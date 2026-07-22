# Loop Designer 新版本 PRD 与技术规范：流程断点扫描与回路重构体验

## 1. 背景与问题

6.24 闭门会复盘暴露出一个明确问题：用户认可“AI 时代组织设计”的方向，但在终端体验中没有真正感受到“回路”与“流程/业务链路”的差异。

典型反馈包括：

- “回路到底是啥？”
- “画草图还是画了一条流程，感觉跟以前做的一样。”
- “案例的细节没有打开，哪些节点被改变了、为什么改变，没有对比。”
- “不知道那个环节要干什么，没有突破感。”
- “未来一个人和多个智能体完成很多事，过渡节奏是什么？”

HBR 文章《你的 AI 为什么被组织排斥了？》给出了更好的产品切入点：不是先解释“回路”的定义，而是让用户看到旧流程中的三类断点：

1. 信息塌缩：原始上下文在转述、汇总、审批中丢失。
2. 等待黑洞：业务掉进审批、排期、跨部门请求或供应商响应中。
3. 验证真空：交付结束后没有真实结果回验，也没有下一轮学习。

本版本要把这三类断点做成产品里的核心干预工具，让用户在操作中经历“旧流程 -> 断点扫描 -> 回路重构 -> 改造前后对比”的过程。

## 2. 产品定位

本版本定位为：

> Loop Designer = 旧流程断点扫描器 + 回路重构工作台 + 持续运行记录与版本发布器。

对用户的解释收敛为一句话：

> 流程图回答“谁接着谁做”；回路设计回答“哪里在丢信息、哪里在等人、哪里没有验证，以及怎么让下一轮变聪明”。

本版本不追求“生成更多方案”，而是把“回路不是流程图”变成可感知的产品体验。

## 3. 目标用户

第一优先用户：

- 成长型企业创始人 / CEO。
- 已经尝试过 AI 工具，但不知道如何进入组织级落地的业务负责人。
- 咨询顾问、组织发展负责人、AI 转型负责人。

用户共性：

- 处于 L1-L2：试过工具，部分岗位提效，但还没有业务闭环。
- 缺少场景画面：听得懂方向，但不知道第一步怎么做。
- 对“流程梳理”熟悉，对“回路构建”陌生。

## 4. 产品目标

### 4.1 用户体验目标

用户完成一次设计后，应能清楚说出：

- 我原来的业务链路哪里不是回路。
- 哪些节点在丢信息、等人或没有验证。
- 哪些节点可以删掉、合并、交给 AI、保留人工裁决或增加验证。
- 改造后为什么不再只是流程图。
- 每一轮运行后要验证什么，以及什么时候从试运行版进入正式运行版。

### 4.2 业务目标

- 提升课程/工作坊现场的“突破感”和可讲解性。
- 让产品成为回路方法论的体验载体，而不是事后报告生成器。
- 为后续组织记忆、接口协议、运行信号和治理审阅积累结构化数据。

## 5. 非目标

本版本不做：

- 完整 BPMN 流程建模器。
- 拖拽式复杂流程图编辑。
- 外部系统运行数据自动接入。
- 自动发布智能体或真实执行工作流。
- Matrix Origin 拓扑自动变更。
- 面向完全零基础用户的 AI 工具教学。

## 6. 版本范围

### P0：流程断点扫描器与 Before/After 首屏

目标：让用户在 5 分钟内感受到“我原来画的是流程，系统正在帮我改造成回路”。

核心能力：

- 旧流程速写。
- 三类断点扫描：信息塌缩、等待黑洞、验证真空。
- 节点级重构建议。
- 改造前后对比指标。
- 结果页首屏展示“旧流程 vs 新回路”。

### P1：运行记录与版本发布

目标：回答“每一轮运行后，这条回路是否变聪明了”，并支持从试运行版发布为正式运行版。

核心能力：

- 每条回路资产下持续记录每一轮运行，不预设三轮上限。
- 每轮记录指标、异常、复盘结论和下一轮修改。
- 支持试运行版与正式运行版发布。
- 每轮后生成“是否形成真回路”的阶段判断。
- 将验证结论沉淀为演化日志。

### P2：接口协议台

目标：把回路关系从“有依赖”升级为“有可治理的接口协议”。

核心能力：

- 依赖关系增加硬咬合、软咬合、回灌咬合。
- 每条接口支持语义协议、结构协议、治理协议。
- 支持版本号、异常回传、下游验收和变更通知。
- 在资产台展示接口风险和断链提醒。

