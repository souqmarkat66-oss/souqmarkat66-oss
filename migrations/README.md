# Production migrations

Place reviewed, backwards-compatible SQL migrations here using names such as
`0001_add_example_column.sql`. The generated `0000_schema_baseline.sql` is the
first versioned migration. On a fresh database, run the normal workflow and the
baseline will execute transactionally like any other pending migration.
`0001_existing_schema_reconciliation.sql` then idempotently adds legacy fields,
support tables, and default settings that were previously provisioned by
application startup. It is safe after either a fresh baseline or one-time
adoption of an existing complete schema.

Each file must contain SQL statements only: do not include transaction control
or psql meta-commands. The runner applies pending files in filename order,
wraps each file in a transaction, records its SHA-256 checksum in
`public.schema_migrations`, and holds a PostgreSQL advisory lock.

Production migrations must follow expand/contract compatibility so both the
new release and previous release work during rollback. Run migrations
separately from application deployment:

```sh
MIGRATE_PRODUCTION_CONFIRM=YES DATABASE_URL='...' \
  bash scripts/migrate-production.sh
```

## Encrypted payout destination cutover

For the payout-destination migration, stop application instances that can still
write plaintext withdrawal destinations before the cutover. Then:

1. Create the backup and apply the reviewed SQL migrations with the command
   above.
2. Run `BACKFILL_PAYOUT_CONFIRM=YES npx tsx scripts/backfill-payout-destinations.ts`
   in the trusted operator environment. It encrypts pending legacy destinations
   and irreversibly replaces terminal legacy destinations with masked values.
3. Start the new application release and verify its health.

The backfill prints counts only. It must never print destination values.

## Adopting the existing VPS database

The VPS schema predates the migration ledger. After reviewing the generated
baseline, adopt it without replaying its `CREATE TABLE` statements:

```sh
MIGRATE_PRODUCTION_CONFIRM=YES MIGRATE_BASELINE_EXISTING=YES \
  DATABASE_URL='...' bash scripts/migrate-production.sh
```

This exceptional mode works only when `0000_schema_baseline.sql` is first, the
ledger has no rows, and baseline table parsing is complete and unambiguous.
The reviewed, idempotent `0001_existing_schema_reconciliation.sql` runs inside
the adoption transaction before the runner proves that every baseline table
exists. The checks and baseline ledger insert run under the same advisory lock.
A fresh or structurally unrelated database is still rejected; omit this mode on
a fresh database so the baseline is executed normally. Once the baseline ledger
row exists, never use adoption mode again.

The runner creates and prints a `pg_dump` backup path first. It never
automatically restores a backup because doing so could erase writes made after
the migration began.
