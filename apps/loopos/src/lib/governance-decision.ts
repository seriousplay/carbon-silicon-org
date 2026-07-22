import { createHash, randomUUID } from "node:crypto";
import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { resolveRoutedGovernanceCandidateForDecision } from "@/lib/domain-operations";
import { parseGovernanceStructuralChange, type GovernanceStructuralChange } from "./governance-change";
import { evaluateMeetingLifecycle } from "./organization-setup/meeting-lifecycle-policy";

export const GOVERNANCE_DECISION_LEASE_MS = 5 * 60_000;

export type GovernanceDecisionState =
  | "READY"
  | "CLARIFICATION_REQUIRED"
  | "OBJECTION_PENDING"
  | "AMENDMENT_REQUIRED"
  | "NOT_ADOPTED"
  | "ADOPTED";

export type GovernanceDecisionOperation =
  | "INITIALIZE"
  | "SUBMIT_REVISION"
  | "REQUEST_CLARIFICATION"
  | "RAISE_OBJECTION"
  | "ASSESS_OBJECTION_INVALID"
  | "ASSESS_OBJECTION_VALID"
  | "RECORD_NON_ADOPTION"
  | "ADOPT_ROLE";

export type GovernanceDecisionLedgerOperation =
  | "INITIALIZE"
  | "SUBMIT_REVISION"
  | "REQUEST_CLARIFICATION"
  | "RAISE_OBJECTION"
  | "ASSESS_OBJECTION"
  | "RECORD_NON_ADOPTION"
  | "ADOPT_ROLE";

export type GovernanceRoleCategory = "CIRCLE_LEAD" | "EXPERT" | "OPERATIONS" | "COACH";

export type GovernanceRoleCreatedPayloadV1 = {
  schemaVersion: 1;
  operation: "ROLE_CREATED";
  circleId: string;
  name: string;
  purpose: string;
  domain: string | null;
  accountabilities: string;
  category: GovernanceRoleCategory;
  ownershipType: "HOME";
};

export type GovernanceProposalRevisionInput = {
  currentStructure: string;
  proposedStructure: string;
  rationale?: string;
  expectedImpact?: string;
  typedChange: GovernanceRoleCreatedPayloadV1 | GovernanceStructuralChange;
};

export type GovernanceClarification = { question: string; reason: string };
export type GovernanceObjection = {
  materialHarm: string;
  factVsWorry: string;
  reversibility: string;
  safeToTry: string;
};
export type GovernanceObjectionAssessment = GovernanceObjection & {
  validity: "VALID" | "INVALID";
  assessmentNote: string;
};

export type GovernanceDecisionProcessSnapshot = {
  id: string;
  organizationId: string;
  proposalId: string;
  sourceTensionId: string;
  provenanceKind: "ORDINARY_TENSION" | "INTERFACE_RUN";
  runId: string | null;
  meetingId: string;
  sourceTensionArtifactId: string | null;
  proposalArtifactId: string | null;
  routeArtifactId: string | null;
  proposerId: string;
  state: GovernanceDecisionState;
  currentRevision: number;
  currentRevisionId: string;
  activeClarification: GovernanceClarification | null;
  activeObjection: GovernanceObjection | null;
  activeObjectionSequence: number | null;
  outcomeRoleId: string | null;
  outcomeObjectId?: string | null;
  outcomeChangeType?: string | null;
  decisionId: string | null;
  changeLogId: string | null;
};

type GovernanceDecisionContextBase = {
  organizationId: string;
  proposalId: string;
  sourceTensionId: string;
  proposerId: string;
  meetingId: string;
  sourceTensionStatus: string;
  process: GovernanceDecisionProcessSnapshot | null;
  currentRevision: GovernanceProposalRevisionInput | null;
};

export type GovernanceDecisionContext = GovernanceDecisionContextBase & (
  | { provenanceKind: "ORDINARY_TENSION"; runId: null; sourceTensionArtifactId: null; proposalArtifactId: null; routeArtifactId: null; routeNodeId: null; routeNodeVisit: null }
  | { provenanceKind: "INTERFACE_RUN"; runId: string; sourceTensionArtifactId: string; proposalArtifactId: string; routeArtifactId: string; routeNodeId: string; routeNodeVisit: number }
);

export type GovernanceDecisionResult = {
  processId: string;
  proposalId: string;
  revision: number;
  state: GovernanceDecisionState;
  roleId?: string;
  objectId?: string;
  changeType?: string;
  decisionId?: string;
  changeLogId?: string;
  artifactId?: string;
  tensionId?: string;
};

type GovernanceDecisionInputBase = {
  organizationId: string;
  proposalId: string;
  meetingId: string;
  actorId: string;
  expectedRevision: number;
  operation: GovernanceDecisionOperation;
  operationScope: string;
  mutationKey: string;
  revision?: GovernanceProposalRevisionInput;
  clarification?: GovernanceClarification;
  objection?: GovernanceObjection;
  assessment?: GovernanceObjectionAssessment;
  note?: string;
};

export type GovernanceDecisionInput = GovernanceDecisionInputBase & (
  | { provenanceKind: "ORDINARY_TENSION"; sourceTensionId: string; runId?: never; proposalArtifactId?: never; routeArtifactId?: never }
  | { provenanceKind: "INTERFACE_RUN"; runId: string; proposalArtifactId: string; routeArtifactId: string; sourceTensionId?: never }
);

type OperationBinding = {
  organizationId: string;
  proposalId: string;
  processId: string | null;
  meetingId: string;
  actorId: string;
  revision: number;
  operation: GovernanceDecisionLedgerOperation;
  operationScope: string;
  mutationKey: string;
  canonicalPayloadHash: string;
};

export type GovernanceDecisionOperationRecord = OperationBinding & {
  id: string;
  status: "PROCESSING" | "FAILED" | "SUCCEEDED";
  attempt: number;
  leaseToken: string;
  leaseExpiresAt: Date;
  failureCode: string | null;
  resultEnvelope: GovernanceDecisionResult | null;
};

export type GovernanceDecisionEvent = {
  type: string;
  actorId: string;
  payload: Record<string, unknown>;
};

export type GovernanceAdoptionWriteStep =
  | "CREATE_ROLE"
  | "CREATE_DECISION"
  | "CREATE_CHANGE_LOG"
  | "UPDATE_PROPOSAL"
  | "UPDATE_PROCESS"
  | "RESOLVE_TENSION"
  | "CREATE_ROLE_ARTIFACT"
  | "APPEND_EVENTS"
  | "MARK_OPERATION_SUCCEEDED";

export interface GovernanceDecisionTransaction {
  readOrganizationLifecycle(organizationId: string): Promise<unknown>;
  lockContext(input: GovernanceDecisionInput): Promise<GovernanceDecisionContext | null>;
  ensureOrdinaryProposal(input: { context: GovernanceDecisionContext; input: GovernanceDecisionInput }): Promise<void>;
  isCurrentParticipant(input: { organizationId: string; meetingId: string; actorId: string }): Promise<boolean>;
  isProposerConfirmationAllowed?(input: { organizationId: string }): Promise<boolean>;
  findOperationByKey(input: { organizationId: string; mutationKey: string }): Promise<GovernanceDecisionOperationRecord | null>;
  findOperationBySlot(binding: Omit<OperationBinding, "mutationKey" | "canonicalPayloadHash" | "actorId" | "processId">): Promise<GovernanceDecisionOperationRecord | null>;
  createOperation(input: OperationBinding & { id: string; leaseToken: string; leaseExpiresAt: Date }): Promise<GovernanceDecisionOperationRecord>;
  reclaimOperation(input: { id: string; expectedStatus: "FAILED" | "PROCESSING"; expectedAttempt: number; staleBefore?: Date; leaseToken: string; leaseExpiresAt: Date }): Promise<GovernanceDecisionOperationRecord | null>;
  lockOperation(input: { id: string; leaseToken: string }): Promise<GovernanceDecisionOperationRecord | null>;
  initializeProcess(input: { context: GovernanceDecisionContext; processId: string; revisionId: string; revision: GovernanceProposalRevisionInput; actorId: string }): Promise<GovernanceDecisionProcessSnapshot>;
  createRevision(input: { process: GovernanceDecisionProcessSnapshot; revisionId: string; revision: GovernanceProposalRevisionInput; actorId: string; sourceKind: "CLARIFICATION" | "AMENDMENT" }): Promise<void>;
  updateProcess(input: { process: GovernanceDecisionProcessSnapshot; expectedState: GovernanceDecisionState; state: GovernanceDecisionState; actorId?: string; note?: string; clarification?: GovernanceClarification | null; objection?: GovernanceObjection | null; objectionSequence?: number | null; nextRevisionId?: string }): Promise<GovernanceDecisionProcessSnapshot>;
  appendEvents(input: { context: GovernanceDecisionContext; events: GovernanceDecisionEvent[] }): Promise<void>;
  applyRoleAdoption(input: { context: GovernanceDecisionContext; process: GovernanceDecisionProcessSnapshot; actorId: string; note: string | null; role: GovernanceRoleCreatedPayloadV1 | GovernanceStructuralChange }): Promise<{ process: GovernanceDecisionProcessSnapshot; roleId?: string; objectId?: string; changeType?: string; decisionId: string; changeLogId: string; artifactId?: string }>;
  markOperationSucceeded(input: { id: string; leaseToken: string; result: GovernanceDecisionResult }): Promise<boolean>;
  markOperationFailed(input: { id: string; leaseToken: string; processId: string; expectedRevision: number; actorId: string; failureCode: string; context: GovernanceDecisionContext }): Promise<boolean>;
  beforeAdoptionStep?(step: GovernanceAdoptionWriteStep): Promise<void>;
}

