# LoopOS Goals

Last updated: 2026-07-21

## Canonical Sources

- Approved V6 design: `docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-design.md`
- V6 implementation plan: `docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md`

- Approved V5 design: `docs/plans/2026-07-14-organization-brain-goal-tree-v5-design.md`
- V5 implementation plan: `docs/plans/2026-07-14-organization-brain-goal-tree-v5-implementation-plan.md`
- M4-B source-authority memory candidate design: `docs/plans/2026-07-15-v5-m4b-source-authority-memory-candidates-design.md`
- M4-B implementation plan: `docs/plans/2026-07-15-v5-m4b-source-authority-memory-candidates-implementation-plan.md`
- M5-A production baseline design: `docs/plans/2026-07-16-v5-m5a-production-baseline-design.md`
- M5-A implementation plan: `docs/plans/2026-07-16-v5-m5a-production-baseline-implementation-plan.md`
- M5-B production validation evidence: `docs/evidence/2026-07-16-v5-m5b-production-validation.md`
- M5-B Brain reader boundary evidence: `docs/evidence/2026-07-16-v5-m5b-brain-reader-production-boundary.md`
- M5-B production recovery proof: `docs/evidence/2026-07-16-v5-m5b-production-recovery-proof.md`
- M5-B acceptance state: `docs/evidence/2026-07-16-v5-m5b-acceptance-state.md`
- M5-B longitudinal readiness evidence: `docs/evidence/2026-07-16-v5-m5b-longitudinal-real-team-readiness.md`
- M5-B remaining gates runbook: `docs/evidence/2026-07-16-v5-m5b-remaining-gates-runbook.md`
- M5-C organization model settings evidence: `docs/evidence/2026-07-16-v5-m5c-model-settings.md`
- M6 Brain-first design: `docs/plans/2026-07-17-v5-m6-brain-first-organization-os-design.md`
- M6 implementation plan: `docs/plans/2026-07-17-v5-m6-brain-first-organization-os-implementation-plan.md`
- M6-0 production Brain Reader readiness: `docs/evidence/2026-07-17-v5-m6-0-brain-reader-readiness.md`
- Previous route-map archive: `docs/archive/GOALS-2026-07-14-pre-v5.md`
- Archive source commit: `8b96ea7`
- Archive SHA-256: `b6603ea7959c70e26737e19a58f1aadd75f1a0c8cb0493c85dad0c567e8c8184`

## Coordination Rules

- This file is the compact shared roadmap for the long-running LoopOS project.
- Keep exactly one Goal active.
- The coordination thread owns goals, constraints, decisions, integration, and evidence gates.
- Delegate bounded implementation to subagents or separate threads with explicit write ownership.
- Workers report only `Conclusion / Changes / Evidence / Blockers`.
- Use an independent thread for work that must remain reviewable.
- Use a local thread for browser, desktop, permission, credential, device, and production-state evidence.
- After each milestone, independently compare this file with the repository, run `/review`, update the roadmap, and only then activate the next milestone.
- Maintain `progress-dashboard.html` while multiple milestones or workers exist.
- Do not announce completion before the named evidence exists.
- Preserve unrelated dirty work and existing canonical tactical and governance behavior.

## North Star

A real team can use LoopOS with low friction to:

1. Set one primary Goal for each Circle in one shared organization cycle.
2. See the organization-wide Goal Tree and how work supports it.
3. Turn Tensions into authorized strategic, tactical, or governance outcomes.
4. Carry Projects and Actions to evidence-backed closure.
5. Use one Organization Brain to understand facts, navigate, prepare work, detect drift, and learn without centralizing decision authority.

## Active Goal

### V6-M6 - Integrated Acceptance and Real-Team Trial

Status: active. This is the only active Goal.

Canonical plan: `docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md`

Target outcome: prove a real non-foundation-model team can register, complete
minimum setup, activate, and run one weekly tension-to-closure operating loop
with human accountability, AI assistance, browser-visible evidence, production
isolation, and no BioCoach cross-application data access.

Current bounded slice: V6-M6-E Production Trial Release and Isolation Proof.

Current evidence: V6-M5 is accepted. Final milestone auditor `Huygens`
returned `ACCEPT V6-M5 AND ACTIVATE V6-M6` after confirming M5-A/B/C/D/E
acceptance, no open P0/P1/P2, inactive deferred scopes, exactly one active Goal,
and V6-M6 pending before activation. Evidence is recorded in
`docs/evidence/2026-07-21-v6-m5f-final-acceptance.md`.

M6-A contract:
`docs/plans/2026-07-21-v6-m6a-integrated-trial-contract.md`.

M6-A evidence harness inventory:
`docs/evidence/2026-07-21-v6-m6a-evidence-harness.md`.

M6-A is accepted. Evidence is recorded in
`docs/evidence/2026-07-21-v6-m6a-contract-acceptance.md`. Independent reviewer
`Pauli` returned `ACCEPT M6-A AND ACTIVATE M6-B` with no findings and no
blockers.

M6-B target output:

- A local integrated browser verifier that exercises the accepted M6-A required
  user journey on disposable data.
- PostgreSQL checks proving authority boundaries, tenant isolation, candidate
  confirmation state, tactical/governance outcomes, and zero fixture residue.
- Browser evidence for desktop and mobile with clean console/page/network
  ledgers.

M6-B current artifact:

- Verifier:
  `scripts/m6b-local-integrated-trial-verifier.cjs`.
- Evidence status:
  `docs/evidence/2026-07-21-v6-m6b-local-integrated-verifier.md`.
- Current finding: the default `.env` local database is missing
  `candidate_tensions`, so M6-B acceptance must run against a disposable fully
  migrated PostgreSQL database.
- Disposable DB readiness now passes with `loopos_m6b_readiness_20260721_2`:
  database created, all migrations applied, required tables present,
  disposable database dropped, and `existsAfterDrop: 0`.
- Local browser smoke now passes on disposable DB
  `loopos_m6b_browser_20260721_1`: registration, setup readiness seed through
  real lifecycle constraints, activation, candidate tension confirmation,
  tactical meeting creation, governance meeting creation, Organization Brain
  access, mobile no-overflow, clean console/page/http ledger, temporary server
  stopped, and disposable DB dropped with `existsAfterDrop: 0`.
- Local SQL-seeded fixture browser deep flow now passes on disposable DB
  `loopos_m6b_deep_20260721_8`: Organization Brain governance proposal,
  tactical meeting outcome approval, assigned Action creation, governance
  meeting initialization, proposer adoption, created governance Role, desktop
  Brain screenshot, mobile organization no-overflow, clean console/page/http
  ledger, temporary server stopped, disposable DB dropped, and
  `temp_db_exists = 0`.
- Focused source gate now passes:
  `./node_modules/.bin/tsx --test src/lib/__tests__/governance-decision.test.ts`
  reported 38 tests / 5 suites / 0 failures; final `npm run build` passed.
- Independent implementation review found P1 issues in governance preview source
  version binding and governance meeting participant boundaries. Fixes are in
  place, with focused tests passing:
  `command-preview-service.test.ts` 8/8 and `goal-command-handler.test.ts`
  16/16.
- After those P1 fixes, the local SQL-seeded fixture browser deep flow was
  re-run on disposable DB `loopos_m6b_deep_20260721_9` and passed with clean
  console/page/http ledger, tactical Action assignment, adopted governance
  process, created governance Role, temporary server stopped, database dropped,
  and `temp_db_exists = 0`.

M6-B scope:

- In scope: local fixture organization, setup readiness, activation, role
  assignment, goal cycle, candidate tension confirmation, tactical meeting
  outcome, governance meeting outcome, Organization Brain read/action support,
  responsive browser evidence, and cleanup.
- Out of scope: production deployment, real-team longitudinal acceptance,
  automatic sensing policy activation, broad notifications, semantic/vector
  retrieval, unsupervised AI execution, and BioCoach integration.

M6-B required evidence:

- Local integrated browser verifier passes against a disposable database.
- `scripts/m6b-local-integrated-trial-verifier.cjs` passes in full browser
  mode, not only readiness mode.
- PostgreSQL authority/isolation assertions pass and report zero residue.
- Desktop and mobile browser ledgers are clean.
- Source gates for the verifier pass.
- Tactical and governance deep outcome processing assertions pass.
M6-B review status:

- Independent implementation review reclosure passed after the P1 fixes.
- Independent roadmap/evidence reclosure passed after explicitly documenting
  that PostgreSQL authority and tenant-isolation negative assertions are not
  proven in the M6-B evidence packet.
- M6-B is retained as local SQL-seeded fixture evidence. It is not the final
  V6-M6 acceptance proof.

M6-C target output:

- Extend or pair the M6-B verifier with PostgreSQL negative assertions for
  cross-tenant denial, unauthorized actor denial, SETUP/ACTIVE boundary denial,
  and zero fixture residue.
- Add a UI-first first-run evidence path, or explicitly document the remaining
  SQL-seeded setup facts as a production-trial precondition.
- Keep production deployment, BioCoach isolation, rollback, and real-team
  longitudinal completion as separate gates with separate evidence files.

M6-C current artifact:

- The verifier now records a `negativeAssertions` block in browser/full mode.
- The same-tenant unauthorized actor assertion has been corrected to call the
  accepted `confirmCandidateTensionWithHuman` service boundary against the
  active `DATABASE_URL`, rather than treating SQL foreign-key behavior as
  authority evidence.
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

M6-D target output:

- Replace the M6-C SQL-seeded setup preconditions with a browser-visible
  UI-first setup path wherever product UI already exists.
- For any setup fact that still cannot be completed through UI without adding
  new domain scope, list it as an explicit production-trial precondition with a
  concrete route/action gap.
- Keep the same full verifier authority/isolation checks intact.

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

M6-D scope:

- In scope: evidence hardening only. Browser-visible setup gaps, database
  authority boundaries, tenant isolation, lifecycle denial paths, cleanup
  assertions, and roadmap/evidence synchronization.
- Out of scope: new domain features, new Organization Brain capabilities,
  automatic sensing policy activation, scheduler work, broad notifications,
  semantic/vector retrieval, and BioCoach integration.

M6-D acceptance status:

- Accepted as local UI-first setup evidence after full browser verifier,
  implementation review reclosure, and roadmap/evidence reclosure.
- Production deployment, rollback, BioCoach isolation, and real-team
  longitudinal trial remain separate unclaimed V6-M6 gates.

M6-E target output:

- Deploy the current accepted local evidence snapshot to Aliyun production using
  local build and remote run, without overloading the server.
- Prove production health/readiness, authenticated smoke for the V6-M6 path,
  strict LoopOS/BioCoach isolation, and a rollback/recovery evidence packet.
- Keep real-team longitudinal completion unclaimed until the trial team runs the
  weekly loop and produces follow-up state evidence.

M6-E required evidence:

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

M6-E current status:

- Aliyun production now points to
  `/var/www/loopos/releases/20260721-m6e-trial-fixed`.
- Public production checks from the server pass for `/loopos`, `/loopos/login`,
  and `/loopos/api/auth/session`.
- `loopos-web` and `loopos-worker` are online after the corrected release. The
  initial package failed because it did not preserve `.next/standalone/server.js`;
  rollback to `20260718-light-theme` restored web health before the corrected
  release was deployed.
- Production migrations are applied and idempotent on the corrected release.
- BioCoach isolation passes with SQLSTATE `42501` denials for both Brain reader
  and application credentials against `biocoach` and `postgres`.
- Authenticated production smoke passes with the provided smoke account: CSRF
  `200`, credentials callback `302`, authenticated `/app` and `/app/brain`
  `200`, and session contains the smoke user.
- M6-E remains not accepted until independent reviews pass and real-team
  longitudinal evidence is collected.

## Next Version Goals

### V6-M7 - AI-Native First-Run to Weekly Operating Loop

Status: proposed. Do not activate until V6-M6 is accepted or explicitly split.

Target outcome: a real team can start from a new organization and complete the
first weekly operating loop with low friction: setup, role accountability,
primary goal, candidate/formal tensions, tactical meeting, governance meeting,
Brain assistance, and evidence-backed closure.

Product definition:

- First-run mode is a guided operating journey, not a settings checklist.
- Organization Brain is the primary assistant throughout setup and weekly work,
  but it suggests, drafts, navigates, and explains without bypassing human
  proposal/meeting authority.
- AI-native structure appears as human+AI role co-assignment, evidence-backed
  candidate tensions, business-loop sensing, and permissioned organization
  memory, not as a GlassFrog clone.
- Organization structure and business loops remain separate but connected
  views: authority/accountability versus value/data flow.

Milestone sequence:

- V6-M7-A: turn the M6-D explicit fixture preconditions into browser-visible
  product paths or intentionally reviewed production-trial preconditions.
- V6-M7-B: first-run guided journey inside `/app/organization` that tells the
  admin the next one action and routes directly to the right UI.
- V6-M7-C: role accountability path from role market/application/governance to
  assignment history, with no direct appointment bypass unless explicitly
  authorized by governance.
- V6-M7-D: primary goal path from cycle creation to proposal, strategic meeting
  decision, adopted goal, target, and first check-in.
- V6-M7-E: tactical meeting path from health review to tension list, per-tension
  processing, generated Projects/Actions/governance tensions, and automatic
  meeting minutes.
- V6-M7-F: production trial release with remote deploy, rollback evidence,
  BioCoach isolation proof, and a real-team weekly runbook.

Evidence required:

- Disposable local browser verifier with clean desktop/mobile ledgers.
- Production deployment and authenticated smoke evidence for the same release.
- Production Reader/BioCoach isolation proof remains mandatory.
- Independent implementation review and roadmap/evidence audit for each
  accepted milestone.
- Real-team longitudinal evidence remains unclaimed until a team completes at
  least one weekly loop with captured outcomes and follow-up state.

M6-A target output:

- A reviewed integrated trial contract for a real team to run LoopOS from
  organization setup through one weekly tension-to-closure operating rhythm.
- A local and production evidence harness that separates source, browser,
  database, deployment, isolation, rollback, UX, and longitudinal evidence.
- A clear trial checklist for administrators and real users that avoids
  claiming completion before evidence exists.

M6-A scope:

- In scope: first-run setup, activation, role assignment, goal cycle creation,
  tactical meeting flow, governance meeting flow, candidate tension
  confirmation, Organization Brain read/action support, production
  health/readiness, rollback, and BioCoach isolation evidence.
- Out of scope: new automatic sensing policies, unsupervised AI execution,
  broad notification fanout, semantic/vector retrieval, plugin marketplace
  expansion, or BioCoach application/database integration.

M6-A locked decisions:

- Real-team trial evidence and independent fixture evidence must be labeled
  separately.
- Production deployment evidence does not prove longitudinal adoption.
- Organization Brain may assist and prepare actions, but final organizational
  authority remains with the relevant human role holders and governance/tactical
  meeting flow.

M6-A blockers:

- No product-decision blocker.
- Longitudinal real-team completion is not yet proven.

M6-A required evidence:

- Trial contract reviewed with no P0/P1/P2.
- `scripts/verify-v6-m6a-contract.mjs` passes.
- Browser flow covers setup to one tactical/governance closure path on desktop
  and mobile.
- PostgreSQL authority/isolation checks pass with zero fixture residue.
- Production health/readiness/authenticated smoke and rollback evidence pass.
- LoopOS credentials and Brain reader remain denied from BioCoach data with the
  expected SQLSTATE evidence.

## Locked Decisions

- V6 is an AI-native organization runtime, not a GlassFrog replica: Organization Structure, Business Loops, Organization Brain, and executable governance policy are distinct connected models.
- New organizations start in explicit `SETUP`; an ORG_ADMIN may irreversibly activate them after four hard readiness checks. `ACTIVE` can never return to `SETUP`.
- Setup order is `组织身份 / 组织结构 / 组织目标 / 角色定义 / 成员邀请 / 角色任命 / 系统配置`.
- Organizations choose `回路`, `圈子`, or `团队` as one organization-wide structure term; structure supports arbitrary nesting.
- Meetings are unavailable during setup. Held invitations send on activation; administrators may send an invitation immediately.
- Formal OKRs require a cycle, but a cycle is not an activation hard gate. Meeting cadence is organization-configurable with per-structure override.
- Organization has parallel `组织结构 | 业务回路` views. Operational loop edits are direct-authority changes; Role/domain/accountability/assignment/decision-right changes require governance.
- AI may co-assume and execute a Role only with an accountable human co-assignee, explicit L0-L4 policy, revocation, confirmation, and audit.
- AI creates evidence-backed candidate tensions; an authorized human Role holder confirms before a formal proposer-owned Tension exists.

- Primary navigation is `Workspace / Goals / Meetings / Organization`.
- Organization Brain, Raise Tension, quick create, search, and notifications are global capabilities.
- Core pending work is one interaction away; frequent work is at most two interactions away.
- Each Circle has at most one active primary Goal per shared organization cycle.
- Child Goals explicitly support their parent Circle Goal; the system does not assign them top-down.
- A Goal belongs to a Circle; follow-up responsibility binds to a Role, not a Person.
- Goal changes use strategic process; tactical meetings inspect progress; governance changes structure only.
- Targets may be numeric or milestone based; Goal total percentage is not manually entered.
- Personal Brain conversations are private by default.
- Shared memory confirmation follows source authority rather than a central administrator.
- Organization Brain is proactively helpful but cannot apply organization changes without confirmation.
- Organization Brain may dynamically read authorized database facts through a read-only query broker with tenant, user, Role, field, cost, and audit controls.
- Confirmed organization-operating facts are transparent to current members; Roles determine relevance and action authority rather than hiding confirmed facts.
- Private conversations and personal drafts remain owner-only, including against organization administrators; contextual drafts require explicit participation, ownership, or capability.
- The model never holds unrestricted database credentials.
- All writes remain previewed, explicitly confirmed, freshly authorized, and audited through an allowlisted command registry.
- Minimal cross-Circle Interface remains core; designer, runtime, validation, and Data -> Pretraining become an optional plugin.

## Accepted Milestones

### V5-M1 - Trustworthy Organization Brain Entry

Status: accepted

Final slice:
- `V5-M1-E2 - Brain UI and Four-Entry Shell`

Worker:
- E1 explorers `Wegener` and `Herschel`, implementation worker `Halley`, correction reviewer `Sagan`, and milestone auditor `Hypatia` are complete and closed.
- E2 explorer `Pauli` completed the independent source/browser audit. Worker `Turing` implemented the locked contract in `6ad7cc7` and corrected review findings in `db0bb46`; reviewer `Herschel` reclosed the source/static gate with no P0/P1/P2.
- E2 local browser/database evidence is recorded. Independent `/review` reopened E2 with two P1 and one P2 findings; bounded correction workers completed and closed all three through `7c9691e` and `095e7f5`. The same reviewer reclosed the exact findings, targeted browser/database re-evidence passed, and the final independent roadmap audit returned `ACCEPT M1` with no P0/P1/P2. No M1 worker remains.
- Planned E2 ownership remains transport and browser UI only; E2 may call the accepted E1 service but may not import or reimplement D2, M1-C, D1, Prisma persistence, or actor authorization.
- E2 no-touch: accepted E1/D2/D1/M1-C source, authorization/session/database internals, Prisma schema/migrations/generated output, tactical/governance/Goal/interface runtime, commands, deployment, scripts, package metadata, and lockfiles.

