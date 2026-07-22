# V6-M5-D Candidate Tension Human Review Actions Evidence

Date: 2026-07-21

Scope: let authorized humans act on visible candidate tensions without
activating automatic sensing or AI-created formal Tensions.

Implementation:

- Added candidate tension Server Actions in `src/app/app/tensions/actions.ts`.
- `confirmCandidateTensionAction` links a candidate to an existing formal
  same-organization `Tension` through the accepted M5-B service.
- `closeCandidateTensionAction` dismisses or marks a candidate as false-positive
  through the accepted M5-B service.
- `mergeCandidateTensionAction` merges one detected same-organization candidate
  into another through the accepted M5-B service.
- `/app/tensions` now renders review forms for detected candidates when the
  current user is a HUMAN assignee of the candidate owner Role.
- Users without owner-role assignment see a read-only notice; the service layer
  still enforces authorization.
- Formal Tension raising and list behavior remain unchanged.

Source evidence:

```text
node --import tsx --test src/lib/candidate-tensions/contract.test.ts src/lib/candidate-tensions/service.test.ts src/app/app/tensions/candidate-review-ui.test.ts
# tests 14
# pass 14
# fail 0
```

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint src/app/app/tensions/page.tsx src/app/app/tensions/actions.ts src/app/app/tensions/candidate-review-ui.test.ts src/lib/candidate-tensions/service.ts src/lib/candidate-tensions/service.test.ts
exit 0
```

```text
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
The schema at prisma/schema.prisma is valid.
Note: Prisma still reports pre-existing warnings outside the M5-D changes.
```

```text
git diff --check -- src/app/app/tensions/page.tsx src/app/app/tensions/actions.ts src/app/app/tensions/candidate-review-ui.test.ts src/lib/candidate-tensions GOALS.md progress-dashboard.html docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md
exit 0
```

```text
npm run build
Compiled successfully. Production build generated 38 app routes.
```

Fix evidence after first implementation review:

```text
node --import tsx --test src/lib/candidate-tensions/contract.test.ts src/lib/candidate-tensions/service.test.ts src/app/app/tensions/candidate-review-ui.test.ts
# tests 14
# pass 14
# fail 0
```

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint src/app/app/tensions/page.tsx src/app/app/tensions/actions.ts src/app/app/tensions/candidate-review-ui.test.ts src/lib/candidate-tensions/service.ts src/lib/candidate-tensions/service.test.ts
exit 0
```

```text
npm run build
Compiled successfully. Production build generated 38 app routes.
```

Behavior proven by focused tests:

- detected candidate cards render confirm, dismiss/false-positive, and merge
  action surfaces;
- candidate review actions call the accepted M5-B service functions;
- page actions do not directly update candidate rows or write audit events;
- formal Tension creation keeps optional submitted `type` compatibility while
  preserving the simplified UI without a visible type picker;
- service tests still prove owner-role human-assignee authorization,
  same-organization formal Tension link checks, terminal-state protection, and
  audit event creation.

Boundaries:

- M5-D does not add automatic signal scanning.
- M5-D does not let AI create formal `Tension` records.
- M5-D does not add scheduler, worker, deployment, broad notifications,
  semantic/vector retrieval, or BioCoach integration.

Independent review:

- Pending implementation review.
- Pending roadmap/evidence audit.
- Implementation review by Hooke initially failed with P1: `createTensionAction`
  hard-coded formal Tension type and could ignore legacy submitted type. The
  action now reads optional `type`, validates it against the current formal
  Tension enum, and defaults to `PROBLEMATIC` when absent.
- Implementation reclosure by Hooke passed with no findings.
- Roadmap/evidence audit by Fermat passed with no P0/P1/P2.
