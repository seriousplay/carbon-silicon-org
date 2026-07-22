# V5-M2 Goal Domain and Lifecycle Contract

Status: accepted on 2026-07-15 after same-reviewer reclosure with no P0/P1/P2
Accepted slice: `V5-M2-A`
Design source: `docs/plans/2026-07-14-organization-brain-goal-tree-v5-design.md`

## 1. Contract Boundary

This contract locks the additive Goal domain before production implementation.
It preserves the accepted Organization Brain read boundary and the canonical
tactical and governance flows.

M2-A changes no Prisma schema, migration, Server Action, page behavior, meeting
behavior, Brain resource, package metadata, or deployment state.

## 2. Existing Data Classification

| Existing data | Decision | M2 use |
| --- | --- | --- |
| `Circle.purpose` and `Circle.parentId` | Related but insufficient | Circle identity and hierarchy validation only; never Goal content |
| `Project.goal` | Must not repurpose | Remains a legacy project-result string |
| `Metric` | Reusable evidence source | Optional source for a numeric Target; never Target history or Goal state |
| weekly review / `GovernanceLog` | Related but insufficient | May link to Goal context later; never canonical Goal history |
| `Meeting` with `STRATEGY` type | Reusable process source | Exact strategic confirmation context |
| `DecisionRecord` | Related but insufficient | Not reused as Goal lifecycle history |
| `ChangeLog` | Must not repurpose | Remains structural governance history |
| `Tension` | Reusable work relation | Blocking gap or approved Action relation only |
| `Project` | Reusable work relation | Execution relation only |
| Goals route | Reusable shell | Replaced by the real Goal Tree without presenting Projects as Goals |

No existing row is backfilled into the Goal domain. Existing Goal-like text is
not treated as confirmed Goal data.

## 3. Canonical Concepts

- `GoalCycle`: one organization-wide time box shared by every Circle.
- `GoalProposal`: a distributed proposal to create, replace, or close a Goal.
- `GoalProposalRevision`: an immutable snapshot of one proposal revision and
  its proposed Targets.
- `GoalProposalTarget`: one immutable, typed Target definition belonging to one
  exact proposal revision.
- `GoalDecision`: an immutable strategic-meeting result for one exact proposal
  revision.
- `Goal`: the confirmed, time-bounded primary outcome of one Circle.
- `GoalTarget`: one immutable numeric or milestone success condition.
- `GoalCheckIn`: one immutable evidence update for one Target.
- `GoalWorkLink`: an explicit relation to a Project, approved Action, or
  blocking Tension; it grants no authority over that work object.

Purpose, Goal, Target, Metric, Project, Action, and Tension remain distinct.

## 4. Lifecycle

### 4.1 GoalCycle

States:

- `PLANNED -> ACTIVE -> CLOSED`
- `PLANNED -> CANCELLED`

- `startAt < endAt` and `checkInCadenceDays > 0`.
- An organization may prepare multiple planned cycles but has at most one
  `ACTIVE` cycle.
- Planned cycles may be edited. Cancellation is allowed only when every related
  proposal is already terminal; it preserves those proposal records and freezes
  the cycle.
- A cycle can close only when it has no `ACTIVE` Goal. Closing does not silently
  close Goals.
- A closed or cancelled cycle and all of its lifecycle evidence cannot be
  updated or deleted.
- A new cycle never copies or activates Goals automatically.

### 4.2 GoalProposal

Kinds: `CREATE`, `REPLACE`, `CLOSE`.

States:

- `DRAFT -> SUBMITTED`
- `SUBMITTED -> ADOPTED | RETURNED | DECLINED`
- `RETURNED -> DRAFT` by appending a new revision
- `DRAFT | RETURNED | SUBMITTED -> WITHDRAWN` by the proposer

`ADOPTED`, `DECLINED`, and `WITHDRAWN` are terminal. A proposal is never edited
in place: each content change appends a `GoalProposalRevision` with a strictly
increasing revision number.

- `CREATE` has no replaced Goal.
- `REPLACE` names the current active Goal of the same Circle and cycle.
- `CLOSE` names the current active Goal and proposes `ACHIEVED` or
  `NOT_ACHIEVED` with a conclusion.
