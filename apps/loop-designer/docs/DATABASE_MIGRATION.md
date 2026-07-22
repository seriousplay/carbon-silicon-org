# 🗄️ 数据库迁移执行指南

本文档提供 **碳硅回路设计师** 数据库迁移的详细步骤，包括首次迁移、升级迁移、验证和回滚方案。

---

## 📋 迁移概览

### 当前迁移状态

| 迁移文件 | 描述 | 状态 |
|---------|------|------|
| `202606060001_feishu_identity.sql` | 初始迁移（用户、会话、认证） | ✅ 已执行 |
| `202606110002_enterprise_subscription.sql` | 企业订阅管理（新增 5 表） | ⏳ **待执行** |

---

## ⚡ 快速执行（推荐）

### 方法 1: 使用 Supabase Dashboard（最简单）

```bash
# 1. 登录 Supabase Dashboard
https://supabase.com/dashboard

# 2. 选择项目
# 3. 进入 SQL Editor
# 4. 打开迁移文件
cat supabase/migrations/202606110002_enterprise_subscription.sql

# 5. 复制全部内容并执行
```

**预计时间**: 5 分钟

---

### 方法 2: 使用 Supabase CLI（自动化）

```bash
# 1. 安装 Supabase CLI（如果未安装）
npm install -g supabase

# 2. 登录
supabase login

# 3. 链接项目
cd /path/to/carbon-silicon-org-book/apps/loop-designer
supabase link --project-ref your-project-ref

# 4. 执行迁移
supabase migration up

# 5. 验证
supabase db diff
```

**预计时间**: 3 分钟

---

## 📖 详细步骤

### 前置条件

- [ ] Supabase 项目已创建
- [ ] 数据库密码已保存
- [ ] 有项目管理员权限
- [ ] 现有数据已备份（Supabase 自动备份）

---

### 步骤 1: 备份数据库

#### 方法 A: 通过 Supabase Dashboard

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目 → **Database** → **Backups**
3. 点击 **Create manual backup**
4. 等待备份完成（通常 1-5 分钟）
5. 下载备份文件（可选）

#### 方法 B: 使用 Supabase CLI

```bash
# 导出数据
supabase db dump --data-only > backup_before_migration_$(date +%Y%m%d_%H%M%S).sql

# 验证备份文件
ls -lh backup_before_migration_*.sql
```

---

### 步骤 2: 执行迁移

#### 选项 A: 使用 Supabase Dashboard（推荐新手）

1. **打开 SQL Editor**
   ```
   https://supabase.com/dashboard → 项目 → SQL Editor
   ```

2. **打开迁移文件**
   ```bash
   # 在本地终端
   cat supabase/migrations/202606110002_enterprise_subscription.sql
   ```

3. **复制全部内容**（从 `-- Phase 1:` 到文件末尾）

4. **粘贴到 SQL Editor** 并点击 **Run**

5. **等待执行完成**（通常 10-30 秒）

6. **查看结果**：
   - ✅ 应看到 "Success. No rows returned"
   - ❌ 如果有错误，查看错误消息

---

#### 选项 B: 使用 Supabase CLI（推荐自动化）

```bash
# 1. 确保已登录并链接项目
supabase login
supabase link --project-ref your-project-ref

# 2. 应用所有未执行的迁移
supabase migration up

# 3. 查看当前迁移状态
supabase migration list
```

**输出示例**:
```
✅ 202606060001_feishu_identity.sql
✅ 202606110002_enterprise_subscription.sql
```

---

### 步骤 3: 验证迁移

#### 3.1 检查表是否创建

在 **SQL Editor** 中执行：

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'loop_designer_%'
ORDER BY table_name;
```

**期望结果**（应返回 8 行）：

| table_name |
|-----------|
| loop_designer_enterprise_members |
| loop_designer_enterprise_settings |
| loop_designer_enterprises |
| loop_designer_invite_codes |
| loop_designer_sessions |
| loop_designer_users |
| loop_designer_audit_logs |
| loop_designer_auth_sessions |

---

#### 3.2 检查新字段

```sql
-- 检查 users 表新字段
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'loop_designer_users'
  AND column_name IN ('email', 'password_hash', 'auth_provider', 'enterprise_id')
