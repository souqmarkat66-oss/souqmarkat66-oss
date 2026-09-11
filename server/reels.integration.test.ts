import { strict as assert } from "node:assert";
import { execFile as execFileCallback } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, unlink, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { createServer } from "node:http";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import express, { type Express, type RequestHandler } from "express";
import pg from "pg";
import sharp from "sharp";

const execFile = promisify(execFileCallback);

function developmentDatabaseUrl(): string {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("reels integration tests may only run with NODE_ENV=development");
  }
  if (!process.env.DATABASE_URL) {
    throw new Error("reels integration tests require DATABASE_URL");
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

type CapturedRoute = {
  method: "get" | "post" | "put";
  path: string;
  handlers: RequestHandler[];
};

/**
 * Register the production routes without starting a listener or an external
 * provider. The selected production handlers are then mounted on a real
 * Express/http server below.
 */
function recordingApp(): { app: Express; routes: CapturedRoute[] } {
  const routes: CapturedRoute[] = [];
  let app: Express;
  app = new Proxy({}, {
    get: (_target, property) => {
      const method = String(property);
      if (method === "get" || method === "post" || method === "put") {
        return (routePath: string, ...handlers: RequestHandler[]) => {
          routes.push({ method, path: routePath, handlers });
          return app;
        };
      }
      return () => app;
    },
  }) as Express;
  return { app, routes };
}

function capturedRoute(
  routes: CapturedRoute[],
  method: CapturedRoute["method"],
  routePath: string,
): CapturedRoute {
  const route = routes.find(candidate => candidate.method === method && candidate.path === routePath);
  assert.ok(route, `production route was not registered: ${method.toUpperCase()} ${routePath}`);
  return route;
}

async function createHttpHarness(
  routes: CapturedRoute[],
  ownerId: string,
  otherUserId: string,
): Promise<{ url: string; close: () => Promise<void> }> {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    const userId = req.header("x-test-user") === "other" ? otherUserId : ownerId;
    req.session = {
      customUser: {
        id: userId,
        email: `${userId}@example.test`,
        phone: null,
        firstName: "Reel",
        lastName: "Integration",
        profileImageUrl: null,
        authGeneration: 0,
      },
    };
    next();
  });

  for (const [method, routePath] of [
    ["post", "/api/upload"],
    ["post", "/api/reels"],
    ["put", "/api/reels/:id"],
    ["post", "/api/ai/images-to-video"],
  ] as const) {
    const route = capturedRoute(routes, method, routePath);
    (app as any)[route.method](route.path, ...route.handlers);
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
    close: () => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    }),
  };
}

