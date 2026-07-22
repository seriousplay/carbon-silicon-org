#!/bin/bash

# 快速上线助手
# 整合所有下一步操作

set -e

APP_DIR="/var/www/carbon-silicon-org-book/apps/loop-designer"

clear

cat << "EOF"
╔══════════════════════════════════════════════════════════════════╗
║                                                                  ║
║              碳硅回路设计师 - 上线助手                             ║
║                                                                  ║
╚══════════════════════════════════════════════════════════════════╝

📊 当前进度: 60%
⏱️  预计完成: 1 小时

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
下一步任务:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1️⃣  配置环境变量 (5分钟)
2️⃣  执行数据库迁移 (5分钟)
3️⃣  测试完整功能 (30分钟)
4️⃣  生产优化 (可选)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

EOF

echo "请选择操作:"
echo ""
echo "  1) 配置环境变量"
echo "  2) 执行数据库迁移"
echo "  3) 验证环境变量"
echo "  4) 重启应用"
echo "  5) 查看当前进度"
echo "  6) 查看完整文档"
echo "  0) 退出"
echo ""

read -p "输入数字 [0-6]: " choice

case $choice in
    1)
        echo ""
        echo "配置环境变量..."
        echo ""
        echo "1. SSH 到服务器:"
        echo "   ssh root@47.95.199.142"
        echo ""
        echo "2. 编辑配置:"
        echo "   nano $APP_DIR/.env.local"
        echo ""
        echo "3. 填入真实配置后重启:"
        echo "   pm2 restart carbon-silicon-loop-designer"
        echo ""
        echo "详细说明:"
        echo "   docs/CONFIG_SERVER_ENV.md"
        echo ""
        ;;

    2)
        echo ""
        echo "执行数据库迁移..."
        echo ""
        echo "方式 1: 使用自动化脚本"
        echo "   ssh root@47.95.199.142"
        echo "   bash $APP_DIR/scripts/run-migration.sh"
        echo ""
        echo "方式 2: 手动执行 (Supabase Dashboard)"
        echo "   1. 打开 https://supabase.com/dashboard"
        echo "   2. 进入 SQL Editor"
        echo "   3. 执行: cat supabase/migrations/202606110002_enterprise_subscription.sql"
        echo ""
        echo "详细说明:"
        echo "   docs/DATABASE_MIGRATION.md"
        echo ""
        ;;

    3)
        echo ""
        echo "验证环境变量..."
        echo ""
        echo "SSH 到服务器:"
        echo "   ssh root@47.95.199.142"
        echo ""
        echo "运行验证:"
        echo "   cd $APP_DIR"
        echo "   node scripts/verify-env.mjs"
        echo ""
        ;;

    4)
        echo ""
        echo "重启应用..."
        echo ""
        echo "SSH 到服务器:"
        echo "   ssh root@47.95.199.142"
        echo ""
        echo "重启 PM2:"
        echo "   pm2 restart carbon-silicon-loop-designer"
        echo ""
        echo "查看状态:"
        echo "   pm2 list"
        echo ""
        ;;

    5)
        echo ""
        cat docs/DEPLOYMENT_PROGRESS.md
        ;;

    6)
        echo ""
        echo "可用文档:"
        echo "  1. CONFIG_SERVER_ENV.md - 环境变量配置"
        echo "  2. DATABASE_MIGRATION.md - 数据库迁移"
        echo "  3. BUSINESS_VERIFICATION.md - 功能验证"
        echo "  4. PRODUCTION_SETUP.md - 生产环境配置"
        echo "  5. QUICK_REFERENCE.md - 快速参考"
        echo ""
        read -p "输入文档编号: " doc_choice
        case $doc_choice in
            1) cat docs/CONFIG_SERVER_ENV.md | less ;;
            2) cat docs/DATABASE_MIGRATION.md | less ;;
            3) cat docs/BUSINESS_VERIFICATION.md | less ;;
            4) cat docs/PRODUCTION_SETUP.md | less ;;
            5) cat docs/QUICK_REFERENCE.md | less ;;
            *) echo "无效选择" ;;
        esac
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
