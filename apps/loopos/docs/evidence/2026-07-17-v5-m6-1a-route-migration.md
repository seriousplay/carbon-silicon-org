# V5-M6-1A Brain-first Route Migration

Date: 2026-07-17

Status: accepted; M6-1B activated

## Outcome

- `/app` is the Organization Brain home.
- The previous `/app` Workspace is moved intact to `/app/workspace`.
- `/app/brain` is a Server Component compatibility redirect to `/app`.
- The four primary one-click entries are `工作`, `目标`, `会议`, and `组织`.
- Organization identity and the global Brain launcher open `/app`.
- No domain operation, authorization rule, database schema, deployment state, or BioCoach application/data was changed.

## Source Evidence

- Normalized old `/app` and new `/app/workspace` source: no diff beyond the component name.
- Focused route/layout tests: `21/21` pass.
- Scoped ESLint: pass.
- TypeScript `--noEmit`: pass.
- `git diff --check`: pass.
- Changed-source BioCoach reference scan: zero.
- Independent implementation reviewer `Russell` (`019f6f0e-8f40-7662-b4bf-40ada76902cf`): PASS, no P0/P1/P2 findings.

Full source-runner boundary:

- The runner discovered and executed `102/102` source-test files and recorded `877` tests.
- It did not finish green because the pre-existing `src/app/app/setup/actions.test.ts` fixture statically imports `server-only` before its shim and exits without a valid TAP summary.
- M6-1A does not modify that setup action or test. This is retained as unrelated test-harness debt rather than represented as a passing full-suite claim.

## Build Evidence

- Next.js `16.2.10` production build: pass.
- Static generation: `36/36` pages.
- Runtime route inventory includes `/app`, `/app/brain`, and `/app/workspace`.
- The first sandboxed build failed only because Turbopack could not bind an internal port. The same build passed outside the sandbox; no code change was needed.

## Browser Evidence

Environment: local production-mode Next server, Chromium, and a disposable PostgreSQL database with all `27/27` migrations.

- Desktop and mobile primary navigation exactly match the four approved entries.
- Desktop Workspace active state: pass.
- Mobile Workspace `aria-current=page`: pass.
- Global Brain launcher opens and its expand link targets `/app`.
- `/app/brain` redirects to `/app`.
- Mobile horizontal overflow: false.
- Console errors: `0`; page errors: `0`; HTTP `4xx/5xx`: `0`.
- Temporary users, people, organizations, sessions, and accounts after cleanup: all `0`.
- Disposable database and temporary no-login Reader role after cleanup: both `0`.

Screenshots:

- `docs/evidence/assets/2026-07-17-v5-m6-1a-desktop-brain-home.png`
- `docs/evidence/assets/2026-07-17-v5-m6-1a-mobile-workspace.png`

Reusable verifier:

- `scripts/m6-1a-browser-acceptance.cjs`

## BioCoach Boundary

BioCoach remains a separate application and data domain. This local slice did not connect to, query, migrate, or modify BioCoach. The production `42501` cross-database denial verifier remains a mandatory M6-1 release gate and is not claimed as refreshed by this local browser run.

## Final Roadmap Audit

Auditor: Halley (`019f6f16-d89b-75c0-88d3-308314783482`)

Conclusion: ACCEPT M6-1A AND ACTIVATE M6-1B

No P0/P1/P2 findings.

BioCoach production `42501` remains a mandatory M6-1 release gate.
