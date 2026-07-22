# LoopOS V5-M6: Brain-first Organization OS Implementation Plan

Date: 2026-07-17

Design source:
`docs/plans/2026-07-17-v5-m6-brain-first-organization-os-design.md`

Status: M5-B and M6-1 accepted; M6-2A active

## Execution Rules

- Keep exactly one active milestone. Do not start M6-1 until M6-0 closes M5-B.
- Connect existing domain logic before adding a new domain concept.
- Brain and traditional pages must invoke the same domain operation for the
  same effect.
- The model may select or fill a typed capability; it may not receive database
  credentials, arbitrary SQL writes, or DOM-control tools.
- Preserve tactical, strategic, and governance authority. A generated preview
  is not authorization.
- Keep private, organization-confirmed, and process-bound states distinct in
  storage and UI.
- Keep source, static, PostgreSQL, browser, production, and longitudinal
  evidence as separate claims.
- Every schema change is additive, has rollback constraints, and is tested on a
  disposable PostgreSQL database.
- Every user-facing slice ends in browser evidence at desktop and mobile
  viewports, including loading, empty, denial, model-off, and failure states.
- Preserve unrelated dirty work and commit each accepted slice independently.
- After every milestone, run an independent implementation review and a
  separate GOALS/evidence audit before activating the next milestone.

## Current Baseline

Reuse these accepted components:

- Actor Context and transparency-first read policy.
- Dedicated Brain read views, query broker, structured query plans, evidence
  packets, links, and query audit.
- Private Brain conversations and messages.
- Six-command registry and preview/confirmation/idempotency ledger.
- Goal proposal, Goal check-in, Tension raise, tactical proposal, and meeting
  note domain handlers.
- Governance IDM domain operations and meeting workbench.
- Goal Tree, Workspace Goal context, private briefs, memory candidates, and
  confirmed shared-memory retrieval.
- Organization model settings and existing worker process.

Known baseline state:

- Production `BRAIN_DATABASE_URL` uses a dedicated Reader login; readiness,
  mutation denial, cross-tenant browser proof, and BioCoach cross-database
  isolation pass. BioCoach remains a separate application and data domain.
- Real-team longitudinal proof is unproven and is explicitly deferred to M6-6.
- M6-1A is accepted: `/app` is the Organization Brain home, the unchanged
  legacy Workspace is at `/app/workspace`, and `/app/brain` redirects to
  `/app`.
- Meeting creation/start and several governance/Project/Action operations are
  still page-coupled rather than shared domain capabilities.

## M6-0 - Production Reader and M5-B Closure

### Slice M6-0A - Operator-safe reader plan

Outcome:
- Select and document one production boundary that gives a dedicated Brain
  login access only to the LoopOS database without altering unrelated workloads.

Likely ownership:
- `scripts/organization-brain/B2A_DEPLOYMENT.md`
- `deploy/aliyun/README.md`
- `docs/evidence/2026-07-17-v5-m6-0-brain-reader-plan.md`

Required behavior:
- Preserve `loopos_brain_reader` as `NOLOGIN NOINHERIT` with no administrative
  attributes and connection limit zero.
- Create one separate `NOINHERIT` login with exactly one direct, non-admin
  membership in `loopos_brain_reader`.
- Do not use the application credential.
- Do not modify the unrelated `biocoach` database ACL without explicit operator
  authorization and workload evidence.
- Prefer a database or cluster isolation path if it avoids unrelated ACL
  changes.
- Define secret creation, rotation, revocation, and recovery without recording
  the password or raw URL in repository evidence.

Evidence:
- Read-only production cluster inventory with credentials redacted.
- Static review of the selected boundary against B2A provisioning rules.
- Operator decision recorded in the evidence document.

### Slice M6-0B - Provision, configure, and prove readiness

Outcome:
- Production dynamic Brain reads pass the dedicated-reader readiness gate.

Likely ownership:
- production database/operator state
- `/var/www/loopos/shared/.env`
- `scripts/verify-production-brain-reader-readiness.mjs`
- `scripts/verify-production-brain-reader-boundary.mjs`
- `docs/evidence/2026-07-17-v5-m6-0-brain-reader-readiness.md`