Acceptance record:
- M1-D1 is accepted in `d14241c`; independent review found no P0/P1/P2 and marked it safe to integrate.
- Coordinator D1 proof passed focused 30/30, all 58 source files and 428 tests, TypeScript, scoped ESLint, diff/no-touch checks, and one redacted StepFun live smoke with `ANSWERED`, one deterministic fact, one source, Chinese-output validation, and no exposed model text or credential.
- M1-D2 is accepted through `c4a3a4b`, correction `df89a83`, and final hardening `555e217`; same-reviewer reclosure found no P0/P1/P2 and marked it safe to integrate.
- Coordinator D2 proof passed focused 49/49, all 61 source files and 477 tests, TypeScript, scoped ESLint, diff/no-touch checks, and one redacted production StepFun smoke with `PLANNED`, one `circles` plan, one symbolic actor reference, and no actor-ID leak.
- M1-E1 is accepted in `8aa10e3`; it owns owner-private conversation creation/list/load and one current-message turn, resolves ActorContext server-side, claims USER before downstream work, keeps provider/read work outside transactions, persists one deterministic BRAIN result, and exposes no generic message write, update, delete, or organization mutation.
- E1 first review found one P1 and three P2 issues in D1 evidence congruence, injected D2 validation, broker packet validation/deduplication, and canonical stored JSON. All four were fixed test-first in the same five files; same-reviewer reclosure reported no P0/P1/P2 and `SAFE TO INTEGRATE`.
- Coordinator E1 proof passed focused 83/83, all 64 source files and 561 tests, PostgreSQL 14.18 1/1 with owner/admin/second-tenant/concurrency/cleanup, TypeScript, scoped ESLint, Prisma validation, production build 33/33, and diff/no-touch checks.
- Redacted E1 runtime proof passed both configured-provider and provider-off paths. StepFun-on produced durable `ANSWERED` with one fact/source and one D2/query/D1 call; StepFun-off produced durable `UNAVAILABLE / PROVIDER_UNAVAILABLE` with zero query/D1 calls. Both replayed from persisted USER/BRAIN with zero new downstream calls and cleaned all temporary data.
- Independent milestone audit `Hypatia` returned `ACCEPT E1 and ACTIVATE E2`, no P0/P1/P2, and kept browser evidence explicitly deferred to E2.
- M1-E2 source is integrated through `6ad7cc7` and correction `db0bb46`: four-entry desktop/mobile shell, four explicit E1 Server Actions, global Brain Sheet, full workspace, structured answers and sources, honest M2 Goals state, meeting grouping from existing timestamps, Organization secondary navigation, Role links, and keyboard-selectable Circle map.
- The first E2 review found three P1 and one P2 issue in route-boundary highlighting, rejected Action Promise handling, retry identity lifetime across panel/workspace transitions, and source-text-only tests. The correction added segment-aware navigation, fixed local temporary failures, authenticated-layout-scoped in-memory pending-request state, and executable behavior tests; same-reviewer reclosure reported no P0/P1/P2.
- Coordinator E2 source proof passed all 70 source-test files with 581 tests, TypeScript, scoped ESLint, Prisma validation, production build 35/35, exact diff/no-touch checks, and clean worktree.
- Coordinator E2 browser proof passed on disposable PostgreSQL 14.18 with a dedicated non-inheriting login, the shared non-login reader Role, four real authenticated actors, and separate model-off and controlled-provider runtimes. All actors received exactly `Workspace / Goals / Meetings / Organization`, global Brain access, and only their owner-private conversations at 1440x1000 and 390x844; the same-organization bystander received no conversation and the second tenant received only its own conversation.
- Model-off persisted and rendered one durable `UNAVAILABLE / PROVIDER_UNAVAILABLE`. The controlled provider produced one valid `circles` plan and a forced reasoner failure; the UI persisted/rendered deterministic `EVIDENCE_ONLY / PROVIDER_FAILURE` with three confirmed Circle facts and three unchanged source links, all of which opened their real Circle pages without 404.
- Independent local Chromium pixel proof showed no horizontal overflow or overlap at either viewport; keyboard operation opened the global Brain, retained `/app/brain` as the expand destination, closed through the focused close control, and focused the labeled question field. The in-app Browser interaction/DOM surface agreed, while its screenshot compositor became unreliable after viewport override and was not used as pixel evidence.
- Browser diagnostics had zero console warnings/errors, page errors, HTTP error responses, or actionable failed requests; only expected aborted Next.js prefetches were observed. Persistence contained exactly one USER and one BRAIN row for the controlled turn, one successful `circles` audit with result count 3, and zero duplicate message IDs. The dedicated reader had no PUBLIC usage/create, database TEMP, business-table INSERT/UPDATE/DELETE, audit INSERT, login, superuser, role/database creation, replication, or RLS-bypass authority. All temporary browser, provider, application, and database resources were stopped and removed, with no listeners remaining on 3215/3216/3217/55447.
- The first milestone `/review` found two P1 issues and one P2: focus restoration ran while the question field was still disabled, one global `take: 50` could hide current or nearest upcoming meetings before grouping, and long continuous user text could clip on mobile. E2 acceptance was suspended until all three were fixed test-first, the same reviewer reclosed them, and focus plus 390x844 long-text browser evidence was refreshed.
- Corrections `7c9691e` and `095e7f5` wait for an enabled textarea before one-shot focus restoration, wrap continuous USER text with `overflow-wrap:anywhere`, and query all current, nearest 50 upcoming, and latest 50 historical meetings independently. Same-reviewer reclosure closed all three findings with no remaining P0/P1/P2.
- Coordinator correction proof passed focused 11/11, repository source runner 70/70 files and 584 tests, TypeScript, scoped ESLint, Prisma validation, production build 35/35, exact four-file diff/no-touch checks, and clean committed source. Targeted 390x844 Chromium proof passed real focus after new conversation, controlled temporary failure, and successful retry; a 2024-byte continuous identifier wrapped with bubble `scrollWidth = clientWidth = 292` and document `scrollWidth = clientWidth = 390`. A real PostgreSQL browser fixture retained a meeting started 120 days earlier but still active, included nearest upcoming/history rows 1-50, and excluded row 51. The controlled request failure was the only expected `net::ERR_FAILED`; all other page-error, HTTP-error, actionable network, and application-log ledgers were clean. Ports 3218/55448 and all temporary resources were removed.
- M1-C is accepted through `f2a90cb` and review correction `0bb1d98`; same-reviewer reclosure found no P0/P1/P2 and marked it safe to integrate.
- Coordinator correction proof passed 81 focused tests, all 55 source files and 398 tests, TypeScript, scoped ESLint, diff checks, and fresh PostgreSQL 14.18 1/1 with cleanup.
- M1-D1 must consume evidence packets rather than unrestricted rows; reconstruct facts deterministically; label model prose as inference, recommendation, or missing evidence; accept only supplied evidence IDs; retain deterministic source navigation when the model is unavailable; and expose no write operation.
- The previously missing natural-language vertical chain is now explicit and mandatory: D1 evidence reasoning, D2 bounded query planning, E1 private conversation and turn orchestration, then E2 transport and browser UI.
- Bounded evidence reasoning, query planning, turn persistence/orchestration, E2 correction, targeted browser/database re-evidence, same-reviewer reclosure, and final roadmap audit are accepted. M1 commands, shared memory, proactive behavior, Goal work, and plugins remained inactive.

Accepted M1-D1 contract:
- Public production API is `reasonOrganizationQuestion(input)` over exact-key version 1 input: a UTF-8-bounded question and either `AUTHORIZED` evidence `{packets, hasMore}` or generic `DENIED` with no packets. D1 never accepts ActorContext, plans, database handles, broker callbacks, tools, actions, commands, URLs, or write capabilities.
- Test/composition dependency injection may expose only `isAvailable()` and `generate({system, prompt, temperature, maxTokens, timeoutMs, maxRetries}) -> string`. The production adapter uses the existing provider; it has no tool or function-calling surface.
- Trimmed question is 1-2,048 UTF-8 bytes. Accept at most 20 unique packets, 48 KiB aggregate display data, and a 64 KiB canonical prompt. Revalidate exact M1-C packet shape, `ev_` plus 64 lowercase hex characters, record IDs up to 191 bytes, catalog-owned display fields, unique truncated fields, local-or-null links, and ISO or `notesRevision:<integer>` source versions.
- Prompt projection includes only evidence ID, resource, source version, display, and truncated-field names. Record IDs and application links stay outside the model prompt. The question and evidence are serialized once as untrusted JSON data under a fixed system instruction requiring Chinese structured output and forbidding tools, actions, writes, code execution, and instruction following from evidence text.
- Provider settings are temperature 0, at most 1,200 output tokens, 20-second total aborting timeout, and zero retries. Raw output over 16 KiB is rejected before parsing. The selected-provider availability check must require that provider's own key; existing provider callers keep their defaults when the new options are omitted.
- Raw model output is exact-key version 1 with at most 24 items: up to 20 `FACT`, 6 `INFERENCE`, 6 `RECOMMENDATION`, and 6 `MISSING_EVIDENCE`. FACT supplies exactly one existing citation ID and a bounded list of catalog display-field names, never prose. Narrative text is 1-600 UTF-8 bytes; inference and recommendation use 1-5 unique existing citations; missing-evidence items use no citations.
- Final response has fixed sections and status `ANSWERED | EVIDENCE_ONLY | INSUFFICIENT_EVIDENCE | DENIED | REJECTED`. FACT values, labels, versions, record IDs, links, and truncation flags are reconstructed from validated packets and frozen catalog label maps, never copied from model prose. Citation membership proves grounding input, not semantic entailment; model prose remains visibly labeled as inference or recommendation.
- Reject the complete model output without partial salvage for extra fields, malformed JSON, unknown labels, invented/duplicate/missing citations, duplicate items, unsupported FACT fields, or model-supplied URLs, versions, actions, commands, or factual prose. Never repair Markdown fences or return provider bodies/raw errors.
- Provider off, timeout/failure, malformed output, invented citation, or unsupported FACT output returns `EVIDENCE_ONLY` with deterministic facts and canonical sources. Authorized zero evidence returns `INSUFFICIENT_EVIDENCE` without a provider call. Denied input returns generic Chinese `DENIED` with no provider call, sources, counts, or existence hints. Invalid or over-limit input returns `REJECTED` with no partial packets.
- Fixed response codes cover invalid question/evidence, limits, denial/empty evidence, provider off/timeout/failure, output size/schema, citation violations, and unsupported factual claims. Response ordering is facts, inferences, recommendations, missing evidence, then sources; packet and catalog field order are deterministic.
- New owned files: `reasoner.ts`, `response-schema.ts`, and focused tests. Minimal provider ownership: `src/lib/ai/provider.ts` plus provider tests for selected-provider availability, optional timeout/retry behavior, AI SDK timeout, and StepFun abort. No package change or transitive schema-library import.
- Static proof must show D1 imports no broker, Prisma, database, persistence, action, command, domain-operation, filesystem, process-execution, network URL, or tool module. Recommendations remain strings and cannot become previews or writes.
- Required acceptance evidence: Chinese Role, Circle, work, meeting, and authority questions; prompt-injection-as-data; deterministic facts and source links; provider-off/timeout/malformed output; invented/duplicate/missing citations; oversized input/output; no-write import/export; provider option compatibility; full source tests, TypeScript, scoped ESLint, diff/no-touch checks, a redacted selected-provider live smoke when configured, and independent review with no P0/P1/P2.

Accepted M1-D2 contract:
- Production API is `planOrganizationQuestion(actor, {schemaVersion: 1, question})`; `actor` is a trusted server-resolved `ActorContext` used only for local preflight and is never serialized into the model prompt. Test composition may inject a text-only port with exactly `isAvailable()` and `generate({system, prompt, temperature, maxTokens, timeoutMs, maxRetries})`.
- Input has exact keys, schema version 1, and a trimmed, well-formed UTF-8 question of 1-2,048 bytes. The canonical prompt is at most 64 KiB and carries the question once as untrusted JSON data under a fixed Chinese instruction that forbids following question text as instructions, tools, URLs, actions, code, writes, SQL, or identifiers outside the logical query schema.
- The model-facing catalog is a deep-frozen projection derived from the accepted M1-C catalog. It exposes only schema version, logical resource token, existing Chinese resource label, display-field names, filterable logical field token and scalar type, logical operators, allowed symbolic actor references, non-ID sortable logical fields with `asc | desc`, one-hop relation resource tokens, and D2 limits.
- The model-facing catalog and prompt must never contain M1-C `view`, quoted `column`, `projection`, `recordIdField`, `defaultSort`, relation `on`, `linkRule`, SQL/operator fragments, database/schema/table names, actual tenant/user/person/Role/Circle/conversation/record IDs, rows, credentials, environment values, application URLs, callbacks, tools, compiler objects, broker handles, or execution/audit functions. Tests must recursively prove forbidden keys and executable values are absent and that the projection cannot be mutated.
- Actor-dependent filters use only `{actorRef: "personId" | "homeCircleId" | "assignedActiveRoleDefIds" | "ledActiveCircleIds"}` where the accepted M1-C field/operator pair permits them. No actual actor-context value is included in the prompt or returned response. Literal opaque record IDs remain accepted only when already present in the user's untrusted question and valid under M1-C; D2 never invents or injects them.
- Exact raw model output is `{schemaVersion: 1, plans: RawPlanV1[]}` with no extra keys, Markdown, repair, rationale, prose, URL, action, command, or executable content. Raw output is rejected before JSON parsing above 16 KiB or for malformed/wrong-prototype data, invalid Unicode, or any schema mismatch.
- `RawPlanV1` is the exact M1-C version 1 subset `{schemaVersion, resource, limit, filters?, relation?, sort?}`. `limit` is required and 1-10; `page` is forbidden so the authoritative parser supplies page 1. Filters remain exact `{field, operator, value}`, relation remains exact `{resource, filters?}`, sort remains exact `{field, direction}`, and every nested object rejects extra keys.
- Accept 0-3 plans. Valid zero plans mean `NO_PLAN / NO_SUPPORTED_PLAN`. For nonempty output, require sum of limits at most 20 and sum of M1-C parsed `estimatedCost` at most 96; each plan still inherits M1-C limits including 16 KiB, depth 5, 128 entries, eight total filters, three relation filters, 20 literal `in` values, one relation, two sort terms, 256-byte strings, 191-byte IDs, 50 expanded actor references, and per-plan cost at most 64.
- Preflight every raw plan through `parseBrainQueryPlan(plan, actor)`. Extract only effective limit and estimated cost, then discard the parsed object because actor references have been expanded to real IDs. D2 never returns, persists, logs, or passes the parsed object to the model and imports no broker, compiler, read adapter, query audit, database, persistence, action, command, or write surface.
- Duplicate detection canonicalizes the raw plan without actor expansion: page is effectively 1, AND filters and `in` values are order-insensitive, sort-term order is preserved, and actor filters remain symbolic `{actorRef}`. Semantically duplicate plans reject the complete model output.
- Return exact deep-frozen `{schemaVersion: 1, status, code, plans}`. `plans` is nonempty only for `PLANNED / PLANNED` and contains unchanged validated raw plans, never parsed plans. Any plan, aggregate, duplicate, or schema failure rejects the complete output without partial salvage.
- Statuses are `PLANNED | NO_PLAN | UNAVAILABLE | REJECTED`. Planner codes are `PLANNED`, `NO_SUPPORTED_PLAN`, `PROVIDER_UNAVAILABLE`, `PROVIDER_TIMEOUT`, `PROVIDER_FAILURE`, `INVALID_QUESTION`, `QUESTION_LIMIT_EXCEEDED`, `PROMPT_LIMIT_EXCEEDED`, `OUTPUT_LIMIT_EXCEEDED`, `OUTPUT_SCHEMA_INVALID`, `PLAN_COUNT_EXCEEDED`, `PLAN_LIMIT_EXCEEDED`, `TOTAL_ROW_LIMIT_EXCEEDED`, `TOTAL_COST_LIMIT_EXCEEDED`, `DUPLICATE_PLAN`, plus the accepted fixed `BrainQueryPlanErrorCode` values. Responses expose no raw provider body or error.
- Provider settings are temperature 0, at most 1,200 output tokens, a 20-second total aborting timeout, and zero retries. Provider unavailable, timeout, or failure returns `UNAVAILABLE` with zero plans. Malformed/unsafe/over-limit model output returns `REJECTED` with zero plans. No deterministic fallback is allowed because it would duplicate and drift from the authoritative catalog/parser contract.
- Historical `privateMessages` planning remains intentionally constrained: M1-C requires exactly one literal `conversationId eq` filter, while D2 receives no trusted conversation ID. D2 does not inject the current conversation ID; unsupported history questions may produce zero plans until a later ownership-bound capability is explicitly designed.
- Owned files are new `query-planner.ts`, `query-planner-schema.ts`, required `query-planner-catalog.ts`, and their focused tests. No-touch remains provider/D1, all M1-C parser/catalog/broker/compiler/read/audit source, authorization, Prisma, persistence, UI, tactical/governance/Goal/interface runtime, commands, deployment, docs/roadmap/dashboard, scripts, package metadata, and lockfiles.
- Required acceptance evidence: Chinese Role, Circle, project, action, tension, meeting, tactical-outcome, and governance-decision questions; symbolic actor-reference planning with no leaked IDs; prompt-injection-as-data; safe-catalog key/value and immutability proof; provider-off/timeout/failure; zero/one/three/four plans; extra keys, Markdown, invalid Unicode, forbidden page, missing/oversized limits, inherited M1-C failures, total-row/cost overflow, semantic duplicates, private-message scope; deep-frozen raw response; no-execute/no-write import proof; focused and full source tests, TypeScript, scoped ESLint, diff/no-touch checks, one redacted selected-provider live planning smoke when configured, and independent review with no P0/P1/P2.

