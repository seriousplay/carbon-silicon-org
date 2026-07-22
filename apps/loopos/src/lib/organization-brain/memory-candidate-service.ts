import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { resolveActorContext } from "../authorization/actor-context";
import type { ActorContext } from "../authorization/actor-context-resolver";
import {
  confirmMemoryCandidate as confirmLifecycleCandidate,
  createDraftMemoryCandidate as createLifecycleDraft,
  rejectMemoryCandidate as rejectLifecycleCandidate,
  submitMemoryCandidate as submitLifecycleCandidate,
  supersedeMemoryCandidate as supersedeLifecycleCandidate,
  MemoryCandidateLifecycleError,
} from "./memory-candidate-lifecycle";
import type {
  MemoryCandidate,
  MemoryCandidateActor,
  MemoryCandidateAuditEvent,
  MemoryCandidateAuthorityRouteKind,
  MemoryCandidateSourceRef,
  MemoryCandidateSourceType,
  MemoryCandidateSupersessionRef,
} from "./memory-candidate-types";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_ID_BYTES = 191;

export type MemoryCandidateServiceErrorCode =
  | "INVALID_INPUT"
  | "ACCESS_DENIED"
  | "NOT_AVAILABLE"
  | "INVALID_STATE"
  | "PERSISTENCE_FAILED";

export class MemoryCandidateServiceError extends Error {
  constructor(public readonly code: MemoryCandidateServiceErrorCode) {
    super(`Memory candidate service failed: ${code}`);
    this.name = "MemoryCandidateServiceError";
  }
}

export type CreateMemoryCandidateDraftInput = Readonly<{
  schemaVersion: 1;
  claim: string;
  rationale: string;
  sourceRefs: readonly MemoryCandidateSourceRef[];
}>;

export type MemoryCandidateIdInput = Readonly<{
  schemaVersion: 1;
  candidateId: string;
  reason?: string | null;
}>;

export type ConfirmMemoryCandidateInput = Readonly<{
  schemaVersion: 1;
  candidateId: string;
  validFrom: string;
  validUntil?: string | null;
  reason?: string | null;
}>;

export type SupersedeMemoryCandidateInput = Readonly<{
  schemaVersion: 1;
  candidateId: string;
  supersededBy: MemoryCandidateSupersessionRef;
  reason: string;
}>;

export type ListMemoryCandidatesInput = Readonly<{
  schemaVersion: 1;
  limit?: number;
}>;

export type MemoryCandidateStore = Readonly<{
  create(candidate: MemoryCandidate): Promise<MemoryCandidate>;
  update(candidate: MemoryCandidate): Promise<MemoryCandidate>;
  load(organizationId: string, candidateId: string): Promise<MemoryCandidate | null>;
  listVisibleCandidates(actor: ActorContext, limit: number): Promise<readonly MemoryCandidate[]>;
  canUseSourceRefs(actor: ActorContext, sourceRefs: readonly MemoryCandidateSourceRef[]): Promise<boolean>;
  canReviewRoute(actor: ActorContext, candidate: MemoryCandidate): Promise<boolean>;
}>;

export type MemoryCandidateServiceDependencies = Readonly<{
  resolveActor(): Promise<ActorContext>;
  store: MemoryCandidateStore;
  now(): Date;
  createId(): string;
}>;

type PlainObject = Record<string, unknown>;

type MemoryCandidateRow = Readonly<{
  id: string;
  organizationId: string;
  ownerPersonId: string;
  claim: string;
  rationale: string;
  sourceRefs: unknown;
  authorityRouteKind: MemoryCandidateAuthorityRouteKind;
  authorityRouteLabel: string;
  authorityRouteUrl: string;
  status: MemoryCandidate["status"];
  submittedBy: unknown | null;
  confirmedBy: unknown | null;
  supersededBy: unknown | null;
  validFrom: Date | null;
  validUntil: Date | null;
  createdAt: Date;
  updatedAt: Date;
}>;

type MemoryCandidateAuditEventRow = Readonly<{
  type: MemoryCandidateAuditEvent["type"];
  actor: unknown;
  reason: string | null;
  occurredAt: Date;
}>;

