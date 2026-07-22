import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import Module, { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";
import { Prisma } from "@/generated/prisma/client";
import { DomainOperationError, submitTacticalOutcomeProposal } from "@/lib/domain-operations";
import {
  createPrismaGovernanceDecisionDependencies,
  executeGovernanceDecisionOperation,
  GovernanceDecisionError,
  type GovernanceDecisionInput,
} from "@/lib/governance-decision";
import {
  closeDisposableDbClient,
  createDisposableDbClient,
  requiredRtw1S0DatabaseUrl,
  type DisposableDbClient,
} from "@/test/rtw1-s0-disposable-db";
import { withCollaborationActionTestDependencies } from "../../app/app/meetings/[id]/collaboration-action-dependencies";
import { withTacticalOutcomeActionTestDependencies } from "../../app/app/meetings/[id]/tactical-outcome-action-dependencies";
import { withMeetingActionTestDependencies } from "../../app/app/meetings/action-dependencies";
import { MEETING_LIFECYCLE_DENIAL_CODE } from "./meeting-lifecycle-policy";

type CreateMeetingAction = typeof import("../../app/app/meetings/actions").createMeetingAction;
type EndMeetingAction = typeof import("../../app/app/meetings/[id]/collaboration-actions").endMeetingAction;
type RecordDecisionAction = typeof import("../../app/app/meetings/[id]/tactical-outcome-actions").recordTacticalOutcomeDecisionAction;

const require = createRequire(import.meta.url);
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let createMeetingAction: CreateMeetingAction;
let endMeetingAction: EndMeetingAction;
let recordTacticalOutcomeDecisionAction: RecordDecisionAction;

before(async () => {
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  ({ createMeetingAction } = await import("../../app/app/meetings/actions"));
  ({ endMeetingAction } = await import("../../app/app/meetings/[id]/collaboration-actions"));
  ({ recordTacticalOutcomeDecisionAction } = await import("../../app/app/meetings/[id]/tactical-outcome-actions"));
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
});

function meetingForm(personId: string): FormData {
  const formData = new FormData();
  formData.set("title", "Denied setup meeting");
  formData.set("type", "TACTICAL");
  formData.set("durationMin", "30");
  formData.set("startedAt", "2026-07-20T09:00:00.000Z");
  formData.append("participantIds", personId);
  return formData;
}

function decisionForm(): FormData {
  const formData = new FormData();
  formData.set("decision", "RETURNED");
  formData.set("note", "Add evidence");
  formData.set("mutationKey", `decision-${randomUUID()}`);
  formData.set("expectedRevision", "1");
  return formData;
}

async function counts(client: DisposableDbClient, organizationId: string, meetingId: string) {
  const [
    meetings,
    tacticalProposals,
    projects,
    tensions,
    governanceProposals,
    governanceProcesses,
    governanceOperations,
    decisions,
    notifications,
    meeting,
  ] = await Promise.all([
    client.prisma.meeting.count({ where: { organizationId } }),
    client.prisma.tacticalOutcomeProposal.count({ where: { organizationId } }),
    client.prisma.project.count({ where: { organizationId } }),
    client.prisma.tension.count({ where: { organizationId } }),
    client.prisma.governanceProposal.count({ where: { organizationId } }),
    client.prisma.governanceDecisionProcess.count({ where: { organizationId } }),
    client.prisma.governanceDecisionOperation.count({ where: { organizationId } }),
    client.prisma.decisionRecord.count({ where: { organizationId } }),
    client.prisma.notification.count({ where: { organizationId } }),
    client.prisma.meeting.findUnique({
      where: { id_organizationId: { id: meetingId, organizationId } },
      select: { endedAt: true, endedById: true, notes: true, notesRevision: true },
    }),
  ]);
  return {
    meetings,
    tacticalProposals,
    projects,
    tensions,
    governanceProposals,
    governanceProcesses,
    governanceOperations,
    decisions,
    notifications,
    meeting,
  };
}

if (process.env.RTW1_S0_DB_REQUIRED === "1") {
  describe("V6-M1-B2 SETUP meeting denial against disposable PostgreSQL", { concurrency: 1 }, () => {
    let client: DisposableDbClient;

    before(() => {
      client = createDisposableDbClient(requiredRtw1S0DatabaseUrl());
    });

    after(async () => {
      await closeDisposableDbClient(client);
    });

    test("all direct meeting and formal-output boundaries deny with zero writes", async () => {
      const suffix = randomUUID();
      const organization = await client.prisma.organization.create({
        data: { name: `M1 B2 ${suffix}`, slug: `m1-b2-${suffix}` },
      });
      const circle = await client.prisma.circle.create({
        data: {
          organizationId: organization.id,
          name: "Root",
          number: "ZERO",
          type: "STRATEGY",
          purpose: "M1-B2 fixture",
        },
      });
      const person = await client.prisma.person.create({
        data: { organizationId: organization.id, name: "Setup participant", homeCircleId: circle.id },
      });
      const existingMeeting = await client.prisma.meeting.create({
        data: {
          organizationId: organization.id,
          title: "Direct fixture meeting",
          type: "TACTICAL",
          durationMin: 30,
          startedAt: new Date("2026-07-20T09:00:00.000Z"),
          circleId: circle.id,
          agenda: "Lifecycle denial fixture",
          participants: { connect: { id: person.id } },
        },
      });

      try {
        const beforeCounts = await counts(client, organization.id, existingMeeting.id);
        const actor = { id: person.id, organizationId: organization.id };

        const createResult = await withMeetingActionTestDependencies({
          prisma: client.prisma,
          getCurrentOrgId: async () => organization.id,
          getCurrentPerson: async () => actor,
          notifyMeetingParticipants: async () => { throw new Error("unexpected notification"); },
          revalidatePath: () => {},
          redirect: () => {},
        }, () => createMeetingAction(undefined, meetingForm(person.id)));
        assert.deepEqual(createResult, { error: "组织尚未启用，不能发起会议" });

        const endResult = await withCollaborationActionTestDependencies({
          prisma: client.prisma,
          getCurrentOrgId: async () => organization.id,
          getCurrentPerson: async () => actor,
          revalidatePath: () => {},
        }, () => endMeetingAction(existingMeeting.id, undefined));
        assert.deepEqual(endResult, { error: "组织尚未启用，不能进行会议操作" });

        const decisionResult = await withTacticalOutcomeActionTestDependencies({
          prisma: client.prisma,
          getCurrentOrgId: async () => organization.id,
          getCurrentPerson: async () => actor,
          revalidatePath: () => {},
        }, () => recordTacticalOutcomeDecisionAction("missing-proposal", existingMeeting.id, null, decisionForm()));
        assert.deepEqual(decisionResult, { error: "组织尚未启用，不能进行会议操作" });

        await assert.rejects(
          client.prisma.$transaction(
            (tx) => submitTacticalOutcomeProposal(tx, {
              organizationId: organization.id,
              actorId: person.id,
              tensionId: "missing-tension",
              meetingId: existingMeeting.id,
              expectedRevision: 0,
              mutationKey: `proposal-${suffix}`,
              kind: "PROJECT",
              title: "Denied project",
              description: "No write",
              circleId: circle.id,
              responsiblePersonId: person.id,
              deadline: null,
            }),
            { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
          ),
          (error: unknown) => error instanceof DomainOperationError && error.code === MEETING_LIFECYCLE_DENIAL_CODE,
        );

        const governanceInput = {
          organizationId: organization.id,
          proposalId: "missing-governance-proposal",
          provenanceKind: "INTERFACE_RUN",
          runId: "missing-run",
          meetingId: existingMeeting.id,
          proposalArtifactId: "missing-proposal-artifact",
          routeArtifactId: "missing-route-artifact",
          actorId: person.id,
          expectedRevision: 1,
          operation: "ADOPT_ROLE",
          operationScope: "result",
          mutationKey: `governance-${suffix}`,
          note: "Denied during setup",
        } as GovernanceDecisionInput;
        await assert.rejects(
          executeGovernanceDecisionOperation(
            governanceInput,
            createPrismaGovernanceDecisionDependencies(client.prisma),
          ),
          (error: unknown) => error instanceof GovernanceDecisionError && error.code === MEETING_LIFECYCLE_DENIAL_CODE,
        );

        assert.deepEqual(await counts(client, organization.id, existingMeeting.id), beforeCounts);
      } finally {
        await client.prisma.meeting.deleteMany({ where: { organizationId: organization.id } });
        await client.prisma.person.deleteMany({ where: { organizationId: organization.id } });
        await client.prisma.circle.deleteMany({ where: { organizationId: organization.id } });
        await client.prisma.organization.delete({ where: { id: organization.id } });
      }
    });
  });
}
