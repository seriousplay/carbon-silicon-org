import "server-only";

import { createHash } from "node:crypto";

import { resolveActorContext } from "../authorization/actor-context";
import type { ActorContext } from "../authorization/actor-context-resolver";
import { askAIWithConfig, isAIConfigAvailable } from "../ai/provider";
import { resolveOrganizationAIConfig } from "../ai/organization-model-settings";
import { getOrganizationGovernanceConfig } from "../organization-governance-config";
import type { BrainEvidencePacket } from "./evidence";
import {
  normalizeOrganizationBrainResponse,
  organizationBrainConversationStore,
  OrganizationBrainConversationStoreError,
  type OrganizationBrainConversationDetail,
  type OrganizationBrainConversationList,
  type OrganizationBrainConversationStore,
  type OrganizationBrainConversationSummary,
  type StoredOrganizationBrainResponse,
} from "./conversation-store";
import {
  executeOrganizationBrainQuery,
  OrganizationBrainQueryError,
  type OrganizationBrainQueryResult,
} from "./query-broker";
import {
  BRAIN_QUERY_CATALOG,
  BRAIN_QUERY_RESOURCES,
  parseBrainQueryPlan,
  type BrainQueryResource,
} from "./query-plan";
import {
  createOrganizationBrainQueryPlanner,
  planOrganizationQuestion,
  type OrganizationBrainQueryPlannerResponse,
} from "./query-planner";
import type {
  RawPlanV1,
  RawPlannerActorReference,
  RawPlannerFilterV1,
  RawPlannerFilterValue,
} from "./query-planner-schema";
import { reasonOrganizationQuestion } from "./reasoner";
import {
  ORGANIZATION_BRAIN_CAPABILITY_HELP_MESSAGE,
  ORGANIZATION_BRAIN_FIELD_LABELS,
  ORGANIZATION_BRAIN_RESOURCE_LABELS,
  ORGANIZATION_BRAIN_SECTION_LABELS,
  confirmedMemoryFromSharedEntry,
  type OrganizationBrainResponse,
} from "./response-schema";
import { retrieveSharedMemory } from "./shared-memory-service";
import type { SharedMemoryEntry } from "./shared-memory-types";

const CONVERSATION_DOMAIN = "loopos:v5:m1:e1:conversation:v1";
const TURN_DOMAIN = "loopos:v5:m1:e1:turn:v1";
const MAX_CONVERSATION_ID_BYTES = 191;
const MAX_CLIENT_ID_BYTES = 128;
const MAX_QUESTION_BYTES = 2_048;
const DEFAULT_LIST_LIMIT = 20;
const MAX_LIST_LIMIT = 50;
const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;
const MAX_PLANNER_OUTPUT_BYTES = 16 * 1024;
const MAX_TOTAL_PLANNED_ROWS = 20;
const MAX_TOTAL_PLANNED_COST = 96;
const MAX_RECORD_ID_BYTES = 191;
const MAX_DISPLAY_VALUE_BYTES = 2 * 1024;
const MAX_PACKET_DISPLAY_BYTES = 8 * 1024;
const MAX_APPLICATION_URL_BYTES = 2 * 1024;
const MAX_MEMORY_QUERY_BYTES = 400;
const MEMORY_RETRIEVAL_LIMIT = 5;
const EVIDENCE_ID = /^ev_[a-f0-9]{64}$/;
const NOTES_REVISION = /^notesRevision:(?:0|-?[1-9]\d*)$/;
const OPAQUE_TOKEN_CHARACTER = /[\p{L}\p{N}\p{M}\p{Pc}\p{Pd}]/u;
const RESOURCE_SET = new Set<string>(BRAIN_QUERY_RESOURCES);
const TRUNCATION_MISSING_EVIDENCE =
  "More authorized rows existed than were returned; the answer is incomplete.";

const PLAN_REJECTION_CODES = Object.freeze([
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
] as const);
const PLAN_REJECTION_SET = new Set<string>(PLAN_REJECTION_CODES);
const BROKER_FAILURE_SET = new Set<string>([
  "AUDIT_FAILED",
  "QUERY_TIMEOUT",
  "DATABASE_POLICY_MISMATCH",
  "DATABASE_UNAVAILABLE",
  "ROW_SHAPE_MISMATCH",
  "DATABASE_EXECUTION_FAILED",
]);
const PROVIDER_CODE_SET = new Set<string>([
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "PROVIDER_FAILURE",
]);
const PLANNER_REJECTED_CODE_SET = new Set<string>([
  "INVALID_QUESTION",
  "QUESTION_LIMIT_EXCEEDED",
  "PROMPT_LIMIT_EXCEEDED",
  "OUTPUT_LIMIT_EXCEEDED",
  "OUTPUT_SCHEMA_INVALID",
  "PLAN_COUNT_EXCEEDED",
  "PLAN_LIMIT_EXCEEDED",
  "TOTAL_ROW_LIMIT_EXCEEDED",
  "TOTAL_COST_LIMIT_EXCEEDED",
  "DUPLICATE_PLAN",
  ...PLAN_REJECTION_CODES,
]);
const D1_CODE_SET = new Set<string>([
  "ANSWERED",
  "INVALID_QUESTION",
  "QUESTION_LIMIT_EXCEEDED",
  "INVALID_EVIDENCE",
  "EVIDENCE_LIMIT_EXCEEDED",
  "PROMPT_LIMIT_EXCEEDED",
  "ACCESS_DENIED",
  "NO_AUTHORIZED_EVIDENCE",
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "PROVIDER_FAILURE",
  "OUTPUT_LIMIT_EXCEEDED",
  "OUTPUT_SCHEMA_INVALID",
  "CITATION_INVALID",
  "UNSUPPORTED_FACT",
]);

const MESSAGES = Object.freeze({
  noPlan: "当前问题无法转换为受支持的组织查询。",
  plannerUnavailable: "组织大脑规划服务暂时不可用。",
  plannerRejected: "当前问题无法通过受限查询规划校验。",
  plannerFailed: "组织大脑查询规划失败。",
  queryRejected: "查询计划未通过组织数据访问校验。",
  denied: "无法提供该问题的组织信息。",
  queryFailed: "组织数据查询暂时失败。",
  evidenceConflict: "授权证据出现冲突，无法生成可靠回答。",
  reasonerFailed: "组织大脑推理暂时失败。",
} as const);

