# LoopOS V6 Implementation Plan

Date: 2026-07-20
Status: active plan

## Delivery Rule

Only one milestone is active. Every milestone requires source tests, PostgreSQL evidence where persistence/authority changes, browser evidence where a user flow changes, independent `/review`, roadmap audit, and cleanup before the next milestone activates.

## V6-M1 - Setup Lifecycle Foundation (accepted)

Outcome: persist explicit irreversible organization lifecycle and enforce it at write boundaries before redesigning the setup UI.

### M1-A Persistence and Readiness

- Add `OrganizationLifecycleStatus` with `SETUP` and `ACTIVE`.
- Add lifecycle timestamps/actor and append-only setup event/activation snapshot persistence.
- Backfill existing organizations as `ACTIVE`; new registrations default to `SETUP`.
- Add one pure readiness evaluator with four hard checks and bounded warning codes.
- Prove migration deploy/rollback/reapply on disposable PostgreSQL.

### M1-B Authority and Meeting Denial

- Add one setup actor policy: ORG_ADMIN whole organization; assigned structure lead own node/descendants.
- Enforce lifecycle on bootstrap structure actions and direct structure mutation boundaries.
- Deny tactical/governance meeting creation and formal meeting output while `SETUP`.
- Deny equivalent Organization Brain commands before model invocation or write execution.

### M1-C Activation and Invitations

- Add serializable one-way activation service with row lock, fresh authorization/readiness, immutable snapshot/event, and idempotent concurrent behavior.
- Add held/immediate invitation delivery policy and a durable post-commit delivery job/outbox.
- Ensure delivery failure is retryable and cannot roll lifecycle back.

### M1-D Minimal Browser Surface

- Add persistent setup banner, readiness screen, activation confirmation, and meeting locked state.
- Browser-proof new registration, failed readiness, warning-only activation, held invitation, activation, meeting availability, and irreversible denial.
- Independently review M1 and reconcile GOALS/dashboard before activating M2.

## V6-M2 - Organization Setup Workspace (accepted)

Outcome: replace the current one-shot template page with the approved seven-step Organization workspace.

- 组织身份 / 组织结构 / 组织目标 / 角色定义 / 成员邀请 / 角色任命 / 系统配置.
- Real editable template output, nested structure editor, organization-wide terminology, vacancy projection, scoped lead editing, and desktop/mobile readiness projection.
- Formal OKRs require a cycle; setup and activation do not.
- Organization defaults plus per-structure meeting cadence override.

### M2-A Information Architecture and Read Model

- Replace the one-shot setup entry with a stable Organization workspace shell
  that exposes the seven approved setup steps.
- Build one setup-state read model for identity, structure, goals, roles,
  invitations, assignments, and system configuration.
- Keep activation delegated to the accepted M1-D action/service; M2-A must not
  add new activation domain logic.
- Browser-proof desktop and mobile navigation across all seven setup steps for a
  SETUP organization.

M2-A is accepted:

- Added `src/lib/organization-setup/setup-workspace-read-model.ts` as the
  server-only read model for the seven setup steps.
- Updated `/app/organization` to render the seven-step Organization workspace
  from the read model and keep activation delegated to the accepted M1-D form and
  service.
- Browser acceptance passed through `scripts/m2a-browser-acceptance.cjs`: all
  seven labels visible, all seven entries route to non-404 pages, desktop/mobile
  horizontal overflow false, console/page/http ledgers clean, cleanupOk true,
  zero users/people/organizations residue, disposable database dropped, and
  `loopos_brain_reader` restored.
- Source gates passed: TypeScript, focused organization page tests 3/3, scoped
  ESLint, Prisma validate with existing warnings only, script syntax, and
  `git diff --check`.
- Independent implementation reviewer returned PASS with no findings and no
  blockers.
- Independent roadmap/evidence re-auditor returned PASS with no findings and no
  blockers.

### M2-B Editable Setup Content

- Make `/app/organization` the primary editable setup workspace instead of a
  pure navigation page.
- Reuse existing organization profile, terminology, governance rule, model
  settings, and template initialization actions/components rather than adding new
  domain logic.
- Keep one-shot structure initialization irreversible: if initialization has
  closed, Organization shows the closed state and routes admins to structure or
  goals work.
- Revalidate `/app/organization` after profile, terminology, and governance-rule
  saves so the new primary workspace stays fresh.
- Browser-proof desktop and mobile setup editing for a SETUP organization, clean
  ledgers, data cleanup, disposable database cleanup, and unchanged
  `loopos_brain_reader` safety attributes.

M2-B is accepted:

- Updated `/app/organization` to render direct editable sections for
  `01 组织身份`, `02 组织结构`, and `07 系统配置`, including
  `OrganizationProfileForm`, `TerminologyForm`, `GovernanceRulesForm`,
  `ModelSettingsForm`, and guarded `InitForm` template entry.
- Fixed the first independent review findings by adding editable
  `organization.purpose` to the organization profile form/action and by
  revalidating `/app/organization` after model setting saves.
- Added `scripts/m2b-browser-acceptance.cjs`.
- Browser acceptance passed against disposable PostgreSQL
  `loopos_m2b_browser_20260720_2`: required headings visible, organization name
  and purpose edited and persisted, identity readiness became ready, desktop/mobile
  horizontal overflow false, console/page/http ledgers clean, cleanupOk true, zero
  users/people/organizations residue, and the disposable database dropped.
- `loopos_brain_reader` after cleanup:
  `rolsuper=f, rolcreatedb=f, rolcreaterole=f, rolinherit=f, rolcanlogin=f,
  rolreplication=f, rolbypassrls=f`.
- Source gates passed: TypeScript, focused organization/setup tests 13/13,
  scoped ESLint, script syntax, Prisma validate with existing warnings only, and
  scoped `git diff --check`.
- Same-reviewer implementation reclosure returned PASS with no P0/P1/P2 after
  confirming the purpose edit/persistence and organization-page revalidation
  findings were closed.
- Same-auditor roadmap/evidence reclosure returned PASS with no P0/P1/P2.

### M2-C Goals, Invitations, and Assignments Setup

- Make the seven-step Organization workspace show actionable setup panels for
  organization goals, member invitations, and role assignments.
- Keep formal OKR creation cycle-based; do not make goal cycle creation a hard
  activation gate.
- Reuse existing goal, people, invitation, role-market, and governance routes
  where possible; add only thin setup guidance and state projection in
  Organization unless a missing low-risk action is strictly needed.
- Browser-proof that a new admin can see the next concrete action for goals,
  invitations, and role assignments without leaving the Organization setup
  context unclear.
- No Business Loops, AI co-assignees, candidate tensions, deployment, or broad
  notification policy in this slice.

M2-C is accepted:

- Updated `/app/organization` to render actionable panels for
  `03 组织目标`, `04 角色定义`, `05 成员邀请`, and `06 角色任命`.
- Each panel shows current setup counts from the accepted read model and one
  direct next action: goals workspace, organization structure/roles, people
  invitations, or role market.
- Source gates passed: TypeScript, focused organization page tests 5/5, scoped
  ESLint, script syntax, and scoped `git diff --check`.
- Browser acceptance passed against disposable PostgreSQL
  `loopos_m2c_browser_20260720_1`: all M2-B editable headings plus M2-C
  headings visible, organization name and purpose persisted, identity readiness
  ready, desktop/mobile horizontal overflow false, console/page/http ledgers
  clean, cleanupOk true, zero users/people/organizations residue, disposable DB
  dropped, and `loopos_brain_reader` remains no-login/no-privilege.
- Repo-local evidence is recorded in
  `docs/evidence/2026-07-20-v6-m2c-organization-setup-panels.md`; the runnable
  M2-C browser entry is `scripts/m2c-browser-acceptance.cjs`.
- Independent implementation reviewer returned PASS with no P0/P1/P2 and
  confirmed M2-C stayed within read-only count projections plus existing routes.
- Same-auditor roadmap/evidence reclosure returned PASS with no P0/P1/P2.

### M2-D Prioritized Readiness Guide

- Add one prioritized readiness gap guide inside `/app/organization` so a real
  admin can see the next concrete action before activation.
