# Loop OS v1.0 Design: 组织级回路资产与记忆底座

## 1. 已确认方向

本版本将 Loop Designer 升级为独立的 Loop OS 回路资产系统。它不并入 Matrix Origin，也不直接读写 Matrix Origin 的数据库。两者通过签名 API、启动票据、DesignStudy、ChangeSet 和稳定实体引用耦合。

核心判断：

- Loop OS 负责企业回路资产、回路版本、回路关系、组织记忆和生成上下文。
- Matrix Origin 负责组织网络事实、Cell/Circuit/Interface 拓扑、运行信号、ChangeSet 审阅和发布。
- 数据打通不是共用业务表，而是共享身份、共享引用、共享审阅协议和可追踪回流。

本版本的目标不是做完整组织智能体，而是让企业第一次拥有一套可沉淀、可管理、可复用的回路资产网络。

## 2. 非目标

v1.0 不做以下能力：

- pgvector 语义检索。
- 自动生成自然语言 OrgSummary。
- 记忆衰减和遗忘权重模型。
- 运行信号自动改变回路资产或 Matrix 拓扑。
- 影响模拟和断链沙盘推演。
- 共享角色深度分析。
- Matrix Origin SIGNALS / BECOMING 的完整改造。
- 两个应用共用同一套业务数据库表。

这些能力进入 v1.1/v1.2。v1.0 先解决“回路资产能否留下来，并被下一次设计复用”。

## 3. 成功标准

P0 成功标准：

1. 企业管理员能看到企业内已确认的所有回路资产，而不是只看到个人 session。
2. 用户可以把一次生成结果沉淀为 `LoopAsset`，并保留来源 session、创建意图、成熟度诊断和版本记录。
3. 回路资产支持父子关系和依赖关系，首版提供卡片矩阵和轻量拓扑。
4. `OrgProfile v1` 从已确认回路资产中计算角色库、术语、成熟度分布、常见依赖和短板维度。
5. 新建或迭代回路时，系统把 `OrgProfile v1` 和同域参考回路注入生成上下文。
6. Matrix Origin 能从目标 Circuit 启动 Loop OS 深度设计；Loop OS 能把设计结果作为 DesignStudy 回流 Matrix。
7. Matrix 仍然通过 Mapping Review 和 ChangeSet 审阅发布，不被 Loop OS 自动改拓扑、改权限或发布版本。

## 4. 核心对象

### 4.1 LoopAsset

`LoopAsset` 是企业级回路资产，不等同于一次生成 session。session 记录访谈和生成过程，asset 记录被企业确认后可长期管理的回路事实。

建议字段：

```ts
type LoopAsset = {
  id: string;
  enterpriseId: string;
  title: string;
  domain: string;
  status: "incubating" | "active" | "dormant" | "retired";
  currentVersionId: string;
  sourceSessionId?: string;
  matrixWorkspaceId?: string;
  matrixCircuitLogicalId?: string;
  matrixBaseVersionId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};
```

关键规则：

- 只有用户明确“沉淀为回路资产”后，session 中的 `currentPlan` 才进入资产层。
- 未确认的模型输出不进入组织记忆。
- `matrixCircuitLogicalId` 是引用，不是所有权转移。

### 4.2 LoopVersion

`LoopVersion` 保存每次可审阅的回路版本。

```ts
type LoopVersion = {
  id: string;
  assetId: string;
  versionNumber: number;
  plan: LoopPlan;
  maturityMapping?: LoopMaturityMapping;
  birthCertificate?: LoopBirthCertificate;
  sourceSessionVersionId?: string;
  changeReason?: string;
  createdBy: string;
  createdAt: string;
};
```

关键规则：

- 当前 `session.outputs.versions` 继续作为生成过程版本；沉淀后复制为资产版本。
- 资产版本不可原地覆盖，只追加新版本。
- Matrix 回流时使用资产版本 ID 形成幂等键。

### 4.3 LoopBirthCertificate

出生证记录“为什么创建这条回路”，用于冷启动记忆。

```ts
type LoopBirthCertificate = {
  intent: string;
  source: "manual" | "questionnaire" | "blueprint" | "matrix_origin";
  references: string[];
  lessonsFromHistory: string[];
  expectedMaturity?: MaturityLevel;
  createdAt: string;
  creatorId: string;
};
```

v1.0 中 `lessonsFromHistory` 可以由规则生成：同域回路、常见角色、常见短板、已有依赖。不要依赖模型总结作为唯一事实。

### 4.4 LoopRelationship

回路关系首版支持两类：

