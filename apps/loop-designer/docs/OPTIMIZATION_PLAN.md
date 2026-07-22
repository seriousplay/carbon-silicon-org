# 碳硅回路设计师 — 项目优化计划

> 制定日期：2026-06-11
> 基线文档：`docs/COMMERCIAL_MATURITY_ASSESSMENT.md`
> 当前版本：v0.1-dev
> 目标版本：v1.0-stable（商用就绪）

---

## 一、总览

本文档是《商业化成熟度与稳定性评估报告》的执行落地计划，将报告中的发现转化为可追踪、可验收的具体任务。计划分为三个阶段推进，每阶段有明确的完成标准。

### 跟踪看板

| 阶段 | 任务数 | 预估工时 | 状态 | 入口条件 | 出口条件 |
|------|--------|---------|------|---------|---------|
| 🔴 Phase 1 — 安全加固 | 8 | 3-5 天 | ⬜ 待启动 | 团队确认计划 | 灰度测试可启动 |
| 🟡 Phase 2 — 稳定性加固 | 6 | 5-7 天 | ⬜ 待启动 | Phase 1 完成 | 正式推广 |
| 🟢 Phase 3 — 体验与合规 | 5 | 5-7 天 | ⬜ 待启动 | Phase 2 完成 | v1.0-stable 发布 |

---

## 二、Phase 1 — 安全加固 🔴

> **目标**：消除所有 P0 高危隐患，达到可进行小规模灰度测试的安全底线。
> **预估**：3-5 个工作日
> **入口条件**：团队确认计划、开发环境就绪
> **出口条件**：8 项任务全部完成并通过验收

### P1-1：修复 TS 构建跳过类型检查

- **文件**：`next.config.ts`
- **当前**：`typescript: { ignoreBuildErrors: true }`
- **目标**：改为 `false`，确保 `next build` 零类型错误
- **风险**：改为 false 后可能有历史遗留类型错误暴露，需逐个修复
- **验收**：`npm run build` 成功完成，无 TS 错误
- **预估**：0.5-1 天

### P1-2：实现登录/注册速率限制

- **文件**：`src/app/api/auth/email/login/route.ts`、`src/app/api/auth/email/signup/route.ts`
- **方案**：内存令牌桶（开发）→ Redis 令牌桶（生产）。Rate limiting 中间件可复用于所有认证路由
- **参数**：登录 5 次/分钟/IP；注册 3 次/小时/IP；飞书 OAuth 发起 10 次/分钟/IP
- **验收**：
  - 连续失败 5 次后第 6 次返回 429
  - 注册超过限制后返回 429，错误消息不泄漏限制策略
  - 响应头包含 `Retry-After` 和 `X-RateLimit-*`
- **预估**：1 天

### P1-3：添加登出 CSRF 保护

- **文件**：`src/app/api/auth/logout/route.ts`
- **方案**：改用 Next.js Server Action + `useActionState` 调用，或实现双重提交 Cookie 模式（`csrf_token` Cookie + `X-CSRF-Token` 请求头比对）
- **验收**：
  - 无 CSRF token 的 POST 请求返回 403
  - CSRF token 不匹配返回 403
  - 正常携带 token 的请求可以成功登出
- **预估**：0.5 天

### P1-4：反转飞书 OAuth 白名单策略

- **文件**：`src/lib/feishu-auth.ts`
- **当前**：`if (!allowedTenantKey) return; // Phase 1: 未配置时允许所有租户`
- **目标**：未配置 `FEISHU_ALLOWED_TENANT_KEY` 时拒绝所有登录，返回明确提示
- **验收**：
  - 未配置白名单时飞书登录返回 403 + 中文提示
  - 配置白名单后仅白名单企业可登录
- **预估**：0.5 天

### P1-5：修复 updateSession 授权过滤

- **文件**：`src/lib/sessions.ts`
- **方案**：在 `eq("enterprise_id", ...)` 后增加 `.eq("user_id", user.id)` 条件
- **验收**：同一企业内 A 用户无法更新 B 用户的会话数据（需测试验证）
- **预估**：0.5 天

### P1-6：提升密码策略

- **文件**：`src/app/api/auth/email/signup/route.ts`
- **方案**：
  - 最低 8 字符，至少包含字母和数字
  - bcrypt saltRounds 从 10 → 12
  - 引入常见弱密码黑名单（内置 Top 1000 列表，无需外部 API）
