# V6-M4-B AI Co-Assignee Configuration Surface Evidence

Date: 2026-07-20

Scope: add the minimum browser-visible configuration path for proposed AI Role
co-assignment policies without activating AI execution.

Implementation:

- Added an AI co-assignment policy section to the Role detail page.
- Organization administrators can inspect existing policy rows for the Role.
- Organization administrators can create or update a `PROPOSED` AI
  co-assignment policy by selecting:
  - an AI `Person`;
  - an accountable human `Person`;
  - a maximum L0-L4 risk level.
- The Server Action calls the accepted M4-A `saveAiCoAssigneePolicy` guard.
- No AI execution handler, candidate tension sensing, scheduler, deployment,
  broad notification, or BioCoach integration was added.

Source evidence:

```text
node --import tsx --test src/lib/ai-coassignees/policy.test.ts src/app/app/roles/ai-coassignee-configuration.test.ts
# tests 8
# pass 8
# fail 0
```

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint 'src/app/app/roles/[id]/actions.ts' 'src/app/app/roles/[id]/page.tsx' src/app/app/roles/ai-coassignee-configuration.test.ts src/lib/ai-coassignees/policy.ts src/lib/ai-coassignees/policy.test.ts
exit 0
```

```text
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
The schema at prisma/schema.prisma is valid.
Note: Prisma still reports pre-existing warnings outside the M4-B changes.
```

```text
npm run build
Compiled successfully. Production build generated 38 app routes.
```

Browser evidence:

```text
NODE_PATH=/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules node --env-file=.env scripts/m4b-browser-acceptance.cjs --base-url http://127.0.0.1:3001 --screenshot-dir /tmp/loopos-m4b-browser-20260720-6
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
  "screenshotDir": "/tmp/loopos-m4b-browser-20260720-6"
}
```

The browser flow proved:

- temporary admin registration;
- fixture AI `Person` and Role creation;
- Role detail page displays `AI 共同承担策略`;
- admin saves a proposed AI co-assignment policy;
- page displays the AI agent, accountable human, `L2`, and `PROPOSED`;
- no desktop horizontal overflow;
- no console/page/http errors;
- zero fixture residue after cleanup.

Boundaries:

- The page exposes configuration only; it does not execute work on behalf of AI.
- The action forces `status: "PROPOSED"`.
- The action refuses to touch an existing policy unless that policy is still
  `PROPOSED`, so an approved, suspended, or revoked policy cannot be silently
  reset by the M4-B configuration form.
- The accepted M4-A guard remains the only persistence path.
- Candidate tension sensing, scheduler, deployment, broad notifications, and
  BioCoach application/database integration remain inactive.

Independent review:

- First implementation review found one P1: the form could reset a non-proposed
  policy to `PROPOSED`.
- The correction now checks existing policy status before calling the M4-A save
  guard.
- Implementation reclosure returned PASS with no findings and no blockers.
- Roadmap/evidence audit returned PASS with no P0/P1/P2; its only remaining
  blocker was implementation review, now closed.