Accepted M1-E1 contract:
- Production exports are owner-bound `createOrganizationBrainConversation`, `listOrganizationBrainConversations`, `loadOrganizationBrainConversation`, and `executeOrganizationBrainTurn`. Every production entry resolves `ActorContext` internally through `resolveActorContext`; public inputs never accept actor, tenant, owner, role, history, plan, evidence, callback, SQL, URL, tool, action, command, database handle, or arbitrary message role/content.
- Conversation creation accepts exact `{schemaVersion: 1, clientConversationId}` with a well-formed opaque client id of 1-128 UTF-8 bytes. Derive internal `bc_<64 lowercase SHA-256 hex>` from a fixed domain separator plus actor organization, actor person, and client identity. Create-or-owner-verify with `title=null`; replay returns the same private conversation. No caller-selected database ID, title change, rename, update, or delete exists in M1.
- Listing accepts exact `{schemaVersion: 1, limit?}`, defaults to 20, caps at 50, filters by actor organization and owner, sorts by `updatedAt desc, id desc`, and returns no total count. Loading accepts exact `{schemaVersion: 1, conversationId, messageLimit?}`, defaults to 50, caps at 100, filters by the same owner boundary, returns the latest bounded messages in ascending display order plus `hasMore`, parses BRAIN content strictly, and never exposes raw stored JSON for BRAIN rows. Foreign and missing conversations are indistinguishable.
- Turn input is exact `{schemaVersion: 1, conversationId, clientTurnId, question}`. Conversation ID is 1-191 bytes; client turn id is a well-formed opaque 1-128-byte value; question is trimmed, well-formed UTF-8 of 1-2,048 bytes before persistence. Invalid input performs no write or downstream call.
- Derive one turn digest from a fixed domain separator plus actor organization, actor person, conversation ID, and client turn id. USER id is `bm_u_<64 hex>` and BRAIN id is `bm_b_<64 hex>`, both below the broker's 191-byte bound. Reusing the same turn identity with different normalized question content returns fixed `IDEMPOTENCY_CONFLICT` and never overwrites either message.
- A short Prisma claim transaction owner-verifies the conversation, insert-if-absent claims exactly one deterministic `USER` message, validates any winner's organization/conversation/role/content, updates conversation `updatedAt` only for a newly inserted USER, and loads any deterministic BRAIN winner. The transaction commits before D2, broker, or D1; missing/foreign ownership returns generic `ACCESS_DENIED` with no BRAIN write.
- A valid terminal BRAIN winner is strictly parsed and returned immediately with zero planner, broker, or reasoner calls. Same-process unresolved calls coalesce by deterministic USER message id. Across instances, races may duplicate planner/provider/read/audit cost under the accepted M1 rule, but primary keys plus insert-if-absent completion permit only one visible USER and one visible BRAIN.
- Each unresolved attempt calls D2 once with only the current normalized question and resolved actor. E1 loads no prior messages into D2 or D1 and never injects its private conversation ID into the question or a plan.
- D2 `PLANNED / PLANNED` executes its unchanged 1-3 raw plans sequentially through `executeOrganizationBrainQuery(actor, conversationId, userMessageId, rawPlan)`. Every plan uses the same persisted USER identity. Stop at the first failure; execute no later plan, discard every collected packet, do not call D1, and retain only audits already completed by the authoritative broker.
- After all plans succeed, flatten packets in plan/result order, OR `hasMore`, and deduplicate by `evidenceId`. Keep the first byte-identical duplicate; the same ID with any differing packet field yields `FAILED / EVIDENCE_CONFLICT`. Never trim, reorder, partially salvage, or bypass D1's own 20-packet/48-KiB validation.
- Call D1 exactly once only after all planned broker calls succeed, with `{status: "AUTHORIZED", packets, hasMore}`. Successful zero rows still call D1 and become its deterministic `INSUFFICIENT_EVIDENCE / NO_AUTHORIZED_EVIDENCE`; D1 provider-off/failure retains its accepted evidence-only response. E1 never passes D1 `DENIED` and never lets D1 access plans, actor, persistence, broker, or writes.
- D2 `NO_PLAN / NO_SUPPORTED_PLAN` calls neither broker nor D1 and persists fixed `INSUFFICIENT_EVIDENCE / NO_SUPPORTED_PLAN`. D2 `UNAVAILABLE` persists the same provider code under `UNAVAILABLE`; D2 `REJECTED` persists the same code under `REJECTED`. Unexpected planner failure is `FAILED / PLANNER_EXECUTION_FAILED`; malformed injected planner output is `FAILED / PLANNER_RESPONSE_INVALID`.
- Typed broker plan codes persist as `REJECTED` with the same code. `INVALID_INVOCATION` becomes generic `DENIED / ACCESS_DENIED`. `AUDIT_FAILED`, `QUERY_TIMEOUT`, `DATABASE_POLICY_MISMATCH`, `DATABASE_UNAVAILABLE`, `ROW_SHAPE_MISMATCH`, and `DATABASE_EXECUTION_FAILED` persist as `FAILED` with the same code. Unexpected query failure is `FAILED / QUERY_EXECUTION_FAILED`.
- Accepted D1 responses persist unchanged. Unexpected reasoner failure becomes `FAILED / REASONER_EXECUTION_FAILED`; malformed injected reasoner output becomes `FAILED / REASONER_RESPONSE_INVALID`. Orchestration never stores raw provider/database errors, stack traces, SQL, rows, plans, evidence outside the accepted response, credentials, or callbacks.
- Persist BRAIN `content` as compact canonical JSON with the exact ordered nine-key D1 response shape: `schemaVersion,status,code,message,facts,inferences,recommendations,missingEvidence,sources`. E1 extends status only with `UNAVAILABLE | FAILED` and extends codes only with the fixed planner/query/orchestration codes above. Orchestration-generated responses use fixed Chinese messages and empty evidence arrays.
- A short completion transaction insert-if-absent writes the deterministic BRAIN row, then owner-loads and strictly validates the committed winner. First writer wins across instances; every caller returns the stored result and exact message IDs with no replay flag. Completion/persistence failure returns fixed `PERSISTENCE_FAILED` and never returns an unpersisted answer; invalid stored terminal content fails closed as `STORED_RESPONSE_INVALID` and is never overwritten.
- Turn return is exact deep-frozen `{schemaVersion: 1, conversationId, userMessageId, brainMessageId, result}`. Pre-claim failures use a fixed typed service error allowlist: `INVALID_INPUT | ACCESS_DENIED | IDEMPOTENCY_CONFLICT | PERSISTENCE_FAILED | STORED_RESPONSE_INVALID`; raw errors and foreign existence are never exposed.
- Test/composition DI is limited to bounded `resolveActor`, `store` methods `create/list/load/claim/complete`, `plan`, `executeQuery`, and `reason`. No dependency accepts arbitrary SQL, actor input from transport, message role, update/delete operation, generic write callback, tool, action, or command. Production dependencies are only `resolveActorContext`, the existing Prisma client through the bounded private store, accepted D2, authoritative M1-C broker, and accepted D1.
- Owned files are exactly new `conversation-store.ts`, `conversation-store.test.ts`, `turn-service.ts`, `turn-service.test.ts`, and `turn-service.postgres.test.ts`. No-touch: every existing source file, Prisma schema/migrations/generated output, D1/D2/M1-C, authorization, UI/transport, tactical/governance/Goal/interface runtime, commands, deployment, docs/roadmap/dashboard, scripts, package metadata, and lockfiles.
- Required acceptance evidence: exact input/ID/content bounds; owner-only create/list/load; foreign/missing indistinguishability; USER-before-planner/query proof; 0/1/3 plan ordering; every D2 and broker mapping; stop-on-failure and partial-evidence discard; evidence dedupe/conflict and `hasMore`; D1 zero-row/model-off behavior; terminal replay zero downstream calls; same-process coalescing; concurrent first-writer BRAIN; conflicting idempotency key; strict stored-response parsing; no raw error/no generic write/static no-SQL proof; focused/full source tests, TypeScript, scoped ESLint, Prisma validate, production build, diff/no-touch checks, provider-off runtime, redacted configured-provider E1 smoke, PostgreSQL 14 owner/admin/second-tenant and concurrency proof with cleanup, and independent review with no P0/P1/P2. Browser evidence remains E2.

Locked M1-E2 contract:
- E2 is a browser transport and presentation slice only. It adds no schema, query, reasoning, persistence, authorization, meeting, governance, tactical, Goal, command, memory, or notification domain behavior. The browser never receives `ActorContext`, database handles, plans, SQL, evidence packets outside the accepted E1 DTO, provider details, raw errors, or generic message/write operations.
- `src/app/app/brain/actions.ts` is the only new transport boundary. It imports only the four accepted E1 production functions plus their public DTO/error types and exposes four explicit Server Actions: create `{clientConversationId}`, list `{limit?}`, load `{conversationId,messageLimit?}`, and submit `{conversationId,clientTurnId,question}`. Each action injects `schemaVersion: 1`; there is no generic action discriminator, route handler, API endpoint, GET mutation, cache, tag, or revalidation behavior.
- Every transport result is exactly `{ok:true,data:<accepted E1 DTO>}` or `{ok:false,code,message}`. Public error codes are `INVALID_INPUT | NOT_AVAILABLE | RETRY_CONFLICT | TEMPORARY_FAILURE`; fixed Chinese messages are respectively `请求内容不符合要求。`, `无法访问该组织大脑会话。`, `该请求标识已用于不同内容，请重新提交。`, and `组织大脑暂时不可用，请稍后重试。`. E1 `INVALID_INPUT` maps to `INVALID_INPUT`, `ACCESS_DENIED` to `NOT_AVAILABLE`, `IDEMPOTENCY_CONFLICT` to `RETRY_CONFLICT`, and persistence/stored-response/unknown failures to `TEMPORARY_FAILURE`. No raw `error.message`, stack, actor, existence, provider, or persistence detail crosses the action boundary.
- The client generates one opaque `clientConversationId` before create and one `clientTurnId` per submitted question. It preserves each identity across ambiguous retries and creates a new turn identity only after a definitive response or an explicit new question. E2 does not implement optimistic BRAIN content, history mutation, rename, delete, sharing, commands, drafts, previews, apply, or organization writes.
- The authenticated primary navigation contains exactly four daily destinations for every current member: `工作台` -> `/app`, `目标` -> `/app/goals`, `会议` -> `/app/meetings`, and `组织` -> `/app/circles/map`. Desktop uses the existing sidebar with Lucide icons and labels; mobile uses a fixed four-tab bottom bar with stable dimensions and safe-area spacing. Search, notifications, account, Raise Tension, and Organization Brain remain global controls rather than primary entries.
- ORG_ADMIN-only `/app/interfaces` and `/app/setup` remain reachable as secondary organization utilities and never appear in the four-entry primary navigation. Existing deep links remain valid. Workspace retains one-click access to current queues and frequent project/action/tension/review surfaces; no existing data becomes inaccessible.
- `/app/goals` is an explicit, operationally honest M1 state explaining that the organization Goal Tree arrives in M2. It does not synthesize Goals, rename Projects as Goals, or expose a fake tree. The page preserves a direct return to current work.
- `/app/meetings` retains a visible start-meeting action and presents existing records by current/active, upcoming/preparation, and history only where existing fields prove those states. It must not infer or persist new meeting state. `/app/circles/map` remains the Organization landing surface and provides stable secondary access to map, Circle list, My Roles, people, and governance records. Circle Role rows link to existing Role detail pages; the interactive map supports keyboard selection in addition to pointer dragging.
- Organization Brain is visible from every authenticated page in the top bar. Its accessible right-side Sheet and `/app/brain` full workspace share one client implementation. The Sheet has a labelled title/description and an explicit expand action; opening or closing it preserves the current page. The full workspace supports create/list/load, latest bounded messages, submit, retry, and source navigation, with no additional E1 capability.
- Brain answers render confirmed facts, inferences, recommendations, missing evidence, and sources as visibly separate sections. Source links use each returned `applicationUrl` unchanged; `null` remains noninteractive. The UI explicitly renders every accepted stored status: `ANSWERED`, `EVIDENCE_ONLY`, `INSUFFICIENT_EVIDENCE`, `DENIED`, `REJECTED`, `UNAVAILABLE`, and `FAILED`, including deterministic model-off `UNAVAILABLE`, without claiming an answer that E1 did not return.
- Required states are empty, loading, conversation-loading, sending, success, no evidence, denied/not available, rejected, retry conflict, temporary failure, and model unavailable. Pending submission is disabled, status changes use `aria-live`, Cmd/Ctrl+Enter submits, Shift+Enter inserts a newline, and focus returns predictably after submit/retry. Icon-only global controls use Lucide icons, accessible names, and tooltips; visible text must not overlap or clip at 390x844 or 1440x1000.
- Exact production write ownership is limited to `src/app/app/layout.tsx`, `src/app/app/page.tsx`, `src/app/app/goals/page.tsx`, `src/app/app/meetings/page.tsx`, `src/app/app/circles/map/page.tsx`, `src/app/app/circles/[id]/page.tsx`, new `src/app/app/brain/{page.tsx,loading.tsx,error.tsx,actions.ts}`, `src/components/layout/{sidebar.tsx,mobile-nav.tsx,topbar.tsx}`, `src/components/circles/circle-map.tsx`, and new `src/components/organization-brain/brain-client.tsx`. Tests may be added or updated only beside those owned files. No other production file may change.
- Static and focused evidence must prove the four-entry contract, admin utilities excluded from primary navigation, action input injection/error redaction/no forbidden imports, retry identity stability, all status/section rendering, source-link behavior, Goals honesty, keyboard/focus labels, and map/Role reachability. Then run all source tests, TypeScript, scoped ESLint, Prisma validate, production build, and exact diff/no-touch checks; independent review must close all P0/P1/P2 findings before browser acceptance.
- Browser evidence uses a disposable migrated database with one organization owner/member, ORG_ADMIN nonowner, second same-organization member, and a second-tenant member, plus owner-private conversations and source-backed Circle, Role, Project, Action, Tension, Meeting, tactical, and governance records. Both application and dedicated Brain read URLs must target the disposable database.
- Browser acceptance runs all four actors at 1440x1000 and 390x844 and proves exactly four primary entries, global Brain access, owner-only list/load, foreign/missing conversation indistinguishability, no Brain write surface, working source destinations, keyboard operation, focus/labels, no overlap/clipping, and clean console/network. Model-on and model-off use separate runtime instances and fresh conversations; model-off must persist/render `UNAVAILABLE`. A controlled provider plan-success/reason-failure case must persist/render deterministic `EVIDENCE_ONLY`. Screenshots/network evidence and database duplicate-count evidence remain separate claims, followed by full cleanup.

Accepted M1 vertical sequence:
- `V5-M1-D2 - Bounded Query Planner` is accepted: it converts one current question into 0-3 raw PlanV1 inputs through a safe catalog projection with no SQL or identifiers, preflights with the M1-C parser, caps each limit at 10, total rows at 20, and aggregate cost at 96.
- `V5-M1-E1 - Turn and Conversation Service` is accepted in `8aa10e3`: resolve ActorContext server-side; persist one owner-private USER message before any broker call; plan each message independently; execute plans sequentially using that message identity; discard partial evidence; call D1; persist one deterministic BRAIN response before returning; expose no generic message-write primitive.
- `V5-M1-E2 - Brain UI and Four-Entry Shell` passed its broad source/browser matrix, bounded correction, same-reviewer reclosure, targeted focus/long-text/meeting browser evidence, and final roadmap audit. UI never reimplements planner, broker, reasoner, or persistence logic.
- Existing Brain tables support deterministic message-ID idempotency in M1. Cross-instance exactly-once provider execution would require a later lease model; M1 accepts possible duplicate read audits/provider cost but no duplicate visible messages or organization mutations.
- M1-B2b is integrated in `54821d6`; independent review found no P0/P1/P2 and marked it safe to integrate.
- The database now exposes exactly six B2a foundation resources and nine B2b operational resources through the dedicated reader, with meeting drafts participant-only and no fabricated confirmed-meeting-result resource.
- M1-C accepts a typed, bounded structured query plan over only the 15 authorized resources and rejects unknown fields, mutation intent, forbidden families, excessive depth/cost, explicit cross-tenant scope, and unbounded reads.
- No model, caller, or plugin may supply SQL, table names, view names, column names, operators, or executable callbacks. Any internal compiler must derive only from an immutable resource/field/operator catalog and parameterized values, or use an equivalently bounded composition of the fixed reads.
- Evidence packets must identify the source resource and record, include only safe display fields, carry a current timestamp or source version, and resolve to deterministic application links without trusting stored URLs.
- Each successful or denied broker execution must produce the bounded audit behavior required by the B1 `BrainQueryAudit` contract without granting the Brain organizational write authority.
- M1-C query execution, evidence, deep links, and audit plus D1 reasoning, D2 planning, E1 turn orchestration, and E2 transport/UI passed their implementation and evidence gates. M1 commands, shared memory, and proactive behavior remained inactive.

Accepted M1-C contract:
- Accept only exact-key plan version 1: `schemaVersion`, `resource`, optional AND-only `filters`, optional one-hop allowlisted `relation`, optional `sort`, `page`, and `limit`. Caller-selected projections, SQL, database identifiers, callbacks, mutation intent, and explicit tenant/organization/user/person scope are forbidden.
- Compile exactly one parameterized `SELECT` from an immutable 15-resource catalog. The compiler alone owns view, column, join, operator, projection, and deterministic tie-breaker fragments; values are always bound and `contains` escapes wildcard characters.
- Enforce before `BEGIN`: 16 KiB plan, depth 5, 128 structural entries, 8 total filters, 3 relation filters, 20 `in` values, one relation, two sort terms, 256 UTF-8 bytes per filter string, 191 bytes per ID, page 1-10, limit 1-50, `page * limit <= 500`, and estimated cost at most 64. Lists fetch `limit + 1` and expose `hasMore`, never a total count.
- Resolve actor references only from canonical `ActorContext`: `personId`, `homeCircleId`, `assignedActiveRoleDefIds`, and `ledActiveCircleIds`; cap expanded actor lists at 50. Opaque foreign record IDs produce the same empty result as missing IDs and never a cross-tenant existence oracle.
- Preserve the B2 transaction boundary: dedicated non-inheriting reader, transaction-local actor identity, read-only transaction, 5-second timeout, one bounded statement, rollback, and destructive client release after rollback failure. No exported API may accept arbitrary query text or identifiers.
- Emit evidence as `{evidenceId, source, display, truncatedFields, applicationUrl}`. IDs are tenant-bound deterministic SHA-256 references without exposing the tenant ID; display strings are inert data, at most 2 KiB each and 8 KiB total; source version uses `updatedAt`, meeting `notesRevision`, or observation time. All links are allowlisted routes built with `withBasePath()` and encoded identifiers; stored URLs are ignored and resources without a real page return `null`.
- Require an owner-matched Brain conversation and USER message before broker execution. With valid invocation identity, persist exactly one value-redacted `M1_C_USER_QUERY` audit for success, plan/policy rejection, or database failure. Invalid invocation identity performs no query; if the audit database cannot record the result, discard any packets and fail closed.
- Audit scope contains only catalog/plan-shape metadata, field/operator names, relation/sort shape, pagination, estimated cost, latency, timeout, and `hasMore`. Never persist filter values, prompts, SQL, rows, evidence text, URLs, credentials, or raw database errors.
- Rejection and failure codes are fixed allowlists. Prompt-like or SQL-like strings inside values remain inert searchable data; unknown keys, prototype-bearing or cyclic objects, forbidden resource families, excessive cost, malformed types, timeout, row-shape mismatch, and database policy mismatch fail closed with no partial packets.
- Focused proof must cover strict parsing and malformed-input fuzzing, catalog-only SQL, cost/pagination, all deterministic links and `null` links, prompt injection as data, audit success/rejection/failure, timeout/rollback, owner-private data, meeting participation, opaque foreign IDs, and two-tenant denial in disposable PostgreSQL 14.

Desired outcome:
- An ordinary member can open a configured Organization Brain from any application page, ask open organization questions, receive permission-correct answers grounded in current database facts, inspect sources, and navigate directly to the right page without granting the Brain any write authority.

Scope:
- Canonical actor context and centralized M1 read policy.
- Dedicated read-only database path with database-enforced tenant boundaries.
- Validated dynamic query plans over an allowlisted Brain read surface.
- Organization Brain profile, private conversations, messages, and query audit.
- Evidence packets, fact/inference/advice labeling, deep links, and model-off fallback.
- Global Brain side panel and full workspace.
- Four-entry primary navigation and approved interaction budgets.

Explicit exclusions:
- No Goal schema or Goal Tree implementation.
- No Brain write commands.
- No shared memory or proactive notifications.
- No arbitrary model-generated SQL.
- No plugin extraction.
- No tactical or governance behavior changes.
- No multi-organization switching.

Resolved blockers and dependencies:
- M1 started from fragmented application permissions and no RLS baseline; the accepted solution uses a dedicated non-inheriting reader and security-barrier views without claiming a general RLS migration.
- M1 proved the database identity is read-only and tenant denial holds even if an application filter is missing.
- M1 fails closed when Session, Membership, Person, and active organization do not agree.
- Relevant Next.js guides under `node_modules/next/dist/docs/` were read before implementation.

Required evidence:
- Focused authorization, query-plan, evidence, reasoning, and UI tests.
- Full source test runner, TypeScript, scoped ESLint, Prisma validate, and production build.
- Disposable PostgreSQL migration apply, reverse review, reapply, read-only identity, and two-tenant denial proof.
- Prompt-injection and forbidden-data tests.
- Desktop and mobile browser evidence for member, Role assignee, administrator, and second-tenant denial.
- Source links and click-budget ledger.
- Model-off and expensive-query degradation evidence.
- Independent implementation review and independent roadmap audit.
- Runtime and disposable-resource cleanup evidence.

## Accepted Milestones (continued)

### V5-M2 - Goal Tree Closed Loop

Status: accepted

Final slice:
- `V5-M2-E - Acceptance and Cleanup`

Worker:
- M2-A, M2-B1, M2-B2, C1, C2, and D implementation, correction, review, and acceptance workers are closed.
- M2-D acceptance auditor `019f63ce-9876-7912-8a6c-b9feaa663580` returned `ACCEPT M2-D AND ACTIVATE M2-E` after closing its exact bounded-projection P2 with no open P0/P1/P2.
- M2-E correction workers `019f6405-22fb-70b1-93a2-e30d41de5630`, `019f6405-46fa-7c82-88bc-b34aa21262f6`, and `019f640f-f603-74f3-8f01-ad9402464e2c` closed the exact final-review authority, FormData, bounded-read, and presentation findings. Final UI worker `019f6473-93be-7cf1-a28a-69d0e58eedd6` exposed the identity of an actionable draft after browser evidence found that its lifecycle controls lacked a human-readable title. Final auditor `019f63e7-6d0f-7db2-85e5-29d4768dff6a` returned `ACCEPT M2 AND ACTIVATE M3` after the cleanup-only reclosure.

