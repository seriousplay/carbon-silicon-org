# V6-M3-E Business Loop Publishing Evidence

Date: 2026-07-20

Scope: add explicit administrator confirmation to publish a Business Loop draft as the current inspectable operating version.

Implementation:

- Added `publishBusinessLoopDraftAction` under `/app/organization/business-loops`.
- ORG_ADMIN is required before publishing.
- Publishing is limited to the M3-B Business Loop table family:
  - `business_loops`
  - `business_loop_versions`
- A draft can only publish after it has at least one activity and one value/data edge.
- Publishing marks older published versions for the same Business Loop as `SUPERSEDED`, marks the selected draft version as `PUBLISHED`, stores `publishedAt`, and sets the loop to `ACTIVE`.
- The Business Loop read model now renders only `ACTIVE` Business Loops as formal persisted operating descriptions, reads the latest published version timestamp, and the page renders `草稿` versus `已发布` where applicable.
- Publishing does not create or update Role, Domain, Accountability, Assignment, Decision-right, Circle nesting, or governance structure records.

Source evidence:

```text
node --import tsx --test src/app/app/organization/business-loops/actions.test.ts src/lib/business-loops/read-model.test.ts src/lib/business-loops/persistence-contract.test.ts src/app/app/organization/business-loops/page.test.ts src/app/app/circles/map/page.test.ts
# tests 16
# pass 16
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
Note: Prisma still reports one pre-existing SetNull warning outside the M3-E changes.
```

Browser evidence:

```text
env DATABASE_URL=postgresql://heyiqing@localhost:5432/loopos NODE_PATH=/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules:/Users/heyiqing/LLM/loopos/node_modules node scripts/m3e-browser-acceptance.cjs --base-url http://127.0.0.1:3001 --screenshot-dir /tmp/loopos-m3e-browser-20260720-3
```

```json
{
  "ok": true,
  "baseUrl": "http://127.0.0.1:3001",
  "screenshotDir": "/tmp/loopos-m3e-browser-20260720-3",
  "stats": ["3", "1", "1", "1"],
  "counts": {
    "active_loops": 1,
    "published_versions": 1,
    "draft_versions": 0,
    "activities": 1,
    "edges": 1,
    "evidence": 1,
    "roles": 1,
    "circles": 3
  },
  "duplicatePublishAttempt": ["fulfilled", "fulfilled"],
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

- The first M3-E browser script waited for a transient success message that can unmount when the draft becomes an active published loop. The script now verifies the stable user result: the published Business Loop appears with `已发布`, then database counts prove one active loop, one published version, and zero draft versions.
- Implementation review found two P1 issues: draft loops were included in the general read projection, and duplicate publish/idempotency behavior was not proven. The correction limits the persisted read projection to `ACTIVE` loops and treats an already active loop with a published version as an idempotent publish success. Browser evidence now performs a repeated publish click attempt and proves final counts remain one active loop, one published version, and zero draft versions.

Boundaries:

- No Role, Domain, Accountability, Assignment, Decision-right, Circle nesting, or governance-structure change is written by publishing.
- No governance-impact routing, candidate tension lifecycle, AI co-assignee execution policy, scheduler, deployment, broad notification policy, or BioCoach application/database integration was added.

Independent review:

- Implementation reclosure: PASS with no findings and no blockers. Reviewer confirmed ACTIVE-only read projection, ORG_ADMIN and same-tenant publishing, idempotent already-published replay, publish preconditions, Business Loop table-family-only writes, focused source assertions, browser duplicate-publish evidence, and no BioCoach or governance-structure writes.
- Roadmap/evidence re-audit: PASS with no findings and no blockers. Auditor confirmed current state, latest evidence path, historical V5 wording, inactive deferred scopes, V6-M4 pending, and no premature acceptance before re-audit.

Acceptance:

- Accept V6-M3-E and proceed to final V6-M3 milestone audit before V6-M4 activation.
