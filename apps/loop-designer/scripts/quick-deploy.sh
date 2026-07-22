#!/bin/bash

# 一键部署脚本
# 整合所有部署步骤

set -e

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$APP_DIR/apps/loop-designer"

# 颜色
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

clear

echo -e "${BLUE}"
cat << "EOF"
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║         碳硅回路设计师 - 一键部署                                ║
║         Carbon-Silicon Loop Designer                             ║
║                                                                  ║
║  本脚本将帮助你：                                                ║
║  1. 配置环境变量                                                ║
║  2. 执行数据库迁移                                              ║
║  3. 构建生产版本                                                ║
║  4. 启动服务                                                    ║
║  5. 验证部署                                                    ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝
EOF
echo -e "${NC}"
echo ""

# 检查前提
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    echo "请先安装 Node.js 22.x: https://nodejs.org/"
    exit 1
fi

echo -e "${GREEN}✅ Node.js $(node --version)${NC}"

# 菜单
while true; do
    echo ""
    echo "请选择操作："
    echo ""
    echo "  1) 完整部署（首次部署推荐）"
    echo "  2) 仅配置环境变量"
    echo "  3) 仅构建项目"
    echo "  4) 仅启动服务"
    echo "  5) 运行部署验证"
    echo "  6) 查看文档"
    echo "  0) 退出"
    echo ""
    read -p "输入数字 [0-6]: " choice

    case $choice in
        1)
            echo ""
            echo -e "${BLUE}═══ 完整部署流程 ═══${NC}"
            echo ""

            # Step 1: 配置
            echo "步骤 1/5: 配置环境变量"
            if [ ! -f .env.local ]; then
                echo "创建 .env.local..."
                cp .env.example .env.local
                echo "⚠️  请编辑 .env.local 填写真实配置"
                nano .env.local
            else
                echo "✅ .env.local 已存在"
            fi
            echo ""

            # Step 2: 验证环境
            echo "步骤 2/5: 验证环境变量"
            node scripts/verify-env.mjs 2>&1 || echo "⚠️  部分变量可能未配置"
            echo ""

            # Step 3: 安装和构建
            echo "步骤 3/5: 安装依赖"
            npm ci
            echo ""

            echo "步骤 4/5: 构建生产版本"
            npm run build
            echo ""

            # Step 4: 验证
            echo "步骤 5/5: 部署验证"
            bash scripts/verify-deployment.sh 2>&1 || echo "⚠️  部分验证失败"
            echo ""

            # 完成
            echo -e "${GREEN}✅ 部署完成！${NC}"
            echo ""
            echo "下一步："
            echo "  1. 执行数据库迁移（查看 docs/DATABASE_MIGRATION.md）"
            echo "  2. 启动服务: pm2 start ecosystem.config.cjs"
            echo "  3. 配置 Nginx（生产环境）"
            echo ""
            ;;

        2)
            echo ""
            echo -e "${BLUE}═══ 配置环境变量 ═══${NC}"
            ./scripts/setup-env.sh
            ;;

        3)
            echo ""
            echo -e "${BLUE}═══ 构建项目 ═══${NC}"
            npm ci
            npm run build
            echo -e "${GREEN}✅ 构建完成${NC}"
            ;;

        4)
            echo ""
            echo -e "${BLUE}═══ 启动服务 ═══${NC}"
            if command -v pm2 &> /dev/null; then
                pm2 start ecosystem.config.cjs
                pm2 logs
            else
                echo "使用 node 直接启动..."
                node .next/standalone/apps/loop-designer/server.js
            fi
            ;;

        5)
            echo ""
            echo -e "${BLUE}═══ 运行部署验证 ═══${NC}"
            bash scripts/verify-deployment.sh
            ;;

        6)
            echo ""
            echo "可用文档："
            echo "  1. docs/GO_LIVE_CHECKLIST.md - 上线清单"
            echo "  2. docs/DEPLOY_QUICK_START.md - 快速开始"
            echo "  3. docs/DATABASE_MIGRATION.md - 数据库迁移"
            echo "  4. docs/PRODUCTION_SETUP.md - 环境配置"
            echo "  5. docs/QUICK_REFERENCE.md - 快速参考"
            echo "  6. docs/DEPLOYMENT.md - 完整部署指南"
            echo ""
            read -p "输入文档编号查看: " doc_choice
            case $doc_choice in
                1) cat docs/GO_LIVE_CHECKLIST.md | less ;;
                2) cat docs/DEPLOY_QUICK_START.md | less ;;
                3) cat docs/DATABASE_MIGRATION.md | less ;;
                4) cat docs/PRODUCTION_SETUP.md | less ;;
                5) cat docs/QUICK_REFERENCE.md | less ;;
                6) cat docs/DEPLOYMENT.md | less ;;
                *) echo "无效选择" ;;
            esac
            ;;

        0)
            echo ""
            echo "再见！"
            exit 0
            ;;

        *)
            echo "无效选择，请重试"
            ;;
    esac
done