ORDER BY ordinal_position;
```

**期望结果**:

| column_name | data_type | is_nullable |
|------------|-----------|-------------|
| email | text | YES |
| password_hash | text | YES |
| auth_provider | text | NO |
| enterprise_id | uuid | YES |

---

#### 3.3 检查 RPC 函数

```sql
SELECT proname, prosrc
FROM pg_proc
WHERE proname IN ('increment_used_seats', 'decrement_used_seats')
  AND pg_function_is_visible(proname);
```

**期望结果**（应返回 2 行）：

| proname | prosrc |
|---------|--------|
| increment_used_seats | (函数实现) |
| decrement_used_seats | (函数实现) |

---

#### 3.4 测试 RPC 函数

```sql
-- 创建测试企业（如果不存在）
INSERT INTO loop_designer_enterprises (
  tenant_key,
  company_name,
  subscription_tier,
  seat_limit,
  is_active
) VALUES (
  'test-tenant',
  '测试企业',
  'free',
  5,
  true
) ON CONFLICT (tenant_key) DO NOTHING;

-- 测试增加席位
SELECT increment_used_seats('your-enterprise-id');

-- 验证
SELECT used_seats FROM loop_designer_enterprises
WHERE id = 'your-enterprise-id';
-- 期望: used_seats = 1

-- 测试减少席位
SELECT decrement_used_seats('your-enterprise-id');

-- 验证
SELECT used_seats FROM loop_designer_enterprises
WHERE id = 'your-enterprise-id';
-- 期望: used_seats = 0
```

---

#### 3.5 检查 RLS 策略

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'loop_designer_%'
ORDER BY tablename;
```

**期望结果**（所有表 `rowsecurity = true`）：

| tablename | rowsecurity |
|-----------|-------------|
| loop_designer_enterprise_members | t |
| loop_designer_enterprise_settings | t |
| loop_designer_enterprises | t |
| loop_designer_invite_codes | t |
| loop_designer_sessions | t |
| loop_designer_users | t |
| loop_designer_audit_logs | t |
| loop_designer_auth_sessions | t |

---

#### 3.6 检查视图

```sql
SELECT table_name
FROM information_schema.views
WHERE table_schema = 'public'
  AND table_name LIKE 'loop_designer_%';
```

**期望结果**：

| table_name |
|-----------|
| enterprise_members_with_users |
| invite_codes_with_details |

---

### 步骤 4: 运行应用测试

```bash
# 1. 重启应用
pm2 restart carbon-silicon-loop-designer

# 2. 运行部署验证
./scripts/verify-deployment.sh

# 3. 测试管理员 API（需要先登录）
curl -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  http://127.0.0.1:3000/loop-designer/api/admin/members
```

---

## 🔄 回滚方案

### 如果迁移失败

#### 方法 A: 使用备份恢复

```bash
# 1. 停止应用
pm2 stop carbon-silicon-loop-designer

# 2. 恢复数据库（在 Supabase SQL Editor 中）
# 执行备份文件中的 SQL

# 3. 重启应用
pm2 restart carbon-silicon-loop-designer
```

#### 方法 B: 手动删除新表

```sql
-- 注意: 这会删除所有新创建的表和数据！

-- 删除视图
DROP VIEW IF EXISTS enterprise_members_with_users CASCADE;
DROP VIEW IF EXISTS invite_codes_with_details CASCADE;

-- 删除 RPC 函数
DROP FUNCTION IF EXISTS increment_used_seats CASCADE;
DROP FUNCTION IF EXISTS decrement_used_seats CASCADE;

-- 删除新表（按依赖顺序）
DROP TABLE IF EXISTS loop_designer_enterprise_settings CASCADE;
DROP TABLE IF EXISTS loop_designer_audit_logs CASCADE;
DROP TABLE IF EXISTS loop_designer_invite_codes CASCADE;
DROP TABLE IF EXISTS loop_designer_enterprise_members CASCADE;
DROP TABLE IF EXISTS loop_designer_enterprises CASCADE;

-- 删除 users 表新字段
ALTER TABLE loop_designer_users
  DROP COLUMN IF EXISTS email CASCADE,
  DROP COLUMN IF EXISTS password_hash CASCADE,
  DROP COLUMN IF EXISTS auth_provider CASCADE,
  DROP COLUMN IF EXISTS enterprise_id CASCADE;
```

