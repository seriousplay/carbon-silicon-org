import { createHash } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import type { ActorContext } from "../authorization/actor-context-resolver";
import {
  type BrainQueryPlanErrorCode,
  type ParsedBrainQueryPlan,
} from "./query-plan";

export const BRAIN_QUERY_AUDIT_PURPOSE = "M1_C_USER_QUERY" as const;
export const BRAIN_QUERY_CATALOG_VERSION = 1 as const;
export const BRAIN_QUERY_TIMEOUT_MS = 5_000;

export const BRAIN_QUERY_REJECTION_CODES = Object.freeze([
  "INVALID_PLAN",
  "PLAN_TOO_LARGE",
  "PLAN_TOO_DEEP",
  "PLAN_TOO_COMPLEX",
  "UNSUPPORTED_RESOURCE",
  "UNSUPPORTED_FIELD",
  "UNSUPPORTED_OPERATOR",
  "INVALID_FILTER",
  "INVALID_RELATION",
  "INVALID_SORT",
  "INVALID_PAGE",
  "INVALID_LIMIT",
  "PRIVATE_MESSAGE_SCOPE_REQUIRED",
  "ACTOR_REFERENCE_LIMIT",
  "QUERY_TOO_EXPENSIVE",
] as const satisfies readonly BrainQueryPlanErrorCode[]);

export const BRAIN_QUERY_FAILURE_CODES = Object.freeze([
  "QUERY_TIMEOUT",
  "DATABASE_POLICY_MISMATCH",
  "DATABASE_UNAVAILABLE",
  "ROW_SHAPE_MISMATCH",
  "DATABASE_EXECUTION_FAILED",
] as const);

export type BrainQueryRejectionCode = (typeof BRAIN_QUERY_REJECTION_CODES)[number];
export type BrainQueryFailureCode = (typeof BRAIN_QUERY_FAILURE_CODES)[number];
export type BrainQueryAuditErrorCode =
  | BrainQueryRejectionCode
  | BrainQueryFailureCode;

type AuditStatus = "SUCCEEDED" | "REJECTED" | "FAILED";

export type BrainQueryAuditScope = Readonly<{
  catalogVersion: 1;
  schemaVersion: 1;
  resource: string | null;
  filters: readonly Readonly<{ field: string; operator: string }>[];
  relation: Readonly<{
    resource: string;
    filters: readonly Readonly<{ field: string; operator: string }>[];
  }> | null;
  sort: readonly Readonly<{ field: string; direction: string }>[];
  page: number | null;
  limit: number | null;
  estimatedCost: number | null;
  planShapeHash: string;
  latencyMs: number;
  timeoutMs: number;
  hasMore: boolean;
}>;

const PLAN_SHAPE_KEYS = new Set([
  "schemaVersion",
  "resource",
  "filters",
  "relation",
  "sort",
  "page",
  "limit",
  "field",
  "operator",
  "value",
  "direction",
  "actorRef",
]);

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function rejectedStructuralShape(
  value: unknown,
  depth: number,
  state: { entries: number; seen: WeakSet<object> },
): unknown {
  if (value === null) return "null";
  if (typeof value === "string") return "string";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") {
    return Number.isFinite(value)
      ? Number.isInteger(value) ? "integer" : "number"
      : "non-finite-number";
  }
  if (typeof value !== "object") return typeof value;
  if (depth > 5) return "depth-limit";
  if (state.seen.has(value)) return "cycle";
  state.seen.add(value);
  if (state.entries >= 128) return "entry-limit";

  const isArray = Array.isArray(value);
  if (isArray && state.entries + value.length > 128) {
    return ["array", "entry-limit"];
  }
  const prototype = Object.getPrototypeOf(value);
  const container = isArray
    ? "array"
    : prototype === Object.prototype ? "object" : "custom-prototype";
  const keys = Reflect.ownKeys(value);
  const entries: unknown[] = [];
  for (const key of keys) {
    if (container === "array" && key === "length") continue;
    state.entries += 1;
    if (state.entries > 128) {
      entries.push(["entry-limit"]);
      break;
    }
    const safeKey =
      typeof key === "string" && PLAN_SHAPE_KEYS.has(key)
        ? key
        : typeof key === "symbol" ? "symbol-key" : "unknown-key";
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    entries.push([
      safeKey,
      descriptor?.enumerable === true ? "enumerable" : "hidden",
      descriptor && "value" in descriptor
        ? rejectedStructuralShape(descriptor.value, depth + 1, state)
        : "accessor",
    ]);
  }
  entries.sort((left, right) =>
    JSON.stringify(left).localeCompare(JSON.stringify(right)),
  );
  return [container, entries];
}

export function hashRejectedBrainQueryPlanShape(input: unknown): string {
  try {
    return sha256(
      rejectedStructuralShape(input, 1, {
        entries: 0,
        seen: new WeakSet(),
      }),
    );
  } catch {
    return sha256("uninspectable-plan-shape");
  }
}

