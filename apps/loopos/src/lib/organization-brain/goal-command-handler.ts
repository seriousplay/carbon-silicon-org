import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  appendGoalCheckIns,
  appendGoalProposalRevision,
  createGoalProposal,
  createPrismaGoalDomainDependencies,
  createPrismaGoalDomainTransactionDependencies,
  GoalDomainError,
  type AppendGoalCheckInsInput,
  type AppendGoalProposalRevisionInput,
  type CreateGoalProposalInput,
  type GoalCheckInSnapshot,
  type GoalDomainActor,
  type GoalDomainDependencies,
  type GoalProposalSnapshot,
  type GoalProposalTargetInput,
} from "@/lib/goals/domain-operations";
import {
  DomainOperationError,
  raiseTension,
  submitTacticalOutcomeProposal,
  updateMeetingNotes,
  type RaiseTensionInput,
  type SubmitTacticalOutcomeProposalInput,
  type SubmitTacticalOutcomeProposalResult,
  type UpdateMeetingNotesInput,
  type UpdateMeetingNotesResult,
} from "@/lib/domain-operations";

import {
  BRAIN_COMMAND_REGISTRY,
  hashBrainCommandBinding,
  parseBrainCommandPublicError,
  publicBrainCommandError,
  type BrainCommandName,
  type BrainCommandPublicError,
  type BrainCommandPublicErrorCode,
  type BrainCommandResult,
  type BrainCommandServerPayload,
  type BrainCommandSourceBinding,
  type BrainCommandTargetPayload,
} from "./command-registry";
import { resolveBrainCapability } from "./capability-registry";
import { parseGovernanceStructuralChange } from "@/lib/governance-change";
import { evaluateMeetingLifecycle } from "@/lib/organization-setup/meeting-lifecycle-policy";

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };

const EXECUTABLE_HANDLER_IDS = Object.freeze({
  "goal_proposal.create_draft": "goal-command-handler.create-goal-proposal",
  "goal_proposal.append_returned_revision": "goal-command-handler.append-goal-proposal-revision",
  "goal_check_in.append": "goal-command-handler.append-goal-check-in",
  "tension.raise": "goal-command-handler.raise-tension",
  "tactical_outcome.submit_proposal": "goal-command-handler.submit-tactical-outcome-proposal",
  "meeting_notes.update": "goal-command-handler.update-meeting-notes",
  "governance_proposal.create": "goal-command-handler.create-governance-proposal",
  "role_application.create": "goal-command-handler.create-role-application",
} as const);

export type BrainGoalCommandActor = Readonly<{
  organizationId: string;
  userId: string;
  personId: string;
}>;

export type BrainGoalCommandOperation = Readonly<{
  id: string;
  organizationId: string;
  ownerUserId: string;
  actorId: string;
  commandName: string;
  commandSchemaVersion: number;
  serverPayload: unknown;
  payloadHash: string;
  sourceBindings: unknown;
  sourceBindingHash: string;
  previewExpiresAt: Date;
  mutationKey: string | null;
  status: "PREVIEWED" | "SUCCEEDED" | "REJECTED" | "EXPIRED";
  terminalCode: string | null;
  terminalResult: unknown;
}>;

export type BrainGoalCommandTerminalInput = Readonly<{
  id: string;
  actor: BrainGoalCommandActor;
  status: "SUCCEEDED" | "REJECTED" | "EXPIRED";
  mutationKey: string | null;
  terminalCode: BrainCommandPublicErrorCode | "SUCCEEDED";
  terminalResult: BrainGoalCommandTerminalEnvelope;
  now: Date;
}>;

export type BrainGoalCommandLedgerStore = Readonly<{
  loadOwnedOperation(input: Readonly<{
    id: string;
    actor: BrainGoalCommandActor;
  }>): Promise<BrainGoalCommandOperation | null>;
  findOperationByMutationKey(input: Readonly<{
    organizationId: string;
    mutationKey: string;
  }>): Promise<BrainGoalCommandOperation | null>;
  completeOperation(input: BrainGoalCommandTerminalInput): Promise<BrainGoalCommandOperation>;
}>;

export type BrainGoalCommandSourceValidationInput = Readonly<{
  actor: BrainGoalCommandActor;
  command: ExecutableBrainCommandName;
  payload: ExecutableBrainCommandPayload;
  sourceBindings: readonly BrainCommandSourceBinding[];
}>;

export type BrainGoalCommandSourceValidationResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      ok: false;
      code: Extract<
        BrainCommandPublicErrorCode,
        "ACCESS_DENIED" | "NOT_AVAILABLE" | "STALE_PREVIEW" | "INVALID_STATE"
      >;
    }>;

export type BrainGoalCommandSourceValidator = Readonly<{
  validate(input: BrainGoalCommandSourceValidationInput): Promise<BrainGoalCommandSourceValidationResult>;
}>;

