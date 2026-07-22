import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PrismaPg } from "@prisma/adapter-pg";
import { Client, Pool } from "pg";
import { test } from "node:test";

import { PrismaClient } from "@/generated/prisma/client";
import {
  hashBrainCommandBinding,
  type BrainCommandSourceBinding,
} from "./command-registry";
import {
  confirmGoalCommandPreview,
  createPrismaBrainGoalCommandDependencies,
  type BrainGoalCommandActor,
} from "./goal-command-handler";
import {
  confirmBrainCommandPreviewForActor,
  listBrainCommandPreviewsForActor,
} from "./command-preview-core";

const adminDatabaseUrl = process.env.M3_D1_TEST_ADMIN_DATABASE_URL;
const m3D2AdminDatabaseUrl = process.env.M3_D2_TEST_ADMIN_DATABASE_URL;
const m3D3AdminDatabaseUrl = process.env.M3_D3_TEST_ADMIN_DATABASE_URL;
const migrationsRoot = fileURLToPath(
  new URL("../../../prisma/migrations/", import.meta.url),
);

test(
  "PostgreSQL 14 M3-D3 command handler updates meeting notes with replay and stale protection",
  { skip: m3D3AdminDatabaseUrl ? false : "M3_D3_TEST_ADMIN_DATABASE_URL is not set" },
  async () => {
    assert.ok(m3D3AdminDatabaseUrl);
    assert.equal(migrations.length, 25);
    const suffix = `${process.pid}_${randomBytes(4).toString("hex")}`;
    const database = `loopos_m3d3_${suffix}`;
    const admin = new Client({ connectionString: m3D3AdminDatabaseUrl });
    let databaseCreated = false;
    let roleCreated = false;
    await admin.connect();
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${quotedIdentifier(database)}`);
      databaseCreated = true;
      await admin.query("DROP ROLE IF EXISTS loopos_brain_reader");
      await admin.query("CREATE ROLE loopos_brain_reader NOLOGIN NOINHERIT");
      roleCreated = true;

      const databaseUrl = new URL(m3D3AdminDatabaseUrl);
      databaseUrl.pathname = `/${database}`;
      const connectionString = databaseUrl.toString();
      const db = new Client({ connectionString });
      const pool = new Pool({ connectionString });
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) });
      try {
        await db.connect();
        for (const migration of migrations) await db.query(migration.sql);
        await seedFixture(db);
        await db.query(`INSERT INTO "meetings" (
            "id", "organizationId", "title", "type", "agenda", "notes", "notesRevision", "durationMin", "startedAt", "circleId", "createdAt", "endedAt"
          ) VALUES (
            'meeting-notes', 'org-a', 'Notes A', 'TACTICAL', '[]', 'Initial notes', 0, 30,
            TIMESTAMP '2026-07-15 12:00:00', 'circle-a', TIMESTAMP '2026-07-15 12:00:00', NULL
          ), (
            'meeting-no-participant', 'org-a', 'No Participant', 'TACTICAL', '[]', 'Closed to actor', 0, 30,
            TIMESTAMP '2026-07-15 12:05:00', 'circle-a', TIMESTAMP '2026-07-15 12:05:00', NULL
          ), (
            'meeting-ended', 'org-a', 'Ended Notes', 'TACTICAL', '[]', 'Ended notes', 0, 30,
            TIMESTAMP '2026-07-15 12:10:00', 'circle-a', TIMESTAMP '2026-07-15 12:10:00', TIMESTAMP '2026-07-15 12:30:00'
          )`);
        await db.query(`INSERT INTO "_MeetingToPerson" ("A", "B") VALUES ('meeting-notes', 'person-a'), ('meeting-ended', 'person-a')`);

        const dependencies = createPrismaBrainGoalCommandDependencies(
          prisma,
          { validate: async () => ({ ok: true as const }) },
        );
        const notesPayload = {
          command: "meeting_notes.update",
          meetingId: "meeting-notes",
          expectedNotesRevision: 0,
          notes: "Brain confirmed notes",
        } as const;
        const notesBindings = [
          { objectType: "meeting", objectId: "meeting-notes", sourceVersionAt: "notesRevision:0", revision: 0 },
        ] as const satisfies readonly BrainCommandSourceBinding[];
        await insertCommandPreview(db, "preview-notes", {
          commandName: "meeting_notes.update",
          serverPayload: notesPayload,
          sourceBindings: notesBindings,
        });

        const ownerPreviews = await listBrainCommandPreviewsForActor(
          { conversationId: "conversation-a", limit: 10 },
          actor,
          prisma,
        );
        assert.equal(ownerPreviews.previews.length, 1);
        assert.equal(ownerPreviews.previews[0]?.id, "preview-notes");
        assert.equal(ownerPreviews.previews[0]?.status, "PREVIEWED");
        assert.equal(ownerPreviews.previews[0]?.commandName, "meeting_notes.update");
        assert.doesNotMatch(JSON.stringify(ownerPreviews), /serverPayload|sourceBindings|payloadHash|sourceBindingHash/);
        const tenantPreviews = await listBrainCommandPreviewsForActor(
          { conversationId: "conversation-a", limit: 10 },
          { organizationId: "org-b", userId: "user-b", personId: "person-b" },
          prisma,
        );
        assert.deepEqual(tenantPreviews.previews, []);

        const notesOutput = await confirmBrainCommandPreviewForActor({
          previewId: "preview-notes",
          mutationKey: "mutation-notes",
        }, actor, prisma);
        const notesResult = notesOutput.confirmation;
        assert.equal(notesOutput.schemaVersion, 1);
        assert.equal(notesResult.ok, true, JSON.stringify(notesResult));
        const terminalPreviews = await listBrainCommandPreviewsForActor(
          { conversationId: "conversation-a", limit: 10 },
          actor,
          prisma,
        );
        assert.equal(terminalPreviews.previews[0]?.status, "SUCCEEDED");
        assert.equal(terminalPreviews.previews[0]?.terminalCode, "SUCCEEDED");
        assert.equal(terminalPreviews.previews[0]?.terminalResult && typeof terminalPreviews.previews[0].terminalResult, "object");
        const replayOutput = await confirmBrainCommandPreviewForActor({
          previewId: "preview-notes",
          mutationKey: "mutation-notes",
        }, actor, prisma);
        assert.deepEqual(replayOutput.confirmation, notesResult);
        assert.deepEqual(await db.query<{ notes: string | null; notesRevision: number }>(
          `SELECT "notes", "notesRevision" FROM "meetings" WHERE "id" = 'meeting-notes' AND "organizationId" = 'org-a'`,
        ).then((result) => result.rows), [{ notes: "Brain confirmed notes", notesRevision: 1 }]);

        const notesHandlerReplay = await confirmGoalCommandPreview({
          previewId: "preview-notes",
          mutationKey: "mutation-notes",
          actor,
        }, dependencies);
        assert.deepEqual(notesHandlerReplay, notesResult);
        assert.deepEqual(await db.query<{ notes: string | null; notesRevision: number }>(
          `SELECT "notes", "notesRevision" FROM "meetings" WHERE "id" = 'meeting-notes' AND "organizationId" = 'org-a'`,
        ).then((result) => result.rows), [{ notes: "Brain confirmed notes", notesRevision: 1 }]);

        await insertCommandPreview(db, "preview-stale-notes", {
          commandName: "meeting_notes.update",
          serverPayload: { ...notesPayload, notes: "Stale write" },
          sourceBindings: notesBindings,
        });
        const stale = await confirmGoalCommandPreview({
          previewId: "preview-stale-notes",
          mutationKey: "mutation-stale-notes",
          actor,
        }, dependencies);
        assert.equal(stale.ok, false);
        if (!stale.ok) assert.equal(stale.error.code, "STALE_PREVIEW");
        assert.deepEqual(await db.query<{ notes: string | null; notesRevision: number }>(
          `SELECT "notes", "notesRevision" FROM "meetings" WHERE "id" = 'meeting-notes' AND "organizationId" = 'org-a'`,
        ).then((result) => result.rows), [{ notes: "Brain confirmed notes", notesRevision: 1 }]);

        await insertCommandPreview(db, "preview-no-participant", {
          commandName: "meeting_notes.update",
          serverPayload: { ...notesPayload, meetingId: "meeting-no-participant" },
          sourceBindings: [
            { objectType: "meeting", objectId: "meeting-no-participant", sourceVersionAt: "notesRevision:0", revision: 0 },
          ] as const satisfies readonly BrainCommandSourceBinding[],
        });
        const noParticipant = await confirmGoalCommandPreview({
          previewId: "preview-no-participant",
          mutationKey: "mutation-no-participant",
          actor,
        }, dependencies);
        assert.equal(noParticipant.ok, false);
        if (!noParticipant.ok) assert.equal(noParticipant.error.code, "ACCESS_DENIED");

        await insertCommandPreview(db, "preview-ended", {
          commandName: "meeting_notes.update",
          serverPayload: { ...notesPayload, meetingId: "meeting-ended" },
          sourceBindings: [
            { objectType: "meeting", objectId: "meeting-ended", sourceVersionAt: "notesRevision:0", revision: 0 },
          ] as const satisfies readonly BrainCommandSourceBinding[],
        });
        const ended = await confirmGoalCommandPreview({
          previewId: "preview-ended",
          mutationKey: "mutation-ended",
          actor,
        }, dependencies);
        assert.equal(ended.ok, false);
        if (!ended.ok) assert.equal(ended.error.code, "INVALID_STATE");

        await insertCommandPreview(db, "preview-notes-tenant-b", {
          organizationId: "org-b",
          ownerUserId: "user-b",
          actorId: "person-b",
          conversationId: "conversation-b",
          userMessageId: "message-b",
          commandName: "meeting_notes.update",
          serverPayload: { ...notesPayload, meetingId: "meeting-b" },
          sourceBindings: [
            { objectType: "meeting", objectId: "meeting-b", sourceVersionAt: "notesRevision:0", revision: 0 },
          ] as const satisfies readonly BrainCommandSourceBinding[],
        });
        const tenantDenied = await confirmGoalCommandPreview({
          previewId: "preview-notes-tenant-b",
          mutationKey: "mutation-notes-tenant-b",
          actor,
        }, dependencies);
        assert.equal(tenantDenied.ok, false);
        if (!tenantDenied.ok) assert.equal(tenantDenied.error.code, "NOT_AVAILABLE");
        assert.deepEqual(await terminal(db, "preview-notes-tenant-b"), {
          status: "PREVIEWED",
          mutationKey: null,
          terminalCode: null,
          confirmedAtNull: true,
        });
      } finally {
        await prisma.$disconnect();
        await pool.end();
        await db.end();
      }
    } finally {
      if (databaseCreated) {
        await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
      }
      if (roleCreated) {
        await admin.query("DROP ROLE IF EXISTS loopos_brain_reader");
      }
      const cleanup = await admin.query<{ databases: number }>(
        `SELECT count(*)::integer AS databases FROM pg_catalog.pg_database WHERE datname = $1`,
        [database],
      );
      assert.deepEqual(cleanup.rows, [{ databases: 0 }]);
      const roleCleanup = await admin.query<{ roles: number }>(
        `SELECT count(*)::integer AS roles FROM pg_catalog.pg_roles WHERE rolname = 'loopos_brain_reader'`,
      );
      assert.deepEqual(roleCleanup.rows, [{ roles: 0 }]);
      await admin.end();
    }
  },
);

test(
  "PostgreSQL 14 M3-D2 command handler raises Tensions and submits tactical proposals without outcome bypass",
  { skip: m3D2AdminDatabaseUrl ? false : "M3_D2_TEST_ADMIN_DATABASE_URL is not set" },
  async () => {
    assert.ok(m3D2AdminDatabaseUrl);
    assert.equal(migrations.length, 25);
    const suffix = `${process.pid}_${randomBytes(4).toString("hex")}`;
    const database = `loopos_m3d2_${suffix}`;
    const admin = new Client({ connectionString: m3D2AdminDatabaseUrl });
    let databaseCreated = false;
    let roleCreated = false;
    await admin.connect();
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${quotedIdentifier(database)}`);
      databaseCreated = true;
      await admin.query("DROP ROLE IF EXISTS loopos_brain_reader");
      await admin.query("CREATE ROLE loopos_brain_reader NOLOGIN NOINHERIT");
      roleCreated = true;

      const databaseUrl = new URL(m3D2AdminDatabaseUrl);
      databaseUrl.pathname = `/${database}`;
      const connectionString = databaseUrl.toString();
      const db = new Client({ connectionString });
      const pool = new Pool({ connectionString });
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) });
      try {
        await db.connect();
        for (const migration of migrations) await db.query(migration.sql);
        await seedFixture(db);
        await db.query(`INSERT INTO "meetings" (
            "id", "organizationId", "title", "type", "agenda", "durationMin", "startedAt", "circleId", "createdAt"
          ) VALUES (
            'meeting-a', 'org-a', 'Tactical A', 'TACTICAL', '[]', 30,
            TIMESTAMP '2026-07-15 12:00:00', 'circle-a', TIMESTAMP '2026-07-15 12:00:00'
          )`);
        await db.query(`INSERT INTO "_MeetingToPerson" ("A", "B") VALUES ('meeting-a', 'person-a')`);

        const dependencies = createPrismaBrainGoalCommandDependencies(
          prisma,
          { validate: async () => ({ ok: true as const }) },
        );

        const tensionPayload = {
          command: "tension.raise",
          title: "Brain-routed tension",
          description: "A confirmed Brain command should raise one tension",
          type: "PROBLEMATIC",
          circleIds: ["circle-a"],
          handlingMode: "TACTICAL",
          routeCircleId: "circle-a",
        } as const;
        const tensionBindings = [
          { objectType: "circle", objectId: "circle-a", sourceVersionAt: "active:true" },
        ] as const satisfies readonly BrainCommandSourceBinding[];
        await insertCommandPreview(db, "preview-tension", {
          commandName: "tension.raise",
          serverPayload: tensionPayload,
          sourceBindings: tensionBindings,
        });
        const tensionResult = await confirmGoalCommandPreview({
          previewId: "preview-tension",
          mutationKey: "mutation-tension",
          actor,
        }, dependencies);
        assert.equal(tensionResult.ok, true, JSON.stringify(tensionResult));
        assert.deepEqual(await db.query<{ count: number }>(
          `SELECT count(*)::integer AS count FROM "tensions"
           WHERE "organizationId" = 'org-a'
             AND "raiserId" = 'person-a'
             AND "source" = 'BOT'
             AND "handlingMode" = 'TACTICAL'
             AND "status" = 'OPEN'`,
        ).then((result) => result.rows), [{ count: 1 }]);
        assert.deepEqual(await confirmGoalCommandPreview({
          previewId: "preview-tension",
          mutationKey: "mutation-tension",
          actor,
        }, dependencies), tensionResult);

        await db.query(`INSERT INTO "tensions" (
            "id", "organizationId", "title", "description", "type", "source", "status", "handlingMode", "raiserId", "createdAt", "updatedAt"
          ) VALUES (
            'tension-submit', 'org-a', 'Submit this proposal', 'Needs a tactical proposal',
            'PROBLEMATIC', 'FORM', 'OPEN', 'TACTICAL', 'person-a',
            TIMESTAMP '2026-07-15 12:05:00', TIMESTAMP '2026-07-15 12:05:00'
          )`);
        const tacticalPayload = {
          command: "tactical_outcome.submit_proposal",
          tensionId: "tension-submit",
          meetingId: "meeting-a",
          expectedRevision: 0,
          kind: "PROJECT",
          title: "Clarify tactical route",
          description: "The route is clear and adopted by meeting review",
          responsibility: "Person A owns the proposed project",
          circleId: "circle-a",
          responsiblePersonId: "person-a",
        } as const;
        const tacticalBindings = [
          { objectType: "tension", objectId: "tension-submit", sourceVersionAt: "revision:0", revision: 0, status: "OPEN", meeting: "meeting-a", route: "TACTICAL" },
          { objectType: "meeting", objectId: "meeting-a", sourceVersionAt: "ended:false" },
          { objectType: "circle", objectId: "circle-a", sourceVersionAt: "active:true" },
        ] as const satisfies readonly BrainCommandSourceBinding[];
        await insertCommandPreview(db, "preview-tactical", {
          commandName: "tactical_outcome.submit_proposal",
          serverPayload: tacticalPayload,
          sourceBindings: tacticalBindings,
        });
        const tacticalResult = await confirmGoalCommandPreview({
          previewId: "preview-tactical",
          mutationKey: "mutation-tactical",
          actor,
        }, dependencies);
        assert.equal(tacticalResult.ok, true, JSON.stringify(tacticalResult));
        assert.deepEqual(await db.query<{ count: number }>(
          `SELECT count(*)::integer AS count FROM "tactical_outcome_proposals"
           WHERE "organizationId" = 'org-a'
             AND "tensionId" = 'tension-submit'
             AND "meetingId" = 'meeting-a'
             AND "proposerId" = 'person-a'
             AND "status" = 'PROPOSED'
             AND "lastMutationKey" = 'mutation-tactical'`,
        ).then((result) => result.rows), [{ count: 1 }]);
        assert.deepEqual(await db.query<{ projectCount: number; actionCount: number; tensionStatus: string }>(
          `SELECT
             (SELECT count(*)::integer FROM "projects" WHERE "organizationId" = 'org-a') AS "projectCount",
             (SELECT count(*)::integer FROM "tensions" WHERE "organizationId" = 'org-a' AND "id" = 'tension-submit' AND "status" = 'ASSIGNED') AS "actionCount",
             (SELECT "status" FROM "tensions" WHERE "id" = 'tension-submit' AND "organizationId" = 'org-a') AS "tensionStatus"`,
        ).then((result) => result.rows), [{ projectCount: 0, actionCount: 0, tensionStatus: "OPEN" }]);
        assert.deepEqual(await confirmGoalCommandPreview({
          previewId: "preview-tactical",
          mutationKey: "mutation-tactical",
          actor,
        }, dependencies), tacticalResult);

        await insertCommandPreview(db, "preview-tenant-b", {
          organizationId: "org-b",
          ownerUserId: "user-b",
          actorId: "person-b",
          conversationId: "conversation-b",
          userMessageId: "message-b",
          commandName: "tension.raise",
          serverPayload: { ...tensionPayload, circleIds: ["circle-b"], routeCircleId: "circle-b" },
          sourceBindings: [
            { objectType: "circle", objectId: "circle-b", sourceVersionAt: "active:true" },
          ] as const satisfies readonly BrainCommandSourceBinding[],
        });
        const tenantDenied = await confirmGoalCommandPreview({
          previewId: "preview-tenant-b",
          mutationKey: "tenant-b-key",
          actor,
        }, dependencies);
        assert.equal(tenantDenied.ok, false);
        if (!tenantDenied.ok) assert.equal(tenantDenied.error.code, "NOT_AVAILABLE");
        assert.deepEqual(await terminal(db, "preview-tenant-b"), {
          status: "PREVIEWED",
          mutationKey: null,
          terminalCode: null,
          confirmedAtNull: true,
        });
      } finally {
        await prisma.$disconnect();
        await pool.end();
        await db.end();
      }
    } finally {
      if (databaseCreated) {
        await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
      }
      if (roleCreated) {
        await admin.query("DROP ROLE IF EXISTS loopos_brain_reader");
      }
      const cleanup = await admin.query<{ databases: number }>(
        `SELECT count(*)::integer AS databases FROM pg_catalog.pg_database WHERE datname = $1`,
        [database],
      );
      assert.deepEqual(cleanup.rows, [{ databases: 0 }]);
      const roleCleanup = await admin.query<{ roles: number }>(
        `SELECT count(*)::integer AS roles FROM pg_catalog.pg_roles WHERE rolname = 'loopos_brain_reader'`,
      );
      assert.deepEqual(roleCleanup.rows, [{ roles: 0 }]);
      await admin.end();
    }
  },
);
const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => ({
    name: entry.name,
    sql: readFileSync(`${migrationsRoot}/${entry.name}/migration.sql`, "utf8"),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const actor: BrainGoalCommandActor = {
  organizationId: "org-a",
  userId: "user-a",
  personId: "person-a",
};
const createdAt = "2099-07-15 12:00:00.000";
const expiresAt = "2099-07-15 12:15:00.000";
const expiredCreatedAt = "2000-07-15 12:00:00.000";
const expiredExpiresAt = "2000-07-15 12:15:00.000";

const payload = {
  command: "goal_proposal.create_draft",
  cycleId: "goal-cycle-a",
  circleId: "circle-a",
  ownerRoleId: "role-a",
  title: "Improve activation",
  intendedOutcome: "Users activate",
  targets: [{
    position: 1,
    label: "Activation",
    kind: "NUMERIC",
    baselineValue: "10",
    desiredValue: "20",
    unit: "%",
  }],
} as const;

const bindings = [
  { objectType: "goal_cycle", objectId: "goal-cycle-a", sourceVersionAt: "status:PLANNED", status: "PLANNED" },
  { objectType: "circle", objectId: "circle-a", sourceVersionAt: "active:true" },
  { objectType: "role", objectId: "role-a", sourceVersionAt: "active:true" },
] as const satisfies readonly BrainCommandSourceBinding[];

function quotedIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

test(
  "PostgreSQL 14 D1 Goal command handler persists terminal replay, conflicts, expiry, and owner denial",
  { skip: adminDatabaseUrl ? false : "M3_D1_TEST_ADMIN_DATABASE_URL is not set" },
  async () => {
    assert.ok(adminDatabaseUrl);
    assert.equal(migrations.length, 25);
    const suffix = `${process.pid}_${randomBytes(4).toString("hex")}`;
    const database = `loopos_m3d1_${suffix}`;
    const admin = new Client({ connectionString: adminDatabaseUrl });
    let databaseCreated = false;
    let roleCreated = false;
    await admin.connect();
    try {
      await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
      await admin.query(`CREATE DATABASE ${quotedIdentifier(database)}`);
      databaseCreated = true;
      await admin.query("DROP ROLE IF EXISTS loopos_brain_reader");
      await admin.query("CREATE ROLE loopos_brain_reader NOLOGIN NOINHERIT");
      roleCreated = true;

      const databaseUrl = new URL(adminDatabaseUrl);
      databaseUrl.pathname = `/${database}`;
      const connectionString = databaseUrl.toString();
      const db = new Client({ connectionString });
      const pool = new Pool({ connectionString });
      const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) });
      try {
        await db.connect();
        for (const migration of migrations) await db.query(migration.sql);
        await seedFixture(db);
        await insertPreview(db, "preview-a", { ownerUserId: actor.userId, previewExpiresAt: expiresAt });

        const dependencies = createPrismaBrainGoalCommandDependencies(
          prisma,
          { validate: async () => ({ ok: true as const }) },
        );

        const first = await confirmGoalCommandPreview({
          previewId: "preview-a",
          mutationKey: "mutation-a",
          actor,
        }, dependencies);
        assert.equal(first.ok, true, JSON.stringify(first));
        const firstProposal = await db.query<{ count: number }>(
          `SELECT count(*)::integer AS count
           FROM "goal_proposals"
           WHERE "organizationId" = 'org-a'
             AND "proposerId" = 'person-a'
             AND "cycleId" = 'goal-cycle-a'
             AND "circleId" = 'circle-a'`,
        );
        assert.deepEqual(firstProposal.rows, [{ count: 1 }]);
        assert.deepEqual(await terminal(db, "preview-a"), {
          status: "SUCCEEDED",
          mutationKey: "mutation-a",
          terminalCode: "SUCCEEDED",
          confirmedAtNull: false,
        });

        const replay = await confirmGoalCommandPreview({
          previewId: "preview-a",
          mutationKey: "mutation-a",
          actor,
        }, dependencies);
        assert.deepEqual(replay, first);
        const replayProposal = await db.query<{ count: number }>(
          `SELECT count(*)::integer AS count FROM "goal_proposals" WHERE "organizationId" = 'org-a'`,
        );
        assert.deepEqual(replayProposal.rows, [{ count: 1 }]);

        const retry = await confirmGoalCommandPreview({
          previewId: "preview-a",
          mutationKey: "mutation-other",
          actor,
        }, dependencies);
        assert.equal(retry.ok, false);
        if (!retry.ok) assert.equal(retry.error.code, "RETRY_CONFLICT");

        await insertPreview(db, "preview-b", { ownerUserId: actor.userId, previewExpiresAt: expiresAt });
        const duplicate = await confirmGoalCommandPreview({
          previewId: "preview-b",
          mutationKey: "mutation-a",
          actor,
        }, dependencies);
        assert.equal(duplicate.ok, false);
        if (!duplicate.ok) assert.equal(duplicate.error.code, "IDEMPOTENCY_CONFLICT");
        const duplicateProposal = await db.query<{ count: number }>(
          `SELECT count(*)::integer AS count FROM "goal_proposals" WHERE "organizationId" = 'org-a'`,
        );
        assert.deepEqual(duplicateProposal.rows, [{ count: 1 }]);

        await insertPreview(db, "preview-expired", {
          ownerUserId: actor.userId,
          previewExpiresAt: expiredExpiresAt,
          previewCreatedAt: expiredCreatedAt,
        });
        const expired = await confirmGoalCommandPreview({
          previewId: "preview-expired",
          mutationKey: "expired-key",
          actor,
        }, dependencies);
        assert.equal(expired.ok, false);
        if (!expired.ok) assert.equal(expired.error.code, "PREVIEW_EXPIRED");
        assert.deepEqual(await terminal(db, "preview-expired"), {
          status: "EXPIRED",
          mutationKey: null,
          terminalCode: "PREVIEW_EXPIRED",
          confirmedAtNull: true,
        });
        const expiredReplay = await confirmGoalCommandPreview({
          previewId: "preview-expired",
          mutationKey: "another-expired-key",
          actor,
        }, dependencies);
        assert.deepEqual(expiredReplay, expired);

        await insertPreview(db, "preview-owner", { ownerUserId: "user-c", previewExpiresAt: expiresAt });
        const denied = await confirmGoalCommandPreview({
          previewId: "preview-owner",
          mutationKey: "owner-key",
          actor,
        }, dependencies);
        assert.equal(denied.ok, false);
        if (!denied.ok) assert.equal(denied.error.code, "NOT_AVAILABLE");
        assert.deepEqual(await terminal(db, "preview-owner"), {
          status: "PREVIEWED",
          mutationKey: null,
          terminalCode: null,
          confirmedAtNull: true,
        });

        await insertPreview(db, "preview-tenant-b", {
          organizationId: "org-b",
          ownerUserId: "user-b",
          actorId: "person-b",
          conversationId: "conversation-b",
          userMessageId: "message-b",
          previewExpiresAt: expiresAt,
        });
        const tenantDenied = await confirmGoalCommandPreview({
          previewId: "preview-tenant-b",
          mutationKey: "tenant-key",
          actor,
        }, dependencies);
        assert.equal(tenantDenied.ok, false);
        if (!tenantDenied.ok) assert.equal(tenantDenied.error.code, "NOT_AVAILABLE");
        assert.deepEqual(await terminal(db, "preview-tenant-b"), {
          status: "PREVIEWED",
          mutationKey: null,
          terminalCode: null,
          confirmedAtNull: true,
        });

        await insertPreview(db, "preview-concurrent", { ownerUserId: actor.userId, previewExpiresAt: expiresAt });
        const [concurrentA, concurrentB] = await Promise.all([
          confirmGoalCommandPreview({
            previewId: "preview-concurrent",
            mutationKey: "mutation-concurrent",
            actor,
          }, dependencies),
          confirmGoalCommandPreview({
            previewId: "preview-concurrent",
            mutationKey: "mutation-concurrent",
            actor,
          }, dependencies),
        ]);
        assert.equal(concurrentA.ok, true, JSON.stringify(concurrentA));
        assert.deepEqual(concurrentB, concurrentA);
        const concurrentProposal = await db.query<{ count: number }>(
          `SELECT count(*)::integer AS count
           FROM "goal_proposals"
           WHERE "organizationId" = 'org-a'
             AND "proposerId" = 'person-a'
             AND "cycleId" = 'goal-cycle-a'
             AND "circleId" = 'circle-a'`,
        );
        assert.deepEqual(concurrentProposal.rows, [{ count: 2 }]);
        assert.deepEqual(await terminal(db, "preview-concurrent"), {
          status: "SUCCEEDED",
          mutationKey: "mutation-concurrent",
          terminalCode: "SUCCEEDED",
          confirmedAtNull: false,
        });
      } finally {
        await prisma.$disconnect();
        await pool.end();
        await db.end();
      }
    } finally {
      if (databaseCreated) {
        await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
      }
      if (roleCreated) {
        await admin.query("DROP ROLE IF EXISTS loopos_brain_reader");
      }
      const cleanup = await admin.query<{ databases: number }>(
        `SELECT count(*)::integer AS databases FROM pg_catalog.pg_database WHERE datname = $1`,
        [database],
      );
      assert.deepEqual(cleanup.rows, [{ databases: 0 }]);
      const roleCleanup = await admin.query<{ roles: number }>(
        `SELECT count(*)::integer AS roles FROM pg_catalog.pg_roles WHERE rolname = 'loopos_brain_reader'`,
      );
      assert.deepEqual(roleCleanup.rows, [{ roles: 0 }]);
      await admin.end();
    }
  },
);