Acceptance record:
- Validate the integrated M2 milestone as one user-visible loop: shared cycle and Goal Tree, distributed drafting, exact strategic confirmation, Target evidence, tactical work linkage, and Workspace alignment.
- Keep static/source, real PostgreSQL, browser, security/no-touch, build, cleanup, and real-team longitudinal evidence explicitly separated. Do not convert prior coordinator evidence into independent-auditor claims.
- The final source and targeted runtime refreshes completed without replaying unchanged matrices; the independent roadmap audit then accepted M2.
- Independent implementation review and roadmap/acceptance audit closed with no open P0/P1/P2.
- Make no new product or domain capability. Any correction must be tied to a concrete final finding and independently reclosed before M2 acceptance.
- Organization Brain Goal operations, governance Goal controls, plugins, deployment, M3, and production activation remained inactive until the final M2 acceptance decision.

Desired outcome:
- A real team can complete the full browser-visible M2 Goal loop from distributed proposal through strategic confirmation, tactical evidence/work alignment, Goal Tree truth, and daily Workspace context with durable provenance and no authority bypass.

Scope:
- Consolidated source, database, browser, security, no-touch, build, cleanup, and roadmap evidence for M2-A through M2-D.
- Final audit of lifecycle invariants, one-primary-Goal cardinality, hierarchy, distributed proposal authority, strategic recorder authority, follow-up capability boundaries, provenance, correction history, candidate trust, bounded reads, error redaction, responsive UX, and tenant isolation.
- State-document reconciliation, disposable-resource verification, accepted-slice commit integrity, and explicit remaining real-team evidence gap.

Explicit exclusions:
- No new schema, migration, domain operation, Goal mutation, UI surface, navigation, Organization Brain Goal read/write, governance Goal control, seed/backfill, plugin extraction, deployment, or unrelated refactor.
- No production or real-team completion claim from source, disposable PostgreSQL, or synthetic browser evidence alone.

Required evidence:
- Final snapshot full source runner, M2 focused suites, TypeScript, scoped ESLint, Prisma validate, production build, and exact diff/no-touch inventory.
- Consolidated PostgreSQL evidence for migrations, invariants, lifecycle, concurrency, two tenants, append-only correction, all work-link kinds, rollback safety, and cleanup, with explicit identification of earlier accepted evidence versus any final rerun.
- Consolidated desktop/mobile browser evidence for proposal, strategic confirmation, tactical follow-up, Workspace context, authority denials, refresh durability, keyboard/responsive behavior, model-off operation, and actionable console/network cleanliness.
- Independent final `/review` and independent roadmap/acceptance audit with no open P0/P1/P2.
- Explicit residual evidence: at least one real team must still run a complete weekly Goal loop before longitudinal product validation can be claimed.

M2-A evidence status:
- Schema/history inventory complete at `c9a89bd`: no Goal/OKR domain exists; additive models and database invariants are required.
- Authority/process inventory complete: Goal strategy operations are absent; tactical proposal authority is distributed and closed; governance remains structural; existing execution follow-up is Person-bound and cannot substitute for Goal Role ownership.
- Review candidate created at `docs/plans/2026-07-15-v5-m2-goal-domain-lifecycle-contract.md`.
- First independent contract review found five P1 and one P2: cycle cancellation, check-in correction concurrency, inactive-Role authority, work-link lifecycle, achieved-result truthfulness, and Circle hierarchy integrity. The accepted contract addresses all six.
- Same-reviewer reclosure reported no P0/P1/P2 and declared M2-A safe to activate M2-B1.
- No schema, migration, Server Action, UI, meeting mutation, Brain Goal read, package, or deployment change has started.

M2-B1 review status:
- Preliminary source evidence passed focused 14/14, full source 71/71 files with 598 tests, TypeScript, scoped ESLint, Prisma validate, and complete-stack migration apply on PostgreSQL 14.18.
- Independent review correctly rejected the first SQL checkpoint: proposal terminal state could bypass GoalDecision; one CREATE decision could also close its Goal; adoption could omit proposed Targets; rollback emptiness was raceable; future revisions could be pre-created.
- SQL correction passed focused 16/16, full source 71/71 files with 600 tests, TypeScript, scoped ESLint, Prisma validate/generate, production build, diff checks, full-stack apply/rollback/reapply, valid lifecycle paths, all rejection probes, and non-empty rollback retention.
- Same-reviewer reclosure reported no P0/P1/P2. Coordinator PostgreSQL 14.18 evidence passed the complete 23-migration stack, two-tenant and immutability denial, one-winner cycle concurrency, guarded non-empty rollback, exact empty rollback, and clean reapply.
- Empty rollback removed all B1 tables, types, functions, and triggers, restored the original Circle parent foreign key, and retained four M1 Brain tables plus fifteen `brain_read` views. Reapply restored nine Goal tables, ten enums, seventeen functions, and twenty-one triggers.
- Independent acceptance audit `019f6219-9ac1-7a40-be7f-0d143d1d6182` returned PASS with no P0/P1/P2 and approved B2 activation. Ports 55449 and 55450 have no listener; both disposable clusters and all temporary probes were removed.

M2-B2 review status:
- The complete domain-operation candidate passed coordinator source evidence: 36/36 focused tests, 72/72 source files with 636 tests, TypeScript, scoped ESLint, and diff checks.
- Independent source review rejected the first candidate with two P1 and one P2: real adapter-pg `P2002 meta.target` arrays were misclassified, unknown database errors escaped the typed boundary, and the ACHIEVED-close fake represented an impossible zero-Target state.
- Corrections classify structured unique targets, convert unknown persistence failures to a stable redacted domain code, and prove legal ACHIEVED plus insufficient-evidence rollback with real Target/effective-check-in state. The first same-reviewer reclosure returned PASS with no P0/P1/P2.
- Fresh PostgreSQL 14.18 acceptance exposed one additional P1: Prisma 7.8 `adapter-pg` nests quoted unique fields under `meta.driverAdapterError.cause.constraint.fields`, so the active-cycle conflict was initially misclassified as `CONSTRAINT_VIOLATION`. The narrow correction accepts direct or nested field arrays and strips only surrounding SQL quotes; a focused regression was added.
- Final coordinator evidence passed 39/39 focused tests, 72/72 source files with 639 tests, TypeScript, scoped ESLint, diff checks, and production build. Final same-reviewer reclosure returned PASS with no P0/P1/P2.
- A fresh complete 23-migration PostgreSQL 14.18 stack passed admin cycle lifecycle, active-cycle conflict mapping, proposer-only revisions, exact historical replay and mutation conflict, exact strategic/tactical meeting authority, administrator denial, two-tenant zero-write denial, concurrent adoption and correction single-winner behavior, typed health, all three work-link kinds, post-terminal link removal, atomic CREATE/REPLACE/CLOSE effects, and legal cycle closure. Tenant B received zero Goal rows; the final database had zero active cycles and zero active Goals.
- The disposable PostgreSQL process, port 55451, cluster directory, and both temporary probes were removed.
- Independent acceptance audit `019f627e-71a2-7e21-9b0e-2b66ff803a64` independently reran 39/39 focused and 72/72 source files with 639 tests, verified no B1/no-touch drift, kept browser evidence explicitly out of B2 scope, and returned PASS with no P0/P1/P2. B2 is accepted and C1 is active.

M2-C1 evidence status:
- The tenant-bounded read model, current-revision proposal projection, four drafting Server Actions, `/app/goals` server boundary, responsive tree/detail workspace, and CREATE/REPLACE/CLOSE drafting form are integrated.
- Coordinator review closed five concrete findings: missing eligible Role choices, ACTION source links routed to Tensions instead of Tracker, stale Goal URL after selecting a missing-Goal node, missing withdrawal for returned proposals, and duplicate conditional heading IDs.
- The first real browser pass exposed raw cycle UUID, Role ID, and Target enum labels plus three Topbar Button-as-Link warnings. Base UI Select labels, the duplicate MILESTONE option, and all three Topbar link semantics were corrected test-first.
- Independent `/review` rejected the first candidate with two P1 and four P2 findings: child CREATE without an active parent Goal, only one actionable proposal rendered, silent fallback for same-cycle non-active Goal links, duplicate mobile/desktop draft IDs, an invalid nested fieldset legend, and hydration-sensitive date formatting. Two disjoint correction workers fixed all six; the same reviewer reclosed each exact finding and returned PASS with no open P0/P1/P2.
- Final focused evidence passes 26/26 across read projection, drafting transport, page/UI boundaries, and Topbar semantics. The repository source runner passes 75/75 files with 658 tests; scoped ESLint, TypeScript, and `git diff --check` pass. The latest Next.js 16.2.10 production build compiles and generates 35/35 static pages. The first sandboxed build attempt failed only because Turbopack could not bind its internal port; the authorized local rerun passed.
- Disposable PostgreSQL 14.18 applied the complete 23-migration stack. Browser mutations persisted one data-Circle DRAFT revision, advanced the inference-Circle proposal to SUBMITTED, retained the alignment-Circle RETURNED revision, and left the second tenant with zero Goal proposals. A second legal DRAFT in the data Circle proved that both actionable proposals retained independent submit and withdraw controls.
- Chromium evidence passed at 1440x900 and 390x844: one-click Goal Tree access, active/missing/stale/inactive-owner/evidence states, stable deep links, DRAFT creation, submission, returned-proposal revision/withdrawal, two actionable proposals, cross-tenant denial, same-cycle non-active Goal warning, Enter/Space operation, mobile Sheet focus restoration, human-readable Select labels, zero duplicate DOM IDs, no horizontal overflow, and zero actionable console, page, request, or HTTP errors.
- Temporary browser scripts were removed. Ports 3121 and 55452 have no listener, and the temporary application copy and PostgreSQL cluster were deleted.
- Independent C1 acceptance audit `019f62d6-2800-78b0-b9f1-2d2e9cf57ee8` independently reran 26/26 focused tests, verified source/no-touch boundaries and cleanup, kept PostgreSQL/browser/build evidence correctly classified as coordinator evidence, returned `ACCEPT C1 AND ACTIVATE C2`, and found no P0/P1/P2. C1 is accepted and C2 is active.

M2-C2 evidence status:
- The tenant-bounded strategic-meeting projection, thin Goal decision Server Action, dedicated strategic workbench, independent proposal/decision pagination, and exact `STRATEGY` meeting integration are implemented. Tactical and governance branches remain unchanged.
- The first independent review found five P2 issues: silent row capping, adoption during a planned cycle, zero-based Target labels, visible internal decision IDs, and client/server note-length mismatch. Bounded corrections replaced the cap with independent 50-row pagination, aligned adoption and UTF-8 limits, and removed presentation leaks. A later browser keyboard failure exposed Next Server Action `$ACTION_` metadata rejection; the parser now ignores only that framework prefix while retaining strict rejection of every ordinary extra or forged field.
- Final focused evidence passes read 8/8, Action 8/8, workbench 12/12, and dashboard semantics 6/6. The repository source runner passes 78/78 files with 693 tests and zero failures, with three environment-gated tests skipped. TypeScript, scoped ESLint, Prisma validate, `git diff --check`, and the Next.js 16.2.10 production build with 35/35 generated pages pass.
- Fresh PostgreSQL 14.18 evidence proves CREATE=ADOPTED, REPLACE=RETURNED, and CLOSE=DECLINED with exactly one immutable decision per proposal and durable notes. CREATE produced one ACTIVE child Goal with one copied Target; the returned replacement and declined closure preserved both existing ACTIVE Goals. The second tenant retained zero Goals, proposals, and decisions.
- Chromium evidence covered 50/1 proposal pagination, proposer-participant authority, absent-proposer denial, same-organization nonparticipant administrator denial, exact second-tenant 404, UTF-8 limits, duplicate-submit safety, durable refresh provenance, Enter/Space operation, desktop 1440x900, and mobile 390x844 with no overflow or duplicate IDs. A Base UI link-semantics warning discovered on the tenant login landing page was fixed test-first. The expected cross-tenant 404 produced one React development-only `performance.measure` page error; an isolated harness matched only that exact development instrumentation event with zero request failures, while all actionable application paths remained clean.
- Final same-reviewer reclosure `019f62f6-1295-7243-bbaa-3fa458a423f5` independently reran 34/34 focused tests, found no open P0/P1/P2, and kept PostgreSQL, browser, and build claims explicitly owned by the coordinator.
- The disposable application, PostgreSQL cluster, scripts, and screenshots were removed. Ports 3122 and 55453 have no listener, while the pre-existing port 3001 service remains untouched.
- Independent C2 acceptance audit `019f633b-ab6d-7871-8837-85483c641b40` independently reran 34/34 focused tests, verified source, evidence classification, cleanup, and state-document consistency, returned `ACCEPT C2 AND ACTIVATE M2-D`, and found no open P0/P1/P2. C2 is accepted and M2-D is active.

M2-D evidence status:
- The exact tactical meeting now projects the same-Circle active Goal, bounded Target evidence and correction history, stable server-computed evidence age, active/removed work links, and bounded approved-outcome/blocking-Tension candidates. Workspace adds a compact, tenant-bounded 6+1 Goal context with independently derived full-fact health and explicit nested truncation.
- Authority is capability-specific: an unended exact tactical participant may append evidence and manage work links; a current active owner-Role assignee may append evidence without receiving work-link authority. Owner-only evidence carries no false meeting provenance. Administrator, Circle lead, coach, Project bearer, Action owner, and AI status grant no implicit authority.
- The first independent source review found one P1 and three P2: owner-assignee evidence denial, unbounded tactical collections, unbounded Workspace relations, and client-clock hydration risk. Two bounded correction workers fixed all four. Same-reviewer reclosure `019f63ac-4cd7-7270-b5ba-8e6ec0395c43` returned PASS with no open P0/P1/P2.
- Final focused evidence passes 47/47. The repository source runner passes 83/83 files with 734 tests and zero failures. TypeScript, scoped ESLint, `git diff --check`, and the Next.js 16.2.10 production build with 35/35 generated pages pass.
- Fresh PostgreSQL 14.18 applied the complete 23-migration stack after provisioning the migration-required no-login Brain reader role. Browser writes persisted three append-only check-ins: Alice's numeric evidence plus correction retain the exact tactical meeting, while owner-assignee Bob's nonparticipant milestone evidence correctly has no meeting provenance. One approved Project link retains exact create/remove meeting provenance and removal reason; the second tenant retained zero Goal check-ins.
- Chromium evidence passed desktop 1440x900 and mobile 390x844 with zero horizontal overflow: Workspace one-click Goal access, Target evidence and correction after refresh, approved Project linkage/removal, keyboard Goal navigation, owner-assignee nonparticipant evidence with work-link denial, same-organization nonowner administrator zero controls, and exact second-tenant 404. After excluding expected Next prefetch cancellations and the expected denial 404, there were zero actionable console, page, request, or HTTP errors.
- The disposable application and PostgreSQL processes, fixture, browser script, cluster, JSON, and screenshots were removed. Ports 3123 and 55454 have no listener; the pre-existing port 3001 service was not touched.
- Independent acceptance audit `019f63ce-9876-7912-8a6c-b9feaa663580` independently reran 47/47 focused tests and rejected M2-D with one P2: meeting participants and owner-Role assignees remained unbounded even though other high-cardinality tactical collections were bounded. M2-E remains inactive while that exact finding is corrected and reclosed.
- The exact P2 correction replaces full participant loading with a one-row exact-viewer probe and replaces full owner-assignee loading with a stable 5+1 preview, exact count, explicit truncation, and a separate tenant/Role/Goal-bound viewer-membership probe. Coordinator evidence passes the affected read/UI tests 19/19 and TypeScript without reopening build, database, or browser matrices whose behavioral paths are unchanged.
- Same acceptance auditor reclosure independently reran the affected 19/19 tests, verified exact viewer probes, stable 5+1 owner preview, exact count, explicit truncation, independent owner authority, unchanged capability semantics, and state-document accuracy, then returned `ACCEPT M2-D AND ACTIVATE M2-E` with no open P0/P1/P2.

M2-E evidence status:
- The accepted M2-D implementation and M2-E activation are committed in `f6fef7f`; the worktree was clean before final-snapshot verification.
- Final-snapshot source evidence passes 83/83 discovered and executed source-test files with 736 tests and zero failures. TypeScript, corrected-scope ESLint, Prisma validate, and `git diff --check` pass. Two earlier ESLint invocations did not execute because their requested glob/path did not exist; no code failure was hidden, and the corrected exact scope passed.
- The Next.js 16.2.10 production build passes and generates 35/35 pages. The final bounded participant/owner projection correction is therefore covered by affected 19/19 tests, TypeScript, ESLint, and production compilation.
- Previously accepted fresh PostgreSQL and Chromium evidence remains classified as coordinator evidence from the immediately preceding M2-D candidate. It was not replayed after the final read-only bounded-projection correction because no mutation, authority, route, form, schema, or persistence behavior changed; M2-E makes no claim that this is a second runtime reproduction.
- The temporary application, PostgreSQL, fixture, browser script, cluster, JSON, and screenshots remain removed; ports 3123 and 55454 have no listener, and the existing port 3001 service was never touched.
- Independent final implementation `/review` rejected the first snapshot with two P1 and two P2 findings: work-link authority could bypass the participant-only boundary, Goal Tree reads were unbounded, drafting Actions accepted unknown fields, and Goal UI exposed raw IDs/status values.
- The bounded correction moves work-link participant/candidate enforcement into the canonical transaction, applies exact drafting FormData allowlists, fail-closes incomplete Goal Tree/strategic projections with deterministic sentinels, and replaces visible internal identifiers/status tokens with named and localized projections. Two correction reclosure findings added independent actionable-proposal reachability and stable node/cycle editor identity. The same reviewer closed every original and correction finding with no open P0/P1/P2 and returned `SAFE FOR M2 ACCEPTANCE AUDIT`.
- Corrected final-snapshot evidence passes 83/83 discovered and executed source-test files with 757 tests, TypeScript, scoped ESLint, Prisma validation, `git diff --check`, and the Next.js 16.2.10 production build with 35/35 generated pages.
- Independent roadmap/acceptance audit rejected the earlier snapshot because one M2-B1 PostgreSQL process, three M1 E2 browser processes, and their temporary resources remained, while this file and the dashboard contained stale state. The exact processes were terminated; port 55445 now has no listener, the named temporary paths are absent, and the existing port 3001 service remains untouched. The state-document corrections are recorded below; audit reclosure remains the single open gate.
- The reviewed authority/query/UI correction is committed in `2ab7505`. Targeted PostgreSQL 14.18 evidence then applied all 23 migrations and used the canonical transaction to create an active Project work link from an approved same-Circle candidate in the exact unended tactical meeting. The exact participant succeeded; a nonparticipant who was also an active owner-Role assignee was denied with `RECORDER_NOT_PARTICIPANT`, and no denied work link was persisted.
- The targeted 1440x900 authenticated Chromium gate passed 11/11: the actionable draft remained reachable beyond proposal-history page one without a duplicate draft entry; owner Role, Metric, Project, and status labels were human-readable; switching between same-kind Goal proposal nodes reset form state; the document had no horizontal overflow; and console/request failure ledgers were empty.
- That browser gate exposed one bounded UI issue: actionable DRAFT/SUBMITTED controls did not identify the current revision. Worker `019f6473-93be-7cf1-a28a-69d0e58eedd6` added title, conclusion, and human-readable placeholder fallback in exactly two files. Focused evidence passed 13/13, TypeScript, two-file ESLint, and `git diff --check`; the same final reviewer returned PASS with no P0/P1/P2, the rebuilt Next.js 16.2.10 snapshot generated 35/35 pages, and the correction is committed in `4af7661`.
- Targeted runtime cleanup is complete: ports 3124 and 55455 have no listener, `/tmp/loopos-v5-m2e-runtime.a4oV5i` is absent, and the pre-existing port 3001 service remains listening and untouched.
- The final cleanup-only reclosure removed the unused 45 MB `/tmp/loopos-v5-m2-b1.1KLpMl` cluster after confirming no process held it. `/tmp` has no top-level `loopos-v5-m2*` path, port 55445 has no listener, and the final auditor returned `ACCEPT M2 AND ACTIVATE M3` with no open P0/P1/P2.
- Longitudinal evidence from one real team's complete weekly Goal loop remains explicitly unproven.

Outcome:
- Root and child Circles complete one shared-cycle Goal flow from draft and strategic confirmation through Target evidence, tactical inspection, Goal Tree display, and Workspace alignment.

Activation gate:
- Passed on 2026-07-15: V5-M1 accepted, reviewed, audited, and cleaned up.

## Completed Milestone

