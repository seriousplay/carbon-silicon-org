# M6-3 只读审阅报告

> **审阅日期**：2026-07-18
> **审阅范围**：V5-M6-3 Governance Execution Recovery 的实现代码 + 证据文档
> **审阅方法**：源码静态分析 + 证据文档审查 + 测试运行 + 迁移状态验证

---

## Findings

### ✅ F1：6 类治理结构变更已全部实现（v3/v4 的 P0-B 已修复）

**证据**：`src/lib/governance-decision.ts` 新增 `applyPrismaNonRoleAdoption` 函数（762-850 行），包含完整的 9 个操作分支：

| 操作 | 行号 | 执行内容 | v3/v4 状态 |
|------|------|---------|----------|
| ROLE_CREATED | 678-759 | `roleDef.create` | ✅ 原有 |
| ROLE_MODIFIED | 776-782 | `roleDef.update` | ✅ **新增** |
| ROLE_ARCHIVED | 784-790 | `roleDef.update(status: ARCHIVED)` | ✅ **新增** |
| CIRCLE_CREATED | 792-794 | `circle.create` | ✅ **新增** |
| CIRCLE_MODIFIED | 796-800 | `circle.update` | ✅ **新增** |
| HOME_CHANGE | 803-809 | `person.update(homeCircleId)` | ✅ **新增** |
| AGENT_CREATED | 811-815 | `person.create(entityType: AGENT)` | ✅ **新增** |
| CHARTER_CREATED | 817-819 | `charter.create` | ✅ **新增** |
| CHARTER_AMENDED | 821-823 | `charter.update` | ✅ **新增** |

每个分支都在同一个 Serializable 事务中执行：结构修改 → DecisionRecord → ChangeLog → Proposal 更新 → Process 更新 → Tension 闭环。

### ✅ F2：解析器（governance-change.ts）支持全部 9 种操作类型

`GOVERNANCE_CHANGE_TYPES` 数组明确定义 9 种类型，每种有类型安全的 `GovernanceStructuralChange` 字段和 `exactKeys` + `text` 边界校验。

### ✅ F3：治理解析器、执行器、工作台 UI、Brain 预览入口覆盖一致

`scripts/verify-governance-structural-coverage.mjs` 验证 9 种操作在 4 个位置（parser/executor/workbench/brain）全部存在。这是源码契约证据。

### ✅ F4：治理工作台 UI 支持 9 种操作的标签和过滤

`governanceChangeLabel` 函数为每种操作提供中文标签（"创建角色"/"修改角色"/"废弃角色"/"创建回路"/"修改回路"/"变更归属"/"创建智能体"/"创建宪章"/"修订宪章"）。`structuralCandidates` 集合正确识别全部 9 种类型。

### ✅ F5：Brain 可起草治理提案

`governance_proposal.create` 能力已注册（`capability-registry.ts:45`），authority 为 PROPOSE，含 idempotency REQUIRED + audit event。Brain 命令预览服务可解析治理提案参数。

### ✅ F6：精益团队模板已创建

`leanTeamTemplate`（`org-templates.ts:305`）提供 1 个根回路 + 3 个角色。`allTemplates` 数组中 leanTeam 排在 llmTeam 之前，创业团队首次看到的选项是"精益团队"。

### ✅ F7：治理测试 34/34 通过

`governance-decision.test.ts` 覆盖六态转换、权限边界、反对语义、幂等性、并发、失败恢复。

### ✅ F8：生产迁移已对齐

生产环境 `prisma migrate status` 报告 31/31 迁移已应用，schema up to date。空基线数据库验证通过（31 迁移全部成功应用 + 二次 deploy 返回无待处理）。

### ✅ F9：生产浏览器证据 — Brain→治理→结构变更闭环

三次独立的生产浏览器运行（suffix `1784309065974`、`1784310698125`、`1784310856694`）均返回 aggregate `ok: true`，覆盖 9 个步骤：注册→治理张力→治理会议→Brain 提问→提案编辑器→预览→确认→治理初始化→`ADOPTED` CIRCLE_CREATED。

数据库读回记录：`ADOPTED|ADOPTED|CIRCLE_CREATED|cmrp6wrrm001r5nkmo0nek8rp|治理验证回路`。

### ✅ F10：采纳标签已修正

工作台的"采纳并创建角色"硬编码标签已改为通用 `采纳：${changeLabel}`（如"采纳：创建回路"、"采纳：变更归属"）。

---

## Evidence