- Use the accepted setup read model; do not add activation domain logic or new
  readiness semantics.
- Link each missing readiness item to the existing setup section or route that
  can resolve it.
- Browser-proof desktop/mobile visibility, clean ledgers, cleanup, and unchanged
  reader safety.
- No Business Loops, AI co-assignees, candidate tensions, deployment, scheduler,
  delivery observability, or broad notification policy.

M2-D is accepted:

- Added a `下一步准备度` guide inside `/app/organization`.
- The guide derives missing items from the accepted setup read model readiness
  list and links to existing setup sections or routes.
- Source gates passed: TypeScript, focused organization page tests 6/6, scoped
  ESLint, script syntax, and scoped `git diff --check`.
- Browser acceptance passed against disposable PostgreSQL
  `loopos_m2d_browser_20260720_1`: readiness guide visible on desktop/mobile,
  missing action and gap count visible, organization name and purpose persisted,
  identity readiness updated, desktop/mobile horizontal overflow false,
  console/page/http ledgers clean, cleanupOk true, zero users/people/organizations
  residue, disposable DB dropped, and `loopos_brain_reader` remains
  no-login/no-privilege.
- Repo-local evidence is recorded in
  `docs/evidence/2026-07-20-v6-m2d-readiness-guide.md`; the runnable browser
  entry is `scripts/m2d-browser-acceptance.cjs`.
- Independent implementation reviewer returned PASS with no P0/P1/P2 and
  confirmed the guide derives from accepted readiness without adding activation
  domain logic or new readiness semantics.
- Independent roadmap/evidence auditor returned PASS after one P2 wording
  precision fix: M2-D does not integrate with BioCoach application/database
  scope; it only preserves existing cross-application query rejection as an
  isolation guard.

### M2-E Final Setup Workspace Acceptance

M2-E is accepted:

- The setup workspace read model now keeps editable setup steps inside
  `/app/organization`:
  - `组织身份` links to `/app/organization#organization-identity`.
  - `系统配置` links to `/app/organization#system-configuration`.
- Focused organization page tests pass 7/7 and assert no setup-workspace step
  links to `/app/setup`.
- Browser acceptance passed against disposable PostgreSQL
  `loopos_m2e_browser_20260720_1`: Organization setup headings visible, setup
  links remain inside Organization, no `/app/setup` links visible from the
  Organization setup workspace, organization name and purpose persisted,
  readiness updated, desktop/mobile horizontal overflow false, console/page/http
  ledgers clean, cleanupOk true, zero users/people/organizations residue,
  disposable database dropped, and local port 3237 closed.
- Repo-local evidence is recorded in
  `docs/evidence/2026-07-20-v6-m2e-setup-workspace-final-acceptance.md`; the
  runnable browser entry is `scripts/m2d-browser-acceptance.cjs`.
- Activation remains delegated to the accepted M1-D service. No activation
  domain logic, new readiness semantics, Business Loops, AI co-assignees,
  candidate tensions, deployment, scheduler, delivery observability, broad
  notification policy, or BioCoach application/database integration was added.
- Independent implementation reviewer returned PASS with no P0/P1/P2 and
  confirmed setup navigation stays inside Organization, activation remains
  delegated, and deferred scopes remain inactive.
- Independent roadmap/evidence auditor returned PASS with no P0/P1/P2 and
  recommended accepting M2-E.

V6-M2 is accepted. Final independent milestone auditor returned `ACCEPT V6-M2
AND ACTIVATE V6-M3` with no P0/P1/P2 after confirming M2-A/B/C/D/E acceptance,
source/browser/cleanup evidence, activation delegation, and deferred-scope
boundaries.

## V6-M3 - Business Loop Core (accepted)

Outcome: add `组织结构 | 业务回路` as parallel Organization views.

- Persist versioned Business Loops, activities, decisions, data/input/output edges, Role assignments, metrics/signals, and evidence references.
- Render inspectable flow and bidirectional Role/structure navigation.
- Classify operational edits versus governance-impact changes; route only the latter to candidate governance tensions.
- Keep the previous generic interface designer/runtime outside primary navigation.

### M3-A Business Loop Read and Navigation Shell

M3-A is accepted:

- Added a shared Organization subnavigation with `组织结构 | 业务回路`.
- Added `/app/organization/business-loops` as a read-only page under the
  Organization module.
- Added the first Business Loop read model over existing `Circle` and
  `CircleInterface` data only.
- Source gates passed after review fixes: focused source tests 7/7, TypeScript, scoped ESLint,
  script syntax, and scoped `git diff --check`.
- Browser acceptance passed against disposable PostgreSQL
  `loopos_m3a_browser_20260720_2`: `/app/circles/map` exposes the parallel
  Organization views, `业务回路` opens `/app/organization/business-loops`,
  the page shows `价值与数据流`, a seeded non-empty fixture proves 3 structures,
  10 identified flows, 6 READY interfaces, 4 non-READY interfaces, exactly 8
  preview rows, `组织结构` returns to `/app/circles/map`, desktop/mobile
  horizontal overflow false, console/page/http ledgers clean, cleanupOk true,
  zero users/people/organizations residue, disposable database dropped, and
  local port 3239 closed.
- Repo-local evidence is recorded in
  `docs/evidence/2026-07-20-v6-m3a-business-loop-read-navigation-shell.md`; the
  runnable browser entry is `scripts/m3a-browser-acceptance.cjs`.
- No Business Loop write flow, schema, migration, governance routing,
  AI co-assignees, candidate tensions, scheduler, delivery observability,
  deployment, broad notification policy, or BioCoach application/database
  integration was added.
- First independent implementation review found one P1 and one P2. Both were
  corrected: Business Loop counts now use full `circleInterface.count` queries
  instead of the 8-row preview list, and browser evidence now proves a
  non-empty 10-interface mixed-status fixture. Same-reviewer reclosure returned
  PASS with no open P0/P1/P2.
- Roadmap/evidence audit first found one P2 stale dashboard active label; the
  label was corrected to `V6-M3 Active · Business Loop Core`, and same-auditor
  reclosure returned PASS with no open P0/P1/P2.

### M3-B Business Loop Persistence Skeleton

M3-B is accepted:

- Design and add the minimal persistence skeleton for versioned Business Loops,
  loop activities, value/data edges, and evidence references.
- Keep the first write surface inactive unless explicitly scoped in a later
  slice.
- Add migration and Prisma model coverage without replacing `Circle` or
  `CircleInterface` and without moving generic interface designer/runtime into
  primary navigation.
- Keep governance-impact routing, AI co-assignees, candidate tensions,
  scheduler, delivery observability, deployment, broad notification policy, and
  BioCoach application/database integration inactive.
- Source evidence is recorded in
  `docs/evidence/2026-07-20-v6-m3b-business-loop-persistence-skeleton.md`:
  focused source tests pass 11/11, TypeScript passes, scoped ESLint passes,
  Prisma validate passes with only one pre-existing warning, and a disposable
  PostgreSQL database applied all 44 migrations including
  `20260720220000_v6_m3b_business_loop_persistence_skeleton`.
- Independent implementation review returned PASS with no P0/P1/P2: the
  reviewer confirmed the additive schema/migration, read-only page boundary,
  tenant-scoped references, no `Circle`/`CircleInterface` replacement, and no
  governance routing, candidate tension, scheduler, deployment, or BioCoach
  integration activation.
- Roadmap/evidence audit first found one P2 stale status after implementation
  review passed. The state documents were corrected, and same-auditor reclosure
  returned PASS with no findings and recommended `ACCEPT M3-B AND ACTIVATE NEXT
  SLICE`.

### M3-C Business Loop Read Projection and Inspectable Flow

M3-C is accepted:

- Read from the new Business Loop persistence skeleton and render an
  inspectable, read-only value/data flow when persisted Business Loops exist.
- Keep the M3-A fallback projection from `Circle` and `CircleInterface` when no
  persisted Business Loops exist, so existing organizations do not see an empty
  product surface.
- Add bidirectional navigation from persisted Business Loop activities/edges to
  existing Organization Structure, Roles, and Interfaces where references exist.