function fail(code: MemoryCandidateServiceErrorCode): never {
  throw new MemoryCandidateServiceError(code);
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isPlainObject(value: unknown): value is PlainObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function objectInput(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): PlainObject {
  if (!isPlainObject(value)) fail("INVALID_INPUT");
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  if (!required.every((key) => Object.hasOwn(value, key))) fail("INVALID_INPUT");
  if (!keys.every((key) => allowed.has(key))) fail("INVALID_INPUT");
  return value;
}

function opaqueId(value: unknown): string {
  if (typeof value !== "string" || utf8Bytes(value) < 1 || utf8Bytes(value) > MAX_ID_BYTES) {
    fail("INVALID_INPUT");
  }
  return value;
}

function optionalReason(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || utf8Bytes(value.trim()) < 1 || utf8Bytes(value.trim()) > 600) {
    fail("INVALID_INPUT");
  }
  return value.trim();
}

function parseLimit(value: unknown): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > MAX_LIMIT) {
    fail("INVALID_INPUT");
  }
  return value;
}

function parseSourceRef(value: unknown): MemoryCandidateSourceRef {
  const input = objectInput(value, ["type", "id", "label", "applicationUrl", "observedAt"]);
  if (
    typeof input.type !== "string" ||
    typeof input.id !== "string" ||
    typeof input.label !== "string" ||
    typeof input.applicationUrl !== "string" ||
    typeof input.observedAt !== "string"
  ) {
    fail("INVALID_INPUT");
  }
  return Object.freeze({
    type: input.type as MemoryCandidateSourceType,
    id: input.id,
    label: input.label,
    applicationUrl: input.applicationUrl,
    observedAt: input.observedAt,
  });
}

function parseSupersessionRef(value: unknown): MemoryCandidateSupersessionRef {
  const input = objectInput(value, ["type", "id", "label", "applicationUrl"]);
  if (
    (input.type !== "memoryCandidate" && input.type !== "sourceRecord") ||
    typeof input.id !== "string" ||
    typeof input.label !== "string" ||
    typeof input.applicationUrl !== "string"
  ) {
    fail("INVALID_INPUT");
  }
  return Object.freeze({
    type: input.type,
    id: input.id,
    label: input.label,
    applicationUrl: input.applicationUrl,
  });
}

function parseCreateInput(input: unknown): CreateMemoryCandidateDraftInput {
  const value = objectInput(input, ["schemaVersion", "claim", "rationale", "sourceRefs"]);
  if (value.schemaVersion !== 1 || typeof value.claim !== "string" || typeof value.rationale !== "string") {
    fail("INVALID_INPUT");
  }
  if (!Array.isArray(value.sourceRefs) || value.sourceRefs.length === 0 || value.sourceRefs.length > 10) {
    fail("INVALID_INPUT");
  }
  return {
    schemaVersion: 1,
    claim: value.claim,
    rationale: value.rationale,
    sourceRefs: Object.freeze(value.sourceRefs.map(parseSourceRef)),
  };
}

function parseIdInput(input: unknown): Readonly<{ candidateId: string; reason: string | null }> {
  const value = objectInput(input, ["schemaVersion", "candidateId"], ["reason"]);
  if (value.schemaVersion !== 1) fail("INVALID_INPUT");
  return {
    candidateId: opaqueId(value.candidateId),
    reason: optionalReason(value.reason),
  };
}

function parseConfirmInput(input: unknown): Readonly<{
  candidateId: string;
  validFrom: string;
  validUntil: string | null;
  reason: string | null;
}> {
  const value = objectInput(input, ["schemaVersion", "candidateId", "validFrom"], ["validUntil", "reason"]);
  if (value.schemaVersion !== 1 || typeof value.validFrom !== "string") fail("INVALID_INPUT");
  if (value.validUntil !== undefined && value.validUntil !== null && typeof value.validUntil !== "string") {
    fail("INVALID_INPUT");
  }
  return {
    candidateId: opaqueId(value.candidateId),
    validFrom: value.validFrom,
    validUntil: value.validUntil ?? null,
    reason: optionalReason(value.reason),
  };
}

