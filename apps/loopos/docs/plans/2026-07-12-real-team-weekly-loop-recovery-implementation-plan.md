# LoopOS Real-Team Weekly Loop Recovery Implementation Plan

Status: Slices 0 through 3 closed; Slice 4 weekly rhythm and real-team acceptance active

Date: 2026-07-12

Design: `docs/plans/2026-07-12-real-team-weekly-loop-recovery-design.md`

## 1. Delivery Contract

Goal: deliver and browser-prove one low-friction, multi-user weekly LoopOS cycle from organization invitation and ordinary tension routing through distributed tactical or governance decisions to durable closure and weekly review.

Only one implementation slice is active at a time. A later slice may not begin until the current slice has:

- focused tests;
- required static or database evidence;
- browser-visible output where specified;
- one independent read-only review;
- at most one concentrated correction;
- same-reviewer closure;
- roadmap and dashboard synchronization.

The coordinator owns `GOALS.md`, `progress-dashboard.html`, integration, and evidence gates. Workers must not edit those files unless a task explicitly grants ownership.

All workers must preserve concurrent dirty work. They may stage or commit only their owned files and must not use destructive Git commands.

Worker return format:

- Conclusion
- Changes
- Evidence
- Blockers

## 2. Baseline and Fixed Decisions

Current baseline:

- `main` includes approved recovery design commit `1ecb61a`.
- The worktree already contains uncommitted changes in `src/app/app/meetings/[id]/governance-workbench.tsx` and `src/app/app/meetings/[id]/proposal-actions.ts`.
- Those changes must be understood and incorporated, never overwritten or reverted.
- Current Prisma migrations are applied.
- TypeScript and scoped governance ESLint pass.
- The full suite currently reports 188 pass and one stale persistence assertion failure.
- Browser governance actions currently use the unsafe legacy engine.
- Independent bypass inventory found browser-reachable direct structure, Project, Action, decision, and candidate writes outside approved meeting proposals.
- Current database evidence contains zero `GovernanceDecisionProcess` rows and no longitudinal weekly-use proof.

Fixed product decisions:

- tactical means work changes without organization-structure changes;
- governance means organization-structure changes;
- the tension raiser owns proposal authorship;
- exact current meeting participants record meeting results;
- a proposer-participant may record adoption;
- AI guides but never decides;
- the first canonical structure application is `ROLE_CREATED` only;
- ordinary tension provenance must not create fake interface workflow runs;
- legacy governance records remain readable but cannot perform new writes.
- organization structure includes roles, circles, circle interfaces, post-onboarding home ownership, circle leadership, and charters;
- registration, invitation onboarding, and one-time pristine-organization template setup are the only direct bootstrap exceptions;
- every Project creation and Action assignment requires an approved tactical proposal;
- normal Project/Action lifecycle closure belongs only to the responsible bearer/owner; escalation titles do not confer completion or reassignment authority.

## 3. Validation Commands

Every implementation slice runs the smallest relevant subset plus these common gates when its scope warrants them:

```bash
./node_modules/.bin/prisma validate
./node_modules/.bin/tsc -p tsconfig.json --noEmit
./node_modules/.bin/eslint <owned source files>
# Use the repository literal-path runner; direct tsx --test globs [id] directories.
node scripts/run-source-tests.mjs
git diff --check
```

Database behavior tests must use a disposable database named explicitly for the slice. Tests must never mutate the normal `loopos` development database unless the coordinator has designated it as the disposable acceptance database.

Before editing Next.js application code, the worker must read the relevant current guides under `node_modules/next/dist/docs/`, especially Server Actions, forms, authentication, and caching/revalidation guidance used by the touched route.

## 4. Slice 0 - Security Stop and Green Baseline

Status: complete after implementation, review, final mobile/network browser reclosure, and roadmap/current-state audit recheck

### Outcome

No browser-reachable legacy governance action can mutate organization structure. Historical legacy proposals remain readable. The full test suite is green.

### Work package S0-A - Legacy governance stop

Owned files:

