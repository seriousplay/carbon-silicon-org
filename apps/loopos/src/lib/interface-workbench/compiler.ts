import { createHash } from "node:crypto";

import {
  WORKFLOW_CAPABILITIES,
  WORKFLOW_COMPILER_VERSION,
  WORKFLOW_DEFINITION_SCHEMA_VERSION,
  WORKFLOW_PROTOCOL_VERSION,
  type CompileWorkflowResult,
  type CompiledRuntimeNode,
  type CompiledWorkflow,
  type SafeWorkflowNode,
  type WorkflowCapability,
  type WorkflowDefinition,
  type WorkflowEdge,
  type WorkflowRole,
  type WorkflowValidationIssue,
} from "./protocol";
import { validateWorkflowResourceBounds } from "./bounds";

type JsonObject = Record<string, unknown>;

const NODE_RULES: Record<
  SafeWorkflowNode["type"],
  { keys: readonly string[]; roleCapability?: WorkflowCapability; sideEffect?: true }
> = {
  structured_evidence_input: { keys: ["fields", "roleId"], roleCapability: "collect_evidence" },
  attachment_input: { keys: ["allowedMimeTypes", "roleId"], roleCapability: "collect_evidence" },
  ai_extract: { keys: ["instruction", "outputFields", "roleId"], roleCapability: "use_ai" },
  human_confirmation: { keys: ["prompt", "roleId"], roleCapability: "confirm" },
  condition: { keys: ["field", "operator", "value"] },
  wait_for_role: { keys: ["request", "roleId"], roleCapability: "route" },
  raise_tension: { keys: ["confirmationNodeId", "descriptionField", "roleId", "titleField"], roleCapability: "raise_tension", sideEffect: true },
  route_tactical_meeting: { keys: ["confirmationNodeId", "roleId"], roleCapability: "route", sideEffect: true },
  create_project: { keys: ["confirmationNodeId", "nameField", "resultField", "roleId"], roleCapability: "create_project", sideEffect: true },
  create_action: { keys: ["acceptanceCriteriaField", "confirmationNodeId", "roleId", "titleField"], roleCapability: "create_action", sideEffect: true },
  mark_governance_candidate: { keys: ["confirmationNodeId", "rationaleField", "roleId"], roleCapability: "governance", sideEffect: true },
  route_governance_meeting: { keys: ["confirmationNodeId", "roleId"], roleCapability: "governance", sideEffect: true },
  complete: { keys: ["outcome"] },
  terminate: { keys: ["reason"] },
};

const TERMINAL_TYPES = new Set<SafeWorkflowNode["type"]>(["complete", "terminate"]);

export function compileWorkflow(input: unknown): CompileWorkflowResult {
  const issues = validateWorkflowResourceBounds(input);
  if (issues.length > 0) return { ok: false, issues };
  const definition = parseDefinition(input, issues);
  if (!definition) return { ok: false, issues };

  validateGraph(definition, issues);
  if (issues.length > 0) return { ok: false, issues };

  const snapshot = canonicalizeDefinition(definition);
  const sourceHash = hashCanonical(snapshot);
  const semantics = buildRuntimeSemantics(snapshot);
  const compiledHash = hashCanonical(semantics);
  const compiled: CompiledWorkflow = {
    ...semantics,
    hashes: { source: sourceHash, semantics: compiledHash },
  };
  return { ok: true, sourceHash, compiledHash, snapshot, compiled };
}

