import type {
  RuntimeCommand,
  RuntimeEvidence,
  RuntimeStatus,
  RuntimeTransitionErrorCode,
  RuntimeTransitionResult,
} from "./runtime-engine";
import type { CompiledWorkflow } from "./protocol";

export type ValidatedRuntimeRoleBinding =
  | { roleId: string; personId: string; roleDefId?: never }
  | { roleId: string; personId?: never; roleDefId: string };

export type StoredRuntimeRoleBinding = {
  id: string;
  roleId: string;
  personId: string | null;
  roleDefId: string | null;
};

export type RuntimeRunSnapshot = {
  id: string;
  organizationId: string;
  workbenchId: string;
  versionId: string;
  workflow: CompiledWorkflow;
  status: RuntimeStatus;
  currentNodeId: string;
  currentNodeVisit: number;
  evidence: RuntimeEvidence;
  revision: number;
  waitingRoleBinding: StoredRuntimeRoleBinding | null;
  lastEventSequence: number;
};

export type LockedActiveRuntimeVersion = {
  workbenchId: string;
  versionId: string;
  workflow: CompiledWorkflow;
  roleIds: string[];
};

export type RuntimeEventWrite = {
  organizationId: string;
  runId: string;
  sequence: number;
  type: string;
  nodeId: string;
  nodeVisit: number;
  actorId: string | null;
  payload: Record<string, unknown>;
};

export type RuntimeCommandRecord = {
  id: string;
  organizationId: string;
  runId: string;
  nodeId: string;
  nodeVisit: number;
  kind: string;
  clientIdempotencyKey: string;
  actorId: string;
  payload: unknown;
  attempts: number;
  status: "PENDING" | "PROCESSING" | "SUCCEEDED" | "FAILED";
  error: string | null;
  updatedAt: Date;
};

export type RuntimeRunCreate = {
  organizationId: string;
  workbenchId: string;
  versionId: string;
  status: RuntimeStatus;
  currentNodeId: string;
  currentNodeVisit: number;
  evidence: RuntimeEvidence;
  revision: number;
  starterId: string;
  lastActorId: string;
};

export type RuntimeRunProjectionUpdate = {
  status?: RuntimeStatus;
  currentNodeId?: string;
  currentNodeVisit?: number;
  evidence?: RuntimeEvidence;
  revision?: number;
  lastActorId?: string;
  waitingRoleBindingId?: string | null;
};

export type RuntimeCommandCreate = {
  organizationId: string;
  runId: string;
  nodeId: string;
  nodeVisit: number;
  kind: string;
  clientIdempotencyKey: string;
  actorId: string;
  payload: unknown;
  attempts: number;
  status: "PROCESSING";
};

export type RuntimeTransaction = {
  lockActiveVersion(input: { organizationId: string; workbenchId: string }): Promise<LockedActiveRuntimeVersion | null>;
  lockRun(input: { organizationId: string; runId: string }): Promise<RuntimeRunSnapshot | null>;
  findCommandByIdempotencyKey(input: { organizationId: string; runId: string; clientIdempotencyKey: string }): Promise<RuntimeCommandRecord | null>;
  findCommandByExecution(input: { organizationId: string; runId: string; nodeId: string; nodeVisit: number; kind: string }): Promise<RuntimeCommandRecord | null>;
  findRoleBinding(input: { organizationId: string; runId: string; roleId: string }): Promise<StoredRuntimeRoleBinding | null>;
  createRun(data: RuntimeRunCreate): Promise<{ id: string }>;
  createRoleBindings(input: { organizationId: string; runId: string; bindings: ValidatedRuntimeRoleBinding[] }): Promise<StoredRuntimeRoleBinding[]>;
  appendEvents(events: RuntimeEventWrite[]): Promise<void>;
  updateRunProjection(input: { organizationId: string; runId: string; expectedRevision: number; data: RuntimeRunProjectionUpdate }): Promise<boolean>;
  createCommand(data: RuntimeCommandCreate): Promise<RuntimeCommandRecord>;
  reclaimCommand(input: {
    organizationId: string;
    commandId: string;
    expectedStatus: "FAILED" | "PROCESSING";
    expectedUpdatedAt: Date;
    staleBefore?: Date;
  }): Promise<RuntimeCommandRecord | null>;
  lockCommand(input: { organizationId: string; commandId: string }): Promise<RuntimeCommandRecord | null>;
  markCommandSucceeded(input: { organizationId: string; commandId: string; leaseToken?: Date }): Promise<boolean>;
  markCommandFailed(input: { organizationId: string; commandId: string; leaseToken: Date; error: string }): Promise<boolean>;
  raiseTension(input: { organizationId: string; raiserId: string; title: string; description: string }): Promise<{ id: string }>;
  resolveTacticalRoute(input: { organizationId: string; runId: string; sourceTensionArtifactId: string; meetingId: string }): Promise<{ tensionId: string; meetingId: string; sourceArtifactId: string }>;
  authorizeGovernanceCandidate(input: { organizationId: string; runId: string; actorId: string; sourceTensionArtifactId: string }): Promise<void>;
  authorizeGovernanceRoute(input: { organizationId: string; runId: string; actorId: string; proposalArtifactId: string; meetingId: string }): Promise<void>;
  authorizeGovernanceCandidateReplay(input: { organizationId: string; runId: string; actorId: string; sourceTensionArtifactId: string; expectedRevision: number; command: RuntimeCommandRecord }): Promise<void>;
  authorizeGovernanceRouteReplay(input: { organizationId: string; runId: string; actorId: string; proposalArtifactId: string; meetingId: string; expectedRevision: number; command: RuntimeCommandRecord }): Promise<void>;
  createGovernanceCandidate(input: {
    organizationId: string;
    runId: string;
    actorId: string;
    sourceTensionArtifactId: string;
    draft: { structuralCategory: "ROLE" | "CIRCLE" | "DOMAIN_AUTHORITY" | "ACCOUNTABILITY" | "POLICY" | "INTERFACE_RELATIONSHIP"; currentStructure: string; proposedStructure: string; expectedImpact: string; rationale: string };
  }): Promise<{ proposalId: string; tensionId: string; sourceArtifactId: string }>;
  routeGovernanceCandidate(input: { organizationId: string; runId: string; actorId: string; proposalArtifactId: string; meetingId: string }): Promise<{ proposalId: string; proposalArtifactId: string; sourceTensionArtifactId: string; tensionId: string; meetingId: string }>;
  createArtifact(input: {
    organizationId: string;
    runId: string;
    artifactType: "TENSION" | "GOVERNANCE_PROPOSAL" | "MEETING";
    artifactId: string;
    relation: string;
    metadata: Record<string, unknown>;
  }): Promise<{ id: string }>;
  assignWaitingBinding(input: { organizationId: string; bindingId: string; personId: string }): Promise<boolean>;
};