export type OrganizationBrainConversationCreateInput = Readonly<{
  schemaVersion: 1;
  clientConversationId: string;
}>;

export type OrganizationBrainConversationListInput = Readonly<{
  schemaVersion: 1;
  limit?: number;
}>;

export type OrganizationBrainConversationLoadInput = Readonly<{
  schemaVersion: 1;
  conversationId: string;
  messageLimit?: number;
}>;

export type OrganizationBrainTurnInput = Readonly<{
  schemaVersion: 1;
  conversationId: string;
  clientTurnId: string;
  question: string;
}>;

export type OrganizationBrainTurnResult = Readonly<{
  schemaVersion: 1;
  conversationId: string;
  userMessageId: string;
  brainMessageId: string;
  result: StoredOrganizationBrainResponse;
}>;

export type OrganizationBrainTurnServiceErrorCode =
  | "INVALID_INPUT"
  | "ACCESS_DENIED"
  | "IDEMPOTENCY_CONFLICT"
  | "PERSISTENCE_FAILED"
  | "STORED_RESPONSE_INVALID";

export class OrganizationBrainTurnServiceError extends Error {
  constructor(public readonly code: OrganizationBrainTurnServiceErrorCode) {
    super(`Organization Brain service failed: ${code}`);
    this.name = "OrganizationBrainTurnServiceError";
  }
}

export type OrganizationBrainTurnServiceDependencies = Readonly<{
  resolveActor(): Promise<ActorContext>;
  store: OrganizationBrainConversationStore;
  plan(
    actor: ActorContext,
    input: Readonly<{ schemaVersion: 1; question: string }>,
  ): Promise<OrganizationBrainQueryPlannerResponse>;
  executeQuery(
    actor: ActorContext,
    conversationId: string,
    userMessageId: string,
    plan: RawPlanV1,
  ): Promise<OrganizationBrainQueryResult>;
  reason(input: Readonly<{
    schemaVersion: 1;
    question: string;
    confirmedMemory?: readonly SharedMemoryEntry[];
    evidence: Readonly<{
      status: "AUTHORIZED";
      packets: readonly BrainEvidencePacket[];
      hasMore: boolean;
    }>;
  }>): Promise<OrganizationBrainResponse>;
  retrieveMemory(
    actor: ActorContext,
    input: Readonly<{ schemaVersion: 1; text: string | null; limit: number }>,
  ): Promise<readonly SharedMemoryEntry[]>;
}>;

export type OrganizationBrainTurnService = Readonly<{
  createConversation(
    input: OrganizationBrainConversationCreateInput,
  ): Promise<OrganizationBrainConversationSummary>;
  listConversations(
    input: OrganizationBrainConversationListInput,
  ): Promise<OrganizationBrainConversationList>;
  loadConversation(
    input: OrganizationBrainConversationLoadInput,
  ): Promise<OrganizationBrainConversationDetail>;
  executeTurn(input: OrganizationBrainTurnInput): Promise<OrganizationBrainTurnResult>;
}>;

type PlainObject = Record<string, unknown>;

class DependencyResponseInvalid extends Error {}

function serviceFail(code: OrganizationBrainTurnServiceErrorCode): never {
  throw new OrganizationBrainTurnServiceError(code);
}

function isWellFormed(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && codePoint >= 0xd800 && codePoint <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function dataObject(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): PlainObject | null {
  try {
    if (
      typeof value !== "object" ||
      value === null ||
      Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype
    ) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    const allowed = new Set([...required, ...optional]);
    if (
      keys.some((key) => typeof key !== "string") ||
      required.some((key) => !keys.includes(key)) ||
      keys.some((key) => !allowed.has(key as string)) ||
      keys.length < required.length
    ) {
      return null;
    }
    const result: PlainObject = {};
    for (const key of keys as string[]) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor?.enumerable || !("value" in descriptor)) return null;
      result[key] = descriptor.value;
    }
    return result;
  } catch {
    return null;
  }
}

function dataArray(value: unknown): readonly unknown[] | null {
  try {
    if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
      return null;
    }
    const keys = Reflect.ownKeys(value);
    if (
      keys.length !== value.length + 1 ||
      !keys.includes("length") ||
      keys.some(
        (key) =>
          typeof key !== "string" ||
          (key !== "length" && !/^(?:0|[1-9]\d*)$/.test(key)),
      )
    ) {
      return null;
    }
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (!descriptor?.enumerable || !("value" in descriptor)) return null;
      result.push(descriptor.value);
    }
    return result;
  } catch {
    return null;
  }
}

function exactInput(value: unknown, keys: readonly string[]): PlainObject {
  const input = dataObject(value, keys);
  if (!input || Object.keys(input).length !== keys.length) {
    serviceFail("INVALID_INPUT");
  }
  return input;
}

function opaqueId(value: unknown, maxBytes: number): string {
  if (
    typeof value !== "string" ||
    !isWellFormed(value) ||
    utf8Bytes(value) < 1 ||
    utf8Bytes(value) > maxBytes
  ) {
    serviceFail("INVALID_INPUT");
  }
  return value;
}

function boundedInteger(value: unknown, fallback: number, maximum: number): number {
  const candidate = value === undefined ? fallback : value;
  if (
    typeof candidate !== "number" ||
    !Number.isInteger(candidate) ||
    candidate < 1 ||
    candidate > maximum
  ) {
    serviceFail("INVALID_INPUT");
  }
  return candidate;
}

function parseCreateInput(input: unknown): string {
  const value = exactInput(input, ["schemaVersion", "clientConversationId"]);
  if (value.schemaVersion !== 1) serviceFail("INVALID_INPUT");
  return opaqueId(value.clientConversationId, MAX_CLIENT_ID_BYTES);
}

