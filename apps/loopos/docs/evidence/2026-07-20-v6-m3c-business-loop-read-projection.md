# V6-M3-C Business Loop Read Projection Evidence

Date: 2026-07-20

Scope: connect the M3-B persistence skeleton to the read-only Business Loop page and keep the M3-A fallback when no persisted Business Loops exist.

Implementation:

- `getBusinessLoopReadModel` now reads persisted `BusinessLoop`, `BusinessLoopActivity`, `BusinessLoopEdge`, and `BusinessLoopEvidenceRef` records.
- The Business Loop page renders a read-only inspectable flow when persisted loops exist, including activities, value/data edges, structure links, role links, and the existing interface entry.
- Organizations without persisted Business Loops still receive the M3-A fallback from `Circle` and `CircleInterface`.
- No Business Loop write surface, governance routing, candidate tension lifecycle, scheduler, deployment change, AI co-assignee policy, broad notification policy, or BioCoach application/database integration was added.

Source evidence:

```text
node --import tsx --test src/lib/business-loops/read-model.test.ts src/lib/business-loops/persistence-contract.test.ts src/app/app/organization/business-loops/page.test.ts src/app/app/circles/map/page.test.ts
# tests 12
# pass 12
# fail 0
```

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint src/lib/business-loops/read-model.ts src/lib/business-loops/read-model.test.ts src/lib/business-loops/persistence-contract.test.ts src/app/app/organization/business-loops/page.tsx src/app/app/organization/business-loops/page.test.ts
exit 0
```

```text
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
The schema at prisma/schema.prisma is valid.
Note: Prisma still reports one pre-existing SetNull warning outside the M3-B/M3-C changes.
```

```text
git diff --check -- prisma/schema.prisma prisma/migrations/20260720220000_v6_m3b_business_loop_persistence_skeleton/migration.sql src/generated/prisma src/lib/business-loops src/app/app/organization/business-loops scripts/m3c-browser-acceptance.cjs docs/evidence/2026-07-20-v6-m3b-business-loop-persistence-skeleton.md docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md GOALS.md progress-dashboard.html
exit 0
```

Browser evidence:

```text
env DATABASE_URL=postgresql://heyiqing@localhost:5432/loopos NODE_PATH=/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules:/Users/heyiqing/LLM/loopos/node_modules node scripts/m3c-browser-acceptance.cjs --base-url http://127.0.0.1:3001 --screenshot-dir /tmp/loopos-m3c-browser-20260720-2
```

```json
{
  "ok": true,
  "baseUrl": "http://127.0.0.1:3001",
  "screenshotDir": "/tmp/loopos-m3c-browser-20260720-2",
  "persistedStats": ["3", "2", "2", "1"],
  "fallbackStats": ["3", "1", "3", "0"],
  "persistedOverflow": false,
  "fallbackOverflow": false,
  "ledger": { "console": [], "page": [], "http": [] },
  "cleanupOk": true,
  "residue": { "users": 0, "people": 0, "organizations": 0 }
}
```

Local database migration note:

- The local development database `loopos` was advanced to the current 44 migrations so the dev server could verify M3-C against real M3-B tables.

Boundaries:

- M3-C is read-only.
- The page does not add a Business Loop editor or command path.
- The fallback path remains available for organizations with only structure/interface data.
- BioCoach data remains outside the LoopOS application/database scope.

Independent review correction:

- First implementation review found one P1: activity, edge, and evidence counts used only `organizationId`, so archived Business Loop child rows could inflate visible counts.
- Correction: child-row counts now filter through `businessLoop: { status: { not: "ARCHIVED" } }`, and the read-model test guards that relation filter.
- Re-run evidence after correction: focused source tests pass 12/12, TypeScript passes, scoped ESLint passes, and browser proof passes again with persisted stats `3,2,2,1`, fallback stats `3,1,3,0`, clean ledgers, no overflow, cleanupOk true, and zero fixture residue.
- Same-reviewer reclosure: PASS with no findings and no blockers.
- Roadmap/evidence audit first found stale implementation-review wording in
  `GOALS.md` and `progress-dashboard.html`. The stale wording was corrected so
  the remaining gate was only roadmap/evidence re-audit.
- Same-auditor roadmap/evidence reclosure: PASS with no findings and no
  blockers. Recommendation: `ACCEPT M3-C AND ACTIVATE NEXT SLICE`.
