import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { Prisma } from "@/generated/prisma/client";

import { assertGovernanceFacilitationGate, assertTacticalFacilitationGate } from "../domain-gates";
import type { GovernanceMeetingState } from "../governance-engine";
import type { TacticalMeetingState } from "../tactical-engine";

describe("meeting facilitation domain gates", () => {
  test("keeps legacy meetings compatible when no facilitation session exists", async () => {
    const client = fakeClient({ session: null });
    await assert.doesNotReject(assertTacticalFacilitationGate(client, {
      organizationId: "org-1",
      meetingId: "meeting-1",
      actorPersonId: "person-a",
      tensionId: "tension-1",
      operation: "SUBMIT_CANDIDATE",
    }));
  });

  test("binds tactical output submission to the active agenda owner and receiver confirmation", async () => {
    const state = tacticalState();
    const client = fakeClient({ state, ownerParticipantId: "participant-a" });
    await assert.doesNotReject(assertTacticalFacilitationGate(client, {
      organizationId: "org-1",
      meetingId: "meeting-1",
      actorPersonId: "person-a",
      tensionId: "tension-1",
      operation: "SUBMIT_CANDIDATE",
      expectedFacilitationRevision: state.revision,
    }));
    await assert.rejects(assertTacticalFacilitationGate(client, {
      organizationId: "org-1",
      meetingId: "meeting-1",
      actorPersonId: "person-b",
      tensionId: "tension-1",
      operation: "SUBMIT_CANDIDATE",
      expectedFacilitationRevision: state.revision,
    }), /ONLY_AGENDA_OWNER/);
    await assert.rejects(assertTacticalFacilitationGate(client, {
      organizationId: "org-1",
      meetingId: "meeting-1",
      actorPersonId: "person-a",
      tensionId: "tension-1",
      operation: "CONFIRM_OUTPUT",
      responsiblePersonId: "person-b",
      expectedFacilitationRevision: state.revision,
    }), /ONLY_OUTPUT_RECEIVER/);
  });

  test("allows distributed governance adoption only at the matching revision with no valid objection", async () => {
    const ready = governanceState();
    const readyClient = fakeClient({ state: ready, linkedProposalId: "proposal-1" });
    await assert.doesNotReject(assertGovernanceFacilitationGate(readyClient, {
      organizationId: "org-1",
      meetingId: "meeting-1",
      actorPersonId: "person-b",
      proposalId: "proposal-1",
      proposalRevision: 2,
      operation: "ADOPT_ROLE",
      expectedFacilitationRevision: ready.revision,
    }));

    const blocked: GovernanceMeetingState = {
      ...ready,
      objections: [{
        id: "objection-1",
        objectorParticipantId: "participant-b",
        proposalRevision: 2,
        statement: "The proposal removes publishing authority.",
        aiValidity: "INVALID",
        humanStances: { "participant-a": "INVALID", "participant-b": "VALID" },
        integrationRevision: null,
        objectorConfirmed: false,
        proposerConfirmed: false,
        integrated: false,
      }],
    };
    await assert.rejects(assertGovernanceFacilitationGate(
      fakeClient({ state: blocked, linkedProposalId: "proposal-1" }),
      {
        organizationId: "org-1",
        meetingId: "meeting-1",
        actorPersonId: "person-a",
        proposalId: "proposal-1",
        proposalRevision: 2,
        operation: "ADOPT_ROLE",
        expectedFacilitationRevision: blocked.revision,
      },
    ), /VALID_OBJECTION_REMAINS/);
  });
});

function fakeClient(input: {
  session?: null;
  state?: TacticalMeetingState | GovernanceMeetingState;
  ownerParticipantId?: string;
  linkedProposalId?: string;
}) {
  const participantByPerson: Record<string, string> = {
    "person-a": "participant-a",
    "person-b": "participant-b",
  };
  return {
    meetingFacilitationSession: {
      findFirst: async () => input.session === null
        ? null
        : {
            revision: input.state!.revision,
            phaseState: input.state!,
            activeAgendaItemId: input.state!.activeAgendaItemId,
            engineType: input.state!.engine,
          },
    },
    meetingParticipant: {
      findFirst: async (query: { where: { personId: string } }) => ({
        id: participantByPerson[query.where.personId],
      }),
    },
    meetingAgendaItem: {
      findFirst: async (query: { where: { linkedTensionId?: string; linkedProposalId?: string } }) => {
        if (query.where.linkedTensionId && query.where.linkedTensionId !== "tension-1") return null;
        if (query.where.linkedProposalId && query.where.linkedProposalId !== input.linkedProposalId) return null;
        return { id: "agenda-1", ownerParticipantId: input.ownerParticipantId ?? "participant-a" };
      },
    },
  } as unknown as Pick<
    Prisma.TransactionClient,
    "meetingFacilitationSession" | "meetingParticipant" | "meetingAgendaItem"
  >;
}

function tacticalState(): TacticalMeetingState {
  return {
    engine: "TACTICAL",
    phase: "TRIAGE_ITEM",
    revision: 7,
    paused: false,
    participantIds: ["participant-a", "participant-b"],
    representedRoleIdsByParticipant: { "participant-a": ["role-a"], "participant-b": ["role-b"] },
    completedParticipantIds: [],
    agenda: [{ id: "agenda-1", ownerParticipantId: "participant-a", ownerRoleId: "role-a", label: "launch", status: "ACTIVE" }],
    activeAgendaItemId: "agenda-1",
  };
}

function governanceState(): GovernanceMeetingState {
  return {
    engine: "GOVERNANCE",
    phase: "ADOPTION_CONFIRMATION",
    revision: 12,
    paused: false,
    participantIds: ["participant-a", "participant-b"],
    representedRoleIdsByParticipant: { "participant-a": ["role-a"], "participant-b": ["role-b"] },
    completedParticipantIds: [],
    agenda: [{ id: "agenda-1", ownerParticipantId: "participant-a", ownerRoleId: "role-a", label: "role", status: "ACTIVE" }],
    activeAgendaItemId: "agenda-1",
    proposerParticipantId: "participant-a",
    proposalRevision: 2,
    objections: [],
  };
}
