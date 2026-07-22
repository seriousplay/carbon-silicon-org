# V6-M3-D Business Loop Minimal Authoring Evidence

Date: 2026-07-20

Scope: add the smallest administrator-facing Business Loop authoring surface for operational flow drafts.

Implementation:

- Added server actions for Business Loop draft authoring under `/app/organization/business-loops`.
- ORG_ADMIN is required before any authoring write.
- Direct writes are limited to the M3-B Business Loop table family:
  - `business_loops`
  - `business_loop_versions`
  - `business_loop_activities`
  - `business_loop_edges`
  - `business_loop_evidence_refs`
- Circle, Role, and CircleInterface references are validated as existing same-organization records, but are not created or updated by this slice.
- The authoring panel allows:
  - creating a Business Loop draft;
  - adding one operational activity;
  - adding one value/data edge;
  - adding one evidence label.
- Duplicate same-name draft/activity/edge/evidence submissions update the existing draft item instead of creating duplicate rows.

Source evidence:

```text
node --import tsx --test src/app/app/organization/business-loops/actions.test.ts src/lib/business-loops/read-model.test.ts src/lib/business-loops/persistence-contract.test.ts src/app/app/organization/business-loops/page.test.ts src/app/app/circles/map/page.test.ts
# tests 15
# pass 15
# fail 0
```

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint src/app/app/organization/business-loops/actions.ts src/app/app/organization/business-loops/actions.test.ts src/app/app/organization/business-loops/business-loop-authoring-panel.tsx src/app/app/organization/business-loops/page.tsx src/app/app/organization/business-loops/page.test.ts src/lib/business-loops/read-model.ts src/lib/business-loops/read-model.test.ts
exit 0
```

```text
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
The schema at prisma/schema.prisma is valid.
Note: Prisma still reports one pre-existing SetNull warning outside the M3-D changes.
```

```text
git diff --check -- src/app/app/organization/business-loops scripts/m3d-browser-acceptance.cjs src/lib/business-loops docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md GOALS.md progress-dashboard.html
exit 0
```

Browser evidence:

```text
env DATABASE_URL=postgresql://heyiqing@localhost:5432/loopos NODE_PATH=/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules:/Users/heyiqing/LLM/loopos/node_modules node scripts/m3d-browser-acceptance.cjs --base-url http://127.0.0.1:3001 --screenshot-dir /tmp/loopos-m3d-browser-20260720-5
```

```json
{
  "ok": true,
  "baseUrl": "http://127.0.0.1:3001",
  "screenshotDir": "/tmp/loopos-m3d-browser-20260720-5",
  "stats": ["3", "1", "1", "1"],
  "counts": {
    "loops": 1,
    "versions": 1,
    "activities": 1,
    "edges": 1,
    "evidence": 1,
    "roles": 1,
    "circles": 3
  },
  "overflow": false,
  "ledger": { "console": [], "page": [], "http": [] },
  "cleanupOk": true,
  "residue": {
    "users": 0,
    "people": 0,
    "organizations": 0,
    "business_loops": 0
  }
}
```

Correction evidence:

- First browser run exposed a cleanup bug in the acceptance script. The script now deletes `organizations` by `id`, and failed-run residue was manually verified at zero for `m3d-admin-*`.
- A later browser run exposed duplicate draft/evidence submissions. The actions now update existing same-name draft/activity/edge/evidence records instead of creating duplicates.
- The final browser proof above passed after those corrections.

Boundaries:

- No Role, Domain, Accountability, Assignment, Decision-right, Circle nesting, or governance-structure change is written by the M3-D authoring surface.
- No governance-impact routing, candidate tension lifecycle, AI co-assignee execution policy, scheduler, deployment, broad notification policy, or BioCoach application/database integration was added.

Independent review:

- Implementation review: PASS with no P0/P1/P2 and no blockers. Reviewer confirmed ORG_ADMIN gating, reference validation, Business Loop table-family-only writes, duplicate same-name update paths, source gates, and browser evidence shape.
- Roadmap/evidence audit first found stale status wording in `GOALS.md` and
  `progress-dashboard.html` after implementation review passed. The wording was
  corrected so the remaining gate was only roadmap/evidence re-audit.
- Same-auditor reclosure: PASS with no findings and no blockers.
  Recommendation: `ACCEPT M3-D AND ACTIVATE NEXT SLICE`.