- Keep all Business Loop writes inactive unless explicitly scoped later.
- Keep governance-impact routing, AI co-assignees, candidate tensions,
  scheduler, delivery observability, deployment, broad notification policy, and
  BioCoach application/database integration inactive.
- Source and browser evidence is recorded in
  `docs/evidence/2026-07-20-v6-m3c-business-loop-read-projection.md`: focused
  source tests pass 12/12, TypeScript passes, scoped ESLint passes, Prisma
  validate passes with only one pre-existing warning, scoped `git diff --check`
  passes, and browser proof passes for both a persisted non-empty Business Loop
  fixture and the M3-A fallback fixture with clean ledgers, no horizontal
  overflow, and zero fixture residue.
- Independent implementation review first found one P1: archived Business Loop
  child rows could inflate visible activity, edge, and evidence counts. The
  correction filters those counts through non-archived parent loops, focused
  source tests/TypeScript/scoped ESLint/browser proof were re-run, and
  same-reviewer reclosure returned PASS with no findings.
- Roadmap/evidence audit first found stale implementation-review wording in
  `GOALS.md` and `progress-dashboard.html`. The wording was corrected, and
  same-auditor reclosure returned PASS with no findings and recommended
  `ACCEPT M3-C AND ACTIVATE NEXT SLICE`.

### M3-D Business Loop Minimal Authoring

M3-D is accepted:

- Add the smallest administrator-facing Business Loop authoring surface under
  Organization -> Business Loops.
- Allow creating and editing operational Business Loop drafts: loop identity,
  purpose, activities, value/data edges, and evidence labels.
- Keep direct authoring limited to operational flow facts only. Role, domain,
  accountability, assignment, decision-right, Circle nesting, and governance
  structure changes remain outside this slice and must not be written here.
- Persist draft edits to the M3-B table family and keep the M3-C read projection
  as the inspectable confirmation surface.
- Keep AI co-assignees, candidate tensions, governance-impact routing,
  scheduler, delivery observability, deployment, broad notification policy, and
  BioCoach application/database integration inactive.
- Source and browser evidence is recorded in
  `docs/evidence/2026-07-20-v6-m3d-business-loop-minimal-authoring.md`:
  focused source tests pass 15/15, TypeScript passes, scoped ESLint passes,
  Prisma validate passes with only one pre-existing warning, scoped `git diff
  --check` passes, and browser proof passes for admin create draft, add
  activity, add value/data edge, add evidence label, M3-C read projection
  refresh, no horizontal overflow, clean console/page/http ledger, expected row
  counts, and zero fixture residue.
- Independent implementation review returned PASS with no P0/P1/P2: the
  reviewer confirmed ORG_ADMIN gating, reference validation, Business Loop
  table-family-only writes, duplicate same-name update paths, source gates, and
  browser evidence shape.
- Roadmap/evidence audit first found stale implementation-review status wording
  in `GOALS.md` and `progress-dashboard.html`. The wording was corrected, and
  same-auditor reclosure returned PASS with no findings and recommended
  `ACCEPT M3-D AND ACTIVATE NEXT SLICE`.

### M3-E Business Loop Publishing and Version Confirmation

M3-E is accepted:

- `publishBusinessLoopDraftAction` requires ORG_ADMIN, publishes only a draft
  Business Loop with at least one activity and one value/data edge, supersedes
  older published versions for the same loop, marks the selected version
  `PUBLISHED`, writes `publishedAt`, and sets the loop to `ACTIVE`.
- The Business Loop read model and page now distinguish `草稿` and `已发布`.
- Focused tests pass 16/16.
- TypeScript, scoped ESLint, Prisma validate, and source/browser script syntax
  gates pass.
- Browser evidence passes in `/tmp/loopos-m3e-browser-20260720-3`: one published
  active loop, one published version, zero draft versions, activities/edges/
  evidence retained, repeated publish click attempt fulfilled without duplicate
  versions, no console/page/http ledger entries, no mobile overflow, cleanupOk
  true, and zero user/person/organization/business-loop residue.
- First implementation review found draft read-projection exposure and missing
  duplicate-publish proof. Both were corrected: formal persisted projection now
  reads only `ACTIVE` Business Loops, and already published loops replay as an
  idempotent success.
- Same-reviewer implementation reclosure returned PASS with no findings and no
  blockers.
- Publishing remains operational-only and does not write Role, Domain,
  Accountability, Assignment, Decision-right, Circle nesting, or governance
  structure records.
- AI co-assignees, candidate tensions, governance-impact routing, scheduler,
  delivery observability, deployment, broad notification policy, and BioCoach
  application/database integration remain inactive.
- Roadmap/evidence re-audit returned PASS with no P0/P1/P2 and no blockers.
- Final V6-M3 milestone auditor returned `ACCEPT V6-M3 AND ACTIVATE V6-M4`
  with no P0/P1/P2 and no blockers.

## V6-M4 - AI Co-Assignees and Risk Policy (accepted)

Outcome: make AI a bounded Role co-executor without removing human accountability.

- Add organization AI-agent identity/configuration and Role co-assignment.
- Enforce at least one accountable human for every active formal Role.
- Add policy-owned L0-L4 capability classification, explicit grants, suspension/revocation, execution ledger, evidence, and confirmation.
- Preserve existing model settings and Brain command ledger rather than creating a parallel execution system.
- M4-A accepted foundation added organization AI actor identity, Role
  co-assignee intent, L0-L4 policy vocabulary, and invariant tests while
  keeping candidate tension sensing, scheduler, deployment, broad
  notifications, and BioCoach application/database integration inactive.

### M4-A AI Co-Assignee Policy Foundation

M4-A is accepted:

- Added `AiCoAssigneeStatus` and `AiCapabilityRiskLevel`.
- Added additive tenant-scoped `ai_role_co_assignment_policies` persistence for
  Role, AI Person, accountable human Person, maximum risk level, status, and
  capability scope.
- Added pure policy helpers and invariant tests that require a Role, an AI
  Person, a distinct accountable human Person, supported L0-L4 risk levels, and
  bounded statuses.
- Added a tested application-level save guard that requires the AI co-assignee
  to be an `AGENT`, the accountable person to be a `HUMAN`, and the Role to be
  active in the same organization.
- Focused tests pass 5/5.
- TypeScript, scoped ESLint, Prisma validate, migration transaction proof, and
  scoped `git diff --check` pass.
- No execution handler, scheduler, candidate tension sensing, broad
  notification, deployment, governance-structure mutation, or BioCoach
  application/database integration was added.
- First implementation review found missing entity-type enforcement; correction
  added tested application-level persistence guards.
- Implementation re-review returned PASS with no P0/P1/P2 and no blockers.
- Roadmap/evidence re-audit returned aligned with no P0/P1/P2; its only
  conditional blocker was implementation re-review, now closed.

### M4-B AI Co-Assignee Configuration Surface

M4-B is accepted:

- Show AI co-assignment readiness and policy status from the accepted M4-A
  foundation.
- Reuse existing organization model settings and role surfaces where possible.
- Allow administrators to create or update proposed AI co-assignment policy
  records through the M4-A guarded save path.
- Keep AI execution, candidate tension sensing, scheduler, deployment, broad
  notifications, and BioCoach application/database integration inactive.
- Required before acceptance: focused source tests, browser evidence for the
  configuration flow, TypeScript, scoped ESLint, Prisma validate, scoped
  `git diff --check`, independent implementation review, and independent
  roadmap/evidence audit.
- Evidence collected: focused tests pass 8/8, TypeScript, scoped ESLint, Prisma
  validate, production build, browser acceptance in
  `/tmp/loopos-m4b-browser-20260720-6`, no desktop overflow, clean browser
  ledger, zero fixture residue, and scoped diff check.
- First implementation review found one P1: a non-proposed existing policy
  could be reset to `PROPOSED`. Correction now rejects existing policies whose
  status is not `PROPOSED`.
- Implementation reclosure returned PASS with no findings and no blockers.
- Roadmap/evidence audit returned PASS with no P0/P1/P2; its only remaining
  blocker was implementation review, now closed.

