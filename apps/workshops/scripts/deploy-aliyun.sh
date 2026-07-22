#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"
HOST="${ALIYUN_HOST:-47.95.199.142}"
USER="${ALIYUN_USER:-root}"
KEY="${ALIYUN_KEY:-$HOME/.ssh/daodecision_aliyun.pem}"
REMOTE_APP="${REMOTE_APP:-/var/www/carbon-silicon-org-book/apps/super-individual-site}"
APP_NAME="super-individual-site"

if [[ ! -f "$KEY" ]]; then
  echo "SSH key not found: $KEY" >&2
  exit 1
fi

ssh -i "$KEY" "$USER@$HOST" "mkdir -p '$REMOTE_APP'"

rsync -az --delete \
  --exclude "node_modules" \
  --exclude ".next" \
  --exclude ".env.local" \
  --exclude ".env.production" \
  --exclude "test-results" \
  --exclude "playwright-report" \
  -e "ssh -i $KEY" \
  "$APP_DIR/" \
  "$USER@$HOST:$REMOTE_APP/"

ssh -i "$KEY" "$USER@$HOST" "cd '$REMOTE_APP' && \
  printf '%s\n' \
    'NEXT_PUBLIC_SITE_URL=https://carbon.daodecision.com/journal' \
    'NEXT_PUBLIC_SITE_NAME=一个人的组织' > .env.production && \
  mkdir -p logs && \
  npm ci --silent && \
  npm run build && \
  (pm2 restart '$APP_NAME' --update-env 2>/dev/null || pm2 start ecosystem.config.cjs --update-env) && \
  pm2 save"

echo "Application deployed. Nginx must route /journal to 127.0.0.1:3020."
