# V5-M3 Command Boundary and Goal Read Surface Contract

## Status and Goal

- Status: `ACCEPTED`; independent same-reviewer reclosure passed with no open
  P0/P1/P2 on 2026-07-15.
- Scope: `V5-M3-A`, the contract gate for Brain-assisted Goal operations.
- Goal: expose a minimal confirmed Goal read surface and exactly six previewed,
  confirmed, replayable commands without bypassing canonical authority.
- This document is normative for M3-B through M3-F.
- `MUST`, `MUST NOT`, and `EXACTLY` are acceptance requirements.
- Independent review must accept this contract with no open P0/P1/P2 before any
  production implementation begins.

## Accepted Baseline

- `GOALS.md:359-370` activates M3-A and requires inventory, an allowlist,
  preview, confirmation, fresh authorization, idempotency, audit, and no generic
  or silent mutation.
- `GOALS.md:372-395` requires canonical Goal/work drafts and prohibits direct
  strategic, tactical, or governance adoption.
- `GOALS.md:462-470` places contract review before implementation and records no product-decision or external blocker.
- The current 15-resource catalog and closed field types are defined at
  `src/lib/organization-brain/query-plan.ts:15-54`; resource metadata currently
  has no source-version selector at `src/lib/organization-brain/query-plan.ts:107-119`.
- Evidence currently derives meeting revisions specially and otherwise falls
  back to `updatedAt` or observation time at
  `src/lib/organization-brain/evidence.ts:154-162`, then persists the version in
  packets at `src/lib/organization-brain/evidence.ts:195-225`.
- Query truncation is an audited server fact: `hasMore` is part of the audit scope at
  `src/lib/organization-brain/query-audit.ts:44-67` and is written with
  the query audit at `src/lib/organization-brain/query-audit.ts:249-302`.
- The turn service passes `hasMore` to the model but currently builds empty
  failure responses at `src/lib/organization-brain/turn-service.ts:1221-1310`.
- The conversation store permits at most six `missingEvidence` items and permits
  evidence arrays only for `ANSWERED` or `EVIDENCE_ONLY` at
  `src/lib/organization-brain/conversation-store.ts:546-620`; its fixed
  `EVIDENCE_ONLY` and `FAILED` code/message rules are at
  `src/lib/organization-brain/conversation-store.ts:495-522`.
- The current turn validator rejects `missingEvidence` on `EVIDENCE_ONLY` at
  `src/lib/organization-brain/turn-service.ts:1025-1086`, while current provider
  throw/invalid-output fallbacks persist empty `FAILED` responses at
  `src/lib/organization-brain/turn-service.ts:1274-1303`.
- Canonical Goal statuses and work-link kinds are fixed at
  `prisma/schema.prisma:300-360`; canonical Goal records are defined at
  `prisma/schema.prisma:1657-1919`.
- Canonical draft/revision/check-in operations and their locks are at
  `src/lib/goals/domain-operations.ts:563-635` and
  `src/lib/goals/domain-operations.ts:710-756`; effective check-ins are selected
  at `src/lib/goals/domain-operations.ts:766-775`.
- Goal transactions are serializable at `src/lib/goals/domain-operations.ts:865-874`,
  with member, meeting, Role, and object checks at
  `src/lib/goals/domain-operations.ts:963-1065`.
- The accepted read policy classifies Goal, Project, and Action as organization-
  transparent but unresolved Tension as context-restricted at
  `src/lib/authorization/read-policy-core.ts:9-24`, with the exact Tension
  context relations at `src/lib/authorization/read-policy-core.ts:50-66`.
- Tactical submit authority and bound replay are at
  `src/app/app/meetings/[id]/tactical-outcome-authority.ts:34-45` and
  `src/app/app/meetings/[id]/tactical-outcome-authority.ts:72-97`.
- Tactical proposal submission is embedded in a Server Action at
  `src/app/app/meetings/[id]/tactical-outcome-actions.ts:153-247`; only the
  separate meeting decision branch creates Project/Action outcomes at
  `src/app/app/meetings/[id]/tactical-outcome-actions.ts:249-343`.