### M4-C AI Co-Assignee Approval Lifecycle

M4-C is accepted:

- Allow organization admins to approve a proposed policy, suspend an approved
  policy, and revoke a policy.
- Preserve human accountability and L0-L4 bounds on every active policy.
- Record lifecycle timestamps/reasons without introducing an execution ledger
  or autonomous action path.
- Keep candidate tension sensing, scheduler, deployment, broad notifications,
  and BioCoach application/database integration inactive.
- Required before acceptance: focused source tests, browser evidence for
  proposed -> approved -> suspended/revoked lifecycle, TypeScript, scoped
  ESLint, Prisma validate, scoped `git diff --check`, independent implementation
  review, and independent roadmap/evidence audit.
- Evidence collected: focused tests pass 9/9, TypeScript, scoped ESLint, Prisma
  validate, production build, browser acceptance in
  `/tmp/loopos-m4c-browser-20260720-1`, no desktop overflow, clean browser
  ledger, zero fixture residue, and scoped diff check.
- Implementation review returned PASS with no P0/P1/P2 and no blockers.
- Roadmap/evidence audit first found stale dashboard wording, then found this
  implementation PASS was not recorded in audited state. That record is now
  updated.
- Roadmap/evidence reclosure returned PASS with no P0/P1/P2 and no blockers.

### M4-D AI Execution Readiness Gate

M4-D is accepted. Add a read-only execution-readiness gate that explains
whether an approved AI co-assignment policy is eligible for future execution,
without executing anything.

- Compute readiness from approved policy status, accountable human presence,
  L0-L4 risk level, Role status, and AI/human entity type.
- Show the readiness state on the Role detail page so administrators can see
  what would block future execution.
- Do not create execution jobs, execution ledger entries, scheduler processes,
  candidate tensions, governance mutations, deployment changes, broad
  notifications, or BioCoach application/database integration.
- Required before acceptance: focused source tests, browser evidence for
  approved eligible and revoked/ineligible cases, TypeScript, scoped ESLint,
  Prisma validate, scoped `git diff --check`, independent implementation review,
  and independent roadmap/evidence audit.
- Evidence collected: focused tests pass 11/11, TypeScript, scoped ESLint,
  script syntax, Prisma validate, scoped diff check, production build, browser
  acceptance in `/tmp/loopos-m4d-browser-20260720-1`, approved eligible policy
  shows `未来执行准备就绪`, revoked policy shows
  `执行准备度：POLICY_NOT_APPROVED`, page copy states it will not trigger AI
  automatic execution, no desktop overflow, clean browser ledger, and zero
  fixture residue.
- Evidence record:
  `docs/evidence/2026-07-20-v6-m4d-ai-execution-readiness-gate.md`.
- Implementation review returned PASS with no P0/P1/P2 and no blockers.
- First roadmap/evidence audit found two stale dashboard P2 findings; both were
  corrected, and roadmap/evidence reclosure returned PASS with no P0/P1/P2 and
  no blockers.

### M4-E AI Execution Audit Ledger Contract

M4-E is accepted. Add the durable audit contract needed before any future AI
execution can be activated. This slice records eligibility and future
execution-attempt intent but must not schedule or perform execution.

- Add a minimal append-only AI execution audit ledger tied to organization,
  Role, AI co-assignment policy, accountable human, risk level, readiness code,
  source process, and requested operation label.
- Only record explicit future execution-intent/audit events from approved
  policies that pass the M4-D readiness gate; blocked readiness must record a
  denied audit event instead of executing.
- Keep every write tenant scoped and human-accountability scoped.
- Do not add scheduler processes, background workers, real AI task execution,
  candidate tension sensing, deployment changes, broad notifications,
  governance mutations, or BioCoach application/database integration.
- Required before acceptance: focused source tests, PostgreSQL migration proof,
  browser or server-action proof for ready and blocked audit events without
  execution, TypeScript, scoped ESLint, Prisma validate, scoped
  `git diff --check`, independent implementation review, and independent
  roadmap/evidence audit.
- Evidence collected: focused tests pass 15/15, TypeScript, scoped ESLint,
  Prisma validate, scoped diff check, production build, and transactional
  PostgreSQL migration proof with `BEGIN` followed by `ROLLBACK`.
- Behavior evidence proves ready policy intent records `RECORDED`, blocked L4
  intent records `DENIED`, missing policy and non-human recorder are rejected,
  and no execution/scheduler/candidate/BioCoach path is added.
- Evidence record:
  `docs/evidence/2026-07-20-v6-m4e-ai-execution-audit-ledger-contract.md`.
- Implementation review returned PASS with no P0/P1/P2 and no blockers.
- Roadmap/evidence audit returned PASS with no P0/P1/P2 and no blockers.

### M4-F AI Co-Assignee and Risk Policy Cleanup

M4-F and V6-M4 are accepted. Consolidate M4 acceptance without adding new domain
logic.

- Re-run M4 scoped source, schema, migration, and build gates.
- Confirm A/B/C/D/E evidence records and state files agree.
- Confirm no automatic AI execution, scheduler, execution job dispatch,
  candidate tension sensing, governance mutation, deployment, broad
  notification, pluginization, semantic/vector retrieval, or BioCoach
  integration is active in V6-M4.
- Required before acceptance: scoped source tests, TypeScript, scoped ESLint,
  Prisma validate, scoped `git diff --check`, production build, independent
  final implementation review, independent final roadmap/evidence audit, and
  activation of V6-M5 only after the final M4 audit passes.
- Evidence collected: focused tests pass 15/15, TypeScript, scoped ESLint,
  Prisma validate, scoped diff check, production build, and browser regression
  in `/tmp/loopos-m4f-browser-20260720-1` with no overflow, clean browser
  ledger, and zero fixture residue.
- Evidence record:
  `docs/evidence/2026-07-20-v6-m4f-ai-co-assignee-risk-policy-cleanup.md`.
- Final implementation review returned PASS with no P0/P1/P2 and no blockers.
- Final roadmap/evidence audit first found one stale plan P2; the old M4-A
  current-slice wording was corrected, and final roadmap/evidence reclosure
  returned PASS with no P0/P1/P2 and no blockers.

## V6-M5 - Candidate Tension Sensing (accepted)

Outcome: turn organization signals into evidence-backed candidates without allowing AI to define formal facts.

M5-F accepted:

- Final milestone auditor `Huygens` returned `ACCEPT V6-M5 AND ACTIVATE V6-M6`.
- The audit found no open P0/P1/P2 across M5-A/B/C/D/E evidence artifacts.
- Deferred scopes remain inactive and unclaimed: automatic sensing, AI-created
  formal `Tension`, scheduler, broad notifications, deployment,
  semantic/vector retrieval, and BioCoach integration.

M5-A accepted:

- Add candidate tension lifecycle/status vocabulary and source-kind vocabulary.
- Persist candidates separately from formal `Tension` records.
- Require source evidence, owner Role scope, detector, and optional
  tactical/governance suggestion.
- Confirmation may only link a later formal Tension and human confirmer; M5-A
  itself does not create formal Tensions.
- Dismissal, false-positive, and merge are terminal candidate outcomes.
- Evidence record:
  `docs/evidence/2026-07-20-v6-m5a-candidate-tension-data-contract.md`.
- Focused tests passed 6/6; TypeScript, scoped ESLint, Prisma validate,
  production build, scoped diff check, and migration `BEGIN`/`ROLLBACK` proof
  passed.
- Implementation reviewer `Poincare` reclosed the original P1/P2 findings with
  PASS; roadmap/evidence auditor `Harvey` returned PASS.

M5-B accepted:

- Add a tenant-scoped persistence service for creating detected candidates from
  explicit source evidence.
- Add authorized human confirmation/dismissal/merge transitions that preserve
  append-only audit evidence.
- Keep automatic sensing loops, browser UI expansion, formal `Tension` creation
  by AI, scheduler, broad notifications, deployment, and BioCoach integration
  inactive.
- M5-B evidence is recorded in
  `docs/evidence/2026-07-20-v6-m5b-candidate-tension-persistence-human-confirmation.md`;
  implementation review and roadmap/evidence audit both passed.

