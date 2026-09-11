import { strict as assert } from "node:assert";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import test from "node:test";
import path from "node:path";
import express, { type Express, type RequestHandler } from "express";
import pg from "pg";
import sharp from "sharp";
import { insertPaymentRequestSchema } from "@shared/schema";
import { resolveManualPaymentPrice } from "./manual-payment";
import { LIVE_PAYMENT_METHODS } from "../client/src/lib/live-payment-method";
import { decryptPayoutDestination, encryptPayoutDestination } from "./payoutEncryption";
import { digestOwnedPaymentProof } from "./payment-proof";

function developmentDatabaseUrl(): string {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("manual-payment integration tests may only run with NODE_ENV=development");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("manual-payment integration tests require DATABASE_URL");
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
 * This is the small, current-schema slice used by DatabaseStorage's manual
 * payment methods.  It lives in a randomly named schema, never in public.
 * The lifecycle migration itself is also applied below so legacy handling is
 * tested from the checked-in migration rather than reimplemented in a mock.
 */
async function createManualPaymentFixture(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE users (
      id varchar PRIMARY KEY,
      email varchar UNIQUE,
      first_name varchar,
      last_name varchar,
      auth_generation integer NOT NULL DEFAULT 0,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
    CREATE TABLE ads (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      title text,
      description text,
      media_url text,
      media_type text,
      is_boosted boolean DEFAULT false,
      boosted_until timestamp,
      status text DEFAULT 'active',
      expires_at timestamp,
      is_admin_promo boolean DEFAULT false
    );
    CREATE TABLE live_streams (
      id serial PRIMARY KEY,
      status text,
      started_at timestamp,
      ended_at timestamp
    );
    CREATE TABLE platform_settings (
      id serial PRIMARY KEY,
      key text NOT NULL UNIQUE,
      value text NOT NULL,
      updated_at timestamp DEFAULT now()
    );
    CREATE TABLE revenue_transactions (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      type text NOT NULL,
       amount_egp numeric(24,10) NOT NULL,
      description text,
      campaign_id integer,
      channel_id integer,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE ai_usage (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      type text NOT NULL,
      credits_used integer DEFAULT 1,
      cost real DEFAULT 0,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE ai_credit_wallets (
      user_id varchar PRIMARY KEY REFERENCES users(id),
      balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
      total_purchased integer NOT NULL DEFAULT 0 CHECK (total_purchased >= 0),
      total_consumed integer NOT NULL DEFAULT 0 CHECK (total_consumed >= 0),
      updated_at timestamp NOT NULL DEFAULT now()
    );
    CREATE TABLE coin_wallets (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL UNIQUE REFERENCES users(id),
      balance integer NOT NULL DEFAULT 0,
      total_spent integer NOT NULL DEFAULT 0,
      total_earned integer NOT NULL DEFAULT 0,
      updated_at timestamp DEFAULT now()
    );
    CREATE TABLE coin_transactions (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      type text NOT NULL,
      coins integer NOT NULL,
      description text,
      related_stream_id integer,
      related_user_id varchar,
      recharge_code_id integer,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE payment_requests (
      id serial PRIMARY KEY,
      order_number text UNIQUE,
      user_id varchar NOT NULL REFERENCES users(id),
      ad_id integer,
      type text NOT NULL,
      amount_egp real NOT NULL,
      method text NOT NULL,
      phone_number text,
      payment_ref text,
      canonical_payment_ref text,
      proof_digest text,
      payout_name text,
      payout_destination_encrypted text,
      payout_destination_iv text,
      payout_destination_auth_tag text,
      payout_destination_last4 text,
      service_type text,
      service_quantity integer,
      service_package_id integer,
      screenshot_url text,
      status text DEFAULT 'pending',
      admin_note text,
      fulfillment_status text,
      fulfillment_note text,
      fulfillment_result text,
      fulfillment_by varchar,
      fulfilled_at timestamp,
      transfer_reference text,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE coin_purchase_orders (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      user_name text,
      package_id integer,
      coins integer NOT NULL,
      amount_egp numeric(12,2) NOT NULL,
      payment_method text NOT NULL,
      payment_ref text,
      canonical_payment_ref text,
      proof_digest text,
      screenshot_url text,
      status text NOT NULL DEFAULT 'pending',
      admin_note text,
      created_at timestamp DEFAULT now(),
      reviewed_at timestamp,
      reviewed_by text
    );
    CREATE TABLE wallet_top_up_orders (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      amount_egp real NOT NULL,
      payment_method text NOT NULL,
      payment_ref text,
      screenshot_url text,
      status text NOT NULL DEFAULT 'pending',
      admin_note text,
      order_number text,
      reviewed_at timestamp,
      reviewed_by varchar,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE payment_service_deliveries (
      id serial PRIMARY KEY,
      payment_request_id integer NOT NULL REFERENCES payment_requests(id) ON DELETE CASCADE,
      service_type text NOT NULL,
      status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
      delivery_note text,
      delivery_result text,
      completed_by varchar REFERENCES users(id) ON DELETE SET NULL,
      completed_at timestamp,
      created_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT payment_service_deliveries_request_service_unique
        UNIQUE(payment_request_id, service_type)
    );
    CREATE TABLE notifications (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      type text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      link text,
      voice_url text,
      sender_user_id varchar,
      dedupe_key text UNIQUE,
      is_read boolean DEFAULT false,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE payment_failures (
      id serial PRIMARY KEY,
      dedupe_key text NOT NULL UNIQUE,
      user_id varchar NOT NULL REFERENCES users(id),
      method text NOT NULL,
      service_type text,
      amount_egp numeric(12,2) NOT NULL DEFAULT 0,
      reason_code text NOT NULL,
      reason_message text NOT NULL,
      reference text,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE uploaded_files (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      filename text NOT NULL,
      original_name text NOT NULL,
      mime_type text NOT NULL,
      size integer NOT NULL,
      url text NOT NULL,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE push_subscriptions (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      endpoint text,
      p256dh text,
      auth text
    );
  `);
}

type CapturedRoute = {
  method: "get" | "post" | "put" | "patch";
  path: string;
  handlers: RequestHandler[];
};

/**
 * Register the production route module against a recording app, then mount
 * only the recorded payment routes on a real Express/http server.  This avoids
 * starting the application or providers while exercising the exact production
 * handlers, middleware order, parsing, and database calls over HTTP.
 */
function recordingApp(): { app: Express; routes: CapturedRoute[] } {
  const routes: CapturedRoute[] = [];
  let app: Express;
  app = new Proxy({}, {
    get: (_target, property) => {
      const method = String(property);
      if (method === "get" || method === "post" || method === "put" || method === "patch") {
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

function capturedRoute(routes: CapturedRoute[], method: CapturedRoute["method"], path: string): CapturedRoute {
  const route = routes.find(candidate => candidate.method === method && candidate.path === path);
  assert.ok(route, `production route was not registered: ${method.toUpperCase()} ${path}`);
  return route;
}

async function startPaymentHttpHarness(routes: CapturedRoute[], userId: string, adminId: string): Promise<{
  url: string;
  close: () => Promise<void>;
}> {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const isAdmin = req.header("x-test-identity") === "admin";
    req.session = {
      customUser: {
        id: isAdmin ? adminId : userId,
        email: isAdmin ? "manual-int-admin@example.test" : "manual-int-user@example.test",
        phone: null,
        firstName: isAdmin ? "Admin" : "User",
        lastName: "Integration",
        profileImageUrl: null,
        authGeneration: 0,
      },
    };
    next();
  });
  for (const route of [
    capturedRoute(routes, "post", "/api/payments"),
    capturedRoute(routes, "get", "/api/payments"),
    capturedRoute(routes, "put", "/api/payments/:id"),
    capturedRoute(routes, "put", "/api/admin/payments/:id"),
    capturedRoute(routes, "patch", "/api/admin/wallet-topups/:id"),
    capturedRoute(routes, "post", "/api/ai/talking-avatar"),
  ]) {
    app[route.method](route.path, ...route.handlers);
  }
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string", "HTTP harness did not receive a TCP port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())),
  };
}

async function paymentHttp(
  baseUrl: string,
  method: "GET" | "POST" | "PUT" | "PATCH",
  path: string,
  body?: Record<string, unknown>,
  identity: "user" | "admin" = "user",
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-test-identity": identity,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

test("manual payment storage lifecycle uses an isolated development schema", async () => {
  const baseDatabaseUrl = developmentDatabaseUrl();
  const schema = `manual_payment_test_${randomUUID().replaceAll("-", "")}`;
  const schemaSql = quoteIdentifier(schema);
  const fixturePool = new pg.Pool({ connectionString: baseDatabaseUrl });
  const originalPayoutKey = process.env.SECRET_VAULT_MASTER_KEY;
  const originalAdminUserId = process.env.ADMIN_USER_ID;
  const originalReplId = process.env.REPL_ID;
  let applicationPool: pg.Pool | undefined;
  let httpHarness: Awaited<ReturnType<typeof startPaymentHttpHarness>> | undefined;
  let proofFilePath: string | undefined;
  let otherAvatarFilePath: string | undefined;

  try {
    await fixturePool.query(`CREATE SCHEMA ${schemaSql}`);
    const fixtureClient = await fixturePool.connect();
    try {
      await fixtureClient.query(`SET search_path TO ${schemaSql}`);
      await createManualPaymentFixture(fixtureClient);

      // An old approved row must be visible for review, but must not be replayed.
      await fixtureClient.query(`
        INSERT INTO users (id, email) VALUES
          ('manual-int-user', 'manual-int-user@example.test');
        INSERT INTO payment_requests
          (order_number, user_id, type, amount_egp, method, service_type, status)
        VALUES
          ('legacy-approved-order', 'manual-int-user', 'top_up', 99, 'vodafone', 'wallet_recharge', 'approved');
      `);
      const lifecycleMigration = await readFile(
        new URL("../migrations/0009_manual_order_lifecycle_and_ai_credits.sql", import.meta.url),
        "utf8",
      );
      await fixtureClient.query(lifecycleMigration);
    } finally {
      fixtureClient.release();
    }

    // db.ts constructs its production pool on module import.  Point that pool
    // at only this schema before importing DatabaseStorage.
    process.env.DATABASE_URL = urlWithSearchPath(baseDatabaseUrl, schema);
    // Do not depend on, validate, or expose a developer's configured vault
    // secret. This key exists only for the in-process encrypted-fixture check.
    process.env.SECRET_VAULT_MASTER_KEY = "a".repeat(64);
    const { DatabaseStorage } = await import("./storage");
    const { pool } = await import("./db");
    applicationPool = pool;
    const storage = new DatabaseStorage();
    const userId = "manual-int-user";
    const adminId = "manual-int-admin";
    await applicationPool.query(
      "INSERT INTO users (id, email) VALUES ($1, $2)",
      [adminId, "manual-int-admin@example.test"],
    );
    await applicationPool.query(`
      INSERT INTO platform_settings (key, value) VALUES
        ('ai_price_per_credit_egp', '5'),
        ('campaign_min_budget_egp', '100'),
        ('wallet_min_withdrawal_egp', '10')
    `);

    const legacyRows = await applicationPool.query(
      "SELECT fulfillment_status FROM payment_requests WHERE order_number = $1",
      ["legacy-approved-order"],
    );
    // Forward-only migration does not rewrite production history. Reads label
    // an evidence-free approved row for review instead.
    assert.equal(legacyRows.rows[0].fulfillment_status, null);
    assert.equal(
      (await storage.getPaymentRequests(userId)).find((row) => row.orderNumber === "legacy-approved-order")?.fulfillmentStatus,
      "legacy_review",
    );
    const legacyReplay = await storage.approvePaymentRequestAtomic(1, "do not replay", undefined, adminId);
    assert.equal(legacyReplay.alreadyProcessed, true);
    assert.equal(await storage.getAiCreditBalance(userId), 0);

    const precisionUserId = "manual-int-precision";
    await applicationPool.query(
      "INSERT INTO users (id, email) VALUES ($1, $2)",
      [precisionUserId, "manual-int-precision@example.test"],
    );
    await storage.createTransaction({
      userId: precisionUserId,
      type: "earning",
      amountEGP: 1_000_000.01,
      description: "large precision earning",
      campaignId: null,
      channelId: null,
    });
    await storage.createTransaction({
      userId: precisionUserId,
      type: "earning",
      amountEGP: 0.009,
      description: "fractional precision earning",
      campaignId: null,
      channelId: null,
    });
    const precisionBalance = await storage.getUserBalanceEGP(precisionUserId);
    assert.ok(Math.abs(precisionBalance - 1_000_000.019) < 1e-9);

    // Submit and approve a wallet recharge.  Retrying the admin action may not
    // write a second credit transaction.
    const walletPrice = resolveManualPaymentPrice({}, "wallet_recharge", 1, "75.50");
    const walletRecharge = await storage.createPaymentRequest(insertPaymentRequestSchema.parse({
      orderNumber: "wallet-recharge-order",
      userId,
      type: "top_up",
      amountEGP: walletPrice.amountEGP,
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "wallet-recharge-reference",
      serviceType: walletPrice.services.join(","),
      serviceQuantity: walletPrice.quantity,
    }));
    const walletApproved = await storage.approvePaymentRequestAtomic(walletRecharge.id, "verified", undefined, adminId);
    assert.equal(walletApproved.alreadyProcessed, false);
    assert.equal(walletApproved.payment?.status, "approved");
    assert.equal(walletApproved.payment?.fulfillmentStatus, "fulfilled");
    assert.equal(await storage.getUserBalanceEGP(userId), 75.5);
    assert.deepEqual(
      (await storage.getPaymentServiceDeliveries(walletRecharge.id)).map(({ serviceType, status }) => ({ serviceType, status })),
      [{ serviceType: "wallet_recharge", status: "completed" }],
    );
    const walletReplay = await storage.approvePaymentRequestAtomic(walletRecharge.id, "replayed", undefined, adminId);
    assert.equal(walletReplay.alreadyProcessed, true);
    const walletEntries = await applicationPool.query(
      "SELECT count(*)::int AS count FROM revenue_transactions WHERE user_id = $1 AND type = 'wallet_recharge'",
      [userId],
    );
    assert.equal(walletEntries.rows[0].count, 1);

    // Approved AI credits are purchased credits, then consumed atomically with
    // their ai_usage row (there are no free credits in this scenario).
    const aiPrice = resolveManualPaymentPrice(
      { ai_price_per_credit_egp: "5" },
      "ai_credits",
      3,
      "15.00",
    );
    const aiOrder = await storage.createPaymentRequest(insertPaymentRequestSchema.parse({
      orderNumber: "ai-credit-order",
      userId,
      type: "top_up",
      amountEGP: aiPrice.amountEGP,
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "ai-credit-reference",
      serviceType: aiPrice.services.join(","),
      serviceQuantity: aiPrice.quantity,
    }));
    const aiApproved = await storage.approvePaymentRequestAtomic(aiOrder.id, "verified", undefined, adminId);
    assert.equal(aiApproved.payment?.fulfillmentStatus, "fulfilled");
    assert.equal(await storage.getAiCreditBalance(userId), 3);
    assert.deepEqual(
      await storage.consumeAiCreditAtomic(userId, "image", 0, 5, "integration purchased AI use"),
      { consumed: true, source: "purchased", remainingPurchasedCredits: 2 },
    );
    assert.deepEqual(
      await storage.consumeAiCreditAtomic(userId, "image", 0, 5, "integration purchased AI use"),
      { consumed: true, source: "purchased", remainingPurchasedCredits: 1 },
    );
    assert.deepEqual(
      await storage.consumeAiCreditAtomic(userId, "image", 0, 5, "integration purchased AI use"),
      { consumed: true, source: "purchased", remainingPurchasedCredits: 0 },
    );
    assert.deepEqual(
      await storage.consumeAiCreditAtomic(userId, "image", 0, 5, "integration wallet AI use"),
      { consumed: true, source: "wallet", remainingPurchasedCredits: 0, walletBalanceEGP: 70.5 },
    );
    assert.equal(await storage.getAiUsageCount(userId), 4);

    // Mixed automatic/manual services are partial until the human-delivered
    // item has an explicit delivery record and completion result.
    const mixedPrice = resolveManualPaymentPrice(
      { ai_price_per_credit_egp: "5", campaign_min_budget_egp: "100" },
      "ai_credits,campaign",
      1,
      "105.00",
    );
    const mixedOrder = await storage.createPaymentRequest(insertPaymentRequestSchema.parse({
      orderNumber: "mixed-services-order",
      userId,
      type: "top_up",
      amountEGP: mixedPrice.amountEGP,
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "mixed-services-reference",
      serviceType: mixedPrice.services.join(","),
      serviceQuantity: mixedPrice.quantity,
    }));
    const mixedApproved = await storage.approvePaymentRequestAtomic(mixedOrder.id, "verified", undefined, adminId);
    assert.equal(mixedApproved.payment?.fulfillmentStatus, "partial");
    assert.deepEqual(
      (await storage.getPaymentServiceDeliveries(mixedOrder.id)).map(({ serviceType, status }) => ({ serviceType, status })),
      [{ serviceType: "ai_credits", status: "completed" }, { serviceType: "campaign", status: "pending" }],
    );
    assert.equal(await storage.getAiCreditBalance(userId), 1);
    const delivered = await storage.completePaymentServiceDeliveryAtomic(
      mixedOrder.id,
      "campaign",
      adminId,
      "campaign created",
      "campaign-123",
    );
    assert.equal(delivered.alreadyCompleted, false);
    assert.equal(delivered.payment?.fulfillmentStatus, "fulfilled");
    const deliveryReplay = await storage.completePaymentServiceDeliveryAtomic(mixedOrder.id, "campaign", adminId);
    assert.equal(deliveryReplay.alreadyCompleted, true);

    // The legacy coin-package branch remains one-shot even if an old manual
    // request is replayed by an administrator.
    const coinOrder = await storage.createPaymentRequest({
      orderNumber: "legacy-coin-order",
      userId,
      type: "top_up",
      amountEGP: 50,
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "legacy-coin-reference",
      serviceType: "coin_package",
      serviceQuantity: 25,
      servicePackageId: 42,
    } as any);
    const coinApproved = await storage.approvePaymentRequestAtomic(coinOrder.id, "verified", undefined, adminId);
    assert.equal(coinApproved.payment?.fulfillmentStatus, "fulfilled");
    assert.equal((await storage.approvePaymentRequestAtomic(coinOrder.id, "retry", undefined, adminId)).alreadyProcessed, true);
    const coinState = await applicationPool.query(
      `SELECT
         (SELECT balance FROM coin_wallets WHERE user_id = $1) AS balance,
         (SELECT count(*)::int FROM coin_transactions WHERE user_id = $1 AND type = 'purchase') AS purchases`,
      [userId],
    );
    assert.deepEqual(coinState.rows[0], { balance: 25, purchases: 1 });

    // A rejected request has neither ledger credit nor service delivery, and a
    // second denial cannot change that result.
    const denied = await storage.createPaymentRequest(insertPaymentRequestSchema.parse({
      orderNumber: "denied-order",
      userId,
      type: "top_up",
      amountEGP: 100,
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "denied-reference",
      serviceType: "campaign",
      serviceQuantity: 1,
    }));
    assert.equal((await storage.rejectPaymentRequestAtomic(denied.id, "receipt denied")).payment?.status, "rejected");
    assert.equal((await storage.rejectPaymentRequestAtomic(denied.id, "retry")).alreadyProcessed, true);
    assert.equal((await storage.getPaymentServiceDeliveries(denied.id)).length, 0);

    // Withdrawal remains pending without a transfer reference.  On the
    // explicit execution path, the debit is written and encrypted destination
    // material is irreversibly purged from the request.
    const encryptedDestination = encryptPayoutDestination("01012345678");
    const withdrawalParsed = insertPaymentRequestSchema.parse({
      orderNumber: "withdrawal-order",
      userId,
      type: "withdrawal",
      amountEGP: 40,
      method: "vodafone",
      payoutName: "Test User",
      payoutDestination: "01012345678",
    });
    const { payoutDestination: _payoutDestination, ...withdrawalFields } = withdrawalParsed;
    const withdrawal = await storage.createPaymentRequest({
      ...withdrawalFields,
      payoutDestinationEncrypted: encryptedDestination.encrypted,
      payoutDestinationIv: encryptedDestination.iv,
      payoutDestinationAuthTag: encryptedDestination.authTag,
      payoutDestinationLast4: "5678",
    } as any);
    await storage.createTransaction({
      userId,
      type: "earning",
      amountEGP: 200,
      description: "integration-test earning",
      campaignId: null,
      channelId: null,
    });
    const beforeExecution = await storage.approvePaymentRequestAtomic(withdrawal.id, "ready", undefined, adminId);
    assert.equal(beforeExecution.transferReferenceRequired, true);
    assert.equal(beforeExecution.payment?.status, "pending");
    const pendingPayout = await applicationPool.query(
      `SELECT payout_destination_encrypted, payout_destination_iv, payout_destination_auth_tag
       FROM payment_requests WHERE id = $1`,
      [withdrawal.id],
    );
    assert.notEqual(pendingPayout.rows[0].payout_destination_encrypted, "01012345678");
    assert.equal(decryptPayoutDestination({
      payoutDestinationEncrypted: pendingPayout.rows[0].payout_destination_encrypted,
      payoutDestinationIv: pendingPayout.rows[0].payout_destination_iv,
      payoutDestinationAuthTag: pendingPayout.rows[0].payout_destination_auth_tag,
    }), "01012345678");
    const executed = await storage.approvePaymentRequestAtomic(withdrawal.id, "sent", "transfer-reference-1", adminId);
    assert.equal(executed.payment?.status, "approved");
    assert.equal(executed.payment?.fulfillmentStatus, "fulfilled");
    assert.equal(executed.payment?.transferReference, "transfer-reference-1");
    const purgedPayout = await applicationPool.query(
      `SELECT payout_destination_encrypted, payout_destination_iv, payout_destination_auth_tag
       FROM payment_requests WHERE id = $1`,
      [withdrawal.id],
    );
    assert.deepEqual(purgedPayout.rows[0], {
      payout_destination_encrypted: null,
      payout_destination_iv: null,
      payout_destination_auth_tag: null,
    });
    assert.equal(await storage.getUserBalanceEGP(userId), 230.5);
    assert.equal((await storage.approvePaymentRequestAtomic(withdrawal.id, "retry", "transfer-reference-2", adminId)).alreadyProcessed, true);

    // Capture the production registrations without booting the entire app, then
    // run the exact captured handlers through a real local HTTP server.
    process.env.ADMIN_USER_ID = adminId;
    delete process.env.REPL_ID; // prevents optional OIDC discovery during registration
    const savedSetInterval = global.setInterval;
    (global as any).setInterval = () => ({ unref() {} });
    try {
      const { registerRoutes } = await import("./routes");
      const captured = recordingApp();
      await registerRoutes(createServer(), captured.app);
      httpHarness = await startPaymentHttpHarness(captured.routes, userId, adminId);
    } finally {
      global.setInterval = savedSetInterval;
      if (originalReplId === undefined) delete process.env.REPL_ID;
      else process.env.REPL_ID = originalReplId;
    }

    // The old wallet queue uses its own table and row shape.  Approval must
    // still write only the operational revenue ledger, notify/refresh after
    // commit, and remain one-shot when an admin retries the same action.
    const legacyWallet = await applicationPool.query(
      `INSERT INTO wallet_top_up_orders
         (user_id, amount_egp, payment_method, payment_ref, screenshot_url, order_number)
       VALUES ($1, 12.50, 'vodafone', 'Legacy-Wallet-Ref', 'https://ads-as.com/uploads/old-receipt.png', 'WLT-OLD-1')
       RETURNING id`,
      [userId],
    );
    const legacyApproval = await paymentHttp(
      httpHarness.url,
      "PATCH",
      `/api/admin/wallet-topups/${legacyWallet.rows[0].id}`,
      { action: "approve", adminNote: "legacy receipt verified" },
      "admin",
    );
    assert.equal(legacyApproval.status, 200);
    assert.equal(legacyApproval.body.status, "approved");
    assert.equal(legacyApproval.body.amountEGP, 12.5);
    assert.equal(legacyApproval.body.newBalance, 243);
    const legacyReplay = await paymentHttp(
      httpHarness.url,
      "PATCH",
      `/api/admin/wallet-topups/${legacyWallet.rows[0].id}`,
      { action: "approve" },
      "admin",
    );
    assert.equal(legacyReplay.status, 400);
    const legacyLedger = await applicationPool.query(
      `SELECT count(*)::int AS count
         FROM revenue_transactions
        WHERE user_id = $1 AND type = 'wallet_recharge' AND amount_egp = 12.50`,
      [userId],
    );
    assert.equal(legacyLedger.rows[0].count, 1);
    assert.equal(
      (await applicationPool.query(
        "SELECT count(*)::int AS count FROM notifications WHERE dedupe_key = $1",
        [`wallet-topup:${legacyWallet.rows[0].id}:approved`],
      )).rows[0].count,
      1,
    );

    const legacyRejected = await applicationPool.query(
      `INSERT INTO wallet_top_up_orders
         (user_id, amount_egp, payment_method, payment_ref, order_number)
       VALUES ($1, 7.50, 'vodafone', 'legacy-reject-ref', 'WLT-OLD-REJECT')
       RETURNING id`,
      [userId],
    );
    const legacyRejection = await paymentHttp(
      httpHarness.url,
      "PATCH",
      `/api/admin/wallet-topups/${legacyRejected.rows[0].id}`,
      { action: "reject", adminNote: "receipt not verified" },
      "admin",
    );
    assert.equal(legacyRejection.status, 200);
    assert.equal(legacyRejection.body.status, "rejected");
    assert.equal(
      (await applicationPool.query(
        "SELECT status FROM wallet_top_up_orders WHERE id = $1",
        [legacyRejected.rows[0].id],
      )).rows[0].status,
      "rejected",
    );
    assert.equal(
      (await applicationPool.query(
        "SELECT count(*)::int AS count FROM revenue_transactions WHERE user_id = $1 AND amount_egp = 7.50",
        [userId],
      )).rows[0].count,
      0,
    );

    // A reference already pending in the legacy coin queue cannot be reused
    // by a wallet approval, even when the old wallet row has no upload record.
    await applicationPool.query(
      `INSERT INTO coin_purchase_orders
         (user_id, coins, amount_egp, payment_method, payment_ref, status)
       VALUES ($1, 20, 10, 'vodafone', 'cross-legacy-ref', 'pending')`,
      [userId],
    );
    const duplicateLegacyWallet = await applicationPool.query(
      `INSERT INTO wallet_top_up_orders
         (user_id, amount_egp, payment_method, payment_ref, order_number)
       VALUES ($1, 10, 'vodafone', 'CROSS legacy REF', 'WLT-OLD-2')
       RETURNING id`,
      [userId],
    );
    const duplicateLegacyApproval = await paymentHttp(
      httpHarness.url,
      "PATCH",
      `/api/admin/wallet-topups/${duplicateLegacyWallet.rows[0].id}`,
      { action: "approve" },
      "admin",
    );
    assert.equal(duplicateLegacyApproval.status, 409);
    assert.equal(
      (await applicationPool.query(
        "SELECT status FROM wallet_top_up_orders WHERE id = $1",
        [duplicateLegacyWallet.rows[0].id],
      )).rows[0].status,
      "pending",
    );

    // The POST handler owns price and quantity. A stale/tampered amount is
    // rejected, while a client that omits amount receives the server price.
    const httpContractViolations: string[] = [];
    // Exercise every visible live selector against the real consolidated route,
    // including the legacy "bank" key whose label is Souq Market, not a bank.
    await applicationPool.query(`CREATE TABLE coin_packages (
      id integer PRIMARY KEY, coins integer, bonus_coins integer,
      price_egp numeric(12,2), is_active boolean
    )`);
    await applicationPool.query("INSERT INTO coin_packages VALUES (1, 100, 0, 10, true)");
    for (const [selector, method] of Object.entries(LIVE_PAYMENT_METHODS)) {
      const submitted = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
        type: "top_up", serviceType: "coin_package", coinPackageId: 1,
        method, paymentRef: `live-selector-${selector}`,
      });
      assert.equal(submitted.status, 201, `live selector ${selector} must submit`);
      assert.equal(submitted.body.method, method);
      assert.equal(submitted.body.amountEGP, 10);
      assert.equal(submitted.body.serviceQuantity, 100);
      assert.equal(submitted.body.status, "pending");
    }

    const tamperedPrice = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
      type: "top_up",
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "http-tampered-price",
      serviceType: "ai_credits",
      aiCreditsQuantity: 3,
      amountEGP: 0.01,
    });
    assert.equal(tamperedPrice.status, 400);
    assert.equal(tamperedPrice.body.field, "amountEGP");
    const httpAi = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
      type: "top_up",
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "http-server-priced-ai",
      serviceType: "ai_credits",
      aiCreditsQuantity: 3,
    });
    assert.equal(httpAi.status, 201);
    if (!Object.hasOwn(httpAi.body, "amountEGP")) {
      httpContractViolations.push("POST /api/payments must expose amountEGP for the Payments/AdminPanel contract");
    }
    assert.equal(Number(httpAi.body.amountEGP ?? httpAi.body.amountEgp), 15);
    assert.equal(httpAi.body.serviceQuantity, 3);
    assert.equal(httpAi.body.serviceType, "ai_credits");

    // Current UI/backend contract: services may be mixed only at quantity one.
    const mixedQuantityRejected = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
      type: "top_up",
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "http-mixed-quantity-rejected",
      serviceType: "ai_credits,campaign",
      serviceQuantity: 2,
    });
    assert.equal(mixedQuantityRejected.status, 400);
    assert.equal(mixedQuantityRejected.body.field, "amountEGP");
    const httpMixed = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
      type: "top_up",
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "http-mixed-quantity-one",
      serviceType: "ai_credits,campaign",
      serviceQuantity: 1,
    });
    assert.equal(httpMixed.status, 201);
    assert.equal(Number(httpMixed.body.amountEGP ?? httpMixed.body.amountEgp), 105);
    assert.equal(httpMixed.body.serviceQuantity, 1);

    // The same canonical reference is rejected despite full-width characters,
    // Arabic numerals, casing, punctuation, and a different incoming flow.
    const canonicalFirst = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
      type: "top_up",
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "ＡＢＣ-١٢",
      serviceType: "wallet_recharge",
      amountEGP: 10,
    });
    assert.equal(canonicalFirst.status, 201);
    const canonicalClaim = await applicationPool.query(
      "SELECT flow, canonical_reference FROM manual_payment_reference_claims WHERE flow = 'incoming' AND canonical_reference = 'abc12'",
    );
    assert.deepEqual(canonicalClaim.rows, [{ flow: "incoming", canonical_reference: "abc12" }]);
    const canonicalReplay = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
      type: "top_up",
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "abc12",
      serviceType: "wallet_recharge",
      amountEGP: 10,
    });
    assert.equal(canonicalReplay.status, 409);
    await applicationPool.query(`
      INSERT INTO coin_purchase_orders
        (user_id, coins, amount_egp, payment_method, payment_ref, canonical_payment_ref, status)
      VALUES ($1, 20, 10, 'vodafone', 'cross-flow-9', 'crossflow9', 'pending')`,
      [userId],
    );
    const crossFlowReplay = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
      type: "top_up",
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "ＣＲＯＳＳ-flow ٩",
      serviceType: "wallet_recharge",
      amountEGP: 10,
    });
    assert.equal(crossFlowReplay.status, 409);

    // A proof URL is validated against an owned upload before the digest is
    // trusted; a matching digest cannot be submitted again under a new ref.
    const invalidProof = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
      type: "top_up",
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "http-unowned-proof",
      serviceType: "wallet_recharge",
      amountEGP: 10,
      screenshotUrl: "/uploads/not-owned.png",
    });
    assert.equal(invalidProof.status, 400);
    assert.equal(invalidProof.body.field, "screenshotUrl");
    const proofFilename = `manual-payment-${randomUUID()}.png`;
    proofFilePath = path.resolve(process.cwd(), "uploads", proofFilename);
    const proofBytes = await sharp({
      create: { width: 1, height: 1, channels: 4, background: "#ffffff" },
    }).png().toBuffer();
    await mkdir(path.dirname(proofFilePath), { recursive: true });
    await writeFile(proofFilePath, proofBytes);
    const proofDigest = await digestOwnedPaymentProof(`/uploads/${proofFilename}`, {
      filename: proofFilename,
      mimeType: "image/png",
      size: proofBytes.length,
    });
    await applicationPool.query(
      `INSERT INTO uploaded_files (user_id, filename, original_name, mime_type, size, url)
       VALUES ($1, $2, $2, 'image/png', $3, $4)`,
      [userId, proofFilename, proofBytes.length, `/uploads/${proofFilename}`],
    );
    await applicationPool.query(
      `INSERT INTO payment_requests
        (order_number, user_id, type, amount_egp, method, payment_ref, canonical_payment_ref, proof_digest, service_type, status)
       VALUES ('existing-proof-order', $1, 'top_up', 10, 'vodafone', 'existing-proof-ref', 'existingproofref', $2, 'wallet_recharge', 'pending')`,
      [userId, proofDigest],
    );
    const proofReplay = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
      type: "top_up",
      method: "vodafone",
      phoneNumber: "01012345678",
      paymentRef: "different-proof-reference",
      serviceType: "wallet_recharge",
      amountEGP: 10,
      screenshotUrl: `/uploads/${proofFilename}`,
    });
    assert.equal(proofReplay.status, 409);

    // Talking-avatar input must be a local image record owned by this account.
    // The provider is injected and deliberately fails, proving an owned source
    // reaches it without charging on a failed create request.
    const otherAvatarFilename = `other-avatar-${randomUUID()}.png`;
    otherAvatarFilePath = path.resolve(process.cwd(), "uploads", otherAvatarFilename);
    await writeFile(otherAvatarFilePath, proofBytes);
    await applicationPool.query(
      "INSERT INTO users (id, email) VALUES ($1, $2)",
      ["manual-int-other-avatar", "manual-int-other-avatar@example.test"],
    );
    await applicationPool.query(
      `INSERT INTO uploaded_files (user_id, filename, original_name, mime_type, size, url)
       VALUES ($1, $2, $2, 'image/png', $3, $4)`,
      ["manual-int-other-avatar", otherAvatarFilename, proofBytes.length, `/uploads/${otherAvatarFilename}`],
    );
    const originalDidKey = process.env.DID_API_KEY;
    const originalFetch = global.fetch;
    let didCreateCalls = 0;
    process.env.DID_API_KEY = "test-did-key";
    (global as any).fetch = async (input: unknown, init?: { body?: unknown }) => {
      if (String(input) === "https://api.d-id.com/talks") {
        didCreateCalls += 1;
        const payload = JSON.parse(String(init?.body));
        assert.equal(payload.source_url, `https://ads-as.com/uploads/${proofFilename}`);
        return new Response(JSON.stringify({ description: "controlled D-ID create failure" }), {
          status: 502,
          headers: { "content-type": "application/json" },
        });
      }
      return originalFetch(input as Parameters<typeof fetch>[0], init as Parameters<typeof fetch>[1]);
    };
    try {
      const externalAvatar = await paymentHttp(httpHarness.url, "POST", "/api/ai/talking-avatar", {
        imageUrl: "https://example.test/untrusted.png",
        text: "نص صالح",
      });
      assert.equal(externalAvatar.status, 400);
      assert.equal(didCreateCalls, 0);
      const otherUserAvatar = await paymentHttp(httpHarness.url, "POST", "/api/ai/talking-avatar", {
        imageUrl: `/uploads/${otherAvatarFilename}`,
        text: "نص صالح",
      });
      assert.equal(otherUserAvatar.status, 400);
      assert.equal(didCreateCalls, 0);
      const creditsBeforeAvatar = await storage.getAiCreditBalance(userId);
      const balanceBeforeAvatar = await storage.getUserBalanceEGP(userId);
      const ownedAvatar = await paymentHttp(httpHarness.url, "POST", "/api/ai/talking-avatar", {
        imageUrl: `/uploads/${proofFilename}`,
        text: "نص صالح",
      });
      assert.equal(ownedAvatar.status, 500);
      assert.equal(didCreateCalls, 1);
      assert.equal(await storage.getAiCreditBalance(userId), creditsBeforeAvatar);
      assert.equal(await storage.getUserBalanceEGP(userId), balanceBeforeAvatar);
    } finally {
      global.fetch = originalFetch;
      if (originalDidKey === undefined) delete process.env.DID_API_KEY;
      else process.env.DID_API_KEY = originalDidKey;
    }

    // The actual admin HTTP action must reject generic approval, an unchecked
    // execution, and a missing transfer reference before it can debit a user.
    const httpWithdrawal = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
      type: "withdrawal",
      method: "vodafone",
      amountEGP: 30,
      payoutName: "Test User",
      payoutDestination: "01012345678",
    });
    assert.equal(httpWithdrawal.status, 201);
    const httpWithdrawalId = Number(httpWithdrawal.body.id);
    const wrongWithdrawalAction = await paymentHttp(httpHarness.url, "PUT", `/api/admin/payments/${httpWithdrawalId}`, {
      status: "approved",
      action: "verify_transfer",
    }, "admin");
    assert.equal(wrongWithdrawalAction.status, 400);
    assert.equal(wrongWithdrawalAction.body.field, "action");
    const uncheckedWithdrawal = await paymentHttp(httpHarness.url, "PUT", `/api/admin/payments/${httpWithdrawalId}`, {
      status: "approved",
      action: "transfer_executed",
      transferReference: "http-transfer-reference",
    }, "admin");
    assert.equal(uncheckedWithdrawal.status, 400);
    assert.equal(uncheckedWithdrawal.body.field, "transferExecuted");
    const missingWithdrawalReference = await paymentHttp(httpHarness.url, "PUT", `/api/admin/payments/${httpWithdrawalId}`, {
      status: "approved",
      action: "transfer_executed",
      transferExecuted: true,
    }, "admin");
    let executedWithdrawal = missingWithdrawalReference;
    const duplicateOutgoingReference = missingWithdrawalReference.status === 400
      && missingWithdrawalReference.body.field === "transferReference"
      ? "HTTP transfer-reference"
      : "admin confirmed transfer";
    if (missingWithdrawalReference.status !== 400 || missingWithdrawalReference.body.field !== "transferReference") {
      httpContractViolations.push("withdrawal execution without transferReference must be rejected before approval");
    } else {
      executedWithdrawal = await paymentHttp(httpHarness.url, "PUT", `/api/admin/payments/${httpWithdrawalId}`, {
        status: "approved",
        action: "transfer_executed",
        transferExecuted: true,
        transferReference: "http-transfer-reference",
      }, "admin");
    }
    assert.equal(executedWithdrawal.status, 200);
    assert.equal(executedWithdrawal.body.status, "approved");
    const secondHttpWithdrawal = await paymentHttp(httpHarness.url, "POST", "/api/payments", {
      type: "withdrawal",
      method: "vodafone",
      amountEGP: 30,
      payoutName: "Test User",
      payoutDestination: "01012345678",
    });
    assert.equal(secondHttpWithdrawal.status, 201);
    const duplicateTransferReference = await paymentHttp(httpHarness.url, "PUT", `/api/admin/payments/${secondHttpWithdrawal.body.id}`, {
      status: "approved",
      action: "transfer_executed",
      transferExecuted: true,
      transferReference: duplicateOutgoingReference,
    }, "admin");
    assert.equal(duplicateTransferReference.status, 409);
    assert.equal(duplicateTransferReference.body.field, "transferReference");

    const httpHistory = await paymentHttp(httpHarness.url, "GET", "/api/payments");
    assert.equal(httpHistory.status, 200);
    assert.ok(httpHistory.body.some((row: any) => Number(row.id) === httpAi.body.id));
    if (!httpHistory.body.some((row: any) => Number(row.id) === httpWithdrawalId && row.transferReference === "http-transfer-reference")) {
      httpContractViolations.push("executed withdrawal must retain the operator-supplied transferReference in history");
    }
    assert.deepEqual(httpContractViolations, []);

    const history = await storage.getPaymentRequests(userId);
    assert.ok(history.length >= 12);
    assert.equal(history.find(row => row.id === mixedOrder.id)?.fulfillmentStatus, "fulfilled");
    assert.equal(history.find(row => row.id === withdrawal.id)?.transferReference, "transfer-reference-1");
  } finally {
    await httpHarness?.close().catch(() => undefined);
    await applicationPool?.end().catch(() => undefined);
    process.env.DATABASE_URL = baseDatabaseUrl;
    if (originalAdminUserId === undefined) delete process.env.ADMIN_USER_ID;
    else process.env.ADMIN_USER_ID = originalAdminUserId;
    if (originalReplId === undefined) delete process.env.REPL_ID;
    else process.env.REPL_ID = originalReplId;
    if (originalPayoutKey === undefined) delete process.env.SECRET_VAULT_MASTER_KEY;
    else process.env.SECRET_VAULT_MASTER_KEY = originalPayoutKey;
    if (proofFilePath) await unlink(proofFilePath).catch(() => undefined);
    if (otherAvatarFilePath) await unlink(otherAvatarFilePath).catch(() => undefined);
    await fixturePool.query(`DROP SCHEMA IF EXISTS ${schemaSql} CASCADE`).catch(() => undefined);
    await fixturePool.end();
  }
});