async function seedFixture(client: Client): Promise<void> {
  await client.query(`INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
    VALUES
      ('org-a', 'Org A', 'org-a', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'),
      ('org-b', 'Org B', 'org-b', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00')`);
  await client.query(`INSERT INTO "users" ("id", "email", "createdAt", "updatedAt")
    VALUES
      ('user-a', 'm3d1-user-a@example.com', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'),
      ('user-b', 'm3d1-user-b@example.com', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'),
      ('user-c', 'm3d1-user-c@example.com', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00')`);
  await client.query(`INSERT INTO "memberships" ("id", "userId", "organizationId", "role", "createdAt")
    VALUES
      ('membership-a', 'user-a', 'org-a', 'ORG_MEMBER', TIMESTAMP '2026-07-15 11:00:00'),
      ('membership-b', 'user-b', 'org-b', 'ORG_MEMBER', TIMESTAMP '2026-07-15 11:00:00'),
      ('membership-c', 'user-c', 'org-a', 'ORG_MEMBER', TIMESTAMP '2026-07-15 11:00:00')`);
  await client.query(`INSERT INTO "circles" (
      "id", "organizationId", "name", "number", "type", "purpose", "createdAt", "updatedAt"
    ) VALUES (
      'circle-a', 'org-a', 'Circle A', 'CUSTOM', 'PRODUCTION', 'Operate D1 checks',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    ), (
      'circle-b', 'org-b', 'Circle B', 'CUSTOM', 'PRODUCTION', 'Operate tenant denial',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    )`);
  await client.query(`INSERT INTO "role_defs" (
      "id", "organizationId", "name", "purpose", "accountabilities", "category",
      "status", "circleId", "createdAt", "updatedAt"
    ) VALUES (
      'role-a', 'org-a', 'Goal Owner A', 'Own Goal A', 'Deliver Goal A',
      'OPERATIONS', 'ACTIVE', 'circle-a',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    ), (
      'role-b', 'org-b', 'Goal Owner B', 'Own Goal B', 'Deliver Goal B',
      'OPERATIONS', 'ACTIVE', 'circle-b',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    )`);
  await client.query(`INSERT INTO "people" (
      "id", "organizationId", "name", "userId", "homeCircleId", "joinedAt", "createdAt", "updatedAt"
    ) VALUES (
      'person-a', 'org-a', 'Person A', 'user-a', 'circle-a',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    ), (
      'person-b', 'org-b', 'Person B', 'user-b', 'circle-b',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    )`);
  await client.query(`INSERT INTO "goal_cycles" (
      "id", "organizationId", "name", "status", "startAt", "endAt",
      "checkInCadenceDays", "createdAt", "updatedAt"
    ) VALUES (
      'goal-cycle-a', 'org-a', 'Cycle A', 'PLANNED',
      TIMESTAMP '2026-07-01 00:00:00', TIMESTAMP '2026-09-30 00:00:00',
      7, TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    ), (
      'goal-cycle-b', 'org-b', 'Cycle B', 'PLANNED',
      TIMESTAMP '2026-07-01 00:00:00', TIMESTAMP '2026-09-30 00:00:00',
      7, TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    )`);
  await client.query(`INSERT INTO "brain_conversations" (
      "id", "organizationId", "ownerId", "title", "createdAt", "updatedAt"
    ) VALUES (
      'conversation-a', 'org-a', 'person-a', 'M3-D1',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    ), (
      'conversation-b', 'org-b', 'person-b', 'M3-D1 Tenant B',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    )`);
  await client.query(`INSERT INTO "brain_messages" (
      "id", "organizationId", "conversationId", "role", "content", "createdAt", "updatedAt"
    ) VALUES (
      'message-a', 'org-a', 'conversation-a', 'USER', 'Prepare a Goal draft',
      TIMESTAMP '2026-07-15 11:00:01', TIMESTAMP '2026-07-15 11:00:01'
    ), (
      'message-b', 'org-b', 'conversation-b', 'USER', 'Prepare another tenant Goal draft',
      TIMESTAMP '2026-07-15 11:00:01', TIMESTAMP '2026-07-15 11:00:01'
    )`);
}

