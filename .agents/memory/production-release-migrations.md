---
name: Production release and migration boundary
description: Why application deployment and production schema migration are intentionally separate workflows
---

Application release activation and rollback cover files and the application process only. Production schema changes must run separately as reviewed, versioned SQL migrations using expand/contract compatibility.

**Why:** A failed application health check can happen after new database writes. Automatically restoring a pre-migration backup could erase those writes, while automatic schema push may make changes that the previous release cannot tolerate.

**How to apply:** Require explicit operator confirmation, create and retain a backup, serialize migrations with a database lock, record checksums, and never auto-restore. Adopt an older unversioned database into the migration ledger only after validating the expected baseline objects.

External VPS releases must install dependencies in staging before touching the live in-place PM2 runtime. Replit-generated lockfiles can contain resolved package-firewall URLs that the VPS cannot reach, so the staging copy must use public npm URLs and verify native runtime dependencies before activation.

**Why:** Installing against the VPS's older package files left a native image dependency unavailable and produced a 502; the corrected lockfile then exposed Replit-only registry hosts. Both failures are preventable before the runtime swap.

**How to apply:** Build locally, rewrite only Replit-internal resolved registry hosts in the temporary deployment lockfile, run the production install and native-module smoke checks in staging, then swap files and check the JSON `/api/health` endpoint internally and publicly.

VPS deployment must stop before upload when the live SSH host fingerprint differs from the configured fingerprint. Do not accept the newly scanned host key automatically, and do not treat an unparseable private key or `known_hosts` secret as permission to fall back to insecure host checking.

**Why:** A release attempt encountered all three trust failures while the existing production service remained healthy. Bypassing them would remove the only protection against connecting to the wrong server.

**How to apply:** Ask the VPS owner to verify the current host key through the provider console, then refresh the SSH fingerprint or provide a valid PEM private key plus OpenSSH `known_hosts` entry. Retry only with strict host checking enabled.