# V6-M2-D Readiness Guide Evidence

Date: 2026-07-20

Scope: `/app/organization` adds a prioritized `下一步准备度` guide for SETUP organizations.

Acceptance evidence:

- Source gates passed: TypeScript, focused organization page tests 6/6, scoped ESLint, script syntax, and scoped `git diff --check`.
- Browser gate passed with `scripts/m2d-browser-acceptance.cjs` against disposable PostgreSQL `loopos_m2d_browser_20260720_1`.
- Required browser proof passed: `下一步准备度` visible on desktop/mobile, missing readiness action and gap count visible, organization name and purpose persisted, identity readiness updated, desktop/mobile horizontal overflow false, console/page/http ledgers clean.
- Cleanup proof passed: cleanupOk true; zero users/people/organizations residue; disposable database dropped.
- Reader safety proof passed after cleanup: `loopos_brain_reader` remained no-login/no-privilege.

Browser output summary:

```json
{
  "ok": true,
  "baseUrl": "http://127.0.0.1:3236",
  "screenshotDir": "/tmp/loopos-m2d-browser-20260720-fix",
  "purposeReady": true,
  "desktopOverflow": false,
  "mobileOverflow": false,
  "ledger": { "console": [], "page": [], "http": [] },
  "cleanupOk": true,
  "residue": { "users": 0, "people": 0, "organizations": 0 }
}
```

Boundaries:

- Uses the accepted setup read model only.
- Adds no activation domain logic and no new readiness semantics.
- Does not activate Business Loops, AI co-assignees, candidate tensions, deployment, scheduler, delivery observability, broad notification policy, or any BioCoach application/database integration. Existing Organization Brain planner protection continues to reject BioCoach cross-application queries as an isolation guard.