### V5-M4 - Proactive Perception and Memory

Status: complete

Current slice:
- V5-M4 is accepted; M4-A private proactive briefs, M4-B source-authority memory candidates, and M4-C confirmed shared-memory retrieval are complete.

Current gate:
- V5-M3 is accepted: Brain-assisted Goal operations are previewed, explicitly confirmed, fresh-authorized, ledger-audited, and browser-proven without bypassing canonical organization processes.
- Final M3 acceptance auditor `Curie` returned `ACCEPT M3 AND ACTIVATE M4` with no findings and no blockers.
- M4-A private daily or weekly briefs, M4-B source-authority memory candidates, and M4-C confirmed shared-memory retrieval are accepted. Final V5-M4 auditor `Tesla` returned `ACCEPT V5-M4 AND ACTIVATE V5-M5` with no P0/P1/P2. No global memory feed, plugin, deployment, or M5 hardening was activated inside M4.
- Product owner confirmed M4-B Option A: build memory candidates first and do not create canonical shared memory in this slice. The accepted design and implementation plan are documented in `docs/plans/2026-07-15-v5-m4b-source-authority-memory-candidates-design.md` and `docs/plans/2026-07-15-v5-m4b-source-authority-memory-candidates-implementation-plan.md`.
- M4-B1 candidate contract and pure lifecycle is accepted after source evidence, same-reviewer implementation reclosure, and independent roadmap audit. M4-B2 persistence and actor-scoped service is accepted after coordinator evidence, implementation review reclosure, and roadmap audit reclosure. M4-B3 Brain draft and submission surface is accepted after source/browser evidence, independent implementation review, and roadmap audit. M4-B4 source-authority review and decision surface is accepted after route/denial source evidence, refreshed browser evidence, independent implementation reclosure, and roadmap audit reclosure. M4-B5 and M4-B are accepted after final cleanup audit PASS. Product owner confirmed M4-C Option A: confirmed-candidate retrieval first. M4-C design and implementation plan are documented in `docs/plans/2026-07-15-v5-m4c-canonical-shared-memory-retrieval-design.md` and `docs/plans/2026-07-15-v5-m4c-canonical-shared-memory-retrieval-implementation-plan.md`. M4-C1 shared memory entry contract, M4-C2 actor-scoped retrieval service, M4-C3 Brain turn integration and answer surface, M4-C4 browser acceptance, and M4-C5 cleanup are accepted. Final M4 acceptance audit passed. Plugins, deployment, M5, global feeds, notifications, semantic retrieval, and longitudinal evidence remained inactive through M4.

Outcome:
- Organization Brain detects drift, prepares briefs, and turns selected private insights into memory candidates only through explicit user submission and source-authority confirmation.

Activation gate:
- Passed on 2026-07-15: V5-M3 accepted, reviewed, audited, and cleaned up.

## Completed Milestone

### V5-M5 - Pluginization and Industry Hardening

Status: accepted on 2026-07-17

Outcome:
- Interface Automation is optional, Data -> Pretraining is a template, failure modes are hardened, and a real team provides longitudinal operating evidence.

Activation gate:
- Passed on 2026-07-16: V5-M4 accepted, reviewed, audited, and cleaned up.

Accepted slice:
- `V5-M5-B` production validation is accepted.

Current gate:
- V5-M1, V5-M2, V5-M3, and V5-M4 are accepted with independent review/audit closure.
- Product owner confirmed M5-A starts with production baseline before plugin boundary or real-team longitudinal trial.
- M5-A planning checkpoint is accepted: independent reviewer `Parfit` returned `PASS / accept M5-A planning and activate M5-A1` with no P0/P1/P2 findings.
- M5-A1 is accepted: `package.json` pins `pnpm@10.28.0`, `deploy/aliyun/README.md` locks the production package-manager and secret-free evidence contract, `docs/evidence/production-baseline-template.md` defines the evidence shape, coordinator verification passed JSON/evidence-shape checks and `git diff --check`, and independent reviewer `Kuhn` returned `PASS / M5-A1 is safe to accept after coordinator verification` with no P0/P1/P2 findings.
- M5-A2 is accepted: `docs/evidence/2026-07-16-v5-m5a2-local-release-candidate.md` records Prisma generate/validate, source tests 98/98 files with 865 tests, TypeScript, diff check, production `/loopos` build with 35/35 static pages, routes-manifest `/loopos/` -> `/loopos` redirect, and full 26-migration deploy on a disposable PostgreSQL database after the documented B2A reader-role prerequisite. Disposable database and role cleanup both returned zero matching rows. Independent reviewer `Lorentz` returned `PASS / M5-A2 is safe to accept after coordinator updates GOALS/dashboard` with no P0/P1/P2 findings.
- M5-A3 is accepted: `scripts/verify-production-http.mjs` defines anonymous no-secret public HTTP checks, `docs/evidence/production-browser-smoke-checklist.md` defines the authenticated read-only browser smoke contract, `docs/evidence/2026-07-16-v5-m5a3-production-smoke-design.md` records coordinator verification, and independent reviewer `Laplace` returned `PASS / M5-A3 is safe to accept after coordinator updates GOALS/dashboard` with no P0/P1/P2 findings.
- M5-A4 is accepted: `docs/evidence/production-recovery-checklist.md` defines LoopOS-only rollback/recovery boundaries, `scripts/verify-production-recovery-plan.mjs` dry-run checks PM2/Nginx/README/checklist recovery contract, `docs/evidence/2026-07-16-v5-m5a4-recovery-proof.md` records coordinator verification, and independent reviewer `Herschel` returned `PASS / M5-A4 is safe to accept after coordinator updates GOALS/dashboard` with no P0/P1/P2 findings.
- M5-A5 is accepted: `docs/evidence/2026-07-16-v5-m5a5-acceptance-cleanup.md` consolidates the production-baseline evidence; final implementation reviewer `Nietzsche` returned `PASS / M5-A implementation is safe to accept after roadmap audit`; final roadmap/evidence auditor `Russell` returned `PASS / accept M5-A and activate M5-B production validation`.
- M5-A production baseline is accepted. Production deployment, pluginization, semantic/vector retrieval, notification policy, and longitudinal real-team validation remain unclaimed until direct M5 evidence exists.
- Historical M5-B initial production snapshot, superseded by the current Reader evidence below: `docs/evidence/2026-07-16-v5-m5b-production-validation.md` records release `20260716-135813-m5b-trial`, 26 applied migrations, public/authenticated HTTP and browser smoke, zero smoke residue, and the then-safe blocked Brain boundary with no dedicated login. `docs/evidence/2026-07-16-v5-m5b-production-recovery-proof.md` records the bounded recovery proof for the `.next/node_modules` packaging incident, current/previous release readback, PM2 online state, and post-recovery public HTTP pass. These are retained as historical evidence and do not describe the current Reader state.
- M5-B is accepted. `docs/evidence/2026-07-16-v5-m5b-acceptance-state.md` remains a truthful historical snapshot with `accepted=false`, 15 passed gates, 2 blocked gates, and 0 missing gates. On 2026-07-17 the product owner moved real-team longitudinal evidence to V5-M6-6 final acceptance; it remains explicitly unproven and is not counted as completed. Product owner accepted the bounded recovery proof as sufficient for M5-B without an extra rollback symlink switch drill. Screenshot-based browser evidence remains recorded in `docs/evidence/assets/2026-07-16-v5-m5b-organization-brain-production.png` with zero smoke residue.
- The production technical Brain Reader gate passed in release `20260717-1410-m6reader-isolation`. `BRAIN_DATABASE_URL` uses the dedicated `loopos_brain_login`; readiness proves both role identities, the exact 20-view allowlist, zero unsafe ACL counts, and forged-actor denial; mutation denial requires `42501`; two real browser tenants each return only their own organization fact with zero HTTP/browser errors and zero residue. BioCoach remains a separate application and database boundary: both `loopos_app` and `loopos_brain_login` connect to `loopos` but receive PostgreSQL `42501` for `biocoach` and `postgres`; BioCoach local/public health remains `200`; no BioCoach code, schema, table, row, credential, migration, Nginx rule, or PM2 configuration was changed. The first independent security review found two P1 and two P2 verifier gaps; all were corrected and the same reviewer returned PASS with no P0/P1/P2. Final roadmap auditor `Franklin` returned `ACCEPT M5-B AND ACTIVATE M6-1` with no P0/P1/P2.

## Historical V5 Milestone State

### V5-M6 - Brain-first Organization OS

Status: superseded as the product-development driver by approved V6; retained for evidence provenance.

Outcome:
- Make the Organization Brain the default LoopOS entry and coordinating layer, connect existing Goal/Tension/meeting/tactical/governance/Project/Action logic through typed capabilities and durable work objects, add bounded continuous perception, and prove one real team's weekly operating loop without authority bypass.

Design and plan:
- `docs/plans/2026-07-17-v5-m6-brain-first-organization-os-design.md`
- `docs/plans/2026-07-17-v5-m6-brain-first-organization-os-implementation-plan.md`

Activation gate:
- Passed on 2026-07-17: M5-B dedicated production Brain Reader readiness passed and independent state auditor `Franklin` approved M5-B closure and M6-1 activation.

Current slice:
- `V5-M6-1` and `V5-M6-2A` are accepted. Remaining V5-M6-3 acceptance debt is retained below but is not an active implementation Goal.

Current gate:
- M6-1 is accepted. Final roadmap auditor `Lovelace` closed the rendered-warning contrast P1 and returned `ACCEPT M6-1 AND ACTIVATE M6-2` with no open P0/P1/P2. `docs/evidence/2026-07-17-v5-m6-1c-command-center.md` records the final Canvas-normalized contrast, browser, cleanup, build, review, and mandatory BioCoach exact-`42501` evidence without claiming the UI was deployed. M6-2A must add only owner-private `BrainArtifact` persistence and one explicit audited lifecycle, preserve drafts on execution failure, make terminal results immutable, and prove tenant/owner denial plus fresh PostgreSQL rollback/reapply and cleanup before M6-2B can activate.

### V5-M6-3 - Governance Execution Recovery

Status: residual acceptance debt; not active. Implementation and coordinator evidence are substantially complete, but the independent milestone review and roadmap reclosure remain open.

Canonical plan:
- `docs/plans/2026-07-17-v5-m6-3-governance-execution-recovery.md`

Evidence:
- `docs/evidence/2026-07-18-v5-m6-3-implementation-progress.md`
- Empty-baseline production-host PostgreSQL migration proof: all 31 migrations applied and a second deploy returned `No pending migrations to apply`.
- Production browser proof returned aggregate `ok: true` for Brain -> governance proposal -> governance meeting -> READY -> ADOPTED -> CIRCLE_CREATED.
- Production migration status, HTTP smoke, BioCoach/postgres SQLSTATE `42501` isolation, M6-2A PostgreSQL acceptance, focused governance tests, ESLint, TypeScript, and rollback constraint coverage are recorded.

Open gates:
- Independent implementation `/review` and independent roadmap audit/reclosure.
- Execution-level tests for every non-role structural change branch, beyond parser/state-machine coverage.
- Evidence that retained `m6-3-acceptance-*` fixtures are isolated from real organization views and use a designated acceptance database/tenant.

Independent review note:
- Read-only review `019f7120-4ae1-7690-9a10-030b159c3dda` confirmed Brain-first reachability and the production Brain-to-governance claim, and found no new runtime P0. It identified P1 evidence/state gaps: the production run lacks a repository-local raw evidence bundle, temporary append-only fixtures remain, and the meeting label was role-specific for non-role changes. The label has been corrected in `src/app/app/meetings/[id]/governance-workbench.tsx`; the evidence and cleanup gates remain open.

### V5-M7 - Role Mechanism and Marketplace
Status: superseded by the approved V6 roadmap; retained for provenance.

Canonical plan:
- `docs/plans/2026-07-18-v5-m7-role-mechanism-and-market.md`

Target outcome:
- Establish the complete role lifecycle: role definition, vacancy discovery, application, nomination, confirmation, assignment history, and Organization Brain synchronization.

Scope and evidence:
- First slice: role vacancy directory and assignment application browser loop.
- PostgreSQL proof that applications cannot mutate current assignments before confirmation.
- Browser proof for vacancy discovery, role detail, application submission, and status visibility.
- Boundary proof for applicant, unrelated member, circle authority, and administrator.
- Independent implementation review, roadmap audit, and cleanup evidence.

Constraints:
- AI may recommend candidates but may not appoint them automatically.
- Current `RoleDef.assignees` remains the read model; application, nomination, change, and audit history use append-only records.
- Preserve the BioCoach cross-database denial gate and do not add open-ended semantic retrieval in this slice.

### V5-M8 - General AI-Native Governance Platform
Status: proposed; this is the next product objective, but it must not become active until V5-M6-3 is independently reclosed and the M8 entry gate is accepted. This preserves the one-active-Goal rule.

Canonical plan:
- docs/plans/2026-07-18-v5-m8-general-ai-native-governance-platform.md

Target outcome:
- Make LoopOS a reusable foundation for teams practicing AI-native governance, not a product shaped only around foundation-model teams.

Milestones:
- M8-1 role and assignment foundation: role market, vacancy, application, nomination, confirmation, exit, and audit.
- M8-2 organization types and templates: foundation-model, lean, professional-services/project, and functional organizations.
- M8-3 configurable organization terminology and governance rules with versioned effective state.
- M8-4 Brain as an organization-aware entry for facts, queries, proposals, tension, meetings, and role applications.
- M8-5 at least two non-foundation-model teams running the weekly tension-to-closure rhythm for four weeks.

Constraints:
- AI recommends and explains; it does not appoint people or make governance decisions automatically.
- Templates provide starting structures and never hard-code an organization's final design.
- Preserve tenant isolation, evidence-only answers, proposer-led distributed authority, and the BioCoach 42501 gate.

Entry gate:
- Close M6-3's non-role execution tests, browser proofs, DecisionRecord actor attribution, and production fixture-isolation evidence.
- Re-run independent implementation review and roadmap audit with no open P0/P1 findings.
- Reconcile M7 role-lifecycle evidence into the M8 baseline without treating source implementation as real-team adoption proof.

Next-stage focus:
- The next product objective is M8-A: connect the existing Organization Brain, Tension, tactical/governance meeting, Goal, Project/Action, and role services into one browser-verifiable weekly operating loop. Do not add new isolated domain logic until this path is proven.
- The user-success gate is a member starting from Brain or the Workspace, raising a tension, reviewing a process-bound proposal, completing the correct meeting flow, producing a project/action, and seeing evidence or a new tension in the next-cycle view.
- M8-A must be demonstrated with at least two organization templates and must preserve proposer-led distributed authority, evidence-only answers, tenant isolation, and the BioCoach exact-`42501` boundary.
- After M8-A, M8-B will prove template/configuration generality across foundation-model, professional-services/project, and functional organizations; M8-C will run the four-week real-team trial; M8-D will perform independent implementation, UX, and roadmap acceptance.

Honest current assessment:
- The reusable configuration and role-governance foundation is substantially implemented and locally browser-proven, including role application, nomination, confirmation, exit, and audit history.
- Brain has local browser evidence for an authorized role query and explicit BioCoach cross-application rejection; the planner also rejects that scope before invoking the model. This is not production or longitudinal evidence.
- The product is not yet a proven general platform: the four Brain action paths are not all browser-proven as one weekly loop, the non-foundation-model browser flow is not complete end to end, and no four-week independent real-team evidence exists.
- Therefore overall M8 completion is currently foundation/prototype level, not industry-ready acceptance. M8 remains proposed until M6-3 is independently reclosed and its entry gate is accepted.

## Current Project State

### What's done

