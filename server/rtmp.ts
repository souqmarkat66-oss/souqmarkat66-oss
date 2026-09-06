import NodeMediaServer from "node-media-server";
import { spawn } from "child_process";
import { createHash } from "crypto";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { sql } from "drizzle-orm";

const HLS_DIR = "/tmp/hls";
if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

type StreamOwner = {
  streamKey: string;
  sessionId: string;
  generation: number;
  closed: boolean;
  pendingTranscoder?: ReturnType<typeof setTimeout>;
  transcoder?: ReturnType<typeof spawn>;
  forceKillTimer?: ReturnType<typeof setTimeout>;
  cleanupTimer?: ReturnType<typeof setTimeout>;
};

const validStreamKeys = new Set<string>();
const rtmpAuthSecret = process.env.RTMP_AUTH_SECRET || process.env.SESSION_SECRET;
const configuredRtmpPort = Number(process.env.RTMP_PORT || 1935);
const rtmpPort = Number.isInteger(configuredRtmpPort) && configuredRtmpPort > 0 && configuredRtmpPort <= 65535
  ? configuredRtmpPort
  : 1935;

export function getRtmpPublisherKey(streamKey: string, lifetimeSeconds = 86400) {
  if (!rtmpAuthSecret) throw new Error("RTMP authentication secret is not configured");
  const expiresAt = Math.floor(Date.now() / 1000) + lifetimeSeconds;
  const signature = createHash("md5")
    .update(`/live/${streamKey}-${expiresAt}-${rtmpAuthSecret}`)
    .digest("hex");
  return `${streamKey}?sign=${expiresAt}-${signature}`;
}

export function registerRtmpStreamKey(streamKey: string, previousKey?: string | null) {
  if (previousKey) validStreamKeys.delete(previousKey);
  if (/^[A-Za-z0-9_-]{8,128}$/.test(streamKey)) validStreamKeys.add(streamKey);
}

