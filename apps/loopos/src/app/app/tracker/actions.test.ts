import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import type { PrismaClient } from "@/generated/prisma/client";
import { authorizeTrackerTensionMutation } from "@/lib/domain-operations";
import {
  closeDisposableDbClient,
  createDisposableDbClient,
  requiredRtw1S0DatabaseUrl,
  type DisposableDbClient,
} from "@/test/rtw1-s0-disposable-db";
import { editTensionAction } from "./[id]/edit-action";
import { withTrackerActionTestDependencies } from "./action-dependencies";
import { transitionTensionAction } from "./actions";

type Actor = { id: string; organizationId: string };
type TrackerContext = {
  organizationId: string;
  circleId: string;
  runId: string;
  meetingId: string;
  routeArtifactId: string;
  owner: Actor;
  outsider: Actor;
  lead: Actor;
  admin: Actor;
};

class RedirectSignal extends Error {
  constructor(readonly destination: string) {
    super(destination);
  }
}

function matches(row: Record<string, unknown>, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => row[key] === value);
}

function inMemoryTrackerFixture({
  ownerId = "owner",
  proposalStatus = "APPROVED",
  proposalKind = "ACTION",
}: {
  ownerId?: string | null;
  proposalStatus?: string;
  proposalKind?: string;
} = {}) {
  const tension: Record<string, unknown> = {
    id: "action",
    organizationId: "org",
    ownerId,
    status: "ASSIGNED",
    resolvedAt: null,
  };
  const proposal = {
    id: "proposal",
    organizationId: "org",
    tensionId: "action",
    status: proposalStatus,
    kind: proposalKind,
    outcomeActionId: "action",
  };
  let writes = 0;
  const client = {
    tension: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => matches(tension, where) ? tension : null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!matches(tension, where)) return { count: 0 };
        Object.assign(tension, data);
        writes += 1;
        return { count: 1 };
      },
    },
    tacticalOutcomeProposal: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => matches(proposal, where) ? proposal : null,
    },
  };
  const dependencies = {
    prisma: client,
    getCurrentOrgId: async () => "org",
    getCurrentPerson: async () => ({ id: "owner", organizationId: "org" }),
    authorizeTrackerTensionMutation,
    revalidatePath: () => {},
    beforeTrackerWrite: async () => {},
  };
  return { dependencies, tension, get writes() { return writes; } };
}

function editForm(title = "Edited action"): FormData {
  const formData = new FormData();
  formData.set("title", title);
  formData.set("description", "Edited through the production Server Action");
  formData.set("acceptanceCriteria", "A durable result exists");
  return formData;
}

function trackerDependencies(
  prisma: PrismaClient,
  organizationId: string,
  actor: Actor,
  beforeTrackerWrite: () => Promise<void> = async () => {},
) {
  return {
    prisma,
    getCurrentOrgId: async () => organizationId,
    getCurrentPerson: async () => actor,
    authorizeTrackerTensionMutation,
    revalidatePath: () => {},
    redirect: (destination: string): never => { throw new RedirectSignal(destination); },
    beforeTrackerWrite,
  };
}

