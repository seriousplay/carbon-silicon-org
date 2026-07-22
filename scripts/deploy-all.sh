#!/bin/bash
# Carbon-Silicon Organization - Unified Deployment Script
# Usage: ./scripts/deploy-all.sh [app_name|all]
# Deploys to Aliyun ECS (47.95.199.142)

set -euo pipefail

ALIYUN_HOST="${ALIYUN_HOST:-47.95.199.142}"
ALIYUN_USER="${ALIYUN_USER:-root}"
ALIYUN_KEY="${ALIYUN_KEY:-~/.ssh/daodecision_aliyun.pem}"
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/carbon-silicon-org}"
DEPLOY_APP="${1:-all}"

echo "=== Carbon-Silicon Org Deploy ==="
echo "Target: ${ALIYUN_USER}@${ALIYUN_HOST}"
echo "App: ${DEPLOY_APP}"
echo ""

deploy_app() {
  local app=$1
  local port=$2
  local pm2_name="csi-${app}"
  
  echo "--- Deploying ${app} (port ${port}) ---"
  
  # Sync app code
  rsync -avz --delete \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='.turbo' \
    --exclude='logs' \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.production' \
    --exclude='prisma/migrations' \
    -e "ssh -i ${ALIYUN_KEY}" \
    "apps/${app}/" \
    "${ALIYUN_USER}@${ALIYUN_HOST}:${REMOTE_ROOT}/apps/${app}/"
  
  # Build and start on remote
  ssh -i "${ALIYUN_KEY}" "${ALIYUN_USER}@${ALIYUN_HOST}" <<EOF
    set -e
    cd ${REMOTE_ROOT}/apps/${app}
    
    # Install dependencies
    pnpm install --frozen-lockfile --prod
    
    # Generate Prisma client (if applicable)
    if [ -f "prisma/schema.prisma" ]; then
      npx prisma generate
      npx prisma migrate deploy
    fi
    
    # Build
    pnpm run build
    
    # Start/restart PM2
    export PORT=${port}
    pm2 startOrRestart ecosystem.config.cjs --update-env
    pm2 save
    
    echo "${app} deployed successfully"
EOF
  
  echo ""
}

# Deploy based on selection
case "${DEPLOY_APP}" in
  all)
    deploy_app "book" 3000
    deploy_app "loop-designer" 3010
    deploy_app "loopos" 3040
    deploy_app "workshops" 3030
    ;;
  book)
    deploy_app "book" 3000
    ;;
  loop-designer)
    deploy_app "loop-designer" 3010
    ;;
  loopos)
    deploy_app "loopos" 3040
    ;;
  workshops)
    deploy_app "workshops" 3030
    ;;
  *)
    echo "Unknown app: ${DEPLOY_APP}"
    echo "Valid options: all, book, loop-designer, loopos, workshops"
    exit 1
    ;;
esac

# Deploy Nginx config
echo "--- Deploying Nginx config ---"
scp -i "${ALIYUN_KEY}" docker/nginx/conf.d/csi-org.conf \
  "${ALIYUN_USER}@${ALIYUN_HOST}:/etc/nginx/conf.d/csi-org.conf"

ssh -i "${ALIYUN_KEY}" "${ALIYUN_USER}@${ALIYUN_HOST}" <<'EOF'
  set -e
  nginx -t && nginx -s reload
  echo "Nginx reloaded"
EOF

# Health check
echo ""
echo "=== Health Check ==="
for path in "/book" "/loop-designer" "/loopos" "/workshops"; do
  status=$(curl -s -o /dev/null -w "%{http_code}" "https://csi-org.com${path}" || echo "FAIL")
  echo "  ${path}: HTTP ${status}"
done

echo ""
echo "=== Deploy Complete ==="
