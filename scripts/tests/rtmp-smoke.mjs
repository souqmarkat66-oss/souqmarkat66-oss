import { build } from "esbuild";
import { randomBytes } from "node:crypto";
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import fsp from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const HLS_ROOT = "/tmp/hls";
const TEST_TIMEOUT_MS = 60_000;
const UNSIGNED_TIMEOUT_MS = 10_000;
const PUBLISHER_STOP_TIMEOUT_MS = 8_000;

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, "../..");
const rtmpSource = path.join(projectRoot, "server/rtmp.ts");

function randomStreamKey() {
  return `smoke_${randomBytes(12).toString("hex")}`;
}

async function randomAvailablePort() {
  const probe = net.createServer();
  await new Promise((resolve, reject) => {
    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", resolve);
  });
  const address = probe.address();
  if (!address || typeof address === "string") {
    await new Promise((resolve) => probe.close(resolve));
    throw new Error("Could not determine a random RTMP port");
  }
  const port = address.port;
  await new Promise((resolve, reject) => {
    probe.close((error) => error ? reject(error) : resolve());
  });
  return port;
}

function waitForChild(child, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (callback, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      callback(value);
    };
    const timer = setTimeout(() => {
      settle(reject, new Error(`Process did not exit within ${timeoutMs}ms`));
    }, timeoutMs);
    child.once("error", (error) => settle(reject, error));
    child.once("close", (code, signal) => settle(resolve, {
      code,
      signal,
      stderr: child.__smokeStderr || "",
    }));
  });
}

async function stopChild(child, timeoutMs = PUBLISHER_STOP_TIMEOUT_MS) {
  if (!child || child.exitCode !== null || child.signalCode) return null;
  child.kill("SIGTERM");
  try {
    return await waitForChild(child, timeoutMs);
  } catch {
    child.kill("SIGKILL");
    return await waitForChild(child, timeoutMs).catch(() => null);
  }
}

function spawnSyntheticPublisher(url) {
  const child = spawn("ffmpeg", [
    "-nostdin",
    "-hide_banner",
    "-loglevel", "error",
    "-re",
    "-f", "lavfi",
    "-i", "testsrc=size=320x240:rate=15",
    "-f", "lavfi",
    "-i", "sine=frequency=1000:sample_rate=44100",
    "-c:v", "libx264",
    "-preset", "ultrafast",
    "-tune", "zerolatency",
    "-pix_fmt", "yuv420p",
    "-g", "30",
    "-keyint_min", "30",
    "-sc_threshold", "0",
    "-c:a", "aac",
    "-b:a", "96k",
    "-f", "flv",
    url,
  ], { stdio: ["ignore", "ignore", "pipe"] });

  child.__smokeStderr = "";
  child.stderr?.on("data", (chunk) => {
    child.__smokeStderr = `${child.__smokeStderr}${String(chunk)}`.slice(-5000);
  });
  return child;
}

async function waitForCondition(label, predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const result = predicate();
    if (result) return result;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}

function readSmokeStatus(statusFile) {
  try {
    return JSON.parse(fs.readFileSync(statusFile, "utf8"));
  } catch {
    return null;
  }
}

function inspectHlsPlaylist(playlistPath, outputDir) {
  if (!fs.existsSync(playlistPath)) return null;
  const playlist = fs.readFileSync(playlistPath, "utf8");
  if (!playlist.includes("#EXTM3U") || !playlist.includes("#EXTINF:")) return null;

  const segmentNames = playlist
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  const segments = segmentNames.filter((segmentName) => {
    const segmentPath = path.resolve(outputDir, segmentName);
    return segmentPath.startsWith(`${path.resolve(outputDir)}${path.sep}`)
      && fs.existsSync(segmentPath)
      && fs.statSync(segmentPath).isFile()
      && fs.statSync(segmentPath).size > 0;
  });
  if (!segments.length) return null;
  return { playlist, segmentNames, segments };
}

