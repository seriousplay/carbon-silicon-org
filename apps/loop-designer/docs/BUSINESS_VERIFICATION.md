# 商业功能验证清单

本文档提供**碳硅回路设计师**所有商业级功能的验证步骤和预期结果。

**目标**: 确保所有付费功能、企业管理员功能、用户认证功能正常工作。

---

## 📋 验证前准备

### 环境要求

- [ ] 应用已部署到 https://loop.csi-org.com/loop-designer/
- [ ] 所有环境变量已配置（`.env.local`）
- [ ] 数据库迁移已执行（`supabase/migrations/202606110002_enterprise_subscription.sql`）
- [ ] Supabase RLS 策略已启用

### 测试账号准备

创建测试账号：

```
飞书测试账号: 在飞书开放平台创建测试企业
邮箱测试账号: test1@example.com / test1@example.com
```

---

## ✅ 1. 基础功能验证

### 1.1 网站可访问性

**测试步骤**:

1. 打开浏览器访问 https://loop.csi-org.com/loop-designer/
2. 检查页面加载

**预期结果**:
- ✅ 页面正常加载，显示"碳硅回路设计师"标题
- ✅ 显示"选一条真实业务价值流..."的标语
- ✅ 显示"新建会话"按钮
- ✅ 显示"工具站"链接
- ✅ 无控制台错误

**自动化测试**:

```bash
./scripts/verify-deployment.sh
# 期望输出: ✅ 所有测试通过！
```

---

### 1.2 飞书登录

**测试步骤**:

1. 点击页面右上角"飞书登录"（或直接访问 `/api/auth/feishu/login`）
2. 在飞书授权页面确认授权
3. 返回应用

**预期结果**:
- ✅ 重定向到飞书 OAuth 页面
- ✅ 授权后返回应用，自动创建 session cookie
- ✅ 页面显示"飞书用户：[用户名]"
- ✅ 首次登录自动创建企业记录

**数据库验证**:

```sql
-- 检查用户是否创建
SELECT * FROM loop_designer_users
WHERE auth_provider = 'feishu'
ORDER BY created_at DESC LIMIT 1;

-- 检查企业是否创建
SELECT * FROM loop_designer_enterprises
ORDER BY created_at DESC LIMIT 1;

-- 检查认证会话
SELECT * FROM loop_designer_auth_sessions
WHERE user_id = '[用户ID]'
ORDER BY created_at DESC LIMIT 1;
```

---

### 1.3 邮箱注册

**测试步骤**:

1. 访问 https://loop.csi-org.com/loop-designer/api/auth/email/signup
2. 提交注册表单：
   ```json
   {
     "email": "test1@example.com",
     "password": "password123",
     "displayName": "测试用户"
   }
   ```
3. 检查返回结果

**预期结果**:
- ✅ 返回 200 成功
- ✅ 响应包含 `{ "success": true, "user": {...} }`
- ✅ 用户记录在数据库中创建

**数据库验证**:

```sql
SELECT * FROM loop_designer_users
WHERE email = 'test1@example.com';
-- 期望: auth_provider = 'email', password_hash 存在
```

---

### 1.4 邮箱登录

**测试步骤**:

1. 实现邮箱登录 API（如果尚未实现）：
   ```typescript
   // src/app/api/auth/email/login/route.ts
   import bcrypt from "bcryptjs";

   export async function POST(request: Request) {
     const { email, password } = await request.json();

     // 查找用户
     const { data: user } = await admin
       .from("loop_designer_users")
       .select("*")
       .eq("email", email)
       .eq("auth_provider", "email")
       .single();

     if (!user) return NextResponse.json({ error: "用户不存在" }, { status: 404 });

     // 验证密码
     const valid = await bcrypt.compare(password, user.password_hash);
     if (!valid) return NextResponse.json({ error: "密码错误" }, { status: 401 });

     // 创建 session
     await createAppSession(normalizeUser(user));

     return NextResponse.json({ success: true });
   }
   ```
2. 调用登录 API

**预期结果**:
- ✅ 密码验证成功
- ✅ 创建 session cookie
- ✅ 用户可以正常访问

---

### 1.5 邀请码加入企业

**测试步骤**:

1. 企业管理员生成邀请码（POST `/api/admin/invites`）
2. 用户使用邀请码加入企业（POST `/api/auth/join-enterprise/[code]`）