export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort(compareCodeUnits)
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function parseDefinition(input: unknown, issues: WorkflowValidationIssue[]): WorkflowDefinition | null {
  if (!isObject(input)) {
    issue(issues, "INVALID_SHAPE", "$", "Workflow must be an object");
    return null;
  }
  exactKeys(input, ["definitionSchemaVersion", "edges", "editor", "entryNodeId", "name", "nodes", "protocolVersion", "roles"], "$", issues, ["editor"]);
  if (input.protocolVersion !== WORKFLOW_PROTOCOL_VERSION) issue(issues, "INVALID_PROTOCOL_VERSION", "$.protocolVersion", `protocolVersion must be ${WORKFLOW_PROTOCOL_VERSION}`);
  if (input.definitionSchemaVersion !== WORKFLOW_DEFINITION_SCHEMA_VERSION) issue(issues, "INVALID_SCHEMA_VERSION", "$.definitionSchemaVersion", `definitionSchemaVersion must be ${WORKFLOW_DEFINITION_SCHEMA_VERSION}`);
  const name = nonEmptyString(input.name, "$.name", issues);
  const entryNodeId = nonEmptyString(input.entryNodeId, "$.entryNodeId", issues);
  const roles = parseRoles(input.roles, issues);
  const nodes = parseNodes(input.nodes, issues);
  const edges = parseEdges(input.edges, issues);
  const editor = parseEditor(input.editor, issues);
  if (!name || !entryNodeId || !roles || !nodes || !edges || input.protocolVersion !== WORKFLOW_PROTOCOL_VERSION || input.definitionSchemaVersion !== WORKFLOW_DEFINITION_SCHEMA_VERSION) return null;
  return {
    protocolVersion: WORKFLOW_PROTOCOL_VERSION,
    definitionSchemaVersion: WORKFLOW_DEFINITION_SCHEMA_VERSION,
    name,
    entryNodeId,
    roles,
    nodes,
    edges,
    ...(editor ? { editor } : {}),
  };
}

function parseEditor(input: unknown, issues: WorkflowValidationIssue[]): WorkflowDefinition["editor"] {
  if (input === undefined) return undefined;
  if (!isObject(input)) {
    issue(issues, "INVALID_SHAPE", "$.editor", "editor must be an object");
    return undefined;
  }
  exactKeys(input, ["description"], "$.editor", issues, ["description"]);
  if (input.description === undefined) return {};
  const description = nonEmptyString(input.description, "$.editor.description", issues);
  return description ? { description } : undefined;
}

function parseRoles(input: unknown, issues: WorkflowValidationIssue[]): WorkflowRole[] | null {
  if (!Array.isArray(input)) {
    issue(issues, "INVALID_SHAPE", "$.roles", "roles must be an array");
    return null;
  }
  const roles: WorkflowRole[] = [];
  input.forEach((value, index) => {
    const path = `$.roles[${index}]`;
    if (!isObject(value)) return issue(issues, "INVALID_SHAPE", path, "Role must be an object");
    exactKeys(value, ["capabilities", "id"], path, issues);
    const id = nonEmptyString(value.id, `${path}.id`, issues);
    if (!Array.isArray(value.capabilities)) {
      issue(issues, "INVALID_SHAPE", `${path}.capabilities`, "capabilities must be an array");
      return;
    }
    const capabilities: WorkflowCapability[] = [];
    value.capabilities.forEach((capability, capabilityIndex) => {
      if (typeof capability !== "string" || !WORKFLOW_CAPABILITIES.includes(capability as WorkflowCapability)) issue(issues, "UNSUPPORTED_CAPABILITY", `${path}.capabilities[${capabilityIndex}]`, "Unsupported capability");
      else capabilities.push(capability as WorkflowCapability);
    });
    if (id) roles.push({ id, capabilities: [...new Set(capabilities)] });
  });
  return roles;
}

function parseNodes(input: unknown, issues: WorkflowValidationIssue[]): SafeWorkflowNode[] | null {
  if (!Array.isArray(input) || input.length === 0) {
    issue(issues, "INVALID_SHAPE", "$.nodes", "nodes must be a non-empty array");
    return null;
  }
  const nodes: SafeWorkflowNode[] = [];
  input.forEach((value, index) => {
    const path = `$.nodes[${index}]`;
    if (!isObject(value)) return issue(issues, "INVALID_SHAPE", path, "Node must be an object");
    exactKeys(value, ["config", "id", "type"], path, issues);
    const id = nonEmptyString(value.id, `${path}.id`, issues);
    if (typeof value.type !== "string" || !(value.type in NODE_RULES)) {
      issue(issues, "UNSUPPORTED_NODE", `${path}.type`, "Unsupported safe-node type");
      return;
    }
    if (!isObject(value.config)) {
      issue(issues, "INVALID_CONFIG", `${path}.config`, "Node config must be an object");
      return;
    }
    const type = value.type as SafeWorkflowNode["type"];
    if (validateConfig(type, value.config, `${path}.config`, issues) && id) nodes.push({ id, type, config: value.config } as SafeWorkflowNode);
  });
  return nodes;
}

