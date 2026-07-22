import type { Edge, Node, XYPosition } from "@xyflow/react";
import type { EditorLayout } from "./dto";
import type { SafeWorkflowNode, WorkflowDefinition, WorkflowEdge } from "./protocol";

export type WorkbenchFlowNode = Node<{ node: SafeWorkflowNode; label: string }, "workflow">;
export type WorkbenchFlowEdge = Edge<{ branch?: "true" | "false" }>;
export type EditorSyncState = "saved" | "unsaved" | "saving" | "stale";

const DEFAULT_POSITION = { x: 80, y: 80 };

export function definitionToFlow(definition: WorkflowDefinition, layout: EditorLayout): { nodes: WorkbenchFlowNode[]; edges: WorkbenchFlowEdge[] } {
  return {
    nodes: definition.nodes.map((node, index) => ({
      id: node.id,
      type: "workflow",
      position: layout[node.id] ?? { x: DEFAULT_POSITION.x + (index % 3) * 260, y: DEFAULT_POSITION.y + Math.floor(index / 3) * 150 },
      data: { node, label: nodeLabel(node.type) },
    })),
    edges: definition.edges.map((edge) => ({
      id: edge.id,
      source: edge.from,
      target: edge.to,
      sourceHandle: edge.branch,
      label: edge.branch === undefined ? undefined : edge.branch === "true" ? "是" : "否",
      data: edge.branch ? { branch: edge.branch } : {},
    })),
  };
}

export function flowToDefinition(definition: WorkflowDefinition, nodes: WorkbenchFlowNode[], edges: WorkbenchFlowEdge[]): { definition: WorkflowDefinition; layout: EditorLayout } {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  return {
    definition: {
      ...definition,
      nodes: definition.nodes.filter((node) => nodeById.has(node.id)).map((node) => nodeById.get(node.id)?.data.node ?? node),
      edges: edges.map(flowEdgeToProtocol),
    },
    layout: Object.fromEntries(nodes.map((node) => [node.id, finitePosition(node.position)])),
  };
}

export function addSafeNode(definition: WorkflowDefinition, layout: EditorLayout, node: SafeWorkflowNode, position: XYPosition): { definition: WorkflowDefinition; layout: EditorLayout } {
  if (definition.nodes.some((item) => item.id === node.id)) return { definition, layout };
  return { definition: { ...definition, nodes: [...definition.nodes, node] }, layout: { ...layout, [node.id]: finitePosition(position) } };
}

export function removeSafeNode(definition: WorkflowDefinition, layout: EditorLayout, nodeId: string): { definition: WorkflowDefinition; layout: EditorLayout } {
  const nextLayout = { ...layout };
  delete nextLayout[nodeId];
  return {
    definition: { ...definition, nodes: definition.nodes.filter((node) => node.id !== nodeId), edges: definition.edges.filter((edge) => edge.from !== nodeId && edge.to !== nodeId) },
    layout: nextLayout,
  };
}

export function connectSafeNodes(definition: WorkflowDefinition, input: { from: string; to: string; branch?: "true" | "false" }): WorkflowDefinition {
  if (definition.edges.some((edge) => edge.from === input.from && edge.to === input.to && edge.branch === input.branch)) return definition;
  const id = stableId("edge", definition.edges.map((edge) => edge.id));
  const edge: WorkflowEdge = { id, from: input.from, to: input.to, ...(input.branch ? { branch: input.branch } : {}) };
  return { ...definition, edges: [...definition.edges, edge] };
}

export function stableId(prefix: string, existing: string[]): string {
  const used = new Set(existing);
  let index = 1;
  while (used.has(`${prefix}-${index}`)) index += 1;
  return `${prefix}-${index}`;
}

export function transitionEditorState(state: EditorSyncState, event: "edit" | "save" | "saved" | "stale" | "reload"): EditorSyncState {
  if (event === "stale") return "stale";
  if (event === "reload" || event === "saved") return "saved";
  if (state === "stale") return "stale";
  if (event === "save") return "saving";
  return "unsaved";
}

export function resolveSavedEditorState(submittedEditSequence: number, currentEditSequence: number): EditorSyncState {
  return submittedEditSequence === currentEditSequence ? "saved" : "unsaved";
}

export function hasPersistentEdgeChanges(changes: ReadonlyArray<{ type: string }>): boolean {
  return changes.some((change) => change.type !== "select");
}

export function isMobileWorkbenchWidth(width: number): boolean {
  return width <= 767;
}

function flowEdgeToProtocol(edge: WorkbenchFlowEdge): WorkflowEdge {
  const branch = edge.data?.branch ?? (edge.sourceHandle === "true" || edge.sourceHandle === "false" ? edge.sourceHandle : undefined);
  return { id: edge.id, from: edge.source, to: edge.target, ...(branch ? { branch } : {}) };
}

function finitePosition(position: XYPosition): XYPosition {
  return { x: Number.isFinite(position.x) ? position.x : 0, y: Number.isFinite(position.y) ? position.y : 0 };
}

export function nodeLabel(type: SafeWorkflowNode["type"]): string {
  const labels: Record<SafeWorkflowNode["type"], string> = {
    structured_evidence_input: "结构化证据", attachment_input: "附件证据", ai_extract: "AI 提取",
    human_confirmation: "人工确认", condition: "条件分支", wait_for_role: "等待角色",
    raise_tension: "发起张力", route_tactical_meeting: "转入战术会议", create_project: "创建项目",
    create_action: "创建行动", mark_governance_candidate: "标记治理候选", route_governance_meeting: "转入治理会议",
    complete: "完成", terminate: "终止",
  };
  return labels[type];
}
