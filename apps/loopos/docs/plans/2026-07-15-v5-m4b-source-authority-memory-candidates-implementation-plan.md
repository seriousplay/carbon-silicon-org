# V5-M4-B Source-Authority Memory Candidates Implementation Plan

Date: 2026-07-15

Design source: `docs/plans/2026-07-15-v5-m4b-source-authority-memory-candidates-design.md`

Status: active planning checkpoint

## Execution Rules

- Implement memory candidates only; do not implement canonical shared memory retrieval.
- Preserve private Brain conversation ownership.
- Require explicit user submission before anything leaves private draft state.
- Route confirmation to source authority; do not add central administrator approval.
- Reuse accepted M1 actor/read boundaries, M3 command/confirmation discipline, and M4-A private brief surfaces where practical.
- Keep browser, PostgreSQL, source, review, and roadmap evidence as separate claims.

## Acceptance Scenario

An authenticated member opens a private Brain brief, chooses one insight, reviews a memory candidate draft, and explicitly submits it. The candidate is routed to the correct source-authority process. A nonparticipant and a second tenant cannot see it. The Brain cannot confirm the candidate. Confirmation or rejection is recorded with immutable audit evidence and does not create a general shared-memory feed.

## Slice M4-B1 - Candidate Contract and Pure Lifecycle

Outcome:
- Define the memory candidate DTO, statuses, source-reference shape, authority route shape, lifecycle transitions, validity metadata, and audit events without database or UI coupling.

Likely ownership:
- new `src/lib/organization-brain/memory-candidate-types.ts`
- new `src/lib/organization-brain/memory-candidate-lifecycle.ts`
- new `src/lib/organization-brain/memory-candidate-lifecycle.test.ts`

Required behavior:
- Support `DRAFT`, `SUBMITTED`, `CONFIRMED`, `REJECTED`, and `SUPERSEDED`.
- Derive expiry from `validUntil` rather than adding an extra status.
- Freeze claim, rationale, source references, and route at submission.
- Reject mutation of closed candidates.
- Route ambiguous candidates to `TENSION`.

Evidence:
- Focused lifecycle tests for every transition, immutable closed states, validity, supersession, and route classification.
- Static import test proving no Prisma, Server Action, command execution, model provider, plugin, deployment, filesystem, process, or shared-memory retrieval boundary.

## Slice M4-B2 - Persistence and Actor-Scoped Service

Outcome:
- Persist candidate drafts, submissions, route visibility, confirmations, rejections, supersession, and audit trail with tenant isolation and private-draft ownership.

Likely ownership:
- Prisma schema and additive migration for `MemoryCandidate` and candidate audit events.
- new `src/lib/organization-brain/memory-candidate-service.ts`
- focused service and PostgreSQL tests.

Required behavior:
- Resolve ActorContext server-side.
- Keep drafts owner-private.
- Make submitted candidates visible only to the submitter and source-authority route participants.
- Enforce authorized source references without existence hints.
- Prevent AI/provider code from submitting or confirming.
- Preserve immutable audit events.

Evidence:
- Focused service tests for actor denial, visibility, route scoping, source-reference authorization, and fixed public errors.
- PostgreSQL evidence for two-tenant denial, administrator non-access to private drafts, route visibility, immutable audit, closed-state rejection, and zero disposable residue.

## Slice M4-B3 - Brain Draft and Submission Surface

Outcome:
- Add a small browser path from private Brain brief or conversation context to candidate draft review and explicit submission.

Likely ownership:
- `src/app/app/brain/actions.ts`
- `src/components/organization-brain/brain-client.tsx`
- candidate-focused UI component and tests.

Required behavior:
- Show `Submit as memory candidate` only where the user has private source context.
- Let the user review and edit claim/rationale before submission.
- Display source references and proposed authority route.
- Keep submitted status visibly separate from confirmed fact.
- Avoid exposing private conversation excerpts to route participants unless explicitly selected as candidate content.

Evidence:
- Component and action tests for explicit submit, fixed error mapping, no raw IDs, no silent write, empty/error states, and mobile layout.
- Browser evidence for draft review, explicit submit, route visibility, second-user invisibility, and clean console/network.

## Slice M4-B4 - Source-Authority Review and Decision Surface

Outcome:
- Provide the minimal route-scoped review surface or process link needed to confirm, reject, or supersede submitted candidates.

Likely ownership:
- Existing meeting, Goal, governance, or Workspace surfaces only where the authority route requires one small entry point.
- Candidate service decision handlers.
- focused review-surface tests.

Required behavior:
- Goal candidates route to strategic or Goal process.
- Structure and Role candidates route to governance.
- Project and Action candidates route to bearer or tactical process.
- Meeting and decision candidates route to official meeting records.
- Unowned candidates become Tensions.
- The Brain never appears as the confirmer.

Evidence:
- Focused tests for each route and denial path.
- Browser evidence for at least one confirmation path and one rejection path.
- Static proof that decision handling reuses canonical process authority and does not add central admin approval.

## Slice M4-B5 - Acceptance Cleanup

Outcome:
- Consolidate source, PostgreSQL, browser, review, roadmap, and cleanup evidence for M4-B.

Evidence:
- Full source tests.
- TypeScript.
- Scoped ESLint.
- Prisma validation and migration rollback/reapply where applicable.
- Production build.
- Disposable-resource cleanup.
- Independent implementation review with no P0/P1/P2.
- Independent roadmap audit with no P0/P1/P2.

## Deferred M4 Work

- Canonical shared-memory retrieval.
- Organization-wide memory feed.
- Notification policies.
- Meeting-preparation briefs.
- M5 pluginization, deployment, and longitudinal real-team evidence.

These remain inactive until M4-B is accepted.