function parseListInput(input: unknown): number {
  const value = dataObject(input, ["schemaVersion"], ["limit"]);
  if (!value || value.schemaVersion !== 1) serviceFail("INVALID_INPUT");
  return boundedInteger(value.limit, DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
}

function parseLoadInput(input: unknown): Readonly<{
  conversationId: string;
  messageLimit: number;
}> {
  const value = dataObject(
    input,
    ["schemaVersion", "conversationId"],
    ["messageLimit"],
  );
  if (!value || value.schemaVersion !== 1) serviceFail("INVALID_INPUT");
  return {
    conversationId: opaqueId(
      value.conversationId,
      MAX_CONVERSATION_ID_BYTES,
    ),
    messageLimit: boundedInteger(
      value.messageLimit,
      DEFAULT_MESSAGE_LIMIT,
      MAX_MESSAGE_LIMIT,
    ),
  };
}

function parseTurnInput(input: unknown): Readonly<{
  conversationId: string;
  clientTurnId: string;
  question: string;
}> {
  const value = exactInput(input, [
    "schemaVersion",
    "conversationId",
    "clientTurnId",
    "question",
  ]);
  if (value.schemaVersion !== 1) serviceFail("INVALID_INPUT");
  const conversationId = opaqueId(
    value.conversationId,
    MAX_CONVERSATION_ID_BYTES,
  );
  const clientTurnId = opaqueId(value.clientTurnId, MAX_CLIENT_ID_BYTES);
  if (typeof value.question !== "string" || !isWellFormed(value.question)) {
    serviceFail("INVALID_INPUT");
  }
  const question = value.question.trim();
  if (utf8Bytes(question) < 1 || utf8Bytes(question) > MAX_QUESTION_BYTES) {
    serviceFail("INVALID_INPUT");
  }
  return { conversationId, clientTurnId, question };
}

function digest(domain: string, values: readonly string[]): string {
  return createHash("sha256")
    .update(JSON.stringify([domain, ...values]))
    .digest("hex");
}

function conversationId(actor: ActorContext, clientConversationId: string): string {
  return `bc_${digest(CONVERSATION_DOMAIN, [
    actor.organizationId,
    actor.personId,
    clientConversationId,
  ])}`;
}

function turnIds(
  actor: ActorContext,
  conversationIdentity: string,
  clientTurnId: string,
): Readonly<{ userMessageId: string; brainMessageId: string }> {
  const turnDigest = digest(TURN_DOMAIN, [
    actor.organizationId,
    actor.personId,
    conversationIdentity,
    clientTurnId,
  ]);
  return {
    userMessageId: `bm_u_${turnDigest}`,
    brainMessageId: `bm_b_${turnDigest}`,
  };
}

async function actorFrom(
  resolveActor: () => Promise<ActorContext>,
): Promise<ActorContext> {
  try {
    return await resolveActor();
  } catch {
    serviceFail("ACCESS_DENIED");
  }
}

async function storeCall<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof OrganizationBrainConversationStoreError) {
      serviceFail(error.code);
    }
    serviceFail("PERSISTENCE_FAILED");
  }
}

function scalar(value: unknown): boolean {
  return (
    (typeof value === "string" && isWellFormed(value)) ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function filterValue(value: unknown): value is RawPlannerFilterValue {
  if (scalar(value)) return true;
  const array = dataArray(value);
  if (array) return array.every(scalar);
  const reference = dataObject(value, ["actorRef"]);
  return (
    reference !== null &&
    Object.keys(reference).length === 1 &&
    typeof reference.actorRef === "string" &&
    isWellFormed(reference.actorRef)
  );
}

function filters(value: unknown): boolean {
  const array = dataArray(value);
  if (!array) return false;
  return array.every((entry) => {
    const filter = dataObject(entry, ["field", "operator", "value"]);
    return (
      filter !== null &&
      Object.keys(filter).length === 3 &&
      typeof filter.field === "string" &&
      isWellFormed(filter.field) &&
      typeof filter.operator === "string" &&
      isWellFormed(filter.operator) &&
      filterValue(filter.value)
    );
  });
}

function rawPlan(value: unknown): value is RawPlanV1 {
  const plan = dataObject(
    value,
    ["schemaVersion", "resource", "limit"],
    ["filters", "relation", "sort"],
  );
  if (
    !plan ||
    plan.schemaVersion !== 1 ||
    typeof plan.resource !== "string" ||
    !isWellFormed(plan.resource) ||
    typeof plan.limit !== "number" ||
    !Number.isInteger(plan.limit) ||
    plan.limit < 1 ||
    plan.limit > 10
  ) {
    return false;
  }
  if (Object.hasOwn(plan, "filters") && !filters(plan.filters)) return false;
  if (Object.hasOwn(plan, "relation")) {
    const relation = dataObject(plan.relation, ["resource"], ["filters"]);
    if (
      !relation ||
      typeof relation.resource !== "string" ||
      !isWellFormed(relation.resource) ||
      (Object.hasOwn(relation, "filters") && !filters(relation.filters))
    ) {
      return false;
    }
  }
  if (Object.hasOwn(plan, "sort")) {
    const sort = dataArray(plan.sort);
    if (
      !sort ||
      sort.some((entry) => {
        const term = dataObject(entry, ["field", "direction"]);
        return (
          !term ||
          Object.keys(term).length !== 2 ||
          typeof term.field !== "string" ||
          !isWellFormed(term.field) ||
          typeof term.direction !== "string" ||
          !isWellFormed(term.direction)
        );
      })
    ) {
      return false;
    }
  }
  return true;
}

function isActorReference(
  value: RawPlannerFilterValue,
): value is RawPlannerActorReference {
  return typeof value === "object" && !Array.isArray(value);
}

function codePointBefore(value: string, index: number): string {
  if (index === 0) return "";
  const lastCodeUnit = value.charCodeAt(index - 1);
  const startsAt =
    lastCodeUnit >= 0xdc00 &&
    lastCodeUnit <= 0xdfff &&
    index >= 2 &&
    value.charCodeAt(index - 2) >= 0xd800 &&
    value.charCodeAt(index - 2) <= 0xdbff
      ? index - 2
      : index - 1;
  return value.slice(startsAt, index);
}

function codePointAt(value: string, index: number): string {
  const codePoint = value.codePointAt(index);
  return codePoint === undefined ? "" : String.fromCodePoint(codePoint);
}

function questionHasLiteralToken(question: string, literal: string): boolean {
  let index = question.indexOf(literal);
  while (index !== -1) {
    const end = index + literal.length;
    if (
      !OPAQUE_TOKEN_CHARACTER.test(codePointBefore(question, index)) &&
      !OPAQUE_TOKEN_CHARACTER.test(codePointAt(question, end))
    ) {
      return true;
    }
    index = question.indexOf(literal, index + 1);
  }
  return false;
}

function filtersUseOnlyQuestionIds(
  values: readonly RawPlannerFilterV1[] | undefined,
  resource: BrainQueryResource,
  question: string,
): boolean {
  const definition = BRAIN_QUERY_CATALOG[resource];
  for (const filter of values ?? []) {
    if (definition.fields[filter.field]?.type !== "id") continue;
    if (isActorReference(filter.value)) continue;
    const literals = Array.isArray(filter.value) ? filter.value : [filter.value];
    if (
      literals.some(
        (literal) =>
          typeof literal !== "string" ||
          !questionHasLiteralToken(question, literal),
      )
    ) {
      return false;
    }
  }
  return true;
}

function planUsesOnlyQuestionIds(plan: RawPlanV1, question: string): boolean {
  const resource = plan.resource as BrainQueryResource;
  if (!filtersUseOnlyQuestionIds(plan.filters, resource, question)) return false;
  return (
    !plan.relation ||
    filtersUseOnlyQuestionIds(
      plan.relation.filters,
      plan.relation.resource as BrainQueryResource,
      question,
    )
  );
}

function planUsesOnlyProjectedSortFields(plan: RawPlanV1): boolean {
  const definition = BRAIN_QUERY_CATALOG[plan.resource as BrainQueryResource];
  return (plan.sort ?? []).every((term) => {
    const field = definition.fields[term.field];
    return field?.sortable === true && field.type !== "id";
  });
}

function canonicalFilter(filter: RawPlannerFilterV1): string {
  const value =
    filter.operator === "in" && Array.isArray(filter.value)
      ? [...new Set(filter.value.map((entry) => JSON.stringify(entry)))]
          .sort()
          .map((entry) => JSON.parse(entry) as unknown)
      : isActorReference(filter.value)
        ? { actorRef: filter.value.actorRef }
        : filter.value;
  return JSON.stringify({ field: filter.field, operator: filter.operator, value });
}

function canonicalFilters(
  values: readonly RawPlannerFilterV1[] | undefined,
): readonly string[] {
  return [...new Set((values ?? []).map(canonicalFilter))].sort();
}

function canonicalPlan(plan: RawPlanV1): string {
  return JSON.stringify({
    schemaVersion: 1,
    resource: plan.resource,
    filters: canonicalFilters(plan.filters),
    relation: plan.relation
      ? {
          resource: plan.relation.resource,
          filters: canonicalFilters(plan.relation.filters),
        }
      : null,
    sort: (plan.sort ?? []).map((term) => ({
      field: term.field,
      direction: term.direction,
    })),
    page: 1,
    limit: plan.limit,
  });
}

function deepFreezeDependency<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const entry of Object.values(value)) deepFreezeDependency(entry);
  return Object.freeze(value);
}