- Create and replace revisions contain title, intended outcome, owner Role,
  optional parent Goal support, and at least one proposed Target.

### 4.3 Goal

States: `ACTIVE`, `SUPERSEDED`, `ACHIEVED`, `NOT_ACHIEVED`.

- Adopting `CREATE` creates one `ACTIVE` Goal and its immutable Targets.
- Adopting `REPLACE` atomically marks the named active Goal `SUPERSEDED` and
  creates the replacement `ACTIVE` Goal.
- Adopting `CLOSE` atomically marks the named active Goal `ACHIEVED` or
  `NOT_ACHIEVED`.
- `ACHIEVED` is valid only when every Target's latest effective check-in is
  `ACHIEVED`. Otherwise the strategic decision may only close the Goal as
  `NOT_ACHIEVED`; its non-empty conclusion explains the evidence gap.
- A terminal Goal never becomes active again. Correction requires a new
  proposal and a new immutable decision; history is not rewritten.
- A Goal definition and its Targets cannot be edited after confirmation.
- The database, not a UI precheck, enforces at most one `ACTIVE` Goal for
  `(organizationId, cycleId, circleId)`.

## 5. Ownership and Process Authority

### 5.1 Cycle administration

An active `ORG_ADMIN` may create, activate, and close the shared cycle as an
organization calendar operation. This authority cannot create, replace, or
close a Circle Goal.

### 5.2 Distributed proposal authority

Any active organization Person may create a Goal proposal for a Circle. Only
the proposer may append revisions, submit, resubmit, or withdraw it. No Circle
lead or administrator receives an implicit veto or unilateral Goal decision.

### 5.3 Strategic confirmation

A proposal can be decided only when all conditions hold:

1. The proposal is `SUBMITTED` at the exact current revision.
2. The meeting is an unended `STRATEGY` meeting in the same organization and
   Circle.
3. The proposer and recorder are current participants in that meeting.
4. The cycle is `ACTIVE` for adoption; return and decline remain available for
   a planned-cycle proposal.
5. The recorder is any current meeting participant, including the proposer.

The recorder records the process result; power comes from the meeting process,
not from job title. Ending a meeting never implies Goal confirmation. Every
decision uses a mutation key, exact revision, fresh authorization, and one
transaction. Concurrent adoption is resolved by database constraints and one
winner; no retry may create a second visible Goal.

### 5.4 Role-bound follow-up

- `Goal.ownerRoleId` must reference an active Role in the same Circle.
- Any current assignee of that still-`ACTIVE` Role may append a check-in.
- An administrator without that Role or exact meeting participation has no
  additional check-in authority.
- Existing Project bearers and Action owners remain Person-bound. Goal ownership
  does not overwrite or infer those assignments.
- If the Role becomes inactive or unassigned, all Role-derived check-in
  authority is revoked immediately and the Goal remains visible as an ownership
  gap. Changing the owner Role requires a replacement proposal. Exact meeting
  participants retain only the meeting-scoped authority defined below.

### 5.5 Tactical and governance boundaries

- A same-Circle `TACTICAL` meeting reads the active Goal and latest evidence.
- A current tactical participant may confirm a check-in through that meeting.
- Tactical processing may create or link a Tension, Project, or Action through
  the existing proposal and approval chain. It cannot change Goal definition,
  Targets, owner Role, parent support, or lifecycle state.
- Governance remains structural only. Governance pages and operations receive
  no Goal mutation command.

## 6. Parent Support and Goal Tree

- A root Circle Goal has no parent Goal.
- On adoption, a non-root Circle Goal must explicitly reference the current
  active Goal of its immediate parent Circle in the same organization and cycle.
- The database validates same tenant, same cycle, and the Circle parent-child
  relationship at confirmation time.
- Replacing a parent Goal does not rewrite child Goals. Existing child support
  remains historical and the current tree shows a stale-alignment gap until
  each child Circle confirms a replacement.
- Missing child Goals, missing parent support, inactive owner Roles, and stale
  evidence are visible gaps, not inferred relationships.
