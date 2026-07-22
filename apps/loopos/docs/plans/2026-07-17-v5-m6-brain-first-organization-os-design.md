# LoopOS V5-M6: Brain-first Organization OS Design

Status: approved by product owner on 2026-07-17

Supersedes: the Organization Brain interaction-surface definition in
`docs/plans/2026-07-14-organization-brain-goal-tree-v5-design.md`.

Preserves: the V5 authority model, dynamic authorized-read boundary, Goal model,
controlled-write contract, memory authority, and plugin boundary from that design.

## 1. Desired Outcome

LoopOS should feel like an operating system whose primary interface is the
organization's own intelligence, not a conventional application with a chat
feature attached.

A member should be able to enter LoopOS, understand what matters now, ask about
any authorized part of the organization, continue current work, and initiate
ordinary operating workflows without first learning the menu structure. The
same workflows must remain reachable through stable traditional pages.

The Organization Brain must help a real team sustain this weekly loop:

`Goal -> evidence -> Tension -> tactical or governance process -> authorized
decision -> Project or Action -> follow-up -> new evidence`

The Brain does not replace distributed authority. It helps people perceive,
prepare, navigate, and execute the authority they already hold.

## 2. Problem Diagnosis

The current Organization Brain has strong foundations but a weak product
surface:

- It is a secondary destination instead of the system's default entry.
- Its visual hierarchy resembles a sparse chat page rather than a live
  organization control surface.
- Existing Brain commands appear as chat-adjacent cards instead of durable work
  objects embedded in the conversation that created them.
- Navigation, meeting creation and start, governance IDM, and Goal-cycle work
  are not expressed through one typed capability system.
- Proactive briefs exist, but the user cannot manage durable watches or see a
  coherent perception-to-action loop.
- Model failure is visible as a feature outage even though deterministic reads,
  signals, and domain operations could remain useful.
- The current information architecture makes the Brain one capability among
  modules rather than the coordinating layer across them.

M6 addresses these connection and experience gaps. It does not add unrelated
domain families.

## 3. Locked Product Principles

1. **Brain first, pages intact.** The Brain is the default home and coordinating
   layer. Traditional pages remain complete, stable, and directly usable.
2. **Work objects, not chat decoration.** A Brain turn may create a durable,
   inspectable work object with state, evidence, authority, and follow-up.
3. **One domain operation, two interfaces.** Brain-generated controls and
   traditional pages call the same authorization and domain services.
4. **Process grants power.** No model, administrator, Circle lead, or proposer
   receives authority outside the applicable strategic, tactical, or governance
   process.
5. **Proactivity is bounded.** The Brain may perceive, summarize, draft, and
   privately remind. Organization facts change only through explicit authority.
6. **Evidence before fluency.** Dynamic claims expose sources and uncertainty.
   Missing evidence produces an explicit limit, not plausible completion.
7. **AI failure is partial failure.** Pages, deterministic signals, registered
   operations, and confirmed memory remain available when the model is down.
8. **Current workflows before new domains.** M6 connects existing Goal, Tension,
   meeting, tactical, governance, Project, Action, note, and memory logic.

## 4. Brain-first Information Architecture

### 4.1 Routes

- `/app` becomes the Organization Brain home and default application shell.
- `/app/workspace` contains the current metrics, queues, Projects, Actions,
  personal Roles, and other daily work currently shown at `/app`.
- `/app/goals` remains the Goal Tree and Goal-cycle surface.
- `/app/meetings` remains the meeting surface.
- `/app/circles/map` remains the Organization entry and opens the organization
  map directly.
- `/app/brain` becomes a compatibility redirect to `/app`, unless a later
  migration needs it as a deep conversation workspace route.

### 4.2 Primary entries

The persistent operational navigation has four one-click entries:

- `工作` -> Workspace
- `目标` -> Goals
- `会议` -> Meetings
- `组织` -> Organization

The organization identity and Brain identity form the Home entry. The Brain is
not rendered as a fifth peer module.

A compact, context-aware Brain launcher remains available on every application
page. Opening it must preserve the current page and object context.

### 4.3 Interaction budgets