function plannerResponse(
  value: unknown,
  actor: ActorContext,
  question: string,
): OrganizationBrainQueryPlannerResponse {
  const response = dataObject(value, [
    "schemaVersion",
    "status",
    "code",
    "plans",
  ]);
  const plans = response ? dataArray(response.plans) : null;
  if (
    !response ||
    Object.keys(response).length !== 4 ||
    response.schemaVersion !== 1 ||
    !plans ||
    plans.some((plan) => !rawPlan(plan))
  ) {
    throw new DependencyResponseInvalid();
  }
  const status = response.status;
  const code = response.code;
  const valid =
    (status === "PLANNED" &&
      code === "PLANNED" &&
      plans.length >= 1 &&
      plans.length <= 3) ||
    (status === "NO_PLAN" && code === "NO_SUPPORTED_PLAN" && plans.length === 0) ||
    (status === "UNAVAILABLE" &&
      typeof code === "string" &&
      PROVIDER_CODE_SET.has(code) &&
      plans.length === 0) ||
    (status === "REJECTED" &&
      typeof code === "string" &&
      PLANNER_REJECTED_CODE_SET.has(code) &&
      plans.length === 0);
  if (!valid) throw new DependencyResponseInvalid();

  if (status === "PLANNED") {
    let serialized: string;
    try {
      serialized = JSON.stringify({ schemaVersion: 1, plans });
    } catch {
      throw new DependencyResponseInvalid();
    }
    if (utf8Bytes(serialized) > MAX_PLANNER_OUTPUT_BYTES) {
      throw new DependencyResponseInvalid();
    }

    let totalRows = 0;
    let totalCost = 0;
    const canonicalPlans = new Set<string>();
    for (const plan of plans as readonly RawPlanV1[]) {
      try {
        const parsed = parseBrainQueryPlan(plan, actor);
        if (
          !planUsesOnlyProjectedSortFields(plan) ||
          !planUsesOnlyQuestionIds(plan, question)
        ) {
          throw new DependencyResponseInvalid();
        }
        totalRows += parsed.limit;
        totalCost += parsed.estimatedCost;
      } catch {
        throw new DependencyResponseInvalid();
      }
      const canonical = canonicalPlan(plan);
      if (canonicalPlans.has(canonical)) throw new DependencyResponseInvalid();
      canonicalPlans.add(canonical);
    }
    if (
      totalRows > MAX_TOTAL_PLANNED_ROWS ||
      totalCost > MAX_TOTAL_PLANNED_COST
    ) {
      throw new DependencyResponseInvalid();
    }
  }

  try {
    return deepFreezeDependency(
      structuredClone({ schemaVersion: 1, status, code, plans }),
    ) as OrganizationBrainQueryPlannerResponse;
  } catch {
    throw new DependencyResponseInvalid();
  }
}

function emptyResponse(
  status: StoredOrganizationBrainResponse["status"],
  code: string,
  message: string,
): StoredOrganizationBrainResponse {
  return normalizeOrganizationBrainResponse({
    schemaVersion: 1,
    status,
    code,
    message,
    facts: [],
    inferences: [],
    recommendations: [],
    missingEvidence: [],
    sources: [],
  });
}

function plannerFailure(code: "PLANNER_EXECUTION_FAILED" | "PLANNER_RESPONSE_INVALID") {
  return emptyResponse("FAILED", code, MESSAGES.plannerFailed);
}

function queryFailure(code: string): StoredOrganizationBrainResponse {
  return emptyResponse("FAILED", code, MESSAGES.queryFailed);
}

