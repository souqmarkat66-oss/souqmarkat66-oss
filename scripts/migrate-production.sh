#!/usr/bin/env bash
# Separate, operator-only production migration workflow.
set -euo pipefail
IFS=$'\n\t'
umask 077

: "${DATABASE_URL:?set DATABASE_URL in the trusted operator shell}"
[[ "${MIGRATE_PRODUCTION_CONFIRM:-}" = "YES" ]] || {
  echo "Refusing migration: set MIGRATE_PRODUCTION_CONFIRM=YES after reviewing every versioned SQL file." >&2
  exit 1
}

MIGRATIONS_DIR="$(realpath -m "${MIGRATIONS_DIR:-./migrations}")"
MIGRATION_BACKUP_DIR="$(realpath -m "${MIGRATION_BACKUP_DIR:-./backups}")"
MIGRATE_BASELINE_EXISTING="${MIGRATE_BASELINE_EXISTING:-NO}"
[[ "$MIGRATE_BASELINE_EXISTING" = "NO" || "$MIGRATE_BASELINE_EXISTING" = "YES" ]] || {
  echo "MIGRATE_BASELINE_EXISTING must be YES or NO." >&2
  exit 1
}
[[ -d "$MIGRATIONS_DIR" ]] || { echo "Migrations directory does not exist: $MIGRATIONS_DIR" >&2; exit 1; }
command -v psql >/dev/null 2>&1 || { echo "psql is required" >&2; exit 1; }
command -v pg_dump >/dev/null 2>&1 || { echo "pg_dump is required" >&2; exit 1; }
command -v sha256sum >/dev/null 2>&1 || { echo "sha256sum is required" >&2; exit 1; }

mapfile -d '' migration_files < <(
  find "$MIGRATIONS_DIR" -maxdepth 1 -type f -name '*.sql' -print0 | sort -z
)
[[ "${#migration_files[@]}" -gt 0 ]] || {
  echo "No reviewed versioned .sql migrations found; nothing was applied." >&2
  exit 1
}

for file in "${migration_files[@]}"; do
  name="$(basename "$file")"
  [[ "$name" =~ ^[0-9]{4,}_[A-Za-z0-9_-]+\.sql$ ]] || {
    echo "Invalid migration filename: $name (expected NNNN_description.sql)" >&2
    exit 1
  }
  if grep -Eiq '^[[:space:]]*(BEGIN([[:space:]]+TRANSACTION)?|START[[:space:]]+TRANSACTION|COMMIT|ROLLBACK)[[:space:]]*;' "$file"; then
    echo "Migration $name contains transaction control; remove it because the runner owns the transaction." >&2
    exit 1
  fi
  if grep -Eq '^[[:space:]]*\\' "$file"; then
    echo "Migration $name contains a psql meta-command, which is not allowed." >&2
    exit 1
  fi
done

baseline_name="0000_schema_baseline.sql"
baseline_file="${migration_files[0]}"
reconciliation_name="0001_existing_schema_reconciliation.sql"
reconciliation_file="$MIGRATIONS_DIR/$reconciliation_name"
expected_tables=()
if [[ "$MIGRATE_BASELINE_EXISTING" = "YES" ]]; then
  [[ "$(basename "$baseline_file")" = "$baseline_name" ]] || {
    echo "Baseline adoption requires $baseline_name to be the first migration." >&2
    exit 1
  }
  [[ -f "$reconciliation_file" ]] || {
    echo "Baseline adoption requires reviewed reconciliation migration $reconciliation_name." >&2
    exit 1
  }
  create_count="$(grep -Eic '^[[:space:]]*CREATE[[:space:]]+TABLE([[:space:]]|$)' "$baseline_file")"
  mapfile -t expected_tables < <(
    sed -nE 's/^[[:space:]]*CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?("public"\.)?"([A-Za-z_][A-Za-z0-9_]*)".*/\3/Ip' "$baseline_file"
  )
  unique_table_count="$(printf '%s\n' "${expected_tables[@]}" | sort -u | wc -l | tr -d ' ')"
  if [[ "$create_count" -eq 0 || "${#expected_tables[@]}" -ne "$create_count" || "$unique_table_count" -ne "$create_count" ]]; then
    echo "Refusing baseline adoption: CREATE TABLE parsing was empty, incomplete, or duplicated." >&2
    exit 1
  fi
fi

