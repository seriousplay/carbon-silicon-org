# V6-M4-C AI Co-Assignee Approval Lifecycle Evidence

Date: 2026-07-20

Scope: add explicit approval, suspension, and revocation lifecycle for AI
co-assignment policies without enabling AI execution.

Implementation:

- Added ORG_ADMIN-only lifecycle Server Actions:
  - approve `PROPOSED` policy to `APPROVED`;
  - suspend `APPROVED` policy to `SUSPENDED`;
  - revoke `PROPOSED`, `APPROVED`, or `SUSPENDED` policy to `REVOKED`.
- Lifecycle actions are tenant and Role scoped through `organizationId`,
  `roleId`, and `policyId`.
- Approval records `approvedAt`.
- Suspension records `suspendedAt` and optional bounded reason.
- Revocation records `revokedAt` and optional bounded reason.
- Role detail page shows lifecycle timestamps/reasons and renders only valid
  next-step controls for the current policy status.
- No AI execution handler, execution ledger, candidate tension sensing,
  scheduler, deployment, broad notification, governance mutation, or BioCoach
  integration was added.

Source evidence:

```text
node --import tsx --test src/lib/ai-coassignees/policy.test.ts src/app/app/roles/ai-coassignee-configuration.test.ts
# tests 9
# pass 9
# fail 0
```

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint 'src/app/app/roles/[id]/actions.ts' 'src/app/app/roles/[id]/page.tsx' src/app/app/roles/ai-coassignee-configuration.test.ts
exit 0
```

```text
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
The schema at prisma/schema.prisma is valid.
Note: Prisma still reports pre-existing warnings outside the M4-C changes.
```

```text
npm run build
Compiled successfully. Production build generated 38 app routes.
```

Browser evidence:

```text
NODE_PATH=/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node --env-file=.env scripts/m4b-browser-acceptance.cjs --base-url http://127.0.0.1:3001 --screenshot-dir /tmp/loopos-m4c-browser-20260720-1
{
  "ok": true,
  "overflow": false,
  "ledger": {
    "console": [],
    "page": [],
    "http": []
  },
  "residue": {
    "users": 0,
    "people": 0,
    "organizations": 0,
    "policies": 0
  },
  "screenshotDir": "/tmp/loopos-m4c-browser-20260720-1"
}
```

The browser flow proved:

- temporary admin registration;
- fixture AI `Person` and Role creation;
- admin saves a proposed AI co-assignment policy;
- admin approves the policy and sees `APPROVED`;
- admin suspends the policy and sees `SUSPENDED`;
- admin revokes the policy and sees `REVOKED` plus the revocation reason;
- no desktop horizontal overflow;
- no console/page/http errors;
- zero fixture residue after cleanup.

Boundaries:

- M4-C does not authorize any AI execution.
- M4-C does not create an execution ledger or scheduler.
- Candidate tension sensing, deployment, broad notifications, and BioCoach
  application/database integration remain inactive.

Independent review:

- Implementation review returned PASS with no P0/P1/P2 and no blockers.
- First roadmap/evidence audit found stale dashboard M4-B current-slice wording;
  the dashboard was corrected.
- Roadmap/evidence reclosure found implementation PASS was not yet recorded in
  audited state files; this evidence, plan, and dashboard update records it.
- Roadmap/evidence reclosure returned PASS with no P0/P1/P2 and no blockers.
