# V5-M4-B Source-Authority Memory Candidates Design

Date: 2026-07-15

Status: product direction approved as Option A

## Decision

M4-B establishes memory candidates, not shared memory.

The Organization Brain may help a user turn a private brief or private conversation insight into an auditable candidate. The candidate is not organization truth. It becomes eligible for later use only after it is routed to the source authority that already owns that kind of fact or operating change.

## Product Outcome

A member can select a Brain insight, draft a precise claim, attach source references, and submit it into the right authority route. The user experience should make five things unmistakable:

- This is a candidate, not a confirmed fact.
- The user chose to submit it.
- The Brain did not silently promote private conversation content.
- Confirmation follows the relevant organization process, not a central memory administrator.
- The resulting decision has provenance, validity, and supersession metadata.

## Scope

M4-B includes:

- A `MemoryCandidate` lifecycle contract.
- Draft and submitted candidate surfaces connected to private Brain brief or conversation context.
- Source references back to existing application objects.
- Source-authority route classification.
- Explicit user submission.
- Confirmation or rejection by the source-authority process.
- Validity and supersession metadata for confirmed candidates.
- Audit trail for draft, submit, confirm, reject, and supersede transitions.
- Tests proving no silent private-to-shared promotion and no AI self-confirmation.

M4-B excludes:

- Canonical shared organization memory retrieval.
- AI automatic shared memory writes.
- Central administrator approval as a substitute for source authority.
- Notifications, plugins, deployment changes, or M5 hardening.
- New model-provider capabilities.
- Longitudinal real-team acceptance evidence.

## Candidate Model

A memory candidate carries the minimum information needed for review:

- `claim`: the bounded statement being proposed.
- `rationale`: why the submitter believes the claim matters.
- `sourceRefs`: typed references to existing source objects.
- `authorityRoute`: where this candidate must be handled.
- `status`: `DRAFT`, `SUBMITTED`, `CONFIRMED`, `REJECTED`, or `SUPERSEDED`.
- `submittedBy`: the actor who explicitly submitted it.
- `confirmedBy`: the source-authority actor or process that confirmed it.
- `supersededBy`: the later candidate or source record that replaced it.
- `validFrom`: when the confirmed claim starts being valid.
- `validUntil`: when it expires, if known.
- `auditTrail`: immutable lifecycle events with actor, timestamp, and reason.

Expiry is a derived state from `validUntil`. It should not add a sixth lifecycle status unless later evidence shows the UI needs a separate terminal state.

## Authority Routes

Confirmation follows the source of authority for the proposed knowledge:

- Goal knowledge routes to the strategic or Goal process.
- Structure, Role, accountability, domain, and policy knowledge routes to governance.
- Project and Action status routes to the bearer or tactical process.
- Meeting and decision knowledge routes to the official meeting record.
- Unowned or ambiguous knowledge becomes a Tension.

The route does not grant authority. It only opens or links to the process that already has authority.

## Lifecycle Rules

### Draft

`DRAFT` candidates are private to the owner. They may be created from a private brief card, a Brain answer, or an explicit user action. The Brain may prefill draft text, but it cannot submit the draft.

### Submit

`SUBMITTED` candidates freeze the claim, rationale, source references, and route. The submitter must explicitly submit the candidate. Private conversation excerpts are not copied into shared context unless the submitter selected the exact claim and source references to expose.

### Confirm

`CONFIRMED` candidates require evidence from the source-authority process. Confirmation records the actor or meeting/process reference, `validFrom`, optional `validUntil`, and audit event. M4-B does not yet publish a general shared-memory retrieval layer; later slices may consume confirmed candidates.

### Reject

`REJECTED` candidates keep the audit trail and rejection reason. Rejection should not delete the private original conversation or brief.

### Supersede

`SUPERSEDED` candidates point to a later candidate or canonical source record. Supersession preserves history and prevents outdated guidance from being treated as current.

## Visibility and Privacy

- Private Brain conversations remain owner-only.
- Draft candidates remain owner-only.
- Submitted candidates are visible only to the submitter and the participants or actors needed by the authority route.
- Confirmed candidate metadata may become organization-visible only through the authorized source process output, not through a new global memory feed in M4-B.
- Administrators do not gain access to private conversation content merely because a candidate exists.

## User Experience

The first browser path should be intentionally small:

1. A private brief or Brain response offers `Submit as memory candidate`.
2. The user reviews claim, rationale, source references, and proposed route.
3. The user submits the candidate.
4. The candidate appears in a review queue or linked process surface for the authority route.
5. The authority process confirms, rejects, or sends it back by creating an appropriate Tension or proposal.

The UI must avoid implying that the Brain has learned a fact before confirmation. Labels should use candidate language throughout.

## Failure Behavior

- Missing actor context returns the same fixed access denial used by the Brain surfaces.
- Unauthorized source references are rejected without existence hints.
- Ambiguous route classification defaults to `TENSION`.
- Claim, rationale, and source-reference bounds are enforced before persistence.
- Closed candidates cannot be mutated; later changes require a new candidate or supersession.
- If the authority process cannot be reached, submission remains recorded but unconfirmed.

## Acceptance Evidence

M4-B cannot be accepted until the following evidence exists:

- Focused lifecycle tests for draft, submit, confirm, reject, supersede, validity, and immutable closed states.
- Permission tests proving private drafts, route-scoped submitted visibility, and no administrator access to private conversation content.
- Static boundary tests proving no shared-memory retrieval layer, AI self-confirmation, generic write surface, plugin gateway, deployment code, or unrestricted command execution.
- PostgreSQL evidence for tenant isolation, immutable audit trail, source-reference authorization, route-scoped review visibility, and cleanup.
- Browser evidence for draft from private Brain context, explicit submission, route visibility, rejection or confirmation, no silent write, and clean console/network.
- Independent implementation review and roadmap audit with no open P0/P1/P2.

## Follow-On M4 Work

Later slices may add meeting-preparation briefs, notification policy, and the first confirmed-memory consumption surface. Those remain inactive until memory candidates and source-authority confirmation are accepted.