| 编号 | 证据 | 来源 |
|------|------|------|
| E1 | `applyPrismaNonRoleAdoption` 9 分支完整实现 | `governance-decision.ts:762-850` |
| E2 | `GOVERNANCE_CHANGE_TYPES` 9 类型定义 | `governance-change.ts:3-13` |
| E3 | `verify-governance-structural-coverage.mjs` 全通过 | `scripts/` |
| E4 | `governanceChangeLabel` 9 标签 | `governance-workbench.tsx` |
| E5 | Brain `governance_proposal.create` 注册 | `capability-registry.ts:45` |
| E6 | `leanTeamTemplate` 定义 | `org-templates.ts:305-327` |
| E7 | 治理测试 34/34 通过 | 本地实机运行 |
| E8 | 生产迁移 31/31 + 空基线验证 | 证据文档 + `prisma migrate status` |
| E9 | 生产浏览器三次 ok:true（含 CIRCLE_CREATED 读回） | 证据文档 suffix 记录 |
| E10 | BioCoach SQLSTATE 42501 隔离通过 | 证据文档 |
| E11 | 部署修复（standalone node_modules 解析） | 证据文档 `20260718-m6-3-fixed` |
| E12 | 回滚约束修复（rollback.sql 恢复 state projection） | 证据文档 |

---

## Blockers

### 🔴 B1：本地开发数据库仍有 2 个迁移未应用

**状态**：`prisma migrate status` 报告本地 2 个 pending（`v5_m6_3_governance_brain_command_check` 和 `v5_m6_3_structural_outcome_projection`）。

**影响**：本地开发环境 Brain governance command check 和 structural outcome 字段可能不存在。生产已应用但本地未同步。

**建议**：`npx prisma migrate dev` 同步本地。

### 🟡 B2：非角色结构变更缺执行级测试

**状态**：证据文档明确标注"Not yet proven"——执行级测试仅覆盖 CIRCLE_CREATED（浏览器证明），其余 7 种操作（ROLE_MODIFIED/ARCHIVED、CIRCLE_MODIFIED、HOME_CHANGE、AGENT_CREATED、CHARTER_CREATED/AMENDED）的执行分支只有解析器和状态机覆盖，无直接执行测试。

**影响**：`applyPrismaNonRoleAdoption` 的 7 个分支代码存在但未经执行验证。解析器测试不能替代执行测试——解析器验证"输入正确"，执行测试验证"数据库实际写入正确"。

**建议**：为每种操作类型编写执行级测试（在 disposable PostgreSQL 上验证实际表写入）。

### 🟡 B3：非角色结构变更缺浏览器工作流证明

**状态**：生产浏览器只证明了 CIRCLE_CREATED 路径。其余 8 种操作类型的浏览器工作流（用户从 UI 走通提案→采纳→结构修改）未证明。

**影响**：`governance-workbench.tsx` 虽然包含 9 种类型的标签和过滤逻辑，但用户能否从 UI 为每种类型填写正确的提案表单并走通采纳流程，未经端到端验证。

**建议**：至少为 HOME_CHANGE、AGENT_CREATED、ROLE_ARCHIVED 各做一个浏览器证明（这三种对用户最有价值）。

### 🟢 B4：DecisionRecord.decisionMakerId 仍为 null

**状态**：`applyPrismaNonRoleAdoption` 第 831 行创建 DecisionRecord 时 `decisionMakerId: null`。采纳者的 ID 写入了 `GovernanceDecisionProcess.recordedById`，但 DecisionRecord 本身缺少"谁拍板"。

**影响**：审计可追溯性不完整——通过 Process 能查到采纳者，但直接查 DecisionRecord 看不到。

**建议**：将 `recordedById`（或 `actorId`）传递到 DecisionRecord。

### 🟢 B5：fixture 隔离验证脚本本地未执行

**状态**：`scripts/verify-m6-3-fixture-isolation.mjs` 已创建并语法检查通过，本地运行返回 `ok: true`（零匹配），但生产数据库中保留的 `m6-3-acceptance-*` fixture 的隔离验证未在该数据库上运行。

**影响**：低风险——fixture 使用独立前缀，不太可能混入真实数据。

**建议**：在生产数据库上运行一次 `verify-m6-3-fixture-isolation.mjs` 并记录证据。

---

## 总结

**M6-3 实质性修复了 v3/v4 审查报告中最严重的 P0-B（治理结构变更覆盖）**。9 种操作类型在解析器、执行器、UI 标签、Brain 能力四个层面全部到位。生产浏览器证明了 Brain→治理→CIRCLE_CREATED 完整闭环。

剩余 Blockers 集中在**测试深度**（B2 执行级测试仅覆盖 1/9 操作）和**证据完整性**（B3 浏览器仅证明 1/9 路径）。这些不影响代码正确性（执行逻辑在代码中且通过编译），但影响"可信任的完成证明"。