export interface GovernanceDecisionDependencies {
  transaction<T>(work: (transaction: GovernanceDecisionTransaction) => Promise<T>, options?: { isolationLevel: "Serializable" }): Promise<T>;
  now?(): Date;
  randomId?(): string;
  leaseMs?: number;
}

export type PrismaGovernanceDecisionOptions = {
  beforeAdoptionStep?(step: GovernanceAdoptionWriteStep): Promise<void> | void;
  beforeFailureAudit?(): Promise<void> | void;
  now?(): Date;
  leaseMs?: number;
};

export class GovernanceDecisionError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "GovernanceDecisionError";
  }
}

export function transitionGovernanceDecision(
  state: GovernanceDecisionState | null,
  operation: GovernanceDecisionOperation,
): GovernanceDecisionState {
  if (state === null && operation === "INITIALIZE") return "READY";
  if (state === "READY" && operation === "REQUEST_CLARIFICATION") return "CLARIFICATION_REQUIRED";
  if ((state === "CLARIFICATION_REQUIRED" || state === "AMENDMENT_REQUIRED" || state === "NOT_ADOPTED") && operation === "SUBMIT_REVISION") return "READY";
  if (state === "READY" && operation === "RAISE_OBJECTION") return "OBJECTION_PENDING";
  if (state === "OBJECTION_PENDING" && operation === "ASSESS_OBJECTION_INVALID") return "READY";
  if (state === "OBJECTION_PENDING" && operation === "ASSESS_OBJECTION_VALID") return "AMENDMENT_REQUIRED";
  if ((state === "READY" || state === "AMENDMENT_REQUIRED") && operation === "RECORD_NON_ADOPTION") return "NOT_ADOPTED";
  if (state === "READY" && operation === "ADOPT_ROLE") return "ADOPTED";
  throw new GovernanceDecisionError("INVALID_TRANSITION");
}

export function authorizeGovernanceOperation(input: {
  operation: GovernanceDecisionOperation;
  actorId: string;
  proposerId: string;
  isCurrentParticipant: boolean;
}): void {
  if (input.operation === "INITIALIZE" || input.operation === "SUBMIT_REVISION") {
    if (input.actorId !== input.proposerId) throw new GovernanceDecisionError("PROPOSER_REQUIRED");
    return;
  }
  if (!input.isCurrentParticipant) throw new GovernanceDecisionError("MEETING_PARTICIPANT_REQUIRED");
}

export function authorizeProposerConfirmation(input: { operation: GovernanceDecisionOperation; actorId: string; proposerId: string; allowed: boolean }): void {
  void input;
}

export function canonicalGovernanceJson(value: unknown): string {
  if (value === undefined) throw new GovernanceDecisionError("NON_CANONICAL_PAYLOAD");
  if (Array.isArray(value)) return `[${value.map(canonicalGovernanceJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalGovernanceJson(value[key])}`).join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined) throw new GovernanceDecisionError("NON_CANONICAL_PAYLOAD");
  return encoded;
}

export function governancePayloadHash(value: unknown): string {
  return createHash("sha256").update(canonicalGovernanceJson(value)).digest("hex");
}

export function isGovernanceRoleTargetCircleStatus(status: string): boolean {
  return status === "NORMAL" || status === "WARNING";
}

const ROLE_CATEGORIES: GovernanceRoleCategory[] = ["CIRCLE_LEAD", "EXPERT", "OPERATIONS", "COACH"];

export function parseGovernanceRoleCreatedPayload(value: unknown): GovernanceRoleCreatedPayloadV1 {
  const keys = "accountabilities,category,circleId,domain,name,operation,ownershipType,purpose,schemaVersion";
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== keys || value.schemaVersion !== 1 || value.operation !== "ROLE_CREATED" || value.ownershipType !== "HOME") {
    throw new GovernanceDecisionError("INVALID_ROLE_PAYLOAD");
  }
  const circleId = boundedText(value.circleId, 200, "INVALID_ROLE_PAYLOAD");
  const name = boundedText(value.name, 240, "INVALID_ROLE_PAYLOAD");
  const purpose = boundedText(value.purpose, 4_000, "INVALID_ROLE_PAYLOAD");
  const accountabilities = boundedText(value.accountabilities, 16_000, "INVALID_ROLE_PAYLOAD");
  const domain = value.domain === null ? null : boundedText(value.domain, 4_000, "INVALID_ROLE_PAYLOAD");
  if (typeof value.category !== "string" || !ROLE_CATEGORIES.includes(value.category as GovernanceRoleCategory)) throw new GovernanceDecisionError("INVALID_ROLE_PAYLOAD");
  return { schemaVersion: 1, operation: "ROLE_CREATED", circleId, name, purpose, domain, accountabilities, category: value.category as GovernanceRoleCategory, ownershipType: "HOME" };
}

export function parseGovernanceRevision(value: unknown): GovernanceProposalRevisionInput {
  if (!isRecord(value)) throw new GovernanceDecisionError("INVALID_REVISION_PAYLOAD");
  const keys = Object.keys(value).sort().join(",");
  // 接受 3 键（无 rationale/expectedImpact）或 5 键格式
  if (keys !== "currentStructure,proposedStructure,typedChange" && keys !== "currentStructure,expectedImpact,proposedStructure,rationale,typedChange") {
    throw new GovernanceDecisionError("INVALID_REVISION_PAYLOAD");
  }
  const typedChange = isRecord(value.typedChange) && ["ROLE_CREATED", "CIRCLE_CREATED", "ROLE_ASSIGNMENT", "ROLE_UNASSIGNMENT"].includes(String(value.typedChange.operation))
    ? Object.fromEntries(Object.entries(value.typedChange).filter(([key]) => key !== "targetId"))
    : value.typedChange;
  return {
    currentStructure: boundedText(value.currentStructure, 16_000, "INVALID_REVISION_PAYLOAD"),
    proposedStructure: boundedText(value.proposedStructure, 16_000, "INVALID_REVISION_PAYLOAD"),
    rationale: typeof value.rationale === "string" ? value.rationale.trim() || "—" : "—",
    expectedImpact: typeof value.expectedImpact === "string" ? value.expectedImpact.trim() || "—" : "—",
    typedChange: isRecord(typedChange) && typedChange.operation === "ROLE_CREATED"
      ? parseGovernanceRoleCreatedPayload(typedChange)
      : parseGovernanceStructuralChange(typedChange),
  };
}

export function parseGovernanceClarification(value: unknown): GovernanceClarification {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "question,reason") throw new GovernanceDecisionError("INVALID_CLARIFICATION");
  return { question: boundedText(value.question, 4_000, "INVALID_CLARIFICATION"), reason: boundedText(value.reason, 4_000, "INVALID_CLARIFICATION") };
}

export function parseGovernanceObjection(value: unknown): GovernanceObjection {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "factVsWorry,materialHarm,reversibility,safeToTry") throw new GovernanceDecisionError("INVALID_OBJECTION");
  return {
    materialHarm: boundedText(value.materialHarm, 4_000, "INVALID_OBJECTION"),
    factVsWorry: boundedText(value.factVsWorry, 4_000, "INVALID_OBJECTION"),
    reversibility: boundedText(value.reversibility, 4_000, "INVALID_OBJECTION"),
    safeToTry: boundedText(value.safeToTry, 4_000, "INVALID_OBJECTION"),
  };
}

export function parseGovernanceObjectionAssessment(value: unknown, validity: "VALID" | "INVALID"): GovernanceObjectionAssessment {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "assessmentNote,factVsWorry,materialHarm,reversibility,safeToTry,validity" || value.validity !== validity) throw new GovernanceDecisionError("INVALID_OBJECTION_ASSESSMENT");
  const objection = parseGovernanceObjection({ materialHarm: value.materialHarm, factVsWorry: value.factVsWorry, reversibility: value.reversibility, safeToTry: value.safeToTry });
  return { ...objection, validity, assessmentNote: boundedText(value.assessmentNote, 4_000, "INVALID_OBJECTION_ASSESSMENT") };
}

