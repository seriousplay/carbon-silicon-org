import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  evaluateInvitationDelivery,
  type InvitationDeliveryMode,
} from "./invitation-delivery-policy";
import { isInvitationTokenCiphertextEnvelope } from "./invitation-token-envelope";

const MAX_TRANSACTION_ATTEMPTS = 3;
const MAX_IDENTIFIER_LENGTH = 512;
const MAX_LEASE_DURATION_MS = 15 * 60 * 1_000;
const MAX_RETRY_DELAY_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_INVITATION_LIFETIME_MS = 30 * 24 * 60 * 60 * 1_000;
export const DEFAULT_MAX_ATTEMPTS = 3;

export const INVITATION_DELIVERY_ERROR_CODES = [
  "INVALID_INPUT",
  "ACCESS_DENIED",
  "INVITATION_UNAVAILABLE",
  "ORG_ADMIN_REQUIRED",
  "INVITATION_CONFLICT",
  "JOB_NOT_CLAIMABLE",
  "LEASE_NOT_OWNED",
  "INTERNAL_ERROR",
] as const;

export type InvitationDeliveryErrorCode =
  (typeof INVITATION_DELIVERY_ERROR_CODES)[number];

export const INVITATION_DELIVERY_FAILURE_CODES = [
  "DELIVERY_TRANSIENT",
  "DELIVERY_PERMANENT",
  "PROVIDER_UNAVAILABLE",
  "RATE_LIMITED",
  "TIMEOUT",
] as const;

export type InvitationDeliveryFailureCode =
  (typeof INVITATION_DELIVERY_FAILURE_CODES)[number];

export type InvitationDeliveryActor = Readonly<{
  organizationId: string;
  userId: string;
  personId: string;
}>;

export type PrepareInvitationDeliveryInput = Readonly<{
  actor: InvitationDeliveryActor;
  invitationId: string;
  requestedMode?: InvitationDeliveryMode;
  now: Date;
}>;

export type CreateInvitationForDeliveryInput = Readonly<{
  actor: InvitationDeliveryActor;
  invitationId: string;
  email: string;
  tokenHash: string;
  tokenCiphertext: string;
  homeCircleId?: string | null;
  requestedMode?: InvitationDeliveryMode;
  now: Date;
  expiresAt: Date;
}>;

export type PrepareInvitationDeliveryResult =
  | Readonly<{ ok: true; status: "HELD"; invitationId: string }>
  | Readonly<{ ok: true; status: "QUEUED"; invitationId: string; jobId: string }>
  | Readonly<{ ok: true; status: "DELIVERED"; invitationId: string }>
  | Readonly<{ ok: false; code: InvitationDeliveryErrorCode }>;

export type CreateInvitationForDeliveryResult = PrepareInvitationDeliveryResult;

export type ClaimInvitationDeliveryJobInput = Readonly<{
  organizationId: string;
  jobId: string;
  leaseToken: string;
  now: Date;
  leaseDurationMs: number;
}>;

export type ClaimInvitationDeliveryJobResult =
  | Readonly<{
      ok: true;
      status: "CLAIMED";
      jobId: string;
      attemptCount: number;
      leaseExpiresAt: string;
    }>
  | Readonly<{ ok: false; code: InvitationDeliveryErrorCode }>;

export type CompleteInvitationDeliverySuccessInput = Readonly<{
  organizationId: string;
  jobId: string;
  leaseToken: string;
  now: Date;
}>;

export type CompleteInvitationDeliverySuccessResult =
  | Readonly<{ ok: true; status: "SENT"; jobId: string; sentAt: string }>
  | Readonly<{ ok: false; code: InvitationDeliveryErrorCode }>;

export type CompleteInvitationDeliveryFailureInput = Readonly<{
  organizationId: string;
  jobId: string;
  leaseToken: string;
  now: Date;
  retryAt: Date;
  errorCode: InvitationDeliveryFailureCode;
}>;

export type CompleteInvitationDeliveryFailureResult =
  | Readonly<{
      ok: true;
      status: "FAILED";
      jobId: string;
      retryAt: string;
      attemptsExhausted: boolean;
    }>
  | Readonly<{ ok: false; code: InvitationDeliveryErrorCode }>;

export type InvitationDeliveryInvitation = Readonly<{
  id: string;
  organizationId: string;
  lifecycleStatus: string;
  deliveryMode: "HELD" | "IMMEDIATE";
  releasedAt: Date | null;
  deliveryCompletedAt: Date | null;
  revokedAt: Date | null;
  consumedAt: Date | null;
  expiresAt: Date;
}>;

export type InvitationDeliveryJob = Readonly<{
  id: string;
  organizationId: string;
  invitationId: string;
  status: "PENDING" | "PROCESSING" | "SENT" | "FAILED" | "CANCELLED";
  attemptCount: number;
  maxAttempts: number;
  availableAt: Date;
  leaseToken: string | null;
  leaseExpiresAt: Date | null;
  lastErrorCode: string | null;
  sentAt: Date | null;
}>;

export type InvitationDeliveryCompletionContext = Readonly<{
  job: InvitationDeliveryJob;
  invitation: InvitationDeliveryInvitation;
}>;

