import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { Prisma } from "@/generated/prisma/client";
import {
  hashBrainCommandBinding,
  type BrainCommandSourceBinding,
} from "@/lib/organization-brain/command-registry";
import {
  confirmGoalCommandPreview,
  createPrismaBrainGoalCommandDependencies,
  type BrainGoalCommandActor,
} from "@/lib/organization-brain/goal-command-handler";
import { createLedgerForMeetingLifecycle } from "@/lib/organization-brain/meeting-preview-lifecycle-gate";
import { BrainCommandPreviewServiceError } from "@/lib/organization-brain/command-preview-types";
import {
  closeDisposableDbClient,
  createDisposableDbClient,
  requiredRtw1S0DatabaseUrl,
  type DisposableDbClient,
} from "@/test/rtw1-s0-disposable-db";

type Fixture = Readonly<{
  prefix: string;
  organizationId: string;
  userId: string;
  personId: string;
  circleId: string;
  conversationId: string;
  messageId: string;
  tacticalMeetingId: string;
  governanceMeetingId: string;
  tacticalTensionId: string;
  governanceTensionId: string;
}>;

type CommandFixture = Readonly<{
  id: string;
  commandName: string;
  serverPayload: Record<string, unknown>;
  sourceBindings: readonly BrainCommandSourceBinding[];
}>;

function operationData(fixture: Fixture, command: CommandFixture) {
  const createdAt = new Date();
  return {
    id: command.id,
    organizationId: fixture.organizationId,
    ownerUserId: fixture.userId,
    actorId: fixture.personId,
    conversationId: fixture.conversationId,
    userMessageId: fixture.messageId,
    commandName: command.commandName,
    commandSchemaVersion: 1,
    serverPayload: command.serverPayload as Prisma.InputJsonValue,
    payloadHash: hashBrainCommandBinding(command.serverPayload as never),
    sourceBindings: command.sourceBindings as Prisma.InputJsonValue,
    sourceBindingHash: hashBrainCommandBinding(command.sourceBindings as never),
    humanDiff: [{ label: "Lifecycle", before: "SETUP", after: "write denied" }],
    createdAt,
    previewExpiresAt: new Date(createdAt.getTime() + 15 * 60_000),
  };
}

async function domainSnapshot(client: DisposableDbClient, fixture: Fixture) {
  const [tacticalProposals, projects, governanceProposals, meetings, tensions] = await Promise.all([
    client.prisma.tacticalOutcomeProposal.count({ where: { organizationId: fixture.organizationId } }),
    client.prisma.project.count({ where: { organizationId: fixture.organizationId } }),
    client.prisma.governanceProposal.count({ where: { organizationId: fixture.organizationId } }),
    client.prisma.meeting.findMany({
      where: { organizationId: fixture.organizationId },
      orderBy: { id: "asc" },
      select: { id: true, notes: true, notesRevision: true, endedAt: true },
    }),
    client.prisma.tension.findMany({
      where: { organizationId: fixture.organizationId },
      orderBy: { id: "asc" },
      select: { id: true, status: true, projectId: true, ownerId: true },
    }),
  ]);
  return { tacticalProposals, projects, governanceProposals, meetings, tensions };
}

async function terminalSnapshot(client: DisposableDbClient, ids: readonly string[]) {
  return client.prisma.brainCommandOperation.findMany({
    where: { id: { in: [...ids] } },
    orderBy: { id: "asc" },
    select: {
      id: true,
      status: true,
      mutationKey: true,
      terminalCode: true,
      terminalResult: true,
      confirmedAt: true,
      completedAt: true,
    },
  });
}