export type BrainGoalCommandOperations = Readonly<{
  createGoalProposal(
    input: CreateGoalProposalInput,
    dependencies: GoalDomainDependencies,
  ): Promise<GoalProposalSnapshot>;
  appendGoalProposalRevision(
    input: AppendGoalProposalRevisionInput,
    dependencies: GoalDomainDependencies,
  ): Promise<GoalProposalSnapshot>;
  appendGoalCheckIns(
    input: AppendGoalCheckInsInput,
    dependencies: GoalDomainDependencies,
  ): Promise<GoalCheckInSnapshot[]>;
  raiseTension(input: RaiseTensionInput): Promise<{ id: string }>;
  submitTacticalOutcomeProposal(
    input: SubmitTacticalOutcomeProposalInput,
  ): Promise<SubmitTacticalOutcomeProposalResult>;
  updateMeetingNotes(input: UpdateMeetingNotesInput): Promise<UpdateMeetingNotesResult>;
  createGovernanceProposal?(input: {
    organizationId: string;
    actorId: string;
    tensionId: string;
    meetingId: string;
    currentStructure: string;
    proposedStructure: string;
    rationale: string;
    expectedImpact: string;
    structuralChange: unknown;
  }): Promise<{ id: string }>;
  createRoleApplication?(input: { organizationId: string; applicantId: string; roleId: string; motivation: string; capabilitySummary: string; commitment: string }): Promise<{ id: string }>;
}>;

export type BrainGoalCommandDependencies = Readonly<{
  ledger: BrainGoalCommandLedgerStore;
  goalDomain: GoalDomainDependencies;
  sourceValidator: BrainGoalCommandSourceValidator;
  readMeetingLifecycleStatus(organizationId: string): Promise<unknown>;
  operations?: BrainGoalCommandOperations;
  now?: () => Date;
  correlationId?: () => string;
  runAtomically?<T>(work: (dependencies: BrainGoalCommandDependencies) => Promise<T>): Promise<T>;
  deferDomainRejection?: boolean;
}>;

export type BrainGoalCommandTerminalEnvelope =
  | Readonly<{
      schemaVersion: 1;
      ok: true;
      code: "SUCCEEDED";
      result: BrainCommandResult;
    }>
  | Readonly<{
      schemaVersion: 1;
      ok: false;
      code: BrainCommandPublicErrorCode;
      error: BrainCommandPublicError;
    }>;

export type BrainGoalCommandConfirmResult =
  | Readonly<{
      ok: true;
      previewId: string;
      command: ExecutableBrainCommandName;
      result: BrainCommandResult;
    }>
  | Readonly<{
      ok: false;
      previewId?: string;
      error: BrainCommandPublicError;
    }>;

export const D1_BRAIN_GOAL_COMMAND_NAMES = Object.freeze([
  "goal_proposal.create_draft",
  "goal_proposal.append_returned_revision",
  "goal_check_in.append",
] as const);

export type D1BrainGoalCommandName = (typeof D1_BRAIN_GOAL_COMMAND_NAMES)[number];
export type D1BrainGoalCommandPayload = Extract<
  BrainCommandServerPayload,
  { command: D1BrainGoalCommandName }
>;

export const M3_D2_BRAIN_COMMAND_NAMES = Object.freeze([
  "tension.raise",
  "tactical_outcome.submit_proposal",
] as const);

export type M3D2BrainCommandName = (typeof M3_D2_BRAIN_COMMAND_NAMES)[number];
export type M3D2BrainCommandPayload = Extract<
  BrainCommandServerPayload,
  { command: M3D2BrainCommandName }
>;

export const M3_D3_BRAIN_COMMAND_NAMES = Object.freeze([
  "meeting_notes.update",
] as const);

export type M3D3BrainCommandName = (typeof M3_D3_BRAIN_COMMAND_NAMES)[number];
export type M3D3BrainCommandPayload = Extract<
  BrainCommandServerPayload,
  { command: M3D3BrainCommandName }
>;

export const M6_3_BRAIN_COMMAND_NAMES = Object.freeze([
  "governance_proposal.create",
] as const);
export type M6_3BrainCommandName = (typeof M6_3_BRAIN_COMMAND_NAMES)[number];
export const M8_BRAIN_COMMAND_NAMES = Object.freeze(["role_application.create"] as const);
export type M8BrainCommandName = (typeof M8_BRAIN_COMMAND_NAMES)[number];

export type ExecutableBrainCommandName =
  | D1BrainGoalCommandName
  | M3D2BrainCommandName
  | M3D3BrainCommandName
  | M6_3BrainCommandName
  | M8BrainCommandName;
export type ExecutableBrainCommandPayload = Extract<
  BrainCommandServerPayload,
  { command: ExecutableBrainCommandName }
>;

