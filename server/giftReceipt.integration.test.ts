import { strict as assert } from "node:assert";
import test from "node:test";
import pg from "pg";

const enabled = process.env.WALLET_COIN_PURCHASE_DB_TEST === "1"
  && process.env.NODE_ENV === "development"
  && !!process.env.DATABASE_URL;

test("gift receipt increases earned coins without increasing spendable balance", { skip: !enabled }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // Use only a temporary table in the explicitly opted-in development
    // database. No production wallet or gift event is touched.
    await client.query(`
      CREATE TEMP TABLE coin_wallets (
        user_id text PRIMARY KEY,
        balance integer NOT NULL DEFAULT 0,
        total_spent integer NOT NULL DEFAULT 0,
        total_earned integer NOT NULL DEFAULT 0,
        updated_at timestamp DEFAULT now()
      )
    `);
    await client.query(
      `INSERT INTO coin_wallets (user_id, balance, total_spent, total_earned)
       VALUES ('gift-recipient', 40, 12, 77)`,
    );

    const receipt = await client.query(
      `INSERT INTO coin_wallets (user_id, balance, total_spent, total_earned)
       VALUES ($1, 0, 0, $2::int)
       ON CONFLICT (user_id) DO UPDATE
       SET total_earned = coin_wallets.total_earned + $2::int,
           updated_at = NOW()
       RETURNING balance, total_spent, total_earned`,
      ["gift-recipient", 30],
    );
    assert.deepEqual(receipt.rows[0], {
      balance: 40,
      total_spent: 12,
      total_earned: 107,
    });

    const secondReceipt = await client.query(
      `INSERT INTO coin_wallets (user_id, balance, total_spent, total_earned)
       VALUES ($1, 0, 0, $2::int)
       ON CONFLICT (user_id) DO UPDATE
       SET total_earned = coin_wallets.total_earned + $2::int,
           updated_at = NOW()
       RETURNING balance, total_spent, total_earned`,
      ["gift-recipient", 18],
    );
    assert.deepEqual(secondReceipt.rows[0], {
      balance: 40,
      total_spent: 12,
      total_earned: 125,
    });
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    await pool.end();
  }
});

test("gift EGP credit uses explicit text casts for mixed legacy user-id types", { skip: !enabled }, async () => {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    // This reproduces the deployed legacy shape in isolated temporary tables:
    // revenue_transactions.user_id is text while channels.user_id is varchar.
    await client.query("BEGIN");
    await client.query(`
      CREATE TEMP TABLE channels (
        id integer PRIMARY KEY,
        user_id varchar NOT NULL
      );
      CREATE TEMP TABLE revenue_transactions (
        id serial PRIMARY KEY,
        user_id text NOT NULL,
        type text NOT NULL,
        amount_egp real NOT NULL,
        description text,
        channel_id integer
      )
    `);
    await client.query(`INSERT INTO channels (id, user_id) VALUES (7, 'gift-recipient')`);

    await client.query(
      `INSERT INTO revenue_transactions (user_id, type, amount_egp, description, channel_id)
       VALUES ($1::text, 'earning', $2, $3,
         (SELECT id FROM channels WHERE channels.user_id::text = $1::text LIMIT 1))`,
      ["gift-recipient", 1.8, "gift earning"],
    );
    const result = await client.query(
      `SELECT user_id, amount_egp, channel_id FROM revenue_transactions`,
    );
    assert.deepEqual(result.rows, [{
      user_id: "gift-recipient",
      amount_egp: 1.8,
      channel_id: 7,
    }]);
  } finally {
    await client.query("ROLLBACK").catch(() => {});
    client.release();
    await pool.end();
  }
});