async function insertPreview(
  client: Client,
  id: string,
  input: {
    ownerUserId: string;
    previewExpiresAt: string;
    organizationId?: string;
    actorId?: string;
    conversationId?: string;
    userMessageId?: string;
    previewCreatedAt?: string;
  },
): Promise<void> {
  const organizationId = input.organizationId ?? "org-a";
  const actorId = input.actorId ?? "person-a";
  const conversationId = input.conversationId ?? "conversation-a";
  const userMessageId = input.userMessageId ?? "message-a";
  const serverPayload = organizationId === "org-a"
    ? payload
    : { ...payload, cycleId: "goal-cycle-b", circleId: "circle-b", ownerRoleId: "role-b" };
  const sourceBindings = organizationId === "org-a"
    ? bindings
    : [
      { objectType: "goal_cycle", objectId: "goal-cycle-b", sourceVersionAt: "status:PLANNED", status: "PLANNED" },
      { objectType: "circle", objectId: "circle-b", sourceVersionAt: "active:true" },
      { objectType: "role", objectId: "role-b", sourceVersionAt: "active:true" },
    ] as const satisfies readonly BrainCommandSourceBinding[];
  await client.query(
    `INSERT INTO "brain_command_operations" (
      "id", "organizationId", "ownerUserId", "actorId", "conversationId", "userMessageId",
      "commandName", "commandSchemaVersion", "serverPayload", "payloadHash",
      "sourceBindings", "sourceBindingHash", "humanDiff", "previewExpiresAt",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      'goal_proposal.create_draft', 1,
      $7::jsonb, $8,
      $9::jsonb, $10,
      '[{"label":"Title","before":null,"after":"Improve activation"}]'::jsonb,
      $11::timestamp,
      $12::timestamp,
      $12::timestamp
    )`,
    [
      id,
      organizationId,
      input.ownerUserId,
      actorId,
      conversationId,
      userMessageId,
      JSON.stringify(serverPayload),
      hashBrainCommandBinding(serverPayload),
      JSON.stringify(sourceBindings),
      hashBrainCommandBinding(sourceBindings),
      input.previewExpiresAt,
      input.previewCreatedAt ?? createdAt,
    ],
  );
}

