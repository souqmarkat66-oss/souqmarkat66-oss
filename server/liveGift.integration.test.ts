import { strict as assert } from "node:assert";
import { randomUUID, createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import test from "node:test";
import express from "express";
import pg from "pg";
import { io, type Socket } from "socket.io-client";

const enabled = process.env.LIVE_GIFT_SOCKET_TEST === "1"
  && process.env.NODE_ENV === "development"
  && !!process.env.DATABASE_URL;

function developmentDatabaseUrl(): string {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("live gift integration tests may only run with NODE_ENV=development");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("live gift integration tests require DATABASE_URL");
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
      // The baseline has production-public FK targets. Point every target at
      // this test's random schema before executing it.
      sql = sql.replaceAll('"public".', "");
    }
    sql = sql.replace("'public.ticker_ads'::regclass", `'${schema}.ticker_ads'::regclass`);
    await client.query(sql);
  }
  // stream_mode/key are additive runtime columns created by the application
  // startup migration rather than the checked-in baseline.
  await client.query(`
    ALTER TABLE live_streams
      ADD COLUMN IF NOT EXISTS stream_key text,
      ADD COLUMN IF NOT EXISTS stream_mode text DEFAULT 'webrtc'
  `);
}

function signedSessionCookie(sid: string, secret: string): string {
  const signature = createHmac("sha256", secret)
    .update(sid)
    .digest("base64")
    .replace(/=+$/, "");
  return encodeURIComponent(`s:${sid}.${signature}`);
}

async function createSession(
  client: pg.PoolClient,
  userId: string,
  secret: string,
): Promise<string> {
  const sid = `live-gift-${randomUUID()}`;
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await client.query(
    `INSERT INTO sessions (sid, sess, expire)
     VALUES ($1, $2::jsonb, $3)`,
    [
      sid,
      JSON.stringify({
        cookie: {
          originalMaxAge: 60 * 60 * 1000,
          expires: expiresAt.toISOString(),
          httpOnly: true,
          path: "/",
        },
        customUser: {
          id: userId,
          email: `${userId}@example.test`,
          phone: null,
          firstName: "Live",
          lastName: "Gift",
          profileImageUrl: null,
          authGeneration: 0,
        },
      }),
      expiresAt,
    ],
  );
  return `connect.sid=${signedSessionCookie(sid, secret)}`;
}

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== "string", "Socket harness did not receive a TCP port");
  return `http://127.0.0.1:${address.port}`;
}

