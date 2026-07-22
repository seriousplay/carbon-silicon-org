#!/usr/bin/env bash

# 演示部署脚本
# 用于展示部署流程（使用模拟数据）

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$APP_DIR/apps/loop-designer"

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║                                                              ║"
echo "║       碳硅回路设计师 - 部署演示                              ║"
echo "║                                                              ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# 检查
echo -e "${YELLOW}⚠️  注意: 这是演示模式，使用模拟数据${NC}"
echo ""

# 创建模拟 .env.local（仅用于演示）
if [ ! -f .env.local ]; then
    echo "创建模拟环境配置..."
    cat > .env.local << 'EOF'
# 演示配置 - 仅用于测试部署流程
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=https://demo.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=demo-anon-key
SUPABASE_SERVICE_ROLE_KEY=demo-service-role-key
MODEL_API_URL=https://api.stepfun.com/step_plan/v1/chat/completions
MODEL_API_KEY=demo-model-api-key
MODEL_NAME=step-router-v1
MODEL_TIMEOUT_MS=300000
FEISHU_APP_ID=demo_app_id
FEISHU_APP_SECRET=demo-secret
FEISHU_ALLOWED_TENANT_KEY=demo-tenant-key
FEISHU_EXPORT_FOLDER_TOKEN=demo-folder-token
LOOP_AUTH_SESSION_SECRET=demo-session-secret-key-12345678901234567890
LOOP_AUTH_SESSION_TTL_SECONDS=1209600
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
EOF
    echo -e "${GREEN}✅ 模拟配置已创建${NC}"
fi

# 执行部署
echo ""
echo "开始部署流程..."
echo ""

# 步骤 1
echo -e "${BLUE}━━━ 步骤 1/8: 环境检查 ━━━${NC}"
echo "Node.js: $(node --version 2>&1 || echo '未安装')"
echo "npm: $(npm --version 2>&1 || echo '未安装')"
echo ""

# 步骤 2
echo -e "${BLUE}━━━ 步骤 2/8: 环境变量检查 ━━━${NC}"
node scripts/verify-env.mjs 2>&1 || echo -e "${YELLOW}⚠️  部分环境变量使用模拟值${NC}"
echo ""

# 步骤 3
echo -e "${BLUE}━━━ 步骤 3/8: 安装依赖 ━━━${NC}"
npm ci --silent
echo -e "${GREEN}✅ 依赖安装完成${NC}"
echo ""

# 步骤 4
echo -e "${BLUE}━━━ 步骤 4/8: 构建生产版本 ━━━${NC}"
npm run build
echo ""

# 步骤 5
echo -e "${BLUE}━━━ 步骤 5/8: 部署验证 ━━━${NC}"
if [ -f scripts/verify-deployment.sh ]; then
    bash scripts/verify-deployment.sh 2>&1 | tail -30 || echo -e "${YELLOW}⚠️  部分验证失败（使用模拟配置）${NC}"
fi
echo ""

# 步骤 6
echo -e "${BLUE}━━━ 步骤 6/8: 启动服务 ━━━${NC}"
echo "模拟启动服务..."
echo "实际部署时: node .next/standalone/apps/loop-designer/server.js"
echo ""

# 步骤 7
echo -e "${BLUE}━━━ 步骤 7/8: 健康检查 ━━━${NC}"
echo "服务状态: 正常（模拟）"
echo ""

# 完成
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║          ✅ 演示部署完成！                                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo -e "${GREEN}部署流程演示完成！${NC}"
echo ""
echo -e "${YELLOW}⚠️  这是演示模式，要完成真实部署，请：${NC}"
echo ""
echo "1. 配置真实环境变量"
echo "   ./scripts/setup-env.sh"
echo ""
echo "2. 执行数据库迁移"
echo "   查看: docs/DATABASE_MIGRATION.md"
echo ""
echo "3. 启动真实服务"
echo "   node .next/standalone/apps/loop-designer/server.js"
echo ""
echo "4. 或使用 PM2 管理"
echo "   pm2 start ecosystem.config.cjs"
echo ""
echo -e "${BLUE}📚 详细文档:${NC}"
echo "  - docs/GO_LIVE_CHECKLIST.md (上线清单)"
echo "  - docs/PRODUCTION_SETUP.md (环境配置)"
echo "  - docs/DATABASE_MIGRATION.md (数据库迁移)"
echo ""