- Open the Brain home: default after login or one identity click.
- Open Workspace, Goal Tree, Meetings, or Organization: one click.
- Raise a Tension: one Brain request or one global action.
- Join an active meeting: one click from the home focus item or Workspace.
- Start a permitted meeting: no more than two interactions after intent is
  understood.
- Open a referenced Circle, Role, Goal, Tension, meeting, Project, or Action:
  one click from a Brain source or work object.

## 5. Brain Home Experience

### 5.1 Default state

The home combines three elements:

1. A daily organization brief.
2. One unified intent input.
3. A continuation surface for recent unfinished work.

The brief contains at most three personalized focus items. Each item answers:

- What changed or needs attention?
- Why is it relevant to this member's Roles and current work?
- What evidence supports it?
- What is the next legitimate action?

The home is not a KPI dashboard. Existing metrics move to Workspace.

When no intervention is needed, the healthy state shows the current primary
Goal, next meeting, and active Projects instead of manufacturing urgency.

### 5.2 Focused state

After the member expresses an intent, the home becomes a focused work surface:

- conversation stays visible;
- relevant sources remain inspectable;
- the current work object stays anchored to the turn that created it;
- the user can continue, revise, confirm, open the canonical page, or stop;
- completed work leaves a concise outcome and follow-up state.

Conversation history supports continuity but does not become the dominant
navigation model.

## 6. Generative Work Objects

### 6.1 Contract

A Brain turn returns one primary result type:

`ANSWER | NAVIGATE | ARTIFACT | CAPABILITY`

- `ANSWER`: source-bearing facts, inference, recommendation, or limitation.
- `NAVIGATE`: an authorized destination with explanation and preserved context.
- `ARTIFACT`: a durable draft, preview, evidence bundle, or follow-up object.
- `CAPABILITY`: a typed operation invocation with the required authority state.

An artifact has:

- stable identity and version;
- organization and owner scope;
- artifact type and typed payload;
- source references and page context;
- lifecycle state;
- linked capability and command operation, when applicable;
- expiry and supersession information;
- result and follow-up links.

### 6.2 Lifecycle

The common lifecycle is:

`DRAFT -> NEEDS_INPUT -> PREVIEW -> PROCESS_REQUIRED or CONFIRMABLE -> EXECUTING
-> EXECUTED -> FOLLOW_UP`

Terminal alternatives include `CANCELLED`, `EXPIRED`, `REJECTED`, and `FAILED`.
Failure preserves the draft and explains the retry boundary.

### 6.3 Initial artifact families

- Tension draft and submitted Tension
- Meeting preparation, creation, and start
- Tactical proposal and accepted tactical outcome
- Governance proposal and IDM objection-validation workbench
- Goal proposal, revision, Target evidence, and check-in
- Meeting notes and closure summary
- Project and Action proposal or follow-up
- Memory candidate and source-authority review

Artifacts render inline at the triggering turn. They are not collected as an
unrelated card stack above the conversation.

## 7. Typed Capability Registry

### 7.1 Capability declaration

Every Brain capability declares:

- stable name and semantic version;
- input, preview, result, and error schemas;
- authorized read resources;
- actor and object permission resolver;
- confirmation requirement;
- strategic, tactical, or governance process gate;
- canonical domain handler;
- idempotency and replay behavior;
- audit event contract;
- supported artifact renderer;
- fallback behavior when the model is unavailable.

The Brain never receives a universal database-write capability and never
operates the UI by clicking DOM elements.

### 7.2 Authority levels

- **L0: Read, explain, navigate.** Execute directly with source visibility.
- **L1: Private draft.** Create automatically in the member's private scope.
- **L2: Confirmable organization operation.** Show a preview, then require fresh
  authorization from the legitimate actor before execution.
- **L3: Process-bound operation.** Advance only through the applicable meeting
  or strategic process. A proposer may confirm final execution after that legal
  process grants the authority.
- **Forbidden.** Cross-tenant access, hidden scope escalation, direct structure
  mutation, process bypass, unrestricted SQL writes, and destructive history
  deletion.

M6 ships core built-in capabilities only. It reserves a versioned plugin
extension contract but does not enable organization-authored write capabilities.

