#!/usr/bin/env bash
# Trusted-operator deployment only. All connection and target values are explicit.
set -euo pipefail
IFS=$'\n\t'

: "${DEPLOY_HOST:?set DEPLOY_HOST}"
: "${DEPLOY_USER:?set DEPLOY_USER}"
: "${DEPLOY_ROOT:?set DEPLOY_ROOT (for example /var/www/ads-as)}"
: "${DEPLOY_SSH_KEY:?set DEPLOY_SSH_KEY}"
: "${DEPLOY_KNOWN_HOSTS:?set DEPLOY_KNOWN_HOSTS with the VPS host key}"
: "${DEPLOY_HEALTH_URL:?set DEPLOY_HEALTH_URL}"

DEPLOY_PM2_APP="${DEPLOY_PM2_APP:-ads-as}"
DEPLOY_KEEP_RELEASES="${DEPLOY_KEEP_RELEASES:-5}"
REMOTE="${DEPLOY_USER}@${DEPLOY_HOST}"
RELEASE_ID="$(date -u +%Y%m%d%H%M%S)-$(git rev-parse --short HEAD)"
ARCHIVE="$(mktemp "${TMPDIR:-/tmp}/ads-as-${RELEASE_ID}.XXXXXX.tgz")"
uploaded=0
cleanup_local() {
  rm -f "$ARCHIVE"
  if [[ "$uploaded" = "1" ]]; then
    "${SSH[@]}" "$REMOTE" "rm -f '$DEPLOY_ROOT/releases/$RELEASE_ID.tgz'" >/dev/null 2>&1 || true
  fi
}
trap cleanup_local EXIT

