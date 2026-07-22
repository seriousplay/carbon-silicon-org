# G3-I2C-GD1 Governance Decision and Typed Structure Application Design

Date: 2026-07-11
Status: product-owner approved; implementation inactive
Milestone: G3-I2C-GD1

## 1. Outcome

GD1 closes the governance half of the tension-driven operating rhythm for precisely routed generic governance candidates.

The original tension proposer authors the proposal and every later revision, even if they no longer participate in the selected meeting; authorship comes from immutable proposal and route provenance and is never transferred. The governance meeting process authorizes the result. Only an actual current participant in that exact meeting, including the proposer when they currently participate, may record a clarification request, objection or assessment, adoption, non-adoption, or other process result. A successful adopted result creates exactly one unassigned `HOME` role in one allowed same-organization circle, records complete provenance, and resolves the source tension in one serializable transaction. Clarification, unresolved or valid objection, explicit non-adoption, denied direct POSTs, and failed pre-commit application attempts create zero structure writes.

This design keeps LoopOS lightweight for a real team. It does not introduce a centralized approver, an administrator override, a coach veto, or runtime decision authority.

## 2. Mission

GD1 must provide one browser-verifiable loop:

1. A precisely routed generic `GovernanceProposal(status = "CANDIDATE")` enters its selected governance meeting.
2. The proposer supplies a complete immutable revision containing both the narrative proposal and the typed `ROLE_CREATED` payload.
3. The meeting process may request clarification, test an objection, request amendment, explicitly decline adoption, or authorize adoption.
4. Any actual current participant in the selected meeting may record the process result; recorder identity is not decision authority.
5. Only a validly adopted, current immutable revision reaches the typed mutation boundary.
6. Successful adoption creates one role, one decision, one change log, one result artifact, append-only events, and one source-tension resolution atomically.
7. Later observation or disagreement creates a new tension. The system never silently rolls back the adopted role.

## 3. Non-Goals

GD1 does not:

- implement role modification, archival, assignment, reassignment, home-circle changes, circle changes, policies, domains/authorities as standalone mutations, accountabilities-only mutations, or interface-relationship mutations;
- implement more than one executable structure category;
- change the pilot weekly governance rollup or migrate `InterfaceValidationRun`;
- implement I2C-3 attachment or AI nodes, or configure the second interface;
- give AI, runtime, coach, administrator, circle lead, affected role holder, or recorder title independent adoption or objection-validity authority;
- require the recorder to differ from the proposer;
- add a post-adoption acknowledgement or veto workflow;
- add notifications or an outbox;
- broadly rewrite the legacy governance engine or current structure CRUD;
- automatically reverse an already-created organizational artifact;
- turn technical application failure into non-adoption;
- decide whether two role names are organizationally equivalent or introduce a new role-name uniqueness policy.

## 4. Approved Product Decisions

All architecture-changing product policies are locked.

1. **One proposal identity, immutable revisions.** One precisely routed `GovernanceProposal` identity survives clarification, amendment, and revision-level non-adoption while its source tension remains `OPEN`. Revisions increase monotonically and are immutable. A new proposal identity is reserved for a genuinely new tension.
2. **One typed mutation only.** GD1 can create one unassigned `HOME` role in one same-organization circle whose status is `NORMAL` or `WARNING`. `HALTED`, `ARCHIVED`, role modification, archival, assignment/reassignment, and every other structure category are deferred or denied.
3. **Projection plus immutable history.** Add one `GovernanceDecisionProcess` current-state projection and append-only immutable proposal revisions/events. Leave legacy `GovernanceProposal` semantics compatible.
4. **Valid objection is a real gate.** A meeting-process-confirmed valid objection blocks adoption until the proposer authors an amended immutable revision or the meeting process records explicit non-adoption. No structure write occurs while the objection is unresolved.
5. **Non-adoption is terminal for one revision, not the open-tension process identity.** Explicit non-adoption permanently ends the current revision/result, keeps the source tension `OPEN`, and creates zero structure or tension-resolution writes. The original proposer may later author one new complete immutable revision on the same precisely routed proposal identity, preserving the non-adopted result in history and returning the projection to `READY` without creating a new proposal, route, outcome, or structure write.
6. **Clarification requires a complete revision.** Clarification blocks adoption until the proposer authors a clarified immutable revision containing the complete narrative and typed role payload.
7. **Invalid objection returns the same revision.** An invalid objection stays in immutable history, returns the unchanged revision to adoption-ready, and never forces amendment or triggers automatic adoption.
8. **Technical failure is retryable, not governance.** A durable immutable operation claim precedes application. A failed pre-commit adopted-result transaction rolls back all application effects, keeps the immutable revision adoption-ready, marks the same operation failed in a mandatory recovery transaction, and retries only with the same payload-bound idempotency key. An expired processing lease is reclaimable only with that key if failure marking itself did not persist. Technical failure never becomes non-adoption.
9. **Successful adoption resolves the source tension.** Adopted role creation resolves the source tension in the same atomic transaction. Later observation or disagreement creates a new tension.

## 5. Prior Governance Contract Preserved

### 5.1 Distributed authority

- The tension raiser is the original proposal author and the only person who may author revision 1 or any clarification, amendment, or post-non-adoption revision. This authority comes from immutable proposal/route provenance, does not require current meeting participation, and cannot be transferred.
- The selected governance meeting process authorizes adoption, non-adoption, clarification, and objection validity.
- Only an actual current participant in the selected governance meeting may record a clarification request, objection, objection assessment, adoption, non-adoption, or other process result. The proposer may record a result only while they are also a current participant.
- Recording is an administrative act backed by meeting-process authority, not personal approval authority.
- Coach, administrator, circle lead, affected role holder, interface support, or title identity has no override. If that person is an actual current participant, they have exactly the same process-recording authority as every other current participant.
- Runtime and AI may persist, route, display, prompt, and trace. They may not author the proposal, validate the objection, authorize adoption, or invoke a structure mutation independently.
- A person who disagrees after adoption raises a new tension and follows the same distributed process.

### 5.2 Valid-objection contract

A valid objection asserts that adopting the current immutable revision would cause material organizational harm or regression. The process tests four things:

1. **Material harm or regression:** what organizational capability, accountability, authority boundary, or operating result would materially worsen?
2. **Fact versus worry:** which statements are observed facts or supported causal evidence, and which are predictions, uncertainty, or preference?
3. **Reversibility:** can the harm be detected and reversed before it becomes material?
4. **Safe to try:** is the proposal safe enough to try within a bounded period, or does the claimed harm remain material despite mitigation and reversibility?

The coach may guide these questions and keep the process valid. The software may require structured answers. Neither coach nor software decides validity. The meeting process decides; an actual current participant records the result.

## 6. Current-State and Source Map