- `src/app/app/meetings/[id]/governance-workbench.tsx`
- `src/app/app/meetings/[id]/proposal-actions.ts`
- `src/app/app/meetings/[id]/page.tsx` for governance copy only
- `src/lib/interface-workbench/__tests__/persistence.test.ts`
- one focused new test file under `src/app/app/meetings/[id]/` if needed

### Work package S0-B - Direct structure bypass stop

Owned files:

- new `src/lib/bootstrap-authority.ts` and focused tests
- `src/app/app/circles/actions.ts`
- `src/app/app/circles/[id]/edit-action.ts`
- `src/app/app/circles/[id]/roles/actions.ts`
- `src/app/app/interfaces/actions.ts`
- `src/app/app/people/agent-action.ts`
- `src/app/app/setup/actions.ts`
- `src/app/app/governance/charter/actions.ts`
- `src/app/app/circles/page.tsx` for create-entry removal only
- `src/app/app/circles/new/page.tsx`
- `src/app/app/circles/[id]/page.tsx` for edit and role-create entry removal only
- `src/app/app/circles/[id]/edit/page.tsx`
- `src/app/app/circles/[id]/edit-form.tsx`
- `src/app/app/circles/[id]/roles/new/page.tsx`
- `src/app/app/circles/[id]/roles/new-form.tsx`
- `src/app/app/interfaces/page.tsx` for create-entry removal only
- `src/app/app/interfaces/new/page.tsx`
- `src/app/app/interfaces/new-form.tsx`
- `src/app/app/interfaces/data-pretraining/page.tsx` for direct interface-create entry removal only
- `src/app/app/people/page.tsx` for agent-create entry removal only
- `src/app/app/people/new-agent/page.tsx`
- `src/app/app/people/new-agent-form.tsx`
- `src/app/app/setup/page.tsx`
- `src/app/app/setup/init-form.tsx`
- `src/app/app/governance/page.tsx` for charter-create entry removal only
- `src/app/app/governance/charter/new/page.tsx`
- `src/app/app/governance/charter/new-form.tsx`

### Work package S0-C - Direct tactical bypass stop

Owned files:

- `src/app/app/projects/actions.ts`
- `src/app/app/projects/new-form.tsx`
- `src/app/app/projects/new/page.tsx`
- `src/app/app/projects/page.tsx` for entry-point removal only
- `src/app/app/meetings/[id]/actions.ts`
- `src/app/app/meetings/[id]/tension-processor.tsx`
- `src/lib/domain-operations.ts` only for the tracker mutation authorization boundary
- `src/lib/__tests__/domain-operations.test.ts` only for that boundary
- `src/app/app/tracker/actions.ts`
- `src/app/app/tracker/[id]/edit-action.ts`
- `src/app/app/tracker/[id]/edit-form.tsx`
- `src/app/app/tracker/[id]/edit/page.tsx`
- `src/app/app/tracker/[id]/page.tsx` for edit/transition visibility and approved-proposal trace only
- `src/app/app/tracker/[id]/transition-button.tsx`
- `src/app/app/meetings/[id]/tactical-outcome-actions.test.ts` only for tracker-boundary regressions
- new `src/app/app/tracker/actions.test.ts`
- new `src/app/app/tracker/[id]/edit-action.test.ts`

### Do not touch

- `src/lib/governance-decision.ts`
- `src/lib/governance-engine.ts`
- Prisma schema or migrations
- interface runtime implementation
- `src/app/app/meetings/[id]/tactical-outcome-actions.ts`
- `src/app/app/meetings/[id]/tactical-outcome-proposal.tsx`
- `GOALS.md`
- `progress-dashboard.html`

### Tasks

