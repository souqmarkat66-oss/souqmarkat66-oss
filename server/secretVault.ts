import crypto from "crypto";
import { pool } from "./db";

export const VAULT_SECRET_DEFINITIONS = [
  { name: "openai_api_key", label: "OpenAI API key", env: ["OPENAI_API_KEY", "AI_INTEGRATIONS_OPENAI_API_KEY"], description: "OpenAI text, image, and audio services" },
  { name: "gemini_api_key", label: "Google Gemini API key", env: ["GEMINI_API_KEY", "GOOGLE_API_KEY"], description: "Google Gemini AI services" },
  { name: "deepseek_api_key", label: "DeepSeek API key", env: ["DEEPSEEK_API_KEY"], description: "DeepSeek AI services" },
  { name: "anthropic_api_key", label: "Anthropic API key", env: ["ANTHROPIC_API_KEY"], description: "Claude AI services" },
  { name: "afs_entity_id", label: "AFS entity ID", env: ["AFS_ENTITY_ID"], description: "COPYandPAY payment integration" },
  { name: "afs_access_token", label: "AFS access token", env: ["AFS_ACCESS_TOKEN"], description: "COPYandPAY payment integration" },
  { name: "did_api_key", label: "D-ID API key", env: ["DID_API_KEY"], description: "Avatar video integration" },
] as const;

export type VaultSecretName = (typeof VAULT_SECRET_DEFINITIONS)[number]["name"];
const definitions = new Map<string, (typeof VAULT_SECRET_DEFINITIONS)[number]>(
  VAULT_SECRET_DEFINITIONS.map(definition => [definition.name, definition]),
);

function masterKey(): Buffer {
  const raw = process.env.SECRET_VAULT_MASTER_KEY?.trim();
  if (raw) {
    const decoded = /^[0-9a-f]{64}$/i.test(raw)
      ? Buffer.from(raw, "hex")
      : Buffer.from(raw, "base64");
    if (decoded.length === 32) return decoded;
    if (raw.length >= 32) return crypto.createHash("sha256").update(raw).digest();
  }
  const sessionSecret = process.env.SESSION_SECRET?.trim();
  if (sessionSecret && sessionSecret.length >= 32) {
    return crypto.createHmac("sha256", sessionSecret).update("secret-vault-master-v1").digest();
  }
  throw new Error("Secret vault is not configured");
}

function encrypt(value: string): { encrypted: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", masterKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return { encrypted: encrypted.toString("base64"), iv: iv.toString("base64"), tag: cipher.getAuthTag().toString("base64") };
}

function decrypt(row: { encrypted_value: string; iv: string; auth_tag: string }): string | null {
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", masterKey(), Buffer.from(row.iv, "base64"));
    decipher.setAuthTag(Buffer.from(row.auth_tag, "base64"));
    return Buffer.concat([
      decipher.update(Buffer.from(row.encrypted_value, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

export function isVaultSecretName(value: string): value is VaultSecretName {
  return definitions.has(value);
}

export function hasEnvironmentSecret(name: VaultSecretName): boolean {
  return definitions.get(name)?.env.some(variable => !!process.env[variable]?.trim()) ?? false;
}

export function validateVaultSecret(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const clean = value.trim();
  if (clean.length < 10 || clean.length > 4096 || /[\0\r\n]/.test(clean)) return null;
  return clean;
}

/** Environment variables always win. This function never logs or returns metadata. */
export async function getProviderSecret(name: VaultSecretName): Promise<string | null> {
  const definition = definitions.get(name);
  if (!definition) return null;
  for (const variable of definition.env) {
    const value = process.env[variable]?.trim();
    if (value) return value;
  }
  try {
    const result = await pool.query(
      "SELECT encrypted_value, iv, auth_tag FROM secret_vault WHERE name = $1 LIMIT 1",
      [name],
    );
    return result.rows[0] ? decrypt(result.rows[0]) : null;
  } catch {
    return null;
  }
}

export async function listVaultSecretMetadata() {
  const rows = await pool.query("SELECT name, masked_last4, updated_at FROM secret_vault");
  const stored = new Map(rows.rows.map(row => [row.name, row]));
  return [
    ...VAULT_SECRET_DEFINITIONS.map(definition => {
      const environmentConfigured = hasEnvironmentSecret(definition.name);
      const row = stored.get(definition.name);
      return {
        name: definition.name,
        label: definition.label,
        description: definition.description,
        configured: environmentConfigured || !!row,
        source: environmentConfigured ? "environment" : row ? "vault" : null,
        environmentManaged: environmentConfigured,
        updatedAt: environmentConfigured ? null : row?.updated_at?.toISOString?.() ?? null,
        // A suffix recorded at save time is the only vault display data; env values
        // are never inspected for display.
        maskedLast4: environmentConfigured ? null : row?.masked_last4 ?? null,
      };
    }),
    {
      name: "database_url",
      label: "Database connection (DATABASE_URL)",
      description: "Environment-managed only; database connection strings cannot be stored in this vault.",
      configured: !!process.env.DATABASE_URL,
      source: process.env.DATABASE_URL ? "environment" as const : null,
      environmentManaged: true,
      updatedAt: null,
      maskedLast4: null,
    },
  ];
}

export async function setVaultSecret(name: VaultSecretName, value: string, updatedBy: string): Promise<void> {
  const secured = encrypt(value);
  await pool.query(
    `INSERT INTO secret_vault (name, encrypted_value, iv, auth_tag, masked_last4, updated_by, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (name) DO UPDATE SET encrypted_value = EXCLUDED.encrypted_value, iv = EXCLUDED.iv,
       auth_tag = EXCLUDED.auth_tag, masked_last4 = EXCLUDED.masked_last4, updated_by = EXCLUDED.updated_by, updated_at = NOW()`,
    [name, secured.encrypted, secured.iv, secured.tag, value.slice(-4), updatedBy],
  );
}

export async function deleteVaultSecret(name: VaultSecretName): Promise<void> {
  await pool.query("DELETE FROM secret_vault WHERE name = $1", [name]);
}