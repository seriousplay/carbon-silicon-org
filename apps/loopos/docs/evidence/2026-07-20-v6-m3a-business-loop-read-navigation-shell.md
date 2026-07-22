# V6-M3-A Business Loop Read and Navigation Shell Evidence

Date: 2026-07-20

Scope: add a read-only Business Loop entry under Organization and a parallel `组织结构 | 业务回路` navigation shell.

Acceptance evidence:

- Source gates passed after review fixes: focused source tests 7/7, TypeScript, scoped ESLint, script syntax, and scoped `git diff --check`.
- Browser gate passed with `scripts/m3a-browser-acceptance.cjs` against disposable PostgreSQL `loopos_m3a_browser_20260720_2`.
- Required browser proof passed: `/app/circles/map` exposes `组织结构 | 业务回路`, clicking `业务回路` opens `/app/organization/business-loops`, the read-only `业务回路` page shows `价值与数据流`, the seeded non-empty fixture shows 3 structures, 10 identified flows, 6 READY interfaces, 4 non-READY interfaces, exactly 8 preview rows, clicking `组织结构` returns to `/app/circles/map`, desktop/mobile horizontal overflow false, console/page/http ledgers clean.
- Cleanup proof passed: cleanupOk true; zero users/people/organizations residue; disposable database dropped; local port 3239 closed.

Browser output summary:

```json
{
  "ok": true,
  "baseUrl": "http://127.0.0.1:3239",
  "screenshotDir": "/tmp/loopos-m3a-browser-20260720-7",
  "desktopOverflow": false,
  "mobileOverflow": false,
  "ledger": { "console": [], "page": [], "http": [] },
  "cleanupOk": true,
  "residue": { "users": 0, "people": 0, "organizations": 0 }
}
```

Cleanup output:

```text
SELECT datname FROM pg_database WHERE datname LIKE 'loopos_m3a_browser_%';
 datname
---------
(0 rows)

curl -sS -m 2 http://127.0.0.1:3239/app/organization/business-loops
curl: (7) Failed to connect to 127.0.0.1 port 3239 after 0 ms: Couldn't connect to server
```

Boundaries:

- Adds no Business Loop write flow, schema, migration, governance routing, AI co-assignee behavior, candidate tension lifecycle, scheduler, delivery observability, deployment, broad notification policy, or BioCoach application/database integration.
- The M3-A read model only projects existing `Circle` and `CircleInterface` data for navigation and current-state visibility.
- First independent implementation review found one P1 and one P2: counts were derived from the 8-row preview list, and browser evidence only covered empty state. The correction uses full-table `circleInterface.count` calls for total/READY counts, keeps `take: 8` only for preview rows, and browser-proves a 10-interface mixed-status fixture.