Required behavior:
- Provision the dedicated login through the approved boundary.
- Configure `BRAIN_DATABASE_URL` through the root-only shared environment.
- Reload only `loopos-web` and `loopos-worker` with `--update-env`.
- Readiness verifies credential separation, exact memberships, safe role
  attributes, read-only transaction, `SET LOCAL ROLE`, statement timeout, actor
  context, and a `brain_read.current_actor` probe.
- Add a mutation-denial probe through the dedicated credential.
- Add an unauthorized-tenant/no-existence probe through the application Brain
  path.
- Verify public HTTP, authenticated Brain read, PM2 state, and no smoke residue.

Evidence:
- Production readiness verifier: `ok=true`, `ready=true`.
- Redacted identity and membership readback.
- Mutation denial and unauthorized-scope denial.
- Authenticated browser question returning current evidence with sources.
- Cleanup counts and bounded recovery readback.

### Slice M6-0C - Re-lock M5-B acceptance state

Outcome:
- M5-B closes on the reader gate while real-team evidence is truthfully carried
  into M6-6.

Likely ownership:
- `scripts/verify-m5b-acceptance-state.mjs`
- focused verifier tests or fixture harness
- `docs/evidence/2026-07-17-v5-m5b-final-acceptance.md`
- `GOALS.md`
- `progress-dashboard.html`

Required behavior:
- Replace the historical two-blocker rule with the approved sequencing rule:
  Brain readiness is the final M5-B gate; longitudinal proof is deferred to
  M6-6 and remains explicitly unproven.
- The acceptance script must require the new readiness evidence and reject a
  mere source-text claim.
- Do not rewrite historical evidence documents to imply they proved readiness.
- Keep pluginization, semantic retrieval, and broad notifications inactive.

Evidence:
- Acceptance verifier: `accepted=true`, `blocked=0`, `missing=0`, with a
  separate `deferred` longitudinal record.
- Independent security review of the production reader.
- Independent roadmap/evidence audit approving M5-B closure and M6-1 activation.

## M6-1 - Brain-first Shell

### Slice M6-1A - Route migration without capability loss

Outcome:
- `/app` becomes the Brain home and all existing dashboard work moves intact to
  `/app/workspace`.

Likely ownership:
- `src/app/app/page.tsx`
- new `src/app/app/workspace/page.tsx`
- new `src/app/app/workspace/loading.tsx`
- new `src/app/app/workspace/error.tsx`
- `src/app/app/brain/page.tsx`
- `src/app/app/layout.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/topbar.tsx`
- route/component tests

Required behavior:
- Move, do not duplicate, the legacy Workspace read path and UI.
- Make `工作`, `目标`, `会议`, and `组织` one-click entries.
- Use the organization/Brain identity as the Home entry.
- Preserve a global context-aware Brain launcher on every application route.
- Redirect `/app/brain` to `/app` using the Next.js server `redirect` API while
  preserving no stale chat-only page.
- Use `Link` for app navigation and keep dynamic routes responsive with loading
  boundaries.
- Keep session and organization resolution in Server Components; pass only
  serializable data into interactive Client Components.

Tests:
- Source tests for route ownership, nav hrefs, labels, and compatibility
  redirect.
- Existing `/app` dashboard tests moved and re-anchored to `/app/workspace`.
- Navigation active-state tests for `/app`, `/app/workspace`, Goals, Meetings,
  and Organization.

### Slice M6-1B - Brain home read model

Outcome:
- The default home shows no more than three evidence-backed, role-relevant focus
  items and a useful healthy state.

Likely ownership:
- new `src/lib/organization-brain/home-read-model.ts`
- new `src/lib/organization-brain/home-read-model.test.ts`
- `src/lib/organization-brain/private-brief-service.ts`
- `src/lib/goals/workspace-read-model.ts`
- `src/app/app/page.tsx`

Required behavior:
- Compile current primary Goal, next meeting, recent unfinished Brain work,
  Projects, Actions, unresolved Tensions, and deterministic private brief
  signals under Actor Context.
- Rank deterministically by materiality, time, Role relevance, and process
  readiness; cap at three.
- Every focus item contains change, relevance, evidence, and legitimate next
  action.
- Healthy state shows Goal, next meeting, and active Projects.
- Model explanation may enrich the copy but cannot decide visibility or ranking.
- If Brain Reader is unavailable, render confirmed/statically available state
  with a visible freshness limit.

Tests:
- Role relevance, cap, stable ranking, no-existence denial, healthy state,
  stale-source label, and model-off fallback.
