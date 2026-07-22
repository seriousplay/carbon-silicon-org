# Loop OS v1 Migration Runbook

This runbook is the operational path for making Loop OS v1 visible to the running Loop Designer API.

## Current Gate

Loop OS v1 is not considered deployed until the full release gate passes:

```bash
node scripts/verify-loop-os-v1-release.mjs --status-url https://<host>/loop-designer/api/loop-os/status
```

For local code readiness without remote database or Matrix credentials, run:

```bash
node scripts/verify-loop-os-v1-release.mjs --local-only
```

The database-specific gates can also be run directly:

```bash
node scripts/verify-loop-os-v1.mjs
node scripts/verify-loop-os-v1.mjs --write-probe
```

The first command verifies that the API can read the required Loop OS v1 tables and columns. The second command creates temporary rows, verifies the database uniqueness guards, and cleans the probe rows.

## Deploy Committed HEAD

If the local worktree contains unrelated changes, deploy the committed Loop OS v1 code path instead of rsyncing the working directory:

```bash
./scripts/deploy-loop-os-v1-head.sh
```

By default, this builds a clean `git archive HEAD` copy locally and uploads the prebuilt standalone bundle. This avoids running a full Next.js build on the production host. If a remote build is explicitly needed, run:

```bash
LOOP_OS_HEAD_BUILD_MODE=remote ./scripts/deploy-loop-os-v1-head.sh
```

The script packages only committed `HEAD` content for:

- `apps/loop-designer`
- `packages/types`

It builds in a remote staging directory, then replaces the running app only after the staged build succeeds. It preserves the existing remote `.env.local` / `.env.production` files and verifies:

- `http://127.0.0.1:3010/loop-designer/`
- `http://127.0.0.1:3010/loop-designer/api/loop-os/status`
- `https://csi-org.com/loop-designer/`
- `https://csi-org.com/loop-designer/api/loop-os/status`

The status endpoint may return HTTP 503 before the database migration is applied. HTTP 503 means the deployed code path is present but the Loop OS v1 schema is not yet visible to the API. HTTP 404 means the committed code path has not reached the running app.

## Apply With Database URL

If a direct Postgres URL is available, run:

```bash
LOOP_OS_DATABASE_URL='postgresql://...' node scripts/apply-loop-os-v1-migration.mjs
```

Supported connection variables:

- `LOOP_OS_DATABASE_URL`
- `DATABASE_URL`
- `SUPABASE_DB_URL`

## Apply With Linked Supabase Pooler

If the local project is linked to Supabase and `supabase/.temp/pooler-url` exists, provide only the database password:

```bash
PGPASSWORD='database-password' node scripts/apply-loop-os-v1-migration.mjs
```

or:

```bash
SUPABASE_DB_PASSWORD='database-password' node scripts/apply-loop-os-v1-migration.mjs
```

The script reads the linked pooler URL and runs the full migration bundle with `psql -v ON_ERROR_STOP=1`.

## Apply In Supabase SQL Editor

If no direct database credentials are available, print the ordered SQL bundle:

```bash
node scripts/print-loop-os-v1-migration.mjs
```

Copy the full output into Supabase SQL Editor and execute it once. The bundle ends with:

```sql
select pg_notify('pgrst', 'reload schema');
```

This reloads the PostgREST schema cache so API routes can see the new `loop_os_*` tables.

For the current production project, execute the SQL in Supabase project `zfuojnosurshknvcnkgi` (`matrix-origin`). This is the project referenced by the production Loop Designer `NEXT_PUBLIC_SUPABASE_URL`. If a file handoff is easier than copying terminal output, generate it with:

```bash
node scripts/print-loop-os-v1-migration.mjs > /tmp/loop-os-v1-migration.sql
```

Then paste the full file contents into the SQL Editor and run it once. After it succeeds, verify in this order:

```bash
node scripts/verify-loop-os-v1.mjs
node scripts/verify-loop-os-v1.mjs --write-probe
curl -sS https://csi-org.com/loop-designer/api/loop-os/status
node scripts/verify-loop-os-v1-release.mjs --status-url https://csi-org.com/loop-designer/api/loop-os/status
```

The status endpoint must return HTTP 200 with `status: "ok"` before the rollout is complete.

## Expected Tables

The runtime schema verifier checks:

- `loop_os_assets`
- `loop_os_versions`
- `loop_os_relationships`
- `loop_os_org_profiles`

The migration chain also adds the key uniqueness guards for:

- source session version idempotency
- active Matrix circuit binding
- parent-child relationships
- dependency relationships

## API Status Check

After deployment, check:

```bash
curl -sS https://<host>/loop-designer/api/loop-os/status
```

Healthy response: HTTP 200 with `status: "ok"`.

Unhealthy response: HTTP 503 with table-level failures and remediation text.

## Completion Criteria

Loop OS v1 database rollout is complete only when all are true:

- `node scripts/verify-loop-os-v1-release.mjs --status-url https://<host>/loop-designer/api/loop-os/status` passes.
- `node scripts/verify-loop-os-v1.mjs` passes.
- `node scripts/verify-loop-os-v1.mjs --write-probe` passes.
- `GET /loop-designer/api/loop-os/status` returns HTTP 200.
- Matrix Origin verification still passes:

```bash
cd ../matrix-origin
npm run verify:matrix-loop
```