function planShape(plan: ParsedBrainQueryPlan | null) {
  return Object.freeze({
    catalogVersion: BRAIN_QUERY_CATALOG_VERSION,
    schemaVersion: 1 as const,
    resource: plan?.resource ?? null,
    filters: Object.freeze(
      (plan?.filters ?? []).map((filter) =>
        Object.freeze({ field: filter.field, operator: filter.operator }),
      ),
    ),
    relation: plan?.relation
      ? Object.freeze({
          resource: plan.relation.resource,
          filters: Object.freeze(
            plan.relation.filters.map((filter) =>
              Object.freeze({ field: filter.field, operator: filter.operator }),
            ),
          ),
        })
      : null,
    sort: Object.freeze(
      (plan?.sort ?? []).map((term) =>
        Object.freeze({ field: term.field, direction: term.direction }),
      ),
    ),
    page: plan?.page ?? null,
    limit: plan?.limit ?? null,
    estimatedCost: plan?.estimatedCost ?? null,
  });
}

function boundedLatency(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.min(60_000, Math.round(value));
}

export function buildBrainQueryAuditScope(
  plan: ParsedBrainQueryPlan | null,
  latencyMs: number,
  hasMore: boolean,
  rejectedPlanShapeHash?: string,
): BrainQueryAuditScope {
  const shape = planShape(plan);
  return Object.freeze({
    ...shape,
    planShapeHash: plan
      ? sha256(shape)
      : rejectedPlanShapeHash ?? sha256(shape),
    latencyMs: boundedLatency(latencyMs),
    timeoutMs: BRAIN_QUERY_TIMEOUT_MS,
    hasMore,
  });
}

function boundedIdentifier(value: string): boolean {
  return value.length > 0 && Buffer.byteLength(value, "utf8") <= 191;
}

export async function hasValidBrainQueryInvocation(
  actor: ActorContext,
  conversationId: string,
  messageId: string,
): Promise<boolean> {
  if (!boundedIdentifier(conversationId) || !boundedIdentifier(messageId)) {
    return false;
  }
  const message = await prisma.brainMessage.findFirst({
    where: {
      id: messageId,
      conversationId,
      organizationId: actor.organizationId,
      role: "USER",
      conversation: {
        is: {
          id: conversationId,
          organizationId: actor.organizationId,
          ownerId: actor.personId,
        },
      },
    },
    select: { id: true },
  });
  return message?.id === messageId;
}

function isRejectionCode(value: string): value is BrainQueryRejectionCode {
  return (BRAIN_QUERY_REJECTION_CODES as readonly string[]).includes(value);
}

function isFailureCode(value: string): value is BrainQueryFailureCode {
  return (BRAIN_QUERY_FAILURE_CODES as readonly string[]).includes(value);
}

export async function writeBrainQueryAudit(
  actor: ActorContext,
  conversationId: string,
  messageId: string,
  input: Readonly<{
    status: AuditStatus;
    errorCode: BrainQueryAuditErrorCode | null;
    resultCount: number;
    plan: ParsedBrainQueryPlan | null;
    latencyMs: number;
    hasMore: boolean;
    rejectedPlanShapeHash?: string;
  }>,
): Promise<void> {
  const hasRejectedShapeHash =
    typeof input.rejectedPlanShapeHash === "string" &&
    /^[a-f0-9]{64}$/.test(input.rejectedPlanShapeHash);
  if (
    !boundedIdentifier(conversationId) ||
    !boundedIdentifier(messageId) ||
    !Number.isInteger(input.resultCount) ||
    input.resultCount < 0 ||
    input.resultCount > 50 ||
    (input.status !== "SUCCEEDED" && input.resultCount !== 0) ||
    (input.status === "SUCCEEDED" &&
      (input.errorCode !== null || input.plan === null || input.rejectedPlanShapeHash !== undefined)) ||
    (input.status === "REJECTED" &&
      (input.errorCode === null ||
        !isRejectionCode(input.errorCode) ||
        input.plan !== null ||
        !hasRejectedShapeHash)) ||
    (input.status === "FAILED" &&
      (input.errorCode === null ||
        !isFailureCode(input.errorCode) ||
        input.plan === null ||
        input.rejectedPlanShapeHash !== undefined))
  ) {
    throw new Error("invalid Brain query audit input");
  }
  const scope = buildBrainQueryAuditScope(
    input.plan,
    input.latencyMs,
    input.hasMore,
    input.rejectedPlanShapeHash,
  );
  await prisma.brainQueryAudit.create({
    data: {
      organizationId: actor.organizationId,
      actorId: actor.personId,
      conversationId,
      messageId,
      purpose: BRAIN_QUERY_AUDIT_PURPOSE,
      scope: scope as Prisma.InputJsonValue,
      resultCount: input.resultCount,
      status: input.status,
      errorCode: input.errorCode,
    },
    select: { id: true },
  });
}