```ts
type LoopRelationship = {
  id: string;
  enterpriseId: string;
  sourceAssetId: string;
  targetAssetId: string;
  type: "parent_child" | "dependency";
  direction?: "source_to_target";
  interfaceName?: string;
  strength?: "critical" | "important" | "nice_to_have";
  createdBy: string;
  createdAt: string;
};
```

父子关系限制最大 3 层。依赖关系必须有 `interfaceName`，否则无法用于断链或关键度判断。

### 4.5 OrgProfile v1

`OrgProfile v1` 是结构化组织记忆，不是自然语言总结。

```ts
type OrgProfileV1 = {
  enterpriseId: string;
  loopCount: number;
  maturityDistribution: Record<MaturityLevel, number>;
  humanRoles: string[];
  agentRoles: string[];
  systemRoles: string[];
  glossary: Record<string, string>;
  commonDependencies: Array<{
    sourceDomain: string;
    targetDomain: string;
    interfaceName: string;
    frequency: number;
  }>;
  weakDimensions: Array<{
    dimension: MaturityDimension;
    frequency: number;
  }>;
  updatedAt: string;
};
```

计算来源只包括：

- `LoopAsset.status in ("incubating", "active", "dormant")`
- 对应 `LoopVersion.currentVersionId`
- `LoopPlan.organizationMap`
- 本地算法生成的 `maturityMapping`
- 已确认的 `LoopRelationship`

退役回路可以展示，但不参与默认注入。

## 5. 主要流程

### 5.1 Session 沉淀为资产

1. 用户完成当前 Loop Designer 生成。
2. 页面显示“沉淀为企业回路资产”动作。
3. 服务端校验 session 属于当前企业，且存在 `currentPlan`。
4. 创建 `LoopAsset` 和首个 `LoopVersion`。
5. 记录出生证。
6. 异步或请求末尾重算 `OrgProfile v1`。
7. 返回资产详情页。

验证：

- 同一个 session 重复点击不会创建重复资产。
- 没有 `currentPlan` 的 session 不能沉淀。
- 只有企业内授权用户能沉淀资产。

### 5.2 企业回路资产台

入口建议放在首页一级能力区，不藏在 session 详情里。

首版视图：

- 卡片矩阵：按成熟度、活跃状态、领域筛选。
- 轻量拓扑：展示父子和依赖，不承诺复杂图编辑。
- 资产详情：展示当前版本、成熟度诊断、出生证、依赖、Matrix 引用和版本记录。

首版操作：

- 新建资产。
- 从 session 沉淀资产。
- 编辑资产状态。
- 新增父子关系。
- 新增依赖关系。
- 从资产启动一次迭代 session。

### 5.3 组织记忆注入

生成前新增 `buildOrgContext(enterpriseId, draft)`：

1. 读取 `OrgProfile v1`。
2. 通过 `domain` 和标签匹配 0-3 条参考回路。
3. 组装生成上下文：
   - 组织角色库。
   - 组织术语。
   - 常见依赖。
   - 同域参考回路摘要。
   - 组织短板维度。
4. 控制上下文长度，超限时优先保留角色库、术语、常见依赖。

规则：

- 参考回路是参考，不是模板。
- UI 提供“从空白开始”选项。
- 如果企业不足 2 条资产，只注入角色库、术语和出生证，不伪造相似回路。

### 5.4 Matrix Origin 耦合

现有 Matrix 启动 Loop Designer 的票据机制保留。v1.0 增加资产引用：

- 从 Matrix Circuit 启动时，如果已有绑定 `LoopAsset`，打开该资产的迭代 session。
- 如果没有绑定，创建新 session，并在沉淀资产时写入 `matrixWorkspaceId`、`matrixCircuitLogicalId`、`matrixBaseVersionId`。
- Loop OS 提交 Matrix 时，继续走 `CircuitDesignStudyPayload.methodologyAnalysis` 和 `proposedOperations`。
- Matrix 只接受签名请求，并校验 `baseVersionId` 未过期。

禁止：

- Loop OS 直接创建 Matrix Cell。
- Loop OS 直接发布 Matrix NetworkVersion。
- Loop OS 绕过 Mapping Review 自动确认 Actor、Participation 或 Interface。

## 6. API 草案

Loop OS 内部 API：

```ts
POST /api/loop-assets
GET /api/loop-assets
GET /api/loop-assets/:assetId
POST /api/loop-assets/:assetId/versions
POST /api/loop-assets/:assetId/relationships
GET /api/org-profile
POST /api/memory/context
```

关键约束：

- 所有资产 API 必须按 `enterprise_id` 过滤。
- 写操作需要企业成员身份，敏感操作需要 admin 或 owner。
- `POST /api/loop-assets` 支持 `sourceSessionId` 幂等创建。
- `POST /api/memory/context` 只返回注入上下文，不直接调用模型。

