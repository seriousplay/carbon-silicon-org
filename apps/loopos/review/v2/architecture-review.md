# 回路OS V2 · 全栈架构审查报告

> **审查日期**：2026-07-08  
> **审查对象**：V2 全栈应用（V1 + Sprint 1/2/3 三个迭代）  
> **审查方法**：逐模块深度代码审查 + V1 P0/P1 修正追踪  
> **审查范围**：AI 集成工程、权限系统、通知系统、数据模型变化、组织初始化、Worker/定时任务、测试覆盖

---

## 一、执行摘要

回路OS V2 在三个 Sprint 中完成了 V1 审查指出的 4 个 P0 问题中的 3 个实质性修复，并引入了组织治理的核心差异化能力——AI 张力翻译、会议守护者、治理日志起草。**权限系统从零到三层模型，通知系统从死表到站内+邮件双渠道，定时任务从空函数到独立 worker 进程。代码库从 V1 的"能够 CRUD 的骨架"演进为"具备自动感知能力的半自动治理系统"**。

但三个 Sprint 中也引入了新的工程质量问题：AI 集成对 StepFun 推理模型做了硬编码绕过而非 SDK 适配、权限校验覆盖率仅约 30%、测试覆盖单薄仅 1 个模块有测试、并发安全（乐观锁）仍未实现。

**V2 综合评分：7.35 / 10**（V1 为 6.27，提升 1.08 分）。主要失分在测试覆盖、AI provider 工程的脆性边角、以及权限校验不全。

### 评分总览

| 审查维度 | V2 评分 | V1 评分 | 变化 | 权重 | 加权 |
|---------|---------|---------|------|------|------|
| AI 集成工程质量 | 7.0 / 10 | 4.0 | +3.0 | 25% | 1.75 |
| 权限系统 | 7.5 / 10 | 2.0 | +5.5 | 15% | 1.13 |
| 通知系统 | 8.0 / 10 | 0.0 | +8.0 | 15% | 1.20 |
| 数据模型变化 | 8.0 / 10 | 7.5 | +0.5 | 15% | 1.20 |
| 组织初始化 | 8.0 / 10 | — | 新增 | 10% | 0.80 |
| Worker/定时任务 | 7.5 / 10 | 0.0 | +7.5 | 10% | 0.75 |
| 测试覆盖 | 3.0 / 10 | 1.5 | +1.5 | 5% | 0.15 |
| Server Actions 安全 | 7.0 / 10 | 5.5 | +1.5 | 5% | 0.35 |
| **综合** | — | — | — | — | **7.35** |

---

## 二、AI 集成工程质量审查（分 4 子模块）

### 2.1 AI Provider 抽象层（`src/lib/ai/provider.ts`）

**评分：7.0 / 10**

#### 设计分析

`provider.ts` 提供了统一抽象：`getModel()` 返回 AI SDK 的 LanguageModel（OpenAI/Anthropic），`askAI()` 封装同步调用并分流 StepFun 走原始 fetch。支持三个 provider：`openai`、`anthropic`、`stepfun`，通过 `AI_PROVIDER` 环境变量切换。

#### ✅ 做得好的地方

1. **单例缓存**：`getModel()` 使用模块级 `cachedModel` 变量避免重复初始化，合理。
2. **阶梯式降级**：`isAIAvailable()` 检查任一 API Key 存在即返回 true，调用方按 `askAI` → 返回 null → 前端展示降级 UI 的链路工作。
3. **流式预留**：`streamAI()` 已声明但使用动态 import 避免未使用时的 bundle 膨胀——这是 Next.js 16 中避免 Edge 问题的正确实践。
4. **温度等参数可配置**：`askAI` 接受 `temperature` 和 `maxTokens`，各调用模块可根据场景定制。

#### ⚠️ 问题与风险

