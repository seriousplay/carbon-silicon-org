# V5-M5-B Production Validation Evidence

Date: 2026-07-16

Scope:
- Validate the current LoopOS production deployment at `https://csi-org.com/loopos`.
- Keep evidence secret-free.
- Do not claim pluginization, semantic/vector retrieval, notification delivery,
  longitudinal real-team validation, or full Organization Brain production read
  capability.

## Release Identity

- Local branch: `main`.
- Local HEAD: `2ddf3bc91cf8`.
- Release id: `20260716-135813-m5b-trial`.
- Remote current release: `/var/www/loopos/releases/20260716-135813-m5b-trial`.
- Previous remote release: `/var/www/loopos/releases/20260716-115933-m5b`.
- Package manager: `pnpm@10.28.0`.
- Release source state: current working snapshot, not a clean commit.

## Local Build

Passed:
- `pnpm db:generate`.
- `NEXT_PUBLIC_BASE_PATH=/loopos AUTH_URL=https://csi-org.com pnpm build`.
- Next.js 16.2.10 production build generated 35/35 static pages.

Notes:
- The sandboxed build failed with the known Turbopack port-binding permission
  error; the same command passed outside the sandbox.

## Deployment

Passed:
- Uploaded `/tmp/loopos-20260716-115933-m5b.tgz`.
- Server toolchain check:
  - Node `v22.22.2`.
  - Corepack available.
  - `corepack pnpm --version` returned `10.28.0`.
- Extracted the release under `/var/www/loopos/releases/20260716-115933-m5b`.
- `corepack pnpm install --frozen-lockfile` passed.
- `corepack pnpm db:generate` passed.
- Prisma migration recovery and deploy passed:
  - Created safe `loopos_brain_reader` as `NOLOGIN NOINHERIT NOSUPERUSER
    NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS CONNECTION LIMIT 0`.
  - Marked failed `20260714081530_v5_m1_b2_brain_read_boundary` attempt as
    rolled back.
  - Re-applied `20260714081530_v5_m1_b2_brain_read_boundary`.
  - Applied the remaining migrations through
    `20260715193000_v5_m4_b2_memory_candidates`.
  - Final migration count: 26 applied, 0 failed.
- Switched `/var/www/loopos/current` to the new release.
- Reloaded only `loopos-web` and `loopos-worker`.

Production readback:
- `loopos-web`: online, cwd `/var/www/loopos/current`.
- `loopos-worker`: online, cwd `/var/www/loopos/current`.
- Local server HTTP: `http://127.0.0.1:3040/loopos` returned `200`.
- `brain_read` schema exists.

## Public HTTP

Passed with:

```bash
node scripts/verify-production-http.mjs --base-url https://csi-org.com/loopos --transport curl --no-proxy --json
```

Results:
- `https://csi-org.com/loopos`: `200`, `text/html; charset=utf-8`.
- `https://csi-org.com/loopos/`: `308`, `location: /loopos`.
- `https://csi-org.com/loopos/login`: `200`, `text/html; charset=utf-8`.
- `https://csi-org.com/loopos/api/auth/session`: `200`, `application/json`.

## Authenticated HTTP Smoke

Passed with temporary production smoke tenant:
- Smoke email: `m5b-smoke-20260716124839@loopos.test`.
- CSRF endpoint: `200`.
- Credentials callback: `302`.
- Authenticated `https://csi-org.com/loopos/app`: `200`, `text/html; charset=utf-8`, not redirected to login.
- Authenticated `https://csi-org.com/loopos/app/brain`: `200`, `text/html; charset=utf-8`, not redirected to login.
- Authenticated `https://csi-org.com/loopos/api/auth/session`: `200`, `application/json`, includes the smoke user email.

Cleanup:
- Removed smoke sessions, accounts, person, membership, circle, organization,
  and user rows by unique email/slug.
- Residue check returned `users=0`, `organizations=0`, `sessions=0`.

Boundary:
- This is authenticated HTTP evidence, not full browser interaction evidence.