| Current source | Current responsibility | GD1 decision |
|---|---|---|
| `prisma/schema.prisma` — `GovernanceProposal` | Generic candidate identity, source tension, selected meeting, free-text JSON, legacy string status, optional decision | Reuse identity and relation; do not overload it with the GD1 state machine or revision history. Add compatible reverse relations only. |
| `prisma/schema.prisma` — `DecisionRecord` | Durable governance decision and meeting relation | Reuse for successful adoption; meeting is the authority source. Do not model the recorder as a sole decision maker. |
| `prisma/schema.prisma` — `ChangeLog` | Before/after structural audit tied to a decision | Reuse for the single role creation; proposer is the change initiator, while the process projection records the result recorder. |
| `prisma/schema.prisma` — `InterfaceWorkflowRunEvent` | Ordered append-only runtime history | Reuse for process and application events. The existing database trigger already rejects update/delete. |
| `prisma/schema.prisma` — `InterfaceWorkflowArtifact` | Durable links from a run to generated organizational artifacts | Reuse; add a `ROLE` artifact type for the created role and exact application provenance. |
| `prisma/schema.prisma` — `InterfaceWorkflowCommand` | Runtime node commands, five-minute lease, retry, and idempotency | Do not reuse as the meeting decision command. The routed workflow may already have advanced past the routing node, and runtime must not own the governance result. |
| `src/lib/domain-operations.ts` — `resolveGovernanceCandidateArtifact` | Verifies candidate artifact, successful command, proposer, source tension, and exact candidate payload | Reuse and extract a transaction-compatible exact candidate/route resolver that can also verify terminal replay after `status` is no longer `CANDIDATE`. |
| `src/lib/domain-operations.ts` — `authorizeGovernanceRouteReplay` | Verifies selected governance meeting, route command, actor, revision, artifact suffixes, and metadata | Reuse as the provenance basis; do not duplicate its validation in UI code. |
| `src/lib/domain-operations.ts` — `resolveGovernanceCandidatesRoutedToMeeting` | Produces only exactly routed generic candidates for a governance meeting | Reuse for meeting visibility and process initialization. |
| `src/lib/governance-engine.ts` — `adoptProposal` | Legacy untyped JSON switch that creates structure, `DecisionRecord`, `ChangeLog`, proposal adoption, and tension resolution | Do not call for GD1. Extract only narrowly useful typed write mechanics, or leave it entirely legacy. Its current authority and validation model is incompatible with GD1. |
| `src/app/app/meetings/[id]/proposal-actions.ts` | Legacy create/adopt/object Server Actions | Preserve legacy behavior for valid legacy proposals, but harden all three direct-POST boundaries so generic candidates and runtime-raised tensions cannot bypass GD1. |
| `src/app/app/meetings/[id]/governance-workbench.tsx` | Legacy proposal controls plus read-only generic candidate card | Extend only the generic candidate card into the GD1 process UI. Keep legacy cards separate. |
| `src/app/app/meetings/[id]/page.tsx` | Tenant-scoped meeting, participants, proposals, and exact generic route projection | Reuse the page and pass exact process/current-person authority data to the workbench. |
| `src/app/app/meetings/[id]/tactical-outcome-authority.ts` | Proven payload-bound authority envelope and exact replay pattern | Reuse the design pattern, not the tactical-specific types. Do not refactor accepted tactical behavior merely to create a shared abstraction. |
| `src/app/app/meetings/[id]/tactical-outcome-actions.ts` | Proven proposer authorship, participant result recording, serializable claim, append-only event, atomic artifact/outcome write | Reuse transaction and test patterns. Do not make tactical proposal code a dependency of governance code. |
| `src/app/app/interfaces/runs/[runId]/page.tsx` | Verifies artifacts against domain state before displaying them | Extend verification for the GD1 `ROLE` result artifact and terminal proposal/process state. |
| `src/app/app/interfaces/runs/[runId]/run-workspace.tsx` | Displays runtime history, retries, and verified artifacts | Extend labels/summaries for governance decision and role application events; no governance controls belong here. |
| `src/app/app/governance/page.tsx` | Displays decisions and change logs | Extend trace display so meeting authority, proposer, recorder, proposal, change, and role are not collapsed into one “decision maker.” |
| `src/app/app/circles/[id]/roles/actions.ts` | Direct role creation form | Do not call from GD1 because it contains session/redirect/UI concerns and is not transaction-compatible. Reuse the `RoleDef` field contract only. |

## 7. Reuse Versus Extraction

### Reuse unchanged

- `GovernanceProposal` identity, source-tension relation, selected meeting, and decision link.
- Exact governance candidate and route artifacts.
- Meeting participants as the only process-authority membership source.
- `DecisionRecord`, `ChangeLog`, `RoleDef`, `Tension`, workflow run, append-only workflow events, and artifact links.
- Existing Data -> Pretraining pilot behavior and weekly governance route.
- Existing session-to-organization/person resolution.

### Extract narrowly

Add a transaction-compatible resolver in `src/lib/domain-operations.ts`, tentatively named `resolveRoutedGovernanceCandidateForDecision`. It must return a verified immutable context:

```ts
type RoutedGovernanceCandidateForDecision = {
  organizationId: string;
  proposalId: string;
  tensionId: string;
  proposerId: string;
  meetingId: string;
  runId: string;
  proposalArtifactId: string;
  routeArtifactId: string;
  sourceTensionArtifactId: string;
  candidateCommandId: string;
  routeCommandId: string;
  candidateRevision: number;
};
```

The resolver must validate exact relation suffixes, metadata equality, command identity, node/visit, run, tenant, source tension, proposer, candidate payload, meeting type, and route artifact. It must support:

- initialization while `GovernanceProposal.status = "CANDIDATE"`;
- nonterminal process actions;
- exact terminal replay after proposal status changes, using the immutable process/revision provenance rather than weakening candidate verification.

### Add, do not generalize prematurely

Create a governance-specific domain service in `src/lib/governance-decision.ts`. It owns state transitions, authorization, typed validation, serializable transactions, idempotency, and append-only events. It must not import session, Next.js, redirects, revalidation, UI modules, or runtime engine code.

Do not refactor `tactical-outcome-authority.ts` in GD1. A later cleanup may extract a shared payload-binding primitive after both flows have production evidence.

## 8. Architecture and Components

```text
Selected governance meeting page
  -> authenticated GD1 Server Action
  -> transaction-compatible exact route resolver
  -> GovernanceDecisionProcess service
       -> immutable GovernanceProposalRevision
       -> append-only InterfaceWorkflowRunEvent
       -> typed ROLE_CREATED mutation adapter
       -> DecisionRecord + ChangeLog
       -> ROLE InterfaceWorkflowArtifact
       -> source Tension transition
  -> meeting / run / governance read projections
```

### 8.1 Server Actions

`src/app/app/meetings/[id]/governance-decision-actions.ts` is a thin adapter. Each action:

1. resolves current organization and person;
2. parses bounded form input;
3. passes actor, meeting, proposal/process, expected revision, mutation key, and payload to the domain service;
4. maps typed domain errors to stable user messages;
5. revalidates only relevant meeting, tension, run, role, circle, and governance pages after success.

No action performs an authorization-only check followed by an unguarded write. Operation-specific authorization is authoritative inside the claim/replay transaction before any operation row or logical slot can be inserted or reclaimed, and application authorization repeats inside the serializable application transaction.

### 8.2 Governance decision service

The service exposes transaction-compatible operations with tentative names:

- `initializeGovernanceDecisionProcess`;
- `submitGovernanceProposalRevision`;
- `requestGovernanceClarification`;
- `raiseGovernanceObjection`;
- `recordGovernanceObjectionAssessment`;
- `recordGovernanceNonAdoption`;
- `adoptGovernanceRoleCreation`.

Every writing operation is tenant-scoped, route-scoped, revision-scoped, payload-bound, durably claimed in the immutable operation ledger, and idempotent. At the start of the claim/replay transaction, before any ledger insertion, reservation, or reclaim, the service validates tenant, exact proposal/route/meeting provenance, operation-specific actor authority, operation, and canonical payload. A fresh claim or reclaim additionally validates current process state and revision before changing the ledger. A successful historical replay instead verifies the exact immutable historical state/revision binding after current actor authorization and may then ignore current-revision equality. Revision-authoring operations authorize only the immutable original proposer and do not require current meeting participation. Clarification, objection/assessment, adoption, non-adoption, and every other process-result operation require the recorder to be an actual current participant inside the authoritative transaction. Unauthorized, forged, stale, or mismatched requests leave every domain table and the operation ledger unchanged.

### 8.3 Typed mutation adapter

The adapter accepts only the canonical `ROLE_CREATED` payload and a verified adoption authorization. It creates the role through a supplied Prisma transaction client. It never imports current-user state and cannot be called with another structure operation.

### 8.4 Read projections

- Meeting page: process controls, immutable revision, objection/clarification history, result, and created role link.
- Run page: proposal, exact meeting route, process events, retry record, and verified role artifact.
- Governance page: meeting-authorized decision, proposer, recorder, role, before/after change, source tension, and run provenance.
- Existing role and circle pages show the created role through current relations; no separate assignment UI is added.

## 9. Persistence Design

### 9.1 GovernanceDecisionProcess current-state projection

One process row exists per generic governance proposal.

Recommended fields:

