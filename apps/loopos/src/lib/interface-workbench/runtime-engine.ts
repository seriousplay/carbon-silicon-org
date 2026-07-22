import type { CompiledRuntimeNode, CompiledWorkflow } from "./protocol";

export type RuntimeEvidenceValue =
  | string
  | number
  | boolean
  | null
  | RuntimeEvidenceValue[]
  | { [key: string]: RuntimeEvidenceValue };

export type RuntimeEvidence = Readonly<Record<string, RuntimeEvidenceValue>>;

export type RuntimeCommand = {
  kind: string;
  payload?: unknown;
};

export type RuntimeStatus = "ACTIVE" | "WAITING" | "COMPLETED" | "TERMINATED" | "PAUSED";

export type RuntimeEvent =
  | { type: "COMMAND_ACCEPTED"; nodeId: string; nodeVisit: number; commandKind: string }
  | { type: "EVIDENCE_RECORDED"; nodeId: string; nodeVisit: number; fields: string[] }
  | { type: "CONDITION_EVALUATED"; nodeId: string; nodeVisit: number; result: boolean }
  | { type: "NODE_TRANSITIONED"; edgeId: string; fromNodeId: string; toNodeId: string; toNodeVisit: number }
  | { type: "WAITING_FOR_ROLE"; nodeId: string; nodeVisit: number; roleId: string }
  | { type: "SIDE_EFFECT_COMPLETED"; nodeId: string; nodeVisit: number; operation: "raise_tension" | "route_tactical_meeting" | "mark_governance_candidate" | "route_governance_meeting" }
  | { type: "COMPLETED"; nodeId: string; nodeVisit: number; outcome: string }
  | { type: "TERMINATED"; nodeId: string; nodeVisit: number; reason: string }
  | { type: "LOOP_LIMIT"; nodeId: string; nodeVisit: number; limit: number };

export type RuntimeTransitionInput = {
  workflow: CompiledWorkflow;
  currentNodeId: string;
  currentNodeVisit: number;
  evidence: RuntimeEvidence;
  command: RuntimeCommand | null;
};

export type RuntimeTransitionErrorCode =
  | "INVALID_COMMAND"
  | "INVALID_WORKFLOW"
  | "UNSUPPORTED_NODE"
  | "UNSUPPORTED_SIDE_EFFECT";

export type RuntimeTransitionResult =
  | {
      ok: true;
      nextNodeId: string;
      nextNodeVisit: number;
      status: RuntimeStatus;
      evidencePatch: Record<string, RuntimeEvidenceValue>;
      waitingRoleId: string | null;
      events: RuntimeEvent[];
    }
  | {
      ok: false;
      error: {
        code: RuntimeTransitionErrorCode;
        nodeId: string;
        message: string;
      };
    };

const AUTOMATIC_TRANSITION_LIMIT = 32;
const SIDE_EFFECT_NODE_TYPES = new Set<CompiledRuntimeNode["type"]>([
  "raise_tension",
  "route_tactical_meeting",
  "create_project",
  "create_action",
  "mark_governance_candidate",
  "route_governance_meeting",
]);
const ENABLED_SIDE_EFFECT_NODE_TYPES = new Set<CompiledRuntimeNode["type"]>([
  "raise_tension",
  "route_tactical_meeting",
  "mark_governance_candidate",
  "route_governance_meeting",
]);

type EngineState = {
  nodeId: string;
  nodeVisit: number;
  evidence: Record<string, RuntimeEvidenceValue>;
  evidencePatch: Record<string, RuntimeEvidenceValue>;
  events: RuntimeEvent[];
};