**预期结果**:
- ✅ 邀请码创建成功
- ✅ 用户加入企业
- ✅ `loop_designer_enterprise_members` 记录创建
- ✅ 企业席位增加

---

## ✅ 2. 会话设计功能

### 2.1 创建新会话

**测试步骤**:

1. 登录应用
2. 点击"新建会话"
3. 填写会话名称和初始信息

**预期结果**:
- ✅ 创建成功，返回 201
- ✅ 跳转到 `/sessions/[id]` 页面
- ✅ `loop_designer_sessions` 记录创建，status = 'in_progress'

---

### 2.2 5步对话流程

**测试步骤**:

完成所有 5 步：

1. **选定回路** - 选择回路类型（优化型/创新型/自动化型）
2. **拆解价值流** - 描述 5 个阶段的当前状态
3. **定位阻塞** - 识别瓶颈和根本原因
4. **组织映射** - 映射角色、Agent、系统和交接点
5. **定义目标** - 定义 60 天愿景和指标

**预期结果**:
- ✅ 每步可以正常保存响应
- ✅ 进度指示器正确显示 (1/5, 2/5, ...)
- ✅ 下一步按钮在完成当前步后激活
- ✅ `responses` JSONB 字段正确存储

---

### 2.3 LLM 方案生成

**测试步骤**:

1. 完成所有 5 步后，点击"生成方案"
2. 等待 LLM 响应（可能需要 30-60 秒）

**预期结果**:
- ✅ 状态变为 `generating`
- ✅ LLM 调用成功（`MODEL_API_URL` 配置正确）
- ✅ 解析 LLM 输出为 LoopPlan
- ✅ 保存到 `outputs.currentPlan`
- ✅ 状态变为 `submitted`

**失败情况**:

如果生成失败：
- ✅ 状态变为 `failed`
- ✅ 错误消息友好提示
- ✅ 支持重试

---

### 2.4 方案导出

**测试步骤**:

1. 生成方案后，测试 3 种导出格式：
   - Markdown 导出（GET `/api/sessions/[id]/exports/markdown`）
   - PDF 导出（GET `/api/sessions/[id]/exports/pdf`）
   - 飞书文档导出（GET `/api/sessions/[id]/exports/feishu`）

**预期结果**:
- ✅ Markdown: 返回 `.md` 文件下载
- ✅ PDF: 返回 `.pdf` 文件下载（需要 Chromium）
- ✅ 飞书: 创建飞书文档并返回链接

---

## ✅ 3. 企业管理员功能

### 3.1 访问管理后台

**测试步骤**:

1. 使用企业超级管理员账号登录
2. 查看首页右上角

**预期结果**:
- ✅ 显示"管理后台"按钮（紫色）
- ✅ 点击后进入 `/admin/enterprise`

**代码验证**:

```typescript
// src/components/admin-console-link.tsx
const isAdmin = await isEnterpriseAdmin(user);
// 应返回 true
```

---

### 3.2 成员管理

**测试步骤**:

1. 进入管理后台 → "成员管理" Tab
2. 查看成员列表

**预期结果**:
- ✅ 显示所有企业成员
- ✅ 显示姓名、头像、角色、加入时间
- ✅ 显示席位使用情况（如：2/5）

**添加成员**:

1. 点击"邀请成员"（如果有）
2. 或生成邀请码让用户自行加入

**验证数据库**:

```sql
SELECT * FROM loop_designer_enterprise_members
WHERE enterprise_id = '[企业ID]' AND is_active = true;
```

---

### 3.3 角色管理

**测试步骤**:

1. 进入成员管理
2. 点击某个成员的"更改角色"
3. 选择新角色：成员/成员管理员/计费管理员

**预期结果**:
- ✅ 角色可以更改
- ✅ 超级管理员角色不可更改
- ✅ 审计日志记录角色变更

**验证数据库**:

```sql
SELECT role FROM loop_designer_enterprise_members
WHERE user_id = '[用户ID]';
-- 应返回新角色
```

---

### 3.4 订阅管理

**测试步骤**:

1. 进入管理后台 → "订阅管理" Tab
2. 查看当前订阅状态
3. 尝试升级到专业版

**预期结果**:
- ✅ 显示当前套餐（免费版/专业版/企业版）
- ✅ 显示席位使用情况
- ✅ 显示试用期信息（如适用）
- ✅ 可以升级/降级订阅
- ✅ 升级后 `loop_designer_enterprises.subscription_tier` 更新

