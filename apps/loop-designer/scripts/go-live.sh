#!/bin/bash

# 一键上线脚本 - 整合所有配置步骤
# 在本地运行此脚本

set -e

SSH_KEY="$HOME/.ssh/daodecision_aliyun.pem"
SERVER="root@47.95.199.142"
APP_DIR="/var/www/carbon-silicon-org-book/apps/loop-designer"

BLUE='\033[0;34m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════════╗"
echo "║                                                                  ║"
echo "║              碳硅回路设计师 - 一键上线助手                        ║"
echo "║                                                                  ║"
echo "╚══════════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""
echo "服务器: $SERVER"
echo "应用路径: $APP_DIR"
echo ""

# 检查 SSH
echo -e "${BLUE}检查 SSH 连接...${NC}"
if ssh -i "$SSH_KEY" -o ConnectTimeout=5 "$SERVER" "echo 'SSH OK'" 2>/dev/null; then
    echo -e "${GREEN}✅ SSH 连接正常${NC}"
else
    echo "❌ SSH 连接失败"
    exit 1
fi
echo ""

# 菜单
while true; do
    echo "请选择操作:"
    echo ""
    echo "  1) 📝 配置环境变量"
    echo "  2) 🗄️  执行数据库迁移"
    echo "  3) ✅ 验证环境配置"
    echo "  4) 🔄 重启应用"
    echo "  5) 📊 查看应用状态"
    echo "  6) 📋 查看部署进度"
    echo "  0) 退出"
    echo ""
    read -p "输入数字 [0-6]: " choice

    case $choice in
        1)
            echo ""
            echo -e "${BLUE}═══ 配置环境变量 ═══${NC}"
            echo ""
            echo "SSH 到服务器:"
            echo "  ssh -i $SSH_KEY $SERVER"
            echo ""
            echo "编辑环境变量:"
            echo "  nano $APP_DIR/.env.local"
            echo ""
            echo "需要填入的变量:"
            echo "  □ NEXT_PUBLIC_SITE_URL=https://loop.csi-org.com"
            echo "  □ NEXT_PUBLIC_SUPABASE_URL=xxx"
            echo "  □ NEXT_PUBLIC_SUPABASE_ANON_KEY=xxx"
            echo "  □ SUPABASE_SERVICE_ROLE_KEY=xxx"
            echo "  □ MODEL_API_URL=xxx"
            echo "  □ MODEL_API_KEY=xxx"
            echo "  □ MODEL_NAME=xxx"
            echo "  □ FEISHU_APP_ID=xxx"
            echo "  □ FEISHU_APP_SECRET=xxx"
            echo "  □ FEISHU_ALLOWED_TENANT_KEY=xxx"
            echo "  □ LOOP_AUTH_SESSION_SECRET=xxx (32+ 字符)"
            echo ""
            echo "保存后重启:"
            echo "  pm2 restart carbon-silicon-loop-designer"
            echo ""
            echo "详细说明: docs/CONFIG_SERVER_ENV.md"
            echo ""

            read -p "是否立即打开编辑器？(y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                ssh -i "$SSH_KEY" "$SERVER" "nano $APP_DIR/.env.local"
            fi
            ;;

        2)
            echo ""
            echo -e "${BLUE}═══ 执行数据库迁移 ═══${NC}"
            echo ""
            echo "方式 1: 自动化脚本"
            echo "  ssh -i $SSH_KEY $SERVER 'bash $APP_DIR/scripts/run-migration.sh'"
            echo ""
            echo "方式 2: 手动执行"
            echo "  1. 打开 https://supabase.com/dashboard"
            echo "  2. 进入 SQL Editor"
            echo "  3. 复制 supabase/migrations/202606110002_enterprise_subscription.sql"
            echo "  4. 粘贴并执行"
            echo ""
            echo "详细说明: docs/DATABASE_MIGRATION.md"
            echo ""

            read -p "是否立即执行？(y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                ssh -i "$SSH_KEY" "$SERVER" "bash $APP_DIR/scripts/run-migration.sh"
            fi
            ;;

        3)
            echo ""
            echo -e "${BLUE}═══ 验证环境配置 ═══${NC}"
            echo ""
            ssh -i "$SSH_KEY" "$SERVER" "cd $APP_DIR && node scripts/verify-env.mjs"
            echo ""
            ;;

        4)
            echo ""
            echo -e "${BLUE}═══ 重启应用 ═══${NC}"
            echo ""
            ssh -i "$SSH_KEY" "$SERVER" "pm2 restart carbon-silicon-loop-designer && pm2 list"
            echo ""
            ;;

        5)
            echo ""
            echo -e "${BLUE}═══ 应用状态 ═══${NC}"
            echo ""
            echo "PM2 状态:"
            ssh -i "$SSH_KEY" "$SERVER" "pm2 list"
            echo ""
            echo "资源使用:"
            ssh -i "$SSH_KEY" "$SERVER" "pm2 monit"
            echo ""
            ;;

        6)
            echo ""
            cat docs/DEPLOYMENT_PROGRESS.md
            echo ""
            ;;

        0)
            echo ""
            echo "再见！"
            exit 0
            ;;

        *)
            echo "无效选择"
            ;;
    esac
done