export function transitionRuntime(input: RuntimeTransitionInput): RuntimeTransitionResult {
  const nodes = new Map(input.workflow.nodes.map((node) => [node.id, node]));
  const initialNode = nodes.get(input.currentNodeId);
  if (!initialNode) return invalidWorkflow(input.currentNodeId, "Current node does not exist in the compiled workflow");

  const state: EngineState = {
    nodeId: input.currentNodeId,
    nodeVisit: input.currentNodeVisit,
    evidence: { ...input.evidence },
    evidencePatch: {},
    events: [],
  };

  const unsupported = unsupportedNode(initialNode);
  if (unsupported) return unsupported;

  if (initialNode.type === "structured_evidence_input") {
    const evidence = parseEvidenceCommand(initialNode, input.command);
    if (!evidence.ok) return evidence.result;
    Object.assign(state.evidence, evidence.values);
    Object.assign(state.evidencePatch, evidence.values);
    state.events.push(
      commandAccepted(state, input.command!.kind),
      {
        type: "EVIDENCE_RECORDED",
        nodeId: state.nodeId,
        nodeVisit: state.nodeVisit,
        fields: Object.keys(evidence.values).sort(compareCodeUnits),
      },
    );
    const moved = followEdge(input.workflow, state, nodes);
    if (!moved.ok) return moved.result;
  } else if (initialNode.type === "human_confirmation") {
    if (!isCommand(input.command, "CONFIRM") || input.command.payload !== undefined) {
      return invalidCommand(initialNode.id, "human_confirmation requires CONFIRM without a payload");
    }
    state.events.push(commandAccepted(state, input.command.kind));
    const moved = followEdge(input.workflow, state, nodes);
    if (!moved.ok) return moved.result;
  } else if (initialNode.type === "wait_for_role") {
    if (input.command === null) return waiting(state, initialNode.config as { roleId: string });
    if (!isCommand(input.command, "RESUME") || input.command.payload !== undefined) {
      return invalidCommand(initialNode.id, "wait_for_role requires RESUME without a payload");
    }
    state.events.push(commandAccepted(state, input.command.kind));
    const moved = followEdge(input.workflow, state, nodes);
    if (!moved.ok) return moved.result;
  } else if (ENABLED_SIDE_EFFECT_NODE_TYPES.has(initialNode.type)) {
    if (input.command === null) return success(state, "ACTIVE", null);
    if (!isCommand(input.command, "EXECUTE_SIDE_EFFECT")) {
      return invalidCommand(initialNode.id, `${initialNode.type} requires EXECUTE_SIDE_EFFECT`);
    }
    state.events.push(
      commandAccepted(state, input.command.kind),
      {
        type: "SIDE_EFFECT_COMPLETED",
        nodeId: state.nodeId,
        nodeVisit: state.nodeVisit,
        operation: initialNode.type as "raise_tension" | "route_tactical_meeting" | "mark_governance_candidate" | "route_governance_meeting",
      },
    );
    const moved = followEdge(input.workflow, state, nodes);
    if (!moved.ok) return moved.result;
  } else if (input.command !== null) {
    return invalidCommand(initialNode.id, `${initialNode.type} does not accept commands`);
  }

  let automaticTransitions = 0;
  while (true) {
    const node = nodes.get(state.nodeId);
    if (!node) return invalidWorkflow(state.nodeId, "Transition target does not exist in the compiled workflow");
    const unsupportedCurrent = unsupportedNode(node);
    if (unsupportedCurrent) return unsupportedCurrent;

    if (node.type === "structured_evidence_input" || node.type === "human_confirmation") {
      return success(state, "ACTIVE", null);
    }
    if (node.type === "wait_for_role") return waiting(state, node.config as { roleId: string });
    if (ENABLED_SIDE_EFFECT_NODE_TYPES.has(node.type)) return success(state, "ACTIVE", null);
    if (node.type === "complete") {
      state.events.push({
        type: "COMPLETED",
        nodeId: state.nodeId,
        nodeVisit: state.nodeVisit,
        outcome: (node.config as { outcome: string }).outcome,
      });
      return success(state, "COMPLETED", null);
    }
    if (node.type === "terminate") {
      state.events.push({
        type: "TERMINATED",
        nodeId: state.nodeId,
        nodeVisit: state.nodeVisit,
        reason: (node.config as { reason: string }).reason,
      });
      return success(state, "TERMINATED", null);
    }
    if (node.type !== "condition") return unsupportedNode(node)!;

    if (automaticTransitions === AUTOMATIC_TRANSITION_LIMIT) {
      state.events.push({
        type: "LOOP_LIMIT",
        nodeId: state.nodeId,
        nodeVisit: state.nodeVisit,
        limit: AUTOMATIC_TRANSITION_LIMIT,
      });
      return success(state, "PAUSED", null);
    }

    const condition = evaluateCondition(node, state.evidence);
    state.events.push({
      type: "CONDITION_EVALUATED",
      nodeId: state.nodeId,
      nodeVisit: state.nodeVisit,
      result: condition,
    });
    const moved = followEdge(input.workflow, state, nodes, condition ? "true" : "false");
    if (!moved.ok) return moved.result;
    automaticTransitions += 1;
  }
}

function parseEvidenceCommand(
  node: CompiledRuntimeNode,
  command: RuntimeCommand | null,
):
  | { ok: true; values: Record<string, RuntimeEvidenceValue> }
  | { ok: false; result: RuntimeTransitionResult } {
  if (!isCommand(command, "SUBMIT_EVIDENCE") || !isObject(command.payload)) {
    return { ok: false, result: invalidCommand(node.id, "structured_evidence_input requires SUBMIT_EVIDENCE with an evidence payload") };
  }
  const keys = Object.keys(command.payload);
  if (keys.length !== 1 || keys[0] !== "evidence" || !isObject(command.payload.evidence)) {
    return { ok: false, result: invalidCommand(node.id, "SUBMIT_EVIDENCE payload must contain only an evidence object") };
  }
  const payloadEvidence = command.payload.evidence;
  const configuredFields = (node.config as { fields: string[] }).fields;
  const submittedFields = Object.keys(payloadEvidence);
  if (
    configuredFields.some((field) => !Object.hasOwn(payloadEvidence, field)) ||
    submittedFields.some((field) => !configuredFields.includes(field))
  ) {
    return { ok: false, result: invalidCommand(node.id, "Submitted evidence must exactly match the configured fields") };
  }
  if (submittedFields.some((field) => !isRuntimeEvidenceValue(payloadEvidence[field]))) {
    return { ok: false, result: invalidCommand(node.id, "Submitted evidence must contain JSON-compatible values") };
  }
  return { ok: true, values: payloadEvidence as Record<string, RuntimeEvidenceValue> };
}