function validateConfig(type: SafeWorkflowNode["type"], config: JsonObject, path: string, issues: WorkflowValidationIssue[]): boolean {
  const before = issues.length;
  exactKeys(config, NODE_RULES[type].keys, path, issues, type === "condition" ? ["value"] : []);
  for (const [key, value] of Object.entries(config)) {
    if (key === "fields" || key === "allowedMimeTypes" || key === "outputFields") stringArray(value, `${path}.${key}`, issues);
    else if (key === "value") {
      if (!["string", "number", "boolean"].includes(typeof value)) issue(issues, "INVALID_CONFIG", `${path}.value`, "value must be a scalar");
    } else if (key === "operator") {
      if (!( ["equals", "not_equals", "exists"] as const).includes(value as never)) issue(issues, "INVALID_CONFIG", `${path}.operator`, "Unsupported condition operator");
    } else nonEmptyString(value, `${path}.${key}`, issues);
  }
  if (type === "condition") {
    if (config.operator === "exists" && "value" in config) issue(issues, "INVALID_CONFIG", `${path}.value`, "exists must not define value");
    if ((config.operator === "equals" || config.operator === "not_equals") && !("value" in config)) issue(issues, "INVALID_CONFIG", `${path}.value`, "Comparison requires value");
  }
  return issues.length === before;
}

function parseEdges(input: unknown, issues: WorkflowValidationIssue[]): WorkflowEdge[] | null {
  if (!Array.isArray(input)) {
    issue(issues, "INVALID_SHAPE", "$.edges", "edges must be an array");
    return null;
  }
  const edges: WorkflowEdge[] = [];
  input.forEach((value, index) => {
    const path = `$.edges[${index}]`;
    if (!isObject(value)) return issue(issues, "INVALID_SHAPE", path, "Edge must be an object");
    exactKeys(value, ["branch", "from", "id", "to"], path, issues, ["branch"]);
    const id = nonEmptyString(value.id, `${path}.id`, issues);
    const from = nonEmptyString(value.from, `${path}.from`, issues);
    const to = nonEmptyString(value.to, `${path}.to`, issues);
    if (value.branch !== undefined && value.branch !== "true" && value.branch !== "false") issue(issues, "INVALID_BRANCH", `${path}.branch`, "branch must be true or false");
    if (id && from && to) edges.push({ id, from, to, ...(value.branch === undefined ? {} : { branch: value.branch as "true" | "false" }) });
  });
  return edges;
}

