import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { Client } from "pg";

const adminDatabaseUrl = process.env.M3_C_TEST_ADMIN_DATABASE_URL;
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
const ledgerRollback = readFileSync(
  `${migrationsRoot}/20260715180000_v5_m3_c_brain_command_ledger/rollback.sql`,
  "utf8",
);

function quotedIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

async function rejectsQuery(
  client: Client,
  sql: string,
  pattern: RegExp,
): Promise<void> {
  await assert.rejects(client.query(sql), pattern);
}

test(
  "PostgreSQL 14 M3-C command ledger enforces lifecycle, immutability, access, rollback, and cleanup",
  { skip: adminDatabaseUrl ? false : "M3_C_TEST_ADMIN_DATABASE_URL is not set" },
  async () => {
    assert.ok(adminDatabaseUrl);
    assert.equal(migrations.length, 25);
    const suffix = `${process.pid}_${randomBytes(4).toString("hex")}`;
    const database = `loopos_m3c_${suffix}`;
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
      const db = new Client({ connectionString: databaseUrl.toString() });
      await db.connect();
      try {
        for (const migration of migrations) {
          await db.query(migration.sql);
        }
        await seedFixture(db);

        const readerPrivileges = await db.query<{
          canSelect: boolean;
          canInsert: boolean;
          canUpdate: boolean;
        }>(`SELECT
          pg_catalog.has_table_privilege('loopos_brain_reader', 'brain_command_operations', 'SELECT') AS "canSelect",
          pg_catalog.has_table_privilege('loopos_brain_reader', 'brain_command_operations', 'INSERT') AS "canInsert",
          pg_catalog.has_table_privilege('loopos_brain_reader', 'brain_command_operations', 'UPDATE') AS "canUpdate"`);
        assert.deepEqual(readerPrivileges.rows, [
          { canSelect: false, canInsert: false, canUpdate: false },
        ]);

        await db.query(previewInsert("op-a", "mutation-a"));
        await rejectsQuery(
          db,
          previewInsert("op-b", "mutation-b").replace(
            "'meeting_notes.update'",
            "'goal.adopt'",
          ),
          /brain_command_operations_command_check/,
        );
        await rejectsQuery(
          db,
          previewInsert("op-c", "mutation-c").replace(
            "'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'",
            "'not-a-hash'",
          ),
          /brain_command_operations_payload_hash_check/,
        );
        await rejectsQuery(
          db,
          previewInsert("op-d", "mutation-d").replace(
            "TIMESTAMP '2026-07-15 12:15:00'",
            "TIMESTAMP '2026-07-15 12:14:59'",
          ),
          /brain_command_operations_expiry_check/,
        );
        await rejectsQuery(
          db,
          previewInsert("op-owner", "mutation-owner").replace("'user-a'", "'user-b'"),
          /brain_command_operations_owner_membership_fkey/,
        );
        await rejectsQuery(
          db,
          `UPDATE "brain_command_operations"
           SET "payloadHash" = 'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
           WHERE "id" = 'op-a'`,
          /preview binding columns are immutable/,
        );

        await db.query(`UPDATE "brain_command_operations"
          SET "status" = 'SUCCEEDED',
              "mutationKey" = 'mutation-a',
              "terminalCode" = 'SUCCEEDED',
              "terminalResult" = '{"schemaVersion":1,"ok":true}'::jsonb,
              "confirmedAt" = TIMESTAMP '2026-07-15 12:01:00',
              "completedAt" = TIMESTAMP '2026-07-15 12:01:01',
              "updatedAt" = TIMESTAMP '2026-07-15 12:01:01'
          WHERE "id" = 'op-a'`);
        const terminal = await db.query<{ status: string; terminalCode: string }>(
          `SELECT "status", "terminalCode"
           FROM "brain_command_operations"
           WHERE "id" = 'op-a'`,
        );
        assert.deepEqual(terminal.rows, [
          { status: "SUCCEEDED", terminalCode: "SUCCEEDED" },
        ]);

        await db.query(previewInsert("op-e", "mutation-a"));
        await rejectsQuery(
          db,
          `UPDATE "brain_command_operations"
           SET "status" = 'REJECTED',
               "mutationKey" = 'mutation-a',
               "terminalCode" = 'STALE_PREVIEW',
               "terminalResult" = '{"schemaVersion":1,"ok":false}'::jsonb,
               "confirmedAt" = TIMESTAMP '2026-07-15 12:02:00',
               "completedAt" = TIMESTAMP '2026-07-15 12:02:01',
               "updatedAt" = TIMESTAMP '2026-07-15 12:02:01'
           WHERE "id" = 'op-e'`,
          /brain_command_operations_organization_mutation_key_key/,
        );
        await db.query(previewInsert("op-f", "mutation-f"));
        await rejectsQuery(
          db,
          `UPDATE "brain_command_operations"
           SET "status" = 'SUCCEEDED',
               "mutationKey" = '   ',
               "terminalCode" = 'SUCCEEDED',
               "terminalResult" = '{"schemaVersion":1,"ok":true}'::jsonb,
               "confirmedAt" = TIMESTAMP '2026-07-15 12:03:00',
               "completedAt" = TIMESTAMP '2026-07-15 12:03:01',
               "updatedAt" = TIMESTAMP '2026-07-15 12:03:01'
           WHERE "id" = 'op-f'`,
          /brain_command_operations_mutation_key_check/,
        );

        await db.query(previewInsert("op-g", "mutation-g"));
        await rejectsQuery(
          db,
          `UPDATE "brain_command_operations"
           SET "status" = 'EXPIRED',
               "terminalCode" = 'PREVIEW_EXPIRED',
               "completedAt" = TIMESTAMP '2026-07-15 12:04:01',
               "updatedAt" = TIMESTAMP '2026-07-15 12:04:01'
           WHERE "id" = 'op-g'`,
          /brain_command_operations_lifecycle_check/,
        );

        await db.query(`UPDATE "brain_command_operations"
          SET "status" = 'EXPIRED',
              "terminalCode" = 'PREVIEW_EXPIRED',
              "terminalResult" = '{"schemaVersion":1,"ok":false,"code":"PREVIEW_EXPIRED"}'::jsonb,
              "completedAt" = TIMESTAMP '2026-07-15 12:04:02',
              "updatedAt" = TIMESTAMP '2026-07-15 12:04:02'
          WHERE "id" = 'op-g'`);
        const expired = await db.query<{
          mutationKey: string | null;
          confirmedAt: Date | null;
          terminalResult: unknown;
        }>(
          `SELECT "mutationKey", "confirmedAt", "terminalResult"
           FROM "brain_command_operations"
           WHERE "id" = 'op-g'`,
        );
        assert.equal(expired.rows[0]?.mutationKey, null);
        assert.equal(expired.rows[0]?.confirmedAt, null);
        assert.deepEqual(expired.rows[0]?.terminalResult, {
          schemaVersion: 1,
          ok: false,
          code: "PREVIEW_EXPIRED",
        });

        await rejectsQuery(db, ledgerRollback, /ledger rows exist/);
        await db.query("ROLLBACK");
        await db.query(`DELETE FROM "brain_command_operations"`);
        await db.query(ledgerRollback);
        const residue = await db.query<{ tables: number; enums: number }>(`SELECT
          (SELECT count(*)::integer FROM pg_catalog.pg_class WHERE relname = 'brain_command_operations') AS tables,
          (SELECT count(*)::integer FROM pg_catalog.pg_type WHERE typname = 'BrainCommandOperationStatus') AS enums`);
        assert.deepEqual(residue.rows, [{ tables: 0, enums: 0 }]);
        const preserved = await db.query<{ organizations: number }>(
          `SELECT count(*)::integer AS organizations FROM "organizations"`,
        );
        assert.deepEqual(preserved.rows, [{ organizations: 2 }]);
      } finally {
        await db.end();
      }
    } finally {
      if (databaseCreated) {
        await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
      }
      if (roleCreated) {
        await admin.query("DROP ROLE IF EXISTS loopos_brain_reader");
      }
      const cleanup = await admin.query<{ databases: number; roles: number }>(`SELECT
        (SELECT count(*)::integer FROM pg_catalog.pg_database WHERE datname = $1) AS databases,
        (SELECT count(*)::integer FROM pg_catalog.pg_roles WHERE rolname = 'loopos_brain_reader') AS roles`,
        [database],
      );
      assert.deepEqual(cleanup.rows, [{ databases: 0, roles: 0 }]);
      await admin.end();
    }
  },
);