export type InvitationDeliveryProviderPayload = Readonly<{
  job: InvitationDeliveryJob;
  invitation: InvitationDeliveryInvitation & Readonly<{
    email: string;
    tokenHash: string;
    deliveryTokenCiphertext: string;
    organizationName: string;
  }>;
}>;

export type InvitationDeliveryTransaction = Readonly<{
  getActorMembershipRole(actor: InvitationDeliveryActor): Promise<string | null>;
  getInvitationForUpdate(
    organizationId: string,
    invitationId: string,
  ): Promise<InvitationDeliveryInvitation | null>;
  getOrganizationLifecycleForUpdate(organizationId: string): Promise<string | null>;
  homeCircleIsAvailable(organizationId: string, homeCircleId: string): Promise<boolean>;
  createInvitation(input: Readonly<{
    id: string;
    organizationId: string;
    email: string;
    tokenHash: string;
    tokenCiphertext: string;
    homeCircleId: string | null;
    createdById: string;
    deliveryMode: "HELD" | "IMMEDIATE";
    releasedAt: Date | null;
    expiresAt: Date;
    now: Date;
  }>): Promise<void>;
  getJobForInvitationForUpdate(
    organizationId: string,
    invitationId: string,
  ): Promise<InvitationDeliveryJob | null>;
  queueInvitation(input: Readonly<{
    organizationId: string;
    invitationId: string;
    releasedAt: Date;
  }>): Promise<void>;
  createPendingJob(input: Readonly<{
    id: string;
    organizationId: string;
    invitationId: string;
    availableAt: Date;
    maxAttempts: number;
  }>): Promise<InvitationDeliveryJob>;
  getJobForUpdate(
    organizationId: string,
    jobId: string,
  ): Promise<InvitationDeliveryJob | null>;
  claimJob(input: Readonly<{
    organizationId: string;
    jobId: string;
    leaseToken: string;
    leaseExpiresAt: Date;
    attemptCount: number;
    now: Date;
  }>): Promise<void>;
  cancelJob(input: Readonly<{
    organizationId: string;
    jobId: string;
    now: Date;
  }>): Promise<void>;
  getCompletionContextForUpdate(
    organizationId: string,
    jobId: string,
  ): Promise<InvitationDeliveryCompletionContext | null>;
  getProviderPayloadForUpdate(
    organizationId: string,
    jobId: string,
    leaseToken: string,
    now: Date,
  ): Promise<InvitationDeliveryProviderPayload | null>;
  completeSuccess(input: Readonly<{
    organizationId: string;
    jobId: string;
    invitationId: string;
    now: Date;
  }>): Promise<void>;
  completeFailure(input: Readonly<{
    organizationId: string;
    jobId: string;
    retryAt: Date;
    errorCode: InvitationDeliveryFailureCode;
    now: Date;
  }>): Promise<void>;
}>;

export type InvitationDeliveryDependencies = Readonly<{
  transaction<T>(work: (tx: InvitationDeliveryTransaction) => Promise<T>): Promise<T>;
  newId(): string;
  isRetryableTransactionError(error: unknown): boolean;
  isInvitationConflictError(error: unknown): boolean;
}>;

function result<T extends object>(value: T): Readonly<T> {
  return Object.freeze(value);
}

function failure(code: InvitationDeliveryErrorCode): Readonly<{
  ok: false;
  code: InvitationDeliveryErrorCode;
}> {
  return result({ ok: false as const, code });
}

function validIdentifier(value: unknown): value is string {
  return typeof value === "string"
    && value.length > 0
    && value.length <= MAX_IDENTIFIER_LENGTH
    && value.trim() === value;
}

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function validLeaseToken(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 1
    && value.length <= 128
    && value.trim() === value;
}

function validLeaseDuration(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1_000 && Number(value) <= MAX_LEASE_DURATION_MS;
}

function validRequestedMode(value: unknown): value is InvitationDeliveryMode | undefined {
  return value === undefined || value === "HELD" || value === "IMMEDIATE";
}

function validEmail(value: unknown): value is string {
  return typeof value === "string"
    && value.length >= 3
    && value.length <= 320
    && value === value.trim().toLowerCase()
    && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validTokenHash(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/.test(value);
}

function validFailureCode(value: unknown): value is InvitationDeliveryFailureCode {
  return typeof value === "string"
    && INVITATION_DELIVERY_FAILURE_CODES.includes(value as InvitationDeliveryFailureCode);
}

async function runSerializable<T>(
  dependencies: InvitationDeliveryDependencies,
  work: (tx: InvitationDeliveryTransaction) => Promise<T>,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      return await dependencies.transaction(work);
    } catch (error) {
      if (attempt === MAX_TRANSACTION_ATTEMPTS || !dependencies.isRetryableTransactionError(error)) {
        throw error;
      }
    }
  }
  throw new Error("unreachable");
}