export async function executeGovernanceDecisionOperation(
  rawInput: GovernanceDecisionInput,
  dependencies: GovernanceDecisionDependencies,
): Promise<GovernanceDecisionResult> {
  const input = normalizeInput(rawInput);
  const now = dependencies.now?.() ?? new Date();
  const randomId = dependencies.randomId ?? randomUUID;
  const leaseMs = dependencies.leaseMs ?? GOVERNANCE_DECISION_LEASE_MS;
  const claim = await dependencies.transaction(async (transaction) => {
    await requireActiveOrganization(transaction, input.organizationId);
    const context = await transaction.lockContext(input);
    validateExactContext(context, input);
    await authorizeCurrentActor(transaction, context, input);
    await transaction.ensureOrdinaryProposal({ context, input });
    const binding = operationBinding(context, input);
    const existing = await transaction.findOperationByKey({ organizationId: input.organizationId, mutationKey: input.mutationKey });
    if (existing) {
      assertExactBinding(existing, binding);
      if (existing.status === "SUCCEEDED") {
        if (!existing.resultEnvelope) throw new GovernanceDecisionError("INVALID_REPLAY_ENVELOPE");
        return { replay: existing.resultEnvelope } as const;
      }
      validateFreshOperation(context, input);
      if (existing.status === "PROCESSING" && existing.leaseExpiresAt.getTime() > now.getTime()) throw new GovernanceDecisionError("OPERATION_IN_PROGRESS");
      const reclaimed = await transaction.reclaimOperation({
        id: existing.id,
        expectedStatus: existing.status,
        expectedAttempt: existing.attempt,
        ...(existing.status === "PROCESSING" ? { staleBefore: now } : {}),
        leaseToken: randomId(),
        leaseExpiresAt: new Date(now.getTime() + leaseMs),
      });
      if (!reclaimed) throw new GovernanceDecisionError("OPERATION_IN_PROGRESS");
      return { operation: reclaimed, context } as const;
    }
    validateFreshOperation(context, input);
    const slot = await transaction.findOperationBySlot(binding);
    if (slot) throw new GovernanceDecisionError("LOGICAL_SLOT_ALREADY_CLAIMED");
    const operation = await transaction.createOperation({ ...binding, id: randomId(), leaseToken: randomId(), leaseExpiresAt: new Date(now.getTime() + leaseMs) });
    return { operation, context } as const;
  }, { isolationLevel: "Serializable" }).catch(translateClaimError);
  if ("replay" in claim && claim.replay) return claim.replay;

  try {
    return await dependencies.transaction(async (transaction) => {
      await requireActiveOrganization(transaction, input.organizationId);
      const operation = await transaction.lockOperation({ id: claim.operation.id, leaseToken: claim.operation.leaseToken });
      if (!operation || operation.status !== "PROCESSING") throw new GovernanceDecisionError("OPERATION_LEASE_LOST");
      const context = await transaction.lockContext(input);
      validateExactContext(context, input);
      await authorizeCurrentActor(transaction, context, input);
      validateFreshOperation(context, input);
      assertExactBinding(operation, operationBinding(context, input));
      const applied = await applyOperation(transaction, context, input, randomId);
      if (input.operation === "ADOPT_ROLE") await transaction.beforeAdoptionStep?.("MARK_OPERATION_SUCCEEDED");
      if (!await transaction.markOperationSucceeded({ id: operation.id, leaseToken: operation.leaseToken, result: applied })) throw new GovernanceDecisionError("OPERATION_LEASE_LOST");
      return applied;
    }, { isolationLevel: "Serializable" });
  } catch (error) {
    if (input.operation === "ADOPT_ROLE" && claim.context.process) {
      try {
        await dependencies.transaction(async (transaction) => {
          await requireActiveOrganization(transaction, input.organizationId);
          const context = await transaction.lockContext(input);
          if (!context?.process || context.process.id !== claim.context.process!.id || context.process.state !== "READY" || context.process.currentRevision !== input.expectedRevision) throw new GovernanceDecisionError("FAILURE_AUDIT_CONTEXT_CHANGED");
          if (!await transaction.markOperationFailed({ id: claim.operation.id, leaseToken: claim.operation.leaseToken, processId: context.process.id, expectedRevision: input.expectedRevision, actorId: input.actorId, failureCode: failureCode(error), context })) throw new GovernanceDecisionError("FAILURE_AUDIT_LEASE_LOST");
        }, { isolationLevel: "Serializable" });
      } catch {
        // A failed audit intentionally leaves the same durable PROCESSING claim for lease-based reclaim.
      }
    }
    throw error;
  }
}

async function requireActiveOrganization(
  transaction: GovernanceDecisionTransaction,
  organizationId: string,
): Promise<void> {
  const lifecycle = evaluateMeetingLifecycle(
    await transaction.readOrganizationLifecycle(organizationId),
  );
  if (!lifecycle.allowed) throw new GovernanceDecisionError(lifecycle.code);
}

export function createPrismaGovernanceDecisionDependencies(client: PrismaClient, options: PrismaGovernanceDecisionOptions = {}): GovernanceDecisionDependencies {
  return {
    transaction: (work) => client.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`SELECT set_config('TimeZone', 'UTC', true)`);
        return work(prismaGovernanceTransaction(transaction, options));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
    ...(options.now ? { now: options.now } : {}),
    ...(options.leaseMs !== undefined ? { leaseMs: options.leaseMs } : {}),
  };
}