async function insertCommandPreview(
  client: Client,
  id: string,
  input: {
    commandName: string;
    serverPayload: Record<string, unknown>;
    sourceBindings: readonly BrainCommandSourceBinding[];
    organizationId?: string;
    ownerUserId?: string;
    actorId?: string;
    conversationId?: string;
    userMessageId?: string;
    previewExpiresAt?: string;
    previewCreatedAt?: string;
  },
): Promise<void> {
  const organizationId = input.organizationId ?? "org-a";
  const ownerUserId = input.ownerUserId ?? actor.userId;
  const actorId = input.actorId ?? actor.personId;
  const conversationId = input.conversationId ?? "conversation-a";
  const userMessageId = input.userMessageId ?? "message-a";
  await client.query(
    `INSERT INTO "brain_command_operations" (
      "id", "organizationId", "ownerUserId", "actorId", "conversationId", "userMessageId",
      "commandName", "commandSchemaVersion", "serverPayload", "payloadHash",
      "sourceBindings", "sourceBindingHash", "humanDiff", "previewExpiresAt",
      "createdAt", "updatedAt"
    ) VALUES (
      $1, $2, $3, $4, $5, $6,
      $7, 1,
      $8::jsonb, $9,
      $10::jsonb, $11,
      '[{"label":"Command","before":null,"after":"M3-D2"}]'::jsonb,
      $12::timestamp,
      $13::timestamp,
      $13::timestamp
    )`,
    [
      id,
      organizationId,
      ownerUserId,
      actorId,
      conversationId,
      userMessageId,
      input.commandName,
      JSON.stringify(input.serverPayload),
      hashBrainCommandBinding(input.serverPayload as never),
      JSON.stringify(input.sourceBindings),
      hashBrainCommandBinding(input.sourceBindings),
      input.previewExpiresAt ?? expiresAt,
      input.previewCreatedAt ?? createdAt,
    ],
  );
}

async function terminal(client: Client, id: string): Promise<{
  status: string;
  mutationKey: string | null;
  terminalCode: string | null;
  confirmedAtNull: boolean;
}> {
  const result = await client.query<{
    status: string;
    mutationKey: string | null;
    terminalCode: string | null;
    confirmedAtNull: boolean;
  }>(
    `SELECT "status",
            "mutationKey",
            "terminalCode",
            "confirmedAt" IS NULL AS "confirmedAtNull"
     FROM "brain_command_operations"
     WHERE "id" = $1`,
    [id],
  );
  const row = result.rows[0];
  assert.ok(row);
  return row;
}
