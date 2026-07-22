# V6-M5-A Candidate Tension Data Contract Evidence

Date: 2026-07-20

Scope: define the durable candidate tension data contract without activating
automatic sensing or formal Tension creation.

Implementation:

- Added `CandidateTensionStatus` with `DETECTED`, `CONFIRMED`, `DISMISSED`,
  `MERGED`, and `FALSE_POSITIVE`.
- Added `CandidateTensionSourceKind` for Goal, metric, project, action, Role,
  Business Loop, AI execution audit, memory, meeting, and external signal
  sources.
- Added `CandidateTension` records with source evidence, owner Role,
  detector, optional tactical/governance suggestion, terminal state fields, and
  optional link to a later confirmed formal `Tension`.
- Added `CandidateTensionAuditEvent` for append-only lifecycle evidence.
- Added a migration-level lifecycle CHECK constraint so durable rows cannot
  represent impossible candidate states.
- Added a pure contract helper proving candidates start as `DETECTED`, are not
  formal Tensions, and can only become `CONFIRMED` by linking a later formal
  Tension plus human confirmer.
- Dismissal, false-positive marking, and merge remain terminal candidate states
  and do not create formal Tensions.
- No scheduler, worker, automatic sensing loop, formal `Tension` insert,
  governance mutation, deployment change, broad notification, semantic/vector
  retrieval, or BioCoach application/database integration was added.

Source evidence:

```text
node --import tsx --test src/lib/candidate-tensions/contract.test.ts
# tests 6
# pass 6
# fail 0
```

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint src/lib/candidate-tensions/contract.ts src/lib/candidate-tensions/contract.test.ts
exit 0
```

```text
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
The schema at prisma/schema.prisma is valid.
Note: Prisma still reports pre-existing warnings outside the M5-A changes.
```

```text
git diff --check -- prisma/schema.prisma prisma/migrations/20260721013000_v6_m5a_candidate_tension_data_contract src/lib/candidate-tensions GOALS.md progress-dashboard.html docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md docs/evidence/2026-07-20-v6-m4f-ai-co-assignee-risk-policy-cleanup.md
exit 0
```

```text
git diff --check -- prisma/schema.prisma prisma/migrations/20260721013000_v6_m5a_candidate_tension_data_contract src/lib/candidate-tensions docs/evidence/2026-07-20-v6-m5a-candidate-tension-data-contract.md
exit 0
```

```text
npm run build
Compiled successfully. Production build generated 38 app routes.
```

Migration evidence:

```text
psql postgresql://heyiqing@localhost:5432/loopos -v ON_ERROR_STOP=1 -c BEGIN -f prisma/migrations/20260721013000_v6_m5a_candidate_tension_data_contract/migration.sql -c ROLLBACK
BEGIN
CREATE TYPE
CREATE TYPE
CREATE TYPE
CREATE TABLE
ALTER TABLE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ROLLBACK
```

Behavior proven by focused tests:

- candidate lifecycle and source vocabularies match schema and migration;
- schema and migration use tenant-scoped uniqueness for confirmed formal
  Tension links instead of a schema-only single-field unique constraint;
- migration enforces durable DETECTED, CONFIRMED, DISMISSED, FALSE_POSITIVE,
  and MERGED lifecycle invariants;
- candidates require source evidence, owner Role, detector, and valid
  tactical/governance suggestion;
- detected candidates are not formal Tensions;
- confirmation only links a later formal Tension and a human confirmer;
- dismissal, false-positive marking, and merge do not create formal Tensions;
- terminal candidates cannot be confirmed or changed again.

Boundaries:

- M5-A does not activate automatic signal scanning.
- M5-A does not insert formal `tensions` rows.
- M5-A does not add scheduler, worker, AI execution, governance mutation,
  deployment, broad notification, pluginization, semantic/vector retrieval, or
  BioCoach integration.

Independent review:

- Implementation review by Poincare initially failed with P1/P2 findings:
  missing durable lifecycle invariants and schema/migration uniqueness drift.
- The P1/P2 findings were addressed by adding the migration CHECK constraint,
  removing schema-only `confirmedTensionId @unique`, and extending focused
  contract tests to lock both behaviors.
- Roadmap/evidence audit by Harvey passed with no P0/P1/P2 before the Poincare
  reclosure step.
- Implementation reclosure by Poincare passed with no P0/P1/P2. The prior P1
  and P2 are closed.