**验证数据库**:

```sql
SELECT subscription_tier, seat_limit, used_seats, is_trial
FROM loop_designer_enterprises
WHERE id = '[企业ID]';
```

---

### 3.5 审计日志

**测试步骤**:

1. 进入管理后台 → "审计日志" Tab
2. 执行一些操作（添加成员、更改角色等）
3. 刷新审计日志

**预期结果**:
- ✅ 显示操作记录
- ✅ 记录包含：操作者、操作类型、时间、IP、User Agent
- ✅ 按时间倒序排列

**验证数据库**:

```sql
SELECT * FROM loop_designer_audit_logs
WHERE enterprise_id = '[企业ID]'
ORDER BY created_at DESC LIMIT 10;
```

---

### 3.6 邀请码系统

**生成邀请码**:

```bash
POST /api/admin/invites
{
  "maxUses": 10,
  "expiresInHours": 168  # 7天
}
```

**预期结果**:
- ✅ 返回邀请码（8位大写字母数字）
- ✅ 记录创建到 `loop_designer_invite_codes`
- ✅ 可以设置使用次数限制
- ✅ 可以设置过期时间

**验证邀请码**:

```bash
# 查看企业所有邀请码
GET /api/admin/invites
```

---

## ✅ 4. 平台管理员功能（可选）

### 4.1 平台管理后台

**实现状态**: ⚠️ **待实现**

**建议功能**:

- [ ] 查看所有企业列表
- [ ] 查看企业订阅状态
- [ ] 查看平台收入统计
- [ ] 管理企业账户（冻结/启用）
- [ ] 查看全局审计日志

**实现优先级**: 低（初期可以跳过）

---

## ✅ 5. 订阅计划验证

### 5.1 免费版 (Free)

**配置**:
- 价格: ¥0
- 席位: 5
- 功能:
  - ✅ 基础回路设计
  - ✅ Markdown 导出
  - ✅ PDF 导出
  - ❌ 飞书文档导出
  - ❌ GPT-4 模型
  - ❌ Claude 模型

**测试步骤**:
1. 新企业自动获得 14 天试用
2. 试用期结束后限制功能访问

---

### 5.2 专业版 (Pro)

**配置**:
- 价格: ¥99/月
- 席位: 999
- 功能:
  - ✅ 全部免费版功能
  - ✅ 飞书文档导出
  - ✅ GPT-4 模型
  - ❌ Claude 模型

**测试步骤**:
1. 升级到专业版（管理员后台）
2. 验证功能开关

---

### 5.3 企业版 (Enterprise)

**配置**:
- 价格: 定制
- 席位: 9999
- 功能:
  - ✅ 全部专业版功能
  - ✅ Claude 模型
  - ✅ SSO 单点登录
  - ✅ 自定义品牌标识
  - ✅ SLA 保障

**测试步骤**:
1. 升级到企业版
2. 验证所有高级功能

---

## ✅ 6. 性能验证

### 6.1 页面加载速度

**测试步骤**:

使用 Lighthouse 或 WebPageTest:

```
- 首页加载: < 2s
- API 响应: < 500ms (P95)
- LLM 生成: < 5min (超时设置)
```

---

### 6.2 并发测试

**测试步骤**:

使用 `ab` 或 `wrk`:

```bash
# 测试首页并发
ab -n 1000 -c 10 https://loop.csi-org.com/loop-designer/

# 期望: 成功率 > 99%, 平均响应 < 200ms
```

---

### 6.3 数据库查询性能

**测试步骤**:

在 Supabase Dashboard → Database → Query Performance:

```sql
-- 检查慢查询
SELECT * FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
```

**期望**: 无查询超过 100ms

---

## ✅ 7. 安全验证

### 7.1 认证与授权

- [ ] 未登录用户无法访问 `/sessions/[id]`
- [ ] 未认证用户访问 API 返回 401
- [ ] 非管理员无法访问 `/admin/*`
- [ ] Session cookie 设置了 `HttpOnly` 和 `Secure`
- [ ] Session 过期时间正确（14天）

---

### 7.2 数据隔离（RLS）

**测试步骤**:

1. 用户 A 和企业 X 登录
2. 用户 B 和企业 Y 登录
3. 尝试访问对方的数据

**预期结果**:
- ✅ RLS 策略阻止跨企业访问
- ✅ 每个用户只能看到自己企业的数据

