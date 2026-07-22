# AI 原生会议引导实施计划

## 目标

依据 `docs/plans/2026-07-22-ai-native-meeting-facilitation-design.md`，把战术会议和治理会议改造成两套独立、可验证的多人实时会议引导系统，并复用现有战术结果与规范治理写入路径。

## 实施约束

- 只修改会议引导、其必要持久化、领域连接和验证表面。
- 不把 LoopOS 改成严格 Holacracy v5。
- 不复制 `TacticalOutcomeProposal` 或 `GovernanceDecisionProcess` 的领域写入逻辑。
- AI 只输出结构化教练建议，不能直接执行不可逆操作。
- 任何参会者可推翻 AI 反对初判；只要一人维持有效，反对进入整合。
- 多人同步不能使用整页刷新，不能破坏输入焦点和草稿。
- 每个里程碑先完成聚焦测试，再进入下一里程碑。

## 里程碑 1：独立确定性状态机

### 结果

两套纯 TypeScript 引擎定义各自阶段、动作、守卫、自动推进和可逆边界，不依赖 React、Prisma 或模型调用。

### 文件

- 新增 `src/lib/meeting-facilitation/types.ts`
- 新增 `src/lib/meeting-facilitation/tactical-engine.ts`
- 新增 `src/lib/meeting-facilitation/governance-engine.ts`
- 新增 `src/lib/meeting-facilitation/__tests__/tactical-engine.test.ts`
- 新增 `src/lib/meeting-facilitation/__tests__/governance-engine.test.ts`

### 核心契约

- 战术阶段：`ENTRY`、`CHECK_IN`、`CHECKLIST_REVIEW`、`METRICS_REVIEW`、`PROJECT_UPDATES`、`BUILD_AGENDA`、`TRIAGE_ITEM`、`CLOSING_ROUND`、`COMPLETED`。
- 治理阶段：`ENTRY`、`CHECK_IN`、`BUILD_AGENDA`、`PRESENT_PROPOSAL`、`CLARIFYING_QUESTIONS`、`REACTION_ROUND`、`AMEND_OR_CLARIFY`、`OBJECTION_ROUND`、`AI_ASSESSMENT`、`DISTRIBUTED_REVIEW`、`INTEGRATION`、`ADOPTION_CONFIRMATION`、`CLOSING_ROUND`、`COMPLETED`。
- 纯函数返回新状态、待追加事件和待执行副作用意图。
- 引擎拒绝跨会议类型动作、过期版本、越过必需轮次和自动执行不可逆动作。

### 验证

```bash
npx tsx --test src/lib/meeting-facilitation/__tests__/tactical-engine.test.ts src/lib/meeting-facilitation/__tests__/governance-engine.test.ts
```

## 里程碑 2：持久化与迁移

### 结果

会议会话、结构化议程、事件游标、角色代表、周期性清单和治理反对复核具有租户限界、并发版本和审计关系。

### 文件

- 修改 `prisma/schema.prisma`
- 新增一个时间戳命名的 Prisma migration 及 `rollback.sql`
- 重新生成 `src/generated/prisma`

### 主要模型

- `MeetingFacilitationSession`
- `MeetingFacilitationEvent`
- `MeetingAgendaItem`
- `MeetingRoleRepresentation`
- `RoleChecklistItem`
- `GovernanceObjectionReview`
- `GovernanceObjectionStance`

### 数据约束

- 所有记录包含 `organizationId`，关系尽可能使用组织复合键。
- 每场会议最多一个主持会话。
- 事件序号在会议内唯一。
- 角色代表在参与者和角色维度唯一。
- 一名参与者对一条反对只有一个当前立场，可更新但不可丢失对应审计事件。
- 迁移不删除或重写旧消息与旧会议阶段。

### 验证

```bash
npx prisma validate
npx prisma generate
git diff --check
```

## 里程碑 3：会议仓储与编排服务

### 结果