function capabilityHelpResponse(question: string): StoredOrganizationBrainResponse | null {
  const normalized = question.trim().replace(/\s+/g, "");
  if (
    !(
      /^(你|组织大脑).*(可以|能|会).*(回答|查询|做|帮助)/u.test(normalized) ||
      /^(可以问|能问|支持).*(什么|哪些|问题|查询|能力)/u.test(normalized) ||
      /^(你|组织大脑).*(支持).*(什么|哪些|问题|查询|能力)/u.test(normalized)
    )
  ) {
    return null;
  }

  return normalizeOrganizationBrainResponse({
    schemaVersion: 1,
    status: "ANSWERED",
    code: "CAPABILITY_HELP",
    message: ORGANIZATION_BRAIN_CAPABILITY_HELP_MESSAGE,
    facts: [],
    inferences: [],
    recommendations: [],
    missingEvidence: [],
    sources: [],
  });
}

function memoryQueryText(question: string): string | null {
  let result = "";
  for (const character of question) {
    if (utf8Bytes(result + character) > MAX_MEMORY_QUERY_BYTES) break;
    result += character;
  }
  const trimmed = result.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function brokerFailure(error: unknown): StoredOrganizationBrainResponse {
  if (!(error instanceof OrganizationBrainQueryError)) {
    return queryFailure("QUERY_EXECUTION_FAILED");
  }
  if (PLAN_REJECTION_SET.has(error.code)) {
    return emptyResponse("REJECTED", error.code, MESSAGES.queryRejected);
  }
  if (error.code === "INVALID_INVOCATION") {
    return emptyResponse("DENIED", "ACCESS_DENIED", MESSAGES.denied);
  }
  if (BROKER_FAILURE_SET.has(error.code)) return queryFailure(error.code);
  return queryFailure("QUERY_EXECUTION_FAILED");
}

function isResource(value: unknown): value is BrainQueryResource {
  return typeof value === "string" && RESOURCE_SET.has(value);
}

function isCanonicalVersion(resource: BrainQueryResource, value: unknown): value is string {
  if (typeof value !== "string" || !isWellFormed(value)) return false;
  if (resource === "meetingDrafts") return NOTES_REVISION.test(value);
  if (NOTES_REVISION.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function isLocalApplicationUrl(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" &&
      isWellFormed(value) &&
      utf8Bytes(value) <= MAX_APPLICATION_URL_BYTES &&
      value.startsWith("/") &&
      !value.startsWith("//") &&
      !/[\\\s\u0000-\u001f\u007f]/.test(value))
  );
}

function expectedEvidenceId(
  actor: ActorContext,
  resource: BrainQueryResource,
  recordId: string,
): string {
  return `ev_${createHash("sha256")
    .update(actor.organizationId)
    .update("\0")
    .update(resource)
    .update("\0")
    .update(recordId)
    .digest("hex")}`;
}

function evidencePacket(value: unknown, actor: ActorContext): BrainEvidencePacket {
  const packet = dataObject(value, [
    "evidenceId",
    "source",
    "display",
    "truncatedFields",
    "applicationUrl",
  ]);
  const source = packet
    ? dataObject(packet.source, ["resource", "recordId", "version"])
    : null;
  if (
    !packet ||
    Object.keys(packet).length !== 5 ||
    !source ||
    Object.keys(source).length !== 3 ||
    typeof packet.evidenceId !== "string" ||
    !EVIDENCE_ID.test(packet.evidenceId) ||
    !isResource(source.resource) ||
    typeof source.recordId !== "string" ||
    !source.recordId ||
    !isWellFormed(source.recordId) ||
    utf8Bytes(source.recordId) > MAX_RECORD_ID_BYTES ||
    !isCanonicalVersion(source.resource, source.version) ||
    !isLocalApplicationUrl(packet.applicationUrl)
  ) {
    throw new DependencyResponseInvalid();
  }

  const resource = source.resource;
  if (packet.evidenceId !== expectedEvidenceId(actor, resource, source.recordId)) {
    throw new DependencyResponseInvalid();
  }
  const definition = BRAIN_QUERY_CATALOG[resource];
  const rawDisplay = dataObject(packet.display, definition.displayFields);
  const rawTruncatedFields = dataArray(packet.truncatedFields);
  if (!rawDisplay || !rawTruncatedFields) throw new DependencyResponseInvalid();

  const display: Record<string, string> = {};
  let displayBytes = 0;
  for (const field of definition.displayFields) {
    const displayValue = rawDisplay[field];
    if (
      typeof displayValue !== "string" ||
      !isWellFormed(displayValue) ||
      utf8Bytes(displayValue) > MAX_DISPLAY_VALUE_BYTES
    ) {
      throw new DependencyResponseInvalid();
    }
    display[field] = displayValue;
    displayBytes += utf8Bytes(displayValue);
  }
  if (displayBytes > MAX_PACKET_DISPLAY_BYTES) {
    throw new DependencyResponseInvalid();
  }

  if (
    rawTruncatedFields.some(
      (field) =>
        typeof field !== "string" ||
        !definition.displayFields.includes(field),
    ) ||
    new Set(rawTruncatedFields).size !== rawTruncatedFields.length
  ) {
    throw new DependencyResponseInvalid();
  }
  const truncatedFields = definition.displayFields.filter((field) =>
    rawTruncatedFields.includes(field),
  );

  return Object.freeze({
    evidenceId: packet.evidenceId,
    source: Object.freeze({
      resource,
      recordId: source.recordId,
      version: source.version,
    }),
    display: Object.freeze(display),
    truncatedFields: Object.freeze(truncatedFields),
    applicationUrl: packet.applicationUrl,
  });
}

function queryResult(
  value: unknown,
  actor: ActorContext,
  maximumPackets: number,
): OrganizationBrainQueryResult {
  const result = dataObject(value, ["packets", "hasMore"]);
  const packets = result ? dataArray(result.packets) : null;
  if (
    !result ||
    Object.keys(result).length !== 2 ||
    !packets ||
    typeof result.hasMore !== "boolean" ||
    packets.length > maximumPackets ||
    (result.hasMore && packets.length !== maximumPackets)
  ) {
    throw new DependencyResponseInvalid();
  }
  return Object.freeze({
    packets: Object.freeze(packets.map((packet) => evidencePacket(packet, actor))),
    hasMore: result.hasMore,
  });
}

function canonicalEvidencePacket(packet: BrainEvidencePacket): string {
  const displayFields = BRAIN_QUERY_CATALOG[packet.source.resource].displayFields;
  return JSON.stringify([
    packet.evidenceId,
    [packet.source.resource, packet.source.recordId, packet.source.version],
    displayFields.map((field) => [field, packet.display[field]]),
    packet.truncatedFields,
    packet.applicationUrl,
  ]);
}

function deduplicateEvidence(
  results: readonly OrganizationBrainQueryResult[],
): Readonly<{ packets: readonly BrainEvidencePacket[]; hasMore: boolean }> | null {
  const packets: BrainEvidencePacket[] = [];
  const serializedById = new Map<string, string>();
  for (const result of results) {
    for (const packet of result.packets) {
      const serialized = canonicalEvidencePacket(packet);
      const prior = serializedById.get(packet.evidenceId);
      if (prior === undefined) {
        serializedById.set(packet.evidenceId, serialized);
        packets.push(packet);
      } else if (prior !== serialized) {
        return null;
      }
    }
  }
  return {
    packets: Object.freeze(packets),
    hasMore: results.some((result) => result.hasMore),
  };
}

function sourceMatchesPacket(
  source: StoredOrganizationBrainResponse["sources"][number],
  packet: BrainEvidencePacket,
): boolean {
  return (
    source.evidenceId === packet.evidenceId &&
    source.resource === packet.source.resource &&
    source.recordId === packet.source.recordId &&
    source.version === packet.source.version &&
    source.applicationUrl === packet.applicationUrl
  );
}

function factMatchesPacket(
  fact: StoredOrganizationBrainResponse["facts"][number],
  packet: BrainEvidencePacket,
  requireEveryDisplayField: boolean,
): boolean {
  if (
    fact.evidenceId !== packet.evidenceId ||
    fact.resource !== packet.source.resource ||
    fact.sourceVersion !== packet.source.version ||
    fact.recordId !== packet.source.recordId ||
    fact.applicationUrl !== packet.applicationUrl
  ) {
    return false;
  }
  const truncated = new Set(packet.truncatedFields);
  if (
    fact.fields.some(
      (field) =>
        !Object.hasOwn(packet.display, field.name) ||
        field.value !== packet.display[field.name] ||
        field.truncated !== truncated.has(field.name),
    )
  ) {
    return false;
  }
  if (!requireEveryDisplayField) return true;
  const displayFields = Object.keys(packet.display);
  return (
    fact.fields.length === displayFields.length &&
    fact.fields.every((field, index) => field.name === displayFields[index])
  );
}

function evidenceOnlyFromPackets(
  code:
    | "PROVIDER_UNAVAILABLE"
    | "PROVIDER_TIMEOUT"
    | "PROVIDER_FAILURE"
    | "OUTPUT_SCHEMA_INVALID",
  packets: readonly BrainEvidencePacket[],
  hasMore: boolean,
  confirmedMemory: readonly SharedMemoryEntry[] = [],
): StoredOrganizationBrainResponse {
  const memory = confirmedMemory.map(confirmedMemoryFromSharedEntry);
  return normalizeOrganizationBrainResponse({
    schemaVersion: 1,
    status: "EVIDENCE_ONLY",
    code,
    message: "模型回答不可用，以下仅展示已授权证据中的确定事实。",
    ...(memory.length > 0 ? { confirmedMemory: memory } : {}),
    facts: packets.map((packet) => {
      const truncated = new Set(packet.truncatedFields);
      return {
        label: ORGANIZATION_BRAIN_SECTION_LABELS.fact,
        evidenceId: packet.evidenceId,
        resource: packet.source.resource,
        resourceLabel: ORGANIZATION_BRAIN_RESOURCE_LABELS[packet.source.resource],
        sourceVersion: packet.source.version,
        recordId: packet.source.recordId,
        applicationUrl: packet.applicationUrl,
        fields: BRAIN_QUERY_CATALOG[packet.source.resource].displayFields.map(
          (name) => ({
            name,
            label: ORGANIZATION_BRAIN_FIELD_LABELS[name]!,
            value: packet.display[name]!,
            truncated: truncated.has(name),
          }),
        ),
      };
    }),
    inferences: [],
    recommendations: [],
    missingEvidence: hasMore
      ? [{
          label: ORGANIZATION_BRAIN_SECTION_LABELS.missingEvidence,
          text: TRUNCATION_MISSING_EVIDENCE,
        }]
      : [],
    sources: packets.map((packet) => ({
      label: ORGANIZATION_BRAIN_SECTION_LABELS.source,
      evidenceId: packet.evidenceId,
      resource: packet.source.resource,
      resourceLabel: ORGANIZATION_BRAIN_RESOURCE_LABELS[packet.source.resource],
      recordId: packet.source.recordId,
      version: packet.source.version,
      applicationUrl: packet.applicationUrl,
    })),
  });
}

function memoryOnlyFromEntries(
  confirmedMemory: readonly SharedMemoryEntry[],
): StoredOrganizationBrainResponse {
  return normalizeOrganizationBrainResponse({
    schemaVersion: 1,
    status: "ANSWERED",
    code: "ANSWERED",
    message: "已基于授权证据生成回答。",
    confirmedMemory: confirmedMemory.map(confirmedMemoryFromSharedEntry),
    facts: [],
    inferences: [],
    recommendations: [],
    missingEvidence: [],
    sources: [],
  });
}

function withTruncationMarker(
  response: StoredOrganizationBrainResponse,
  hasMore: boolean,
): StoredOrganizationBrainResponse {
  if (!hasMore) return response;
  return normalizeOrganizationBrainResponse({
    ...response,
    missingEvidence: [
      ...response.missingEvidence
        .filter((item) => item.text !== TRUNCATION_MISSING_EVIDENCE)
        .slice(0, 5),
      {
        label: ORGANIZATION_BRAIN_SECTION_LABELS.missingEvidence,
        text: TRUNCATION_MISSING_EVIDENCE,
      },
    ],
  });
}

function reasonerTimedOut(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.name === "AbortError" ||
      error.name === "TimeoutError" ||
      /timeout|timed out/i.test(error.message))
  );
}

