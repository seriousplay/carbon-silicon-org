import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Module, { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";
import type { PrismaClient } from "../../../generated/prisma/client";
import { BOOTSTRAP_AUTHORITY_DENIAL } from "../../../lib/bootstrap-authority";
import { llmTeamTemplate } from "../../../lib/org-templates";
import {
  closeDisposableDbClient,
  createDisposableDbClient,
  requiredRtw1S0DatabaseUrl,
  type DisposableDbClient,
} from "../../../test/rtw1-s0-disposable-db";
import { withSetupActionTestDependencies } from "./action-dependencies";
type InitializeOrgAction = typeof import("./actions").initializeOrgAction;

type SetupFixture = { organizationId: string; personId: string; userId: string; rootCircleId: string; rootName: string };
type BootstrapStep =
  | "BEFORE_AUTHORITY_REFRESH"
  | "AUTHORITY_CONFIRMED"
  | "ROOT_WRITTEN";

const require = createRequire(import.meta.url);
let initializeOrgAction: InitializeOrgAction;

before(async () => {
  const serverOnlyPath = require.resolve("server-only");
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  ({ initializeOrgAction } = await import("./actions"));
});

function templateForm(): FormData {
  const formData = new FormData();
  formData.set("templateId", llmTeamTemplate.id);
  return formData;
}

function setupDependencies(
  prisma: PrismaClient,
  fixture: SetupFixture,
  onBootstrapStep: (step: BootstrapStep) => Promise<void> = async () => {},
) {
  return {
    prisma,
    requireSession: async () => ({ user: { id: fixture.userId } }),
    getCurrentOrgId: async () => fixture.organizationId,
    getCurrentPerson: async () => ({ id: fixture.personId, organizationId: fixture.organizationId }),
    revalidatePath: () => {},
    onBootstrapStep,
  };
}

async function createPristineOrganization(prisma: PrismaClient, label: string): Promise<SetupFixture> {
  const suffix = `${label}-${randomUUID().slice(0, 8)}`;
  const organization = await prisma.organization.create({
    data: { name: `RTW1 S0 ${suffix}`, slug: `rtw1-s0-${suffix}` },
  });
  const rootName = `Pristine root ${suffix}`;
  const rootCircle = await prisma.circle.create({
    data: {
      organizationId: organization.id,
      name: rootName,
      number: "CUSTOM",
      type: "PRODUCTION",
      purpose: "Pristine registration root",
    },
  });
  const person = await prisma.person.create({
    data: {
      organizationId: organization.id,
      name: `Initializer ${suffix}`,
      homeCircleId: rootCircle.id,
    },
  });
  const user = await prisma.user.create({
    data: { email: `${suffix}@loopos.test`, name: `Initializer ${suffix}` },
  });
  await prisma.person.update({ where: { id: person.id }, data: { userId: user.id } });
  await prisma.membership.create({
    data: { organizationId: organization.id, userId: user.id, role: "ORG_ADMIN" },
  });
  return {
    organizationId: organization.id,
    personId: person.id,
    userId: user.id,
    rootCircleId: rootCircle.id,
    rootName,
  };
}

async function bootstrapCounts(prisma: PrismaClient, organizationId: string) {
  const [circles, roles, interfaces, changes] = await Promise.all([
    prisma.circle.count({ where: { organizationId } }),
    prisma.roleDef.count({ where: { organizationId } }),
    prisma.circleInterface.count({ where: { organizationId } }),
    prisma.changeLog.count({ where: { organizationId } }),
  ]);
  return { circles, roles, interfaces, changes };
}

test("initializeOrgAction directly rejects a missing template before database mutation", async () => {
  let transactions = 0;
  const result = await withSetupActionTestDependencies({
    prisma: { $transaction: async () => { transactions += 1; } },
    getCurrentOrgId: async () => "org",
    getCurrentPerson: async () => ({ id: "person", organizationId: "org" }),
    requireSession: async () => ({ user: { id: "user" } }),
    revalidatePath: () => {},
    onBootstrapStep: async () => {},
  }, () => initializeOrgAction(undefined, new FormData()));
  assert.deepEqual(result, { error: "请选择一个模板" });
  assert.equal(transactions, 0);
});

function deniedActionDependencies(options: {
  transactionLifecycle: "SETUP" | "ACTIVE";
  outerMembershipRole?: "ORG_ADMIN" | "ORG_MEMBER";
  transactionMembershipRole?: "ORG_ADMIN" | "ORG_MEMBER" | null;
}) {
  let writes = 0;
  let transactions = 0;
  const transactionMembershipRole = options.transactionMembershipRole ?? "ORG_ADMIN";
  const tx = {
    organization: {
      findUnique: async () => ({ lifecycleStatus: options.transactionLifecycle }),
    },
    membership: {
      findUnique: async () => transactionMembershipRole === null
        ? null
        : { role: transactionMembershipRole },
    },
    person: {
      findFirst: async () => ({ id: "person", organizationId: "org" }),
    },
    circle: {
      count: async () => 1,
      findFirst: async () => { writes += 1; return null; },
      create: async () => { writes += 1; throw new Error("unexpected write"); },
      update: async () => { writes += 1; throw new Error("unexpected write"); },
    },
    roleDef: { count: async () => 0, create: async () => { writes += 1; } },
    circleInterface: { count: async () => 0, create: async () => { writes += 1; } },
    charter: { count: async () => 0 },
    changeLog: { count: async () => 0, create: async () => { writes += 1; } },
    meeting: { count: async () => 0 },
    decisionRecord: { count: async () => 0 },
    governanceProposal: { count: async () => 0 },
    tacticalOutcomeProposal: { count: async () => 0 },
    project: { count: async () => 0 },
    tension: { count: async () => 0 },
  };

  return {
    dependencies: {
      prisma: {
        membership: {
          findUnique: async () => ({ role: options.outerMembershipRole ?? "ORG_ADMIN" }),
        },
        $transaction: async (work: (client: typeof tx) => Promise<unknown>) => {
          transactions += 1;
          return work(tx);
        },
      },
      getCurrentOrgId: async () => "org",
      getCurrentPerson: async () => ({ id: "person", organizationId: "org" }),
      requireSession: async () => ({ user: { id: "user" } }),
      revalidatePath: () => {},
      onBootstrapStep: async () => {},
    },
    evidence: () => ({ writes, transactions }),
  };
}

test("initializeOrgAction denies an ACTIVE organization inside the transaction with zero writes", async () => {
  const fixture = deniedActionDependencies({ transactionLifecycle: "ACTIVE" });
  const result = await withSetupActionTestDependencies(
    fixture.dependencies,
    () => initializeOrgAction(undefined, templateForm()),
  );
  assert.deepEqual(result, { error: BOOTSTRAP_AUTHORITY_DENIAL });
  assert.deepEqual(fixture.evidence(), { writes: 0, transactions: 1 });
});

test("initializeOrgAction denies authority revoked after the outer check with zero writes", async () => {
  const fixture = deniedActionDependencies({
    transactionLifecycle: "SETUP",
    outerMembershipRole: "ORG_ADMIN",
    transactionMembershipRole: "ORG_MEMBER",
  });
  const result = await withSetupActionTestDependencies(
    fixture.dependencies,
    () => initializeOrgAction(undefined, templateForm()),
  );
  assert.deepEqual(result, { error: "只有组织管理员可以初始化组织" });
  assert.deepEqual(fixture.evidence(), { writes: 0, transactions: 1 });
});

if (process.env.RTW1_S0_DB_REQUIRED === "1") {
  describe("initializeOrgAction against disposable PostgreSQL", { concurrency: 1 }, () => {
    let first: DisposableDbClient;
    let second: DisposableDbClient;

    before(() => {
      const connectionString = requiredRtw1S0DatabaseUrl();
      first = createDisposableDbClient(connectionString);
      second = createDisposableDbClient(connectionString);
    });

    after(async () => {
      await Promise.all([closeDisposableDbClient(first), closeDisposableDbClient(second)]);
    });

    test("pristine setup succeeds once and a second invocation is denied without duplicate effects", async () => {
      const fixture = await createPristineOrganization(first.prisma, "once");
      const dependencies = setupDependencies(first.prisma, fixture);
      assert.deepEqual(
        await withSetupActionTestDependencies(dependencies, () => initializeOrgAction(undefined, templateForm())),
        { ok: true },
      );
      const expected = {
        circles: llmTeamTemplate.circles.length,
        roles: llmTeamTemplate.circles.flatMap((circle) => circle.roles).length,
        interfaces: llmTeamTemplate.interfaces.length,
        changes: 1,
      };
      assert.deepEqual(await bootstrapCounts(first.prisma, fixture.organizationId), expected);
      assert.deepEqual(
        await withSetupActionTestDependencies(dependencies, () => initializeOrgAction(undefined, templateForm())),
        { error: BOOTSTRAP_AUTHORITY_DENIAL },
      );
      assert.deepEqual(await bootstrapCounts(first.prisma, fixture.organizationId), expected);
    });

    test("an ordinary member direct invocation is denied with zero writes", async () => {
      const fixture = await createPristineOrganization(first.prisma, "member");
      await first.prisma.membership.update({
        where: { userId_organizationId: { userId: fixture.userId, organizationId: fixture.organizationId } },
        data: { role: "ORG_MEMBER" },
      });
      const beforeCounts = await bootstrapCounts(first.prisma, fixture.organizationId);

      assert.deepEqual(
        await withSetupActionTestDependencies(
          setupDependencies(first.prisma, fixture),
          () => initializeOrgAction(undefined, templateForm()),
        ),
        { error: "只有组织管理员可以初始化组织" },
      );
      assert.deepEqual(await bootstrapCounts(first.prisma, fixture.organizationId), beforeCounts);
    });

    test("an ACTIVE organization is denied inside the transaction with zero structural writes", async () => {
      const fixture = await createPristineOrganization(first.prisma, "active");
      await first.prisma.organization.update({
        where: { id: fixture.organizationId },
        data: {
          lifecycleStatus: "ACTIVE",
          activatedAt: new Date(),
          activatedById: fixture.personId,
          activatedByOrganizationId: fixture.organizationId,
        },
      });
      const beforeCounts = await bootstrapCounts(first.prisma, fixture.organizationId);

      assert.deepEqual(
        await withSetupActionTestDependencies(
          setupDependencies(first.prisma, fixture),
          () => initializeOrgAction(undefined, templateForm()),
        ),
        { error: BOOTSTRAP_AUTHORITY_DENIAL },
      );
      assert.deepEqual(await bootstrapCounts(first.prisma, fixture.organizationId), beforeCounts);
    });

    test("authority revoked after the outer check is denied by the transaction with zero structural writes", async () => {
      const fixture = await createPristineOrganization(first.prisma, "stale-authority");
      const beforeCounts = await bootstrapCounts(first.prisma, fixture.organizationId);
      const result = await withSetupActionTestDependencies(
        setupDependencies(first.prisma, fixture, async (step) => {
          if (step !== "BEFORE_AUTHORITY_REFRESH") return;
          await second.prisma.membership.update({
            where: {
              userId_organizationId: {
                userId: fixture.userId,
                organizationId: fixture.organizationId,
              },
            },
            data: { role: "ORG_MEMBER" },
          });
        }),
        () => initializeOrgAction(undefined, templateForm()),
      );

      assert.deepEqual(result, { error: "只有组织管理员可以初始化组织" });
      assert.deepEqual(await bootstrapCounts(first.prisma, fixture.organizationId), beforeCounts);
    });

    test("any operational history denies setup with zero structural writes", async () => {
      const fixture = await createPristineOrganization(first.prisma, "history");
      await first.prisma.tension.create({
        data: {
          organizationId: fixture.organizationId,
          title: "Existing operation",
          description: "An operational tension already exists",
          type: "CONSTRUCTIVE",
          source: "FORM",
          raiserId: fixture.personId,
        },
      });
      const beforeCounts = await bootstrapCounts(first.prisma, fixture.organizationId);
      const result = await withSetupActionTestDependencies(
        setupDependencies(first.prisma, fixture),
        () => initializeOrgAction(undefined, templateForm()),
      );
      assert.deepEqual(result, { error: BOOTSTRAP_AUTHORITY_DENIAL });
      assert.deepEqual(await bootstrapCounts(first.prisma, fixture.organizationId), beforeCounts);
    });

    test("an injected failure after the root write rolls the whole setup transaction back", async () => {
      const fixture = await createPristineOrganization(first.prisma, "rollback");
      const result = await withSetupActionTestDependencies(
        setupDependencies(first.prisma, fixture, async (step) => {
          if (step === "ROOT_WRITTEN") throw new Error("injected rollback proof");
        }),
        () => initializeOrgAction(undefined, templateForm()),
      );
      assert.deepEqual(result, { error: "初始化失败，请重试" });
      assert.deepEqual(await bootstrapCounts(first.prisma, fixture.organizationId), {
        circles: 1,
        roles: 0,
        interfaces: 0,
        changes: 0,
      });
      assert.deepEqual(
        await first.prisma.circle.findUnique({ where: { id: fixture.rootCircleId }, select: { name: true, leadPersonId: true } }),
        { name: fixture.rootName, leadPersonId: null },
      );
    });

    test("two independent serializable clients produce one setup winner and one set of effects", async () => {
      const fixture = await createPristineOrganization(first.prisma, "race");
      let arrivals = 0;
      let releaseBarrier!: () => void;
      const barrier = new Promise<void>((resolve) => { releaseBarrier = resolve; });
      const onBootstrapStep = async (step: BootstrapStep) => {
        if (step !== "AUTHORITY_CONFIRMED") return;
        arrivals += 1;
        if (arrivals === 2) releaseBarrier();
        await barrier;
      };
      const [firstResult, secondResult] = await Promise.all([
        withSetupActionTestDependencies(
          setupDependencies(first.prisma, fixture, onBootstrapStep),
          () => initializeOrgAction(undefined, templateForm()),
        ),
        withSetupActionTestDependencies(
          setupDependencies(second.prisma, fixture, onBootstrapStep),
          () => initializeOrgAction(undefined, templateForm()),
        ),
      ]);
      assert.equal(arrivals, 2);
      assert.equal([firstResult, secondResult].filter((result) => result?.ok === true).length, 1);
      assert.equal([firstResult, secondResult].filter((result) => result?.error).length, 1);
      assert.deepEqual(await bootstrapCounts(first.prisma, fixture.organizationId), {
        circles: llmTeamTemplate.circles.length,
        roles: llmTeamTemplate.circles.flatMap((circle) => circle.roles).length,
        interfaces: llmTeamTemplate.interfaces.length,
        changes: 1,
      });
    });
  });
}
