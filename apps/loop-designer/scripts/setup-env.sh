#!/bin/bash

# 环境配置向导
# 交互式配置 .env.local

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$APP_DIR/apps/loop-designer"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }

echo -e "${BLUE}"
echo "═══════════════════════════════════════════════"
echo "  碳硅回路设计师 - 环境配置向导"
echo "═══════════════════════════════════════════════"
echo -e "${NC}"
echo ""

# 检查是否已存在
if [ -f .env.local ]; then
    echo -e "${YELLOW}⚠️  .env.local 文件已存在${NC}"
    read -p "是否覆盖？(y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "取消配置"
        exit 0
    fi
fi

# 创建模板
cp .env.example .env.local

log_info "请按提示配置环境变量"
log_info "详细说明请参考: docs/PRODUCTION_SETUP.md"
echo ""

# 函数：配置变量
config_var() {
    local var_name="$1"
    local description="$2"
    local required="$3"
    local current_value=$(grep "^$var_name=" .env.local | cut -d'=' -f2-)

    echo -e "${BLUE}$description${NC}"
    if [ -n "$current_value" ] && [[ ! "$current_value" =~ (replace-me|your-) ]]; then
        echo -e "当前值: ${GREEN}$current_value${NC}"
        read -p "是否修改？(y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return
        fi
    fi

    while true; do
        read -p "请输入 $var_name: " value
        if [ -z "$value" ] && [ "$required" = "true" ]; then
            log_warning "此变量为必填项"
        else
            if [ -n "$value" ]; then
                sed -i.bak "s|^$var_name=.*|$var_name=$value|" .env.local && rm -f .env.local.bak
                log_success "$var_name 已配置"
            fi
            break
        fi
    done
    echo ""
}

# Supabase 配置
echo -e "${BLUE}━━━ Supabase 配置 ━━━${NC}"
config_var "NEXT_PUBLIC_SUPABASE_URL" "Supabase Project URL" true
config_var "NEXT_PUBLIC_SUPABASE_ANON_KEY" "Supabase Anon Key" true
config_var "SUPABASE_SERVICE_ROLE_KEY" "Supabase Service Role Key" true

# LLM 配置
echo ""
echo -e "${BLUE}━━━ LLM 配置 ━━━${NC}"
config_var "MODEL_API_URL" "LLM API URL (如: https://api.stepfun.com/step_plan/v1/chat/completions)" true
config_var "MODEL_API_KEY" "LLM API Key" true
config_var "MODEL_NAME" "模型名称 (如: step-router-v1)" true

# 飞书配置
echo ""
echo -e "${BLUE}━━━ 飞书配置 ━━━${NC}"
config_var "FEISHU_APP_ID" "飞书 App ID" true
config_var "FEISHU_APP_SECRET" "飞书 App Secret" true
config_var "FEISHU_ALLOWED_TENANT_KEY" "飞书 Encrypt Key" true
config_var "FEISHU_EXPORT_FOLDER_TOKEN" "飞书导出文件夹 Token (可选)" false

# 认证配置
echo ""
echo -e "${BLUE}━━━ 认证配置 ━━━${NC}"
config_var "LOOP_AUTH_SESSION_SECRET" "Session 密钥 (≥32字符, 生成: openssl rand -hex 32)" true
config_var "LOOP_AUTH_SESSION_TTL_SECONDS" "Session 有效期 (默认: 1209600 = 14天)" false

# PDF 配置
echo ""
read -p "是否配置 PDF 导出功能？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    config_var "CHROMIUM_EXECUTABLE_PATH" "Chromium 路径 (如: /usr/bin/chromium-browser)" false
fi

# 完成
echo ""
log_success "配置完成！"
echo ""
log_info "验证配置..."
node scripts/verify-env.mjs 2>/dev/null || log_warning "验证脚本发现未配置项，请检查"

echo ""
log_info "下一步："
echo "  1. 执行数据库迁移: 查看 docs/DATABASE_MIGRATION.md"
echo "  2. 构建部署: ./scripts/deploy.sh"
echo "  3. 上线清单: 查看 docs/GO_LIVE_CHECKLIST.md"
echo ""