服务端只有一个入口可以初始化、读取和迁移会议状态；每次操作重新验证身份、组织、会议参与资格、代表角色和状态版本。

### 文件

- 新增 `src/lib/meeting-facilitation/repository.ts`
- 新增 `src/lib/meeting-facilitation/prisma-repository.ts`
- 新增 `src/lib/meeting-facilitation/service.ts`
- 新增 `src/lib/meeting-facilitation/read-model.ts`
- 新增对应单元测试和 PostgreSQL 集成测试

### 主要操作

- 初始化会议会话
- 加入、离开和确认代表角色
- 提交阶段允许的发言或状态动作
- 添加、排序和激活议程项
- 暂停、恢复和回退可逆阶段
- 记录候选教练介入和结构化输出
- 提交或推翻反对初判
- 计算保护性反对聚合
- 人工确认不可逆节点
- 按版本获取增量事件

### 验证

```bash
npx tsx --test src/lib/meeting-facilitation/__tests__/*.test.ts
```

PostgreSQL 测试必须证明错误会议、非参与者、错误角色、跨租户和并发旧版本不会产生写入。

## 里程碑 4：上下文读取与结构化 AI 教练

### 结果

David 和 Brian 从会议类型对应的真实上下文工作，并输出可校验的教练建议；AI 失败不阻塞会议。

### 文件

- 新增 `src/lib/meeting-facilitation/context-builder.ts`
- 新增 `src/lib/meeting-facilitation/coach-schema.ts`
- 新增 `src/lib/meeting-facilitation/coach.ts`
- 重构 `src/app/app/meetings/[id]/coach-personas.ts`
- 将 `src/app/app/meetings/[id]/meeting-agent-actions.ts` 收敛为兼容入口或移除旧写入职责
- 新增上下文和教练契约测试

### 上下文

- 会议、回路、角色、职责、领域、承担人
- 参与者代表角色、阶段、发言轮次、议程和时间
- 战术目标、清单、指标、项目、行动、张力和提案
- 治理结构、提案版本、澄清、回应、反对、复核和整合
- 带来源引用的滚动会议记忆

### AI 契约

- 输出严格解析为 `MeetingCoachSuggestion`。
- 没有 `evidenceRefs` 的组织事实或反对判断不得成为正式教练输出。
- 模型建议的迁移和领域输出必须再次通过状态机验证。
- 失败时使用按阶段定义的确定性主持语。

### 验证

```bash
npx tsx --test src/lib/meeting-facilitation/__tests__/context-builder.test.ts src/lib/meeting-facilitation/__tests__/coach.test.ts
```

## 里程碑 5：连接现有战术与治理领域动作

### 结果

会议候选输出经人类确认后调用现有权威路径，会议会话只保存引用和状态，不复制领域结果。

### 文件

- 修改 `src/app/app/meetings/[id]/tactical-outcome-actions.ts`
- 修改 `src/app/app/meetings/[id]/proposal-actions.ts`
- 修改 `src/lib/governance-decision.ts`（仅在现有契约无法表达重新反对和审计绑定时）
- 新增会议编排与两个领域服务之间的适配器和测试

### 战术连接

- 议程拥有者确认需要。
- Action 或 Project 接收者明确接受后，复用 `submitTacticalOutcomeProposalAction` 和 `recordTacticalOutcomeDecisionAction` 的领域逻辑。
- 信息答复和表达空间只作为会议结果事件，不伪造 Action。
- 治理张力进入明确治理路由，不在战术会上改变结构。

### 治理连接

- 当前治理提案修订绑定主持会话和活动议程项。
- AI 初判和分布式复核不会直接触发 `ASSESS_OBJECTION` 或采纳。
- 保护性聚合确认有效后进入现有反对/修订路径。
- 新修订必须创建新的反对轮。
- 无维持有效反对且人工确认后才调用现有采纳事务。

### 验证

