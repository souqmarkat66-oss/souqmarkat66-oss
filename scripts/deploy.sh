#!/bin/bash
# Auto-deploy: build full app and push to VPS, then restart pm2.
# Ships BOTH dist/index.cjs (server bundle) AND dist/public/** (client bundle/static assets).
# Fails loudly on any error so callers can detect failure.
set -euo pipefail

VPS="${VPS_HOST:-root@72.61.177.222}"
VPS_DIR="${VPS_DIR:-/root}"
SSH_KEY_FILE="$HOME/.ssh/id_ed25519"
SSH_OPTS_BASE="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -o BatchMode=yes"

# If a key is provided via env var (e.g. Replit secret), write it to a temp file
TEMP_KEY=""
if [ -n "${VPS_SSH_PRIVATE_KEY:-}" ]; then
  TEMP_KEY="$(mktemp)"
  printf '%s\n' "$VPS_SSH_PRIVATE_KEY" > "$TEMP_KEY"
  chmod 600 "$TEMP_KEY"
  SSH_KEY_FILE="$TEMP_KEY"
  trap 'rm -f "$TEMP_KEY"' EXIT
fi

if [ ! -f "$SSH_KEY_FILE" ]; then
  echo "✗ Deploy aborted: no SSH key found (set VPS_SSH_PRIVATE_KEY secret or place key at $SSH_KEY_FILE)" >&2
  exit 1
fi

SSH_OPTS="-i $SSH_KEY_FILE $SSH_OPTS_BASE"

echo "▶ Building (server + client)..."
npm run build
test -f dist/index.cjs || { echo "✗ Build failed: dist/index.cjs missing" >&2; exit 1; }
test -d dist/public  || { echo "✗ Build failed: dist/public missing"  >&2; exit 1; }
echo "✓ Build done — server: $(du -sh dist/index.cjs | cut -f1), client: $(du -sh dist/public | cut -f1)"

echo "▶ Ensuring remote dir $VPS_DIR/dist exists..."
ssh $SSH_OPTS "$VPS" "mkdir -p '$VPS_DIR/dist'"

echo "▶ Uploading server bundle..."
scp $SSH_OPTS dist/index.cjs "$VPS:$VPS_DIR/dist/index.cjs"

echo "▶ Uploading client bundle (dist/public/**)..."
# Use rsync if available (faster, atomic) — otherwise fall back to scp -r.
if command -v rsync >/dev/null 2>&1; then
  rsync -az --delete -e "ssh $SSH_OPTS" dist/public/ "$VPS:$VPS_DIR/dist/public/"
else
  ssh $SSH_OPTS "$VPS" "rm -rf '$VPS_DIR/dist/public'"
  scp $SSH_OPTS -r dist/public "$VPS:$VPS_DIR/dist/public"
fi
echo "✓ Files uploaded"

echo "▶ Restarting pm2..."
ssh $SSH_OPTS "$VPS" "pm2 restart all && pm2 save && echo '[VPS] Restarted OK'"

echo ""
echo "✅ Deployed ✓ — https://ads-as.com"