function validateGraph(definition: WorkflowDefinition, issues: WorkflowValidationIssue[]): void {
  const nodeById = new Map<string, SafeWorkflowNode>();
  for (const node of definition.nodes) {
    if (nodeById.has(node.id)) issue(issues, "DUPLICATE_NODE", "$.nodes", `Duplicate node id: ${node.id}`);
    nodeById.set(node.id, node);
  }
  const roleById = new Map<string, WorkflowRole>();
  for (const role of definition.roles) {
    if (roleById.has(role.id)) issue(issues, "DUPLICATE_ROLE", "$.roles", `Duplicate role id: ${role.id}`);
    roleById.set(role.id, role);
  }
  if (!nodeById.has(definition.entryNodeId)) issue(issues, "MISSING_ENTRY", "$.entryNodeId", "Entry node does not exist");

  const outgoing = new Map(definition.nodes.map((node) => [node.id, [] as WorkflowEdge[]]));
  const incoming = new Map(definition.nodes.map((node) => [node.id, [] as WorkflowEdge[]]));
  for (const node of definition.nodes) validateRoleCapability(node, roleById, issues);

  const edgeIds = new Set<string>();
  const transitions = new Set<string>();
  for (const edge of definition.edges) {
    if (edgeIds.has(edge.id)) issue(issues, "DUPLICATE_EDGE", "$.edges", `Duplicate edge id: ${edge.id}`);
    edgeIds.add(edge.id);
    const transition = `${edge.from}\0${edge.to}\0${edge.branch ?? ""}`;
    if (transitions.has(transition)) issue(issues, "DUPLICATE_TRANSITION", "$.edges", `Duplicate transition: ${edge.from} -> ${edge.to}`);
    transitions.add(transition);
    if (!nodeById.has(edge.from) || !nodeById.has(edge.to)) {
      issue(issues, "UNKNOWN_EDGE_NODE", "$.edges", `Edge references unknown node: ${edge.from} -> ${edge.to}`);
      continue;
    }
    outgoing.get(edge.from)!.push(edge);
    incoming.get(edge.to)!.push(edge);
  }

  for (const node of definition.nodes) {
    const next = outgoing.get(node.id)!;
    const previous = incoming.get(node.id)!;
    if (node.id === definition.entryNodeId && previous.length !== 0) issue(issues, "ENTRY_HAS_INCOMING", `$.nodes.${node.id}`, "Entry node must have zero incoming edges");
    if (node.id !== definition.entryNodeId && previous.length === 0) issue(issues, "UNEXPECTED_ROOT", `$.nodes.${node.id}`, "Only the entry node may be a root");
    if (TERMINAL_TYPES.has(node.type)) {
      if (next.length !== 0) issue(issues, "UNSAFE_TRANSITION", `$.nodes.${node.id}`, "Terminal nodes cannot have outgoing edges");
    } else if (node.type === "condition") {
      const branches = next.map((edge) => edge.branch ?? "").sort(compareCodeUnits);
      if (branches.length !== 2 || branches[0] !== "false" || branches[1] !== "true") issue(issues, "INVALID_BRANCH", `$.nodes.${node.id}`, "Condition must have exactly one true and one false edge");
    } else {
      if (next.length !== 1) issue(issues, "INVALID_OUT_DEGREE", `$.nodes.${node.id}`, "Non-condition non-terminal nodes must have exactly one outgoing edge");
      if (next.some((edge) => edge.branch !== undefined)) issue(issues, "INVALID_BRANCH", `$.nodes.${node.id}`, "Only condition nodes may use branch labels");
    }
  }

  const terminalIds = definition.nodes.filter((node) => TERMINAL_TYPES.has(node.type)).map((node) => node.id);
  if (terminalIds.length === 0) issue(issues, "MISSING_TERMINAL", "$.nodes", "Workflow requires a completion or termination node");
  if (!nodeById.has(definition.entryNodeId)) return;

  const reachable = visitForward(definition.entryNodeId, outgoing);
  for (const node of definition.nodes) if (!reachable.has(node.id)) issue(issues, "UNREACHABLE_NODE", `$.nodes.${node.id}`, "Node is unreachable from entry");
  const terminating = visitBackward(terminalIds, incoming);
  for (const node of definition.nodes) if (!terminating.has(node.id)) issue(issues, "NON_TERMINATING_REGION", `$.nodes.${node.id}`, "Node cannot reach a completion or termination node");

  validateConfirmationReferences(definition, nodeById, incoming, reachable, issues);
  validateGovernanceRoutes(definition, nodeById, incoming, outgoing, issues);
}