- Meeting notes use participant checks and `notesRevision` compare-and-swap at
  `src/app/app/meetings/[id]/collaboration-actions.ts:52-75` and
  `src/app/app/meetings/[id]/collaboration-actions.ts:100-120`.

## Non-Goals

- No autonomous, background, implicit, model-triggered, or silent mutation.
- No arbitrary SQL, model database credentials, generic write API, runtime
  registration, callback execution, or client-selected storage coordinates.
- No new Goal lifecycle, derived Goal state, shared memory, proactive signal,
  plugin, deployment, M4, M5, or unrelated refactor.
- No change, backfill, reinterpretation, or replacement of existing Goal
  business tables.
- No command outside the exact allowlist below.

## Goal Read Surface

- M3-B adds exactly five read-only `security_barrier` resources:
  `goalCycles`, `goals`, `goalTargets`, `goalEffectiveCheckIns`, and
  `goalActiveWorkLinks`.
- They map respectively to `brain_read.goal_cycles`, `brain_read.goals`,
  `brain_read.goal_targets`, `brain_read.goal_effective_check_ins`, and
  `brain_read.goal_active_work_links`.
- Each view is tenant-bound to the current actor, grants only `SELECT` to the
  dedicated Brain reader, and has no write rule, trigger, or writable path.
- The views project existing canonical tables; existing Goal business tables
  are not altered.
- `goalCycles` contains canonical cycle facts only.
- `goals` contains confirmed canonical Goals, including confirmed terminal
  Goals, but never a proposal-shaped row.
- `goalTargets` contains canonical adopted Targets only.
- `goalEffectiveCheckIns` contains exactly the latest unsuperseded check-in per Target, ordered by `recordedAt DESC, id DESC`.
- `goalActiveWorkLinks` contains only rows whose status is `ACTIVE`.
- Proposal, revision, proposed Target, derived health, derived gap, historical
  check-in, superseded check-in, and `REMOVED` link rows MUST NOT enter these
  current resources.
- The surface emits canonical confirmed facts only; model interpretation remains
  inference and cannot be persisted as a read-row fact.

The table below is the closed catalog contract. `ID` means type `id` with only
`eq/in`; `ENUM` means type `string` with only `eq/in`; `TEXT` means type `string`
with only `eq/in/contains`; `RANGE` means the declared `number` or `datetime`
type with only `eq/in/gt/gte/lt/lte`; `NONE` means the declared type with no
filter operator. `?` means nullable and `(sort)` means sortable. Unmarked fields
are not sortable. Fields are listed in exact projection order.

