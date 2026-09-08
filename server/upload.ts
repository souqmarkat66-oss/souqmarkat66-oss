import multer from "multer";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import type { RequestHandler } from "express";
import sharp from "sharp";
import { execFile } from "child_process";

const uploadsDir = path.join(process.cwd(), "uploads");
const quarantineDir = path.join(uploadsDir, ".quarantine");
fs.mkdirSync(quarantineDir, { recursive: true });

type MediaKind = "jpeg" | "png" | "gif" | "webp" | "mp4" | "mov" | "avi" | "webm";
type UploadMode = "image" | "media";

const declaredTypes: Record<string, { kind: "image" | "video"; extensions: string[] }> = {
  "image/jpeg": { kind: "image", extensions: [".jpg", ".jpeg"] },
  "image/png": { kind: "image", extensions: [".png"] },
  "image/gif": { kind: "image", extensions: [".gif"] },
  "image/webp": { kind: "image", extensions: [".webp"] },
  "video/mp4": { kind: "video", extensions: [".mp4"] },
  "video/quicktime": { kind: "video", extensions: [".mov"] },
  "video/x-msvideo": { kind: "video", extensions: [".avi"] },
  "video/webm": { kind: "video", extensions: [".webm"] },
};

function detectMediaKind(header: Buffer): MediaKind | null {
  if (header.length >= 3 && header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff) return "jpeg";
  if (header.length >= 8 && header.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (header.length >= 6 && ["GIF87a", "GIF89a"].includes(header.subarray(0, 6).toString("ascii"))) return "gif";
  if (header.length >= 12 && header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  if (header.length >= 12 && header.subarray(0, 4).toString("ascii") === "RIFF" && header.subarray(8, 11).toString("ascii") === "AVI") return "avi";
  if (header.length >= 4 && header.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]))) return "webm";
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
  if (kind === "webm") return ["video/webm"];
  return ["video/mp4"];
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

function probeVideo(filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=format_name,duration", "-of", "json", filePath],
      { timeout: 20_000, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) return reject(new Error("Invalid video container"));
        try {
          const parsed = JSON.parse(stdout);
          if (!parsed?.format?.format_name) throw new Error("Missing video format");
          resolve();
        } catch {
          reject(new Error("Invalid video container"));
        }
      },
    );
  });
}

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

  let finalExtension: string;
  let finalMime: string;
  const finalId = uuidv4();

  if (isImage) {
    const image = sharp(file.path, { animated: true, failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    const metadata = await image.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 12_000 || metadata.height > 12_000) {
      throw new Error("أبعاد الصورة غير صالحة");
    }
    if (detected === "jpeg") {
      finalExtension = ".jpg";
      finalMime = "image/jpeg";
      await image.jpeg({ quality: 90, mozjpeg: true }).toFile(path.join(uploadsDir, `${finalId}${finalExtension}`));
    } else if (detected === "png") {
      finalExtension = ".png";
      finalMime = "image/png";
      await image.png({ compressionLevel: 9 }).toFile(path.join(uploadsDir, `${finalId}${finalExtension}`));
    } else {
      finalExtension = ".webp";
      finalMime = "image/webp";
      await image.webp({ quality: 90 }).toFile(path.join(uploadsDir, `${finalId}${finalExtension}`));
    }
  } else {
    await probeVideo(file.path);
    finalExtension = detected === "mov" ? ".mov" : detected === "avi" ? ".avi" : detected === "webm" ? ".webm" : ".mp4";
    finalMime = expectedMime(detected)[0];
    await fs.promises.rename(file.path, path.join(uploadsDir, `${finalId}${finalExtension}`));
  }

  const finalName = `${finalId}${finalExtension}`;
  const finalPath = path.join(uploadsDir, finalName);
  await fs.promises.chmod(finalPath, 0o640);
  const stat = await fs.promises.stat(finalPath);
  if (isImage) await fs.promises.rm(file.path, { force: true });
  file.filename = finalName;
  file.path = finalPath;
  file.destination = uploadsDir;
  file.mimetype = finalMime;
  file.size = stat.size;
  file.originalname = path.basename(file.originalname).replace(/[\0-\x1f\x7f]/g, "").slice(0, 255);
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
      const declared = declaredTypes[file.mimetype];
      const extension = path.extname(file.originalname).toLowerCase();
      const allowedMode = mode === "media" || declared?.kind === "image";
      if (declared && allowedMode && declared.extensions.includes(extension)) cb(null, true);
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