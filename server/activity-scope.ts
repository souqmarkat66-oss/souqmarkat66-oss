/**
 * Resolve the user scope for authenticated payment/activity reads.
 *
 * Administrators may use the existing all-users view, but a personal report
 * must opt into `scope=self` so an admin viewing their own account cannot
 * accidentally render the administrative aggregate.
 */
export function resolvePaymentUserScope(
  req: { user?: { claims?: { sub?: unknown } }; query?: Record<string, unknown> },
  admin: boolean,
): string | null {
  const userId = req.user?.claims?.sub;
  if (req.query?.scope === "self") {
    // An explicit personal scope must never fall back to the admin aggregate.
    return userId == null ? "" : String(userId);
  }
  if (!admin) {
    return userId == null ? "" : String(userId);
  }
  return null;
}
