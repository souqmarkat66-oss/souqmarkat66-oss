#!/usr/bin/env bash
# Offline guardrails for the release script's rollback contract.
set -euo pipefail
script="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/deploy.sh"
scripts_dir="$(dirname "$script")"
migration_script="$scripts_dir/migrate-production.sh"
post_merge_script="$scripts_dir/post-merge.sh"
routes_file="$scripts_dir/../server/routes.ts"
custom_auth_file="$scripts_dir/../server/customAuth.ts"
index_file="$scripts_dir/../server/index.ts"
reconciliation="$scripts_dir/../migrations/0001_existing_schema_reconciliation.sql"

grep -Fq 'pm2 delete "$app_name"' "$script"
grep -Fq '! pm2 describe "$app_name" >/dev/null 2>&1' "$script"
grep -Fq 'rm -f "$root/current"' "$script"
grep -Fq 'activation rollback failed' "$script"
grep -Fq 'trap activation_error ERR' "$script"
grep -Fq 'pm2 reload "$root/current/ecosystem.config.cjs"' "$script"
! grep -Fq 'DEPLOY_RUN_MIGRATIONS' "$script"
! grep -Fq 'db:push' "$script"
! grep -Fq 'db:push' "$post_merge_script"

grep -Fq 'MIGRATE_PRODUCTION_CONFIRM' "$migration_script"
grep -Fq 'pg_advisory_lock' "$migration_script"
grep -Fq 'public.schema_migrations' "$migration_script"
grep -Fq 'ON_ERROR_STOP' "$migration_script"
grep -Fq 'pg_dump --format=custom' "$migration_script"
grep -Fq 'NEVER restores backups automatically' "$migration_script"
grep -Fq 'MIGRATE_BASELINE_EXISTING' "$migration_script"
grep -Fq 'baseline adoption requires an empty schema_migrations ledger' "$migration_script"
grep -Fq "to_regclass(format('%I.%I', 'public', expected.name))" "$migration_script"

baseline="$scripts_dir/../migrations/0000_schema_baseline.sql"
create_count="$(grep -Eic '^[[:space:]]*CREATE[[:space:]]+TABLE([[:space:]]|$)' "$baseline")"
parsed_count="$(sed -nE 's/^[[:space:]]*CREATE[[:space:]]+TABLE[[:space:]]+(IF[[:space:]]+NOT[[:space:]]+EXISTS[[:space:]]+)?("public"\.)?"([A-Za-z_][A-Za-z0-9_]*)".*/\3/Ip' "$baseline" | sort -u | wc -l | tr -d ' ')"
[[ "$create_count" -gt 0 && "$parsed_count" -eq "$create_count" ]]

! grep -Eq 'ALTER TABLE|CREATE TABLE IF NOT EXISTS' "$routes_file"
! grep -Eq 'ALTER TABLE|CREATE TABLE IF NOT EXISTS|ensureColumns' "$custom_auth_file"
grep -Fq 'process.env.NODE_ENV !== "production"' "$routes_file"
grep -Fq 'process.env.RUN_STARTUP_MIGRATIONS === "1"' "$index_file"
grep -Fq 'ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;' "$reconciliation"
grep -Fq 'CREATE TABLE IF NOT EXISTS coupons (' "$reconciliation"
grep -Fq 'CREATE TABLE IF NOT EXISTS admin_activity_log (' "$reconciliation"
grep -Fq 'CREATE TABLE IF NOT EXISTS consultations (' "$reconciliation"
grep -Fq 'ON CONFLICT (key) DO NOTHING;' "$reconciliation"

# Cleanup must remain after the public health test, never in activation.
health_line="$(grep -nF 'Checking public health endpoint' "$script" | cut -d: -f1)"
cleanup_line="$(grep -nF 'Cleaning up old successful releases' "$script" | cut -d: -f1)"
[[ "$cleanup_line" -gt "$health_line" ]]
echo "deploy rollback static checks passed"