function createPrismaBrainCommandOperations(
  client: PrismaClient | Prisma.TransactionClient,
): BrainGoalCommandOperations {
  return {
    createGoalProposal,
    appendGoalProposalRevision,
    appendGoalCheckIns,
    raiseTension: (input) => raiseTension(client, input),
    submitTacticalOutcomeProposal: (input) => submitTacticalOutcomeProposal(client, input),
    updateMeetingNotes: (input) => updateMeetingNotes(client, input),
    createGovernanceProposal: async (input) => {
      const change = parseGovernanceStructuralChange(input.structuralChange);
      const tension = await client.tension.findFirst({ where: { id: input.tensionId, organizationId: input.organizationId, status: "OPEN", raiserId: input.actorId }, select: { id: true } });
      if (!tension) throw new DomainOperationError("GOVERNANCE_CANDIDATE_AUTHOR_FORBIDDEN");
      const meeting = await client.meeting.findFirst({ where: { id: input.meetingId, organizationId: input.organizationId, type: "GOVERNANCE", endedAt: null, participants: { some: { id: input.actorId, organizationId: input.organizationId } } }, select: { id: true } });
      if (!meeting) throw new DomainOperationError("MEETING_NOT_FOUND");
      const existing = await client.governanceProposal.findFirst({ where: { organizationId: input.organizationId, tensionId: input.tensionId, status: "CANDIDATE" }, select: { id: true } });
      if (existing) throw new DomainOperationError("GOVERNANCE_CANDIDATE_EXISTS");
      const proposal = await client.governanceProposal.create({ data: { organizationId: input.organizationId, tensionId: input.tensionId, meetingId: input.meetingId, type: change.operation, proposedChange: JSON.stringify(change), rationale: input.rationale, status: "CANDIDATE" }, select: { id: true } });
      return { id: proposal.id };
    },
    createRoleApplication: async (input) => {
      const role = await client.roleDef.findFirst({ where: { id: input.roleId, organizationId: input.organizationId, status: "ACTIVE", assignees: { none: {} } }, select: { id: true } });
      if (!role) throw new DomainOperationError("TARGET_NOT_FOUND");
      const existing = await client.roleAssignmentApplication.findFirst({ where: { organizationId: input.organizationId, roleId: role.id, applicantId: input.applicantId, status: "PENDING" }, select: { id: true } });
      if (existing) throw new DomainOperationError("ROLE_APPLICATION_EXISTS");
      const application = await client.roleAssignmentApplication.create({ data: { organizationId: input.organizationId, roleId: role.id, applicantId: input.applicantId, motivation: input.motivation, capabilitySummary: input.capabilitySummary, commitment: input.commitment }, select: { id: true } });
      return { id: application.id };
    },
  };
}

const DEFAULT_OPERATIONS: BrainGoalCommandOperations = Object.freeze({
  createGoalProposal,
  appendGoalProposalRevision,
  appendGoalCheckIns,
  raiseTension: async () => {
    throw new DomainOperationError("COMMAND_HANDLER_NOT_CONFIGURED");
  },
  submitTacticalOutcomeProposal: async () => {
    throw new DomainOperationError("COMMAND_HANDLER_NOT_CONFIGURED");
  },
  updateMeetingNotes: async () => {
    throw new DomainOperationError("COMMAND_HANDLER_NOT_CONFIGURED");
  },
  createGovernanceProposal: async () => {
    throw new DomainOperationError("COMMAND_HANDLER_NOT_CONFIGURED");
  },
  createRoleApplication: async () => {
    throw new DomainOperationError("COMMAND_HANDLER_NOT_CONFIGURED");
  },
});

class BrainGoalCommandMutationConflictError extends Error {
  constructor() {
    super("Brain goal command mutation key conflict");
    this.name = "BrainGoalCommandMutationConflictError";
  }
}

class BrainGoalCommandStaleTerminalError extends Error {
  constructor() {
    super("Brain goal command terminal state changed");
    this.name = "BrainGoalCommandStaleTerminalError";
  }
}

class BrainGoalCommandDeferredRejectionError extends Error {
  constructor(
    readonly operation: BrainGoalCommandOperation,
    readonly actor: BrainGoalCommandActor,
    readonly mutationKey: string,
    readonly code: BrainCommandPublicErrorCode,
  ) {
    super("Brain goal command domain rejection after rollback");
    this.name = "BrainGoalCommandDeferredRejectionError";
  }
}

export async function confirmGoalCommandPreview(
  input: Readonly<{
    previewId: string;
    mutationKey: string;
    actor: BrainGoalCommandActor;
  }>,
  dependencies: BrainGoalCommandDependencies,
): Promise<BrainGoalCommandConfirmResult> {
  const now = dependencies.now?.() ?? new Date();
  const correlationId = dependencies.correlationId?.() ?? crypto.randomUUID();
  const mutationKey = input.mutationKey.trim();
  if (!input.previewId.trim() || !mutationKey) {
    return rejected("INVALID_INPUT", correlationId, input.previewId);
  }
  try {
    if (dependencies.runAtomically) {
      return await dependencies.runAtomically((atomicDependencies) =>
        confirmGoalCommandPreviewCore(input, atomicDependencies, now, correlationId, mutationKey),
      );
    }
    return await confirmGoalCommandPreviewCore(input, dependencies, now, correlationId, mutationKey);
  } catch (error) {
    if (error instanceof BrainGoalCommandMutationConflictError) {
      return rejected("IDEMPOTENCY_CONFLICT", correlationId, input.previewId);
    }
    if (error instanceof BrainGoalCommandStaleTerminalError) {
      return rejected("RETRY_CONFLICT", correlationId, input.previewId);
    }
    if (error instanceof BrainGoalCommandDeferredRejectionError) {
      try {
        return await completeRejection(
          error.operation,
          error.actor,
          error.mutationKey,
          error.code,
          correlationId,
          dependencies,
          now,
        );
      } catch (completionError) {
        if (completionError instanceof BrainGoalCommandMutationConflictError) {
          return rejected("IDEMPOTENCY_CONFLICT", correlationId, input.previewId);
        }
        if (completionError instanceof BrainGoalCommandStaleTerminalError) {
          return rejected("RETRY_CONFLICT", correlationId, input.previewId);
        }
        return rejected("TEMPORARY_FAILURE", correlationId, input.previewId);
      }
    }
    const replay = await replayAfterAtomicFailure(input, mutationKey, correlationId, dependencies);
    if (replay) return replay;
    return rejected("TEMPORARY_FAILURE", correlationId, input.previewId);
  }
}