| Resource | Exact `fields`: type/operator/sortability | `displayFields` | `recordIdField`; `defaultSort` | `relations`; `linkRule`; `sourceVersionField` |
| --- | --- | --- | --- | --- |
| `goalCycles` | `organizationId ID`; `id ID(sort)`; `name TEXT(sort)`; `status ENUM`; `startAt datetime RANGE(sort)`; `endAt datetime RANGE(sort)`; `checkInCadenceDays number RANGE(sort)`; `sourceVersionAt datetime RANGE(sort)` | `name,status,startAt,endAt,checkInCadenceDays` | `recordIdField=id`; `defaultSort=startAt desc,id asc` | `relations=goals(cycleId)`; `linkRule=goal-cycle`; `sourceVersionField=sourceVersionAt` |
| `goals` | `organizationId ID`; `id ID(sort)`; `cycleId ID`; `circleId ID`; `title TEXT`; `intendedOutcome string NONE`; `ownerRoleId ID`; `parentGoalId ID?`; `status ENUM`; `createdAt datetime RANGE(sort)`; `adoptedMeetingId ID`; `adoptedAt datetime RANGE`; `terminalOutcome ENUM?`; `terminalMeetingId ID?`; `terminalAt datetime RANGE?`; `sourceVersionAt datetime RANGE` | `title,intendedOutcome,status,createdAt,adoptedAt,terminalOutcome,terminalAt` | `recordIdField=id`; `defaultSort=createdAt asc,id asc` | `relations=goalCycles(cycleId),circles(circleId),roleDefinitions(ownerRoleId),goals(parentGoalId as parent Goal)`; `linkRule=goal`; `sourceVersionField=sourceVersionAt` |
| `goalTargets` | `organizationId ID`; `id ID(sort)`; `cycleId ID`; `goalId ID`; `position number RANGE(sort)`; `label TEXT`; `kind ENUM`; `baselineValue string NONE?`; `desiredValue string NONE?`; `unit string NONE?`; `acceptanceCriteria string NONE?`; `metricId ID?`; `createdAt datetime RANGE`; `sourceVersionAt datetime RANGE` | `position,label,kind,baselineValue,desiredValue,unit,acceptanceCriteria,createdAt` | `recordIdField=id`; `defaultSort=position asc,id asc` | `relations=goals(goalId)`; `linkRule=goal`; `sourceVersionField=sourceVersionAt` |
| `goalEffectiveCheckIns` | `organizationId ID`; `id ID(sort)`; `cycleId ID`; `goalId ID`; `targetId ID`; `fact string NONE`; `evidenceSummary string NONE`; `currentValue string NONE?`; `milestoneState ENUM?`; `acceptanceEvidence string NONE?`; `assessment ENUM`; `recorderId ID`; `meetingId ID?`; `recordedAt datetime RANGE(sort)`; `sourceVersionAt datetime RANGE` | `fact,evidenceSummary,currentValue,milestoneState,acceptanceEvidence,assessment,recordedAt` | `recordIdField=id`; `defaultSort=recordedAt desc,id desc` | `relations=goals(goalId),goalTargets(targetId)`; `linkRule=goal`; `sourceVersionField=sourceVersionAt` |
| `goalActiveWorkLinks` | `organizationId ID`; `id ID(sort)`; `cycleId ID`; `goalId ID`; `kind ENUM`; `projectId ID?`; `tensionId ID?`; `objectLabel TEXT`; `objectStatus ENUM`; `createdAt datetime RANGE(sort)`; `sourceVersionAt datetime RANGE` | `kind,objectLabel,objectStatus,createdAt` | `recordIdField=id`; `defaultSort=createdAt desc,id asc` | `relations=goals(goalId),projects(projectId),unresolvedTensions(tensionId; authorized row only)`; `linkRule=goal-work-link`; `sourceVersionField=sourceVersionAt` |

- The field lists are closed: no additional projection, filter, sort, display, or
  relation field is allowed in M3-B.
- Every projection includes `organizationId`, its record id, and
  `sourceVersionAt` for tenant, row, and version validation; none is displayed.
- No internal id is in any `displayFields`; `sourceVersionAt` is never displayed.
- `BrainLinkRule` adds exactly `goal-cycle`, `goal`, and `goal-work-link` for these
  resources. `goal-cycle` resolves `/app/goals?cycle=<cycleId>&goal=` and `goal`
  resolves `/app/goals?cycle=<cycleId>&goal=<goalId>`.
- `goal-work-link` routes `PROJECT` to its Project, routes `ACTION` through its
  `tensionId` to Tracker, and routes an authorized `BLOCKING_TENSION` to Tension.
- Response resource labels are exact: `goalCycles=目标周期`, `goals=目标`,
  `goalTargets=目标靶点`, `goalEffectiveCheckIns=目标有效检查`, and
  `goalActiveWorkLinks=目标工作关联`.
- Existing field labels are reused; required additions are exact:
  `startAt=开始时间`, `endAt=结束时间`, `checkInCadenceDays=检查节奏（天）`,
  `intendedOutcome=预期成果`, `adoptedAt=采纳时间`, `terminalOutcome=终态结果`,
  `terminalAt=终止时间`, `position=顺序`, `label=指标`, `baselineValue=基线值`,
  `desiredValue=目标值`, `unit=单位`, `fact=事实`, `evidenceSummary=证据摘要`,
  `currentValue=当前值`, `milestoneState=里程碑状态`,
  `acceptanceEvidence=验收证据`, `assessment=评估`, `recordedAt=记录时间`,
  `objectLabel=工作对象`, and `objectStatus=工作对象状态`.