export async function startRtmpServer() {
  if (!rtmpAuthSecret) throw new Error("RTMP authentication secret is not configured");
  const keys: any = await db.execute(sql`
    SELECT stream_key
    FROM live_streams
    WHERE stream_key IS NOT NULL AND stream_key <> ''
  `);
  for (const row of keys.rows || []) registerRtmpStreamKey(String(row.stream_key));

  const nms = new NodeMediaServer({
    bind: "0.0.0.0",
    rtmp: {
      port: rtmpPort,
      chunk_size: 60000,
      gop_cache: true,
      ping: 30,
      ping_timeout: 60,
    },
    auth: {
      publish: true,
      play: false,
      secret: rtmpAuthSecret,
    },
  } as any);

  const getStreamKey = (session: any) => {
    const streamPath = String(session?.streamPath || "");
    const streamKey = String(session?.streamName || streamPath.split("/").pop() || "");
    return streamPath.startsWith("/live/") && /^[A-Za-z0-9_-]{8,128}$/.test(streamKey)
      ? streamKey
      : null;
  };

  const streamOwners = new Map<string, StreamOwner>();
  const sessionOwners = new Map<string, StreamOwner>();
  const generations = new Map<string, number>();
  const operationQueues = new Map<string, Promise<void>>();
  const rejectedSessions = new Set<string>();
  let stopping = false;

  const isSignedPublisher = (session: any, streamKey: string) => {
    const sign = String(session?.streamQuery?.sign || "");
    const [expiryText, suppliedSignature, ...extra] = sign.split("-");
    if (extra.length || !/^\d+$/.test(expiryText) || !/^[a-f0-9]{32}$/.test(suppliedSignature || "")) return false;
    const expiresAt = Number(expiryText);
    if (!Number.isSafeInteger(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) return false;
    const expectedSignature = createHash("md5")
      .update(`/live/${streamKey}-${expiresAt}-${rtmpAuthSecret}`)
      .digest("hex");
    return suppliedSignature === expectedSignature;
  };

  const cancelOwnerResources = (owner: StreamOwner) => {
    if (owner.pendingTranscoder) {
      clearTimeout(owner.pendingTranscoder);
      owner.pendingTranscoder = undefined;
    }
    if (owner.cleanupTimer) {
      clearTimeout(owner.cleanupTimer);
      owner.cleanupTimer = undefined;
    }
    if (owner.transcoder && !owner.forceKillTimer) {
      const transcoder = owner.transcoder;
      transcoder.kill("SIGTERM");
      owner.forceKillTimer = setTimeout(() => {
        owner.forceKillTimer = undefined;
        if (owner.transcoder === transcoder) transcoder.kill("SIGKILL");
      }, 2000);
    }
  };

  const enqueueStreamOperation = (streamKey: string, operation: () => Promise<void>) => {
    const previous = operationQueues.get(streamKey) || Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(operation)
      .catch((error: any) => console.error("[RTMP] Stream operation error:", error?.message || error));
    const tracked = next.finally(() => {
      if (operationQueues.get(streamKey) === tracked) operationQueues.delete(streamKey);
    });
    operationQueues.set(streamKey, tracked);
  };

  const rejectPublisher = (session: any) => {
    rejectedSessions.add(String(session?.id || ""));
    // NMS v4 forwards parsed packets without checking isPublisher. Disable the
    // parser callback before destroying a rejected socket so buffered packets
    // cannot enter an existing broadcast.
    if (session?.rtmp) session.rtmp.onPacketCallback = () => {};
    session?.socket?.destroy?.();
  };

  nms.on("prePublish", (session: any) => {
    if (stopping) {
      rejectPublisher(session);
      return;
    }
    const streamKey = getStreamKey(session);
    if (!streamKey || !validStreamKeys.has(streamKey) || !isSignedPublisher(session, streamKey)) {
      console.warn("[RTMP] Closing publisher with invalid credentials");
      rejectPublisher(session);
      return;
    }

    // Let Node-Media-Server reject a true simultaneous duplicate without
    // replacing the owner of the already-active publisher.
    if (session?.broadcast?.publisher) {
      rejectPublisher(session);
      return;
    }

    const previous = streamOwners.get(streamKey);
    if (previous) {
      previous.closed = true;
      cancelOwnerResources(previous);
    }
    const owner: StreamOwner = {
      streamKey,
      sessionId: String(session?.id || ""),
      generation: (generations.get(streamKey) || 0) + 1,
      closed: false,
    };
    generations.set(streamKey, owner.generation);
    streamOwners.set(streamKey, owner);
    sessionOwners.set(owner.sessionId, owner);
  });

  nms.on("postPublish", (session: any) => {
    if (rejectedSessions.delete(String(session?.id || ""))) return;
    const owner = sessionOwners.get(String(session?.id || ""));
    if (!owner) {
      console.warn("[RTMP] Rejected unsupported stream path");
      session.close?.();
      return;
    }
    const { streamKey } = owner;
    console.log(`[RTMP] Stream starting: ${streamKey}`);

    enqueueStreamOperation(streamKey, async () => {
      if (stopping || owner.closed || streamOwners.get(streamKey) !== owner) return;
      let updated: any;
      try {
        updated = await db.execute(sql`
          UPDATE live_streams
          SET status = 'live', started_at = NOW(), ended_at = NULL, stream_mode = 'rtmp'
          WHERE stream_key = ${streamKey}
          RETURNING id
        `);
      } catch (e: any) {
        console.error("[RTMP] DB update error:", e.message);
        owner.closed = true;
        session.close?.();
        return;
      }
      if (!updated.rows?.length) {
        owner.closed = true;
        console.warn("[RTMP] Closing publisher with an unknown stream key");
        session.close?.();
        return;
      }
      if (stopping || owner.closed || streamOwners.get(streamKey) !== owner) return;

      const outputDir = path.join(HLS_DIR, "live", streamKey);
      cancelOwnerResources(owner);
      if (fs.existsSync(outputDir)) fs.rmSync(outputDir, { recursive: true, force: true });
      fs.mkdirSync(outputDir, { recursive: true });

      // Node-Media-Server v4 accepts RTMP but no longer implements the old
      // built-in `trans` configuration. Express serves these HLS files on the
      // application's one public HTTP port, avoiding a competing port 8000.
      owner.pendingTranscoder = setTimeout(() => {
        owner.pendingTranscoder = undefined;
        if (stopping || owner.closed || streamOwners.get(streamKey) !== owner) return;
        const ffmpeg = spawn(process.env.FFMPEG_PATH || "ffmpeg", [
          "-nostdin",
          "-hide_banner",
          "-loglevel", "warning",
          "-i", `rtmp://127.0.0.1:${rtmpPort}/live/${streamKey}`,
          "-c:v", "copy",
          "-c:a", "aac",
          "-f", "hls",
          "-hls_time", "2",
          "-hls_list_size", "6",
          "-hls_flags", "delete_segments+append_list",
          path.join(outputDir, "index.m3u8"),
        ], { stdio: ["ignore", "ignore", "pipe"] });
        owner.transcoder = ffmpeg;
        ffmpeg.stderr?.on("data", (chunk) => {
          const message = String(chunk).trim();
          if (message) console.warn(`[RTMP/FFmpeg] ${message}`);
        });
        ffmpeg.on("error", (error) => {
          console.error("[RTMP/FFmpeg] Could not start transcoder:", error.message);
        });
        ffmpeg.on("exit", () => {
          if (owner.transcoder === ffmpeg) {
            owner.transcoder = undefined;
            if (owner.forceKillTimer) {
              clearTimeout(owner.forceKillTimer);
              owner.forceKillTimer = undefined;
            }
          }
        });
      }, 300);
    });
  });

  nms.on("donePublish", (session: any) => {
    const sessionId = String(session?.id || "");
    rejectedSessions.delete(sessionId);
    const owner = sessionOwners.get(sessionId);
    if (!owner) return;
    sessionOwners.delete(sessionId);
    owner.closed = true;
    cancelOwnerResources(owner);
    const { streamKey } = owner;
    console.log(`[RTMP] Stream ended: ${streamKey}`);

    enqueueStreamOperation(streamKey, async () => {
      if (streamOwners.get(streamKey) !== owner) return;
      try {
        await db.execute(sql`
          UPDATE live_streams
          SET status = 'ended', ended_at = NOW()
          WHERE stream_key = ${streamKey}
        `);
      } catch (e: any) {
        console.error("[RTMP] DB update error:", e.message);
      }
      if (stopping || streamOwners.get(streamKey) !== owner || !owner.closed) return;
      owner.cleanupTimer = setTimeout(() => {
        owner.cleanupTimer = undefined;
        if (streamOwners.get(streamKey) !== owner || !owner.closed) return;
        const dir = path.join(HLS_DIR, "live", streamKey);
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      }, 30000);
    });
  });

  const rtmpServer = (nms as any).rtmpServer?.tcpServer;
  rtmpServer?.on("error", (error: any) => {
    console.error("[RTMP] Server error:", error?.message || error);
  });
  nms.run();
  console.log(`[RTMP] Server started on port ${rtmpPort}; HLS is served by the application`);
  return {
    stop: async () => {
      stopping = true;
      rejectedSessions.clear();
      streamOwners.forEach(owner => {
        owner.closed = true;
        cancelOwnerResources(owner);
      });
      sessionOwners.clear();
      await new Promise<void>((resolve) => {
        if (!rtmpServer?.listening) return resolve();
        rtmpServer.close(() => resolve());
      });
      await Promise.allSettled(Array.from(operationQueues.values()));
      streamOwners.clear();
      operationQueues.clear();
    },
  };
}

export function getHlsPath(streamKey: string) {
  return path.join(HLS_DIR, "live", streamKey, "index.m3u8");
}

export function isStreamLive(streamKey: string): boolean {
  const p = getHlsPath(streamKey);
  if (!fs.existsSync(p)) return false;
  const stat = fs.statSync(p);
  return Date.now() - stat.mtimeMs < 10000;
}