async function createTrackerContext(prisma: PrismaClient, label: string): Promise<TrackerContext> {
  const suffix = `${label}-${randomUUID().slice(0, 8)}`;
  const organization = await prisma.organization.create({
    data: { name: `Tracker ${suffix}`, slug: `tracker-${suffix}` },
  });
  const circle = await prisma.circle.create({
    data: {
      organizationId: organization.id,
      name: `Delivery ${suffix}`,
      number: "CUSTOM",
      type: "PRODUCTION",
      purpose: "Deliver approved actions",
    },
  });
  const adminUser = await prisma.user.create({
    data: { email: `admin-${suffix}@example.test`, name: "Organization admin" },
  });
  const [owner, outsider, lead, admin] = await Promise.all([
    prisma.person.create({ data: { organizationId: organization.id, name: "Action owner", homeCircleId: circle.id } }),
    prisma.person.create({ data: { organizationId: organization.id, name: "Ordinary nonowner", homeCircleId: circle.id } }),
    prisma.person.create({ data: { organizationId: organization.id, name: "Circle lead", homeCircleId: circle.id } }),
    prisma.person.create({ data: { organizationId: organization.id, name: "Organization admin", homeCircleId: circle.id, userId: adminUser.id } }),
  ]);
  await Promise.all([
    prisma.circle.update({ where: { id: circle.id }, data: { leadPersonId: lead.id } }),
    prisma.membership.create({ data: { organizationId: organization.id, userId: adminUser.id, role: "ORG_ADMIN" } }),
  ]);
  const circleInterface = await prisma.circleInterface.create({
    data: {
      organizationId: organization.id,
      name: `Tracker interface ${suffix}`,
      contractContent: "Deliver approved tactical outcomes",
      sla: "One week",
      acceptanceCriteria: "Action closes",
      fromCircleId: circle.id,
      toCircleId: circle.id,
      ownerId: owner.id,
    },
  });
  const workbench = await prisma.interfaceWorkbench.create({
    data: {
      organizationId: organization.id,
      interfaceId: circleInterface.id,
      draft: {},
      draftLayout: {},
      draftHash: `draft-${suffix}`,
    },
  });
  const version = await prisma.interfaceWorkbenchVersion.create({
    data: {
      organizationId: organization.id,
      workbenchId: workbench.id,
      version: 1,
      publisherId: owner.id,
      sourceSnapshot: {},
      compiledSnapshot: {},
      editorLayout: {},
      validationResult: { ok: true },
      sourceHash: `source-${suffix}`,
      compiledHash: `compiled-${suffix}`,
      definitionSchemaVersion: 1,
      compilerVersion: "rtw1-s0-test",
    },
  });
  await prisma.interfaceWorkbench.update({ where: { id: workbench.id }, data: { activeVersionId: version.id } });
  const run = await prisma.interfaceWorkflowRun.create({
    data: {
      organizationId: organization.id,
      workbenchId: workbench.id,
      versionId: version.id,
      status: "ACTIVE",
      currentNodeId: "tracker-test",
      currentNodeVisit: 1,
      evidence: {},
      revision: 1,
      starterId: owner.id,
      lastActorId: owner.id,
    },
  });
  const meeting = await prisma.meeting.create({
    data: {
      organizationId: organization.id,
      title: `Tactical meeting ${suffix}`,
      type: "TACTICAL",
      agenda: "Approve actions",
      durationMin: 30,
      startedAt: new Date(),
      circleId: circle.id,
      participants: { connect: [{ id: owner.id }, { id: outsider.id }, { id: lead.id }, { id: admin.id }] },
    },
  });
  const routeArtifact = await prisma.interfaceWorkflowArtifact.create({
    data: {
      organizationId: organization.id,
      runId: run.id,
      artifactType: "MEETING",
      artifactId: meeting.id,
      relation: "tactical-route",
      metadata: {},
    },
  });
  return {
    organizationId: organization.id,
    circleId: circle.id,
    runId: run.id,
    meetingId: meeting.id,
    routeArtifactId: routeArtifact.id,
    owner: { id: owner.id, organizationId: organization.id },
    outsider: { id: outsider.id, organizationId: organization.id },
    lead: { id: lead.id, organizationId: organization.id },
    admin: { id: admin.id, organizationId: organization.id },
  };
}

async function createTrackerItem(
  prisma: PrismaClient,
  context: TrackerContext,
  label: string,
  options: { status?: "PROPOSED" | "APPROVED"; kind?: "ACTION" | "PROJECT"; proposal?: boolean } = {},
) {
  const tension = await prisma.tension.create({
    data: {
      organizationId: context.organizationId,
      title: label,
      description: `${label} description`,
      type: "CONSTRUCTIVE",
      source: "FORM",
      status: "ASSIGNED",
      ownerId: context.owner.id,
      circleId: context.circleId,
      raiserId: context.owner.id,
    },
  });
  if (options.proposal !== false) {
    const sourceArtifact = await prisma.interfaceWorkflowArtifact.create({
      data: {
        organizationId: context.organizationId,
        runId: context.runId,
        artifactType: "TENSION",
        artifactId: tension.id,
        relation: "raised-tension",
        metadata: {},
      },
    });
    const kind = options.kind ?? "ACTION";
    const status = options.status ?? "APPROVED";
    const outcomeProject = kind === "PROJECT" && status === "APPROVED"
      ? await prisma.project.create({
        data: {
          organizationId: context.organizationId,
          name: `${label} project`,
          goal: `${label} result`,
          expectedResult: `${label} result`,
          circleId: context.circleId,
          bearerId: context.owner.id,
          sourceTensionId: tension.id,
        },
      })
      : null;
    await prisma.tacticalOutcomeProposal.create({
      data: {
        organizationId: context.organizationId,
        tensionId: tension.id,
        provenanceKind: "INTERFACE_RUN",
        runId: context.runId,
        meetingId: context.meetingId,
        sourceTensionArtifactId: sourceArtifact.id,
        routeArtifactId: context.routeArtifactId,
        proposerId: context.owner.id,
        kind,
        title: `${label} proposal`,
        circleId: context.circleId,
        responsiblePersonId: context.owner.id,
        status,
        expectedResult: kind === "PROJECT" ? `${label} result` : null,
        acceptanceCriteria: kind === "ACTION" ? `${label} accepted` : null,
        recordedById: status === "APPROVED" ? context.owner.id : null,
        recordedAt: status === "APPROVED" ? new Date() : null,
        outcomeActionId: status === "APPROVED" && kind === "ACTION" ? tension.id : null,
        outcomeProjectId: outcomeProject?.id ?? null,
      },
    });
  }
  return tension;
}