| 问题 | 严重度 | 详情 |
|------|--------|------|
| **StepFun 硬编码绕过 AI SDK** | P1 | `callStepFun` 使用原始 `fetch` 而非 AI SDK。注释说是因为"推理模型的 `reasoning_content` 字段解析有兼容问题"。这意味着：① 无法享 AI SDK 的重试/错误分类；② 无法走 `streamAI` 的流式路径；③ 如果 StepFun 的模型返回格式变化，需要手动跟进。正确做法应是向 AI SDK 提供自定义 `fetch` 或 middleware 来过滤 `reasoning_content`。 |
| **模型实例化耦合** | P2 | `getModel()` 中 `ANTHROPIC_API_KEY` 和 `OPENAI_API_KEY` 的环境变量检查硬编码。添加新 provider（如 Google Gemini）需要修改 `getModel()` 内部逻辑，而非注册新 adapter。 |
| **无超时控制** | P2 | `askAI` 使用 AI SDK 的 `generateText` 和原生 `fetch`，均无 timeout 设置。若 AI API 无响应，调用方会无限等待（最多到 Server Action 的 Vercel 函数超时 60s）。Node.js 的 `AbortController` 未被使用。 |
| **`stepfun` provider 不支持 streamAI** | P2 | `streamAI` 只使用 `getModel()`，不走 `callStepFun`，因此在 stepfun provider 下调用 `streamAI` 会抛错（因为 `getModel()` 走的是 OpenAI 逻辑）。 |

#### 建议修正

```typescript
// 方案 A：给 askAI 加超时
const controller = new AbortController();
setTimeout(() => controller.abort(), 30000);

// 方案 B：为 stepfun 提供 AI SDK 兼容层
// 使用 createOpenAI 的自定义 baseURL + fetch 中间件过滤 reasoning_content
```

### 2.2 AI 张力翻译（`src/lib/ai/tension-translator.ts`）

**评分：8.0 / 10**

#### ✅ 设计质量

