import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import type { RequestHandler } from "express";
import sharp from "sharp";
import { execFile } from "child_process";

const uploadsDir = path.join(process.cwd(), "uploads");
const quarantineDir = path.join(uploadsDir, ".quarantine");
const QUARANTINE_TTL_MS = 60 * 60 * 1000;
const MAX_MEDIA_DURATION_SECONDS = 24 * 60 * 60;
const MAX_DURATIONLESS_WEBM_BYTES = 25 * 1024 * 1024;
fs.mkdirSync(quarantineDir, { recursive: true, mode: 0o700 });
fs.chmodSync(quarantineDir, 0o700);

type MediaKind = "jpeg" | "png" | "gif" | "webp" | "mp4" | "mov" | "avi" | "webm" | "ogg";
type UploadMode = "image" | "media";
type DeclaredKind = "image" | "video" | "audio";

const declaredTypes: Record<string, { kind: DeclaredKind; extensions: string[] }> = {
  "image/jpeg": { kind: "image", extensions: [".jpg", ".jpeg"] },
  "image/png": { kind: "image", extensions: [".png"] },
  "image/gif": { kind: "image", extensions: [".gif"] },
  "image/webp": { kind: "image", extensions: [".webp"] },
  "video/mp4": { kind: "video", extensions: [".mp4"] },
  "video/quicktime": { kind: "video", extensions: [".mov"] },
  "video/x-msvideo": { kind: "video", extensions: [".avi"] },
  "video/webm": { kind: "video", extensions: [".webm"] },
  "audio/webm": { kind: "audio", extensions: [".webm"] },
  "audio/ogg": { kind: "audio", extensions: [".ogg", ".oga"] },
  "audio/mp4": { kind: "audio", extensions: [".mp4", ".m4a"] },
};

function detectMediaKind(header: Buffer): MediaKind | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "jpeg";
  if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (header.length >= 6 && ["GIF87a", "GIF89a"].includes(header.subarray(0, 6).toString("ascii"))) return "gif";
  if (header.length >= 12 && header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (header.length >= 12 && header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 11).toString("ascii") === "AVI") return "avi";
  if (header.length >= 4 && header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "webm";
  if (header.length >= 4 && header.subarray(0, 4).toString("ascii") === "OggS") return "ogg";
  if (header.length >= 12 && header.subarray(4, 8).toString("ascii") === "ftyp") {
    const brand = header.subarray(8, 12).toString("ascii").toLowerCase();
    return brand.includes("qt") ? "mov" : "mp4";
  }
  return null;
}

function expectedMime(kind: MediaKind): string[] {
  if (kind === "jpeg") return ["image/jpeg"];
  if (kind === "png") return ["image/png"];
  if (kind === "gif") return ["image/gif"];
  if (kind === "webp") return ["image/webp"];
  if (kind === "mov") return ["video/quicktime", "video/mp4"];
  if (kind === "avi") return ["video/x-msvideo"];
  if (kind === "webm") return ["video/webm", "audio/webm"];
  if (kind === "ogg") return ["audio/ogg"];
  return ["video/mp4", "audio/mp4"];
}

async function containsExecutableMarker(filePath: string): Promise<boolean> {
  const markers = ["<?php", "<?=", "<script", "#!/usr/bin/php", "application/x-httpd-php"];
  let carry = "";
  for await (const chunk of fs.createReadStream(filePath, { highWaterMark: 64 * 1024 })) {
    const text = (carry + (chunk as Buffer).toString("latin1")).toLowerCase();
    if (markers.some(marker => text.includes(marker))) return true;
    carry = text.slice(-64);
  }
  return false;
}

function formatMatchesDetected(formatName: string, detected: MediaKind): boolean {
  const formats = new Set(formatName.toLowerCase().split(","));
  if (detected === "webm") return formats.has("webm") || formats.has("matroska");
  if (detected === "ogg") return formats.has("ogg");
  if (detected === "avi") return formats.has("avi");
  if (detected === "mov" || detected === "mp4") return formats.has("mov") || formats.has("mp4");
  return false;
}

function runFfprobe(args: string[], maxBuffer = 1024 * 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      args,
      { timeout: 20_000, maxBuffer },
      (error, stdout) => {
        if (error) return reject(new Error("Invalid media container"));
        resolve(String(stdout));
      },
    );
  });
}