## 8. Distributed Decision and Meeting Semantics

The Brain must preserve these rules in UI text, capability gates, and domain
handlers:

- A Tension proposer authors a tactical or governance proposal.
- The proposal is processed by the appropriate meeting flow.
- Governance is used only when organization operating structure changes.
- Work that does not modify structure belongs in tactical operation.
- A valid governance objection must show that adopting the proposal would cause
  material harm or regression.
- The coach guides objection testing: fact versus worry, current harm versus
  speculation, reversibility, and safe-to-try scope.
- The Brain may summarize or ask the process questions; it does not judge the
  objection or decide the proposal.
- After a legal tactical or governance process, the proposer may confirm the
  authorized final execution.
- An assigned owner who disagrees may raise a new Tension and proposal. The
  system does not silently transfer decision authority to a Circle lead.

## 9. Visual and Interaction System

### 9.1 Direction

The approved direction is a future command center, implemented through real
organizational signal rather than decorative science-fiction effects.

The visual language uses:

- precise grids and stable spatial hierarchy;
- visible live state, event flow, topology, and timelines;
- execution previews and before/after diffs;
- restrained, short motion only when state changes;
- dense but readable operational typography;
- clear source, permission, and process-status affordances.

It must not use purple gradients, glowing orbs, particle backgrounds, decorative
AI animations, or generic chatbot bubbles as the main product identity.

### 9.2 Palette and theming

The system follows the operating-system theme. Dark and light modes are both
first-class and preserve the same hierarchy and semantic colors.

- carbon and near-white provide structure;
- signal green indicates healthy or executed state;
- electric cyan indicates active sensing or linked context;
- amber indicates attention or pending process;
- red indicates denial, failure, or material risk;
- warm white is reserved for focused editing surfaces in light mode.

Color never carries the only state cue. Every status also has text and icon
semantics.

## 10. Proactivity, Memory, and Watches

### 10.1 Bounded autonomy

The Brain may automatically:

- read authorized data;
- reconcile deterministic signals;
- summarize changes;
- produce private briefs and drafts;
- run a previously confirmed Watch;
- send private reminders inside LoopOS.

It may not automatically change confirmed organization facts or advance a
process-bound decision.

### 10.2 Memory layers

- **Conversation memory:** private continuity for the current user.
- **Private work memory:** private drafts, preferences, watches, and unfinished
  work.
- **Confirmed organizational memory:** source-authorized shared knowledge with
  provenance, validity, and supersession.

Model-detected patterns are memory candidates, never confirmed facts. They enter
organizational memory only through the authority of the source domain.

### 10.3 Brain Watches

Initial Watch patterns include:

- Goal evidence becoming stale or contradictory;
- repeated or unresolved Tensions;
- meeting output without Project, Action, or follow-up;
- weekly Role-specific operating brief;
- active Project or Action drift;
- missing child-Circle Goal alignment.

A Watch is confirmed once, then runs autonomously within its declared read scope
and schedule. The user can inspect why it ran, snooze it, disable it, or report a
bad signal. Repeated equivalent signals are deduplicated.

Deterministic detectors and scheduled jobs continue when the model is
unavailable. Model explanation may be delayed without losing the underlying
signal.

## 11. Trust, Confirmation, and Degradation

### 11.1 Confirmation matrix

- Authorized reads and navigation: direct.
- Private briefs and drafts: automatic.
- Watches: one explicit setup confirmation, then bounded autonomous runs.
- Organization writes: preview plus fresh authorization every time.
- Tactical, strategic, and governance actions: applicable legal process.

At confirmation time the system re-resolves actor, tenant, object, and process
state. Stale previews expire. Idempotency prevents duplicate effects.

### 11.2 Visible audit trail

The user can inspect:

`request -> sources -> proposed plan -> required authority -> confirmer -> domain
result -> follow-up`

The product does not expose hidden chain-of-thought. It exposes evidence,
structured plans, policy decisions, and execution facts. Denials must not reveal
the existence of unauthorized records.

### 11.3 Degradation

- If the selected model is unavailable, traditional pages, deterministic
  signals, confirmed memory, source links, and registered domain operations stay
  available.