### P3：行业样板与回路负责人角色卡

目标：提升讲解和冷启动效率。

核心能力：

- 行业 Before/After 样板：跨境选品、客服投诉、销售线索、教研讲评、合同审核等。
- 回路负责人角色卡：说明人从执行者变成设计者/验收者需要什么条件。
- Day 0 / Day 7 / Day 30 / Day 90 过渡路线。

## 7. 核心用户流程

### 7.1 新建回路

当前流程：

1. 业务目标锚点。
2. 描述回路单元。
3. 确认拆解。
4. 生成方案。

新流程：

1. 业务目标锚点。
2. 旧流程速写。
3. 断点扫描与确认。
4. 回路重构。
5. 生成新回路方案。
6. Before/After 首屏。
7. 沉淀为回路资产。
8. 进入运行记录与版本发布。

### 7.2 旧流程速写

用户不需要理解回路概念，只按熟悉方式填写当前业务链路。

每个旧流程节点收集：

- 这一步实际在做什么。
- 谁执行，谁负责结果。
- 输入来自哪里。
- 输出交给谁。
- 是否需要审批、等待、转述、排期。
- 怎样算完成。
- 完成后是否有人回头验证结果。
- 哪里费时间、容易错、反复沟通。

### 7.3 断点扫描

系统对每个节点标记 0-N 个断点。

#### 信息塌缩

判断问题：

- 这个节点是否把复杂上下文压缩成摘要、表格、会议结论或口头转述？
- 下游是否拿不到原始语境、关键字段或判断依据？
- AI 或下游角色是否需要重新追问才能继续工作？

典型提示：

> 这里不是在创造新价值，而是在把原始信息压缩给下一个人。建议改成结构化输入协议，保留原始上下文和关键字段。

#### 等待黑洞

判断问题：

- 这个节点是否进入审批、排期、跨部门沟通、供应商响应或负责人空档？
- 是否没有 SLA、超时规则或替代路径？
- 等待时间是否远大于真实处理时间？

典型提示：

> 这里的主要成本不是处理，而是等待。建议把审批改成前置规则，把人工从逐条确认退到异常裁决。

#### 验证真空

判断问题：

- 输出交付后是否没有真实结果回验？
- 是否无法判断本轮比上一轮更好？
- 是否没有反馈信号进入下一轮输入？

典型提示：

> 这一步完成后没有回验，流程在这里结束，回路没有形成。建议增加验证节点和下一轮回灌信号。

### 7.4 回路重构

系统为每个断点给出一个或多个重构动作：

| 动作 | 说明 | 示例 |
|---|---|---|
| 删掉 | 节点只是在转述或制造等待，不再保留 | 删除“手工汇总给主管” |
| 合并 | 两个节点重复确认，可以合并 | 合并“组长初审”和“负责人复核” |
| AI 接手 | 高重复、规则清晰、低风险 | AI 进行初步分类、结构化、候选生成 |
| 人退到边界 | 人不再逐条执行，只处理异常/价值判断/承诺 | 负责人只审核低置信度或高风险事项 |
| 增加验证 | 把交付结果接回下一轮 | 30 天内同类投诉复现率回灌 |
| 增加记忆 | 沉淀脚本、规则、异常、复盘 | 形成验收脚本和边界日志 |
| 增加接口协议 | 明确上下游输入输出和异常回传 | 下游发现字段缺失时回传上游 |

### 7.5 Before/After 首屏

生成结果页的首屏不直接展示完整报告，而是先展示：

- 旧流程节点数 -> 新回路节点数。
- 人工执行节点数 -> 人工边界节点数。
- 等待点数量 -> 等待点数量。
- 审批轮次 -> 审批轮次。
- AI 可接手节点数。
- 验证信号数量。
- 记忆资产数量。
- 预计闭环周期变化。

同时展示三条关键解释：

- 哪个旧节点被删掉，为什么。
- 哪个节点从“人执行”变成“AI 执行 + 人裁决”。
- 哪个交付终点被改成验证回灌。

### 7.6 运行记录与版本发布

用户沉淀资产后，系统提示：

> 不要急着规模化。先发布试运行版，逐轮记录真实运行结果；当目标、接口、护栏和验证信号稳定后，再发布正式运行版。

每一轮运行记录：

- 本轮目标。
- 运行模式：试运行 / 正式运行。
- 关联版本：本轮基于哪个回路版本运行。
- 真实运行数据。
- 触发了哪些异常。
- 哪条假设被证实或证伪。
- 下一轮先改什么。
- 是否更新工作流、验收脚本、护栏或接口协议。