function acceptedReasonerResponse(
  value: unknown,
  packets: readonly BrainEvidencePacket[],
  confirmedMemory: readonly SharedMemoryEntry[],
): StoredOrganizationBrainResponse {
  const response = normalizeOrganizationBrainResponse(value);
  const expectedMemory = confirmedMemory.map(confirmedMemoryFromSharedEntry);
  if (
    JSON.stringify(response.confirmedMemory ?? []) !==
      JSON.stringify(expectedMemory)
  ) {
    throw new DependencyResponseInvalid();
  }
  if (
    response.status === "UNAVAILABLE" ||
    response.status === "FAILED" ||
    response.status === "DENIED" ||
    !D1_CODE_SET.has(response.code)
  ) {
    throw new DependencyResponseInvalid();
  }

  if (response.status === "INSUFFICIENT_EVIDENCE") {
    if (response.code !== "NO_AUTHORIZED_EVIDENCE" || packets.length !== 0) {
      throw new DependencyResponseInvalid();
    }
    return response;
  }
  if (response.status === "REJECTED") {
    if (
      response.code !== "EVIDENCE_LIMIT_EXCEEDED" &&
      response.code !== "PROMPT_LIMIT_EXCEEDED"
    ) {
      throw new DependencyResponseInvalid();
    }
    return response;
  }
  if (
    packets.length === 0 ||
    response.sources.length !== packets.length ||
    response.sources.some(
      (source, index) => !sourceMatchesPacket(source, packets[index]!),
    )
  ) {
    throw new DependencyResponseInvalid();
  }
  const packetsById = new Map(packets.map((packet) => [packet.evidenceId, packet]));
  if (response.status === "ANSWERED") {
    if (
      response.facts.some((fact) => {
        const packet = packetsById.get(fact.evidenceId);
        return !packet || !factMatchesPacket(fact, packet, false);
      })
    ) {
      throw new DependencyResponseInvalid();
    }
    return response;
  }
  if (
    response.inferences.length > 0 ||
    response.recommendations.length > 0 ||
    response.missingEvidence.length > 0 ||
    response.facts.length !== packets.length ||
    response.facts.some(
      (fact, index) => !factMatchesPacket(fact, packets[index]!, true),
    )
  ) {
    throw new DependencyResponseInvalid();
  }
  return response;
}

