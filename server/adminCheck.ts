const configuredAdminId = process.env.ADMIN_USER_ID?.trim();
const configuredAdminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

// Deliberately one configured principal: ID takes precedence, otherwise email.
// The two legacy fallback identifiers refer to the same recovery account.
export const SUPER_ADMIN_IDS = configuredAdminId ? [configuredAdminId] : configuredAdminEmail ? [] : ["54165148"];
export const SUPER_ADMIN_EMAILS = configuredAdminId ? [] : configuredAdminEmail ? [configuredAdminEmail] : ["ahmedesmat.5151@gmail.com"];

/**
 * Canonical administrator identity check.
 *
 * Authorization middleware must use this synchronous function as well as
 * auth/user responses.  Keeping the rule pure prevents custom sessions and
 * Passport sessions from drifting apart.
 */
export function isAdminIdentity(opts: { id?: string | null; email?: string | null }): boolean {
  const id = opts.id ? String(opts.id) : "";
  const email = (opts.email || "").toLowerCase();
  if (id && SUPER_ADMIN_IDS.includes(id)) return true;
  if (email && SUPER_ADMIN_EMAILS.includes(email)) return true;
  return false;
}

export async function checkIsAdmin(opts: { id?: string | null; email?: string | null }): Promise<boolean> {
  return isAdminIdentity(opts);
}