每轮结束后生成阶段判断：

- 继续试运行：仍需补充目标、接口、护栏或验证信号。
- 可以发布正式运行版：指标改善，验证信号回灌，记忆变厚，异常边界清楚。
- 尚未闭环：仍缺验证、接口或责任边界。
- 不适合继续：痛点不真、数据不足、无人认领或闭环过长。

## 8. 信息架构与页面调整

### 8.1 新建设计页

新增或调整模块顺序：

1. 业务目标锚点。
2. 旧流程速写。
3. 断点扫描。
4. 回路重构确认。
5. 方案生成进度。

### 8.2 方案结果页

首屏模块：

- `旧流程 vs 新回路`。
- `三类断点命中`。
- `最关键的三个重构动作`。

后续模块沿用现有：

- 优先阅读。
- 业务目标锚点。
- AI 可以接管的工作。
- 人机协作拓扑图。
- 对齐与成熟度诊断。
- 30 天行动路线。

### 8.3 回路资产详情页

新增模块：

- 断点扫描记录。
- 改造前后指标。
- 运行记录与版本发布。
- 演化日志。

### 8.4 回路关系页 / 资产台

P2 新增：

- 接口协议状态。
- 咬合类型。
- 协议版本。
- 断链或版本冲突提醒。

## 9. 数据模型

### 9.1 P0 类型扩展

P0 优先存入 `LoopPlan`，不新增数据库表。`loop_designer_sessions.outputs.currentPlan` 与 `loop_os_versions.plan` 已经是 JSONB，可承载新增字段。

新增类型：

```ts
export type BreakpointType =
  | "information_collapse"
  | "waiting_black_hole"
  | "validation_vacuum";

export type BreakpointSeverity = "low" | "medium" | "high";

export type LegacyWorkflowNode = {
  id: string;
  order: number;
  action: string;
  owner: string;
  input: string;
  output: string;
  handoffTo?: string;
  waitFor?: string;
  decision?: string;
  approval?: string;
  system?: string;
  acceptance?: string;
  verification?: string;
  painNote?: string;
};

export type WorkflowBreakpoint = {
  id: string;
  nodeId: string;
  type: BreakpointType;
  severity: BreakpointSeverity;
  diagnosis: string;
  evidence: string;
  suggestedIntervention: string;
  confidence: "high" | "medium" | "low";
  userConfirmed?: boolean;
};

export type TransformationMoveType =
  | "remove"
  | "merge"
  | "agent_takeover"
  | "human_boundary"
  | "add_validation"
  | "add_memory"
  | "add_interface_protocol";

export type LoopTransformationMove = {
  id: string;
  type: TransformationMoveType;
  sourceNodeIds: string[];
  targetCellId?: string;
  title: string;
  rationale: string;
  expectedEffect: string;
  humanChange?: string;
};

export type BeforeAfterMetrics = {
  nodeCountBefore: number;
  nodeCountAfter: number;
  humanExecutionNodesBefore: number;
  humanExecutionNodesAfter: number;
  waitingPointsBefore: number;
  waitingPointsAfter: number;
  approvalRoundsBefore: number;
  approvalRoundsAfter: number;
  aiTakeoverNodesAfter: number;
  validationSignalsBefore: number;
  validationSignalsAfter: number;
  memoryAssetsBefore: number;
  memoryAssetsAfter: number;
  estimatedCycleBefore?: string;
  estimatedCycleAfter?: string;
  confidence: "high" | "medium" | "low";
};

export type ProcessTransformation = {
  generatedAt: string;
  legacyNodes: LegacyWorkflowNode[];
  breakpoints: WorkflowBreakpoint[];
  moves: LoopTransformationMove[];
  beforeAfter: BeforeAfterMetrics;
  conceptBridge: Array<{
    oldTerm: string;
    newTerm: string;
    explanation: string;
  }>;
};
```

`LoopPlan` 增加可选字段：

```ts
processTransformation?: ProcessTransformation;
```

### 9.2 P1 表：loop_os_evolution_events

P1 需要资产级追加记录，建议新增通用演化事件表，而不是只为固定轮次试运行建窄表。

