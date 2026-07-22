import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { Client } from "pg";

import type { ActorContext } from "../authorization/actor-context-resolver";
import type { OrganizationBrainConversationStore } from "./conversation-store";
import type { OrganizationBrainTurnServiceDependencies } from "./turn-service";

const adminDatabaseUrl =
  process.env.M1_E1_TEST_ADMIN_DATABASE_URL ??
  process.env.BRAIN_TEST_ADMIN_DATABASE_URL;
const migrationsRoot = fileURLToPath(
  new URL("../../../prisma/migrations/", import.meta.url),
);
const b1Migration = "20260714074405_v5_m1_b1_brain_persistence";
const migrations = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name <= b1Migration)
  .map((entry) => ({
    name: entry.name,
    sql: readFileSync(`${migrationsRoot}/${entry.name}/migration.sql`, "utf8"),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));

const FIXTURE_SQL = `BEGIN;
INSERT INTO public.users ("id", "email", "updatedAt") VALUES
  ('user-a', 'user-a@example.invalid', CURRENT_TIMESTAMP),
  ('user-admin', 'user-admin@example.invalid', CURRENT_TIMESTAMP),
  ('user-b', 'user-b@example.invalid', CURRENT_TIMESTAMP);
INSERT INTO public.organizations ("id", "name", "slug", "updatedAt") VALUES
  ('org-a', 'Organization A', 'organization-a', CURRENT_TIMESTAMP),
  ('org-b', 'Organization B', 'organization-b', CURRENT_TIMESTAMP);
INSERT INTO public.memberships ("id", "userId", "organizationId", "role") VALUES
  ('membership-a', 'user-a', 'org-a', 'ORG_MEMBER'),
  ('membership-admin', 'user-admin', 'org-a', 'ORG_ADMIN'),
  ('membership-b', 'user-b', 'org-b', 'ORG_MEMBER');
INSERT INTO public.circles (
  "id", "organizationId", "name", "number", "type", "purpose", "status", "updatedAt"
) VALUES
  ('circle-a', 'org-a', 'Circle A', 'ONE', 'PRODUCTION', 'Purpose A', 'NORMAL', CURRENT_TIMESTAMP),
  ('circle-admin', 'org-a', 'Circle Admin', 'TWO', 'PRODUCTION', 'Purpose Admin', 'NORMAL', CURRENT_TIMESTAMP),
  ('circle-b', 'org-b', 'Circle B', 'ONE', 'PRODUCTION', 'Purpose B', 'NORMAL', CURRENT_TIMESTAMP);
INSERT INTO public.people (
  "id", "organizationId", "userId", "name", "homeCircleId", "updatedAt"
) VALUES
  ('person-a', 'org-a', 'user-a', 'Member A', 'circle-a', CURRENT_TIMESTAMP),
  ('person-admin', 'org-a', 'user-admin', 'Admin A', 'circle-admin', CURRENT_TIMESTAMP),
  ('person-b', 'org-b', 'user-b', 'Member B', 'circle-b', CURRENT_TIMESTAMP);
COMMIT;`;

function quotedIdentifier(value: string): string {
  assert.match(value, /^[a-z][a-z0-9_]+$/);
  return `"${value}"`;
}

function databaseUrl(baseUrl: string, database: string): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

function actor(
  organizationId: string,
  userId: string,
  personId: string,
  homeCircleId: string,
  membershipRole: ActorContext["membershipRole"] = "ORG_MEMBER",
): ActorContext {
  return {
    organizationId,
    userId,
    personId,
    membershipRole,
    homeCircleId,
    assignedActiveRoleDefIds: [],
    ledActiveCircleIds: [],
  };
}

async function installServerOnlyShim(): Promise<() => void> {
  const require = createRequire(import.meta.url);
  const originalNodePath = process.env.NODE_PATH;
  const compiledModules = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "../../../node_modules/next/dist/compiled",
  );
  const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
  process.env.NODE_PATH = originalNodePath
    ? `${compiledModules}:${originalNodePath}`
    : compiledModules;
  moduleWithInitPaths._initPaths();
  const serverOnlyPath = require.resolve("server-only");
  const originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  return () => {
    if (originalServerOnlyModule) {
      require.cache[serverOnlyPath] = originalServerOnlyModule;
    } else {
      delete require.cache[serverOnlyPath];
    }
    if (originalNodePath === undefined) delete process.env.NODE_PATH;
    else process.env.NODE_PATH = originalNodePath;
    moduleWithInitPaths._initPaths();
  };
}