- M2 does not alter Circle hierarchy or require governance to rewrite Goals.
- Before M2 constraints are installed, migration preflight rejects any existing
  cross-tenant parent, self-parent, or hierarchy cycle. M2 adds a tenant-composite
  Circle parent foreign key, self-parent check, and cycle-prevention trigger;
  these reject invalid structure without adding a new governance operation.
- An organization must have exactly one non-archived root Circle before a Goal
  cycle can activate. Zero or multiple roots do not block migration, but cycle
  activation and Goal adoption fail closed with an Organization integrity gap
  until governance repairs the structure.

## 7. Targets, Check-Ins, and Health

Target kinds: `NUMERIC`, `MILESTONE`.

- Numeric Target: non-null, unequal `baselineValue` and `desiredValue`, plus a
  non-empty `unit`; optional same-Circle `Metric`; no milestone acceptance
  criteria.
- Milestone Target: non-empty acceptance criteria; no numeric values, unit, or
  Metric.
- A Goal has at least one Target. Target order is explicit and stable.
- No field stores a manually entered total Goal completion percentage.

Each `GoalCheckIn` addresses exactly one Target. A single UI submission may
append several check-ins in one transaction, but each row remains independently
attributable. It records:

- fact and evidence summary;
- numeric current value or milestone completion, according to Target kind;
- confirmed assessment: `ON_TRACK`, `AT_RISK`, `OFF_TRACK`, or `ACHIEVED`;
- recorder Person, optional exact meeting, timestamp, and optional source link;
- optional `supersedesCheckInId` for an append-only correction chain.

Check-ins cannot be updated or deleted. A superseded row remains history.
`supersedesCheckInId` has a unique constraint and a tenant/Goal/Target composite
foreign key, so one correction cannot branch and cannot cross Targets. The
effective evidence is the unsuperseded row ordered by `(recordedAt DESC, id
DESC)`; the ID tie-break is mandatory and covered by tests. Concurrent ordinary
updates may both commit, but the same ordering produces exactly one effective
row. Concurrent corrections of the same row have one database winner.

Validation rules:

- Numeric `ACHIEVED` is accepted only when the current value reaches or crosses
  the desired value in the baseline-to-desired direction.
- Milestone `ACHIEVED` requires completion plus non-empty acceptance evidence.
- A meeting-sourced check-in requires an unended same-Circle `TACTICAL` or
  `STRATEGY` meeting and a current participant recorder.

Goal health is derived, never entered:

1. A terminal Goal yields `ACHIEVED` or `NOT_ACHIEVED` from its confirmed close.
2. An active Goal with no effective check-in yields `NOT_UPDATED`.
3. An active Goal past cycle end yields `OFF_TRACK` until strategically closed.
4. If every Target is `ACHIEVED`, Goal health is `ACHIEVED`.
5. Any `OFF_TRACK` Target yields `OFF_TRACK`.
6. Any missing Target check-in, `AT_RISK` Target, or non-achieved Target older
   than `checkInCadenceDays` yields `AT_RISK`.
7. Otherwise the Goal is `ON_TRACK`.

## 8. Work Alignment

`GoalWorkLink` is an explicit many-to-many relation with kind `PROJECT`,
`ACTION`, or `BLOCKING_TENSION` and state `ACTIVE` or `REMOVED`.

- Exactly one Project or Tension reference is populated according to kind.
- `ACTION` must reference the approved Action outcome represented by the current
  Tension-based Action model.
- All records share one organization; cross-tenant links fail closed.
- A link is created `ACTIVE`. Duplicate active Goal/kind/work-object links are
  rejected by a partial unique index.
- A current owner-Role assignee or exact same-Circle tactical participant may
  move it once from `ACTIVE` to `REMOVED`, recording actor, optional meeting,
  timestamp, and reason. It cannot be deleted or reactivated; relinking creates
  a new row and preserves the removed history.
- Creating a link does not change work status, owner, bearer, or process
  authority.
- Tactical output can create the link atomically after its existing approval.

## 9. Persistence Invariants

The first schema slice must provide:

