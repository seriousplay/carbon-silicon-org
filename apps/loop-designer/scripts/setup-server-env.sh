#!/usr/bin/env bash

# 服务器环境变量配置脚本
# 在服务器上运行此脚本创建 .env.local

set -e

APP_DIR="/var/www/carbon-silicon-org-book/apps/loop-designer"

echo "=========================================="
echo "  配置服务器环境变量"
echo "=========================================="
echo ""

cd "$APP_DIR"

# 检查是否已存在
if [ -f .env.local ]; then
    echo "⚠️  .env.local 文件已存在"
    read -p "是否覆盖？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "取消配置"
        exit 0
    fi
fi

# 复制模板
cp .env.example .env.local

echo "✅ .env.local 文件已创建"
echo ""
echo "⚠️  重要：请编辑 .env.local 填入真实配置！"
echo ""
echo "编辑文件："
echo "  nano $APP_DIR/.env.local"
echo ""
echo "必填变量："
echo "  - NEXT_PUBLIC_SUPABASE_URL"
echo "  - NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "  - SUPABASE_SERVICE_ROLE_KEY"
echo "  - MODEL_API_URL"
echo "  - MODEL_API_KEY"
echo "  - MODEL_NAME"
echo "  - FEISHU_APP_ID"
echo "  - FEISHU_APP_SECRET"
echo "  - FEISHU_ALLOWED_TENANT_KEY"
echo "  - LOOP_AUTH_SESSION_SECRET"
echo ""
echo "详细说明：docs/PRODUCTION_SETUP.md"
echo ""

# 验证
if [ -f scripts/verify-env.mjs ]; then
    echo "运行环境变量验证..."
    node scripts/verify-env.mjs 2>&1 || true
    echo ""
fi

echo "配置完成后，重启应用："
echo "  pm2 restart carbon-silicon-loop-designer"
echo ""