1. Preserve the current browser-native form work, but remove or disable every mutation control for legacy `PROPOSED`, `OBJECTED`, or other noncanonical governance proposals.
2. Make every exported legacy proposal mutation action fail closed with one stable user-facing result before writes.
3. Keep canonical `CANDIDATE` display read-only until Slice 3.
4. Add a visible explanation that historical proposals are read-only while the canonical governance process is being used for new decisions.
5. Remove the browser action import and call to `adoptProposal`.
6. Replace the stale persistence assertion that runtime models remain outside the original foundation with a current contract assertion that does not deny later reviewed migrations.
7. Add focused proof that legacy browser actions cannot reach a write dependency.
8. Replace meeting-page copy that promises automatic structure mutation with an accurate read-only transition message until Slice 3 activates canonical actions.
9. Add one pure, testable pristine-organization bootstrap guard. Only registration, invitation onboarding, and the dedicated setup action may use the bootstrap exception.
10. Make direct circle create/edit, role create, interface-relationship create, agent/home-circle structure create, and charter create/archive/ratify actions fail closed outside the bootstrap contract.
11. Remove or disable browser controls for every retired direct structure action while preserving historical read pages.
12. Make standalone Project creation fail closed and remove its browser entry points.
13. Make legacy meeting assignment, direct resolution, direct DecisionRecord conversion, pilot direct Project/Action resolution, and legacy governance-candidate creation fail closed before writes.
14. Require an approved Action-shaped `TacticalOutcomeProposal` before tracker edit or lifecycle mutation, including ordinary tensions; deny raw tension records and nonapproved proposals before writes.
15. Limit tracker edit, status transition, completion, and resolution to the current responsible owner. Circle lead, administrator, coach, facilitator, escalation, or technical access must not substitute for owner authority.
16. Keep tracker history and escalation notifications readable, but do not let the escalation scanner or escalation state grant edit, reassignment, completion, or resolution authority.
17. Keep the already-reviewed `TacticalOutcomeProposal` action and UI path reachable; Slice 0 must not disable the canonical distributed tactical proposal path.
18. Add a repository-wide bypass inventory test or equivalent explicit action matrix proving every retired Server Action fails before its write dependency.

### Evidence

- `rg` finds no browser action import or call of `adoptProposal`.
- focused action/UI tests prove all legacy mutations fail closed;
- full test suite passes with zero failures;
- TypeScript and scoped ESLint pass;
- browser shows legacy proposal history with no adopt, object, clarify, withdraw, or create mutation control;
- browser shows no standalone Project, direct structure, charter ratification, or legacy direct tension-result control outside permitted pristine setup;
- pristine setup succeeds once and is denied after operational history exists;
- direct invocation of every retired action returns a stable denial before writes;
- canonical `TacticalOutcomeProposal` actions remain available and unchanged;
- tracker direct-invocation tests prove an unapproved tension, nonowner, circle lead, administrator, and escalated title cannot edit, transition, complete, or resolve, while the responsible owner of an approved Action can do so;
- tracker browser evidence exposes controls only to the responsible owner of an approved Action and preserves historical trace for everyone otherwise authorized to read it;
- no Prisma model or database row changes during denied attempts.

### Rollback

Own-delta reverse patch for only the Slice 0 files. Restoring the unsafe legacy browser write path is not an acceptable production rollback; if the slice must be reverted, the meeting governance surface remains read-only.

## 5. Slice 1 - Team Entry and Multi-Participant Meetings

Status: complete; implementation, coordinator verification, independent review, roadmap audit, and product acceptance passed

### Outcome

An administrator can invite two people into the same organization. Three distinct accounts can be selected as meeting participants, maintain notes, and end a meeting.

### Schema and migration

Add a bounded invitation model with:

- organization ownership;
- normalized invited email;
- cryptographically random token hash, never a stored plaintext token;
- role limited to `ORG_MEMBER` for this milestone;
- optional home circle;
- creator, expiry, revocation, and consumed timestamps;
- unique token hash and indexed organization/email state.

Add optimistic notes revision and meeting completion data if the existing `Meeting` model cannot safely support shared notes:

- `notesRevision` integer defaulting to zero;
- `endedAt` nullable timestamp;
- optional `endedById` with tenant-safe relation.

Migration must include reverse SQL and database constraints for invitation terminal states and tenant-safe references.

