# V5-M6-0 Production Brain Reader Readiness

Date: 2026-07-17

Status: production technical evidence, independent security review, and final
roadmap acceptance audit passed; M5-B accepted and M6-1 active

## Scope

- Complete the final technical M5-B gate for a dedicated production
  Organization Brain reader.
- Keep the unrelated BioCoach application and data outside the Brain boundary.
- Preserve separate application and Brain credentials.
- Prove view-only access, canonical-table mutation denial, authenticated browser
  use, public health, and smoke cleanup.

Real-team longitudinal evidence is not claimed here. By product-owner decision,
that evidence is deferred to V5-M6-6.

## Final Production State

Database server:

- PostgreSQL `16.14`.
- Application database and user: `loopos` / `loopos_app`.
- Brain login: `loopos_brain_login`.
- Brain read role: `loopos_brain_reader`.
- `BRAIN_DATABASE_URL`: configured.
- Application and Brain credentials: different.
- Shared environment file: mode `600`, owner `root:root`.
- Active release: `/var/www/loopos/releases/20260717-1410-m6reader-isolation`.

Brain role boundary:

- `loopos_brain_login`: `LOGIN NOINHERIT`, connection limit `10`, no superuser,
  createdb, createrole, replication, or bypass-RLS attribute.
- `loopos_brain_reader`: `NOLOGIN NOINHERIT`, connection limit `0`, no
  administrative attribute.
- `loopos_brain_login` has exactly one direct membership:
  `loopos_brain_reader`, without admin option.
- The login receives direct `CONNECT` only on `loopos`.
- The reader retains exactly the approved `brain_read` view grants.

Database separation:

| Database | Owner | PUBLIC CONNECT | PUBLIC TEMPORARY | Brain result |
| --- | --- | --- | --- | --- |
| `loopos` | `loopos_app` | no | no | direct connection allowed |
| `biocoach` | `biocoach` | no | no | connection denied `42501` |
| `postgres` | `postgres` | no | no | connection denied `42501` |

BioCoach data was not migrated, queried, or modified. Its process continues to
connect as its own database owner. No BioCoach schema, table, row, credential,
migration, Nginx rule, or PM2 configuration was touched.

## Readiness Verifier

`scripts/verify-production-brain-reader-readiness.mjs --json` returned:

- `ok=true`
- `ready=true`
- Brain URL present
- credential separated from the application URL
- dedicated login identity and exact reader membership
- `SET LOCAL ROLE loopos_brain_reader` success in a read-only transaction
- `brain_read.current_actor` success under bounded fake actor context

After independent security review found incomplete drift coverage, the verifier
was hardened and rerun. The final result additionally proves:

- both login and reader roles have the required safe attributes;
- exactly `20/20` approved security-barrier views are readable;
- reader schema usage is limited to `brain_read`;
- unsafe schema, relation, sequence, function, direct ACL, PUBLIC function, and
  function-default counts are all `0`;
- a nonexistent forged actor context returns no actor or organization row.

Verifier SHA-256:

- `ee6edb24884b737741eb88764b637d4fd383fe2dee2f2a78b51e95d94dcf80a0`

The output redacted both database passwords.

## Cross-database Isolation

The hardened `scripts/verify-production-brain-reader-isolation.mjs --json`
returned `ok=true` for both LoopOS production credentials:

- `brain-loopos-connection-allowed`: pass as `loopos_brain_login`
- `application-loopos-connection-allowed`: pass as `loopos_app`
- `brain-biocoach-connection-denied`: pass, SQLSTATE `42501`
- `application-biocoach-connection-denied`: pass, SQLSTATE `42501`
- `brain-postgres-connection-denied`: pass, SQLSTATE `42501`
- `application-postgres-connection-denied`: pass, SQLSTATE `42501`

The verifier only accepts PostgreSQL permission denial `42501`; DNS, network,
authentication, timeout, or other connection failures cannot produce a pass.

Verifier SHA-256:

- `481e5a40d7607836e27aac69e4b3d82892be215e6b42b3b7ac76071a002dc3aa`

Source inspection found no BioCoach application or data integration in
`src/`, `prisma/`, `worker/`, or `next.config.ts`. BioCoach appears only in the
production isolation verifier and evidence boundary.

## Mutation Denial

`scripts/verify-production-brain-reader-mutation-denial.mjs --json` returned
`ok=true`:

- reader role active
- no `public` schema usage
- no direct canonical organization-table read
- no insert, update, or delete privilege
- no effective database, schema, relation, sequence, function, or default-ACL
  write surface
- no-row `UPDATE public.organizations` denied and rolled back
- denial SQLSTATE `42501`

The final verifier does not use a read-only transaction as a substitute for an
ACL denial. It performs a safe `WHERE false` update in a rollback transaction
and accepts only PostgreSQL permission denial `42501`.

Verifier SHA-256:

- `cf3f9397dc698b4d3ebc6d5253bc424fa047e30e873a505c5d529c2a12f1cf79`

Before production use, the verifier was reproduced against a real local
PostgreSQL 14 fixture with no public schema usage. The passing fixture produced
the same five checks and `42501`, then removed both temporary roles and the
temporary database. Residue was `roles=0`, `databases=0`.

## Authenticated Browser Read

Browser test:

- URL: `https://csi-org.com/loopos/app/brain`
- Temporary email: `m5b-smoke-20260717-1355-reader@loopos.test`
- Temporary organization: `M5B Smoke 20260717-1355-reader`
- Question: `当前组织名称是什么？请只根据组织事实回答。`

Result:

- `ok=true`
- a new `确认事实` section appeared
- a new `来源` section appeared
- the exact organization name appeared as a returned fact
- server responses with status `>=500`: `0`
- browser console/page errors: `0`

The prior diagnostic attempt used an obsolete locator label (`事实` instead of
the current `确认事实`). Database readback showed that request had already
succeeded with `M1_C_USER_QUERY`, `resultCount=1`, one organization identity
fact, and one source. The locator was corrected before the passing browser run.

Cleanup after the passing run returned:

- `users=0`
- `people=0`
- `organizations=0`
- `sessions=0`
- `accounts=0`

## Cross-tenant Browser Read

`scripts/m6-0-production-brain-reader-tenant-isolation.cjs` created two real
temporary LoopOS organizations in separate browser contexts:

- `M5B Smoke 20260717-142000-a`
- `M5B Smoke 20260717-142000-b`

Each actor asked the same organization-name question. Both returned their own
exact organization name, and each page contained zero occurrences of the other
organization name before and after the Brain answer. Both contexts recorded:

- HTTP `4xx`: `0`
- HTTP `5xx`: `0`
- browser console/page errors: `0`

The first diagnostic run exposed a real base-path defect on the landing page:
Next Link received an already-prefixed Goal URL and prefetched
`/loopos/loopos/app/goals` with `404`. The workspace Goal read model now returns
root-relative internal URLs and lets Next apply `/loopos` exactly once. Focused
tests pass `13/13`, scoped ESLint passes, and the production build passes
`35/35` pages before release deployment.

Both final temporary organizations were removed. Each cleanup independently
returned `users=0`, `people=0`, `organizations=0`, `sessions=0`, and
`accounts=0`. The two earlier diagnostic organizations were also cleaned with
the same zero-residue result.

Verifier SHA-256:

- `7c8b10111b1bb03f94414ec5fd95410dbb2c1570dd2bac12a955cc113d1c0370`

## HTTP and Process Health

Production public verifier passed:

- `/loopos`: `200`
- `/loopos/`: `308`, location `/loopos`
- `/loopos/login`: `200`
- `/loopos/api/auth/session`: `200`

Post-change adjacent health:

- `http://127.0.0.1:3001/biocoach`: `200`
- `https://daodecision.com/biocoach`: `200`
- PM2 `biocoach`: online
- PM2 `loopos-web`: online
- PM2 `loopos-worker`: online

The final public readback after release activation returned LoopOS `200` and
BioCoach `200`.

## Recovery Evidence

The production procedure was fail-closed and automatically restored the
environment, login role, database ACLs, object-level PUBLIC grants, LoopOS PM2
processes, and adjacent HTTP health on every failed attempt.

Observed and corrected pre-acceptance failures:

1. Role provisioning ran as `loopos_app`; PostgreSQL correctly rejected role
   attribute changes. Rollback restored the initial state. Provisioning was
   moved to the PostgreSQL administrator while object hardening remained under
   `loopos_app`.
2. New verifier files were absent from the immutable current release. Rollback
   restored the initial state. Exact files were uploaded to `/tmp` with local and
   remote SHA-256 equality.
3. `/tmp` ESM files could not resolve the release-local `pg` dependency.
   Rollback restored the initial state. Verifiers now bind explicitly to the
   LoopOS package root, and remote dependency preflight passes before mutation.
4. The mutation verifier used a textual canonical-table name after revoking
   public schema usage. PostgreSQL correctly denied schema resolution. Rollback
   restored the initial state. A real local PostgreSQL test reproduced the
   error; the verifier now uses catalog OIDs and passed locally before reuse.
5. The public base-path check ran before PM2 reload readiness and observed one
   transient `502`. Other routes were already `200`; rollback still restored the
   initial state. Local and public base-path readiness waits now precede all
   final verification.
6. Independent security review found that readiness inspected only login-role
   attributes, mutation denial accepted any exception, the view probe did not
   test a denied actor, and readiness lacked a script hash. The verifier now
   checks both roles and the complete effective ACL surface, mutation requires
   `42501`, a forged actor returns zero rows, and all three database verifier
   hashes are recorded.
7. The first dual-tenant browser run proved own/other organization isolation but
   found a double-base-path Goal prefetch `404`. Internal workspace Goal URLs
   were corrected, locally rebuilt, deployed in release
   `20260717-1410-m6reader-isolation`, and the final dual-tenant run passed with
   no HTTP or browser errors.

After each rollback, readback showed `BRAIN_DATABASE_URL` absent,
`loopos_brain_login` count `0`, and LoopOS/BioCoach local/public HTTP `200`.

The successful run retained root-only recovery files:

- environment backup:
  `/var/www/loopos/shared/.env.pre-m6-0-20260717T051801Z`
- database ACL rollback:
  `/var/www/loopos/shared/m6-0-reader-rollback-20260717T051801Z.sql`

No credential appears in repository evidence or command output.

## Acceptance Boundary

This evidence proves the M6-0B production technical gate. It does not by itself
close M5-B or activate M6-1.

Still required:

- independent security review of the reader boundary and verifier changes;
- acceptance-state verifier update for the product-owner deferral decision;
- independent GOALS/current-state audit approving M5-B closure and M6-1
  activation.
