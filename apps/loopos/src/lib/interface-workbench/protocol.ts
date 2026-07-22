export const WORKFLOW_PROTOCOL_VERSION = 1 as const;
export const WORKFLOW_DEFINITION_SCHEMA_VERSION = 1 as const;
export const WORKFLOW_COMPILER_VERSION = "1.0.0" as const;

export const WORKFLOW_CAPABILITIES = [
  "collect_evidence",
  "use_ai",
  "confirm",
  "route",
  "create_project",
  "create_action",
  "raise_tension",
  "governance",
] as const;

export type WorkflowCapability = (typeof WORKFLOW_CAPABILITIES)[number];

export type WorkflowRole = {
  id: string;
  capabilities: WorkflowCapability[];
};

type NodeBase<TType extends string, TConfig> = {
  id: string;
  type: TType;
  config: TConfig;
};

type ConfirmedSideEffectConfig = {
  confirmationNodeId: string;
  roleId: string;
};

export type SafeWorkflowNode =
  | NodeBase<"structured_evidence_input", { fields: string[]; roleId: string }>
  | NodeBase<"attachment_input", { allowedMimeTypes: string[]; roleId: string }>
  | NodeBase<"ai_extract", { instruction: string; outputFields: string[]; roleId: string }>
  | NodeBase<"human_confirmation", { prompt: string; roleId: string }>
  | NodeBase<"condition", { field: string; operator: "equals" | "not_equals" | "exists"; value?: string | number | boolean }>
  | NodeBase<"wait_for_role", { roleId: string; request: string }>
  | NodeBase<"raise_tension", ConfirmedSideEffectConfig & { titleField: string; descriptionField: string }>
  | NodeBase<"route_tactical_meeting", ConfirmedSideEffectConfig>
  | NodeBase<"create_project", ConfirmedSideEffectConfig & { nameField: string; resultField: string }>
  | NodeBase<"create_action", ConfirmedSideEffectConfig & { titleField: string; acceptanceCriteriaField: string }>
  | NodeBase<"mark_governance_candidate", ConfirmedSideEffectConfig & { rationaleField: string }>
  | NodeBase<"route_governance_meeting", ConfirmedSideEffectConfig>
  | NodeBase<"complete", { outcome: string }>
  | NodeBase<"terminate", { reason: string }>;

export type WorkflowEdge = {
  id: string;
  from: string;
  to: string;
  branch?: "true" | "false";
};

export type WorkflowDefinition = {
  protocolVersion: typeof WORKFLOW_PROTOCOL_VERSION;
  definitionSchemaVersion: typeof WORKFLOW_DEFINITION_SCHEMA_VERSION;
  name: string;
  entryNodeId: string;
  roles: WorkflowRole[];
  nodes: SafeWorkflowNode[];
  edges: WorkflowEdge[];
  editor?: { description?: string };
};

export type CompiledRuntimeNode = {
  id: string;
  type: SafeWorkflowNode["type"];
  config: SafeWorkflowNode["config"];
  requiredCapability?: WorkflowCapability;
};

export type CompiledWorkflow = {
  protocolVersion: typeof WORKFLOW_PROTOCOL_VERSION;
  definitionSchemaVersion: typeof WORKFLOW_DEFINITION_SCHEMA_VERSION;
  compilerVersion: typeof WORKFLOW_COMPILER_VERSION;
  entryNodeId: string;
  nodes: CompiledRuntimeNode[];
  edges: WorkflowEdge[];
  adjacency: Record<string, Array<{ edgeId: string; to: string; branch?: "true" | "false" }>>;
  terminalNodeIds: string[];
  requiredCapabilities: WorkflowCapability[];
  hashes: { source: string; semantics: string };
};

export type WorkflowValidationIssue = {
  code: string;
  path: string;
  message: string;
};

export type CompileWorkflowResult =
  | {
      ok: true;
      sourceHash: string;
      compiledHash: string;
      snapshot: WorkflowDefinition;
      compiled: CompiledWorkflow;
    }
  | { ok: false; issues: WorkflowValidationIssue[] };