- tenant-composite keys and foreign keys for every Goal relation;
- partial unique indexes for one active cycle per organization and one active
  Goal per Circle and cycle, plus one active instance of each work link;
- type-shape checks for proposal Targets, canonical Targets, check-ins, and work
  links;
- tenant-composite proposal revision/Target, Goal/Target/check-in correction,
  Goal/work, and Circle parent relations;
- confirmation-time triggers for owner Role/Circle and parent Goal hierarchy,
  plus migration-preflight and runtime Circle hierarchy guards;
- legal lifecycle transition checks;
- database denial of update/delete for proposal revisions, decisions, Targets,
  check-ins, and closed historical records;
- restrictive deletes so Circle, Role, Meeting, Metric, Person, Project, and
  Tension deletion cannot erase Goal history;
- idempotent strategic operations keyed within the organization.

Application validation may improve errors but cannot replace these database
invariants.

## 10. Migration and Rollback

- The migration is additive: new enums, tables, indexes, triggers, and relations
  only. It does not rename, reinterpret, or backfill existing Goal-like data.
- Apply on the complete migration stack, reverse-review, and clean reapply in a
  disposable PostgreSQL database.
- Empty-schema rollback removes M2 objects in dependency order and restores the
  exact pre-M2 schema.
- Destructive rollback must abort when any M2 business row exists. After real
  data exists, operational rollback is an application disable/forward-fix; it
  never drops Goal history.
- Migration evidence must include two tenants, concurrency, immutability,
  hierarchy, cardinality, non-empty rollback denial, and zero residue cleanup.

## 11. Bounded Implementation Slices

1. `V5-M2-B1 - Goal Persistence Foundation`: Prisma schema, one additive
   migration, rollback guard, database invariants, and focused schema tests.
2. `V5-M2-B2 - Goal Domain Operations`: cycle administration, proposal
   revisions, strategic decisions, check-ins, health derivation, work links,
   fresh authorization, transactions, and idempotency. No UI.
3. `V5-M2-C1 - Goal Tree and Drafting`: operational `/app/goals` tree/detail,
   proposal drafting, missing-alignment states, desktop/mobile accessibility.
4. `V5-M2-C2 - Strategic Confirmation`: exact `STRATEGY` meeting workbench for
   adopt/return/decline, replacement, closure, and provenance.
5. `V5-M2-D - Tactical Inspection and Workspace Alignment`: read-only Goal
   inspection, check-in, existing tactical outcome linkage, and Workspace Goal
   context without governance changes.
6. `V5-M2-E - Acceptance and Cleanup`: full source, PostgreSQL, browser,
   security, review, roadmap audit, and disposable-resource cleanup.

Only one implementation slice is active at a time. Every slice requires an
independent review with no open P0/P1/P2 before the next slice activates.

## 12. Acceptance Evidence

Static and unit evidence:

- every lifecycle transition, authority rule, Target shape, health rule,
  correction chain, work-link kind, and no-touch boundary;
- full source tests, TypeScript, scoped ESLint, Prisma validate, and production
  build.

Database evidence:

- complete migration apply, guarded rollback, clean reapply;
- two-tenant denial, tenant-composite FKs, one-active constraints, exact parent
  support, immutable history, legal transitions, and concurrent adoption;
- Role assignment and meeting participation checks with administrator denial;
- no writes through the accepted M1 Brain read identity.

Browser evidence at desktop and mobile:

- ordinary member proposes a root Goal and child Goal;
- exact strategic participants adopt them, including proposer-as-recorder;
- Role assignee records numeric and milestone evidence and corrects by
  supersession;
- tactical inspection creates and links a Tension, Project, or Action through
  the existing approval path without mutating Goal state;
- Goal Tree and Workspace show current alignment, stale/missing support,
  evidence age, health, linked work, and source navigation;
- administrator receives no implicit strategic or check-in authority;
- governance has no Goal controls; ending a meeting alone confirms nothing;
- second tenant cannot discover Goal existence, counts, IDs, or values;
- model-off operation, keyboard access, interaction budget, and no actionable
  console/network errors.

M2 does not add Organization Brain Goal reads or writes. Those activate only in
V5-M3 after M2 is accepted.
