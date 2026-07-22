# V6-M5-B Candidate Tension Persistence and Human Confirmation Evidence

Date: 2026-07-20

Scope: add a bounded service layer for persisted candidate tensions and
authorized human lifecycle transitions.

Implementation:

- Added `src/lib/candidate-tensions/service.ts`.
- `createCandidateTension` persists `DETECTED` candidates only after validating
  the owner Role and detector are tenant-scoped.
- `confirmCandidateTensionWithHuman` requires the candidate to be `DETECTED`,
  requires the actor to be a HUMAN assignee of the candidate owner Role, and
  only links an existing same-organization formal `Tension`.
- `closeCandidateTensionWithHuman` records dismissal and false-positive
  terminal outcomes through the owner Role's human assignee.
- `mergeCandidateTensionWithHuman` merges only detected same-organization
  candidates through the owner Role's human assignee.
- Every lifecycle transition writes a `CandidateTensionAuditEvent`.
- No automatic sensing loop, scheduler, worker, browser UI, AI-created formal
  `Tension`, governance mutation, deployment change, broad notification,
  semantic/vector retrieval, or BioCoach application/database integration was
  added.

Source evidence:

```text
node --import tsx --test src/lib/candidate-tensions/contract.test.ts src/lib/candidate-tensions/service.test.ts
# tests 11
# pass 11
# fail 0
```

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint src/lib/candidate-tensions/contract.ts src/lib/candidate-tensions/contract.test.ts src/lib/candidate-tensions/service.ts src/lib/candidate-tensions/service.test.ts
exit 0
```

```text
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
The schema at prisma/schema.prisma is valid.
Note: Prisma still reports pre-existing warnings outside the M5-B changes.
```

```text
git diff --check -- src/lib/candidate-tensions GOALS.md progress-dashboard.html docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md docs/evidence/2026-07-20-v6-m5a-candidate-tension-data-contract.md
exit 0
```

```text
npm run build
Compiled successfully. Production build generated 38 app routes.
```

Behavior proven by focused tests:

- persisted detection writes exactly one detection audit event;
- detection does not create or link a formal `Tension`;
- confirmation is refused for non-assignee humans;
- confirmation is refused for cross-organization formal `Tension` links;
- confirmation succeeds for the owner Role's human assignee and records audit
  evidence;
- dismissal and false-positive outcomes are terminal and audited;
- merge requires detected same-organization candidates and keeps no formal
  `Tension` link;
- terminal candidates cannot later be confirmed.

Boundaries:

- M5-B is a service-layer slice only.
- Automatic signal scanning remains inactive.
- Browser UI and Organization Brain command surfaces remain unchanged.
- Formal `Tension` creation by AI remains unavailable.
- BioCoach cross-application/database access remains outside scope.

Independent review:

- Implementation review by Mendel passed with no P0/P1/P2.
- Roadmap/evidence audit by Planck passed with no P0/P1/P2.