export async function createInvitationForDelivery(
  input: CreateInvitationForDeliveryInput,
  dependencies: InvitationDeliveryDependencies = prismaInvitationDeliveryDependencies,
): Promise<CreateInvitationForDeliveryResult> {
  const lifetime = validDate(input.expiresAt) && validDate(input.now)
    ? input.expiresAt.getTime() - input.now.getTime()
    : Number.NaN;
  if (
    !validIdentifier(input.actor?.organizationId)
    || !validIdentifier(input.actor?.userId)
    || !validIdentifier(input.actor?.personId)
    || !validIdentifier(input.invitationId)
    || !validEmail(input.email)
    || !validTokenHash(input.tokenHash)
    || !isInvitationTokenCiphertextEnvelope(input.tokenCiphertext)
    || input.tokenCiphertext === input.tokenHash
    || (input.homeCircleId !== undefined
      && input.homeCircleId !== null
      && !validIdentifier(input.homeCircleId))
    || !validRequestedMode(input.requestedMode)
    || !validDate(input.now)
    || !validDate(input.expiresAt)
    || lifetime <= 0
    || lifetime > MAX_INVITATION_LIFETIME_MS
  ) {
    return failure("INVALID_INPUT");
  }

  try {
    return await runSerializable(dependencies, async (tx) => {
      const membershipRole = await tx.getActorMembershipRole(input.actor);
      if (membershipRole !== "ORG_ADMIN") return failure("ACCESS_DENIED");

      const lifecycleStatus = await tx.getOrganizationLifecycleForUpdate(
        input.actor.organizationId,
      );
      if (lifecycleStatus !== "SETUP" && lifecycleStatus !== "ACTIVE") {
        return failure("INVITATION_UNAVAILABLE");
      }
      const homeCircleId = input.homeCircleId ?? null;
      if (homeCircleId !== null && !await tx.homeCircleIsAvailable(
        input.actor.organizationId,
        homeCircleId,
      )) {
        return failure("INVITATION_UNAVAILABLE");
      }

      const decision = evaluateInvitationDelivery({
        lifecycleStatus,
        actorIsOrgAdmin: true,
        requestedMode: input.requestedMode,
        revoked: false,
        consumed: false,
        expiresAt: input.expiresAt,
        now: input.now,
      });
      if (!decision.allowed) return failure(decision.code);

      const queued = decision.action === "QUEUE";
      await tx.createInvitation({
        id: input.invitationId,
        organizationId: input.actor.organizationId,
        email: input.email,
        tokenHash: input.tokenHash,
        tokenCiphertext: input.tokenCiphertext,
        homeCircleId,
        createdById: input.actor.personId,
        deliveryMode: queued ? "IMMEDIATE" : "HELD",
        releasedAt: queued ? input.now : null,
        expiresAt: input.expiresAt,
        now: input.now,
      });
      if (!queued) {
        return result({
          ok: true as const,
          status: "HELD" as const,
          invitationId: input.invitationId,
        });
      }

      const job = await tx.createPendingJob({
        id: dependencies.newId(),
        organizationId: input.actor.organizationId,
        invitationId: input.invitationId,
        availableAt: input.now,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      });
      return result({
        ok: true as const,
        status: "QUEUED" as const,
        invitationId: input.invitationId,
        jobId: job.id,
      });
    });
  } catch (error) {
    return failure(dependencies.isInvitationConflictError(error)
      ? "INVITATION_CONFLICT"
      : "INTERNAL_ERROR");
  }
}

export async function prepareInvitationDelivery(
  input: PrepareInvitationDeliveryInput,
  dependencies: InvitationDeliveryDependencies = prismaInvitationDeliveryDependencies,
): Promise<PrepareInvitationDeliveryResult> {
  if (
    !validIdentifier(input.actor?.organizationId)
    || !validIdentifier(input.actor?.userId)
    || !validIdentifier(input.actor?.personId)
    || !validIdentifier(input.invitationId)
    || !validRequestedMode(input.requestedMode)
    || !validDate(input.now)
  ) {
    return failure("INVALID_INPUT");
  }

  try {
    return await runSerializable(dependencies, async (tx) => {
      const membershipRole = await tx.getActorMembershipRole(input.actor);
      if (membershipRole === null) return failure("ACCESS_DENIED");

      const invitation = await tx.getInvitationForUpdate(
        input.actor.organizationId,
        input.invitationId,
      );
      if (!invitation) return failure("INVITATION_UNAVAILABLE");

      const decision = evaluateInvitationDelivery({
        lifecycleStatus: invitation.lifecycleStatus,
        actorIsOrgAdmin: membershipRole === "ORG_ADMIN",
        requestedMode: input.requestedMode,
        revoked: invitation.revokedAt !== null,
        consumed: invitation.consumedAt !== null,
        expiresAt: invitation.expiresAt,
        now: input.now,
      });
      if (!decision.allowed) return failure(decision.code);

      const existingJob = await tx.getJobForInvitationForUpdate(
        input.actor.organizationId,
        input.invitationId,
      );
      if (invitation.deliveryCompletedAt !== null) {
        return result({ ok: true as const, status: "DELIVERED" as const, invitationId: invitation.id });
      }
      if (invitation.deliveryMode === "IMMEDIATE") {
        if (!invitation.releasedAt || !existingJob) throw new Error("invalid invitation delivery state");
        return result({
          ok: true as const,
          status: "QUEUED" as const,
          invitationId: invitation.id,
          jobId: existingJob.id,
        });
      }
      if (existingJob) throw new Error("invalid held invitation delivery state");

      if (decision.action === "HOLD") {
        return result({ ok: true as const, status: "HELD" as const, invitationId: invitation.id });
      }

      const jobId = dependencies.newId();
      await tx.queueInvitation({
        organizationId: input.actor.organizationId,
        invitationId: invitation.id,
        releasedAt: input.now,
      });
      const job = await tx.createPendingJob({
        id: jobId,
        organizationId: input.actor.organizationId,
        invitationId: invitation.id,
        availableAt: input.now,
        maxAttempts: DEFAULT_MAX_ATTEMPTS,
      });
      return result({
        ok: true as const,
        status: "QUEUED" as const,
        invitationId: invitation.id,
        jobId: job.id,
      });
    });
  } catch {
    return failure("INTERNAL_ERROR");
  }
}