function prismaGovernanceTransaction(client: Prisma.TransactionClient, options: PrismaGovernanceDecisionOptions): GovernanceDecisionTransaction {
  const loadContext = async (input: GovernanceDecisionInput): Promise<GovernanceDecisionContext | null> => {
    await client.$queryRaw(Prisma.sql`SELECT "id" FROM "governance_proposals" WHERE "id" = ${input.proposalId} AND "organizationId" = ${input.organizationId} FOR UPDATE`);
    await client.$queryRaw(Prisma.sql`SELECT "id" FROM "governance_decision_processes" WHERE "proposalId" = ${input.proposalId} AND "organizationId" = ${input.organizationId} FOR UPDATE`);
    const process = await client.governanceDecisionProcess.findFirst({
      where: { organizationId: input.organizationId, proposalId: input.proposalId },
      select: processSelect,
    });
    const revision = process?.currentRevisionId ? await client.governanceProposalRevision.findFirst({
      where: { id: process.currentRevisionId, organizationId: input.organizationId, processId: process.id, proposalId: input.proposalId, revision: process.currentRevision },
      select: { currentStructure: true, proposedStructure: true, rationale: true, expectedImpact: true, typedChange: true },
    }) : null;
    if (input.provenanceKind === "ORDINARY_TENSION") {
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "tensions" WHERE "id" = ${input.sourceTensionId} AND "organizationId" = ${input.organizationId} FOR UPDATE`);
      const [tension, meeting, existingProposal, competingProposal] = await Promise.all([
        client.tension.findFirst({ where: { id: input.sourceTensionId, organizationId: input.organizationId, handlingMode: "GOVERNANCE" }, select: { id: true, raiserId: true, status: true } }),
        client.meeting.findFirst({ where: { id: input.meetingId, organizationId: input.organizationId, type: "GOVERNANCE" }, select: { id: true } }),
        client.governanceProposal.findFirst({ where: { id: input.proposalId, organizationId: input.organizationId, tensionId: input.sourceTensionId, status: { in: ["CANDIDATE", "ADOPTED"] }, meetingId: input.meetingId }, select: { id: true } }),
        client.governanceProposal.findFirst({ where: { organizationId: input.organizationId, tensionId: input.sourceTensionId, status: "CANDIDATE" }, select: { id: true, meetingId: true } }),
      ]);
      if (!tension || !meeting || (!existingProposal && (competingProposal || tension.status !== "OPEN"))) return null;
      const runtimeSource = await client.interfaceWorkflowArtifact.findFirst({ where: { organizationId: input.organizationId, artifactType: "TENSION", artifactId: tension.id, relation: "raised-tension" }, select: { id: true } });
      if (runtimeSource) return null;
      return {
        provenanceKind: "ORDINARY_TENSION", organizationId: input.organizationId, proposalId: input.proposalId, sourceTensionId: tension.id,
        proposerId: tension.raiserId, meetingId: input.meetingId, runId: null, sourceTensionArtifactId: null, proposalArtifactId: null,
        routeArtifactId: null, routeNodeId: null, routeNodeVisit: null, sourceTensionStatus: tension.status,
        process: process ? processSnapshot(process) : null,
        currentRevision: revision ? parseGovernanceRevision({ ...revision, typedChange: revision.typedChange }) : null,
      };
    }
    let routed;
    try { routed = await resolveRoutedGovernanceCandidateForDecision(client, input); } catch { return null; }
    return {
      provenanceKind: "INTERFACE_RUN",
      organizationId: routed.organizationId,
      proposalId: routed.proposal.id,
      sourceTensionId: routed.tension.id,
      proposerId: routed.proposerId,
      meetingId: routed.meeting.id,
      runId: routed.run.id,
      sourceTensionArtifactId: routed.sourceTensionArtifact.id,
      proposalArtifactId: routed.proposalArtifact.id,
      routeArtifactId: routed.routeArtifact.id,
      routeNodeId: routed.routeCommand.nodeId,
      routeNodeVisit: routed.routeCommand.nodeVisit,
      sourceTensionStatus: routed.tension.status,
      process: process ? processSnapshot(process) : null,
      currentRevision: revision ? parseGovernanceRevision({ ...revision, typedChange: revision.typedChange }) : null,
    };
  };

  const appendEvents = async (input: { context: GovernanceDecisionContext; events: GovernanceDecisionEvent[] }): Promise<void> => {
    if (input.events.length === 0 || input.context.provenanceKind === "ORDINARY_TENSION") return;
    const context = input.context;
    await client.$queryRaw(Prisma.sql`SELECT "id" FROM "interface_workflow_runs" WHERE "id" = ${context.runId} AND "organizationId" = ${context.organizationId} FOR UPDATE`);
    const last = await client.interfaceWorkflowRunEvent.aggregate({ where: { runId: context.runId }, _max: { sequence: true } });
    const first = (last._max.sequence ?? 0) + 1;
    await client.interfaceWorkflowRunEvent.createMany({
      data: input.events.map((event, index) => ({ organizationId: context.organizationId, runId: context.runId, sequence: first + index, type: event.type, nodeId: context.routeNodeId, nodeVisit: context.routeNodeVisit, actorId: event.actorId, payload: event.payload as Prisma.InputJsonValue })),
    });
  };

  return {
    readOrganizationLifecycle: async (organizationId) => (await client.organization.findUnique({
      where: { id: organizationId },
      select: { lifecycleStatus: true },
    }))?.lifecycleStatus ?? null,
    lockContext: loadContext,
    ensureOrdinaryProposal: async ({ context, input }) => {
      if (input.provenanceKind !== "ORDINARY_TENSION") return;
      const existing = await client.governanceProposal.findFirst({ where: { id: context.proposalId, organizationId: context.organizationId, tensionId: context.sourceTensionId, status: { in: ["CANDIDATE", "ADOPTED"] }, meetingId: context.meetingId }, select: { id: true } });
      if (existing) return;
      const competing = await client.governanceProposal.findFirst({ where: { organizationId: context.organizationId, tensionId: context.sourceTensionId, status: "CANDIDATE" }, select: { id: true } });
      if (competing) throw new GovernanceDecisionError("ORDINARY_PROPOSAL_CONFLICT");
      const proposedChange = input.revision?.typedChange;
      if (!proposedChange) throw new GovernanceDecisionError("INVALID_REVISION");
      await client.governanceProposal.create({ data: { id: context.proposalId, organizationId: context.organizationId, tensionId: context.sourceTensionId, meetingId: context.meetingId, type: proposedChange.operation as never, proposedChange: canonicalGovernanceJson(proposedChange), rationale: input.revision?.rationale ?? "", status: "CANDIDATE" }, select: { id: true } });
    },
    isCurrentParticipant: async (input) => Boolean(await client.meeting.findFirst({ where: { id: input.meetingId, organizationId: input.organizationId, type: "GOVERNANCE", participants: { some: { id: input.actorId, organizationId: input.organizationId } } }, select: { id: true } })),
    isProposerConfirmationAllowed: async () => true,
    findOperationByKey: async (input) => operationSnapshot(await client.governanceDecisionOperation.findUnique({ where: { organizationId_mutationKey: input }, select: operationSelect })),
    findOperationBySlot: async (binding) => operationSnapshot(await client.governanceDecisionOperation.findFirst({ where: { organizationId: binding.organizationId, proposalId: binding.proposalId, meetingId: binding.meetingId, revision: binding.revision, operation: binding.operation, operationScope: binding.operationScope }, select: operationSelect })),
    createOperation: async (input) => operationSnapshotRequired(await client.governanceDecisionOperation.create({
      data: { ...input, status: "PROCESSING", attempt: 1, failureCode: null, resultEnvelope: Prisma.DbNull },
      select: operationSelect,
    })),
    reclaimOperation: async (input) => {
      const reclaimed = await client.governanceDecisionOperation.updateMany({
        where: { id: input.id, status: input.expectedStatus, attempt: input.expectedAttempt, ...(input.staleBefore ? { leaseExpiresAt: { lte: input.staleBefore } } : {}) },
        data: { status: "PROCESSING", attempt: { increment: 1 }, leaseToken: input.leaseToken, leaseExpiresAt: input.leaseExpiresAt, failureCode: null, resultEnvelope: Prisma.DbNull },
      });
      return reclaimed.count === 1 ? operationSnapshot(await client.governanceDecisionOperation.findUnique({ where: { id: input.id }, select: operationSelect })) : null;
    },
    lockOperation: async (input) => {
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "governance_decision_operations" WHERE "id" = ${input.id} AND "leaseToken" = ${input.leaseToken} FOR UPDATE`);
      return operationSnapshot(await client.governanceDecisionOperation.findFirst({ where: { id: input.id, leaseToken: input.leaseToken }, select: operationSelect }));
    },
    appendEvents,
    initializeProcess: (input) => initializePrismaProcess(client, input),
    createRevision: (input) => createPrismaRevision(client, input),
    updateProcess: (input) => updatePrismaProcess(client, input),
    applyRoleAdoption: (input) => applyPrismaRoleAdoption(client, input, options.beforeAdoptionStep),
    markOperationSucceeded: async (input) => (await client.governanceDecisionOperation.updateMany({ where: { id: input.id, leaseToken: input.leaseToken, status: "PROCESSING" }, data: { status: "SUCCEEDED", resultEnvelope: input.result as Prisma.InputJsonValue, failureCode: null } })).count === 1,
    markOperationFailed: async (input) => markPrismaOperationFailed(client, appendEvents, input, options.beforeFailureAudit),
    beforeAdoptionStep: async (step) => { await options.beforeAdoptionStep?.(step); },
  };
}

const processSelect = {
  id: true,
  organizationId: true,
  proposalId: true,
  sourceTensionId: true,
  provenanceKind: true,
  runId: true,
  meetingId: true,
  sourceTensionArtifactId: true,
  proposalArtifactId: true,
  routeArtifactId: true,
  proposerId: true,
  state: true,
  currentRevision: true,
  currentRevisionId: true,
  activeClarification: true,
  activeObjection: true,
  activeObjectionSequence: true,
  outcomeRoleId: true,
  outcomeObjectId: true,
  outcomeChangeType: true,
  decisionId: true,
  changeLogId: true,
} as const;

const operationSelect = {
  id: true,
  organizationId: true,
  proposalId: true,
  processId: true,
  meetingId: true,
  actorId: true,
  revision: true,
  operation: true,
  operationScope: true,
  mutationKey: true,
  canonicalPayloadHash: true,
  status: true,
  attempt: true,
  leaseToken: true,
  leaseExpiresAt: true,
  failureCode: true,
  resultEnvelope: true,
} as const;

type PrismaProcessRow = Prisma.GovernanceDecisionProcessGetPayload<{ select: typeof processSelect }>;
type PrismaOperationRow = Prisma.GovernanceDecisionOperationGetPayload<{ select: typeof operationSelect }>;

function processSnapshot(row: PrismaProcessRow): GovernanceDecisionProcessSnapshot {
  if (!row.currentRevisionId) throw new GovernanceDecisionError("INVALID_CURRENT_REVISION_POINTER");
  return {
    ...row,
    state: row.state as GovernanceDecisionState,
    currentRevisionId: row.currentRevisionId,
    activeClarification: row.activeClarification === null ? null : parseGovernanceClarification(row.activeClarification),
    activeObjection: row.activeObjection === null ? null : parseGovernanceObjection(row.activeObjection),
  };
}

function operationSnapshot(row: PrismaOperationRow | null): GovernanceDecisionOperationRecord | null {
  if (!row) return null;
  return {
    ...row,
    operation: row.operation,
    status: row.status,
    resultEnvelope: parseResultEnvelope(row.resultEnvelope),
  };
}

function operationSnapshotRequired(row: PrismaOperationRow): GovernanceDecisionOperationRecord {
  return operationSnapshot(row)!;
}

function parseResultEnvelope(value: unknown): GovernanceDecisionResult | null {
  if (value === null || !isRecord(value) || typeof value.processId !== "string" || typeof value.proposalId !== "string" || !Number.isInteger(value.revision) || typeof value.state !== "string") return null;
  if (!["READY", "CLARIFICATION_REQUIRED", "OBJECTION_PENDING", "AMENDMENT_REQUIRED", "NOT_ADOPTED", "ADOPTED"].includes(value.state)) return null;
  const result: GovernanceDecisionResult = { processId: value.processId, proposalId: value.proposalId, revision: value.revision as number, state: value.state as GovernanceDecisionState };
  for (const key of ["roleId", "decisionId", "changeLogId", "artifactId", "tensionId"] as const) {
    if (typeof value[key] === "string") result[key] = value[key];
  }
  return result;
}

async function initializePrismaProcess(
  client: Prisma.TransactionClient,
  input: { context: GovernanceDecisionContext; processId: string; revisionId: string; revision: GovernanceProposalRevisionInput; actorId: string },
): Promise<GovernanceDecisionProcessSnapshot> {
  await client.governanceDecisionProcess.create({
    data: {
      id: input.processId,
      organizationId: input.context.organizationId,
      proposalId: input.context.proposalId,
      sourceTensionId: input.context.sourceTensionId,
      provenanceKind: input.context.provenanceKind,
      runId: input.context.runId,
      meetingId: input.context.meetingId,
      sourceTensionArtifactId: input.context.sourceTensionArtifactId,
      proposalArtifactId: input.context.proposalArtifactId,
      routeArtifactId: input.context.routeArtifactId,
      proposerId: input.context.proposerId,
      state: "READY",
      currentRevision: 1,
      currentRevisionId: null,
    },
  });
  await client.governanceProposalRevision.create({
    data: { id: input.revisionId, organizationId: input.context.organizationId, processId: input.processId, proposalId: input.context.proposalId, revision: 1, authoredById: input.actorId, ...revisionData(input.revision), sourceKind: "INITIAL" },
  });
  await client.governanceDecisionProcess.update({ where: { id: input.processId }, data: { currentRevisionId: input.revisionId } });
  const row = await client.governanceDecisionProcess.findUnique({ where: { id: input.processId }, select: processSelect });
  if (!row) throw new GovernanceDecisionError("PROCESS_INITIALIZATION_FAILED");
  return processSnapshot(row);
}