export type RuntimeServiceDependencies = {
  readRun(input: { organizationId: string; runId: string }): Promise<RuntimeRunSnapshot | null>;
  findCommandByIdempotencyKey(input: { organizationId: string; runId: string; clientIdempotencyKey: string }): Promise<RuntimeCommandRecord | null>;
  findCommandByExecution(input: { organizationId: string; runId: string; nodeId: string; nodeVisit: number; kind: string }): Promise<RuntimeCommandRecord | null>;
  transaction<T>(work: (transaction: RuntimeTransaction) => Promise<T>): Promise<T>;
  now?: () => Date;
  transition?: (input: {
    workflow: CompiledWorkflow;
    currentNodeId: string;
    currentNodeVisit: number;
    evidence: RuntimeEvidence;
    command: RuntimeCommand | null;
  }) => RuntimeTransitionResult;
};

export type StartWorkflowRunInput = {
  organizationId: string;
  workbenchId: string;
  starterId: string;
  bindings: ValidatedRuntimeRoleBinding[];
  evidence?: RuntimeEvidence;
};

export type StartWorkflowRunResult =
  | { ok: true; runId: string; versionId: string }
  | { ok: false; error: "NO_ACTIVE_VERSION" | "INVALID_BINDINGS" }
  | { ok: false; error: "ENGINE_ERROR"; engineError: RuntimeEngineError };

export type AdvanceWorkflowRunInput = {
  organizationId: string;
  runId: string;
  actorId: string;
  actorAuthorized: boolean;
  expectedRevision: number;
  clientIdempotencyKey: string;
  command: RuntimeCommand;
};

export type AdvanceWorkflowRunResult =
  | { ok: true; commandId: string; artifactId?: string }
  | { ok: false; error: "FORBIDDEN" | "NOT_FOUND" | "COMMAND_IN_PROGRESS" }
  | { ok: false; error: "SIDE_EFFECT_FAILED"; commandId: string }
  | { ok: false; error: "REVISION_CONFLICT"; currentRevision: number }
  | { ok: false; error: "COMMAND_ALREADY_EXECUTED"; commandId: string }
  | { ok: false; error: "ENGINE_ERROR"; engineError: RuntimeEngineError };

export type TakeOverWorkflowRunInput = {
  organizationId: string;
  runId: string;
  actorId: string;
  actorAuthorized: boolean;
  expectedRevision: number;
};

export type TakeOverWorkflowRunResult =
  | { ok: true; revision: number }
  | { ok: false; error: "FORBIDDEN" | "NOT_FOUND" | "NOT_WAITING" }
  | { ok: false; error: "REVISION_CONFLICT"; currentRevision: number };

export type RuntimeEngineError = {
  code: RuntimeTransitionErrorCode;
  nodeId: string;
  message: string;
};