async function createFixture(client: DisposableDbClient): Promise<Fixture> {
  const prefix = `m1-b3-${randomUUID()}`;
  const userId = `${prefix}-user`;
  const organizationId = `${prefix}-org`;
  const circleId = `${prefix}-circle`;
  const personId = `${prefix}-person`;
  const conversationId = `${prefix}-conversation`;
  const messageId = `${prefix}-message`;
  const tacticalMeetingId = `${prefix}-tactical-meeting`;
  const governanceMeetingId = `${prefix}-governance-meeting`;
  const tacticalTensionId = `${prefix}-tactical-tension`;
  const governanceTensionId = `${prefix}-governance-tension`;

  await client.prisma.user.create({
    data: { id: userId, email: `${prefix}@example.invalid`, name: "M1 B3 actor" },
  });
  await client.prisma.organization.create({
    data: { id: organizationId, name: `M1 B3 ${prefix}`, slug: prefix },
  });
  await client.prisma.membership.create({
    data: { id: `${prefix}-membership`, userId, organizationId, role: "ORG_ADMIN" },
  });
  await client.prisma.circle.create({
    data: {
      id: circleId,
      organizationId,
      name: "M1 B3 Root",
      number: "ZERO",
      type: "STRATEGY",
      purpose: "Verify Brain lifecycle denial",
    },
  });
  await client.prisma.person.create({
    data: { id: personId, organizationId, name: "M1 B3 actor", userId, homeCircleId: circleId },
  });
  await client.prisma.brainConversation.create({
    data: { id: conversationId, organizationId, ownerId: personId, title: "M1 B3" },
  });
  await client.prisma.brainMessage.create({
    data: { id: messageId, organizationId, conversationId, role: "USER", content: "Verify SETUP denial" },
  });
  await client.prisma.meeting.createMany({
    data: [
      {
        id: tacticalMeetingId,
        organizationId,
        title: "M1 B3 tactical",
        type: "TACTICAL",
        agenda: "Lifecycle fixture",
        notes: "Unchanged tactical notes",
        durationMin: 30,
        startedAt: new Date("2026-07-20T09:00:00.000Z"),
        circleId,
      },
      {
        id: governanceMeetingId,
        organizationId,
        title: "M1 B3 governance",
        type: "GOVERNANCE",
        agenda: "Lifecycle fixture",
        notes: "Unchanged governance notes",
        durationMin: 60,
        startedAt: new Date("2026-07-20T10:00:00.000Z"),
        circleId,
      },
    ],
  });
  await client.prisma.tension.createMany({
    data: [
      {
        id: tacticalTensionId,
        organizationId,
        title: "M1 B3 tactical tension",
        description: "Must not produce a tactical proposal during setup",
        type: "PROBLEMATIC",
        source: "FORM",
        handlingMode: "TACTICAL",
        raiserId: personId,
      },
      {
        id: governanceTensionId,
        organizationId,
        title: "M1 B3 governance tension",
        description: "Must not produce a governance proposal during setup",
        type: "PROBLEMATIC",
        source: "FORM",
        handlingMode: "GOVERNANCE",
        raiserId: personId,
      },
    ],
  });

  return {
    prefix,
    organizationId,
    userId,
    personId,
    circleId,
    conversationId,
    messageId,
    tacticalMeetingId,
    governanceMeetingId,
    tacticalTensionId,
    governanceTensionId,
  };
}