## Authenticated Browser Interaction Smoke

Passed through the external browser surface with temporary production smoke
tenant:
- Smoke email: `m5b-browser-20260716125451@loopos.test`.
- Start URL: `https://csi-org.com/loopos/login`.
- Browser actions filled `#email` and `#password`, submitted the login form,
  then navigated to `https://csi-org.com/loopos/app/brain`.
- Final browser metadata URL:
  `https://csi-org.com/loopos/app/brain`.
- Final status: `200`, `text/html; charset=utf-8`.
- Screenshot evidence:
  `docs/evidence/assets/2026-07-16-v5-m5b-organization-brain-production.png`.
- Screenshot SHA-256:
  `c7b3eb8405e26b39c186269f1a03e19f5367290ba871797c8e4267f53542f8fb`.
- Screenshot dimensions: `1365 x 900`.
- Extracted authenticated page text included:
  - organization name `M5B Browser Organization`;
  - four primary entries `工作台 / 目标 / 会议 / 组织`;
  - global `提出张力`, `通知`, and account `M5B Browser User`;
  - page heading `组织大脑`;
  - private brief section `私人简报`;
  - question input surface `向组织大脑提问`.

Cleanup:
- Removed browser-smoke sessions, accounts, person, membership, circle,
  organization, and user rows by unique email/slug.
- Residue check returned `users=0`, `organizations=0`, `sessions=0`.

Follow-up screenshot smoke:
- Smoke email: `m5b-smoke-202607161745-screenshot@loopos.test`.
- Browser actions registered a temporary production organization, authenticated,
  opened `https://csi-org.com/loopos/app/brain`, and saved the screenshot above.
- The screenshot was captured after the Brain workspace left `aria-busy=true`;
  the visible state shows the private-brief empty state, no conversation yet,
  and the question input.
- Console/page/server error ledger was empty.
- Cleanup removed the temporary organization and user.
- Residue check returned `users=0`, `people=0`, `organizations=0`,
  `sessions=0`, `accounts=0`.

Boundary:
- This proves authenticated browser form login and read-only navigation to the
  production Organization Brain page.
- It now includes screenshot evidence from a local Playwright run outside the
  sandboxed browser-launch boundary.

## Recovery During Deployment

Observed issue:
- The first source archive used a bare `--exclude=node_modules` pattern.
- That removed `.next/node_modules`, which Next.js 16/Turbopack needs for
  hashed server external aliases such as `pg-...` and `@prisma/client-...`.
- Symptom: `/loopos/api/auth/session` returned `500` while static pages still
  returned `200`.

Recovery:
- Uploaded and extracted `.next/node_modules` from the local production build.
- Reloaded `loopos-web`.
- Public HTTP verification passed after recovery.
- `deploy/aliyun/README.md` now records that `.next/node_modules` must be
  preserved.
- Detailed bounded recovery evidence is recorded in
  `docs/evidence/2026-07-16-v5-m5b-production-recovery-proof.md`.

## Not Yet Proven

- `BRAIN_DATABASE_URL` is not configured in production.
- The production PostgreSQL cluster contains an unrelated `biocoach` database
  with `PUBLIC CONNECT/TEMPORARY`; the B2A full dedicated
  `loopos_brain_login` provisioning contract cannot be completed without an
  operator decision about isolating that unrelated database.
- Because `BRAIN_DATABASE_URL` is absent, Organization Brain dynamic read
  capability is not claimed as production-ready.
- No rollback symlink switch was performed after the successful recovery.
- No real-team longitudinal operation evidence is claimed.

## Trial Deployment Update

Date: 2026-07-16

Purpose:
- Update production to the latest current working snapshot so a real team can
  start trial operation.
- Preserve the M5-B evidence boundary: this deploy enables trial use, but does
  not complete the real-team longitudinal gate.