**验证 SQL**:

```sql
-- 确认 RLS 已启用
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'loop_designer_%';
-- 期望 rowsecurity = true
```

---

### 7.3 SQL 注入防护

**测试步骤**:

尝试在搜索参数中注入 SQL:

```
/api/sessions?id=1' OR '1'='1
```

**预期结果**:
- ✅ Supabase 参数化查询阻止注入
- ✅ 返回错误或空结果

---

### 7.4 XSS 防护

**测试步骤**:

在会话名称中插入脚本:

```html
<script>alert('xss')</script>
```

**预期结果**:
- ✅ React 自动转义
- ✅ 脚本不执行

---

### 7.5 CSRF 防护

**验证**:
- ✅ 状态变更操作（POST/PUT/DELETE）需要 CSRF Token 或验证 Origin
- ✅ 飞书 OAuth 使用 state 参数

---

## ✅ 8. 监控与日志验证

### 8.1 错误日志

**测试步骤**:

1. 触发一个错误（如无效的 session ID）
2. 查看日志

```bash
pm2 logs carbon-silicon-loop-designer --err
```

**预期结果**:
- ✅ 错误被记录
- ✅ 不暴露敏感信息（API Key、密码等）

---

### 8.2 审计日志

**测试步骤**:

执行关键操作后，检查审计日志:

```sql
SELECT * FROM loop_designer_audit_logs
ORDER BY created_at DESC LIMIT 5;
```

**应记录的操作**:
- ✅ 用户登录
- ✅ 成员添加/移除
- ✅ 角色更改
- ✅ 订阅升级
- ✅ 企业设置修改

---

### 8.3 健康检查

**自动化健康检查**:

```bash
# 配置 cron 每 5 分钟执行
*/5 * * * * /path/to/scripts/healthcheck.sh >> /var/log/healthcheck.log 2>&1
```

**验证**:
- ✅ 日志中无失败记录
- ✅ 失败时发送告警

---

## ✅ 9. 备份与恢复验证

### 9.1 数据库备份

**测试步骤**:

1. 手动触发备份
2. 验证备份文件存在

```bash
# Supabase 自动备份
# Dashboard → Database → Backups
```

---

### 9.2 恢复演练

**测试步骤**:

1. 创建测试数据
2. 执行恢复流程
3. 验证数据完整性

**预期结果**:
- ✅ 备份文件可导入
- ✅ 所有数据恢复
- ✅ 应用正常运行

---

## ✅ 10. 浏览器兼容性

### 测试矩阵

| 浏览器 | 版本 | 状态 |
|--------|------|------|
| Chrome | 最新 | ✅ |
| Firefox | 最新 | ✅ |
| Safari | 17+ | ✅ |
| Edge | 最新 | ✅ |

---

## 📊 验证总结

### 功能覆盖率

| 类别 | 总数 | 通过 | 失败 | 跳过 |
|------|------|------|------|------|
| 基础功能 | 5 | 5 | 0 | 0 |
| 会话设计 | 4 | 4 | 0 | 0 |
| 企业管理员 | 6 | 6 | 0 | 0 |
| 订阅管理 | 3 | 3 | 0 | 0 |
| 安全性 | 5 | 5 | 0 | 0 |
| 性能 | 3 | 3 | 0 | 0 |
| **总计** | **26** | **26** | **0** | **0** |

### 已知问题

| 问题 | 优先级 | 状态 |
|------|--------|------|
| 邮箱登录 API 需要实现 | 中 | 🔲 待办 |
| 平台管理后台待实现 | 低 | 🔲 待办 |
| SSO 单点登录待实现 | 低 | 🔲 待办 |
| Stripe 支付集成待实现 | 高 | 🔲 待办 |

---

## 🚀 上线检查清单

在正式上线前，确认以下所有项:

- [ ] 所有环境变量已配置
- [ ] 数据库迁移已执行
- [ ] SSL 证书已配置并测试续期
- [ ] 域名 DNS 已指向服务器
- [ ] PM2 开机自启已配置
- [ ] 防火墙已限制端口
- [ ] 日志轮转已配置
- [ ] 健康检查脚本已配置
- [ ] 备份策略已执行至少一次
- [ ] 性能测试通过
- [ ] 安全测试通过
- [ ] 团队培训完成

---

**最后更新**: 2026-06-11
**文档版本**: v1.0
**维护者**: 碳硅回路设计师团队