1. **Prompt 设计合理**：系统提示清晰说明了三种张力类型（问题性/建设性/澄清性），要求返回 JSON，并显式要求"只返回 JSON，不要其他文字"——减少了输出解析的复杂度。
2. **容错解析**：`result.replace(/```json\n?/g, "")` 正确处理了 AI 可能返回 markdown 包裹的 JSON 格式。
3. **降级策略正确**：AI 不可用时返回 `null`，调用方 `translateTensionAction` 返回明确的 `warning` 指引用户手动填写。
4. **"草稿"哲学一致**：翻译结果标注为"草稿"，需用户确认后才写入 `aiTranslation` 字段——这符合 docs/06 的"AI 不做决策者"原则。

#### ⚠️ 问题

| 问题 | 严重度 | 详情 |
|------|--------|------|
| **JSON 解析容错单一** | P2 | 仅处理了 markdown 代码块包裹，未处理尾逗号（`"suggestedCircles": ["数据"],`）、单引号等问题。实际 AI 返回的 JSON 经常有这些"小问题"。建议用类似 `jsonrepair` 或重试机制。 |
| **无准确率追踪** | P3 | docs/06 要求准确率 ≥85%，但当前无任何 metrics 收集——哪些翻译被用户接受、哪些被大幅修改、哪些导致调用失败——完全不可知。 |

### 2.3 会议助手（`src/lib/ai/meeting-assistant.ts`）

**评分：7.5 / 10**

#### ✅ 设计亮点

1. **议程生成的数据收集很全面**：查询未闭环张力（含负责人、回路、DDL），根据会议类型定制 prompt（战术会≤30min 追踪阻塞点，治理会≤90min 按标准议程模板）。
2. **守护者报告覆盖会议质量关键维度**：模糊词检测（可能/大概/争取/尽量/尽快）、四要素齐全（负责人/DDL/验收标准/依赖）、超时未闭环的遗漏——这些都是在 `assignTensionAction` 中也做了前置校验的，守护者报告是事后复查。
3. **两个函数粒度清晰**：`generateMeetingAgenda` 和 `generateGuardReport` 各司其职，调用方独立使用。

#### ⚠️ 问题

| 问题 | 严重度 | 详情 |
|------|--------|------|
| **getTensions 查询两次** | P2 | `draftGovernanceLog` 中将 `tensions` 和 `blockers` 分开查询但其实都走了 `prisma.tension` 表（tension+blocker 已合并），这是合并后遗留的重复查询。`generateMeetingAgenda` 中则正确处理了——只查一次。 |
| **`blockerContext` 引用了已不存在的 blocker 表语义** | P2 | 在 `draftGovernanceLog`（pattern-builder.ts）中，`blockerSummary` 从 `prisma.tension` 查出并取 `b.description.slice(0, 50)` 和 `b.owner?.name`——这里 `b` 变量名仍是 `blocker` 思维残留，但数据来自 tension 表的行动字段。 |
| **无会议数据持久化** | P3 | 议程生成后未自动存入 `Meeting.agenda` 字段——调用方需在生成后手动写入。 |

### 2.4 治理日志起草（`src/lib/ai/pattern-builder.ts`）

**评分：7.5 / 10**

#### ✅ 设计亮点

1. **可信度评分机制**：`credibilityScore = dataPoints < 5 ? 0.3 : dataPoints < 15 ? 0.6 : 0.8`——这是 docs/06 中强调的质量保证措施，已落地到 Schema 字段 `GovernanceLog.credibilityScore`。
2. **模式提取导向**：系统提示要求"识别真正的模式，不要泛泛而谈"，鼓励 AI 从重复出现的阻塞类型、回路间反复的张力、决策规律中提炼洞察——这比简单的数据罗列有价值得多。
3. **upsert 防重复**：`draftLogAction` 使用 `prisma.governanceLog.upsert` + `organizationId_period` 唯一约束，同一月只保留一份草稿。

#### ⚠️ 问题

| 问题 | 严重度 | 详情 |
|------|--------|------|
| **重复查询浪费** | P2 | 同一个月的数据，`tensions` 和 `blockers` 两次查询（如上所述，tension+blocker 已合并）。两个查询的 where 条件完全相同，仅 include 不同。应改为一次查询 + 两个 map。 |
| **changes/meetings 数据未充分喂给 AI** | P3 | prompt 中 changes 和 meetings 只给出了计数（`${changes.length} 条 + ${meetings.length} 次`），但 change 的 `objectDesc` 和 meeting 的 `title` 对模式识别是有价值的输入。 |
| **排序未考虑到** | P2 | 当 tensions 超过 take: 50 时，使用默认排序 `updatedAt: desc`，但未考虑"是否闭环"应在排序中加权——最近更新的未闭环项应优先于已闭环的历史项。 |

---

## 三、权限系统审查（`src/lib/permissions.ts`）

**评分：7.5 / 10 — 三层模型正确，覆盖率不足**

### 三层权限模型

```
Layer 1: requireOrgAdmin()        → 检查 Membership.role === "ORG_ADMIN"
Layer 2: requireCircleLead(id)    → 检查 Circle.leadPersonId === person.id
Layer 3: canManageTension(id)     → owner || circle lead || org admin
```

这个三层模型覆盖了组织治理中的典型权限场景，设计合理。

### 权限校验覆盖率检查

| Server Action | 权限校验 | 状态 |
|--------------|---------|------|
| `transitionTensionAction`（tracker） | `canManageTension` ✅ | 已覆盖 |
| `createCharterAction`（charter） | `requireOrgAdmin` ✅ | 已覆盖 |
| `ratifyCharterAction`（charter） | `requireOrgAdmin` ✅ | 已覆盖 |
| `draftLogAction`（log） | ❌ | **未覆盖**——任何成员可起草治理日志 |
| `publishLogAction`（log） | ❌ | **未覆盖**——任何成员可发布 |
| `assignTensionAction`（meetings） | ❌ | **未覆盖**——会议中分配行动未检查权限 |
| `convertTensionToDecision`（meetings） | ❌ | **未覆盖**——会议中转决策未检查权限 |
| `resolveTensionInMeeting`（meetings） | ❌ | **未覆盖** |
| `createTensionAction` | ❌ | 仅检查登录，任何成员可创建张力（合理） |
| `createInterfaceAction` | ❌ | 任何成员可创建回路间接口 |
| `createMetricAction` | ❌ | 仅检查 circle 是否属于 org，无权限校验 |
| `initializeOrgAction` | ❌ | **未覆盖**——任何成员可执行一键初始化 |
| `markAllReadAction` / `markReadAction` | ❌ | 仅检查当前 person，合理 |

**覆盖率统计**：13 个有副作用（写操作）的 Server Action 中，仅 3 个做了权限校验（23%）。但其中核心的安全关键操作（状态转移、宪章修订）已覆盖。

### ⚠️ 其他问题

| 问题 | 严重度 | 详情 |
|------|--------|------|
| `initializeOrgAction` 无权限 | P0 | 一键初始化是破坏性操作（创建回路+角色+接口），任何登录成员可执行。应组织 admin 限制。当前只有"已初始化则拒绝重试"的保护，但首次执行无权限门。 |
| `draftLogAction` / `publishLogAction` 无权限 | P1 | 治理日志发布应有组织 admin 校验。 |
| `assignTensionAction` 无权限 | P1 | 会议中为张力分配行动（负责人/回路/DDL）是敏感操作，至少应验证操作者是 meeting 参与人。 |
| `canManageTension` 性能 | P2 | 每个请求做 2 次 prisma 查询（tension + membership），对于追踪看板（一次渲染 20+ 个张力）不适用——仅供单次操作校验。 |

---

## 四、通知系统审查

### 4.1 站内通知（`src/lib/notifications/index.ts`）

**评分：8.5 / 10**

#### ✅ 质量评估

1. **频控实现正确**：24h 内同一 recipient + 同一 type 最多 2 次——这是 docs/07 中规定的频控策略，代码干净利落。
2. **API 完整**：`createNotification`、`getUnreadCount`、`markAsRead`、`markAllAsRead` 覆盖了通知系统完整生命周期。
3. **类型安全**：`NotificationType` 联合类型定义了 6 种通知类型，使用 string union 而非松散 string。

#### ⚠️ 问题

| 问题 | 严重度 | 详情 |
|------|--------|------|
| **频控基于 count 而非时间窗口内的实际间隔** | P2 | 24h 内 2 次后永久跳过——这意味着如果在 23:50 和 23:55 各触发一次，之后 24h 内不会再触发任何同类型通知。应该是"最近 24h 内已触发 2 次"而非"过去 24h 内总数≥2"。当前逻辑在边界场景下可能漏掉重要的第三个事件。 |
| **`Notification.type` 在 Schema 中是 String** | P3 | Schema 未使用枚举约束通知类型（V1 审查的 P2 遗留问题）。 |

### 4.2 邮件通知（`src/lib/notifications/email.ts`）

**评分：7.5 / 10**

#### ✅ 质量评估

1. **降级设计优雅**：`getClient()` 返回 `Resend | null`，未配置 `RESEND_API_KEY` 时静默跳过——不会因为邮件配置缺失导致系统崩溃。
2. **HTML 模板可用**：`sendBlockerOverdueEmail` 的 HTML 模板基本可用（含 CTA 按钮、回路名称、超时时长）。
3. **错误处理完备**：区分了 `error` 返回值和 catch 异常两种情况。

#### ⚠️ 问题

| 问题 | 严重度 | 详情 |
|------|--------|------|
| **邮件发送触发点不明确** | P1 | `sendBlockerOverdueEmail` 函数已定义，但在整个代码库中**无调用方**。Worker 的 `scanOrg` 仅在 48h 超时后创建站内通知（`maybeNotify`），并未调用 `sendBlockerOverdueEmail`。邮件通知渠道实际未接入主流程。 |
| **无退订/偏好设置** | P3 | 无 `unsubscribeUrl` 参数——法律合规风险（CAN-SPAM、GDPR 要求退订链接）。 |
| **模板中 `appUrl` 硬编码来源不明** | P2 | 调用方需传入 `appUrl` 参数，但应用中可能从环境变量 `NEXT_PUBLIC_APP_URL` 获取，无人保证调用方会正确传入。 |

### 4.3 通知系统主线集成度

| 触发点 | 站内通知 | 邮件通知 | 状态 |
|--------|---------|---------|------|
| Worker 扫描 48h 超时 | ✅ `maybeNotify` | ❌ 未调用 | ⚠️ 邮件缺失 |
| Worker 扫描 DDL 临近 | ✅ `maybeNotify` | ❌ 未调用 | ⚠️ 同上 |
| `scanEscalationsForOrg` | ✅ `createNotification` 动态导入 | ❌ 未调用 | ⚠️ 仅站内 |
| 会议创建 | ❌ | ❌ | 未接入 |
| 阻塞点指派 | ❌ | ❌ | 未接入 |
| 张力被翻译/确认 | ❌ | ❌ | 未接入 |

**结论**：通知框架已高质量搭建，但仅被 2 个入口调用（Worker 定时扫描 + `scanEscalationsForOrg`）。会议提醒、指派通知等基本面尚未接入。

---

## 五、数据模型变化审查

### 5.1 Tension + Blocker 合并分析

V1 有两个独立模型：`Tension`（张力/感知层）和 `Blocker`（阻塞点/行动层）。V2 在 `prisma/schema.prisma` 中**将二者合并为单一 `Tension` 模型**，这是最重大的数据模型变化。

#### 合并后的字段分布

```
感知层字段（保留）：
  title, description, type, source, conflictLevel, aiTranslation
  raiserId, circles (多值), createdAt