async function mutationSnapshot(prisma: PrismaClient, tensionId: string) {
  return prisma.tension.findUniqueOrThrow({
    where: { id: tensionId },
    select: { title: true, description: true, status: true, resolvedAt: true, ownerId: true },
  });
}

describe("transitionTensionAction direct production boundary", () => {
  test("raw, unapproved, non-ACTION, and nonowner calls produce zero writes", async () => {
    for (const fixture of [
      inMemoryTrackerFixture({ proposalStatus: "PROPOSED" }),
      inMemoryTrackerFixture({ proposalKind: "PROJECT" }),
      inMemoryTrackerFixture({ ownerId: null }),
    ]) {
      const result = await withTrackerActionTestDependencies(
        fixture.dependencies,
        () => transitionTensionAction("action", "IN_PROGRESS", undefined),
      );
      assert.ok(result?.error);
      assert.equal(fixture.writes, 0);
    }
  });

  test("the approved ACTION owner directly transitions through the actual Server Action", async () => {
    const fixture = inMemoryTrackerFixture();
    assert.equal(
      await withTrackerActionTestDependencies(
        fixture.dependencies,
        () => transitionTensionAction("action", "IN_PROGRESS", undefined),
      ),
      undefined,
    );
    assert.equal(fixture.writes, 1);
    assert.equal(fixture.tension.status, "IN_PROGRESS");
  });
});

