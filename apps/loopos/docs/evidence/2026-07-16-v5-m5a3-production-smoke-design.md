# V5-M5-A3 Production Health and Browser Smoke Design Evidence

Date: 2026-07-16
Recorder: Codex coordinator

## Scope

- Claim: production health and browser smoke contract is defined.
- Explicit non-claims: public production HTTP has not been executed in this
  slice; authenticated production browser smoke has not passed; no production
  data was created or changed; rollback and longitudinal real-team evidence are
  not claimed.

## Delivered Artifacts

- `scripts/verify-production-http.mjs`
  - Anonymous public HTTP smoke script.
  - Defaults to `https://csi-org.com/loopos`.
  - Checks `/loopos`, `/loopos/`, `/loopos/login`, and
    `/loopos/api/auth/session`.
  - Captures status, redirect location, content type, and body size only.
  - Does not accept credentials, cookies, or secret headers.
- `docs/evidence/production-browser-smoke-checklist.md`
  - Defines the authenticated browser smoke path.
  - Requires the four primary navigation entries: `工作台`, `目标`, `会议`, `组织`.
  - Requires workspace secondary entries: `项目`, `行动追踪`, `张力`, `本周回顾`.
  - Requires `/loopos/app/brain` to render.
  - Default smoke mode is read-only.
  - Blocks production data mutation unless a test tenant and cleanup plan are
    approved before the run.
- `deploy/aliyun/README.md`
  - Adds the anonymous HTTP smoke script to the verification section.
  - Points authenticated browser smoke to the checklist and keeps it separate
    from public HTTP verification.

## Coordinator Verification

| Check | Result |
| --- | --- |
| `node --check scripts/verify-production-http.mjs` | pass |
| `node scripts/verify-production-http.mjs --base-url https://csi-org.com/loopos --dry-run --json` | pass |
| checklist key-field inspection with `rg` | pass |
| `git diff --check` | pass |

Dry-run planned checks:

- `https://csi-org.com/loopos`
- `https://csi-org.com/loopos/`
- `https://csi-org.com/loopos/login`
- `https://csi-org.com/loopos/api/auth/session`

## Deferred Evidence

- Production public HTTP execution belongs to the production validation thread.
- Authenticated browser execution requires credentials or an approved local
  browser thread.
- PM2 process proof belongs to the production health execution slice.
- Rollback proof belongs to M5-A4.
- Longitudinal real-team weekly operation remains deferred beyond M5-A.