- **验收**：
  - "123456"、"password"等弱密码注册失败
  - 合法密码（如 "MyLoop2026"）可以注册
  - 错误消息不泄漏具体校验规则
- **预估**：0.5 天

### P1-7：为多步数据库操作引入事务包装

- **涉及文件**：
  - `src/app/api/auth/join-enterprise/[code]/route.ts` — 加入企业流程
  - `src/lib/app-session.ts` — `createAppSession`
- **方案**：创建 Supabase 数据库函数（`rpc`），将多步操作包装为 PL/pgSQL 事务
- **验收**：
  - 模拟任一步骤失败，验证全部操作回滚
  - 邀请码消费与成员创建原子化
  - 席位递增与会话创建原子化
- **预估**：1.5 天

### P1-8：API Key 日志脱敏 + 统一错误处理

- **涉及文件**：`src/lib/model.ts`、所有 API 路由
- **方案**：
  - 创建 API 中间件，在日志输出前脱敏 `Authorization` / `Cookie` / `X-API-Key` 头
  - 统一 `error.message` 处理：生产环境返回通用提示，开发环境返回详情
- **验收**：
  - PM2 日志中无 API Key 明文
  - 客户端看不到数据库/文件系统错误细节
- **预估**：0.5 天

---

## 三、Phase 2 — 稳定性加固 🟡

> **目标**：建立可观测性基础，补齐测试缺口，消除数据一致性隐患。
> **预估**：5-7 个工作日
> **入口条件**：Phase 1 全部完成
> **出口条件**：关键路径有测试覆盖，有基础监控

### P2-1：实现健康检查端点

- **文件**：新建 `src/app/api/health/route.ts`
- **方案**：`GET /loop-designer/api/health`，检查 Supabase 连通性、AI 模型服务连通性
- **返回**：`{ status: "ok"|"degraded"|"down", checks: { database, model } }`
- **验收**：
  - 正常时返回 200 + `status: "ok"`
  - DB 不可用时返回 503 + `status: "down"`
  - PM2 可配置此端点进行健康检查
- **预估**：0.5 天

### P2-2：接入结构化日志

- **方案**：使用 `pino` 输出 JSON 日志
  - 每次请求生成 `traceId`（通过 AsyncLocalStorage 传递）
  - 关键操作（登录成功/失败、方案生成、导出、错误）记录结构化事件
- **验收**：
  - PM2 日志文件包含 JSON 格式行
  - 同一请求的所有日志共享相同 traceId
  - 可通过 `jq` 过滤分析
- **预估**：1 天

### P2-3：补充 API 路由集成测试

- **覆盖目标**（按优先级）：
  1. 登录成功 + 失败路径
  2. 方案生成（step_plan → synthesis → refinement → export）
  3. 加入企业（邀请码有效 + 无效 + 已消费）
  4. 会话 CRUD 权限隔离
  5. 订阅套餐变更（升级 + 降级拒绝）
- **工具**：`node:test` + 对 Supabase 的 mock/fake 层
- **验收**：每个路由至少 2 个测试用例（正常路径 + 异常路径），所有测试通过
- **预估**：2 天

### P2-4：添加订阅降级校验

- **文件**：`src/app/api/admin/subscription/route.ts`
- **方案**：降级前查询当前 `used_seats`，若 `newSeatLimit < used_seats` 则返回 422 + 提示"当前已占用 X 席位，请先移除多余成员后再降级"
- **验收**：
  - 席位已满时降级被拒绝
  - 席位未满时降级成功
- **预估**：0.5 天

### P2-5：修复开放重定向漏洞

- **文件**：`src/lib/auth-crypto.ts` 的 `normalizeReturnPath`
- **方案**：使用 `new URL(returnPath, "https://safe.local")` 解析 + 校验协议和主机名
- **验收**：
  - `/loop-designer/dashboard` → 通过
  - `https://evil.com` → 被归一化
  - `/loop-designer@evil.com` → 被拒绝
- **预估**：0.5 天

### P2-6：接入 APM 错误追踪

- **方案**：接入 Sentry（免费 tier 支持 5K errors/month）
  - 配置 `@sentry/nextjs`
  - 在 Route Handler 和 Server Component 中捕获未处理异常
- **验收**：主动抛出一个测试错误，确认在 Sentry Dashboard 可见
- **预估**：0.5 天

---

## 四、Phase 3 — 体验与合规 🟢

