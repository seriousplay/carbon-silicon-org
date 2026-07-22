# 主线程 → Codex 交接说明

> **日期**：2026-07-12
> **作者**：主线程（原始架构师）
> **目的**：通报我做的修改 + 审查发现 + 合并安全建议

---

## 一、我做了什么

### 安全检查点
- commit `e3ebe2d`：包含 Codex 全部工程成果的快照
- 无代码修改，仅 git add + commit + push

### 审查范围
对 Codex 的 20+ 小时工程成果做了全面代码审查，覆盖：
- 210 个 TS/TSX 文件（131,137 行）
- 32 个 Prisma 模型 + 16 个迁移
- 21 个测试文件（169 个用例，1 个失败）
- interface-workbench 子系统（5,366 行）
- domain-operations.ts（951 行）+ governance-decision.ts（921 行）
- GOALS.md（4,214 行）

---

## 二、关键发现

### 🔴 governance-decision.ts 零 UI 接入

**`src/lib/governance-decision.ts`（921 行，12 个导出函数）在全仓库中除测试文件外零引用。**

UI 的治理提案采纳仍走 `governance-engine.ts`（旧版，270 行），不调用 Codex 新版治理决策引擎。

### 根因分析

Codex 的 `executeGovernanceDecisionOperation` 要求 `GovernanceDecisionInput` 包含：
- `runId`（接口工作流运行 ID）
- `proposalArtifactId`（工作流产物 ID）
- `routeArtifactId`（路由产物 ID）
- `routeNodeId` + `routeNodeVisit`（路由节点信息）

**这些字段全部来自 interface-workbench 子系统**。Codex 的治理决策引擎与工作流引擎深度耦合——不能直接用于普通治理会议（非工作流路由的）提案。

### 接通策略建议

**方案 A（推荐）**：解耦 governance-decision.ts，让它支持不带 runId 的普通治理提案
- `GovernanceDecisionInput.runId` 改为可选
- 当无 runId 时，跳过工作流产物路由逻辑
- `resolveRoutedGovernanceCandidateForDecision` 增加非路由路径

**方案 B**：在 UI 层创建适配层，把普通治理提案包装成工作流格式
- 需要在创建提案时自动创建一个虚拟的 InterfaceWorkflowRun
- 更复杂，但不动 Codex 的核心设计

### 🔴 1 个测试失败

`src/lib/interface-workbench/__tests__/bounds.test.ts` 第 4 个测试：
`runtime models remain outside this foundation` — 期望 schema 中不含 runtime 模型但实际包含。

**建议**：更新测试期望值或隔离 runtime 模型。

### 🟡 schema 与数据库不一致

- Prisma schema：32 个模型
- 实际数据库：29 张表
- 未应用迁移：`g3_i2c_gd1_governance_decision` 等

**建议**：在合并前运行 `npx prisma migrate dev`。

---

## 三、我对治理 UI 的修改计划

我将在 `proposal-actions.ts` 中**保留旧版 `adoptProposal` 作为 fallback**，同时在 `governance-workbench.tsx` 中增强 UI 交互——加入完整的 Holacracy 三步法：

1. **提案提交**：用户选择提案类型（角色新增/修改/废弃），填写结构化修改内容
2. **澄清环节**：其他参会人可提出澄清问题
3. **反对环节**：参会人可提出反对（含四要素：实质性损害/事实vs担忧/可逆性/安全尝试）
4. **采纳**：无有效反对时采纳，自动执行结构修改 + 审计

**不会修改 Codex 的 governance-decision.ts**——那是你的领域。我只在 UI 层做接通。

---

## 四、合并安全建议

### 安全合并的部分
- `src/lib/domain-operations.ts`：大部分函数已被 server actions 接通，运行良好
- `src/lib/interface-workbench/`：独立子系统，有完整测试
- `src/app/app/interfaces/` 页面：可独立运行
- `src/app/app/projects/` 页面：独立，已接通
- GOALS.md：协调文档，不影响代码

### 需要注意合并冲突的部分
- `src/app/app/meetings/[id]/page.tsx`：我修改了工作台区块（区分 GOVERNANCE/TACTICAL）
- `src/app/app/meetings/[id]/proposal-actions.ts`：我创建了初始版本，Codex 可能有修改
- `prisma/schema.prisma`：双方都加了模型，需要对齐

### 建议给 Codex 的指令
1. **不要删除** `governance-engine.ts`——UI 当前依赖它
2. **解耦** `governance-decision.ts` 的 `GovernanceDecisionInput`，让 runId 可选
3. **修复** `bounds.test.ts` 的失败测试
4. **同步** 数据库迁移

---

## 五、项目健康状况

| 维度 | 评分 | 说明 |
|------|------|------|
| TypeScript 编译 | ✅ 零错误 | |
| Dev server 启动 | ✅ 正常 | |
| 核心测试 | ✅ 168/169 通过 | 1 个 bounds 失败 |
| 治理领域逻辑 | ⭐⭐⭐⭐⭐ | Codex 的设计非常严谨 |
| 治理 UI 接通 | ⭐⭐ | 领域逻辑完善但 UI 走旧版 |
| interface-workbench | ⭐⭐⭐⭐ | 工程质量高但过度复杂 |
| 可维护性 | ⭐⭐⭐ | GOALS.md 过长，部分代码是孤岛 |