Local build:
- `./node_modules/.bin/prisma generate` passed.
- `NEXT_PUBLIC_BASE_PATH=/loopos AUTH_URL=https://csi-org.com ./node_modules/.bin/next build` passed outside the sandbox after the sandboxed Turbopack run hit the known local port-binding permission error.
- Next.js 16.2.10 production build generated 35/35 static pages.

Release package:
- Archive: `/tmp/loopos-20260716-135813-m5b-trial.tgz`.
- The package excludes local `.env`, `.env.*`, top-level `node_modules`,
  `.git`, `.next/cache`, and `.next/dev`.
- The package includes `.next/node_modules` with the hashed server external
  aliases required by Next.js 16/Turbopack.

Deployment:
- Uploaded the archive to the Aliyun host.
- Extracted to `/var/www/loopos/releases/20260716-135813-m5b-trial`.
- `corepack pnpm --version` returned `10.28.0`.
- `corepack pnpm install --frozen-lockfile` passed.
- `corepack pnpm db:generate` passed.
- `node --env-file=/var/www/loopos/shared/.env node_modules/prisma/build/index.js migrate deploy` found 26 migrations and no pending migrations.
- Switched `/var/www/loopos/current` to
  `/var/www/loopos/releases/20260716-135813-m5b-trial`.
- Reloaded only `loopos-web` and `loopos-worker`.

Production readback:
- `loopos-web`: online, cwd `/var/www/loopos/current`, uptime exceeded 200
  seconds after reload.
- `loopos-worker`: online, cwd `/var/www/loopos/current`, uptime exceeded 200
  seconds after reload.
- Local server HTTP on the host returned success for
  `http://127.0.0.1:3040/loopos`.

Public HTTP:
- The local workstation could not resolve `csi-org.com` during this run, so
  the repeatable HTTP verifier was executed from the Aliyun host.
- `node scripts/verify-production-http.mjs --base-url https://csi-org.com/loopos --transport curl --no-proxy --json` passed on the host:
  - `/loopos`: `200`, `text/html; charset=utf-8`;
  - `/loopos/`: `308`, `location: /loopos`;
  - `/loopos/login`: `200`, `text/html; charset=utf-8`;
  - `/loopos/api/auth/session`: `200`, `application/json`.

Authenticated browser smoke:
- Browser used `https://csi-org.com/loopos` with a Chromium host-resolver rule
  mapping `csi-org.com` to `47.95.199.142`; the URL, certificate host, and
  base path remained production-shaped.
- Temporary smoke email:
  `m5b-smoke-20260716-1410-trial@loopos.test`.
- Temporary organization:
  `M5B Smoke 20260716-1410-trial`.
- Browser registered the temporary organization, reached `/loopos/app`, opened
  `/loopos/app/brain`, and received `/loopos/api/auth/session` with status
  `200`.
- Extracted authenticated text included the four primary entries
  `工作台 / 目标 / 会议 / 组织`, page heading `组织大脑`, private brief text,
  and the question input surface `向组织大脑提问`.
- Screenshot evidence:
  `docs/evidence/assets/2026-07-16-m5b-trial-deployment-brain.png`.
- Screenshot SHA-256:
  `04f6f31c926f7469ccbafde078ab05d044b4d6140d1bc75fb527956ad9b214b8`.
- Screenshot dimensions: `1365 x 900`.
- A follow-up login to `/loopos/app/brain` with the same smoke account produced
  zero captured 4xx/5xx responses and zero console warnings/errors.

Cleanup:
- `scripts/m5b-cleanup-production-smoke.mjs` removed the temporary smoke
  organization and user.
- Residue check returned `users=0`, `people=0`, `organizations=0`,
  `sessions=0`, and `accounts=0`.

Acceptance boundary:
- `scripts/verify-m5b-acceptance-state.mjs --json` on the current production
  release still reports `accepted=false`, `pass=15`, `blocked=2`, `missing=0`.
- `scripts/verify-production-brain-reader-readiness.mjs` still fails because
  `BRAIN_DATABASE_URL` is absent.
- The remaining blocked gates are unchanged: production Brain reader readiness
  and real-team longitudinal operating evidence.
