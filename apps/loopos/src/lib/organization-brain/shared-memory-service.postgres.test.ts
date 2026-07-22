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
import type {
  SharedMemoryRetrievalAuditStore,
  SharedMemoryRetrievalStore,
} from "./shared-memory-service";

type ServiceModule = typeof import("./shared-memory-service");

const adminDatabaseUrl =
  process.env.M4_C2_TEST_ADMIN_DATABASE_URL ?? process.env.DATABASE_URL;
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
  service = await import("./shared-memory-service");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = originalNodePath;
  moduleWithInitPaths._initPaths();
});

const actorJson = `{"type":"person","id":"person-owner","label":"Owner"}`;
const confirmerJson = `{"type":"process","id":"goal:person-lead","label":"Goal source authority"}`;
const supersededJson = `{"type":"sourceRecord","id":"decision-a","label":"Later decision","applicationUrl":"/app/meetings/meeting-a"}`;

const fixtureSql = `BEGIN;
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO "users" ("id", "email", "updatedAt") VALUES
  ('user-owner', 'm4c2-owner@example.invalid', TIMESTAMP '2026-07-15 00:00:00'),
  ('user-lead', 'm4c2-lead@example.invalid', TIMESTAMP '2026-07-15 00:00:00'),
  ('user-outsider', 'm4c2-outsider@example.invalid', TIMESTAMP '2026-07-15 00:00:00'),
  ('user-b', 'm4c2-b@example.invalid', TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "organizations" ("id", "name", "slug", "updatedAt") VALUES
  ('org-a', 'Org A', 'm4c2-org-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('org-b', 'Org B', 'm4c2-org-b', TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "memberships" ("id", "userId", "organizationId", "role") VALUES
  ('membership-owner', 'user-owner', 'org-a', 'ORG_MEMBER'),
  ('membership-lead', 'user-lead', 'org-a', 'ORG_MEMBER'),
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
  ('person-lead', 'org-a', 'user-lead', 'Lead', 'circle-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('person-outsider', 'org-a', 'user-outsider', 'Outsider', 'circle-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('person-b', 'org-b', 'user-b', 'Person B', 'circle-b', TIMESTAMP '2026-07-15 00:00:00');

UPDATE "circles" SET "leadPersonId" = 'person-lead' WHERE "id" = 'circle-a';
UPDATE "circles" SET "leadPersonId" = 'person-b' WHERE "id" = 'circle-b';

INSERT INTO "role_defs" (
  "id", "organizationId", "name", "purpose", "accountabilities", "category",
  "status", "circleId", "updatedAt"
) VALUES
  ('role-a', 'org-a', 'Role A', 'Own A', 'Accountable A', 'OPERATIONS', 'ACTIVE', 'circle-a', TIMESTAMP '2026-07-15 00:00:00'),
  ('role-b', 'org-b', 'Role B', 'Own B', 'Accountable B', 'OPERATIONS', 'ACTIVE', 'circle-b', TIMESTAMP '2026-07-15 00:00:00');

INSERT INTO "_PersonRoles" ("A", "B") VALUES
  ('person-lead', 'role-a'),
  ('person-b', 'role-b');

INSERT INTO "meetings" (
  "id", "organizationId", "title", "type", "agenda", "notesRevision",
  "durationMin", "startedAt", "circleId", "createdAt"
) VALUES
  ('meeting-a', 'org-a', 'Strategic A', 'STRATEGY', '[]', 0, 30, TIMESTAMP '2026-07-14 12:00:00', 'circle-a', TIMESTAMP '2026-07-14 12:00:00'),
  ('meeting-b', 'org-b', 'Strategic B', 'STRATEGY', '[]', 0, 30, TIMESTAMP '2026-07-14 12:00:00', 'circle-b', TIMESTAMP '2026-07-14 12:00:00');

INSERT INTO "_MeetingToPerson" ("A", "B") VALUES
  ('meeting-a', 'person-lead'),
  ('meeting-b', 'person-b');

INSERT INTO "tensions" (
  "id", "organizationId", "title", "description", "type", "source", "status",
  "createdAt", "updatedAt", "raiserId", "ownerId"
) VALUES
  ('tension-private-a', 'org-a', 'Private A', 'Owner-only source', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 08:00:00', TIMESTAMP '2026-07-13 08:00:00', 'person-owner', 'person-owner'),
  ('tension-b', 'org-b', 'Private B', 'Tenant B source', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'OPEN', TIMESTAMP '2026-07-13 08:00:00', TIMESTAMP '2026-07-13 08:00:00', 'person-b', 'person-b');

INSERT INTO "memory_candidates" (
  "id", "organizationId", "ownerPersonId", "claim", "rationale", "sourceRefs",
  "authorityRouteKind", "authorityRouteLabel", "authorityRouteUrl", "status",
  "submittedBy", "confirmedBy", "supersededBy", "validFrom", "validUntil",
  "createdAt", "updatedAt"
) VALUES
  (
    'candidate-governance-a', 'org-a', 'person-owner', 'Role A needs weekly evidence.', 'Role A accountability is missing an update.',
    '[{"type":"role","id":"role-a","label":"Role A","applicationUrl":"/app/roles/role-a","observedAt":"2026-07-15T12:00:00.000Z"},{"type":"tension","id":"tension-private-a","label":"Private A","applicationUrl":"/app/tensions/tension-private-a","observedAt":"2026-07-15T12:00:00.000Z"}]'::jsonb,
    'GOVERNANCE', 'Governance source authority', '/app/roles/role-a', 'CONFIRMED',
    '${actorJson}'::jsonb, '${confirmerJson}'::jsonb, NULL, TIMESTAMP '2026-07-15 00:00:00', NULL,
    TIMESTAMP '2026-07-15 10:00:00', TIMESTAMP '2026-07-15 10:30:00'
  ),
  (
    'candidate-tension-a', 'org-a', 'person-owner', 'Private tension requires owner follow-up.', 'Only the tension owner can read the source.',
    '[{"type":"tension","id":"tension-private-a","label":"Private A","applicationUrl":"/app/tensions/tension-private-a","observedAt":"2026-07-15T12:00:00.000Z"}]'::jsonb,
    'TENSION', 'Tension source authority', '/app/tensions/tension-private-a', 'CONFIRMED',
    '${actorJson}'::jsonb, '${confirmerJson}'::jsonb, NULL, TIMESTAMP '2026-07-15 00:00:00', NULL,
    TIMESTAMP '2026-07-15 09:00:00', TIMESTAMP '2026-07-15 09:30:00'
  ),
  (
    'candidate-expired-a', 'org-a', 'person-owner', 'Expired memory should not return.', 'Its validity window has ended.',
    '[{"type":"role","id":"role-a","label":"Role A","applicationUrl":"/app/roles/role-a","observedAt":"2026-07-15T12:00:00.000Z"}]'::jsonb,
    'GOVERNANCE', 'Governance source authority', '/app/roles/role-a', 'CONFIRMED',
    '${actorJson}'::jsonb, '${confirmerJson}'::jsonb, NULL, TIMESTAMP '2026-07-14 00:00:00', TIMESTAMP '2026-07-15 00:00:00',
    TIMESTAMP '2026-07-14 09:00:00', TIMESTAMP '2026-07-14 09:30:00'
  ),
  (
    'candidate-superseded-a', 'org-a', 'person-owner', 'Superseded memory should not return.', 'It has been replaced.',
    '[{"type":"role","id":"role-a","label":"Role A","applicationUrl":"/app/roles/role-a","observedAt":"2026-07-15T12:00:00.000Z"}]'::jsonb,
    'GOVERNANCE', 'Governance source authority', '/app/roles/role-a', 'SUPERSEDED',
    '${actorJson}'::jsonb, '${confirmerJson}'::jsonb, '${supersededJson}'::jsonb, TIMESTAMP '2026-07-15 00:00:00', NULL,
    TIMESTAMP '2026-07-15 08:00:00', TIMESTAMP '2026-07-15 08:30:00'
  ),
  (
    'candidate-b', 'org-b', 'person-b', 'Tenant B memory should not leak.', 'Tenant B only.',
    '[{"type":"role","id":"role-b","label":"Role B","applicationUrl":"/app/roles/role-b","observedAt":"2026-07-15T12:00:00.000Z"}]'::jsonb,
    'GOVERNANCE', 'Governance source authority', '/app/roles/role-b', 'CONFIRMED',
    '{"type":"person","id":"person-b","label":"Person B"}'::jsonb, '{"type":"process","id":"goal:person-b","label":"Goal source authority"}'::jsonb, NULL, TIMESTAMP '2026-07-15 00:00:00', NULL,
    TIMESTAMP '2026-07-15 10:00:00', TIMESTAMP '2026-07-15 10:30:00'
  );

COMMIT;`;

