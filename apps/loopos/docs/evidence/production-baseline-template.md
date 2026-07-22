# LoopOS Production Baseline Evidence Template

Date:
Recorder:
Release candidate name:

## Scope

- Public URL: `https://csi-org.com/loopos`
- Release path: `/var/www/loopos/current`
- Shared environment file path: `/var/www/loopos/shared/.env`
- Web listener: `127.0.0.1:3040`
- PM2 processes: `loopos-web`, `loopos-worker`
- Package manager: `pnpm@10.28.0`
- Base path: `/loopos`
- Site origin: `https://csi-org.com`

## Redaction Policy

Do not paste secrets or raw secret-bearing output into this evidence file.

Forbidden values:
- production database URLs;
- passwords, tokens, cookies, session values, API keys, and OAuth secrets;
- raw PM2 environment dumps;
- raw logs containing credentials or request headers;
- full `.env` contents.

Allowed values:
- command names and exit status;
- redacted host, project, and database identifiers;
- commit hashes and tree hashes;
- migration names and counts;
- HTTP status codes and redirect locations without cookies;
- PM2 process names and online/stopped status;
- browser route, console, and network summaries with secret headers omitted.

## Release Identity

- Git commit:
- Git tree:
- Branch:
- Dirty worktree at build time: yes/no
- Source archive or release directory identifier:
- Previous release target for rollback:

## Local Build Evidence

- Node version:
- pnpm version:
- Install command:
- Prisma generate command:
- Build command:
- Build environment:
  - `NEXT_PUBLIC_BASE_PATH=/loopos`
  - `AUTH_URL=https://csi-org.com`
- Build result:
- `.next/routes-manifest.json` contains `/loopos/` -> `/loopos` redirect: yes/no

## Migration Evidence

- Database target identifier, redacted:
- `loopos_brain_reader` provisioned with safe attributes before migrate deploy: yes/no
- Reader-role prerequisite evidence:
- Migration command:
- Migration status before deploy:
- Migration status after deploy:
- Failed migration behavior verified or reason deferred:
- Data rollback status:
  - unavailable
  - forward-only remediation
  - covered by named backup/restore procedure

## Process Evidence

- PM2 reload command:
- `loopos-web` status:
- `loopos-worker` status:
- PM2 dump saved: yes/no
- PM2 environment output captured: no

## Public HTTP Evidence

- `https://csi-org.com/loopos` status:
- `https://csi-org.com/loopos/` status and redirect behavior:
- Static asset base-path check:
- Application endpoint check:

## Browser Smoke Evidence

- Browser and viewport:
- Login route under `/loopos/login`:
- Authenticated app shell:
- Four primary entries visible:
- Organization Brain route under `/loopos/app/brain`:
- Console summary:
- Network summary:
- Production data mutation performed: yes/no
- Test tenant or cleanup policy if mutated:

## Rollback and Recovery Evidence

- Previous release target:
- Application rollback command:
- PM2 restart scope:
- Nginx withdrawal scope if needed:
- Service restoration check:
- Database rollback or remediation status:

## Evidence Class Summary

| Evidence class | Result | Notes |
| --- | --- | --- |
| Source/build | pending | |
| Migration | pending | |
| Process | pending | |
| Public HTTP | pending | |
| Browser smoke | pending | |
| Rollback | pending | |
| Longitudinal real-team use | deferred | Not claimed by M5-A. |

## Open Gaps

- TBD