M5-C accepted:

- Add the first visible candidate tension inbox/review surface for authorized
  humans.
- Let users inspect evidence, source, owner Role, suggested path, and lifecycle
  status before confirmation.
- Route human confirmation to existing formal `Tension` records or terminal
  candidate outcomes through the accepted M5-B service.
- Keep automatic sensing loops, AI-created formal `Tension`, scheduler, broad
  notifications, deployment, semantic/vector retrieval, and BioCoach
  integration inactive.
- M5-C evidence is recorded in
  `docs/evidence/2026-07-20-v6-m5c-candidate-tension-inbox.md`;
  implementation reclosure and roadmap/evidence reclosure both passed.

M5-D accepted:

- Add human review actions to the candidate tension inbox.
- Authorized owner Role human assignees can dismiss, mark false-positive, merge,
  or link a candidate to an existing formal Tension through the accepted M5-B
  service.
- Keep AI-created formal `Tension`, automatic sensing, scheduler, broad
  notifications, deployment, semantic/vector retrieval, and BioCoach
  integration inactive.
- M5-D evidence is recorded in
  `docs/evidence/2026-07-21-v6-m5d-candidate-tension-human-review-actions.md`;
  implementation reclosure and roadmap/evidence audit both passed.

M5-E accepted:

- Prove the candidate tension inbox and human review actions in a browser flow
  with disposable fixtures.
- Verify authorized owner-role human assignee can process candidates, read-only
  users cannot see action forms, browser console/network remains clean, and
  fixture cleanup leaves no residue.
- Keep automatic sensing, AI-created formal `Tension`, scheduler, broad
  notifications, deployment, semantic/vector retrieval, and BioCoach
  integration inactive.
- M5-E evidence is recorded in
  `docs/evidence/2026-07-21-v6-m5e-candidate-tension-browser-acceptance.md`;
  implementation reviewer `James` and roadmap/evidence auditor
  `Chandrasekhar` returned PASS.

Deferred V6-M5 follow-up candidates:

- Connect bounded Goal, metric, work, Role vacancy, Business Loop, memory, and
  AI-execution signals into explicit candidate sensing policies.
- Feed outcomes into versioned sensing policy and retain append-only provenance.

## V6-M6 - Integrated Acceptance and Real-Team Trial (active)

Outcome: prove one non-foundation-model team can register, prepare, activate, and run one weekly tension-to-closure loop with human/AI co-execution.

Current bounded slice: M6-E production trial release and isolation proof.

M6-A accepted:

- Define the exact real-team trial path, fixture boundary, evidence commands,
  and acceptance thresholds before implementing additional product behavior.
- Cover first-run setup, activation, role assignment, goal cycle, tactical
  meeting, governance meeting, candidate tension confirmation, Organization
  Brain read/action support, production deployment, and BioCoach isolation.
- Keep longitudinal completion unclaimed until the agreed evidence is collected
  from the real team or an explicitly marked independent fixture.

M6-A artifacts:

- Contract:
  `docs/plans/2026-07-21-v6-m6a-integrated-trial-contract.md`.
- Evidence harness inventory:
  `docs/evidence/2026-07-21-v6-m6a-evidence-harness.md`.
- Read-only contract verifier:
  `scripts/verify-v6-m6a-contract.mjs`.
- Acceptance evidence:
  `docs/evidence/2026-07-21-v6-m6a-contract-acceptance.md`.
- Independent reviewer `Pauli` returned `ACCEPT M6-A AND ACTIVATE M6-B` with
  no findings and no blockers.

M6-B target:

- Implement a local integrated browser verifier over disposable data for the
  M6-A required user journey.
- Prove setup readiness, activation, role assignment, goal cycle, candidate
  tension confirmation, tactical meeting outcome, governance meeting outcome,
  Organization Brain support, responsive browser behavior, and cleanup.
- Add PostgreSQL assertions for authority boundaries, tenant isolation,
  lifecycle state, generated outcomes, and zero fixture residue.
- Keep production deployment and longitudinal real-team completion unclaimed.

M6-B current artifacts:

- Verifier:
  `scripts/m6b-local-integrated-trial-verifier.cjs`.
- Evidence status:
  `docs/evidence/2026-07-21-v6-m6b-local-integrated-verifier.md`.
- Current verifier supports readiness and browser modes.
- Coordinator readiness found the default `.env` local database is stale and
  missing `candidate_tensions`; M6-B acceptance must use a disposable fully
  migrated PostgreSQL database.
- Disposable DB readiness passes with `loopos_m6b_readiness_20260721_2`:
  database created, all migrations applied, required tables present, database
  dropped, and `existsAfterDrop: 0`.
- Local browser smoke passes with disposable DB
  `loopos_m6b_browser_20260721_1`: registration, readiness-seeded activation
  through real lifecycle constraints, candidate confirmation, tactical meeting
  creation, governance meeting creation, Organization Brain access,
  desktop/mobile evidence, clean ledger, temporary server stopped, and
  disposable DB dropped with `existsAfterDrop: 0`.
- Local SQL-seeded fixture browser deep flow passes with disposable DB
  `loopos_m6b_deep_20260721_8`: Organization Brain governance proposal,
  tactical meeting outcome approval, assigned Action creation, governance
  meeting initialization, proposer adoption, created governance Role,
  desktop/mobile evidence, clean ledger, temporary server stopped, disposable DB
  dropped, and `temp_db_exists = 0`.
- Focused governance-decision regression tests pass 38/38 and final
  `npm run build` passes after the Organization Brain governance and proposer
  adoption fixes.
- Implementation review found and the coordinator corrected P1 issues in
  governance preview source-version binding and governance meeting participant
  boundaries. Focused follow-up tests pass: command preview 8/8 and goal command
  handler 16/16.
- After those P1 fixes, the local SQL-seeded fixture browser deep flow was
  re-run on disposable DB `loopos_m6b_deep_20260721_9` and passed with clean
  browser ledgers, tactical Action assignment, adopted governance process,
  created governance Role, temporary server stopped, database dropped, and
  `temp_db_exists = 0`.
- M6-B implementation review reclosure passed after the P1 fixes.
- M6-B roadmap/evidence reclosure passed after explicitly documenting that
  PostgreSQL authority and tenant-isolation negative assertions are not proven
  in the M6-B evidence packet.
- M6-B is retained as local SQL-seeded fixture evidence. It is not final V6-M6
  acceptance proof.

M6-C target:

- Add PostgreSQL negative assertions for cross-tenant denial, unauthorized
  actor denial, invalid lifecycle denial, and zero fixture residue.
- Add or split out a UI-first first-run browser evidence path so the setup
  journey is not silently dependent on SQL-seeded readiness facts.
- Keep production refresh, BioCoach isolation, rollback, and real-team
  longitudinal completion as distinct evidence classes.

M6-C current artifact:

- The verifier now reports `negativeAssertions` in browser/full mode.
- The unauthorized actor check now calls the accepted
  `confirmCandidateTensionWithHuman` service boundary against the active
  `DATABASE_URL`; it no longer relies on SQL foreign-key denial as permission
  evidence.
- Current focused evidence passes: script syntax, candidate tension service
  tests 5/5, production build, and scoped diff check.
- Full local verifier evidence now passes on disposable DB
  `loopos_m6c_full_20260721_2` through a production server on
  `http://127.0.0.1:3034`: browser path passed, cross-tenant denial passed,
  service-boundary unauthorized actor denial passed, zero-residue rollback
  passed, invalid lifecycle denial passed, browser ledgers were clean, server
  stopped, DB dropped, and `existsAfterDrop: 0`.
- Initial implementation review found P1 weak cross-tenant SQL evidence and P2
  incomplete service-boundary fixture residue coverage; both were corrected and
  the full verifier re-ran successfully in
  `/tmp/loopos-m6c-full-20260721-9`.
- Same-reviewer implementation reclosure passed with no open P0/P1/P2 after
  confirming service-boundary cross-tenant denial and complete
  service-boundary fixture residue coverage.