function turnResult(
  conversationIdentity: string,
  userMessageId: string,
  brainMessageId: string,
  result: StoredOrganizationBrainResponse,
): OrganizationBrainTurnResult {
  return Object.freeze({
    schemaVersion: 1 as const,
    conversationId: conversationIdentity,
    userMessageId,
    brainMessageId,
    result,
  });
}

export function createOrganizationBrainTurnService(
  dependencies: OrganizationBrainTurnServiceDependencies,
): OrganizationBrainTurnService {
  const inFlight = new Map<
    string,
    Readonly<{
      question: string;
      promise: Promise<OrganizationBrainTurnResult>;
    }>
  >();

  async function complete(
    actor: ActorContext,
    conversationIdentity: string,
    userMessageId: string,
    brainMessageId: string,
    proposed: StoredOrganizationBrainResponse,
  ): Promise<OrganizationBrainTurnResult> {
    const result = await storeCall(() =>
      dependencies.store.complete(actor, {
        conversationId: conversationIdentity,
        userMessageId,
        brainMessageId,
        result: proposed,
      }),
    );
    return turnResult(
      conversationIdentity,
      userMessageId,
      brainMessageId,
      result,
    );
  }

  async function executeClaimedTurn(
    actor: ActorContext,
    input: Readonly<{ conversationId: string; question: string }>,
    ids: Readonly<{ userMessageId: string; brainMessageId: string }>,
  ): Promise<OrganizationBrainTurnResult> {
    const claim = await storeCall(() =>
      dependencies.store.claim(actor, {
        conversationId: input.conversationId,
        userMessageId: ids.userMessageId,
        brainMessageId: ids.brainMessageId,
        question: input.question,
      }),
    );
    if (claim.terminal) {
      return turnResult(
        input.conversationId,
        ids.userMessageId,
        ids.brainMessageId,
        claim.terminal,
      );
    }

    const helpResponse = capabilityHelpResponse(input.question);
    if (helpResponse) {
      return complete(
        actor,
        input.conversationId,
        ids.userMessageId,
        ids.brainMessageId,
        helpResponse,
      );
    }

    let confirmedMemory: readonly SharedMemoryEntry[];
    try {
      confirmedMemory = await dependencies.retrieveMemory(actor, {
        schemaVersion: 1,
        text: memoryQueryText(input.question),
        limit: MEMORY_RETRIEVAL_LIMIT,
      });
    } catch {
      return complete(
        actor,
        input.conversationId,
        ids.userMessageId,
        ids.brainMessageId,
        queryFailure("QUERY_EXECUTION_FAILED"),
      );
    }

    let plannedRaw: unknown;
    try {
      plannedRaw = await dependencies.plan(actor, {
        schemaVersion: 1,
        question: input.question,
      });
    } catch {
      return complete(
        actor,
        input.conversationId,
        ids.userMessageId,
        ids.brainMessageId,
        plannerFailure("PLANNER_EXECUTION_FAILED"),
      );
    }

    let planned: OrganizationBrainQueryPlannerResponse;
    try {
      planned = plannerResponse(plannedRaw, actor, input.question);
    } catch {
      return complete(
        actor,
        input.conversationId,
        ids.userMessageId,
        ids.brainMessageId,
        plannerFailure("PLANNER_RESPONSE_INVALID"),
      );
    }

    if (planned.status === "NO_PLAN") {
      return complete(
        actor,
        input.conversationId,
        ids.userMessageId,
        ids.brainMessageId,
        confirmedMemory.length > 0
          ? memoryOnlyFromEntries(confirmedMemory)
          : emptyResponse(
              "INSUFFICIENT_EVIDENCE",
              "NO_SUPPORTED_PLAN",
              MESSAGES.noPlan,
            ),
      );
    }
    if (planned.status === "UNAVAILABLE") {
      return complete(
        actor,
        input.conversationId,
        ids.userMessageId,
        ids.brainMessageId,
        confirmedMemory.length > 0
          ? memoryOnlyFromEntries(confirmedMemory)
          : emptyResponse(
              "UNAVAILABLE",
              planned.code,
              MESSAGES.plannerUnavailable,
            ),
      );
    }
    if (planned.status === "REJECTED") {
      return complete(
        actor,
        input.conversationId,
        ids.userMessageId,
        ids.brainMessageId,
        emptyResponse("REJECTED", planned.code, MESSAGES.plannerRejected),
      );
    }

    const queryResults: OrganizationBrainQueryResult[] = [];
    for (const plan of planned.plans) {
      try {
        queryResults.push(
          queryResult(
            await dependencies.executeQuery(
              actor,
              input.conversationId,
              ids.userMessageId,
              plan,
            ),
            actor,
            plan.limit,
          ),
        );
      } catch (error) {
        return complete(
          actor,
          input.conversationId,
          ids.userMessageId,
          ids.brainMessageId,
          error instanceof DependencyResponseInvalid
            ? queryFailure("QUERY_EXECUTION_FAILED")
            : brokerFailure(error),
        );
      }
    }

    let evidence: ReturnType<typeof deduplicateEvidence> | undefined;
    try {
      evidence = deduplicateEvidence(queryResults);
    } catch {
      evidence = undefined;
    }
    if (evidence === null) {
      return complete(
        actor,
        input.conversationId,
        ids.userMessageId,
        ids.brainMessageId,
        emptyResponse("FAILED", "EVIDENCE_CONFLICT", MESSAGES.evidenceConflict),
      );
    }
    if (evidence === undefined) {
      return complete(
        actor,
        input.conversationId,
        ids.userMessageId,
        ids.brainMessageId,
        queryFailure("QUERY_EXECUTION_FAILED"),
      );
    }

    let reasonedRaw: unknown;
    try {
      reasonedRaw = await dependencies.reason({
        schemaVersion: 1,
        question: input.question,
        confirmedMemory,
        evidence: {
          status: "AUTHORIZED",
          packets: evidence.packets,
          hasMore: evidence.hasMore,
        },
      });
    } catch (error) {
      return complete(
        actor,
        input.conversationId,
        ids.userMessageId,
        ids.brainMessageId,
        evidence.packets.length > 0
          ? evidenceOnlyFromPackets(
              reasonerTimedOut(error) ? "PROVIDER_TIMEOUT" : "PROVIDER_FAILURE",
              evidence.packets,
              evidence.hasMore,
              confirmedMemory,
            )
          : confirmedMemory.length > 0
          ? memoryOnlyFromEntries(confirmedMemory)
          : emptyResponse(
              "FAILED",
              "REASONER_EXECUTION_FAILED",
              MESSAGES.reasonerFailed,
            ),
      );
    }
    let reasoned: StoredOrganizationBrainResponse;
    try {
      reasoned = withTruncationMarker(
        acceptedReasonerResponse(reasonedRaw, evidence.packets, confirmedMemory),
        evidence.hasMore,
      );
    } catch {
      reasoned = evidence.packets.length > 0
        ? evidenceOnlyFromPackets(
            "OUTPUT_SCHEMA_INVALID",
            evidence.packets,
            evidence.hasMore,
            confirmedMemory,
          )
        : confirmedMemory.length > 0
        ? memoryOnlyFromEntries(confirmedMemory)
        : emptyResponse(
            "FAILED",
            "REASONER_RESPONSE_INVALID",
            MESSAGES.reasonerFailed,
          );
    }
    return complete(
      actor,
      input.conversationId,
      ids.userMessageId,
      ids.brainMessageId,
      reasoned,
    );
  }

  return Object.freeze({
    createConversation: async (input) => {
      const clientConversationId = parseCreateInput(input);
      const actor = await actorFrom(dependencies.resolveActor);
      return storeCall(() =>
        dependencies.store.create(actor, {
          conversationId: conversationId(actor, clientConversationId),
        }),
      );
    },

    listConversations: async (input) => {
      const limit = parseListInput(input);
      const actor = await actorFrom(dependencies.resolveActor);
      return storeCall(() => dependencies.store.list(actor, { limit }));
    },

    loadConversation: async (input) => {
      const parsed = parseLoadInput(input);
      const actor = await actorFrom(dependencies.resolveActor);
      return storeCall(() => dependencies.store.load(actor, parsed));
    },

    executeTurn: async (input) => {
      const parsed = parseTurnInput(input);
      const actor = await actorFrom(dependencies.resolveActor);
      const ids = turnIds(actor, parsed.conversationId, parsed.clientTurnId);
      const existing = inFlight.get(ids.userMessageId);
      if (existing) {
        if (existing.question !== parsed.question) {
          serviceFail("IDEMPOTENCY_CONFLICT");
        }
        return existing.promise;
      }

      const promise = executeClaimedTurn(actor, parsed, ids);
      inFlight.set(ids.userMessageId, { question: parsed.question, promise });
      try {
        return await promise;
      } finally {
        if (inFlight.get(ids.userMessageId)?.promise === promise) {
          inFlight.delete(ids.userMessageId);
        }
      }
    },
  });
}