export async function claimInvitationDeliveryJob(
  input: ClaimInvitationDeliveryJobInput,
  dependencies: InvitationDeliveryDependencies = prismaInvitationDeliveryDependencies,
): Promise<ClaimInvitationDeliveryJobResult> {
  if (
    !validIdentifier(input.organizationId)
    || !validIdentifier(input.jobId)
    || !validLeaseToken(input.leaseToken)
    || !validDate(input.now)
    || !validLeaseDuration(input.leaseDurationMs)
  ) {
    return failure("INVALID_INPUT");
  }

  try {
    return await runSerializable(dependencies, async (tx) => {
      const context = await tx.getCompletionContextForUpdate(input.organizationId, input.jobId);
      if (!context) return failure("JOB_NOT_CLAIMABLE");
      const job = context.job;
      if (job.status === "SENT" || job.status === "CANCELLED") {
        return failure("JOB_NOT_CLAIMABLE");
      }
      if (!invitationAvailableForClaim(context.invitation, input.now)) {
        await tx.cancelJob({
          organizationId: input.organizationId,
          jobId: job.id,
          now: input.now,
        });
        return failure("INVITATION_UNAVAILABLE");
      }
      if (job.attemptCount >= job.maxAttempts) return failure("JOB_NOT_CLAIMABLE");
      const available =
        ((job.status === "PENDING" || job.status === "FAILED")
          && job.availableAt.getTime() <= input.now.getTime())
        || (job.status === "PROCESSING"
          && job.leaseExpiresAt !== null
          && job.leaseExpiresAt.getTime() <= input.now.getTime());
      if (!available) return failure("JOB_NOT_CLAIMABLE");

      const attemptCount = job.attemptCount + 1;
      const leaseExpiresAt = new Date(input.now.getTime() + input.leaseDurationMs);
      await tx.claimJob({
        organizationId: input.organizationId,
        jobId: input.jobId,
        leaseToken: input.leaseToken,
        leaseExpiresAt,
        attemptCount,
        now: input.now,
      });
      return result({
        ok: true as const,
        status: "CLAIMED" as const,
        jobId: input.jobId,
        attemptCount,
        leaseExpiresAt: leaseExpiresAt.toISOString(),
      });
    });
  } catch {
    return failure("INTERNAL_ERROR");
  }
}

export async function completeInvitationDeliverySuccess(
  input: CompleteInvitationDeliverySuccessInput,
  dependencies: InvitationDeliveryDependencies = prismaInvitationDeliveryDependencies,
): Promise<CompleteInvitationDeliverySuccessResult> {
  if (
    !validIdentifier(input.organizationId)
    || !validIdentifier(input.jobId)
    || !validLeaseToken(input.leaseToken)
    || !validDate(input.now)
  ) {
    return failure("INVALID_INPUT");
  }

  try {
    return await runSerializable(dependencies, async (tx) => {
      const context = await tx.getCompletionContextForUpdate(input.organizationId, input.jobId);
      if (!context || !liveLease(context.job, input.leaseToken, input.now)) {
        return failure("LEASE_NOT_OWNED");
      }
      const invitation = context.invitation;
      if (
        invitation.deliveryMode !== "IMMEDIATE"
        || invitation.releasedAt === null
        || invitation.releasedAt.getTime() > input.now.getTime()
        || invitation.deliveryCompletedAt !== null
        || invitation.revokedAt !== null
        || invitation.consumedAt !== null
        || invitation.expiresAt.getTime() <= input.now.getTime()
      ) {
        await tx.cancelJob({
          organizationId: input.organizationId,
          jobId: context.job.id,
          now: input.now,
        });
        return failure("INVITATION_UNAVAILABLE");
      }

      await tx.completeSuccess({
        organizationId: input.organizationId,
        jobId: context.job.id,
        invitationId: invitation.id,
        now: input.now,
      });
      return result({
        ok: true as const,
        status: "SENT" as const,
        jobId: context.job.id,
        sentAt: input.now.toISOString(),
      });
    });
  } catch {
    return failure("INTERNAL_ERROR");
  }
}