if (process.env.RTW1_S0_DB_REQUIRED === "1") {
  describe("tracker Server Actions against disposable PostgreSQL", { concurrency: 1 }, () => {
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

    test("raw, unapproved, and non-ACTION items deny transition and edit with zero writes", async () => {
      const context = await createTrackerContext(first.prisma, "provenance");
      const items = [
        await createTrackerItem(first.prisma, context, "Raw item", { proposal: false }),
        await createTrackerItem(first.prisma, context, "Unapproved item", { status: "PROPOSED" }),
        await createTrackerItem(first.prisma, context, "Project item", { kind: "PROJECT" }),
      ];
      for (const item of items) {
        const beforeSnapshot = await mutationSnapshot(first.prisma, item.id);
        const dependencies = trackerDependencies(first.prisma, context.organizationId, context.owner);
        assert.ok((await withTrackerActionTestDependencies(
          dependencies,
          () => transitionTensionAction(item.id, "RESOLVED", undefined),
        ))?.error);
        assert.ok((await withTrackerActionTestDependencies(
          dependencies,
          () => editTensionAction(item.id, undefined, editForm(`Forbidden ${item.id}`)),
        ))?.error);
        assert.deepEqual(await mutationSnapshot(first.prisma, item.id), beforeSnapshot);
      }
    });

    test("ordinary nonowner, circle lead, and org admin deny both mutations with zero writes", async () => {
      const context = await createTrackerContext(first.prisma, "roles");
      const item = await createTrackerItem(first.prisma, context, "Owner-only action");
      assert.equal(
        (await first.prisma.circle.findUniqueOrThrow({ where: { id: context.circleId }, select: { leadPersonId: true } })).leadPersonId,
        context.lead.id,
      );
      assert.equal(
        (await first.prisma.membership.findFirstOrThrow({ where: { organizationId: context.organizationId, user: { person: { id: context.admin.id } } }, select: { role: true } })).role,
        "ORG_ADMIN",
      );
      const beforeSnapshot = await mutationSnapshot(first.prisma, item.id);
      for (const actor of [context.outsider, context.lead, context.admin]) {
        const dependencies = trackerDependencies(first.prisma, context.organizationId, actor);
        assert.ok((await withTrackerActionTestDependencies(
          dependencies,
          () => transitionTensionAction(item.id, "RESOLVED", undefined),
        ))?.error);
        assert.ok((await withTrackerActionTestDependencies(
          dependencies,
          () => editTensionAction(item.id, undefined, editForm(`Forbidden ${actor.id}`)),
        ))?.error);
      }
      assert.deepEqual(await mutationSnapshot(first.prisma, item.id), beforeSnapshot);
    });

    test("the current responsible owner edits, transitions, and resolves an approved ACTION", async () => {
      const context = await createTrackerContext(first.prisma, "owner");
      const item = await createTrackerItem(first.prisma, context, "Owner lifecycle");
      const dependencies = trackerDependencies(first.prisma, context.organizationId, context.owner);
      await assert.rejects(
        withTrackerActionTestDependencies(
          dependencies,
          () => editTensionAction(item.id, undefined, editForm("Edited owner action")),
        ),
        (error) => error instanceof RedirectSignal && error.destination === `/app/tracker/${item.id}`,
      );
      assert.equal(await withTrackerActionTestDependencies(
        dependencies,
        () => transitionTensionAction(item.id, "IN_PROGRESS", undefined),
      ), undefined);
      assert.equal(await withTrackerActionTestDependencies(
        dependencies,
        () => transitionTensionAction(item.id, "RESOLVED", undefined),
      ), undefined);
      const result = await mutationSnapshot(first.prisma, item.id);
      assert.equal(result.title, "Edited owner action");
      assert.equal(result.status, "RESOLVED");
      assert.ok(result.resolvedAt instanceof Date);
    });

    test("cross-tenant transition and edit attempts are denied with zero writes", async () => {
      const actorContext = await createTrackerContext(first.prisma, "tenant-a");
      const targetContext = await createTrackerContext(first.prisma, "tenant-b");
      const target = await createTrackerItem(first.prisma, targetContext, "Other tenant action");
      const beforeSnapshot = await mutationSnapshot(first.prisma, target.id);
      const dependencies = trackerDependencies(first.prisma, actorContext.organizationId, actorContext.owner);
      assert.ok((await withTrackerActionTestDependencies(
        dependencies,
        () => transitionTensionAction(target.id, "RESOLVED", undefined),
      ))?.error);
      assert.ok((await withTrackerActionTestDependencies(
        dependencies,
        () => editTensionAction(target.id, undefined, editForm("Cross-tenant edit")),
      ))?.error);
      assert.deepEqual(await mutationSnapshot(first.prisma, target.id), beforeSnapshot);
    });

    test("ownership changes between authorization and write deny transition and edit", async () => {
      const context = await createTrackerContext(first.prisma, "ownership-race");
      const transitionItem = await createTrackerItem(first.prisma, context, "Transition ownership race");
      const transitionResult = await withTrackerActionTestDependencies(
        trackerDependencies(first.prisma, context.organizationId, context.owner, async () => {
          await second.prisma.tension.update({ where: { id: transitionItem.id }, data: { ownerId: context.outsider.id } });
        }),
        () => transitionTensionAction(transitionItem.id, "RESOLVED", undefined),
      );
      assert.ok(transitionResult?.error);
      const transitionSnapshot = await mutationSnapshot(first.prisma, transitionItem.id);
      assert.equal(transitionSnapshot.ownerId, context.outsider.id);
      assert.equal(transitionSnapshot.status, "ASSIGNED");

      const editItem = await createTrackerItem(first.prisma, context, "Edit ownership race");
      const editResult = await withTrackerActionTestDependencies(
        trackerDependencies(first.prisma, context.organizationId, context.owner, async () => {
          await second.prisma.tension.update({ where: { id: editItem.id }, data: { ownerId: context.outsider.id } });
        }),
        () => editTensionAction(editItem.id, undefined, editForm("Must not persist")),
      );
      assert.ok(editResult?.error);
      const editSnapshot = await mutationSnapshot(first.prisma, editItem.id);
      assert.equal(editSnapshot.ownerId, context.outsider.id);
      assert.equal(editSnapshot.title, "Edit ownership race");
    });
  });
}
