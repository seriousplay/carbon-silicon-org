# V5-M5-B Acceptance State

Date: 2026-07-16

Scope:
- Summarize the current M5-B evidence ledger.
- Prevent accidental acceptance while explicit blockers remain.
- Keep production dynamic-read, screenshot, rollback-switch, and longitudinal
  evidence separated.

## Verifier

Added:
- `scripts/verify-m5b-acceptance-state.mjs`

Current production release:
- `/var/www/loopos/current` points to
  `/var/www/loopos/releases/20260716-135813-m5b-trial`.
- This release was deployed to enable real-team trial operation. It does not
  change the acceptance boundary below.

Command:

```bash
node scripts/verify-m5b-acceptance-state.mjs --json
```

Result:

```json
{
  "accepted": false,
  "activeMilestone": "V5-M5-B",
  "summary": {
    "pass": 15,
    "blocked": 2,
    "missing": 0
  }
}
```

## Passed Gates

- Production release identity, migration count, and PM2 readback are recorded.
- Public HTTP evidence is recorded.
- Authenticated HTTP smoke and cleanup are recorded.
- Authenticated browser form login and Organization Brain navigation are
  recorded.
- Safe blocked Brain reader boundary is recorded.
- Bounded recovery proof is recorded.
- Product-owner decision accepts the bounded recovery proof as sufficient for
  M5-B without an extra rollback symlink switch drill.
- Screenshot-based authenticated browser evidence and cleanup are recorded.
- Longitudinal real-team verifier exists and has been dry-run against the
  production schema.
- `GOALS.md` and `progress-dashboard.html` reflect the current M5-B state.
- Production verifier scripts exist for HTTP, authenticated HTTP, browser smoke,
  Brain boundary, and Brain readiness.

## Blocked Gates

- `brain-readiness`: readiness verifier exists but currently fails because
  `BRAIN_DATABASE_URL` is absent.
- `longitudinal-real-team`: real-team longitudinal operation evidence is
  explicitly unproven.

## Decision

M5-B is not accepted.

The current state is useful and not a loop:
- core production deployment is live and repeatedly verifiable;
- authenticated HTTP and browser interaction have passed;
- Brain reader boundary is safely blocked and now has both boundary and future
  readiness verifiers;
- production recovery no longer requires an extra rollback drill in M5-B;
- screenshot-based browser proof is now durable evidence;
- remaining blockers are explicit and narrow.

Do not mark V5 complete until the blocked gates are either satisfied or
explicitly descoped by product-owner decision.