- M8 onboarding foundation slice is implemented: organization administrators can version organization name, organization type, suggested meeting cadence, and role categories alongside terminology and governance rules; configured category labels now appear in the role market and role detail; malformed legacy profile JSON fails back to neutral defaults. TypeScript, focused profile tests (4/4), full source tests (112 files, 920 tests), production build, and diff checks pass.
- M8 governance-rule enforcement slice is implemented: the current effective `proposerConfirmationAfterProcess` rule is read inside the canonical governance transaction; when disabled, the proposer cannot self-confirm adoption, while another exact meeting participant may still confirm. Focused governance tests pass 35/35.
- M8 meeting-scope enforcement slice is implemented: `meetingParticipantScope=CIRCLE_SCOPE` is enforced by the participant update Server Action using meeting Circle membership or an active Role in that Circle; `OPEN_INVITE` remains organization-scoped and uncircled meetings do not invent a scope. Full source tests now pass 113 files / 923 tests and the production build passes.
- M8 governance invariant hardening is implemented: organization configuration cannot downgrade role assignment to `DIRECT_CONFIRMATION`; the setup UI presents governance-process confirmation as a non-configurable core invariant. Full source tests now pass 114 files / 924 tests and the production build passes.
- M8 Brain terminology slice is implemented: deterministic role-directory planning now uses the current organization role term in addition to legacy aliases, so renamed terms such as `职能` remain queryable when the model is unavailable. Planner focused tests pass 30/30.
- M8 Brain directory terminology slice now also covers configured Circle, Tension, tactical-meeting, and governance-meeting terms with allowlisted deterministic resources and resource-valid sort fields. Full source tests now pass 114 files / 926 tests.
- M8 Brain evidence synchronization is implemented: saving organization terminology updates the versioned governance configuration and the tenant-scoped OrganizationBrainProfile in one transaction, so Brain read evidence no longer lags the setup vocabulary. Full source tests now pass 115 files / 927 tests and the production build passes.
- M8-A tactical Brain entry is connected to the existing `tactical_outcome.submit_proposal` command handler: a tension proposer can select an open tactical tension, an open tactical meeting, Project/Action type, result description, Circle, and responsible person, then generate a confirmation preview. The preview is tenant/actor scoped, requires the new-proposal revision `0`, and does not write a tactical proposal until the existing command confirmation path executes it. TypeScript, diff check, the full source runner, and the local browser/database acceptance pass.
- M8-A tactical Brain browser evidence is now recorded in `docs/evidence/2026-07-18-v5-m8-configuration-browser.md`: a fresh functional-organization fixture completed `Brain question -> tactical outcome preview -> explicit confirmation -> tactical meeting -> Action`; the database showed `actions=1`, `approved_proposals=1`, and `assigned_tensions=1`, and the runner cleaned its temporary organization. The browser path is proven locally, but this does not prove four-week real-team adoption or production deployment.
- The same M8-A browser runner now passes unchanged for both `functional-team` and `professional-services` templates, with identical database outcomes and zero temporary-organization residue after cleanup. This proves template-independent local closure for two non-model starting structures; it does not prove real-team adoption.
- M8-4 Brain role-application evidence now passes on a fresh professional-services organization: Brain question, role-application composer, explicit confirmation, and `PENDING` application were proven in the browser; PostgreSQL showed `assignees=0`, so governance is still required. The missing `role_application.create` command whitelist was added by migration `20260719110000_v5_m8_brain_role_application_command_check` and the rerun passed.
- The configuration regression now covers all three non-foundation-model templates: lean, professional-services, and functional. The lean template passed with an explicitly verified empty role-market state, after correcting the runner's assumption that every template must expose a vacancy.
- M8-4 Brain governance closure is now browser-proven with a second meeting participant: Brain governance composer, preview, explicit confirmation, `READY`, second-participant adoption, and `ADOPTED` all passed. The single-participant self-adoption attempt was rejected as expected by distributed authority; the successful rerun left zero fixture residue after controlled cleanup.
- Added the read-only M8 longitudinal verifier `scripts/verify-m8-longitudinal-real-team.mjs`. It requires a 28-day window, two non-smoke participants, four recorded tactical meetings, tension closure, and a recorded Project/Action or governance terminal outcome, while reporting the planned operating metrics. It is an acceptance instrument, not real-team evidence.
- M8 template directory contract is now covered: the general onboarding catalog explicitly includes lean, professional-services, functional, and foundation-model starting structures, while tests assert templates remain editable starting structures rather than governance decisions. Focused template/profile tests pass 7/7.
- Added `scripts/m8-configuration-browser-acceptance.cjs` as a read-only browser gate for organization profile, organization language, governance rules, and (on an uninitialized fixture) all four onboarding templates. Authenticated local execution passed with clean page/console error collection.
- M8 configuration browser evidence is now captured in `docs/evidence/2026-07-18-v5-m8-configuration-browser.md`: fresh registered organizations exposed all four templates and the profile, language, and governance-rule surfaces; same-origin Server Actions initialized both professional-services and functional-team templates into their expected three-circle structures and completed one role-market application/withdrawal lifecycle for each; temporary organizations were deleted and PostgreSQL residue was zero. Nomination/confirmation/exit and real-team adoption remain unclaimed.
- M8 governance-entry browser evidence now also covers a functional-team organization creating one governance-source Tension and one governance Meeting, then submitting a role application through the inbox into a meeting proposal URL; the single-member denial and two-member confirmation paths are both proven. The successful path produced one accepted application, one adopted process, one DecisionRecord, and one RoleAssignmentHistory row. Temporary organization cleanup returned zero residue.
- M8 distributed role-confirmation evidence now passes with a second member: the reviewer joined the governance Meeting and adopted the applicant's proposal; before cleanup, PostgreSQL showed one `decision_records`, one `role_assignment_history`, one accepted application, and one adopted governance process. The UI showed `ADOPTED`, decision, and change-log links. The old Prisma-client cache was eliminated by restarting the dev service; all temporary organizations were then removed.
- M8 exit-flow evidence now passes: the assigned person submitted a new exit Tension, initialized a `ROLE_UNASSIGNMENT` proposal, and a second meeting participant adopted it. Before cleanup, PostgreSQL showed `decision_records=2`, `assigned=1`, `released=1`, and `adopted_processes=2`; the browser runner waits for and asserts the `RELEASED` history row.
- M8 nomination slice is implemented and browser-proven: an organization admin nominated another human for an unassigned role, the nominee accepted it, and PostgreSQL recorded one nomination with the application in `PENDING` while the pre-confirmation assignment count was zero. Only the existing governance workflow confirmed the separate assignment.
- Integrated review was read and independently checked against current code.
- False or obsolete review claims were separated from current product gaps.
- Product owner approved the Organization Brain control layer, Goal Tree model, four-entry daily-work navigation, plugin boundary, memory authority, bounded proactivity, dynamic authorized reads, and five-milestone sequence.
- Product owner approved a transparency-first read matrix: confirmed organization facts are member-visible, while private and contextual data remain explicitly scoped.
- Previous roadmap and dashboard were archived without losing history.
- V5 design and implementation plan were created.
- M1-A introduced a fail-closed ActorContext resolver and fixed transparency-first object read policy without changing tactical, governance, interface-runtime, schema, AI, or UI behavior.
- M1-A is integrated in `158b36b` and `47a3e2e`; same-reviewer reclosure found no P0/P1/P2 findings.
- Coordinator verification passed 51/51 focused tests, 44/44 source-test files with 308 tests, TypeScript, scoped ESLint, and diff checks. The first attempted runner name did not exist; verification used the repository's actual `scripts/run-source-tests.mjs` runner.
- Independent M1-A roadmap audit passed with no P0/P1/P2 findings and explicitly kept database, browser, and production evidence pending.
- M1-B1 is integrated in `a1b2ff2` with four tenant-safe Brain persistence models and one additive reversible migration.
- M1-B1 passed independent review with no P0/P1/P2, 6/6 focused tests, 45/45 source-test files with 314 tests, Prisma validate/generate, TypeScript, and diff checks.
- Coordinator PostgreSQL 14 evidence passed 20/20 migration apply, unique/composite-FK/check rejection probes, complete B1 rollback, preservation of pre-existing organization data, clean reapply, and disposable-database cleanup.
- The first broad M1-B2 worker failed to return a checkpoint but left an uncommitted draft; it was preserved, tested, and independently reviewed rather than silently discarded.
- Independent security review rejected that draft with three P1 and two P2 findings; four bounded correction commits closed the raw-SQL, role-lifecycle, scope, rollback, PUBLIC ACL, database-lifecycle, and real-database-evidence gaps.
- M1-B2a is integrated through `cdec37c` with exactly six foundation views and no B2b operational views.
- Fifth same-reviewer reclosure reported no P0/P1/P2 and marked B2a safe to integrate.
- Coordinator verification passed 21/21 focused tests when the database environment was present, 49/49 source-test files with 335 tests, TypeScript, scoped ESLint, and diff checks.
- Fresh isolated PostgreSQL 14.18 evidence passed the complete 20-migration pre-B2a stack, PUBLIC ACL hardening, future-function defaults, two allowlisted databases, post-provision database admission, tenant/private denial, rollback/reapply, exact maintenance ACL restoration, and zero role/database residue.
- The B2b source contract was independently mapped to nine existing canonical resources without schema changes; confirmed meeting results and unconfirmed legacy work remained intentionally absent.
- M1-B2b is integrated in `54821d6` with nine security-barrier views, 15 exact provisioned views in total, and 15 fixed read resources.
- Independent B2b review reported no P0/P1/P2 and marked the commit safe to integrate.
- Coordinator verification passed 29 focused tests with the database case enabled separately, 49/49 source-test files with 343 tests, TypeScript, scoped ESLint, and diff checks.
- Fresh isolated PostgreSQL 14.18 evidence passed two-tenant transparency and denial cases, participant-only notes including administrator denial, Tension owner/raiser/lead/admin policy, confirmed tactical/governance/publication filters, mutation denial, B2b rollback/reapply, B2a survival, ACL restoration, and zero residue.
- M1-C is integrated through `f2a90cb` and correction `0bb1d98` with a strict dynamic query plan, private broker compiler and transaction adapter, immutable 15-resource catalog, evidence packets, deterministic links, and value-redacted query audits.
- The first M1-C review found two P1 and two P2 issues in exported execution boundaries, executable relation mutability, pre-bound input processing, and date-like string formatting; all four were fixed test-first and same-reviewer reclosure reported no P0/P1/P2 and `SAFE TO INTEGRATE`.
- Coordinator M1-C correction verification passed 81 focused tests, 55/55 source files with 398 tests, TypeScript, scoped ESLint, full diff checks, and fresh PostgreSQL 14.18 1/1 covering two tenants, relations, privacy, meeting participation, opaque IDs, read-only denial, audit outcomes, and zero disposable-resource residue.
- M1-D1 is integrated in `d14241c` with strict evidence revalidation, deterministic FACT reconstruction, labeled model interpretation, model-off evidence fallback, selected-provider timeout/retry controls, and no broker or write capability.
- Independent D1 review reported no P0/P1/P2 and `SAFE TO INTEGRATE`; coordinator verification passed focused 30/30, 58/58 source files with 428 tests, TypeScript, scoped ESLint, diff/no-touch checks, and a redacted StepFun live smoke with `ANSWERED`, one fact, one source, and Chinese-output validation.
- M1-D2 is integrated through `c4a3a4b`, `df89a83`, and `555e217` with a deeply frozen safe catalog, strict 0-3 PlanV1 output, symbolic actor references, M1-C preflight, aggregate bounds, semantic duplicate rejection, Unicode-safe literal-ID binding, and no broker/read/write capability.
- The first D2 review found three P2 issues in ID-sort enforcement, literal-ID substring binding, and semantic duplicate multiplicity; same-reviewer reclosure also found one Unicode-boundary P2. All findings were fixed test-first, and final reclosure reported no P0/P1/P2 and `SAFE TO INTEGRATE`.
- Coordinator D2 verification passed focused 49/49, 61/61 source files with 477 tests, TypeScript, scoped ESLint, diff/no-touch checks, and a redacted production StepFun smoke with `PLANNED`, one `circles` plan, one symbolic actor reference, and zero actor-ID leakage.
- V5-M2 is accepted through final corrections `2ab7505` and `4af7661`, state commit `ddc7f9f`, targeted PostgreSQL and Chromium evidence, complete disposable-resource cleanup, and final roadmap decision `ACCEPT M2 AND ACTIVATE M3` with no open P0/P1/P2.
- V5-M3-A is accepted in `docs/plans/2026-07-15-v5-m3-command-boundary-goal-read-surface-contract.md`. Two bounded inventories defined the reusable Brain/Goal boundaries and exactly six future commands. The first independent review found four P1 contract gaps; the same reviewer reclosed those exact findings with no open P0/P1/P2 and declared M3-A safe to accept. No production code or runtime evidence was claimed for this contract-only slice.
- V5-M3-B is accepted through implementation `62f004b`, truncation correction `29dae99`, retained PostgreSQL evidence `12e35b0`, and final decision `ACCEPT M3-B AND ACTIVATE M3-C`. The final snapshot passes 83/83 source-test files with 770 tests, TypeScript, scoped ESLint, `git diff --check`, and the Next.js 16.2.10 production build with 35/35 pages. Disposable PostgreSQL 14.18 evidence passes 1/1 with five populated resources, tenant denial, effective check-ins, active-link filtering, unauthorized blocking-Tension row/relation/`hasMore`/audit indistinguishability, reader mutation denial, rollback/reapply, and cleanup. Independent source review reclosed its sole P2, the final auditor found no open P0/P1/P2, port 55456 and its temporary cluster are gone, and the existing port 3001 service remains untouched. No M3-B browser claim is made because the slice changed no UI.
- V5-M3-C is accepted through implementation `d018d77` and correction `711644e` with one owner-private Brain command ledger, guarded rollback, immutable preview bindings, closed lifecycle/idempotency constraints, and exactly six static command metadata variants. Focused static tests pass 10/10, fresh PostgreSQL 14.18 evidence passes 1/1 for owner membership denial, command/hash/expiry rejection, immutable preview bindings, successful terminal update, duplicate mutation key rejection, blank mutation key rejection, closed EXPIRED lifecycle, rollback refusal while rows exist, rollback cleanup, preserved non-ledger data, and zero disposable-resource residue. Full source tests pass 86/86 files with 781 tests, Prisma validate/generate, TypeScript, `git diff --check`, and production build 35/35 pages. The first independent review found two P1 and one P2 ledger gaps; same-reviewer reclosure passed with no findings, and an independent roadmap audit approved accepting M3-C and activating M3-D1. No M3-C browser claim is made because the slice added no UI or command handlers.
- V5-M3-D1 is accepted through Goal handler foundation `24c0d2f`, atomicity correction `70e7109`, and tenant/concurrency proof `76b8e45`. It handles only `goal_proposal.create_draft`, `goal_proposal.append_returned_revision`, and `goal_check_in.append`; routes writes through canonical Goal proposal/check-in operations; uses transaction-scoped domain dependencies plus ledger terminal replay after atomic conflicts; defers domain rejection until after rollback; and keeps non-Goal commands inactive. Focused source tests pass 22/22 with the PostgreSQL case skipped when its env is absent, fresh PostgreSQL 14.18 evidence passes 1/1 for successful replay, different-key retry conflict, duplicate mutation key conflict, expired preview replay, same-tenant owner denial, second-tenant denial, same-preview concurrent confirmation, and cleanup. Full source tests pass 88/88 files with 793 tests, TypeScript, `git diff --check`, production build 35/35 pages, disposable database count 0, and `loopos_brain_reader` role count 0. Same-reviewer reclosure and independent roadmap re-audit returned PASS/ACCEPT with no open P0/P1/P2. No D1 browser preview/confirm claim is made; that evidence remains deferred to M3-E/M3-F.
- V5-M3-D2 is accepted in the current working snapshot. It adds executable handlers only for `tension.raise` and `tactical_outcome.submit_proposal`; reuses the private Brain command ledger; moves tactical submit authority into the canonical domain-operation layer; keeps tactical decisions and Project/Action creation inside the meeting decision path; and keeps `meeting_notes.update`, preview/confirm UI, shared memory, proactive signals, plugins, deployment, M4, and M5 inactive. Focused D2 tests pass 32/32, full source tests pass 88/88 files with 795 tests, TypeScript, scoped ESLint, `git diff --check`, Prisma validation, and the Next.js 16.2.10 production build with 35/35 pages. Fresh PostgreSQL 14.18 evidence passes 1/1 for Brain-raised Tension, idempotent replay, tactical proposal submission, no Project/Action outcome bypass, tenant denial, and cleanup. Independent source review found no open P0/P1/P2; independent roadmap audit approved D2 acceptance after the review evidence was added. No D2 browser preview/confirm claim is made; that evidence remains deferred to M3-E/M3-F.
- V5-M3-D3 is accepted in the current working snapshot. It adds executable handling for `meeting_notes.update` only; extracts meeting-note mutation into canonical `updateMeetingNotes`; preserves the existing meeting collaboration UI by routing it through the same service; and does not activate agenda, participant changes, end-meeting, decision capture, shared memory, proactive signals, plugins, deployment, M4, or M5. Focused D3/source tests pass 39/39, full source tests pass 88/88 files with 798 tests, TypeScript, scoped ESLint, `git diff --check`, Prisma validation, and the Next.js 16.2.10 production build with 35/35 pages. Fresh PostgreSQL 14.18 evidence passes 1/1 for successful Brain-confirmed notes update, same-preview replay without a second write, stale revision rejection, nonparticipant denial, ended-meeting denial, second-tenant denial, and cleanup. Independent source review and independent roadmap re-audit found no open P0/P1/P2 and marked D3 safe to accept. No D3 browser preview/confirm claim is made; that evidence remains deferred to M3-E/M3-F.
- V5-M3-E is accepted in the current working snapshot. It adds owner-only Brain command preview listing, explicit confirm transport, browser DTO projection without `serverPayload`/`sourceBindings`, production source-binding validation, and a Brain UI preview card surface that calls the ledger confirm path rather than direct domain actions. Focused M3-E/source tests pass 36/36, full source tests pass 89/89 files with 803 tests, TypeScript passes, scoped ESLint passes, `git diff --check` passes, Prisma validation passes, and production build passes 35/35 pages. Fresh PostgreSQL evidence passes 1/1 inside the M3-D3 fixture for owner preview listing, cross-tenant invisibility, explicit confirm through the service wrapper, terminal preview projection, and replay without a second write. Authenticated production-mode browser evidence passes via `scripts/m3-e-browser-acceptance.cjs` with evidence in `/tmp/loopos-m3e-browser-1784124498816`: owner preview visibility, no silent write before confirmation, explicit confirmation persistence, refresh durability, other-tenant mobile invisibility, stale-preview rejection, terminal expired preview without a confirm button, clean network/page/console ledger, closed port 3224, and zero `loopos_m3e_browser_%` database residue. Independent implementation review `Parfit` returned PASS with no findings; independent roadmap/evidence audit `Ohm` found no findings and its only HOLD blocker was resolved by the implementation review PASS.
- V5-M3-F coordinator cleanup evidence passes in the current working snapshot: `git diff --check`, scoped ESLint for M3-E files plus `scripts/m3-e-browser-acceptance.cjs`, `node -c scripts/m3-e-browser-acceptance.cjs`, `npx tsc --noEmit`, `npx prisma validate` with only the existing `driverAdapters` deprecation warning, full source tests 89/89 files with 803 tests, production build 35/35 pages, zero `loopos_m3e_browser_%` disposable databases, and no server listening on port 3224.
- V5-M3 was accepted and V5-M4 was activated. Final M3 acceptance auditor `Curie` returned `ACCEPT M3 AND ACTIVATE M4` with no findings after checking `GOALS.md`, `progress-dashboard.html`, git status, `scripts/m3-e-browser-acceptance.cjs`, `/tmp/loopos-m3e-browser-1784124498816`, empty network/page/console ledger, valid command terminal rows, no 3224 listener, and zero `loopos_m3e_browser_%` database residue.
- Product owner approved `V5-M4-A` as daily or weekly private briefs first. The accepted design is documented in `docs/plans/2026-07-15-v5-m4a-private-briefs-design.md`; it keeps shared memory records, memory-candidate confirmation, real-time notifications, autonomous writes, plugins, deployment, and M5 hardening out of scope.
- The M4-A implementation plan is documented in `docs/plans/2026-07-15-v5-m4a-private-briefs-implementation-plan.md`. M4-A1 owned only the private brief DTO, deterministic signal kinds, source references, deduplication identity, safe next action shape, and pure detector tests.
- M4-A1 initial implementation is in the current working snapshot. It adds pure private brief DTOs and a deterministic detector for stale Goal check-ins, missing Target evidence, unresolved meeting output, repeated Tensions, Role/work mismatch, and missing child Goals. Focused evidence passes 6/6 for the six signal kinds, missing-source and missing-link fail-closed behavior, deduplication, truncation, safe source/action shape, and static no database/action/command/provider/plugin/shared-memory import boundary. Scoped ESLint, TypeScript, `git diff --check`, full source tests 90/90 files with 809 tests, and production build 35/35 pages pass. Independent implementation reviewer `McClintock` found one P2 for missing source/action URL fail-closed behavior; the same reviewer reclosed the exact finding with PASS and no blockers after the detector required `/app/` source and action URLs and added focused coverage.
- Independent roadmap auditor `Lorentz` reclosed the M4-A1 roadmap gate with `ACCEPT A1 AND ACTIVATE A2`, no findings, and no blockers after confirming `GOALS.md` and `progress-dashboard.html` recorded implementation review PASS and only the roadmap audit reclosure as the remaining pre-A2 gate.
- M4-A2 actor-scoped private brief service is accepted in the current working snapshot. It adds a server-only private brief service and Prisma fact store that resolves ActorContext, returns fixed access denial on missing context, reads only actor-scoped source facts, keeps meeting drafts participant-only, keeps unresolved tensions to owner/raiser/related circle lead/org admin, and reads Project/Action work only from approved tactical outcome rows. Focused A1/A2 tests pass 12/12, PostgreSQL evidence passes 1/1 for actor-private visibility, cross-tenant denial, nonparticipant meeting denial, same-Circle nonlead hidden Tension denial, unapproved Project/Action exclusion, no mutation side effects, and zero `loopos_m4a2_%` database residue. Scoped ESLint, TypeScript, `git diff --check`, full source tests 92/92 files with 816 tests, and production build 35/35 pages pass. Independent implementation reviewer `Beauvoir` first found two P1 and one P2 boundary issues; same-reviewer reclosure returned PASS with no findings and no blockers after the service adopted the accepted read policies.
- M4-A3 implementation evidence exists in the current working snapshot. It adds `loadBrainPrivateBrief` to the explicit Brain Server Action boundary, maps private-brief service errors through the fixed public error allowlist, and renders a lightweight private brief panel in the Organization Brain UI with private visibility indicator, honest empty/degraded states, source links, evidence age, and safe next action links. Focused Brain action/client tests pass 16/16, scoped ESLint passes for the touched Brain files plus `scripts/m4-a3-browser-acceptance.cjs`, TypeScript passes, `git diff --check` passes, full source tests pass 92/92 files with 818 tests, and the Next.js 16.2.10 production build passes 35/35 pages. Authenticated production-mode browser evidence passes via `scripts/m4-a3-browser-acceptance.cjs` with evidence in `/tmp/loopos-m4a3-browser-1784134920921`: owner private-brief visibility, source navigation to the Goal Tree, unrelated same-organization member mobile invisibility, honest empty state, clean network/page/console ledger, unchanged Goal/Brain object counts, and zero `loopos_m4a3_browser_%` database residue.
- Independent M4-A3 implementation reviewer `Erdos` returned PASS with no P0/P1/P2 findings and no blockers after checking the Server Action boundary, fixed error mapping, `/app/` link filtering, no raw source IDs/dedupe keys, explicit empty/degraded/pending/truncated states, separation from M3 command preview/confirm, actor/tenant scoping in the service, detector fail-closed URL behavior, and focused checks.
- Independent roadmap auditor `Plato` first returned HOLD only because implementation review was not yet recorded; after `Erdos` PASS was recorded, the exact blocker was reclosed with `ACCEPT A3 AND ACTIVATE A4`, no findings, and no blockers.
- M4-A4 coordinator cleanup evidence exists in the current working snapshot: `node -c scripts/m4-a3-browser-acceptance.cjs`, `npx prisma validate` with only the existing `driverAdapters` deprecation warning, focused Brain action/client 16/16, scoped ESLint, TypeScript, `git diff --check`, full source tests 92/92 files with 818 tests, production build 35/35 pages, clean browser network/page/console ledger, unchanged Goal/Brain object counts, and zero `loopos_m4a3_browser_%` database residue.
- Independent final M4-A acceptance auditor `Plato` returned `ACCEPT M4-A`, no findings, and no blockers after confirming A1/A2/A3/A4 evidence, browser evidence classification, cleanup evidence, no premature M4-B/M5/plugin/deployment/shared-memory/longitudinal claims, and plan coverage.
- Product owner confirmed M4-B Option A: candidate-first, no canonical shared memory retrieval or AI-confirmed organization truth in this slice. M4-B design is now documented in `docs/plans/2026-07-15-v5-m4b-source-authority-memory-candidates-design.md`; implementation planning is documented in `docs/plans/2026-07-15-v5-m4b-source-authority-memory-candidates-implementation-plan.md`. The plan keeps drafts private, requires explicit user submission, routes submitted candidates by source authority, and defers shared memory, notifications, plugins, deployment, M5 hardening, and longitudinal real-team evidence.
- M4-B1 is accepted in the current working snapshot. It adds pure memory candidate types and lifecycle functions for draft, submit, confirm, reject, supersede, route classification, validity expiry derivation, immutable audit trail, owner-only submission, and invalid AI-style actor rejection. The first independent implementation review found two P1 and one P2 issue in confirmation authority, route integrity, and shallow source-ref freezing; the coordinator fixed them by removing caller-selected routes, ranking all source refs by source authority, requiring route-prefixed process confirmation, and deep-freezing source refs. Focused lifecycle tests pass 9/9, TypeScript passes, scoped ESLint passes for the three new files, `git diff --check` passes, full source tests pass 93/93 files with 827 tests, `npx prisma validate` passes with only the existing `driverAdapters` warning, and production build passes 35/35 pages. Same-reviewer implementation reclosure `Kuhn` returned PASS with no findings; independent roadmap/evidence auditor `Singer` returned PASS and allowed M4-B1 acceptance after implementation review PASS. No database, Server Action, UI, shared-memory retrieval, plugin, deployment, or M5 implementation has started in M4-B1.
- M4-B2 is accepted in the current working snapshot. It adds `memory_candidates` and `memory_candidate_audit_events` with lifecycle checks, owner and tenant FKs, closed-row immutability including timestamp-only closed-row rejection, append-only audit events, source-authority route metadata, and PUBLIC privilege revocation; adds a server-only actor-scoped service that resolves ActorContext server-side, creates owner-private drafts from accessible source refs only, requires explicit owner submission, exposes submitted candidates only to source-authority reviewers, confirms/rejects/supersedes through route-scoped authority, and records route-prefixed process confirmation actors instead of client-chosen or AI actors. Focused service tests pass 7/7; PostgreSQL evidence passes 1/1 on a disposable fully migrated database for private drafts, reviewer-only submitted visibility, second-tenant denial, cross-tenant source-ref rejection, audit trail `CREATED/SUBMITTED/CONFIRMED`, route-prefixed confirmation actor, closed-row content and timestamp immutability, audit-event update/delete immutability, and table counts; Prisma validate passes with only the existing `driverAdapters` warning; TypeScript passes; scoped ESLint passes; `git diff --check` passes; full source tests pass 95/95 files with 835 tests; and production build passes 35/35 pages. Independent implementation reviewer `Meitner` first found one P1 and one P2 in audit-event append-only protection and timestamp-only closed-row mutation; both were fixed and reclosed with PASS/no findings. Independent roadmap auditor `Confucius` first found one P2 dashboard count mismatch; it was fixed and reclosed with PASS/no findings. No UI, Server Action, canonical shared memory retrieval, plugin, deployment, M5, or longitudinal real-team evidence is claimed.
- M4-B3 is accepted in the current working snapshot. It adds one explicit Brain Server Action `submitBrainMemoryCandidate`, maps memory-candidate service errors through the fixed Brain public error allowlist, renders a private-brief candidate affordance only when a signal has safe `/app/` source refs, lets the user review/edit claim and rationale locally, submits only after pressing `提交候选记忆`, and shows the submitted candidate status and authoritative source route returned by B2. Focused Brain action/client tests pass 18/18, scoped ESLint passes for the touched Brain files plus `scripts/m4-b3-browser-acceptance.cjs`, TypeScript passes, `git diff --check` passes, `npx prisma validate` passes with only the existing `driverAdapters` warning, full source tests pass 95/95 files with 837 tests, and production build passes 35/35 pages. Production-mode browser evidence passes via `scripts/m4-b3-browser-acceptance.cjs` with evidence in `/tmp/loopos-m4b3-browser-1784154856960`: owner private brief -> local candidate review -> edited explicit submit, one `SUBMITTED` candidate with `GOAL_STRATEGY` route and one safe source, `CREATED,SUBMITTED` audit events, zero Brain conversation/message side effects, unrelated same-organization mobile member cannot see the owner signal or candidate surface, clean network/page/console ledger, and disposable database cleanup. Independent implementation reviewer `Avicenna` returned PASS with no findings; independent roadmap auditor `Ramanujan` returned PASS with no findings. No source-authority decision surface, confirmation/rejection UI, canonical shared memory retrieval, plugin, deployment, M5, or longitudinal real-team evidence is claimed.
- M4-B4 is accepted in the current working snapshot. It adds route-scoped Brain review actions for submitted memory candidates, a Brain review surface that only lists candidates the current actor may review through source authority, explicit confirm/reject controls, and a production browser acceptance script. The service no longer grants `ORG_ADMIN` central approval for memory-candidate review, removes admin bypass from Tension source and Meeting authority checks, excludes candidate owners from reviewable listing and confirm/reject/supersede shortcuts, and still records route-prefixed process actors rather than Brain/client actors. Focused service/action/client tests pass 29/29, including GOAL_STRATEGY/GOVERNANCE/TACTICAL/MEETING_RECORD route decisions and owner/admin/outsider/tension denial paths; scoped ESLint passes for all touched B4 files; TypeScript passes; `git diff --check` passes; `npx prisma validate` passes with only the existing `driverAdapters` warning; full source tests pass with 304 top-level tests, 776 assertion items, 767 pass, 9 skip, 0 fail; and production build passes 35/35 pages. Production-mode browser evidence passes via `scripts/m4-b4-browser-acceptance.cjs` with evidence in `/tmp/loopos-m4b4-browser-1784156353691`: owner cannot self-review, central admin cannot review without source route authority, source reviewer sees two submitted candidates and confirms one/rejects one, unrelated same-organization mobile member cannot see the review surface, database counts stay at two candidates while audit events go 4 -> 6, the confirmed candidate actor is `goal:person-m4b4-reviewer`, there are zero Brain conversations/messages, and the network/page/console ledger is clean. Independent implementation reviewer `Schrodinger` first found central-admin and self-review gaps; both were fixed and reclosed with PASS/no findings. Independent roadmap auditor `Bacon` first held B4 for central-admin, route/denial coverage, and stale roadmap/dashboard; after the fixes and refreshed evidence it returned PASS reclosure with only this roadmap/dashboard update remaining. No canonical shared memory retrieval, plugin, deployment, M5, or longitudinal real-team evidence is claimed.
- M4-B5 and M4-B are accepted in the current working snapshot. Coordinator cleanup evidence: script syntax checks pass for `scripts/m4-b3-browser-acceptance.cjs` and `scripts/m4-b4-browser-acceptance.cjs`; TypeScript passes; scoped ESLint passes for the touched Brain/service files plus M4-B browser scripts; `npx prisma validate` passes with only the existing `driverAdapters` warning; `git diff --check` passes; full source tests pass with 304 top-level tests, 776 assertion items, 767 pass, 9 skip, 0 fail; and production build passes 35/35 pages. Disposable-resource cleanup evidence shows no M4-B browser server on 3226/3227, no matching `next start`/M4-B browser processes, and no PostgreSQL databases matching `loopos_m4b2_%`, `loopos_m4b3_browser_%`, or `loopos_m4b4_browser_%`. Independent final cleanup auditor `Bernoulli` returned PASS with no P0/P1/P2 and recommended accepting B5/M4-B and activating only the next deferred M4 shared-memory design gate. No canonical shared-memory retrieval implementation, organization-wide memory feed, notification policy, plugin, deployment, M5, or longitudinal real-team evidence is claimed.
- Product owner confirmed M4-C Option A: derive a bounded, source-scoped shared-memory retrieval layer from confirmed memory candidates first. The accepted M4-C design is documented in `docs/plans/2026-07-15-v5-m4c-canonical-shared-memory-retrieval-design.md`; implementation planning is documented in `docs/plans/2026-07-15-v5-m4c-canonical-shared-memory-retrieval-implementation-plan.md`. M4-C1 is accepted in the current working snapshot. It adds pure shared-memory entry types and derivation/ranking rules for active confirmed candidates only, validity windows, supersession exclusion, actor-authorized source filtering, malformed candidate rejection, and deterministic query-time ranking. Focused evidence passes 8/8; scoped ESLint passes for the three touched shared-memory files; TypeScript passes; `git diff --check` passes; `npx prisma validate` passes with only the existing `driverAdapters` warning; full source tests pass 305 top-level tests, 784 assertion items, 775 pass, 9 skip, 0 fail; and production build passes 35/35 pages. Independent implementation reviewer `James` first found one P2 for malformed candidate shapes escaping as raw `TypeError`; the coordinator fixed object/array/source-type guards and malformed-shape tests, and the same reviewer reclosed with no findings. Independent roadmap/evidence auditor `Bernoulli the 2nd` first found one stale-roadmap P2; the coordinator fixed the current-gate line and the same auditor reclosed with PASS, no findings, and approval to accept M4-C1 and activate M4-C2.
- M4-C2 is accepted in the current working snapshot. It adds a server-only actor-scoped retrieval service over confirmed memory candidates, route-aware bounded candidate loading, actor source-reference authorization through the existing source-ref policy, active/expired/superseded filtering through the M4-C1 derivation contract, fixed public service errors, retrieval audit rows with hashed query text, and no UI, Brain turn, plugin, deployment, notification, semantic retrieval, or direct memory mutation activation. Focused service tests pass 7/7; real PostgreSQL evidence passes 1/1 with `M4_C2_TEST_ADMIN_DATABASE_URL=postgresql://heyiqing@localhost:5432/postgres` for tenant-scoped retrieval, same-organization permitted/nonpermitted paths, filtered source references, expired/superseded exclusion, audit rows, and zero disposable database residue; TypeScript passes; scoped ESLint passes; `git diff --check` passes; `npx prisma validate` passes with only the existing `driverAdapters` warning; full source tests pass 307 top-level tests / 792 assertion items with 0 failures and 10 skips; and production build passes 35/35 pages. Independent implementation reviewer `Parfit the 2nd` returned PASS with no findings. Independent roadmap/evidence auditor `Carson the 2nd` first held only because implementation review was not yet recorded; after review PASS was supplied, same-auditor reclosure returned PASS with no findings and no blockers. No M4-C Brain turn/UI integration, browser evidence, global feed, notification, semantic retrieval, plugin, deployment, M5, or longitudinal real-team evidence is claimed yet.
- M4-C3 is accepted in the current working snapshot. It connects confirmed shared memory retrieval into the Brain turn service after claim and before planning, keeps terminal replay independent of new memory state, passes confirmed memory to D1 as a separate server-controlled packet, stores `confirmedMemory` as an optional distinct response section without breaking old nine-key stored responses, rejects D1 outputs that omit or alter retrieved memory, returns memory-only answers when no supported query plan exists but confirmed memory is available, and renders confirmed memory separately from facts/inferences with source links and a `提出纠偏张力` correction entry. Focused tests pass 128/128 across conversation store, reasoner, turn service, Brain client, and Brain actions; full source tests pass 98/98 files with 865 tests; TypeScript passes; scoped ESLint passes for all touched files; Prisma validate passes with only the existing `driverAdapters` warning; `git diff --check` passes; and production build passes 35/35 pages. Independent implementation reviewer `Kuhn the 2nd` returned PASS with no P0/P1/P2. Independent roadmap/evidence auditor `Galileo the 2nd` reclosed the prior implementation-review blocker and returned PASS with no P0/P1/P2. Browser acceptance remains unclaimed and is active as M4-C4.
- M4-C4 is accepted in the current working snapshot. Browser/database evidence exists in `/tmp/loopos-m4c4-browser-1784170114120`. The production-mode script `scripts/m4-c4-browser-acceptance.cjs` confirms one submitted memory candidate through a real source-authority browser flow, then asks the same Brain question as the permitted reviewer, a nonpermitted same-organization member, and a second-tenant member. Evidence shows the permitted reviewer receives an `ANSWERED` Brain response with one `confirmedMemory` item, provenance, source link, validity, confirming process actor, and `correctionUrl`; the correction affordance opens `/app/tensions/new?...` without creating a Tension. The nonpermitted same-organization member receives `INSUFFICIENT_EVIDENCE / NO_SUPPORTED_PLAN`; the second tenant receives `UNAVAILABLE / PROVIDER_FAILURE`; neither persisted the confirmed claim. Database evidence shows memory candidates stay `1 -> 1`, audit events `2 -> 3`, Brain conversations `0 -> 3`, Brain messages `0 -> 6`, retrieval audits `0 -> 3`, and Tensions `0 -> 0`; retrieval audits are result counts `1,0,0` for reviewer, nonpermitted member, and second tenant. Network/page/console ledgers are clean, the disposable database count is zero after cleanup, and port 3228 is closed. Independent implementation reviewer `Wegener` returned PASS with no P0/P1/P2. Independent roadmap/evidence auditor `Aquinas` returned PASS with no P0/P1/P2 and allowed C4 acceptance once implementation review passed.
- M4-C5 and M4-C are accepted in the current working snapshot. Cleanup evidence: `git diff --check` passes; `node -c scripts/m4-c4-browser-acceptance.cjs` passes; `npx prisma validate` passes with only the existing `driverAdapters` warning; TypeScript passes; scoped ESLint passes for the touched Brain files plus `scripts/m4-c4-browser-acceptance.cjs`; full source tests pass 98/98 files with 865 tests; production build passes 35/35 pages; disposable PostgreSQL cleanup shows zero `loopos_m4c4_browser_%` databases; and port 3228 is closed. Independent final implementation reviewer `Zeno` returned PASS with no P0/P1/P2. Independent final roadmap/evidence auditor `Einstein` returned PASS with no P0/P1/P2 and explicitly kept M5 pending until V5-M4 final acceptance/cleanup is complete.
- V5-M4 is accepted in the current working snapshot. Final auditor `Tesla` returned `ACCEPT V5-M4 AND ACTIVATE V5-M5` with no P0/P1/P2 after confirming M4-A private proactive briefs, M4-B source-authority memory candidates, M4-C confirmed-memory retrieval, browser/database evidence separation, cleanup evidence, and no hidden activation of deferred M5/global feed/notification/semantic/plugin/deployment/longitudinal scope.
- Product owner confirmed M5-A uses Option A: production baseline first. The design is documented in `docs/plans/2026-07-16-v5-m5a-production-baseline-design.md`; implementation planning is documented in `docs/plans/2026-07-16-v5-m5a-production-baseline-implementation-plan.md`. The plan locks the `https://csi-org.com/loopos` production contract, release identity, local build/remote run model, migration safety, health/readiness, browser smoke, rollback/recovery, and evidence-class separation. It explicitly does not activate pluginization, Data -> Pretraining template migration, semantic/vector retrieval, notification delivery, production deployment, or longitudinal real-team completion claims.
- M5-A planning checkpoint is accepted after independent reviewer `Parfit` returned `PASS / accept M5-A planning and activate M5-A1` with no P0/P1/P2 findings and confirmed contract alignment, evidence-class separation, local-build/remote-run constraints, and no hidden M5 activation.
- M5-A1 is accepted. It pins `packageManager` to `pnpm@10.28.0`, updates the Aliyun deployment contract to forbid `npm install`/`package-lock.json` production releases, and adds a secret-free production baseline evidence template covering release identity, local build, migration, process, public HTTP, browser smoke, rollback, and explicit longitudinal deferral. Coordinator verification passed package JSON parsing, evidence-shape inspection, and `git diff --check`; independent reviewer `Kuhn` returned PASS with no P0/P1/P2.
- M5-A2 is accepted. It records local release candidate evidence in `docs/evidence/2026-07-16-v5-m5a2-local-release-candidate.md`: Prisma generate/validate, source tests 98/98 files with 865 tests, TypeScript, `git diff --check`, production `/loopos` build with 35/35 static pages, routes-manifest redirect verification, and a full 26-migration disposable PostgreSQL deploy after the B2A reader-role prerequisite. It also exposed and fixed a deployment-doc gap by documenting the required `loopos_brain_reader` prerequisite before `migrate deploy`. No production deployment, public HTTP, browser smoke, rollback, plugin, notification, semantic retrieval, or longitudinal claim is made. Independent reviewer `Lorentz` returned PASS with no P0/P1/P2.
- M5-A3 is accepted. It adds `scripts/verify-production-http.mjs` for anonymous public HTTP smoke planning, `docs/evidence/production-browser-smoke-checklist.md` for authenticated read-only browser smoke, and `docs/evidence/2026-07-16-v5-m5a3-production-smoke-design.md` with coordinator verification. Script syntax, dry-run JSON for four public checks, strict `/loopos/` redirect validation, key-field inspection, and `git diff --check` passed. It explicitly does not claim production HTTP/browser smoke execution. Independent reviewer `Laplace` returned PASS with no P0/P1/P2.
- M5-A4 is accepted. It expands Aliyun rollback guidance, adds `docs/evidence/production-recovery-checklist.md`, adds `scripts/verify-production-recovery-plan.mjs`, and records dry-run proof in `docs/evidence/2026-07-16-v5-m5a4-recovery-proof.md`. Coordinator verification passed script syntax, recovery-plan dry run, and `git diff --check`; independent reviewer `Herschel` returned PASS with no P0/P1/P2. It explicitly does not claim production rollback, PM2 reload, Nginx change, or database restore execution.
- M5-A5 and M5-A are accepted. `docs/evidence/2026-07-16-v5-m5a5-acceptance-cleanup.md` consolidates M5-A evidence; final implementation reviewer `Nietzsche` returned PASS with no P0/P1/P2; final roadmap/evidence auditor `Russell` returned PASS and activated `V5-M5-B - Production Validation`. It explicitly does not claim production deployment, public HTTP execution, authenticated production browser smoke, PM2/Nginx production state, rollback execution, pluginization, semantic retrieval, notifications, or longitudinal real-team validation.
- Historical M5-B initial snapshot: release `20260716-135813-m5b-trial` established migration, HTTP, authenticated browser, screenshot, cleanup, and bounded recovery evidence while the dedicated Reader was intentionally absent. It is retained for provenance and is superseded by release `20260717-1410-m6reader-isolation` for current deployment and Reader state.
- M5-C organization model settings is deployed in release `20260716-2354-model-settings`. It adds an ORG_ADMIN `/app/setup` entry for provider, model name, base URL, thinking mode, and encrypted API key configuration; Organization Brain planning now uses organization-specific model configuration when present and falls back to the system environment otherwise. Evidence in `docs/evidence/2026-07-16-v5-m5c-model-settings.md` records Prisma generate, focused setup/provider/encryption/planner/turn tests, TypeScript, diff check, production build 35/35, migration `20260716164000_v5_m5c_org_model_settings`, PM2 online reload, server-side HTTP smoke, authenticated `/app/setup` smoke with temporary ORG_ADMIN, and zero smoke residue. The slice does not claim completion of Brain reader readiness or longitudinal real-team validation.
- The historical M5-B acceptance-state verifier reported `accepted=false`, `pass=15`, `blocked=2`, `missing=0` before Reader provisioning. That snapshot is superseded. The current M5-B verifier reports `accepted=true`, `pass=26`, `blocked=0`, `missing=0`, and `deferred=1`; the deferred item is longitudinal real-team evidence carried to M6-6. The bounded recovery proof remains accepted without an extra rollback symlink switch drill.
- V5-M6 Brain-first Organization OS design and implementation plan are approved in `120c968` and `7520727`. M5-B, M6-1, and M6-2A have closed; the historical M6-2B entry is superseded by the current M6-3 governance execution slice below.
- Final M5-B state: release `20260717-1410-m6reader-isolation`, production Reader/BioCoach isolation gates passing, dual-tenant browser and cleanup passing, independent security reclosure passing, and final roadmap audit accepting M5-B with no P0/P1/P2.
- M6-1A is accepted. `/app` is the Brain home, the unchanged legacy Workspace is at `/app/workspace`, `/app/brain` redirects to `/app`, four primary entries are one click away, and the global Brain launcher remains available. Focused tests pass 21/21; scoped ESLint, TypeScript, diff check, production build 36/36, disposable PostgreSQL browser proof, zero browser/network errors, zero smoke residue, independent implementation review, and final roadmap audit all pass.
- M6-1B is accepted. The Actor-scoped read model covers relevant Goal, nearest future meeting, unfinished private Brain work, approved Projects and Actions, unresolved Tensions, and deterministic private brief signals; ranks deterministically with a hard cap of three; exposes immutable change, relevance, evidence/freshness, and navigation-only actions; and renders healthy and source-limited states. Correction-focused tests pass 17/17; scoped lint, TypeScript, diff check, production build 36/36, disposable 27-migration browser click proof, zero browser/network errors, zero smoke and database/role residue, and same-reviewer reclosure pass with no P0/P1/P2. The full source runner executes 104/104 files with 890 tests but retains the unrelated pre-existing setup action invalid-TAP harness debt.
- M6-1B is accepted. Independent roadmap auditor `Meitner` returned `ACCEPT M6-1B AND ACTIVATE M6-1C` with no P0/P1/P2 while preserving the full-runner boundary, conditional Broker-test boundary, M6-6 longitudinal deferral, and mandatory BioCoach production gate.
- M6-1C implementation is accepted. The Brain-first workspace is visible in the initial desktop and mobile viewport, followed by the unchanged M6-1B sensing projection; focused tests pass 45/45; scoped lint, TypeScript, diff check, production build 36/36, disposable browser light/dark proof, rendered-badge AA contrast, real navigation, model-off rendering, cleanup, and same-reviewer UX reclosure pass. The final audit's warning-contrast P1 is corrected with Canvas-normalized actual badge ratios 6.08:1 light and 10.02:1 dark. The mandatory production refresh proves Reader mutation denial and both LoopOS credentials denied BioCoach and `postgres` with exact `42501`; BioCoach remains healthy and untouched. Final same-auditor reclosure passed.
- M6-1 is accepted. Final roadmap auditor `Lovelace` returned `ACCEPT M6-1 AND ACTIVATE M6-2` with no open P0/P1/P2 after independently confirming the Canvas-normalized 6.08:1 light and 10.02:1 dark rendered warning ratios, focused 45/45, artifact hashes, browser/build/cleanup evidence, and mandatory BioCoach exact-`42501` gates.
- V6-M1-A is accepted. The slice persists irreversible `SETUP -> ACTIVE` lifecycle, append-only setup/activation evidence, historical `ACTIVE` backfill, new-organization `SETUP` default, and a pure four-gate readiness evaluator that requires a human key-role assignee. Focused tests pass 10/10; Prisma validate, TypeScript, and diff check pass; a disposable PostgreSQL run applies all 42 migrations, rejects direct `ACTIVE` inserts, proves legal human activation, irreversible lifecycle and immutable evidence, and reports zero residue across tables, columns, types, triggers, functions, and constraints after rollback. Same-reviewer implementation reclosure returned PASS, and independent roadmap audit returned `ACCEPT M1-A AND PROCEED TO M1-B`. V6-M1 remains the only active Goal.
- V6-M1-B1 is accepted. Setup writes now re-check lifecycle and actor authority inside the serializable transaction: ORG_ADMIN may edit organization-wide during SETUP; assigned structure leads are limited to their own node and descendants; ordinary members, stale authority, cross-branch targets, ACTIVE organizations, and repeated/history-bearing initialization are denied with zero structural writes. Focused tests pass 18/18; fresh 42-migration PostgreSQL action evidence passes 10/10 including rollback and concurrent single-winner behavior; lifecycle proof passes default SETUP, direct-ACTIVE denial, tenant-bound activation actor, immutable snapshot, and irreversible activation; Prisma reports zero `organizations` drift; the original independent reviewer reclosed with no P0/P1/P2.
- V6-M1-B2 is accepted. One fail-closed lifecycle policy now guards tactical/governance meeting creation, tactical proposal submission and meeting decision, governance claim/apply/failure-audit transactions, and meeting end/automatic notes. SETUP or missing organizations receive fixed non-leaking denials before formal writes; ACTIVE follows the existing path. Source tests pass 59/59 plus 21/21 bracket-directory runtime tests; TypeScript, scoped ESLint, and diff check pass; disposable PostgreSQL proves five denied boundaries leave Meeting, TacticalOutcomeProposal, Project/Action, governance proposal/process/operation/decision, notification, and meeting-end fields unchanged with zero fixture residue. Independent review found one P1 in the multi-transaction governance apply/audit path; the correction repeats the lifecycle gate in all three transactions, and the same reviewer reclosed PASS with no findings.
- V6-M1-B3 is accepted. Organization Brain preview and confirmation now fail closed for tactical outcome, meeting notes, and governance proposal commands while the organization is SETUP or missing, without gating Goal, Tension raise, or Role application commands. Focused tests pass 23/23; TypeScript, scoped ESLint, and diff check pass; disposable PostgreSQL proves zero preview-ledger writes, three PREVIEWED confirmations with zero terminal/domain writes, successful `tension.raise`, and zero fixture residue. Independent implementation review returned PASS with no P0/P1/P2.
- V6-M1-C1 is accepted. A bounded server-only activation service reauthorizes the current ORG_ADMIN, locks and reloads lifecycle/readiness in one Serializable transaction, blocks failed hard gates while retaining warnings, and atomically writes one immutable readiness-fact snapshot, `ACTIVATED` event, and tenant-bound irreversible lifecycle transition. Focused tests pass 11/11; PostgreSQL 1/1 proves legal activation, warning persistence, hard-gate/authority/cross-tenant zero writes, concurrent `ACTIVATED` plus `ALREADY_ACTIVE` with one evidence pair, irreversible lifecycle, append-only evidence, redacted facts, replay, and zero residue. TypeScript, scoped ESLint, Prisma validation, and diff check pass. Independent review found one P1 and one P2 in evidence completeness and sorting; both were fixed and the same reviewer reclosed PASS.
- V6-M1-C2A is accepted. SETUP-held versus explicit-admin-immediate policy and tenant-bound delivery persistence now exist without provider execution. Focused tests pass 11/11; the full migration chain, rollback/reapply, historical completed backfill with zero retroactive jobs, DB state constraints, PUBLIC denial, and PostgreSQL negative DML 1/1 are proven. Independent review found attempt-count and executable-DML evidence gaps; both were fixed and the same reviewer returned `ACCEPT C2A` with no open P0/P1/P2. C2B service primitives are the current bounded slice.
- V6-M1-C2B is accepted. Serializable hold/queue, current authority reload, tenant-bound claim, pre-lease invitation validity, persisted retry limits, stale-lease recovery, success/failure completion, and durable cancellation now form a deterministic provider-free state machine. Focused C2 tests pass 21/21 and PostgreSQL suites pass 2/2 after final migration rollback/reapply. Independent review found caller-controlled exhaustion and stranded PROCESSING gaps; both were corrected and the same reviewer returned `ACCEPT C2B` with no open P0/P1/P2.
- V6-M1-C2D is accepted. Provider processing remains explicit-job only and now uses a live tenant-bound lease to fetch encrypted invitation payloads, decrypts only outside the transaction, sends through the existing provider seam, redacts failures, and never persists plaintext invitation tokens. Focused processor/service tests pass 17/17; disposable PostgreSQL processor proof passes 1/1 after the full 43-migration chain; Prisma validate, TypeScript, scoped ESLint, and diff check pass. Independent reviewer returned PASS with no P0/P1/P2.
- V6-M1-C2E is accepted. Successful activation now releases eligible HELD invitations into the durable delivery queue inside the same Serializable activation transaction, creates at most one tenant-bound job per invitation, preserves irreversible activation evidence, and leaves provider processing explicit-job only. Activation focused tests pass 12/12; combined C2 focused tests pass 29/29 with the PG env absent; disposable PostgreSQL activation-release proof passes 1/1 after the full 43-migration chain; Prisma validate, TypeScript, scoped ESLint, and diff check pass. Independent reviewer returned PASS with no P0/P1/P2.
- V6-M1-D is accepted. It adds the Organization workspace setup/readiness surface, explicit admin activation through the accepted service, SETUP meeting lock, post-ACTIVE meeting availability, and a browser acceptance script. Browser evidence passed with a disposable database: initial activation disabled, ready activation enabled, meeting locked before activation, meeting available after activation, lifecycle `ACTIVE`, HELD invitation released to one PENDING delivery job, no plaintext token/email in job JSON, no mobile horizontal overflow, clean console/page/http ledger, cleanupOk, dropped disposable DB, and restored `loopos_brain_reader|t|f|f|f|f|f|f`. Source gates passed Prisma validate with existing warnings only, TypeScript, focused tests 26/26, scoped ESLint, and `git diff --check`. Independent implementation reviewer returned PASS with no findings; independent roadmap/evidence re-auditor returned PASS with no findings.
- V6-M1 is accepted. Final acceptance auditor returned `ACCEPT V6-M1 AND ACTIVATE V6-M2` with no findings and no blockers after confirming M1-A/B/C/D acceptance, cleanup evidence, no M1-D/dev-server residue, no next-milestone activation, and deferred scopes inactive.
- V6-M2-A is accepted. It adds one server-only setup workspace read model and renders the Organization workspace as seven navigable steps. Browser evidence passed with a disposable database: all seven labels visible, all seven entries route to non-404 pages, desktop/mobile horizontal overflow false, clean console/page/http ledger, cleanupOk, zero users/people/organizations residue, dropped disposable DB, and restored `loopos_brain_reader|t|f|f|f|f|f|f`. Source gates passed TypeScript, focused organization page tests 3/3, scoped ESLint, Prisma validate with existing warnings only, script syntax, and `git diff --check`. Independent implementation reviewer returned PASS with no findings; independent roadmap/evidence re-auditor returned PASS with no findings.
- V6-M2-B is accepted. `/app/organization` now owns direct editable setup sections for organization identity, structure initialization/closed state, organization language, governance rules, and organization brain model settings while reusing existing setup actions/components rather than adding new domain logic. The first independent implementation review found that organization purpose was not editable and model-setting saves did not revalidate the new primary workspace; both were fixed and same-reviewer reclosed PASS with no P0/P1/P2. Browser evidence passed on disposable PostgreSQL `loopos_m2b_browser_20260720_2`: required Organization headings visible, organization name and purpose edited and persisted, identity readiness became ready, desktop/mobile horizontal overflow false, clean console/page/http ledger, cleanupOk, zero users/people/organizations residue, disposable DB dropped, and `loopos_brain_reader` remains `rolsuper=f, rolcreatedb=f, rolcreaterole=f, rolinherit=f, rolcanlogin=f, rolreplication=f, rolbypassrls=f`. Source gates passed TypeScript, focused organization/setup tests 13/13, scoped ESLint, script syntax, Prisma validate with existing warnings only, and scoped `git diff --check`. Same-auditor roadmap/evidence reclosure returned PASS with no P0/P1/P2.
- V6-M2-C is accepted. `/app/organization` now renders actionable setup panels for `03 组织目标`, `04 角色定义`, `05 成员邀请`, and `06 角色任命`, showing current counts from the accepted read model and direct next actions to goals, organization structure/roles, people invitations, and role market. Browser evidence passed on disposable PostgreSQL `loopos_m2c_browser_20260720_1` through repo-local `scripts/m2c-browser-acceptance.cjs`; evidence is recorded in `docs/evidence/2026-07-20-v6-m2c-organization-setup-panels.md`. All M2-B editable headings plus M2-C headings were visible, organization name and purpose persisted, identity readiness ready, desktop/mobile overflow false, clean console/page/http ledger, cleanupOk, zero users/people/organizations residue, disposable DB dropped, and `loopos_brain_reader` remains no-login/no-privilege. Source gates passed TypeScript, focused organization page tests 5/5, scoped ESLint, script syntax, and scoped `git diff --check`. Independent implementation review and same-auditor roadmap/evidence reclosure both returned PASS with no P0/P1/P2.
- V6-M2-D is accepted. `/app/organization` now shows `下一步准备度`, deriving missing readiness items from the accepted read model and linking to existing setup sections or routes. Browser evidence passed on disposable PostgreSQL `loopos_m2d_browser_20260720_1` through repo-local `scripts/m2d-browser-acceptance.cjs`; evidence is recorded in `docs/evidence/2026-07-20-v6-m2d-readiness-guide.md`. The readiness guide was visible on desktop/mobile, missing action and gap count were visible, organization name and purpose persisted, identity readiness updated, desktop/mobile overflow false, console/page/http ledger clean, cleanupOk true, zero users/people/organizations residue, disposable DB dropped, and `loopos_brain_reader` remains no-login/no-privilege. Source gates passed TypeScript, focused organization page tests 6/6, scoped ESLint, script syntax, and scoped `git diff --check`. Independent implementation review returned PASS with no P0/P1/P2. Independent roadmap/evidence audit returned PASS after one P2 wording precision fix: M2-D does not integrate with BioCoach application/database scope; it only preserves existing cross-application query rejection as an isolation guard.
- V6-M2-E is accepted. `/app/organization` identity and system-configuration setup steps now stay inside Organization instead of routing to `/app/setup`: `组织身份` links to `/app/organization#organization-identity`, and `系统配置` links to `/app/organization#system-configuration`. Browser evidence passed on disposable PostgreSQL `loopos_m2e_browser_20260720_1` through repo-local `scripts/m2d-browser-acceptance.cjs`; evidence is recorded in `docs/evidence/2026-07-20-v6-m2e-setup-workspace-final-acceptance.md`. Organization setup headings were visible, no `/app/setup` links were visible from the Organization setup workspace, organization name and purpose persisted, identity readiness updated, desktop/mobile overflow false, console/page/http ledger clean, cleanupOk true, zero users/people/organizations residue, disposable DB dropped, and local port 3237 closed. Source gates passed TypeScript, focused organization page tests 7/7, scoped ESLint, script syntax, and scoped `git diff --check`. Independent implementation review and independent roadmap/evidence audit returned PASS with no P0/P1/P2.
- V6-M2 is accepted. Final independent milestone auditor returned `ACCEPT V6-M2 AND ACTIVATE V6-M3` with no P0/P1/P2 after confirming M2-A/B/C/D/E acceptance, seven-step editable Organization setup coverage, actionable setup panels, prioritized readiness guidance, no `/app/setup` setup-workspace regression, source/browser/cleanup evidence, M1-D activation delegation, no V6-M3 preactivation, no deployment or real-team longitudinal claim, and no Business Loops, AI co-assignees, candidate tensions, scheduler, delivery observability, broad notification policy, or BioCoach application/database integration inside V6-M2.