async function replayAfterAtomicFailure(
  input: Readonly<{
    previewId: string;
    mutationKey: string;
    actor: BrainGoalCommandActor;
  }>,
  mutationKey: string,
  correlationId: string,
  dependencies: BrainGoalCommandDependencies,
): Promise<BrainGoalCommandConfirmResult | null> {
  try {
    const operation = await dependencies.ledger.loadOwnedOperation({
      id: input.previewId,
      actor: input.actor,
    });
    if (!operation || operation.status === "PREVIEWED") return null;
    return replayTerminal(operation, mutationKey, correlationId);
  } catch {
    return null;
  }
}

async function confirmGoalCommandPreviewCore(
  input: Readonly<{
    previewId: string;
    mutationKey: string;
    actor: BrainGoalCommandActor;
  }>,
  dependencies: BrainGoalCommandDependencies,
  now: Date,
  correlationId: string,
  mutationKey: string,
): Promise<BrainGoalCommandConfirmResult> {
  const operation = await dependencies.ledger.loadOwnedOperation({
    id: input.previewId,
    actor: input.actor,
  });
  if (!operation) return rejected("NOT_AVAILABLE", correlationId, input.previewId);

  if (operation.status !== "PREVIEWED") {
    return replayTerminal(operation, mutationKey, correlationId);
  }

  const command = parseCommandName(operation.commandName);
  if (!command) {
    return completeRejection(operation, input.actor, mutationKey, "INVALID_COMMAND", correlationId, dependencies, now);
  }
  if (!isExecutableBrainCommand(command)) {
    return completeRejection(operation, input.actor, mutationKey, "NOT_AVAILABLE", correlationId, dependencies, now);
  }
  if (isMeetingLifecycleGatedCommand(command)) {
    const lifecycle = evaluateMeetingLifecycle(
      await dependencies.readMeetingLifecycleStatus(input.actor.organizationId),
    );
    if (!lifecycle.allowed) {
      return rejected("INVALID_STATE", correlationId, operation.id);
    }
  }

  const duplicate = await dependencies.ledger.findOperationByMutationKey({
    organizationId: input.actor.organizationId,
    mutationKey,
  });
  if (duplicate && duplicate.id !== operation.id) {
    return rejected("IDEMPOTENCY_CONFLICT", correlationId, operation.id);
  }

  if (operation.previewExpiresAt.getTime() <= now.getTime()) {
    return completeExpired(operation, input.actor, correlationId, dependencies, now);
  }

  const parsed = parseOperationPreview(operation, command);
  if (!parsed.ok) {
    return completeRejection(operation, input.actor, mutationKey, parsed.code, correlationId, dependencies, now);
  }

  const sourceValidation = await dependencies.sourceValidator.validate({
    actor: input.actor,
    command,
    payload: parsed.payload,
    sourceBindings: parsed.sourceBindings,
  });
  if (!sourceValidation.ok) {
    return completeRejection(operation, input.actor, mutationKey, sourceValidation.code, correlationId, dependencies, now);
  }

  try {
    const result = await runExecutableBrainCommand(
      command,
      parsed.payload,
      input.actor,
      dependencies.goalDomain,
      dependencies.operations ?? DEFAULT_OPERATIONS,
      mutationKey,
    );
    const terminalResult = successEnvelope(result);
    const completed = await dependencies.ledger.completeOperation({
      id: operation.id,
      actor: input.actor,
      status: "SUCCEEDED",
      mutationKey,
      terminalCode: "SUCCEEDED",
      terminalResult,
      now,
    });
    return terminalSuccess(completed, command, result);
  } catch (error) {
    if (error instanceof BrainGoalCommandStaleTerminalError) {
      return rejected("RETRY_CONFLICT", correlationId, operation.id);
    }
    const code = mapGoalCommandError(error);
    if (code === "IDEMPOTENCY_CONFLICT") {
      return rejected(code, correlationId, operation.id);
    }
    if (dependencies.deferDomainRejection) {
      throw new BrainGoalCommandDeferredRejectionError(operation, input.actor, mutationKey, code);
    }
    return completeRejection(operation, input.actor, mutationKey, code, correlationId, dependencies, now);
  }
}

