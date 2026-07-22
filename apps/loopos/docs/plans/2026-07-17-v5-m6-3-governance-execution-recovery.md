# V5-M6-3 Governance Execution Recovery

## Goal

Make the Brain-first product trustworthy for a real team by restoring one
production database contract and connecting the Brain to the complete
distributed governance decision path.

## Target outcome

An authenticated team can open the Brain, inspect current organization facts,
raise a tension, prepare and confirm the appropriate tactical or governance
proposal, and see the resulting organization state without runtime migration
failures or a central circuit-owner decision shortcut.

## Scope

1. Reconcile the Prisma migration history and production schema. No new domain
   feature work is allowed until the migration ledger and schema agree.
2. Move the six existing governance change types into the typed, previewed,
   explicitly confirmed, freshly authorized, idempotent command path.
3. Add the missing distributed decision paths for circle ownership changes,
   charter changes, and agent participation, preserving proposer-led proposals
   and meeting review.
4. Make the lightweight team onboarding path usable for a 3-5 person team.
5. Publish a locally built, portable production artifact and prove the browser
   flow against a real migrated database.

## Decisions

- A tactical meeting does not change organization structure; structural changes
  go through governance.
- The tension proposer submits the proposal. The meeting process reviews it;
  the proposer may self-approve only as a power granted by the completed
  process, never as unilateral authority.
- A circuit lead is not the universal decision maker. A dissent must identify
  a concrete risk of organizational damage or regression; the facilitator
  helps test that claim, and a new tension remains available afterward.
- Brain writes remain previewed, confirmed, authorized, and audited. The Brain
  does not become a central administrator.
- BioCoach cross-database denial with SQLSTATE 42501 remains a mandatory gate.

## Required evidence

- Disposable PostgreSQL: all repository migrations apply from an empty
  baseline, `migrate deploy` is idempotent, and production schema matches the
  current Prisma schema.
- Focused tests for all six governance command variants, proposer authority,
  meeting review, objection handling, idempotency, and tenant isolation.
- Browser proof of: Brain -> tension -> proposal preview -> confirmation ->
  tactical/governance meeting -> project/action or structural change -> state.
- Production smoke proof after local standalone build and release switch.
- Exact BioCoach and postgres denial evidence with SQLSTATE 42501.
- Independent review and roadmap audit before activating the next milestone.

## Blockers

- Production is currently on the previous stable release because the first
  local-to-Linux deployment attempt used a non-portable Next build output.
- The v4 report identifies 13 unapplied migrations in the reviewed runtime
  state; this must be verified against the current production database before
  any schema or feature implementation.
- Agent creation, HOME_CHANGE, and Charter execution are currently unavailable
  in the reviewed implementation.

## Explicit non-goals

- No new Brain read surface, semantic retrieval, global feed, plugin system, or
  proactive notification expansion.
- No speculative refactor of accepted tactical behavior.
- No completion claim based only on source tests or a successful local build.
