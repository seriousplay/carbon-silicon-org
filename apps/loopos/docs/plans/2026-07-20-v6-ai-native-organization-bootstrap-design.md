# LoopOS V6: AI-Native Organization Bootstrap and Runtime Design

Date: 2026-07-20
Status: approved by product owner

## 1. Outcome

LoopOS V6 must let a newly registered team prepare, inspect, and irreversibly launch an AI-native organization without confusing bootstrap authority with normal governance authority. It must go beyond a GlassFrog-style structure registry by maintaining four connected models:

1. Organization structure: who owns purpose, roles, domains, accountabilities, and authority.
2. Business loops: how value, data, decisions, outputs, feedback, and abnormal signals flow.
3. Organization Brain: how authorized facts are understood, sensed, explained, and coordinated.
4. Executable governance policy: which changes are operational, which need confirmation, and which require distributed governance.

## 2. Organization Lifecycle

Every new organization starts in explicit `SETUP` state and may transition once to `ACTIVE`.

```text
SETUP -> ACTIVE
```

The transition is irreversible. Registration atomically creates the organization, root structure node, first Person, and an `ORG_ADMIN` Membership. Data activity must never be used to infer lifecycle state.

During `SETUP`:

- Organization administrators may directly edit the whole starting structure.
- Assigned structure leads may edit their own node and descendants.
- Direct edits are bootstrap events, not governance decisions.
- Tactical and governance meetings are unavailable at UI, action, domain, and Brain-command boundaries.
- Invitations are held by default; an administrator may explicitly send one immediately.
- Routine structure-change notifications are suppressed.

During `ACTIVE`:

- Bootstrap mutation routes fail closed.
- Structure changes use proposer-led governance tension, proposal, meeting, and adoption flows.
- The organization cannot return to `SETUP`, including through administrator or Brain actions.

## 3. Readiness and Activation

Activation requires four hard conditions:

1. Organization purpose is nonempty.
2. Exactly one active root structure node exists.
3. At least one active Role exists.
4. At least one key Role is assigned to an active human Person.

Warnings do not block activation: vacant Roles, incomplete Role purpose/accountabilities, unassigned child-node leads, no Goal cycle, no root OKR, no meeting cadence, unavailable Brain model, or held invitations.

An administrator sees the current hard checks and warnings, confirms the consequences, and activates through one serializable transaction. The transaction reauthorizes the administrator, locks and rechecks lifecycle/readiness, writes an immutable setup snapshot and audit event, changes lifecycle to `ACTIVE`, and enqueues held invitations. External delivery happens after commit and is retryable.

## 4. Setup Workspace

Registration lands on the Organization primary entry. A persistent setup banner appears across the application and links to readiness and activation. Other primary destinations remain visible, but meeting creation explains that activation is required.

The setup workspace uses this locked order and terminology:

1. 组织身份
2. 组织结构
3. 组织目标
4. 角色定义
5. 成员邀请
6. 角色任命
7. 系统配置

The desktop layout has a setup checklist, a contextual editor, and a live structure/readiness projection. Mobile uses the same order as stacked views. Template output is real editable starting data, not a detached wizard draft.

Organizations choose one organization-wide structure term: `回路`, `圈子`, or `团队`. The canonical data model remains stable. Structure nodes support arbitrary parent-child nesting.

## 5. Goals and Cadence

Organization Goals use OKR semantics. Each structure node may have at most one primary Objective in a shared cycle, with two to five measurable Key Results recommended. Child Objectives support parent Objectives; Projects and Actions are initiatives, not Key Results.

A formal Objective must belong to a cycle, but creating a cycle is not an activation hard gate. The first Objective flow requires selecting or creating a monthly, bimonthly, quarterly, half-year, annual, or custom cycle. Quarterly is suggested, not imposed. Goal cycle and check-in cadence are separate.

Organizations configure default tactical, governance, and Goal-review cadence. Each structure node may override the default. Cadence is operational configuration rather than a structure-governance mutation.

## 6. Organization Structure and Business Loops

The Organization primary entry has two parallel main views:

```text
组织
|- 组织结构
`- 业务回路
```

Organization structure answers who owns what. Business loops answer how value and data flow. A Business Loop contains purpose/customer value, trigger and terminal outcome, activities and decision points, responsible Roles and human/AI executors, inputs/outputs/data, handoffs, Goals/KRs/metrics, feedback, abnormal signals, execution history, and action-risk policy.

Business-loop changes are split by governance impact:

- Activity order, metrics, data sources, and operating rules may be changed by the authorized loop Role.
- Changes to Role purpose, accountabilities, domains, assignments, or cross-structure decision authority become governance candidate tensions.
- One edit may atomically apply its operational part while retaining the structural part as a governance candidate, with separate audit evidence.

Defining a Business Loop during setup is recommended but not an activation hard gate.

## 7. Human and AI Co-Responsibility

AI agents may be co-assignees and executors of a Role, but every formal Role must retain at least one accountable human assignee. AI authority is explicit, revocable, risk-classified, and audited; Role membership does not grant unrestricted capability.

Risk levels:

- L0 read-only: query, retrieve, summarize, explain.
- L1 reversible assistance: drafts, private organization, candidate creation.
- L2 shared organization writes: formal Tension, Project, Action, Goal proposal, or shared-data mutation; requires Role-holder confirmation.
- L3 structure/governance: Role, structure, accountability, domain, assignment, or policy change; requires governance process.
- L4 external or irreversible: publishing, financial/legal commitment, sensitive disclosure, destructive operations; requires specialized authority and human confirmation.

The model cannot lower the policy-defined risk level. Every execution records agent identity, model/config version, evidence, capability, confirmer, and result.

## 8. Candidate Tensions and Learning

The Brain and authorized AI agents may detect Goal drift, metric anomalies, stalled work, Role vacancy, loop handoff failure, stale memory, or AI execution failure. They create evidence-backed candidate tensions, not formal organization facts.

A candidate records detector, evidence, observed time, related Role/Loop/Goal, confidence, and suggested tactical/governance path. The related human Role holder may confirm, dismiss, merge, or mark false positive. Confirmation creates a formal Tension owned by the confirming proposer while preserving AI provenance. Feedback updates sensing policy without deleting the audit trail.

## 9. Brain Boundaries

The Organization Brain may recommend structure, Role definitions, assignments, OKRs, Business Loops, risk policy, and navigation. It may explain readiness and prepare activation summaries. It cannot activate an organization, bypass setup authority, create formal meetings while in `SETUP`, define organization facts without confirmation, or send held invitations without administrator action.

The existing tenant isolation, evidence-only response contract, read-only Brain database boundary, explicit command confirmation, and BioCoach cross-database denial remain mandatory.

## 10. Acceptance

V6 is not complete until browser and database evidence proves:

- Registration creates one `ORG_ADMIN` and one `SETUP` organization.
- The seven-step workspace, terminology, nested structure, scoped setup authority, held/immediate invitation behavior, and meeting denial work on desktop and mobile.
- Hard readiness checks block activation while warnings do not.
- Concurrent activation succeeds exactly once and writes immutable audit/snapshot evidence.
- `ACTIVE` cannot return to `SETUP`; bootstrap mutations and Brain bypasses fail closed.
- Organization structure and Business Loop views link bidirectionally.
- At least one Role has a human plus AI co-assignee with bounded capability and audit evidence.
- One runtime signal becomes a candidate tension and only human confirmation creates a formal Tension.
- A non-foundation-model team completes setup, activation, and one weekly operating loop without tenant or BioCoach boundary regression.