async function createPrismaRevision(
  client: Prisma.TransactionClient,
  input: { process: GovernanceDecisionProcessSnapshot; revisionId: string; revision: GovernanceProposalRevisionInput; actorId: string; sourceKind: "CLARIFICATION" | "AMENDMENT" },
): Promise<void> {
  await client.governanceProposalRevision.create({
    data: { id: input.revisionId, organizationId: input.process.organizationId, processId: input.process.id, proposalId: input.process.proposalId, revision: input.process.currentRevision + 1, authoredById: input.actorId, ...revisionData(input.revision), sourceKind: input.sourceKind },
  });
}

async function updatePrismaProcess(
  client: Prisma.TransactionClient,
  input: { process: GovernanceDecisionProcessSnapshot; expectedState: GovernanceDecisionState; state: GovernanceDecisionState; actorId?: string; note?: string; clarification?: GovernanceClarification | null; objection?: GovernanceObjection | null; objectionSequence?: number | null; nextRevisionId?: string },
): Promise<GovernanceDecisionProcessSnapshot> {
  const data: Prisma.GovernanceDecisionProcessUncheckedUpdateManyInput = { state: input.state };
  if ("clarification" in input) data.activeClarification = input.clarification === null ? Prisma.DbNull : input.clarification as Prisma.InputJsonValue;
  if ("objection" in input) data.activeObjection = input.objection === null ? Prisma.DbNull : input.objection as Prisma.InputJsonValue;
  if ("objectionSequence" in input) data.activeObjectionSequence = input.objectionSequence;
  if (input.nextRevisionId) {
    data.currentRevision = { increment: 1 };
    data.currentRevisionId = input.nextRevisionId;
    data.recordedById = null;
    data.recordedAt = null;
    data.resultNote = null;
  }
  if (input.state === "NOT_ADOPTED") {
    data.recordedById = input.actorId;
    data.recordedAt = new Date();
    data.resultNote = input.note;
  }
  const updated = await client.governanceDecisionProcess.updateMany({
    where: { id: input.process.id, organizationId: input.process.organizationId, state: input.expectedState, currentRevision: input.process.currentRevision, currentRevisionId: input.process.currentRevisionId },
    data,
  });
  if (updated.count !== 1) throw new GovernanceDecisionError("PROCESS_STATE_CHANGED");
  const row = await client.governanceDecisionProcess.findUnique({ where: { id: input.process.id }, select: processSelect });
  if (!row) throw new GovernanceDecisionError("PROCESS_NOT_FOUND");
  return processSnapshot(row);
}

function revisionData(revision: GovernanceProposalRevisionInput) {
  return {
    currentStructure: revision.currentStructure,
    proposedStructure: revision.proposedStructure,
    rationale: revision.rationale ?? "—",
    expectedImpact: revision.expectedImpact ?? "—",
    typedChange: revision.typedChange as Prisma.InputJsonValue,
  };
}

async function applyPrismaRoleAdoption(
  client: Prisma.TransactionClient,
  input: { context: GovernanceDecisionContext; process: GovernanceDecisionProcessSnapshot; actorId: string; note: string | null; role: GovernanceRoleCreatedPayloadV1 | GovernanceStructuralChange },
  beforeStep?: (step: GovernanceAdoptionWriteStep) => Promise<void> | void,
): Promise<{ process: GovernanceDecisionProcessSnapshot; roleId?: string; objectId?: string; changeType: string; decisionId: string; changeLogId: string; artifactId?: string }> {
  if (input.role.operation !== "ROLE_CREATED") return applyPrismaNonRoleAdoption(client, { ...input, role: input.role as GovernanceStructuralChange }, beforeStep);
  const created = parseGovernanceRoleCreatedPayload(input.role);
  await client.$queryRaw(Prisma.sql`SELECT "id" FROM "governance_proposal_revisions" WHERE "id" = ${input.process.currentRevisionId} AND "processId" = ${input.process.id} FOR UPDATE`);
  if (input.context.provenanceKind === "INTERFACE_RUN") await client.$queryRaw(Prisma.sql`SELECT "id" FROM "interface_workflow_runs" WHERE "id" = ${input.context.runId} AND "organizationId" = ${input.context.organizationId} FOR UPDATE`);
  await client.$queryRaw(Prisma.sql`SELECT "id" FROM "tensions" WHERE "id" = ${input.context.sourceTensionId} AND "organizationId" = ${input.context.organizationId} FOR UPDATE`);
  const circle = await client.circle.findFirst({ where: { id: created.circleId, organizationId: input.context.organizationId }, select: { id: true, status: true } });
  if (!circle || !isGovernanceRoleTargetCircleStatus(circle.status)) throw new GovernanceDecisionError("ROLE_TARGET_CIRCLE_FORBIDDEN");
  await beforeStep?.("CREATE_ROLE");
  const role = await client.roleDef.create({
    data: { organizationId: input.context.organizationId, circleId: circle.id, name: created.name, purpose: created.purpose, domain: created.domain, accountabilities: created.accountabilities, category: created.category, ownershipType: "HOME", status: "ACTIVE" },
    select: { id: true },
  });
  const now = new Date();
  await beforeStep?.("CREATE_DECISION");
  const decision = await client.decisionRecord.create({
    data: {
      organizationId: input.context.organizationId,
      title: `治理会议采纳角色：${created.name}`,
      type: "ROLE_CHANGE",
      content: input.context.currentRevision!.proposedStructure,
      rationale: input.context.currentRevision!.rationale ?? "—",
      effectiveAt: now,
      decisionMakerId: null,
      meetingId: input.context.meetingId,
      relatedTensions: { connect: { id: input.context.sourceTensionId } },
      resolvedTensions: { connect: { id: input.context.sourceTensionId } },
    },
    select: { id: true },
  });
  await beforeStep?.("CREATE_CHANGE_LOG");
  const change = await client.changeLog.create({
    data: {
      organizationId: input.context.organizationId,
      type: "ROLE_CREATED",
      objectDesc: `角色：${created.name}`,
      beforeValue: "无",
      afterValue: canonicalGovernanceJson(created),
      impactAssessment: input.context.currentRevision!.expectedImpact ?? "—",
      effectiveAt: now,
      initiatorId: input.context.proposerId,
      decisionId: decision.id,
    },
    select: { id: true },
  });
  await beforeStep?.("UPDATE_PROPOSAL");
  const proposalUpdated = await client.governanceProposal.updateMany({
    where: { id: input.context.proposalId, organizationId: input.context.organizationId, status: "CANDIDATE", meetingId: input.context.meetingId, decisionId: null },
    data: { status: "ADOPTED", adoptedAt: now, decisionId: decision.id },
  });
  if (proposalUpdated.count !== 1) throw new GovernanceDecisionError("PROPOSAL_STATE_CHANGED");
  await beforeStep?.("UPDATE_PROCESS");
  const processUpdated = await client.governanceDecisionProcess.updateMany({
    where: { id: input.process.id, organizationId: input.context.organizationId, state: "READY", currentRevision: input.process.currentRevision, currentRevisionId: input.process.currentRevisionId, outcomeRoleId: null, decisionId: null, changeLogId: null },
    data: { state: "ADOPTED", recordedById: input.actorId, recordedAt: now, resultNote: input.note, outcomeRoleId: role.id, outcomeObjectId: role.id, outcomeChangeType: "ROLE_CREATED", decisionId: decision.id, changeLogId: change.id },
  });
  if (processUpdated.count !== 1) throw new GovernanceDecisionError("PROCESS_STATE_CHANGED");
  await beforeStep?.("RESOLVE_TENSION");
  const tensionUpdated = await client.tension.updateMany({
    where: { id: input.context.sourceTensionId, organizationId: input.context.organizationId, status: "OPEN" },
    data: { status: "RESOLVED", resolvedAt: now },
  });
  if (tensionUpdated.count !== 1) throw new GovernanceDecisionError("SOURCE_TENSION_STATE_CHANGED");
  await beforeStep?.("CREATE_ROLE_ARTIFACT");
  const artifact = input.context.provenanceKind === "INTERFACE_RUN" ? await client.interfaceWorkflowArtifact.create({
    data: {
      organizationId: input.context.organizationId,
      runId: input.context.runId,
      artifactType: "ROLE",
      artifactId: role.id,
      relation: `governance-application:${input.process.id}`,
      metadata: { schemaVersion: 1, processId: input.process.id, proposalId: input.context.proposalId, revision: input.process.currentRevision, meetingId: input.context.meetingId, proposerId: input.context.proposerId, recordedById: input.actorId, runId: input.context.runId, sourceTensionArtifactId: input.context.sourceTensionArtifactId, proposalArtifactId: input.context.proposalArtifactId, routeArtifactId: input.context.routeArtifactId, decisionId: decision.id, changeLogId: change.id, roleId: role.id },
    },
    select: { id: true },
  }) : null;
  const process = await client.governanceDecisionProcess.findUnique({ where: { id: input.process.id }, select: processSelect });
  if (!process) throw new GovernanceDecisionError("PROCESS_NOT_FOUND");
  return { process: processSnapshot(process), roleId: role.id, objectId: role.id, changeType: "ROLE_CREATED", decisionId: decision.id, changeLogId: change.id, ...(artifact ? { artifactId: artifact.id } : {}) };
}

