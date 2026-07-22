# V6-M2-E Setup Workspace Final Acceptance Evidence

Date: 2026-07-20

Scope: keep the administrator first-run setup path anchored in `/app/organization` instead of routing editable setup steps back to the legacy setup page.

Acceptance evidence:

- Source gates passed: TypeScript, focused organization page tests 7/7, scoped ESLint, script syntax, and scoped `git diff --check`.
- Browser gate passed with `scripts/m2d-browser-acceptance.cjs` against disposable PostgreSQL `loopos_m2e_browser_20260720_1`.
- Required browser proof passed: Organization setup headings visible, identity and system-configuration setup links remain inside `/app/organization`, no `/app/setup` links visible from the Organization setup workspace, organization name and purpose persisted, identity readiness updated, desktop/mobile horizontal overflow false, console/page/http ledgers clean.
- Cleanup proof passed: cleanupOk true; zero users/people/organizations residue; disposable database dropped; local port 3237 closed.

Browser output summary:

```json
{
  "ok": true,
  "baseUrl": "http://127.0.0.1:3237",
  "screenshotDir": "/tmp/loopos-m2e-browser-20260720-3",
  "purposeReady": true,
  "desktopOverflow": false,
  "mobileOverflow": false,
  "ledger": { "console": [], "page": [], "http": [] },
  "cleanupOk": true,
  "residue": { "users": 0, "people": 0, "organizations": 0 }
}
```

Cleanup output:

```text
SELECT datname FROM pg_database WHERE datname LIKE 'loopos_m2e_browser_%';
 datname
---------
(0 rows)

curl -sS -m 2 http://127.0.0.1:3237/app/organization
curl: (7) Failed to connect to 127.0.0.1 port 3237 after 0 ms: Couldn't connect to server
```

Boundaries:

- Keeps activation delegated to the accepted M1-D service.
- Adds no activation domain logic and no new readiness semantics.
- Does not activate Business Loops, AI co-assignees, candidate tensions, deployment, scheduler, delivery observability, broad notification policy, or any BioCoach application/database integration.