function parseSupersedeInput(input: unknown): Readonly<{
  candidateId: string;
  supersededBy: MemoryCandidateSupersessionRef;
  reason: string;
}> {
  const value = objectInput(input, ["schemaVersion", "candidateId", "supersededBy", "reason"]);
  if (value.schemaVersion !== 1 || typeof value.reason !== "string") fail("INVALID_INPUT");
  const reason = optionalReason(value.reason);
  if (!reason) fail("INVALID_INPUT");
  return {
    candidateId: opaqueId(value.candidateId),
    supersededBy: parseSupersessionRef(value.supersededBy),
    reason,
  };
}

function parseListInput(input: unknown): Readonly<{ limit: number }> {
  const value = objectInput(input, ["schemaVersion"], ["limit"]);
  if (value.schemaVersion !== 1) fail("INVALID_INPUT");
  return { limit: parseLimit(value.limit) };
}

async function resolveActor(dependencies: MemoryCandidateServiceDependencies): Promise<ActorContext> {
  try {
    return await dependencies.resolveActor();
  } catch {
    fail("ACCESS_DENIED");
  }
}

function processActorForRoute(
  route: MemoryCandidateAuthorityRouteKind,
  actor: ActorContext,
): MemoryCandidateActor {
  const prefix: Record<MemoryCandidateAuthorityRouteKind, string> = {
    GOAL_STRATEGY: "goal:",
    GOVERNANCE: "governance:",
    TACTICAL: "tactical:",
    MEETING_RECORD: "meeting:",
    TENSION: "tension:",
  };
  return Object.freeze({
    type: "process",
    id: `${prefix[route]}${actor.personId}`,
    label: `${route} source authority`,
  });
}

function personActor(actor: ActorContext): MemoryCandidateActor {
  return Object.freeze({ type: "person", id: actor.personId, label: "Current actor" });
}

function mapLifecycleError(error: unknown): never {
  if (error instanceof MemoryCandidateLifecycleError) {
    if (error.code === "INVALID_STATUS") fail("INVALID_STATE");
    if (error.code === "OWNER_REQUIRED" || error.code === "UNAUTHORIZED_CONFIRMATION") fail("ACCESS_DENIED");
    fail("INVALID_INPUT");
  }
  throw error;
}

async function visibleCandidate(
  store: MemoryCandidateStore,
  actor: ActorContext,
  candidateId: string,
): Promise<MemoryCandidate> {
  const candidate = await store.load(actor.organizationId, candidateId);
  if (!candidate) fail("NOT_AVAILABLE");
  if (candidate.ownerPersonId === actor.personId) return candidate;
  if (candidate.status !== "DRAFT" && await store.canReviewRoute(actor, candidate)) return candidate;
  fail("NOT_AVAILABLE");
}

export async function createMemoryCandidateDraftForActor(
  input: CreateMemoryCandidateDraftInput,
  dependencies: MemoryCandidateServiceDependencies,
): Promise<MemoryCandidate> {
  const parsed = parseCreateInput(input);
  const actor = await resolveActor(dependencies);
  const now = dependencies.now();
  const sourceAllowed = await dependencies.store.canUseSourceRefs(actor, parsed.sourceRefs);
  if (!sourceAllowed) fail("NOT_AVAILABLE");

  try {
    const draft = createLifecycleDraft({
      id: dependencies.createId(),
      organizationId: actor.organizationId,
      ownerPersonId: actor.personId,
      actor: personActor(actor),
      claim: parsed.claim,
      rationale: parsed.rationale,
      sourceRefs: parsed.sourceRefs,
      now,
    });
    return await dependencies.store.create(draft);
  } catch (error) {
    return mapLifecycleError(error);
  }
}

export async function submitMemoryCandidateForActor(
  input: MemoryCandidateIdInput,
  dependencies: MemoryCandidateServiceDependencies,
): Promise<MemoryCandidate> {
  const parsed = parseIdInput(input);
  const actor = await resolveActor(dependencies);
  const candidate = await visibleCandidate(dependencies.store, actor, parsed.candidateId);
  if (candidate.ownerPersonId !== actor.personId) fail("ACCESS_DENIED");
  try {
    return await dependencies.store.update(submitLifecycleCandidate(candidate, {
      actor: personActor(actor),
      now: dependencies.now(),
      reason: parsed.reason,
    }));
  } catch (error) {
    return mapLifecycleError(error);
  }
}