## Visibility and Versioning

- Current members may read confirmed Goal, Project-link, and Action-link facts
  exposed by the views; cross-organization rows are impossible.
- `BLOCKING_TENSION` retains the accepted M1 context-restricted Tension policy.
- If the viewer does not satisfy that existing policy, the entire
  `BLOCKING_TENSION` work-link row is absent from `goalActiveWorkLinks`; no row,
  count, `hasMore`, relation, id, title, label, status, or URL may reveal existence.
- Only a viewer authorized for that Tension receives the complete active link and
  may resolve its `unresolvedTensions` relation and Tension URL.
- Confirmed `PROJECT` and `ACTION` links retain their existing organization-
  transparent read rules; Action storage still uses `tensionId` but its link
  resolver routes to Tracker.
- The only Goal application URL shape is exactly
  `/app/goals?cycle=&goal=` with the encoded cycle and Goal values in those two
  parameters; no Target, check-in, link, or alternate Goal URL is introduced.
- `BrainResourceDefinition` gains server-owned
  `sourceVersionField: string | null`; plans, models, and clients cannot set it.
- All five new definitions set `sourceVersionField` to `sourceVersionAt`.
- View version mapping is exact: cycle `updatedAt`; Goal
  `coalesce(terminalAt, createdAt)`; Target `createdAt`; effective check-in
  `recordedAt`; active link `createdAt`.
- A check-in correction has a new record id; evidence identity therefore changes
  even when its `recordedAt` happens to match another record.
- Decimal values are PostgreSQL decimal strings, never JavaScript numbers.
- Boolean milestone state is mapped to a string enum such as `COMPLETED` or
  `NOT_COMPLETED`; `BrainFieldType` is not expanded for decimal or boolean.
- When any authorized broker result has `hasMore = true`, the turn service
  reserves the sixth `missingEvidence` slot for one deterministic marker.
- The model may contribute at most its first five valid `missingEvidence` items;
  the turn service then appends exactly
  `More authorized rows existed than were returned; the answer is incomplete.`
- Marker merge occurs after model validation and before persistence, produces at
  most six total items, is deterministic, and cannot be removed by model output.
- After safe authorized evidence packets exist, provider off, unavailable,
  timeout, throw, or invalid output MUST persist `EVIDENCE_ONLY` with deterministic
  packet facts and sources, no inference/recommendation, and the marker when
  `hasMore`; it MUST NOT persist a payload-bearing `FAILED` response.
- The fallback uses the existing safe `EVIDENCE_ONLY` code matching the failure,
  including `PROVIDER_UNAVAILABLE`, `PROVIDER_TIMEOUT`, `PROVIDER_FAILURE`, or
  `OUTPUT_SCHEMA_INVALID`, and reconstructs every fact/source from packets.
- Only a path unable to form safe authorized evidence may retain an empty
  `FAILED` or `UNAVAILABLE`; that response contains no evidence arrays and never
  claims or implies completeness.

## Command Registry

- The command type is a static TypeScript discriminated union of the six exact
  command names in the allowlist.
- Each variant owns a closed input schema, server payload schema, source-binding
  schema, human-diff formatter, result schema, and public-error mapping.
- M3-C adds metadata and validation only; it adds no executable handlers.
- Later D slices add an exhaustive server switch with explicit imports of
  transaction-scoped canonical handlers; there is no public `register()` hook.
- All six executable handlers MUST be transaction-scoped canonical services;
  no Server Action itself is a command handler.
- Goal dependencies already expose a transaction boundary suitable for an adapter
  at `src/lib/goals/domain-operations.ts:865-874`.
- Tactical submission and meeting notes are currently embedded in Server Actions
  at `src/app/app/meetings/[id]/tactical-outcome-actions.ts:153-247` and
  `src/app/app/meetings/[id]/collaboration-actions.ts:52-75`; M3-D2 and M3-D3
  MUST first extract canonical transaction-scoped services with no behavior drift.
- Model and client input is untrusted proposal data and is parsed before preview.
- The model or client MUST NOT provide a handler, module, table, field, SQL,
  callback, database client, `ActorContext`, organization id, person id, user id,
  actor id, owner id, recorder id, or raiser id.