const productionService = createOrganizationBrainTurnService({
  resolveActor: resolveActorContext,
  store: organizationBrainConversationStore,
  plan: async (actor, input) => {
    const governanceConfig = await getOrganizationGovernanceConfig(actor.organizationId);
    const config = await resolveOrganizationAIConfig(actor.organizationId);
    const brainConfig = { configVersion: governanceConfig.version, terminology: governanceConfig.terminology, governanceRules: governanceConfig.rules };
    if (!config) return planOrganizationQuestion(actor, input, brainConfig);
    return createOrganizationBrainQueryPlanner({
      isAvailable: () => isAIConfigAvailable(config),
      generate: ({ system, prompt, temperature, maxTokens, timeoutMs, maxRetries }) =>
        askAIWithConfig(system, prompt, config, {
          temperature,
          maxTokens,
          timeoutMs,
          maxRetries,
        }),
    })(actor, input, brainConfig);
  },
  executeQuery: executeOrganizationBrainQuery,
  reason: reasonOrganizationQuestion,
  retrieveMemory: async (_actor, input) => retrieveSharedMemory(input),
});

export function createOrganizationBrainConversation(
  input: OrganizationBrainConversationCreateInput,
): Promise<OrganizationBrainConversationSummary> {
  return productionService.createConversation(input);
}

export function listOrganizationBrainConversations(
  input: OrganizationBrainConversationListInput,
): Promise<OrganizationBrainConversationList> {
  return productionService.listConversations(input);
}

export function loadOrganizationBrainConversation(
  input: OrganizationBrainConversationLoadInput,
): Promise<OrganizationBrainConversationDetail> {
  return productionService.loadConversation(input);
}

export function executeOrganizationBrainTurn(
  input: OrganizationBrainTurnInput,
): Promise<OrganizationBrainTurnResult> {
  return productionService.executeTurn(input);
}
