# LoopOS Real-Team Weekly Loop Recovery Design

Status: approved

Date: 2026-07-12

## 1. Outcome

LoopOS must let at least three people in one real organization complete a weekly operating cycle without implementation-team facilitation:

1. join the same organization;
2. raise and route an ordinary tension;
3. participate in the selected tactical or governance meeting;
4. record a distributed meeting result;
5. create and close a Project or Action, or atomically apply one supported governance structure change;
6. review the durable result in the next weekly rhythm.

The milestone is not complete when only source code, unit tests, fixtures, or a single-user browser rehearsal exist. It requires multi-user browser evidence and one real-team weekly use cycle.

## 2. Product Principles

### 2.1 Tension ownership

- The tension raiser decides what proposal to make.
- AI may suggest tactical or governance routing, but the raiser confirms it.
- A tactical tension changes work without changing organization structure.
- A governance tension proposes a change to organization structure.

### 2.2 Distributed meeting authority

- The proposer owns proposal authorship and immutable revisions.
- Current participants in the exact selected meeting may record meeting-process results.
- The proposer may record adoption when they are also a current participant. This is authority granted by the meeting process, not unilateral personal authority.
- A nonparticipant, administrator title, coach title, circle-lead title, interface ownership, or technical access never substitutes for current participation.
- An assignee who disagrees with an approved tactical outcome raises a new tension and proposal; assignment disagreement does not silently undo the approved result.

### 2.3 AI boundary

AI may:

- suggest tactical or governance routing;
- structure a tension draft;
- prepare an agenda;
- guide an objector through the material-harm test;
- summarize notes and identify missing follow-up;
- prepare a weekly review draft.

AI may not:

- adopt or reject a proposal;
- decide whether an objection is valid;
- assign authority to itself or another actor;
- apply organization structure changes without a recorded human meeting result;
- close a Project or Action without the responsible human action.

## 3. One Authoritative Governance Path

`src/lib/governance-decision.ts` becomes the only authoritative governance mutation service.

For this recovery, organization structure explicitly includes:

- `RoleDef` creation, modification, archival, domains, accountabilities, and assignment-defining ownership;
- `Circle` creation, modification, archival, hierarchy, purpose, domain, and leadership;
- `CircleInterface` relationship and contract creation or modification;
- a person's home-circle ownership after initial onboarding;
- organization `Charter` creation, archival, and ratification.

Browser actions may not directly mutate these surfaces after bootstrap. Unsupported structure categories remain read-only and require a future canonical governance operation; they do not use an administrator or legacy action as a fallback.

The only direct structure-write exception is bounded organization bootstrap:

- registration may create the organization, initial root circle, first administrator membership, and first person;
- invitation acceptance may create the invited membership, person, and initial home-circle placement;
- the dedicated one-time setup action may create the approved initial template only while the organization has no operational meetings, decisions, proposals, Projects, or non-bootstrap tensions;
- every bootstrap write is organization-scoped and auditable;
- once bootstrap closes, it cannot be reopened by deleting individual records or calling another browser action.

The legacy `src/lib/governance-engine.ts` path must become unreachable for browser writes. Existing legacy proposals remain readable for history and audit, but cannot continue to mutate roles, circles, people, decisions, change logs, or source tensions.

The canonical governance service supports two provenance kinds:

- `ORDINARY_TENSION`: a person-raised tension explicitly routed to an exact governance meeting;
- `INTERFACE_RUN`: an existing precisely routed interface-workflow governance candidate.

Both provenance kinds share the same process state, immutable revisions, participant authority, objection flow, idempotency ledger, concurrency behavior, failure recovery, audit events, and atomic structure application.

Ordinary tensions must not be wrapped in fake `InterfaceWorkflowRun` records. Runtime provenance fields become conditionally required as one all-or-none group for `INTERFACE_RUN`; direct provenance is bound by organization, source tension, proposal, proposer, and exact governance meeting.

The first recovery milestone supports only the already-reviewed `ROLE_CREATED` typed structure operation. Unsupported governance structure categories remain visible as unsupported, produce zero structure writes, and leave the source tension open. They never fall back to the legacy engine.

## 4. Team Entry and Identity

### 4.1 Invitation

An organization administrator creates a bounded, expiring, single-use invitation for an email address.

Accepting an invitation atomically creates or connects:

- the existing `User` identity;
- one `Membership` in the invitation organization;
- one organization-scoped `Person` record;
- the selected or default home circle.