async function deriveWebmAudioDuration(filePath: string): Promise<number> {
  const stat = await fs.promises.stat(filePath);
  if (stat.size > MAX_DURATIONLESS_WEBM_BYTES) throw new Error("Durationless audio is too large");
  const stdout = await runFfprobe(
    [
      "-v", "error",
      "-select_streams", "a:0",
      "-show_packets",
      "-show_entries", "packet=pts_time,dts_time,duration_time",
      "-of", "json",
      filePath,
    ],
    4 * 1024 * 1024,
  );
  const parsed = JSON.parse(stdout);
  const packets = Array.isArray(parsed?.packets) ? parsed.packets : [];
  let endTime = 0;
  for (const packet of packets) {
    const start = Number(packet?.pts_time ?? packet?.dts_time);
    const packetDuration = Number(packet?.duration_time);
    if (Number.isFinite(start)) {
      endTime = Math.max(endTime, start + (Number.isFinite(packetDuration) ? packetDuration : 0));
    }
  }
  if (!Number.isFinite(endTime) || endTime <= 0) throw new Error("Missing audio duration");
  return endTime;
}

async function probeMedia(filePath: string, detected: MediaKind, declaredKind: "audio" | "video"): Promise<void> {
  try {
    const stdout = await runFfprobe([
      "-v", "error",
      "-show_entries", "format=format_name,duration:stream=codec_type,width,height,duration",
      "-of", "json",
      filePath,
    ]);
    const parsed = JSON.parse(stdout);
    const formatName = parsed?.format?.format_name;
    const streams = Array.isArray(parsed?.streams) ? parsed.streams : [];
    const requestedStreams = streams.filter((stream: any) => stream?.codec_type === declaredKind);
    const hasUnexpectedVideo = declaredKind === "audio" && streams.some((stream: any) => stream?.codec_type === "video");
    let duration = Number(parsed?.format?.duration ?? requestedStreams[0]?.duration);
    if (
      !Number.isFinite(duration) &&
      declaredKind === "audio" &&
      detected === "webm"
    ) {
      duration = await deriveWebmAudioDuration(filePath);
    }
    if (
      !formatName ||
      !formatMatchesDetected(formatName, detected) ||
      requestedStreams.length === 0 ||
      hasUnexpectedVideo ||
      !Number.isFinite(duration) ||
      duration <= 0 ||
      duration > MAX_MEDIA_DURATION_SECONDS
    ) {
      throw new Error("Invalid media metadata");
    }
    if (declaredKind === "video") {
      const validDimensions = requestedStreams.every((stream: any) => {
        const width = Number(stream?.width);
        const height = Number(stream?.height);
        return Number.isInteger(width) && Number.isInteger(height) &&
          width > 0 && height > 0 && width <= 8192 && height <= 8192;
      });
      if (!validDimensions) throw new Error("Invalid video dimensions");
    }
  } catch {
    throw new Error("Invalid media container");
  }
}

async function cleanupStaleQuarantineFiles(): Promise<void> {
  const now = Date.now();
  const entries = await fs.promises.readdir(quarantineDir, { withFileTypes: true });
  await Promise.all(entries.map(async entry => {
    if (!entry.isFile()) return;
    const candidate = path.join(quarantineDir, entry.name);
    const stat = await fs.promises.lstat(candidate);
    if (now - stat.mtimeMs > QUARANTINE_TTL_MS) {
      await fs.promises.rm(candidate, { force: true });
    }
  }));
}

void cleanupStaleQuarantineFiles().catch(error => {
  console.warn("[Upload security] quarantine cleanup failed:", error?.message);
});
const quarantineCleanupTimer = setInterval(() => {
  void cleanupStaleQuarantineFiles().catch(error => {
    console.warn("[Upload security] quarantine cleanup failed:", error?.message);
  });
}, 30 * 60 * 1000);
quarantineCleanupTimer.unref();