Matrix 相关 API：

```ts
POST /api/integrations/matrix-origin/launch
POST /api/integrations/matrix-origin/design-studies
```

保持现有边界：Loop OS 是设计工作台，Matrix 是组织事实和治理发布系统。

## 7. 数据迁移策略

新增表建议使用 `loop_os_*` 前缀，避免和旧 `loop_designer_sessions` 混淆：

- `loop_os_assets`
- `loop_os_versions`
- `loop_os_relationships`
- `loop_os_org_profiles`

迁移不自动把历史 session 全量转成资产。首版提供“从历史 session 沉淀”操作，由用户挑选确认。

原因：

- 历史 session 里可能有草稿、测试、重复生成。
- 组织记忆必须基于企业确认过的资产。
- 自动迁移会污染角色库和短板统计。

## 8. UI 结构

首页新增一级入口：

- 业务回路设计：保留现有单回路生成流程。
- 回路资产台：进入组织级管理。
- 组织记忆：展示 OrgProfile v1 的可解释摘要。

资产详情页结构：

1. 顶部：标题、状态、领域、成熟度、Matrix 绑定状态。
2. 诊断：复用当前成熟度面板。
3. 出生证：创建意图、来源、参考、历史经验。
4. 关系：父子回路、依赖回路、接口名称和强度。
5. 版本：资产版本历史，支持从某版本发起迭代。
6. Matrix：提交为 DesignStudy、查看回流状态、返回 Matrix 审阅。

## 9. 异常与治理

错误处理：

- Matrix base version 过期：提示“Matrix 已有新版本，请从 Matrix 重新进入”。
- 资产已绑定另一个 Circuit：阻止覆盖，要求用户显式解除或新建资产。
- 关系成环：拒绝保存父子关系；依赖关系允许有向环但标记为预警。
- OrgProfile 计算失败：不阻塞资产创建，展示最近一次成功画像和更新时间。
- 记忆上下文为空：退化为行业模板和当前输入。

治理边界：

- 组织记忆只影响生成上下文，不作为成熟度评分依据。
- 成熟度仍由本地算法和证据链计算。
- 运行信号只能成为诊断或 Tension 的证据，不直接改资产或拓扑。

## 10. 测试与验收

单元测试：

- `LoopAsset` schema 和权限过滤。
- session 到 asset 的幂等沉淀。
- `OrgProfile v1` 聚合角色、成熟度分布、弱维度和依赖。
- `buildOrgContext` 在 0/1/3/5 条资产下的降级行为。
- 父子关系防环。

集成测试：

- 生成回路 -> 沉淀资产 -> 资产出现在企业资产台。
- 创建依赖 -> 卡片矩阵和拓扑同时更新。
- 从资产启动迭代 session -> 新版本回写资产。
- Matrix 启动 -> Loop OS 生成/迭代 -> DesignStudy 回流 -> Matrix Mapping Review。

手工验收：

- 企业管理员能看到组织级资产，普通用户不能越权看其他企业。
- 老 session 不会自动污染资产库。
- 没有任何路径会绕过 Matrix ChangeSet 审阅。
- 组织记忆注入后，新回路使用企业已有角色和术语，而不是通用岗位称谓。

## 11. 分阶段实施

### Slice 1: 资产底座

- 新增 `loop_os_assets`、`loop_os_versions`。
- 从 session 沉淀资产。
- 资产列表和资产详情。
- 测试幂等和企业隔离。

### Slice 2: 关系网络

- 新增 `loop_os_relationships`。
- 支持父子和依赖关系。
- 卡片矩阵和轻量拓扑。
- 增加孤立回路、依赖集中、父子成熟度倒挂三条预警。

### Slice 3: 组织记忆

- 新增 `loop_os_org_profiles`。
- 资产创建和版本更新后重算画像。
- 生成时注入组织角色库、术语、常见依赖和同域参考。
- 保留“从空白开始”。

### Slice 4: Matrix 耦合增强

- Matrix launch 时识别已有资产绑定。
- DesignStudy payload 增加 `loopAssetId` 和 `loopVersionId`。
- 资产详情展示 Matrix 审阅状态。
- 继续保持 Matrix 人工确认边界。

## 12. 版本之后

v1.1：

- pgvector 相似回路检索。
- 自动 OrgSummary。
- 演化日志可视化。
- 仪表盘。

v1.2：

- 记忆衰减。
- 影响模拟。
- 运行信号进入 Tension。
- 共享角色分析。

v2：

- 组织智能体层。
- 跨回路自动提案。
- 基于 Matrix BECOMING 的连续演化路线。