function validateRoleCapability(node: SafeWorkflowNode, roles: Map<string, WorkflowRole>, issues: WorkflowValidationIssue[]): void {
  const capability = NODE_RULES[node.type].roleCapability;
  if (!capability || !("roleId" in node.config)) return;
  const role = roles.get(node.config.roleId);
  if (!role) issue(issues, "UNKNOWN_ROLE", `$.nodes.${node.id}.config.roleId`, "Configured role does not exist");
  else if (!role.capabilities.includes(capability)) issue(issues, "MISSING_CAPABILITY", `$.nodes.${node.id}.config.roleId`, `Role lacks ${capability}`);
}

function validateConfirmationReferences(
  definition: WorkflowDefinition,
  nodes: Map<string, SafeWorkflowNode>,
  incoming: Map<string, WorkflowEdge[]>,
  reachable: Set<string>,
  issues: WorkflowValidationIssue[],
): void {
  const dominators = computeDominators(definition.entryNodeId, incoming, reachable);
  for (const node of definition.nodes) {
    if (!NODE_RULES[node.type].sideEffect) continue;
    const confirmationNodeId = (node.config as { confirmationNodeId: string }).confirmationNodeId;
    const confirmation = nodes.get(confirmationNodeId);
    if (confirmation?.type !== "human_confirmation") {
      issue(issues, "INVALID_CONFIRMATION_REFERENCE", `$.nodes.${node.id}.config.confirmationNodeId`, "confirmationNodeId must reference a human_confirmation node");
    } else if (!dominators.get(node.id)?.has(confirmationNodeId)) {
      issue(issues, "CONFIRMATION_REQUIRED", `$.nodes.${node.id}.config.confirmationNodeId`, "Declared confirmation must dominate the side effect");
    }
  }
}

function validateGovernanceRoutes(
  definition: WorkflowDefinition,
  nodes: Map<string, SafeWorkflowNode>,
  incoming: Map<string, WorkflowEdge[]>,
  outgoing: Map<string, WorkflowEdge[]>,
  issues: WorkflowValidationIssue[],
): void {
  for (const node of definition.nodes) {
    if (node.type === "mark_governance_candidate" && nodes.get(outgoing.get(node.id)?.[0]?.to ?? "")?.type !== "route_governance_meeting") issue(issues, "INVALID_GOVERNANCE_ROUTE", `$.nodes.${node.id}`, "Governance candidate must route directly to governance meeting");
    if (node.type === "route_governance_meeting" && incoming.get(node.id)?.some((edge) => nodes.get(edge.from)?.type !== "mark_governance_candidate")) issue(issues, "INVALID_GOVERNANCE_ROUTE", `$.nodes.${node.id}`, "Governance meeting route requires a governance candidate");
  }
}

function computeDominators(entry: string, incoming: Map<string, WorkflowEdge[]>, reachable: Set<string>): Map<string, Set<string>> {
  const dominators = new Map<string, Set<string>>();
  for (const id of reachable) dominators.set(id, id === entry ? new Set([id]) : new Set(reachable));
  let changed = true;
  while (changed) {
    changed = false;
    for (const id of reachable) {
      if (id === entry) continue;
      const predecessors = (incoming.get(id) ?? []).map((edge) => edge.from).filter((from) => reachable.has(from));
      const next = predecessors.length === 0 ? new Set<string>() : intersect(predecessors.map((from) => dominators.get(from)!));
      next.add(id);
      if (!setEqual(next, dominators.get(id)!)) {
        dominators.set(id, next);
        changed = true;
      }
    }
  }
  return dominators;
}

function canonicalizeDefinition(definition: WorkflowDefinition): WorkflowDefinition {
  return {
    protocolVersion: WORKFLOW_PROTOCOL_VERSION,
    definitionSchemaVersion: WORKFLOW_DEFINITION_SCHEMA_VERSION,
    name: definition.name,
    entryNodeId: definition.entryNodeId,
    roles: definition.roles
      .map((role) => ({ ...role, capabilities: [...role.capabilities].sort(compareCodeUnits) }))
      .sort((a, b) => compareCodeUnits(a.id, b.id)),
    nodes: definition.nodes
      .map((node) => ({ ...node, config: canonicalValue(node.config) }) as SafeWorkflowNode)
      .sort((a, b) => compareCodeUnits(a.id, b.id)),
    edges: [...definition.edges].sort((a, b) => compareCodeUnits(a.id, b.id)),
    ...(definition.editor ? { editor: definition.editor } : {}),
  };
}