- Roadmap/evidence reclosure passed with no open P0/P1/P2 after stale
  implementation-review pending wording was removed.
- M6-C is accepted as local fixture evidence. It does not accept V6-M6 overall
  because UI-first setup, production deployment, BioCoach isolation, rollback,
  and real-team longitudinal evidence remain separate unproven gates.

M6-D target:

- Replace M6-C SQL-seeded setup preconditions with a browser-visible UI-first
  setup path wherever product UI already exists.
- For any setup fact that cannot be completed through UI without adding new
  domain scope, list the exact route/action gap as a production-trial
  precondition.
- Keep M6-C full verifier authority/isolation checks intact.

M6-D exact setup facts to close or explicitly defer:

- Organization purpose.
- Main circle lead and tactical cadence.
- First accountable human Role and Role assignment.
- Organization Brain profile.
- Goal cycle, Goal proposal, Goal decision, adopted Goal, and Goal target.
- Detector Agent person.
- Formal tactical/governance tensions.
- Candidate tension before browser confirmation.

M6-D current artifact:

- UI-first setup gap matrix:
  `docs/evidence/2026-07-21-v6-m6d-ui-first-setup-gap.md`.
- The verifier now performs browser UI setup for organization purpose,
  structure initialization, goal cycle availability, and formal tactical and
  governance tension creation. It only proves the Organization Brain model
  settings section is visible, not persisted model/profile setup.
- Disposable full browser verifier passed with
  `loopos_m6d_full_20260721_3` through a local production server on
  `http://127.0.0.1:3035`, with screenshots in
  `/tmp/loopos-m6d-full-20260721-7`.
- Browser/full evidence proves activation, candidate confirmation, tactical and
  governance meeting creation, tactical outcome approval, assigned Action
  creation, governance process adoption, governance Role creation,
  Organization Brain visit, mobile overflow false, and empty console/page/http
  ledgers.
- PostgreSQL/service-boundary negative assertions pass for cross-tenant denial,
  unauthorized actor denial, zero fixture residue, and invalid lifecycle denial
  with SQLSTATE `55000`.
- Remaining explicit fixture preconditions are tactical cadence, Organization
  Brain model/profile persistence, full goal proposal/decision/adopted-goal/
  target path, detector Agent person, and candidate tension creation.
- The temporary production server was stopped and disposable database
  `loopos_m6d_full_20260721_3` was dropped after the full run.
- Independent implementation reviewer `Carson` first found one P1 and one P2
  in model/profile and goal-chain evidence boundaries. Both were corrected and
  reclosed with PASS and no open P0/P1/P2.
- Independent roadmap/evidence auditor `Ohm` first found one stale GOALS P2.
  It was corrected and reclosed with PASS and no open P0/P1/P2.
- M6-D is accepted as local UI-first setup evidence. It does not accept V6-M6
  overall because production deployment, rollback, BioCoach isolation, and
  real-team longitudinal evidence remain unclaimed.

M6-D non-goals:

- Do not add new domain features.
- Do not expand Organization Brain capabilities.
- Do not activate automatic sensing, scheduler work, broad notifications,
  semantic/vector retrieval, or BioCoach integration.

M6-D required evidence:

- Accepted as local UI-first setup evidence after full browser verifier,
  implementation review reclosure, and roadmap/evidence reclosure.
- Production deployment, rollback, BioCoach isolation, and real-team
  longitudinal trial remain separate unclaimed V6-M6 gates.

- Full desktop/mobile browser flow and PostgreSQL authority/isolation evidence.
- Production deployment, health/readiness, authenticated smoke, and rollback evidence.
- Mandatory LoopOS/BioCoach exact denial gate.
- Independent implementation review, UX review, roadmap audit, and longitudinal evidence remain distinct.

## V6-M6-E - Production Trial Release and Isolation Proof

Target output:

- Deploy the current accepted local evidence snapshot to Aliyun production using
  local build and remote run.
- Prove production health/readiness, authenticated smoke for the V6-M6 path,
  strict LoopOS/BioCoach isolation, and rollback/recovery evidence.
- Keep real-team longitudinal completion unclaimed until the trial team runs the
  weekly loop and produces follow-up state evidence.

Required evidence:

- Evidence file:
  `docs/evidence/2026-07-21-v6-m6e-production-trial-release.md`.
- Local production build with `NEXT_PUBLIC_BASE_PATH=/loopos` and
  `AUTH_URL=https://csi-org.com` passes, and routes-manifest proves
  `/loopos/` -> `/loopos` redirect.
- Production deployment release identity and build artifact are recorded.
- Production migrations are healthy with no failed rows and no unexpected
  pending migrations.
- Public health/readiness and authenticated browser smoke pass for the deployed
  release.
- LoopOS application credentials and Brain reader remain denied from BioCoach
  data with exact SQLSTATE evidence.
- Rollback/recovery checklist is validated for the release.
- Independent implementation/security review and roadmap/evidence audit return
  no open P0/P1/P2 before M6-E is accepted.

## V6-M7 - AI-Native First-Run to Weekly Operating Loop (proposed)

Outcome: turn the accepted V6 foundations into a low-friction operating journey
for any AI-native team, from first setup to one weekly tension-to-closure loop.

Do not activate this version until V6-M6 is accepted or explicitly split.

Version goals:

- Make first-run mode a guided operating journey rather than a settings
  checklist.
- Make Organization Brain the primary assistant for setup and weekly work while
  preserving human proposal, meeting, and governance authority.
- Express AI-native organization design through human+AI role co-assignment,
  evidence-backed candidate tensions, business-loop sensing, and permissioned
  organization memory.
- Keep organization structure and business loops as connected but distinct
  views: accountability/authority versus value/data flow.

Milestone candidates:

- M7-A: turn the M6-D explicit fixture preconditions into browser-visible
  product paths or intentionally reviewed production-trial preconditions.
- M7-B: guided first-run journey inside `/app/organization`.
- M7-C: role accountability path from market/application/governance to
  assignment history.
- M7-D: primary goal path from cycle to proposal, strategic meeting decision,
  adopted goal, target, and first check-in.
- M7-E: tactical meeting path from health review to tension list, per-tension
  processing, generated work, and automatic minutes.
- M7-F: production trial release with deploy, rollback, BioCoach isolation, and
  real-team weekly runbook evidence.

## Accepted Slice: V6-M1-A

Accepted on 2026-07-20 after focused 10/10, Prisma validation, TypeScript,
42-migration PostgreSQL boundary proof, zero-residue rollback, same-reviewer
implementation reclosure, and independent roadmap audit.

## Accepted Slice: V6-M1-B1

Accepted on 2026-07-20 after focused 18/18, Prisma validation, TypeScript,
fresh 42-migration PostgreSQL setup-action 10/10, lifecycle/actor boundary proof,
zero `organizations` Prisma drift, and same-reviewer reclosure with no findings.

## Accepted Slice: V6-M1-B2

Accepted on 2026-07-20 after source 59/59, bracket-directory runtime 21/21,
TypeScript, scoped ESLint, diff check, disposable PostgreSQL five-boundary
zero-write proof, fixture cleanup, and same-reviewer reclosure of the sole P1.

## Worker Contract: V6-M1-B3 (accepted)

Owned scope:

- reuse the accepted meeting lifecycle policy for Organization Brain command
  preview and confirmation boundaries
- deny only `tactical_outcome.submit_proposal`, `meeting_notes.update`, and
  `governance_proposal.create` while the organization is SETUP or missing
- prevent denied preview-ledger writes and deny confirmation before command
  execution; refresh lifecycle in every transaction that can claim or execute
  a meeting-dependent command
- keep setup guidance, Goal, Tension raise, and Role application Brain
  capabilities available

No-touch:

- direct meeting and formal-output boundaries accepted in M1-B2
- setup authority and lifecycle persistence semantics accepted in M1-A/B1
- model reasoning/content semantics and non-meeting Brain commands
- Goal lifecycle
- Business Loop, AI co-assignee, candidate tension, setup UI, deployment
- BioCoach or any external database/application

Required evidence:

