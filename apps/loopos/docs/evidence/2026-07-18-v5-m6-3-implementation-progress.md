# V5-M6-3 Implementation Progress

## Proven in this slice

- Production stable release was checked with `prisma migrate status`: 31/31
  migrations applied and schema up to date.
- The local schema adds reversible migrations for generic governance outcome
  targets (`outcomeObjectId`, `outcomeChangeType`).
- The governance change parser accepts the six existing structural changes plus
  agent creation and Charter creation/amendment, with closed keys and bounded
  text.
- The governance adoption transaction executes role, circle, home, agent, and
  Charter changes in the same audited transaction as proposal/process/tension
  updates.
- Brain now has an allowlisted `governance_proposal.create` capability. It
  requires confirmation, uses the governance meeting gate, binds the proposer
  to an open tension, and writes a candidate proposal through the command
  ledger handler.
- Brain also exposes a server-side preview creator that resolves the actor,
  open tension, governance meeting, conversation, and user message before
  writing a ten-minute command preview.
- A `lean-team` onboarding template provides one root circle and three roles.

## Verification

- `pnpm prisma validate`: pass.
- `npx tsc --noEmit --pretty false`: pass.
- `git diff --check`: pass.
- Focused command/capability/handler/governance/template/Brain-client tests:
  48/48 pass; focused governance transition, authority, idempotency, and
  recovery tests pass 38/38.
- `npm run build`: pass; Next.js generated the 36 application routes.
- Production-path build with `NEXT_PUBLIC_BASE_PATH=/loopos` and
  `AUTH_URL=https://csi-org.com`: pass; `routes-manifest.json` records
  `basePath=/loopos`, `.next/standalone/server.js` is present, and the local
  release archive preserved `.next/node_modules`.
- Deployment contract assertions for the two `/loopos` Nginx locations and
  HTTP redirect: pass.

## Not yet proven

- Execution-level tests for every non-role structural adoption branch. The
  production browser proof covers `CIRCLE_CREATED`; parser and state-machine
  coverage do not substitute for direct execution proof of the remaining
  branches.
- A browser workflow for each non-role structural change type, rather than the
  currently proven circle-creation path.

The disposable PostgreSQL attempt on the local host was blocked by the local
host's SysV shared-memory limit (`shmget: No space left on device`). An empty
baseline database on the production host was subsequently created and removed
after all 31 migrations applied and a second deploy returned no pending
migrations; no production database was reset.

The repository-wide ESLint command still reports pre-existing CommonJS import
errors in deployment/smoke scripts; all M6-3 changed TypeScript files pass a
targeted ESLint run.

## Production release readback

- Release `/var/www/loopos/releases/20260718-m6-3` was built locally and
  switched into `/var/www/loopos/current`.
- Production migration deploy applied the M6-3 outcome, Brain command-check,
  and structural-outcome migrations; subsequent status readback reports the
  database schema up to date with 31 migrations found.
- PM2 readback reported `loopos-web` using
  `.next/standalone/server.js` and both LoopOS processes online.
- Public HTTP smoke passed for base path, trailing slash, login, and auth
  session. This proves release availability, not the authenticated governance
  browser loop.
- Production isolation verifier passed: both LoopOS credentials can connect to
  LoopOS, while Brain and application credentials were denied from both
  `biocoach` and `postgres` with SQLSTATE `42501`.
- The production rollback-scoped M6-2A PostgreSQL acceptance suite passed all
  14 artifact ownership, lifecycle, audit, immutability, and transition checks.
- A production browser registration check initially exposed root-path redirects
  escaping `/loopos`; auth, app-layout, tension, and meeting server redirects
  were changed to use `withBasePath()`. The post-fix check reached
  `https://csi-org.com/loopos/app` and rendered the Organization Brain entry.
  Five temporary test organizations/accounts were removed after the check.
- A later production browser run passed registration, governance tension,
  governance meeting, Brain conversation, governance proposal preview, and
  explicit confirmation. The resulting `governance_proposal.create` command
  was read back as `SUCCEEDED`, with one persisted governance proposal.
- The production release required standalone `.next/static` to be copied into
  `.next/standalone/.next/static`; without it, all Brain client JavaScript and
  CSS returned 404. Server redirects also remain framework-relative so Next.js
  applies `/loopos` exactly once.

The full Brain-to-governance structure path is now browser-proven in production
with the temporary account `m63-1784307953030@example.invalid`: registration,
governance tension, governance meeting, Brain proposal preview, explicit
confirmation, candidate initialization to `READY`, and meeting-participant
adoption to `ADOPTED`. Database readback recorded:
`ADOPTED|ADOPTED|CIRCLE_CREATED|cmrp6wrrm001r5nkmo0nek8rp|治理验证回路 1784307953030`.
The product owner accepted the retained-fixture strategy: `m6-3-acceptance-*`
organizations and accounts are independent acceptance fixtures, excluded from
real organization views, and their append-only governance audit records remain
permanently retained. No destructive cleanup or trigger bypass is required;
future browser evidence must use this prefix and a designated acceptance
database/tenant separate from real-team data.

The read-only isolation verifier `scripts/verify-m6-3-fixture-isolation.mjs`
was added and syntax-checked. Its local acceptance-database read returned
`ok: true` with zero matching organizations/accounts, confirming that no
M6-3 fixture currently exists in the local development database. A populated
fixture run remains required before treating the production-equivalent browser
gate as closed.

