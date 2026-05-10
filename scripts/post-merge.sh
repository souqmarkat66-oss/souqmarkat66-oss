#!/bin/bash
# Runs automatically after every Replit task merge.
# 1. Installs dependencies
# 2. Pushes any DB schema changes
# 3. If VPS_SSH_PRIVATE_KEY secret is set, also auto-deploys to VPS.
#    Deployment failure causes this script to exit non-zero so Replit
#    surfaces the error instead of silently masking a broken deploy.
set -e

echo "▶ Installing dependencies..."
npm install --no-audit --no-fund

echo "▶ Pushing DB schema..."
# NOTE: --force was removed intentionally. Forced schema pushes can drop
# columns / truncate tables on schema drift, which is unacceptable on a
# production database with real user data. If a destructive change is
# genuinely required, run `npm run db:push -- --force` MANUALLY after
# reviewing the diff.
npm run db:push

if [ -n "${VPS_SSH_PRIVATE_KEY:-}" ]; then
  echo "▶ VPS_SSH_PRIVATE_KEY detected — running auto-deploy to VPS..."
  if bash scripts/deploy.sh; then
    echo "✅ Post-merge complete — deployed to VPS."
  else
    echo "✗ Post-merge: VPS deploy FAILED — fix the error above and retry with: bash scripts/deploy.sh" >&2
    exit 1
  fi
else
  echo "ℹ Skipping VPS deploy — set VPS_SSH_PRIVATE_KEY secret to enable auto-deploy."
  echo "✅ Post-merge setup complete (no deploy)."
fi