- Server resolution binds all authority identifiers and rejects ambiguous names;
  the registry never guesses an organization Person or Role.

## Preview/Confirm/Replay Transaction

- Preview performs zero organization-domain writes. Its only write is one
  owner-private `BrainCommandOperation` control-plane row.
- The server resolves and stores owner user, organization, actor Person,
  conversation, user message, exact command schema version, immutable canonical
  server payload, payload hash, source bindings, and human-readable diff.
- Source bindings include every selected object id and current source version,
  revision, status, Role, meeting, or route fact needed by that command.
- Preview expiry is server time plus exactly 15 minutes.
- Preview shows all material changes, including nulling, nesting, routing,
  handling mode, responsibility, deadline, and expected revision.
- Confirm transport contains exactly `previewId` and `mutationKey`; it never
  resubmits command name, payload, source ids, actor data, or diff.
- Confirm first resolves a fresh `ActorContext`, then admits only the same owner,
  organization, and current member; only after that admission does its one
  serializable transaction lock the ledger row by `previewId`.
- After lock, confirm validates the immutable ledger binding and branches on the
  stored lifecycle before checking any command source pre-state.
- If the ledger is terminal, same `previewId`, same `mutationKey`, and the same
  immutable owner/organization/command/payload/source binding returns the stored
  terminal result immediately with no Role, meeting, object-state, source-version,
  expiry, or domain-handler check and with zero domain writes.
- A terminal operation addressed with the same organization mutation key but a
  different immutable binding returns `IDEMPOTENCY_CONFLICT`; the same preview
  addressed with a different key returns `RETRY_CONFLICT`; both write nothing.
- This replay-before-fresh-state order mirrors tactical replay-before-validation at
  `src/app/app/meetings/[id]/tactical-outcome-authority.ts:72-97` and avoids
  rejecting a successful notes replay merely because success advanced
  `notesRevision` at `src/app/app/meetings/[id]/collaboration-actions.ts:52-75`.
- Only a locked `PREVIEWED` operation verifies current Membership Role,
  command-specific Role authority, meeting, object state, source versions,
  expiry, canonical payload hash, and source-binding hash.
- That first-execution transaction claims unique `(organizationId, mutationKey)`,
  invokes the transaction-scoped canonical handler, and writes the terminal
  result atomically.
- Stale, expired, denied, invalid, or unavailable confirmation performs zero
  domain writes.
- A temporary database error rolls back ledger claim, handler effects, and
  result together; the unchanged preview is retryable with the same key.
- Domain success with ledger failure, or ledger success with domain failure, is
  impossible because both are in the same transaction.
- Lifecycle is exactly `PREVIEWED -> SUCCEEDED | REJECTED | EXPIRED`.
- There is no `PROCESSING` state, external lease, lease token, worker, polling,
  provider call, or AI execution in preview, confirm, expiry, or replay.

## Exact Command Allowlist

1. `goal_proposal.create_draft` creates a canonical Goal proposal in `DRAFT`;
   Targets exist only as nested proposal-revision input.
2. `goal_proposal.append_returned_revision` appends only to the actor's exact
   `RETURNED` proposal at the expected revision; Targets remain nested only.
3. `goal_check_in.append` appends canonical check-ins, including a correction
   binding when supplied, and never edits check-in history.
4. `tension.raise` creates one Tension; the user must explicitly confirm the
   exact `handlingMode` and routing in preview.
5. `tactical_outcome.submit_proposal` submits or revises a tactical proposal
   only after proposal submission is extracted into a canonical service.
6. `meeting_notes.update` updates notes by exact `notesRevision` compare-and-swap.

## Forbidden Commands

- Goal proposal submit and withdraw.
- Strategic Goal adoption, return, decline, close, or any strategic decision.
- Tactical outcome approve, return, reject, or any tactical decision.
- Goal work-link create, remove, replace, or status change.
- Direct Project or Action create; Project/Action status, bearer, owner, assignee,
  responsibility, or deadline mutation outside an allowed proposal payload.