### Owned implementation areas

- `prisma/schema.prisma`
- one new additive migration
- generated Prisma client files produced by the approved generation command
- `src/app/(auth)/actions.ts`
- new `/invite/[token]` route and actions
- new recoverable `/onboarding` route
- organization-member invitation controls under `src/app/app/people/`
- `src/app/app/meetings/new-form.tsx`
- `src/app/app/meetings/actions.ts`
- meeting detail participant/notes controls in new narrowly scoped components and actions
- focused invitation and meeting-collaboration tests

### Tasks

1. Implement admin-only invitation creation with an expiring single-use link.
2. Implement invitation acceptance for new and existing user identities.
3. Atomically create or connect `Membership` and organization-scoped `Person`.
4. Implement recoverable onboarding for an authenticated user without a current person record.
5. Add organization-scoped participant selection to meeting creation.
6. Add participant maintenance with current-participant visibility and authority checks.
7. Add optimistic-concurrency shared notes updates.
8. Add participant-authorized meeting completion.
9. Revalidate only affected routes and return stable, understandable errors.

### Focused tests

- invitation creation requires current organization admin;
- token is hashed and plaintext is not persisted;
- acceptance joins the existing organization and does not create another organization;
- expired, revoked, consumed, email-mismatched, and cross-tenant invitations produce zero membership/person writes;
- acceptance replay is stable;
- meeting participant IDs must belong to the current organization;
- participant removal revokes future result authority without rewriting history;
- stale notes revision cannot overwrite newer notes;
- nonparticipant cannot update notes or end the meeting.

### Browser evidence

- administrator creates invitation links;
- two invited accounts join the same organization;
- all three people appear in participant selection;
- a meeting opens with all selected participants visible;
- two participants update notes without silent overwrite;
- a nonparticipant is denied;
- meeting completion remains correct after refresh;
- desktop and 390px forms remain usable.

### Coordinator evidence gathered

- Focused tests passed 9/9 for invitation/onboarding and meeting collaboration.
- Full source runner passed 31/31 files and 226/226 tests.
- TypeScript, Prisma validate, production build, and scoped ESLint passed; scoped ESLint had zero errors and two pre-existing warnings in `src/app/app/meetings/[id]/ai-buttons.tsx`.
- Disposable PostgreSQL migration evidence passed full apply, rollback absence for `organization_invitations` and the three meeting collaboration columns, and fresh reapply.
- Local Playwright production evidence on `http://127.0.0.1:3198` proved admin registration, two invitations, two invited joins into the same organization, three-account people list, three-participant meeting creation, stale shared-notes conflict, participant meeting completion, and 390px meeting usability.
- Browser database proof showed exactly one `RTW1 S1 Org 1783894895b`, 3 memberships, 3 people, two consumed invitations, and one ended three-participant meeting with `notesRevision=1`.
- Temporary production server and disposable browser database were cleaned up after evidence capture.
- Independent implementation review `019f586f-d0b1-7360-99ed-88da783a8c3a` initially found one P1 cross-tenant `circleId` meeting-creation defect and one P2 test-depth risk. The concentrated correction added current-organization, non-archived circle validation before meeting creation and a focused assertion for that boundary.
- Same-reviewer recheck `019f586f-d0b1-7360-99ed-88da783a8c3a` returned PASS with no findings.
- Roadmap/current-state audit `019f5873-b94f-7273-9835-64b875834444` initially found only stale-status wording; after targeted corrections, the same auditor returned PASS with no findings.
- Product owner directed `继续实行slice 2` on 2026-07-13, accepting Slice 1 and activating Slice 2.

### Rollback

Drop invitation and meeting-note additions only after proving no accepted invitation or new meeting notes depend on them in the disposable database. Production rollback must preserve accepted memberships and notes through a forward correction rather than destructive deletion.

## 6. Slice 2 - Ordinary Tactical Tension Closure

Status: complete; implementation, concentrated correction, same-reviewer recheck, coordinator verification, cleanup, roadmap audit, and product acceptance passed