行动层字段（从原 Blocker 迁移）：
  status (BlockerStatus), acceptanceCriteria, deadline
  resolvedAt, rootCause, consecutiveMissed
  ownerId, circleId (单值), roleId, actionContext
  interfaceDependencyId
```

#### ✅ 设计评审

1. **语义正确**：一条记录的生命周期从"提出张力"→"感知层字段填充"→"分配行动后行动层字段填充"→"闭环"——消除了 V1 中需要事务包裹的张力→阻塞点转换。
2. **消除了 V1 的 P0-2**：V1 中 `convertToBlockerAction` 的无事务创建 + 更新风险被彻底消除——现在只需 update 同一条记录的行动字段。
3. **`circles`（多值）与 `circleId`（单值）共存**：感知阶段可关联多个回路（`circles: Circle[]`），分配行动后确定主归属回路（`circleId: String?`）——这个过度设计合理。

#### ⚠️ 问题

| 问题 | 严重度 | 详情 |
|------|--------|------|
| **`status` 字段语义扩大** | P2 | 原 `BlockerStatus` 枚举（10 状态：OPEN/ASSIGNED/.../REJECTED）现在也用于纯张力状态。纯张力（未分配行动）用 `OPEN` 表示，但 `OPEN` 在状态机中的含义是"阻塞点已提出未指派"——存在语义模糊。建议增加一个 `CONCEPTUAL` 或 `RAW` 状态。 |
| **`blocker` 相关变量名未统一** | P2 | `worker/index.ts` 中 `scanOrg` 函数的局部变量名 `blockers`、代码注释中仍用"阻塞点"——但实际查询的是 `prisma.tension`。`pattern-builder.ts` 中 `blockerSummary` 同理。这是合并遗留的技术债。 |
| **原 Blocker 的 deadline 索引** | P1 | V1 审查 P1-2 指出 Blocker.deadline 需要索引。合并后 `deadline` 字段在 Tension 表中，但 Schema 中仍未添加 `@@index([organizationId, deadline])`——超时阻塞点扫描（Worker 的核心操作）依赖此查询。 |
| **consecutiveMissed 累积问题** | P2 | V1 审查中已指出：降级时 `consecutiveMissed` 不重置。V2 的 `transitionTensionAction` 仍然在升级时 `{ increment: 1 }`，降级时不重置。若从 ESCALATED_L3 退回 IN_PROGRESS 再升级，计数器会累积失真。 |

### 5.2 新增模型

#### GovernanceLog（治理日志）
- ✅ `@@unique([organizationId, period])` 保证每月每组织仅一份日志
- ✅ `credibilityScore` 可空（Float?）——AI 不可用时可为 null
- ✅ `status` 枚举 `draft/published` 支持审核流程
- ⚠️ `patterns` 字段为 String 存储 JSON 字符串，而非 JSON 类型（PostgreSQL 原生），需应用层序列化/反序列化

#### Charter（组织宪章）
- ✅ `previousVersionId` 自关联实现单向版本链
- ✅ `@@unique([organizationId, version])` 防止版本号重复
- ✅ `status` 枚举 `draft/ratified/archived` 完整

### 5.3 Schema 整体评估

| 维度 | 评分 | 说明 |
|------|------|------|
| 关系建模 | 9.0 | 合并后的 Tension 关系清晰，DecisionRecord 自关联正确 |
| 枚举覆盖 | 8.5 | 所有业务状态均有枚举 |
| 索引策略 | 6.5 | deadline 缺失、circle 缺联合索引 |
| 约束完整性 | 6.0 | 无跨回路角色 contractId 强制、无接口 from≠to CHECK |

---

## 六、组织初始化审查（`src/app/app/setup/actions.ts` + `src/lib/org-templates.ts`）

**评分：8.0 / 10**

### ✅ 设计亮点

1. **事务安全正确**：`initializeOrgAction` 使用 `prisma.$transaction(async (tx) => {...})` 包裹整个初始化流程（回路创建 → 角色创建 → 接口创建），原子性正确。
2. **幂等性保护**：通过 `existingCircles > 1` 检查防止重复初始化。
3. **key→circleId 映射机制**：`circleMap` 在事务内先建回路再建接口，通过 key 查找已创建的 circleId——这是正确的依赖顺序。
4. **模板复用设计**：`allTemplates` 数组支持未来扩展（如 SaaS 团队模板、硬件团队模板）。
5. **模板数据真实可用**：`llmTeamTemplate` 基于大模型生产链路设计，5 个回路 + 7 个接口 + 12 个角色，非常具体且有行业依据。

### ⚠️ 问题

| 问题 | 严重度 | 详情 |
|------|--------|------|
| **无权限校验** | P0 | 见权限系统审查——任何登录成员可执行一键初始化。应在 action 开头加 `requireOrgAdmin()`。 |
| **默认创建者为所有回路和接口的负责人** | P2 | `leadPersonId: person.id` 和 `ownerId: person.id` 使初始化者成为所有回路和接口的负责人/拥有者——这在 50 人组织中合理（管理员再手动调整），但如果接口 `ownerId` 应是供给方回路负责人而非创建者，则语义不准确。 |
| **无回滚时的用户通知** | P3 | catch 块仅返回通用 `"初始化失败，请重试"`，不告知用户失败在哪一步（回路？角色？接口？）。 |
| **模板数据与 Schema 耦合** | P2 | `TemplateCircle.roles` 的 `accountabilities` 用 `\n` 分隔——这是模板层的约定，与 Schema 的 `RoleDef.accountabilities` 字段注释对齐但无运行时校验。 |

---

## 七、Worker / 定时任务审查（`worker/index.ts`）

**评分：7.5 / 10**

### ✅ 设计亮点

1. **独立 Node 进程设计**：使用 `node-cron` + 独立 Prisma 客户端（PG 直连适配器），不依赖 Vercel Cron。这是 docs/09 的明确决策——"不锁死在 Vercel 平台"。正确。
2. **频控逻辑独立**：`maybeNotify` 函数在通知创建前再做一次频控检查（数据库查询），不依赖 `createNotification` 的内置频控——双重保障。
3. **启动即执行**：`scanAllOrgs().catch(console.error)` 确保 worker 启动时不是空等一小时。
4. **优雅退出**：`SIGTERM` 处理器关闭 PG 连接池。

#### ⚠️ 问题

| 问题 | 严重度 | 详情 |
|------|--------|------|
| **未接入升级信号检测** | P0 | `scanOrg` 仅做超时检测（48h）和 DDL 临近检测（24h），**未调用 `detectEscalation`**。docs/05 中定义的核心升级逻辑（L0.5 紧急路径、L2 SLA 超时、L3 48h 未解决、L3 系统性）在 worker 中完全缺失。Worker 目前只做了"提醒"，没做"自动升级状态转移"。 |
| **邮件通知未接入** | P1 | `scanOrg` 仅调用 `maybeNotify` 创建站内通知，未调用 `sendBlockerOverdueEmail`。邮件渠道未激活。 |
| **`notifyCooldown` 内存 Map 未使用** | P3 | 第 24 行定义了 `notifyCooldown` Map，但 `maybeNotify` 函数中从未读取或写入该 Map——是残留代码。频控完全依赖数据库查询。 |
| **无健康检查端点** | P2 | worker 没有 /health 端点，监控工具无法确认其存活状态。 |
| **无错误告警** | P2 | `catch (e) { console.error("扫描失败:", e); }` 仅打印到 stdout，生产环境中无人会看。应接入日志/Sentry。 |

---

## 八、测试覆盖审查

**评分：3.0 / 10**

### 测试现状

| 模块 | 测试文件 | 测试数 | 评价 |
|------|---------|--------|------|
| `statemachine.ts` | `src/lib/__tests__/statemachine.test.ts` | 18 个 | ✅ 覆盖转移合法性、状态判断、升级检测、SLA、连续未闭环 |
| `provider.ts` | 无 | 0 | ❌ |
| `tension-translator.ts` | 无 | 0 | ❌ |
| `meeting-assistant.ts` | 无 | 0 | ❌ |
| `pattern-builder.ts` | 无 | 0 | ❌ |
| `permissions.ts` | 无 | 0 | ❌ |
| `notifications/index.ts` | 无 | 0 | ❌ |
| `notifications/email.ts` | 无 | 0 | ❌ |
| `metrics.ts` | 无 | 0 | ❌ |
| `org-templates.ts` | 无 | 0 | ❌ |
| Server Actions | 无 | 0 | ❌ |

**唯一有测试覆盖的模块是 `statemachine.ts`——这与 V1 审查时完全相同。** 三个 Sprint 新增的约 800 行核心代码（AI 集成、通知、权限、组织初始化）零测试。

### V1 P2-1 修正状态

V1 审查建议"状态机测试补全（边界值、降级路径）"，当前 `statemachine.test.ts` 的测试用例与 V1 时期一致（18 个），未增加 ESL4→L3 降级、ASSIGNED→OPEN 退回、边界值测试等建议的用例。**P2-1 未实质推进。**

---

## 九、上次 V1 审查 P0/P1 修正追踪矩阵

### 9.1 P0 修正（阻塞上线）

| 编号 | V1 问题 | V2 状态 | 修正质量 | 详情 |
|------|---------|---------|---------|------|
| **P0-1** | Server Actions 权限校验缺失 | ✅ **已修复** | ⭐⭐⭐ | `permissions.ts` 实现三层权限模型。`transitionTensionAction` 接入 `canManageTension`。`createCharterAction` / `ratifyCharterAction` 接入 `requireOrgAdmin`。**但覆盖率仅 23%**（见第三章）。 |
| **P0-2** | convertToBlockerAction 事务不安全 | ✅ **已消除** | ⭐⭐⭐ | Tension + Blocker 合并为单表，不再需要跨表事务。`assignTensionAction` 使用 `$transaction` 但仅做单表更新（过度使用）。 |
| **P0-3** | scanEscalations 空实现 + 无 cron | ⚠️ **部分修复** | ⭐⭐ | `worker/index.ts` 实现独立 node-cron 进程，`scanEscalationsForOrg` 实现超时检测逻辑。**但 Worker 未接入升级信号检测（detectEscalation）**——仅做通知提醒，不自动升级状态。 |
| **P0-4** | Notification 创建逻辑为零 | ✅ **已修复** | ⭐⭐⭐ | `notifications/index.ts` 实现 `createNotification`（含频控）+ `notifications/email.ts` 实现 Resend 邮件。**邮件未接入 worker 主流程。** |

### 9.2 P1 修正（影响核心功能完整性）

| 编号 | V1 问题 | V2 状态 | 修正质量 | 详情 |
|------|---------|---------|---------|------|
| **P1-1** | transitionBlockerAction 竞态条件 | ❌ **未修复** | — | 无乐观锁/悲观锁。`transitionTensionAction` 仍是 read-check-write。`update` 使用 `{ where: { id } }` 无版本检查。 |
| **P1-2** | Blocker.deadline 索引 | ❌ **未修复** | — | Tension 表的 deadline 字段无单独索引。 |
| **P1-3** | 登录限流 | ❌ **未修复** | — | 无登录失败计数或限制。 |
| **P1-4** | RBAC 角色权限模型 | ✅ **已修复** | ⭐⭐⭐ | `permissions.ts` 完整实现了 org admin / circle lead / owner 三层。 |
| **P1-5** | SUPPORT 角色 contractId 强制 | ❌ **未修复** | — | 无运行时校验跨回路角色是否有 contractId。 |
| **P1-6** | 通知频控 | ✅ **已修复** | ⭐⭐⭐ | `createNotification` 24h 同类最多 2 次。Worker `maybeNotify` 双重频控。 |

### 9.3 P2 修正（工程质量）

| 编号 | 状态 | 详情 |
|------|------|------|
| P2-1 | ❌ | 状态机测试未补全 |
| P2-2 | ❌ | Person.email 无索引 |
| P2-3 | ❌ | `as never` 枚举强转未清理 |
| P2-4 | ❌ | 输入验证未增强 |
| P2-5 | ❌ | seed.ts 不存在 |
| P2-6 | ❌ | 错误日志未结构化 |
| P2-7 | ❌ | 无 Prisma Middleware 审计 |
| P2-8 | ❌ | Metric 类型未增强 |

**P0 修正率：3/4（75%）| P1 修正率：3/6（50%）| P2 修正率：0/8（0%）**

---

## 十、综合建议：P0/P1/P2 优先级

### P0 — 立即修复（阻塞上线或安全关键）

| 编号 | 问题 | 文件 | 工时 |
|------|------|------|------|
| **P0-1** | `initializeOrgAction` 无组织 admin 权限校验 | `src/app/app/setup/actions.ts` | 0.5h |
| **P0-2** | Worker 未接入 `detectEscalation` 升级信号 | `worker/index.ts` | 3h |
| **P0-3** | 邮件通知未接入 worker 主流程 | `worker/index.ts` | 1h |

### P1 — 下个 Sprint 修复（功能完整性和工程质量）

| 编号 | 问题 | 工时 |
|------|------|------|
| **P1-1** | `draftLogAction` / `publishLogAction` 加 admin 权限 | 0.5h |
| **P1-2** | `assignTensionAction` / `convertTensionToDecision` 加 meeting 参与人校验 | 1h |
| **P1-3** | 乐观锁：Tension 表加 version 字段 + updateMany 条件 | 3h |
| **P1-4** | Tension.deadline 索引 | 0.5h |
| **P1-5** | `pattern-builder.ts` 重复查询合并 | 0.5h |
| **P1-6** | StepFun provider 的 AI SDK 兼容层（替代裸 fetch） | 4h |
| **P1-7** | AI 调用加超时控制（AbortController） | 0.5h |

### P2 — 改善工程质量和长期可维护性

| 编号 | 问题 | 工时 |
|------|------|------|
| **P2-1** | AI 模块测试（provider / translator / meeting / pattern-builder） | 8h |
| **P2-2** | `blocker` 变量名残留清理 | 2h |
| **P2-3** | 频控逻辑的 `notifyCooldown` Map 清理或复用 | 0.5h |
| **P2-4** | Worker 健康检查端点 | 1h |
| **P2-5** | seed.ts 创建 | 3h |
| **P2-6** | `as never` 强转清理 | 2h |
| **P2-7** | `consecutiveMissed` 降级重置逻辑 | 1h |
| **P2-8** | AI 翻译准确率追踪埋点 | 2h |

**总计工时：P0 4.5h + P1 10h + P2 19.5h ≈ 34h**

---

## 十一、V1 → V2 进化总结

### 关键得分变化

```
V1 综合评分:  6.27 / 10
V2 综合评分:  7.35 / 10
提升:        +1.08 分（+17%）

