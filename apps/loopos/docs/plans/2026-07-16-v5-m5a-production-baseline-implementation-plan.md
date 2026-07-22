# V5-M5-A Production Baseline Implementation Plan

Date: 2026-07-16

Design source:
`docs/plans/2026-07-16-v5-m5a-production-baseline-design.md`

Status: active planning checkpoint

## Execution Rules

- Do not deploy in M5-A planning.
- Do not activate pluginization, notifications, semantic retrieval, or
  longitudinal real-team claims.
- Keep production, browser, source/build, migration, rollback, and longitudinal
  evidence separate.
- Preserve the existing accepted M1-M4 product behavior.
- Do not commit secrets, production environment files, PM2 dumps, or raw logs
  containing credentials.

## Slice M5-A1 - Contract and Release Evidence Shape

Outcome:
- Lock the production release contract and define a secret-free evidence shape.

Likely ownership:
- `deploy/aliyun/README.md`
- new `docs/plans/2026-07-16-v5-m5a-production-baseline-design.md`
- new `docs/plans/2026-07-16-v5-m5a-production-baseline-implementation-plan.md`
- optional future `scripts/verify-production-baseline.mjs`

Required behavior:
- Public URL, release path, env path, PM2 processes, upstream port, base path,
  and NextAuth URL expectations are explicit.
- The evidence shape records commit/tree identity, local build command,
  migration status, PM2 status, public HTTP checks, browser smoke, rollback
  target, and redaction policy.
- Documentation reconciles `npm` versus `pnpm` so the deployment path uses the
  repository's actual package manager.

Evidence:
- `git diff --check`.
- Static source inspection of deployment docs and package scripts.
- Independent design/roadmap review with no P0/P1/P2.

## Slice M5-A2 - Local Release Candidate Verification

Outcome:
- Prove a candidate release is buildable locally with the production base path
  and has no obvious source/build/migration drift.

Likely ownership:
- verification script if needed
- docs/evidence output shape if needed
- no production deployment yet

Required behavior:
- Run the repository's actual install/build/test commands.
- Build with `NEXT_PUBLIC_BASE_PATH=/loopos` and `AUTH_URL=https://csi-org.com`.
- Validate Prisma schema and migration deploy path against a disposable
  PostgreSQL database when available.
- Verify `.next/routes-manifest.json` contains the `/loopos/` to `/loopos`
  redirect expected by the Nginx contract.

Evidence:
- Full source tests.
- TypeScript.
- Scoped or full ESLint as appropriate.
- Prisma validate.
- Production build with `/loopos` base path.
- Disposable PostgreSQL migration apply evidence or a recorded blocker if local
  PostgreSQL is unavailable.

## Slice M5-A3 - Production Health and Browser Smoke Design

Outcome:
- Define exactly what the local or production validation thread must prove once
  deployment authority is available.

Likely ownership:
- production smoke script or documented checklist
- optional read-only health/status endpoint only if existing routes are
  insufficient

Required behavior:
- Public checks cover `https://csi-org.com/loopos` and
  `https://csi-org.com/loopos/`.
- Browser smoke covers login route, authenticated shell, four primary entries,
  and Organization Brain route under `/loopos`.
- Console/network ledger is captured.
- The smoke must not seed or mutate production data unless an explicit test
  tenant and rollback/cleanup policy exists.

Evidence:
- Script syntax and dry-run where possible.
- Production/local-thread execution evidence when credentials and host state are
  available.
- Clear separation between public anonymous checks and authenticated browser
  checks.

## Slice M5-A4 - Rollback and Recovery Proof

Outcome:
- Establish the minimum recovery path before real-team longitudinal trial.

Likely ownership:
- deploy docs
- optional recovery checklist or script

Required behavior:
- Identify previous release target.
- Reload only LoopOS PM2 processes.
- Withdraw only LoopOS Nginx locations if the route must be disabled.
- Verify service restoration after rollback.
- State whether database rollback is unavailable, forward-only, or covered by a
  specific backup/restore procedure.

Evidence:
- Read-only review of deploy docs.
- If authorized, a controlled production recovery drill or dry-run evidence.
- Independent audit that no unrelated host apps are affected.

## Slice M5-A5 - M5-A Acceptance Cleanup

Outcome:
- Consolidate design, source/build, migration, production-health, browser-smoke,
  rollback, and review evidence.

Required evidence:
- `git diff --check`.
- Source/build verification from A2.
- Production or local-thread production-state evidence from A3/A4, or explicit
  blocker if unavailable.
- Independent implementation review with no P0/P1/P2.
- Independent roadmap/evidence audit with no P0/P1/P2.

## Deferred Work

- Interface Automation plugin enablement and capability gateway.
- Data -> Pretraining template migration.
- Organization-wide notification policy.
- Semantic/vector retrieval.
- Longitudinal real-team weekly rhythm evidence.
- Final V5 completion claim.