function waitForEvent<T = any>(socket: Socket, event: string, timeoutMs = 5_000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for Socket.IO event ${event}`));
    }, timeoutMs);
    const onEvent = (value: T) => {
      clearTimeout(timer);
      resolve(value);
    };
    socket.once(event, onEvent);
  });
}

async function connectAuthenticated(baseUrl: string, cookie: string): Promise<Socket> {
  const socket = io(baseUrl, {
    path: "/socket.io",
    transports: ["websocket"],
    extraHeaders: { Cookie: cookie },
  });
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      socket.close();
      reject(new Error("Timed out connecting authenticated Socket.IO client"));
    }, 5_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      socket.close();
      reject(error);
    });
  });
  return socket;
}

/**
 * The browser uses the same membership sequence for WebRTC and RTMP:
 * the live DB row is started, the broadcaster claims the server room, and
 * each viewer joins it. Retry only the room announcement because the
 * production broadcaster handler performs an async stream-owner lookup.
 */
async function establishLiveMembership(
  broadcaster: Socket,
  viewer: Socket,
  streamId: string,
): Promise<void> {
  broadcaster.emit("broadcaster", streamId);
  for (let attempt = 0; attempt < 30; attempt++) {
    const announcement = waitForEvent(viewer, "broadcaster", 200);
    viewer.emit("join-stream", streamId);
    try {
      await announcement;
      return;
    } catch {
      // The owner lookup may still be in flight. A subsequent join retries
      // only room membership and never creates a ledger write.
    }
  }
  throw new Error(`Broadcaster did not become a live member for stream ${streamId}`);
}

function giftPayload(eventId: string, streamId: string, giftType: string) {
  return {
    eventId,
    streamId,
    giftType,
    // Deliberately forged client fields: the live handler must ignore these.
    giftEmoji: "forged",
    giftName: "forged",
    giftCoins: 999_999,
    userName: "forged sender",
    userId: "forged-user",
    broadcasterUserId: "forged-recipient",
  };
}

test("the mounted live send-gift Socket.IO handler settles normal and RTMP gifts exactly once", { skip: !enabled }, async () => {
  const baseDatabaseUrl = developmentDatabaseUrl();
  const schema = `live_gift_test_${randomUUID().replaceAll("-", "")}`;
  const schemaSql = quoteIdentifier(schema);
  const fixturePool = new pg.Pool({ connectionString: baseDatabaseUrl });
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalSessionSecret = process.env.SESSION_SECRET;
  const originalReplId = process.env.REPL_ID;
  let applicationPool: pg.Pool | undefined;
  let httpServer: Server | undefined;
  const sockets: Socket[] = [];

  const senderId = "live-gift-sender";
  const normalBroadcasterId = "live-gift-normal-host";
  const rtmpBroadcasterId = "live-gift-rtmp-host";
  const sessionSecret = "live-gift-integration-session-secret";

  try {
    await fixturePool.query(`CREATE SCHEMA ${schemaSql}`);
    const fixtureClient = await fixturePool.connect();
    let senderCookie: string;
    let normalBroadcasterCookie: string;
    let rtmpBroadcasterCookie: string;
    let normalStreamId: number;
    let rtmpStreamId: number;
    try {
      await fixtureClient.query(`SET search_path TO ${schemaSql}`);
      await createFixtureSchema(fixtureClient, schema);
      await fixtureClient.query(
        `INSERT INTO users (id, email, first_name, last_name, auth_generation)
         VALUES ($1, $2, 'Gift', 'Sender', 0),
                ($3, $4, 'Normal', 'Broadcaster', 0),
                ($5, $6, 'RTMP', 'Broadcaster', 0)`,
        [
          senderId,
          `${senderId}@example.test`,
          normalBroadcasterId,
          `${normalBroadcasterId}@example.test`,
          rtmpBroadcasterId,
          `${rtmpBroadcasterId}@example.test`,
        ],
      );
      const channels = await fixtureClient.query(
        `INSERT INTO channels (user_id, name)
         VALUES ($1, 'Normal gift channel'), ($2, 'RTMP gift channel')
         RETURNING id, user_id`,
        [normalBroadcasterId, rtmpBroadcasterId],
      );
      const normalChannelId = channels.rows.find(row => row.user_id === normalBroadcasterId)?.id;
      const rtmpChannelId = channels.rows.find(row => row.user_id === rtmpBroadcasterId)?.id;
      assert.ok(normalChannelId && rtmpChannelId);
      const streams = await fixtureClient.query(
        `INSERT INTO live_streams
           (channel_id, user_id, title, status, started_at, stream_mode)
         VALUES
           ($1, $2, 'Normal gift stream', 'live', NOW(), 'webrtc'),
           ($3, $4, 'RTMP gift stream', 'live', NOW(), 'rtmp')
         RETURNING id, user_id`,
        [normalChannelId, normalBroadcasterId, rtmpChannelId, rtmpBroadcasterId],
      );
      normalStreamId = Number(streams.rows.find(row => row.user_id === normalBroadcasterId)?.id);
      rtmpStreamId = Number(streams.rows.find(row => row.user_id === rtmpBroadcasterId)?.id);
      assert.ok(Number.isSafeInteger(normalStreamId) && Number.isSafeInteger(rtmpStreamId));
      await fixtureClient.query(
        `INSERT INTO coin_wallets (user_id, balance, total_spent, total_earned)
         VALUES ($1, 100, 0, 0), ($2, 0, 0, 0), ($3, 0, 0, 0)`,
        [senderId, normalBroadcasterId, rtmpBroadcasterId],
      );
      senderCookie = await createSession(fixtureClient, senderId, sessionSecret);
      normalBroadcasterCookie = await createSession(fixtureClient, normalBroadcasterId, sessionSecret);
      rtmpBroadcasterCookie = await createSession(fixtureClient, rtmpBroadcasterId, sessionSecret);
    } finally {
      fixtureClient.release();
    }

    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = urlWithSearchPath(baseDatabaseUrl, schema);
    process.env.SESSION_SECRET = sessionSecret;
    delete process.env.REPL_ID;

    const { pool } = await import("./db");
    applicationPool = pool;
    const { registerRoutes } = await import("./routes");
    const app = express();
    httpServer = createServer(app);
    const savedSetInterval = global.setInterval;
    (global as any).setInterval = () => ({ unref() {} });
    try {
      await registerRoutes(httpServer, app);
    } finally {
      global.setInterval = savedSetInterval;
    }
    const baseUrl = await listen(httpServer);

    const sender = await connectAuthenticated(baseUrl, senderCookie!);
    const normalBroadcaster = await connectAuthenticated(baseUrl, normalBroadcasterCookie!);
    const rtmpBroadcaster = await connectAuthenticated(baseUrl, rtmpBroadcasterCookie!);
    sockets.push(sender, normalBroadcaster, rtmpBroadcaster);

    // Normal WebRTC membership: the sender is a real authenticated viewer in
    // the server-owned room, and the broadcaster is authenticated owner.
    const normalState = await applicationPool.query(
      `SELECT status, stream_mode FROM live_streams WHERE id = $1`,
      [normalStreamId],
    );
    assert.deepEqual(normalState.rows[0], { status: "live", stream_mode: "webrtc" });
    await establishLiveMembership(
      normalBroadcaster,
      sender,
      String(normalStreamId),
    );
    const normalGiftId = randomUUID();
    const normalGift = giftPayload(normalGiftId, String(normalStreamId), "heart");
    const normalAccepted = waitForEvent<any>(sender, "gift-accepted");
    sender.emit("send-gift", normalGift);
    assert.deepEqual(await normalAccepted, {
      balance: 90,
      giftType: "heart",
      eventId: normalGiftId,
    });

    const normalLedger = await applicationPool.query(
      `SELECT
         (SELECT balance FROM coin_wallets WHERE user_id = $1) AS sender_balance,
         (SELECT total_spent FROM coin_wallets WHERE user_id = $1) AS sender_spent,
         (SELECT balance FROM coin_wallets WHERE user_id = $2) AS recipient_balance,
         (SELECT total_earned FROM coin_wallets WHERE user_id = $2) AS recipient_earned,
         (SELECT coins FROM coin_transactions
            WHERE user_id = $1 AND type = 'gift_sent' AND related_stream_id = $3) AS sender_transaction,
         (SELECT coins FROM coin_transactions
            WHERE user_id = $2 AND type = 'gift_received' AND related_stream_id = $3) AS recipient_transaction,
         (SELECT amount_egp FROM revenue_transactions
            WHERE user_id = $2 AND type = 'earning' AND channel_id IS NOT NULL) AS recipient_egp`,
      [senderId, normalBroadcasterId, normalStreamId],
    );
    assert.deepEqual(normalLedger.rows[0], {
      sender_balance: 90,
      sender_spent: 10,
      recipient_balance: 0,
      recipient_earned: 6,
      sender_transaction: -10,
      recipient_transaction: 6,
      recipient_egp: "0.3000000000",
    });

    const normalEvent = await applicationPool.query(
      `SELECT event_id, sender_user_id, recipient_user_id, stream_id, gift_type,
              gross_coins, broadcaster_coins, platform_coins
       FROM gift_events WHERE event_id = $1`,
      [normalGiftId],
    );
    assert.deepEqual(normalEvent.rows, [{
      event_id: normalGiftId,
      sender_user_id: senderId,
      recipient_user_id: normalBroadcasterId,
      stream_id: normalStreamId,
      gift_type: "heart",
      gross_coins: 10,
      broadcaster_coins: 6,
      platform_coins: 4,
    }]);
    // The 40% platform share is an immutable event field, not a spendable
    // wallet credit. There is no platform wallet row or platform transaction.
    assert.equal(
      (await applicationPool.query(
        "SELECT count(*)::int AS count FROM coin_wallets WHERE user_id = 'platform'",
      )).rows[0].count,
      0,
    );

    // The same event ID is accepted as a harmless retry, but does not create
    // another event, debit, broadcaster earning, or platform share.
    const duplicateAccepted = waitForEvent<any>(sender, "gift-accepted");
    sender.emit("send-gift", normalGift);
    assert.deepEqual(await duplicateAccepted, {
      balance: 90,
      giftType: "heart",
      eventId: normalGiftId,
      duplicate: true,
    });
    const duplicateCounts = await applicationPool.query(
      `SELECT
         (SELECT count(*)::int FROM gift_events WHERE event_id = $1) AS events,
         (SELECT count(*)::int FROM coin_transactions WHERE user_id = $2 AND type = 'gift_sent') AS sender_transactions,
         (SELECT count(*)::int FROM coin_transactions WHERE user_id = $3 AND type = 'gift_received') AS recipient_transactions,
         (SELECT total_earned FROM coin_wallets WHERE user_id = $3) AS recipient_earned`,
      [normalGiftId, senderId, normalBroadcasterId],
    );
    assert.deepEqual(duplicateCounts.rows[0], {
      events: 1,
      sender_transactions: 1,
      recipient_transactions: 1,
      recipient_earned: 6,
    });

    // RTMP membership follows the production client path too: the RTMP
    // publisher has already made the DB row live, then its authenticated UI
    // announces the broadcaster socket while viewers join the room. No RTMP
    // provider or external stream is started by this isolated test.
    const rtmpState = await applicationPool.query(
      `SELECT status, stream_mode FROM live_streams WHERE id = $1`,
      [rtmpStreamId],
    );
    assert.deepEqual(rtmpState.rows[0], { status: "live", stream_mode: "rtmp" });
    await establishLiveMembership(
      rtmpBroadcaster,
      sender,
      String(rtmpStreamId),
    );
    const rtmpGiftId = randomUUID();
    const rtmpAccepted = waitForEvent<any>(sender, "gift-accepted");
    sender.emit("send-gift", giftPayload(rtmpGiftId, String(rtmpStreamId), "rose"));
    assert.deepEqual(await rtmpAccepted, {
      balance: 85,
      giftType: "rose",
      eventId: rtmpGiftId,
    });
    const rtmpLedger = await applicationPool.query(
      `SELECT
         (SELECT balance FROM coin_wallets WHERE user_id = $1) AS sender_balance,
         (SELECT total_spent FROM coin_wallets WHERE user_id = $1) AS sender_spent,
         (SELECT balance FROM coin_wallets WHERE user_id = $2) AS recipient_balance,
         (SELECT total_earned FROM coin_wallets WHERE user_id = $2) AS recipient_earned,
         (SELECT amount_egp FROM revenue_transactions
            WHERE user_id = $2 AND type = 'earning' AND channel_id IS NOT NULL) AS recipient_egp
       `,
      [senderId, rtmpBroadcasterId],
    );
    assert.deepEqual(rtmpLedger.rows[0], {
      sender_balance: 85,
      sender_spent: 15,
      recipient_balance: 0,
      recipient_earned: 3,
      recipient_egp: "0.1500000000",
    });
    const rtmpEvent = await applicationPool.query(
      `SELECT gross_coins, broadcaster_coins, platform_coins
       FROM gift_events WHERE event_id = $1`,
      [rtmpGiftId],
    );
    assert.deepEqual(rtmpEvent.rows[0], {
      gross_coins: 5,
      broadcaster_coins: 3,
      platform_coins: 2,
    });

    // Insufficient funds roll back the inserted event as well as all ledger
    // writes. The recipient remains unable to spend earned coins.
    await applicationPool.query(
      "UPDATE coin_wallets SET balance = 1 WHERE user_id = $1",
      [senderId],
    );
    const beforeInsufficient = await applicationPool.query(
      `SELECT
         (SELECT count(*)::int FROM gift_events) AS gift_events,
         (SELECT count(*)::int FROM coin_transactions) AS coin_transactions,
         (SELECT count(*)::int FROM revenue_transactions) AS revenue_transactions,
         (SELECT balance FROM coin_wallets WHERE user_id = $1) AS sender_balance,
         (SELECT total_earned FROM coin_wallets WHERE user_id = $2) AS normal_earned,
         (SELECT balance FROM coin_wallets WHERE user_id = $2) AS normal_spendable`,
      [senderId, normalBroadcasterId],
    );
    const insufficientId = randomUUID();
    const rejected = waitForEvent<any>(sender, "gift-rejected");
    sender.emit("send-gift", giftPayload(insufficientId, String(normalStreamId), "heart"));
    assert.deepEqual(await rejected, {
      reason: "insufficient_balance",
      balance: 1,
      required: 10,
      eventId: insufficientId,
    });
    const afterInsufficient = await applicationPool.query(
      `SELECT
         (SELECT count(*)::int FROM gift_events) AS gift_events,
         (SELECT count(*)::int FROM coin_transactions) AS coin_transactions,
         (SELECT count(*)::int FROM revenue_transactions) AS revenue_transactions,
         (SELECT balance FROM coin_wallets WHERE user_id = $1) AS sender_balance,
         (SELECT total_earned FROM coin_wallets WHERE user_id = $2) AS normal_earned,
         (SELECT balance FROM coin_wallets WHERE user_id = $2) AS normal_spendable`,
      [senderId, normalBroadcasterId],
    );
    assert.deepEqual(afterInsufficient.rows[0], beforeInsufficient.rows[0]);
    assert.equal(
      (await applicationPool.query(
        "SELECT count(*)::int AS count FROM gift_events WHERE event_id = $1",
        [insufficientId],
      )).rows[0].count,
      0,
    );
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (httpServer) {
      await new Promise<void>(resolve => {
        if (!httpServer!.listening) return resolve();
        httpServer!.close(() => resolve());
      }).catch(() => undefined);
    }
    await applicationPool?.end().catch(() => undefined);
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
    if (originalReplId === undefined) delete process.env.REPL_ID;
    else process.env.REPL_ID = originalReplId;
    await fixturePool.query(`DROP SCHEMA IF EXISTS ${schemaSql} CASCADE`).catch(() => undefined);
    await fixturePool.end();
  }
});