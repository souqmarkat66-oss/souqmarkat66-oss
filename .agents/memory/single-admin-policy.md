---
name: Single-admin policy
description: Admin access is locked to one hardcoded super-admin; extra_admin_ids is intentionally ignored.
---
Only `ahmedesmat.5151@gmail.com` (user id 54165148) is admin. **Why:** an unauthorized user previously got admin access; the owner mandated a single admin.
**How to apply:** all server admin predicates (routes.ts `isAdminUser`/`isAdminUserId`, adminCheck.ts `checkIsAdmin`) check only the hardcoded principal; `platform_settings.extra_admin_ids` and `/api/admin/admins/add` are intentionally disabled — do not re-enable extras. Client must gate on server-provided `user.isAdmin`, never hardcoded ids/emails. Known unresolved risk: `/api/auth/set-password` accepts any userId with no verification (account-takeover vector).
