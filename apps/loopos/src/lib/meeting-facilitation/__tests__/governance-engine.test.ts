import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  effectiveObjectionValidity,
  initialGovernanceMeetingState,
  transitionGovernanceMeeting,
  type GovernanceMeetingState,
} from "../governance-engine";

const participants = ["alice", "bob", "cara"] as const;
type GovernanceActionWithoutRevision = Parameters<typeof transitionGovernanceMeeting>[1] extends infer Action
  ? Action extends unknown
    ? Omit<Action, "expectedRevision">
    : never
  : never;

function initial(): GovernanceMeetingState {
  return initialGovernanceMeetingState({
    participantIds: participants,
    representedRoleIdsByParticipant: {
      alice: ["role-product", "role-research"],
      bob: ["role-data"],
      cara: ["role-ops"],
    },
  });
}

function act(state: GovernanceMeetingState, action: GovernanceActionWithoutRevision) {
  return transitionGovernanceMeeting(state, { ...action, expectedRevision: state.revision } as Parameters<typeof transitionGovernanceMeeting>[1]);
}

function completeParticipants(state: GovernanceMeetingState, participantIds: readonly string[]): GovernanceMeetingState {
  let current = state;
  for (const participantId of participantIds) current = act(current, { type: "COMPLETE_TURN", actorId: participantId }).state;
  return current;
}

function toObjectionRound(): GovernanceMeetingState {
  let state = act(initial(), { type: "START", actorId: "alice" }).state;
  state = completeParticipants(state, participants);
  state = act(state, {
    type: "ADD_AGENDA_ITEM",
    actorId: "alice",
    item: { id: "item-1", ownerParticipantId: "alice", ownerRoleId: "role-product", label: "role clarity", status: "PENDING" },
  }).state;
  state = completeParticipants(state, participants);
  state = act(state, { type: "PRESENT_PROPOSAL", actorId: "alice", itemId: "item-1", proposalRevision: 1 }).state;
  state = completeParticipants(state, participants);
  state = completeParticipants(state, ["bob", "cara"]);
  state = act(state, { type: "PROPOSER_DECISION", actorId: "alice", amended: false, proposalRevision: 1 }).state;
  assert.equal(state.phase, "OBJECTION_ROUND");
  return state;
}

