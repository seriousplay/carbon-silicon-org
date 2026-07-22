# V5-M6-2B Typed Brain Capability Contract

Status: implementation evidence collected; final acceptance pending same-reviewer re-review.

## Scope

This slice adds a versioned capability contract for the six existing Brain
commands. It adapts the existing `BRAIN_COMMAND_REGISTRY`; it does not create a
second domain schema or replace the canonical domain handlers.

The contract declares reads, authority, confirmation, process gate, fixed
handler identity, idempotency, audit event, artifact type, and fallback. Stored
operation parsing resolves the capability and its schema version before payload
validation. Confirmation checks the fixed command-to-handler identity and
requires confirmation and idempotency. Tactical meeting-note mutation is
domain-gated to `TACTICAL` meetings. `tension.raise` is represented as a
confirmed proposal that creates a formal Tension, matching its current domain
behavior.

## Local Evidence

| Check | Result |
| --- | --- |
| Capability contract tests | 4/4 pass |
| Command, preview, and handler regression tests | 22/22 pass |
| Combined focused tests | 26/26 pass |
| TypeScript | pass |
| Scoped ESLint | pass |
| `git diff --check` | pass |
| Production build | pass |

The public preview service has an explicit `server-only` boundary. Client
imports are type-only and static tests reject client directives in the handler
and preview core.

## Production BioCoach Boundary

The production host is `/var/www/loopos`. A read-only SSH tunnel was used so a
local `pg` client could capture structured PostgreSQL errors without printing
credentials. All required denials returned SQLSTATE `42501`:

| Identity | Target database | Result |
| --- | --- | --- |
| `loopos_app` | `biocoach` | `42501` |
| `loopos_app` | `postgres` | `42501` |
| `loopos_brain_login` | `biocoach` | `42501` |
| `loopos_brain_login` | `postgres` | `42501` |
| `loopos_brain_login` mutation probe | `loopos` | `42501` |

The mutation probe was transactional and rolled back. No BioCoach code,
schema, row, migration, credential, or process was changed.

## Remaining Gate

Same-reviewer re-review of the post-fix capability contract remains required.
Browser governance-loop evidence is also not claimed by this source review.