```sql
create table public.loop_os_evolution_events (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  asset_id uuid not null references public.loop_os_assets(id) on delete cascade,
  version_id uuid references public.loop_os_versions(id) on delete set null,
  event_type text not null check (event_type in (
    'run_round',
    'version_released',
    'validation_result',
    'guardrail_update',
    'memory_lesson',
    'interface_change'
  )),
  run_sequence int check (run_sequence is null or run_sequence > 0),
  run_mode text check (run_mode is null or run_mode in ('trial', 'production')),
  payload jsonb not null,
  created_by uuid not null references public.loop_designer_users(id) on delete restrict,
  created_at timestamptz not null default now()
);
```

`run_round` payload:

```ts
export type RunRoundPayload = {
  runSequence: number;
  runMode: "trial" | "production";
  loopVersionId: string;
  goal: string;
  metricSnapshot: Array<{
    name: string;
    before?: string;
    current: string;
    target?: string;
  }>;
  incidents: string[];
  validatedLearning: string;
  nextChange: string;
  workflowChanged: boolean;
  acceptanceScriptChanged: boolean;
  guardrailChanged: boolean;
  interfaceChanged: boolean;
  trueLoopSignal: "strong" | "partial" | "missing";
  releaseRecommendation: "continue_trial" | "release_production" | "keep_production" | "pause";
};
```

`version_released` payload:

```ts
export type LoopRunReleasePayload = {
  loopVersionId: string;
  releaseStage: "trial" | "production";
  releaseReason: string;
  readinessEvidence: string[];
  ownerRole: string;
  releaseAt: string;
};
```

### 9.3 P2 表：loop_os_interface_protocols

P2 不建议把接口协议全部塞进 `loop_os_relationships`，因为协议需要版本。

```sql
create table public.loop_os_interface_protocols (
  id uuid primary key default gen_random_uuid(),
  enterprise_id uuid not null references public.loop_designer_enterprises(id) on delete cascade,
  relationship_id uuid not null references public.loop_os_relationships(id) on delete cascade,
  version_number int not null check (version_number > 0),
  coupling_type text not null check (coupling_type in ('hard', 'soft', 'feedback')),
  semantic_protocol jsonb not null,
  structural_protocol jsonb not null,
  governance_protocol jsonb not null,
  status text not null default 'draft' check (status in ('draft', 'active', 'deprecated')),
  change_reason text,
  created_by uuid not null references public.loop_designer_users(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(relationship_id, version_number)
);
```

协议类型：

```ts
export type InterfaceProtocol = {
  couplingType: "hard" | "soft" | "feedback";
  semanticProtocol: {
    meaning: string;
    consumptionRule: string;
    confidenceRule?: string;
  };
  structuralProtocol: {
    dataObject: string;
    requiredFields: string[];
    optionalFields: string[];
    version: string;
    sourceOfTruth: string;
  };
  governanceProtocol: {
    ownerRole: string;
    acceptanceRole: string;
    failureReturnPath: string;
    changeNotice: string;
    emergencyRule: string;
  };
};
```

### 9.4 P3 模板扩展

优先扩展现有 `industry-loop-template-data.json`，不新增表。

模板增加：

```ts
type IndustryBeforeAfterTemplate = {
  legacyFlow: LegacyWorkflowNode[];
  expectedBreakpoints: WorkflowBreakpoint[];
  transformationMoves: LoopTransformationMove[];
  beforeAfter: BeforeAfterMetrics;
  facilitatorNotes: string[];
};
```

## 10. API 设计

### P0 APIs

```txt
POST /api/sessions/:sessionId/legacy-flow
PATCH /api/sessions/:sessionId/legacy-flow
POST /api/sessions/:sessionId/breakpoint-scan
PATCH /api/sessions/:sessionId/breakpoints/:breakpointId
POST /api/sessions/:sessionId/transformation-preview
```

说明：

- `legacy-flow` 保存旧流程节点，可复用现有 session JSONB。
- `breakpoint-scan` 返回断点，不直接生成完整方案。
- 用户可以确认、忽略或修改断点。
- `transformation-preview` 生成 Before/After 对比和建议动作。
- 最终 `generate` 使用已确认断点和重构动作作为上下文。

### P1 APIs

```txt
GET /api/loop-assets/:assetId/evolution-events
POST /api/loop-assets/:assetId/evolution-events
GET /api/loop-assets/:assetId/run-summary
POST /api/loop-assets/:assetId/releases
```

### P2 APIs

```txt
GET /api/loop-assets/:assetId/interface-protocols
POST /api/loop-relationships/:relationshipId/interface-protocols
PATCH /api/interface-protocols/:protocolId/status
```

