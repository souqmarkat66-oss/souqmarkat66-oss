import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import pg from "pg";
import sharp from "sharp";
import {
  canonicalPaymentReference,
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
  const table = `payment_proof_test_${randomUUID().replace(/-/g, "")}`;
  const quotedTable = `"${table}"`;
  let setupReleased = false;
  try {
    await setup.query(`CREATE TABLE ${quotedTable} (proof_digest text PRIMARY KEY)`);
    setup.release();
    setupReleased = true;
    const clients = [await pool.connect(), await pool.connect()];
    const submit = async (client: pg.PoolClient) => {
      await client.query("BEGIN");
      const [referenceLock, digestLock] = paymentProofLockKeys("ref123", "digest123");
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [referenceLock]);
      await client.query(`SELECT pg_advisory_xact_lock(hashtextextended($1, 0))`, [digestLock]);
      const existing = await client.query(`SELECT 1 FROM ${quotedTable} WHERE proof_digest = $1`, ["digest123"]);
      if (existing.rowCount) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query(`INSERT INTO ${quotedTable} (proof_digest) VALUES ($1)`, ["digest123"]);
      await client.query("COMMIT");
      return true;
    };
    const results = await Promise.all([
      submit(clients[0]),
      submit(clients[1]),
    ]);
    assert.deepEqual(results.sort(), [false, true]);
    await Promise.all(clients.map(client => client.release()));
  } finally {
    await pool.query(`DROP TABLE IF EXISTS ${quotedTable}`);
    if (!setupReleased) setup.release();
    await pool.end();
  }
});