- V6-M5-A is accepted. Candidate tension records, source vocabulary,
  lifecycle status, audit events, durable lifecycle CHECK constraints,
  tenant-scoped confirmed-tension uniqueness, and pure contract helpers are in
  place without activating automatic sensing or formal `Tension` creation.
  Focused tests passed 6/6; TypeScript, scoped ESLint, Prisma validate,
  production build, scoped diff check, and migration `BEGIN`/`ROLLBACK` proof
  passed. Implementation reviewer `Poincare` reclosed the original P1/P2
  findings with PASS, and roadmap/evidence auditor `Harvey` returned PASS.
- V6-M5 is accepted. Final milestone auditor `Huygens` returned `ACCEPT V6-M5
  AND ACTIVATE V6-M6` with no P0/P1/P2 after confirming M5-A/B/C/D/E
  acceptance, no open findings, deferred scopes inactive, exactly one active
  Goal, and V6-M6 not preactivated.

### What's next

- Prepare M6-E production deployment and isolation proof from the accepted M6-D
  local evidence snapshot.
- Keep the remaining setup gaps explicit before production trial: tactical
  cadence, Organization Brain model/profile persistence, full goal
  proposal/decision/adopted-goal/target path, detector Agent, and candidate
  tension creation.
- Re-prove production Brain Reader and BioCoach isolation before asking a real
  team to trial the release.
