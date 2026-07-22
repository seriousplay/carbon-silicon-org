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
import type { MemoryCandidateStore } from "./memory-candidate-service";

type ServiceModule = typeof import("./memory-candidate-service");

const adminDatabaseUrl =
  process.env.M4_B2_TEST_ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
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
  service = await import("./memory-candidate-service");
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
  ('user-owner', 'm4b2-owner@example.invalid', TIMESTAMP '2026-07-15 00:00:00'),
  ('user-reviewer', 'm4b2-reviewer@example.invalid', TIMESTAMP '2026-07-15 00:00:00'),
  ('user-outsider', 'm4b2-outsider@example.invalid', TIMESTAMP '2026-07-15 00:00:00'),
  ('user-b', 'm4b2-b@example.invalid', TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "organizations" ("id", "name", "slug", "updatedAt") VALUES
  ('org-a', 'Org A', 'm4b2-org-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('org-b', 'Org B', 'm4b2-org-b', TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "memberships" ("id", "userId", "organizationId", "role") VALUES
  ('membership-owner', 'user-owner', 'org-a', 'ORG_MEMBER'),
  ('membership-reviewer', 'user-reviewer', 'org-a', 'ORG_MEMBER'),
  ('membership-outsider', 'user-outsider', 'org-a', 'ORG_MEMBER'),
  ('membership-b', 'user-b', 'org-b', 'ORG_MEMBER');

INSERT INTO "circles" (
  "id", "organizationId", "name", "number", "type", "purpose", "status",
  "parentId", "leadPersonId", "updatedAt"
) VALUES
  ('circle-a', 'org-a', 'Circle A', 'ONE', 'PRODUCTION', 'Main A', 'NORMAL', NULL, NULL, TIMESTAMP '2026-07-15 00:00:00'),
  ('circle-b', 'org-b', 'Circle B', 'ONE', 'PRODUCTION', 'Main B', 'NORMAL', NULL, NULL, TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "people" (
  "id", "organizationId", "userId", "name", "homeCircleId", "updatedAt"
) VALUES
  ('person-owner', 'org-a', 'user-owner', 'Owner', 'circle-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('person-reviewer', 'org-a', 'user-reviewer', 'Reviewer', 'circle-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('person-outsider', 'org-a', 'user-outsider', 'Outsider', 'circle-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('person-b', 'org-b', 'user-b', 'Person B', 'circle-b', TIMESTAMP '2026-07-15 00:00:00');

UPDATE "circles" SET "leadPersonId" = 'person-reviewer' WHERE "id" = 'circle-a';
UPDATE "circles" SET "leadPersonId" = 'person-b' WHERE "id" = 'circle-b';

INSERT INTO "role_defs" (
  "id", "organizationId", "name", "purpose", "accountabilities", "category",
  "status", "circleId", "updatedAt"
) VALUES
  ('role-a', 'org-a', 'Role A', 'Own A', 'Accountable A', 'OPERATIONS', 'ACTIVE', 'circle-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('role-b', 'org-b', 'Role B', 'Own B', 'Accountable B', 'OPERATIONS', 'ACTIVE', 'circle-b', TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "_PersonRoles" ("A", "B") VALUES
  ('person-owner', 'role-a'),
  ('person-reviewer', 'role-a');

INSERT INTO "meetings" (
  "id", "organizationId", "title", "type", "agenda", "notesRevision",
  "durationMin", "startedAt", "circleId", "createdAt"
) VALUES
  ('meeting-a', 'org-a', 'Strategic A', 'STRATEGY', '[]', 0, 30, TIMESTAMP '2026-07-14 12:00:00', 'circle-a', TIMESTAMP '2026-07-14 12:00:00'),
  ('meeting-b', 'org-b', 'Strategic B', 'STRATEGY', '[]', 0, 30, TIMESTAMP '2026-07-14 12:00:00', 'circle-b', TIMESTAMP '2026-07-14 12:00:00');

INSERT INTO "_MeetingToPerson" ("A", "B") VALUES
  ('meeting-a', 'person-owner'),
  ('meeting-a', 'person-reviewer'),
  ('meeting-b', 'person-b');

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
  "status", "currentRevision", "submittedAt", "terminalAt", "createdAt", "updatedAt"
) VALUES
  ('proposal-a', 'org-a', 'cycle-a', 'circle-a', 'person-owner', 'CREATE', 'DRAFT', 1, NULL, NULL, TIMESTAMP '2026-07-01 00:50:00', TIMESTAMP '2026-07-01 00:50:00'),
  ('proposal-b', 'org-b', 'cycle-b', 'circle-b', 'person-b', 'CREATE', 'DRAFT', 1, NULL, NULL, TIMESTAMP '2026-07-01 00:50:00', TIMESTAMP '2026-07-01 00:50:00');

INSERT INTO "goal_proposal_revisions" (
  "organizationId", "proposalId", "revision", "title", "intendedOutcome",
  "ownerRoleId", "authoredById", "createdAt"
) VALUES
  ('org-a', 'proposal-a', 1, 'Goal A', 'Outcome A', 'role-a', 'person-owner', TIMESTAMP '2026-07-01 00:55:00'),
  ('org-b', 'proposal-b', 1, 'Goal B', 'Outcome B', 'role-b', 'person-b', TIMESTAMP '2026-07-01 00:55:00');

INSERT INTO "goal_proposal_targets" (
  "id", "organizationId", "proposalId", "revision", "position", "label",
  "kind", "acceptanceCriteria", "createdAt"
) VALUES
  ('target-a', 'org-a', 'proposal-a', 1, 1, 'Target A', 'MILESTONE', 'Target A accepted', TIMESTAMP '2026-07-01 00:56:00'),
  ('target-b', 'org-b', 'proposal-b', 1, 1, 'Target B', 'MILESTONE', 'Target B accepted', TIMESTAMP '2026-07-01 00:56:00');

UPDATE "goal_proposals"
SET "status" = 'SUBMITTED',
    "submittedAt" = TIMESTAMP '2026-07-01 01:00:00',
    "updatedAt" = TIMESTAMP '2026-07-01 01:00:00'
WHERE "id" IN ('proposal-a', 'proposal-b');

UPDATE "goal_proposals"
SET "status" = 'ADOPTED',
    "terminalAt" = TIMESTAMP '2026-07-01 01:10:00',
    "updatedAt" = TIMESTAMP '2026-07-01 01:10:00'
WHERE "id" IN ('proposal-a', 'proposal-b');

INSERT INTO "goal_decisions" (
  "id", "organizationId", "proposalId", "revision", "outcome", "meetingId",
  "recorderId", "mutationKey", "decidedAt"
) VALUES
  ('decision-a', 'org-a', 'proposal-a', 1, 'ADOPTED', 'meeting-a', 'person-reviewer', 'm4b2-a', TIMESTAMP '2026-07-01 01:10:00'),
  ('decision-b', 'org-b', 'proposal-b', 1, 'ADOPTED', 'meeting-b', 'person-b', 'm4b2-b', TIMESTAMP '2026-07-01 01:10:00');

INSERT INTO "goals" (
  "id", "organizationId", "cycleId", "circleId", "title", "intendedOutcome",
  "ownerRoleId", "status", "adoptedDecisionId", "createdAt"
) VALUES
  ('goal-a', 'org-a', 'cycle-a', 'circle-a', 'Goal A', 'Outcome A', 'role-a', 'ACTIVE', 'decision-a', TIMESTAMP '2026-07-01 01:20:00'),
  ('goal-b', 'org-b', 'cycle-b', 'circle-b', 'Goal B', 'Outcome B', 'role-b', 'ACTIVE', 'decision-b', TIMESTAMP '2026-07-01 01:20:00');

INSERT INTO "goal_targets" (
  "id", "organizationId", "goalId", "sourceProposalTargetId", "position",
  "label", "kind", "acceptanceCriteria", "createdAt"
) VALUES
  ('canonical-target-a', 'org-a', 'goal-a', 'target-a', 1, 'Target A', 'MILESTONE', 'Target A accepted', TIMESTAMP '2026-07-01 01:21:00'),
  ('canonical-target-b', 'org-b', 'goal-b', 'target-b', 1, 'Target B', 'MILESTONE', 'Target B accepted', TIMESTAMP '2026-07-01 01:21:00');

COMMIT;`;

test(
  "PostgreSQL M4-B2 memory candidate service keeps drafts private, route-scoped, tenant-scoped, and audited",
  { skip: adminDatabaseUrl ? false : "M4_B2_TEST_ADMIN_DATABASE_URL or DATABASE_URL is not set" },
  async () => {
    assert.ok(adminDatabaseUrl);
    const suffix = `${process.pid}_${randomBytes(4).toString("hex")}`;
    const database = `loopos_m4b2_${suffix}`;
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

        const store = service.createPrismaMemoryCandidateStore(prisma);
        const owner = actor("org-a", "user-owner", "person-owner", ["role-a"], []);
        const reviewer = actor("org-a", "user-reviewer", "person-reviewer", ["role-a"], ["circle-a"]);
        const outsider = actor("org-a", "user-outsider", "person-outsider", [], []);
        const tenantB = actor("org-b", "user-b", "person-b", ["role-b"], ["circle-b"]);
        const draft = await service.createMemoryCandidateDraftForActor(
          {
            schemaVersion: 1,
            claim: "Goal A evidence is stale.",
            rationale: "Goal A needs source-authority review.",
            sourceRefs: [{
              type: "goal",
              id: "goal-a",
              label: "Goal A",
              applicationUrl: "/app/goals?goal=goal-a",
              observedAt: "2026-07-15T12:00:00.000Z",
            }],
          },
          deps(owner, store, "candidate-a"),
        );

        assert.equal(draft.status, "DRAFT");
        assert.deepEqual(await service.listMemoryCandidatesForActor({ schemaVersion: 1 }, deps(reviewer, store)), []);
        assert.deepEqual(await service.listMemoryCandidatesForActor({ schemaVersion: 1 }, deps(tenantB, store)), []);

        const submitted = await service.submitMemoryCandidateForActor(
          { schemaVersion: 1, candidateId: draft.id, reason: "Please review." },
          deps(owner, store),
        );
        assert.equal(submitted.status, "SUBMITTED");
        assert.equal((await service.listMemoryCandidatesForActor({ schemaVersion: 1 }, deps(reviewer, store))).length, 1);
        assert.deepEqual(await service.listMemoryCandidatesForActor({ schemaVersion: 1 }, deps(outsider, store)), []);
        assert.deepEqual(await service.listMemoryCandidatesForActor({ schemaVersion: 1 }, deps(tenantB, store)), []);

        const confirmed = await service.confirmMemoryCandidateForActor(
          {
            schemaVersion: 1,
            candidateId: draft.id,
            validFrom: "2026-07-16T00:00:00.000Z",
            reason: "Confirmed by Goal source authority.",
          },
          deps(reviewer, store),
        );
        assert.equal(confirmed.status, "CONFIRMED");
        assert.equal(confirmed.confirmedBy?.id, "goal:person-reviewer");
        assert.deepEqual(confirmed.auditTrail.map((event) => event.type), ["CREATED", "SUBMITTED", "CONFIRMED"]);

        await assert.rejects(
          () => db.query(`UPDATE "memory_candidates" SET "claim" = 'mutated' WHERE "id" = 'candidate-a'`),
          /closed memory candidate rows are immutable/,
        );
        await assert.rejects(
          () => db.query(`UPDATE "memory_candidates" SET "updatedAt" = TIMESTAMP '2026-07-17 00:00:00' WHERE "id" = 'candidate-a'`),
          /closed memory candidate rows are immutable/,
        );
        await assert.rejects(
          () => db.query(`UPDATE "memory_candidate_audit_events" SET "reason" = 'mutated' WHERE "candidateId" = 'candidate-a'`),
          /memory candidate audit event rows are immutable/,
        );
        await assert.rejects(
          () => db.query(`DELETE FROM "memory_candidate_audit_events" WHERE "candidateId" = 'candidate-a'`),
          /memory candidate audit event rows are immutable/,
        );
        await assert.rejects(
          () => service.createMemoryCandidateDraftForActor(
            {
              schemaVersion: 1,
              claim: "Foreign Goal",
              rationale: "Should not be visible.",
              sourceRefs: [{
                type: "goal",
                id: "goal-b",
                label: "Goal B",
                applicationUrl: "/app/goals?goal=goal-b",
                observedAt: "2026-07-15T12:00:00.000Z",
              }],
            },
            deps(owner, store, "candidate-foreign"),
          ),
          (error) => error instanceof service.MemoryCandidateServiceError && error.code === "NOT_AVAILABLE",
        );

        const counts = await db.query<{ candidates: string; events: string }>(
          `SELECT
            (SELECT count(*) FROM "memory_candidates")::text AS candidates,
            (SELECT count(*) FROM "memory_candidate_audit_events")::text AS events`,
        );
        assert.deepEqual(counts.rows[0], { candidates: "1", events: "3" });
      } finally {
        await prisma.$disconnect().catch(() => undefined);
        await pool.end().catch(() => undefined);
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

function deps(actorContext: ActorContext, store: MemoryCandidateStore, id = "candidate-a") {
  return {
    resolveActor: async () => actorContext,
    store,
    now: () => new Date("2026-07-15T12:00:00.000Z"),
    createId: () => id,
  };
}

function actor(
  organizationId: string,
  userId: string,
  personId: string,
  assignedActiveRoleDefIds: readonly string[],
  ledActiveCircleIds: readonly string[],
): ActorContext {
  return {
    organizationId,
    userId,
    personId,
    membershipRole: "ORG_MEMBER",
    homeCircleId: organizationId === "org-a" ? "circle-a" : "circle-b",
    assignedActiveRoleDefIds,
    ledActiveCircleIds,
  };
}

function quotedIdentifier(value: string): string {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function databaseUrl(connectionString: string, database: string): string {
  const url = new URL(connectionString);
  url.pathname = `/${database}`;
  return url.toString();
}
