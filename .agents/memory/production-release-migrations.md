---
name: Production release and migration boundary
description: Why application deployment and production schema migration are intentionally separate workflows
---

Application release activation and rollback cover files and the application process only. Production schema changes must run separately as reviewed, versioned SQL migrations using expand/contract compatibility.

**Why:** A failed application health check can happen after new database writes. Automatically restoring a pre-migration backup could erase those writes, while automatic schema push may make changes that the previous release cannot tolerate.

**How to apply:** Require explicit operator confirmation, create and retain a backup, serialize migrations with a database lock, record checksums, and never auto-restore. Adopt an older unversioned database into the migration ledger only after validating the expected baseline objects.

External VPS releases must install dependencies in staging before touching the live in-place PM2 runtime. Replit-generated lockfiles can contain resolved package-firewall URLs that the VPS cannot reach, so the staging copy must use public npm URLs and verify native runtime dependencies before activation.

**Why:** Installing against the VPS's older package files left a native image dependency unavailable and produced a 502; the corrected lockfile then exposed Replit-only registry hosts. Both failures are preventable before the runtime swap.

**How to apply:** Build locally or in isolated VPS staging when an on-server build is requested; never build over the live runtime. Rewrite only Replit-internal registry hosts in the staging lockfile, verify native dependencies, then activate and check health internally and publicly. Include new working-tree source files, not just files already tracked by Git.

VPS deployment must stop before upload when the live SSH host fingerprint differs from the configured fingerprint. Do not accept the newly scanned host key automatically, and do not treat an unparseable private key or `known_hosts` secret as permission to fall back to insecure host checking.

**Why:** A release attempt encountered all three trust failures while the existing production service remained healthy. Bypassing them would remove the only protection against connecting to the wrong server.

**How to apply:** Ask the VPS owner to verify the current host key through the provider console, then refresh the SSH fingerprint or provide a valid PEM private key plus OpenSSH `known_hosts` entry. Retry only with strict host checking enabled.

PM2 environment metadata alone is not proof that a provider secret is missing from the running app.

**Why:** The VPS application also loads its local environment file internally, so PM2 metadata can omit credentials that the application receives at startup.

**How to apply:** Diagnose both configuration sources using presence-only checks. Never print environment files or PM2's complete environment, and do not replace existing keys based only on PM2 metadata.

New release health requirements must not make rollback to an older compatible release falsely fail.

**Why:** Adding a dedicated live-readiness route would reject a healthy older runtime that predates that route, despite successful file restoration.

**How to apply:** Gate activation on the new capabilities, but verify rollback using the health contract supported by the previous release. A passing media-readiness check is not proof of public firewall reachability or completed financial transactions.

The VPS network-change authorization is limited to the application's RTMP TCP port 1935. Port 8080 belongs to the separate iDeliver platform and must remain untouched.

**Why:** The owner explicitly narrowed the network authorization to the streaming port only, despite the broader request to improve live video.

**How to apply:** Preserve other firewall rules, listeners, and project paths. Do not treat this permission as approval to add TURN relay port ranges or reconfigure shared services; obtain separate authorization for those changes.