最大提升模块:
  通知系统:   0.0 → 8.0 (+8.0)
  权限系统:   2.0 → 7.5 (+5.5)
  Worker:    0.0 → 7.5 (+7.5)
  AI 集成:   4.0 → 7.0 (+3.0)

最大拖分项:
  测试覆盖:   1.5 → 3.0 (仍极低)
  P2 修正:   0/8 (零推进)
```

### 三视角交叉（相对于 V1 整合报告）

| V1 共识级问题 | V2 状态 |
|-------------|---------|
| 🔴 AI 集成零进展 | ✅ **已解决**：4 个 AI 模块全部实现，支持多 provider |
| 🔴 通知系统缺失 | ✅ **已解决**：站内通知+邮件，含频控 |
| 🔴 定时任务零实现 | ⚠️ **部分解决**：Worker 运行但升级信号检测缺失 |
| 🟡 Server Actions 权限缺失 | ⚠️ **部分解决**：三层模型建立但覆盖率 23% |

### 架构债务

V2 的主要架构债务集中在：
1. **AI provider 层的 StepFun 兼容 hack**：裸 fetch 方案是短期补丁，应回归 AI SDK
2. **测试覆盖极度单薄**：唯一有测试的模块是 V1 时期就有的 statemachine.ts
3. **代码清理不彻底**：blocker 遗留变量名、notifyCooldown 死代码
4. **通知系统接入面窄**：仅 worker 调用，meeting/setup/tension CRUD 均未接入

---

> **方法论**：逐模块代码审查（AI 4 子模块 / 权限 / 通知 / 数据模型 / 初始化 / Worker）→ V1 P0/P1 修正逐项追踪 → 权限覆盖率统计 → 综合评分。  
> **审查产出**：本报告（约 9500 字）+ 修正追踪矩阵。  
> **文件路径**：`review/v2/architecture-review.md`
