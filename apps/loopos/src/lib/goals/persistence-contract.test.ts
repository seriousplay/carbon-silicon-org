import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../../prisma/migrations/20260715120000_v5_m2_b1_goal_persistence/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const rollback = readFileSync(
  new URL(
    "../../../prisma/migrations/20260715120000_v5_m2_b1_goal_persistence/rollback.sql",
    import.meta.url,
  ),
  "utf8",
);

const goalEnums = {
  GoalCycleStatus: ["PLANNED", "ACTIVE", "CLOSED", "CANCELLED"],
  GoalProposalKind: ["CREATE", "REPLACE", "CLOSE"],
  GoalProposalStatus: ["DRAFT", "SUBMITTED", "ADOPTED", "RETURNED", "DECLINED", "WITHDRAWN"],
  GoalCloseResult: ["ACHIEVED", "NOT_ACHIEVED"],
  GoalDecisionOutcome: ["ADOPTED", "RETURNED", "DECLINED"],
  GoalStatus: ["ACTIVE", "SUPERSEDED", "ACHIEVED", "NOT_ACHIEVED"],
  GoalTargetKind: ["NUMERIC", "MILESTONE"],
  GoalCheckInAssessment: ["ON_TRACK", "AT_RISK", "OFF_TRACK", "ACHIEVED"],
  GoalWorkLinkKind: ["PROJECT", "ACTION", "BLOCKING_TENSION"],
  GoalWorkLinkStatus: ["ACTIVE", "REMOVED"],
} as const;

const goalModels = [
  "GoalCycle",
  "GoalProposal",
  "GoalProposalRevision",
  "GoalProposalTarget",
  "GoalDecision",
  "Goal",
  "GoalTarget",
  "GoalCheckIn",
  "GoalWorkLink",
] as const;

const goalTables = [
  "goal_cycles",
  "goal_proposals",
  "goal_proposal_revisions",
  "goal_proposal_targets",
  "goal_decisions",
  "goals",
  "goal_targets",
  "goal_check_ins",
  "goal_work_links",
] as const;

function captures(source: string, pattern: RegExp): string[] {
  return Array.from(source.matchAll(pattern), (match) => match[1]);
}

function schemaBlock(kind: "enum" | "model", name: string): string {
  return schema.match(new RegExp(`^${kind} ${name} \\{[\\s\\S]*?^\\}`, "m"))?.[0] ?? "";
}

function schemaEnumValues(name: string): string[] {
  return schemaBlock("enum", name)
    .split("\n")
    .slice(1, -1)
    .map((line) => line.replace(/\/\/.*$/, "").trim())
    .filter(Boolean)
    .map((line) => line.split(/\s+/)[0]);
}

function sqlTable(name: string): string {
  return migration.match(new RegExp(`^CREATE TABLE "${name}" \\([\\s\\S]*?^\\);`, "m"))?.[0] ?? "";
}

function sqlFunction(name: string): string {
  return migration.match(
    new RegExp(`CREATE FUNCTION ${name}\\(\\)[\\s\\S]*?\\$function\\$;`),
  )?.[0] ?? "";
}

function sqlEnumValues(name: string): string[] {
  const definition = migration.match(new RegExp(`CREATE TYPE "${name}" AS ENUM \\(([^;]+)\\);`));
  return definition ? captures(definition[1], /'([^']+)'/g) : [];
}

function compact(source: string): string {
  return source.replace(/\s+/g, " ").trim();
}

function assertTargetShape(table: string): void {
  const source = compact(sqlTable(table));
  assert.match(
    source,
    /"kind" = 'NUMERIC'.*"baselineValue" IS NOT NULL.*"desiredValue" IS NOT NULL.*"baselineValue" <> "desiredValue".*"unit" IS NOT NULL.*btrim\("unit"\) <> ''.*"acceptanceCriteria" IS NULL/,
  );
  assert.match(
    source,
    /"kind" = 'MILESTONE'.*"baselineValue" IS NULL.*"desiredValue" IS NULL.*"unit" IS NULL.*"metricId" IS NULL.*"acceptanceCriteria" IS NOT NULL.*btrim\("acceptanceCriteria"\) <> ''/,
  );
}