- All governance proposals, decisions, applications, logs, and structure writes.
- Meeting agenda execution, meeting end, participant changes, or decision capture.
- Project/Action creation from a tactical proposal before meeting approval; only
  the canonical meeting decision path may create those outcomes.

## Public Errors

- `INVALID_COMMAND`: discriminant is not in the exact allowlist.
- `INVALID_INPUT`: command data or confirmation transport fails the closed schema.
- `NOT_AVAILABLE`: an owner-private or tenant-scoped object is not safely visible.
- `ACCESS_DENIED`: the known owner no longer has required current authority.
- `PREVIEW_EXPIRED`: server expiry passed; ledger transitions to `EXPIRED`.
- `STALE_PREVIEW`: any bound object, revision, source version, route, or hash changed.
- `IDEMPOTENCY_CONFLICT`: one organization mutation key has a different binding.
- `INVALID_STATE`: the canonical object lifecycle does not allow the command.
- `RETRY_CONFLICT`: one preview was confirmed or claimed with another mutation key.
- `TEMPORARY_FAILURE`: retryable transaction, connectivity, or database failure.
- Public responses contain only the code, fixed safe message, preview/result id
  when authorized, and an opaque correlation id.
- Unknown exceptions are logged privately and exposed only as a redacted
  `TEMPORARY_FAILURE`; SQL, stack, schema, ids, credentials, and provider details
  never enter the public response.

## Schema/Migration/Rollback

- Add one owner-private `BrainCommandOperation` ledger and one closed status enum:
  `PREVIEWED`, `SUCCEEDED`, `REJECTED`, `EXPIRED`.
- The additive model stores the preview ownership/bindings, immutable payload and
  hashes, diff, expiry, nullable mutation key, terminal public code, result, and
  created/confirmed/completed timestamps.
- Database constraints enforce a known command discriminant, 64-character hash
  shapes, exact 15-minute expiry, valid lifecycle terminal fields, and immutable
  preview columns after insert.
- Indexes include primary id, unique `(organizationId, mutationKey)`, owner plus
  creation time, organization/status/expiry, and conversation/user-message lookup.
- The migration grants no model, browser, Brain reader, or public database role
  direct ledger access.
- Reader provisioning, database admission, migration grants, and rollback scripts
  MUST enumerate all five new views; admission fails on a missing/extra view or
  privilege, and rollback revokes then drops exactly those five views.
- `BrainCommandOperation` is never granted to `loopos_brain_reader`, never enters
  its admission allowlist, and is inaccessible through every Brain read view.
- The migration is additive and changes no existing Goal table, enum, column,
  constraint, index, row, or foreign-key behavior.
- Guarded rollback first aborts if any ledger row exists; only an empty ledger may
  be dropped, followed by the new enum and its dedicated grants.
- Rollback never deletes or rewrites organization-domain records.

## Authorization Matrix

| Command | Fresh confirm authority |
| --- | --- |
| `goal_proposal.create_draft` | Current organization member; canonical cycle, Circle, Role, parent Goal, Metric, replacement, and shape checks pass. |
| `goal_proposal.append_returned_revision` | Current member is exact proposer; proposal is `RETURNED`; expected revision matches. |
| `goal_check_in.append` | Current active owner-Role assignee, or participant in the exact unended same-Circle `TACTICAL`/`STRATEGY` meeting. |
| `tension.raise` | Current member; server binds raiser and organization; referenced Circle/route remains authorized. |
| `tactical_outcome.submit_proposal` | Exact Tension raiser and participant in the exact selected unended tactical meeting; provenance, route, revision, Circle, and responsible Person remain valid. |
| `meeting_notes.update` | Participant in the exact unended meeting; exact `notesRevision` matches. |

- Admin status is not a bypass for proposer, owner-Role, raiser, participant,
  meeting, source-version, or revision checks.
- Read visibility never grants command authority.

## Implementation Slices

- `M3-B Goal read`: gate on five security-barrier views, catalog/evidence/turn
  coverage, truncation persistence, and query audit; no command or Goal-table write.
