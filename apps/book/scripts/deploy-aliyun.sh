#!/usr/bin/env bash
set -euo pipefail

# Determine paths
# When run from apps/carbon-silicon-tools-site/, this script is in scripts/deploy-aliyun.sh
SCRIPT_PATH="${BASH_SOURCE[0]}"
SCRIPT_DIR="$(cd "$(dirname "$SCRIPT_PATH")" && pwd)"

# Try to find project root by looking for .git directory
PROJECT_ROOT="$SCRIPT_DIR"
while [[ "$PROJECT_ROOT" != "/" ]] && [[ ! -d "$PROJECT_ROOT/.git" ]]; do
  PROJECT_ROOT="$(dirname "$PROJECT_ROOT")"
done

if [[ ! -d "$PROJECT_ROOT/.git" ]]; then
  echo "Error: Could not find project root (no .git directory found)" >&2
  exit 1
fi

HOST="${ALIYUN_HOST:-47.95.199.142}"
USER="${ALIYUN_USER:-root}"
KEY="${ALIYUN_KEY:-$HOME/.ssh/daodecision_aliyun.pem}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/carbon-silicon-org-book}"
APP_NAME="carbon-silicon-tools-site"
REMOTE_APP="$REMOTE_ROOT/apps/$APP_NAME"

if [[ ! -f "$KEY" ]]; then
  echo "SSH key not found: $KEY" >&2
  exit 1
fi

echo "Project root: $PROJECT_ROOT"
echo "App directory: $SCRIPT_DIR/.."
echo "Remote destination: $REMOTE_APP"

# Create remote directory
ssh -i "$KEY" "$USER@$HOST" "mkdir -p '$REMOTE_ROOT/apps'"

# Sync entire app directory (excluding node_modules, .next, env files)
echo "Syncing application files..."
rsync -az --delete \
  --exclude "node_modules" \
  --exclude ".next" \
  --exclude ".env.local" \
  --exclude ".env.production" \
  -e "ssh -i $KEY" \
  "$SCRIPT_DIR/../" \
  "$USER@$HOST:$REMOTE_APP/"

echo "Build and restart on server..."
ssh -i "$KEY" "$USER@$HOST" "cd '$REMOTE_APP' && \
  echo 'Installing dependencies...' && \
  npm ci --silent && \
  echo 'Building...' && \
  npm run build && \
  echo 'Restarting PM2...' && \
  (pm2 start ecosystem.config.cjs --update-env 2>/dev/null || pm2 restart $APP_NAME --update-env) && \
  pm2 save && \
  echo 'Deployment complete!'"

echo ""
echo "✓ Deployed to https://carbon.daodecision.com"
echo ""
echo "Verify:"
echo "  curl -I https://carbon.daodecision.com | grep -i content-encoding"