function buildRuntimeSemantics(definition: WorkflowDefinition): Omit<CompiledWorkflow, "hashes"> {
  const nodes: CompiledRuntimeNode[] = definition.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    config: node.config,
    ...(NODE_RULES[node.type].roleCapability ? { requiredCapability: NODE_RULES[node.type].roleCapability } : {}),
  }));
  const adjacency: CompiledWorkflow["adjacency"] = {};
  for (const node of nodes) adjacency[node.id] = [];
  for (const edge of definition.edges) adjacency[edge.from].push({ edgeId: edge.id, to: edge.to, ...(edge.branch ? { branch: edge.branch } : {}) });
  for (const entries of Object.values(adjacency)) entries.sort((a, b) => compareCodeUnits(a.edgeId, b.edgeId));
  return {
    protocolVersion: WORKFLOW_PROTOCOL_VERSION,
    definitionSchemaVersion: WORKFLOW_DEFINITION_SCHEMA_VERSION,
    compilerVersion: WORKFLOW_COMPILER_VERSION,
    entryNodeId: definition.entryNodeId,
    nodes,
    edges: definition.edges,
    adjacency,
    terminalNodeIds: nodes.filter((node) => TERMINAL_TYPES.has(node.type)).map((node) => node.id).sort(compareCodeUnits),
    requiredCapabilities: [...new Set(nodes.flatMap((node) => node.requiredCapability ?? []))].sort(compareCodeUnits),
  };
}

export function hashCanonical(value: unknown): string {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (!isObject(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort(compareCodeUnits)
      .map((key) => [key, canonicalValue(value[key])]),
  );
}

function exactKeys(value: JsonObject, allowed: readonly string[], path: string, issues: WorkflowValidationIssue[], optional: readonly string[] = []): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(value)) if (!allowedSet.has(key)) issue(issues, "UNKNOWN_FIELD", `${path}.${key}`, "Unknown field is not allowed");
  const optionalSet = new Set(optional);
  for (const key of allowed) if (!optionalSet.has(key) && !(key in value)) issue(issues, "MISSING_FIELD", `${path}.${key}`, "Required field is missing");
}

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function nonEmptyString(value: unknown, path: string, issues: WorkflowValidationIssue[]): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    issue(issues, "INVALID_CONFIG", path, "Expected a non-empty string");
    return null;
  }
  return value;
}

function stringArray(value: unknown, path: string, issues: WorkflowValidationIssue[]): void {
  if (!Array.isArray(value) || value.length === 0 || value.some((item) => typeof item !== "string" || item.trim() === "")) issue(issues, "INVALID_CONFIG", path, "Expected a non-empty string array");
}

function visitForward(entry: string, outgoing: Map<string, WorkflowEdge[]>): Set<string> {
  const seen = new Set<string>();
  const pending = [entry];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of outgoing.get(id) ?? []) pending.push(edge.to);
  }
  return seen;
}

function visitBackward(terminals: string[], incoming: Map<string, WorkflowEdge[]>): Set<string> {
  const seen = new Set<string>();
  const pending = [...terminals];
  while (pending.length > 0) {
    const id = pending.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    for (const edge of incoming.get(id) ?? []) pending.push(edge.from);
  }
  return seen;
}

function intersect(sets: Set<string>[]): Set<string> {
  return new Set([...sets[0]].filter((value) => sets.every((set) => set.has(value))));
}

function setEqual(left: Set<string>, right: Set<string>): boolean {
  return left.size === right.size && [...left].every((value) => right.has(value));
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

function issue(issues: WorkflowValidationIssue[], code: string, path: string, message: string): void {
  issues.push({ code, path, message });
}
