# V5-M4-C Canonical Shared-Memory Retrieval Implementation Plan

Date: 2026-07-15

Design source: `docs/plans/2026-07-15-v5-m4c-canonical-shared-memory-retrieval-design.md`

Status: active planning checkpoint

## Execution Rules

- Implement confirmed-memory retrieval only; do not add a global memory feed.
- Treat `CONFIRMED` memory candidates as the source of the read model.
- Preserve source-authority and actor-scoped visibility.
- Do not add AI automatic writes, direct memory edits, central administrator approval, plugins, deployment changes, or M5 hardening.
- Keep source, PostgreSQL, browser, review, and roadmap evidence as separate claims.

## Acceptance Scenario

A source-authority reviewer confirms a memory candidate. A permitted member asks the Organization Brain a related question and sees a confirmed-memory answer section with provenance, validity, and links. A nonpermitted same-organization member and a second tenant receive no existence hint. If the permitted member disputes the memory, the UI routes them toward a tension or superseding candidate rather than direct editing.

## Slice M4-C1 - Shared Memory Entry Contract

Outcome:
- Define the pure read-model contract and derivation rules from confirmed memory candidates without database, UI, model provider, or command coupling.

Likely ownership:
- new `src/lib/organization-brain/shared-memory-types.ts`
- new `src/lib/organization-brain/shared-memory-derivation.ts`
- new `src/lib/organization-brain/shared-memory-derivation.test.ts`

Required behavior:
- Include only `CONFIRMED` candidates with valid `validFrom`, no expired `validUntil`, and no `supersededBy`.
- Filter source references to caller-authorized references supplied by the service layer.
- Reject draft, submitted, rejected, expired, superseded, future-valid, or malformed candidates.
- Produce deterministic ranking inputs without semantic/vector search.

Evidence:
- Focused pure tests for derivation, validity, expiry, supersession, malformed candidate rejection, source filtering, and ranking.
- Static import test proving no Prisma, Server Action, command execution, model provider, plugin, deployment, filesystem, process, or direct memory mutation boundary.

## Slice M4-C2 - Actor-Scoped Retrieval Service

Outcome:
- Add a server-only retrieval service that loads confirmed candidates, authorizes source references, returns bounded shared memory entries, and audits retrieval.

Likely ownership:
- new `src/lib/organization-brain/shared-memory-service.ts`
- focused service tests
- PostgreSQL tests and any additive migration or view if needed

Required behavior:
- Resolve ActorContext server-side.
- Return only active confirmed entries.
- Filter or omit entries without authorized source references.
- Apply deterministic bounded query, route, and limit handling.
- Fail closed if audit persistence fails.
- Expose fixed public errors only.

Evidence:
- Focused service tests for actor denial, no existence hint, route filtering, source filtering, empty results, and audit failure.
- PostgreSQL evidence for two tenants, same-organization permitted and nonpermitted members, expired/superseded exclusion, filtered source references, query audit, and zero disposable residue.

## Slice M4-C3 - Brain Turn Integration and Answer Surface

Outcome:
- Let the Brain use confirmed memory as a distinct evidence packet and render it separately from ordinary database evidence and inference.

Likely ownership:
- `src/lib/organization-brain/turn-service.ts`
- `src/lib/organization-brain/reasoner.ts`
- `src/lib/organization-brain/response-schema.ts`
- `src/app/app/brain/actions.ts`
- `src/components/organization-brain/brain-client.tsx`

Required behavior:
- Keep memory retrieval behind an explicit service/action boundary.
- Label confirmed memory separately in stored responses.
- Cite route, validity, source links, and confirming process.
- Never claim private drafts or submitted candidates as learned facts.
- Provide a correction affordance that starts a tension or superseding candidate flow without direct memory edits.

Evidence:
- Focused turn/reasoner/schema/component/action tests for confirmed memory packets, empty memory, denial, correction affordance, fixed errors, and mobile layout.
- Static proof that Brain UI cannot confirm or edit memory outside M4-B actions.

## Slice M4-C4 - Browser Acceptance

Outcome:
- Prove the end-user path in production mode.

Required behavior:
- Confirm one candidate through source authority.
- Ask a related Brain question as a permitted member and see confirmed memory with provenance.
- Ask as a nonpermitted same-organization member and receive no existence hint.
- Ask as a second tenant and receive no existence hint.
- Use the correction affordance without direct memory mutation.
- Keep console/network clean.

Evidence:
- Production-mode browser script and evidence directory.
- Database counts proving no private conversation/message side effects unless the turn path intentionally stores them.
- Audit evidence for retrieval success and denial/empty paths.

## Slice M4-C5 - Acceptance Cleanup

Outcome:
- Consolidate source, PostgreSQL, browser, review, roadmap, and cleanup evidence for M4-C.

Evidence:
- Full source tests.
- TypeScript.
- Scoped ESLint.
- Prisma validation and migration rollback/reapply where applicable.
- Production build.
- Disposable-resource cleanup.
- Independent implementation review with no P0/P1/P2.
- Independent roadmap audit with no P0/P1/P2.

## Deferred Work

- Organization-wide memory feed.
- Notification policies.
- Meeting-preparation briefs.
- Semantic/vector retrieval.
- M5 pluginization, deployment, and longitudinal real-team evidence.

These remain inactive until M4-C is accepted.