- Two-tenant PostgreSQL tests if the read model crosses the Brain query broker.

### Slice M6-1C - Future command-center surface and themes

Outcome:
- Brain home presents a coherent live operating surface in both system light and
  dark themes.

Likely ownership:
- `src/components/organization-brain/brain-client.tsx`
- new focused Brain home components under
  `src/components/organization-brain/`
- `src/app/globals.css` or existing theme tokens
- layout and component tests

Required behavior:
- Provide default, focused, continuation, loading, empty, denied, model-off, and
  error states.
- Show organization identity, current sensing state, focus items, intent input,
  recent work, sources, and process status without nested-card clutter.
- Use Lucide icons, stable responsive grids, and text plus icons for all status.
- Use carbon/near-white structure with green, cyan, amber, and red semantic
  signals. Avoid purple gradients, glow orbs, particles, and decorative motion.
- Follow OS theme and preserve contrast and hierarchy in both modes.
- Keep keyboard focus, screen-reader labels, reduced motion, touch targets, and
  long Chinese text robust.

Evidence:
- Focused component tests.
- Playwright screenshots at desktop and mobile in light and dark modes.
- Browser checks for no overlap, no horizontal overflow, one-click navigation,
  input focus, and clean console/network.
- Independent UX review before M6-1 acceptance.

## M6-2 - Generative Artifact Foundation

### Slice M6-2A - Artifact persistence and lifecycle

Outcome:
- Brain work can survive refresh and progress through one explicit, audited
  lifecycle.

Likely ownership:
- `prisma/schema.prisma`
- new additive migration
- new `src/lib/organization-brain/artifact-types.ts`
- new `src/lib/organization-brain/artifact-lifecycle.ts`
- new `src/lib/organization-brain/artifact-service.ts`
- pure, service, persistence-contract, and PostgreSQL tests

Required behavior:
- Add `BrainArtifact` only in this slice.
- Owner-private by default; organization visibility requires an explicit
  confirmed domain result, not an artifact flag.
- Validate type, schema version, payload bounds, source references, lifecycle,
  expiry, supersession, and linked command operation.
- Enforce tenant/owner composite references and lifecycle constraints in the
  database where practical.
- Preserve draft on execution failure and make terminal results immutable.

Evidence:
- Pure lifecycle tests.
- Fresh PostgreSQL migration apply, denial, transition, rollback/reapply, and
  zero-residue evidence.
- Independent persistence/security review.

### Slice M6-2B - Typed capability contract

Outcome:
- The six accepted Brain commands are described by a versioned capability
  registry without changing their domain authority.

Likely ownership:
- new `src/lib/organization-brain/capability-types.ts`
- new `src/lib/organization-brain/capability-registry.ts`
- `src/lib/organization-brain/command-registry.ts`
- `src/lib/organization-brain/command-preview-service.ts`
- focused contract tests

Required behavior:
- Declare schemas, reads, authority level, confirmation, process gate, handler,
  idempotency, audit, artifact renderer, and fallback for every capability.
- Adapt rather than duplicate the existing six command metadata definitions.
- Reject unknown capability versions, arbitrary handler injection, SQL/table
  identifiers, and cross-capability payloads.
- Keep execution server-only and require fresh Actor Context at confirmation.

Tests:
- Complete registry coverage, version rejection, schema confusion, forbidden
  keys, authority level, handler identity, and static no-client-import proof.

### Slice M6-2C - Inline artifact rendering and parity

Outcome:
- Each existing command appears where it was requested and can be revised,
  previewed, confirmed, executed, and reopened after refresh.

Likely ownership:
- `src/lib/organization-brain/response-schema.ts`
- `src/lib/organization-brain/turn-service.ts`
- `src/app/app/brain/actions.ts`
- `src/components/organization-brain/brain-client.tsx`
- new artifact renderer components and tests

Required behavior:
- Extend turn result to `ANSWER | NAVIGATE | ARTIFACT | CAPABILITY` without
  breaking stored V1 answers.
- Anchor artifacts to the triggering message and preserve chronological order.
- Render missing input, preview diff, authority, expiry, execution, failure, and
  follow-up states.
- Link to the canonical page and show the same resulting record after execution.
- Do not render all command cards above the message stream.

