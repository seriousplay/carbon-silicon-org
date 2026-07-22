#!/usr/bin/env bash
set -euo pipefail

# ============================================
# 碳硅回路设计师 - 阿里云部署脚本
# ============================================

# Determine paths
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

# 配置
HOST="${ALIYUN_HOST:-47.95.199.142}"
USER="${ALIYUN_USER:-root}"
KEY="${ALIYUN_KEY:-$HOME/.ssh/daodecision_aliyun.pem}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/carbon-silicon-org-book}"
APP_NAME="carbon-silicon-loop-designer"
WORKER_NAME="carbon-silicon-loop-designer-worker"
REMOTE_APP="$REMOTE_ROOT/apps/loop-designer"
INCOMING_APP="$REMOTE_ROOT/.deploy-incoming/loop-designer"
PUBLIC_URL="${PUBLIC_URL:-https://csi-org.com/loop-designer/}"

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

log_info() {
  echo -e "${GREEN}✓${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

# 检查 SSH key
if [[ ! -f "$KEY" ]]; then
  log_error "SSH key not found: $KEY"
  exit 1
fi

echo "=========================================="
echo "  碳硅回路设计师 - 阿里云部署"
echo "=========================================="
echo ""
echo "Project root: $PROJECT_ROOT"
echo "App directory: $SCRIPT_DIR/.."
echo "Remote destination: $REMOTE_APP"
echo "Remote host: $USER@$HOST"
echo ""

# 1. 本地构建
log_info "Building locally..."
cd "$SCRIPT_DIR/.."
npm run build

# 2. 创建远程目录
log_info "Creating remote directory..."
ssh -i "$KEY" "$USER@$HOST" "mkdir -p '$REMOTE_ROOT/apps' '$INCOMING_APP'"

# 3. 同步文件到服务器
log_info "Syncing prebuilt runtime files..."
rsync -az --delete \
  --include ".next/" \
  --include ".next/standalone/***" \
  --include "scripts/" \
  --include "scripts/generation-worker.mjs" \
  --include "ecosystem.config.cjs" \
  --exclude "*" \
  -e "ssh -i $KEY" \
  "$SCRIPT_DIR/../" \
  "$USER@$HOST:$INCOMING_APP/"

# 4. 在服务器上切换本地构建产物并重启
log_info "Restarting prebuilt application on server..."
ssh -i "$KEY" "$USER@$HOST" "APP_NAME='$APP_NAME' WORKER_NAME='$WORKER_NAME' REMOTE_APP='$REMOTE_APP' INCOMING_APP='$INCOMING_APP' bash -s" <<'REMOTE_DEPLOY'
set -euo pipefail

start_app() {
  for env_file in .env.production .env.local; do
    if [[ -f "$env_file" ]]; then
      set -a
      # shellcheck disable=SC1090
      source "$env_file"
      set +a
    fi
  done

  if [[ -z "${LOOP_GENERATION_WORKER_SECRET:-}" ]]; then
    umask 077
    touch .env.production
    LOOP_GENERATION_WORKER_SECRET="$(openssl rand -hex 32)"
    export LOOP_GENERATION_WORKER_SECRET
    printf '\nLOOP_GENERATION_WORKER_SECRET=%s\n' "$LOOP_GENERATION_WORKER_SECRET" >> .env.production
    echo "Generated LOOP_GENERATION_WORKER_SECRET in .env.production"
  fi

  pm2 startOrRestart ecosystem.config.cjs --only "$APP_NAME" --update-env
  pm2 startOrRestart ecosystem.config.cjs --only "$WORKER_NAME" --update-env
}

SERVER_FILE=".next/standalone/apps/loop-designer/server.js"
WORKER_FILE="scripts/generation-worker.mjs"
cd "$INCOMING_APP"
if [[ ! -f "$SERVER_FILE" ]]; then
  echo "✗ Missing standalone server file: $SERVER_FILE" >&2
  exit 1
fi
if [[ ! -f "$WORKER_FILE" ]]; then
  echo "✗ Missing generation worker file: $WORKER_FILE" >&2
  exit 1
fi

mkdir -p "$REMOTE_APP"
rsync -a --delete \
  --exclude ".env.local" \
  --exclude ".env.production" \
  --exclude "logs" \
  "$INCOMING_APP/" \
  "$REMOTE_APP/"

cd "$REMOTE_APP"
mkdir -p logs
chmod a+rx .next
chmod -R a+rX .next/standalone/apps/loop-designer/.next/static .next/standalone/apps/loop-designer/public

echo "🚀 Starting PM2..."
start_app
pm2 save

echo "🔎 Verifying local app response..."
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 3 http://127.0.0.1:3010/loop-designer/ >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == "30" ]]; then
    echo "✗ App did not respond on 127.0.0.1:3010 after 30 seconds" >&2
    exit 1
  fi
  sleep 1
done

echo ""
echo "=========================================="
echo "  ✓ Deployment Complete!"
echo "=========================================="
echo ""
pm2 list
REMOTE_DEPLOY

log_info "Verifying public URL..."
curl -fsSIL --max-time 15 "$PUBLIC_URL" >/dev/null

echo ""
log_info "Deployment finished!"
echo ""
echo "=========================================="
echo "  Next Steps:"
echo "=========================================="
echo ""
echo "1. Check PM2 status:"
echo "   ssh -i $KEY $USER@$HOST 'pm2 list'"
echo ""
echo "2. Check application logs:"
echo "   ssh -i $KEY $USER@$HOST 'pm2 logs $APP_NAME'"
echo ""
echo "3. Test locally on server:"
echo "   ssh -i $KEY $USER@$HOST 'curl -I http://localhost:3010'"
echo ""
echo "4. Access via browser:"
echo "   $PUBLIC_URL"
echo ""
echo "5. Setup Nginx (if not done):"
echo "   See docs/nginx-setup.md"
echo ""