Normal registration without an invitation may continue to create a new organization. Invitation acceptance must never create a second organization for the invited member.

Invitation replay, email mismatch, expiry, revocation, cross-tenant identifiers, and already-consumed tokens must be denied without partial membership or person writes.

### 4.2 Orphan session recovery

An authenticated user without a current organization person record must see a recoverable join/onboarding surface. The application must not redirect to a nonexistent route or return a 404.

## 5. Tension Routing

The tension form adds one low-friction binary intent:

- `TACTICAL`: advance work without changing organization structure;
- `GOVERNANCE`: change organization structure.

AI may preselect an intent and explain its suggestion. The raiser must confirm the stored value. Existing ordinary open tensions without an intent require a one-time explicit routing choice before meeting processing.

Meeting queues use the stored intent:

- tactical meetings show ordinary open `TACTICAL` tensions plus valid precisely routed tactical runtime tensions;
- governance meetings show ordinary open `GOVERNANCE` tensions plus valid precisely routed governance candidates;
- a tension is never shown in both queues at the same time;
- technical runtime identity is not shown to ordinary users unless needed for trace inspection.

## 6. Meeting Participation and Notes

Meeting creation allows the creator to choose current organization members as participants. The creator is included by default but is not the only possible participant.

Participant changes are organization-scoped and auditable. Removing a participant revokes future meeting-result authority but does not rewrite previously recorded history.

Current participants may update shared meeting notes and end the meeting. Notes are versioned or protected by optimistic concurrency so one participant cannot silently overwrite another participant's newer text.

AI agenda and guard-report actions consume the actual saved agenda and notes. AI output remains a draft or report and cannot mutate meeting results.

## 7. Tactical Cycle

For an ordinary or precisely routed tactical tension:

1. the raiser authors a Project or Action proposal;
2. the proposal records responsible person, circle, expected result or acceptance criteria, and optional Action deadline;
3. any current participant in the exact meeting records approved, returned, or not adopted;
4. the raiser may record the result when they are also a participant;
5. approval atomically creates the Project or transforms the source tension into the assigned Action;
6. returned or not-adopted proposals keep the source tension open for a new proposer revision.

Project bearers may update, pause, resume, and complete their Projects. Action owners may advance valid Action states and resolve them. Completion records the actor and time and remains linked to the source tension and meeting outcome.

Every Project creation and every Action assignment must come from an approved `TacticalOutcomeProposal`. Standalone Project creation, direct meeting assignment, direct meeting resolution, and pilot-specific direct Project/Action result handlers are not alternate authority paths.

Escalation authority is separate from outcome ownership. A circle lead, administrator, coach, or facilitator may surface or route a new tension and may perform only explicitly modeled escalation operations; those titles do not grant authority to edit, reassign, complete, or resolve another person's approved Project or Action.

## 8. Governance Cycle

For a canonical governance proposal:

1. the raiser creates a complete immutable revision;
2. a current participant may request clarification;
3. only the proposer authors the complete clarified revision;
4. a current participant may raise a structured objection;
5. the facilitator or recording participant guides the objector through material harm, observed fact, reversibility, and safe-to-try checks;
6. an invalid objection returns the unchanged revision to ready;
7. a valid objection requires a proposer-authored amendment;
8. a current participant may record non-adoption or adoption;
9. adoption of `ROLE_CREATED` atomically creates the role, DecisionRecord, ChangeLog, trace artifact/events, and resolves the source tension.

Technical failure preserves an adoption-ready state, persists mandatory failure audit, and allows only exact same-key retry under the reviewed lease and concurrency rules.

## 9. Weekly User Experience

The normal member navigation prioritizes daily work. Interface design and runtime implementation surfaces remain administrator-only or move behind an advanced administration area.

The application home page adds one compact weekly rhythm section containing:

- tensions waiting for routing;
- tensions waiting for a meeting;
- proposals waiting for a meeting result;
- Projects and Actions waiting for the current user;
- overdue or blocked items;
- completed outcomes from the current week.

No new marketing page or explanatory dashboard is required. The section links directly to the next executable user action.

The system produces only necessary notifications for invitation, meeting participation, assignment, approaching commitment, and overdue follow-up. Notification types that exist only as enums do not count as implemented behavior.

## 10. Error and Authorization Contract

The following cases must return a clear user-facing denial and perform zero domain writes:

- wrong organization;
- wrong meeting type or meeting identity;
- nonparticipant recording a meeting result;
- nonproposer authoring or revising a proposal;
- stale proposal or notes revision;
- changed idempotency payload;
- expired, revoked, mismatched, or replayed invitation;
- unsupported governance structure operation;
- invalid provenance or forged runtime artifact;
- Project or Action lifecycle mutation by an unauthorized actor.

Repeated successful requests with the same immutable binding return the prior result without duplicate effects.

## 11. Compatibility and Migration

- Existing legacy governance proposals and decisions remain readable.
- No legacy proposal is silently converted into a canonical process.
- New browser governance writes use only the canonical service.
- The migration is additive where possible and includes reviewed reverse SQL.
- Direct and runtime governance provenance constraints are database-enforced where practical.
- Existing Data -> Pretraining tactical behavior remains a required regression path.
- Preserving Data -> Pretraining behavior means routing it through the canonical tactical proposal/result path, not retaining its direct legacy Project/Action handlers.
- Standalone Project creation and direct legacy tension assignment/resolution become unreachable before canonical ordinary-tension activation.
- Direct role, circle, interface-relationship, home-ownership, agent-structure, and charter mutation actions fail closed after the bounded bootstrap exception.
- Existing dirty work outside each delegated write scope must be preserved.

## 12. Implementation Slices

Only one slice is active at a time.

### Slice 0: Security stop

- Make legacy governance browser mutations fail closed.
- Make every independent direct structure mutation fail closed outside the bounded bootstrap exception.
- Make standalone Project creation and direct legacy meeting Project/Action/decision/candidate handlers fail closed.
- Remove or disable the corresponding browser controls while preserving historical reads.
- Preserve historical read-only display.
- Repair the stale full-suite persistence assertion.

### Slice 1: Team and meeting foundation

- Invitation creation and acceptance.
- Recoverable onboarding for authenticated users without a person record.
- Multi-person meeting creation and participant maintenance.
- Shared notes and meeting completion.

### Slice 2: Ordinary tactical closure

- Tension intent and low-friction routing.
- Ordinary tactical meeting queue.
- Project and Action proposal flow.
- Project and Action responsible-person lifecycle controls.

### Slice 3: Canonical governance closure

- Dual direct/runtime provenance.
- Canonical Server Actions and governance workbench state projection.
- Clarification, objection, amendment, non-adoption, adoption, and trace display.
- `ROLE_CREATED` typed structure application only.

### Slice 4: Weekly rhythm and acceptance

- Home-page weekly action queue.
- Necessary notifications.
- Multi-user desktop and 390px browser rehearsal.
- Independent review, roadmap audit, product-owner acceptance, and real-team weekly run.

## 13. Evidence Required for Completion

Static and behavioral evidence:

- Prisma schema validation and migration apply/rollback/reapply;
- TypeScript with no errors;
- scoped ESLint with no errors;
- full test suite with zero failures;
- focused authorization, zero-write denial, idempotency, concurrency, failure-injection, and compatibility tests.

Browser evidence on the exact integrated source and database:

- administrator creates an invitation;
- two invited people join the same organization;
- three accounts appear as separate participants;
- ordinary tactical tension becomes an approved Project or Action;
- responsible person advances and closes the result;
- ordinary or runtime governance tension reaches a canonical proposal;
- clarification and valid/invalid objection paths behave correctly;
- proposer-participant records adoption successfully;
- nonparticipant result recording is denied with zero writes;
- adopted role, decision, change log, source tension, and trace remain correct after refresh;
- desktop and 390px layouts expose every required action without overlap or hidden controls;
- Data -> Pretraining regression remains usable.

Longitudinal evidence:

- one real team completes at least one weekly cycle;
- the next weekly review can trace open and completed work to source tensions and meeting results;
- implementation-team intervention is recorded and treated as a product gap rather than hidden facilitation.

## 14. Explicit Exclusions

This recovery milestone does not include:

- a second cross-loop interface migration;
- arbitrary workflow code or scripts;
- new workflow node families;
- governance structure mutations beyond `ROLE_CREATED`;
- automated objection validity decisions;
- autonomous AI adoption, assignment, or closure;
- a broad visual redesign;
- integrations with external chat or calendar platforms;
- unrelated refactors or cleanup.

## 15. Completion Rule

The milestone is complete only after the exact integrated implementation passes independent review, current-state roadmap audit, multi-account browser verification, and one real-team weekly use cycle. Source completeness, test counts, historical screenshots, or coordinator declaration alone are insufficient.