### P3 APIs

无需新增 API。模板可通过现有模板读取逻辑扩展。

## 11. 断点扫描规则

断点扫描采用“规则优先 + 模型补充”的混合策略。P0 首版应保证规则扫描可用，模型只用于补充诊断文案和重构建议。

### 11.1 信息塌缩规则

命中线索：

- action / output 包含：汇总、整理、摘要、转述、上报、同步、会议纪要、口头确认。
- input 明显多源，但 output 字段很少。
- minimum fields 或 acceptance 缺失。
- 下游需要重新确认。

### 11.2 等待黑洞规则

命中线索：

- waitFor / approval / painNote 包含：审批、排期、等、确认、协调、供应商、IT、信息中心、跨部门。
- 未填写 SLA、超时升级或替代路径。
- owner 与 decision 不一致，且没有授权规则。

### 11.3 验证真空规则

命中线索：

- acceptance 只写“完成/交付/发送/提交”，没有结果指标。
- verification 为空。
- output 没有进入下一轮输入。
- businessGoal.successSignal 与任何节点无连接。

## 12. 生成提示词调整

`SYSTEM_PROMPT` 增加规则：

1. 先基于用户旧流程识别信息塌缩、等待黑洞、验证真空，不要直接把旧流程改写成 To-Be。
2. 每个 To-Be 回路单元必须能追溯到一个旧流程节点或一个重构动作。
3. 对每个删除、合并、AI 接手、人退到边界、增加验证、增加记忆的动作写明理由。
4. 结果必须包含 `processTransformation`，用于首屏 Before/After 展示。
5. 没有真实运行数据时，Before/After 的周期变化必须标记为 low confidence。
6. 不要把“流程更短”本身当成成功；必须说明验证信号和记忆资产如何增加。

输出结构增加：

```json
{
  "processTransformation": {
    "generatedAt": "string",
    "legacyNodes": [],
    "breakpoints": [],
    "moves": [],
    "beforeAfter": {},
    "conceptBridge": []
  }
}
```

## 13. 前端组件

### 新增组件

```txt
src/components/legacy-flow-composer.tsx
src/components/breakpoint-scan-panel.tsx
src/components/transformation-preview.tsx
src/components/before-after-summary.tsx
src/components/loop-run-board.tsx
src/components/loop-release-panel.tsx
src/components/interface-protocol-panel.tsx
src/components/loop-owner-card.tsx
```

### 修改组件

```txt
src/components/designer-workspace.tsx
src/components/loop-asset-board.tsx
src/app/assets/[assetId]/page.tsx
src/lib/plan-schema.ts
src/lib/model.ts
src/lib/markdown.ts
src/lib/matrix-study-payload.ts
```

## 14. 导出与 Matrix 回流

Markdown / PDF / 飞书导出增加：

- 旧流程 vs 新回路。
- 三类断点扫描。
- 重构动作表。
- 运行记录建议与发布条件。

Matrix `methodologyAnalysis` 增加：

```ts
processTransformation?: ProcessTransformation;
runSummary?: {
  completedRuns: number;
  latestRunMode: "trial" | "production";
  trueLoopSignal: "strong" | "partial" | "missing";
  validatedLearnings: string[];
  releaseStage?: "trial" | "production";
};
```

边界保持不变：

- Loop Designer 只提交审阅证据和候选建议。
- 不自动修改 Matrix 拓扑。
- 不自动扩大权限。
- 不自动发布版本。

## 15. 权限与安全

- 所有新 API 必须通过 `requireUser`。
- 所有查询必须按 `enterprise_id` 过滤。
- 断点扫描可以基于草稿 session 运行，但只有确认后的资产才进入组织记忆。
- 运行记录只允许企业成员写入；后续可增加 admin/owner 限制。
- 正式运行版发布建议要求 admin/owner 权限，或至少记录发布人和发布理由。
- 接口协议状态切换为 `active` 时，建议要求 admin/owner 权限。

## 16. 测试计划

### 单元测试

- `breakpoint-scan-core.test.ts`
  - 信息塌缩命中。
  - 等待黑洞命中。
  - 验证真空命中。
  - 用户忽略断点后不进入生成上下文。
- `before-after-metrics.test.ts`
  - 节点数、人参与节点、等待点、验证信号、记忆资产统计正确。
- `plan-schema.test.ts`
  - `processTransformation` 可选字段校验。
- `evolution-events.test.ts`
  - 连续运行记录 payload 校验。
  - 试运行版和正式运行版发布 payload 校验。