async function applyPrismaNonRoleAdoption(
  client: Prisma.TransactionClient,
  input: { context: GovernanceDecisionContext; process: GovernanceDecisionProcessSnapshot; actorId: string; note: string | null; role: GovernanceStructuralChange },
  beforeStep?: (step: GovernanceAdoptionWriteStep) => Promise<void> | void,
): Promise<{ process: GovernanceDecisionProcessSnapshot; objectId?: string; changeType: string; decisionId: string; changeLogId: string }> {
  const change = input.role;
  const organizationId = input.context.organizationId;
  await client.$queryRaw(Prisma.sql`SELECT "id" FROM "governance_proposal_revisions" WHERE "id" = ${input.process.currentRevisionId} AND "processId" = ${input.process.id} FOR UPDATE`);
  await client.$queryRaw(Prisma.sql`SELECT "id" FROM "tensions" WHERE "id" = ${input.context.sourceTensionId} AND "organizationId" = ${organizationId} FOR UPDATE`);

  let objectId: string | undefined;
  let assignmentPersonId: string | undefined;
  let beforeValue = "无";
  const afterValue = canonicalGovernanceJson(change);
  let description: string = change.operation;
  if (change.operation === "ROLE_ASSIGNMENT") {
    const application = await client.roleAssignmentApplication.findFirst({ where: { id: change.applicationId!, organizationId, roleId: change.roleId!, applicantId: change.personId!, status: "PENDING" }, select: { id: true, roleId: true, applicantId: true, status: true } });
    if (!application) throw new GovernanceDecisionError("TARGET_NOT_FOUND");
    const role = await client.roleDef.findFirst({ where: { id: application.roleId, organizationId, status: "ACTIVE" }, select: { id: true, name: true } });
    const person = await client.person.findFirst({ where: { id: application.applicantId, organizationId }, select: { id: true, name: true } });
    if (!role || !person) throw new GovernanceDecisionError("TARGET_NOT_FOUND");
    objectId = role.id;
    assignmentPersonId = person.id;
    description = `确认任职：${person.name} → ${role.name}`;
    await beforeStep?.("CREATE_ROLE");
    await client.roleDef.update({ where: { id: role.id }, data: { assignees: { connect: { id: person.id } } } });
    await client.roleAssignmentApplication.update({ where: { id: application.id }, data: { status: "ACCEPTED" } });
    beforeValue = "未任职";
  } else if (change.operation === "ROLE_UNASSIGNMENT") {
    const role = await client.roleDef.findFirst({ where: { id: change.roleId!, organizationId, status: "ACTIVE", assignees: { some: { id: change.personId! } } }, select: { id: true, name: true } });
    const person = await client.person.findFirst({ where: { id: change.personId!, organizationId }, select: { id: true, name: true } });
    if (!role || !person) throw new GovernanceDecisionError("TARGET_NOT_FOUND");
    objectId = role.id;
    assignmentPersonId = person.id;
    description = `确认退出：${person.name} ← ${role.name}`;
    await beforeStep?.("CREATE_ROLE");
    await client.roleDef.update({ where: { id: role.id }, data: { assignees: { disconnect: { id: person.id } } } });
    beforeValue = "已任职";
  } else if (change.operation === "ROLE_MODIFIED") {
    const old = await client.roleDef.findFirst({ where: { id: change.targetId!, organizationId }, select: { id: true, name: true, purpose: true, domain: true, accountabilities: true } });
    if (!old) throw new GovernanceDecisionError("TARGET_NOT_FOUND");
    objectId = old.id;
    beforeValue = canonicalGovernanceJson(old);
    description = `修改角色：${old.name}`;
    await beforeStep?.("CREATE_ROLE");
    await client.roleDef.update({ where: { id: old.id }, data: { name: change.name, purpose: change.purpose, domain: change.domain, accountabilities: change.accountabilities } });
  } else if (change.operation === "ROLE_ARCHIVED") {
    const old = await client.roleDef.findFirst({ where: { id: change.targetId!, organizationId }, select: { id: true, name: true, status: true } });
    if (!old) throw new GovernanceDecisionError("TARGET_NOT_FOUND");
    objectId = old.id;
    beforeValue = old.status;
    description = `废弃角色：${old.name}`;
    await beforeStep?.("CREATE_ROLE");
    await client.roleDef.update({ where: { id: old.id }, data: { status: "ARCHIVED" } });
  } else if (change.operation === "CIRCLE_CREATED") {
    const circle = await client.circle.create({ data: { organizationId, name: change.name!, purpose: change.purpose!, domain: change.domain, number: change.number as never, type: change.type as never, parentId: change.parentId }, select: { id: true } });
    objectId = circle.id;
    description = `新建回路：${change.name}`;
  } else if (change.operation === "CIRCLE_MODIFIED") {
    const old = await client.circle.findFirst({ where: { id: change.targetId!, organizationId }, select: { id: true, name: true, purpose: true, domain: true } });
    if (!old) throw new GovernanceDecisionError("TARGET_NOT_FOUND");
    objectId = old.id;
    beforeValue = canonicalGovernanceJson(old);
    description = `修改回路：${old.name}`;
    await client.circle.update({ where: { id: old.id }, data: { name: change.name, purpose: change.purpose, domain: change.domain } });
  } else if (change.operation === "HOME_CHANGE") {
    const person = await client.person.findFirst({ where: { id: change.targetId!, organizationId }, select: { id: true, name: true, homeCircleId: true } });
    const circle = await client.circle.findFirst({ where: { id: change.homeCircleId!, organizationId }, select: { id: true } });
    if (!person || !circle) throw new GovernanceDecisionError("TARGET_NOT_FOUND");
    objectId = person.id;
    beforeValue = person.homeCircleId ?? "无归属";
    description = `变更归属：${person.name}`;
    await client.person.update({ where: { id: person.id }, data: { homeCircleId: circle.id } });
  } else if (change.operation === "AGENT_CREATED") {
    const circle = await client.circle.findFirst({ where: { id: change.circleId!, organizationId }, select: { id: true } });
    if (!circle) throw new GovernanceDecisionError("TARGET_NOT_FOUND");
    const agent = await client.person.create({ data: { organizationId, name: change.name!, entityType: "AGENT", agentModel: change.agentModel!, agentEndpoint: change.agentEndpoint, agentAbilities: change.agentAbilities!, agentConfig: change.agentConfig, homeCircleId: circle.id }, select: { id: true } });
    objectId = agent.id;
    description = `新增智能体：${change.name}`;
  } else if (change.operation === "CHARTER_CREATED") {
    const charter = await client.charter.create({ data: { organizationId, version: change.version!, content: change.content!, changeSummary: change.changeSummary, previousVersionId: change.previousVersionId }, select: { id: true } });
    objectId = charter.id;
    description = `创建宪章：${change.version}`;
  } else if (change.operation === "CHARTER_AMENDED") {
    const old = await client.charter.findFirst({ where: { id: change.targetId!, organizationId }, select: { id: true, content: true, version: true } });
    if (!old) throw new GovernanceDecisionError("TARGET_NOT_FOUND");
    objectId = old.id;
    beforeValue = canonicalGovernanceJson(old);
    description = `修订宪章：${old.version}`;
    await client.charter.update({ where: { id: old.id }, data: { version: change.version, content: change.content, changeSummary: change.changeSummary } });
  }

  const now = new Date();
  const decision = await client.decisionRecord.create({ data: { organizationId, title: `治理会议采纳：${description}`, type: change.operation.includes("CIRCLE") || change.operation === "HOME_CHANGE" ? "CIRCLE_STRUCTURE_CHANGE" : change.operation.includes("CHARTER") ? "STRATEGY_CHANGE" : "ROLE_CHANGE", content: afterValue, rationale: input.context.currentRevision!.rationale ?? "—", effectiveAt: now, decisionMakerId: input.actorId, meetingId: input.context.meetingId, relatedTensions: { connect: { id: input.context.sourceTensionId } }, resolvedTensions: { connect: { id: input.context.sourceTensionId } }, }, select: { id: true } });
  const changeLog = await client.changeLog.create({ data: { organizationId, type: change.operation as never, objectDesc: description, beforeValue, afterValue, impactAssessment: input.context.currentRevision!.expectedImpact ?? "—", effectiveAt: now, initiatorId: input.context.proposerId, decisionId: decision.id }, select: { id: true } });
  if (change.operation === "ROLE_ASSIGNMENT" && assignmentPersonId && objectId) {
    await client.roleAssignmentHistory.create({ data: { organizationId, roleId: objectId, personId: assignmentPersonId, eventType: "ASSIGNED", effectiveAt: now, decisionId: decision.id, changeLogId: changeLog.id } });
  }
  if (change.operation === "ROLE_UNASSIGNMENT" && assignmentPersonId && objectId) {
    await client.roleAssignmentHistory.create({ data: { organizationId, roleId: objectId, personId: assignmentPersonId, eventType: "RELEASED", effectiveAt: now, decisionId: decision.id, changeLogId: changeLog.id } });
  }
  const proposalUpdated = await client.governanceProposal.updateMany({ where: { id: input.context.proposalId, organizationId, status: "CANDIDATE", meetingId: input.context.meetingId, decisionId: null }, data: { status: "ADOPTED", adoptedAt: now, decisionId: decision.id } });
  if (proposalUpdated.count !== 1) throw new GovernanceDecisionError("PROPOSAL_STATE_CHANGED");
  const processUpdated = await client.governanceDecisionProcess.updateMany({ where: { id: input.process.id, organizationId, state: "READY", currentRevision: input.process.currentRevision, currentRevisionId: input.process.currentRevisionId, outcomeRoleId: null, decisionId: null, changeLogId: null }, data: { state: "ADOPTED", recordedById: input.actorId, recordedAt: now, resultNote: input.note, outcomeObjectId: objectId, outcomeChangeType: change.operation, decisionId: decision.id, changeLogId: changeLog.id } });
  if (processUpdated.count !== 1) throw new GovernanceDecisionError("PROCESS_STATE_CHANGED");
  const tensionUpdated = await client.tension.updateMany({ where: { id: input.context.sourceTensionId, organizationId, status: "OPEN" }, data: { status: "RESOLVED", resolvedAt: now } });
  if (tensionUpdated.count !== 1) throw new GovernanceDecisionError("SOURCE_TENSION_STATE_CHANGED");
  const process = await client.governanceDecisionProcess.findUnique({ where: { id: input.process.id }, select: processSelect });
  if (!process) throw new GovernanceDecisionError("PROCESS_NOT_FOUND");
  return { process: processSnapshot(process), objectId, changeType: change.operation, decisionId: decision.id, changeLogId: changeLog.id };
}

