#!/bin/bash
set -e

VPS="root@72.61.177.222"
SSH_KEY="$HOME/.ssh/id_ed25519"
SSH_OPTS="-i $SSH_KEY -o StrictHostKeyChecking=no -o ConnectTimeout=10"

echo "▶ Building..."
npm run build
echo "✓ Build done — $(du -sh dist/index.cjs | cut -f1)"

echo "▶ Uploading to VPS..."
scp $SSH_OPTS dist/index.cjs $VPS:/root/dist/index.cjs
echo "✓ File uploaded"

echo "▶ Restarting server..."
ssh $SSH_OPTS $VPS "pm2 restart all && echo '[VPS] Restarted OK'"

echo ""
echo "✅ Deploy complete!"
echo "   https://ads-as.com"