- `interface-protocols.test.ts`
  - 协议版本唯一性和 active/deprecated 规则。

### API 测试

- 未登录访问返回 401/重定向。
- 跨企业 session / asset 访问被拒绝。
- 无 legacy flow 时扫描返回可解释错误。
- 重复提交 run round 不覆盖历史事件。

### 产品验收

P0 验收：

- 用户能先输入旧流程，不需要理解回路术语。
- 系统能标出三类断点，并允许用户确认/忽略。
- 生成结果首屏能展示 Before/After。
- 导出内容包含断点和改造动作。

P1 验收：

- 回路资产详情页能持续记录每一轮运行。
- 每轮后能生成“真回路信号”阶段判断。
- 用户可以发布试运行版，并在证据满足后发布正式运行版。

P2 验收：

- 依赖关系可以绑定接口协议版本。
- 资产台能展示硬/软/回灌咬合。

P3 验收：

- 至少 3 个行业模板含 Before/After 样板。
- 用户可以从模板载入旧流程并查看断点样例。

## 17. 迭代顺序

### Milestone 1：P0 输入与扫描

- 增加旧流程输入。
- 增加本地断点扫描。
- 增加断点确认 UI。

### Milestone 2：P0 生成与展示

- 扩展 `LoopPlan`。
- 更新模型提示词。
- 结果页增加 Before/After 首屏。
- 导出增加断点与重构内容。

### Milestone 3：P1 运行记录与版本发布

- 新增 `loop_os_evolution_events`。
- 资产详情页增加运行记录与发布面板。
- 生成 run summary。

### Milestone 4：P2 接口协议

- 新增 `loop_os_interface_protocols`。
- 关系详情增加协议版本。
- 资产台增加接口风险提醒。

### Milestone 5：P3 样板与角色卡

- 扩展行业模板。
- 增加回路负责人角色卡。
- 增加 Day 0 / Day 7 / Day 30 / Day 90 过渡路线。

## 18. 风险与控制

| 风险 | 表现 | 控制方式 |
|---|---|---|
| 用户输入负担变重 | 觉得比原来更复杂 | P0 只要求 3-7 个旧流程节点，详细字段可选 |
| 断点误判 | 用户不认可系统判断 | 每个断点必须可忽略、可编辑、可补证据 |
| 又变成流程图工具 | 用户只画节点不理解回路 | 首屏强制展示断点、重构动作和验证信号 |
| AI 编造运行效果 | 声称周期缩短但无数据 | 无真实数据时标记 low confidence |
| 概念再次膨胀 | 回路、本体、三螺旋同时出现 | P0 用户端只出现流程、断点、回路、验证、记忆 |
| 过早做复杂系统集成 | 开发周期失控 | P0/P1 不接外部运行数据，只做手动记录 |

## 19. 文案原则

用户端优先使用旧词桥接：

| 旧词 | 新词 | 解释 |
|---|---|---|
| 流程 | 回路 | 不只是流转，还要验证和回灌 |
| 审批 | 护栏 | 不逐条卡住，而是定义边界和异常 |
| 复盘 | 记忆 | 不只开会总结，而是沉淀到下轮可复用 |
| 岗位 | 角色 | 不按 title 分工，按能力和责任边界分工 |
| 报表 | 验证信号 | 不只是看数据，而是触发下一轮动作 |

避免在 P0 主路径里使用：

- 业务本体。
- 三螺旋。
- 混合智能细胞。
- 组织大脑。
- FDE。

需要表达 FDE 时，先使用“回路负责人”：

> 回路负责人不是新岗位名称，而是一类能力：懂业务、能识别断点、能设定验证标准、能让 AI 接手部分节点，并保留人的裁决边界。

## 20. 最终判断

这次迭代的关键不是新增一个功能，而是重建 Loop Designer 的第一体验。

旧体验是：用户描述业务，系统生成方案。

新体验应该是：用户画出旧流程，系统指出它为什么不是回路，再陪用户把它改造成能验证、能记忆、能迭代的新回路。

只要 P0 做扎实，用户会直接看到回路独有价值：

- 不是画出更多节点，而是找出断点。
- 不是缩短流程本身，而是减少信息衰减和等待。
- 不是交付结束，而是验证回灌。
- 不是人被替代，而是人从执行者退到目标、边界、验收和异常裁决。
- 不是一次性方案，而是能在每一轮运行后继续变聪明的组织资产。
