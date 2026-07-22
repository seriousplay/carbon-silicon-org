#!/bin/bash
# Carbon-Silicon Organization - Production Deploy
# Usage: ./scripts/deploy-all.sh [app_name|all]
# Deploys pre-built apps to Aliyun ECS via rsync + PM2 restart

set -euo pipefail

ALIYUN_HOST="${ALIYUN_HOST:-47.95.199.142}"
ALIYUN_USER="${ALIYUN_USER:-root}"
ALIYUN_KEY="${ALIYUN_KEY:-~/.ssh/daodecision_aliyun.pem}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/carbon-silicon-org}"
DEPLOY_APP="${1:-all}"
SSH_CMD="ssh -i ${ALIYUN_KEY} -o StrictHostKeyChecking=no"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()  { echo -e "${GREEN}[CSI]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; }

deploy_app() {
  local app=$1
  local port=$2
  local pm2_name="csi-${app}"

  log "Deploying ${app} (port ${port})..."

  # Sync source code
  rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.turbo' \
    --exclude='logs' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.*.local' \
    -e "ssh -i ${ALIYUN_KEY}" \
    "apps/${app}/" \
    "${ALIYUN_USER}@${ALIYUN_HOST}:${REMOTE_ROOT}/apps/${app}/"

  # Build and restart on remote
  ${SSH_CMD} "${ALIYUN_USER}@${ALIYUN_HOST}" <<EOF
    set -e
    cd ${REMOTE_ROOT}/apps/${app}

    # Ensure logs directory
    mkdir -p logs

    # Source shared env
    if [ -f "${REMOTE_ROOT}/shared/.env" ]; then
      export \$(grep -v '^#' ${REMOTE_ROOT}/shared/.env | xargs)
    fi
    if [ -f ".env.production" ]; then
      export \$(grep -v '^#' .env.production | xargs)
    fi

    # Install deps
    pnpm install --frozen-lockfile --prod 2>/dev/null || pnpm install --prod

    # Database migrations
    if [ -f "prisma/schema.prisma" ]; then
      echo "Running Prisma migrations for ${app}..."
      npx prisma generate
      npx prisma migrate deploy
    fi

    # Build
    echo "Building ${app}..."
    pnpm run build

    # Start PM2
    export PORT=${port}
    pm2 startOrRestart ecosystem.config.cjs --update-env
    pm2 save

    echo "${app} deployed OK"
EOF

  log "${app} deployed successfully"
  echo ""
}

# ─── Main ───
log "Carbon-Silicon Org Deploy"
log "Target: ${ALIYUN_USER}@${ALIYUN_HOST}"
log "App: ${DEPLOY_APP}"
echo ""

case "${DEPLOY_APP}" in
  all)
    deploy_app "book" 3000
    deploy_app "loop-designer" 3010
    deploy_app "loopos" 3040
    deploy_app "workshops" 3030
    ;;
  book)          deploy_app "book" 3000 ;;
  loop-designer) deploy_app "loop-designer" 3010 ;;
  loopos)        deploy_app "loopos" 3040 ;;
  workshops)     deploy_app "workshops" 3030 ;;
  *)
    err "Unknown app: ${DEPLOY_APP}"
    err "Valid: all, book, loop-designer, loopos, workshops"
    exit 1
    ;;
esac

# ─── Deploy Nginx config ───
log "Deploying Nginx config..."
scp -i "${ALIYUN_KEY}" docker/nginx/conf.d/csi-org.conf \
  "${ALIYUN_USER}@${ALIYUN_HOST}:/etc/nginx/conf.d/csi-org.conf"

${SSH_CMD} "${ALIYUN_USER}@${ALIYUN_HOST}" <<'EOF'
  nginx -t && systemctl reload nginx
  echo "Nginx reloaded OK"
EOF

# ─── Health Check ───
log "Health check..."
sleep 3

check_url() {
  local path=$1
  local code
  code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "https://csi-org.com${path}" 2>/dev/null || echo "000")
  if [ "$code" = "200" ] || [ "$code" = "302" ]; then
    echo -e "  ${GREEN}✓${NC} ${path}: ${code}"
  else
    echo -e "  ${RED}✗${NC} ${path}: ${code}"
  fi
}

check_url "/book"
check_url "/loop-designer"
check_url "/loopos"
check_url "/workshops"

echo ""
log "Deploy complete!"
