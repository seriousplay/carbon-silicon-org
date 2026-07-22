# V5-M4-A Private Proactive Briefs Implementation Plan

Date: 2026-07-15

Design source: `docs/plans/2026-07-15-v5-m4a-private-briefs-design.md`

Status: active

## Execution Rules

- Keep M4-A limited to private briefs and deterministic signals.
- Do not add shared memory records, real-time notifications, plugins, deployment changes, or autonomous writes.
- Do not call AI providers from the first slice; deterministic copy is acceptable.
- Reuse accepted M1 ActorContext, M1 read boundaries, M2 Goal facts, and M3 preview/confirm flows.
- Treat browser, PostgreSQL, source, review, and roadmap evidence as separate claims.

## Acceptance Scenario

An authenticated member opens the Organization Brain and sees a private brief containing only signals they are authorized to know about. Each signal has a source, evidence age, reason, and a safe next action. A second tenant and an unrelated member cannot see the signal. The brief does not mutate organization records and does not promote any shared memory.

## Slice M4-A1 - Signal Contract and Pure Detector

Outcome:
- Define the private brief DTO, signal kinds, source references, deduplication identity, safe next action shape, and deterministic detector rules without database access.

Likely ownership:
- new `src/lib/organization-brain/private-brief-types.ts`
- new `src/lib/organization-brain/private-brief-detector.ts`
- new `src/lib/organization-brain/private-brief-detector.test.ts`

Required behavior:
- Represent the initial signal set from the design: stale Goal check-in, missing Target evidence, unresolved meeting output, repeated Tensions, Role/work mismatch, and missing child Goal.
- Require every signal to include a source reference and a safe next action.
- Deduplicate repeated source/kind identities inside one brief window.
- Fail closed when required source facts are missing.
- Expose no command execution or shared-memory capability.

Evidence:
- Focused tests for every signal kind, deduplication, missing-source omission, truncation, source links, and safe action shape.
- Static import test proving no Prisma, Server Action, command execution, model provider, plugin, deployment, filesystem, process, or shared-memory write boundary.

## Slice M4-A2 - Actor-Scoped Brief Service

Outcome:
- Resolve actor context and build a private brief from accepted organization facts without leaking unauthorized records.

Likely ownership:
- new `src/lib/organization-brain/private-brief-service.ts`
- new `src/lib/organization-brain/private-brief-service.test.ts`
- possibly a PostgreSQL focused test once the query shape is stable

Required behavior:
- Use accepted session/actor context.
- Read only tenant-scoped facts required by M4-A1.
- Return a fixed public denial for missing actor context.
- Preserve owner-private brief visibility and cross-tenant denial.
- Avoid writes and shared-memory records.

Evidence:
- Unit tests for actor denial and projection shape.
- PostgreSQL evidence for two-tenant isolation, owner-private visibility, no mutation side effects, and stable signal rows.

## Slice M4-A3 - Brain UI Surface

Outcome:
- Render private briefs in the Organization Brain surface without changing the four-entry shell.

Likely ownership:
- `src/app/app/brain/actions.ts`
- `src/components/organization-brain/brain-client.tsx`
- related focused tests

Required behavior:
- Show an empty/degraded state honestly.
- Render title, reason, source, evidence age, and safe next action.
- Link only to existing application URLs.
- Keep M3 command preview/confirm as the only write-adjacent path.
- Preserve mobile layout and no-overlap behavior.

Evidence:
- Component tests for rendering, links, empty/degraded states, private visibility indicators, and no raw IDs.
- Browser evidence for member brief visibility, source navigation, second-user invisibility, and clean console/network.

## Slice M4-A4 - Acceptance Cleanup

Outcome:
- Consolidate source, PostgreSQL, browser, review, roadmap, and cleanup evidence for M4-A.

Evidence:
- Full source tests.
- TypeScript.
- Scoped ESLint.
- Prisma validation where applicable.
- Production build.
- Disposable-resource cleanup.
- Independent implementation review with no P0/P1/P2.
- Independent roadmap audit with no P0/P1/P2.

## Deferred M4 Work

- Meeting preparation briefs.
- Shared memory candidates.
- Source-authority confirmation workflows.
- Validity, expiry, and supersession for confirmed procedural memory.
- Notification delivery and noise controls.

These remain inactive until M4-A is accepted.
