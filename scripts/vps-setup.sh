#!/usr/bin/env bash
# Idempotent host preparation for the in-place PM2 runtime.
# It does not clone, install application code, or deploy.
set -euo pipefail
IFS=$'\n\t'

: "${APP_DOMAIN:?set APP_DOMAIN (for example ads-as.example)}"
APP_ROOT="${APP_ROOT:-/var/www/ads-as}"
DEPLOY_USER="${DEPLOY_USER:-ads-as}"
PM2_APP_NAME="${PM2_APP_NAME:-ads-as}"
SSH_PORT="${SSH_PORT:-22}"
ENABLE_SSL="${ENABLE_SSL:-0}"
ALLOW_RTMP="${ALLOW_RTMP:-0}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-}"
APP_ROOT="$(realpath -m "$APP_ROOT")"
[[ "$APP_ROOT" = /var/www/* && "$APP_ROOT" != "/var/www" ]] || { echo "APP_ROOT must resolve below /var/www" >&2; exit 1; }
[[ "$ENABLE_SSL" =~ ^[01]$ && "$ALLOW_RTMP" =~ ^[01]$ ]] || { echo "ENABLE_SSL and ALLOW_RTMP must be 0 or 1" >&2; exit 1; }
[[ "$APP_DOMAIN" =~ ^[A-Za-z0-9.-]+$ && "$APP_DOMAIN" != .* && "$APP_DOMAIN" != *..* ]] || { echo "APP_DOMAIN is invalid" >&2; exit 1; }
[[ "$DEPLOY_USER" =~ ^[a-z_][a-z0-9_-]*[$]?$ ]] || { echo "DEPLOY_USER is invalid" >&2; exit 1; }
[[ "$PM2_APP_NAME" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || { echo "PM2_APP_NAME is invalid" >&2; exit 1; }
[[ "$SSH_PORT" =~ ^[1-9][0-9]{0,4}$ && "$SSH_PORT" -le 65535 ]] || { echo "SSH_PORT must be a valid TCP port" >&2; exit 1; }
[[ "$(id -u)" = 0 ]] || { echo "Run as root" >&2; exit 1; }

export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg nginx certbot python3-certbot-nginx ffmpeg postgresql-client ufw
if ! command -v node >/dev/null || [[ "$(node -p 'process.versions.node.split(`.`)[0]')" != "20" ]]; then
  install -d -m 0755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --yes --dearmor -o /etc/apt/keyrings/nodesource.gpg
  printf '%s\n' 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main' > /etc/apt/sources.list.d/nodesource.list
  apt-get update -qq
  apt-get install -y -qq nodejs
fi
command -v pm2 >/dev/null 2>&1 || npm install --global pm2

if ! id "$DEPLOY_USER" >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash --user-group "$DEPLOY_USER"
fi
DEPLOY_HOME="$(getent passwd "$DEPLOY_USER" | cut -d: -f6)"
[[ -n "$DEPLOY_HOME" && -d "$DEPLOY_HOME" ]] || { echo "DEPLOY_USER must have a real home directory" >&2; exit 1; }
install -d -o "$DEPLOY_USER" -g "$DEPLOY_USER" -m 0755 \
  "$APP_ROOT" "$APP_ROOT/uploads" "$APP_ROOT/runtime-backups" "$APP_ROOT/backups"
touch "$APP_ROOT/.env"
chmod 600 "$APP_ROOT/.env"
chown "$DEPLOY_USER:$DEPLOY_USER" "$APP_ROOT/.env"

cat > "/etc/nginx/sites-available/$PM2_APP_NAME" <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $APP_DOMAIN;
    client_max_body_size 25m;
    location / {
        proxy_pass http://127.0.0.1:5000;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_connect_timeout 60s;
        proxy_send_timeout 3600s;
        proxy_read_timeout 3600s;
        proxy_buffering off;
    }
}
EOF
ln -sfn "/etc/nginx/sites-available/$PM2_APP_NAME" "/etc/nginx/sites-enabled/$PM2_APP_NAME"
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl enable --now nginx
systemctl reload nginx

ufw allow "$SSH_PORT"/tcp
ufw allow 80/tcp
ufw allow 443/tcp
if [[ "$ALLOW_RTMP" = 1 ]]; then ufw allow 1935/tcp; fi
ufw --force enable

if [[ "$ENABLE_SSL" = 1 ]]; then
  : "${CERTBOT_EMAIL:?set CERTBOT_EMAIL when ENABLE_SSL=1}"
  certbot --nginx --non-interactive --agree-tos --email "$CERTBOT_EMAIL" -d "$APP_DOMAIN" --redirect
fi
pm2 startup systemd -u "$DEPLOY_USER" --hp "$DEPLOY_HOME"
runuser -u "$DEPLOY_USER" -- env HOME="$DEPLOY_HOME" pm2 save
echo "Host ready for deploy user $DEPLOY_USER. Put production secrets in $APP_ROOT/.env, run reviewed migrations separately, then run scripts/deploy.sh."