```text
GovernanceDecisionProcess
  id
  organizationId
  proposalId                 unique
  sourceTensionId
  runId
  meetingId
  sourceTensionArtifactId
  proposalArtifactId
  routeArtifactId
  proposerId
  state                      GovernanceDecisionProcessState
  currentRevision            integer >= 1
  currentRevisionId           nullable during initialization; required at commit
  activeClarification        nullable JSON
  activeObjection            nullable JSON
  activeObjectionSequence    nullable
  recordedById               nullable
  recordedAt                 nullable
  resultNote                 nullable
  outcomeRoleId              nullable unique
  decisionId                 nullable unique
  changeLogId                nullable unique
  applicationAttempts        integer >= 0
  lastApplicationError       nullable bounded code
  createdAt
  updatedAt
```

`currentRevisionId` is nullable in the Prisma model solely to make initialization executable. It is not nullable in any committed process state. Initialization is one Prisma interactive transaction with this order:

1. insert the process with `currentRevisionId = NULL` and `currentRevision = 1`;
2. insert revision 1 with the required `processId`;
3. update the process to that revision's ID;
4. commit only after all route, proposer, payload, and operation-claim checks pass.

Migration SQL installs a PostgreSQL `DEFERRABLE INITIALLY DEFERRED` constraint trigger on process insert and on changes to `currentRevisionId`, `currentRevision`, `proposalId`, or `organizationId`. At commit it rejects a null current revision, a missing revision, or a revision whose organization, process, proposal, or revision number does not exactly match the process row. The ordinary nullable foreign key rejects a non-null missing ID immediately, revision immutability prevents later removal, and the deferred trigger makes it impossible to commit an incomplete process while avoiding the required-FK insertion cycle.

Required constraints:

- unique `proposalId`, plus composite tenant ownership on every relation;
- exact composite foreign keys to proposal, source tension, run, meeting, source/proposal/route artifacts, proposer, current revision, recorder, role, decision, and change log;
- current revision is positive and the deferred commit constraint requires an exact non-null `currentRevisionId` match;
- `CLARIFICATION_REQUIRED` has one bounded structured `activeClarification`; every other state has none;
- `OBJECTION_PENDING` and `AMENDMENT_REQUIRED` have one revision-bound structured `activeObjection` and sequence; `READY` clears the active projection only after preserving the objection and assessment in immutable events;
- nonterminal states have no role/decision/change-log outcome;
- `NOT_ADOPTED` has recorder/time/note for the current revision and no role/decision/change-log outcome; a later proposer revision clears only this current-result projection after immutable history has been preserved;
- `ADOPTED` has recorder/time, role, decision, and change log;
- `applicationAttempts` cannot decrease;
- the process cannot change proposal, run, meeting, artifact, source tension, proposer, or organization after creation.

### 9.2 Immutable operation ledger

`GovernanceDecisionOperation` is the database-unique source of idempotency and recovery for every writing operation. No overwriteable last-operation fields exist on the process.

```text
GovernanceDecisionOperation
  id
  organizationId
  proposalId
  processId                  nullable only for initialization claim
  meetingId
  actorId
  revision                   exact source or target revision
  operation                  bounded operation enum
  operationScope             stable logical slot/sequence
  mutationKey                unique
  canonicalPayloadHash
  status                     PROCESSING | FAILED | SUCCEEDED
  attempt                    integer >= 1
  leaseToken
  leaseExpiresAt
  failureCode                nullable bounded code
  resultEnvelope             nullable immutable JSON
  createdAt
  updatedAt
```

Required invariants:

- no operation row or logical slot may be inserted, reserved, or reclaimed until operation-specific authorization and new-claim state/revision/payload validation succeed inside the same claim/replay transaction;
- the database uniquely owns every `mutationKey` forever; operation rows and historical keys are never deleted, reused, or overwritten;
- organization, proposal, process ID or explicit initialization null, meeting, actor, revision, operation, operation scope, mutation key, and canonical payload hash are immutable and protected by a database trigger;
- a unique logical-slot constraint on `(organizationId, proposalId, meetingId, revision, operation, operationScope)` binds one operation slot to its first key, so a fresh-key retry conflicts even if the first attempt is `FAILED` or its `PROCESSING` lease expired;
- same key plus any changed bound field or canonical payload hash is a stable conflict, never a replay;
- only lease ownership permits `PROCESSING` application or status finalization; reclaim rotates the lease token and increments `attempt` atomically;
- allowed status transitions are `PROCESSING -> SUCCEEDED`, `PROCESSING -> FAILED`, and same-key `FAILED -> PROCESSING`; an expired `PROCESSING` row is reclaimed in place with the same key, rotated lease token, and incremented attempt;
- `SUCCEEDED` requires an immutable result envelope; `FAILED` requires a bounded failure code; neither can be reclaimed with a fresh key;
- initialization operations bind revision 1 and the precisely routed proposal identity before the process exists, so the durable claim does not depend on inserting the process first;
- append-only process events remain the human-readable audit; this ledger is the authoritative claim, replay, conflict, lease, and recovery record.

### 9.3 Immutable proposal revisions

`GovernanceProposalRevision` stores the complete authoritative proposal basis for each revision:

```text
GovernanceProposalRevision
  id
  organizationId
  processId
  proposalId
  revision                   integer >= 1
  authoredById               proposer
  currentStructure
  proposedStructure
  rationale
  expectedImpact
  typedChange                canonical JSON
  sourceKind                 INITIAL | CLARIFICATION | AMENDMENT
  createdAt
```

Required invariants:

- unique `(processId, revision)` and `(proposalId, revision)`;
- revisions increase by exactly one under the locked process row;
- only the original proposer may author a revision;
- original-proposer authority is resolved from immutable proposal and route provenance and survives departure from the current meeting; no author transfer is allowed;
- a revision is a full snapshot, never a partial patch;
- update and delete are rejected by a database trigger;
- `GovernanceProposal.proposedChange` may mirror the current narrative for compatibility, but the immutable revision is authoritative for GD1 adoption;
- the revision payload must canonicalize to the payload hash stored in its immutable operation row.

### 9.4 Append-only process events

Reuse `InterfaceWorkflowRunEvent`; append events in the process run with exact proposal/process/revision/meeting references. Event types:

- `GOVERNANCE_PROCESS_INITIALIZED`;
- `GOVERNANCE_REVISION_AUTHORED`;
- `GOVERNANCE_CLARIFICATION_REQUESTED`;
- `GOVERNANCE_OBJECTION_RAISED`;
- `GOVERNANCE_OBJECTION_ASSESSED`;
- `GOVERNANCE_NON_ADOPTION_RECORDED`;
- `GOVERNANCE_ADOPTION_RECORDED`;
- `GOVERNANCE_STRUCTURE_APPLIED`;
- `COMMAND_FAILED` for a sanitized, retryable technical failure;
- `ARTIFACT_CREATED` for the result role link.

Each event payload includes `schemaVersion`, `processId`, `proposalId`, `revision`, `meetingId`, and action-specific fields. Objection events contain the material-harm statement, fact-versus-worry analysis, reversibility analysis, safe-to-try analysis, objector, assessor/recorder, and validity result. Events never contain mutable authorization shortcuts.

The existing run-event append-only trigger is reused. Event sequence allocation occurs while the run row is locked.

### 9.5 Result artifact

Add `ROLE` to `InterfaceWorkflowArtifactType`. Successful adoption creates one artifact:

```text
artifactType: ROLE
artifactId: created RoleDef.id
relation: governance-application:<processId>
metadata:
  schemaVersion
  processId
  proposalId
  revision
  meetingId
  proposerId
  recordedById
  runId
  sourceTensionArtifactId
  proposalArtifactId
  routeArtifactId
  decisionId
  changeLogId
  roleId
```

The run page renders the artifact only after verifying all metadata against the process, adopted revision, role, decision, change log, meeting, and exact route.

## 10. ROLE_CREATED Typed Contract

The only executable payload is:

```ts
type GovernanceRoleCreatedPayloadV1 = {
  schemaVersion: 1;
  operation: "ROLE_CREATED";
  circleId: string;
  name: string;
  purpose: string;
  domain: string | null;
  accountabilities: string;
  category: RoleCategory;
  ownershipType: "HOME";
};
```

Validation rules:

- `operation` is exactly `ROLE_CREATED`; no compatibility alias is accepted.
- `ownershipType` is exactly `HOME` and is also fixed server-side.
- `circleId` resolves to one same-organization circle whose current `CircleStatus` is exactly `NORMAL` or `WARNING`, both at revision authoring and again inside adoption. `HALTED` and `ARCHIVED` are denied.
- `name`, `purpose`, and `accountabilities` are trimmed, non-empty, and bounded by explicit UTF-8 byte limits.
- `domain` is null or a bounded trimmed string.
- `category` is one current `RoleCategory` enum value.
- no assignee, lead, contract, support relation, cross-cutting relation, action, project, interface, person reassignment, or home-circle change is accepted.
- adoption writes no fields not present in this contract except database-generated identity/timestamps and the fixed `ACTIVE`/`HOME` defaults.
- canonical JSON uses stable key ordering and explicit nulls before hashing.
- the system introduces no additional role-name uniqueness rule beyond the existing schema.

The revision contains the complete narrative fields (`currentStructure`, `proposedStructure`, `rationale`, `expectedImpact`) and this complete typed payload. A recorder cannot alter either while recording a result.

## 11. Six-State Process

```text
READY
  -> CLARIFICATION_REQUIRED
  -> OBJECTION_PENDING
  -> NOT_ADOPTED
  -> ADOPTED

CLARIFICATION_REQUIRED
  -> READY by proposer-authored revision + 1

OBJECTION_PENDING
  -> READY when objection is invalid, same revision
  -> AMENDMENT_REQUIRED when objection is valid, same revision

AMENDMENT_REQUIRED
  -> READY by proposer-authored revision + 1
  -> NOT_ADOPTED by meeting-process result

NOT_ADOPTED
  -> READY by original-proposer-authored complete revision + 1, only while source tension remains OPEN

ADOPTED is process-terminal. NOT_ADOPTED is terminal only for its exact revision/result; its immutable result cannot be changed or adopted, but the same process identity can return to READY through a later proposer revision while the source tension remains OPEN.
```

The six persisted states are:

1. `READY`
2. `CLARIFICATION_REQUIRED`
3. `OBJECTION_PENDING`
4. `AMENDMENT_REQUIRED`
5. `NOT_ADOPTED`
6. `ADOPTED`

### 11.1 Initialization

An exact routed candidate initializes revision 1 and `READY`. Initialization verifies:

- generic candidate provenance;
- exact selected governance route;
- open source tension;
- original proposer identity from exact proposal/route provenance, without requiring current meeting participation;
- complete narrative plus typed role payload;
- no existing process for the proposal.

Duplicate exact initialization replays the existing process. A mismatched duplicate is denied.

### 11.2 Clarification

From `READY`, the meeting process may record a clarification request, moving to `CLARIFICATION_REQUIRED`. It creates an event and zero structure, decision, change-log, artifact, or tension-resolution writes.

Only the original proposer may respond, whether or not they still participate in the current meeting. The response is a complete immutable revision with revision number exactly current + 1. It returns the process to `READY`; the prior revision and clarification remain immutable. There is no author transfer.

### 11.3 Objection

From `READY`, an actual current participant may raise one structured objection against the current revision, moving to `OBJECTION_PENDING`. The objection is bound to that revision and cannot edit the proposal.

The meeting process then records exactly one assessment:

- `INVALID`: append the assessment, preserve the objection, return the unchanged revision to `READY`, and create zero structure writes;
- `VALID`: append the assessment and move the unchanged revision to `AMENDMENT_REQUIRED`, where adoption is forbidden.

The application does not infer validity from the form fields. The fields ensure the process examined the approved material-harm tests.

### 11.4 Amendment

Only the original proposer may author an amendment from `AMENDMENT_REQUIRED`, whether or not they still participate in the current meeting. The amendment is a complete revision current + 1 and returns to `READY`. It must include the full narrative and typed role payload, not a diff-only patch.

### 11.5 Non-adoption

From `READY` or `AMENDMENT_REQUIRED`, the meeting process may record explicit non-adoption. An actual current participant records a required note. The current revision/result becomes `NOT_ADOPTED`.

Non-adoption:

- leaves `GovernanceProposal` linked to its immutable history;
- leaves the source tension `OPEN`;
- creates no role, decision, change log, result artifact, or tension-resolution write;
- cannot convert that revision to adoption by replay, later action, or administrator override;
- permits only the original proposer to author a later complete immutable revision + 1 on the same precisely routed proposal identity while the source tension remains `OPEN`;
- preserves the prior non-adoption event and operation forever, clears only the current-result projection, and returns the process to `READY`;
- creates only the new revision, operation/event audit, and process-projection update: zero new proposal, route, outcome, role, decision, change-log, artifact, or tension-resolution writes.

### 11.6 Adoption

Only `READY` may adopt. The action is bound to the exact current revision and typed payload. A successful serializable transaction moves directly to terminal `ADOPTED`; there is no persisted intermediate governance state such as `APPROVED` or `APPLICATION_FAILED`.

Technical failure leaves the process `READY`. It never changes the meeting result to non-adoption.

## 12. Source-Tension Semantics

| Process situation | Source tension | Structure/resolution writes |
|---|---|---|
| Initial routed candidate | `OPEN` | 0 |
| Clarification requested | `OPEN` | 0 |
| Clarified revision authored | `OPEN` | 0 |
| Objection pending | `OPEN` | 0 |
| Invalid objection | `OPEN` | 0 |
| Valid objection / amendment required | `OPEN` | 0 |
| Amended revision authored | `OPEN` | 0 |
| Explicit non-adoption | `OPEN` | 0 |
| Complete proposer revision after non-adoption | `OPEN` | 0 proposal/route/outcome/structure/resolution writes |
| Pre-commit application failure | `OPEN` | 0 |
| Successful adopted role creation | `RESOLVED`, `resolvedAt = transaction time` | Exactly one resolution write in the adoption transaction |
| Later observation or disagreement | New tension | No reopen, veto, or silent rollback |

The source tension describes the organizational discrepancy. Rejecting one proposal does not prove the discrepancy false or resolved. Successful application of the approved structural change closes it.

## 13. Authority Matrix

| Actor | Author initial/clarified/amended revision | Raise clarification/objection | Record objection validity or result | Apply structure |
|---|---:|---:|---:|---:|
| Original proposer who is an actual current selected-meeting participant | Yes | Yes | Yes, including self-recording | Only by recording a process-authorized adoption |
| Original proposer who is no longer a current selected-meeting participant | Yes; provenance-based, no transfer | No | No | No |
| Other actual current selected-meeting participant | No | Yes | Yes | Only by recording a process-authorized adoption |
| Coach | No title-based authority | Only if participant | Only if participant | Never independently |
| Circle lead | No title-based authority | Only if participant | Only if participant | Never independently |
| Organization administrator | No title-based authority | Only if participant | Only if participant | Never independently |
| Affected or future role holder | No special authority | Only if participant | Only if participant | Never independently |
| Runtime / AI | No | No validity judgment | No | No |
| Nonparticipant | No | No | No | No |

For every process-result write, participation is evaluated from the exact current `Meeting.participants` relation inside the authoritative transaction. Interface visibility, membership role, lead status, role category, coach title, administrator membership, proposer identity alone, or ownership of another artifact never substitutes for result-recording participation. Revision authorship is the explicit exception: immutable original-proposer provenance authorizes revision writing without current participation and cannot authorize any process result.

## 14. Direct-POST Zero-Write Denials

Every denial below occurs before any `GovernanceDecisionOperation` insertion or logical-slot reservation and before any process, revision, event, role, decision, change-log, artifact, proposal-status, or tension-success write. Unauthorized, forged, stale, and mismatched calls therefore leave the operation-row count unchanged. If an exact successful replay exists, the same operation-specific current actor authorization and exact immutable binding checks run before returning it.

### 14.1 Identity and tenant

- no authenticated organization person;
- actor, proposal, tension, meeting, run, circle, artifact, revision, role, decision, or change log belongs to another organization;
- forged cross-tenant composite identifiers;
- process-result actor is not an actual current participant in the selected meeting;
- revision author is not the immutable original proposer;
- administrator, coach, circle-lead, affected-holder, or interface-support title without participation.

### 14.2 Meeting and route

