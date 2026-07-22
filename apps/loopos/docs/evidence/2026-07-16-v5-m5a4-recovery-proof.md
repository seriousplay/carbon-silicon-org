# V5-M5-A4 Rollback and Recovery Proof

Date: 2026-07-16
Recorder: Codex coordinator

## Scope

- Claim: rollback and recovery proof is defined and locally dry-run checked.
Explicit non-claims:

- no production rollback drill was executed;
- no production PM2 process was reloaded;
- no Nginx config was changed;
- no database restore was executed.

## Delivered Artifacts

- `docs/evidence/production-recovery-checklist.md`
  - Defines required release targets, database rollback classification, PM2
    scope, Nginx withdrawal scope, restoration checks, and missing-evidence
    handling.
- `scripts/verify-production-recovery-plan.mjs`
  - Dry-run checker for the local recovery contract.
  - Verifies the PM2 process names and release path in
    `deploy/aliyun/ecosystem.config.cjs`.
  - Verifies the LoopOS-only Nginx HTTPS and HTTP fragments.
  - Verifies the README and recovery checklist include database and PM2
    boundaries.
- `deploy/aliyun/README.md`
  - Expands rollback instructions with previous-release target, database
    rollback/remediation boundary, LoopOS-only PM2 reload, and service
    restoration checks.

## Coordinator Verification

| Check | Result |
| --- | --- |
| `node --check scripts/verify-production-recovery-plan.mjs` | pass |
| `node scripts/verify-production-recovery-plan.mjs` | pass: PM2 scope, release path, HTTPS LoopOS locations, HTTP LoopOS redirects, README rollback boundary, recovery checklist boundary, and restoration checks. |
| `git diff --check` | pass |

## Deferred Evidence

- Production rollback drill remains deferred.
- Production PM2/Nginx execution remains deferred.
- Database restore or forward-only remediation proof remains deferred until a
  real release needs it or a controlled recovery drill is authorized.
