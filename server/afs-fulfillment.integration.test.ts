import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import express, { type Express, type RequestHandler } from "express";
import pg from "pg";
import { AFS_LIVE_URL } from "./afsEnvironment";

function developmentDatabaseUrl(): string {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("AFS fulfillment integration tests may only run with NODE_ENV=development");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("AFS fulfillment integration tests require DATABASE_URL");
  }
  return process.env.DATABASE_URL;
}

function urlWithSearchPath(databaseUrl: string, schema: string): string {
  const url = new URL(databaseUrl);
  const existingOptions = url.searchParams.get("options");
  url.searchParams.set(
    "options",
    `${existingOptions ? `${existingOptions} ` : ""}-c search_path=${schema}`,
  );
  return url.toString();
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

/**
 * Keep the fixture on the checked-in schema rather than creating a reduced
 * mock.  The production verifier consequently exercises the real constraints,
 * transaction, and ledger tables in an isolated schema.
 */
async function createFixtureSchema(client: pg.PoolClient, schema: string): Promise<void> {
  const migrationFiles = [
    "0000_schema_baseline.sql",
    "0001_existing_schema_reconciliation.sql",
    "0002_password_reset_challenges.sql",
    "0003_secret_vault.sql",
    "0004_email_only_password_recovery.sql",
    "0005_user_auth_generation.sql",
    "0006_encrypted_payout_destinations.sql",
    "0007_wallet_coin_purchases.sql",
    "0008_legacy_manual_coin_wallet_fields.sql",
    "0009_manual_order_lifecycle_and_ai_credits.sql",
    "0010_ai_media_jobs.sql",
  ];
  for (const file of migrationFiles) {
    let sql = await readFile(new URL(`../migrations/${file}`, import.meta.url), "utf8");
    if (file === "0000_schema_baseline.sql") {
      // The baseline was authored for public; an isolated fixture must keep
      // all of its foreign keys inside the randomly named test schema.
      sql = sql.replaceAll('"public".', "");
    }
    if (file === "0001_existing_schema_reconciliation.sql") {
      sql = sql.replace("'public.ticker_ads'::regclass", `'${schema}.ticker_ads'::regclass`);
    }
    await client.query(sql);
  }
}

type CapturedRoute = {
  method: "post";
  path: string;
  handlers: RequestHandler[];
};

/**
 * Register routes without starting the application.  Only the exact
 * production verification route is mounted on the real HTTP harness below.
 */
function recordingApp(): { app: Express; routes: CapturedRoute[] } {
  const routes: CapturedRoute[] = [];
  let app: Express;
  app = new Proxy({}, {
    get: (_target, property) => {
      const method = String(property);
      if (method === "post") {
        return (path: string, ...handlers: RequestHandler[]) => {
          if (typeof path === "string") routes.push({ method, path, handlers });
          return app;
        };
      }
      return () => app;
    },
  }) as Express;
  return { app, routes };
}

function capturedVerifyRoute(routes: CapturedRoute[]): CapturedRoute {
  const route = routes.find(
    candidate => candidate.method === "post" && candidate.path === "/api/payments/afs/:id/verify",
  );
  assert.ok(route, "production AFS verification route was not registered");
  return route;
}

async function startHttpHarness(routes: CapturedRoute[], userId: string): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.session = {
      customUser: {
        id: userId,
        email: `${userId}@example.test`,
        phone: null,
        firstName: "AFS",
        lastName: "Integration",
        profileImageUrl: null,
        authGeneration: 0,
      },
    };
    next();
  });

  const route = capturedVerifyRoute(routes);
  app.post(route.path, ...route.handlers);

  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string", "AFS HTTP harness did not receive a TCP port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}

async function verifyHttp(baseUrl: string, id: number): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}/api/payments/afs/${id}/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
  const text = await response.text();
  try {
    return { status: response.status, body: JSON.parse(text) };
  } catch {
    throw new Error(`AFS verification returned non-JSON ${response.status}: ${text.slice(0, 200)}`);
  }
}

