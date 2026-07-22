import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { initialTacticalMeetingState, transitionTacticalMeeting, type TacticalMeetingState } from "../tactical-engine";

const participants = ["alice", "bob"] as const;
type TacticalActionWithoutRevision = Parameters<typeof transitionTacticalMeeting>[1] extends infer Action
  ? Action extends unknown
    ? Omit<Action, "expectedRevision">
    : never
  : never;

function initial(): TacticalMeetingState {
  return initialTacticalMeetingState({
    participantIds: participants,
    representedRoleIdsByParticipant: { alice: ["role-product", "role-research"], bob: ["role-data"] },
  });
}

function act<State extends TacticalMeetingState>(state: State, action: TacticalActionWithoutRevision) {
  return transitionTacticalMeeting(state, { ...action, expectedRevision: state.revision } as Parameters<typeof transitionTacticalMeeting>[1]);
}

function completeRound(state: TacticalMeetingState): TacticalMeetingState {
  let current = act(state, { type: "COMPLETE_TURN", actorId: "alice" }).state;
  current = act(current, { type: "COMPLETE_TURN", actorId: "bob" }).state;
  return current;
}

describe("tactical meeting engine", () => {
  test("uses the Holacracy tactical preamble instead of governance phases", () => {
    let state = act(initial(), { type: "START", actorId: "alice" }).state;
    assert.equal(state.phase, "CHECK_IN");
    state = completeRound(state);
    assert.equal(state.phase, "CHECKLIST_REVIEW");
    state = completeRound(state);
    assert.equal(state.phase, "METRICS_REVIEW");
    state = completeRound(state);
    assert.equal(state.phase, "PROJECT_UPDATES");
    state = completeRound(state);
    assert.equal(state.phase, "BUILD_AGENDA");
    assert.equal(["PRESENT_PROPOSAL", "REACTION_ROUND", "OBJECTION_ROUND"].includes(state.phase), false);
  });

  test("only the agenda owner can confirm the need and close the item", () => {
    let state = act(initial(), { type: "START", actorId: "alice" }).state;
    for (let round = 0; round < 4; round += 1) state = completeRound(state);
    state = act(state, {
      type: "ADD_AGENDA_ITEM",
      actorId: "alice",
      item: { id: "item-1", ownerParticipantId: "alice", ownerRoleId: "role-product", label: "launch", status: "PENDING" },
    }).state;
    state = completeRound(state);
    assert.equal(state.phase, "TRIAGE_ITEM");
    assert.throws(() => act(state, { type: "CONFIRM_NEED", actorId: "bob", itemId: "item-1", need: "a next action" }), /ONLY_AGENDA_OWNER/);
    state = act(state, { type: "CONFIRM_NEED", actorId: "alice", itemId: "item-1", need: "a next action" }).state;
    assert.throws(() => act(state, { type: "CONFIRM_NEED_MET", actorId: "bob", itemId: "item-1" }), /ONLY_AGENDA_OWNER/);
    const output = act(state, { type: "CONFIRM_OUTPUT", actorId: "bob", itemId: "item-1" });
    assert.equal(output.effects[0]?.type, "CREATE_TACTICAL_OUTPUT");
    state = output.state;
    state = act(state, { type: "CONFIRM_NEED_MET", actorId: "alice", itemId: "item-1" }).state;
    assert.equal(state.phase, "CLOSING_ROUND");
  });

  test("lets an agenda owner use any role represented in this meeting", () => {
    let state = act(initial(), { type: "START", actorId: "alice" }).state;
    for (let round = 0; round < 4; round += 1) state = completeRound(state);
    state = act(state, {
      type: "ADD_AGENDA_ITEM",
      actorId: "alice",
      item: { id: "item-2", ownerParticipantId: "alice", ownerRoleId: "role-research", label: "research", status: "PENDING" },
    }).state;
    assert.equal(state.agenda[0]?.ownerRoleId, "role-research");
  });

  test("requires all closing turns and explicit human end confirmation", () => {
    let state = act(initial(), { type: "START", actorId: "alice" }).state;
    for (let round = 0; round < 5; round += 1) state = completeRound(state);
    assert.equal(state.phase, "CLOSING_ROUND");
    assert.throws(() => act(state, { type: "CONFIRM_END", actorId: "alice" }), /CLOSING_ROUND_INCOMPLETE/);
    state = completeRound(state);
    const completed = act(state, { type: "CONFIRM_END", actorId: "bob" });
    assert.equal(completed.state.phase, "COMPLETED");
    assert.equal(completed.effects[0]?.type, "END_MEETING");
  });

  test("rejects stale writes and actions while paused", () => {
    const started = act(initial(), { type: "START", actorId: "alice" }).state;
    assert.throws(() => transitionTacticalMeeting(started, { type: "COMPLETE_TURN", actorId: "alice", expectedRevision: 0 }), /STALE_MEETING_REVISION/);
    const paused = act(started, { type: "PAUSE", actorId: "bob", reason: "process question" }).state;
    assert.throws(() => act(paused, { type: "COMPLETE_TURN", actorId: "alice" }), /MEETING_PAUSED/);
    const resumed = act(paused, { type: "RESUME", actorId: "alice" }).state;
    assert.equal(resumed.paused, false);
  });
});
