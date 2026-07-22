# Phase 1 + Phase 2 数据库迁移验证指南

## ✅ 迁移成功确认

执行完 `combined_phase1_phase2.sql` 后，请按以下步骤验证。

---

## 📋 验证步骤

### 1. 基础验证查询

在 Supabase SQL Editor 中执行：

```sql
-- 检查所有表是否创建成功
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'loop_designer%'
ORDER BY table_name;
```

**期望看到 7 张表**：
```
loop_designer_enterprises
loop_designer_enterprise_members
loop_designer_enterprise_settings
loop_designer_auth_sessions
loop_designer_audit_logs
loop_designer_sessions
loop_designer_users
```

### 2. 检查企业数据

```sql
SELECT
  COUNT(*) as enterprise_count,
  SUM(used_seats) as total_used_seats,
  SUM(seat_limit) as total_seat_limit
FROM public.loop_designer_enterprises;
```

**期望结果**：
- `enterprise_count > 0`（至少1个企业）
- `used_seats >= 0`
- `seat_limit > 0`

### 3. 检查用户数据

```sql
SELECT
  COUNT(*) as total_users,
  COUNT(*) FILTER (WHERE enterprise_id IS NOT NULL) as users_with_enterprise,
  COUNT(*) FILTER (WHERE enterprise_id IS NULL) as users_without_enterprise
FROM public.loop_designer_users;
```

**期望结果**：
- `users_without_enterprise = 0`（所有用户都应该有企业ID）

### 4. 检查成员角色

```sql
SELECT role, COUNT(*) as count
FROM public.loop_designer_enterprise_members
GROUP BY role
ORDER BY role;
```

**期望结果**：
```
role        | count
------------|-------
super_admin | >= 1  ← 至少1个超级管理员
```

### 5. 检查 RPC 函数

```sql
SELECT proname FROM pg_proc
WHERE proname LIKE '%used_seats%'
ORDER BY proname;
```

**期望看到 2 个函数**：
```
increment_used_seats
decrement_used_seats
```

---

## 🧪 高级验证

### 使用验证脚本

我已经创建了完整的验证脚本，包含 12 项检查：

📄 **文件**：`supabase/migrations/verify_migration.sql`

在 Supabase SQL Editor 中执行此脚本，会输出：
1. ✅ 表结构验证（7张表）
2. ✅ 企业数据统计
3. ✅ 用户数据完整性
4. ✅ 会话数据分布
5. ✅ 成员角色分布
6. ✅ 审计日志统计
7. ✅ 企业设置状态
8. ✅ RPC 函数检查
9. ✅ RLS 策略检查
10. ✅ 数据完整性检查
11. ✅ 企业-用户-会话关系验证
12. ✅ 总结报告

### 使用测试数据

如果需要测试多租户功能，可以执行测试数据脚本：

📄 **文件**：`supabase/migrations/seed_test_data.sql`

**测试数据包含**：
- 2个测试企业（test_tenant_a, test_tenant_b）
- 每个企业1个测试用户
- 每个企业1个测试会话
- 测试成员角色
- 测试审计日志
- 测试企业设置

**注意**：测试数据使用 `test_tenant_xxx` 作为租户键，不会影响真实数据。

---

## 🔍 常见问题排查

### 问题1：`relation "public.loop_designer_enterprises" does not exist`

**原因**：Phase 1 迁移未执行

**解决**：重新执行 `combined_phase1_phase2.sql`

### 问题2：`duplicate key value violates unique constraint`

**原因**：某些记录已存在

**解决**：这是正常的，迁移脚本使用了 `ON CONFLICT DO NOTHING`

### 问题3：`foreign key constraint fails`

**原因**：依赖的表不存在或顺序错误

**解决**：
1. 确保基础表存在（`202606060001_feishu_identity.sql`）
2. 按顺序执行迁移

### 问题4：企业数为 0

**原因**：现有用户没有 `tenant_key`

**解决**：
```sql
-- 检查是否有用户
SELECT COUNT(*) FROM public.loop_designer_users;

-- 如果有用户但企业数为0，手动迁移
INSERT INTO public.loop_designer_enterprises (tenant_key, company_name)
SELECT DISTINCT tenant_key, '默认企业'
FROM public.loop_designer_users
WHERE tenant_key IS NOT NULL;
```

---

## 📊 验证清单

执行完验证后，确认以下所有项：

### 数据库表
- [ ] `loop_designer_enterprises` 存在
- [ ] `loop_designer_enterprise_members` 存在
- [ ] `loop_designer_enterprise_settings` 存在
- [ ] `loop_designer_auth_sessions` 存在
- [ ] `loop_designer_audit_logs` 存在
- [ ] `loop_designer_sessions` 存在
- [ ] `loop_designer_users` 存在

### 数据完整性
- [ ] 所有用户都有 `enterprise_id`
- [ ] 所有会话都有 `enterprise_id`
- [ ] 企业数据已自动创建
- [ ] 至少1个超级管理员角色存在
- [ ] RPC 函数已创建

### 索引和约束
- [ ] `idx_users_enterprise` 索引存在
- [ ] `idx_sessions_enterprise` 索引存在
- [ ] `idx_enterprise_members_enterprise` 索引存在
- [ ] `idx_audit_logs_enterprise_created` 索引存在
- [ ] RLS 策略已启用

---

## 🚀 下一步

验证通过后：

1. ✅ **启动本地开发服务器**
   ```bash
   npm run dev
   ```

2. ✅ **测试登录流程**
   - 访问 `http://localhost:3010/loop-designer`
   - 飞书登录
   - 验证企业自动激活

3. ✅ **测试管理员后台**
   - 访问 `http://localhost:3010/loop-designer/admin/enterprise`
   - 查看成员列表
   - 测试订阅管理

4. ✅ **准备 Phase 3**
   - 集成支付API
   - 邮件邀请系统
   - 事件订阅

---

## 📞 需要帮助？

如果遇到问题：
1. 检查 Supabase Logs（Dashboard → Logs）
2. 运行 `verify_migration.sql` 查看详细错误
3. 查看迁移脚本的注释说明