export async function confirmMemoryCandidateForActor(
  input: ConfirmMemoryCandidateInput,
  dependencies: MemoryCandidateServiceDependencies,
): Promise<MemoryCandidate> {
  const parsed = parseConfirmInput(input);
  const actor = await resolveActor(dependencies);
  const candidate = await visibleCandidate(dependencies.store, actor, parsed.candidateId);
  if (candidate.ownerPersonId === actor.personId) fail("ACCESS_DENIED");
  if (!await dependencies.store.canReviewRoute(actor, candidate)) fail("ACCESS_DENIED");
  try {
    return await dependencies.store.update(confirmLifecycleCandidate(candidate, {
      actor: processActorForRoute(candidate.authorityRoute.kind, actor),
      now: dependencies.now(),
      validFrom: parsed.validFrom,
      validUntil: parsed.validUntil,
      reason: parsed.reason,
    }));
  } catch (error) {
    return mapLifecycleError(error);
  }
}

export async function rejectMemoryCandidateForActor(
  input: MemoryCandidateIdInput,
  dependencies: MemoryCandidateServiceDependencies,
): Promise<MemoryCandidate> {
  const parsed = parseIdInput(input);
  const actor = await resolveActor(dependencies);
  const candidate = await visibleCandidate(dependencies.store, actor, parsed.candidateId);
  if (candidate.ownerPersonId === actor.personId) fail("ACCESS_DENIED");
  if (!await dependencies.store.canReviewRoute(actor, candidate)) fail("ACCESS_DENIED");
  try {
    return await dependencies.store.update(rejectLifecycleCandidate(candidate, {
      actor: processActorForRoute(candidate.authorityRoute.kind, actor),
      now: dependencies.now(),
      reason: parsed.reason ?? "Rejected by source authority.",
    }));
  } catch (error) {
    return mapLifecycleError(error);
  }
}

export async function supersedeMemoryCandidateForActor(
  input: SupersedeMemoryCandidateInput,
  dependencies: MemoryCandidateServiceDependencies,
): Promise<MemoryCandidate> {
  const parsed = parseSupersedeInput(input);
  const actor = await resolveActor(dependencies);
  const candidate = await visibleCandidate(dependencies.store, actor, parsed.candidateId);
  if (candidate.ownerPersonId === actor.personId) fail("ACCESS_DENIED");
  if (!await dependencies.store.canReviewRoute(actor, candidate)) fail("ACCESS_DENIED");
  try {
    return await dependencies.store.update(supersedeLifecycleCandidate(candidate, {
      actor: processActorForRoute(candidate.authorityRoute.kind, actor),
      now: dependencies.now(),
      supersededBy: parsed.supersededBy,
      reason: parsed.reason,
    }));
  } catch (error) {
    return mapLifecycleError(error);
  }
}

export async function listMemoryCandidatesForActor(
  input: ListMemoryCandidatesInput,
  dependencies: MemoryCandidateServiceDependencies,
): Promise<readonly MemoryCandidate[]> {
  const parsed = parseListInput(input);
  const actor = await resolveActor(dependencies);
  return dependencies.store.listVisibleCandidates(actor, parsed.limit);
}

export async function listReviewableMemoryCandidatesForActor(
  input: ListMemoryCandidatesInput,
  dependencies: MemoryCandidateServiceDependencies,
): Promise<readonly MemoryCandidate[]> {
  const parsed = parseListInput(input);
  const actor = await resolveActor(dependencies);
  const candidates = await dependencies.store.listVisibleCandidates(actor, parsed.limit);
  const reviewable: MemoryCandidate[] = [];
  for (const candidate of candidates) {
    if (
      candidate.ownerPersonId !== actor.personId &&
      candidate.status !== "DRAFT" &&
      await dependencies.store.canReviewRoute(actor, candidate)
    ) {
      reviewable.push(candidate);
    }
  }
  return Object.freeze(reviewable);
}