export function createPrismaBrainGoalCommandLedgerStore(
  client: PrismaClient | Prisma.TransactionClient,
): BrainGoalCommandLedgerStore {
  return {
    loadOwnedOperation: async ({ id, actor }) => {
      await client.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "brain_command_operations"
        WHERE "id" = ${id}
          AND "organizationId" = ${actor.organizationId}
          AND "ownerUserId" = ${actor.userId}
          AND "actorId" = ${actor.personId}
        FOR UPDATE
      `);
      return client.brainCommandOperation.findFirst({
        where: {
          id,
          organizationId: actor.organizationId,
          ownerUserId: actor.userId,
          actorId: actor.personId,
        },
        select: brainCommandOperationSelect,
      });
    },
    findOperationByMutationKey: ({ organizationId, mutationKey }) =>
      client.brainCommandOperation.findUnique({
        where: { organizationId_mutationKey: { organizationId, mutationKey } },
        select: brainCommandOperationSelect,
      }),
    completeOperation: async (input) => {
      try {
        const updated = await client.brainCommandOperation.updateMany({
          where: {
            id: input.id,
            organizationId: input.actor.organizationId,
            ownerUserId: input.actor.userId,
            actorId: input.actor.personId,
            status: "PREVIEWED",
          },
          data: {
            status: input.status,
            mutationKey: input.mutationKey,
            terminalCode: input.terminalCode,
            terminalResult: input.terminalResult as Prisma.InputJsonValue,
            confirmedAt: input.status === "EXPIRED" ? null : input.now,
            completedAt: input.now,
          },
        });
        if (updated.count !== 1) throw new BrainGoalCommandStaleTerminalError();
        const completed = await client.brainCommandOperation.findFirst({
          where: {
            id: input.id,
            organizationId: input.actor.organizationId,
            ownerUserId: input.actor.userId,
            actorId: input.actor.personId,
          },
          select: brainCommandOperationSelect,
        });
        if (!completed) throw new BrainGoalCommandStaleTerminalError();
        return completed;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          throw new BrainGoalCommandMutationConflictError();
        }
        throw error;
      }
    },
  };
}

export function createPrismaBrainGoalCommandDependencies(
  client: PrismaClient,
  sourceValidator: BrainGoalCommandSourceValidator,
): BrainGoalCommandDependencies {
  return {
    ledger: createPrismaBrainGoalCommandLedgerStore(client),
    goalDomain: createPrismaGoalDomainDependencies(client),
    sourceValidator,
    readMeetingLifecycleStatus: createPrismaMeetingLifecycleReader(client),
    operations: createPrismaBrainCommandOperations(client),
    runAtomically: (work) => client.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`SELECT set_config('TimeZone', 'UTC', true)`);
        return work({
          ledger: createPrismaBrainGoalCommandLedgerStore(transaction),
          goalDomain: createPrismaGoalDomainTransactionDependencies(transaction),
          sourceValidator,
          readMeetingLifecycleStatus: createPrismaMeetingLifecycleReader(transaction),
          operations: createPrismaBrainCommandOperations(transaction),
          deferDomainRejection: true,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  };
}

function createPrismaMeetingLifecycleReader(
  client: PrismaClient | Prisma.TransactionClient,
): BrainGoalCommandDependencies["readMeetingLifecycleStatus"] {
  return async (organizationId) => {
    const organization = await client.organization.findUnique({
      where: { id: organizationId },
      select: { lifecycleStatus: true },
    });
    return organization?.lifecycleStatus;
  };
}

function parseOperationPreview(
  operation: BrainGoalCommandOperation,
  command: ExecutableBrainCommandName,
): { ok: true; payload: ExecutableBrainCommandPayload; sourceBindings: readonly BrainCommandSourceBinding[] }
  | { ok: false; code: BrainCommandPublicErrorCode } {
  try {
    if (operation.commandSchemaVersion !== 1) return { ok: false, code: "INVALID_INPUT" };
    const metadata = resolveBrainCapability({ id: command, schemaVersion: operation.commandSchemaVersion }).command;
    const payload = metadata.parseServerPayload(operation.serverPayload);
    if (payload.command !== command) return { ok: false, code: "INVALID_INPUT" };
    const sourceBindings = metadata.parseSourceBindings(operation.sourceBindings);
    if (hashBrainCommandBinding(payload as JsonValue) !== operation.payloadHash) {
      return { ok: false, code: "STALE_PREVIEW" };
    }
    if (hashBrainCommandBinding(sourceBindings as JsonValue) !== operation.sourceBindingHash) {
      return { ok: false, code: "STALE_PREVIEW" };
    }
    return { ok: true, payload: payload as ExecutableBrainCommandPayload, sourceBindings };
  } catch {
    return { ok: false, code: "INVALID_INPUT" };
  }
}

async function runExecutableBrainCommand(
  command: ExecutableBrainCommandName,
  payload: ExecutableBrainCommandPayload,
  actorInput: BrainGoalCommandActor,
  goalDomain: GoalDomainDependencies,
  operations: BrainGoalCommandOperations,
  mutationKey: string,
): Promise<BrainCommandResult> {
  const capability = resolveBrainCapability({ id: command, schemaVersion: 1 });
  if (
    capability.handlerId !== EXECUTABLE_HANDLER_IDS[command] ||
    capability.requiresConfirmation !== true ||
    capability.idempotency !== "REQUIRED"
  ) {
    throw new GoalDomainError("INVALID_INPUT");
  }
  const actor: GoalDomainActor = {
    organizationId: actorInput.organizationId,
    userId: actorInput.userId,
    personId: actorInput.personId,
  };
  if (payload.command !== command) throw new GoalDomainError("INVALID_INPUT");

  switch (payload.command) {
    case "goal_proposal.create_draft": {
      const proposal = await operations.createGoalProposal({
        organizationId: actor.organizationId,
        cycleId: payload.cycleId,
        circleId: payload.circleId,
        actor,
        kind: payload.replacementProposalId ? "REPLACE" : "CREATE",
        replacedGoalId: payload.replacementProposalId,
        revision: {
          title: payload.title,
          intendedOutcome: payload.intendedOutcome,
          ownerRoleId: payload.ownerRoleId,
          parentGoalId: payload.parentGoalId ?? null,
          targets: payload.targets.map(goalProposalTarget),
        },
      }, goalDomain);
      return { resultId: proposal.id, status: "SUCCEEDED", summary: "Goal draft created." };
    }
    case "goal_proposal.append_returned_revision": {
      const proposal = await operations.appendGoalProposalRevision({
        organizationId: actor.organizationId,
        proposalId: payload.proposalId,
        expectedRevision: payload.expectedRevision,
        actor,
        revision: {
          title: payload.title,
          intendedOutcome: payload.intendedOutcome,
          targets: payload.targets.map(goalProposalTarget),
        },
      }, goalDomain);
      return { resultId: proposal.id, status: "SUCCEEDED", summary: "Goal draft revision appended." };
    }
    case "goal_check_in.append": {
      const checkIns = await operations.appendGoalCheckIns({
        organizationId: actor.organizationId,
        goalId: payload.goalId,
        actor,
        meetingId: payload.meetingId,
        entries: [{
          targetId: payload.targetId,
          fact: payload.fact,
          evidenceSummary: payload.evidenceSummary,
          assessment: payload.assessment,
          currentValue: payload.currentValue,
          milestoneCompleted: payload.milestoneCompleted,
          acceptanceEvidence: payload.acceptanceEvidence,
          supersedesCheckInId: payload.supersedesCheckInId,
        }],
      }, goalDomain);
      return { resultId: checkIns[0]?.id ?? payload.goalId, status: "SUCCEEDED", summary: "Goal check-in appended." };
    }
    case "tension.raise": {
      if (payload.routeMeetingId) {
        throw new DomainOperationError("INVALID_TENSION_ROUTE");
      }
      const circleIds = payload.routeCircleId
        ? [...new Set([...payload.circleIds, payload.routeCircleId])]
        : [...payload.circleIds];
      const tension = await operations.raiseTension({
        organizationId: actor.organizationId,
        raiserId: actor.personId,
        title: payload.title,
        description: payload.description,
        type: payload.type,
        source: "BOT",
        circleIds,
        handlingMode: payload.handlingMode,
        aiHandlingSuggestion: null,
      });
      return { resultId: tension.id, status: "SUCCEEDED", summary: "Tension raised." };
    }
    case "tactical_outcome.submit_proposal": {
      const deadline = payload.dueDate ? new Date(payload.dueDate) : null;
      if (deadline && Number.isNaN(deadline.getTime())) {
        throw new DomainOperationError("INVALID_TACTICAL_OUTCOME_PROPOSAL");
      }
      const proposal = await operations.submitTacticalOutcomeProposal({
        organizationId: actor.organizationId,
        actorId: actor.personId,
        tensionId: payload.tensionId,
        meetingId: payload.meetingId,
        expectedRevision: payload.expectedRevision,
        mutationKey,
        kind: payload.kind,
        title: payload.title,
        description: payload.description,
        circleId: payload.circleId,
        responsiblePersonId: payload.responsiblePersonId,
        deadline,
      });
      return { resultId: proposal.proposalId, status: "SUCCEEDED", summary: "Tactical proposal submitted." };
    }
    case "meeting_notes.update": {
      const updated = await operations.updateMeetingNotes({
        organizationId: actor.organizationId,
        actorId: actor.personId,
        meetingId: payload.meetingId,
        expectedNotesRevision: payload.expectedNotesRevision,
        notes: payload.notes,
      });
      return { resultId: updated.meetingId, status: "SUCCEEDED", summary: "Meeting notes updated." };
    }
    case "governance_proposal.create": {
      if (!operations.createGovernanceProposal) throw new DomainOperationError("COMMAND_HANDLER_NOT_CONFIGURED");
      const proposal = await operations.createGovernanceProposal({
        organizationId: actor.organizationId,
        actorId: actor.personId,
        tensionId: payload.tensionId,
        meetingId: payload.meetingId,
        currentStructure: payload.currentStructure,
        proposedStructure: payload.proposedStructure,
        rationale: payload.rationale,
        expectedImpact: payload.expectedImpact,
        structuralChange: payload.structuralChange,
      });
      return { resultId: proposal.id, status: "SUCCEEDED", summary: "Governance proposal created." };
    }
    case "role_application.create": {
      if (!operations.createRoleApplication) throw new DomainOperationError("COMMAND_HANDLER_NOT_CONFIGURED");
      const application = await operations.createRoleApplication({ organizationId: actor.organizationId, applicantId: actor.personId, roleId: payload.roleId, motivation: payload.motivation, capabilitySummary: payload.capabilitySummary, commitment: payload.commitment });
      return { resultId: application.id, status: "SUCCEEDED", summary: "Role application created." };
    }
  }
}

function goalProposalTarget(target: BrainCommandTargetPayload): GoalProposalTargetInput {
  if (target.kind === "NUMERIC") {
    return {
      kind: "NUMERIC",
      label: target.label,
      baselineValue: target.baselineValue ?? "0",
      desiredValue: target.desiredValue ?? "0",
      unit: target.unit ?? "",
      metricId: target.metricId,
    };
  }
  return {
    kind: "MILESTONE",
    label: target.label,
    acceptanceCriteria: target.acceptanceCriteria ?? target.label,
  };
}

async function completeRejection(
  operation: BrainGoalCommandOperation,
  actor: BrainGoalCommandActor,
  mutationKey: string,
  code: BrainCommandPublicErrorCode,
  correlationId: string,
  dependencies: BrainGoalCommandDependencies,
  now: Date,
): Promise<BrainGoalCommandConfirmResult> {
  const terminalResult = errorEnvelope(code, correlationId, operation.id);
  try {
    await dependencies.ledger.completeOperation({
      id: operation.id,
      actor,
      status: "REJECTED",
      mutationKey,
      terminalCode: code,
      terminalResult,
      now,
    });
  } catch (error) {
    if (error instanceof BrainGoalCommandMutationConflictError) {
      return rejected("IDEMPOTENCY_CONFLICT", correlationId, operation.id);
    }
    if (error instanceof BrainGoalCommandStaleTerminalError) {
      return rejected("RETRY_CONFLICT", correlationId, operation.id);
    }
    throw error;
  }
  return { ok: false, previewId: operation.id, error: terminalResult.error };
}

async function completeExpired(
  operation: BrainGoalCommandOperation,
  actor: BrainGoalCommandActor,
  correlationId: string,
  dependencies: BrainGoalCommandDependencies,
  now: Date,
): Promise<BrainGoalCommandConfirmResult> {
  const terminalResult = errorEnvelope("PREVIEW_EXPIRED", correlationId, operation.id);
  try {
    await dependencies.ledger.completeOperation({
      id: operation.id,
      actor,
      status: "EXPIRED",
      mutationKey: null,
      terminalCode: "PREVIEW_EXPIRED",
      terminalResult,
      now,
    });
  } catch (error) {
    if (error instanceof BrainGoalCommandStaleTerminalError) {
      return rejected("RETRY_CONFLICT", correlationId, operation.id);
    }
    throw error;
  }
  return { ok: false, previewId: operation.id, error: terminalResult.error };
}

function replayTerminal(
  operation: BrainGoalCommandOperation,
  mutationKey: string,
  correlationId: string,
): BrainGoalCommandConfirmResult {
  if (operation.status !== "EXPIRED" && operation.mutationKey !== mutationKey) {
    return rejected("RETRY_CONFLICT", correlationId, operation.id);
  }
  const terminal = parseTerminalEnvelope(operation.terminalResult);
  if (!terminal) return rejected("TEMPORARY_FAILURE", correlationId, operation.id);
  if (!terminal.ok) return { ok: false, previewId: operation.id, error: terminal.error };
  const command = parseCommandName(operation.commandName);
  if (!command || !isExecutableBrainCommand(command)) {
    return rejected("NOT_AVAILABLE", correlationId, operation.id);
  }
  return terminalSuccess(operation, command, terminal.result);
}

function parseTerminalEnvelope(raw: unknown): BrainGoalCommandTerminalEnvelope | null {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (value.schemaVersion !== 1 || typeof value.ok !== "boolean") return null;
  if (value.ok) {
    const result = value.result;
    if (result === null || typeof result !== "object" || Array.isArray(result)) return null;
    return {
      schemaVersion: 1,
      ok: true,
      code: "SUCCEEDED",
      result: BRAIN_COMMAND_REGISTRY["goal_proposal.create_draft"].parseResult(result),
    };
  }
  const error = value.error;
  if (error === null || typeof error !== "object" || Array.isArray(error)) return null;
  try {
    const parsedError = parseBrainCommandPublicError(error);
    if (value.code !== parsedError.code) return null;
    return {
      schemaVersion: 1,
      ok: false,
      code: parsedError.code,
      error: parsedError,
    };
  } catch {
    return null;
  }
}

function successEnvelope(result: BrainCommandResult): BrainGoalCommandTerminalEnvelope {
  return { schemaVersion: 1, ok: true, code: "SUCCEEDED", result };
}

function errorEnvelope(
  code: BrainCommandPublicErrorCode,
  correlationId: string,
  previewId: string,
): Extract<BrainGoalCommandTerminalEnvelope, { ok: false }> {
  return {
    schemaVersion: 1,
    ok: false,
    code,
    error: publicBrainCommandError({ code, correlationId, previewId }),
  };
}

function rejected(
  code: BrainCommandPublicErrorCode,
  correlationId: string,
  previewId?: string,
): BrainGoalCommandConfirmResult {
  return {
    ok: false,
    ...(previewId === undefined ? {} : { previewId }),
    error: publicBrainCommandError({ code, correlationId, previewId }),
  };
}

function terminalSuccess(
  operation: BrainGoalCommandOperation,
  command: ExecutableBrainCommandName,
  result: BrainCommandResult,
): BrainGoalCommandConfirmResult {
  return { ok: true, previewId: operation.id, command, result };
}

function parseCommandName(value: string): BrainCommandName | null {
  return Object.hasOwn(BRAIN_COMMAND_REGISTRY, value)
    ? value as BrainCommandName
    : null;
}

function isExecutableBrainCommand(command: BrainCommandName): command is ExecutableBrainCommandName {
  switch (command) {
    case "goal_proposal.create_draft":
    case "goal_proposal.append_returned_revision":
    case "goal_check_in.append":
    case "tension.raise":
    case "tactical_outcome.submit_proposal":
    case "meeting_notes.update":
    case "governance_proposal.create":
    case "role_application.create":
      return true;
  }
}

function isMeetingLifecycleGatedCommand(command: ExecutableBrainCommandName): boolean {
  return command === "tactical_outcome.submit_proposal" ||
    command === "meeting_notes.update" ||
    command === "governance_proposal.create";
}

function mapGoalCommandError(error: unknown): BrainCommandPublicErrorCode {
  if (error instanceof BrainGoalCommandMutationConflictError) return "IDEMPOTENCY_CONFLICT";
  if (error instanceof DomainOperationError) return mapDomainOperationError(error.code);
  if (!(error instanceof GoalDomainError)) return "TEMPORARY_FAILURE";
  switch (error.code) {
    case "INVALID_INPUT":
    case "CHECK_IN_INVALID":
    case "DUPLICATE_TARGET":
      return "INVALID_INPUT";
    case "ACTOR_CONTEXT_MISMATCH":
    case "FORBIDDEN":
    case "PROPOSER_REQUIRED":
    case "PROPOSER_NOT_PARTICIPANT":
    case "RECORDER_NOT_PARTICIPANT":
    case "FOLLOW_UP_AUTHORITY_REQUIRED":
      return "ACCESS_DENIED";
    case "CYCLE_NOT_FOUND":
    case "CIRCLE_NOT_FOUND":
    case "PROPOSAL_NOT_FOUND":
    case "MEETING_NOT_FOUND":
    case "GOAL_NOT_FOUND":
    case "TARGET_NOT_FOUND":
      return "NOT_AVAILABLE";
    case "STALE_REVISION":
    case "PROPOSAL_STATE_CONFLICT":
    case "CYCLE_STATE_CONFLICT":
    case "CORRECTION_CONFLICT":
      return "STALE_PREVIEW";
    case "MUTATION_KEY_CONFLICT":
      return "IDEMPOTENCY_CONFLICT";
    case "SERIALIZATION_CONFLICT":
      return "RETRY_CONFLICT";
    default:
      return "INVALID_STATE";
  }
}

function mapDomainOperationError(code: string): BrainCommandPublicErrorCode {
  switch (code) {
    case "INVALID_TENSION":
    case "INVALID_TENSION_ROUTE":
    case "INVALID_TACTICAL_OUTCOME_PROPOSAL":
    case "INVALID_MEETING_NOTES":
      return "INVALID_INPUT";
    case "RAISER_NOT_FOUND":
    case "CIRCLE_NOT_FOUND":
    case "TACTICAL_TENSION_NOT_AVAILABLE":
    case "TACTICAL_TARGET_NOT_AVAILABLE":
    case "MEETING_NOT_AVAILABLE":
      return "NOT_AVAILABLE";
    case "TACTICAL_PROPOSER_REQUIRED":
    case "TACTICAL_MEETING_PARTICIPANT_REQUIRED":
    case "TACTICAL_OUTCOME_ACCESS_DENIED":
    case "MEETING_PARTICIPANT_REQUIRED":
      return "ACCESS_DENIED";
    case "TACTICAL_PROPOSAL_STALE":
    case "TACTICAL_PROVENANCE_STALE":
    case "EXACT_TACTICAL_ROUTE_REQUIRED":
    case "TACTICAL_TENSION_ROUTE_REQUIRED":
    case "MEETING_NOTES_STALE":
      return "STALE_PREVIEW";
    case "MEETING_ENDED":
      return "INVALID_STATE";
    case "MUTATION_KEY_CONFLICT":
      return "IDEMPOTENCY_CONFLICT";
    default:
      return "INVALID_STATE";
  }
}

const brainCommandOperationSelect = {
  id: true,
  organizationId: true,
  ownerUserId: true,
  actorId: true,
  commandName: true,
  commandSchemaVersion: true,
  serverPayload: true,
  payloadHash: true,
  sourceBindings: true,
  sourceBindingHash: true,
  previewExpiresAt: true,
  mutationKey: true,
  status: true,
  terminalCode: true,
  terminalResult: true,
} satisfies Prisma.BrainCommandOperationSelect;