export async function completeInvitationDeliveryFailure(
  input: CompleteInvitationDeliveryFailureInput,
  dependencies: InvitationDeliveryDependencies = prismaInvitationDeliveryDependencies,
): Promise<CompleteInvitationDeliveryFailureResult> {
  const retryDelay = validDate(input.retryAt) && validDate(input.now)
    ? input.retryAt.getTime() - input.now.getTime()
    : Number.NaN;
  if (
    !validIdentifier(input.organizationId)
    || !validIdentifier(input.jobId)
    || !validLeaseToken(input.leaseToken)
    || !validDate(input.now)
    || !validDate(input.retryAt)
    || retryDelay < 0
    || retryDelay > MAX_RETRY_DELAY_MS
    || !validFailureCode(input.errorCode)
  ) {
    return failure("INVALID_INPUT");
  }

  try {
    return await runSerializable(dependencies, async (tx) => {
      const context = await tx.getCompletionContextForUpdate(input.organizationId, input.jobId);
      if (!context || !liveLease(context.job, input.leaseToken, input.now)) {
        return failure("LEASE_NOT_OWNED");
      }

      await tx.completeFailure({
        organizationId: input.organizationId,
        jobId: context.job.id,
        retryAt: input.retryAt,
        errorCode: input.errorCode,
        now: input.now,
      });
      return result({
        ok: true as const,
        status: "FAILED" as const,
        jobId: context.job.id,
        retryAt: input.retryAt.toISOString(),
        attemptsExhausted: context.job.attemptCount >= context.job.maxAttempts,
      });
    });
  } catch {
    return failure("INTERNAL_ERROR");
  }
}

export async function getInvitationDeliveryProviderPayload(
  input: Readonly<{
    organizationId: string;
    jobId: string;
    leaseToken: string;
    now: Date;
  }>,
  dependencies: InvitationDeliveryDependencies = prismaInvitationDeliveryDependencies,
): Promise<
  | Readonly<{ ok: true; payload: InvitationDeliveryProviderPayload }>
  | Readonly<{ ok: false; code: InvitationDeliveryErrorCode }>
> {
  if (
    !validIdentifier(input.organizationId)
    || !validIdentifier(input.jobId)
    || !validLeaseToken(input.leaseToken)
    || !validDate(input.now)
  ) {
    return failure("INVALID_INPUT");
  }

  try {
    return await runSerializable(dependencies, async (tx) => {
      const payload = await tx.getProviderPayloadForUpdate(
        input.organizationId,
        input.jobId,
        input.leaseToken,
        input.now,
      );
      if (!payload) return failure("LEASE_NOT_OWNED");
      if (!invitationAvailableForClaim(payload.invitation, input.now)) {
        await tx.cancelJob({
          organizationId: input.organizationId,
          jobId: payload.job.id,
          now: input.now,
        });
        return failure("INVITATION_UNAVAILABLE");
      }
      if (
        !validEmail(payload.invitation.email)
        || !validTokenHash(payload.invitation.tokenHash)
        || !isInvitationTokenCiphertextEnvelope(payload.invitation.deliveryTokenCiphertext)
        || typeof payload.invitation.organizationName !== "string"
        || payload.invitation.organizationName.trim().length === 0
        || payload.invitation.organizationName.length > 256
      ) {
        await tx.cancelJob({
          organizationId: input.organizationId,
          jobId: payload.job.id,
          now: input.now,
        });
        return failure("INVITATION_UNAVAILABLE");
      }
      return result({ ok: true as const, payload });
    });
  } catch {
    return failure("INTERNAL_ERROR");
  }
}

function liveLease(job: InvitationDeliveryJob, leaseToken: string, now: Date): boolean {
  return job.status === "PROCESSING"
    && job.leaseToken === leaseToken
    && job.leaseExpiresAt !== null
    && job.leaseExpiresAt.getTime() > now.getTime();
}

function invitationAvailableForClaim(
  invitation: InvitationDeliveryInvitation,
  now: Date,
): boolean {
  return (invitation.lifecycleStatus === "SETUP" || invitation.lifecycleStatus === "ACTIVE")
    && invitation.deliveryMode === "IMMEDIATE"
    && invitation.releasedAt !== null
    && invitation.releasedAt.getTime() <= now.getTime()
    && invitation.deliveryCompletedAt === null
    && invitation.revokedAt === null
    && invitation.consumedAt === null
    && invitation.expiresAt.getTime() > now.getTime();
}

type PrismaTransaction = Pick<Prisma.TransactionClient, "$queryRaw" | "$executeRaw">;