- wrong meeting ID;
- tactical or strategy meeting instead of governance meeting;
- candidate routed to another governance meeting;
- result recorder no longer belongs to the selected meeting at the mutation boundary;
- missing or forged proposal artifact, route artifact, source tension artifact, command, relation suffix, node, node visit, run, revision, proposer, meeting type, or metadata;
- candidate payload or stored proposal no longer matches immutable provenance.

### 14.3 Proposal and process state

- proposal is not the exact generic candidate represented by the process;
- missing process or mismatched process/proposal/run/meeting/artifact binding;
- stale expected revision;
- skipped revision or attempt to update/delete an immutable revision;
- non-proposer authors or alters a revision;
- recorder supplies fields that rewrite narrative or typed payload;
- adoption outside `READY`;
- adoption while clarification or objection remains unresolved;
- adoption or result rewrite against a `NOT_ADOPTED` revision, or any transition from process-terminal `ADOPTED`, other than exact replay;
- post-non-adoption revision by anyone other than the original proposer, while the source tension is not `OPEN`, or without a complete revision exactly current + 1;
- invalid transition, missing required note, or incomplete structured objection assessment.

### 14.4 Typed mutation

- operation other than `ROLE_CREATED`;
- ownership other than `HOME`;
- assignee, reassignment, archive, modification, contract, interface, project, action, or person fields;
- target circle missing, `HALTED`, `ARCHIVED`, or cross-tenant; only `NORMAL` and `WARNING` are allowed;
- missing or over-limit name, purpose, accountabilities, domain, narrative, rationale, or impact;
- invalid role category;
- typed payload hash differs from the current immutable revision.

### 14.5 Idempotency and concurrency

- empty mutation key;
- same key bound to another organization, proposal, revision, meeting, actor, operation, or payload;
- changed payload on retry;
- fresh key submitted while the approved failed attempt requires same-key retry;
- fresh key submitted for any existing logical operation slot, including after a failed or expired claim;
- a competing participant already committed the terminal result;
- revision or process state changes between preflight and locked transaction validation.

Every item in Sections 14.1-14.5 is validated inside the claim/replay transaction before a fresh claim insert. A stale or mismatched request cannot consume a mutation key, reserve a logical operation slot, or leave a failed operation row. A request that was fully authorized and valid when its claim committed but loses an application race follows the existing same-key failure/recovery contract; that concurrency case does not weaken authorization-before-claim.

### 14.6 Legacy bypasses

- legacy create proposal against a runtime-raised generic tension;
- legacy adoption against `CANDIDATE`, a process-backed proposal, or generic provenance;
- legacy objection update against `CANDIDATE`, any GD1 state, wrong tenant, wrong meeting, wrong status, or nonparticipant;
- direct circle/role form action used as the GD1 application adapter.

## 15. Serializable Atomic Adoption

After a durable operation claim has committed, successful adoption uses one Prisma interactive transaction with `Serializable` isolation for every application effect and the operation success marker.

1. Lock the immutable `GovernanceDecisionOperation`; require the exact `PROCESSING` lease token, binding, logical slot, and payload hash.
2. Lock the `GovernanceDecisionProcess` and `GovernanceProposal` rows.
3. Load and lock the current immutable revision; require `READY` and exact expected revision.
4. Re-resolve exact candidate/route provenance under the transaction.
5. Revalidate same-organization governance meeting, recorder's current participation, immutable original-proposer provenance, open source tension, current run, and artifact ownership.
6. Recompute canonical payload hash and validate the payload-bound operation binding.
7. Validate the target circle remains `NORMAL` or `WARNING` and in the same organization.
8. Conditionally claim the process with `READY`, current revision, and no outcome.
9. Create exactly one `RoleDef` using the canonical `ROLE_CREATED` payload, fixed `HOME`, no assignees, and default active status.
10. Create one `DecisionRecord` with `meetingId`, `ROLE_CHANGE`, complete content/rationale, and source tension connected as related and resolved. `decisionMakerId` remains null because the meeting process, not the recorder, authorized the result.
11. Create one `ChangeLog` with `ROLE_CREATED`, before value `无`, canonical after snapshot, expected impact, proposer as initiator, and the decision relation.
12. Update `GovernanceProposal` to the compatible adopted terminal representation, set `adoptedAt`, and attach the decision.
13. Update `GovernanceDecisionProcess` to `ADOPTED` and attach recorder/time/note, role, decision, and change log.
14. Conditionally change the source tension from `OPEN` to `RESOLVED` and set `resolvedAt`; require exactly one row.
15. Create one `ROLE` workflow artifact with complete provenance.
16. Append `GOVERNANCE_ADOPTION_RECORDED`, `GOVERNANCE_STRUCTURE_APPLIED`, and `ARTIFACT_CREATED` events with ordered sequence numbers.
17. Mark the claimed operation `SUCCEEDED` with an immutable result envelope containing the exact process, role, decision, change-log, artifact, and tension result IDs.
18. Commit.

Any error at any application step rolls back all seventeen in-transaction application/success effects while leaving the previously committed operation claim recoverable. There is no valid database state with a role but no adopted process, a decision without a change log, an adopted proposal with an open source tension, a resolved source tension without the role, or a `SUCCEEDED` operation without the complete result.

## 16. Idempotency, Replay, Retry, and Failure

### 16.1 Durable claim and binding

Every writing action enters one short claim/replay transaction before application starts. Its required order is:

1. canonicalize and bound the requested payload without writing;
2. resolve and lock the tenant-scoped exact proposal, route, meeting, process when present, and relevant revision/state rows;
3. authorize the requested operation: revision authoring requires the immutable original proposer and no current participation, while every clarification, objection/assessment, adoption, non-adoption, or other meeting-result operation requires that actor to be an actual current participant in that exact meeting;
4. validate the requested operation and canonical payload, then read the immutable key/logical slot without changing it;
5. for an existing successful key, verify every immutable binding and return replay only after the operation-specific current authorization in step 3; the historical bound revision need not still be current;
6. for a fresh claim or same-key reclaim, validate current process state, exact revision, operation, and canonical payload, then and only then insert or reclaim `PROCESSING` and reserve or retain its slot;
7. commit the authorized claim before application starts.

No failed authorization or validation in steps 1-6 may insert an operation row, reserve a slot, or change an existing operation. The binding is:

```text
schemaVersion
organizationId
proposalId
processId
meetingId
actorId
operation
expectedRevision
mutationKey
canonicalPayloadHash
```

The canonical payload for adoption is the immutable revision identity plus the complete typed role payload and result note. Stable JSON key ordering and explicit null values produce the hash. `processId` is the exact immutable process ID for established processes and explicit null only for initialization, whose successful result envelope returns the created process ID without mutating the binding. After authorization and new-claim validation, the transaction inserts `PROCESSING`, attempt 1, and a bounded lease, or applies the replay/conflict/reclaim rules to the existing key. The unique logical-operation slot denies a fresh key for an already claimed action.

### 16.2 Exact replay

- Before returning an exact successful replay, the claim/replay transaction re-resolves the current tenant and exact proposal/route/meeting provenance and re-runs the same operation-specific actor authorization used by the original write.
- Revision-authoring replay requires the actor to remain the immutable original proposer but does not require current meeting participation.
- Clarification, objection, objection-assessment, adoption, non-adoption, and every other meeting-result replay requires the bound actor to be an actual current participant in that exact meeting at replay time.
- Only after current actor authorization succeeds does replay load and verify every immutable bound field, operation, revision, key, and canonical payload hash and return the immutable result envelope.
- Replay creates zero new writes.
- Delayed replay remains exact after any number of later successful operations because each historical key has its own immutable ledger row. After current operation-specific actor authorization and exact immutable binding checks succeed, replay may ignore whether the historical revision remains current; it does not consult a last-operation field or overwrite newer state.
- Failed replay authorization or binding validation returns denial with zero writes, including zero operation-row or logical-slot changes.
- Terminal replay never depends on weakening the original `CANDIDATE` resolver; it uses immutable process/revision/artifact provenance.
- Same key with any changed binding is denied.

### 16.3 Concurrent recorders