- If the dynamic read path is unavailable, the Brain does not fabricate current
  state. It may use timestamped confirmed memory and clearly label its age.
- If a command fails, its draft and preview remain recoverable and the ledger
  records the failure.
- If the Brain-first home is disabled for an organization canary, `/app` falls
  back to the legacy Workspace and the Brain remains reachable separately.

## 12. Technical Architecture

### 12.1 Runtime layers

1. **Brain-first UI:** home, contextual launcher, conversation, sources, and
   inline artifact renderers.
2. **Context compiler:** actor, organization, Roles, current route, object, Goal,
   meeting, and recent-work context.
3. **Brain orchestrator:** intent interpretation and `ANSWER | NAVIGATE |
   ARTIFACT | CAPABILITY` result selection.
4. **Permission-aware query broker:** existing dedicated-reader, fixed-resource,
   provenance-bearing dynamic read path.
5. **Typed capability registry:** declarative authority and schema boundary.
6. **Memory service:** private continuity, candidates, and confirmed shared
   memory.
7. **Artifact service:** durable generated work objects and lifecycle.
8. **Command preview ledger:** existing preview, confirmation, idempotency, and
   audit boundary.
9. **Shared domain operations:** Goal, Tension, tactical, governance, meeting,
   Project, Action, notes, and memory handlers used by both UI modes.
10. **Perception service and worker:** event ingestion plus scheduled
    reconciliation.
11. **Signals and Watches:** deterministic detection, deduplication, private
    delivery, and optional model explanation.

### 12.2 Perception model

M6 uses a hybrid of domain events and periodic reconciliation:

- canonical mutations emit compact organization events after successful domain
  transactions;
- the worker evaluates affected Watches and signal rules;
- scheduled reconciliation repairs missed events and detects time-based drift;
- signal state provides deduplication and recovery;
- model reasoning is downstream of deterministic scope and evidence selection.

This design avoids making the model or event delivery a single point of truth.

### 12.3 Reuse before addition

M6 reuses the existing:

- Actor Context and Brain read views;
- query plan, evidence packet, and query audit;
- command registry and operation ledger;
- memory candidate and confirmed-memory retrieval flow;
- Goal, Tension, tactical outcome, and meeting-note services;
- governance IDM operations and meeting workbench;
- application worker and organization model settings.

Meeting creation and start, governance IDM, Goal process operations, Projects,
and Actions must be exposed as shared domain operations before the Brain calls
them. Page-only Prisma mutations are not registered as capabilities.

## 13. Minimum Persistence Additions

M6 may add only these general-purpose persistence concepts unless a reviewed
slice proves another one is necessary:

- `BrainArtifact`: durable owner-scoped work object and lifecycle.
- `BrainWatch`: confirmed private proactive instruction and read scope.
- `BrainWatchRun`: execution, evidence, delivery, and failure record.
- `BrainSignalState`: detector identity, deduplication key, state, and latest
  evidence.

Page context and temporary model reasoning are not persisted as organization
facts.

## 14. Milestones

### M6-0 - Production prerequisite and M5-B closure

Outcome:
- Production dynamic reads use a dedicated, non-login, non-inheriting Brain
  reader path and the readiness verifier passes.

Scope:
- Resolve the unrelated database ACL boundary without broadening LoopOS access.
- Configure `BRAIN_DATABASE_URL` through the approved secret path.
- Run boundary, readiness, authenticated Brain, cleanup, and recovery checks.
- Re-audit M5-B state.

Decision:
- Product owner moved real-team longitudinal evidence from M5-B to M6-6.
- M5-B closes only after the reader gate passes; the longitudinal gate is
  deferred, not falsely marked complete.

### M6-1 - Brain-first shell

Outcome:
- `/app` is a useful Brain home; legacy dashboard content is available at
  `/app/workspace`; all four operational entries remain one click away.

Scope:
- Route migration, identity-home entry, contextual launcher, system theme,
  default/focused/empty/loading/error states, and canary fallback.

### M6-2 - Generative artifact foundation

Outcome:
- Existing six Brain commands render and progress as inline durable artifacts.

