# V5-M5-A2 Local Release Candidate Evidence

Date: 2026-07-16
Recorder: Codex coordinator
Release candidate name: local working snapshot for M5-A2

## Scope

- Claim: local release candidate verification only.
- Explicit non-claims: no production deployment, no production browser smoke, no rollback drill, no plugin activation, no notification delivery, no semantic retrieval, and no longitudinal real-team evidence.
- Public production contract under test: `https://csi-org.com/loopos`
- Base path under test: `/loopos`
- Package manager: `pnpm@10.28.0`

## Source and Build Evidence

| Check | Result | Evidence |
| --- | --- | --- |
| `pnpm db:generate` | pass | Prisma Client 7.8.0 generated in `src/generated/prisma`; existing `driverAdapters` deprecation warning only. |
| `pnpm exec prisma validate` | pass | `prisma/schema.prisma` valid; existing `driverAdapters` deprecation warning only. |
| `node scripts/run-source-tests.mjs` | pass | Source test files discovered 98, executed 98, tests 865. |
| `pnpm exec tsc --noEmit` | pass | Exit code 0. |
| scoped `pnpm exec eslint ...` for M5-A docs/JSON/HTML | non-applicable | Exit code 0 with ignored-file warnings because this ESLint config has no matching rules for Markdown, JSON, or HTML. |
| `git diff --check` | pass | Exit code 0. |

## Production Base-Path Build Evidence

Command:

```sh
NEXT_PUBLIC_BASE_PATH=/loopos AUTH_URL=https://csi-org.com pnpm build
```

Result:

- First sandboxed attempt failed with Turbopack `Operation not permitted` while binding to a port. This was an environment permission failure, not an application compile failure.
- The same command passed outside the sandbox.
- Next.js version: 16.2.10.
- Build output: compiled successfully, TypeScript completed, 35/35 static pages generated.
- Existing warning: `middleware` file convention is deprecated in favor of `proxy`.

Routes manifest check:

- `.next/routes-manifest.json` contains a 308 redirect from `/loopos/` to `/loopos`.
- This matches the Aliyun Nginx contract where Nginx preserves `/loopos` and Next.js owns the trailing-slash redirect.

## Migration Evidence

Disposable database:

- Database name: `loopos_m5a2_verify_20260716_01`
- Secret-bearing database URL: not recorded.
- Local PostgreSQL connectivity: `select 1 as ok` passed.

Initial migration attempt:

- `prisma migrate deploy` failed at `20260714081530_v5_m1_b2_brain_read_boundary`.
- Reason: `loopos_brain_reader must be provisioned before applying the B2a migration`.
- Outcome: M5-A2 exposed a real deployment-contract gap in `deploy/aliyun/README.md`; the README now records the B2A reader-role prerequisite before `migrate deploy`.

Verified migration path:

- Provisioned `loopos_brain_reader` with safe attributes for the disposable migration test:
  - `NOLOGIN`
  - `NOINHERIT`
  - `NOSUPERUSER`
  - `NOCREATEDB`
  - `NOCREATEROLE`
  - `NOREPLICATION`
  - `NOBYPASSRLS`
- Recreated the disposable database.
- `DATABASE_URL=<redacted disposable URL> pnpm exec prisma migrate deploy --schema prisma/schema.prisma` passed.
- Migration count: 26 applied migrations.
- `brain_read` schema existed after migration.

Cleanup:

- Disposable database `loopos_m5a2_verify_20260716_01` was dropped.
- `loopos_brain_reader` was dropped after database cleanup.
- Final checks returned zero matching disposable database rows and zero matching role rows.

## Evidence Class Summary

| Evidence class | Result | Notes |
| --- | --- | --- |
| Source/build | pass | Prisma generate/validate, source tests, TypeScript, diff check, and production `/loopos` build passed. |
| Migration | pass | Full 26-migration stack applied to a disposable database after documented reader-role prerequisite. |
| Process | deferred | PM2 process proof belongs to production health slice. |
| Public HTTP | deferred | Public Nginx checks belong to production health slice. |
| Browser smoke | deferred | Authenticated browser proof belongs to production/browser smoke slice. |
| Rollback | deferred | Rollback proof belongs to M5-A4. |
| Longitudinal real-team use | deferred | Not claimed by M5-A. |

## Open Gaps

- Production host migration status is not claimed.
- Production PM2/Nginx health is not claimed.
- Production browser smoke is not claimed.
- Rollback and recovery drill is not claimed.