export async function createMemoryCandidateDraft(input: CreateMemoryCandidateDraftInput): Promise<MemoryCandidate> {
  return createMemoryCandidateDraftForActor(input, productionDependencies());
}

export async function submitMemoryCandidate(input: MemoryCandidateIdInput): Promise<MemoryCandidate> {
  return submitMemoryCandidateForActor(input, productionDependencies());
}

export async function confirmMemoryCandidate(input: ConfirmMemoryCandidateInput): Promise<MemoryCandidate> {
  return confirmMemoryCandidateForActor(input, productionDependencies());
}

export async function rejectMemoryCandidate(input: MemoryCandidateIdInput): Promise<MemoryCandidate> {
  return rejectMemoryCandidateForActor(input, productionDependencies());
}

export async function supersedeMemoryCandidate(input: SupersedeMemoryCandidateInput): Promise<MemoryCandidate> {
  return supersedeMemoryCandidateForActor(input, productionDependencies());
}

export async function listMemoryCandidates(input: ListMemoryCandidatesInput): Promise<readonly MemoryCandidate[]> {
  return listMemoryCandidatesForActor(input, productionDependencies());
}

export async function listReviewableMemoryCandidates(
  input: ListMemoryCandidatesInput,
): Promise<readonly MemoryCandidate[]> {
  return listReviewableMemoryCandidatesForActor(input, productionDependencies());
}

function productionDependencies(): MemoryCandidateServiceDependencies {
  return {
    resolveActor: resolveActorContext,
    store: createPrismaMemoryCandidateStore(prisma),
    now: () => new Date(),
    createId: () => randomUUID(),
  };
}

export function createPrismaMemoryCandidateStore(client: PrismaClient): MemoryCandidateStore {
  return {
    async create(candidate) {
      await persistCandidate(client, candidate, "create");
      return candidate;
    },
    async update(candidate) {
      await persistCandidate(client, candidate, "update");
      return candidate;
    },
    async load(organizationId, candidateId) {
      return loadCandidate(client, organizationId, candidateId);
    },
    async listVisibleCandidates(actor, limit) {
      const rows = await client.$queryRaw<MemoryCandidateRow[]>(Prisma.sql`
        SELECT *
        FROM "memory_candidates"
        WHERE "organizationId" = ${actor.organizationId}
          AND ("ownerPersonId" = ${actor.personId} OR "status" <> 'DRAFT')
        ORDER BY "updatedAt" DESC, "id" ASC
        LIMIT ${Math.min(limit * 4, 200)}
      `);
      const candidates = await Promise.all(rows.map((row) => candidateFromRow(client, row)));
      const visible: MemoryCandidate[] = [];
      for (const candidate of candidates) {
        if (
          candidate.ownerPersonId === actor.personId ||
          (candidate.status !== "DRAFT" && await this.canReviewRoute(actor, candidate))
        ) {
          visible.push(candidate);
        }
        if (visible.length >= limit) break;
      }
      return Object.freeze(visible);
    },
    async canUseSourceRefs(actor, sourceRefs) {
      for (const ref of sourceRefs) {
        if (!ref.applicationUrl.startsWith("/app/")) return false;
        if (!await sourceRefExists(client, actor, ref)) return false;
      }
      return true;
    },
    async canReviewRoute(actor, candidate) {
      const refs = candidate.sourceRefs;
      if (candidate.authorityRoute.kind === "GOAL_STRATEGY") {
        return hasGoalAuthority(client, actor, refs);
      }
      if (candidate.authorityRoute.kind === "GOVERNANCE") {
        return hasGovernanceAuthority(client, actor, refs);
      }
      if (candidate.authorityRoute.kind === "TACTICAL") {
        return hasTacticalAuthority(client, actor, refs);
      }
      if (candidate.authorityRoute.kind === "MEETING_RECORD") {
        return hasMeetingAuthority(client, actor, refs);
      }
      return candidate.ownerPersonId === actor.personId;
    },
  };
}