function makeMockDbSource() {
  return `import fs from "node:fs";

const statusFile = process.env.RTMP_SMOKE_STATUS_FILE;
const streamKey = process.env.RTMP_SMOKE_STREAM_KEY;
if (!statusFile || !streamKey) {
  throw new Error("RTMP smoke mock DB environment is incomplete");
}

const state = {
  status: "offline",
  streamKey,
  queries: [],
  liveUpdates: 0,
  endedUpdates: 0,
};

function save() {
  fs.writeFileSync(statusFile, JSON.stringify(state));
}

function queryText(query) {
  return (query?.queryChunks || []).map((chunk) => {
    if (typeof chunk === "string") return "?";
    return Array.isArray(chunk?.value) ? chunk.value.join("") : "";
  }).join("");
}

save();

export const db = {
  async execute(query) {
    const text = queryText(query);
    if (/SELECT\\s+stream_key/i.test(text)) {
      state.queries.push("select-stream-key");
      save();
      return { rows: [{ stream_key: streamKey }] };
    }
    if (/SET status = 'live'/i.test(text)) {
      state.queries.push("set-live");
      state.status = "live";
      state.liveUpdates += 1;
      save();
      return { rows: [{ id: 1 }] };
    }
    if (/SET status = 'ended'/i.test(text)) {
      state.queries.push("set-ended");
      state.status = "ended";
      state.endedUpdates += 1;
      save();
      return { rows: [] };
    }
    throw new Error("Unexpected SQL in RTMP smoke mock: " + text);
  },
};
`;
}

async function buildIsolatedRtmpModule(tempDir, mockDbPath) {
  const bundlePath = path.join(tempDir, "rtmp-smoke.bundle.mjs");
  const exactDbAliasPlugin = {
    name: "rtmp-smoke-exact-db-alias",
    setup(esbuild) {
      esbuild.onResolve({ filter: /^\.\/db$/ }, (args) => {
        if (path.resolve(args.importer) !== rtmpSource) return undefined;
        return { path: mockDbPath };
      });
    },
  };

  await build({
    entryPoints: [rtmpSource],
    outfile: bundlePath,
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    external: ["node-media-server", "drizzle-orm"],
    plugins: [exactDbAliasPlugin],
    sourcemap: false,
  });

  const bundle = await fsp.readFile(bundlePath, "utf8");
  if (bundle.includes("DATABASE_URL") || bundle.includes("drizzle-orm/node-postgres")) {
    throw new Error("RTMP smoke bundle unexpectedly includes the production database module");
  }
  return bundlePath;
}

