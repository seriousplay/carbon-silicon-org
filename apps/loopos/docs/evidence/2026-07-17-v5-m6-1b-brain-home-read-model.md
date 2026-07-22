# V5-M6-1B Brain Home Read Model

Date: 2026-07-17

Status: accepted; M6-1C activated

## Outcome

- `/app` now loads one Actor-scoped Organization Brain home projection before
  the existing Brain workspace.
- The projection combines the current relevant primary Goal, nearest future
  participant meeting, unfinished private Brain work, approved actor-owned
  Projects and Actions, relevant unresolved Tensions, and deterministic private
  brief signals.
- Visibility and ranking are deterministic and capped at three. The model may
  enrich only summary and relevance wording; it cannot change the change fact,
  identity, order, evidence, or navigation action.
- Every focus item exposes a change fact, relevance, evidence and freshness,
  and one `/app` navigation-only next action. Healthy state exposes Goal, next
  meeting, and active Projects.
- Confirmed absence is distinct from source failure. Failed dynamic sources
  retain confirmed facts with an explicit freshness limitation.

## Source Evidence

- Correction-focused tests: `17/17` pass.
- Related home/private-brief/Goal tests: `37/37` pass before review corrections.
- Scoped ESLint: pass.
- TypeScript `--noEmit`: pass.
- `git diff --check`: pass.
- Changed-source scan: no BioCoach, Brain Query Broker, Brain Reader credential,
  or domain mutation reference.
- The read model does not cross the Brain Query Broker; the plan's conditional
  two-tenant Broker PostgreSQL test is therefore not activated.

Full source-runner boundary:

- The runner discovered and executed `104/104` source-test files and recorded
  `890` tests.
- It did not finish green because the pre-existing
  `src/app/app/setup/actions.test.ts` fixture still exits without a valid TAP
  summary. M6-1B does not modify that action or test, so this remains unrelated
  test-harness debt rather than a passing full-suite claim.

## Build Evidence

- Next.js `16.2.10` production build: pass.
- Static generation: `36/36` pages.
- Runtime route inventory retains `/app`, `/app/brain`, and `/app/workspace`.

## Browser Evidence

Environment: local production-mode Next server, Chromium, and a disposable
PostgreSQL database with all `27/27` migrations.

- Four authorized current-tenant Tensions were seeded; desktop and mobile each
  rendered exactly the first three in stable order.
- Desktop and mobile each exposed exactly three evidence links and three action
  links, all under `/app`.
- The first evidence link and first action link were clicked and reached their
  exact Tension detail URL.
- Goal, next-meeting, and active-Project healthy-state labels were visible.
- Confirmed absence of an active Goal cycle did not produce a false
  `新鲜度受限` warning.
- Desktop and mobile horizontal overflow: false.
- Console warnings/errors: `0`; page errors: `0`; HTTP `4xx/5xx`: `0`.
- Temporary users, people, organizations, sessions, and accounts after cleanup:
  all `0`.
- Disposable database and temporary no-login Reader role after cleanup: both
  `0`.

Screenshots:

- `docs/evidence/assets/2026-07-17-v5-m6-1b-desktop-brain-focus.png`
- `docs/evidence/assets/2026-07-17-v5-m6-1b-mobile-brain-focus.png`

Reusable verifier:

- `scripts/m6-1b-browser-acceptance.cjs`

## Independent Implementation Review

Reviewer: Locke (`019f6f2c-9946-7620-989a-c6576cde4359`)

The first review found two P1 and two P2 issues: future-meeting semantics,
missing explicit change facts, incomplete Role relevance wording, and weak link
navigation assertions. All four were corrected. Same-reviewer reclosure:

`ACCEPT M6-1B`

No P0/P1/P2 findings.

## BioCoach Boundary

BioCoach remains a separate application and data domain. This local slice did
not connect to, query, migrate, configure, or modify BioCoach. The production
SQLSTATE `42501` denial for both LoopOS application and Brain credentials must
be refreshed before M6-1 release acceptance; it is not claimed by this local
evidence.

## Final Roadmap Audit

Auditor: Meitner (`019f6f34-b840-76f1-86e4-05fbf9c991a1`)

Conclusion: `ACCEPT M6-1B AND ACTIVATE M6-1C`

No P0/P1/P2 findings. The auditor preserved the full-runner boundary, the
conditional non-activation of Broker PostgreSQL evidence, the M6-6 real-team
deferral, and the mandatory production BioCoach `42501` M6-1 release gate.