test(
  "PostgreSQL M4-C2 retrieval is tenant-scoped, source-authorized, lifecycle-bounded, and audited",
  { skip: adminDatabaseUrl ? false : "M4_C2_TEST_ADMIN_DATABASE_URL or DATABASE_URL is not set" },
  async () => {
    assert.ok(adminDatabaseUrl);
    const suffix = `${process.pid}_${randomBytes(4).toString("hex")}`;
    const database = `loopos_m4c2_${suffix}`;
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

        const store = service.createPrismaSharedMemoryRetrievalStore(prisma);
        const audit = service.createPrismaSharedMemoryRetrievalAuditStore(prisma);

        const leadEntries = await service.retrieveSharedMemoryForActor(
          { schemaVersion: 1, text: "role evidence", authorityRouteKind: "GOVERNANCE", limit: 10 },
          deps(actor("org-a", "user-lead", "person-lead", ["role-a"], ["circle-a"]), store, audit),
        );
        assert.deepEqual(leadEntries.map((entry) => entry.candidateId), ["candidate-governance-a"]);
        assert.deepEqual(leadEntries[0]?.sourceRefs.map((sourceRef) => sourceRef.id), ["role-a"]);

        const ownerEntries = await service.retrieveSharedMemoryForActor(
          { schemaVersion: 1, text: "private tension", authorityRouteKind: "TENSION", limit: 10 },
          deps(actor("org-a", "user-owner", "person-owner", [], []), store, audit),
        );
        assert.deepEqual(ownerEntries.map((entry) => entry.candidateId), ["candidate-tension-a"]);

        const outsiderEntries = await service.retrieveSharedMemoryForActor(
          { schemaVersion: 1, text: "private tension", authorityRouteKind: "TENSION", limit: 10 },
          deps(actor("org-a", "user-outsider", "person-outsider", [], []), store, audit),
        );
        assert.deepEqual(outsiderEntries, []);

        const tenantBEntries = await service.retrieveSharedMemoryForActor(
          { schemaVersion: 1, text: "role evidence", limit: 10 },
          deps(actor("org-b", "user-b", "person-b", ["role-b"], ["circle-b"]), store, audit),
        );
        assert.deepEqual(tenantBEntries.map((entry) => entry.candidateId), ["candidate-b"]);

        const auditRows = await db.query<{
          purpose: string;
          status: string;
          resultCount: number;
          actorId: string;
          scope: {
            capability?: string;
            hasText?: boolean;
            textHash?: string | null;
            authorityRouteKind?: string | null;
            limit?: number;
          };
        }>(
          `SELECT "purpose", "status", "resultCount", "actorId", "scope"
           FROM "brain_query_audits"
           ORDER BY "createdAt" ASC, "id" ASC`,
        );
        assert.deepEqual(
          auditRows.rows.map((row) => [row.actorId, row.status, row.resultCount]),
          [
            ["person-lead", "SUCCEEDED", 1],
            ["person-owner", "SUCCEEDED", 1],
            ["person-outsider", "SUCCEEDED", 0],
            ["person-b", "SUCCEEDED", 1],
          ],
        );
        for (const row of auditRows.rows) {
          assert.equal(row.purpose, "M4_C_SHARED_MEMORY_RETRIEVAL");
          assert.equal(row.scope.capability, "sharedMemoryRetrieval");
          assert.equal(row.scope.hasText, true);
          assert.match(row.scope.textHash ?? "", /^[a-f0-9]{64}$/);
          assert.equal(row.scope.limit, 10);
        }
      } finally {
        await prisma.$disconnect().catch(() => undefined);
        await pool.end().catch(() => undefined);
        await db.end().catch(() => undefined);
      }
    } finally {
      if (databaseCreated) {
        await admin.query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)} WITH (FORCE)`);
        const residue = await admin.query<{ exists: boolean }>(
          "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
          [database],
        );
        assert.equal(residue.rows[0]?.exists, false);
      }
      if (readerRoleCreated) {
        await admin.query("DROP ROLE IF EXISTS loopos_brain_reader");
      }
      await admin.end().catch(() => undefined);
    }
  },
);

function deps(
  actorContext: ActorContext,
  store: SharedMemoryRetrievalStore,
  audit: SharedMemoryRetrievalAuditStore,
) {
  return {
    resolveActor: async () => actorContext,
    store,
    audit,
    now: () => new Date("2026-07-16T00:00:00.000Z"),
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
