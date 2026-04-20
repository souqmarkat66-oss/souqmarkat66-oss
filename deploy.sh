#!/bin/bash
# سكريبت نشر ads-as من Replit إلى VPS
# الاستخدام: bash deploy.sh

VPS="root@72.61.177.222"
REMOTE_DIR="/root/ads-as"

echo "🔨 Building..."
npm run build

echo "📤 Uploading server files..."
rsync -avz --exclude=node_modules --exclude=.git --exclude=dist \
  server/ $VPS:$REMOTE_DIR/server/

echo "📤 Uploading client/src..."
rsync -avz \
  client/src/ $VPS:$REMOTE_DIR/client/src/

echo "📤 Uploading dist (built frontend)..."
rsync -avz dist/ $VPS:$REMOTE_DIR/dist/

echo "🔄 Restarting pm2..."
ssh $VPS "cd $REMOTE_DIR && pm2 restart ads-as"

echo "✅ Done! Site live at https://ads-as.com"