Two actual current participants may race to record the same process result. The unique logical-operation slot, operation lease, row locks, expected revision, terminal claim, unique outcome relations, and serializable isolation allow one commit. The loser receives the committed exact result only for the same key and binding or a stable conflict otherwise. It never creates a second role.

### 16.4 Pre-commit failure

If adoption application fails before commit:

- all application effects roll back;
- the previously committed operation claim remains `PROCESSING` under its bounded lease;
- process remains `READY` on the same immutable revision;
- source tension remains `OPEN`;
- no role, decision, change log, result artifact, success event, proposal adoption, or tension resolution survives;
- the service must run a failure-audit transaction that locks the same operation and unchanged process/revision, marks that operation `FAILED` with a bounded error code, increments the process attempt projection, and appends `COMMAND_FAILED` atomically;
- if the failure-audit transaction itself does not persist, the row remains `PROCESSING`; after lease expiry, only the exact same key and binding may atomically rotate the lease token, increment `attempt`, reauthorize, and retry;
- a fresh key for the logical operation slot is always denied, whether the original row is `PROCESSING`, `FAILED`, or `SUCCEEDED`;
- a stale lease token or changed process/revision cannot mark failure or apply writes;
- the UI and server retain and reuse the same idempotency key; exact same-key retry reauthorizes everything and reruns the complete atomic application transaction.

The stored failure record is operational evidence only. It does not add an `APPLICATION_FAILED` governance state and cannot become non-adoption.

## 17. Experience Design

### 17.1 Governance meeting

The generic candidate card becomes a compact process card, separate from legacy proposals. It shows:

- proposer and source tension;
- exact immutable revision number;
- current structure, proposed structure, rationale, expected impact;
- typed role fields: circle, name, purpose, optional domain, accountabilities, category, fixed `HOME`, and “unassigned”;
- exact meeting and source run links;
- process state and immutable event history;
- clarification and objection records with fact/worry, reversibility, and safe-to-try fields;
- terminal non-adoption note or adopted role/decision/change links.

Only the original proposer sees revision-authoring controls in `CLARIFICATION_REQUIRED`, `AMENDMENT_REQUIRED`, or revision-terminal `NOT_ADOPTED` with an open source tension, even if they no longer participate in the meeting. Actual current participants see process-result controls appropriate to the current state. The proposer sees result controls only when they are also a current participant. Other nonparticipants see no controls, but the Server Actions remain the authority boundary.

The UI describes result actions as:

- “记录会议澄清请求”;
- “提出需验证的异议”;
- “记录异议有效/无效”;
- “记录会议不采纳”;
- “记录会议采纳并创建角色”.

It never says that the recorder personally approves the proposal.

### 17.2 Run page

The run page remains evidence and provenance, not a decision surface. It displays:

- candidate and selected governance meeting artifacts;
- proposal revision and process events;
- failed application attempts and same-key retry history;
- verified created-role artifact after adoption;
- links back to meeting, source tension, governance decision/change, and role.

No adoption, objection, or amendment control is added to the run page.

### 17.3 Governance page

Decision and audit cards show:

- “治理会议流程通过” as the authority source;
- meeting, proposal/revision, source tension, proposer, and recorder separately;
- before/after structural change;
- created role and target circle;
- run and artifact provenance.

The existing `decisionMaker` display must not imply that the recorder held centralized decision authority.

### 17.4 Responsive acceptance

Desktop and 390×844 must support full reading and all authorized actions without horizontal overflow, clipped buttons, nested-scroll traps, development overlay, console errors, or failed requests. Dense governance content may stack vertically on mobile; no information or authority explanation may disappear.

## 18. Legacy Bypass Hardening

GD1 introduces a new safe path but must also close the old direct paths.

### createProposalAction

- Require same-organization, open, ordinary legacy tension provenance.
- Require an organization-scoped `GOVERNANCE` meeting and current actor participation.
- Reject runtime-raised generic tensions and any existing GD1 process/candidate provenance.
- Validate target objects in the same organization.

### adoptProposalAction / adoptProposal

- Permit only legacy `PROPOSED` records that are not generic candidates and have no `GovernanceDecisionProcess`.
- Bind proposal meeting to the Server Action meeting; require governance type and actual participation.
- Revalidate tenant and legacy status inside the transaction.
- Explicitly reject `CANDIDATE` and every GD1 process state before writes.
- Do not route GD1 through the untyped legacy switch.

### objectProposalAction

- Replace unscoped `update({ id })` behavior with tenant-, meeting-, participant-, and status-scoped authoritative mutation.
- Permit only legacy `PROPOSED` proposals.
- Reject generic candidates and process-backed proposals before writes.
- Preserve a required legacy objection reason according to existing legacy semantics; do not map it into the GD1 valid-objection process.

Focused tests must prove these guards at the exported Server Action boundary, not only through copied fake permission logic.

## 19. Exact Implementation Write Scope

Future implementation is limited to:

### Persistence

- `prisma/schema.prisma`
- `prisma/migrations/<timestamp>_g3_i2c_gd1_governance_decision/migration.sql`
- generated `src/generated/prisma/**` output produced by the repository-standard Prisma generation command; no manual generated-client edits

### Domain

- `src/lib/domain-operations.ts`
- new `src/lib/governance-decision.ts`
- `src/lib/governance-engine.ts` only if a narrow transaction-compatible typed role helper is extracted; otherwise leave it unchanged

### Meeting and governance UI/actions

- new `src/app/app/meetings/[id]/governance-decision-actions.ts`
- `src/app/app/meetings/[id]/proposal-actions.ts`
- `src/app/app/meetings/[id]/page.tsx`
- `src/app/app/meetings/[id]/governance-workbench.tsx`
- `src/app/app/governance/page.tsx`

### Run trace UI

- `src/app/app/interfaces/runs/[runId]/page.tsx`
- `src/app/app/interfaces/runs/[runId]/run-workspace.tsx`

### Focused tests and disposable fixture

- new `src/lib/__tests__/governance-decision.test.ts`
- new `src/lib/interface-workbench/__tests__/governance-decision-persistence.test.ts`
- new `src/lib/interface-workbench/__tests__/governance-decision-action.test.ts`
- `src/lib/__tests__/domain-operations.test.ts`
- new `scripts/g3-i2c-gd1-governance-decision-fixture.ts`

If implementation discovery proves another file is unavoidable, stop and return the exact reason before expanding scope. Do not silently add files.

## 20. Explicit Implementation Exclusions

Do not modify:

- `GOALS.md` or `progress-dashboard.html` during the implementation worker slice unless separately assigned to the coordinator after evidence closes;
- Data -> Pretraining workbench/actions, `InterfaceValidationRun`, pilot tactical actions, or pilot weekly governance route;
- workbench protocol, compiler, publication, designer, or AI proposal assistance;
- tactical outcome schema, authority, actions, or UI except to run regressions;
- meeting creation;
- role assignment, person/home-circle actions, project/action outcomes, notifications, charter, or governance-log actions;
- I2C-3, second-interface configuration, package files, or unrelated styling;
- existing dirty files outside the exact scope;
- more than the approved `ROLE_CREATED` mutation.

## 21. Migration Plan

The migration is additive and must:

1. create `GovernanceDecisionProcessState`;
2. create `governance_decision_processes`, immutable `governance_proposal_revisions`, and immutable-key `governance_decision_operations`;
3. add required unique composite keys to existing models only where needed for tenant-safe foreign keys;
4. add relations and indexes for organization/meeting/state, proposal, proposer, run, current revision, operation status, lease, and logical operation slot;
5. add state/result/operation/check constraints and the nullable-current-revision initialization foreign key;
6. add the deferred valid-current-revision commit constraint, revision/operation immutability triggers, and process-provenance immutability trigger;
7. extend `InterfaceWorkflowArtifactType` with `ROLE`;
8. preserve all existing proposal, decision, change, run, event, and artifact rows unchanged.

No historical generic candidate is automatically initialized during migration. Process initialization occurs only when an exactly routed candidate enters the GD1 surface and passes current provenance validation.

### Rollback

Reviewed reverse SQL must:

1. remove GD1 triggers;
2. drop GD1 foreign keys, indexes, operation table, revision table, and process table in reverse dependency order;
3. remove `ROLE` artifacts created by the disposable fixture before rebuilding the PostgreSQL artifact enum without `ROLE`;
4. remove added compatibility relations/constraints;
5. leave all pre-GD1 proposal, run, decision, change-log, tension, meeting, role, and pilot rows intact.

