import {
  BRAIN_COMMAND_NAMES,
  BRAIN_COMMAND_REGISTRY,
  BrainCommandValidationError,
  parseBrainCommandInput,
  type BrainCommandName,
} from "./command-registry";
import type {
  BrainCapabilityDefinition,
  BrainCapabilityHandlerId,
  BrainCapabilityRequest,
} from "./capability-types";

const DEFINITIONS: Readonly<Record<BrainCommandName, Omit<BrainCapabilityDefinition, "command">>> = {
  "goal_proposal.create_draft": {
    id: "goal_proposal.create_draft", schemaVersion: 1, reads: ["goal_cycle", "circle", "role"], authority: "DRAFT",
    requiresConfirmation: true, processGate: "GOAL_CYCLE", handlerId: "goal-command-handler.create-goal-proposal",
    idempotency: "REQUIRED", auditEvent: "brain.goal_proposal.created", artifact: "GOAL_PROPOSAL", fallback: "SAVE_DRAFT",
  },
  "goal_proposal.append_returned_revision": {
    id: "goal_proposal.append_returned_revision", schemaVersion: 1, reads: ["goal_proposal"], authority: "PROPOSE",
    requiresConfirmation: true, processGate: "GOAL_CYCLE", handlerId: "goal-command-handler.append-goal-proposal-revision",
    idempotency: "REQUIRED", auditEvent: "brain.goal_proposal.revised", artifact: "GOAL_PROPOSAL", fallback: "SAVE_DRAFT",
  },
  "goal_check_in.append": {
    id: "goal_check_in.append", schemaVersion: 1, reads: ["goal", "goal_target", "goal_check_in"], authority: "APPEND_EVIDENCE",
    requiresConfirmation: true, processGate: "GOAL_CYCLE", handlerId: "goal-command-handler.append-goal-check-in",
    idempotency: "REQUIRED", auditEvent: "brain.goal_check_in.appended", artifact: "GOAL_CHECK_IN", fallback: "EXPLAIN_AND_LINK",
  },
  "tension.raise": {
    id: "tension.raise", schemaVersion: 1, reads: ["circle", "role"], authority: "PROPOSE",
    requiresConfirmation: true, processGate: "NONE", handlerId: "goal-command-handler.raise-tension",
    idempotency: "REQUIRED", auditEvent: "brain.tension.raised", artifact: "TENSION", fallback: "EXPLAIN_AND_LINK",
  },
  "tactical_outcome.submit_proposal": {
    id: "tactical_outcome.submit_proposal", schemaVersion: 1, reads: ["tension", "meeting", "circle", "role"], authority: "PROPOSE",
    requiresConfirmation: true, processGate: "TACTICAL_MEETING", handlerId: "goal-command-handler.submit-tactical-outcome-proposal",
    idempotency: "REQUIRED", auditEvent: "brain.tactical_outcome.proposed", artifact: "TACTICAL_OUTCOME_PROPOSAL", fallback: "EXPLAIN_AND_LINK",
  },
  "meeting_notes.update": {
    id: "meeting_notes.update", schemaVersion: 1, reads: ["meeting"], authority: "APPEND_EVIDENCE",
    requiresConfirmation: true, processGate: "TACTICAL_MEETING", handlerId: "goal-command-handler.update-meeting-notes",
    idempotency: "REQUIRED", auditEvent: "brain.meeting_notes.updated", artifact: "MEETING_NOTES", fallback: "EXPLAIN_AND_LINK",
  },
  "governance_proposal.create": {
    id: "governance_proposal.create", schemaVersion: 1, reads: ["tension", "meeting", "circle", "role"], authority: "PROPOSE",
    requiresConfirmation: true, processGate: "GOVERNANCE_MEETING", handlerId: "goal-command-handler.create-governance-proposal",
    idempotency: "REQUIRED", auditEvent: "brain.governance_proposal.created", artifact: "GOVERNANCE_PROPOSAL", fallback: "EXPLAIN_AND_LINK",
  },
  "role_application.create": {
    id: "role_application.create", schemaVersion: 1, reads: ["role"], authority: "PROPOSE",
    requiresConfirmation: true, processGate: "NONE", handlerId: "goal-command-handler.create-role-application",
    idempotency: "REQUIRED", auditEvent: "brain.role_application.created", artifact: "ROLE_APPLICATION", fallback: "EXPLAIN_AND_LINK",
  },
};

function freezeDefinition(id: BrainCommandName): BrainCapabilityDefinition {
  const definition = { ...DEFINITIONS[id], command: BRAIN_COMMAND_REGISTRY[id] };
  return Object.freeze({ ...definition, reads: Object.freeze([...definition.reads]) });
}

export const BRAIN_CAPABILITY_REGISTRY: Readonly<Record<BrainCommandName, BrainCapabilityDefinition>> =
  Object.freeze(Object.fromEntries(BRAIN_COMMAND_NAMES.map((id) => [id, freezeDefinition(id)])) as Record<BrainCommandName, BrainCapabilityDefinition>);

export function resolveBrainCapability(request: Readonly<{ id: string; schemaVersion: number }>): BrainCapabilityDefinition {
  if (!Object.hasOwn(BRAIN_CAPABILITY_REGISTRY, request.id)) {
    throw new BrainCommandValidationError("INVALID_COMMAND");
  }
  const definition = BRAIN_CAPABILITY_REGISTRY[request.id as BrainCommandName];
  if (request.schemaVersion !== definition.schemaVersion) {
    throw new BrainCommandValidationError("INVALID_INPUT");
  }
  return definition;
}

export function parseBrainCapabilityRequest(request: BrainCapabilityRequest) {
  const definition = resolveBrainCapability(request);
  const parsed = parseBrainCommandInput({ schemaVersion: request.schemaVersion, command: request.id, input: request.input });
  return Object.freeze({ definition, parsedInput: parsed.input });
}

export function isBrainCapabilityHandlerId(value: string): value is BrainCapabilityHandlerId {
  return Object.values(BRAIN_CAPABILITY_REGISTRY).some((definition) => definition.handlerId === value);
}
