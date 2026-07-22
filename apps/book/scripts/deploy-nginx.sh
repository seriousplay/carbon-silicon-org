#!/usr/bin/env bash
set -euo pipefail

# Deploy Nginx configuration to production server
# This script copies the optimized nginx.conf to the Aliyun server

HOST="${ALIYUN_HOST:-47.95.199.142}"
USER="${ALIYUN_USER:-root}"
KEY="${ALIYUN_KEY:-$HOME/.ssh/daodecision_aliyun.pem}"

if [[ ! -f "$KEY" ]]; then
  echo "SSH key not found: $KEY" >&2
  exit 1
fi

CONFIG_SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/.deploy/nginx.conf"
CONFIG_DST="/etc/nginx/conf.d/carbon-silicon-tools-site.conf"

echo "Deploying Nginx configuration..."

# Copy config to server
scp -i "$KEY" "$CONFIG_SRC" "$USER@$HOST:$CONFIG_DST"

# Test configuration
echo "Testing Nginx configuration..."
ssh -i "$KEY" "$USER@$HOST" "nginx -t"

# Reload Nginx
echo "Reloading Nginx..."
ssh -i "$KEY" "$USER@$HOST" "nginx -s reload"

echo "✓ Nginx configuration deployed successfully"
echo ""
echo "Verification:"
echo "  curl -I -H 'Accept-Encoding: gzip' https://carbon.daodecision.com | grep -i content-encoding"
echo ""
echo "Expected output: Content-Encoding: gzip"