async function secureStoredFile(file: Express.Multer.File, mode: UploadMode): Promise<void> {
  const handle = await fs.promises.open(file.path, "r");
  const header = Buffer.alloc(32);
  try {
    await handle.read(header, 0, header.length, 0);
  } finally {
    await handle.close();
  }

  const detected = detectMediaKind(header);
  const isImage = detected && ["jpeg", "png", "gif", "webp"].includes(detected);
  if (!detected || !expectedMime(detected).includes(file.mimetype) || (mode === "image" && !isImage)) {
    throw new Error("محتوى الملف لا يطابق نوعه المعلن");
  }
  if (await containsExecutableMarker(file.path)) {
    throw new Error("تم رفض الملف لاحتوائه على محتوى تنفيذي");
  }

  let finalExtension = "";
  let finalMime = "";
  const finalId = uuidv4();
  let stagingPath = file.path;
  let finalPath: string | null = null;

  try {
    if (isImage) {
      const image = sharp(file.path, { animated: true, failOn: "error", limitInputPixels: 40_000_000 }).rotate();
      const metadata = await image.metadata();
      if (!metadata.width || !metadata.height || metadata.width > 12_000 || metadata.height > 12_000) {
        throw new Error("أبعاد الصورة غير صالحة");
      }
      stagingPath = path.join(quarantineDir, `${finalId}.safe`);
      if (detected === "jpeg") {
        finalExtension = ".jpg";
        finalMime = "image/jpeg";
        await image.jpeg({ quality: 90, mozjpeg: true }).toFile(stagingPath);
      } else if (detected === "png") {
        finalExtension = ".png";
        finalMime = "image/png";
        await image.png({ compressionLevel: 9 }).toFile(stagingPath);
      } else {
        finalExtension = ".webp";
        finalMime = "image/webp";
        await image.webp({ quality: 90 }).toFile(stagingPath);
      }
      await fs.promises.rm(file.path, { force: true });
    } else {
      const declaredKind = declaredTypes[file.mimetype]?.kind;
      if (declaredKind !== "audio" && declaredKind !== "video") {
        throw new Error("نوع الوسائط غير مدعوم");
      }
      await probeMedia(file.path, detected, declaredKind);
      finalExtension = detected === "mov" ? ".mov"
        : detected === "avi" ? ".avi"
        : detected === "webm" ? ".webm"
        : detected === "ogg" ? ".ogg"
        : file.mimetype === "audio/mp4" ? ".m4a"
        : ".mp4";
      finalMime = file.mimetype;
    }

    const finalName = `${finalId}${finalExtension}`;
    finalPath = path.join(uploadsDir, finalName);
    await fs.promises.chmod(stagingPath, 0o640);
    const stat = await fs.promises.stat(stagingPath);
    await fs.promises.rename(stagingPath, finalPath);
    file.filename = finalName;
    file.path = finalPath;
    file.destination = uploadsDir;
    file.mimetype = finalMime;
    file.size = stat.size;
    file.originalname = path.basename(file.originalname).replace(/[\0-\x1f\x7f]/g, "").slice(0, 255);
  } catch (error) {
    await Promise.all([
      fs.promises.rm(file.path, { force: true }).catch(() => undefined),
      stagingPath !== file.path ? fs.promises.rm(stagingPath, { force: true }).catch(() => undefined) : Promise.resolve(),
      finalPath ? fs.promises.rm(finalPath, { force: true }).catch(() => undefined) : Promise.resolve(),
    ]);
    throw error;
  }
}

export function secureUpload(field: string, mode: UploadMode = "media"): RequestHandler {
  const parser = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, quarantineDir),
      filename: (_req, _file, cb) => cb(null, `${uuidv4()}.upload`),
    }),
    limits: {
      fileSize: mode === "image" ? 20 * 1024 * 1024 : 200 * 1024 * 1024,
      files: 1,
      fields: 30,
    },
    fileFilter: (_req, file, cb) => {
      const normalizedMime = file.mimetype.split(";", 1)[0].trim().toLowerCase();
      const declared = declaredTypes[normalizedMime];
      const extension = path.extname(file.originalname).toLowerCase();
      const allowedMode = mode === "media" || declared?.kind === "image";
      if (declared && allowedMode && declared.extensions.includes(extension)) {
        file.mimetype = normalizedMime;
        cb(null, true);
      }
      else cb(new multer.MulterError("LIMIT_UNEXPECTED_FILE", field));
    },
  }).single(field);

  return (req, res, next) => {
    parser(req, res, async error => {
      if (error) {
        const status = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ message: "تم رفض الملف: النوع أو الحجم غير مسموح" });
      }
      if (!req.file) return next();
      try {
        await secureStoredFile(req.file, mode);
        next();
      } catch (securityError: any) {
        await fs.promises.rm(req.file.path, { force: true }).catch(() => undefined);
        console.warn("[Upload security] rejected file:", securityError?.message);
        return res.status(400).json({ message: securityError?.message || "تم رفض الملف لأسباب أمنية" });
      }
    });
  };
}