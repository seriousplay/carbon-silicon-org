# Generation Queue Runbook

Loop Designer uses a persistent generation queue so the web request only submits a job and the worker process performs model execution.

## Apply Migration

Preferred direct database path:

```bash
GENERATION_QUEUE_DATABASE_URL='postgresql://...' node scripts/apply-generation-queue-migration.mjs
```

If direct database credentials are not available:

```bash
node scripts/print-generation-queue-migration.mjs > /tmp/loop-generation-queue.sql
```

Apply the printed SQL in Supabase SQL Editor.

## Verify Schema

```bash
node scripts/verify-generation-queue.mjs
node scripts/verify-generation-queue.mjs --write-probe
```

The write probe creates temporary enterprise, user, session, and generation job rows, verifies the one-active-job-per-session guard, then deletes the temporary rows.

## Start Worker

Local:

```bash
npm run worker:generation
```

PM2:

```bash
pm2 start ecosystem.config.cjs --only carbon-silicon-loop-designer-worker
```

Production should set `LOOP_GENERATION_WORKER_SECRET` and use the same value in the worker process environment. The web process will keep accepting user submissions even when the worker is busy; users see queue status through the session page polling.

## Runtime Checks

- `POST /loop-designer/api/sessions/:id/generate` returns `202` with a `generationJob`.
- `GET /loop-designer/api/sessions/:id` returns the latest `generationJob`.
- `POST /loop-designer/api/generation-jobs/run` processes queued jobs when called by the worker.
- A failed worker attempt marks the job `failed` and writes the user-facing error back to the session.
- A stale `running` job can be reclaimed after `LOOP_GENERATION_STALE_MS`.