Evidence:
- Source tests for all six commands and lifecycle states.
- PostgreSQL idempotency and stale-authorization evidence.
- Browser workflows for Tension, Goal draft/check-in, tactical proposal, and
  meeting notes with refresh recovery and page parity.

## M6-3 - Context, Navigation, and Meeting Operations

### Slice M6-3A - Page context and navigation catalog

Outcome:
- The Brain understands the current route/object and can reliably open the right
  canonical surface.

Likely ownership:
- new `src/lib/organization-brain/context-compiler.ts`
- new `src/lib/organization-brain/navigation-catalog.ts`
- `src/lib/organization-brain/link-resolver.ts`
- `src/components/organization-brain/brain-client.tsx`
- focused tests

Required behavior:
- Compile actor, organization, Roles, route, object reference, current Goal,
  meeting, and recent artifact context.
- Page context is request-scoped and is not written as organization memory.
- Navigation uses a fixed catalog and canonical link resolver, not model-created
  URLs.
- Unauthorized objects yield no destination or existence hint.

### Slice M6-3B - Shared meeting domain operations

Outcome:
- Traditional pages and Brain capabilities share meeting preparation, creation,
  and start operations.

Likely ownership:
- new `src/lib/meetings/domain-operations.ts`
- `src/app/app/meetings/actions.ts`
- `src/app/app/meetings/[id]/actions.ts`
- capability registry and focused tests

Required behavior:
- Extract page-coupled Prisma mutations behind typed domain operations.
- Preserve meeting type, Circle, facilitator/coach, participant, and start-state
  authority.
- Separate private preparation artifact from organization meeting creation.
- Require L2 confirmation for creation and the correct actor/process state for
  start.
- Make duplicate create/start requests idempotent.

Evidence:
- Domain tests and page regression tests.
- PostgreSQL concurrency and tenant-denial tests.
- Browser parity: create/start from page and Brain produce equivalent records.

### Slice M6-3C - M6-3 acceptance

Evidence:
- Full source tests, TypeScript, scoped ESLint, Prisma validate, production build,
  desktop/mobile browser matrix, independent review, and roadmap audit.

## M6-4 - Governance, Goal, and Execution Loop

### Slice M6-4A - Governance IDM artifact

Outcome:
- The Brain guides a proposer and participants through the canonical governance
  flow without making the decision.

Likely ownership:
- `src/lib/governance-decision.ts`
- `src/app/app/meetings/[id]/governance-workbench.tsx`
- new governance capability adapter and artifact renderer
- focused domain/component tests

Required behavior:
- Reuse existing IDM operations and revisions.
- Present proposal, clarifying questions, reactions, objection, objection test,
  integration, and terminal state inline.
- Guide valid-objection testing around material harm, fact versus worry,
  reversibility, and safe-to-try scope.
- Do not let the model judge validity, adopt a proposal, or modify structure.
- Permit proposer final execution only after the canonical process grants it.

### Slice M6-4B - Goal process capability

Outcome:
- Goal proposal, revision, Target evidence, strategic decision, and tactical
  inspection form one coherent Brain-assisted flow.

Likely ownership:
- `src/lib/goals/domain-operations.ts`
- Goal meeting action adapters
- capability registry and Goal artifact renderer
- focused tests

Required behavior:
- Preserve one active primary Goal per Circle per cycle.
- Preserve strategic confirmation and Role-based follow-up authority.
- Keep AI suggestions as drafts and evidence candidates until confirmed.
- Reflect accepted results in Goal Tree and Workspace immediately.

### Slice M6-4C - Project, Action, and closure operations

Outcome:
- Accepted tactical or governance output can create and follow a Project or
  Action through the proper actor confirmation.

Likely ownership:
- new shared Project/Action domain operations
- existing Project, tracker, tactical outcome, and meeting actions
- capability registry and artifact renderers
- focused tests

Required behavior:
- Project means a result requiring multiple actions; Action means a result
  obtainable through one concrete action.
- The proposal names the responsible Role or legitimate assignee according to
  the existing domain rule.
- Disagreement creates a new Tension rather than silent reassignment.
- Closure requires existing evidence and authority; the Brain cannot close work
  from inference.

### Slice M6-4D - End-to-end authority acceptance

Evidence:
- Browser scenarios for tactical and governance routing, valid-objection test,
  process completion, proposer final confirmation, Project/Action result, Goal
  linkage, notes, and follow-up.
