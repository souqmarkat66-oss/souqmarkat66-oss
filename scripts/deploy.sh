#!/usr/bin/env bash
# Deploy the current build to the in-place PM2 runtime used by the Hostinger VPS.
# Database migrations are intentionally separate; run migrate-production.sh first.
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

: "${DEPLOY_HOST:?set DEPLOY_HOST}"
: "${DEPLOY_USER:?set DEPLOY_USER}"
: "${DEPLOY_SSH_PORT:?set DEPLOY_SSH_PORT}"
: "${DEPLOY_ROOT:?set DEPLOY_ROOT (for example /var/www/ads-as)}"
: "${DEPLOY_HEALTH_URL:?set DEPLOY_HEALTH_URL to the public /api/health URL}"

DEPLOY_PM2_APP="${DEPLOY_PM2_APP:-ads-as}"
DEPLOY_KEEP_BACKUPS="${DEPLOY_KEEP_BACKUPS:-5}"
DEPLOY_INTERNAL_HEALTH_URL="${DEPLOY_INTERNAL_HEALTH_URL:-http://127.0.0.1:5000/api/health}"
DEPLOY_BUILD_ON_VPS="${DEPLOY_BUILD_ON_VPS:-0}"
DEPLOY_INTERNAL_LIVE_HEALTH_URL="${DEPLOY_INTERNAL_LIVE_HEALTH_URL:-}"
DEPLOY_PUBLIC_LIVE_HEALTH_URL="${DEPLOY_PUBLIC_LIVE_HEALTH_URL:-}"
DEPLOY_HEALTH_URL="${DEPLOY_HEALTH_URL%/}"
DEPLOY_INTERNAL_HEALTH_URL="${DEPLOY_INTERNAL_HEALTH_URL%/}"
DEPLOY_INTERNAL_LIVE_HEALTH_URL="${DEPLOY_INTERNAL_LIVE_HEALTH_URL%/}"
DEPLOY_PUBLIC_LIVE_HEALTH_URL="${DEPLOY_PUBLIC_LIVE_HEALTH_URL%/}"
health_origin_pattern='^https?://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?$'
if [[ "$DEPLOY_HEALTH_URL" =~ $health_origin_pattern ]]; then
  DEPLOY_HEALTH_URL="$DEPLOY_HEALTH_URL/api/health"
fi
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/ads-as-deploy.XXXXXX")"
ARCHIVE="$WORK_DIR/runtime.tgz"
CHECKSUM="$WORK_DIR/runtime.sha256"
KNOWN_HOSTS_TMP=""
ASKPASS_TMP=""
REMOTE_ARCHIVE="/tmp/ads-as-$RELEASE_ID.tgz"
REMOTE_CHECKSUM="/tmp/ads-as-$RELEASE_ID.sha256"
uploaded=0

