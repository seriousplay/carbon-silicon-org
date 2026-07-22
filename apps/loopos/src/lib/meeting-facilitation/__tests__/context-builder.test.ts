import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  buildMeetingContext,
  type MeetingContextLoader,
  type MeetingContextSnapshot,
} from "../context-builder";

const input = { organizationId: "org-1", meetingId: "meeting-1", actorPersonId: "person-1" } as const;

describe("meeting context builder", () => {
  test("accepts a tenant-bound snapshot with unique evidence references", async () => {
    const snapshot = tacticalSnapshot();
    const loader: MeetingContextLoader = { load: async () => snapshot };
    assert.equal((await buildMeetingContext(input, loader)).facts[0]?.ref, "meeting:meeting-1");
  });

  test("rejects tenant mismatch and duplicate evidence references", async () => {
    await assert.rejects(
      buildMeetingContext(input, {
        load: async () => ({ ...tacticalSnapshot(), organizationId: "org-2" }),
      }),
      /MEETING_CONTEXT_TENANT_MISMATCH/,
    );
    const snapshot = tacticalSnapshot();
    await assert.rejects(
      buildMeetingContext(input, {
        load: async () => ({ ...snapshot, facts: [...snapshot.facts, snapshot.facts[0]!] }),
      }),
      /MEETING_CONTEXT_EVIDENCE_REF_INVALID/,
    );
  });
});

function tacticalSnapshot(): MeetingContextSnapshot {
  return {
    organizationId: "org-1",
    meetingId: "meeting-1",
    engine: "TACTICAL",
    title: "Weekly tactical",
    phase: "TRIAGE_ITEM",
    revision: 8,
    paused: false,
    activeAgendaItemId: "agenda-1",
    participantRoleIds: { "participant-1": ["role-product"] },
    agenda: [{ id: "agenda-1", label: "launch", ownerParticipantId: "participant-1" }],
    recentEvents: [{ sequence: 9, type: "AGENDA_NEED_CONFIRMED", payload: { itemId: "agenda-1" } }],
    recentMessages: [{
      id: "message-1",
      participantId: "participant-1",
      roleId: "role-product",
      phase: "TRIAGE_ITEM",
      content: "I need a release owner.",
    }],
    facts: [
      { ref: "meeting:meeting-1", category: "MEETING", label: "Weekly tactical", value: { durationMin: 30 } },
      { ref: "role:role-product", category: "ROLE", label: "Product", value: { accountabilities: "Own release" } },
      { ref: "project:project-1", category: "PROJECT", label: "Launch", value: { status: "ACTIVE" } },
    ],
  };
}
