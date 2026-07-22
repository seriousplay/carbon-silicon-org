# V6-M3-B Business Loop Persistence Skeleton Evidence

Date: 2026-07-20

Scope: add the minimal persistence skeleton for Business Loops without opening a write surface or replacing Organization Structure.

Implementation:

- Added Prisma enums for Business Loop status, version status, activity type, edge type, and evidence kind.
- Added Prisma models and SQL migration for:
  - `business_loops`
  - `business_loop_versions`
  - `business_loop_activities`
  - `business_loop_edges`
  - `business_loop_evidence_refs`
- Preserved `Circle`, `RoleDef`, and `CircleInterface` as canonical formal structure and interface models; Business Loops reference them through tenant-scoped foreign keys.
- Kept `/app/organization/business-loops` read-only. No Business Loop form, server action, command registry entry, governance routing, candidate tension lifecycle, scheduler, broad notification policy, deployment change, or BioCoach application/database integration was added.

Source evidence:

```text
node --import tsx --test src/lib/business-loops/read-model.test.ts src/lib/business-loops/persistence-contract.test.ts src/app/app/organization/business-loops/page.test.ts src/app/app/circles/map/page.test.ts
# tests 11
# pass 11
# fail 0
```

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint src/lib/business-loops/read-model.ts src/lib/business-loops/read-model.test.ts src/lib/business-loops/persistence-contract.test.ts src/app/app/organization/business-loops/page.tsx src/app/app/organization/business-loops/page.test.ts src/app/app/organization/organization-subnav.tsx src/app/app/circles/map/page.tsx src/app/app/circles/map/page.test.ts
exit 0
```

```text
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
The schema at prisma/schema.prisma is valid.
Note: Prisma still reports one pre-existing SetNull warning outside the M3-B changes.
```

Disposable PostgreSQL migration proof:

```text
createdb -h localhost -p 5432 loopos_m3b_schema_20260720_1
env DATABASE_URL=postgresql://postgres@localhost:5432/loopos_m3b_schema_20260720_1 ./node_modules/.bin/prisma migrate deploy --schema prisma/schema.prisma
44 migrations found in prisma/migrations
Applying migration `20260720220000_v6_m3b_business_loop_persistence_skeleton`
All migrations have been successfully applied.
```

Database inspection:

```text
business_loop_activities
business_loop_edges
business_loop_evidence_refs
business_loop_versions
business_loops
```

```text
BusinessLoopActivityType  {WORK,DECISION,HANDOFF,SIGNAL}
BusinessLoopEdgeType      {VALUE,DATA,DECISION_SIGNAL,EVIDENCE}
BusinessLoopEvidenceKind  {CIRCLE,ROLE,CIRCLE_INTERFACE,GOAL,METRIC,PROJECT,ACTION,TENSION,MEETING,EXTERNAL_NOTE}
BusinessLoopStatus        {DRAFT,ACTIVE,ARCHIVED}
BusinessLoopVersionStatus {DRAFT,PUBLISHED,SUPERSEDED}
```

```text
business_loop_activities     5 foreign keys
business_loop_edges          6 foreign keys
business_loop_evidence_refs  3 foreign keys
business_loop_versions       2 foreign keys
business_loops               1 foreign key
```

Cleanup proof:

```text
dropdb -h localhost -p 5432 loopos_m3b_schema_20260720_1
SELECT count(*) FROM pg_database WHERE datname='loopos_m3b_schema_20260720_1';
0
```

Boundaries:

- No Business Loop write surface is active.
- No Circle or CircleInterface replacement is made.
- No governance-impact routing or candidate tension lifecycle is active.
- No AI co-assignee execution policy is active.
- No BioCoach application or database integration is added.

Independent reviews:

- Implementation review: PASS with no P0/P1/P2 and no blockers. Reviewer confirmed additive schema/migration, tenant-scoped references, no `Circle`/`CircleInterface` replacement, read-only page boundary, and no write/governance/candidate/scheduler/deployment/BioCoach activation.
- Roadmap/evidence audit first found one P2 stale status after implementation review passed. The docs were updated to record the implementation review PASS while keeping roadmap/evidence re-audit as the remaining gate.
- Same-auditor reclosure: PASS with no findings and no blockers. Recommendation: `ACCEPT M3-B AND ACTIVATE NEXT SLICE`.