[[ "$DEPLOY_HOST" =~ ^[A-Za-z0-9][A-Za-z0-9.-]*$ ]] || { echo "Invalid DEPLOY_HOST" >&2; exit 1; }
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]] || { echo "Invalid DEPLOY_USER" >&2; exit 1; }
[[ "$DEPLOY_PM2_APP" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || { echo "Invalid DEPLOY_PM2_APP" >&2; exit 1; }
[[ "$DEPLOY_ROOT" =~ ^/[A-Za-z0-9._/-]+$ && "$DEPLOY_ROOT" != "/" && "$DEPLOY_ROOT" != *"//"* && "$DEPLOY_ROOT" != *"/../"* && "$DEPLOY_ROOT" != */.. ]] || { echo "Invalid DEPLOY_ROOT" >&2; exit 1; }
[[ "$DEPLOY_KEEP_RELEASES" =~ ^[2-9][0-9]*$ ]] || { echo "DEPLOY_KEEP_RELEASES must be an integer of at least 2" >&2; exit 1; }
health_url_pattern='^https?://[A-Za-z0-9][A-Za-z0-9.-]*(:[0-9]{1,5})?(/[^[:space:]]*)?$'
[[ "$DEPLOY_HEALTH_URL" =~ $health_url_pattern ]] || { echo "Invalid DEPLOY_HEALTH_URL" >&2; exit 1; }
[[ -r "$DEPLOY_SSH_KEY" && -r "$DEPLOY_KNOWN_HOSTS" ]] || { echo "SSH key or known_hosts file is unreadable" >&2; exit 1; }
chmod 600 "$DEPLOY_SSH_KEY"

SSH=(ssh -i "$DEPLOY_SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$DEPLOY_KNOWN_HOSTS")
SCP=(scp -i "$DEPLOY_SSH_KEY" -o BatchMode=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=yes -o UserKnownHostsFile="$DEPLOY_KNOWN_HOSTS")

echo "Building release $RELEASE_ID..."
npm run build
[[ -f dist/index.cjs && -d dist/public ]] || { echo "Build output is incomplete" >&2; exit 1; }
archive_files=(dist package.json package-lock.json ecosystem.config.cjs)
tar -czf "$ARCHIVE" "${archive_files[@]}"

echo "Uploading staged release..."
"${SSH[@]}" "$REMOTE" "mkdir -p '$DEPLOY_ROOT/releases' '$DEPLOY_ROOT/shared/uploads' '$DEPLOY_ROOT/shared/backups' && test -f '$DEPLOY_ROOT/shared/.env'"
"${SCP[@]}" "$ARCHIVE" "$REMOTE:$DEPLOY_ROOT/releases/$RELEASE_ID.tgz"
uploaded=1

echo "Activating release atomically..."
"${SSH[@]}" "$REMOTE" bash -s -- "$DEPLOY_ROOT" "$RELEASE_ID" "$DEPLOY_PM2_APP" <<'REMOTE_SCRIPT'
set -euo pipefail
root=$1 release_id=$2 app_name=$3
releases="$root/releases"; release="$releases/$release_id"; previous="$(readlink -f "$root/current" || true)"
rollback_release() {
  local current
  current="$(readlink -f "$root/current" || true)"
  if [ -n "$previous" ] && [ -d "$previous" ]; then
    ln -sfn "$previous" "$root/current" || return 1
    APP_CURRENT_DIR="$root/current" PM2_APP_NAME="$app_name" \
      pm2 reload "$root/current/ecosystem.config.cjs" --only "$app_name" --update-env || return 1
    [ "$(readlink -f "$root/current" || true)" = "$previous" ] || return 1
  elif [ "$current" = "$release" ]; then
    if pm2 describe "$app_name" >/dev/null 2>&1; then
      pm2 delete "$app_name" || return 1
    fi
    ! pm2 describe "$app_name" >/dev/null 2>&1 || return 1
    rm -f "$root/current" || return 1
    [ ! -e "$root/current" ] && [ ! -L "$root/current" ] || return 1
  elif [ -n "$current" ]; then
    echo "Refusing rollback: current points to unexpected release $current" >&2
    return 1
  fi
  rm -rf "$release" || return 1
  rm -f "$releases/$release_id.tgz" || return 1
}
activation_error() {
  local status=$?
  trap - ERR
  if ! rollback_release; then
    echo "CRITICAL: activation rollback failed; manual intervention is required" >&2
  fi
  exit "$status"
}
trap activation_error ERR
mkdir "$release"
tar -xzf "$releases/$release_id.tgz" -C "$release"
rm -f "$releases/$release_id.tgz"
ln -sfn "$root/shared/.env" "$release/.env"
rm -rf "$release/uploads"; ln -s "$root/shared/uploads" "$release/uploads"
(
  cd "$release"
  npm ci --omit=dev --no-audit --no-fund
)
if [ -n "$previous" ] && [ -d "$previous" ]; then
  ln -sfn "$previous" "$root/previous"
else
  rm -f "$root/previous"
fi
ln -sfn "$release" "$root/current"
if pm2 describe "$app_name" >/dev/null 2>&1; then
  APP_CURRENT_DIR="$root/current" PM2_APP_NAME="$app_name" pm2 reload "$root/current/ecosystem.config.cjs" --only "$app_name" --update-env
else
  APP_CURRENT_DIR="$root/current" PM2_APP_NAME="$app_name" pm2 start "$root/current/ecosystem.config.cjs" --only "$app_name"
fi
pm2 save
trap - ERR
REMOTE_SCRIPT
uploaded=0

echo "Checking public health endpoint..."
if ! curl --fail --silent --show-error --retry 8 --retry-delay 2 "$DEPLOY_HEALTH_URL" | grep -q '"status":"ok"'; then
  echo "Health check failed; rolling back application files." >&2
  if ! "${SSH[@]}" "$REMOTE" bash -s -- "$DEPLOY_ROOT" "$RELEASE_ID" "$DEPLOY_PM2_APP" <<'ROLLBACK_SCRIPT'
set -euo pipefail
root=$1 release_id=$2 app_name=$3
release="$root/releases/$release_id"
previous="$(readlink -f "$root/previous" || true)"
if [ -n "$previous" ] && [ -d "$previous" ]; then
  ln -sfn "$previous" "$root/current" || exit 1
  APP_CURRENT_DIR="$root/current" PM2_APP_NAME="$app_name" \
    pm2 reload "$root/current/ecosystem.config.cjs" --only "$app_name" --update-env || exit 1
  [ "$(readlink -f "$root/current" || true)" = "$previous" ] || exit 1
else
  current="$(readlink -f "$root/current" || true)"
  [ "$current" = "$release" ] || { echo "Refusing rollback from unexpected current target" >&2; exit 1; }
  if pm2 describe "$app_name" >/dev/null 2>&1; then
    pm2 delete "$app_name" || exit 1
  fi
  ! pm2 describe "$app_name" >/dev/null 2>&1 || exit 1
  rm -f "$root/current" || exit 1
  [ ! -e "$root/current" ] && [ ! -L "$root/current" ] || exit 1
fi
rm -rf "$release" || exit 1
ROLLBACK_SCRIPT
  then
    echo "CRITICAL: application rollback did not complete; manual intervention is required." >&2
  else
    echo "Application rollback completed." >&2
  fi
  exit 1
fi
echo "Cleaning up old successful releases..."
"${SSH[@]}" "$REMOTE" bash -s -- "$DEPLOY_ROOT" "$DEPLOY_KEEP_RELEASES" <<'CLEANUP_SCRIPT'
set -euo pipefail
root=$1 keep=$2 releases="$1/releases"
active="$(readlink -f "$root/current")"
previous="$(readlink -f "$root/previous" || true)"
find "$releases" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' | sort -rn |
  awk -v keep="$keep" -v active="$active" -v previous="$previous" '
    BEGIN { protected = 1 + (previous != "" && previous != active ? 1 : 0) }
    $2 != active && $2 != previous { eligible[++count] = $2 }
    END {
      retain_eligible = keep - protected
      if (retain_eligible < 0) retain_eligible = 0
      for (i = retain_eligible + 1; i <= count; i++) print eligible[i]
    }
  ' | xargs -r rm -rf
CLEANUP_SCRIPT
echo "Deployment complete: $RELEASE_ID"
