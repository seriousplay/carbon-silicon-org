# V6-M6-E Production Trial Release and Isolation Proof

Date: 2026-07-21
Recorder: Codex

## Conclusion

M6-E is active and not accepted. The current snapshot has been deployed to
Aliyun through a local-build/remote-run release, public web health is restored
on the corrected release, BioCoach isolation has passed, and authenticated
production smoke now passes with the provided smoke account. Independent review
plus real-team longitudinal evidence are still outstanding.

## Scope

- Public URL: `https://csi-org.com/loopos`
- Base path: `/loopos`
- Production listener: `127.0.0.1:3040`
- PM2 processes: `loopos-web`, `loopos-worker`
- Deployment model: local build, remote run
- Mandatory isolation gate: LoopOS application credentials and Brain reader
  must remain denied from BioCoach data.

## Release Identity

- Branch: `main`
- HEAD commit: `13fa647fa652f515db653ac227a71cc2c16c0254`
- Dirty worktree at build time: yes
- Release candidate name: `20260721-m6e-trial-fixed`
- Previous release target before switching: `20260718-light-theme`
- Current production release after correction:
  `/var/www/loopos/releases/20260721-m6e-trial-fixed`

## Local Build Evidence

- Node version: `v22.23.1`
- npm version: `10.9.8`
- pnpm version: `10.28.0`
- Build command:
  `NEXT_PUBLIC_BASE_PATH=/loopos AUTH_URL=https://csi-org.com npm run build`
- Build result: pass
- Next.js version: `16.2.10`
- Static pages generated: `38/38`
- Route contract check: `.next/routes-manifest.json` contains `/loopos/` ->
  `/loopos` redirect with status `308`.
- Build artifact sizes:
  - `.next`: `1.7G`
  - `.next/standalone`: `58M`
  - `.next/static`: `2.3M`
  - `.next/node_modules`: `0B`

## Local Artifact Evidence

- Source release archive:
  `/tmp/loopos-m6e-source-20260721.tgz`
- Initial build/runtime archive:
  `/tmp/loopos-m6e-release-20260721.tgz`
- Corrected build/runtime archive:
  `/tmp/loopos-m6e-release-20260721-fixed.tgz`
- Source archive size: `4.2M`
- Initial build/runtime archive size: `15M`
- Corrected build/runtime archive size: `16M`
- Source archive includes:
  - `package.json`
  - `pnpm-lock.yaml`
  - `prisma/migrations/*/migration.sql`
  - `worker/index.ts`
  - `deploy/aliyun/ecosystem.config.cjs`
  - `src/app/app/organization/page.tsx`
- Source archive excludes `.env`, `.env.local`, `.git`, `node_modules`, and
  `.next`.
- Initial build/runtime archive included `app/server.js`, `app/.next/static`,
  and `app/.next/routes-manifest.json`.
- Corrected build/runtime archive preserves the PM2-expected layout:
  `.next/standalone/server.js` and `.next/standalone/.next/static`.
- Build/runtime archive excludes local `.env`.
- Build/runtime archive route contract check passed for `/loopos/` -> `/loopos`
  status `308`.
- Corrected archive SHA256:
  `afea1bffb6236e013bc1cd18393518ebdcaca0bd31d5f51ee0210c3c3bf09c78`.
- Worker runtime supplement SHA256:
  `b5fba34d5b1fdee4196e34d4b0c46a8406d1572450327a1f8cda5b342a066e8d`.

## Remote Deployment Runbook

- Prepared runbook:
  `docs/evidence/2026-07-21-v6-m6e-remote-deploy-runbook.md`
- Status: executed with one rollback and one corrected redeploy.
- The runbook defines remote preflight, upload, release install, migration, PM2
  reload, public HTTP verification, optional authenticated smoke, BioCoach
  isolation verification, and rollback.
- The runbook explicitly forbids server-side `next build`.

## Local Recovery and HTTP Plan Evidence

- `node --check scripts/verify-production-recovery-plan.mjs`: pass
- `node scripts/verify-production-recovery-plan.mjs`: pass
  - PM2 process scope is limited to `loopos-web` and `loopos-worker`.
  - PM2 release cwd uses the current LoopOS release path.
  - HTTPS Nginx fragment contains exactly the two LoopOS locations and
    upstreams.
  - HTTP Nginx fragment contains only LoopOS redirect exceptions.
  - README rollback boundary distinguishes application rollback, database
    boundary, and scoped Nginx withdrawal.
  - Recovery checklist requires PM2 and public HTTP restoration checks.
- `node scripts/verify-production-http.mjs --base-url https://csi-org.com/loopos
  --dry-run --json`: pass
  - Planned checks cover base path, trailing slash normalization, login route,
    and auth session endpoint.

## Current Required Evidence

- Package release artifact from the locally built standalone output: done after
  correction.
- Read current remote release target before switching `/var/www/loopos/current`:
  done.
- Upload release to Aliyun without building on the server: done.
- Run production migrations with the existing reader-role prerequisite intact:
  done. The first deploy applied six pending migrations; the corrected release
  then returned `No pending migrations to apply`.
- Reload only `loopos-web` and `loopos-worker`: done.
- Verify public HTTP/readiness for `https://csi-org.com/loopos`: done from the
  production host.
