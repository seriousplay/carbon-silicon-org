# V6-M4-A AI Co-Assignee Policy Foundation Evidence

Date: 2026-07-20

Scope: add the foundation for AI as a bounded Role co-assignee without activating AI execution.

Implementation:

- Added `AiCoAssigneeStatus` and `AiCapabilityRiskLevel` enums.
- Added `ai_role_co_assignment_policies` as a tenant-scoped policy table.
- A policy binds:
  - one formal Role;
  - one AI `Person`;
  - one distinct accountable human `Person`;
  - one maximum L0-L4 risk level;
  - one policy status.
- Added pure policy helpers under `src/lib/ai-coassignees/policy.ts`.
- Added an application-level save guard that requires:
  - the Role is active in the same organization;
  - the AI co-assignee `Person` has `entityType = AGENT`;
  - the accountable human `Person` has `entityType = HUMAN`.
- No execution handler, scheduler, candidate tension sensing, broad notification, deployment, or BioCoach integration was added.

Source evidence:

```text
node --import tsx --test src/lib/ai-coassignees/policy.test.ts
# tests 5
# pass 5
# fail 0
```

```text
./node_modules/.bin/tsc --noEmit
exit 0
```

```text
./node_modules/.bin/eslint src/lib/ai-coassignees/policy.ts src/lib/ai-coassignees/policy.test.ts
exit 0
```

```text
./node_modules/.bin/prisma validate --schema prisma/schema.prisma
The schema at prisma/schema.prisma is valid.
Note: Prisma still reports pre-existing warnings outside the M4-A changes.
```

Migration evidence:

```text
psql postgresql://heyiqing@localhost:5432/loopos -v ON_ERROR_STOP=1 -c BEGIN -f prisma/migrations/20260720233000_v6_m4a_ai_co_assignee_policy_foundation/migration.sql -c ROLLBACK
BEGIN
CREATE TYPE
CREATE TYPE
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ROLLBACK
```

```text
git diff --check -- prisma/schema.prisma prisma/migrations/20260720233000_v6_m4a_ai_co_assignee_policy_foundation src/lib/ai-coassignees GOALS.md progress-dashboard.html docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md
exit 0
```

Boundaries:

- The migration adds only new enum types and one new policy table.
- Existing Role, Person, Circle, governance, Brain command, notification, scheduler, and BioCoach tables are not altered.
- Entity-type enforcement is intentionally application-level because PostgreSQL
  CHECK constraints cannot safely validate referenced `people.entityType`; the
  tested save path rejects a human as AI co-assignee and rejects an agent as
  accountable human.
- `canAiExecuteWithoutHumanAccountability` always returns `false`; M4-A does not authorize autonomous AI execution.
- Candidate tension sensing and AI execution remain inactive until later accepted slices.

Independent review:

- First implementation review failed on missing entity-type enforcement for
  `aiPersonId` and `accountableHumanPersonId`.
- Correction added tested application-level persistence guards.
- Implementation re-review returned PASS with no P0/P1/P2 and no blockers.
- Roadmap/evidence re-audit returned aligned with no P0/P1/P2; its only
  conditional blocker was implementation re-review, now closed.
