# V5-M5C Organization Model Settings Evidence

Date: 2026-07-16

## Scope

Provide an organization-admin UI entry for manual model provider, model name,
base URL, thinking mode, and API key configuration. Saved API keys are encrypted
and never rendered back to the browser. Organization Brain planning uses the
organization-specific configuration when present, otherwise it inherits the
system environment configuration.

## Local Evidence

- `./node_modules/.bin/prisma generate` passed.
- `./node_modules/.bin/tsx --test src/app/app/setup/page.test.ts` passed 2/2.
- `./node_modules/.bin/tsx --test src/lib/ai/provider.test.ts` passed 8/8.
- `./node_modules/.bin/tsx --test src/lib/ai/organization-model-settings.test.ts` passed 2/2.
- `./node_modules/.bin/tsx --test src/lib/organization-brain/query-planner.test.ts` passed 28/28.
- `./node_modules/.bin/tsx --test src/lib/organization-brain/turn-service.test.ts` passed 78/78.
- `./node_modules/.bin/tsc --noEmit` passed.
- `git diff --check` passed.
- `NEXT_PUBLIC_BASE_PATH=/loopos AUTH_URL=https://csi-org.com ./node_modules/.bin/next build` passed after rerunning outside the sandbox; the first sandboxed run failed only because Turbopack could not bind its helper port.

## Production Evidence

- Release deployed: `/var/www/loopos/releases/20260716-2354-model-settings`.
- `/var/www/loopos/current` points to that release.
- Migration applied: `20260716164000_v5_m5c_org_model_settings`.
- `prisma migrate status` reports `Database schema is up to date!`.
- PM2 reports `loopos-web` and `loopos-worker` online after reload.
- Server-side HTTP smoke passed:
  - `200 http://127.0.0.1:3040/loopos`
  - `200 https://csi-org.com/loopos`
  - `200 https://csi-org.com/loopos/login`
  - `200 https://csi-org.com/loopos/api/auth/session`
  - `308 https://csi-org.com/loopos/`
- Authenticated production smoke created a temporary `@loopos.test` ORG_ADMIN,
  logged in through NextAuth credentials, loaded `/app/setup` with HTTP 200, and
  confirmed the page contains the organization model settings entry, API key
  non-disclosure copy, and the DeepSeek `deepseek-v4-pro` option.
- Smoke cleanup returned zero residue for organizations, users, people,
  sessions, and accounts.

## Boundaries

- The production DeepSeek API key is not recorded here.
- This slice does not claim completion of the broader M5-B dynamic Brain reader
  readiness or real-team longitudinal gates.
