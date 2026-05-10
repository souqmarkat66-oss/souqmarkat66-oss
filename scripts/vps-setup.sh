#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# VPS First-Time Setup Script — ads-as.com
# Run ONCE on the VPS to:
#   1. Install Node.js 20 + npm + git + build tools (if missing)
#   2. Install pm2 globally
#   3. Configure git credential helper (no more username/password prompts)
#   4. Clone the repo (or pull if already cloned)
#   5. Install npm deps + run db:push
#   6. Start the app with pm2 + persist across reboots
#   7. Make sure the Node.js user can run pm2 & git without sudo issues
#
# Usage (one-liner — see bottom of file):
#   bash <(curl -fsSL https://raw.githubusercontent.com/souqmarkat66-oss/ads-as/main/scripts/vps-setup.sh) <GITHUB_TOKEN>
# OR if you already cloned:
#   GITHUB_TOKEN=ghp_xxx bash scripts/vps-setup.sh
# ─────────────────────────────────────────────────────────────────────

set -e

# ── Config ──────────────────────────────────────────────────────────
REPO_URL_HTTPS="https://github.com/souqmarkat66-oss/ads-as.git"
REPO_USER="souqmarkat66-oss"
REPO_NAME="ads-as"
APP_DIR="/var/www/${REPO_NAME}"
PM2_APP_NAME="ads-as"
NODE_VERSION="20"

# Token may come from:
#   1. First positional arg
#   2. GITHUB_TOKEN env var
GITHUB_TOKEN="${1:-${GITHUB_TOKEN:-}}"

# ── Pretty output ───────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
step()  { echo -e "\n${CYAN}▶ $*${NC}"; }
ok()    { echo -e "${GREEN}✓ $*${NC}"; }
warn()  { echo -e "${YELLOW}⚠ $*${NC}"; }
fail()  { echo -e "${RED}✗ $*${NC}" >&2; exit 1; }

# ── Sanity ──────────────────────────────────────────────────────────
[ "$(id -u)" = "0" ] || fail "Run this script as root (use: sudo bash scripts/vps-setup.sh)"
[ -n "$GITHUB_TOKEN" ] || fail "GITHUB_TOKEN missing. Pass it as 1st arg or env var."

# ── 1. System packages ──────────────────────────────────────────────
step "Updating apt + installing system packages"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git build-essential ca-certificates ufw

if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt "$NODE_VERSION" ]; then
  step "Installing Node.js ${NODE_VERSION}.x"
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash -
  apt-get install -y -qq nodejs
fi
ok "Node $(node -v), npm $(npm -v), git $(git --version | awk '{print $3}')"

# ── 2. PM2 ──────────────────────────────────────────────────────────
if ! command -v pm2 >/dev/null; then
  step "Installing pm2 globally"
  npm install -g pm2
fi
ok "pm2 $(pm2 -v)"

# ── 3. Git credential helper — never prompts for password again ────
step "Configuring git credential store (no more password prompts)"

# Use git's built-in 'store' helper — saves credentials in plaintext at
# ~/.git-credentials (root only). Token is treated as the password.
git config --global credential.helper store
git config --global user.name  "${GIT_USER_NAME:-Souq Admin}"
git config --global user.email "${GIT_USER_EMAIL:-admin@ads-as.com}"

# Write the token to ~/.git-credentials so future `git pull` is silent
CRED_FILE="${HOME}/.git-credentials"
{
  echo "https://${REPO_USER}:${GITHUB_TOKEN}@github.com"
} > "$CRED_FILE"
chmod 600 "$CRED_FILE"
ok "Git credentials cached at $CRED_FILE (chmod 600)"

# ── 4. Clone or update the repo ─────────────────────────────────────
if [ ! -d "$APP_DIR/.git" ]; then
  step "Cloning $REPO_URL_HTTPS into $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone "$REPO_URL_HTTPS" "$APP_DIR"
else
  step "Repo already exists — pulling latest"
  git -C "$APP_DIR" pull origin main
fi

cd "$APP_DIR"

# Make sure remote URL is HTTPS form so credential store is used
git remote set-url origin "$REPO_URL_HTTPS"
ok "Repo ready at $APP_DIR"

# ── 5. .env check ───────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  warn ".env file is MISSING at $APP_DIR/.env"
  warn "Copy .env.example -> .env and fill in DATABASE_URL, SESSION_SECRET, OPENAI_API_KEY, etc."
  warn "Then re-run: cd $APP_DIR && npm install && npm run build && pm2 restart $PM2_APP_NAME"
  if [ -f "$APP_DIR/.env.example" ]; then
    cp "$APP_DIR/.env.example" "$APP_DIR/.env"
    chmod 600 "$APP_DIR/.env"
    warn "Created blank .env from template — edit it before continuing."
  fi
fi

# ── 6. Install dependencies + build ────────────────────────────────
step "Installing npm dependencies (this may take a few minutes)"
npm install --no-audit --no-fund

step "Building production bundle"
npm run build || warn "Build step failed or not configured — continuing"

# Apply DB schema if DATABASE_URL is set
if [ -f "$APP_DIR/.env" ] && grep -q "DATABASE_URL=" "$APP_DIR/.env"; then
  step "Applying DB schema (npm run db:push)"
  npm run db:push || warn "db:push failed — check DATABASE_URL in .env"
fi

# ── 7. Start with pm2 + autostart on reboot ────────────────────────
step "Starting app with pm2"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME"
else
  # Use npm script as the entry point
  pm2 start npm --name "$PM2_APP_NAME" -- start
fi

pm2 save
# Generate systemd startup script so pm2 survives reboot
pm2 startup systemd -u root --hp /root | tail -1 | bash || warn "pm2 startup setup failed (may already be configured)"

ok "App is running under pm2 — name: $PM2_APP_NAME"

# ── 8. Permissions / sudoers safety net ────────────────────────────
# If you ever switch the Node user away from root, uncomment below to
# let that user run pm2 + git without password.
# NODE_USER="nodeuser"
# usermod -aG sudo "$NODE_USER" 2>/dev/null || true
# echo "$NODE_USER ALL=(ALL) NOPASSWD: $(which pm2), $(which git)" \
#   > /etc/sudoers.d/$NODE_USER-pm2-git
# chmod 440 /etc/sudoers.d/$NODE_USER-pm2-git

# ── 9. Firewall (optional but recommended) ─────────────────────────
if command -v ufw >/dev/null; then
  step "Opening firewall ports 22 (SSH), 80, 443"
  ufw allow 22/tcp  >/dev/null 2>&1 || true
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
fi

# ── Done ────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ VPS SETUP COMPLETE${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "App dir       : ${CYAN}$APP_DIR${NC}"
echo -e "PM2 app name  : ${CYAN}$PM2_APP_NAME${NC}"
echo -e "Status        : run ${CYAN}pm2 status${NC}"
echo -e "Live logs     : run ${CYAN}pm2 logs $PM2_APP_NAME${NC}"
echo -e "Future deploys: just press the ${CYAN}'تحديث النظام'${NC} button in admin panel"
echo ""