mkdir -p "$MIGRATION_BACKUP_DIR"
backup_path="$MIGRATION_BACKUP_DIR/pre-migration-$(date -u +%Y%m%d%H%M%S)-$$.dump"
control_file="$(mktemp "${TMPDIR:-/tmp}/ads-as-migrations.XXXXXX.sql")"
trap 'rm -f "$control_file"' EXIT

echo "Creating database backup before migration..."
pg_dump --format=custom --no-owner --no-acl --file="$backup_path" "$DATABASE_URL"
echo "Recovery backup created: $backup_path"
echo "This workflow NEVER restores backups automatically; recovery is an explicit operator action."

cat > "$control_file" <<'SQL'
\set ON_ERROR_STOP on
SELECT pg_advisory_lock(1095981395, 5000);
SQL

if [[ "$MIGRATE_BASELINE_EXISTING" = "YES" ]]; then
  baseline_checksum="$(sha256sum "$baseline_file" | awk '{print $1}')"
  {
    cat <<'SQL'
BEGIN;
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  name text PRIMARY KEY,
  checksum_sha256 text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
SQL
    # Existing VPS installs may predate a few runtime-provisioned tables or
    # columns. Reconcile them transactionally before proving that the baseline
    # is complete. The normal migration loop re-runs this idempotent file and
    # records its checksum immediately after the baseline adoption commits.
    cat "$reconciliation_file"
    cat <<'SQL'
DO $adopt$
DECLARE
  missing_tables text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.schema_migrations) THEN
    RAISE EXCEPTION 'baseline adoption requires an empty schema_migrations ledger';
  END IF;
  SELECT string_agg(expected.name, ', ' ORDER BY expected.name)
    INTO missing_tables
    FROM (VALUES
SQL
    for index in "${!expected_tables[@]}"; do
      separator=","
      if [[ "$index" -eq $((${#expected_tables[@]} - 1)) ]]; then separator=""; fi
      printf "      ('%s')%s\n" "${expected_tables[$index]}" "$separator"
    done
    cat <<'SQL'
    ) AS expected(name)
    WHERE to_regclass(format('%I.%I', 'public', expected.name)) IS NULL;
  IF missing_tables IS NOT NULL THEN
    RAISE EXCEPTION 'baseline adoption refused; missing public tables: %', missing_tables;
  END IF;
END
$adopt$;
SQL
    printf "INSERT INTO public.schema_migrations (name, checksum_sha256) VALUES ('%s', '%s');\n" "$baseline_name" "$baseline_checksum"
    cat <<'SQL'
COMMIT;
SQL
  } >> "$control_file"
else
  cat >> "$control_file" <<'SQL'
BEGIN;
CREATE TABLE IF NOT EXISTS public.schema_migrations (
  name text PRIMARY KEY,
  checksum_sha256 text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT now()
);
COMMIT;
SQL
fi

for file in "${migration_files[@]}"; do
  name="$(basename "$file")"
  checksum="$(sha256sum "$file" | awk '{print $1}')"
  {
    printf '\\echo Checking %s\n' "$name"
    printf 'DO $guard$ BEGIN IF EXISTS (SELECT 1 FROM public.schema_migrations WHERE name = '\''%s'\'' AND checksum_sha256 <> '\''%s'\'') THEN RAISE EXCEPTION '\''checksum mismatch for applied migration %s'\''; END IF; END $guard$;\n' "$name" "$checksum" "$name"
    printf '%s\n' "SELECT EXISTS (SELECT 1 FROM public.schema_migrations WHERE name = '$name') AS migration_applied \\gset"
    printf '%s\n' "\\if :migration_applied"
    printf '\\echo Already applied: %s\n' "$name"
    printf '%s\n' "\\else" "BEGIN;"
    cat "$file"
    printf "\nINSERT INTO public.schema_migrations (name, checksum_sha256) VALUES ('%s', '%s');\nCOMMIT;\n" "$name" "$checksum"
    printf '\\echo Applied: %s\n' "$name"
    printf '%s\n' "\\endif"
  } >> "$control_file"
done

cat >> "$control_file" <<'SQL'
SELECT pg_advisory_unlock(1095981395, 5000);
SQL

echo "Applying reviewed migrations under advisory lock..."
if ! psql "$DATABASE_URL" -X --set ON_ERROR_STOP=1 --file "$control_file"; then
  echo "Migration failed. No automatic restore was attempted." >&2
  echo "Recovery backup remains at: $backup_path" >&2
  exit 1
fi
echo "Production migrations complete. Recovery backup retained at: $backup_path"