```bash
npx tsx --test 'src/app/app/meetings/[id]/tactical-outcome-actions.test.ts' 'src/app/app/meetings/[id]/proposal-actions.test.ts' src/lib/__tests__/governance-decision.test.ts
```

## 里程碑 6：增量同步接口

### 结果

多个客户端通过递增事件游标同步，不执行整页刷新，不丢焦点、草稿或事件。

### 文件

- 新增 `src/app/api/meetings/[id]/events/route.ts`
- 新增 `src/app/api/meetings/[id]/snapshot/route.ts`（如增量响应需要快照恢复）
- 新增路由授权和游标测试

### 契约

- `GET` 每次重新认证并验证组织会议参与资格。
- 请求提供 `after` 游标，响应事件、当前版本和下一游标。
- 返回 `Cache-Control: no-store`。
- 先实现稳定的增量拉取；流式长连接只在当前自托管运行环境可可靠验证时启用。
- 连接恢复从最后确认游标补齐。

### 验证

路由测试覆盖未登录、非参与者、错误会议、跨租户、空增量、批量增量和非法游标。

## 里程碑 7：双屏会议驾驶舱

### 结果

左侧提供逼真的实时主持与轮次体验，右侧随会议推进实时形成结构化成果。

### 文件

- 重构 `src/app/app/meetings/[id]/meeting-agent-client.tsx`
- 重构 `src/app/app/meetings/[id]/structure-panel.tsx`
- 修改 `src/app/app/meetings/[id]/page.tsx`
- 新增 `src/app/app/meetings/[id]/tactical-cockpit.tsx`
- 新增 `src/app/app/meetings/[id]/governance-cockpit.tsx`
- 新增 `src/app/app/meetings/[id]/meeting-results-panel.tsx`
- 新增客户端 reducer、事件同步 hook 和组件测试

### 体验要求

- 当前阶段、当前发言角色、允许动作、规则解释和剩余时间持续可见。
- AI 不对每条消息机械回复，只在引擎触发点介入。
- 左侧候选输出与右侧候选卡同步出现。
- 点击成果卡可定位来源发言。
- 远端事件不改写本地输入草稿。
- AI 思考状态说明具体任务。
- 小屏幕使用成果抽屉，不删除任何确认能力。

### 验证

- TypeScript 和 ESLint。
- 静态组件契约测试。
- Playwright 两身份同步、焦点和重连场景。

## 里程碑 8：完整验证和质量门槛

### 聚焦静态验证

```bash
npx tsc --noEmit
npx eslint src/lib/meeting-facilitation 'src/app/app/meetings/[id]' src/app/api/meetings
git diff --check
```

### 领域回归

```bash
npm test
```

### 数据库证明

在一次性 PostgreSQL 数据库应用完整迁移栈，并执行：

- 双会议会话初始化和状态迁移
- 两租户隔离
- 非参与者和错误代表角色零写入
- 并发版本单赢家
- 反对初判、相反推翻和保护性有效聚合
- 战术结果和治理采纳真实落库
- 临时数据清理零残留

### 浏览器证明

至少两个独立身份完成设计文档中的六个代表性场景，保存可核查日志和截图。多人事件同步小于两秒，远端更新不丢焦点或草稿。

### AI 质量评估

建立人工标注的战术和治理场景集，分别评分：

- 流程忠实度
- 上下文依据
- 介入时机
- 简洁度
- 人类自主权
- 反对初判准确率

五项体验维度平均至少 4/5，反对初判至少 85%，虚构组织事实为零。

## 提交策略

1. 设计文档独立提交。
2. 状态机和纯测试独立提交。
3. Schema、迁移和持久化独立提交。
4. 上下文、AI 与编排服务独立提交。
5. 领域连接独立提交。
6. 实时接口和 UI 独立提交。
7. 验证修正独立提交。

除设计文档提交外，后续提交只在对应里程碑通过聚焦验证后创建。