[[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] || { echo "Invalid DEPLOY_HOST" >&2; exit 1; }
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]] || { echo "Invalid DEPLOY_USER" >&2; exit 1; }
[[ "$DEPLOY_SSH_PORT" =~ ^[1-9][0-9]{0,4}$ && "$DEPLOY_SSH_PORT" -le 65535 ]] || {
  echo "DEPLOY_SSH_PORT must be a valid TCP port" >&2
  exit 1
}
[[ "$DEPLOY_PM2_APP" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || { echo "Invalid DEPLOY_PM2_APP" >&2; exit 1; }
[[ "$DEPLOY_ROOT" =~ ^/[A-Za-z0-9._/-]+$ && "$DEPLOY_ROOT" != "/" && "$DEPLOY_ROOT" != *"//"* && "$DEPLOY_ROOT" != *"/../"* && "$DEPLOY_ROOT" != */.. ]] || {
  echo "Invalid DEPLOY_ROOT" >&2
  exit 1
}
[[ "$DEPLOY_KEEP_BACKUPS" =~ ^[2-9][0-9]*$ ]] || {
  echo "DEPLOY_KEEP_BACKUPS must be an integer of at least 2" >&2
  exit 1
}
[[ "$DEPLOY_BUILD_ON_VPS" = "0" || "$DEPLOY_BUILD_ON_VPS" = "1" ]] || {
  echo "DEPLOY_BUILD_ON_VPS must be 0 or 1" >&2
  exit 1
}
health_url_pattern='^https?://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?(/[^[:space:]]*)?$'
[[ "$DEPLOY_HEALTH_URL" =~ $health_url_pattern && "$DEPLOY_INTERNAL_HEALTH_URL" =~ $health_url_pattern ]] || {
  echo "Health URLs are invalid" >&2
  exit 1
}
[[ "$DEPLOY_HEALTH_URL" = */api/health ]] || {
  echo "DEPLOY_HEALTH_URL must be an origin or end with /api/health" >&2
  exit 1
}
[[ "$DEPLOY_INTERNAL_HEALTH_URL" = */api/health ]] || {
  echo "DEPLOY_INTERNAL_HEALTH_URL must end with /api/health" >&2
  exit 1
}

for live_health_url in "$DEPLOY_INTERNAL_LIVE_HEALTH_URL" "$DEPLOY_PUBLIC_LIVE_HEALTH_URL"; do
  [[ -z "$live_health_url" || "$live_health_url" =~ $health_url_pattern ]] || {
    echo "Live health URL is invalid" >&2
    exit 1
  }
done
if [[ -z "$DEPLOY_INTERNAL_LIVE_HEALTH_URL" ]]; then
  DEPLOY_INTERNAL_LIVE_HEALTH_URL="${DEPLOY_INTERNAL_HEALTH_URL%/api/health}/api/health/live"
fi
if [[ -z "$DEPLOY_PUBLIC_LIVE_HEALTH_URL" ]]; then
  DEPLOY_PUBLIC_LIVE_HEALTH_URL="${DEPLOY_HEALTH_URL%/api/health}/api/health/live"
fi
[[ "$DEPLOY_INTERNAL_LIVE_HEALTH_URL" = */api/health/live &&
  "$DEPLOY_PUBLIC_LIVE_HEALTH_URL" = */api/health/live ]] || {
  echo "Live health URLs must end with /api/health/live" >&2
  exit 1
}

SSH_OPTIONS=(-p "$DEPLOY_SSH_PORT" -o ConnectTimeout=15 -o StrictHostKeyChecking=yes)
SCP_OPTIONS=(-P "$DEPLOY_SSH_PORT" -o ConnectTimeout=15 -o StrictHostKeyChecking=yes)
AUTH_MODE=""

if [[ -n "${DEPLOY_SSH_KEY:-}" && -n "${DEPLOY_KNOWN_HOSTS:-}" ]]; then
  [[ -r "$DEPLOY_SSH_KEY" && -r "$DEPLOY_KNOWN_HOSTS" ]] || {
    echo "DEPLOY_SSH_KEY or DEPLOY_KNOWN_HOSTS is unreadable" >&2
    exit 1
  }
  chmod 600 "$DEPLOY_SSH_KEY"
  SSH_OPTIONS+=(-i "$DEPLOY_SSH_KEY" -o BatchMode=yes -o UserKnownHostsFile="$DEPLOY_KNOWN_HOSTS")
  SCP_OPTIONS+=(-i "$DEPLOY_SSH_KEY" -o BatchMode=yes -o UserKnownHostsFile="$DEPLOY_KNOWN_HOSTS")
  AUTH_MODE="key"
elif [[ -n "${VPS_SSH_PASSWORD:-}" && -n "${VPS_SSH_HOST_FINGERPRINT:-}" ]]; then
  KNOWN_HOSTS_TMP="$(mktemp "${TMPDIR:-/tmp}/ads-as-known-hosts.XXXXXX")"
  ASKPASS_TMP="$(mktemp "${TMPDIR:-/tmp}/ads-as-askpass.XXXXXX")"
  ssh-keyscan -p "$DEPLOY_SSH_PORT" -T 10 -t ed25519 "$DEPLOY_HOST" 2>/dev/null > "$KNOWN_HOSTS_TMP"
  [[ -s "$KNOWN_HOSTS_TMP" ]] || { echo "Could not obtain the VPS host key" >&2; exit 1; }
  actual_fingerprint="$(ssh-keygen -lf "$KNOWN_HOSTS_TMP" | awk 'NR == 1 { print $2 }')"
  [[ "$actual_fingerprint" = "$VPS_SSH_HOST_FINGERPRINT" ]] || {
    echo "VPS host fingerprint mismatch" >&2
    exit 1
  }
  cat > "$ASKPASS_TMP" <<'ASKPASS'
#!/bin/sh
printf '%s\n' "$VPS_SSH_PASSWORD"
ASKPASS
  chmod 700 "$ASKPASS_TMP"
  export SSH_ASKPASS="$ASKPASS_TMP" SSH_ASKPASS_REQUIRE=force DISPLAY=:0
  SSH_OPTIONS+=(
    -o BatchMode=no
    -o PreferredAuthentications=password,keyboard-interactive
    -o PubkeyAuthentication=no
    -o NumberOfPasswordPrompts=1
    -o UserKnownHostsFile="$KNOWN_HOSTS_TMP"
  )
  SCP_OPTIONS+=(
    -o BatchMode=no
    -o PreferredAuthentications=password,keyboard-interactive
    -o PubkeyAuthentication=no
    -o NumberOfPasswordPrompts=1
    -o UserKnownHostsFile="$KNOWN_HOSTS_TMP"
  )
  AUTH_MODE="password"
else
  echo "Configure key authentication or VPS_SSH_PASSWORD with VPS_SSH_HOST_FINGERPRINT" >&2
  exit 1
fi

run_ssh() {
  if [[ "$AUTH_MODE" = "password" ]]; then
    setsid -w ssh "${SSH_OPTIONS[@]}" "$@"
  else
    ssh "${SSH_OPTIONS[@]}" "$@"
  fi
}

run_scp() {
  if [[ "$AUTH_MODE" = "password" ]]; then
    setsid -w scp "${SCP_OPTIONS[@]}" "$@"
  else
    scp "${SCP_OPTIONS[@]}" "$@"
  fi
}

cleanup_local() {
  local status=$?
  if [[ "$uploaded" = "1" ]]; then
    run_ssh "$REMOTE" "rm -f '$REMOTE_ARCHIVE' '$REMOTE_CHECKSUM'" >/dev/null 2>&1 || true
  fi
  rm -rf "$WORK_DIR"
  [[ -z "$KNOWN_HOSTS_TMP" ]] || rm -f "$KNOWN_HOSTS_TMP"
  [[ -z "$ASKPASS_TMP" ]] || rm -f "$ASKPASS_TMP"
  return "$status"
}
trap cleanup_local EXIT

echo "Building release $RELEASE_ID..."
if [[ "$DEPLOY_BUILD_ON_VPS" = "1" ]]; then
  # Send working-tree build inputs, including new source files. Never send .env,
  # uploads, generated output, node_modules, .git, or unrelated workspace data.
  tracked_source_pattern='^(client/|server/|shared/|script/build\.ts$|package\.json$|package-lock\.json$|tsconfig\.json$|vite\.config\.ts$|postcss\.config\.js$|tailwind\.config\.ts$|components\.json$|drizzle\.config\.ts$|ecosystem\.config\.cjs$)'
  forbidden_source_pattern='(^|/)(\.env($|\.)|uploads(/|$)|attached_assets(/|$)|dist(/|$)|node_modules(/|$)|\.git(/|$))'
  git ls-files -z --cached --others --exclude-standard |
    grep -zE "$tracked_source_pattern" |
    grep -zEv "$forbidden_source_pattern" |
    tar --null --files-from=- --ignore-failed-read -czf "$ARCHIVE"
  if tar -tzf "$ARCHIVE" | grep -Eq '(^|/)(\.env($|\.)|uploads(/|$)|attached_assets(/|$)|dist(/|$)|node_modules(/|$)|\.git(/|$))'; then
    echo "Source archive contains a prohibited deployment input" >&2
    exit 1
  fi
  echo "VPS build mode enabled; source will be built in remote staging."
else
  npm run check
  npm run build
  [[ -f dist/index.cjs && -d dist/public ]] || { echo "Build output is incomplete" >&2; exit 1; }

  mkdir -p "$WORK_DIR/payload"
  cp -a dist "$WORK_DIR/payload/dist"
  cp package.json ecosystem.config.cjs "$WORK_DIR/payload/"
  node - "$WORK_DIR/payload/package-lock.json" <<'NODE'
const fs = require("node:fs");
const source = fs.readFileSync("package-lock.json", "utf8");
const converted = source.replace(
  /http:\/\/package-firewall\.replit\.(?:internal|local)\/npm\//g,
  "https://registry.npmjs.org/",
);
if (/package-firewall\.replit\.(?:internal|local)/.test(converted)) {
  throw new Error("Unconverted Replit-internal package registry URL");
}
fs.writeFileSync(process.argv[2], converted, { mode: 0o600 });
NODE
  tar -C "$WORK_DIR/payload" -czf "$ARCHIVE" .
fi
sha256sum "$ARCHIVE" | awk '{ print $1 }' > "$CHECKSUM"

echo "Uploading staged runtime..."
run_scp "$ARCHIVE" "$REMOTE:$REMOTE_ARCHIVE" >/dev/null
run_scp "$CHECKSUM" "$REMOTE:$REMOTE_CHECKSUM" >/dev/null
uploaded=1

echo "Installing and activating runtime..."
run_ssh "$REMOTE" bash -s -- \
  "$DEPLOY_ROOT" "$RELEASE_ID" "$DEPLOY_PM2_APP" \
  "$REMOTE_ARCHIVE" "$REMOTE_CHECKSUM" \
  "$DEPLOY_BUILD_ON_VPS" "$DEPLOY_INTERNAL_HEALTH_URL" "$DEPLOY_HEALTH_URL" \
  "$DEPLOY_KEEP_BACKUPS" "$DEPLOY_INTERNAL_LIVE_HEALTH_URL" \
  "$DEPLOY_PUBLIC_LIVE_HEALTH_URL" <<'REMOTE_SCRIPT'
set -Eeuo pipefail
IFS=$'\n\t'
umask 077

root=$1
release_id=$2
app_name=$3
archive=$4
checksum_file=$5
build_on_vps=$6
internal_health_url=$7
public_health_url=$8
keep_backups=$9
internal_live_health_url=${10}
public_live_health_url=${11}
stage="$root/.deploy-stage-$release_id"
backup="$root/runtime-backups/$release_id"
switch_started=0
was_running=0

cleanup_remote() {
  rm -rf "$stage"
  rm -f "$archive" "$checksum_file"
  rmdir "$backup" 2>/dev/null || true
}

health_ok() {
  local url=$1
  local output=$2
  local code
  code="$(curl --silent --show-error --max-time 10 -o "$output" -w '%{http_code}' "$url" 2>/dev/null || true)"
  [[ "$code" = "200" ]] &&
    node -e '
      const value = JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8"));
      if (value.status !== "ok") process.exit(1);
    ' "$output" 2>/dev/null
}

wait_for_health() {
  local attempt
  local require_live="${1:-1}"
  for attempt in $(seq 1 15); do
    if health_ok "$internal_health_url" "/tmp/ads-as-internal-health.$$" &&
       health_ok "$public_health_url" "/tmp/ads-as-public-health.$$" &&
       { [[ "$require_live" = "0" ]] ||
         { health_ok "$internal_live_health_url" "/tmp/ads-as-internal-live-health.$$" &&
           health_ok "$public_live_health_url" "/tmp/ads-as-public-live-health.$$"; }; }; then
      rm -f \
        "/tmp/ads-as-internal-health.$$" \
        "/tmp/ads-as-public-health.$$" \
        "/tmp/ads-as-internal-live-health.$$" \
        "/tmp/ads-as-public-live-health.$$"
      return 0
    fi
    sleep 5
  done
  rm -f \
    "/tmp/ads-as-internal-health.$$" \
    "/tmp/ads-as-public-health.$$" \
    "/tmp/ads-as-internal-live-health.$$" \
    "/tmp/ads-as-public-live-health.$$"
  return 1
}

restore_previous_runtime() {
  local rollback_failed=0
  trap - ERR
  set +e
  echo "Activation failed; restoring the previous runtime." >&2
  pm2 stop "$app_name" >/dev/null 2>&1 || true
  if [[ -d "$backup/dist" ]]; then
    rm -rf "$root/dist"
    mv "$backup/dist" "$root/dist"
  fi
  if [[ -d "$backup/node_modules" ]]; then
    rm -rf "$root/node_modules"
    mv "$backup/node_modules" "$root/node_modules"
  fi
  for file in package.json package-lock.json ecosystem.config.cjs .env; do
    [[ ! -f "$backup/$file" ]] || cp "$backup/$file" "$root/$file"
  done
  chmod 600 "$root/.env" 2>/dev/null || true
  cd "$root" || rollback_failed=1
  if [[ "$was_running" = "1" ]]; then
    pm2 reload "$app_name" --update-env >/dev/null 2>&1 || rollback_failed=1
    # The previous release may predate the dedicated live health endpoint.
    wait_for_health 0 || rollback_failed=1
  else
    pm2 delete "$app_name" >/dev/null 2>&1 || true
  fi
  cleanup_remote
  if [[ "$rollback_failed" = "0" ]]; then
    echo "Previous runtime restored." >&2
  else
    echo "CRITICAL: runtime rollback did not become healthy." >&2
  fi
  return "$rollback_failed"
}

activation_error() {
  local status=$?
  trap - ERR
  if [[ "$switch_started" = "1" ]]; then
    restore_previous_runtime || true
  else
    cleanup_remote
  fi
  exit "$status"
}
trap activation_error ERR

[[ -f "$root/.env" && -d "$root/dist" && -d "$root/node_modules" ]] || {
  echo "The in-place runtime is incomplete below $root" >&2
  exit 1
}
[[ "$(sha256sum "$archive" | awk '{ print $1 }')" = "$(cat "$checksum_file")" ]]
mkdir -p "$stage" "$backup"
tar -C "$stage" -xzf "$archive"

if [[ "$build_on_vps" = "1" ]]; then
  (
    cd "$stage"
    node - package-lock.json <<'NODE'
const fs = require("node:fs");
const source = fs.readFileSync("package-lock.json", "utf8");
const converted = source.replace(
  /http:\/\/package-firewall\.replit\.(?:internal|local)\/npm\//g,
  "https://registry.npmjs.org/",
);
if (/package-firewall\.replit\.(?:internal|local)/.test(converted)) {
  throw new Error("Unconverted Replit-internal package registry URL");
}
fs.writeFileSync("package-lock.json", converted, { mode: 0o600 });
NODE
    npm ci --no-audit --no-fund --registry=https://registry.npmjs.org
    npm run check && npm run build
    [[ -f dist/index.cjs && -d dist/public ]] || {
      echo "Remote build output is incomplete" >&2
      exit 1
    }
    npm prune --omit=dev --no-audit --no-fund --registry=https://registry.npmjs.org
    node -e '
      const pkg = require("./package.json");
      if (pkg.dependencies?.sharp) require("sharp");
    '
  )
else
  (
    cd "$stage"
    npm ci --omit=dev --no-audit --no-fund --registry=https://registry.npmjs.org
    node -e '
      const pkg = require("./package.json");
      if (pkg.dependencies?.sharp) require("sharp");
    '
  )
fi

pm2_env_afs_base_url=""
if pm2 describe "$app_name" >/dev/null 2>&1; then
  was_running=1
  # --update-env must not discard a value PM2 already carries for the
  # provider's AFS endpoint. Read only this variable and never print PM2 env.
  pm2_env_afs_base_url="$(
    pm2 jlist 2>/dev/null |
      node -e '
        let input = "";
        process.stdin.setEncoding("utf8");
        process.stdin.on("data", (chunk) => { input += chunk; });
        process.stdin.on("end", () => {
          try {
            const list = JSON.parse(input);
            const app = list.find((entry) => entry.name === process.argv[1]);
            const value =
              app?.pm2_env?.env?.AFS_BASE_URL ?? app?.pm2_env?.AFS_BASE_URL;
            if (typeof value === "string") process.stdout.write(value);
          } catch {}
        });
      ' "$app_name" || true
  )"
fi
cp "$root/.env" "$backup/.env"
for file in package.json package-lock.json ecosystem.config.cjs; do
  [[ ! -f "$root/$file" ]] || cp "$root/$file" "$backup/$file"
done

switch_started=1
mv "$root/dist" "$backup/dist"
mv "$root/node_modules" "$backup/node_modules"
mv "$stage/dist" "$root/dist"
mv "$stage/node_modules" "$root/node_modules"
cp "$stage/package.json" "$root/package.json"
cp "$stage/package-lock.json" "$root/package-lock.json"
cp "$stage/ecosystem.config.cjs" "$root/ecosystem.config.cjs"

cd "$root"
if [[ -n "$pm2_env_afs_base_url" ]]; then
  export AFS_BASE_URL="$pm2_env_afs_base_url"
fi
if [[ "$was_running" = "1" ]]; then
  pm2 reload "$app_name" --update-env
else
  pm2 start ecosystem.config.cjs --only "$app_name" --update-env
fi
wait_for_health
pm2 save >/dev/null

switch_started=0
cleanup_remote
find "$root/runtime-backups" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' |
  sort -rn |
  awk -v keep="$keep_backups" 'NR > keep { print $2 }' |
  xargs -r rm -rf
echo "Runtime activated: $release_id"
echo "Rollback backup: $backup"
REMOTE_SCRIPT

uploaded=0
echo "Deployment complete: $RELEASE_ID"