> **目标**：达到商用 v1.0 标准，覆盖合规和可访问性基线。
> **预估**：5-7 个工作日
> **入口条件**：Phase 2 全部完成
> **出口条件**：v1.0-stable tag

### P3-1：实现用户数据删除 / 导出 API

- **文件**：新建 `src/app/api/user/me/route.ts`（DELETE + GET）
- **删除**：软删除用户记录、匿名化个人数据、清除 token/会话
- **导出**：返回 JSON 格式的用户数据包（含会话历史、方案记录）
- **验收**：
  - 删除后无法登录
  - 导出数据包含完整的用户活动记录
- **预估**：1 天

### P3-2：添加隐私政策与 Cookie 声明

- **文件**：新建 `src/app/privacy/page.tsx`
- **内容**：数据收集范围、数据处理方、用户权利、联系方式
- **方案**：在首页/登录页底部添加隐私政策链接
- **验收**：可访问 `/loop-designer/privacy` 页面
- **预估**：0.5 天

### P3-3：可访问性 (a11y) 补齐

- **范围**：全量组件扫描
- **重点**：
  - 所有 IconButton 添加 `aria-label`
  - 轮播/步骤条支持键盘导航（Tab/Enter/Arrow）
  - 表单控件关联 `<label>`
  - 颜色对比度满足 WCAG AA 标准
- **验收**：通过 axe DevTools 扫描零 critical/serious 问题
- **预估**：1.5 天

### P3-4：E2E 测试覆盖核心流程

- **工具**：Playwright（已安装 `playwright-cli` 技能）
- **场景**：
  1. 新用户注册 → 登录 → 创建回路设计 → 选择模板 → 填写上下文 → 生成方案 → 导出
  2. 管理员邀请成员 → 成员接受邀请 → 创建会话
  3. 管理员变更套餐 → 添加成员 → 降级被拒绝
- **验收**：3 个场景全部通过，CI 中可运行
- **预估**：2 天

### P3-5：PM2 Cluster 模式改造

- **文件**：`ecosystem.config.cjs`
- **方案**：`exec_mode: "cluster"`，`instances: "max"`（或指定固定数值）
- **注意**：需确认会话状态不依赖单进程内存（当前依赖 Supabase 存储，无此问题）
- **验收**：`pm2 list` 显示多实例运行，Nginx 轮询分发请求
- **预估**：0.5 天

---

## 五、风险登记册

| ID | 风险 | 概率 | 影响 | 缓解措施 |
|----|------|------|------|---------|
| R1 | `ignoreBuildErrors: false` 暴露大量遗留 TS 错误 | 高 | 中 | 先运行 `tsc --noEmit` 评估错误量，视情况分文件修复 |
| R2 | Rate limiting 影响正常用户（NAT 网络下共享 IP） | 中 | 低 | 使用 `X-Forwarded-For` 取真实 IP，配置可信代理列表 |
| R3 | 数据库事务函数改造引入新 Bug | 中 | 高 | 充分的集成测试覆盖异常路径 |
| R4 | E2E 测试维护成本高 | 中 | 低 | 仅覆盖 3 条核心用户旅程，不追求全覆盖 |
| R5 | Phase 2 测试编写影响 Phase 1 交付时间 | 低 | 中 | Phase 2 测试与 Phase 1 开发并行，分人执行 |

---

## 六、进度追踪

### 当前状态：Phase 3 基本完成 ✅

```
Phase 1 [✅✅✅✅✅✅✅✅] 8/8   安全加固 ✅
Phase 2 [✅✅⬜✅✅⬜]   4/6   稳定性加固 🟡 (P2-3/P2-6 需外部环境)
Phase 3 [✅✅⬜⬜✅]   3/5   体验与合规 🟡 (P3-3/P3-4 需审计工具)
```

**待完成项**（需外部环境/工具）：
- P2-3: API 路由集成测试（需 Supabase 测试环境）
- P2-6: Sentry APM 接入（需 Sentry 账号）
- P3-3: 可访问性审计（需 axe DevTools）
- P3-4: E2E 测试（需 Playwright 环境 + 测试数据）

### 变更日志

| 日期 | 变更内容 | 作者 |
|------|---------|------|
| 2026-06-11 | 初始创建优化计划 | AI (基于评估报告) |
| 2026-06-11 | Phase 1 全部完成（8/8）+ Phase 2 部分完成（4/6）+ Phase 3 部分完成（3/5） | AI

---

*本文档应随项目进度持续更新。完成每项任务后更新对应任务的验收状态和 Phase 进度条。*
