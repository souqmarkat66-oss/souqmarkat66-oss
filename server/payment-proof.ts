import { createHash } from "node:crypto";
import { lstat, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const FULLWIDTH_DIGITS = "０１２３４５６７８９";
const ASCII_DIGITS = "0123456789";
const UPLOADS_DIR = path.resolve(process.cwd(), "uploads");
const MAX_PROOF_BYTES = 20 * 1024 * 1024;
const MAX_PROOF_PIXELS = 40_000_000;
const MAX_PROOF_DIMENSION = 12_000;

/**
 * Payment references are identifiers, not human-readable descriptions.
 * Canonicalization deliberately removes presentation differences while
 * retaining letters and digits, including Arabic letters.
 */
export function canonicalPaymentReference(value: unknown): string {
  if (typeof value !== "string") return "";
  const translated = value
    .normalize("NFKC")
    .replace(/[٠-٩۰-۹]/g, digit => {
      const arabic = ARABIC_DIGITS.indexOf(digit);
      if (arabic >= 0) return ASCII_DIGITS[arabic];
      const persian = PERSIAN_DIGITS.indexOf(digit);
      return persian >= 0 ? ASCII_DIGITS[persian] : digit;
    })
    .toLocaleLowerCase("en-US");
  return Array.from(translated)
    .filter(character => {
      if (/\s/.test(character)) return false;
      const codePoint = character.codePointAt(0) || 0;
      // ASCII punctuation/symbols and the common Unicode punctuation blocks.
      // Digits and letters (including Arabic letters) remain untouched.
      return !(
        (codePoint >= 0x21 && codePoint <= 0x2f) ||
        (codePoint >= 0x3a && codePoint <= 0x40) ||
        (codePoint >= 0x5b && codePoint <= 0x60) ||
        (codePoint >= 0x7b && codePoint <= 0x7e) ||
        (codePoint >= 0x2000 && codePoint <= 0x206f) ||
        (codePoint >= 0x20a0 && codePoint <= 0x20cf) ||
        (codePoint >= 0x2e00 && codePoint <= 0x2e7f) ||
        (codePoint >= 0x3000 && codePoint <= 0x303f) ||
        (codePoint >= 0xfe30 && codePoint <= 0xfe4f) ||
        (codePoint >= 0xff01 && codePoint <= 0xff65)
      );
    })
    .join("");
}

/**
 * Equivalent PostgreSQL expression for legacy rows. The old rows contain the
 * original reference, so SQL must canonicalize them before comparing. Keep
 * column names constants at call sites; this helper is not for user SQL.
 */
export function canonicalPaymentReferenceSql(column: string): string {
  const sourceDigits = `${ARABIC_DIGITS}${PERSIAN_DIGITS}${FULLWIDTH_DIGITS}`;
  const targetDigits = `${ASCII_DIGITS}${ASCII_DIGITS}${ASCII_DIGITS}`;
  // PostgreSQL normalize(..., NFKC) mirrors the JS normalization used for new
  // submissions, including full-width Latin letters and digits in old rows.
  return `lower(regexp_replace(translate(normalize(coalesce(${column}, ''), NFKC), '${sourceDigits}', '${targetDigits}'), '[[:space:][:punct:]]+', '', 'g'))`;
}

export function paymentProofLockKeys(reference: string, proofDigest?: string | null): string[] {
  const keys = [`manual-payment-ref:${reference}`];
  if (proofDigest) keys.push(`manual-payment-proof:${proofDigest}`);
  return keys.sort();
}

export function outgoingTransferReferenceLockKey(reference: string): string {
  return `manual-outgoing-transfer-ref:${reference}`;
}

export type OwnedProofFile = {
  filename: string;
  mimeType: string;
  size?: number | null;
};

/**
 * Hash decoded, orientation-normalized pixels instead of the uploaded bytes.
 * secureUpload has already validated and normalized these local files; this
 * second bounded decode makes metadata-only reuploads produce the same digest.
 * This is only a proof-reuse signal; it does not authenticate the payment.
 */
export async function digestOwnedPaymentProof(
  screenshotUrl: string,
  ownedFile: OwnedProofFile,
): Promise<string> {
  if (!screenshotUrl.startsWith("/uploads/")) {
    throw new Error("Payment proof must be a local upload");
  }
  const filename = screenshotUrl.slice("/uploads/".length);
  if (
    !filename ||
    filename !== path.basename(filename) ||
    filename.includes("\0") ||
    filename.includes("/") ||
    filename.includes("\\") ||
    !ownedFile.filename ||
    ownedFile.filename !== filename ||
    !ownedFile.mimeType.startsWith("image/")
  ) {
    throw new Error("Payment proof upload is invalid");
  }

  const uploadPath = path.resolve(UPLOADS_DIR, filename);
  const relativePath = path.relative(UPLOADS_DIR, uploadPath);
  if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
    throw new Error("Payment proof path is invalid");
  }
  const linkInfo = await lstat(uploadPath);
  if (!linkInfo.isFile() || linkInfo.size > MAX_PROOF_BYTES) {
    throw new Error("Payment proof file is unavailable");
  }
  if (ownedFile.size != null && Number(ownedFile.size) !== linkInfo.size) {
    throw new Error("Payment proof file changed");
  }
  const fileInfo = await stat(uploadPath);
  if (!fileInfo.isFile() || fileInfo.size > MAX_PROOF_BYTES) {
    throw new Error("Payment proof file is unavailable");
  }

  const image = sharp(uploadPath, {
    animated: false,
    failOn: "error",
    limitInputPixels: MAX_PROOF_PIXELS,
  }).rotate();
  const metadata = await image.metadata();
  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width > MAX_PROOF_DIMENSION ||
    metadata.height > MAX_PROOF_DIMENSION ||
    metadata.width * metadata.height > MAX_PROOF_PIXELS
  ) {
    throw new Error("Payment proof image dimensions are invalid");
  }
  const { data, info } = await image
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return createHash("sha256")
    .update(`${info.width}x${info.height}x${info.channels}\0`, "utf8")
    .update(data)
    .digest("hex");
}