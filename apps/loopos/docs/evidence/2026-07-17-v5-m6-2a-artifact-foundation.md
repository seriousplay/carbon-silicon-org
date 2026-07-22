# V5-M6-2A Brain Artifact Foundation Checkpoint

Date: 2026-07-17
Status: accepted

## Scope

This checkpoint covers only the owner-private `BrainArtifact` persistence
foundation and one explicit audited lifecycle. It does not activate the typed
capability registry, inline rendering, meeting operations, plugins, semantic
retrieval, or broad notifications.

## Implemented

- Added `BrainArtifactStatus` and the additive `brain_artifacts` table.
- Added tenant/owner composite references to `Organization` and `Person`.
- Added optional conversation and linked-command-operation composite references.
- Added payload/source-array/schema-version/expiry/lifecycle database checks.
- Added terminal-row immutability trigger for `SUCCEEDED` and `FAILED`.
- Added `BrainArtifactAuditEvent` with immutable audit rows for `CREATED`,
  `READY`, `EXECUTION_STARTED`, `SUCCEEDED`, and `FAILED`.
- Added same-tenant/same-owner `supersedesArtifactId` relation; service permits
  supersession only of the owner's terminal artifact.
- M6-2A supports one explicit artifact type, `TENSION_DRAFT`, with a required
  bounded `title` payload; later artifact types remain inactive.
- Source references now carry organization and optional owner bindings; the
  lifecycle rejects foreign organization/owner references.
- Added `artifact-types.ts`, `artifact-lifecycle.ts`, and the server-only
  `artifact-service.ts`.
- The service loads and transitions artifacts only through the current
  Actor's `organizationId` and `personId`.
- Failed execution preserves the original draft payload; terminal results are
  immutable in the pure lifecycle and database trigger.

## Evidence

- Pure lifecycle tests: 3/3 pass.
- Pure lifecycle tests cover foreign source organization/owner bindings and
  the 64KB payload boundary.
- Independent persistence/security re-review: `PASS`, no P0/P1/P2.
- PostgreSQL acceptance script (14 checks): owner can read its own artifact; foreign owner
  and foreign tenant receive zero rows; non-DRAFT insertion is rejected; audit
  actor mismatch is rejected; failed lifecycle preserves the payload and
  records four audit events; foreign source bindings and missing source messages
  are rejected by database constraints; same-owner supersession succeeds and cross-tenant
  supersession is rejected; invalid lifecycle update is rejected; direct
  DRAFT-to-SUCCEEDED is rejected; terminal update and delete are rejected by
  the database trigger with exact `P0001`.
- TypeScript: `npx tsc --noEmit` pass.
- Scoped ESLint: pass for all four artifact files.
- Prisma validation: pass, with only the pre-existing `driverAdapters`
  deprecation warning.
- `git diff --check`: pass.
- Fresh PostgreSQL migration: all 28 migrations applied successfully.
- Fresh PostgreSQL rollback and reapply: pass for the M6-2A migration.
- PostgreSQL structure probe: `brain_artifacts` exists, the status type exists,
  the command-operation tenant index, owner-conversation index, source-message
  FK, and immutable source-ref validation function exist.
- Temporary database cleanup: zero `loopos_m6_2a_%` databases remain.
- Production refresh through a read-only SSH tunnel: Brain and application
  credentials connect to LoopOS; all four attempts to connect to `biocoach` or
  `postgres` return exact SQLSTATE `42501`; Brain Reader mutation denial also
  returns exact SQLSTATE `42501` with zero effective write surface.
- The 14-check PostgreSQL acceptance was rerun after the final source-binding
  and terminal-delete assertions; all checks passed, rollback/reapply passed,
  and the temporary database count returned to zero.

## Review checkpoint

The independent persistence/security review initially found four P1 and three
P2 issues; the follow-up review identified supersession and source ownership
gaps. All findings were fixed, the same reviewer returned `PASS` with no
P0/P1/P2, and the current snapshot now has:
optimistic expected-status
transitions, database INSERT/UPDATE transition graph and time-order checks,
same-owner supersession, owner-bound conversation/message/command references,
organization/owner-bound source refs, bounded JSON input and stable
persistence errors, terminal delete protection, and actor-person audit FKs.

The final independent roadmap/evidence audit returned `PASS` with no P0/P1/P2.
M6-2A is accepted; M6-2B is now the only active slice.