### Outcome

An ordinary person-raised tactical tension appears in the correct tactical meeting, becomes a participant-approved Project or Action, and can be closed by its responsible person.

### Schema and migration

Add an explicit tension handling mode:

- `UNROUTED`
- `TACTICAL`
- `GOVERNANCE`

Existing tensions default to `UNROUTED`; no historical record is silently classified.

Generalize `TacticalOutcomeProposal` provenance with:

- `ORDINARY_TENSION` or `INTERFACE_RUN` provenance kind;
- nullable runtime and artifact fields that are required as one all-or-none group only for `INTERFACE_RUN`;
- direct provenance bound to organization, tension, proposer, and exact tactical meeting;
- unchanged immutable proposal revision and result authority.

Replace the free-form Project status string with a bounded enum only if the migration can preserve every existing value without coercion. Otherwise enforce the existing three states through the service and defer the enum conversion.

### Owned implementation areas

- Prisma schema, one additive migration, and generated client
- `src/app/app/tensions/new/page-client.tsx`
- `src/app/app/tensions/actions.ts`
- tension detail routing action for existing `UNROUTED` records
- tactical queue query in `src/app/app/meetings/[id]/page.tsx`
- tactical outcome proposal actions, authority, UI, and tests
- Project lifecycle actions and detail controls
- Action lifecycle authority and existing tracker controls/tests

### Tasks

1. Add one low-friction tactical/governance choice to tension capture.
2. Record AI suggestion separately from the raiser's confirmed mode.
3. Add a one-time explicit route control for existing unrouted tensions.
4. Make tactical meetings list ordinary open tactical tensions plus valid runtime-routed tactical tensions.
5. Update tactical proposal authority to accept exact direct or runtime provenance without weakening proposer/participant rules.
6. Preserve proposer revision semantics and participant result recording.
7. Add Project bearer lifecycle actions: pause, resume, complete.
8. Keep normal Action lifecycle updates and resolution with the responsible owner only. Model escalation separately; circle lead, administrator, coach, or facilitator titles do not grant edit, reassignment, completion, or resolution authority.
9. Persist completion actor/time and preserve source trace.

### Focused tests

- a tension appears in exactly one meeting-type queue;
- AI suggestion never writes the confirmed mode by itself;
- only the raiser can confirm or change routing before processing;
- ordinary tactical proposal requires the exact meeting and participant proposer;
- runtime tactical route still requires exact artifacts;
- nonparticipant result recording performs zero writes;
- proposer-participant can record approval;
- approved Project or Action is created exactly once;
- Project bearer lifecycle authority and stale transition behavior;
- lead/admin/coach/title-only Action completion and resolution attempts produce zero writes;
- Data -> Pretraining regression remains unchanged.

### Browser evidence

- ordinary member raises a tactical tension;
- tension appears in the selected tactical meeting without runtime terminology;
- raiser submits Project and Action variants;
- another participant records returned and approved outcomes;
- proposer-participant self-records an approved outcome;
- Project bearer completes the Project;
- Action owner resolves the Action;
- source tension, meeting, proposal, responsible person, and completion remain linked after refresh;
- desktop and 390px paths pass.

### Coordinator evidence gathered