async function markPrismaOperationFailed(
  client: Prisma.TransactionClient,
  appendEvents: (input: { context: GovernanceDecisionContext; events: GovernanceDecisionEvent[] }) => Promise<void>,
  input: { id: string; leaseToken: string; processId: string; expectedRevision: number; actorId: string; failureCode: string; context: GovernanceDecisionContext },
  beforeFailureAudit?: () => Promise<void> | void,
): Promise<boolean> {
  await beforeFailureAudit?.();
  await client.$queryRaw(Prisma.sql`SELECT "id" FROM "governance_decision_operations" WHERE "id" = ${input.id} AND "leaseToken" = ${input.leaseToken} FOR UPDATE`);
  const failed = await client.governanceDecisionOperation.updateMany({
    where: { id: input.id, leaseToken: input.leaseToken, status: "PROCESSING", processId: input.processId, revision: input.expectedRevision },
    data: { status: "FAILED", failureCode: input.failureCode, resultEnvelope: Prisma.DbNull },
  });
  if (failed.count !== 1) return false;
  const process = await client.governanceDecisionProcess.updateMany({
    where: { id: input.processId, organizationId: input.context.organizationId, state: "READY", currentRevision: input.expectedRevision },
    data: { applicationAttempts: { increment: 1 }, lastApplicationError: input.failureCode },
  });
  if (process.count !== 1) throw new GovernanceDecisionError("FAILURE_AUDIT_CONTEXT_CHANGED");
  await appendEvents({ context: input.context, events: [{ type: "COMMAND_FAILED", actorId: input.actorId, payload: { schemaVersion: 1, processId: input.processId, proposalId: input.context.proposalId, revision: input.expectedRevision, meetingId: input.context.meetingId, failureCode: input.failureCode } }] });
  return true;
}

async function authorizeCurrentActor(transaction: GovernanceDecisionTransaction, context: GovernanceDecisionContext, input: GovernanceDecisionInput): Promise<void> {
  const isCurrentParticipant = await transaction.isCurrentParticipant({ organizationId: input.organizationId, meetingId: input.meetingId, actorId: input.actorId });
  await authorizeProposerConfirmation({ operation: input.operation, actorId: input.actorId, proposerId: context.proposerId, allowed: transaction.isProposerConfirmationAllowed ? await transaction.isProposerConfirmationAllowed({ organizationId: input.organizationId }) : true });
  authorizeGovernanceOperation({ operation: input.operation, actorId: input.actorId, proposerId: context.proposerId, isCurrentParticipant });
}

async function applyOperation(transaction: GovernanceDecisionTransaction, context: GovernanceDecisionContext, input: GovernanceDecisionInput, randomId: () => string): Promise<GovernanceDecisionResult> {
  if (input.operation === "INITIALIZE") {
    const process = await transaction.initializeProcess({ context, processId: randomId(), revisionId: randomId(), revision: input.revision!, actorId: input.actorId });
    await transaction.appendEvents({ context: { ...context, process }, events: [governanceEvent("GOVERNANCE_PROCESS_INITIALIZED", input, process.id)] });
    return processResult(process);
  }
  const process = context.process!;
  if (input.operation === "SUBMIT_REVISION") {
    const revisionId = randomId();
    const sourceKind = process.state === "CLARIFICATION_REQUIRED" ? "CLARIFICATION" : "AMENDMENT";
    await transaction.createRevision({ process, revisionId, revision: input.revision!, actorId: input.actorId, sourceKind });
    const updated = await transaction.updateProcess({ process, expectedState: process.state, state: "READY", clarification: null, objection: null, objectionSequence: null, nextRevisionId: revisionId });
    await transaction.appendEvents({ context: { ...context, process: updated }, events: [governanceEvent("GOVERNANCE_REVISION_AUTHORED", input, process.id, { revision: updated.currentRevision })] });
    return processResult(updated);
  }
  if (input.operation === "ADOPT_ROLE") {
    const role = context.currentRevision!.typedChange.operation === "ROLE_CREATED"
      ? parseGovernanceRoleCreatedPayload(context.currentRevision!.typedChange)
      : context.currentRevision!.typedChange;
    const adopted = await transaction.applyRoleAdoption({ context, process, actorId: input.actorId, note: input.note ?? null, role });
    await transaction.beforeAdoptionStep?.("APPEND_EVENTS");
    await transaction.appendEvents({ context: { ...context, process: adopted.process }, events: [
      governanceEvent("GOVERNANCE_ADOPTION_RECORDED", input, process.id),
      governanceEvent("GOVERNANCE_STRUCTURE_APPLIED", input, process.id, { ...(adopted.roleId ? { roleId: adopted.roleId } : {}), ...(adopted.objectId ? { objectId: adopted.objectId } : {}), ...(adopted.changeType ? { changeType: adopted.changeType } : {}), decisionId: adopted.decisionId, changeLogId: adopted.changeLogId }),
      ...(adopted.artifactId ? [governanceEvent("ARTIFACT_CREATED", input, process.id, { artifactId: adopted.artifactId, roleId: adopted.roleId })] : []),
    ] });
    return { ...processResult(adopted.process), ...(adopted.roleId ? { roleId: adopted.roleId } : {}), ...(adopted.objectId ? { objectId: adopted.objectId } : {}), changeType: adopted.changeType, decisionId: adopted.decisionId, changeLogId: adopted.changeLogId, ...(adopted.artifactId ? { artifactId: adopted.artifactId } : {}), tensionId: context.sourceTensionId };
  }
  const nextState = transitionGovernanceDecision(process.state, input.operation);
  const updated = await transaction.updateProcess({
    process,
    expectedState: process.state,
    state: nextState,
    actorId: input.actorId,
    note: input.note,
    ...(input.operation === "REQUEST_CLARIFICATION" ? { clarification: input.clarification! } : {}),
    ...(input.operation === "RAISE_OBJECTION" ? { objection: input.objection!, objectionSequence: 1 } : {}),
    ...(input.operation === "ASSESS_OBJECTION_INVALID" ? { objection: null, objectionSequence: null } : {}),
    ...(input.operation === "RECORD_NON_ADOPTION" ? { objection: null, objectionSequence: null } : {}),
  });
  await transaction.appendEvents({ context: { ...context, process: updated }, events: eventsForOperation(input, process.id) });
  return processResult(updated);
}