test("LIVE AFS verification fulfills wallet and coin orders exactly once", async () => {
  const baseDatabaseUrl = developmentDatabaseUrl();
  const schema = `afs_fulfillment_test_${randomUUID().replaceAll("-", "")}`;
  const schemaSql = quoteIdentifier(schema);
  const fixturePool = new pg.Pool({ connectionString: baseDatabaseUrl });
  const originalEnv = {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    SESSION_SECRET: process.env.SESSION_SECRET,
    REPL_ID: process.env.REPL_ID,
    AFS_BASE_URL: process.env.AFS_BASE_URL,
    AFS_ENTITY_ID: process.env.AFS_ENTITY_ID,
    AFS_ACCESS_TOKEN: process.env.AFS_ACCESS_TOKEN,
  };
  let applicationPool: pg.Pool | undefined;
  let httpHarness: Awaited<ReturnType<typeof startHttpHarness>> | undefined;
  const userId = "afs-fulfillment-user";
  const entityId = "test-afs-entity";
  const providerCalls: string[] = [];
  const providerResponses = new Map<string, Record<string, unknown>>();
  const originalFetch = global.fetch;

  const restoreEnv = () => {
    if (originalEnv.DATABASE_URL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalEnv.DATABASE_URL;
    if (originalEnv.NODE_ENV === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv.NODE_ENV;
    if (originalEnv.SESSION_SECRET === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalEnv.SESSION_SECRET;
    if (originalEnv.REPL_ID === undefined) delete process.env.REPL_ID;
    else process.env.REPL_ID = originalEnv.REPL_ID;
    if (originalEnv.AFS_BASE_URL === undefined) delete process.env.AFS_BASE_URL;
    else process.env.AFS_BASE_URL = originalEnv.AFS_BASE_URL;
    if (originalEnv.AFS_ENTITY_ID === undefined) delete process.env.AFS_ENTITY_ID;
    else process.env.AFS_ENTITY_ID = originalEnv.AFS_ENTITY_ID;
    if (originalEnv.AFS_ACCESS_TOKEN === undefined) delete process.env.AFS_ACCESS_TOKEN;
    else process.env.AFS_ACCESS_TOKEN = originalEnv.AFS_ACCESS_TOKEN;
  };

  try {
    await fixturePool.query(`CREATE SCHEMA ${schemaSql}`);
    const fixtureClient = await fixturePool.connect();
    try {
      await fixtureClient.query(`SET search_path TO ${schemaSql}`);
      await createFixtureSchema(fixtureClient, schema);
      await fixtureClient.query(
        "INSERT INTO users (id, email, auth_generation) VALUES ($1, $2, 0)",
        [userId, `${userId}@example.test`],
      );
      await fixtureClient.query(
        `INSERT INTO coin_packages (id, name, coins, bonus_coins, price_egp, is_active)
         VALUES (7, 'AFS integration package', 60, 15, 10, true)`,
      );
    } finally {
      fixtureClient.release();
    }

    // Production mode is intentional here: it proves the verifier's Live
    // settlement guard, while the provider credentials are test-only values
    // read from this test process rather than from the developer's vault.
    process.env.NODE_ENV = "production";
    process.env.DATABASE_URL = urlWithSearchPath(baseDatabaseUrl, schema);
    process.env.SESSION_SECRET = "afs-fulfillment-integration-session-secret";
    process.env.AFS_BASE_URL = AFS_LIVE_URL;
    process.env.AFS_ENTITY_ID = entityId;
    process.env.AFS_ACCESS_TOKEN = "test-afs-access-token";
    delete process.env.REPL_ID;

    (global as any).fetch = async (input: unknown, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith("http://127.0.0.1:")) {
        return originalFetch(input as Parameters<typeof fetch>[0], init);
      }
      providerCalls.push(url);
      const match = /\/checkouts\/([^/]+)\/payment/.exec(url);
      assert.ok(match, `unexpected external request from AFS test: ${url}`);
      const checkoutId = decodeURIComponent(match[1]);
      const body = providerResponses.get(checkoutId);
      assert.ok(body, `no mocked AFS response for checkout ${checkoutId}`);
      // Force both concurrent requests to reach the same database lock path.
      if (checkoutId === "wallet-concurrent") {
        await new Promise(resolve => setTimeout(resolve, 15));
      }
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    const { registerRoutes } = await import("./routes");
    const { pool } = await import("./db");
    applicationPool = pool;
    const savedSetInterval = global.setInterval;
    (global as any).setInterval = () => ({ unref() {} });
    try {
      const captured = recordingApp();
      await registerRoutes(createServer(), captured.app);
      httpHarness = await startHttpHarness(captured.routes, userId);
    } finally {
      global.setInterval = savedSetInterval;
    }

    const providerResult = (
      checkoutId: string,
      amount: number,
      overrides: Record<string, unknown> = {},
    ) => {
      providerResponses.set(checkoutId, {
        id: `provider-${checkoutId}`,
        amount,
        currency: "EGP",
        paymentType: "DB",
        authentication: { entityId },
        paymentBrand: "VISA",
        card: { last4Digits: "4242" },
        result: { code: "000.000.000", description: "Approved" },
        ...overrides,
      });
    };

    const insertOrder = async (input: {
      purpose: "wallet_top_up" | "coin_purchase";
      checkoutId: string;
      amount: number;
      coins?: number;
      packageId?: number;
      status?: "pending" | "paid" | "failed";
      serviceReference?: Record<string, unknown> | null;
    }): Promise<number> => {
      const result = await applicationPool!.query(
        `INSERT INTO afs_payment_orders
          (user_id, purpose, package_id, amount_egp, coins, checkout_id, status, service_reference)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
         RETURNING id`,
        [
          userId,
          input.purpose,
          input.packageId ?? null,
          input.amount,
          input.coins ?? null,
          input.checkoutId,
          input.status ?? "pending",
          input.serviceReference ? JSON.stringify(input.serviceReference) : null,
        ],
      );
      return Number(result.rows[0].id);
    };

    // A concurrent double-submit of a successful wallet checkout has one
    // transaction and one balance credit, even though the provider is queried
    // twice before the row lock is acquired.
    const walletId = await insertOrder({
      purpose: "wallet_top_up",
      checkoutId: "wallet-concurrent",
      amount: 25,
    });
    providerResult("wallet-concurrent", 25);
    const concurrentWallet = await Promise.all([
      verifyHttp(httpHarness.url, walletId),
      verifyHttp(httpHarness.url, walletId),
    ]);
    assert.deepEqual(concurrentWallet.map(result => result.status), [200, 200]);
    assert.deepEqual(concurrentWallet.map(result => result.body.status).sort(), ["paid", "paid"]);

    // A normal verification followed by another pair of retries must not
    // duplicate a successful coin-package credit.
    const coinId = await insertOrder({
      purpose: "coin_purchase",
      checkoutId: "coin-duplicate",
      amount: 10,
      coins: 75,
      packageId: 7,
    });
    providerResult("coin-duplicate", 10);
    const firstCoin = await verifyHttp(httpHarness.url, coinId);
    assert.equal(firstCoin.status, 200);
    assert.equal(firstCoin.body.status, "paid");
    const duplicateCoin = await Promise.all([
      verifyHttp(httpHarness.url, coinId),
      verifyHttp(httpHarness.url, coinId),
    ]);
    assert.deepEqual(duplicateCoin.map(result => result.status), [200, 200]);
    assert.deepEqual(duplicateCoin.map(result => result.body.status).sort(), ["paid", "paid"]);

    // Provider outcomes that are not an exact, successful Live charge must not
    // create either kind of balance or ledger entry.
    const pendingId = await insertOrder({
      purpose: "wallet_top_up",
      checkoutId: "wallet-pending",
      amount: 15,
    });
    providerResult("wallet-pending", 15, {
      result: { code: "000.200.000", description: "Pending" },
    });
    const pending = await verifyHttp(httpHarness.url, pendingId);
    assert.equal(pending.status, 200);
    assert.equal(pending.body.status, "pending");

    const failedId = await insertOrder({
      purpose: "wallet_top_up",
      checkoutId: "wallet-failed",
      amount: 20,
    });
    providerResult("wallet-failed", 20, {
      result: { code: "100.100.101", description: "Declined" },
    });
    const failed = await verifyHttp(httpHarness.url, failedId);
    assert.equal(failed.status, 200);
    assert.equal(failed.body.status, "failed");
    assert.equal(failed.body.serviceActivated, false);
    const failedRetry = await verifyHttp(httpHarness.url, failedId);
    assert.equal(failedRetry.status, 200);
    assert.equal(failedRetry.body.status, "failed");

    const mismatchId = await insertOrder({
      purpose: "coin_purchase",
      checkoutId: "coin-mismatch",
      amount: 10,
      coins: 75,
      packageId: 7,
    });
    providerResult("coin-mismatch", 9.99, {
      // The success code alone is not sufficient: this entity is not ours.
      authentication: { entityId: "another-test-entity" },
    });
    const mismatch = await verifyHttp(httpHarness.url, mismatchId);
    assert.equal(mismatch.status, 200);
    assert.equal(mismatch.body.status, "failed");
    assert.equal(mismatch.body.reasonCode, "verification_failed");

    const sandboxId = await insertOrder({
      purpose: "wallet_top_up",
      checkoutId: "wallet-sandbox",
      amount: 35,
      serviceReference: { _afsEnvironment: "test" },
    });
    providerResult("wallet-sandbox", 35);
    const sandbox = await verifyHttp(httpHarness.url, sandboxId);
    assert.equal(sandbox.status, 409);
    assert.equal(providerCalls.filter(url => url.includes("wallet-sandbox")).length, 0);

    const walletState = await applicationPool.query(
      `SELECT
         COALESCE((SELECT SUM(amount_egp) FROM revenue_transactions
                   WHERE user_id = $1 AND type = 'wallet_recharge'), 0)::numeric AS balance,
         (SELECT COUNT(*)::int FROM revenue_transactions
          WHERE user_id = $1 AND type = 'wallet_recharge') AS recharges`,
      [userId],
    );
    assert.deepEqual(walletState.rows[0], { balance: "25.0000000000", recharges: 1 });
    const coinState = await applicationPool.query(
      `SELECT
         COALESCE((SELECT balance FROM coin_wallets WHERE user_id = $1), 0)::int AS balance,
         (SELECT COUNT(*)::int FROM coin_transactions
          WHERE user_id = $1 AND type = 'purchase') AS purchases`,
      [userId],
    );
    assert.deepEqual(coinState.rows[0], { balance: 75, purchases: 1 });

    const untouched = await applicationPool.query(
      `SELECT checkout_id, status, coin_transaction_id, revenue_transaction_id
       FROM afs_payment_orders
       WHERE id IN ($1, $2, $3, $4)
       ORDER BY id`,
      [pendingId, failedId, mismatchId, sandboxId],
    );
    assert.deepEqual(untouched.rows, [
      { checkout_id: "wallet-pending", status: "pending", coin_transaction_id: null, revenue_transaction_id: null },
      { checkout_id: "wallet-failed", status: "failed", coin_transaction_id: null, revenue_transaction_id: null },
      { checkout_id: "coin-mismatch", status: "failed", coin_transaction_id: null, revenue_transaction_id: null },
      { checkout_id: "wallet-sandbox", status: "pending", coin_transaction_id: null, revenue_transaction_id: null },
    ]);
    assert.equal(providerCalls.filter(url => url.includes("wallet-concurrent")).length, 2);
    assert.equal(providerCalls.filter(url => url.includes("coin-duplicate")).length, 1);
  } finally {
    global.fetch = originalFetch;
    await httpHarness?.close().catch(() => undefined);
    await applicationPool?.end().catch(() => undefined);
    restoreEnv();
    await fixturePool.query(`DROP SCHEMA IF EXISTS ${schemaSql} CASCADE`).catch(() => undefined);
    await fixturePool.end();
  }
});