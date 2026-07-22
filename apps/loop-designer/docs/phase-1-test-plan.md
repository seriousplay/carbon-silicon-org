# Phase 1 测试与验证计划

## 环境准备

### 1. 应用数据库迁移

```bash
# 方法1：通过 Supabase CLI（推荐）
cd apps/loop-designer
supabase migration up

# 方法2：通过 Supabase Dashboard SQL Editor
# 1. 登录 https://supabase.com/dashboard
# 2. 选择项目 → SQL Editor
# 3. 粘贴 supabase/migrations/202606080001_multi_tenant_enterprises.sql
# 4. 点击 "Run"
```

### 2. 验证迁移成功

在 Supabase SQL Editor 中运行：

```sql
-- 检查企业表是否存在
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE '%enterprise%';

-- 检查列是否添加成功
SELECT column_name FROM information_schema.columns
WHERE table_name = 'loop_designer_users' AND column_name = 'enterprise_id';

-- 检查 RPC 函数
SELECT proname FROM pg_proc WHERE proname = 'decrement_used_seats';
```

## 功能测试清单

### ✅ 测试1：现有功能向后兼容

**目标**：确保现有单租户逻辑仍然工作

- [ ] **1.1 用户登录流程**
  - 访问 `http://localhost:3010/loop-designer`
  - 点击飞书登录
  - 完成 OAuth 授权
  - 验证：成功跳转到首页，显示"飞书用户：xxx"
  - 验证：`loop_designer_users` 表有记录
  - 验证：`loop_designer_enterprises` 自动创建企业记录

- [ ] **1.2 创建会话**
  - 点击"开始设计"按钮
  - 填写回路类型和描述
  - 点击"下一步"
  - 验证：`loop_designer_sessions` 插入成功
  - 验证：`enterprise_id` 字段已填写

- [ ] **1.3 完成5步对话**
  - 依次完成5个步骤
  - 验证：数据正确保存
  - 验证：进度指示器正确更新

- [ ] **1.4 生成方案**
  - 点击"生成回路设计"
  - 等待 AI 生成完成
  - 验证：方案成功显示
  - 验证：`outputs.currentPlan` 有值

- [ ] **1.5 导出功能**
  - 测试 Markdown 导出
  - 测试 PDF 导出
  - 测试飞书文档导出
  - 验证：所有导出功能正常

### ✅ 测试2：多租户数据隔离

**目标**：验证不同企业数据完全隔离

- [ ] **2.1 创建第二个企业**
  ```bash
  # 在测试环境使用不同的飞书企业账号登录
  # 或模拟不同的 tenant_key
  ```

- [ ] **2.2 验证企业A看不到企业B的数据**
  ```sql
  -- 在 Supabase SQL Editor 中验证
  SELECT tenant_key, COUNT(*) as user_count
  FROM loop_designer_users
  GROUP BY tenant_key;

  -- 检查会话是否只属于对应企业
  SELECT s.id, s.enterprise_id, u.tenant_key
  FROM loop_designer_sessions s
  JOIN loop_designer_users u ON s.user_id = u.id
  WHERE u.tenant_key = '企业A的tenant_key';
  -- 应该只返回企业A的会话
  ```

- [ ] **2.3 验证强制过滤生效**
  ```typescript
  // 在代码中添加日志验证
  console.log('User enterpriseId:', user.enterpriseId);
  console.log('Session enterpriseId:', session.enterpriseId);
  // 两者应该匹配
  ```

### ✅ 测试3：企业注册流程

**目标**：首次登录自动激活企业

- [ ] **3.1 新企业首次登录**
  - 使用全新的飞书企业账号登录
  - 验证：`loop_designer_enterprises` 自动创建记录
  - 验证：`subscription_tier = 'free'`
  - 验证：`is_trial = true`
  - 验证：`trial_ends_at = 当前时间 + 14天`
  - 验证：用户 `enterprise_id` 自动关联

- [ ] **3.2 老用户再次登录**
  - 已有企业记录的用户登录
  - 验证：不会创建重复企业
  - 验证：企业记录返回现有数据

