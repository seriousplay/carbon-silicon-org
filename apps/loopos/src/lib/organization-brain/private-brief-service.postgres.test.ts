import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, Pool } from "pg";

import { PrismaClient } from "@/generated/prisma/client";
import type { ActorContext } from "../authorization/actor-context-resolver";

type ServiceModule = typeof import("./private-brief-service");

const adminDatabaseUrl =
  process.env.M4_A2_TEST_ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
const migrationsRoot = fileURLToPath(
  new URL("../../../prisma/migrations/", import.meta.url),
);
const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    name: entry.name,
    sql: readFileSync(`${migrationsRoot}/${entry.name}/migration.sql`, "utf8"),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const require = createRequire(import.meta.url);
const originalNodePath = process.env.NODE_PATH;
const compiledModules = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../node_modules/next/dist/compiled",
);
const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let service: ServiceModule;

before(async () => {
  process.env.NODE_PATH = originalNodePath
    ? `${compiledModules}:${originalNodePath}`
    : compiledModules;
  moduleWithInitPaths._initPaths();
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  service = await import("./private-brief-service");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = originalNodePath;
  moduleWithInitPaths._initPaths();
});

const fixtureSql = `BEGIN;
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO "users" ("id", "email", "updatedAt") VALUES
  ('user-a', 'm4a2-a@example.invalid', TIMESTAMP '2026-07-15 00:00:00'),
  ('user-a2', 'm4a2-a2@example.invalid', TIMESTAMP '2026-07-15 00:00:00'),
  ('user-b', 'm4a2-b@example.invalid', TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "organizations" ("id", "name", "slug", "updatedAt") VALUES
  ('org-a', 'Org A', 'm4a2-org-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('org-b', 'Org B', 'm4a2-org-b', TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "memberships" ("id", "userId", "organizationId", "role") VALUES
  ('membership-a', 'user-a', 'org-a', 'ORG_MEMBER'),
  ('membership-a2', 'user-a2', 'org-a', 'ORG_MEMBER'),
  ('membership-b', 'user-b', 'org-b', 'ORG_MEMBER');

INSERT INTO "circles" (
  "id", "organizationId", "name", "number", "type", "purpose", "status",
  "parentId", "updatedAt"
) VALUES
  ('circle-a', 'org-a', 'Circle A', 'ONE', 'PRODUCTION', 'Main A', 'NORMAL', NULL, TIMESTAMP '2026-07-15 00:00:00'),
  ('circle-child-a', 'org-a', 'Child A', 'TWO', 'PRODUCTION', 'Child A', 'NORMAL', 'circle-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('circle-a2', 'org-a', 'Circle A2', 'THREE', 'PRODUCTION', 'Other A', 'NORMAL', 'circle-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('circle-b', 'org-b', 'Circle B', 'ONE', 'PRODUCTION', 'Main B', 'NORMAL', NULL, TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "people" (
  "id", "organizationId", "userId", "name", "homeCircleId", "updatedAt"
) VALUES
  ('person-a', 'org-a', 'user-a', 'Person A', 'circle-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('person-a2', 'org-a', 'user-a2', 'Person A2', 'circle-a2', TIMESTAMP '2026-07-15 00:00:00'),
  ('person-b', 'org-b', 'user-b', 'Person B', 'circle-b', TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "role_defs" (
  "id", "organizationId", "name", "purpose", "accountabilities", "category",
  "status", "circleId", "updatedAt"
) VALUES
  ('role-a', 'org-a', 'Role A', 'Own A', 'Accountable A', 'OPERATIONS', 'ACTIVE', 'circle-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('role-b', 'org-b', 'Role B', 'Own B', 'Accountable B', 'OPERATIONS', 'ACTIVE', 'circle-b', TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "meetings" (
  "id", "organizationId", "title", "type", "agenda", "notesRevision",
  "durationMin", "startedAt", "circleId", "createdAt"
) VALUES
  ('meeting-a', 'org-a', 'Tactical A', 'TACTICAL', '[]', 0, 30, TIMESTAMP '2026-07-14 12:00:00', 'circle-a', TIMESTAMP '2026-07-14 12:00:00'),
  ('meeting-not-participant-a', 'org-a', 'Hidden Tactical A', 'TACTICAL', '[]', 0, 30, TIMESTAMP '2026-07-14 12:30:00', 'circle-a', TIMESTAMP '2026-07-14 12:30:00'),
  ('meeting-b', 'org-b', 'Tactical B', 'TACTICAL', '[]', 0, 30, TIMESTAMP '2026-07-14 12:00:00', 'circle-b', TIMESTAMP '2026-07-14 12:00:00');

INSERT INTO "_MeetingToPerson" ("A", "B") VALUES
  ('meeting-a', 'person-a'),
  ('meeting-b', 'person-b');

INSERT INTO "tensions" (
  "id", "organizationId", "title", "description", "type", "source", "status",
  "createdAt", "updatedAt", "raiserId", "ownerId", "circleId", "roleId"
) VALUES
  ('tension-source-a', 'org-a', 'Source A', 'Meeting source', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 08:00:00', TIMESTAMP '2026-07-13 08:00:00', 'person-a', 'person-a', 'circle-a', NULL),
  ('tension-hidden-meeting-a', 'org-a', 'Hidden Meeting Source A', 'Hidden meeting source', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 08:30:00', TIMESTAMP '2026-07-13 08:30:00', 'person-a2', 'person-a2', 'circle-a', NULL),
  ('tension-project-approved-a', 'org-a', 'Approved Project Source A', 'Approved project source', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 08:40:00', TIMESTAMP '2026-07-13 08:40:00', 'person-a', 'person-a', 'circle-a', NULL),
  ('tension-action-approved-a', 'org-a', 'Approved Action Source A', 'Approved action source', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 08:50:00', TIMESTAMP '2026-07-13 08:50:00', 'person-a', 'person-a', 'circle-a', NULL),
  ('tension-repeat-a1', 'org-a', 'Repeated A', 'Repeated', 'PROBLEMATIC', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 09:00:00', TIMESTAMP '2026-07-13 09:00:00', 'person-a', 'person-a', 'circle-a', NULL),
  ('tension-repeat-a2', 'org-a', 'Repeated A', 'Repeated again', 'PROBLEMATIC', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 10:00:00', TIMESTAMP '2026-07-13 10:00:00', 'person-a', 'person-a', 'circle-a', NULL),
  ('tension-hidden-a1', 'org-a', 'Hidden Repeat', 'Hidden same-circle tension', 'PROBLEMATIC', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 10:10:00', TIMESTAMP '2026-07-13 10:10:00', 'person-a2', 'person-a2', 'circle-a', NULL),
  ('tension-hidden-a2', 'org-a', 'Hidden Repeat', 'Hidden same-circle tension again', 'PROBLEMATIC', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 10:20:00', TIMESTAMP '2026-07-13 10:20:00', 'person-a2', 'person-a2', 'circle-a', NULL),
  ('action-a', 'org-a', 'Action A', 'Actor action', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 11:00:00', TIMESTAMP '2026-07-13 11:00:00', 'person-a', 'person-a', NULL, NULL),
  ('action-unapproved-a', 'org-a', 'Unapproved Action A', 'Unapproved actor action', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 11:05:00', TIMESTAMP '2026-07-13 11:05:00', 'person-a', 'person-a', NULL, NULL),
  ('action-a2', 'org-a', 'Action A2', 'Other actor action', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 11:30:00', TIMESTAMP '2026-07-13 11:30:00', 'person-a2', 'person-a2', NULL, NULL),
  ('tension-b', 'org-b', 'Repeated B', 'Tenant B', 'PROBLEMATIC', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 09:00:00', TIMESTAMP '2026-07-13 09:00:00', 'person-b', 'person-b', 'circle-b', NULL);

INSERT INTO "tactical_outcome_proposals" (
  "id", "organizationId", "tensionId", "provenanceKind", "meetingId",
  "proposerId", "kind", "title", "circleId", "responsiblePersonId",
  "acceptanceCriteria", "status", "createdAt", "updatedAt"
) VALUES
  ('proposal-a', 'org-a', 'tension-source-a', 'ORDINARY_TENSION', 'meeting-a', 'person-a', 'ACTION', 'Unclosed A', 'circle-a', 'person-a', 'Close the action evidence', 'PROPOSED', TIMESTAMP '2026-07-14 13:00:00', TIMESTAMP '2026-07-14 13:00:00'),
  ('proposal-hidden-meeting-a', 'org-a', 'tension-hidden-meeting-a', 'ORDINARY_TENSION', 'meeting-not-participant-a', 'person-a2', 'ACTION', 'Hidden Unclosed A', 'circle-a', 'person-a2', 'Close hidden action evidence', 'PROPOSED', TIMESTAMP '2026-07-14 13:10:00', TIMESTAMP '2026-07-14 13:10:00');

INSERT INTO "projects" (
  "id", "organizationId", "name", "goal", "expectedResult", "status",
  "createdAt", "updatedAt", "circleId", "bearerId"
) VALUES
  ('project-a', 'org-a', 'Project A', 'Goal A', 'Result A', 'ACTIVE', TIMESTAMP '2026-07-13 12:00:00', TIMESTAMP '2026-07-13 12:00:00', 'circle-a', 'person-a'),
  ('project-unapproved-a', 'org-a', 'Unapproved Project A', 'Goal A', 'Result A', 'ACTIVE', TIMESTAMP '2026-07-13 12:10:00', TIMESTAMP '2026-07-13 12:10:00', 'circle-a', 'person-a'),
  ('project-a2', 'org-a', 'Project A2', 'Goal A2', 'Result A2', 'ACTIVE', TIMESTAMP '2026-07-13 12:30:00', TIMESTAMP '2026-07-13 12:30:00', 'circle-a2', 'person-a2');

INSERT INTO "tactical_outcome_proposals" (
  "id", "organizationId", "tensionId", "provenanceKind", "meetingId",
  "proposerId", "kind", "title", "expectedResult", "acceptanceCriteria",
  "circleId", "responsiblePersonId", "status", "recordedById",
  "recordedAt", "outcomeProjectId", "outcomeActionId", "createdAt", "updatedAt"
) VALUES
  ('proposal-project-approved-a', 'org-a', 'tension-project-approved-a', 'ORDINARY_TENSION', 'meeting-a', 'person-a', 'PROJECT', 'Project A', 'Result A', NULL, 'circle-a', 'person-a', 'APPROVED', 'person-a', TIMESTAMP '2026-07-14 14:00:00', 'project-a', NULL, TIMESTAMP '2026-07-14 13:30:00', TIMESTAMP '2026-07-14 14:00:00'),
  ('proposal-action-approved-a', 'org-a', 'tension-action-approved-a', 'ORDINARY_TENSION', 'meeting-a', 'person-a', 'ACTION', 'Action A', NULL, 'Action A accepted', 'circle-a', 'person-a', 'APPROVED', 'person-a', TIMESTAMP '2026-07-14 14:10:00', NULL, 'action-a', TIMESTAMP '2026-07-14 13:40:00', TIMESTAMP '2026-07-14 14:10:00');

INSERT INTO "goal_cycles" (
  "id", "organizationId", "name", "status", "startAt", "endAt",
  "checkInCadenceDays", "activatedAt", "createdAt", "updatedAt"
) VALUES
  ('cycle-a', 'org-a', 'Cycle A', 'PLANNED', TIMESTAMP '2026-07-01 00:00:00', TIMESTAMP '2026-09-30 00:00:00', 7, NULL, TIMESTAMP '2026-07-01 00:00:00', TIMESTAMP '2026-07-01 00:00:00'),
  ('cycle-b', 'org-b', 'Cycle B', 'PLANNED', TIMESTAMP '2026-07-01 00:00:00', TIMESTAMP '2026-09-30 00:00:00', 7, NULL, TIMESTAMP '2026-07-01 00:00:00', TIMESTAMP '2026-07-01 00:00:00');

UPDATE "goal_cycles"
SET "status" = 'ACTIVE',
    "activatedAt" = TIMESTAMP '2026-07-01 00:05:00',
    "updatedAt" = TIMESTAMP '2026-07-01 00:05:00'
WHERE "id" IN ('cycle-a', 'cycle-b');

INSERT INTO "goal_proposals" (
  "id", "organizationId", "cycleId", "circleId", "proposerId", "kind",
  "status", "currentRevision", "createdAt", "updatedAt"
) VALUES
  ('goal-proposal-a', 'org-a', 'cycle-a', 'circle-a', 'person-a', 'CREATE', 'DRAFT', 1, TIMESTAMP '2026-07-01 01:00:00', TIMESTAMP '2026-07-01 01:00:00'),
  ('goal-proposal-b', 'org-b', 'cycle-b', 'circle-b', 'person-b', 'CREATE', 'DRAFT', 1, TIMESTAMP '2026-07-01 01:00:00', TIMESTAMP '2026-07-01 01:00:00');

INSERT INTO "goal_proposal_revisions" (
  "organizationId", "proposalId", "revision", "title", "intendedOutcome",
  "ownerRoleId", "authoredById", "createdAt"
) VALUES
  ('org-a', 'goal-proposal-a', 1, 'Goal A', 'Outcome A', 'role-a', 'person-a', TIMESTAMP '2026-07-01 01:10:00'),
  ('org-b', 'goal-proposal-b', 1, 'Goal B', 'Outcome B', 'role-b', 'person-b', TIMESTAMP '2026-07-01 01:10:00');

INSERT INTO "goal_proposal_targets" (
  "id", "organizationId", "proposalId", "revision", "position", "label",
  "kind", "acceptanceCriteria", "createdAt"
) VALUES
  ('proposal-target-a', 'org-a', 'goal-proposal-a', 1, 1, 'Target A', 'MILESTONE', 'Target A accepted', TIMESTAMP '2026-07-01 01:20:00'),
  ('proposal-target-b', 'org-b', 'goal-proposal-b', 1, 1, 'Target B', 'MILESTONE', 'Target B accepted', TIMESTAMP '2026-07-01 01:20:00');

UPDATE "goal_proposals"
SET "status" = 'SUBMITTED',
    "submittedAt" = TIMESTAMP '2026-07-01 01:25:00',
    "updatedAt" = TIMESTAMP '2026-07-01 01:25:00'
WHERE "id" IN ('goal-proposal-a', 'goal-proposal-b');

UPDATE "goal_proposals"
SET "status" = 'ADOPTED',
    "terminalAt" = TIMESTAMP '2026-07-01 01:28:00',
    "updatedAt" = TIMESTAMP '2026-07-01 01:28:00'
WHERE "id" IN ('goal-proposal-a', 'goal-proposal-b');

INSERT INTO "goal_decisions" (
  "id", "organizationId", "proposalId", "revision", "outcome", "meetingId",
  "recorderId", "mutationKey", "decidedAt"
) VALUES
  ('goal-decision-a', 'org-a', 'goal-proposal-a', 1, 'ADOPTED', 'meeting-a', 'person-a', 'm4a2-goal-a', TIMESTAMP '2026-07-01 01:30:00'),
  ('goal-decision-b', 'org-b', 'goal-proposal-b', 1, 'ADOPTED', 'meeting-b', 'person-b', 'm4a2-goal-b', TIMESTAMP '2026-07-01 01:30:00');

INSERT INTO "goals" (
  "id", "organizationId", "cycleId", "circleId", "title", "intendedOutcome",
  "ownerRoleId", "status", "adoptedDecisionId", "createdAt"
) VALUES
  ('goal-a', 'org-a', 'cycle-a', 'circle-a', 'Goal A', 'Outcome A', 'role-a', 'ACTIVE', 'goal-decision-a', TIMESTAMP '2026-07-01 02:00:00'),
  ('goal-b', 'org-b', 'cycle-b', 'circle-b', 'Goal B', 'Outcome B', 'role-b', 'ACTIVE', 'goal-decision-b', TIMESTAMP '2026-07-01 02:00:00');

INSERT INTO "goal_targets" (
  "id", "organizationId", "goalId", "sourceProposalTargetId", "position",
  "label", "kind", "acceptanceCriteria", "createdAt"
) VALUES
  ('target-a', 'org-a', 'goal-a', 'proposal-target-a', 1, 'Target A', 'MILESTONE', 'Target A accepted', TIMESTAMP '2026-07-01 02:10:00'),
  ('target-b', 'org-b', 'goal-b', 'proposal-target-b', 1, 'Target B', 'MILESTONE', 'Target B accepted', TIMESTAMP '2026-07-01 02:10:00');

COMMIT;`;

