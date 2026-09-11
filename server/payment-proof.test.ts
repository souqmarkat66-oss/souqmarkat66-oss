import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import pg from "pg";
import sharp from "sharp";
import {
  canonicalPaymentReference,
  canonicalPaymentReferenceSql,
  outgoingTransferReferenceLockKey,
  paymentProofLockKeys,
  digestOwnedPaymentProof,
} from "./payment-proof";

test("canonical payment references collapse case, separators, and Arabic/Persian digits", () => {
  assert.equal(
    canonicalPaymentReference("  Ref-١٢٣ / A.B  "),
    canonicalPaymentReference("ref۱۲۳ab"),
  );
  assert.equal(canonicalPaymentReference("ＡＢ－１２３"), "ab123");
  assert.equal(canonicalPaymentReference("... ---"), "");
  assert.match(canonicalPaymentReferenceSql("payment_ref"), /normalize\(coalesce\(payment_ref, ''\), NFKC\)/);
  assert.equal(
    outgoingTransferReferenceLockKey(canonicalPaymentReference(" OUT-１２٣ ")),
    "manual-outgoing-transfer-ref:out123",
  );
});

test("orientation-normalized pixel digest is stable across metadata-only reuploads", async () => {
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const firstName = `payment-proof-test-${randomUUID()}.png`;
  const secondName = `payment-proof-test-${randomUUID()}.png`;
  const firstPath = path.join(uploadsDir, firstName);
  const secondPath = path.join(uploadsDir, secondName);
  try {
    const source = await sharp({
      create: {
        width: 3,
        height: 2,
        channels: 4,
        background: { r: 240, g: 180, b: 20, alpha: 1 },
      },
    }).png().toBuffer();
    const metadataVariant = await sharp(source)
      .withMetadata({ density: 144 })
      .png()
      .toBuffer();
    await writeFile(firstPath, source);
    await writeFile(secondPath, metadataVariant);
    const [firstInfo, secondInfo] = await Promise.all([stat(firstPath), stat(secondPath)]);
    const firstDigest = await digestOwnedPaymentProof(`/uploads/${firstName}`, {
      filename: firstName,
      mimeType: "image/png",
      size: firstInfo.size,
    });
    const secondDigest = await digestOwnedPaymentProof(`/uploads/${secondName}`, {
      filename: secondName,
      mimeType: "image/png",
      size: secondInfo.size,
    });
    assert.equal(firstDigest, secondDigest);
    assert.deepEqual(
      paymentProofLockKeys(canonicalPaymentReference("Ref-١٢٣"), firstDigest),
      paymentProofLockKeys(canonicalPaymentReference("ref۱۲۳"), secondDigest),
    );
  } finally {
    await Promise.all([rm(firstPath, { force: true }), rm(secondPath, { force: true })]);
  }
});

const dbTestEnabled = process.env.PAYMENT_PROOF_DB_TEST === "1"
  && process.env.NODE_ENV === "development"
  && !!process.env.DATABASE_URL;

test("concurrent cross-flow proof submissions serialize on the same ref/digest", { skip: !dbTestEnabled }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const setup = await pool.connect();
  const schema = `payment_proof_test_${randomUUID().replace(/-/g, "")}`;
  const quotedSchema = `"${schema}"`;
  const qualifiedTable = `${quotedSchema}."orders"`;
  let setupReleased = false;
  try {
    // A fresh schema, rather than application tables or a connection-local
    // TEMP table, lets concurrent pool clients exercise the real lock path.
    await setup.query(`CREATE SCHEMA ${quotedSchema}`);
    await setup.query(`CREATE TABLE ${qualifiedTable} (
      source text NOT NULL,
      payment_ref text NOT NULL,
      proof_digest text,
      UNIQUE (payment_ref),
      UNIQUE (proof_digest)
    )`);
    setup.release();
    setupReleased = true;
    const clients = [await pool.connect(), await pool.connect()];
    const submit = async (client: pg.PoolClient, source: string) => {
      await client.query("BEGIN");
      const [referenceLock, digestLock] = paymentProofLockKeys("ref123", "digest123");
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [referenceLock]);
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [digestLock]);
      const existing = await client.query(
        `SELECT 1 FROM ${qualifiedTable} WHERE payment_ref = $1 OR proof_digest = $2`,
        ["ref123", "digest123"],
      );
      if (existing.rowCount) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query(
        `INSERT INTO ${qualifiedTable} (source, payment_ref, proof_digest) VALUES ($1, $2, $3)`,
        [source, "ref123", "digest123"],
      );
      await client.query("COMMIT");
      return true;
    };
    const results = await Promise.all([
      submit(clients[0], "payment_request"),
      submit(clients[1], "coin_purchase_order"),
    ]);
    assert.deepEqual(results.sort(), [false, true]);
    await Promise.all(clients.map(client => client.release()));
  } finally {
    await pool.query(`DROP SCHEMA IF EXISTS ${quotedSchema} CASCADE`);
    if (!setupReleased) setup.release();
    await pool.end();
  }
});