if (process.env.RTW1_S0_DB_REQUIRED !== "1") {
  test("V6-M1-B3 SETUP Brain meeting-command denial against disposable PostgreSQL", {
    skip: "RTW1_S0_DB_REQUIRED is not set",
  }, () => {});
} else {
  describe("V6-M1-B3 SETUP Brain meeting-command denial against disposable PostgreSQL", { concurrency: 1 }, () => {
    let client: DisposableDbClient;

    before(() => {
      client = createDisposableDbClient(requiredRtw1S0DatabaseUrl());
    });

    after(async () => {
      await closeDisposableDbClient(client);
    });

    test("meeting previews and confirmations fail closed while tension.raise remains available", async () => {
      let fixture: Fixture | undefined;
      try {
        fixture = await createFixture(client);
        const actor: BrainGoalCommandActor = {
          organizationId: fixture.organizationId,
          userId: fixture.userId,
          personId: fixture.personId,
        };
        const commands = {
          tactical: {
            id: `${fixture.prefix}-preview-tactical`,
            commandName: "tactical_outcome.submit_proposal",
            serverPayload: {
              command: "tactical_outcome.submit_proposal",
              tensionId: fixture.tacticalTensionId,
              meetingId: fixture.tacticalMeetingId,
              expectedRevision: 0,
              kind: "PROJECT",
              title: "Denied tactical project",
              description: "SETUP must prevent this proposal",
              responsibility: "M1 B3 actor",
              circleId: fixture.circleId,
              responsiblePersonId: fixture.personId,
            },
            sourceBindings: [
              { objectType: "tension", objectId: fixture.tacticalTensionId, sourceVersionAt: "revision:0", revision: 0, status: "OPEN" },
              { objectType: "meeting", objectId: fixture.tacticalMeetingId, sourceVersionAt: "ended:false" },
              { objectType: "circle", objectId: fixture.circleId, sourceVersionAt: "active:true" },
            ] as const satisfies readonly BrainCommandSourceBinding[],
          },
          notes: {
            id: `${fixture.prefix}-preview-notes`,
            commandName: "meeting_notes.update",
            serverPayload: {
              command: "meeting_notes.update",
              meetingId: fixture.tacticalMeetingId,
              expectedNotesRevision: 0,
              notes: "This write must be denied",
            },
            sourceBindings: [
              { objectType: "meeting", objectId: fixture.tacticalMeetingId, sourceVersionAt: "notesRevision:0", revision: 0 },
            ] as const satisfies readonly BrainCommandSourceBinding[],
          },
          governance: {
            id: `${fixture.prefix}-preview-governance`,
            commandName: "governance_proposal.create",
            serverPayload: {
              command: "governance_proposal.create",
              tensionId: fixture.governanceTensionId,
              meetingId: fixture.governanceMeetingId,
              currentStructure: "Current boundary",
              proposedStructure: "Proposed boundary",
              rationale: "Repeated tension",
              expectedImpact: "Clearer accountability",
              structuralChange: { schemaVersion: 1, operation: "ROLE_ARCHIVED", targetId: `${fixture.prefix}-role` },
            },
            sourceBindings: [
              { objectType: "tension", objectId: fixture.governanceTensionId, sourceVersionAt: "revision:0", revision: 0, status: "OPEN" },
              { objectType: "meeting", objectId: fixture.governanceMeetingId, sourceVersionAt: "ended:false" },
            ] as const satisfies readonly BrainCommandSourceBinding[],
          },
        } satisfies Record<string, CommandFixture>;

        for (const command of [commands.tactical, commands.governance]) {
          const beforeLedgerCount: number = await client.prisma.brainCommandOperation.count({
            where: { organizationId: fixture.organizationId },
          });
          await assert.rejects(
            client.prisma.$transaction(
              async (transaction) => {
                const organization = await transaction.organization.findUnique({
                  where: { id: fixture!.organizationId },
                  select: { lifecycleStatus: true },
                });
                return createLedgerForMeetingLifecycle(
                  organization?.lifecycleStatus,
                  () => transaction.brainCommandOperation.create({ data: operationData(fixture!, command) }),
                );
              },
              { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
            ),
            (error: unknown) => error instanceof BrainCommandPreviewServiceError && error.code === "ACCESS_DENIED",
          );
          assert.equal(
            await client.prisma.brainCommandOperation.count({ where: { organizationId: fixture.organizationId } }),
            beforeLedgerCount,
          );
        }

        await client.prisma.brainCommandOperation.createMany({
          data: [commands.tactical, commands.notes, commands.governance].map((command) => operationData(fixture!, command)),
        });
        const previewIds = [commands.tactical.id, commands.notes.id, commands.governance.id];
        const beforeTerminal = await terminalSnapshot(client, previewIds);
        const beforeDomain = await domainSnapshot(client, fixture);
        const dependencies = createPrismaBrainGoalCommandDependencies(
          client.prisma,
          { validate: async () => ({ ok: true as const }) },
        );

        for (const command of [commands.tactical, commands.notes, commands.governance]) {
          const result = await confirmGoalCommandPreview({
            previewId: command.id,
            mutationKey: `${command.id}-mutation`,
            actor,
          }, dependencies);
          assert.equal(result.ok, false, JSON.stringify(result));
          if (!result.ok) assert.equal(result.error.code, "INVALID_STATE");
        }

        assert.deepEqual(await terminalSnapshot(client, previewIds), beforeTerminal);
        assert.deepEqual(await domainSnapshot(client, fixture), beforeDomain);

        const tensionCommand: CommandFixture = {
          id: `${fixture.prefix}-preview-tension`,
          commandName: "tension.raise",
          serverPayload: {
            command: "tension.raise",
            title: "Allowed setup tension",
            description: "Non-meeting work remains available while setup is incomplete",
            type: "CLARIFYING",
            circleIds: [fixture.circleId],
            handlingMode: "UNROUTED",
          },
          sourceBindings: [
            { objectType: "circle", objectId: fixture.circleId, sourceVersionAt: "active:true" },
          ] as const satisfies readonly BrainCommandSourceBinding[],
        };
        await client.prisma.brainCommandOperation.create({ data: operationData(fixture, tensionCommand) });
        const tensionCountBefore = await client.prisma.tension.count({ where: { organizationId: fixture.organizationId } });
        const tensionResult = await confirmGoalCommandPreview({
          previewId: tensionCommand.id,
          mutationKey: `${tensionCommand.id}-mutation`,
          actor,
        }, dependencies);
        assert.equal(tensionResult.ok, true, JSON.stringify(tensionResult));
        assert.equal(
          await client.prisma.tension.count({ where: { organizationId: fixture.organizationId } }),
          tensionCountBefore + 1,
        );
        const tensionTerminal = await client.prisma.brainCommandOperation.findUnique({
          where: { id: tensionCommand.id },
          select: { status: true, terminalCode: true, mutationKey: true, confirmedAt: true },
        });
        assert.equal(tensionTerminal?.status, "SUCCEEDED");
        assert.equal(tensionTerminal?.terminalCode, "SUCCEEDED");
        assert.equal(tensionTerminal?.mutationKey, `${tensionCommand.id}-mutation`);
        assert.ok(tensionTerminal?.confirmedAt instanceof Date);
      } finally {
        if (fixture) {
          await client.prisma.organization.deleteMany({ where: { id: fixture.organizationId } });
          await client.prisma.user.deleteMany({ where: { id: fixture.userId } });
          assert.equal(
            await client.prisma.organization.count({ where: { slug: { startsWith: "m1-b3-" } } }),
            0,
          );
        }
      }
    });
  });
}