- Full source runner passed 33/33 files and 235/235 tests; TypeScript, Prisma validate/generate, production build, scoped ESLint with zero errors, and diff checks passed.
- Independent reviewer `019f586f-d0b1-7360-99ed-88da783a8c3a` initially found a P1 global-versus-tenant mutation-key mismatch and a P2 non-tenant-safe Project completion actor relation. One concentrated correction changed both to organization-scoped composite constraints and selectors; same-reviewer recheck returned PASS with no findings.
- Disposable PostgreSQL applied all 17 migrations, exposed the required handling/provenance fields, enforced ordinary/runtime all-or-none provenance, tenant-scoped mutation keys, and a tenant-safe Project completion actor, then passed Slice 2 rollback and fresh reapply.
- Three-account browser fixture `RTW1 S2 Org 1783897000c` proved two ordinary tactical tensions in one three-participant meeting. Another participant approved and completed the Project; the proposer-participant self-recorded Action approval and resolved it as owner.
- Database proof showed both proposals `APPROVED` with `ORDINARY_TENSION`, the exact same meeting, and null runtime/artifact fields. The Project was completed by its bearer and the Action was resolved by its owner.
- Refresh preserved the complete ordinary source trace. Meeting and Action pages passed 390x844 without horizontal overflow. The accepted browser ledger had zero unexplained failures, 4xx/5xx responses, console warnings/errors, or page errors.
- The first two browser attempts were invalidated due only to automation locator/navigation timing and contributed no acceptance credit. The accepted run used fresh member sessions against the unchanged third fixture.
- The local server, browser sessions, and disposable PostgreSQL database were removed and confirmed absent after evidence capture.
- Independent roadmap/current-state audit `019f5873-b94f-7273-9835-64b875834444` initially found only three stale historical-tense dashboard lines. After targeted correction, the same auditor returned PASS with no findings. Product acceptance is the only remaining Slice 2 gate.
- Product owner replied `确认` on 2026-07-13, accepting Slice 2 and activating Slice 3.

### Rollback

The handling mode and provenance migration must include reverse SQL. Completed ordinary outcomes must not be destructively rolled back; use a forward compatibility correction if accepted data exists.

## 7. Slice 3 - Canonical Governance Closure

Status: complete and product-owner accepted

### Outcome

An ordinary or runtime-routed governance tension completes the reviewed distributed governance process and atomically applies one `ROLE_CREATED` structure change through `governance-decision.ts`.

### Schema and migration

Generalize governance decision provenance with:

- `ORDINARY_TENSION` and `INTERFACE_RUN` provenance kinds;
- runtime and artifact fields nullable only as one group;
- direct provenance bound to exact organization, source tension, proposal, proposer, and governance meeting;
- current revision, operation ledger, result, and structure-application constraints unchanged;
- database checks preventing mixed or incomplete provenance.

The migration must preserve every existing reviewed runtime constraint and include executable reverse SQL.

### Owned implementation areas

- Prisma schema, one additive migration, and generated client
- `src/lib/governance-decision.ts`
- `src/lib/__tests__/governance-decision.test.ts`
- governance persistence tests
- exact direct/runtime resolver in `src/lib/domain-operations.ts` or a narrowly scoped governance resolver module
- `src/app/app/meetings/[id]/proposal-actions.ts`
- `src/app/app/meetings/[id]/governance-workbench.tsx`
- meeting page governance projection and trace links
- focused Server Action and browser-boundary tests

### Tasks

1. Add an explicit provenance union to the governance domain input and context.
2. Preserve operation-specific authorization before claim, replay, or reclaim.
3. Implement direct ordinary-tension context loading without fake runtime records.
4. Keep runtime context validation exact and unchanged.
5. Add thin canonical Server Actions for initialize, request clarification, submit revision, raise objection, assess objection, record non-adoption, and adopt role.
6. Project current process state and complete immutable revision into the meeting card.
7. Guide objection entry through material harm, observed fact, reversibility, and safe-to-try fields without AI validity decisions.
8. Allow proposer-participant adoption recording and deny nonparticipants.
9. Display stable links to role, decision, change log, source tension, meeting, and runtime source where applicable.
10. Keep every unsupported structure category read-only and source tension open.
11. Retire direct DecisionRecord conversion, legacy governance-candidate creation, and every remaining `governance-engine.ts` caller.
12. Keep direct role, circle, interface-relationship, home-ownership, leadership, and charter writes fail closed until a corresponding typed canonical governance operation is approved in a later milestone.

### Focused tests

