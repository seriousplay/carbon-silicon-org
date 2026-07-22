import "server-only";

import { createHash } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { resolveActorContext } from "../authorization/actor-context";
import type { ActorContext } from "../authorization/actor-context-resolver";
import type {
  MemoryCandidate,
  MemoryCandidateActor,
  MemoryCandidateAuthorityRouteKind,
  MemoryCandidateSourceRef,
  MemoryCandidateSupersessionRef,
} from "./memory-candidate-types";
import {
  deriveSharedMemoryEntry,
  rankSharedMemoryEntries,
  SharedMemoryDerivationError,
} from "./shared-memory-derivation";
import type { SharedMemoryEntry } from "./shared-memory-types";
import {
  createPrismaMemoryCandidateStore,
} from "./memory-candidate-service";

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 20;
const MAX_TEXT_BYTES = 400;
const MAX_SCAN_LIMIT = 100;
const AUDIT_PURPOSE = "M4_C_SHARED_MEMORY_RETRIEVAL";

export type SharedMemoryRetrievalErrorCode =
  | "INVALID_INPUT"
  | "ACCESS_DENIED"
  | "RETRIEVAL_FAILED"
  | "AUDIT_FAILED";

export class SharedMemoryRetrievalError extends Error {
  constructor(public readonly code: SharedMemoryRetrievalErrorCode) {
    super(`Shared memory retrieval failed: ${code}`);
    this.name = "SharedMemoryRetrievalError";
  }
}

export type RetrieveSharedMemoryInput = Readonly<{
  schemaVersion: 1;
  text?: string | null;
  authorityRouteKind?: MemoryCandidateAuthorityRouteKind | null;
  limit?: number | null;
}>;

export type SharedMemoryRetrievalStore = Readonly<{
  listConfirmedCandidates(
    actor: ActorContext,
    input: Readonly<{
      authorityRouteKind: MemoryCandidateAuthorityRouteKind | null;
      limit: number;
    }>,
  ): Promise<readonly MemoryCandidate[]>;
  authorizedSourceRefs(
    actor: ActorContext,
    sourceRefs: readonly MemoryCandidateSourceRef[],
  ): Promise<readonly MemoryCandidateSourceRef[]>;
}>;

export type SharedMemoryRetrievalAuditStore = Readonly<{
  record(
    actor: ActorContext,
    input: Readonly<{
      status: "SUCCEEDED" | "FAILED";
      errorCode: Exclude<SharedMemoryRetrievalErrorCode, "INVALID_INPUT" | "ACCESS_DENIED"> | null;
      resultCount: number;
      query: ParsedSharedMemoryRetrievalInput;
      latencyMs: number;
    }>,
  ): Promise<void>;
}>;

export type SharedMemoryRetrievalDependencies = Readonly<{
  resolveActor(): Promise<ActorContext>;
  store: SharedMemoryRetrievalStore;
  audit: SharedMemoryRetrievalAuditStore;
  now(): Date;
}>;

type ParsedSharedMemoryRetrievalInput = Readonly<{
  text: string | null;
  authorityRouteKind: MemoryCandidateAuthorityRouteKind | null;
  limit: number;
}>;

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

function fail(code: SharedMemoryRetrievalErrorCode): never {
  throw new SharedMemoryRetrievalError(code);
}

function utf8Bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function parseText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || utf8Bytes(value) > MAX_TEXT_BYTES) fail("INVALID_INPUT");
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function parseLimit(value: unknown): number {
  if (value === undefined || value === null) return DEFAULT_LIMIT;
  if (!Number.isInteger(value) || Number(value) < 1 || Number(value) > MAX_LIMIT) fail("INVALID_INPUT");
  return Number(value);
}

function isRouteKind(value: unknown): value is MemoryCandidateAuthorityRouteKind {
  return (
    value === "GOAL_STRATEGY" ||
    value === "GOVERNANCE" ||
    value === "TACTICAL" ||
    value === "MEETING_RECORD" ||
    value === "TENSION"
  );
}

function parseInput(input: RetrieveSharedMemoryInput): ParsedSharedMemoryRetrievalInput {
  if (!input || input.schemaVersion !== 1) fail("INVALID_INPUT");
  if (
    input.authorityRouteKind !== undefined &&
    input.authorityRouteKind !== null &&
    !isRouteKind(input.authorityRouteKind)
  ) {
    fail("INVALID_INPUT");
  }
  return Object.freeze({
    text: parseText(input.text),
    authorityRouteKind: input.authorityRouteKind ?? null,
    limit: parseLimit(input.limit),
  });
}

function elapsed(startedAt: number, now: Date): number {
  if (!Number.isFinite(startedAt) || !Number.isFinite(now.getTime())) return 0;
  return Math.max(0, Math.round(Date.now() - startedAt));
}

function scanLimit(limit: number): number {
  return Math.min(MAX_SCAN_LIMIT, Math.max(limit * 5, limit));
}

async function resolveActor(dependencies: SharedMemoryRetrievalDependencies): Promise<ActorContext> {
  try {
    return await dependencies.resolveActor();
  } catch {
    fail("ACCESS_DENIED");
  }
}