function evaluateCondition(node: CompiledRuntimeNode, evidence: RuntimeEvidence): boolean {
  const config = node.config as {
    field: string;
    operator: "equals" | "not_equals" | "exists";
    value?: string | number | boolean;
  };
  const exists = Object.hasOwn(evidence, config.field);
  if (config.operator === "exists") return exists;
  const equals = exists && evidence[config.field] === config.value;
  return config.operator === "equals" ? equals : !equals;
}

function followEdge(
  workflow: CompiledWorkflow,
  state: EngineState,
  nodes: Map<string, CompiledRuntimeNode>,
  branch?: "true" | "false",
): { ok: true } | { ok: false; result: RuntimeTransitionResult } {
  const outgoing = workflow.adjacency[state.nodeId] ?? [];
  const matches = outgoing.filter((edge) => edge.branch === branch);
  if (matches.length !== 1) {
    return { ok: false, result: invalidWorkflow(state.nodeId, "Current node must have exactly one matching outgoing edge") };
  }
  const edge = matches[0];
  if (!nodes.has(edge.to)) {
    return { ok: false, result: invalidWorkflow(state.nodeId, `Edge ${edge.edgeId} targets an unknown node`) };
  }
  const fromNodeId = state.nodeId;
  state.nodeId = edge.to;
  state.nodeVisit += 1;
  state.events.push({
    type: "NODE_TRANSITIONED",
    edgeId: edge.edgeId,
    fromNodeId,
    toNodeId: state.nodeId,
    toNodeVisit: state.nodeVisit,
  });
  return { ok: true };
}

function unsupportedNode(node: CompiledRuntimeNode): RuntimeTransitionResult | null {
  if (ENABLED_SIDE_EFFECT_NODE_TYPES.has(node.type)) return null;
  if (SIDE_EFFECT_NODE_TYPES.has(node.type) && !ENABLED_SIDE_EFFECT_NODE_TYPES.has(node.type)) {
    return {
      ok: false,
      error: {
        code: "UNSUPPORTED_SIDE_EFFECT",
        nodeId: node.id,
        message: `${node.type} side effects are not supported by this runtime slice`,
      },
    };
  }
  if (
    node.type !== "structured_evidence_input" &&
    node.type !== "human_confirmation" &&
    node.type !== "condition" &&
    node.type !== "wait_for_role" &&
    node.type !== "complete" &&
    node.type !== "terminate"
  ) {
    return {
      ok: false,
      error: { code: "UNSUPPORTED_NODE", nodeId: node.id, message: `${node.type} is not supported by this runtime slice` },
    };
  }
  return null;
}

function waiting(state: EngineState, config: { roleId: string }): RuntimeTransitionResult {
  state.events.push({
    type: "WAITING_FOR_ROLE",
    nodeId: state.nodeId,
    nodeVisit: state.nodeVisit,
    roleId: config.roleId,
  });
  return success(state, "WAITING", config.roleId);
}

function success(state: EngineState, status: RuntimeStatus, waitingRoleId: string | null): RuntimeTransitionResult {
  return {
    ok: true,
    nextNodeId: state.nodeId,
    nextNodeVisit: state.nodeVisit,
    status,
    evidencePatch: state.evidencePatch,
    waitingRoleId,
    events: state.events,
  };
}

function commandAccepted(state: EngineState, commandKind: string): RuntimeEvent {
  return {
    type: "COMMAND_ACCEPTED",
    nodeId: state.nodeId,
    nodeVisit: state.nodeVisit,
    commandKind,
  };
}

function invalidCommand(nodeId: string, message: string): RuntimeTransitionResult {
  return { ok: false, error: { code: "INVALID_COMMAND", nodeId, message } };
}

function invalidWorkflow(nodeId: string, message: string): RuntimeTransitionResult {
  return { ok: false, error: { code: "INVALID_WORKFLOW", nodeId, message } };
}

function isCommand(command: RuntimeCommand | null, kind: string): command is RuntimeCommand {
  return command?.kind === kind;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRuntimeEvidenceValue(value: unknown): value is RuntimeEvidenceValue {
  if (value === null || ["string", "number", "boolean"].includes(typeof value)) return true;
  if (Array.isArray(value)) return value.every(isRuntimeEvidenceValue);
  return isObject(value) && Object.values(value).every(isRuntimeEvidenceValue);
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