- direct and runtime provenance success;
- mixed provenance and missing direct/runtime bindings denied before claims;
- proposer-only revision authorship;
- current exact-meeting participant result authority;
- proposer-participant adoption;
- nonparticipant/admin/coach/lead title-only zero-ledger denials;
- valid and invalid objection paths;
- non-adoption and proposer revision reopening;
- exact same-key replay and changed-payload conflict;
- concurrent participant adoption creates one role outcome;
- every injected adoption failure rolls back effects and persists mandatory audit;
- terminal replay reauthorizes current actors;
- runtime governance regression remains unchanged.

### Database evidence

- migration apply, absence, rollback, and reapply;
- direct process cardinality and runtime process cardinality;
- one role, one decision, one change log, one role artifact, and one resolved source tension for successful adoption;
- zero operation rows and zero structure effects for denied pre-claim requests;
- one successful result under concurrent recording;
- failure and same-key retry evidence.

### Browser evidence

- ordinary governance tension initializes a canonical process;
- proposer submits complete initial and clarified revisions;
- participant requests clarification;
- participant raises objection;
- invalid objection returns the unchanged revision ready;
- valid objection requires proposer amendment;
- participant records non-adoption;
- proposer creates a later revision;
- proposer-participant records adoption;
- nonparticipant is denied;
- role and full trace appear after refresh;
- runtime-routed candidate completes the same process;
- desktop and 390px paths pass.

### Rollback

Rollback may remove only unapplied additive provenance support in a disposable database. Accepted governance outcomes are immutable organizational history and require forward correction, never destructive rollback.

### Current evidence

- Full source: 34/34 files and 244/244 tests; TypeScript, Prisma validation, diff checks, and production build pass.
- Disposable PostgreSQL: all 18 migrations applied; provenance and tenant-key constraints inspected; S3 rollback and fresh reapply passed.
- Ordinary browser: four accounts completed clarification, invalid and valid objections on one revision, amendment, non-adoption, later revision, proposer-participant adoption, nonparticipant denial, durable role/decision/change/tension trace, and 390px no-overflow proof.
- Runtime browser: exact candidate creation and meeting route persisted; meeting initialization and adoption preserved the runtime-source link and durable role trace.
- Accepted browser ledgers contain zero unexplained failed requests, 4xx/5xx responses, console errors, or page errors.
- Browser-driven corrections explicitly fixed submit-button semantics, repeated objection/assessment scopes, and uninitialized runtime-candidate identity/provenance display.
- Independent implementation re-review returned PASS with no findings. The same roadmap auditor returned PASS after five stale review-status statements were synchronized.
- Port 3200 and disposable database `loopos_rtw1_s3_main_1783899000` were removed and confirmed absent.
- The product owner explicitly accepted Slice 3 on 2026-07-13. Slice 4 is active.

## 8. Slice 4 - Weekly Rhythm and Real-Team Acceptance

Status: active

Engineering status: implemented, browser-rehearsed, review-closed, audit-closed, and cleaned up; product acceptance and designated real-team evidence remain open.

### Outcome

Normal members can see and act on the current weekly rhythm without navigating implementation-oriented interface runtime screens. One real team completes a weekly cycle.

### Owned implementation areas

- `src/app/app/page.tsx`
- role-aware navigation in `src/app/app/layout.tsx`
- narrow weekly rhythm query/service module
- worker notification implementation and focused tests
- any small presentation components required by the weekly action queue
- browser fixtures/scripts that do not ship product-only shortcuts

### Tasks

1. Add a compact home-page weekly action queue.
2. Show only executable next actions for the current person.
3. Keep interface design/runtime implementation surfaces administrator-only or under advanced administration.
4. Implement necessary invitation, meeting participation, assignment, approaching commitment, and overdue notifications.
5. Ensure notification actions link to exact executable targets.
6. Add meeting notes summary and weekly review draft through existing AI provider boundaries.
7. Preserve full human confirmation for every write or decision.

### Browser evidence

Run on one retained local acceptance server and disposable database with three accounts:

- admin/inviter;
- tension proposer and meeting participant;
- other participant and Project/Action responsible person.

Verify the full tactical and governance journeys on desktop and 390px. Capture exact URLs, screenshots, console errors, failed network requests, database cardinality, and trace links.