### ✅ 测试4：企业席位管理

**目标**：席位配额控制

- [ ] **4.1 登录增加席位**
  ```sql
  -- 初始状态
  SELECT used_seats, seat_limit FROM loop_designer_enterprises WHERE tenant_key = 'xxx';
  -- used_seats 应该 +1
  ```

- [ ] **4.2 登出减少席位**
  - 用户点击"退出"
  - 验证：`used_seats` 应该 -1

- [ ] **4.3 超出配额限制**
  ```typescript
  // 在 enterprise.ts 中测试
  const enterprise = { seatLimit: 1, usedSeats: 1, ... };
  checkSeatQuota(enterprise); // 应该返回 false
  ```

### ✅ 测试5：功能权限控制

**目标**：基于订阅层级的权限管理

- [ ] **5.1 Free tier 权限**
  ```typescript
  const enterprise = { subscriptionTier: "free", featureFlags: {}, isTrial: false };
  checkFeatureAccess(enterprise, "basic_design"); // true
  checkFeatureAccess(enterprise, "feishu_export"); // false
  checkFeatureAccess(enterprise, "ai_gpt4"); // false
  ```

- [ ] **5.2 Pro tier 权限**
  ```typescript
  const enterprise = { subscriptionTier: "pro", featureFlags: {}, isTrial: false };
  checkFeatureAccess(enterprise, "feishu_export"); // true
  checkFeatureAccess(enterprise, "ai_gpt4"); // true
  ```

### ✅ 测试6：迁移数据完整性

**目标**：现有数据正确迁移

- [ ] **6.1 验证所有用户都有 enterprise_id**
  ```sql
  SELECT COUNT(*) FROM loop_designer_users WHERE enterprise_id IS NULL;
  -- 应该返回 0
  ```

- [ ] **6.2 验证所有会话都有 enterprise_id**
  ```sql
  SELECT COUNT(*) FROM loop_designer_sessions WHERE enterprise_id IS NULL;
  -- 应该返回 0
  ```

- [ ] **6.3 验证企业数据一致性**
  ```sql
  -- 每个租户_key应该只有一个企业记录
  SELECT tenant_key, COUNT(*)
  FROM loop_designer_enterprises
  GROUP BY tenant_key
  HAVING COUNT(*) > 1;
  -- 应该返回空
  ```

## 性能测试

### 查询性能

```sql
-- 添加索引后的查询性能测试
EXPLAIN ANALYZE
SELECT * FROM loop_designer_sessions
WHERE enterprise_id = 'xxx' AND user_id = 'yyy'
ORDER BY created_at DESC LIMIT 8;

-- 应该使用 idx_sessions_enterprise 索引
```

### 并发测试

```bash
# 使用 Apache Bench 或 similar
ab -n 100 -c 10 http://localhost:3010/loop-designer/api/sessions
```

## 回滚方案

如果测试失败需要回滚：

```sql
-- 1. 删除企业表
DROP TABLE IF EXISTS public.loop_designer_enterprises CASCADE;

-- 2. 删除用户表 enterprise_id 列
ALTER TABLE public.loop_designer_users DROP COLUMN IF EXISTS enterprise_id;

-- 3. 删除会话表 enterprise_id 列
ALTER TABLE public.loop_designer_sessions DROP COLUMN IF EXISTS enterprise_id;

-- 4. 删除 RPC 函数
DROP FUNCTION IF EXISTS public.decrement_used_seats(uuid);
```

## 验收标准

Phase 1 完成标准：

- [x] ✅ 数据库迁移文件创建完成
- [x] ✅ TypeScript 类型更新完成
- [x] ✅ 所有查询强制注入企业隔离
- [x] ✅ 构建成功（`npm run build`）
- [ ] ⏳ 迁移应用到测试环境
- [ ] ⏳ 通过功能测试清单（6大测试类）
- [ ] ⏳ 通过性能测试
- [ ] ⏳ 代码审查
- [ ] ⏳ 文档更新

## 下一步

测试通过后进入 **Phase 2：企业管理员后台**