async function auditOrFail(
  actor: ActorContext,
  dependencies: SharedMemoryRetrievalDependencies,
  input: Parameters<SharedMemoryRetrievalAuditStore["record"]>[1],
): Promise<void> {
  try {
    await dependencies.audit.record(actor, input);
  } catch {
    fail("AUDIT_FAILED");
  }
}

export async function retrieveSharedMemoryForActor(
  input: RetrieveSharedMemoryInput,
  dependencies: SharedMemoryRetrievalDependencies,
): Promise<readonly SharedMemoryEntry[]> {
  const parsed = parseInput(input);
  const actor = await resolveActor(dependencies);
  const now = dependencies.now();
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) fail("INVALID_INPUT");
  const startedAt = Date.now();

  try {
    const candidates = await dependencies.store.listConfirmedCandidates(actor, {
      authorityRouteKind: parsed.authorityRouteKind,
      limit: scanLimit(parsed.limit),
    });
    const entries: SharedMemoryEntry[] = [];
    for (const candidate of candidates) {
      const sourceRefs = await dependencies.store.authorizedSourceRefs(actor, candidate.sourceRefs);
      const entry = deriveSharedMemoryEntry(candidate, {
        authorizedSourceRefs: sourceRefs,
        now,
        queryText: parsed.text,
      });
      if (entry) entries.push(entry);
    }
    const ranked = rankSharedMemoryEntries(entries, parsed);
    await auditOrFail(actor, dependencies, {
      status: "SUCCEEDED",
      errorCode: null,
      resultCount: ranked.length,
      query: parsed,
      latencyMs: elapsed(startedAt, now),
    });
    return ranked;
  } catch (error) {
    if (error instanceof SharedMemoryRetrievalError) throw error;
    const errorCode: SharedMemoryRetrievalErrorCode =
      error instanceof SharedMemoryDerivationError ? "RETRIEVAL_FAILED" : "RETRIEVAL_FAILED";
    await auditOrFail(actor, dependencies, {
      status: "FAILED",
      errorCode,
      resultCount: 0,
      query: parsed,
      latencyMs: elapsed(startedAt, now),
    });
    fail(errorCode);
  }
}

export async function retrieveSharedMemory(
  input: RetrieveSharedMemoryInput,
): Promise<readonly SharedMemoryEntry[]> {
  return retrieveSharedMemoryForActor(input, {
    resolveActor: resolveActorContext,
    store: createPrismaSharedMemoryRetrievalStore(prisma),
    audit: createPrismaSharedMemoryRetrievalAuditStore(prisma),
    now: () => new Date(),
  });
}

export function createPrismaSharedMemoryRetrievalStore(client: PrismaClient): SharedMemoryRetrievalStore {
  const candidateStore = createPrismaMemoryCandidateStore(client);
  return {
    async listConfirmedCandidates(actor, input) {
      const routeClause = input.authorityRouteKind
        ? Prisma.sql`AND "authorityRouteKind" = ${input.authorityRouteKind}::"MemoryCandidateAuthorityRouteKind"`
        : Prisma.empty;
      const rows = await client.$queryRaw<MemoryCandidateRow[]>(Prisma.sql`
        SELECT *
        FROM "memory_candidates"
        WHERE "organizationId" = ${actor.organizationId}
          AND "status" = 'CONFIRMED'
          ${routeClause}
        ORDER BY "validFrom" DESC NULLS LAST, "updatedAt" DESC, "id" ASC
        LIMIT ${Math.min(input.limit, MAX_SCAN_LIMIT)}
      `);
      return Object.freeze(rows.map(candidateFromRow));
    },
    async authorizedSourceRefs(actor, sourceRefs) {
      const authorized: MemoryCandidateSourceRef[] = [];
      for (const sourceRef of sourceRefs) {
        if (await candidateStore.canUseSourceRefs(actor, [sourceRef])) {
          authorized.push(sourceRef);
        }
      }
      return Object.freeze(authorized);
    },
  };
}

export function createPrismaSharedMemoryRetrievalAuditStore(
  client: PrismaClient,
): SharedMemoryRetrievalAuditStore {
  return {
    async record(actor, input) {
      await client.brainQueryAudit.create({
        data: {
          organizationId: actor.organizationId,
          actorId: actor.personId,
          purpose: AUDIT_PURPOSE,
          scope: auditScope(input.query, input.latencyMs) as Prisma.InputJsonValue,
          resultCount: input.resultCount,
          status: input.status,
          errorCode: input.errorCode,
        },
        select: { id: true },
      });
    },
  };
}

function auditScope(query: ParsedSharedMemoryRetrievalInput, latencyMs: number) {
  const textHash = query.text
    ? createHash("sha256").update(query.text).digest("hex")
    : null;
  return Object.freeze({
    schemaVersion: 1,
    capability: "sharedMemoryRetrieval",
    hasText: query.text !== null,
    textHash,
    authorityRouteKind: query.authorityRouteKind,
    limit: query.limit,
    latencyMs: Math.max(0, Math.min(60_000, Math.round(latencyMs))),
  });
}

function candidateFromRow(row: MemoryCandidateRow): MemoryCandidate {
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
    auditTrail: Object.freeze([]),
  });
}