### Real-team evidence

The product owner designates the pilot team and start date. During the weekly run, record:

- tensions raised and routed;
- meetings held;
- proposals returned, not adopted, or adopted;
- Projects and Actions created and closed;
- intervention requested from the implementation team;
- user-reported friction and abandoned steps;
- next-week traceability of open and completed outcomes.

The slice cannot close from a scripted rehearsal alone.

### Delivered evidence checkpoint - 2026-07-13

- Slice 4 implementation is committed through `b87129b`: member weekly queue, role-aware mobile/desktop navigation, exact event notifications, human-confirmed AI meeting/weekly drafts, commitment reconciliation, setup admin authorization, create-only weekly confirmation with confirmer audit, and browser-discovered low-friction/timing fixes.
- Full source passes 41/41 files and 265/265 tests; setup PostgreSQL passes 6/6 and weekly-review PostgreSQL passes 5/5; TypeScript, Prisma validation, production build, diff checks, and zero-error ESLint pass. All 19 migrations freshly applied.
- A disposable PostgreSQL and local-only AI stub backed a clean three-account browser run from invitations through owner-completed Action and Project, proposer-participant governance adoption, meeting report confirmation, and weekly review confirmation. Exact notification cardinality/targets, pre-confirmation zero writes, durable supported actor/status traces, 390px geometry, and complete error ledger passed. Action owner closure is browser-proven; the current Action model has no separate resolver-actor field.
- This checkpoint proves the scripted rehearsal only. A designated real-team weekly-run record remains mandatory before closure.
- Independent review initially found no P0, three P1, and two P2 gaps in setup authorization, Action/Project owner evidence, notification assertions, weekly-review overwrite/audit behavior, and pre-confirmation zero-write proof. The one concentrated correction closed all five; the same reviewer returned PASS with no P0/P1/P2. Independent roadmap audit remains open.
- After evidence inspection, ports 3212/3213 were stopped and confirmed unreachable; accepted, rejected-prefix, and pre-correction Slice 4 disposable databases were dropped and confirmed absent. JSON and screenshots remain retained for audit.
- Independent roadmap audit `019f5be5-1898-7c63-9350-db2f5df2ce24` initially found four state-document precision issues and no implementation finding. After `d6d2fd8`, the same auditor verified current S4 state, cleanup, evidence wording, and later-slice inactivity, then returned PASS with no P0/P1/P2.

## 9. Independent Review and Roadmap Audit

After every slice:

1. an implementation reviewer reports P0/P1/P2 findings with exact file and line evidence;
2. the slice receives at most one concentrated correction;
3. the same reviewer confirms closure;
4. a separate read-only auditor compares design, plan, `GOALS.md`, dashboard, source, tests, database, browser evidence, and cleanup;
5. the coordinator updates `GOALS.md` and `progress-dashboard.html` and activates only the next slice.

The recovery Goal replaces cross-loop generalization as the single active milestone once this plan passes its independent audit. G3 interface generalization, I2C-3, and second-interface migration remain inactive until real-team weekly evidence exists.

## 10. Plan Audit Gate

Before Slice 0 activates, an independent read-only auditor must confirm:

- the plan matches the approved design;
- every slice has a disjoint or explicitly coordinated write scope;
- dirty governance UI files are protected from overwrite;
- direct provenance never fakes runtime records;
- legacy governance writes fail closed before canonical UI activation;
- every direct structure, standalone Project, direct Action, direct decision, and legacy candidate bypass is inventoried and fails closed before Slice 0 closure;
- the only direct structure-write exception is bounded, auditable pristine-organization bootstrap;
- normal Project/Action closure is responsible-person-only and escalation authority is separate;
- permission and zero-write denial requirements are explicit;
- migration and rollback boundaries are executable;
- browser evidence matches the environment that owns the claim;
- only one slice and one Goal will be active;
- no second-interface, arbitrary-workflow, unsupported-structure, or broad-redesign work is activated.

Only a PASS with no P0/P1 findings activates Slice 0.