Production rollback after real adopted roles is not “delete the role.” Database rollback is allowed only before production acceptance or after an explicit data-retention plan. Once real governance decisions exist, remediation is forward-only: disable the GD1 UI/action path, preserve decision/audit/provenance rows, and use a later governance proposal for structural reversal.

## 22. Test Plan

### 22.1 Pure/domain tests

- only the original proposer authors revision 1, clarification, amendment, and post-non-adoption revisions;
- original proposer can author a complete amendment after leaving the current meeting, while they remain unable to record any process result;
- revisions are complete, immutable, monotonic, and cannot skip numbers;
- any actual current participant, including the proposer while currently participating, can record each process result;
- nonparticipant and admin/coach/lead/affected-holder title-only identities are denied;
- valid objection moves to `AMENDMENT_REQUIRED` and blocks adoption;
- invalid objection remains in history and returns unchanged revision to `READY`;
- clarification requires a complete new revision;
- non-adoption is terminal for its revision/result, keeps tension open, and creates zero structure writes;
- original proposer can author a complete next revision after non-adoption on the same proposal identity, restoring `READY` while prior non-adoption remains immutable and proposal/route/outcome/structure counts do not change;
- adoption only accepts `READY` current revision;
- recorder cannot rewrite proposal or typed fields;
- typed payload accepts only unassigned same-organization `HOME` `ROLE_CREATED`;
- `NORMAL` and `WARNING` target circles are accepted; `HALTED`, `ARCHIVED`, and cross-tenant circles are denied;
- exact idempotent replay returns existing result;
- revision-authoring replay succeeds only for the immutable original proposer without requiring current participation;
- meeting-result replay succeeds only while the bound actor is an actual current participant in the exact meeting;
- delayed replay of an older successful key after later writes returns its original immutable result with zero writes only after current operation-specific authorization and exact binding checks, while revision-currentness may then be ignored;
- same key with changed actor/meeting/revision/operation/payload is denied;
- fresh-key retry for an existing logical operation slot is denied;
- concurrent recorders create one role;
- failure injection after every atomic step leaves zero partial application/domain writes while the durable operation claim and mandatory audit follow their specified lifecycle;
- technical failure stays `READY`, mandatory failure audit marks the same operation `FAILED`, and same-key retry succeeds;
- injected failure of failure-audit persistence leaves `PROCESSING`; lease expiry permits exact same-key reclaim and denies fresh-key retry;
- later disagreement uses new-tension semantics and does not reopen or roll back the adopted process.

### 22.2 Persistence contract tests

- schema contains the projection, revision and operation models, composite foreign keys, database-unique immutable keys, logical-slot uniqueness, lease/status indexes, and checks;
- claim-transaction probes prove unauthorized, forged, stale, wrong-state, wrong-revision, wrong-operation, and payload-mismatched requests cannot insert an operation row or reserve a logical slot;
- initialization transaction can insert process then revision then set current revision, while a direct commit with null or mismatched current revision is rejected by the deferred constraint;
- revision update/delete triggers reject mutation;
- operation binding/key update or delete is rejected and valid status/lease transitions are enforced;
- process provenance cannot be changed;
- state/result checks reject impossible combinations;
- artifact enum and result relation support one verified role;
- current revision and process outcome relations are tenant-safe;
- existing run-event immutability remains intact.

### 22.3 Exported action-boundary tests

- wrong tenant, meeting, type, participant, proposer, route, artifact, state, revision, operation, payload, or key yields zero writes including an unchanged `GovernanceDecisionOperation` count and no logical-slot reservation;
- every fresh action authorizes inside the claim transaction before operation insertion, not only in Server Action preflight;
- revision-authoring replay reauthorizes the immutable original proposer and succeeds without current meeting participation;
- meeting-result replay reauthorizes actual current participation in the exact meeting before return; a former participant is denied with unchanged operation count;
- delayed replay checks current operation-specific authorization and exact binding before ignoring historical revision-currentness;
- proposer self-recording succeeds because of meeting participation;
- proposer who left the meeting can author a permitted revision but cannot request clarification, object/assess, adopt, non-adopt, or record another process result;
- another participant recording succeeds without interface/admin/lead/coach authority;
- legacy create/adopt/object actions reject generic candidates and runtime tensions;
- valid legacy ordinary/pilot behavior remains available;
- normal test discovery runs the action tests; do not rely only on bracket-path test discovery.

### 22.4 Required regression suites

Run all focused interface-workbench runtime, governance-route, domain-operation, tactical-outcome authority/action, persistence, permission, and Data -> Pretraining tests. Existing foundation-era excluded debt must be reported explicitly and must not be attributed to GD1.

## 23. Real Database Evidence

Use a disposable PostgreSQL database containing all project migrations.

### Migration evidence

- apply all migrations including GD1;
- inspect exact tables, enums, indexes, checks, foreign keys, and triggers;
- execute reviewed rollback and prove complete GD1 absence with pre-GD1 rows intact;
- reapply GD1 successfully.

### Zero-write probes

Snapshot counts and relevant rows before/after each denial:

- nonparticipant, admin-only, coach-only, lead-only, affected-holder-only;
- wrong tenant, meeting, and meeting type;
- forged candidate/route/source artifact or command metadata;
- stale revision, wrong state, changed payload, and conflicting idempotency key;
- non-proposer revision author;
- `HALTED`, `ARCHIVED`, cross-tenant circle, and unsupported structure payload;
- adoption attempts during unresolved clarification, pending/valid objection, or after revision-level non-adoption;
- legacy direct adoption/object/create attempts against the generic candidate.

Each must prove unchanged `GovernanceDecisionOperation` rows and logical slots as well as unchanged role, decision, change-log, result artifact, proposal adoption, process terminal outcome, and tension-resolution counts. Direct database/service claim probes must attempt every listed denial against an otherwise unused key and prove that key and slot remain available because no unauthorized claim was inserted.

### Success and concurrency probes

- authorized participant adoption creates exactly one role, decision, change log, result artifact, adopted process, proposal result, and source-tension resolution;
- proposer self-recording produces the same authority shape;
- exact revision-authoring duplicate reauthorizes the immutable original proposer without requiring current participation and returns the same IDs with all counts unchanged;
- exact meeting-result duplicate reauthorizes the bound actor's actual current participation in the exact meeting before returning the same IDs with all counts unchanged;
- two concurrent authorized participants produce one committed outcome;
- injected failures at each transaction stage roll back everything;
- a valid application failure retains the authorized operation claim and mandatory failure audit while all application/domain effects roll back;
- same-key retry after failure succeeds once and preserves attempt history;
- delayed replay of an earlier successful key after later operations returns its original result and leaves all counts unchanged only after current operation-specific authorization and exact binding checks; historical revision-currentness is then ignored;
- initialization in one transaction commits only after revision 1 is linked, while direct null, missing, mismatched-process, mismatched-proposal, and mismatched-revision commits fail at the deferred constraint;
- proposer-left-meeting amendment and post-non-adoption revision succeed without proposal/route/outcome/structure writes, while that proposer cannot record a process result;
- failed failure-audit persistence leaves an expiring `PROCESSING` claim; exact same-key reclaim succeeds and fresh-key retry is rejected;
- `NORMAL` and `WARNING` targets can reach adoption, while `HALTED` and `ARCHIVED` targets produce zero writes;
- database rejects revision mutation, operation binding/key mutation or deletion, and impossible state/result combinations directly.

## 24. Browser Acceptance

Use an isolated local server, disposable database, and dedicated fixture. Do not kill unknown port owners.

The fixture includes:

- two organizations;
- proposer, another meeting participant, nonparticipant, administrator-only, coach-title-only, circle-lead-title-only, and affected-holder identities;
- `NORMAL`, `WARNING`, `HALTED`, `ARCHIVED`, and cross-tenant target circles;
- one exactly routed generic governance candidate with full runtime artifacts;
- separate candidates or resettable revisions for clarification, invalid objection, valid objection/amendment, non-adoption, participant adoption, proposer self-recording, retry, and concurrency evidence.

