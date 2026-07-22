# V6-M5-C Candidate Tension Inbox Evidence

Date: 2026-07-20

Scope: add the first visible candidate tension inbox/review surface without
activating automatic sensing.

Implementation:

- Regenerated Prisma client after the accepted candidate tension schema.
- Updated `/app/tensions` to show an `AI 候选张力` section above formal
  Tensions.
- The inbox lists candidate title, evidence summary, status, suggested
  tactical/governance path, owner Role, source kind, detector, detected date,
  concrete source reference summary, and linked confirmed formal Tension when
  one exists.
- Empty state explains that AI-detected signals remain candidates until the
  related Role confirms them.
- Formal Tension list and `提一个张力` flow remain unchanged.

Source evidence:

```text
./node_modules/.bin/prisma generate --schema prisma/schema.prisma
Generated Prisma Client (7.8.0) to ./src/generated/prisma
```

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint src/app/app/tensions/page.tsx src/lib/candidate-tensions/service.ts src/lib/candidate-tensions/service.test.ts
exit 0
```

```text
git diff --check -- src/app/app/tensions/page.tsx src/lib/candidate-tensions GOALS.md progress-dashboard.html docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md docs/evidence/2026-07-20-v6-m5b-candidate-tension-persistence-human-confirmation.md src/generated/prisma
exit 0
```

```text
npm run build
Compiled successfully. Production build generated 38 app routes.
```

Fix evidence after first review:

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint src/app/app/tensions/page.tsx
exit 0
```

```text
git diff --check -- src/app/app/tensions/page.tsx GOALS.md progress-dashboard.html docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md docs/evidence/2026-07-20-v6-m5c-candidate-tension-inbox.md
exit 0
```

```text
npm run build
Compiled successfully. Production build generated 38 app routes.
```

Boundaries:

- M5-C does not add automatic signal scanning.
- M5-C does not create formal `Tension` records from AI.
- M5-C does not add confirmation/dismissal buttons yet; it exposes the review
  inbox read surface and relies on the accepted M5-B service for later actions.
- M5-C does not add scheduler, worker, deployment, broad notifications,
  semantic/vector retrieval, or BioCoach integration.

Independent review:

- Implementation review by Galileo initially failed with P1: the inbox showed
  source category but not concrete `sourceRef`. The page now displays a
  readable `sourceRef` summary for human review.
- Roadmap/evidence audit by Raman initially failed with P2: `GOALS.md` still
  said to keep candidate tensions inactive. The wording now defers only
  automatic candidate sensing and other inactive scopes.
- Implementation reclosure by Galileo passed with no findings.
- Roadmap/evidence reclosure by Raman passed with no findings.