async function seedFixture(client: Client): Promise<void> {
  await client.query(`INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
    VALUES ('org-a', 'Org A', 'org-a', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00')`);
  await client.query(`INSERT INTO "organizations" ("id", "name", "slug", "createdAt", "updatedAt")
    VALUES ('org-b', 'Org B', 'org-b', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00')`);
  await client.query(`INSERT INTO "users" ("id", "email", "createdAt", "updatedAt")
    VALUES ('user-a', 'm3c-user@example.com', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00')`);
  await client.query(`INSERT INTO "users" ("id", "email", "createdAt", "updatedAt")
    VALUES ('user-b', 'm3c-user-b@example.com', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00')`);
  await client.query(`INSERT INTO "memberships" ("id", "userId", "organizationId", "role", "createdAt")
    VALUES ('membership-a', 'user-a', 'org-a', 'ORG_MEMBER', TIMESTAMP '2026-07-15 11:00:00')`);
  await client.query(`INSERT INTO "memberships" ("id", "userId", "organizationId", "role", "createdAt")
    VALUES ('membership-b', 'user-b', 'org-b', 'ORG_MEMBER', TIMESTAMP '2026-07-15 11:00:00')`);
  await client.query(`INSERT INTO "circles" (
      "id", "organizationId", "name", "number", "type", "purpose", "createdAt", "updatedAt"
    ) VALUES (
      'circle-a', 'org-a', 'Circle A', 'CUSTOM', 'PRODUCTION', 'Operate M3-C checks',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    )`);
  await client.query(`INSERT INTO "people" (
      "id", "organizationId", "name", "userId", "homeCircleId", "joinedAt", "createdAt", "updatedAt"
    ) VALUES (
      'person-a', 'org-a', 'Person A', 'user-a', 'circle-a',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    )`);
  await client.query(`INSERT INTO "brain_conversations" (
      "id", "organizationId", "ownerId", "title", "createdAt", "updatedAt"
    ) VALUES (
      'conversation-a', 'org-a', 'person-a', 'M3-C',
      TIMESTAMP '2026-07-15 11:00:00', TIMESTAMP '2026-07-15 11:00:00'
    )`);
  await client.query(`INSERT INTO "brain_messages" (
      "id", "organizationId", "conversationId", "role", "content", "createdAt", "updatedAt"
    ) VALUES (
      'message-a', 'org-a', 'conversation-a', 'USER', 'Prepare a notes update',
      TIMESTAMP '2026-07-15 11:00:01', TIMESTAMP '2026-07-15 11:00:01'
    )`);
}

function previewInsert(id: string, mutationKey: string): string {
  return `INSERT INTO "brain_command_operations" (
      "id", "organizationId", "ownerUserId", "actorId", "conversationId", "userMessageId",
      "commandName", "commandSchemaVersion", "serverPayload", "payloadHash",
      "sourceBindings", "sourceBindingHash", "humanDiff", "previewExpiresAt",
      "createdAt", "updatedAt"
    ) VALUES (
      '${id}', 'org-a', 'user-a', 'person-a', 'conversation-a', 'message-a',
      'meeting_notes.update', 1,
      '{"schemaVersion":1,"command":"meeting_notes.update"}'::jsonb,
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '[{"objectType":"meeting","objectId":"meeting-a","sourceVersionAt":"notesRevision:0"}]'::jsonb,
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      '[{"label":"Notes","before":null,"after":"Updated"}]'::jsonb,
      TIMESTAMP '2026-07-15 12:15:00',
      TIMESTAMP '2026-07-15 12:00:00',
      TIMESTAMP '2026-07-15 12:00:00'
    )`;
}
