#!/bin/bash

# 自动化部署脚本
# 碳硅回路设计师 - 一键部署

set -uo pipefail

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$APP_DIR/apps/loop-designer"

# 颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 日志
log_info() { echo -e "${BLUE}ℹ️  $1${NC}"; }
log_success() { echo -e "${GREEN}✅ $1${NC}"; }
log_warning() { echo -e "${YELLOW}⚠️  $1${NC}"; }
log_error() { echo -e "${RED}❌ $1${NC}"; }
log_step() { echo -e "\n${BLUE}═══════════════════════════════════${NC}"; echo -e "${BLUE}$1${NC}"; echo -e "${BLUE}═══════════════════════════════════${NC}\n"; }

# 检查命令是否存在
check_command() {
    if command -v "$1" &> /dev/null; then
        log_success "$1 已安装"
        return 0
    else
        log_error "$1 未安装"
        return 1
    fi
}

# 检查环境变量
check_env() {
    local required_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "SUPABASE_SERVICE_ROLE_KEY"
        "MODEL_API_URL"
        "MODEL_API_KEY"
        "MODEL_NAME"
        "FEISHU_APP_ID"
        "FEISHU_APP_SECRET"
        "FEISHU_ALLOWED_TENANT_KEY"
        "LOOP_AUTH_SESSION_SECRET"
    )

    local missing=0

    for var in "${required_vars[@]}"; do
        if [ -z "${!var:-}" ]; then
            log_error "缺失环境变量: $var"
            missing=$((missing + 1))
        else
            log_success "$var 已配置"
        fi
    done

    if [ $missing -gt 0 ]; then
        log_error "缺少 $missing 个环境变量"
        return 1
    fi

    return 0
}

# 主流程
main() {
    log_step "🚀 碳硅回路设计师 - 自动化部署"

    echo "项目目录: $APP_DIR"
    echo "开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""

    # ==================== 阶段 1: 环境检查 ====================
    log_step "阶段 1/8: 环境检查"

    log_info "检查 Node.js..."
    if ! check_command node; then
        log_error "请先安装 Node.js 22.x: https://nodejs.org/"
        exit 1
    fi

    log_info "检查 npm..."
    if ! check_command npm; then
        log_error "npm 未安装"
        exit 1
    fi

    log_info "Node.js 版本: $(node --version)"
    log_info "npm 版本: $(npm --version)"

    # ==================== 阶段 2: 环境变量检查 ====================
    log_step "阶段 2/8: 环境变量检查"

    if [ ! -f .env.local ]; then
        log_error ".env.local 文件不存在"
        log_info "请复制 .env.example 并配置:"
        log_info "  cp .env.example .env.local"
        log_info "  nano .env.local"
        exit 1
    fi

    log_success ".env.local 文件存在"

    log_info "检查环境变量..."
    if ! check_env; then
        log_error "环境变量配置不完整"
        log_info "请参考 docs/PRODUCTION_SETUP.md 配置"
        exit 1
    fi

    # ==================== 阶段 3: 安装依赖 ====================
    log_step "阶段 3/8: 安装依赖"

    log_info "执行 npm ci..."
    if npm ci; then
        log_success "依赖安装完成"
    else
        log_error "依赖安装失败"
        exit 1
    fi

    # ==================== 阶段 4: 构建 ====================
    log_step "阶段 4/8: 构建生产版本"

    log_info "执行 npm run build..."
    if npm run build; then
        log_success "构建成功"
    else
        log_error "构建失败"
        exit 1
    fi

    # ==================== 阶段 5: 部署验证 ====================
    log_step "阶段 5/8: 部署验证"

    if [ -f scripts/verify-deployment.sh ]; then
        log_info "运行部署验证脚本..."
        if bash scripts/verify-deployment.sh; then
            log_success "部署验证通过"
        else
            log_warning "部署验证有失败项，请检查"
        fi
    else
        log_warning "未找到验证脚本，跳过"
    fi

    # ==================== 阶段 6: 启动服务 ====================
    log_step "阶段 6/8: 启动服务"

    log_info "检查端口 3000 是否被占用..."
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "端口 3000 已被占用，尝试停止旧进程..."
        lsof -ti:3000 | xargs kill -9 2>/dev/null || true
        sleep 2
    fi

    log_info "启动服务..."
    node .next/standalone/apps/loop-designer/server.js &
    SERVER_PID=$!

    sleep 3

    if ps -p $SERVER_PID > /dev/null 2>&1; then
        log_success "服务已启动 (PID: $SERVER_PID)"
    else
        log_error "服务启动失败"
        exit 1
    fi

    # ==================== 阶段 7: 健康检查 ====================
    log_step "阶段 7/8: 健康检查"

    log_info "等待服务启动..."
    sleep 3

    log_info "测试本地访问..."
    if curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000/loop-designer/ | grep -q "307\|200"; then
        log_success "本地访问正常"
    else
        log_warning "本地访问异常，但服务可能还在启动"
    fi

    # ==================== 阶段 8: 完成 ====================
    log_step "✅ 部署完成"

    echo "结束时间: $(date '+%Y-%m-%d %H:%M:%S')"
    echo ""
    log_success "🚀 部署成功！"
    echo ""
    log_info "📋 下一步："
    echo "  1. 执行数据库迁移"
    echo "     → 查看: docs/DATABASE_MIGRATION.md"
    echo ""
    echo "  2. 配置 Nginx（生产环境）"
    echo "     → 查看: docs/GO_LIVE_CHECKLIST.md"
    echo ""
    echo "  3. 测试飞书登录"
    echo ""
    echo "  4. 测试邮箱注册"
    echo ""
    log_info "🌐 访问地址:"
    echo "  本地: http://127.0.0.1:3000/loop-designer/"
    echo "  生产: https://loop.csi-org.com/loop-designer/"
    echo ""
    log_info "📚 文档:"
    echo "  上线清单: docs/GO_LIVE_CHECKLIST.md"
    echo "  快速参考: docs/QUICK_REFERENCE.md"
    echo "  部署指南: docs/DEPLOYMENT.md"
    echo ""
    log_info "🛑 停止服务:"
    echo "  kill $SERVER_PID"
    echo "  或使用 PM2: pm2 stop carbon-silicon-loop-designer"
    echo ""
}

# 执行
main "$@"