test(
  "PostgreSQL M4-A2 private brief service keeps signals actor-private, tenant-scoped, and read-only",
  { skip: adminDatabaseUrl ? false : "M4_A2_TEST_ADMIN_DATABASE_URL or DATABASE_URL is not set" },
  async () => {
    assert.ok(adminDatabaseUrl);
    const suffix = `${process.pid}_${randomBytes(4).toString("hex")}`;
    const database = `loopos_m4a2_${suffix}`;
    const admin = new Client({ connectionString: adminDatabaseUrl });
    let databaseCreated = false;
    let readerRoleCreated = false;
    await admin.connect();
    try {
      const existingRole = await admin.query<{ exists: boolean }>(
        "SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'loopos_brain_reader') AS exists",
      );
      if (!existingRole.rows[0]?.exists) {
        await admin.query("CREATE ROLE loopos_brain_reader NOLOGIN NOINHERIT");
        readerRoleCreated = true;
      }
      await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${quotedIdentifier(database)}`);
      databaseCreated = true;

      const connectionString = databaseUrl(adminDatabaseUrl, database);
      const db = new Client({ connectionString });
      const pool = new Pool({ connectionString });
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) });
      try {
        await db.connect();
        for (const migration of migrations) await db.query(migration.sql);
        await db.query(fixtureSql);

        const beforeCounts = await objectCounts(db);
        const store = service.createPrismaPrivateBriefFactStore(prisma);
        const actorA = actor("org-a", "user-a", "person-a", "circle-a", ["role-a"]);
        const actorA2 = actor("org-a", "user-a2", "person-a2", "circle-a2", []);
        const actorB = actor("org-b", "user-b", "person-b", "circle-b", ["role-b"]);

        const briefA = await service.buildPrivateBriefForCurrentActor(
          { schemaVersion: 1, maxSignals: 20 },
          { resolveActor: async () => actorA, facts: store, now: () => new Date("2026-07-15T12:00:00.000Z") },
        );
        const briefA2 = await service.buildPrivateBriefForCurrentActor(
          { schemaVersion: 1, maxSignals: 20 },
          { resolveActor: async () => actorA2, facts: store, now: () => new Date("2026-07-15T12:00:00.000Z") },
        );
        const briefB = await service.buildPrivateBriefForCurrentActor(
          { schemaVersion: 1, maxSignals: 20 },
          { resolveActor: async () => actorB, facts: store, now: () => new Date("2026-07-15T12:00:00.000Z") },
        );

        assert.deepEqual(new Set(briefA.signals.map((signal) => signal.kind)), new Set([
          "MISSING_CHILD_GOAL",
          "MISSING_TARGET_EVIDENCE",
          "REPEATED_TENSION",
          "ROLE_WORK_MISMATCH",
          "STALE_GOAL_CHECK_IN",
          "UNRESOLVED_MEETING_OUTPUT",
        ]));
        assertNoSourceIds(briefA, [
          /org-b/i,
          /^goal-b$/,
          /^meeting-not-participant-a$/,
          /^tension-hidden-a1$/,
          /^tension-hidden-a2$/,
          /^project-unapproved-a$/,
          /^project-a2$/,
          /^action-unapproved-a$/,
          /^action-a2$/,
        ]);
        assertNoSourceIds(briefA2, [/org-b/i, /^goal-a$/, /^project-a$/, /^project-a2$/, /^action-a$/]);
        assertNoSourceIds(briefB, [/org-a/i, /^goal-a$/, /^project-a$/, /^action-a$/]);
        assert.equal(
          briefA.signals.some((signal) => signal.sources.some((source) => source.id === "project-a")),
          true,
        );
        assert.equal(
          briefA.signals.some((signal) => signal.sources.some((source) => source.id === "action-a")),
          true,
        );
        assert.deepEqual(await objectCounts(db), beforeCounts);
      } finally {
        await prisma.$disconnect();
        await pool.end();
        await db.end().catch(() => undefined);
      }
    } finally {
      if (databaseCreated) {
        await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
      }
      if (readerRoleCreated) {
        await admin.query("DROP ROLE IF EXISTS loopos_brain_reader");
      }
      await admin.end().catch(() => undefined);
    }
  },
);

function actor(
  organizationId: string,
  userId: string,
  personId: string,
  homeCircleId: string,
  assignedActiveRoleDefIds: readonly string[],
): ActorContext {
  return {
    organizationId,
    userId,
    personId,
    membershipRole: "ORG_MEMBER",
    homeCircleId,
    assignedActiveRoleDefIds,
    ledActiveCircleIds: [],
  };
}

function quotedIdentifier(value: string): string {
  assert.match(value, /^[a-z][a-z0-9_]+$/);
  return `"${value}"`;
}

function databaseUrl(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function objectCounts(client: Client): Promise<Record<string, number>> {
  const result = await client.query<Record<string, number>>(`SELECT
    (SELECT count(*)::integer FROM "goals") AS goals,
    (SELECT count(*)::integer FROM "goal_targets") AS "goalTargets",
    (SELECT count(*)::integer FROM "goal_check_ins") AS "goalCheckIns",
    (SELECT count(*)::integer FROM "meetings") AS meetings,
    (SELECT count(*)::integer FROM "tensions") AS tensions,
    (SELECT count(*)::integer FROM "projects") AS projects,
    (SELECT count(*)::integer FROM "brain_conversations") AS "brainConversations",
    (SELECT count(*)::integer FROM "brain_messages") AS "brainMessages",
    (SELECT count(*)::integer FROM "brain_command_operations") AS "brainCommandOperations"`);
  return result.rows[0] ?? {};
}

function assertNoSourceIds(brief: { signals: readonly { sources: readonly { id: string }[] }[] }, patterns: readonly RegExp[]): void {
  const sourceIds = brief.signals.flatMap((signal) => signal.sources.map((source) => source.id));
  for (const pattern of patterns) {
    assert.equal(sourceIds.some((id) => pattern.test(id)), false, `${pattern} leaked through ${sourceIds.join(",")}`);
  }
}