The browser script's activity heuristic has now been tightened to recognize
the successful governance composer response, and its base-path check now
normalizes a trailing slash. The latest run showed all nine recorded steps
true; its aggregate flag was false only because the older exact base-path
comparison rejected a trailing slash. A fresh run after this final script
correction is still required before treating its aggregate result as a release
gate.

## Refreshed production gates

- Production `npx prisma migrate status` reports 31 migrations found and
  `Database schema is up to date!`.
- Production HTTP verification passed base path, trailing-slash
  normalization, login, and auth-session checks.
- Production cross-database isolation verification passed all six checks:
  both dedicated LoopOS credentials connect only to `loopos`, while Brain and
  application credentials are denied from both `biocoach` and `postgres` with
  SQLSTATE `42501`.
- Full repository ESLint now exits successfully with three unrelated unused
  variable warnings, and the repository TypeScript check passes. The
  CommonJS deployment/smoke scripts retain their runtime form with explicit
  file-level lint allowances.
- A temporary PostgreSQL database on the production host was created from an
  empty baseline. All 31 repository migrations applied successfully, a second
  `migrate deploy` returned `No pending migrations to apply`, and the temporary
  database was deleted afterward. This proves empty-baseline migration and
  idempotence for the current migration ledger; the local host limitation was
  bypassed without touching the production `loopos` database.
- The production M6-2A PostgreSQL acceptance suite was rerun and passed all 14
  tenant-ownership, lifecycle, audit, immutability, and transition checks.
- Focused governance tests passed 38/38 across the six-state transition table,
  distributed authority, proposer/participant boundaries, objection and
  revision semantics, idempotent operation claims, concurrency, and failure
  recovery.
- The coordinator source review found and closed one migration rollback issue:
  `rollback.sql` now restores the prior state projection constraint instead of
  leaving the table without that guard. The remaining review gate is the
  milestone-level roadmap audit, not an open source finding.
- The final corrected production browser run returned aggregate `ok: true` for
  all nine steps, including Brain activity, proposal preview and confirmation,
  governance initialization, and structural adoption. Run suffix:
  `1784309065974`.

## Product interpretation

The V4 review's migration and Brain-governance findings are closed by current
production evidence. Its remaining product diagnosis is still active: Brain is
an effective coordinating entry point for sensing, proposal drafting, and one
structural adoption path, but it is not yet a uniform execution surface for
all governance changes. The next slice must therefore prioritize one complete
browser-verifiable path per structural change type, with proposer-led,
meeting-approved, audited distributed decision authority preserved.

The independent implementation review also found that the meeting UI used the
role-specific label "采纳并创建角色" for every structural change. That copy
was corrected to render the concrete change label (for example, "采纳：创建回路"
or "采纳：变更归属"); the focused TypeScript, ESLint, and diff checks pass.
The production browser acceptance selector was updated at the same time to
target the generic `采纳：` prefix rather than the retired role-specific label;
the script passes `node --check`.

The current local production build was rerun outside the restricted sandbox
because Turbopack's CSS worker requires subprocess/port binding. The build
completed with 36/36 generated routes, TypeScript passed, the manifest records
`basePath=/loopos`, `.next/standalone/server.js` exists, and `.next/static` was
copied into `.next/standalone/.next/static` for the portable release artifact.

The first attempted remote release switch to
`20260718-m6-3-current` was rolled back immediately after post-switch HTTP
verification found `/loopos/api/auth/session` returning 500. PM2 logs showed
standalone external-module resolution failures for `pg` and Prisma runtime;
the previous release `20260718-m6-3-brain-input` was restored and only the two
LoopOS PM2 processes were reloaded. The new release is therefore not counted
as a production pass. The deployment packaging contract still requires a
portable standalone dependency closure before another switch.

A second attempted release with the `.next/node_modules` aliases added still
failed after `/loopos/api/auth/session` exposed transitive pnpm aliases
(`pg-types` and `@prisma/client-runtime-utils`). It was also rolled back
immediately. The stable release was then rechecked: base path 200, slash
normalization 308, login 200, and auth/session 200. No failed release remains
active.

The packaging correction was then validated on a remote temporary port by
dereferencing the full pnpm virtual-store top-level dependency links into the
standalone runtime; `/loopos/api/auth/session` returned 200. The corrected
release `20260718-m6-3-fixed` was switched to production afterward. Final
public HTTP verification passed base path 200, slash normalization 308, login
200, and auth/session 200; both LoopOS PM2 processes are online.

Post-release browser acceptance returned aggregate `ok: true` for all nine
steps on the corrected release: registration, governance tension, governance
meeting, Brain question, proposal composer, preview, confirmation, governance
initialization, and `ADOPTED` circle creation. Run suffix:
`1784310698125`. The browser showed the corrected `采纳：创建回路` label.

The acceptance script now supports `M63_EVIDENCE_FILE` for a machine-readable
result artifact. A second post-release run also returned aggregate `ok: true`
with run suffix `1784310856694`; the JSON result was written to the local
temporary evidence path during verification.

The new structural coverage gate `scripts/verify-governance-structural-coverage.mjs`
passes for all nine supported operations across the parser, executor, meeting
workbench, and Brain preview entry. This is source-contract evidence only; it
does not replace the still-open real database/browser evidence for each branch.

The independent read-only review in `review/v4/m6-3-read-only-review.md` was
integrated. Its B1 finding was corrected in the local environment by applying
all 16 pending migrations; the local database now matches the 31-migration
ledger. Its B4 audit finding was corrected by recording the meeting adopter as
`DecisionRecord.decisionMakerId` in the non-role adoption transaction. Focused
governance, persistence, and structural contract tests pass 40/40 after the
correction.
