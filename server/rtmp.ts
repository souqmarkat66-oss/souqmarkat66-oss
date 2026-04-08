import NodeMediaServer from "node-media-server";
import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { db } from "./db";
import { sql } from "drizzle-orm";

const HLS_DIR = "/tmp/hls";
if (!fs.existsSync(HLS_DIR)) fs.mkdirSync(HLS_DIR, { recursive: true });

const activeTranscoders = new Map<string, ReturnType<typeof spawn>>();

export function startRtmpServer() {
  const nms = new NodeMediaServer({
    rtmp: {
      port: 1935,
      chunk_size: 60000,
      gop_cache: true,
      ping: 30,
      ping_timeout: 60,
    },
    http: {
      port: 8000,
      allow_origin: "*",
      mediaroot: HLS_DIR,
    },
    trans: {
      ffmpeg: "/nix/store/hm5p1jkyrqp2jinklggxv8q7qg1glf03-replit-runtime-path/bin/ffmpeg",
      tasks: [
        {
          app: "live",
          hls: true,
          hlsFlags: "[hls_time=2:hls_list_size=3:hls_flags=delete_segments]",
          hlsKeep: false,
          dash: false,
        },
      ],
    },
  } as any);

  nms.on("prePublish", async (id: string, StreamPath: string, _args: any) => {
    const streamKey = StreamPath.split("/").pop();
    if (!streamKey) return;
    console.log(`[RTMP] Stream starting: ${streamKey}`);

    try {
      await db.execute(sql`
        UPDATE live_streams
        SET status = 'live', started_at = NOW(), stream_mode = 'rtmp'
        WHERE stream_key = ${streamKey}
      `);
    } catch (e: any) {
      console.error("[RTMP] DB update error:", e.message);
    }
  });

  nms.on("donePublish", async (id: string, StreamPath: string, _args: any) => {
    const streamKey = StreamPath.split("/").pop();
    if (!streamKey) return;
    console.log(`[RTMP] Stream ended: ${streamKey}`);

    const proc = activeTranscoders.get(streamKey);
    if (proc) { proc.kill(); activeTranscoders.delete(streamKey); }

    try {
      await db.execute(sql`
        UPDATE live_streams
        SET status = 'ended', ended_at = NOW()
        WHERE stream_key = ${streamKey}
      `);
    } catch (e: any) {
      console.error("[RTMP] DB update error:", e.message);
    }

    setTimeout(() => {
      const dir = path.join(HLS_DIR, "live", streamKey);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    }, 30000);
  });

  // Handle port-already-in-use gracefully
  nms.on('error', (err: any) => {
    console.warn("[RTMP] Server error (non-fatal):", err?.message || err);
  });

  try {
    nms.run();
    console.log("[RTMP] Server started on port 1935 (RTMP) and 8000 (HLS)");
  } catch (e: any) {
    console.warn("[RTMP] Could not start (port may be busy):", e.message);
  }
  return nms;
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