- focused preview tests proving denied commands create zero ledger rows
- focused confirmation tests proving denied commands execute zero handler or
  domain writes, including previews persisted before the fresh check
- ACTIVE pass-through and explicit non-meeting command availability tests
- disposable PostgreSQL zero-write/replay evidence for all three commands
- TypeScript and `git diff --check`

## Accepted Slice: V6-M1-B3

Accepted on 2026-07-20 after focused preview/confirmation 23/23, TypeScript,
scoped ESLint, diff check, disposable PostgreSQL zero-ledger/zero-domain-write
proof for all three meeting commands, explicit `tension.raise` availability,
zero fixture residue, and independent review PASS with no P0/P1/P2. The
PostgreSQL preview proof exercises the production lifecycle helper and the same
Serializable transaction seam; session/browser evidence remains owned by M1-D.

## Worker Contract: V6-M1-C1 (accepted)

Owned scope:

- add one bounded activation service for the irreversible `SETUP -> ACTIVE`
  transition; no Server Action or browser UI in this slice
- reauthorize the actor as a current organization `ORG_ADMIN`, lock the
  organization row, and reload lifecycle and readiness inputs inside one
  Serializable transaction
- block activation when any accepted hard readiness gate fails; warning codes
  remain visible in the accepted result but do not block activation
- on success, atomically write the immutable activation snapshot, append the
  `ACTIVATED` setup event, and update lifecycle/timestamp/tenant-bound actor
- make repeated and concurrent activation deterministic and idempotent with one
  lifecycle winner, one snapshot, and one activation event
- use canonical bounded JSON and checksum input; never expose raw database or
  infrastructure errors

No-touch:

- invitation hold/immediate policy, delivery outbox, email delivery, and retry
  worker; these remain M1-C2+
- setup/browser UI and meeting unlock presentation; these remain M1-D
- accepted M1-A/M1-B authority and meeting boundaries
- Goal lifecycle, Business Loops, AI co-assignees, candidate tensions,
  deployment, BioCoach, or any external database/application

Required evidence:

- focused service tests for authorization, failed hard gates, warning-only
  success, immutable snapshot/event payload, redacted failures, and idempotency
- disposable PostgreSQL proof for one legal activation, failed readiness zero
  writes, wrong-tenant/non-admin denial, concurrent single winner, irreversible
  transition, append-only evidence, and zero fixture residue
- Prisma validation, TypeScript, scoped ESLint, and `git diff --check`
- independent review with no open P0/P1/P2 before M1-C2 activates

## Accepted Slice: V6-M1-C1

Accepted on 2026-07-20 after focused 11/11, Prisma validation, TypeScript,
scoped ESLint, diff check, and disposable PostgreSQL proof for legal and
warning-only activation, hard-gate/authority/tenant zero writes, concurrent
single evidence, irreversible lifecycle, append-only evidence, strict replay,
redacted readiness facts, and zero fixture residue. Independent review found
one P1 and one P2 in evidence completeness and deterministic ordering; both
were corrected and the same reviewer reclosed PASS with no findings.

## Accepted Sub-slice: V6-M1-C2A

Accepted on 2026-07-20 after focused 11/11, Prisma validation, TypeScript,
scoped ESLint, diff check, and disposable PostgreSQL migration
deploy/rollback/reapply proof. Historical invitations are deterministically
marked delivered without creating jobs; held/immediate policy, tenant-bound
foreign keys, state checks, PUBLIC privilege denial, and sensitive-field
exclusion are persisted. Independent review found one P1 and one P2 in attempt
count invariants and executable negative DML evidence; both were corrected,
PostgreSQL negative tests passed 1/1 with zero random fixture residue, and the
same reviewer returned `ACCEPT C2A` with no open P0/P1/P2.

## Immediate Worker Contract: V6-M1-C2B

Owned scope:

- add one server-only invitation delivery service over the accepted C2A policy
  and persistence model
- inside a Serializable transaction, reload the invitation, organization
  lifecycle, actor Person/User binding, and current membership before deciding
  HOLD, QUEUE, or fixed denial
- persist HOLD without a job; for QUEUE, atomically set IMMEDIATE/releasedAt and
  create or reuse exactly one tenant-bound PENDING job
- provide bounded claim, success, and failure primitives with lease ownership,
  attempt limits, stale-lease recovery, fixed redacted error codes, and
  invitation-validity rechecks
- make repeated and concurrent queue/claim/complete calls deterministic; stale
  or wrong leases must never complete or mutate another tenant's job
- preserve hashed invitation tokens and never return or persist plaintext
  tokens, provider payloads, recipient addresses, or infrastructure errors

No-touch:

- actual email/provider calls, scheduler/worker process, retry timing policy,
  and activation-time release of held invitations; these remain M1-C3+
- existing people/invitation Server Action and browser UI; their explicit
  integration remains C2C
- invitation creation, actual email/provider calls, scheduler/worker process,
  retry timing policy, and activation-time held release; these remain C2C+
- accepted activation service, meeting/Brain boundaries, Goal lifecycle,
  Business Loops, AI co-assignees, candidate tensions, deployment, and BioCoach

Required evidence:

- service tests for fresh authorization/lifecycle reload, hold, queue,
  unavailable denial, fixed errors, lease ownership, and attempt exhaustion
- PostgreSQL tests for idempotent queueing, concurrent claim single winner,
  stale/wrong lease denial, success/failure terminal rules, token secrecy,
  tenant isolation, and zero fixture residue
- Prisma validation, TypeScript, scoped ESLint, `git diff --check`, and
  independent review with no open P0/P1/P2

## Accepted Sub-slice: V6-M1-C2B

Accepted on 2026-07-20 after focused policy/persistence/service 21/21,
disposable PostgreSQL persistence/service 2/2, migration rollback/reapply,
Prisma validation, TypeScript, scoped ESLint, and diff check. Queue and claim
are serializable and tenant-bound; invitation validity is rechecked before a
lease; retry limits are persisted; invalid work reaches durable `CANCELLED`;
and no recipient, token, provider payload, or infrastructure error enters a
job or response. Independent review found two P1 state-machine gaps in
caller-controlled attempt limits and invalid-at-completion recovery. Both were
corrected with persisted `maxAttempts` and transactional cancellation, and the
same reviewer returned `ACCEPT C2B` with no open P0/P1/P2.

## Immediate Worker Contract: V6-M1-C2C

Owned scope:

- add domain-separated AES-256-GCM invitation-token envelope helpers using a
  dedicated environment secret with `AUTH_SECRET` fallback; plaintext exists
  only in bounded server memory and the existing authorized invitation-link
  response
- persist ciphertext on the invitation, never on the delivery job, and bind
  decryption context to organization and invitation identity
- extend the server-only delivery service with one atomic invitation-creation
  primitive that freshly reauthorizes the current ORG_ADMIN, validates an
  optional home structure, applies the accepted delivery policy, and creates
  either HELD with no job or IMMEDIATE with exactly one PENDING job
- replace the existing people action's create-then-send path with that atomic
  primitive; remove direct provider execution while preserving hashed token
  lookup and the current authorized link response
- make missing encryption configuration, cross-tenant structure, stale
  authority, invalid input, and transaction failure fixed and non-leaking with
  zero partial invitation/job writes

No-touch:

- actual email/provider execution, job polling/scheduler, retry timing policy,
  activation-time held release, and delivery observability; these remain C2D+
- setup/browser workflow design and activation controls; these remain M1-D
- accepted activation/meeting/Brain boundaries, Goal lifecycle, Business
  Loops, AI co-assignees, candidate tensions, deployment, and BioCoach

Required evidence:

- envelope tests for round trip, random IV, context binding, tamper rejection,
  missing secret, and plaintext exclusion
- service/action tests for SETUP hold, ACTIVE queue, SETUP admin immediate,
  current-admin authority, tenant-bound home structure, fixed failure mapping,
  and no direct provider call
- disposable PostgreSQL proof for atomic create/hold/queue, rollback on failure,
  token hash/ciphertext separation, no plaintext in invitation/job, tenant
  isolation, concurrent duplicate protection where applicable, and zero residue
- Prisma validation, TypeScript, scoped ESLint, `git diff --check`, and
  independent review with no open P0/P1/P2