async function persistCandidate(
  client: PrismaClient,
  candidate: MemoryCandidate,
  mode: "create" | "update",
): Promise<void> {
  const lastEvent = candidate.auditTrail[candidate.auditTrail.length - 1];
  if (!lastEvent) fail("INVALID_INPUT");
  try {
    await client.$transaction(async (transaction) => {
      if (mode === "create") {
        await transaction.$executeRaw(Prisma.sql`
          INSERT INTO "memory_candidates" (
            "id", "organizationId", "ownerPersonId", "claim", "rationale",
            "sourceRefs", "authorityRouteKind", "authorityRouteLabel", "authorityRouteUrl",
            "status", "submittedBy", "confirmedBy", "supersededBy", "validFrom",
            "validUntil", "createdAt", "updatedAt"
          ) VALUES (
            ${candidate.id}, ${candidate.organizationId}, ${candidate.ownerPersonId},
            ${candidate.claim}, ${candidate.rationale}, ${JSON.stringify(candidate.sourceRefs)}::jsonb,
            ${candidate.authorityRoute.kind}::"MemoryCandidateAuthorityRouteKind",
            ${candidate.authorityRoute.label}, ${candidate.authorityRoute.applicationUrl},
            ${candidate.status}::"MemoryCandidateStatus",
            ${jsonOrNull(candidate.submittedBy)}, ${jsonOrNull(candidate.confirmedBy)},
            ${jsonOrNull(candidate.supersededBy)}, ${dateOrNull(candidate.validFrom)},
            ${dateOrNull(candidate.validUntil)}, ${new Date(candidate.createdAt)}, ${new Date(candidate.updatedAt)}
          )
        `);
      } else {
        await transaction.$executeRaw(Prisma.sql`
          UPDATE "memory_candidates"
          SET
            "status" = ${candidate.status}::"MemoryCandidateStatus",
            "submittedBy" = ${jsonOrNull(candidate.submittedBy)},
            "confirmedBy" = ${jsonOrNull(candidate.confirmedBy)},
            "supersededBy" = ${jsonOrNull(candidate.supersededBy)},
            "validFrom" = ${dateOrNull(candidate.validFrom)},
            "validUntil" = ${dateOrNull(candidate.validUntil)},
            "updatedAt" = ${new Date(candidate.updatedAt)}
          WHERE "id" = ${candidate.id}
            AND "organizationId" = ${candidate.organizationId}
        `);
      }
      await transaction.$executeRaw(Prisma.sql`
        INSERT INTO "memory_candidate_audit_events" (
          "id", "organizationId", "candidateId", "type", "actor", "reason", "occurredAt"
        ) VALUES (
          ${randomUUID()}, ${candidate.organizationId}, ${candidate.id},
          ${lastEvent.type}::"MemoryCandidateAuditEventType",
          ${JSON.stringify(lastEvent.actor)}::jsonb, ${lastEvent.reason},
          ${new Date(lastEvent.occurredAt)}
        )
      `);
    });
  } catch {
    fail("PERSISTENCE_FAILED");
  }
}

function jsonOrNull(value: unknown): Prisma.Sql {
  return value === null ? Prisma.sql`NULL` : Prisma.sql`${JSON.stringify(value)}::jsonb`;
}

function dateOrNull(value: string | null): Date | null {
  return value ? new Date(value) : null;
}

async function loadCandidate(
  client: PrismaClient,
  organizationId: string,
  candidateId: string,
): Promise<MemoryCandidate | null> {
  const rows = await client.$queryRaw<MemoryCandidateRow[]>(Prisma.sql`
    SELECT *
    FROM "memory_candidates"
    WHERE "id" = ${candidateId}
      AND "organizationId" = ${organizationId}
    LIMIT 1
  `);
  const row = rows[0];
  return row ? candidateFromRow(client, row) : null;
}