describe("V5-M2-B1 Goal persistence contract", () => {
  test("defines exactly the accepted Goal enums and states", () => {
    assert.deepEqual(captures(schema, /^enum (Goal\w+) \{/gm), Object.keys(goalEnums));
    for (const [name, values] of Object.entries(goalEnums)) {
      assert.deepEqual(schemaEnumValues(name), values);
    }
  });

  test("defines exactly nine tenant-owned Goal models with restrictive relations", () => {
    assert.deepEqual(captures(schema, /^model (Goal\w*) \{/gm), goalModels);

    const relationCounts: Record<(typeof goalModels)[number], number> = {
      GoalCycle: 1,
      GoalProposal: 6,
      GoalProposalRevision: 5,
      GoalProposalTarget: 3,
      GoalDecision: 5,
      Goal: 7,
      GoalTarget: 4,
      GoalCheckIn: 6,
      GoalWorkLink: 8,
    };

    for (const model of goalModels) {
      const relations = schemaBlock("model", model)
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.includes("@relation") && line.includes("fields:"));
      assert.equal(relations.length, relationCounts[model]);
      for (const relation of relations) {
        assert.match(relation, /fields: \[[^\]]*organizationId/);
        assert.match(relation, /onDelete: Restrict/);
        if (!relation.startsWith("organization ")) {
          assert.match(relation, /references: \[[^\]]*organizationId/);
        }
      }
    }

    assert.match(schemaBlock("model", "GoalProposalRevision"), /@@id\(\[organizationId, proposalId, revision\]\)/);
    assert.match(schemaBlock("model", "GoalProposal"), /@@unique\(\[organizationId, id, currentRevision\]\)/);
    assert.match(schemaBlock("model", "Goal"), /@@unique\(\[id, organizationId, cycleId, circleId\]\)/);
    assert.match(schemaBlock("model", "GoalTarget"), /@@unique\(\[id, organizationId, goalId\]\)/);
    assert.match(schemaBlock("model", "GoalCheckIn"), /@@unique\(\[id, organizationId, goalId, targetId\]\)/);
  });

  test("uses tenant-composite Circle parents and Metric identities", () => {
    const circle = schemaBlock("model", "Circle");
    assert.match(
      circle,
      /parent\s+Circle\?\s+@relation\("CircleHierarchy", fields: \[parentId, organizationId\], references: \[id, organizationId\], onDelete: NoAction\)/,
    );
    assert.match(circle, /@@unique\(\[id, organizationId\]\)/);
    assert.match(schemaBlock("model", "Metric"), /@@unique\(\[id, organizationId\]\)/);
  });

  test("creates exactly ten Goal enums and nine additive Goal tables", () => {
    assert.deepEqual(captures(migration, /^CREATE TYPE "([^"]+)"/gm), Object.keys(goalEnums));
    assert.deepEqual(captures(migration, /^CREATE TABLE "([^"]+)"/gm), goalTables);
    assert.doesNotMatch(migration, /^(?:INSERT\s+INTO|UPDATE\s+"|DELETE\s+FROM|COPY\s+)/im);
    assert.doesNotMatch(migration, /\bRENAME\s+(?:TO|COLUMN)\b/i);
    assert.doesNotMatch(
      migration,
      /CREATE\s+(?:MATERIALIZED\s+)?VIEW|CREATE\s+(?:ROLE|POLICY)|ROW LEVEL SECURITY|\b(?:GRANT|REVOKE)\b|brain_read|\/app\//i,
    );

    const alteredExistingTables = [
      ...new Set(captures(migration, /^ALTER TABLE "([^"]+)"/gm)),
    ].filter((table) => !goalTables.includes(table as (typeof goalTables)[number]));
    assert.deepEqual(alteredExistingTables, ["circles"]);
  });

  test("enforces every one-active boundary with partial unique indexes", () => {
    const sql = compact(migration);
    for (const pattern of [
      /CREATE UNIQUE INDEX "goal_cycles_one_active_per_organization_key" ON "goal_cycles"\("organizationId"\) WHERE "status" = 'ACTIVE'/,
      /CREATE UNIQUE INDEX "goals_one_active_per_circle_cycle_key" ON "goals"\("organizationId", "cycleId", "circleId"\) WHERE "status" = 'ACTIVE'/,
      /CREATE UNIQUE INDEX "goal_work_links_active_project_key" ON "goal_work_links"\("organizationId", "goalId", "kind", "projectId"\) WHERE "status" = 'ACTIVE' AND "projectId" IS NOT NULL/,
      /CREATE UNIQUE INDEX "goal_work_links_active_tension_key" ON "goal_work_links"\("organizationId", "goalId", "kind", "tensionId"\) WHERE "status" = 'ACTIVE' AND "tensionId" IS NOT NULL/,
    ]) {
      assert.match(sql, pattern);
    }
  });

  test("guards proposal and Target type shapes and canonical copies", () => {
    const proposal = compact(sqlTable("goal_proposals"));
    assert.match(proposal, /"kind" = 'CREATE' AND "replacedGoalId" IS NULL/);
    assert.match(proposal, /"kind" IN \('REPLACE', 'CLOSE'\) AND "replacedGoalId" IS NOT NULL/);

    const revisionGuard = compact(sqlFunction("v5_m2_b1_guard_proposal_revision_insert"));
    assert.match(
      revisionGuard,
      /proposal_record\."kind" IN \('CREATE', 'REPLACE'\).*NEW\."title" IS NULL.*NEW\."intendedOutcome" IS NULL.*NEW\."ownerRoleId" IS NULL.*NEW\."closeResult" IS NOT NULL.*NEW\."conclusion" IS NOT NULL/,
    );
    assert.match(
      revisionGuard,
      /NEW\."title" IS NOT NULL.*NEW\."intendedOutcome" IS NOT NULL.*NEW\."ownerRoleId" IS NOT NULL.*NEW\."parentGoalId" IS NOT NULL.*NEW\."closeResult" IS NULL.*NEW\."conclusion" IS NULL/,
    );

    assertTargetShape("goal_proposal_targets");
    assertTargetShape("goal_targets");
    const targetGuard = sqlFunction("v5_m2_b1_guard_goal_target_insert");
    assert.deepEqual(
      captures(targetGuard, /NEW\."([^"]+)" IS DISTINCT FROM source_record\."\1"/g),
      ["position", "label", "kind", "baselineValue", "desiredValue", "unit", "acceptanceCriteria", "metricId"],
    );
    assert.match(targetGuard, /Canonical Target must exactly copy its adopted proposed Target/);
    assert.match(
      sqlFunction("v5_m2_b1_guard_proposal_target_insert"),
      /metric_circle_id <> proposal_circle_id/,
    );
  });

  test("guards typed check-ins, correction chains, and work-link shapes", () => {
    const checkIn = compact(sqlTable("goal_check_ins"));
    assert.match(checkIn, /btrim\("fact"\) <> '' AND btrim\("evidenceSummary"\) <> ''/);
    assert.match(checkIn, /"supersedesCheckInId" IS NULL OR "supersedesCheckInId" <> "id"/);
    assert.match(
      compact(migration),
      /UNIQUE INDEX "goal_check_ins_supersedesCheckInId_key".*FOREIGN KEY \("supersedesCheckInId", "organizationId", "goalId", "targetId"\) REFERENCES "goal_check_ins"\("id", "organizationId", "goalId", "targetId"\) ON DELETE RESTRICT/,
    );

    const checkInGuard = compact(sqlFunction("v5_m2_b1_guard_check_in_insert"));
    assert.match(checkInGuard, /target_record\."kind" = 'NUMERIC'.*NEW\."currentValue" IS NULL.*NEW\."milestoneCompleted" IS NOT NULL.*NEW\."acceptanceEvidence" IS NOT NULL/);
    assert.match(checkInGuard, /"desiredValue" > target_record\."baselineValue".*NEW\."currentValue" >= target_record\."desiredValue"/);
    assert.match(checkInGuard, /"desiredValue" < target_record\."baselineValue".*NEW\."currentValue" <= target_record\."desiredValue"/);
    assert.match(checkInGuard, /NEW\."milestoneCompleted" IS NOT TRUE.*NEW\."acceptanceEvidence" IS NULL.*btrim\(NEW\."acceptanceEvidence"\) = ''/);
    assert.match(checkInGuard, /NEW\."recordedAt" < superseded_at/);

    const workLink = compact(sqlTable("goal_work_links"));
    assert.match(workLink, /"kind" = 'PROJECT' AND "projectId" IS NOT NULL AND "tensionId" IS NULL/);
    assert.match(workLink, /"kind" IN \('ACTION', 'BLOCKING_TENSION'\) AND "projectId" IS NULL AND "tensionId" IS NOT NULL/);
    assert.match(workLink, /"status" = 'REMOVED'.*"removedById" IS NOT NULL.*"removedAt" IS NOT NULL.*btrim\("removalReason"\) <> ''/);

    const workLinkGuard = compact(sqlFunction("v5_m2_b1_guard_work_link_lifecycle"));
    assert.match(workLinkGuard, /NEW\."kind" = 'ACTION'.*"outcomeActionId" = NEW\."tensionId" AND "status" = 'APPROVED'/);
    assert.match(workLinkGuard, /OLD\."status" = 'REMOVED'.*Removed Goal work link is immutable/);
    assert.match(workLinkGuard, /NEW\."status" <> 'REMOVED'.*move only from ACTIVE to REMOVED/);
  });

  test("preflights and guards tenant-safe acyclic Circle hierarchy", () => {
    const preflight = compact(migration.slice(0, migration.indexOf("CREATE TYPE")));
    assert.match(preflight, /child\."organizationId" <> parent\."organizationId"/);
    assert.match(preflight, /"parentId" = "id"/);
    assert.match(preflight, /WITH RECURSIVE hierarchy/);
    assert.match(preflight, /cross-tenant Circle parent detected/);
    assert.match(preflight, /self-parent Circle detected/);
    assert.match(preflight, /Circle hierarchy cycle detected/);

    const hierarchyGuard = compact(sqlFunction("v5_m2_b1_guard_circle_hierarchy"));
    assert.match(hierarchyGuard, /pg_advisory_xact_lock\(hashtextextended\(NEW\."organizationId", 52021\)\)/);
    assert.match(hierarchyGuard, /WITH RECURSIVE ancestors/);
    assert.match(hierarchyGuard, /parent\."organizationId" = NEW\."organizationId"/);
    assert.match(hierarchyGuard, /Circle hierarchy cycle is not allowed/);
    assert.match(compact(migration), /BEFORE INSERT OR UPDATE ON "circles" FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_guard_circle_hierarchy\(\)/);
  });

  test("permits only legal cycle, proposal, and Goal lifecycle transitions", () => {
    const cycle = compact(sqlFunction("v5_m2_b1_guard_cycle_lifecycle"));
    assert.match(cycle, /NEW\."status" <> 'PLANNED'.*Goal cycle must be created PLANNED/);
    assert.match(cycle, /OLD\."status" = 'PLANNED' AND NEW\."status" IN \('ACTIVE', 'CANCELLED'\)/);
    assert.match(cycle, /OLD\."status" = 'ACTIVE' AND NEW\."status" = 'CLOSED'/);
    assert.match(cycle, /OLD\."status" IN \('CLOSED', 'CANCELLED'\).*Terminal Goal cycle is immutable/);
    assert.match(cycle, /"status" NOT IN \('ADOPTED', 'DECLINED', 'WITHDRAWN'\)/);
    assert.match(cycle, /"status" = 'ACTIVE'.*Goal cycle cannot close while an ACTIVE Goal remains/);

    const proposal = compact(sqlFunction("v5_m2_b1_guard_proposal_lifecycle"));
    assert.match(proposal, /OLD\."status" = 'DRAFT' AND NEW\."status" IN \('SUBMITTED', 'WITHDRAWN'\)/);
    assert.match(proposal, /OLD\."status" = 'SUBMITTED' AND NEW\."status" IN \('ADOPTED', 'RETURNED', 'DECLINED', 'WITHDRAWN'\)/);
    assert.match(proposal, /OLD\."status" = 'RETURNED' AND NEW\."status" IN \('DRAFT', 'WITHDRAWN'\)/);
    assert.match(proposal, /NEW\."currentRevision" = OLD\."currentRevision" \+ 1/);
    assert.match(proposal, /Terminal Goal proposal is immutable/);

    const goal = compact(sqlFunction("v5_m2_b1_guard_goal_lifecycle"));
    assert.match(goal, /OLD\."status" <> 'ACTIVE'.*Terminal Goal is immutable/);
    assert.match(goal, /NEW\."status" NOT IN \('SUPERSEDED', 'ACHIEVED', 'NOT_ACHIEVED'\)/);
    assert.match(goal, /Goal terminal fields require a lifecycle transition/);
    assert.match(goal, /Confirmed Goal cannot be deleted/);
  });

  test("keeps revisions, decisions, Targets, and check-ins immutable", () => {
    const sql = compact(migration);
    for (const [trigger, table] of [
      ["v5_m2_b1_goal_proposal_revision_immutable", "goal_proposal_revisions"],
      ["v5_m2_b1_goal_proposal_target_immutable", "goal_proposal_targets"],
      ["v5_m2_b1_goal_decision_immutable", "goal_decisions"],
      ["v5_m2_b1_goal_target_immutable", "goal_targets"],
      ["v5_m2_b1_goal_check_in_immutable", "goal_check_ins"],
    ]) {
      assert.match(
        sql,
        new RegExp(`CREATE TRIGGER ${trigger} BEFORE UPDATE OR DELETE ON "${table}" FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_deny_immutable_mutation\\(\\)`),
      );
    }
    assert.match(sqlFunction("v5_m2_b1_guard_proposal_revision_insert"), /revisions must be strictly consecutive/);
    assert.match(sqlFunction("v5_m2_b1_guard_goal_lifecycle"), /Goal definition is immutable/);
  });

  test("defers terminal proposal decisions and exact-current revisions to commit", () => {
    const sql = compact(migration);
    assert.match(
      sql,
      /CREATE CONSTRAINT TRIGGER v5_m2_b1_goal_proposal_decision_guard AFTER INSERT OR UPDATE ON "goal_proposals" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_assert_proposal_decision\(\)/,
    );
    const proposalDecision = compact(sqlFunction("v5_m2_b1_assert_proposal_decision"));
    assert.match(proposalDecision, /proposal_record\."status" NOT IN \('ADOPTED', 'RETURNED', 'DECLINED'\)/);
    assert.match(
      proposalDecision,
      /FROM "goal_decisions" WHERE "organizationId" = NEW\."organizationId" AND "proposalId" = NEW\."id" AND "revision" = proposal_record\."currentRevision" AND "outcome"::text = proposal_record\."status"::text/,
    );
    assert.match(proposalDecision, /matching_decisions <> 1/);

    assert.match(
      sql,
      /CREATE CONSTRAINT TRIGGER v5_m2_b1_goal_revision_current_guard AFTER INSERT ON "goal_proposal_revisions" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_assert_revision_current\(\)/,
    );
    const revisionCurrent = compact(sqlFunction("v5_m2_b1_assert_revision_current"));
    assert.match(revisionCurrent, /proposal_record\."currentRevision" <> NEW\."revision"/);
    assert.match(revisionCurrent, /proposal_record\.row_xid <> pg_current_xact_id\(\)/);
    assert.match(revisionCurrent, /pair with proposal creation or revision advancement in the same transaction/);
  });

  test("binds terminal Goal state to an exact distinct REPLACE or CLOSE decision", () => {
    assert.match(
      compact(migration),
      /CREATE CONSTRAINT TRIGGER v5_m2_b1_goal_terminal_decision_guard AFTER UPDATE ON "goals" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION v5_m2_b1_assert_goal_terminal_decision\(\)/,
    );
    const terminalDecision = compact(sqlFunction("v5_m2_b1_assert_goal_terminal_decision"));
    assert.match(
      terminalDecision,
      /goal_record\."terminalDecisionId" = goal_record\."adoptedDecisionId".*Goal terminal decision must differ from its adoption decision/,
    );
    assert.match(
      terminalDecision,
      /terminal_record\.decision_outcome <> 'ADOPTED'.*terminal_record\.proposal_status <> 'ADOPTED'.*terminal_record\.current_revision <> terminal_record\.decision_revision.*terminal_record\.proposal_kind NOT IN \('REPLACE', 'CLOSE'\).*terminal_record\.replaced_goal_id IS DISTINCT FROM goal_record\."id".*terminal_record\.cycle_id <> goal_record\."cycleId".*terminal_record\.circle_id <> goal_record\."circleId"/,
    );
    assert.match(
      terminalDecision,
      /goal_record\."status" = 'SUPERSEDED'.*terminal_record\.proposal_kind <> 'REPLACE'.*replacement\."id" <> goal_record\."id".*replacement\."adoptedDecisionId" = goal_record\."terminalDecisionId"/,
    );
    assert.match(
      terminalDecision,
      /goal_record\."status" IN \('ACHIEVED', 'NOT_ACHIEVED'\).*terminal_record\.proposal_kind <> 'CLOSE'.*terminal_record\.close_result::text IS DISTINCT FROM goal_record\."status"::text.*terminal_record\.conclusion IS NULL.*btrim\(terminal_record\.conclusion\) = ''/,
    );
  });

  test("defers Target cardinality and strategic decision effects to commit", () => {
    const sql = compact(migration);
    for (const [trigger, table, fn] of [
      ["v5_m2_b1_goal_revision_targets_guard", "goal_proposal_revisions", "v5_m2_b1_assert_revision_targets"],
      ["v5_m2_b1_goal_targets_guard", "goals", "v5_m2_b1_assert_goal_targets"],
      ["v5_m2_b1_goal_decision_effects_guard", "goal_decisions", "v5_m2_b1_assert_decision_effects"],
    ]) {
      assert.match(
        sql,
        new RegExp(`CREATE CONSTRAINT TRIGGER ${trigger} AFTER INSERT ON "${table}" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ${fn}\\(\\)`),
      );
    }

    const revisionTargets = compact(sqlFunction("v5_m2_b1_assert_revision_targets"));
    assert.match(revisionTargets, /proposal_kind IN \('CREATE', 'REPLACE'\) AND target_count = 0/);
    assert.match(revisionTargets, /proposal_kind = 'CLOSE' AND target_count <> 0/);

    const goalTargets = compact(sqlFunction("v5_m2_b1_assert_goal_targets"));
    assert.match(
      goalTargets,
      /FROM "goal_decisions" AS decision JOIN "goal_proposal_targets" AS source_target.*WHERE decision\."id" = NEW\."adoptedDecisionId".*AND NOT EXISTS \( SELECT 1 FROM "goal_targets" AS canonical_target.*canonical_target\."sourceProposalTargetId" = source_target\."id" \)/,
    );
    assert.match(
      goalTargets,
      /OR EXISTS \( SELECT 1 FROM "goal_targets" AS canonical_target.*AND NOT EXISTS \( SELECT 1 FROM "goal_decisions" AS decision JOIN "goal_proposal_targets" AS source_target.*WHERE decision\."id" = NEW\."adoptedDecisionId".*source_target\."id" = canonical_target\."sourceProposalTargetId" \) \) THEN/,
    );
    assert.match(goalTargets, /Canonical Goal Targets must exactly match the adopted proposal Target set/);

    const decisionEffects = compact(sqlFunction("v5_m2_b1_assert_decision_effects"));
    assert.match(decisionEffects, /proposal_record\."currentRevision" <> NEW\."revision"/);
    assert.match(decisionEffects, /proposal_record\."kind" = 'CREATE'.*"adoptedDecisionId" = NEW\."id"/);
    assert.match(decisionEffects, /proposal_record\."kind" = 'REPLACE'.*"status" = 'SUPERSEDED'/);
    assert.match(decisionEffects, /proposal_record\."kind" = 'CLOSE'.*"status"::text = proposal_record\."closeResult"::text/);
    assert.match(decisionEffects, /Non-adopted Goal decision cannot mutate canonical Goals/);
  });

  test("requires latest effective evidence for an ACHIEVED Goal", () => {
    const goalLifecycle = compact(sqlFunction("v5_m2_b1_guard_goal_lifecycle"));
    assert.match(goalLifecycle, /NEW\."status" = 'ACHIEVED'/);
    assert.match(goalLifecycle, /LEFT JOIN LATERAL/);
    assert.match(goalLifecycle, /correction\."supersedesCheckInId" = check_in\."id"/);
    assert.match(goalLifecycle, /ORDER BY check_in\."recordedAt" DESC, check_in\."id" DESC LIMIT 1/);
    assert.match(goalLifecycle, /latest\."assessment" IS DISTINCT FROM 'ACHIEVED'::"GoalCheckInAssessment"/);
    assert.match(goalLifecycle, /every Target latest effective check-in is ACHIEVED/);
  });

  test("guards non-empty rollback and restores the exact empty-schema order", () => {
    assert.match(rollback, /^BEGIN;/);
    assert.match(rollback, /COMMIT;\s*$/);
    const lockStatement = rollback.match(/LOCK TABLE ([\s\S]*?)\s+IN ACCESS EXCLUSIVE MODE;/)?.[1] ?? "";
    assert.deepEqual(captures(lockStatement, /"([^"]+)"/g), goalTables);
    assert.ok(rollback.indexOf("LOCK TABLE") < rollback.indexOf("DO $rollback_guard$"));

    const firstDrop = rollback.indexOf("DROP TRIGGER");
    assert.ok(firstDrop > 0);
    const guard = rollback.slice(0, firstDrop);
    assert.deepEqual(
      captures(guard, /FROM "([^"]+)"/g).sort(),
      [...goalTables].sort(),
    );
    assert.match(guard, /Rollback blocked: Goal persistence contains business rows and requires a forward fix/);

    assert.deepEqual(captures(rollback, /^DROP TABLE "([^"]+)"/gm), [
      "goal_work_links",
      "goal_check_ins",
      "goal_targets",
      "goal_decisions",
      "goal_proposal_targets",
      "goal_proposal_revisions",
      "goals",
      "goal_proposals",
      "goal_cycles",
    ]);
    assert.deepEqual(captures(rollback, /^DROP TYPE "([^"]+)"/gm), Object.keys(goalEnums).reverse());

    for (const [trigger, table] of [
      ["v5_m2_b1_goal_proposal_decision_guard", "goal_proposals"],
      ["v5_m2_b1_goal_revision_current_guard", "goal_proposal_revisions"],
      ["v5_m2_b1_goal_terminal_decision_guard", "goals"],
    ]) {
      assert.match(rollback, new RegExp(`DROP TRIGGER ${trigger} ON "${table}";`));
    }
    for (const fn of [
      "v5_m2_b1_assert_proposal_decision",
      "v5_m2_b1_assert_revision_current",
      "v5_m2_b1_assert_goal_terminal_decision",
    ]) {
      assert.match(rollback, new RegExp(`DROP FUNCTION ${fn}\\(\\);`));
    }

    const stages = [
      "DROP TRIGGER",
      "DROP FUNCTION",
      'ALTER TABLE "goal_proposals" DROP CONSTRAINT',
      "DROP TABLE",
      'DROP INDEX "metrics_id_organizationId_key"',
      'ALTER TABLE "circles" DROP CONSTRAINT "circles_parentId_organizationId_fkey"',
      "DROP TYPE",
      'ALTER TABLE "circles" ADD CONSTRAINT "circles_parentId_fkey"',
    ];
    for (let index = 1; index < stages.length; index += 1) {
      assert.ok(rollback.indexOf(stages[index]) > rollback.indexOf(stages[index - 1]));
    }
    assert.match(
      compact(rollback),
      /ALTER TABLE "circles" ADD CONSTRAINT "circles_parentId_fkey" FOREIGN KEY \("parentId"\) REFERENCES "circles"\("id"\) ON DELETE SET NULL ON UPDATE CASCADE/,
    );
  });

  test("keeps Prisma model, enum, and migration names coherent", () => {
    for (const [name, values] of Object.entries(goalEnums)) {
      assert.deepEqual(sqlEnumValues(name), values);
    }
    assert.deepEqual(
      goalModels.map((model) => schemaBlock("model", model).match(/@@map\("([^"]+)"\)/)?.[1]),
      goalTables,
    );
  });
});