function prismaTransactionStore(tx: PrismaTransaction): InvitationDeliveryTransaction {
  return {
    async getActorMembershipRole(actor) {
      const people = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "people"
        WHERE "id" = ${actor.personId}
          AND "organizationId" = ${actor.organizationId}
          AND "userId" = ${actor.userId}
        FOR KEY SHARE
      `);
      if (people.length !== 1) return null;
      const memberships = await tx.$queryRaw<Array<{ role: string }>>(Prisma.sql`
        SELECT "role"::text AS "role"
        FROM "memberships"
        WHERE "organizationId" = ${actor.organizationId}
          AND "userId" = ${actor.userId}
        FOR KEY SHARE
      `);
      return memberships.length === 1 ? memberships[0]!.role : null;
    },
    async getInvitationForUpdate(organizationId, invitationId) {
      const rows = await tx.$queryRaw<InvitationDeliveryInvitation[]>(Prisma.sql`
        SELECT
          i."id",
          i."organizationId",
          o."lifecycleStatus"::text AS "lifecycleStatus",
          i."deliveryMode"::text AS "deliveryMode",
          i."releasedAt",
          i."deliveryCompletedAt",
          i."revokedAt",
          i."consumedAt",
          i."expiresAt"
        FROM "organization_invitations" i
        JOIN "organizations" o ON o."id" = i."organizationId"
        WHERE i."id" = ${invitationId}
          AND i."organizationId" = ${organizationId}
        FOR UPDATE OF i, o
      `);
      return rows[0] ?? null;
    },
    async getOrganizationLifecycleForUpdate(organizationId) {
      const rows = await tx.$queryRaw<Array<{ lifecycleStatus: string }>>(Prisma.sql`
        SELECT "lifecycleStatus"::text AS "lifecycleStatus"
        FROM "organizations"
        WHERE "id" = ${organizationId}
        FOR UPDATE
      `);
      return rows[0]?.lifecycleStatus ?? null;
    },
    async homeCircleIsAvailable(organizationId, homeCircleId) {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        SELECT "id"
        FROM "circles"
        WHERE "id" = ${homeCircleId}
          AND "organizationId" = ${organizationId}
          AND "status" <> 'ARCHIVED'
        FOR KEY SHARE
      `);
      return rows.length === 1;
    },
    async createInvitation(input) {
      const changed = await tx.$executeRaw(Prisma.sql`
        INSERT INTO "organization_invitations" (
          "id", "organizationId", "email", "tokenHash", "deliveryTokenCiphertext",
          "role", "homeCircleId", "createdById", "expiresAt", "deliveryMode",
          "releasedAt", "deliveryCompletedAt", "createdAt", "updatedAt"
        ) VALUES (
          ${input.id}, ${input.organizationId}, ${input.email}, ${input.tokenHash},
          ${input.tokenCiphertext}, 'ORG_MEMBER', ${input.homeCircleId}, ${input.createdById},
          ${input.expiresAt}, CAST(${input.deliveryMode} AS "InvitationDeliveryMode"),
          ${input.releasedAt}, NULL, ${input.now}, ${input.now}
        )
      `);
      if (changed !== 1) throw new Error("invitation create failed");
    },
    async getJobForInvitationForUpdate(organizationId, invitationId) {
      const rows = await tx.$queryRaw<InvitationDeliveryJob[]>(Prisma.sql`
        SELECT
          "id", "organizationId", "invitationId", "status"::text AS "status",
          "attemptCount", "maxAttempts", "availableAt", "leaseToken", "leaseExpiresAt",
          "lastErrorCode", "sentAt"
        FROM "organization_invitation_delivery_jobs"
        WHERE "organizationId" = ${organizationId}
          AND "invitationId" = ${invitationId}
        FOR UPDATE
      `);
      return rows[0] ?? null;
    },
    async queueInvitation(input) {
      const changed = await tx.$executeRaw(Prisma.sql`
        UPDATE "organization_invitations"
        SET "deliveryMode" = 'IMMEDIATE',
            "releasedAt" = ${input.releasedAt},
            "deliveryCompletedAt" = NULL,
            "updatedAt" = ${input.releasedAt}
        WHERE "id" = ${input.invitationId}
          AND "organizationId" = ${input.organizationId}
          AND "deliveryMode" = 'HELD'
          AND "releasedAt" IS NULL
          AND "deliveryCompletedAt" IS NULL
      `);
      if (changed !== 1) throw new Error("invitation queue update failed");
    },
    async createPendingJob(input) {
      const rows = await tx.$queryRaw<InvitationDeliveryJob[]>(Prisma.sql`
        INSERT INTO "organization_invitation_delivery_jobs" (
          "id", "organizationId", "invitationId", "status", "attemptCount", "maxAttempts",
          "availableAt", "createdAt", "updatedAt"
        ) VALUES (
          ${input.id}, ${input.organizationId}, ${input.invitationId}, 'PENDING', 0,
          ${input.maxAttempts},
          ${input.availableAt}, ${input.availableAt}, ${input.availableAt}
        )
        RETURNING
          "id", "organizationId", "invitationId", "status"::text AS "status",
          "attemptCount", "maxAttempts", "availableAt", "leaseToken", "leaseExpiresAt",
          "lastErrorCode", "sentAt"
      `);
      if (rows.length !== 1) throw new Error("invitation delivery job create failed");
      return rows[0]!;
    },
    async getJobForUpdate(organizationId, jobId) {
      const rows = await tx.$queryRaw<InvitationDeliveryJob[]>(Prisma.sql`
        SELECT
          "id", "organizationId", "invitationId", "status"::text AS "status",
          "attemptCount", "maxAttempts", "availableAt", "leaseToken", "leaseExpiresAt",
          "lastErrorCode", "sentAt"
        FROM "organization_invitation_delivery_jobs"
        WHERE "id" = ${jobId} AND "organizationId" = ${organizationId}
        FOR UPDATE
      `);
      return rows[0] ?? null;
    },
    async claimJob(input) {
      const changed = await tx.$executeRaw(Prisma.sql`
        UPDATE "organization_invitation_delivery_jobs"
        SET "status" = 'PROCESSING',
            "attemptCount" = ${input.attemptCount},
            "leaseToken" = ${input.leaseToken},
            "leaseExpiresAt" = ${input.leaseExpiresAt},
            "lastErrorCode" = NULL,
            "sentAt" = NULL,
            "updatedAt" = ${input.now}
        WHERE "id" = ${input.jobId} AND "organizationId" = ${input.organizationId}
      `);
      if (changed !== 1) throw new Error("invitation delivery claim failed");
    },
    async cancelJob(input) {
      const changed = await tx.$executeRaw(Prisma.sql`
        UPDATE "organization_invitation_delivery_jobs"
        SET "status" = 'CANCELLED',
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL,
            "lastErrorCode" = 'INVITATION_UNAVAILABLE',
            "sentAt" = NULL,
            "updatedAt" = ${input.now}
        WHERE "id" = ${input.jobId} AND "organizationId" = ${input.organizationId}
          AND "status" <> 'SENT' AND "status" <> 'CANCELLED'
      `);
      if (changed !== 1) throw new Error("invitation delivery cancellation failed");
    },
    async getCompletionContextForUpdate(organizationId, jobId) {
      const rows = await tx.$queryRaw<Array<InvitationDeliveryJob & {
        invitationLifecycleStatus: string;
        invitationDeliveryMode: "HELD" | "IMMEDIATE";
        invitationReleasedAt: Date | null;
        invitationDeliveryCompletedAt: Date | null;
        invitationRevokedAt: Date | null;
        invitationConsumedAt: Date | null;
        invitationExpiresAt: Date;
      }>>(Prisma.sql`
        SELECT
          j."id", j."organizationId", j."invitationId",
          j."status"::text AS "status", j."attemptCount", j."maxAttempts", j."availableAt",
          j."leaseToken", j."leaseExpiresAt", j."lastErrorCode", j."sentAt",
          o."lifecycleStatus"::text AS "invitationLifecycleStatus",
          i."deliveryMode"::text AS "invitationDeliveryMode",
          i."releasedAt" AS "invitationReleasedAt",
          i."deliveryCompletedAt" AS "invitationDeliveryCompletedAt",
          i."revokedAt" AS "invitationRevokedAt",
          i."consumedAt" AS "invitationConsumedAt",
          i."expiresAt" AS "invitationExpiresAt"
        FROM "organization_invitation_delivery_jobs" j
        JOIN "organization_invitations" i
          ON i."id" = j."invitationId" AND i."organizationId" = j."organizationId"
        JOIN "organizations" o ON o."id" = i."organizationId"
        WHERE j."id" = ${jobId} AND j."organizationId" = ${organizationId}
        FOR UPDATE OF j, i, o
      `);
      const row = rows[0];
      if (!row) return null;
      return {
        job: {
          id: row.id,
          organizationId: row.organizationId,
          invitationId: row.invitationId,
          status: row.status,
          attemptCount: row.attemptCount,
          maxAttempts: row.maxAttempts,
          availableAt: row.availableAt,
          leaseToken: row.leaseToken,
          leaseExpiresAt: row.leaseExpiresAt,
          lastErrorCode: row.lastErrorCode,
          sentAt: row.sentAt,
        },
        invitation: {
          id: row.invitationId,
          organizationId: row.organizationId,
          lifecycleStatus: row.invitationLifecycleStatus,
          deliveryMode: row.invitationDeliveryMode,
          releasedAt: row.invitationReleasedAt,
          deliveryCompletedAt: row.invitationDeliveryCompletedAt,
          revokedAt: row.invitationRevokedAt,
          consumedAt: row.invitationConsumedAt,
          expiresAt: row.invitationExpiresAt,
        },
      };
    },
    async getProviderPayloadForUpdate(organizationId, jobId, leaseToken, now) {
      const rows = await tx.$queryRaw<Array<InvitationDeliveryJob & {
        invitationLifecycleStatus: string;
        invitationDeliveryMode: "HELD" | "IMMEDIATE";
        invitationReleasedAt: Date | null;
        invitationDeliveryCompletedAt: Date | null;
        invitationRevokedAt: Date | null;
        invitationConsumedAt: Date | null;
        invitationExpiresAt: Date;
        invitationEmail: string;
        invitationTokenHash: string;
        invitationDeliveryTokenCiphertext: string | null;
        organizationName: string;
      }>>(Prisma.sql`
        SELECT
          j."id", j."organizationId", j."invitationId",
          j."status"::text AS "status", j."attemptCount", j."maxAttempts", j."availableAt",
          j."leaseToken", j."leaseExpiresAt", j."lastErrorCode", j."sentAt",
          o."lifecycleStatus"::text AS "invitationLifecycleStatus",
          o."name" AS "organizationName",
          i."deliveryMode"::text AS "invitationDeliveryMode",
          i."releasedAt" AS "invitationReleasedAt",
          i."deliveryCompletedAt" AS "invitationDeliveryCompletedAt",
          i."revokedAt" AS "invitationRevokedAt",
          i."consumedAt" AS "invitationConsumedAt",
          i."expiresAt" AS "invitationExpiresAt",
          i."email" AS "invitationEmail",
          i."tokenHash" AS "invitationTokenHash",
          i."deliveryTokenCiphertext" AS "invitationDeliveryTokenCiphertext"
        FROM "organization_invitation_delivery_jobs" j
        JOIN "organization_invitations" i
          ON i."id" = j."invitationId" AND i."organizationId" = j."organizationId"
        JOIN "organizations" o ON o."id" = i."organizationId"
        WHERE j."id" = ${jobId}
          AND j."organizationId" = ${organizationId}
          AND j."status" = 'PROCESSING'
          AND j."leaseToken" = ${leaseToken}
          AND j."leaseExpiresAt" > ${now}
        FOR UPDATE OF j, i, o
      `);
      const row = rows[0];
      if (!row || row.invitationDeliveryTokenCiphertext === null) return null;
      return {
        job: {
          id: row.id,
          organizationId: row.organizationId,
          invitationId: row.invitationId,
          status: row.status,
          attemptCount: row.attemptCount,
          maxAttempts: row.maxAttempts,
          availableAt: row.availableAt,
          leaseToken: row.leaseToken,
          leaseExpiresAt: row.leaseExpiresAt,
          lastErrorCode: row.lastErrorCode,
          sentAt: row.sentAt,
        },
        invitation: {
          id: row.invitationId,
          organizationId: row.organizationId,
          lifecycleStatus: row.invitationLifecycleStatus,
          deliveryMode: row.invitationDeliveryMode,
          releasedAt: row.invitationReleasedAt,
          deliveryCompletedAt: row.invitationDeliveryCompletedAt,
          revokedAt: row.invitationRevokedAt,
          consumedAt: row.invitationConsumedAt,
          expiresAt: row.invitationExpiresAt,
          email: row.invitationEmail,
          tokenHash: row.invitationTokenHash,
          deliveryTokenCiphertext: row.invitationDeliveryTokenCiphertext,
          organizationName: row.organizationName,
        },
      };
    },
    async completeSuccess(input) {
      const changedJob = await tx.$executeRaw(Prisma.sql`
        UPDATE "organization_invitation_delivery_jobs"
        SET "status" = 'SENT',
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL,
            "lastErrorCode" = NULL,
            "sentAt" = ${input.now},
            "updatedAt" = ${input.now}
        WHERE "id" = ${input.jobId} AND "organizationId" = ${input.organizationId}
      `);
      const changedInvitation = await tx.$executeRaw(Prisma.sql`
        UPDATE "organization_invitations"
        SET "deliveryCompletedAt" = ${input.now}, "updatedAt" = ${input.now}
        WHERE "id" = ${input.invitationId} AND "organizationId" = ${input.organizationId}
      `);
      if (changedJob !== 1 || changedInvitation !== 1) {
        throw new Error("invitation delivery completion failed");
      }
    },
    async completeFailure(input) {
      const changed = await tx.$executeRaw(Prisma.sql`
        UPDATE "organization_invitation_delivery_jobs"
        SET "status" = 'FAILED',
            "availableAt" = ${input.retryAt},
            "leaseToken" = NULL,
            "leaseExpiresAt" = NULL,
            "lastErrorCode" = ${input.errorCode},
            "sentAt" = NULL,
            "updatedAt" = ${input.now}
        WHERE "id" = ${input.jobId} AND "organizationId" = ${input.organizationId}
      `);
      if (changed !== 1) throw new Error("invitation delivery failure update failed");
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object";
}

export function createPrismaInvitationDeliveryDependencies(
  client: PrismaClient = prisma,
): InvitationDeliveryDependencies {
  return {
    transaction(work) {
      return client.$transaction(
        (tx) => work(prismaTransactionStore(tx)),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    },
    newId: randomUUID,
    isRetryableTransactionError(error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return error.code === "P2034"
          || (error.code === "P2010"
            && (error.message.includes("40001") || error.message.includes("40P01")));
      }
      if (!isRecord(error)) return false;
      if (error.code === "40001" || error.code === "40P01") return true;
      const cause = isRecord(error.cause) ? error.cause : null;
      return cause?.originalCode === "40001" || cause?.originalCode === "40P01";
    },
    isInvitationConflictError(error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return error.code === "P2002"
          || (error.code === "P2010" && error.message.includes("23505"));
      }
      if (!isRecord(error)) return false;
      if (error.code === "23505") return true;
      const cause = isRecord(error.cause) ? error.cause : null;
      return cause?.originalCode === "23505";
    },
  };
}

const prismaInvitationDeliveryDependencies = createPrismaInvitationDeliveryDependencies();