async function candidateFromRow(client: PrismaClient, row: MemoryCandidateRow): Promise<MemoryCandidate> {
  const events = await client.$queryRaw<MemoryCandidateAuditEventRow[]>(Prisma.sql`
    SELECT "type", "actor", "reason", "occurredAt"
    FROM "memory_candidate_audit_events"
    WHERE "organizationId" = ${row.organizationId}
      AND "candidateId" = ${row.id}
    ORDER BY "occurredAt" ASC, "id" ASC
  `);
  return Object.freeze({
    schemaVersion: 1,
    id: row.id,
    organizationId: row.organizationId,
    ownerPersonId: row.ownerPersonId,
    claim: row.claim,
    rationale: row.rationale,
    sourceRefs: Object.freeze((row.sourceRefs as MemoryCandidateSourceRef[]).map((ref) => Object.freeze({ ...ref }))),
    authorityRoute: Object.freeze({
      kind: row.authorityRouteKind,
      label: row.authorityRouteLabel,
      applicationUrl: row.authorityRouteUrl,
    }),
    status: row.status,
    submittedBy: row.submittedBy as MemoryCandidateActor | null,
    confirmedBy: row.confirmedBy as MemoryCandidateActor | null,
    supersededBy: row.supersededBy as MemoryCandidateSupersessionRef | null,
    validFrom: row.validFrom?.toISOString() ?? null,
    validUntil: row.validUntil?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    auditTrail: Object.freeze(events.map((event) => Object.freeze({
      type: event.type,
      actor: event.actor as MemoryCandidateActor,
      reason: event.reason,
      occurredAt: event.occurredAt.toISOString(),
    }))),
  });
}

async function sourceRefExists(
  client: PrismaClient,
  actor: ActorContext,
  ref: MemoryCandidateSourceRef,
): Promise<boolean> {
  if (ref.type === "goal") return exists(client, Prisma.sql`
    SELECT 1 FROM "goals"
    WHERE "id" = ${ref.id} AND "organizationId" = ${actor.organizationId}
    LIMIT 1
  `);
  if (ref.type === "target") return exists(client, Prisma.sql`
    SELECT 1 FROM "goal_targets"
    WHERE "id" = ${ref.id} AND "organizationId" = ${actor.organizationId}
    LIMIT 1
  `);
  if (ref.type === "circle") return exists(client, Prisma.sql`
    SELECT 1 FROM "circles"
    WHERE "id" = ${ref.id} AND "organizationId" = ${actor.organizationId} AND "status" <> 'ARCHIVED'
    LIMIT 1
  `);
  if (ref.type === "role" || ref.type === "accountability" || ref.type === "domain" || ref.type === "policy") {
    return exists(client, Prisma.sql`
      SELECT 1 FROM "role_defs"
      WHERE "id" = ${ref.id} AND "organizationId" = ${actor.organizationId} AND "status" = 'ACTIVE'
      LIMIT 1
    `);
  }
  if (ref.type === "project") return exists(client, Prisma.sql`
    SELECT 1 FROM "projects" AS project
    JOIN "tactical_outcome_proposals" AS proposal
      ON proposal."organizationId" = project."organizationId"
      AND proposal."outcomeProjectId" = project."id"
      AND proposal."kind" = 'PROJECT'
      AND proposal."status" = 'APPROVED'
    WHERE project."id" = ${ref.id} AND project."organizationId" = ${actor.organizationId}
    LIMIT 1
  `);
  if (ref.type === "action") return exists(client, Prisma.sql`
    SELECT 1 FROM "tensions" AS action
    JOIN "tactical_outcome_proposals" AS proposal
      ON proposal."organizationId" = action."organizationId"
      AND proposal."outcomeActionId" = action."id"
      AND proposal."kind" = 'ACTION'
      AND proposal."status" = 'APPROVED'
    WHERE action."id" = ${ref.id} AND action."organizationId" = ${actor.organizationId}
    LIMIT 1
  `);
  if (ref.type === "meeting" || ref.type === "decision") return hasMeetingAuthority(client, actor, [ref]);
  if (ref.type === "tension") return exists(client, Prisma.sql`
    SELECT 1 FROM "tensions"
    WHERE "id" = ${ref.id}
      AND "organizationId" = ${actor.organizationId}
      AND ("ownerId" = ${actor.personId} OR "raiserId" = ${actor.personId})
    LIMIT 1
  `);
  return false;
}