**⚠️ 警告**: 回滚将删除所有企业、成员、邀请码、审计日志数据！

---

## 🚀 升级迁移（后续版本）

### 执行新迁移

```bash
# 1. 拉取最新代码
git pull origin main

# 2. 查看新迁移文件
ls supabase/migrations/ | sort

# 3. 备份数据库
supabase db dump --data-only > backup_before_upgrade_$(date +%Y%m%d).sql

# 4. 执行迁移
supabase migration up

# 5. 验证
./scripts/verify-deployment.sh

# 6. 重启应用
pm2 restart carbon-silicon-loop-designer
```

---

## 📊 迁移后验证清单

执行迁移后，确认以下所有项:

### 数据库表验证

- [ ] 8 张表全部创建
- [ ] 新字段添加到 `loop_designer_users`
- [ ] 索引创建成功
- [ ] RLS 策略启用

### 功能验证

- [ ] 应用正常启动
- [ ] 飞书登录正常
- [ ] 邮箱注册正常
- [ ] 管理员后台可访问
- [ ] API 路由正常工作

### 数据完整性

- [ ] 现有用户数据未丢失
- [ ] 现有会话数据未丢失
- [ ] 外键约束正确

---

## 🐛 常见问题

### Q1: 迁移执行失败 - "relation already exists"

**原因**: 表已存在（可能是部分迁移）

**解决方案**:
```sql
-- 检查表是否存在
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'loop_designer_enterprise%';

-- 如果存在，选择：
-- 选项 A: 跳过此迁移（如果表结构已正确）
-- 选项 B: 删除旧表后重新执行（会丢失数据）
DROP TABLE loop_designer_enterprises CASCADE;
-- 然后重新执行迁移
```

---

### Q2: RPC 函数创建失败 - "permission denied"

**原因**: Supabase 默认限制函数创建

**解决方案**:
1. 在 Supabase Dashboard → SQL Editor 中执行
2. 确保使用 **service_role** 密钥（不是 anon 密钥）
3. 检查 RLS 是否影响了系统表

---

### Q3: 应用启动失败 - "column does not exist"

**原因**: 代码期望新字段，但数据库未迁移

**解决方案**:
```bash
# 1. 确认迁移已执行
# 在 SQL Editor 中执行步骤 3.2 的查询

# 2. 如果字段缺失，重新执行迁移
supabase migration up

# 3. 重启应用
pm2 restart carbon-silicon-loop-designer
```

---

### Q4: RLS 策略冲突

**症状**: 查询返回空或权限错误

**排查**:
```sql
-- 查看 RLS 策略
SELECT * FROM pg_policies
WHERE tablename LIKE 'loop_designer_%';

-- 临时禁用 RLS（仅用于调试）
ALTER TABLE loop_designer_enterprises DISABLE ROW LEVEL SECURITY;

-- 测试查询
SELECT * FROM loop_designer_enterprises LIMIT 1;

-- 重新启用
ALTER TABLE loop_designer_enterprises ENABLE ROW LEVEL SECURITY;
```

**注意**: 不要在生产环境长期禁用 RLS！

---

## 📞 需要帮助？

### 获取支持

- 📧 **邮件**: support@csi-org.com
- 💬 **飞书群**: [加入讨论]
- 📖 **文档**: https://docs.csi-org.com/database-migration

### 相关文档

- [部署指南](../DEPLOYMENT.md)
- [商业验证清单](../BUSINESS_VERIFICATION.md)
- [快速参考](../QUICK_REFERENCE.md)

---

**最后更新**: 2026-06-11
**文档版本**: v1.0
**维护者**: 碳硅回路设计师团队
