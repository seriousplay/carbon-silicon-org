# LoopOS Production Browser Smoke Checklist

Status: M5-A3 design artifact

This checklist defines what a production or local-production validation thread
must prove. It does not claim that production browser smoke has passed.

## Preconditions

- Validate the exact release candidate that passed local source/build/migration
  evidence.
- Use `https://csi-org.com/loopos` as the public base URL unless testing a
  local production-mode build.
- Use an authorized test account or explicitly approved real account.
- Do not record passwords, cookies, session values, request headers, or raw
  secret-bearing logs.
- Do not mutate production data unless an explicit test tenant, cleanup plan,
  and rollback owner are named before the run.

## Anonymous Public HTTP Checks

Run:

```sh
node scripts/verify-production-http.mjs --base-url https://csi-org.com/loopos --json
```

Required checks:

- `/loopos` responds without a 404 or 5xx.
- `/loopos/` normalizes to `/loopos`, or the proxy follows that redirect without
  a loop.
- `/loopos/login` responds without a 404 or 5xx.
- `/loopos/api/auth/session` responds without a 404 or 5xx.

This proves only public route reachability. It does not prove authentication,
application data, PM2 health, database migrations, or weekly team use.

## Authenticated Browser Checks

Use a real browser with console and network capture enabled. Redact secret
headers, cookies, session values, and credentials from the evidence.

Required observations:

- Open `/loopos/login`; the login page renders and does not redirect-loop.
- Log in with the authorized account; do not record the password.
- The authenticated shell loads under `/loopos/app`.
- The four primary navigation entries are visible:
  - `工作台`
  - `目标`
  - `会议`
  - `组织`
- The workspace secondary entries are reachable from `/loopos/app`:
  - `项目`
  - `行动追踪`
  - `张力`
  - `本周回顾`
- Open `/loopos/app/brain`; the Organization Brain surface renders.
- Static assets load under the `/loopos` base path without 404s.
- Console ledger has no uncaught page errors.
- Network ledger has no failed application requests, redirect loops, or 5xx
  responses.

## Mutation Boundary

Default smoke mode is read-only.

Allowed without a separate product-owner approval:

- login;
- route navigation;
- opening the Brain page without submitting a message;
- reading existing dashboard, Goal, meeting, and organization pages.

Not allowed without an explicit test tenant and cleanup plan:

- creating organizations, people, goals, meetings, tensions, projects, actions,
  memory candidates, or Brain messages;
- confirming or rejecting governance or memory decisions;
- changing roles, circle structure, settings, notifications, or plugin state.

## Evidence Shape

Record the browser result in a secret-free evidence file or validation report:

- release candidate identity;
- browser, viewport, and base URL;
- account identity redacted to role or test-account label;
- public HTTP script output;
- route-by-route result summary;
- console summary;
- network summary;
- mutation statement: `none`, or named test tenant plus cleanup result;
- screenshots only when they contain no private data or have been redacted;
- explicit non-claims for longitudinal team use and rollback.

## Failure Handling

- A 404, 5xx, redirect loop, missing primary entry, missing Brain route, failed
  static asset, unhandled console error, or failed application request blocks
  production browser acceptance.
- A production data mutation without a pre-approved cleanup plan blocks
  acceptance, even if the UI otherwise works.
- Missing credentials or host access is recorded as missing evidence, not as a
  pass or fail of the product.