Scope:
- Artifact persistence and service, lifecycle, renderer registry, source and
  authority surfaces, and current command-ledger integration.

### M6-3 - Navigation and meeting operations

Outcome:
- A member can ask the Brain to locate organization facts, open the right page,
  prepare a meeting, and create or start a permitted meeting.

Scope:
- Context compiler, navigation catalog, meeting shared domain operations, typed
  capabilities, and page/Brain parity tests.

### M6-4 - Governance, Goal, and execution loop

Outcome:
- The Brain can guide governance IDM and Goal work without deciding for people
  or bypassing meeting authority, then connect accepted outcomes to Projects,
  Actions, notes, and follow-up.

Scope:
- Governance artifact renderer, objection testing, Goal process capability,
  Project/Action shared operations, and proposer final confirmation after legal
  process.

### M6-5 - Watches and continuous perception

Outcome:
- Members receive useful private organization sensing that is inspectable,
  deduplicated, controllable, and resilient to model failure.

Scope:
- Watch, run, and signal persistence; event hooks; scheduled reconciliation;
  private delivery; snooze/disable/feedback; and worker recovery.

### M6-6 - Canary and real-team acceptance

Outcome:
- One real team uses Brain-first LoopOS for a complete weekly Goal-to-Tension-to-
  decision-to-follow-up rhythm with no authority bypass or unresolved critical
  usability failure.

Scope:
- Organization-level canary, production recovery drill, longitudinal evidence,
  user observation, independent implementation review, and roadmap audit.

## 15. Acceptance Evidence

M6 is complete only when evidence proves all of the following:

- `/app` is the Brain-first home in desktop and mobile browser viewports.
- Workspace, Goals, Meetings, and Organization remain one-click destinations.
- A member can complete representative Tension, meeting, tactical, governance,
  Goal, Project/Action, note, and memory workflows through the Brain.
- The equivalent traditional-page workflows still work and reach the same
  domain operations.
- Sources, fact age, permission, preview, confirmer, process state, execution,
  and follow-up are inspectable.
- Unauthorized reads and writes fail without record-existence leakage.
- Governance and tactical flows preserve distributed decision authority.
- Proposer final execution works only after a legal process grants it.
- Watches deduplicate, can be disabled, recover after worker interruption, and
  preserve deterministic signal behavior during model outage.
- Brain Reader isolation and mutation denial pass in production.
- Canary rollback returns the organization to the legacy Workspace without data
  loss.
- A real team completes one longitudinal weekly operating loop and the
  independent M6 review and roadmap audit both pass.

Static, database, browser, production, and longitudinal evidence remain separate
classes. Passing one class never implies another.

## 16. Rollout and Recovery

- Enable Brain-first home per organization canary, not globally in one switch.
- Keep `/app/workspace` and the traditional module routes stable throughout M6.
- Make artifact and Watch migrations additive and reversible before retained
  rows exist; define archive behavior before non-empty rollback is needed.
- Ship deterministic and traditional-page fallbacks before enabling proactive
  model behavior.
- Preserve command ledger and audit history across UI rollback.
- Use local builds and the existing bounded Aliyun release process.

## 17. Explicit Non-goals

M6 does not include:

- arbitrary SQL or universal database writes;
- model-driven DOM or browser automation;
- organization-authored write plugins;
- a public plugin marketplace;
- semantic or vector retrieval as a prerequisite;
- global social feeds or broad notification systems;
- autonomous governance, Goal changes, responsibility assignment, or work
  closure;
- centralized administrator approval replacing source authority;
- chain-of-thought display;
- unrelated new domain logic.

## 18. Sequencing Decision

Only one milestone is active at a time.

1. Keep V5-M5-B active until the dedicated production Brain Reader is proven.
2. Record real-team longitudinal evidence as deferred to M6-6 by explicit
   product-owner decision.
3. Close M5-B through an independent state audit after reader evidence passes.
4. Activate M6-1 only after M6-0 is accepted.
5. After each M6 milestone, run focused implementation review, browser or
   database evidence as applicable, independent roadmap audit, and only then
   activate the next milestone.