Browser proof must cover:

1. proposer authors complete revision 1;
2. participant records clarification; proposer authors complete revision 2;
3. participant raises objection; process records invalid; unchanged revision returns ready;
4. participant raises valid objection; adoption is unavailable; the original proposer leaves the meeting, still authors the complete amended revision and replays that revision-authoring operation, and remains unable to record or replay a meeting-process result;
5. explicit non-adoption leaves source tension open and creates no role; the original proposer then authors a complete next revision on the same proposal identity and returns it to `READY` with prior non-adoption visible;
6. another participant records adoption and one role appears unassigned in an allowed circle;
7. proposer self-recording succeeds in a separate candidate;
8. nonparticipant and title-only identities have no controls; their direct fresh actions and replay attempts are denied with the operation-row count unchanged and no logical slot reserved;
9. injected first application failure remains visible; refresh preserves state/key; a separate failure-audit persistence injection leaves a reclaimable `PROCESSING` lease; fresh-key retry is denied and same-key retry succeeds without duplication;
10. a current participant can replay an older bound meeting result after later writes and receive its exact historical result even though its revision is no longer current; after that actor leaves the exact meeting, the same replay is denied with every domain and operation count unchanged;
11. meeting, source tension, role, governance decision/change, run history, and role artifact links survive refresh;
12. cross-tenant and wrong-meeting URLs/actions return denial/404 without leakage or operation-row writes;
13. `NORMAL` and `WARNING` target-circle flows are allowed, while direct `HALTED` and `ARCHIVED` attempts are denied with zero writes including operation rows;
14. desktop and 390×844 have no overflow, clipped controls, console errors, failed requests, warnings caused by GD1, or development overlays.

## 25. Data -> Pretraining Regression

GD1 must not claim closure from generic governance evidence alone. Re-run the proven pilot rhythm:

- submit Data -> Pretraining validation;
- record failed smoke result;
- create failure tension;
- process the unresolved validation card in a tactical meeting;
- mark the pilot governance candidate;
- confirm it remains visible in the weekly governance review;
- verify generic GD1 candidates remain isolated from the pilot weekly rollup unless separately designed later;
- verify project/action/defer pilot dispositions and exact meeting trace remain unchanged.

Static source review or generic tests do not substitute for this browser regression.

## 26. Delivery and Evidence Gates

Implementation remains inactive until a separately delegated worker receives this exact scope.

Closure order:

1. implementation within the exact write set;
2. focused tests, Prisma validate/generate, TypeScript, scoped ESLint, production build, and diff checks;
3. disposable-database migration apply/rollback/reapply and direct probes;
4. complete desktop/390px browser acceptance and Data -> Pretraining regression;
5. one independent `/review` covering correctness, authority, concurrency, tenant isolation, provenance, and bypasses;
6. at most one concentrated correction pass;
7. the same reviewer confirms every finding closed with no remaining P0/P1/P2;
8. one independent milestone/current-state audit against implementation, tests, database, browser, review, exact scope, and inactive later slices;
9. product owner opens the retained visible page and explicitly accepts it;
10. only after acceptance, stop the dedicated service, clear the isolated port, remove the disposable database/fixture state, and verify cleanup.

Do not update roadmap/dashboard closure claims before implementation, evidence, review, audit, and product acceptance actually pass.

## 27. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| Recorder is mistaken for centralized decision maker | Store meeting authority and recorder separately; UI says “record meeting result”; leave `DecisionRecord.decisionMakerId` null for GD1. |
| Generic candidate bypasses GD1 through legacy actions | Harden exported legacy create/adopt/object boundaries and add direct zero-write tests. |
| Forged route or artifact reaches mutation | Reuse exact relation/command/metadata validation and repeat it inside the serializable transaction. |
| Revision history becomes mutable | Separate full snapshots, monotonic unique indexes, and database update/delete rejection trigger. |
| Two participants create two roles | Row lock, expected revision, conditional terminal claim, unique outcome links, serializable isolation, and exact replay. |
| Application failure leaves partial organizational state | Commit an immutable operation claim first; keep application atomic; require same-operation failure audit after rollback; reclaim an unaudited expired lease only with the same key. |
| Same idempotency key replays a different request | Bind an immutable database-unique operation key to tenant, actor, meeting, proposal, revision, operation, scope, and canonical payload hash; deny changed bindings and fresh-key retries. |
| Valid objection is reduced to a preference veto | Require material-harm, fact/worry, reversibility, and safe-to-try fields; meeting process records validity. |
| Coach/admin/lead titles centralize authority | Meeting participation is the only result-recording authority source; title-only direct POSTs produce zero writes. |
| Role target changes between proposal and adoption | Revalidate exact `NORMAL` or `WARNING` same-organization circle status and the complete typed payload inside the locked transaction; deny `HALTED` and `ARCHIVED`. |
| Adding `ROLE` enum complicates rollback | Use reviewed enum-rebuild reverse SQL in the disposable database; never delete real adopted roles as rollback. |
| GD1 regresses the pilot | Keep pilot files out of scope and require real Data -> Pretraining browser regression before closure. |
| Dirty checkout causes collateral changes | Worker audits baseline first, edits only named paths, and reports any unavoidable scope expansion before acting. |

## 28. Rollback and Operational Recovery

### Before product acceptance

- Stop the isolated GD1 service.
- Run reviewed reverse migration in the disposable database.
- Verify GD1 tables, triggers, indexes, enum value, and fixture artifacts are absent.
- Verify pre-GD1 proposals, tensions, runs, meetings, decisions, changes, roles, and pilot data remain.
- Revert only GD1-owned implementation files if the implementation is rejected; preserve unrelated dirty work.

### After a failed application attempt

- Do not manually patch proposal, role, decision, change-log, artifact, or tension rows.
- Confirm the transaction left zero partial effects.
- Inspect the immutable operation status/attempt/lease, bounded failure event, and process attempt count.
- Retry through the same meeting action with the exact same idempotency key after correcting the technical cause; never issue a fresh key for that logical operation.

### After a successful adopted result

- Do not delete or silently archive the role as an operational rollback.
- Preserve the immutable proposal, revision, decision, change log, events, and artifact provenance.
- If the organization later disagrees, raise a new tension and use a future governance proposal to change or archive the role.
- If code rollback is required, disable new GD1 actions while retaining read access and durable history.

## 29. Definition of Done

GD1 is complete only when all of the following are true:

- the exact routed generic candidate follows the approved six-state process;
- immutable revisions and events are database-enforced;
- immutable database-unique operation claims provide exact historical replay, conflict denial, and recoverable same-key leases for every writing operation;
- complete tenant, route, meeting, actor, state, revision, operation, and canonical-payload authorization occurs inside the claim transaction before any operation insertion, slot reservation, or reclaim; denied calls leave operation rows unchanged;
- exact replay re-runs current operation-specific authorization before return: immutable original proposer for revision authoring, and actual current exact-meeting participation for every meeting result;
- only the original proposer authors revisions, including after leaving the meeting and after revision-level non-adoption, with no author transfer;
- any actual current meeting participant, including the proposer while currently participating, can record the process result;
- title identities and nonparticipants cannot write;
- clarification and valid objection block adoption as approved;
- non-adoption is terminal only for its current revision/result and a later complete proposer revision on the same open-tension proposal identity returns the projection to `READY` without new proposal/route/outcome/structure writes;
- invalid objection, non-adoption, denial, and technical failure create zero structure writes;
- only `NORMAL` and `WARNING` target circles are allowed; `HALTED` and `ARCHIVED` are denied;
- one successful adoption creates exactly one unassigned same-organization `HOME` role and complete decision/change/artifact provenance atomically;
- the source tension resolves only with successful adoption;
- exact replay, concurrency, and same-key retry are proven;
- legacy direct paths cannot bypass GD1;
- migration, focused/static, real-database, desktop/390px browser, and Data -> Pretraining regression evidence pass;
- independent review closes with no P0/P1/P2 after at most one correction;
- independent audit passes;
- product owner explicitly accepts the visible result;
- retained runtime and disposable database cleanup is verified;
- I2C-3 and second-interface migration remain inactive.
