import crypto from "crypto";

type EncryptedPayoutDestination = {
  encrypted: string;
  iv: string;
  authTag: string;
};

function payoutKey(): Buffer {
  const raw = process.env.SECRET_VAULT_MASTER_KEY?.trim();
  if (!raw) {
    throw new Error("SECRET_VAULT_MASTER_KEY is required to protect payout destinations");
  }
  const decoded = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  const master = decoded.length === 32
    ? decoded
    : raw.length >= 32
      ? crypto.createHash("sha256").update(raw).digest()
      : null;
  if (!master) {
    throw new Error("SECRET_VAULT_MASTER_KEY must contain at least 32 characters or 32 encoded bytes");
  }
  return crypto.createHmac("sha256", master).update("payout-destination:v1").digest();
}

export function encryptPayoutDestination(value: string): EncryptedPayoutDestination {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", payoutKey(), iv);
  cipher.setAAD(Buffer.from("payment_requests:payout_destination:v1"));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    encrypted: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptPayoutDestination(row: {
  payoutDestinationEncrypted: string;
  payoutDestinationIv: string;
  payoutDestinationAuthTag: string;
}): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    payoutKey(),
    Buffer.from(row.payoutDestinationIv, "base64"),
  );
  decipher.setAAD(Buffer.from("payment_requests:payout_destination:v1"));
  decipher.setAuthTag(Buffer.from(row.payoutDestinationAuthTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(row.payoutDestinationEncrypted, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function maskPayoutDestination(method: string, value: string): string {
  const clean = value.trim();
  const last4 = clean.replace(/\D/g, "").slice(-4) || clean.slice(-4);
  if (method === "visa_bank") return `•••• •••• •••• ${last4}`;
  if (method === "instapay" && clean.includes("@")) {
    const [handle, provider] = clean.split("@", 2);
    return `${handle.slice(0, 2)}${"•".repeat(Math.max(3, handle.length - 2))}@${provider}`;
  }
  return `•••••••${last4}`;
}