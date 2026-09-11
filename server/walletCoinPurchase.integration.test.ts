import { strict as assert } from "node:assert";
import test from "node:test";
import pg from "pg";
import { purchaseCoinsWithWallet } from "./walletCoinPurchase";

const enabled = process.env.WALLET_COIN_PURCHASE_DB_TEST === "1"
  && process.env.NODE_ENV === "development"
  && !!process.env.DATABASE_URL;

test("wallet coin purchase debits EGP and credits coins atomically", { skip: !enabled }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // Temporary tables make this safe for a development database: no
    // application tables or production rows are touched.
    await client.query(`
      CREATE TEMP TABLE coin_packages (
        id integer PRIMARY KEY,
        name text NOT NULL,
        coins integer NOT NULL,
        price_egp numeric(12,2) NOT NULL,
        bonus_coins integer DEFAULT 0,
        is_active boolean DEFAULT true
      );
      CREATE TEMP TABLE revenue_transactions (
        id serial PRIMARY KEY,
        user_id text NOT NULL,
        type text NOT NULL,
        amount_egp numeric(12,2) NOT NULL,
        description text
      );
      CREATE TEMP TABLE coin_wallets (
        user_id text PRIMARY KEY,
        balance integer NOT NULL DEFAULT 0,
        total_spent integer NOT NULL DEFAULT 0,
        total_earned integer NOT NULL DEFAULT 0,
        updated_at timestamp DEFAULT now()
      );
      CREATE TEMP TABLE coin_transactions (
        id serial PRIMARY KEY,
        user_id text NOT NULL,
        type text NOT NULL,
        coins integer NOT NULL,
        description text
      );
      CREATE TEMP TABLE wallet_coin_purchases (
        id serial PRIMARY KEY,
        user_id text NOT NULL,
        package_id integer NOT NULL,
        coins integer NOT NULL,
        amount_egp numeric(12,2) NOT NULL,
        idempotency_key text NOT NULL,
        revenue_transaction_id integer NOT NULL,
        coin_transaction_id integer NOT NULL,
        coin_balance integer NOT NULL,
        wallet_balance_egp numeric(12,2) NOT NULL,
        UNIQUE (user_id, idempotency_key)
      )
    `);
    await client.query("INSERT INTO coin_packages VALUES (1, 'اختبار', 100, 10, 25, true), (2, 'أغلى', 500, 100, 0, true)");
    await client.query(
      "INSERT INTO revenue_transactions (user_id, type, amount_egp, description) VALUES ('wallet-test-user', 'earning', 25, 'test seed')",
    );

    const first = await purchaseCoinsWithWallet(client, {
      userId: "wallet-test-user",
      packageId: 1,
      idempotencyKey: "wallet-test-purchase-1",
    });
    assert.equal(first.status, "purchased");
    if (first.status !== "purchased") return;
    assert.equal(first.coins, 125);
    assert.equal(first.amountEGP, 10);
    assert.equal(first.coinBalance, 125);
    assert.equal(first.walletBalanceEGP, 15);

    const retry = await purchaseCoinsWithWallet(client, {
      userId: "wallet-test-user",
      packageId: 1,
      idempotencyKey: "wallet-test-purchase-1",
    });
    assert.equal(retry.status, "already_processed");
    if (retry.status !== "already_processed") return;
    assert.equal(retry.coinBalance, 125);
    assert.equal(retry.walletBalanceEGP, 15);

    // Reusing a committed key for a different package is not a retry of the
    // original intent. It must be rejected without touching either ledger.
    const conflictingRetry = await purchaseCoinsWithWallet(client, {
      userId: "wallet-test-user",
      packageId: 2,
      idempotencyKey: "wallet-test-purchase-1",
    });
    assert.deepEqual(conflictingRetry, {
      status: "idempotency_conflict",
      purchaseId: first.purchaseId,
      requestedPackageId: 2,
      processedPackageId: 1,
    });

    const ledgerCounts = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM revenue_transactions WHERE type = 'spending') AS spending,
        (SELECT COUNT(*) FROM coin_transactions WHERE type = 'purchase') AS purchases,
        (SELECT COUNT(*) FROM wallet_coin_purchases) AS idempotency_rows,
        (SELECT balance FROM coin_wallets WHERE user_id = 'wallet-test-user') AS coins
    `);
    assert.deepEqual(ledgerCounts.rows[0], {
      spending: "1",
      purchases: "1",
      idempotency_rows: "1",
      coins: 125,
    });

    // The insufficient-funds branch rolls back its transaction and leaves all
    // three ledgers untouched.
    const insufficient = await purchaseCoinsWithWallet(client, {
      userId: "wallet-test-user",
      packageId: 2,
      idempotencyKey: "wallet-test-purchase-2",
    });
    assert.deepEqual(insufficient, {
      status: "insufficient_balance",
      requiredEGP: 100,
      walletBalanceEGP: 15,
    });
    const afterRollback = await client.query(`
      SELECT
        (SELECT COUNT(*) FROM revenue_transactions WHERE type = 'spending') AS spending,
        (SELECT COUNT(*) FROM coin_transactions WHERE type = 'purchase') AS purchases,
        (SELECT COUNT(*) FROM wallet_coin_purchases) AS idempotency_rows,
        (SELECT balance FROM coin_wallets WHERE user_id = 'wallet-test-user') AS coins
    `);
    assert.deepEqual(afterRollback.rows[0], {
      spending: "1",
      purchases: "1",
      idempotency_rows: "1",
      coins: 125,
    });
  } finally {
    // Explicit rollback is a final guard if this test is interrupted before
    // the temporary session is released.
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    await pool.end();
  }
});