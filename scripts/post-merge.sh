#!/bin/bash
# Runs automatically after every Replit task merge.
# 1. Installs dependencies
# 2. Never mutates a production database.
# 3. Deploys only when explicitly opted in with DEPLOY_AFTER_MERGE=1.
set -euo pipefail

echo "▶ Installing dependencies..."
npm install --no-audit --no-fund

echo "ℹ Database migrations are never run post-merge; use the reviewed production migration workflow."

if [ "${DEPLOY_AFTER_MERGE:-0}" = "1" ]; then
  echo "▶ DEPLOY_AFTER_MERGE=1 — running opted-in deploy..."
  if bash scripts/deploy.sh; then
    echo "✅ Post-merge complete — deployed to VPS."
  else
    echo "✗ Post-merge: VPS deploy FAILED — fix the error above and retry with: bash scripts/deploy.sh" >&2
    exit 1
  fi
else
  echo "ℹ Skipping VPS deploy — set DEPLOY_AFTER_MERGE=1 explicitly to opt in."
  echo "✅ Post-merge setup complete (no deploy)."
fi