async function main() {
  const ffmpegCheck = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" });
  if (ffmpegCheck.error || ffmpegCheck.status !== 0) {
    throw new Error("FFmpeg is required for the RTMP smoke test");
  }

  const streamKey = randomStreamKey();
  const rtmpPort = await randomAvailablePort();
  const secret = randomBytes(32).toString("hex");
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), "rtmp-smoke-"));
  await fsp.symlink(path.join(projectRoot, "node_modules"), path.join(tempDir, "node_modules"), "dir");
  const mockDbPath = path.join(tempDir, "mock-db.mjs");
  const statusFile = path.join(tempDir, "mock-status.json");
  const hlsDir = path.join(HLS_ROOT, "live", streamKey);
  const playlistPath = path.join(hlsDir, "index.m3u8");
  const hadHlsDir = fs.existsSync(hlsDir);
  if (hadHlsDir) {
    throw new Error(`Refusing to use a pre-existing HLS test key: ${streamKey}`);
  }

  const changedEnvironment = new Map();
  const setTestEnvironment = (name, value) => {
    changedEnvironment.set(name, process.env[name]);
    process.env[name] = value;
  };
  const originalDatabaseUrl = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  setTestEnvironment("RTMP_AUTH_SECRET", secret);
  setTestEnvironment("SESSION_SECRET", secret);
  setTestEnvironment("RTMP_PORT", String(rtmpPort));
  setTestEnvironment("FFMPEG_PATH", "ffmpeg");
  setTestEnvironment("RTMP_SMOKE_STREAM_KEY", streamKey);
  setTestEnvironment("RTMP_SMOKE_STATUS_FILE", statusFile);

  let rtmpHandle;
  let publisher;
  let unsignedPublisher;
  let hlsResult;
  try {
    await fsp.writeFile(mockDbPath, makeMockDbSource(), "utf8");
    const bundlePath = await buildIsolatedRtmpModule(tempDir, mockDbPath);
    const rtmp = await import(`${pathToFileUrl(bundlePath)}?smoke=${randomBytes(4).toString("hex")}`);

    rtmpHandle = await waitForPromise("RTMP server startup", rtmp.startRtmpServer(), 15_000);
    if (!rtmpHandle?.isReady?.()) throw new Error("RTMP server did not report ready");

    unsignedPublisher = spawnSyntheticPublisher(
      `rtmp://127.0.0.1:${rtmpPort}/live/${streamKey}`,
    );
    const unsignedResult = await waitForChild(unsignedPublisher, UNSIGNED_TIMEOUT_MS);
    unsignedPublisher = null;
    if (unsignedResult.code === 0) {
      throw new Error("Unsigned RTMP publish unexpectedly succeeded");
    }
    const afterUnsigned = readSmokeStatus(statusFile);
    if (afterUnsigned?.status !== "offline" || afterUnsigned.liveUpdates !== 0) {
      throw new Error("Unsigned RTMP publish changed mock stream state");
    }

    const signedKey = rtmp.getRtmpPublisherKey(streamKey, 600);
    publisher = spawnSyntheticPublisher(
      `rtmp://127.0.0.1:${rtmpPort}/live/${signedKey}`,
    );
    await waitForCondition("mock live status", () => {
      const status = readSmokeStatus(statusFile);
      return status?.status === "live" && status.liveUpdates === 1 ? status : null;
    }, 15_000);
    hlsResult = await waitForCondition(
      "HLS playlist and segment",
      () => inspectHlsPlaylist(playlistPath, hlsDir),
      20_000,
    );

    await stopChild(publisher);
    publisher = null;
    await waitForCondition("mock ended status", () => {
      const status = readSmokeStatus(statusFile);
      return status?.status === "ended" && status.endedUpdates === 1 ? status : null;
    }, 15_000);

    const finalStatus = readSmokeStatus(statusFile);
    console.log(JSON.stringify({
      ok: true,
      rtmpPort,
      streamKey,
      unsignedPublishRejected: true,
      playlistFound: true,
      segmentsFound: hlsResult.segments.length,
      mockStatus: finalStatus?.status,
      mockQueries: finalStatus?.queries,
      unverified: [
        "Express HTTP /hls serving was not exercised; this test reads the production HLS filesystem path.",
        "No production DATABASE_URL, users, or stream rows were used.",
      ],
    }, null, 2));
  } finally {
    await stopChild(unsignedPublisher).catch(() => {});
    await stopChild(publisher).catch(() => {});
    if (rtmpHandle) {
      await waitForPromise("RTMP server shutdown", rtmpHandle.stop(), 10_000).catch(() => {});
    }
    if (!hadHlsDir && hlsDir.startsWith(`${path.join(HLS_ROOT, "live")}${path.sep}`)) {
      await fsp.rm(hlsDir, { recursive: true, force: true }).catch(() => {});
    }
    await fsp.rm(tempDir, { recursive: true, force: true }).catch(() => {});
    for (const [name, previous] of changedEnvironment) {
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    }
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = originalDatabaseUrl;
  }
}

function pathToFileUrl(filePath) {
  return new URL(`file://${filePath.split(path.sep).map(encodeURIComponent).join("/")}`).href;
}

function waitForPromise(label, promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

main().catch((error) => {
  console.error(`RTMP smoke test failed: ${error?.message || error}`);
  if (error?.stack) console.error(error.stack);
  process.exitCode = 1;
});