test(
  "PostgreSQL 14 E1 keeps conversations owner-private and commits one deterministic turn winner",
  {
    skip: adminDatabaseUrl ? false : "M1_E1_TEST_ADMIN_DATABASE_URL is not set",
    timeout: 120_000,
  },
  async () => {
    assert.ok(adminDatabaseUrl);
    assert.equal(migrations.at(-1)?.name, b1Migration);
    const suffix = `${process.pid}_${randomBytes(4).toString("hex")}`;
    const database = `loopos_m1e1_${suffix}`;
    const admin = new Client({ connectionString: adminDatabaseUrl });
    let databaseCreated = false;
    let applicationClient: Client | undefined;
    let disconnectPrisma: (() => Promise<void>) | undefined;
    let restoreServerOnly: (() => void) | undefined;
    const originalDatabaseUrl = process.env.DATABASE_URL;

    await admin.connect();
    try {
      const version = await admin.query<{ server_version_num: string }>(
        "SHOW server_version_num",
      );
      const versionNumber = Number(version.rows[0]?.server_version_num);
      assert.ok(versionNumber >= 140_000 && versionNumber < 150_000);

      await admin.query(`CREATE DATABASE ${quotedIdentifier(database)}`);
      databaseCreated = true;
      const applicationDatabaseUrl = databaseUrl(adminDatabaseUrl, database);
      applicationClient = new Client({ connectionString: applicationDatabaseUrl });
      await applicationClient.connect();
      for (const migration of migrations) {
        await applicationClient.query(migration.sql);
      }
      await applicationClient.query(FIXTURE_SQL);

      process.env.DATABASE_URL = applicationDatabaseUrl;
      restoreServerOnly = await installServerOnlyShim();
      const [{ organizationBrainConversationStore }, turnModule, dbModule] =
        await Promise.all([
          import("./conversation-store"),
          import("./turn-service"),
          import("@/lib/db"),
        ]);
      const prismaInternals = dbModule.prisma as unknown as {
        $disconnect(): Promise<void>;
        _engineConfig: {
          adapter: { externalPool: { end(): Promise<void> } };
        };
      };
      disconnectPrisma = async () => {
        await prismaInternals.$disconnect();
        await prismaInternals._engineConfig.adapter.externalPool.end();
      };

      const member = actor("org-a", "user-a", "person-a", "circle-a");
      const administrator = actor(
        "org-a",
        "user-admin",
        "person-admin",
        "circle-admin",
        "ORG_ADMIN",
      );
      const secondTenant = actor("org-b", "user-b", "person-b", "circle-b");
      const makeService = (
        actorValue: ActorContext,
        plan: OrganizationBrainTurnServiceDependencies["plan"] = async () => ({
          schemaVersion: 1,
          status: "NO_PLAN",
          code: "NO_SUPPORTED_PLAN",
          plans: [],
        }),
      ) =>
        turnModule.createOrganizationBrainTurnService({
          resolveActor: async () => actorValue,
          store: organizationBrainConversationStore,
          plan,
          executeQuery: async () => {
            throw new Error("query must not run for NO_PLAN");
          },
          reason: async () => {
            throw new Error("reasoner must not run for NO_PLAN");
          },
          retrieveMemory: async () => [],
        });

      const memberService = makeService(member);
      const adminService = makeService(administrator);
      const tenantService = makeService(secondTenant);
      const memberConversation = await memberService.createConversation({
        schemaVersion: 1,
        clientConversationId: "member-browser-1",
      });
      const replayedConversation = await memberService.createConversation({
        schemaVersion: 1,
        clientConversationId: "member-browser-1",
      });
      const adminConversation = await adminService.createConversation({
        schemaVersion: 1,
        clientConversationId: "admin-browser-1",
      });
      const tenantConversation = await tenantService.createConversation({
        schemaVersion: 1,
        clientConversationId: "tenant-browser-1",
      });
      assert.equal(memberConversation.id, replayedConversation.id);
      assert.notEqual(memberConversation.id, adminConversation.id);
      assert.notEqual(memberConversation.id, tenantConversation.id);

      assert.deepEqual(
        (await memberService.listConversations({ schemaVersion: 1 })).conversations.map(
          (conversation) => conversation.id,
        ),
        [memberConversation.id],
      );
      assert.deepEqual(
        (await adminService.listConversations({ schemaVersion: 1 })).conversations.map(
          (conversation) => conversation.id,
        ),
        [adminConversation.id],
      );
      assert.deepEqual(
        (await tenantService.listConversations({ schemaVersion: 1 })).conversations.map(
          (conversation) => conversation.id,
        ),
        [tenantConversation.id],
      );

      for (const service of [adminService, tenantService]) {
        await assert.rejects(
          service.loadConversation({
            schemaVersion: 1,
            conversationId: memberConversation.id,
          }),
          (error: unknown) =>
            error instanceof turnModule.OrganizationBrainTurnServiceError &&
            error.code === "ACCESS_DENIED",
        );
      }
      await assert.rejects(
        memberService.loadConversation({
          schemaVersion: 1,
          conversationId: `bc_${"f".repeat(64)}`,
        }),
        (error: unknown) =>
          error instanceof turnModule.OrganizationBrainTurnServiceError &&
          error.code === "ACCESS_DENIED",
      );

      let plannersReady = 0;
      let releasePlanners!: () => void;
      const bothPlannersReady = new Promise<void>((resolveReady) => {
        releasePlanners = resolveReady;
      });
      const barrier = async () => {
        plannersReady += 1;
        if (plannersReady === 2) releasePlanners();
        await bothPlannersReady;
      };
      const firstService = makeService(member, async () => {
        await barrier();
        return {
          schemaVersion: 1,
          status: "NO_PLAN",
          code: "NO_SUPPORTED_PLAN",
          plans: [],
        };
      });
      const secondService = makeService(member, async () => {
        await barrier();
        return {
          schemaVersion: 1,
          status: "UNAVAILABLE",
          code: "PROVIDER_UNAVAILABLE",
          plans: [],
        };
      });
      const concurrentInput = {
        schemaVersion: 1 as const,
        conversationId: memberConversation.id,
        clientTurnId: "cross-instance-turn-1",
        question: "组织现在最重要的目标是什么？",
      };
      const [firstResult, secondResult] = await Promise.all([
        firstService.executeTurn(concurrentInput),
        secondService.executeTurn(concurrentInput),
      ]);
      assert.deepEqual(firstResult, secondResult);
      assert.ok(
        firstResult.result.code === "NO_SUPPORTED_PLAN" ||
          firstResult.result.code === "PROVIDER_UNAVAILABLE",
      );

      const counts = await applicationClient.query<{
        role: "USER" | "BRAIN";
        count: number;
      }>(`SELECT "role", count(*)::integer AS count
        FROM public.brain_messages
        WHERE "conversationId" = $1
        GROUP BY "role"
        ORDER BY "role"`, [memberConversation.id]);
      assert.deepEqual(counts.rows, [
        { role: "USER", count: 1 },
        { role: "BRAIN", count: 1 },
      ]);

      let replayPlannerCalls = 0;
      const replayService = makeService(member, async () => {
        replayPlannerCalls += 1;
        throw new Error("terminal replay must not plan");
      });
      const replay = await replayService.executeTurn(concurrentInput);
      assert.deepEqual(replay, firstResult);
      assert.equal(replayPlannerCalls, 0);
      await assert.rejects(
        replayService.executeTurn({
          ...concurrentInput,
          question: "同一个键对应另一个问题",
        }),
        (error: unknown) =>
          error instanceof turnModule.OrganizationBrainTurnServiceError &&
          error.code === "IDEMPOTENCY_CONFLICT",
      );

      const detail = await memberService.loadConversation({
        schemaVersion: 1,
        conversationId: memberConversation.id,
      });
      assert.deepEqual(
        detail.messages.map((message) => message.role),
        ["USER", "BRAIN"],
      );
      assert.equal("content" in detail.messages[1]!, false);

      const directStore: OrganizationBrainConversationStore =
        organizationBrainConversationStore;
      const claim = await directStore.claim(member, {
        conversationId: memberConversation.id,
        userMessageId: firstResult.userMessageId,
        brainMessageId: firstResult.brainMessageId,
        question: concurrentInput.question,
      });
      assert.deepEqual(claim.terminal, firstResult.result);
    } finally {
      if (disconnectPrisma) await disconnectPrisma().catch(() => undefined);
      if (applicationClient) {
        await applicationClient.end().catch(() => undefined);
        applicationClient = undefined;
      }
      if (restoreServerOnly) restoreServerOnly();
      if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = originalDatabaseUrl;
      if (databaseCreated) {
        for (let attempt = 0; attempt < 20; attempt += 1) {
          const active = await admin.query<{ count: number }>(
            `SELECT count(*)::integer AS count
             FROM pg_stat_activity
             WHERE datname = $1 AND pid <> pg_backend_pid()`,
            [database],
          );
          if (active.rows[0]?.count === 0) break;
          await new Promise((resolveWait) => setTimeout(resolveWait, 25));
        }
        await admin.query(
          `SELECT pg_terminate_backend(pid)
           FROM pg_stat_activity
           WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [database],
        );
        await admin.query(`DROP DATABASE ${quotedIdentifier(database)}`);
      }
      const residue = await admin.query(
        "SELECT 1 FROM pg_database WHERE datname = $1",
        [database],
      );
      assert.equal(residue.rowCount, 0);
      await admin.end();
    }
  },
);
