#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────
# VPS First-Time Setup Script — ads-as.com
#
# Security model:
#   • The GitHub token is used INLINE for clone/pull ONLY.
#   • It is NEVER written to ~/.git-credentials, NEVER stored in
#     git config, and NEVER embedded in the saved remote URL.
#   • Token must be supplied fresh on every run (1st arg or env var).
#
# Usage:
#   sudo GITHUB_TOKEN=ghp_xxx bash scripts/vps-setup.sh
#   # or:
#   sudo bash scripts/vps-setup.sh ghp_xxx
# ─────────────────────────────────────────────────────────────────────

set -e

# ── Config ──────────────────────────────────────────────────────────
REPO_URL_HTTPS="https://github.com/souqmarkat66-oss/ads-as.git"
REPO_NAME="ads-as"
APP_DIR="/var/www/${REPO_NAME}"
PM2_APP_NAME="ads-as"
NODE_VERSION="20"

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

# Helper: run any git command with the token injected as a request
# header just for that invocation. Nothing is persisted on disk.
git_with_token() {
  git -c "http.extraheader=Authorization: Bearer ${GITHUB_TOKEN}" "$@"
}

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

# ── 3. Git identity (no credential helper, no stored token) ────────
step "Configuring git identity (token NOT stored on disk)"
git config --global user.name  "${GIT_USER_NAME:-Souq Admin}"
git config --global user.email "${GIT_USER_EMAIL:-admin@ads-as.com}"
# Defensive cleanup: if a previous run stored credentials, remove them.
git config --global --unset credential.helper 2>/dev/null || true
rm -f "${HOME}/.git-credentials" 2>/dev/null || true
ok "Git identity set; no credentials persisted"

# ── 4. Clone or update the repo (token used inline only) ───────────
if [ ! -d "$APP_DIR/.git" ]; then
  step "Cloning $REPO_URL_HTTPS into $APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git_with_token clone "$REPO_URL_HTTPS" "$APP_DIR"
else
  step "Repo already exists — pulling latest"
  git_with_token -C "$APP_DIR" pull origin main
fi

cd "$APP_DIR"
# Saved remote URL is plain HTTPS — token is NOT embedded.
git remote set-url origin "$REPO_URL_HTTPS"
ok "Repo ready at $APP_DIR (remote URL is token-free)"

# ── 5. .env check ───────────────────────────────────────────────────
if [ ! -f "$APP_DIR/.env" ]; then
  warn ".env file is MISSING at $APP_DIR/.env"
  warn "Copy .env.example -> .env and fill in DATABASE_URL, SESSION_SECRET, OPENAI_API_KEY, etc."
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

if [ -f "$APP_DIR/.env" ] && grep -q "DATABASE_URL=" "$APP_DIR/.env"; then
  step "Applying DB schema (npm run db:push)"
  npm run db:push || warn "db:push failed — check DATABASE_URL in .env"
fi

# ── 7. Start with pm2 + autostart on reboot ────────────────────────
step "Starting app with pm2"
if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
  pm2 restart "$PM2_APP_NAME"
else
  pm2 start npm --name "$PM2_APP_NAME" -- start
fi

pm2 save
pm2 startup systemd -u root --hp /root | tail -1 | bash || warn "pm2 startup setup failed (may already be configured)"
ok "App is running under pm2 — name: $PM2_APP_NAME"

# ── 8. Firewall (optional but recommended) ─────────────────────────
if command -v ufw >/dev/null; then
  step "Opening firewall ports 22 (SSH), 80, 443"
  ufw allow 22/tcp  >/dev/null 2>&1 || true
  ufw allow 80/tcp  >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
  ufw --force enable >/dev/null 2>&1 || true
fi

# Scrub the token from this shell before exit
unset GITHUB_TOKEN

# ── Done ────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ VPS SETUP COMPLETE${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "App dir       : ${CYAN}$APP_DIR${NC}"
echo -e "PM2 app name  : ${CYAN}$PM2_APP_NAME${NC}"
echo -e "Status        : ${CYAN}pm2 status${NC}"
echo -e "Live logs     : ${CYAN}pm2 logs $PM2_APP_NAME${NC}"
echo ""
echo -e "${YELLOW}Future pulls (token NOT stored, supply each time):${NC}"
echo -e "  ${CYAN}cd $APP_DIR && git -c \"http.extraheader=Authorization: Bearer \$GITHUB_TOKEN\" pull origin main${NC}"
echo ""
