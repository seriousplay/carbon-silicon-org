# V5-M4-A Private Proactive Briefs Design

Date: 2026-07-15

## Decision

V5-M4 starts with private daily or weekly briefs.

This slice gives each member a low-friction way to see organization drift signals that are relevant to them. The Brain may explain signals and suggest next steps, but it does not write shared memory, send broad notifications, or mutate organization records.

## Product Outcome

A member opens the Organization Brain and sees a private brief containing concrete, source-linked signals such as stale Goal evidence, missing Target evidence, unresolved meeting output, repeated Tensions, Role/work mismatch, or missing child Goals.

Each signal answers four questions:

- What changed or looks stale.
- Why it matters to this member.
- Which source records prove it.
- What safe next step is available.

## Scope

M4-A includes:

- A deterministic signal detector over already accepted organization facts.
- A private brief projection for the current actor.
- Source links back to existing Goal, meeting, Tension, Project, Action, Circle, and Role surfaces.
- Deduplication so repeated evidence appears once per brief window.
- Safe suggested next steps that route to existing pages or M3 preview/confirm command flows.
- Tests proving permission filtering, no silent writes, no shared-memory promotion, and no cross-tenant visibility.

M4-A excludes:

- Shared organization memory records.
- Memory candidate confirmation workflows.
- Real-time notification delivery.
- Autonomous Goal, Role, meeting, Project, Action, Tension, or governance mutation.
- Plugin activation, deployment changes, or M5 resilience hardening.
- AI-only signal creation without deterministic source evidence.

## Architecture

M4-A adds a bounded Signal Service beside the existing Organization Brain services.

The service runs in three steps:

1. Resolve ActorContext using the accepted M1 boundary.
2. Collect deterministic signals from authorized tenant-scoped facts.
3. Return a private brief DTO with source links, reason codes, and safe next actions.

The Signal Service must not import command execution, generic write surfaces, plugin gateways, deployment code, or model provider code. AI narration, when later enabled, may only rewrite already detected signal facts and must preserve source IDs. The first slice can render deterministic copy without a model dependency.

## Data Model

M4-A may start without persistent brief tables if the brief is computed on demand and remains fast enough. If persistence is needed for deduplication, the table must be private by owner and store only signal identities, timestamps, source references, dismissal state, and brief window metadata.

No table in M4-A may represent shared memory, canonical organization truth, or AI-confirmed knowledge. Shared memory remains a later M4 slice behind source-authority confirmation.

## Initial Signal Set

The first accepted signal set is deliberately small:

- Stale Goal check-in: active Goal has no recent evidence inside the configured brief window.
- Missing Target evidence: active Target has no current check-in or correction trail.
- Unresolved meeting output: recent tactical or governance meeting has notes or outcomes that did not lead to an accepted next process.
- Repeated Tension: similar unresolved Tensions recur in the same Circle.
- Role/work mismatch: a member carries active work with no clear Role or Circle context.
- Missing child Goal: a child Circle has no active primary Goal while its parent has one.

Each detector must fail closed when required source facts are missing or unauthorized.

## User Experience

The brief appears as a private Organization Brain surface. It should feel like an operational inbox, not a notification feed.

For every signal, the user sees:

- A short title.
- The source and evidence age.
- The reason the Brain surfaced it.
- One or more links to inspect the source.
- One safe next action, such as opening the Goal Tree, opening a meeting, raising a Tension, or preparing a command preview.

The brief must not claim that an AI inference is an organization fact. AI-derived wording is labeled as interpretation or suggestion.

## Authority Model

Private briefs inherit the actor's existing read permissions. If a user cannot read the source record through accepted policy, no signal may reveal its existence, count, or value.

Suggested actions do not grant new authority. They only navigate to existing pages or prepare M3-style previews that still require fresh authorization and explicit confirmation.

## Failure Behavior

- No actor context: return an indistinguishable access denial.
- Missing source facts: omit the signal or mark evidence missing without inventing facts.
- Expensive query: cap the detector and disclose truncation in the brief.
- Model unavailable: render deterministic brief text.
- Policy mismatch: fail closed and produce an auditable error.

## Acceptance Evidence

M4-A cannot be accepted until the following evidence exists:

- Focused tests for detector rules, source links, deduplication, truncation, permission filtering, and safe next actions.
- Static tests proving no command execution, generic write, model provider, plugin gateway, deployment, or shared-memory write boundary is imported by the detector.
- PostgreSQL evidence for two-tenant isolation, owner-private brief visibility, missing-source fail-closed behavior, stale/repeated signal handling, and no mutation side effects.
- Browser evidence for a member opening their private brief, following source links, seeing deterministic degraded states, and another member not seeing private signals.
- Independent implementation review and roadmap audit with no open P0/P1/P2.

## Follow-On M4 Slices

Later M4 slices may add:

- Meeting preparation briefs.
- Memory candidates.
- Source-authority confirmation.
- Validity, expiry, and supersession for confirmed procedural memory.
- Notification policies.

Those remain inactive until M4-A is accepted.