async function exists(client: PrismaClient, query: Prisma.Sql): Promise<boolean> {
  const rows = await client.$queryRaw<Array<{ "?column?": number }>>(query);
  return rows.length > 0;
}

async function hasGoalAuthority(
  client: PrismaClient,
  actor: ActorContext,
  refs: readonly MemoryCandidateSourceRef[],
): Promise<boolean> {
  const ids = refs.filter((ref) => ref.type === "goal" || ref.type === "target").map((ref) => ref.id);
  if (ids.length === 0) return false;
  if (actor.ledActiveCircleIds.length === 0 && actor.assignedActiveRoleDefIds.length === 0) return false;
  return exists(client, Prisma.sql`
    SELECT 1
    FROM "goals" AS goal
    LEFT JOIN "goal_targets" AS target
      ON target."goalId" = goal."id"
      AND target."organizationId" = goal."organizationId"
    WHERE goal."organizationId" = ${actor.organizationId}
      AND (goal."id" IN (${Prisma.join(ids)}) OR target."id" IN (${Prisma.join(ids)}))
      AND (
        goal."circleId" IN (${Prisma.join([...actor.ledActiveCircleIds, "__none__"])})
        OR goal."ownerRoleId" IN (${Prisma.join([...actor.assignedActiveRoleDefIds, "__none__"])})
      )
    LIMIT 1
  `);
}

async function hasGovernanceAuthority(
  client: PrismaClient,
  actor: ActorContext,
  refs: readonly MemoryCandidateSourceRef[],
): Promise<boolean> {
  const ids = refs
    .filter((ref) => ["circle", "role", "accountability", "domain", "policy"].includes(ref.type))
    .map((ref) => ref.id);
  if (ids.length === 0 || actor.ledActiveCircleIds.length === 0) return false;
  return exists(client, Prisma.sql`
    SELECT 1
    FROM "circles" AS circle
    WHERE circle."organizationId" = ${actor.organizationId}
      AND circle."id" IN (${Prisma.join(ids)})
      AND circle."id" IN (${Prisma.join(actor.ledActiveCircleIds)})
    UNION
    SELECT 1
    FROM "role_defs" AS role
    WHERE role."organizationId" = ${actor.organizationId}
      AND role."id" IN (${Prisma.join(ids)})
      AND role."circleId" IN (${Prisma.join(actor.ledActiveCircleIds)})
    LIMIT 1
  `);
}

async function hasTacticalAuthority(
  client: PrismaClient,
  actor: ActorContext,
  refs: readonly MemoryCandidateSourceRef[],
): Promise<boolean> {
  const projectIds = refs.filter((ref) => ref.type === "project").map((ref) => ref.id);
  const actionIds = refs.filter((ref) => ref.type === "action").map((ref) => ref.id);
  if (projectIds.length === 0 && actionIds.length === 0) return false;
  return exists(client, Prisma.sql`
    SELECT 1 FROM "projects"
    WHERE "organizationId" = ${actor.organizationId}
      AND "bearerId" = ${actor.personId}
      AND "id" IN (${Prisma.join([...projectIds, "__none__"])})
    UNION
    SELECT 1 FROM "tensions"
    WHERE "organizationId" = ${actor.organizationId}
      AND "ownerId" = ${actor.personId}
      AND "id" IN (${Prisma.join([...actionIds, "__none__"])})
    LIMIT 1
  `);
}

async function hasMeetingAuthority(
  client: PrismaClient,
  actor: ActorContext,
  refs: readonly MemoryCandidateSourceRef[],
): Promise<boolean> {
  const meetingIds = refs.filter((ref) => ref.type === "meeting" || ref.type === "decision").map((ref) => ref.id);
  if (meetingIds.length === 0) return false;
  return exists(client, Prisma.sql`
    SELECT 1
    FROM "meetings" AS meeting
    WHERE meeting."organizationId" = ${actor.organizationId}
      AND meeting."id" IN (${Prisma.join(meetingIds)})
      AND EXISTS (
        SELECT 1 FROM "_MeetingToPerson" AS participant
        WHERE participant."A" = meeting."id" AND participant."B" = ${actor.personId}
      )
    LIMIT 1
  `);
}
