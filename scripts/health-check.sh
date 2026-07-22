#!/bin/bash
# Carbon-Silicon Organization - Health Check Script
# Usage: ./scripts/health-check.sh

set -euo pipefail

BASE_URL="${BASE_URL:-https://csi-org.com}"
APPS=(
  "/book"
  "/loop-designer"
  "/loopos"
  "/workshops"
  "/health"
)

echo "=== Carbon-Silicon Org Health Check ==="
echo "Base URL: ${BASE_URL}"
echo ""

ALL_OK=true

for path in "${APPS[@]}"; do
  url="${BASE_URL}${path}"
  response=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "${url}" 2>/dev/null || echo "000")
  
  if [ "$response" = "200" ] || [ "$response" = "302" ] || [ "$response" = "301" ]; then
    echo "  ✅ ${path}: HTTP ${response}"
  else
    echo "  ❌ ${path}: HTTP ${response}"
    ALL_OK=false
  fi
done

echo ""
if [ "$ALL_OK" = true ]; then
  echo "All services healthy ✅"
  exit 0
else
  echo "Some services unhealthy ❌"
  exit 1
fi
