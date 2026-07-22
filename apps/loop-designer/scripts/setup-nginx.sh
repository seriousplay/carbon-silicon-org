#!/usr/bin/env bash
set -euo pipefail

# ============================================
# Nginx 配置脚本 - 碳硅回路设计师
# ============================================

echo "=========================================="
echo "  Configuring Nginx for Loop Designer"
echo "=========================================="
echo ""

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_info() {
  echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
  echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
  echo -e "${RED}✗${NC} $1"
}

# 配置变量
NGINX_CONF="/etc/nginx/conf.d/loop-designer.conf"
DOMAIN="${DOMAIN:-47.95.199.142}"
PORT=3010

echo "Domain: $DOMAIN"
echo "Backend Port: $PORT"
echo "Config File: $NGINX_CONF"
echo ""

# 1. 检查 Nginx 是否安装
if ! command -v nginx &> /dev/null; then
  log_error "Nginx is not installed"
  echo "Install with: apt-get install -y nginx"
  exit 1
fi

log_info "Nginx found: $(nginx -v 2>&1)"

# 2. 创建 Nginx 配置
log_info "Creating Nginx configuration..."

sudo tee "$NGINX_CONF" > /dev/null << EOF
# 碳硅回路设计师 - Carbon Silicon Loop Designer
# Generated: $(date '+%Y-%m-%d %H:%M:%S')

server {
  listen 80;
  server_name $DOMAIN;

  # 碳硅回路设计师
  location /loop-designer/ {
    proxy_pass http://127.0.0.1:3010/;
    proxy_http_version 1.1;

    # Headers
    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    # Timeouts (AI generation can take longer)
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
  }

  # Static assets caching
  location /loop-designer/_next/static/ {
    proxy_pass http://127.0.0.1:3010/_next/static/;
    expires 1y;
    add_header Cache-Control "public, immutable, max-age=31536000";
    add_header X-Content-Type-Options "nosniff";
  }

  # Favicon
  location /loop-designer/favicon.ico {
    proxy_pass http://127.0.0.1:3010/favicon.ico;
    expires 7d;
    add_header Cache-Control "public, max-age=604800";
  }

  # Health check endpoint
  location /loop-designer/api/health {
    proxy_pass http://127.0.0.1:3010/api/health;
    access_log off;
  }
}
EOF

log_info "Configuration file created: $NGINX_CONF"

# 3. 测试配置
log_info "Testing Nginx configuration..."

if sudo nginx -t; then
  log_info "Nginx configuration is valid"
else
  log_error "Nginx configuration test failed"
  echo "Check the error message above"
  exit 1
fi

# 4. 检查是否已存在相同的配置
if sudo nginx -T 2>/dev/null | grep -q "loop-designer"; then
  log_warn "Loop Designer configuration already exists"
  read -p "Do you want to replace it? (y/N): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 0
  fi
fi

# 5. 重新加载 Nginx
log_info "Reloading Nginx..."

if sudo nginx -s reload; then
  log_info "Nginx reloaded successfully"
else
  log_error "Failed to reload Nginx"
  exit 1
fi

# 6. 等待应用启动
log_info "Waiting for application to be ready..."
sleep 2

# 7. 测试本地连接
log_info "Testing local connection..."

if curl -s -o /dev/null -w "%{http_code}" http://localhost:$PORT/ | grep -q "200"; then
  log_info "Local connection: OK (HTTP 200)"
else
  log_warn "Local connection: FAILED (Application might not be ready)"
fi

# 8. 测试 Nginx 代理
log_info "Testing Nginx proxy..."

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN/loop-designer/")
if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "304" ]; then
  log_info "Nginx proxy: OK (HTTP $HTTP_CODE)"
else
  log_warn "Nginx proxy: HTTP $HTTP_CODE (Check if application is running)"
fi

# 9. 显示配置摘要
echo ""
echo "=========================================="
echo "  Configuration Summary"
echo "=========================================="
echo ""
echo "Config File: $NGINX_CONF"
echo "Domain: $DOMAIN"
echo "Backend: http://127.0.0.1:$PORT"
echo ""
echo "Access URLs:"
echo "  • Direct: http://$DOMAIN:$PORT/"
echo "  • Proxy:  http://$DOMAIN/loop-designer/"
echo ""
echo "Next Steps:"
echo "  1. Test in browser: http://$DOMAIN/loop-designer/"
echo "  2. Check logs: tail -f /var/log/nginx/access.log"
echo "  3. Setup HTTPS: certbot --nginx -d $DOMAIN"
echo ""

# 10. 显示 Nginx 配置片段
echo "=========================================="
echo "  Current Configuration"
echo "=========================================="
echo ""
sudo nginx -T 2>/dev/null | grep -A 50 "loop-designer" || cat "$NGINX_CONF"
echo ""

log_info "Nginx configuration complete!"