function normalizeInput(input: GovernanceDecisionInput): GovernanceDecisionInput {
  const common = {
    ...input,
    organizationId: boundedText(input.organizationId, 200, "INVALID_INPUT"),
    proposalId: boundedText(input.proposalId, 200, "INVALID_INPUT"),
    meetingId: boundedText(input.meetingId, 200, "INVALID_INPUT"),
    actorId: boundedText(input.actorId, 200, "INVALID_INPUT"),
    operationScope: boundedText(input.operationScope, 240, "INVALID_INPUT"),
    mutationKey: boundedText(input.mutationKey, 240, "INVALID_INPUT"),
  };
  const normalized = (input.provenanceKind === "ORDINARY_TENSION"
    ? { ...common, provenanceKind: "ORDINARY_TENSION", sourceTensionId: boundedText(input.sourceTensionId, 200, "INVALID_INPUT") }
    : { ...common, provenanceKind: "INTERFACE_RUN", runId: boundedText(input.runId, 200, "INVALID_INPUT"), proposalArtifactId: boundedText(input.proposalArtifactId, 200, "INVALID_INPUT"), routeArtifactId: boundedText(input.routeArtifactId, 200, "INVALID_INPUT") }) as unknown as GovernanceDecisionInput;
  if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) throw new GovernanceDecisionError("INVALID_INPUT");
  if (input.operation === "INITIALIZE" || input.operation === "SUBMIT_REVISION") normalized.revision = parseGovernanceRevision(input.revision);
  if (input.operation === "REQUEST_CLARIFICATION") normalized.clarification = parseGovernanceClarification(input.clarification);
  if (input.operation === "RAISE_OBJECTION") normalized.objection = parseGovernanceObjection(input.objection);
  if (input.operation === "ASSESS_OBJECTION_VALID") normalized.assessment = parseGovernanceObjectionAssessment(input.assessment, "VALID");
  if (input.operation === "ASSESS_OBJECTION_INVALID") normalized.assessment = parseGovernanceObjectionAssessment(input.assessment, "INVALID");
  if (input.operation === "RECORD_NON_ADOPTION") normalized.note = boundedText(input.note, 4_000, "INVALID_RESULT_NOTE");
  if (input.operation === "ADOPT_ROLE" && input.note !== undefined) normalized.note = optionalBoundedText(input.note, 4_000, "INVALID_RESULT_NOTE");
  return normalized;
}

function validateExactContext(context: GovernanceDecisionContext | null, input: GovernanceDecisionInput): asserts context is GovernanceDecisionContext {
  if (!context || context.provenanceKind !== input.provenanceKind || context.organizationId !== input.organizationId || context.proposalId !== input.proposalId || context.meetingId !== input.meetingId) throw new GovernanceDecisionError("PROVENANCE_MISMATCH");
  if (input.provenanceKind === "ORDINARY_TENSION") {
    if (context.sourceTensionId !== input.sourceTensionId || context.runId !== null || context.sourceTensionArtifactId !== null || context.proposalArtifactId !== null || context.routeArtifactId !== null) throw new GovernanceDecisionError("PROVENANCE_MISMATCH");
  } else if (context.runId !== input.runId || context.proposalArtifactId !== input.proposalArtifactId || context.routeArtifactId !== input.routeArtifactId) {
    throw new GovernanceDecisionError("PROVENANCE_MISMATCH");
  }
}

function validateFreshOperation(context: GovernanceDecisionContext, input: GovernanceDecisionInput): void {
  transitionGovernanceDecision(context.process?.state ?? null, input.operation);
  if (input.operation === "INITIALIZE") {
    if (context.process || input.expectedRevision !== 1 || context.sourceTensionStatus !== "OPEN") throw new GovernanceDecisionError("STALE_REVISION");
    return;
  }
  if (!context.process || context.process.currentRevision !== input.expectedRevision || !context.currentRevision) throw new GovernanceDecisionError("STALE_REVISION");
  if (input.operation === "ASSESS_OBJECTION_VALID" || input.operation === "ASSESS_OBJECTION_INVALID") {
    const activeObjection = context.process.activeObjection;
    if (!activeObjection || canonicalGovernanceJson(activeObjection) !== canonicalGovernanceJson(assessmentObjection(input.assessment!))) {
      throw new GovernanceDecisionError("OBJECTION_BINDING_MISMATCH");
    }
  }
  if ((input.operation === "SUBMIT_REVISION" || input.operation === "ADOPT_ROLE") && context.sourceTensionStatus !== "OPEN") throw new GovernanceDecisionError("SOURCE_TENSION_NOT_OPEN");
}

function operationBinding(context: GovernanceDecisionContext, input: GovernanceDecisionInput): OperationBinding {
  const processId = input.operation === "INITIALIZE" ? null : context.process?.id ?? null;
  return {
    organizationId: input.organizationId,
    proposalId: input.proposalId,
    processId,
    meetingId: input.meetingId,
    actorId: input.actorId,
    revision: input.expectedRevision,
    operation: ledgerOperation(input.operation),
    operationScope: input.operationScope,
    mutationKey: input.mutationKey,
    canonicalPayloadHash: governancePayloadHash({ schemaVersion: 1, organizationId: input.organizationId, proposalId: input.proposalId, processId, meetingId: input.meetingId, actorId: input.actorId, operation: input.operation, expectedRevision: input.expectedRevision, operationScope: input.operationScope, mutationKey: input.mutationKey, payload: operationPayload(context, input) }),
  };
}

function assertExactBinding(operation: GovernanceDecisionOperationRecord, binding: OperationBinding): void {
  const keys: Array<keyof OperationBinding> = ["organizationId", "proposalId", "processId", "meetingId", "actorId", "revision", "operation", "operationScope", "mutationKey", "canonicalPayloadHash"];
  if (keys.some((key) => operation[key] !== binding[key])) throw new GovernanceDecisionError("IDEMPOTENCY_BINDING_CONFLICT");
}

function operationPayload(context: GovernanceDecisionContext, input: GovernanceDecisionInput): unknown {
  if (input.operation === "INITIALIZE" || input.operation === "SUBMIT_REVISION") return input.revision;
  if (input.operation === "REQUEST_CLARIFICATION") return input.clarification;
  if (input.operation === "RAISE_OBJECTION") return input.objection;
  if (input.operation === "ASSESS_OBJECTION_VALID" || input.operation === "ASSESS_OBJECTION_INVALID") return input.assessment;
  if (input.operation === "ADOPT_ROLE") {
    return {
      revisionId: context.process?.currentRevisionId ?? null,
      revision: context.process?.currentRevision ?? null,
      typedChange: context.currentRevision?.typedChange ?? null,
      note: input.note ?? null,
    };
  }
  return { note: input.note ?? null };
}

function assessmentObjection(assessment: GovernanceObjectionAssessment): GovernanceObjection {
  return {
    materialHarm: assessment.materialHarm,
    factVsWorry: assessment.factVsWorry,
    reversibility: assessment.reversibility,
    safeToTry: assessment.safeToTry,
  };
}

function ledgerOperation(operation: GovernanceDecisionOperation): GovernanceDecisionLedgerOperation {
  return operation === "ASSESS_OBJECTION_VALID" || operation === "ASSESS_OBJECTION_INVALID" ? "ASSESS_OBJECTION" : operation;
}

function eventsForOperation(input: GovernanceDecisionInput, processId: string): GovernanceDecisionEvent[] {
  if (input.operation === "REQUEST_CLARIFICATION") return [governanceEvent("GOVERNANCE_CLARIFICATION_REQUESTED", input, processId, { clarification: input.clarification })];
  if (input.operation === "RAISE_OBJECTION") return [governanceEvent("GOVERNANCE_OBJECTION_RAISED", input, processId, { objection: input.objection })];
  if (input.operation === "ASSESS_OBJECTION_VALID" || input.operation === "ASSESS_OBJECTION_INVALID") return [governanceEvent("GOVERNANCE_OBJECTION_ASSESSED", input, processId, { assessment: input.assessment })];
  return [governanceEvent("GOVERNANCE_NON_ADOPTION_RECORDED", input, processId, { note: input.note })];
}

function governanceEvent(type: string, input: GovernanceDecisionInput, processId: string, extra: Record<string, unknown> = {}): GovernanceDecisionEvent {
  return { type, actorId: input.actorId, payload: { schemaVersion: 1, processId, proposalId: input.proposalId, revision: input.expectedRevision, meetingId: input.meetingId, ...extra } };
}

function processResult(process: GovernanceDecisionProcessSnapshot): GovernanceDecisionResult {
  return { processId: process.id, proposalId: process.proposalId, revision: process.currentRevision, state: process.state };
}

function failureCode(error: unknown): string {
  const code = error instanceof GovernanceDecisionError ? error.code : error instanceof Error ? error.message : "ADOPTION_APPLICATION_FAILED";
  return /^[A-Z0-9_:-]+$/.test(code) ? code.slice(0, 128) : "ADOPTION_APPLICATION_FAILED";
}

function translateClaimError(error: unknown): never {
  if (isRecord(error) && error.code === "P2002") throw new GovernanceDecisionError("OPERATION_CLAIM_CONFLICT");
  if (isRecord(error) && error.code === "P2034") throw new GovernanceDecisionError("SERIALIZATION_CONFLICT");
  if (isRecord(error) && error.code === "P2010" && error.message?.toString().includes("40001")) throw new GovernanceDecisionError("SERIALIZATION_CONFLICT");
  throw error;
}

function optionalBoundedText(value: unknown, maxBytes: number, code: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new GovernanceDecisionError(code);
  const normalized = value.trim();
  if (Buffer.byteLength(normalized, "utf8") > maxBytes) throw new GovernanceDecisionError(code);
  return normalized;
}

function boundedText(value: unknown, maxBytes: number, code: string): string {
  if (typeof value !== "string") throw new GovernanceDecisionError(code);
  const normalized = value.trim();
  if (!normalized || Buffer.byteLength(normalized, "utf8") > maxBytes) throw new GovernanceDecisionError(code);
  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
