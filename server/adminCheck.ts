import { storage } from "./storage";

export const SUPER_ADMIN_IDS = ["54165148"];
export const SUPER_ADMIN_EMAILS = ["ahmedesmat.5151@gmail.com"];

let _extraAdminIds: Set<string> = new Set();
let _loadedAt = 0;
const CACHE_MS = 30_000;

async function loadExtras(): Promise<Set<string>> {
  if (Date.now() - _loadedAt < CACHE_MS) return _extraAdminIds;
  try {
    const v = await storage.getSetting("extra_admin_ids");
    _extraAdminIds = new Set(
      (v || "").split(",").map((s: string) => s.trim()).filter(Boolean),
    );
    _loadedAt = Date.now();
  } catch {
    /* ignore */
  }
  return _extraAdminIds;
}

export async function checkIsAdmin(opts: { id?: string | null; email?: string | null }): Promise<boolean> {
  // Single-admin policy: only the hardcoded super-admin is an admin.
  // extra_admin_ids is intentionally ignored (privilege-escalation lockdown).
  const id = opts.id ? String(opts.id) : "";
  const email = (opts.email || "").toLowerCase();
  if (id && SUPER_ADMIN_IDS.includes(id)) return true;
  if (email && SUPER_ADMIN_EMAILS.includes(email)) return true;
  return false;
}