- Use disposable fixtures without claiming production deployment or real-team
  longitudinal completion.
- Keep activation available through the accepted M1-D service but do not add new activation domain logic.
- Keep automatic candidate sensing, scheduler, delivery observability, and deployment inactive until later slices or milestones.
- Keep real-team longitudinal completion unclaimed until M6-6 passes `scripts/verify-m5b-longitudinal-real-team.mjs` or its reviewed M6 successor.
- Keep pluginization, semantic/vector retrieval, global feeds, and broad notification policy inactive.

### Any blockers

- No product decision blocker.
- No open V6-M1-A, M1-B, M1-C1, M1-C2A, M1-C2B, M1-C2C, M1-C2D, M1-C2E, or M1-D implementation/roadmap finding.
- V5-M2, V5-M3, V5-M4, and V5-M5 are accepted with no open P0/P1/P2. V5-M6 is historical work with residual M6-3 acceptance debt, not an active Goal.
- M5-A production baseline and M5-B production validation are accepted with no open P0/P1/P2.
- V6-M3 and V6-M4 are accepted. V6-M4 is accepted after A-F: AI co-assignee policy table, L0-L4 vocabulary, accountable-human invariant helper, AGENT/HUMAN creation guard, Role detail configuration, ORG_ADMIN proposed-policy action, non-proposed reset guard, approval/suspension/revocation lifecycle, read-only execution readiness gate, AI execution audit ledger contract, focused tests 15/15, TypeScript, scoped ESLint, Prisma validate, production build, migration `BEGIN`/`ROLLBACK` proof, browser regression in `/tmp/loopos-m4f-browser-20260720-1`, no overflow, clean browser ledger, zero fixture residue, implementation reviews PASS, roadmap/evidence audits PASS, and no automatic AI execution. V6-M5-A is accepted after source/build/migration evidence: candidate tension schema/migration, pure contract helper, lifecycle/source vocabularies, no-formal-Tension-before-human-confirmation invariant, focused tests 6/6, TypeScript, scoped ESLint, Prisma validate, production build, scoped diff check, migration `BEGIN`/`ROLLBACK` proof, implementation reclosure PASS, and roadmap/evidence audit PASS. V6-M5-B is accepted after source/build evidence: candidate tension persistence service, human owner-role confirmation boundary, terminal dismissal/false-positive/merge transitions, audit events, focused tests 11/11, TypeScript, scoped ESLint, Prisma validate, production build, scoped diff check, implementation review PASS, and roadmap/evidence audit PASS. V6-M5-C is accepted after `/app/tensions` exposes an AI candidate tension inbox with evidence, sourceRef summary, owner Role, detector, suggested path, status, and confirmed-Tension link, while formal Tension flow remains unchanged; TypeScript, scoped ESLint, production build, scoped diff check, implementation reclosure PASS, and roadmap/evidence reclosure PASS passed. V6-M5-D is accepted after candidate review Server Actions call the accepted M5-B service, `/app/tensions` exposes confirm/dismiss/false-positive/merge actions to owner-role human assignees, read-only users see a notice, focused tests 14/14, TypeScript, scoped ESLint, Prisma validate, production build, scoped diff check, implementation reclosure PASS, and roadmap/evidence audit PASS. V6-M5-E is accepted after disposable DB applied 47 migrations, isolated 3025 server proved candidate inbox, sourceRef display, owner-role action visibility, scoped read-only notice, candidate confirmation to existing formal Tension, clean browser ledger, fixture cleanupOk, default DB residue zero, temp DB dropped, implementation review PASS, and roadmap/evidence audit PASS. Production Reader and BioCoach isolation remain required invariants.
- Real-team longitudinal evidence is deferred to M6-6 and remains unproven rather than blocked inside M5-B.
- Pluginization, global feeds, broad notifications, and semantic retrieval remain inactive.
- Cross-instance exactly-once provider execution remains outside M1; E1 must still prevent duplicate visible messages and organization mutations while accepting possible duplicate read audits/provider cost under the locked M1 assumption.