## Accepted Sub-slice: V6-M1-C2C

Accepted on 2026-07-20 after focused envelope/policy/persistence/service/action
37/37, disposable PostgreSQL 2/2, final migration rollback/reapply, TypeScript,
scoped ESLint, and diff check. Invitation tokens are encrypted with
domain-separated AES-256-GCM, collision-free tenant/invitation AAD, and a
strong dedicated-secret-or-`AUTH_SECRET` policy; the action now atomically
creates HELD or QUEUED work and never calls the provider directly. Real
PostgreSQL initially exposed an unsupported regex bound and a duplicate-token
fixture; both were corrected without weakening production constraints.
Independent security review found two P1 gaps in secret strength and NUL-based
AAD collisions. Both were corrected, and the same reviewer returned
`ACCEPT C2C` with no open P0/P1/P2.

## Immediate Worker Contract: V6-M1-C2D

Owned scope:

- add one explicit-job provider processor over the accepted C2B claim and
  completion primitives; do not add a polling scheduler or background process
- after a successful lease claim, load the invitation delivery payload only
  for the matching tenant/job/live lease, decrypt with organization/invitation
  context, and verify the recovered token against the stored hash before use
- construct the existing base-path-aware invitation URL and invoke the existing
  invitation email provider outside the database transaction
- atomically record success, or map provider/decryption/configuration failures
  to fixed redacted failure codes and bounded retry timing through the accepted
  completion primitive
- tolerate at-least-once provider execution while preserving one visible job
  state, lease ownership, tenant isolation, and no plaintext token logging or
  persistence

No-touch:

- job polling/scheduler, cross-instance exactly-once provider guarantees,
  activation-time held release, and delivery observability; these remain C2E+
- setup/browser workflow design and activation controls; these remain M1-D
- accepted activation/meeting/Brain boundaries, Goal lifecycle, Business
  Loops, AI co-assignees, candidate tensions, deployment, and BioCoach

Required evidence:

- processor tests for claim denial, live-lease payload authority, context/hash
  verification, base path URL, provider success, transient/permanent failure,
  missing configuration, timeout, and fixed non-leaking results
- disposable PostgreSQL proof that SENT updates invitation completion, failures
  remain retryable or exhausted per persisted limit, wrong/stale/tenant leases
  reveal no payload, and no plaintext enters invitation job or logs
- fake provider evidence only; no external email must be sent in acceptance
- TypeScript, scoped ESLint, `git diff --check`, and independent review with no
  open P0/P1/P2

## Accepted Sub-slice: V6-M1-C2D

Accepted on 2026-07-20 after focused processor/service 17/17, disposable
PostgreSQL processor 1/1 after the full 43-migration chain, Prisma validation,
TypeScript, scoped ESLint, and diff check. The processor claims explicit jobs,
loads provider payload only for the tenant/job/live lease, decrypts the token
with organization/invitation context, verifies the token hash before use,
builds a base-path-aware invitation URL, invokes the existing email provider
outside the database transaction, and persists success or fixed redacted retry
failure through the accepted completion primitives. PostgreSQL proof exposed
that C2D fixtures must respect the irreversible lifecycle guard; the test was
corrected to keep the organization in SETUP and exercise explicit-admin
IMMEDIATE delivery without weakening production constraints. Independent
review returned PASS with no open P0/P1/P2.

## Immediate Worker Contract: V6-M1-C2E

Owned scope:

- extend the accepted activation path so a successful `SETUP -> ACTIVE`
  transition releases all eligible HELD invitations for that organization into
  the durable delivery queue
- preserve activation atomicity: lifecycle, activation snapshot/event, invitation
  release, and delivery job creation must commit together; later provider
  failure must never roll lifecycle back
- use the accepted C2B/C2D state machine and constraints; create at most one
  tenant-bound job per invitation and never expose or persist plaintext tokens
  outside existing encrypted invitation storage
- make activation replay/idempotency deterministic: already active organizations
  must not create duplicate delivery jobs
- keep actual provider processing explicit-job only; no scheduler, background
  poller, UI, or delivery observability in this sub-slice

No-touch:

- explicit provider processing semantics accepted in C2D
- setup/browser workflow design and activation controls; these remain M1-D
- accepted meeting/Brain boundaries, Goal lifecycle, Business Loops,
  AI co-assignees, candidate tensions, deployment, and BioCoach

Required evidence:

- activation service tests proving successful activation releases held
  invitations, creates one job per eligible invitation, and leaves consumed,
  revoked, expired, immediate, and already delivered invitations unchanged
- replay/concurrency tests proving no duplicate delivery jobs and no lifecycle
  rollback when invitation release encounters existing jobs or provider failure
  is simulated after commit
- disposable PostgreSQL proof for activation release, tenant isolation,
  append-only activation evidence, zero duplicate jobs, zero plaintext job
  leakage, and zero fixture residue
- Prisma validation, TypeScript, scoped ESLint, `git diff --check`, and
  independent review with no open P0/P1/P2

## Accepted Sub-slice: V6-M1-C2E

Accepted on 2026-07-20 after activation focused 12/12, combined activation and
invitation focused 29/29 with the PostgreSQL env absent, disposable PostgreSQL
activation-release 1/1 after the full 43-migration chain, Prisma validation,
TypeScript, scoped ESLint, and diff check. Successful activation now releases
eligible HELD invitations and creates tenant-bound PENDING delivery jobs inside
the same Serializable activation transaction; replay and already-active paths
create no duplicate jobs; consumed, revoked, expired, immediate, and completed
invitations remain unchanged; and job rows do not contain plaintext tokens,
recipient emails, or provider payloads. Independent review returned PASS with
no open P0/P1/P2.

## Immediate Worker Contract: V6-M1-D

Owned scope:

- add a persistent setup/activation banner and readiness surface for SETUP
  organizations, visible from the app shell and Organization workspace
- expose activation confirmation through the accepted activation service; show
  hard readiness failures, warnings, held invitation release behavior, and
  irreversible activation status without raw infrastructure errors
- show tactical/governance meeting locked state while SETUP and the normal
  meeting creation path after activation
- browser-proof new registration or SETUP fixture, failed readiness,
  warning-only activation, held invitation release, activation success,
  meeting availability, and irreversible denial/replay

No-touch:

- C2 provider processor, activation/invitation persistence semantics, and
  accepted meeting/Brain denial boundaries except for user-facing surfaces
- Business Loops, AI co-assignees, candidate tensions, delivery scheduler,
  observability, deployment, and BioCoach

Required evidence:

- focused source tests for setup banner/readiness/action routing and meeting
  locked copy/state
- browser evidence on desktop and mobile for SETUP, activation, and ACTIVE
  meeting availability, with clean console/network ledger and zero fixture
  residue
- PostgreSQL proof where browser setup/activation mutates lifecycle or
  invitations
- Prisma validation, TypeScript, scoped ESLint, `git diff --check`, and
  independent implementation review with no open P0/P1/P2 before M1 acceptance

## Implementation Evidence: V6-M1-D

M1-D is accepted. The slice adds the Organization workspace setup/readiness
surface, admin-only explicit activation via the accepted activation service,
SETUP meeting lock, ACTIVE meeting availability, and
`scripts/m1d-browser-acceptance.cjs`.

Evidence:

- Browser acceptance passed against a disposable PostgreSQL database and local
  Next server: initial activation disabled, seeded-ready activation enabled,
  meeting locked before activation, activation succeeds, HELD invitation releases
  to one PENDING delivery job, meeting form is available after ACTIVE, mobile has
  no horizontal overflow, console/page/http ledgers are clean, cleanupOk is true,
  the disposable database is dropped, and `loopos_brain_reader` is restored to
  `loopos_brain_reader|t|f|f|f|f|f|f`.
- Source gates passed: Prisma validate with existing warnings only,
  TypeScript, focused tests 26/26, scoped ESLint, and `git diff --check`.
- Independent implementation reviewer returned PASS with no findings and no
  blockers.
- Independent roadmap/evidence re-auditor returned PASS with no findings and no
  blockers.
