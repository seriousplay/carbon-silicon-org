# V5-M5-A Production Baseline Design

Date: 2026-07-16

Status: design checkpoint

## Purpose

V5-M5-A turns the current local/source/browser/PostgreSQL evidence into a
production-readiness baseline for LoopOS at `https://csi-org.com/loopos`.

This slice does not add new product capability. It defines and proves the
minimum production contract that later M5 slices need before pluginization,
notification policy, semantic retrieval, or real-team longitudinal evidence can
be trusted.

## Why This Comes First

V5-M4 accepted the Organization Brain's proactive perception and confirmed
memory path with local source, disposable PostgreSQL, and browser evidence.
That is not enough to claim industry-grade readiness. The V5 completion boundary
also requires production deployment and recovery proof, plus a designated real
team running the weekly rhythm without implementation-team intervention.

If pluginization or real-team trials begin before production baseline evidence,
failures will be ambiguous: they could come from product flow, deployment drift,
database migration state, missing secrets, broken base path handling, weak
rollback, or insufficient observability.

## Existing Production Contract

The current deployment contract is already partially documented under
`deploy/aliyun/`:

- Public URL: `https://csi-org.com/loopos`
- Release path: `/var/www/loopos/current`
- Shared environment file: `/var/www/loopos/shared/.env`
- Web listener: `127.0.0.1:3040`
- PM2 processes: `loopos-web` and `loopos-worker`
- Build-time base path: `NEXT_PUBLIC_BASE_PATH=/loopos`
- Site origin: `AUTH_URL=https://csi-org.com`
- Nginx path proxy keeps `/loopos` in the upstream request
- Next.js owns the `/loopos/` to `/loopos` redirect

M5-A should preserve this contract unless production evidence proves it is
wrong.

## Non-Goals

M5-A does not:

- Activate Interface Automation as a plugin.
- Move Data -> Pretraining into a plugin template.
- Add semantic or vector retrieval.
- Add organization-wide memory feeds.
- Add proactive notification delivery.
- Claim real-team longitudinal completion.
- Add AI autonomous writes or direct memory edits.
- Replace the canonical tactical, governance, Goal, or Brain flows accepted in
  M1-M4.

## Design Principles

1. **Build locally, run remotely.** The shared production host should not run a
   heavy Next.js build. Build artifacts are produced locally with the production
   base path and uploaded with the matching source release.
2. **Migrate before serving.** A release is not eligible to start until Prisma
   migrations have been applied against the intended production database.
3. **Evidence classes stay separate.** Source/build, migration, production
   health, browser smoke, rollback, backup/recovery, and longitudinal evidence
   must not be collapsed into one success claim.
4. **Rollback is a first-class path.** Every release should have an identified
   previous release, a rollback command, and verification after rollback.
5. **Path-based hosting is part of the product.** `/loopos`, `/loopos/`,
   NextAuth URLs, cookies, static assets, and deep links must be verified under
   the production path, not only at root.
6. **No hidden M5 activation.** Production baseline work must not silently
   activate plugins, notifications, semantic retrieval, deployment-side AI
   behavior, or longitudinal success claims.

## Required Production Baseline

### Release Identity

Each production candidate needs a durable release record:

- Git commit or exact tree identity.
- Build command and environment used for the local artifact.
- Prisma migration status before and after deployment.
- PM2 process versions after reload.
- Nginx validation result.
- Public URL verification results.

The release record may start as a structured file under `docs/evidence/` or as
script output captured in the roadmap. It must avoid secrets.

### Health and Readiness

M5-A should define two levels of health:

- **Process health:** PM2 reports `loopos-web` and `loopos-worker` online.
- **Application readiness:** the public `/loopos` route and at least one
  application endpoint respond through Nginx under the configured base path.

If an explicit health endpoint is added later, it must be read-only, disclose no
secrets, and report only stable operational facts such as version, base path,
database reachability, and worker readiness.

### Migration Safety

M5-A must prove:

- The migration stack validates locally.
- Production deploy uses `migrate deploy`, not `db push`.
- Failed migrations stop the release before PM2 reload.
- Rollback guidance distinguishes application rollback from irreversible data
  rollback.

Migration rollback scripts already exist for selected migrations, but M5-A
should not pretend every migration is reversible. Once real production data
exists, remediation is normally forward-only unless an explicit retention plan
exists.

### Browser Smoke

The minimum production browser smoke should prove:

- `https://csi-org.com/loopos` loads without redirect loops.
- `https://csi-org.com/loopos/` normalizes correctly.
- Login route is reachable under `/loopos/login`.
- Authenticated application shell loads with the four primary entries.
- Organization Brain page opens under `/loopos/app/brain`.
- No obvious static asset base-path failure appears in the browser console.

This smoke does not prove longitudinal team adoption.

### Backup and Recovery

M5-A should define recovery evidence before real-team trials:

- Which database backup is considered restorable.
- How to identify the latest safe application release.
- How to restart only LoopOS PM2 processes.
- How to withdraw only LoopOS Nginx locations without disturbing other sites.
- How to verify service restoration after rollback.

If production database credentials or host access are unavailable in the current
thread, M5-A must record the missing evidence instead of claiming success.

## Evidence Matrix

| Evidence class | M5-A proof | Explicit non-claim |
| --- | --- | --- |
| Source/build | TypeScript, lint, Prisma validate, source tests, production build | Does not prove public host readiness |
| Migration | `migrate deploy` path and status | Does not prove every migration is reversible |
| Process | PM2 web and worker online | Does not prove product workflow success |
| Public HTTP | `/loopos` and `/loopos/` through Nginx | Does not prove authenticated workflows |
| Browser smoke | Login/app/Brain shell under base path | Does not prove weekly real-team use |
| Rollback | Previous release and PM2/Nginx restoration steps | Does not prove data rollback safety |
| Longitudinal | Deferred to later M5 slice | Not claimed in M5-A |

## Risks

- The shared Aliyun host may contain other applications; Nginx and PM2 changes
  must be scoped to LoopOS only.
- Secrets may leak through PM2 dump or environment inspection; evidence must
  redact or avoid secret values.
- Existing local build scripts use `npm`, while deployment README mentions
  `pnpm`; M5-A implementation should choose the repository's actual package
  manager or update documentation consistently.
- Production database state can drift from local assumptions; verification must
  inspect real migration status before claiming readiness.
- Base-path regressions may pass local root-path tests but fail under
  `/loopos`.

## Planning Checkpoint Acceptance Criteria

The M5-A planning checkpoint can be accepted when:

1. The production baseline contract is documented and reflected in `GOALS.md`
   and `progress-dashboard.html`.
2. A concrete implementation plan exists for release identity, migration,
   public health, browser smoke, rollback, and evidence capture.
3. No M5 plugin, notification, semantic retrieval, or longitudinal claim is
   activated.
4. Independent review finds no P0/P1/P2 in the production baseline design and
   implementation plan.

## Next Slices

After the M5-A planning checkpoint:

- **M5-A1 through M5-A5 - Production Baseline Implementation:** add or refine scripts,
  read-only health/status endpoints if needed, release evidence capture, and
  production smoke verification.
- **M5-B - Interface Automation Plugin Boundary:** move designer/runtime/Data ->
  Pretraining behind explicit enablement, capability discovery, degraded states,
  and audit.
- **M5-C - Longitudinal Real-Team Trial:** run the accepted weekly rhythm with a
  designated team and measure friction, correction rate, unanswered questions,
  and notification noise.
