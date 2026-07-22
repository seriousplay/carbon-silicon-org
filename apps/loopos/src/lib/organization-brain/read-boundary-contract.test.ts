import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";

function source(relativeUrl: string): string {
  const url = new URL(relativeUrl, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : "";
}

const migration = source(
  "../../../prisma/migrations/20260714081530_v5_m1_b2_brain_read_boundary/migration.sql",
);
const rollback = source(
  "../../../prisma/migrations/20260714081530_v5_m1_b2_brain_read_boundary/rollback.sql",
);
const b2bMigration = source(
  "../../../prisma/migrations/20260714110000_v5_m1_b2b_operational_fact_views/migration.sql",
);
const b2bRollback = source(
  "../../../prisma/migrations/20260714110000_v5_m1_b2b_operational_fact_views/rollback.sql",
);
const goalMigration = source(
  "../../../prisma/migrations/20260715160000_v5_m3_b_goal_read_surface/migration.sql",
);
const goalRollback = source(
  "../../../prisma/migrations/20260715160000_v5_m3_b_goal_read_surface/rollback.sql",
);
const provision = source(
  "../../../scripts/organization-brain/provision-reader-role.sql",
);
const harden = source(
  "../../../scripts/organization-brain/harden-reader-database.sql",
);
const deprovision = source(
  "../../../scripts/organization-brain/deprovision-reader-role.sql",
);
const deployment = source(
  "../../../scripts/organization-brain/B2A_DEPLOYMENT.md",
);

const b2aViews = [
  "current_actor",
  "organization_identity",
  "organization_brain_profile",
  "current_actor_role_assignments",
  "private_conversations",
  "private_messages",
] as const;

const inactiveViews = [
  "circles",
  "role_definitions",
  "projects",
  "actions",
  "unresolved_tensions",
  "meeting_drafts",
  "approved_tactical_outcomes",
  "adopted_governance_decisions",
  "published_governance_logs",
] as const;

const b2bViews = [...inactiveViews];
const goalViews = [
  "goal_cycles",
  "goals",
  "goal_targets",
  "goal_effective_check_ins",
  "goal_active_work_links",
] as const;

function viewBlock(name: (typeof b2aViews)[number]): string {
  return (
    migration.match(
      new RegExp(
        `CREATE VIEW brain_read\\.${name}[\\s\\S]*?(?=\\nCREATE VIEW brain_read\\.|\\nGRANT )`,
      ),
    )?.[0] ?? ""
  );
}

function b2bViewBlock(name: (typeof b2bViews)[number]): string {
  return (
    b2bMigration.match(
      new RegExp(
        `CREATE VIEW brain_read\\.${name}[\\s\\S]*?(?=\\nCREATE VIEW brain_read\\.|\\nGRANT )`,
      ),
    )?.[0] ?? ""
  );
}

function goalViewBlock(name: (typeof goalViews)[number]): string {
  return (
    goalMigration.match(
      new RegExp(
        `CREATE VIEW brain_read\\.${name}[\\s\\S]*?(?=\\nCREATE VIEW brain_read\\.|\\nDO \\$loopos\\$|\\nGRANT )`,
      ),
    )?.[0] ?? ""
  );
}

describe("V5-M1-B2a database-local read surface", () => {
  test("fails closed unless the pre-provisioned group role has exact safe attributes", () => {
    assert.match(migration, /pg_catalog\.pg_roles/);
    assert.match(migration, /rolname\s*=\s*'loopos_brain_reader'/);
    assert.match(migration, /RAISE EXCEPTION/);
    assert.match(migration, /rolcanlogin/);
    assert.match(migration, /rolinherit/);
    assert.match(migration, /rolsuper/);
    assert.match(migration, /rolcreatedb/);
    assert.match(migration, /rolcreaterole/);
    assert.match(migration, /rolreplication/);
    assert.match(migration, /rolbypassrls/);
    assert.doesNotMatch(migration, /\b(?:CREATE|ALTER|DROP) ROLE\b/i);
    assert.doesNotMatch(migration, /\bGRANT\s+loopos_brain_reader\s+TO\b/i);
  });

  test("creates and grants exactly the six security-barrier B2a views", () => {
    const created = [...migration.matchAll(/CREATE VIEW brain_read\.([a-z_]+)/g)].map(
      (match) => match[1],
    );
    const granted = [
      ...migration.matchAll(
        /GRANT SELECT ON brain_read\.([a-z_]+) TO loopos_brain_reader/g,
      ),
    ].map((match) => match[1]);

    assert.deepEqual(created, [...b2aViews]);
    assert.deepEqual(granted.sort(), [...b2aViews].sort());
    for (const view of b2aViews) {
      assert.match(
        migration,
        new RegExp(
          `CREATE VIEW brain_read\\.${view}\\s+WITH \\(security_barrier = true\\)`,
        ),
      );
    }
    for (const view of inactiveViews) {
      assert.doesNotMatch(migration, new RegExp(`brain_read\\.${view}\\b`));
    }
    assert.doesNotMatch(migration, /GRANT (?:ALL|SELECT) ON ALL TABLES/i);
    assert.doesNotMatch(migration, /ALTER DEFAULT PRIVILEGES/i);
    assert.doesNotMatch(migration, /GRANT .*(?:public\.|FUNCTION|SEQUENCE)/i);
  });

  test("validates one exact ActorContext without exposing account or agent fields", () => {
    const actor = viewBlock("current_actor");

    assert.match(actor, /public\.people/);
    assert.match(actor, /public\.memberships/);
    assert.match(actor, /public\.organizations/);
    assert.match(actor, /public\.circles/);
    assert.match(actor, /current_setting\('loopos\.organization_id', true\)/);
    assert.match(actor, /current_setting\('loopos\.user_id', true\)/);
    assert.match(actor, /current_setting\('loopos\.person_id', true\)/);
    assert.doesNotMatch(
      actor,
      /email|password|agentModel|agentEndpoint|agentAbilities|agentConfig/i,
    );
  });

  test("limits assignments to the current actor and private rows to their owner", () => {
    const assignments = viewBlock("current_actor_role_assignments");
    assert.match(assignments, /_PersonRoles/);
    assert.match(assignments, /actor\."personId"/);
    assert.match(assignments, /role_definition\."status" = 'ACTIVE'/);

    assert.match(
      viewBlock("private_conversations"),
      /"ownerId" = actor\."personId"/,
    );
    assert.match(
      viewBlock("private_messages"),
      /"ownerId" = actor\."personId"/,
    );
  });

  test("does not expose forbidden tables, fields, privileges, or stored functions", () => {
    assert.doesNotMatch(
      migration,
      /public\."?(?:users|accounts|sessions|verification_tokens|brain_query_audits|interface_workflow_runs|interface_workbenches)"?/i,
    );
    assert.doesNotMatch(
      migration,
      /"?(?:email|passwordHash|agentModel|agentEndpoint|agentAbilities|agentConfig|aiTranslation|aiHandlingSuggestion|aiGuardReport)"?/,
    );
    assert.doesNotMatch(migration, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i);
    assert.doesNotMatch(migration, /BRAIN_DATABASE_URL|PASSWORD/i);
  });

  test("rolls back only database-local B2a grants and objects", () => {
    for (const view of b2aViews) {
      assert.match(
        rollback,
        new RegExp(
          `REVOKE SELECT ON brain_read\\.${view} FROM loopos_brain_reader`,
        ),
      );
    }
    assert.match(rollback, /REVOKE USAGE ON SCHEMA brain_read FROM loopos_brain_reader/);
    assert.match(rollback, /DROP SCHEMA brain_read CASCADE/);
    assert.doesNotMatch(rollback, /\b(?:CREATE|ALTER|DROP) ROLE\b/i);
    assert.doesNotMatch(
      rollback,
      /organization_brain_profiles|brain_conversations|brain_messages|brain_query_audits|organizations|people|memberships/i,
    );
  });
});

describe("V5-M1-B2b authorized operational fact views", () => {
  test("fails closed unless the safe B2a foundation and reader ACL exist", () => {
    assert.match(b2bMigration, /pg_catalog\.pg_roles/);
    assert.match(b2bMigration, /rolname\s*=\s*'loopos_brain_reader'/);
    assert.match(b2bMigration, /foundation_view_count <> 6/);
    assert.match(b2bMigration, /class\.reloptions[\s\S]*security_barrier=true/);
    assert.match(b2bMigration, /has_schema_privilege[\s\S]*'brain_read'[\s\S]*'USAGE'/);
    assert.match(b2bMigration, /has_table_privilege[\s\S]*'SELECT'/);
    assert.match(b2bMigration, /RAISE EXCEPTION/);
    assert.doesNotMatch(b2bMigration, /\b(?:CREATE|ALTER|DROP) ROLE\b/i);
  });

  test("creates and grants exactly nine security-barrier B2b views", () => {
    const created = [
      ...b2bMigration.matchAll(/CREATE VIEW brain_read\.([a-z_]+)/g),
    ].map((match) => match[1]);
    const granted = [
      ...b2bMigration.matchAll(
        /GRANT SELECT ON brain_read\.([a-z_]+) TO loopos_brain_reader/g,
      ),
    ].map((match) => match[1]);

    assert.deepEqual(created, b2bViews);
    assert.deepEqual(granted, b2bViews);
    for (const view of b2bViews) {
      assert.match(
        b2bMigration,
        new RegExp(
          `CREATE VIEW brain_read\\.${view}\\s+WITH \\(security_barrier = true\\)`,
        ),
      );
      assert.match(
        b2bViewBlock(view),
        /JOIN brain_read\.current_actor AS actor[\s\S]*actor\."organizationId"/,
      );
    }
    assert.doesNotMatch(b2bMigration, /GRANT (?:ALL|SELECT) ON ALL TABLES/i);
    assert.doesNotMatch(b2bMigration, /ALTER DEFAULT PRIVILEGES/i);
    assert.doesNotMatch(b2bMigration, /GRANT .*(?:public\.|FUNCTION|SEQUENCE)/i);
  });

  test("enforces confirmed project, action, tactical, governance, and publication facts", () => {
    const circles = b2bViewBlock("circles");
    assert.match(circles, /circle\."status" <> 'ARCHIVED'/);

    const roles = b2bViewBlock("role_definitions");
    assert.match(roles, /role_definition\."status" = 'ACTIVE'/);

    const projects = b2bViewBlock("projects");
    assert.match(projects, /proposal\."outcomeProjectId" = project\."id"/);
    assert.match(projects, /proposal\."kind" = 'PROJECT'/);
    assert.match(projects, /proposal\."status" = 'APPROVED'/);
    assert.match(projects, /proposal\."outcomeActionId" IS NULL/);

    const actions = b2bViewBlock("actions");
    assert.match(actions, /proposal\."outcomeActionId" = action\."id"/);
    assert.match(actions, /proposal\."kind" = 'ACTION'/);
    assert.match(actions, /proposal\."status" = 'APPROVED'/);
    assert.match(actions, /proposal\."outcomeProjectId" IS NULL/);

    const tactical = b2bViewBlock("approved_tactical_outcomes");
    assert.match(tactical, /proposal\."status" = 'APPROVED'/);
    assert.match(tactical, /proposal\."outcomeProjectId" IS NOT NULL/);
    assert.match(tactical, /proposal\."outcomeActionId" IS NOT NULL/);
    assert.match(tactical, /outcome_project\."id" = proposal\."outcomeProjectId"/);
    assert.match(tactical, /outcome_action\."id" = proposal\."outcomeActionId"/);

    const governance = b2bViewBlock("adopted_governance_decisions");
    assert.match(governance, /process\."state" = 'ADOPTED'/);
    assert.match(governance, /process\."recordedById" IS NOT NULL/);
    assert.match(governance, /process\."recordedAt" IS NOT NULL/);
    assert.match(governance, /process\."outcomeRoleId" IS NOT NULL/);
    assert.match(governance, /decision\."id" = process\."decisionId"/);
    assert.match(governance, /decision\."meetingId" = process\."meetingId"/);
    assert.match(governance, /change\."id" = process\."changeLogId"/);
    assert.match(governance, /change\."decisionId" = decision\."id"/);

    const logs = b2bViewBlock("published_governance_logs");
    assert.match(logs, /governance_log\."status" = 'published'/);
    assert.match(logs, /governance_log\."publishedAt" IS NOT NULL/);
    assert.match(logs, /governance_log\."confirmedById"/);
  });

  test("limits open unapproved Tensions to owner, raiser, active Circle lead, or admin", () => {
    const tensions = b2bViewBlock("unresolved_tensions");
    assert.match(tensions, /tension\."status" = 'OPEN'/);
    assert.match(tensions, /NOT EXISTS[\s\S]*approved_action\."kind" = 'ACTION'/);
    assert.match(tensions, /approved_action\."status" = 'APPROVED'/);
    assert.match(tensions, /approved_action\."outcomeActionId" = tension\."id"/);
    assert.match(tensions, /tension\."ownerId" = actor\."personId"/);
    assert.match(tensions, /tension\."raiserId" = actor\."personId"/);
    assert.match(tensions, /actor\."membershipRole" = 'ORG_ADMIN'/);
    assert.match(tensions, /authorized_circle\."leadPersonId" = actor\."personId"/);
    assert.match(tensions, /authorized_circle\."status" <> 'ARCHIVED'/);
    assert.match(tensions, /authorized_circle\."id" = tension\."circleId"/);
    assert.match(tensions, /public\."_TensionCircle"/);
    assert.doesNotMatch(tensions, /_PersonRoles|_MeetingToPerson/);
  });

  test("keeps meeting drafts participant-only with no admin or lead bypass", () => {
    const meetings = b2bViewBlock("meeting_drafts");
    assert.match(meetings, /public\."_MeetingToPerson"/);
    assert.match(meetings, /participant\."A" = meeting\."id"/);
    assert.match(meetings, /participant\."B" = actor\."personId"/);
    assert.match(meetings, /meeting\."endedAt"/);
    assert.doesNotMatch(meetings, /membershipRole|leadPersonId|ORG_ADMIN/);
  });

  test("omits forbidden identities, private derivations, runtime data, and generic resources", () => {
    assert.doesNotMatch(
      b2bMigration,
      /public\."?(?:users|accounts|sessions|verification_tokens|brain_conversations|brain_messages|brain_query_audits|interface_workflow_runs|interface_workbenches|governance_decision_operations)"?/i,
    );
    assert.doesNotMatch(
      b2bMigration,
      /"(?:email|passwordHash|agentModel|agentEndpoint|agentAbilities|agentConfig|aiTranslation|aiHandlingSuggestion|aiGuardReport|rootCause|linkedDataVersion|lastMutationKey|lastMutationResult|mutationKey|canonicalPayloadHash|leaseToken|leaseExpiresAt|resultEnvelope)"/,
    );
    assert.doesNotMatch(
      b2bMigration,
      /CREATE VIEW brain_read\.(?:confirmed_meeting_results|meetings|decision_records|change_logs|governance_proposals|governance_logs)\b/,
    );
    assert.doesNotMatch(b2bMigration, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i);
    assert.doesNotMatch(b2bMigration, /BRAIN_DATABASE_URL|PASSWORD/i);
  });

  test("reprovision permits exactly all 20 accepted views", () => {
    const whitelistBlocks = [
      ...provision.matchAll(
        /class\.relname = ANY \(ARRAY\[([\s\S]*?)\]::text\[\]\)/g,
      ),
    ];
    assert.equal(whitelistBlocks.length, 2);
    const expected = [...b2aViews, ...b2bViews, ...goalViews];
    for (const block of whitelistBlocks) {
      const names = [...(block[1] ?? "").matchAll(/'([a-z_]+)'/g)].map(
        (match) => match[1],
      );
      assert.deepEqual(names, expected);
      assert.equal(new Set(names).size, 20);
    }
  });

  test("rolls back only the nine B2b grants and views in reverse order", () => {
    const expectedReverse = [...b2bViews].reverse();
    const revoked = [
      ...b2bRollback.matchAll(
        /REVOKE SELECT ON brain_read\.([a-z_]+) FROM loopos_brain_reader/g,
      ),
    ].map((match) => match[1]);
    const dropped = [
      ...b2bRollback.matchAll(/DROP VIEW brain_read\.([a-z_]+)/g),
    ].map((match) => match[1]);
    assert.deepEqual(revoked, expectedReverse);
    assert.deepEqual(dropped, expectedReverse);
    assert.doesNotMatch(b2bRollback, /DROP SCHEMA|REVOKE USAGE/);
    for (const view of b2aViews) {
      assert.doesNotMatch(b2bRollback, new RegExp(`brain_read\\.${view}\\b`));
    }
    assert.doesNotMatch(b2bRollback, /\b(?:CREATE|ALTER|DROP) ROLE\b/i);
    assert.doesNotMatch(b2bRollback, /public\./);
  });
});

describe("V5-M3-B confirmed Goal read surface", () => {
  test("admits the exact existing boundary and creates exactly five security-barrier views", () => {
    assert.match(goalMigration, /BEGIN;/);
    assert.match(goalMigration, /rolname\s*=\s*'loopos_brain_reader'/);
    assert.match(goalMigration, /existing_view_count <> 15/);
    assert.match(goalMigration, /class\.reloptions[\s\S]*security_barrier=true/);
    assert.match(goalMigration, /has_schema_privilege[\s\S]*'brain_read'[\s\S]*'USAGE'/);
    assert.match(goalMigration, /has_table_privilege[\s\S]*'SELECT'/);

    const created = [
      ...goalMigration.matchAll(/CREATE VIEW brain_read\.([a-z_]+)/g),
    ].map((match) => match[1]);
    const granted = [
      ...goalMigration.matchAll(
        /GRANT SELECT ON brain_read\.([a-z_]+) TO loopos_brain_reader/g,
      ),
    ].map((match) => match[1]);
    assert.deepEqual(created, goalViews);
    assert.deepEqual(granted, goalViews);
    for (const view of goalViews) {
      assert.match(
        goalMigration,
        new RegExp(
          `CREATE VIEW brain_read\\.${view}\\s+WITH \\(security_barrier = true\\)`,
        ),
      );
      assert.match(
        goalViewBlock(view),
        /JOIN brain_read\.current_actor AS actor[\s\S]*actor\."organizationId"/,
      );
    }
    assert.match(goalMigration, /admitted_view_count <> 20/);
    assert.doesNotMatch(goalMigration, /GRANT (?:ALL|SELECT) ON ALL TABLES/i);
    assert.doesNotMatch(goalMigration, /ALTER DEFAULT PRIVILEGES/i);
    assert.doesNotMatch(goalMigration, /\b(?:CREATE|ALTER|DROP) ROLE\b/i);
  });

  test("projects the exact closed field order for every Goal resource", () => {
    const expected = {
      goal_cycles: [
        "organizationId", "id", "name", "status", "startAt", "endAt",
        "checkInCadenceDays", "sourceVersionAt",
      ],
      goals: [
        "organizationId", "id", "cycleId", "circleId", "title",
        "intendedOutcome", "ownerRoleId", "parentGoalId", "status", "createdAt",
        "adoptedMeetingId", "adoptedAt", "terminalOutcome",
        "terminalMeetingId", "terminalAt", "sourceVersionAt",
      ],
      goal_targets: [
        "organizationId", "id", "cycleId", "goalId", "position", "label",
        "kind", "baselineValue", "desiredValue", "unit", "acceptanceCriteria",
        "metricId", "createdAt", "sourceVersionAt",
      ],
      goal_effective_check_ins: [
        "organizationId", "id", "cycleId", "goalId", "targetId", "fact",
        "evidenceSummary", "currentValue", "milestoneState",
        "acceptanceEvidence", "assessment", "recorderId", "meetingId",
        "recordedAt", "sourceVersionAt",
      ],
      goal_active_work_links: [
        "organizationId", "id", "cycleId", "goalId", "kind", "projectId",
        "tensionId", "objectLabel", "objectStatus", "createdAt",
        "sourceVersionAt",
      ],
    } as const;

    for (const view of goalViews) {
      const projection = goalViewBlock(view).split("\nFROM ")[0] ?? "";
      const aliases = [...projection.matchAll(/ AS "([A-Za-z]+)"/g)].map(
        (match) => match[1],
      );
      assert.deepEqual(aliases, expected[view], view);
    }
  });

  test("exposes canonical current facts, exact versions, decimals, and milestone enum strings", () => {
    const cycles = goalViewBlock("goal_cycles");
    assert.match(cycles, /public\.goal_cycles/);
    assert.match(cycles, /cycle\."updatedAt" AS "sourceVersionAt"/);

    const goals = goalViewBlock("goals");
    assert.match(goals, /public\.goals/);
    assert.match(goals, /public\.goal_decisions AS adopted_decision/);
    assert.match(goals, /adopted_decision\."meetingId" AS "adoptedMeetingId"/);
    assert.match(goals, /adopted_decision\."decidedAt" AS "adoptedAt"/);
    assert.match(goals, /COALESCE\(goal\."terminalAt", goal\."createdAt"\) AS "sourceVersionAt"/);
    assert.doesNotMatch(goals, /goal_proposals|goal_proposal_revisions/);

    const targets = goalViewBlock("goal_targets");
    assert.match(targets, /public\.goal_targets/);
    assert.match(targets, /target\."baselineValue"::text AS "baselineValue"/);
    assert.match(targets, /target\."desiredValue"::text AS "desiredValue"/);
    assert.match(targets, /target\."createdAt" AS "sourceVersionAt"/);

    const checkIns = goalViewBlock("goal_effective_check_ins");
    assert.match(checkIns, /DISTINCT ON \(check_in\."targetId"\)/);
    assert.match(checkIns, /correction\."supersedesCheckInId" = check_in\."id"/);
    assert.match(checkIns, /ORDER BY[\s\S]*check_in\."targetId"[\s\S]*check_in\."recordedAt" DESC[\s\S]*check_in\."id" DESC/);
    assert.match(checkIns, /check_in\."currentValue"::text AS "currentValue"/);
    assert.match(checkIns, /WHEN TRUE THEN 'COMPLETED'[\s\S]*WHEN FALSE THEN 'NOT_COMPLETED'/);
    assert.match(checkIns, /check_in\."recordedAt" AS "sourceVersionAt"/);
    assert.doesNotMatch(checkIns, /derived|health|gap/i);
  });

  test("removes unauthorized blocking Tension links before broker pagination", () => {
    const links = goalViewBlock("goal_active_work_links");
    assert.match(links, /work_link\."status" = 'ACTIVE'/);
    assert.match(links, /work_link\."kind" = 'PROJECT'/);
    assert.match(links, /work_link\."kind" = 'ACTION'/);
    assert.match(links, /work_link\."kind" = 'BLOCKING_TENSION'/);
    assert.match(links, /JOIN brain_read\.projects AS project/);
    assert.match(links, /JOIN brain_read\.actions AS action/);
    assert.match(links, /JOIN brain_read\.unresolved_tensions AS authorized_tension/);
    assert.match(links, /authorized_tension\."id" = work_link\."tensionId"/);
    assert.doesNotMatch(links, /REMOVED|removedAt|removalReason/);
    assert.doesNotMatch(links, /COUNT\s*\(|hasMore/i);
  });

  test("contains no Goal-table write path or proposal, revision, historical, or derived row surface", () => {
    assert.doesNotMatch(
      goalMigration,
      /^\s*(?:INSERT\s+INTO|UPDATE|DELETE\s+FROM|TRUNCATE|MERGE\s+INTO)\s+public\.goal_/im,
    );
    assert.doesNotMatch(goalMigration, /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION/i);
    assert.doesNotMatch(goalMigration, /CREATE\s+TRIGGER/i);
    assert.doesNotMatch(
      goalMigration,
      /public\.goal_(?:proposals|proposal_revisions|proposal_targets)/,
    );
  });

  test("rolls back exactly the five M3-B grants and views in reverse order", () => {
    const expectedReverse = [...goalViews].reverse();
    const revoked = [
      ...goalRollback.matchAll(
        /REVOKE SELECT ON brain_read\.([a-z_]+) FROM loopos_brain_reader/g,
      ),
    ].map((match) => match[1]);
    const dropped = [
      ...goalRollback.matchAll(/DROP VIEW brain_read\.([a-z_]+)/g),
    ].map((match) => match[1]);
    assert.deepEqual(revoked, expectedReverse);
    assert.deepEqual(dropped, expectedReverse);
    assert.doesNotMatch(goalRollback, /DROP SCHEMA|REVOKE USAGE|public\./);
    assert.doesNotMatch(goalRollback, /\b(?:CREATE|ALTER|DROP) ROLE\b/i);
  });
});

describe("V5-M1-B2a cluster role lifecycle scripts", () => {
  test("provisions the group role idempotently for one verified dedicated login", () => {
    assert.match(provision, /\\set ON_ERROR_STOP on/);
    assert.match(provision, /:\{\?brain_login_role\}/);
    assert.match(provision, /:\{\?brain_allowed_databases\}/);
    assert.match(provision, /:\{\?brain_migration_owner_role\}/);
    assert.match(provision, /CREATE ROLE loopos_brain_reader/);
    assert.match(
      provision,
      /ALTER ROLE loopos_brain_reader[\s\S]*NOLOGIN[\s\S]*NOINHERIT[\s\S]*NOSUPERUSER[\s\S]*NOCREATEDB[\s\S]*NOCREATEROLE[\s\S]*NOREPLICATION[\s\S]*NOBYPASSRLS/,
    );
    assert.match(provision, /rolcanlogin/);
    assert.match(provision, /rolinherit/);
    assert.match(provision, /rolsuper/);
    assert.match(provision, /rolcreatedb/);
    assert.match(provision, /rolcreaterole/);
    assert.match(provision, /rolreplication/);
    assert.match(provision, /rolbypassrls/);
    assert.match(provision, /pg_catalog\.pg_auth_members/);
    assert.match(provision, /admin_option/);
    assert.match(provision, /pg_catalog\.aclexplode/);
    assert.match(provision, /pg_catalog\.pg_default_acl/);
    assert.match(provision, /pg_catalog\.pg_database/);
    assert.match(provision, /jsonb_array_elements_text/);
    assert.match(provision, /current_database\(\)/);
    assert.match(provision, /datistemplate/);
    assert.match(provision, /has_database_privilege/);
    assert.match(provision, /'CONNECT'/);
    assert.match(provision, /'TEMPORARY'/);
    assert.match(provision, /has_schema_privilege/);
    assert.match(provision, /has_table_privilege/);
    assert.match(provision, /has_sequence_privilege/);
    assert.match(provision, /has_function_privilege/);
    assert.match(provision, /acl\.grantee\s*=\s*0/);
    assert.match(provision, /unsafe PUBLIC function EXECUTE/i);
    assert.match(provision, /migration owner function defaults are unsafe/i);
    assert.match(provision, /brain_post_provision_exact/);
    assert.match(provision, /RAISE EXCEPTION/);
    assert.doesNotMatch(provision, /\\quit\s+\d+/);
    assert.match(
      provision,
      /GRANT loopos_brain_reader TO :"brain_login_role"/,
    );
    assert.doesNotMatch(provision, /PASSWORD|BRAIN_DATABASE_URL/i);
  });

  test("hardens existing and future migration-owner functions in one allowlisted database", () => {
    assert.match(harden, /\\set ON_ERROR_STOP on/);
    assert.match(harden, /:\{\?brain_allowed_databases\}/);
    assert.match(harden, /:\{\?brain_migration_owner_role\}/);
    assert.match(harden, /jsonb_array_elements_text/);
    assert.match(harden, /current_database\(\)/);
    assert.match(harden, /REVOKE ALL PRIVILEGES ON SCHEMA[\s\S]*FROM PUBLIC/i);
    assert.match(
      harden,
      /REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA[\s\S]*FROM PUBLIC/i,
    );
    assert.match(
      harden,
      /REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA[\s\S]*FROM PUBLIC/i,
    );
    assert.match(
      harden,
      /REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA[\s\S]*FROM PUBLIC/i,
    );
    assert.match(
      harden,
      /ALTER DEFAULT PRIVILEGES FOR ROLE[\s\S]*REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC/i,
    );
    assert.match(harden, /pg_catalog\.pg_default_acl/);
    assert.match(harden, /pg_catalog\.aclexplode/);
    assert.match(harden, /acl\.grantee\s*=\s*0/);
    assert.match(harden, /RAISE EXCEPTION/);
    assert.doesNotMatch(harden, /\b(?:CREATE|ALTER|DROP)\s+ROLE\b/i);
    assert.doesNotMatch(harden, /PASSWORD|BRAIN_DATABASE_URL/i);
  });

  test("deprovisions membership but lets DROP ROLE fail on cross-database dependencies", () => {
    assert.match(deprovision, /\\set ON_ERROR_STOP on/);
    assert.match(deprovision, /:\{\?brain_login_role\}/);
    assert.match(
      deprovision,
      /REVOKE loopos_brain_reader FROM :"brain_login_role"/,
    );
    assert.match(deprovision, /DROP ROLE loopos_brain_reader/);
    assert.match(deprovision, /dependenc/i);
    assert.match(deprovision, /RAISE EXCEPTION/);
    assert.doesNotMatch(deprovision, /\\quit\s+\d+/);
    assert.doesNotMatch(deprovision, /DROP OWNED|REASSIGN OWNED|CASCADE/i);
    assert.doesNotMatch(deprovision, /PASSWORD|BRAIN_DATABASE_URL/i);
  });

  test("requires fail-closed admission for every database created after provisioning", () => {
    assert.match(deployment, /ALLOW_CONNECTIONS=false/);
    assert.match(
      deployment,
      /REVOKE[\s\S]*CONNECT[\s\S]*TEMPORARY[\s\S]*FROM PUBLIC/i,
    );
    assert.match(deployment, /same JSON allowlist/i);
    assert.match(deployment, /rerun[\s\S]*provision-reader-role\.sql/i);
    assert.match(deployment, /only after[\s\S]*open/i);
    assert.match(deployment, /does not continuously monitor/i);
  });
});