- Negative browser and PostgreSQL cases for Circle lead, administrator, model,
  stale proposer, wrong tenant, and pre-process execution attempts.
- Independent Holacracy/process review and roadmap audit.

## M6-5 - Watches and Continuous Perception

### Slice M6-5A - Watch and signal persistence

Outcome:
- One confirmed private Watch can run repeatedly without duplicate reminders or
  organization-fact writes.

Likely ownership:
- `prisma/schema.prisma`
- additive migration for `BrainWatch`, `BrainWatchRun`, `BrainSignalState`
- new watch/signal types, lifecycle, service, and tests

Required behavior:
- Actor-owned, tenant-bound, bounded read scope and schedule.
- Stable detector and deduplication keys.
- Inspectable run evidence, status, delivery, failure, retry, snooze, disable,
  and feedback.
- No shared organization mutation from a Watch run.

### Slice M6-5B - Event plus reconciliation worker

Outcome:
- Watches respond to canonical events and recover through scheduled
  reconciliation.

Likely ownership:
- `worker/index.ts`
- new perception service and event/reconciliation adapter
- minimal event emission from shared domain operations
- focused worker tests

Required behavior:
- Emit only after successful domain transactions.
- Make event processing idempotent and bounded per organization.
- Reconciliation detects missed events and time-based conditions.
- Deterministic detection completes without a model; explanation can retry
  separately.
- One failing Watch does not block unrelated organizations or later runs.

### Slice M6-5C - Watch management and delivery UX

Outcome:
- Members can create, inspect, snooze, disable, and correct private Watches from
  the Brain.

Likely ownership:
- Brain home/read model
- Watch capability and inline renderer
- focused component/action tests

Evidence:
- Fake-clock detector and deduplication tests.
- PostgreSQL concurrency, tenant denial, retry, and cleanup evidence.
- Browser create/run/deliver/snooze/disable/why/feedback flow.
- Worker interruption and model-off recovery proof.
- Independent implementation review and roadmap audit.

## M6-6 - Canary and Real-team Acceptance

### Slice M6-6A - Organization canary and rollback

Outcome:
- Enable Brain-first home for selected organizations while preserving immediate
  fallback to legacy Workspace.

Required behavior:
- Server-authoritative organization flag.
- No client-only permission or rollout decision.
- Rollback changes entry routing only; it preserves conversations, artifacts,
  command ledger, Watches, and domain results.

Evidence:
- Production canary enable/disable and recovery timing.
- Public/authenticated HTTP and browser proof before and after rollback.

### Slice M6-6B - Longitudinal real-team weekly loop

Outcome:
- One real team uses production LoopOS for at least one complete weekly
  Goal-to-Tension-to-decision-to-follow-up cycle.

Required proof:
- At least two real members and no smoke/test tenant.
- One shared Goal cycle with a Circle primary Goal, Target, and check-in.
- At least one real Tension processed tactically or through governance.
- At least one meeting with official notes and terminal or continued process
  state.
- At least one accepted Project, Action, or governance result linked to the Goal
  or justified as follow-up.
- Organization Brain used to perceive, locate evidence, prepare or execute at
  least one core workflow.
- Traditional page path remains usable for the same workflow.
- No unauthorized read/write, unresolved P0/P1, or critical usability blocker.
- User observations record friction, confusion, recovery, and time-to-complete,
  not only database counts.

### Slice M6-6C - Final acceptance

Evidence:
- Full source tests, TypeScript, ESLint, Prisma validation, production build.
- Migration apply and retained-data proof.
- Production reader readiness and mutation denial.
- Desktop/mobile, light/dark browser matrix.
- Model-off, read-off, worker-restart, stale-preview, denial, and rollback cases.
- Longitudinal verifier and qualitative trial report.
- Independent implementation `/review` with no open P0/P1/P2.
- Independent GOALS/current-state audit approving M6 and V5 completion.

Only after every evidence class above passes may the coordinator mark the V5
goal complete.

## Explicitly Deferred

- Organization-authored write plugins and plugin marketplace.
- Arbitrary database writes or generated SQL mutation.
- DOM/browser automation by the Organization Brain.
- Semantic/vector retrieval as a core dependency.
- Global social feeds and broad cross-channel notification policy.
- Autonomous governance, strategic decisions, responsibility assignment, or
  closure.
- New unrelated domain modules.
