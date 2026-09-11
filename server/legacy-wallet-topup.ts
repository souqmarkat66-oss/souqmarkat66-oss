import { canonicalPaymentReference } from "./payment-proof";
import { parseLedgerAmount } from "./wallet-ledger";

/**
 * The legacy wallet endpoint predates the exact-piaster manual-payment
 * validation. Keep its compatibility boundary explicit so malformed rows are
 * never turned into a ledger mutation.
 */
export const LEGACY_WALLET_TOPUP_MAX_EGP = 1_000_000;

export function legacyWalletTopUpReference(value: unknown): string {
  if (typeof value !== "string") return "";
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > 160) return "";
  return canonicalPaymentReference(trimmed);
}

/**
 * Old wallet submissions accepted absolute URLs while current uploads use
 * /uploads/... paths. A path is only a comparison key here; it is not proof
 * validation and must never be used to grant a payment by itself.
 */
export function legacyPaymentProofLocator(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const raw = value.trim();
  if (!raw || raw.length > 2_048) return null;

  let pathname = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      pathname = new URL(raw).pathname;
    } catch {
      return null;
    }
  }
  if (pathname.startsWith("/api/uploads/")) pathname = pathname.slice("/api".length);
  if (!pathname.startsWith("/uploads/")) return null;
  const filename = pathname.slice("/uploads/".length);
  if (
    !filename
    || filename !== filename.split("/").at(-1)
    || filename.includes("\\")
    || filename.includes("\0")
  ) {
    return null;
  }
  return `/uploads/${filename}`;
}

export function parseLegacyWalletTopUpAmount(value: unknown): number {
  const amount = parseLedgerAmount(value, "wallet top-up amount");
  if (
    amount <= 0
    || amount > LEGACY_WALLET_TOPUP_MAX_EGP
    || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8
  ) {
    throw new Error("Invalid wallet top-up amount");
  }
  return Math.round(amount * 100) / 100;
}