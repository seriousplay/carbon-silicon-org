# V5-M7 Governance Execution Surface

## Objective

Make the Organization Brain a reliable execution entry point for the full
governance change vocabulary, so a real team can move from tension to proposal,
meeting approval, organization-state change, and auditable follow-up without
falling back to hidden administrative screens.

## Scope

- Complete browser-verifiable Brain-to-governance paths for:
  `ROLE_MODIFIED`, `ROLE_ARCHIVED`, `CIRCLE_MODIFIED`, `HOME_CHANGE`,
  `AGENT_CREATED`, `CHARTER_CREATED`, and `CHARTER_AMENDED`.
- Keep the already-proven `CIRCLE_CREATED` path as the reference contract.
- Add execution-level tests against PostgreSQL for every branch, including
  rollback, idempotency, proposer authority, participant authority, and
  append-only audit behavior.
- Make the UI state explicit when a proposal is drafted, awaiting meeting
  review, ready for adoption, adopted, or failed and recoverable.
- Add a small-team onboarding path as the default product entry, without
  removing the existing foundation-model-team template.

## Decisions

- Structural decisions remain proposer-led and meeting-approved. A circuit
  owner is not the hidden decision maker.
- The proposer may self-approve only through the completed meeting process; the
  UI must show that this is process authority, not unilateral authority.
- No new read-only Brain domain is added until the execution surface is closed.
- BioCoach remains a separate application and database; cross-database reads
  remain a hard acceptance gate.

## Required evidence

- One production or production-equivalent browser acceptance per structural
  change type.
- One disposable-PostgreSQL execution suite covering all branches and failure
  recovery.
- TypeScript, lint, focused tests, production build, HTTP smoke, and exact
  `42501` BioCoach/postgres isolation proof.
- Independent implementation review and independent roadmap reclosure.

## Out of scope

- Watches, broad proactive memory, new plugin modules, or additional AI
  personas.
- Replacing the existing tactical-meeting workflow.
