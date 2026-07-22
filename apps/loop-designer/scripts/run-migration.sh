#!/bin/bash

# 数据库迁移执行脚本
# 自动验证迁移状态

set -e

APP_DIR="/var/www/carbon-silicon-org-book/apps/loop-designer"

echo "=========================================="
echo "  数据库迁移执行脚本"
echo "=========================================="
echo ""

cd "$APP_DIR"

# 检查环境变量
echo "检查环境变量..."
if ! node scripts/verify-env.mjs 2>&1 | grep -q "✅ 所有环境变量已配置"; then
    echo "❌ 环境变量未配置完整"
    echo "请先配置 .env.local"
    exit 1
fi

echo "✅ 环境变量配置正确"
echo ""

# 检查迁移文件
MIGRATION_FILE="supabase/migrations/202606110002_enterprise_subscription.sql"

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ 迁移文件不存在: $MIGRATION_FILE"
    exit 1
fi

echo "✅ 迁移文件存在"
echo ""

# 显示迁移内容
echo "=========================================="
echo "  迁移内容预览"
echo "=========================================="
echo ""
echo "新增表:"
grep "create table" "$MIGRATION_FILE" | sed 's/.*create table if not exists //' | sed 's/ (.*//'
echo ""

echo "新增字段:"
grep "add column" "$MIGRATION_FILE" | sed 's/.*add column if not exists //' | sed 's/ .*//'
echo ""

echo "RPC 函数:"
grep "create or replace function" "$MIGRATION_FILE" | sed 's/.*function //' | sed 's/(.*//'
echo ""

# 检查 Supabase 连接
echo "=========================================="
echo "  检查数据库连接"
echo "=========================================="
echo ""

if ! node -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
supabase.from('loop_designer_users').select('count').then(({ error }) => {
  if (error) {
    console.error('❌ 数据库连接失败:', error.message);
    process.exit(1);
  } else {
    console.log('✅ 数据库连接成功');
  }
});
" 2>&1; then
    echo "❌ 数据库连接失败"
    echo "请检查 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY"
    exit 1
fi

echo ""

# 检查表是否存在
echo "=========================================="
echo "  检查现有表"
echo "=========================================="
echo ""

EXISTING_TABLES=$(node -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
supabase.rpc('get_existing_tables').then(({ data }) => {
  console.log(data || []);
}).catch(() => {
  console.log([]);
});
" 2>&1)

echo "现有表: $EXISTING_TABLES"
echo ""

# 检查是否需要迁移
NEEDS_MIGRATION=false

if echo "$EXISTING_TABLES" | grep -q "loop_designer_enterprises"; then
    echo "✅ 企业表已存在，可能已迁移"
else
    echo "⚠️  企业表不存在，需要执行迁移"
    NEEDS_MIGRATION=true
fi

echo ""

if [ "$NEEDS_MIGRATION" = false ]; then
    echo "=========================================="
    echo "  验证迁移结果"
    echo "=========================================="
    echo ""

    echo "检查新增字段..."
    if node -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
supabase.from('loop_designer_users').select('email, password_hash, auth_provider, enterprise_id').limit(1).then(({ error }) => {
  if (error) {
    console.error('❌ 字段检查失败:', error.message);
    process.exit(1);
  } else {
    console.log('✅ 新增字段已存在');
  }
});
" 2>&1; then
        echo ""
    else
        echo "⚠️  新增字段可能不存在"
    fi

    echo ""
    echo "=========================================="
    echo "  迁移已完成"
    echo "=========================================="
    echo ""
    echo "如果需要重新迁移，请："
    echo "1. 备份数据库"
    echo "2. 在 Supabase SQL Editor 手动执行迁移"
    echo ""
    exit 0
fi

# 执行迁移
echo "=========================================="
echo "  执行迁移"
echo "=========================================="
echo ""

echo "⚠️  即将执行数据库迁移"
echo ""
echo "迁移内容:"
echo "  - 5 张新表 (enterprises, members, invites, audit_logs, settings)"
echo "  - 4 个新字段 (users 表)"
echo "  - 2 个 RPC 函数"
echo ""

read -p "确认执行？(y/N): " -n 1 -r
echo

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "取消迁移"
    exit 0
fi

echo ""
echo "方式 1: 使用 Supabase CLI"
echo "  supabase migration up"
echo ""

echo "方式 2: 使用 Supabase Dashboard (推荐)"
echo "  1. 打开 https://supabase.com/dashboard"
echo "  2. 进入 SQL Editor"
echo "  3. 复制以下内容并执行:"
echo ""
echo "  $(cat $MIGRATION_FILE)"
echo ""

read -p "是否在浏览器中打开 Supabase Dashboard？(y/N): " -n 1 -r
echo

if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "请在浏览器中完成迁移后按回车继续..."
    read
fi

echo ""
echo "=========================================="
echo "  验证迁移结果"
echo "=========================================="
echo ""

echo "检查表是否创建..."
if node -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const tables = [
  'loop_designer_enterprises',
  'loop_designer_enterprise_members',
  'loop_designer_invite_codes',
  'loop_designer_audit_logs',
  'loop_designer_enterprise_settings'
];
Promise.all(tables.map(t => supabase.from(t).select('count').limit(1))).then(() => {
  console.log('✅ 所有表创建成功');
}).catch((error) => {
  console.error('❌ 表检查失败:', error.message);
  process.exit(1);
});
" 2>&1; then
    echo ""
else
    echo "⚠️  部分表可能未创建"
fi

echo ""
echo "=========================================="
echo "  迁移完成"
echo "=========================================="
echo ""
echo "下一步:"
echo "1. 重启应用"
echo "   pm2 restart carbon-silicon-loop-designer"
echo ""
echo "2. 验证环境变量"
echo "   node scripts/verify-env.mjs"
echo ""
echo "3. 测试功能"
echo "   - 飞书登录"
echo "   - 邮箱注册"
echo "   - 管理后台"
echo ""
echo "详细文档: docs/DATABASE_MIGRATION.md"
echo ""