- `M3-C ledger/registry no handlers`: gate on additive schema, constraints,
  owner isolation, migration/rollback, and six union variants; no domain handler or UI.
- `M3-D1 Goal draft/check-in`: gate on canonical transaction adapters, stale and
  replay PostgreSQL evidence; no submit, withdraw, decision, or work-link command.
- `M3-D2 Tension/tactical proposal`: gate on canonical tactical submit service
  extraction with no behavior drift and authority parity; no tactical decision or direct Project/Action write.
- `M3-D3 notes`: gate on participant, ended-meeting, revision, replay, and stale
  evidence after no-drift canonical service extraction; no agenda, participant, end-meeting, or decision behavior.
- `M3-E Brain UI`: gate on owner-only preview/diff/confirm/result browser evidence;
  no direct domain action call, auto-confirm, or model-selected authority data.
- `M3-F acceptance/cleanup`: gate on all evidence, independent review, rollback
  rehearsal, and disposable-resource cleanup; no feature or allowlist expansion.

## Evidence Gates

- Contract: independent review accepts this file with no open P0/P1/P2.
- Source: focused tests prove exact resources, fields, URLs, redaction, versions,
  command union, forbidden inputs, errors, lifecycle, and no generic dispatch.
- PostgreSQL: prove `security_barrier`, tenant denial, reader-only grants, source
  versions, effective check-ins, atomic success, rollback, concurrency, stale
  denial, same-binding replay, different-binding conflict, and no domain bypass.
- Replay: prove successful notes and tactical commands replay after their own
  writes changed revision/source pre-state, without fresh pre-state checks or writes.
- Tension: prove an unauthorized `BLOCKING_TENSION` link contributes no row,
  relation, count, `hasMore`, audit, label, id, or URL oracle.
- Turn service: prove deterministic persisted truncation evidence for model on,
  off, timeout, throw, and invalid response, five-plus-marker capping, packet
  `EVIDENCE_ONLY` fallback, and query-audit `hasMore` preservation.
- Authorization: prove every matrix row with allowed, revoked, foreign-tenant,
  wrong-Role, wrong-proposer, wrong-raiser, wrong-meeting, and ended-meeting cases.
- Browser: prove preview contents, explicit confirmation, owner privacy, expiry,
  stale denial, refresh-durable replay, redacted errors, and no silent execution.
- Final: scoped TypeScript/lint/build/Prisma validation, migration rollback rehearsal,
  authenticated browser evidence, cleanup, final `/review`, and roadmap audit.
- No static or source-only check may be reported as runtime or end-to-end proof.

## Ownership/No-Touch

- M3-A owns only
  `docs/plans/2026-07-15-v5-m3-command-boundary-goal-read-surface-contract.md`.
- All production code, schema, migrations, generated Prisma output, tests,
  `GOALS.md`, roadmap documents, deployment files, and unrelated dirty work are
  no-touch until this contract is independently accepted and a slice is activated.
- Future slices own only files explicitly assigned in their activation brief.
- Existing Goal business tables and governance decision paths remain no-touch
  throughout M3 except for calls through accepted canonical services.

## Risks Closed

- Generic model-to-database writes are closed by the static union and server data.
- Tenant and owner leakage are closed by barrier views, fresh actor resolution,
  owner-private ledger lookup, and existence-hiding `NOT_AVAILABLE`.
- Stale intent is closed by immutable hashes, source bindings, 15-minute expiry,
  fresh authority checks, and locked compare-and-swap.
- Duplicate mutation is closed by organization-scoped keys and stored replay.
- Partial success is closed by one transaction for claim, domain write, and result.
- Tension leakage is closed by omitting the entire unauthorized blocking-link row,
  including every existence, count, truncation, relation, id, label, and URL oracle.
- Tactical authority bypass is closed by proposal-only scope and meeting-only
  Project/Action creation.
- False completeness is closed by deterministic persisted truncation evidence.

## Blockers

- No external blocker and no product blocker.
- M3-B Goal-read production work may begin within its locked ownership and
  evidence gate; all command execution remains inactive.
- Meeting-agenda and tactical proposal service extraction are later implementation dependencies, not current blockers.
