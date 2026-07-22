import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { resolveActorContext } from "../authorization/actor-context";
import type { ActorContext } from "../authorization/actor-context-resolver";
import {
  completeBrainArtifact,
  createBrainArtifact,
  failBrainArtifact,
  markBrainArtifactReady,
  startBrainArtifactExecution,
  BrainArtifactLifecycleError,
} from "./artifact-lifecycle";
import type { BrainArtifact, BrainArtifactSourceRef, BrainArtifactType } from "./artifact-types";

export type BrainArtifactServiceErrorCode = "INVALID_INPUT" | "ACCESS_DENIED" | "NOT_FOUND" | "INVALID_STATE" | "PERSISTENCE_FAILED";

export class BrainArtifactServiceError extends Error {
  constructor(public readonly code: BrainArtifactServiceErrorCode) {
    super(`Brain artifact service failed: ${code}`);
    this.name = "BrainArtifactServiceError";
  }
}

export type CreateBrainArtifactServiceInput = Readonly<{
  schemaVersion: 1;
  artifactType: BrainArtifactType;
  payload: Readonly<Record<string, unknown>>;
  sourceRefs: readonly BrainArtifactSourceRef[];
  conversationId?: string | null;
  sourceMessageId?: string | null;
  linkedCommandOperationId?: string | null;
  supersedesArtifactId?: string | null;
  expiresAt?: string | null;
}>;

function fail(code: BrainArtifactServiceErrorCode): never {
  throw new BrainArtifactServiceError(code);
}

function actorContext(): Promise<ActorContext> {
  return resolveActorContext().catch(() => fail("ACCESS_DENIED"));
}

function toDomain(row: {
  id: string;
  organizationId: string;
  ownerPersonId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  linkedCommandOperationId: string | null;
  supersedesArtifactId: string | null;
  artifactType: string;
  schemaVersion: number;
  payload: unknown;
  sourceRefs: unknown;
  status: BrainArtifact["status"];
  expiresAt: Date | null;
  failureCode: string | null;
  terminalResult: unknown;
  createdAt: Date;
  updatedAt: Date;
  readyAt: Date | null;
  executionStartedAt: Date | null;
  completedAt: Date | null;
}): BrainArtifact {
  return Object.freeze({
    ...row,
    artifactType: row.artifactType as BrainArtifactType,
    schemaVersion: row.schemaVersion as 1,
    payload: row.payload as Readonly<Record<string, unknown>>,
    sourceRefs: row.sourceRefs as readonly BrainArtifactSourceRef[],
    terminalResult: row.terminalResult as Readonly<Record<string, unknown>> | null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    readyAt: row.readyAt?.toISOString() ?? null,
    executionStartedAt: row.executionStartedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
  });
}

async function loadOwned(client: typeof prisma, actor: ActorContext, id: string): Promise<BrainArtifact> {
  const row = await client.brainArtifact.findFirst({
    where: { id, organizationId: actor.organizationId, ownerPersonId: actor.personId },
  });
  if (!row) fail("NOT_FOUND");
  return toDomain(row);
}

function lifecycleError(error: unknown): never {
  if (error instanceof BrainArtifactLifecycleError) {
    if (error.code === "INVALID_STATE" || error.code === "TERMINAL_IMMUTABLE" || error.code === "EXPIRED") fail("INVALID_STATE");
    fail("INVALID_INPUT");
  }
  throw error;
}

function auditType(status: BrainArtifact["status"]): "READY" | "EXECUTION_STARTED" | "SUCCEEDED" | "FAILED" {
  if (status === "READY") return "READY";
  if (status === "EXECUTING") return "EXECUTION_STARTED";
  if (status === "SUCCEEDED") return "SUCCEEDED";
  if (status === "FAILED") return "FAILED";
  throw new BrainArtifactServiceError("INVALID_STATE");
}

function auditData(artifact: BrainArtifact, type: "CREATED" | "READY" | "EXECUTION_STARTED" | "SUCCEEDED" | "FAILED", reason?: string) {
  return {
    id: crypto.randomUUID(),
    organizationId: artifact.organizationId,
    artifactId: artifact.id,
    type,
    actor: { type: "person", id: artifact.ownerPersonId },
    actorPersonId: artifact.ownerPersonId,
    reason: reason ?? null,
  };
}