- Run authenticated production smoke for the deployed release: done with the
  provided smoke account.
- Re-prove LoopOS/BioCoach isolation with exact denial evidence: done.
- Record rollback/recovery target and validation.
- Run independent implementation/security review and roadmap/evidence audit
  before accepting M6-E.

## Remote Deployment Evidence

- Preflight current release:
  `/var/www/loopos/releases/20260718-light-theme`.
- Preflight PM2: `loopos-web` and `loopos-worker` were online.
- Preflight disk: `/` had 36G available, 53% used.
- Preflight load: `0.08, 0.02, 0.01`.
- Uploaded source archive SHA256 matched local:
  `25aa77f3d2c494175b47885863db1d04f7ca1fc0441ed9edf64d2704ab876b99`.
- Uploaded initial runtime archive SHA256 matched local:
  `4f030e92c1efd6a3d802edc697e56dffcb0ffcb7fd14afee76ace9db32b2c54e`.
- Initial release directory: `/var/www/loopos/releases/20260721-m6e-trial`.
- Remote `pnpm install --frozen-lockfile --prod=false`: pass.
- Remote `pnpm db:generate`: pass.
- Remote `prisma migrate deploy`: pass; six migrations applied:
  - `20260720120000_v6_m1a_setup_lifecycle`
  - `20260720183000_v6_m1c2_invitation_delivery`
  - `20260720220000_v6_m3b_business_loop_persistence_skeleton`
  - `20260720233000_v6_m4a_ai_co_assignee_policy_foundation`
  - `20260721003000_v6_m4e_ai_execution_audit_ledger`
  - `20260721013000_v6_m5a_candidate_tension_data_contract`
- Initial PM2 switch failed: `loopos-web` entered `errored`, local port `3040`
  was closed, and logs showed `MODULE_NOT_FOUND`. Root cause: the runtime
  archive extracted standalone contents into the release root while PM2 expects
  `.next/standalone/server.js`.
- Recovery action: symlink was restored to
  `/var/www/loopos/releases/20260718-light-theme`; `loopos-web` returned local
  HTTP `200`.
- Corrected release directory:
  `/var/www/loopos/releases/20260721-m6e-trial-fixed`.
- Corrected release migration gate: pass, `No pending migrations to apply`.
- Corrected PM2 switch: pass after preserving `.next/standalone/server.js`.
- Worker correction: the worker runtime supplement added
  `src/generated/prisma`, `src/lib/statemachine.ts`, and
  `src/lib/notifications`; `loopos-worker` then started, scanned 22
  organizations, and stayed online through the stability check.

## Production Health Evidence

- Current release:
  `/var/www/loopos/releases/20260721-m6e-trial-fixed`.
- PM2 stability check:
  - `loopos-web`: online for at least 5 minutes, 0% CPU, about 140MB memory.
  - `loopos-worker`: online for at least 3 minutes, 0% CPU, about 67MB memory.
- Server-side HTTP checks:
  - `http://127.0.0.1:3040/loopos`: `200`
  - `https://csi-org.com/loopos`: `200`
  - `https://csi-org.com/loopos/login`: `200`
  - `https://csi-org.com/loopos/api/auth/session`: `200`
- Local workstation HTTP script could not be used as final public evidence in
  this pass because local DNS temporarily returned `Could not resolve host:
  csi-org.com`; server-side HTTPS checks were used instead.

## BioCoach Isolation Evidence

Command:
`node --env-file=/var/www/loopos/shared/.env scripts/verify-production-brain-reader-isolation.mjs --json`

Result: pass.

- Brain reader connected only to LoopOS as `loopos_brain_login`.
- Application credential connected only to LoopOS as `loopos_app`.
- Brain reader to `biocoach`: denied, SQLSTATE `42501`.
- Brain reader to `postgres`: denied, SQLSTATE `42501`.
- Application credential to `biocoach`: denied, SQLSTATE `42501`.
- Application credential to `postgres`: denied, SQLSTATE `42501`.

## Authenticated Smoke Evidence

Command:
`M5B_SMOKE_EMAIL=<provided> M5B_SMOKE_PASSWORD=<provided> node --env-file=/var/www/loopos/shared/.env scripts/m5b-production-auth-http-smoke.mjs --base-url https://csi-org.com/loopos --timeout-ms 15000`

Result: pass.

- CSRF endpoint: `200`.
- Credentials callback: `302`.
- Authenticated `/app`: `200`, not redirected to login.
- Authenticated `/app/brain`: `200`, not redirected to login.
- Authenticated `/api/auth/session`: `200`, session contained the smoke user.

## Non-Claims

- M6-E is not accepted.
- V6-M6 is not accepted.
- Production web deployment refresh is claimed only for the corrected release.
- A rollback execution is claimed for restoring web health after the initial
  bad package; full recovery proof still needs independent review.
- BioCoach isolation proof is claimed for the corrected release.
- Authenticated production smoke is claimed for the provided smoke account.
- No real-team longitudinal completion is claimed.

## Blockers

No product-decision blocker.

Open gates:

- Run independent implementation/security review on the corrected production
  package process and worker runtime supplement.
- Run independent roadmap/evidence audit against this file and current
  production state.
- Collect real-team longitudinal evidence before claiming V6-M6 completion.
