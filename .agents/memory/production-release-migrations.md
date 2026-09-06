---
name: Production release and migration boundary
description: Why application deployment and production schema migration are intentionally separate workflows
---

Application release activation and rollback cover files and the application process only. Production schema changes must run separately as reviewed, versioned SQL migrations using expand/contract compatibility.

**Why:** A failed application health check can happen after new database writes. Automatically restoring a pre-migration backup could erase those writes, while automatic schema push may make changes that the previous release cannot tolerate.

**How to apply:** Require explicit operator confirmation, create and retain a backup, serialize migrations with a database lock, record checksums, and never auto-restore. Adopt an older unversioned database into the migration ledger only after validating the expected baseline objects.