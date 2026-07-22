# V5-M4-C Canonical Shared-Memory Retrieval Design

Date: 2026-07-15

Status: product direction approved as Option A

## Decision

M4-C turns confirmed memory candidates into a small, auditable retrieval layer for the Organization Brain.

The retrieval layer does not create a second source of truth. A shared memory entry is a read model derived from a `CONFIRMED` memory candidate that is still valid, not superseded, and backed by source references the current actor is allowed to know about. The Brain may cite those entries in answers, but it cannot silently create, confirm, edit, or delete organization memory.

## Product Outcome

A member can ask the Organization Brain about how the organization currently understands an operating fact, pattern, decision, or working agreement. The Brain can answer from confirmed shared memory when available, cite the confirming process and source records, and guide the member to the right page or process when the memory looks missing, outdated, or disputed.

The user experience should make five things clear:

- The answer is based on confirmed organization memory, not private chat content.
- The memory has provenance, validity, and source links.
- The actor only sees memory backed by sources they are allowed to access.
- Corrections happen through a new tension or superseding candidate, not direct Brain overwrite.
- Missing memory is a productively handled state, not a model hallucination gap.

## Scope

M4-C includes:

- A pure `SharedMemoryEntry` contract derived from confirmed memory candidates.
- Validity filtering for `CONFIRMED`, non-expired, non-superseded candidates.
- Actor-scoped retrieval with source-reference authorization and no existence hints.
- A bounded search surface for the Brain to request relevant memory entries.
- Brain answer rendering that separates confirmed memory from ordinary database evidence and inference.
- Deep links to the confirming route and source records.
- Correction affordance that routes outdated or disputed memory into a new tension or superseding candidate path.
- Query/audit evidence for memory retrieval attempts, successes, denials, and empty results.

M4-C excludes:

- AI automatic memory writes.
- Direct editing of confirmed memory.
- Central administrator approval as a substitute for source authority.
- Organization-wide notification feeds.
- Plugin extraction, deployment changes, M5 hardening, or longitudinal real-team acceptance evidence.
- A general knowledge-base import pipeline.

## Memory Entry Contract

A shared memory entry carries only review-safe information:

- `candidateId`: the confirmed candidate that produced the entry.
- `claim`: the confirmed bounded statement.
- `rationale`: why the statement matters.
- `authorityRoute`: the confirming source-authority route.
- `sourceRefs`: source records the current actor may access.
- `confirmedBy`: the source-authority process actor.
- `validFrom` and optional `validUntil`.
- `supersededBy`: absent for active entries.
- `confidence`: fixed to source-confirmed, not model-scored.
- `applicationUrl`: a deep link to the candidate or source process.

Private conversation excerpts, draft text, rejected candidates, submitted-but-unconfirmed candidates, expired entries, and superseded entries are not retrievable as shared memory.

## Visibility Rules

Retrieval is source-scoped, not globally public by default.

An actor may retrieve a shared memory entry only when all of these are true:

- The candidate belongs to the actor's organization.
- The candidate status is `CONFIRMED`.
- `validFrom` is present and not in the future.
- `validUntil` is absent or in the future.
- `supersededBy` is absent.
- At least one source reference is readable by the actor through the existing Brain read boundary or source-authority route checks.
- Returned source references are filtered to those the actor may access.

If no authorized source reference remains, the entry is omitted without revealing that it exists.

## Retrieval Behavior

The first retrieval surface should be intentionally narrow:

1. The Brain planner may request confirmed memory using a bounded text query, optional route filter, and limit.
2. The retrieval service returns at most a small number of entries with provenance and source links.
3. The reasoner may cite entries in a distinct confirmed-memory section.
4. If entries conflict with live source data, the answer labels the conflict and points to the source authority process.
5. If no entry is found, the Brain can suggest asking from live records or raising a tension to create memory.

Search ranking should be deterministic at first: route match, recency, source count, and simple text match. Semantic/vector retrieval remains out of scope until the basic audited path is proven.

## Correction and Supersession

The Brain cannot correct memory by rewriting it.

When a member says a memory is wrong or stale, the UI should offer one of two process paths:

- Raise a tension linked to the memory entry.
- Submit a superseding memory candidate with source references.

The source authority then confirms, rejects, or supersedes through the same M4-B lifecycle. This keeps organizational learning distributed and auditable.

## User Experience

The first browser path:

1. A source-authority reviewer confirms a memory candidate.
2. A permitted member asks the Brain a related question.
3. The Brain answer includes a compact `Confirmed organization memory` section with claim, route, validity, and links.
4. A nonpermitted member receives no existence hint.
5. The permitted member can open the source, raise a tension, or start a superseding candidate.

This should feel like the Brain has organizational memory, while still making the chain of authority visible.

## Failure Behavior

- Missing actor context returns the fixed Brain access denial.
- Unauthorized memory returns an empty result, not a different error.
- Invalid query shape is rejected before database access.
- Retrieval audit failure fails closed.
- Source-reference authorization failure omits the entry.
- Conflicting evidence is labeled instead of merged into a single unsupported statement.
- Expired or superseded memory is excluded unless a later explicit history view is designed.

## Acceptance Evidence

M4-C cannot be accepted until the following evidence exists:

- Focused pure tests for entry derivation, validity, expiry, supersession exclusion, deterministic ranking, and source filtering.
- Service tests proving actor-scoped retrieval, no private draft/submitted/rejected leakage, no owner-only shortcut, fixed public errors, and no direct writes.
- Static boundary tests proving no provider writes, plugin gateway, deployment code, unrestricted command execution, or direct memory mutation path.
- PostgreSQL evidence for two tenants, authorized and unauthorized members, expired/superseded exclusion, filtered source references, audit behavior, and cleanup.
- Brain action/turn tests proving memory packets are separated from ordinary evidence and inference.
- Browser evidence for confirmed-memory answer display, no-existence-hint denial, correction affordance, and clean console/network.
- Independent implementation review and roadmap audit with no open P0/P1/P2.

## Follow-On Work

Later slices may add organization-wide memory feeds, notification policy, meeting-preparation briefs, semantic retrieval, and M5 pluginization/deployment/longitudinal evidence. Those remain inactive until the narrow confirmed-memory retrieval path is accepted.
