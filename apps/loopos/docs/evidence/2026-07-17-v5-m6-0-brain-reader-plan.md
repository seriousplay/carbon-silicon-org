# V5-M6-0 Production Brain Reader Plan

Date: 2026-07-17

Status: executed; see
`docs/evidence/2026-07-17-v5-m6-0-brain-reader-readiness.md`

## Outcome

Provision one dedicated production Brain login that can connect only to the
LoopOS database, assume only `loopos_brain_reader`, read only the approved
`brain_read` views, and fail every mutation attempt.

## Read-only Production Inventory

Server:

- PostgreSQL `16.14`.
- LoopOS database: `loopos`.
- Application session identity: `loopos_app`.
- `BRAIN_DATABASE_URL`: absent.

Roles:

- `loopos_brain_reader` exists as `NOLOGIN NOINHERIT`, has no administrative
  attributes, connection limit `0`, and no members.
- `loopos_brain_login` does not exist.
- `loopos_app` and `biocoach` are non-superuser login roles and are the owners of
  their respective databases.

Database boundary:

| Database | Owner | Current connection identity | PUBLIC CONNECT | PUBLIC TEMPORARY |
| --- | --- | --- | --- | --- |
| `loopos` | `loopos_app` | `loopos_app` | yes | yes |
| `biocoach` | `biocoach` | `biocoach` | yes | yes |
| `postgres` | `postgres` | none observed | yes | yes |

The owner roles retain their direct and owner privileges independently of
`PUBLIC`. Revoking the default `PUBLIC` database privileges therefore does not
remove `loopos_app`, `biocoach`, or `postgres` owner access.

LoopOS object boundary:

- `brain_read` has no PUBLIC usage or create privilege.
- `loopos_brain_reader` has exactly 20 direct `SELECT` grants on approved
  `brain_read` views.
- `public` has PUBLIC usage but not create privilege.
- 27 application-owned trigger functions still have default PUBLIC execute.
- All 27 are owned by `loopos_app`, are not security-definer functions, and are
  covered by the existing `harden-reader-database.sql` contract.

Adjacent application baseline:

- PM2 `biocoach`: online.
- Local `http://127.0.0.1:3001/biocoach`: `200`.
- Public `https://daodecision.com/biocoach`: `200`.

## Selected Minimal Change

1. Record exact pre-change database ACLs and environment-file backup path in a
   root-only host evidence file.
2. Create `loopos_brain_login` with `LOGIN NOINHERIT NOSUPERUSER NOCREATEDB
   NOCREATEROLE NOREPLICATION NOBYPASSRLS` and a generated credential.
3. Revoke `CONNECT, TEMPORARY` from `PUBLIC` on `loopos`, `biocoach`, and
   `postgres`.
4. Grant `CONNECT` on `loopos` directly to `loopos_brain_login`.
5. Run `harden-reader-database.sql` on `loopos` with `loopos_app` as migration
   owner and `['loopos']` as the allowlist.
6. Run `provision-reader-role.sql` with the same allowlist and the dedicated
   login.
7. Add `BRAIN_DATABASE_URL` to `/var/www/loopos/shared/.env` without printing or
   storing the credential in repository evidence; preserve mode `600`.
8. Reload only `loopos-web` and `loopos-worker` with updated environment and
   save PM2 state.
9. Run readiness, mutation denial, LoopOS public/authenticated, PM2, BioCoach
   local/public, and cleanup checks.

Data isolation is explicit, not inferred:

- the Brain allowlist contains only `loopos`;
- the Brain login receives no membership or direct privilege from `biocoach`;
- a production connection attempt to `biocoach` with the Brain credential must
  fail before any query can run;
- the same negative connection probe applies to the maintenance `postgres`
  database;
- no BioCoach table, schema, row, credential, or migration is read or changed by
  LoopOS tooling.

This path is narrower than moving either application to another cluster and
does not change application owners, application credentials, schemas, data,
Nginx, or non-LoopOS processes.

## Abort Conditions

Abort and restore before enabling `BRAIN_DATABASE_URL` if:

- either application owner loses database connection;
- `provision-reader-role.sql` reports outside-allowlist access, contaminated
  membership, unsafe function/default ACL, or unexpected direct grants;
- readiness does not show one dedicated login and exactly one direct reader
  membership;
- mutation denial fails;
- the Brain credential can connect to `biocoach` or `postgres`;
- BioCoach or LoopOS baseline HTTP changes;
- any command would require displaying or committing the generated credential.

## Rollback

Before PM2 reload:

- remove `BRAIN_DATABASE_URL` from the shared environment;
- revoke `loopos_brain_reader` and `CONNECT` from `loopos_brain_login`;
- drop the dedicated login;
- restore the recorded database ACLs;
- keep the existing non-login reader and its view grants because application
  migrations depend on them.

After PM2 reload:

- restore the environment backup;
- reload only `loopos-web` and `loopos-worker`;
- repeat LoopOS and BioCoach health checks.

Object-level hardening removes unsafe PUBLIC privileges while preserving the
application owner. It is retained on rollback unless evidence shows an adjacent
role depended on PUBLIC access. The inventory found no such role or connection.

## Required Authorization

Production execution received explicit continuation and command approval. The
approved change removed default `PUBLIC` database privileges from the unrelated
`biocoach` and `postgres` databases while preserving their owner access. Final
readiness, cross-database denial, mutation denial, HTTP, PM2, authenticated
browser, cleanup, and recovery evidence is recorded in the readiness document.