async function jsonRequest(
  baseUrl: string,
  method: "POST" | "PUT",
  routePath: string,
  body: Record<string, unknown>,
  user = "owner",
): Promise<{ status: number; body: any }> {
  const response = await fetch(`${baseUrl}${routePath}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-test-user": user,
    },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
}

async function uploadFile(
  baseUrl: string,
  filePath: string,
  mimeType: string,
  user = "owner",
): Promise<{ status: number; body: any }> {
  const form = new FormData();
  form.append(
    "file",
    new Blob([await readFile(filePath)], { type: mimeType }),
    path.basename(filePath),
  );
  const response = await fetch(`${baseUrl}/api/upload`, {
    method: "POST",
    headers: { "x-test-user": user },
    body: form,
  });
  return { status: response.status, body: await response.json() };
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
      // Drizzle's baseline names the production public schema in FK targets;
      // the isolated fixture must point those targets at its own users table.
      sql = sql.replaceAll('"public".', "");
    }
    // 0001 predates schema-isolated tests and hard-codes public for one
    // idempotency check. Point that check at this fixture schema only.
    sql = sql.replace("'public.ticker_ads'::regclass", `'${schema}.ticker_ads'::regclass`);
    await client.query(sql);
  }
}

test("owned reel publishing and image-video rendering stay local, playable, and charge only on success", async () => {
  const baseDatabaseUrl = developmentDatabaseUrl();
  const schema = `reels_test_${randomUUID().replaceAll("-", "")}`;
  const schemaSql = quoteIdentifier(schema);
  const fixturePool = new pg.Pool({ connectionString: baseDatabaseUrl });
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalReplId = process.env.REPL_ID;
  const originalSessionSecret = process.env.SESSION_SECRET;
  const originalFfmpegPath = process.env.FFMPEG_PATH;
  let applicationPool: pg.Pool | undefined;
  let httpHarness: Awaited<ReturnType<typeof createHttpHarness>> | undefined;
  const temporaryFiles: string[] = [];
  const storedFiles: string[] = [];

  const ownerId = "reels-int-owner";
  const otherUserId = "reels-int-other";

  try {
    await fixturePool.query(`CREATE SCHEMA ${schemaSql}`);
    const fixtureClient = await fixturePool.connect();
    try {
      await fixtureClient.query(`SET search_path TO ${schemaSql}`);
      await createFixtureSchema(fixtureClient, schema);
      await fixtureClient.query(
        `INSERT INTO users (id, email, created_at, auth_generation)
         VALUES ($1, $2, NOW() - INTERVAL '30 days', 0),
                ($3, $4, NOW(), 0)`,
        [ownerId, `${ownerId}@example.test`, otherUserId, `${otherUserId}@example.test`],
      );
      await fixtureClient.query(
        `INSERT INTO platform_settings (key, value)
         VALUES ('ai_free_credits', '20')
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
      );
    } finally {
      fixtureClient.release();
    }

    process.env.NODE_ENV = "development";
    process.env.DATABASE_URL = urlWithSearchPath(baseDatabaseUrl, schema);
    process.env.SESSION_SECRET = "reels-integration-test-session-secret";
    delete process.env.REPL_ID;
    const { pool } = await import("./db");
    applicationPool = pool;

    const savedSetInterval = global.setInterval;
    (global as any).setInterval = () => ({ unref() {} });
    try {
      const { registerRoutes } = await import("./routes");
      const captured = recordingApp();
      await registerRoutes(createServer(), captured.app);
      httpHarness = await createHttpHarness(captured.routes, ownerId, otherUserId);
    } finally {
      global.setInterval = savedSetInterval;
    }

    const assetDirectory = path.join(tmpdir(), `reels-assets-${randomUUID()}`);
    await mkdir(assetDirectory, { recursive: true });
    temporaryFiles.push(assetDirectory);
    const pngPath = path.join(assetDirectory, "source.png");
    const webpPath = path.join(assetDirectory, "source.webp");
    const mp3Path = path.join(assetDirectory, "source.mp3");
    await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 24, g: 118, b: 242 },
      },
    }).png().toFile(pngPath);
    await sharp({
      create: {
        width: 320,
        height: 240,
        channels: 3,
        background: { r: 242, g: 118, b: 24 },
      },
    }).webp().toFile(webpPath);
    await execFile(
      process.env.FFMPEG_PATH || "ffmpeg",
      ["-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=3", "-c:a", "libmp3lame", mp3Path],
    );

    const uploadedPng = await uploadFile(httpHarness.url, pngPath, "image/png");
    const uploadedWebp = await uploadFile(httpHarness.url, webpPath, "image/webp");
    const uploadedMp3 = await uploadFile(httpHarness.url, mp3Path, "audio/mpeg");
    assert.equal(uploadedPng.status, 200);
    assert.equal(uploadedWebp.status, 200);
    assert.equal(uploadedMp3.status, 200, "a valid MP3 signature should pass secure upload");
    assert.equal(uploadedMp3.body.file.mimeType, "audio/mpeg");
    const pngUrl = uploadedPng.body.url as string;
    const webpUrl = uploadedWebp.body.url as string;
    const mp3Url = uploadedMp3.body.url as string;
    storedFiles.push(path.basename(pngUrl), path.basename(webpUrl), path.basename(mp3Url));
    assert.match(pngUrl, /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/);
    assert.match(webpUrl, /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/);
    assert.match(mp3Url, /^\/uploads\/[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/);

    const usageBefore = await applicationPool.query(
      "SELECT count(*)::int AS count FROM ai_usage WHERE user_id = $1",
      [ownerId],
    );
    assert.equal(usageBefore.rows[0].count, 0);

    // No-audio mode must produce a real MP4 and settle exactly once.
    const noAudio = await jsonRequest(httpHarness.url, "POST", "/api/ai/images-to-video", {
      imageUrls: [pngUrl],
      duration: 1,
      quality: "standard",
    });
    assert.equal(noAudio.status, 200);
    const noAudioUrl = noAudio.body.url as string;
    const noAudioFilename = path.basename(noAudioUrl);
    const noAudioFile = path.join(process.cwd(), "uploads", noAudioFilename);
    storedFiles.push(noAudioFilename);
    const noAudioProbe = await execFile("ffprobe", [
      "-v", "error", "-show_entries", "format=format_name,duration:stream=codec_name,codec_type",
      "-of", "json", noAudioFile,
    ]);
    const noAudioMetadata = JSON.parse(noAudioProbe.stdout);
    assert.ok(noAudioMetadata.streams.some((stream: any) => stream.codec_type === "video" && stream.codec_name === "h264"));
    assert.ok(!noAudioMetadata.streams.some((stream: any) => stream.codec_type === "audio"));
    assert.ok(Math.abs(Number(noAudioMetadata.format.duration) - 1) < 0.15);

    // PNG + WebP + optional owned MP3 must remain a playable MP4 with audio.
    const withAudio = await jsonRequest(httpHarness.url, "POST", "/api/ai/images-to-video", {
      imageUrls: [pngUrl, webpUrl],
      audioUrl: mp3Url,
      duration: 1,
      quality: "standard",
    });
    assert.equal(withAudio.status, 200);
    const withAudioUrl = withAudio.body.url as string;
    const withAudioFilename = path.basename(withAudioUrl);
    const withAudioFile = path.join(process.cwd(), "uploads", withAudioFilename);
    storedFiles.push(withAudioFilename);
    const withAudioProbe = await execFile("ffprobe", [
      "-v", "error", "-show_entries", "format=format_name,duration:stream=codec_name,codec_type",
      "-of", "json", withAudioFile,
    ]);
    const withAudioMetadata = JSON.parse(withAudioProbe.stdout);
    assert.equal(withAudioMetadata.format.format_name.split(",")[0], "mov");
    assert.ok(withAudioMetadata.streams.some((stream: any) => stream.codec_type === "video" && stream.codec_name === "h264"));
    assert.ok(withAudioMetadata.streams.some((stream: any) => stream.codec_type === "audio" && stream.codec_name === "aac"));
    assert.ok(Math.abs(Number(withAudioMetadata.format.duration) - 2) < 0.15);
    const storedVideo = await applicationPool.query(
      `SELECT user_id, mime_type, size FROM uploaded_files WHERE filename = $1`,
      [withAudioFilename],
    );
    assert.deepEqual(storedVideo.rows[0], { user_id: ownerId, mime_type: "video/mp4", size: (await readFile(withAudioFile)).length });

    const usageAfterSuccess = await applicationPool.query(
      "SELECT count(*)::int AS count FROM ai_usage WHERE user_id = $1 AND type = 'video'",
      [ownerId],
    );
    assert.equal(usageAfterSuccess.rows[0].count, 2);

    // The ordinary reel route is not subscription-gated, even for an old
    // account with no subscription, and accepts the owned generated MP4.
    const createdReel = await jsonRequest(httpHarness.url, "POST", "/api/reels", {
      title: "Owned MP4 reel",
      description: "created without subscription",
      videoUrl: withAudioUrl,
    });
    assert.equal(createdReel.status, 201);
    assert.equal(createdReel.body.videoUrl, withAudioUrl);
    const reelId = Number(createdReel.body.id);
    assert.ok(Number.isSafeInteger(reelId) && reelId > 0);

    const nonOwned = await jsonRequest(httpHarness.url, "POST", "/api/reels", {
      title: "Non-owned reel",
      videoUrl: withAudioUrl,
    }, "other");
    assert.equal(nonOwned.status, 403);

    const replacedRemote = await jsonRequest(httpHarness.url, "PUT", `/api/reels/${reelId}`, {
      videoUrl: "https://provider.example/video.mp4",
    });
    assert.equal(replacedRemote.status, 403);

    // A real encoding failure must not settle another AI usage row.
    const usageBeforeFailure = await applicationPool.query(
      "SELECT count(*)::int AS count FROM ai_usage WHERE user_id = $1 AND type = 'video'",
      [ownerId],
    );
    const badFfmpegPath = path.join(tmpdir(), `missing-ffmpeg-${randomUUID()}`);
    process.env.FFMPEG_PATH = badFfmpegPath;
    try {
      const failedEncode = await jsonRequest(httpHarness.url, "POST", "/api/ai/images-to-video", {
        imageUrls: [pngUrl],
        duration: 1,
        quality: "standard",
      });
      assert.equal(failedEncode.status, 502);
      assert.equal(failedEncode.body.message, "تعذر إنشاء فيديو MP4");
      assert.doesNotMatch(String(failedEncode.body.message), /ffmpeg|tmp|uploads/i);
    } finally {
      if (originalFfmpegPath === undefined) delete process.env.FFMPEG_PATH;
      else process.env.FFMPEG_PATH = originalFfmpegPath;
    }
    const usageAfterFailure = await applicationPool.query(
      "SELECT count(*)::int AS count FROM ai_usage WHERE user_id = $1 AND type = 'video'",
      [ownerId],
    );
    assert.equal(usageAfterFailure.rows[0].count, usageBeforeFailure.rows[0].count);
  } finally {
    if (httpHarness) await httpHarness.close();
    if (applicationPool) await applicationPool.end();
    for (const filename of storedFiles) {
      await unlink(path.join(process.cwd(), "uploads", filename)).catch(() => undefined);
      await fixturePool.query(`DELETE FROM ${schemaSql}.uploaded_files WHERE filename = $1`, [filename]).catch(() => undefined);
    }
    for (const filePath of temporaryFiles) {
      await rm(filePath, { recursive: true, force: true }).catch(() => undefined);
    }
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.NODE_ENV = originalNodeEnv;
    if (originalReplId === undefined) delete process.env.REPL_ID;
    else process.env.REPL_ID = originalReplId;
    if (originalSessionSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = originalSessionSecret;
    if (originalFfmpegPath === undefined) delete process.env.FFMPEG_PATH;
    else process.env.FFMPEG_PATH = originalFfmpegPath;
    await fixturePool.query(`DROP SCHEMA IF EXISTS ${schemaSql} CASCADE`);
    await fixturePool.end();
  }
});