describe("governance meeting engine", () => {
  test("lets a proposer use any role represented in this meeting", () => {
    let state = act(initial(), { type: "START", actorId: "alice" }).state;
    state = completeParticipants(state, participants);
    state = act(state, {
      type: "ADD_AGENDA_ITEM",
      actorId: "alice",
      item: { id: "item-2", ownerParticipantId: "alice", ownerRoleId: "role-research", label: "research role", status: "PENDING" },
    }).state;
    assert.equal(state.agenda[0]?.ownerRoleId, "role-research");
  });

  test("protects proposer-only steps and excludes proposer from reaction round", () => {
    let state = act(initial(), { type: "START", actorId: "alice" }).state;
    state = completeParticipants(state, participants);
    state = act(state, {
      type: "ADD_AGENDA_ITEM",
      actorId: "alice",
      item: { id: "item-1", ownerParticipantId: "alice", ownerRoleId: "role-product", label: "role clarity", status: "PENDING" },
    }).state;
    state = completeParticipants(state, participants);
    assert.throws(() => act(state, { type: "PRESENT_PROPOSAL", actorId: "bob", itemId: "item-1", proposalRevision: 1 }), /ONLY_PROPOSER/);
    state = act(state, { type: "PRESENT_PROPOSAL", actorId: "alice", itemId: "item-1", proposalRevision: 1 }).state;
    state = completeParticipants(state, participants);
    assert.equal(state.phase, "REACTION_ROUND");
    assert.throws(() => act(state, { type: "COMPLETE_TURN", actorId: "alice" }), /ACTOR_HAS_NO_TURN/);
  });

  test("lets any participant overturn AI while conflicting human stances remain valid", () => {
    let state = toObjectionRound();
    state = act(state, { type: "RECORD_OBJECTION", actorId: "bob", objectionId: "obj-1", statement: "This blocks my role from publishing required data." }).state;
    state = completeParticipants(state, participants);
    assert.equal(state.phase, "AI_ASSESSMENT");
    state = act(state, { type: "RECORD_AI_ASSESSMENT", actorId: "alice", objectionId: "obj-1", validity: "INVALID" }).state;
    state = act(state, { type: "CONFIRM_AI_ASSESSMENTS", actorId: "cara" }).state;
    state = act(state, { type: "RECORD_HUMAN_STANCE", actorId: "bob", objectionId: "obj-1", validity: "VALID" }).state;
    state = act(state, { type: "RECORD_HUMAN_STANCE", actorId: "cara", objectionId: "obj-1", validity: "INVALID" }).state;
    assert.equal(effectiveObjectionValidity(state.objections[0]!), true);
    state = act(state, { type: "CONFIRM_DISTRIBUTED_REVIEW", actorId: "alice" }).state;
    assert.equal(state.phase, "INTEGRATION");
  });

  test("a unanimous human override can invalidate an AI-valid objection", () => {
    let state = toObjectionRound();
    state = act(state, { type: "RECORD_OBJECTION", actorId: "bob", objectionId: "obj-1", statement: "The proposal is not optimal." }).state;
    state = completeParticipants(state, participants);
    state = act(state, { type: "RECORD_AI_ASSESSMENT", actorId: "cara", objectionId: "obj-1", validity: "VALID" }).state;
    state = act(state, { type: "CONFIRM_AI_ASSESSMENTS", actorId: "alice" }).state;
    state = act(state, { type: "RECORD_HUMAN_STANCE", actorId: "bob", objectionId: "obj-1", validity: "INVALID" }).state;
    assert.equal(effectiveObjectionValidity(state.objections[0]!), false);
    state = act(state, { type: "CONFIRM_DISTRIBUTED_REVIEW", actorId: "cara" }).state;
    assert.equal(state.phase, "ADOPTION_CONFIRMATION");
  });

  test("integration requires both confirmations and restarts a full objection round", () => {
    let state = toObjectionRound();
    state = act(state, { type: "RECORD_OBJECTION", actorId: "bob", objectionId: "obj-1", statement: "The proposal removes authority my role needs." }).state;
    state = completeParticipants(state, participants);
    state = act(state, { type: "RECORD_AI_ASSESSMENT", actorId: "alice", objectionId: "obj-1", validity: "VALID" }).state;
    state = act(state, { type: "CONFIRM_AI_ASSESSMENTS", actorId: "alice" }).state;
    state = act(state, { type: "CONFIRM_DISTRIBUTED_REVIEW", actorId: "cara" }).state;
    assert.throws(() => act(state, { type: "CONFIRM_INTEGRATION", actorId: "alice", objectionId: "obj-1", capacity: "OBJECTOR", proposalRevision: 2 }), /ONLY_OBJECTOR/);
    state = act(state, { type: "CONFIRM_INTEGRATION", actorId: "bob", objectionId: "obj-1", capacity: "OBJECTOR", proposalRevision: 2 }).state;
    assert.equal(state.phase, "INTEGRATION");
    assert.equal(state.objections[0]?.objectorConfirmed, true);
    state = act(state, { type: "CONFIRM_INTEGRATION", actorId: "alice", objectionId: "obj-1", capacity: "PROPOSER", proposalRevision: 2 }).state;
    assert.equal(state.phase, "OBJECTION_ROUND");
    assert.equal(state.proposalRevision, 2);
    assert.equal(state.objections.length, 0);
  });

  test("adoption and meeting completion both require explicit human confirmation", () => {
    let state = toObjectionRound();
    state = completeParticipants(state, participants);
    assert.equal(state.phase, "ADOPTION_CONFIRMATION");
    const adopted = act(state, { type: "CONFIRM_ADOPTION", actorId: "cara" });
    assert.equal(adopted.effects[0]?.type, "ADOPT_GOVERNANCE_PROPOSAL");
    state = adopted.state;
    assert.equal(state.phase, "CLOSING_ROUND");
    state = completeParticipants(state, participants);
    const completed = act(state, { type: "CONFIRM_END", actorId: "bob" });
    assert.equal(completed.state.phase, "COMPLETED");
    assert.equal(completed.effects[0]?.type, "END_MEETING");
  });
});
