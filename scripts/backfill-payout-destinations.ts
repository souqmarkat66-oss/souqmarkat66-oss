import { pool } from "../server/db";
import { encryptPayoutDestination, maskPayoutDestination } from "../server/payoutEncryption";

async function main() {
  if (process.env.BACKFILL_PAYOUT_CONFIRM !== "YES") {
    throw new Error("Refusing payout backfill: set BACKFILL_PAYOUT_CONFIRM=YES after reviewing this script");
  }
  const client = await pool.connect();
  let pendingEncrypted = 0;
  let terminalPurged = 0;
  try {
    await client.query("BEGIN");
    await client.query(
      "SELECT pg_advisory_xact_lock(hashtextextended('payout-destination-backfill:v1', 0))",
    );
    const result = await client.query(
      `SELECT id, status, method, phone_number
       FROM payment_requests
       WHERE type = 'withdrawal'
         AND phone_number IS NOT NULL
         AND phone_number NOT LIKE '%•%'
         AND payout_destination_encrypted IS NULL
       FOR UPDATE`,
    );
    for (const row of result.rows) {
      const destination = String(row.phone_number).trim();
      const last4 = destination.replace(/\D/g, "").slice(-4) || destination.slice(-4);
      const masked = maskPayoutDestination(row.method, destination);
      if (row.status === "pending") {
        const secured = encryptPayoutDestination(destination);
        await client.query(
          `UPDATE payment_requests
           SET phone_number = $2,
               payout_destination_encrypted = $3,
               payout_destination_iv = $4,
               payout_destination_auth_tag = $5,
               payout_destination_last4 = $6
           WHERE id = $1`,
          [row.id, masked, secured.encrypted, secured.iv, secured.authTag, last4],
        );
        pendingEncrypted += 1;
      } else {
        await client.query(
          `UPDATE payment_requests
           SET phone_number = $2, payout_destination_last4 = $3
           WHERE id = $1`,
          [row.id, masked, last4],
        );
        terminalPurged += 1;
      }
    }
    await client.query("COMMIT");
    console.log(JSON.stringify({ pendingEncrypted, terminalPurged }));
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Payout backfill failed");
  process.exit(1);
});