---
name: Publish and NOT VALID checks
description: Replit Publish schema-diff behavior for PostgreSQL CHECK constraints created as NOT VALID
---

Do not leave `NOT VALID` CHECK constraints in the development schema when Replit Publish will create the corresponding production table. Define the checks in the Drizzle schema and validate the development constraints after proving existing rows comply.

**Why:** Publish introspection once reconstructed validated-later constraints inside `CREATE TABLE` with extra closing parentheses around `NOT VALID`, producing invalid SQL even though PostgreSQL stored the constraints correctly.

**How to apply:** Query `pg_constraint.convalidated` and count violating rows first. If there are no violations, validate only the development constraints, remove startup code that recreates them as `NOT VALID`, and recompute the official development-to-production diff. Never repair this with production DDL.