export async function createBrainArtifactForCurrentActor(input: CreateBrainArtifactServiceInput): Promise<BrainArtifact> {
  if (input.schemaVersion !== 1) fail("INVALID_INPUT");
  const actor = await actorContext();
  try {
    const artifact = createBrainArtifact({
      ...input,
      id: crypto.randomUUID(),
      organizationId: actor.organizationId,
      ownerPersonId: actor.personId,
      actor: { type: "person", id: actor.personId, label: actor.personId },
      now: new Date(),
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
    });
    const row = await prisma.$transaction(async (transaction) => {
      if (artifact.conversationId) {
        const conversation = await transaction.brainConversation.findFirst({
          where: { id: artifact.conversationId, organizationId: actor.organizationId, ownerId: actor.personId },
          select: { id: true },
        });
        if (!conversation) fail("NOT_FOUND");
      }
      if (artifact.sourceMessageId) {
        if (!artifact.conversationId) fail("INVALID_INPUT");
        const message = await transaction.brainMessage.findFirst({
          where: {
            id: artifact.sourceMessageId,
            conversationId: artifact.conversationId,
            organizationId: actor.organizationId,
            conversation: { ownerId: actor.personId },
          },
          select: { id: true },
        });
        if (!message) fail("NOT_FOUND");
      }
      if (artifact.linkedCommandOperationId) {
        const operation = await transaction.brainCommandOperation.findFirst({
          where: { id: artifact.linkedCommandOperationId, organizationId: actor.organizationId, ownerUserId: actor.userId },
          select: { id: true },
        });
        if (!operation) fail("NOT_FOUND");
      }
      if (artifact.supersedesArtifactId) {
        const superseded = await transaction.brainArtifact.findFirst({
          where: {
            id: artifact.supersedesArtifactId,
            organizationId: actor.organizationId,
            ownerPersonId: actor.personId,
            status: { in: ["SUCCEEDED", "FAILED"] },
          },
          select: { id: true },
        });
        if (!superseded) fail("NOT_FOUND");
      }
      const created = await transaction.brainArtifact.create({ data: {
        id: artifact.id,
        organizationId: artifact.organizationId,
        ownerPersonId: artifact.ownerPersonId,
        conversationId: artifact.conversationId,
        sourceMessageId: artifact.sourceMessageId,
        linkedCommandOperationId: artifact.linkedCommandOperationId,
        supersedesArtifactId: artifact.supersedesArtifactId,
        artifactType: artifact.artifactType,
        schemaVersion: artifact.schemaVersion,
        payload: artifact.payload as Prisma.InputJsonValue,
        sourceRefs: artifact.sourceRefs as Prisma.InputJsonValue,
        status: artifact.status,
        expiresAt: artifact.expiresAt ? new Date(artifact.expiresAt) : null,
        updatedAt: new Date(artifact.updatedAt),
      } });
      await transaction.brainArtifactAuditEvent.create({ data: auditData(artifact, "CREATED") });
      return created;
    });
    return toDomain(row);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError || error instanceof Prisma.PrismaClientValidationError) {
      return fail("PERSISTENCE_FAILED");
    }
    return lifecycleError(error);
  }
}

async function persistTransition(artifact: BrainArtifact, expectedStatus: BrainArtifact["status"]): Promise<BrainArtifact> {
  try {
    const row = await prisma.$transaction(async (transaction) => {
      const result = await transaction.brainArtifact.updateMany({
        where: { id: artifact.id, organizationId: artifact.organizationId, status: expectedStatus },
        data: {
        status: artifact.status,
        failureCode: artifact.failureCode,
        terminalResult: artifact.terminalResult === null ? Prisma.JsonNull : artifact.terminalResult as Prisma.InputJsonValue,
        readyAt: artifact.readyAt ? new Date(artifact.readyAt) : null,
        executionStartedAt: artifact.executionStartedAt ? new Date(artifact.executionStartedAt) : null,
        completedAt: artifact.completedAt ? new Date(artifact.completedAt) : null,
        updatedAt: new Date(artifact.updatedAt),
        },
      });
      if (result.count !== 1) fail("INVALID_STATE");
      await transaction.brainArtifactAuditEvent.create({ data: auditData(artifact, auditType(artifact.status)) });
      const updated = await transaction.brainArtifact.findUniqueOrThrow({
        where: { id_organizationId: { id: artifact.id, organizationId: artifact.organizationId } },
      });
      return updated;
    });
    return toDomain(row);
  } catch (error) {
    if (error instanceof BrainArtifactLifecycleError) return lifecycleError(error);
    throw new BrainArtifactServiceError("PERSISTENCE_FAILED");
  }
}

export async function loadBrainArtifactForCurrentActor(id: string): Promise<BrainArtifact> {
  const actor = await actorContext();
  return loadOwned(prisma, actor, id);
}

export async function markBrainArtifactReadyForCurrentActor(id: string): Promise<BrainArtifact> {
  const actor = await actorContext();
  try {
    const current = await loadOwned(prisma, actor, id);
    return persistTransition(markBrainArtifactReady(current, new Date()), current.status);
  } catch (error) { return lifecycleError(error); }
}

export async function startBrainArtifactForCurrentActor(id: string): Promise<BrainArtifact> {
  const actor = await actorContext();
  try {
    const current = await loadOwned(prisma, actor, id);
    return persistTransition(startBrainArtifactExecution(current, new Date()), current.status);
  } catch (error) { return lifecycleError(error); }
}

export async function completeBrainArtifactForCurrentActor(id: string, result: Readonly<Record<string, unknown>>): Promise<BrainArtifact> {
  const actor = await actorContext();
  try {
    const current = await loadOwned(prisma, actor, id);
    return persistTransition(completeBrainArtifact(current, result, new Date()), current.status);
  } catch (error) { return lifecycleError(error); }
}

export async function failBrainArtifactForCurrentActor(id: string, failureCode: string): Promise<BrainArtifact> {
  const actor = await actorContext();
  try {
    const current = await loadOwned(prisma, actor, id);
    return persistTransition(failBrainArtifact(current, failureCode, new Date()), current.status);
  } catch (error) { return lifecycleError(error); }
}
