import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

import type { ActorContext } from "../authorization/actor-context-resolver";
import {
  BRAIN_QUERY_CATALOG,
  BRAIN_QUERY_RESOURCES,
  type BrainQueryResource,
} from "./query-plan";
import {
  ORGANIZATION_BRAIN_CAPABILITY_HELP_MESSAGE,
  ORGANIZATION_BRAIN_FIELD_LABELS,
  ORGANIZATION_BRAIN_RESOURCE_LABELS,
  ORGANIZATION_BRAIN_SECTION_LABELS,
  type OrganizationBrainConfirmedMemory,
  type OrganizationBrainFact,
  type OrganizationBrainMissingEvidence,
  type OrganizationBrainNarrative,
  type OrganizationBrainResponse,
  type OrganizationBrainSource,
} from "./response-schema";

const CONVERSATION_ID = /^bc_[a-f0-9]{64}$/;
const USER_MESSAGE_ID = /^bm_u_[a-f0-9]{64}$/;
const BRAIN_MESSAGE_ID = /^bm_b_[a-f0-9]{64}$/;
const EVIDENCE_ID = /^ev_[a-f0-9]{64}$/;
const RESOURCE_SET = new Set<string>(BRAIN_QUERY_RESOURCES);

const D1_RESPONSE_CODES = Object.freeze([
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
] as const);

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

const PLANNER_REJECTION_CODES = Object.freeze([
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
] as const);

const FAILED_CODES = Object.freeze([
  "EVIDENCE_CONFLICT",
  "PLANNER_EXECUTION_FAILED",
  "PLANNER_RESPONSE_INVALID",
  "QUERY_EXECUTION_FAILED",
  "REASONER_EXECUTION_FAILED",
  "REASONER_RESPONSE_INVALID",
  "AUDIT_FAILED",
  "QUERY_TIMEOUT",
  "DATABASE_POLICY_MISMATCH",
  "DATABASE_UNAVAILABLE",
  "ROW_SHAPE_MISMATCH",
  "DATABASE_EXECUTION_FAILED",
] as const);

const ALL_RESPONSE_CODES = new Set<string>([
  ...D1_RESPONSE_CODES,
  "CAPABILITY_HELP",
  "NO_SUPPORTED_PLAN",
  "PLAN_COUNT_EXCEEDED",
  "PLAN_LIMIT_EXCEEDED",
  "TOTAL_ROW_LIMIT_EXCEEDED",
  "TOTAL_COST_LIMIT_EXCEEDED",
  "DUPLICATE_PLAN",
  ...PLAN_REJECTION_CODES,
  ...FAILED_CODES,
]);
const PLANNER_REJECTION_SET = new Set<string>(PLANNER_REJECTION_CODES);
const PLAN_REJECTION_SET = new Set<string>(PLAN_REJECTION_CODES);
const FAILED_CODE_SET = new Set<string>(FAILED_CODES);
const PROVIDER_CODE_SET = new Set<string>([
  "PROVIDER_UNAVAILABLE",
  "PROVIDER_TIMEOUT",
  "PROVIDER_FAILURE",
]);
const EVIDENCE_ONLY_CODE_SET = new Set<string>([
  ...PROVIDER_CODE_SET,
  "OUTPUT_LIMIT_EXCEEDED",
  "OUTPUT_SCHEMA_INVALID",
  "CITATION_INVALID",
  "UNSUPPORTED_FACT",
]);
const D1_REJECTION_CODE_SET = new Set<string>([
  "INVALID_QUESTION",
  "QUESTION_LIMIT_EXCEEDED",
  "INVALID_EVIDENCE",
  "EVIDENCE_LIMIT_EXCEEDED",
  "PROMPT_LIMIT_EXCEEDED",
]);

const MESSAGES = Object.freeze({
  answered: "已基于授权证据生成回答。",
  evidenceOnly: "模型回答不可用，以下仅展示已授权证据中的确定事实。",
  noEvidence: "当前没有可用于回答该问题的授权证据。",
  reasonerRejected: "请求不符合组织大脑推理契约。",
  denied: "无法提供该问题的组织信息。",
  noPlan: "当前问题无法转换为受支持的组织查询。",
  plannerUnavailable: "组织大脑规划服务暂时不可用。",
  plannerRejected: "当前问题无法通过受限查询规划校验。",
  plannerFailed: "组织大脑查询规划失败。",
  queryRejected: "查询计划未通过组织数据访问校验。",
  queryFailed: "组织数据查询暂时失败。",
  evidenceConflict: "授权证据出现冲突，无法生成可靠回答。",
  reasonerFailed: "组织大脑推理暂时失败。",
} as const);

export type StoredOrganizationBrainStatus =
  | OrganizationBrainResponse["status"]
  | "UNAVAILABLE"
  | "FAILED";

export type StoredOrganizationBrainResponse = Readonly<{
  schemaVersion: 1;
  status: StoredOrganizationBrainStatus;
  code: string;
  message: string;
  confirmedMemory?: readonly OrganizationBrainConfirmedMemory[];
  facts: readonly OrganizationBrainFact[];
  inferences: readonly OrganizationBrainNarrative[];
  recommendations: readonly OrganizationBrainNarrative[];
  missingEvidence: readonly OrganizationBrainMissingEvidence[];
  sources: readonly OrganizationBrainSource[];
}>;

export type OrganizationBrainConversationSummary = Readonly<{
  schemaVersion: 1;
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
}>;

export type OrganizationBrainConversationList = Readonly<{
  schemaVersion: 1;
  conversations: readonly OrganizationBrainConversationSummary[];
}>;

export type OrganizationBrainConversationMessage =
  | Readonly<{
      id: string;
      role: "USER";
      content: string;
      createdAt: string;
      updatedAt: string;
    }>
  | Readonly<{
      id: string;
      role: "BRAIN";
      result: StoredOrganizationBrainResponse;
      createdAt: string;
      updatedAt: string;
    }>;

export type OrganizationBrainConversationDetail = Readonly<{
  schemaVersion: 1;
  conversation: OrganizationBrainConversationSummary;
  messages: readonly OrganizationBrainConversationMessage[];
  hasMore: boolean;
}>;

export type OrganizationBrainConversationStoreErrorCode =
  | "ACCESS_DENIED"
  | "IDEMPOTENCY_CONFLICT"
  | "PERSISTENCE_FAILED"
  | "STORED_RESPONSE_INVALID";

export class OrganizationBrainConversationStoreError extends Error {
  constructor(public readonly code: OrganizationBrainConversationStoreErrorCode) {
    super(`Organization Brain conversation store failed: ${code}`);
    this.name = "OrganizationBrainConversationStoreError";
  }
}

export type OrganizationBrainConversationStore = Readonly<{
  create(
    actor: ActorContext,
    input: Readonly<{ conversationId: string }>,
  ): Promise<OrganizationBrainConversationSummary>;
  list(
    actor: ActorContext,
    input: Readonly<{ limit: number }>,
  ): Promise<OrganizationBrainConversationList>;
  load(
    actor: ActorContext,
    input: Readonly<{ conversationId: string; messageLimit: number }>,
  ): Promise<OrganizationBrainConversationDetail>;
  claim(
    actor: ActorContext,
    input: Readonly<{
      conversationId: string;
      userMessageId: string;
      brainMessageId: string;
      question: string;
    }>,
  ): Promise<Readonly<{ terminal: StoredOrganizationBrainResponse | null }>>;
  complete(
    actor: ActorContext,
    input: Readonly<{
      conversationId: string;
      userMessageId: string;
      brainMessageId: string;
      result: StoredOrganizationBrainResponse;
    }>,
  ): Promise<StoredOrganizationBrainResponse>;
}>;

type PlainObject = Record<string, unknown>;
const RESPONSE_BASE_KEYS = Object.freeze([
  "schemaVersion",
  "status",
  "code",
  "message",
  "facts",
  "inferences",
  "recommendations",
  "missingEvidence",
  "sources",
] as const);
const RESPONSE_MEMORY_KEYS = Object.freeze([
  "schemaVersion",
  "status",
  "code",
  "message",
  "confirmedMemory",
  "facts",
  "inferences",
  "recommendations",
  "missingEvidence",
  "sources",
] as const);
const MEMORY_ROUTE_KINDS = new Set([
  "GOAL_STRATEGY",
  "GOVERNANCE",
  "TACTICAL",
  "MEETING_RECORD",
  "TENSION",
]);
const MEMORY_SOURCE_TYPES = new Set([
  "goal",
  "target",
  "circle",
  "role",
  "accountability",
  "domain",
  "policy",
  "project",
  "action",
  "meeting",
  "decision",
  "tension",
  "unknown",
]);

function fail(code: OrganizationBrainConversationStoreErrorCode): never {
  throw new OrganizationBrainConversationStoreError(code);
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

function exactObject(value: unknown, keys: readonly string[]): PlainObject {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== keys.length ||
    ownKeys.some((key) => typeof key !== "string") ||
    keys.some((key) => !ownKeys.includes(key))
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail("STORED_RESPONSE_INVALID");
    }
  }
  return value as PlainObject;
}

function exactArray(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    fail("STORED_RESPONSE_INVALID");
  }
  const ownKeys = Reflect.ownKeys(value);
  if (
    ownKeys.length !== value.length + 1 ||
    !ownKeys.includes("length") ||
    ownKeys.some(
      (key) =>
        typeof key !== "string" ||
        (key !== "length" && !/^(?:0|[1-9]\d*)$/.test(key)),
    )
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  for (let index = 0; index < value.length; index += 1) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
    if (!descriptor?.enumerable || !("value" in descriptor)) {
      fail("STORED_RESPONSE_INVALID");
    }
  }
  return value;
}

function exactString(value: unknown, allowEmpty = false): string {
  if (
    typeof value !== "string" ||
    !isWellFormed(value) ||
    (!allowEmpty && value.length === 0)
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  return value;
}

function localApplicationUrl(value: unknown): string | null {
  if (value === null) return null;
  const url = exactString(value);
  if (
    utf8Bytes(url) > 2_048 ||
    !url.startsWith("/") ||
    url.startsWith("//") ||
    /[\\\s\u0000-\u001f\u007f]/.test(url)
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  return url;
}

function appApplicationUrl(value: unknown): string {
  const url = exactString(value);
  if (
    utf8Bytes(url) > 2_048 ||
    !url.startsWith("/app/") ||
    url.startsWith("//") ||
    /[\\\s\u0000-\u001f\u007f]/.test(url)
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  return url;
}

function resource(value: unknown): BrainQueryResource {
  const candidate = exactString(value);
  if (!RESOURCE_SET.has(candidate)) fail("STORED_RESPONSE_INVALID");
  return candidate as BrainQueryResource;
}

function evidenceReference(value: unknown): string {
  const candidate = exactString(value);
  if (!EVIDENCE_ID.test(candidate)) fail("STORED_RESPONSE_INVALID");
  return candidate;
}

function parseSource(value: unknown): OrganizationBrainSource {
  const sourceValue = exactObject(value, [
    "label",
    "evidenceId",
    "resource",
    "resourceLabel",
    "recordId",
    "version",
    "applicationUrl",
  ]);
  const sourceResource = resource(sourceValue.resource);
  const recordId = exactString(sourceValue.recordId);
  if (utf8Bytes(recordId) > 191) fail("STORED_RESPONSE_INVALID");
  if (
    sourceValue.label !== ORGANIZATION_BRAIN_SECTION_LABELS.source ||
    sourceValue.resourceLabel !==
      ORGANIZATION_BRAIN_RESOURCE_LABELS[sourceResource] ||
    !isCanonicalVersion(sourceResource, sourceValue.version)
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  return {
    label: ORGANIZATION_BRAIN_SECTION_LABELS.source,
    evidenceId: evidenceReference(sourceValue.evidenceId),
    resource: sourceResource,
    resourceLabel: ORGANIZATION_BRAIN_RESOURCE_LABELS[sourceResource],
    recordId,
    version: exactString(sourceValue.version),
    applicationUrl: localApplicationUrl(sourceValue.applicationUrl),
  };
}

function isCanonicalVersion(resourceValue: BrainQueryResource, value: unknown): boolean {
  if (typeof value !== "string" || !isWellFormed(value)) return false;
  if (resourceValue === "meetingDrafts") {
    return /^notesRevision:(?:0|-?[1-9]\d*)$/.test(value);
  }
  if (/^notesRevision:/.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function parseFactField(value: unknown): OrganizationBrainFact["fields"][number] {
  const field = exactObject(value, ["name", "label", "value", "truncated"]);
  const name = exactString(field.name);
  const label = ORGANIZATION_BRAIN_FIELD_LABELS[name];
  const fieldValue = exactString(field.value, true);
  if (
    !label ||
    field.label !== label ||
    typeof field.truncated !== "boolean" ||
    utf8Bytes(fieldValue) > 2_048
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  return {
    name,
    label,
    value: fieldValue,
    truncated: field.truncated,
  };
}

function parseFact(
  value: unknown,
  sources: ReadonlyMap<string, OrganizationBrainSource>,
): OrganizationBrainFact {
  const fact = exactObject(value, [
    "label",
    "evidenceId",
    "resource",
    "resourceLabel",
    "sourceVersion",
    "recordId",
    "applicationUrl",
    "fields",
  ]);
  const evidenceId = evidenceReference(fact.evidenceId);
  const factResource = resource(fact.resource);
  const source = sources.get(evidenceId);
  const fields = exactArray(fact.fields).map(parseFactField);
  const allowedFields = BRAIN_QUERY_CATALOG[factResource].displayFields;
  if (
    fact.label !== ORGANIZATION_BRAIN_SECTION_LABELS.fact ||
    fact.resourceLabel !== ORGANIZATION_BRAIN_RESOURCE_LABELS[factResource] ||
    fields.length < 1 ||
    fields.length > allowedFields.length ||
    new Set(fields.map((field) => field.name)).size !== fields.length ||
    fields.some((field) => !allowedFields.includes(field.name)) ||
    !source ||
    source.resource !== factResource ||
    source.resourceLabel !== fact.resourceLabel ||
    source.recordId !== fact.recordId ||
    source.version !== fact.sourceVersion ||
    source.applicationUrl !== fact.applicationUrl
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  return {
    label: ORGANIZATION_BRAIN_SECTION_LABELS.fact,
    evidenceId,
    resource: factResource,
    resourceLabel: ORGANIZATION_BRAIN_RESOURCE_LABELS[factResource],
    sourceVersion: exactString(fact.sourceVersion),
    recordId: exactString(fact.recordId),
    applicationUrl: localApplicationUrl(fact.applicationUrl),
    fields,
  };
}

function parseNarrative(
  value: unknown,
  label: "推断" | "建议",
  sources: ReadonlyMap<string, OrganizationBrainSource>,
): OrganizationBrainNarrative {
  const narrative = exactObject(value, ["label", "text", "citations"]);
  const citations = exactArray(narrative.citations).map(evidenceReference);
  const text = exactString(narrative.text);
  if (
    narrative.label !== label ||
    citations.length < 1 ||
    citations.length > 5 ||
    new Set(citations).size !== citations.length ||
    citations.some((citation) => !sources.has(citation)) ||
    utf8Bytes(text) > 600
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  return { label, text, citations };
}

function parseMissingEvidence(value: unknown): OrganizationBrainMissingEvidence {
  const missing = exactObject(value, ["label", "text"]);
  if (missing.label !== ORGANIZATION_BRAIN_SECTION_LABELS.missingEvidence) {
    fail("STORED_RESPONSE_INVALID");
  }
  const text = exactString(missing.text);
  if (utf8Bytes(text) > 600) fail("STORED_RESPONSE_INVALID");
  return {
    label: ORGANIZATION_BRAIN_SECTION_LABELS.missingEvidence,
    text,
  };
}

function isoTimestamp(value: unknown): string {
  const timestamp = exactString(value);
  const parsed = Date.parse(timestamp);
  if (!Number.isFinite(parsed) || new Date(parsed).toISOString() !== timestamp) {
    fail("STORED_RESPONSE_INVALID");
  }
  return timestamp;
}

function boundedStoredString(value: unknown, maxBytes: number): string {
  const text = exactString(value);
  if (utf8Bytes(text) > maxBytes) fail("STORED_RESPONSE_INVALID");
  return text;
}

function parseMemoryActor(value: unknown): OrganizationBrainConfirmedMemory["confirmedBy"] {
  const actor = exactObject(value, ["type", "id", "label"]);
  if (
    actor.type !== "person" &&
    actor.type !== "meeting" &&
    actor.type !== "process"
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  return {
    type: actor.type,
    id: boundedStoredString(actor.id, 191),
    label: boundedStoredString(actor.label, 160),
  };
}

function parseMemoryAuthorityRoute(value: unknown): OrganizationBrainConfirmedMemory["authorityRoute"] {
  const route = exactObject(value, ["kind", "label", "applicationUrl"]);
  const kind = exactString(route.kind);
  if (!MEMORY_ROUTE_KINDS.has(kind)) fail("STORED_RESPONSE_INVALID");
  return {
    kind: kind as OrganizationBrainConfirmedMemory["authorityRoute"]["kind"],
    label: boundedStoredString(route.label, 160),
    applicationUrl: appApplicationUrl(route.applicationUrl),
  };
}

function parseMemorySourceRef(value: unknown): OrganizationBrainConfirmedMemory["sourceRefs"][number] {
  const source = exactObject(value, [
    "type",
    "id",
    "label",
    "applicationUrl",
    "observedAt",
  ]);
  const type = exactString(source.type);
  if (!MEMORY_SOURCE_TYPES.has(type)) fail("STORED_RESPONSE_INVALID");
  return {
    type: type as OrganizationBrainConfirmedMemory["sourceRefs"][number]["type"],
    id: boundedStoredString(source.id, 191),
    label: boundedStoredString(source.label, 200),
    applicationUrl: appApplicationUrl(source.applicationUrl),
    observedAt: isoTimestamp(source.observedAt),
  };
}

function parseConfirmedMemory(value: unknown): OrganizationBrainConfirmedMemory {
  const memory = exactObject(value, [
    "label",
    "candidateId",
    "claim",
    "rationale",
    "authorityRoute",
    "sourceRefs",
    "confirmedBy",
    "validFrom",
    "validUntil",
    "applicationUrl",
    "correctionUrl",
  ]);
  const candidateId = boundedStoredString(memory.candidateId, 191);
  const validUntil = memory.validUntil === null ? null : isoTimestamp(memory.validUntil);
  const sourceRefs = exactArray(memory.sourceRefs).map(parseMemorySourceRef);
  if (
    memory.label !== ORGANIZATION_BRAIN_SECTION_LABELS.confirmedMemory ||
    sourceRefs.length < 1 ||
    sourceRefs.length > 12 ||
    hasCanonicalDuplicates(sourceRefs) ||
    memory.correctionUrl !== `/app/tensions/new?memoryCandidateId=${encodeURIComponent(candidateId)}`
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  return {
    label: ORGANIZATION_BRAIN_SECTION_LABELS.confirmedMemory,
    candidateId,
    claim: boundedStoredString(memory.claim, 600),
    rationale: boundedStoredString(memory.rationale, 1200),
    authorityRoute: parseMemoryAuthorityRoute(memory.authorityRoute),
    sourceRefs,
    confirmedBy: parseMemoryActor(memory.confirmedBy),
    validFrom: isoTimestamp(memory.validFrom),
    validUntil,
    applicationUrl: appApplicationUrl(memory.applicationUrl),
    correctionUrl: appApplicationUrl(memory.correctionUrl),
  };
}

function allowedMessage(
  status: StoredOrganizationBrainStatus,
  code: string,
  message: string,
): boolean {
  if (status === "ANSWERED") {
    return (
      (code === "ANSWERED" && message === MESSAGES.answered) ||
      (code === "CAPABILITY_HELP" && message === ORGANIZATION_BRAIN_CAPABILITY_HELP_MESSAGE)
    );
  }
  if (status === "EVIDENCE_ONLY") {
    return EVIDENCE_ONLY_CODE_SET.has(code) && message === MESSAGES.evidenceOnly;
  }
  if (status === "INSUFFICIENT_EVIDENCE") {
    return (
      (code === "NO_AUTHORIZED_EVIDENCE" && message === MESSAGES.noEvidence) ||
      (code === "NO_SUPPORTED_PLAN" && message === MESSAGES.noPlan)
    );
  }
  if (status === "DENIED") {
    return code === "ACCESS_DENIED" && message === MESSAGES.denied;
  }
  if (status === "UNAVAILABLE") {
    return PROVIDER_CODE_SET.has(code) && message === MESSAGES.plannerUnavailable;
  }
  if (status === "FAILED") {
    if (!FAILED_CODE_SET.has(code)) return false;
    if (code === "EVIDENCE_CONFLICT") return message === MESSAGES.evidenceConflict;
    if (code.startsWith("PLANNER_")) return message === MESSAGES.plannerFailed;
    if (code.startsWith("REASONER_")) return message === MESSAGES.reasonerFailed;
    return message === MESSAGES.queryFailed;
  }
  if (status !== "REJECTED") return false;
  if (D1_REJECTION_CODE_SET.has(code) && message === MESSAGES.reasonerRejected) {
    return true;
  }
  if (PLANNER_REJECTION_SET.has(code) && message === MESSAGES.plannerRejected) {
    return true;
  }
  return PLAN_REJECTION_SET.has(code) && message === MESSAGES.queryRejected;
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

function hasCanonicalDuplicates(values: readonly unknown[]): boolean {
  const canonical = values.map((value) => JSON.stringify(value));
  return new Set(canonical).size !== canonical.length;
}

export function normalizeOrganizationBrainResponse(
  value: unknown,
): StoredOrganizationBrainResponse {
  const hasConfirmedMemory = (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.hasOwn(value, "confirmedMemory")
  );
  const response = exactObject(value, hasConfirmedMemory ? RESPONSE_MEMORY_KEYS : RESPONSE_BASE_KEYS);
  if (response.schemaVersion !== 1) fail("STORED_RESPONSE_INVALID");
  const status = exactString(response.status) as StoredOrganizationBrainStatus;
  if (
    ![
      "ANSWERED",
      "EVIDENCE_ONLY",
      "INSUFFICIENT_EVIDENCE",
      "DENIED",
      "REJECTED",
      "UNAVAILABLE",
      "FAILED",
    ].includes(status)
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  const code = exactString(response.code);
  const message = exactString(response.message);
  if (!ALL_RESPONSE_CODES.has(code) || !allowedMessage(status, code, message)) {
    fail("STORED_RESPONSE_INVALID");
  }

  const confirmedMemory = hasConfirmedMemory
    ? exactArray(response.confirmedMemory).map(parseConfirmedMemory)
    : [];
  if (
    confirmedMemory.length > 8 ||
    hasCanonicalDuplicates(confirmedMemory) ||
    (status !== "ANSWERED" && status !== "EVIDENCE_ONLY" && confirmedMemory.length > 0)
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  const sources = exactArray(response.sources).map(parseSource);
  if (sources.length > 20) fail("STORED_RESPONSE_INVALID");
  const sourceMap = new Map(sources.map((source) => [source.evidenceId, source]));
  if (sourceMap.size !== sources.length) fail("STORED_RESPONSE_INVALID");
  const facts = exactArray(response.facts).map((fact) => parseFact(fact, sourceMap));
  const inferences = exactArray(response.inferences).map((entry) =>
    parseNarrative(entry, ORGANIZATION_BRAIN_SECTION_LABELS.inference, sourceMap),
  );
  const recommendations = exactArray(response.recommendations).map((entry) =>
    parseNarrative(
      entry,
      ORGANIZATION_BRAIN_SECTION_LABELS.recommendation,
      sourceMap,
    ),
  );
  const missingEvidence = exactArray(response.missingEvidence).map(
    parseMissingEvidence,
  );
  if (
    facts.length > 20 ||
    inferences.length > 6 ||
    recommendations.length > 6 ||
    missingEvidence.length > 6 ||
    hasCanonicalDuplicates(facts) ||
    hasCanonicalDuplicates(inferences) ||
    hasCanonicalDuplicates(recommendations) ||
    hasCanonicalDuplicates(missingEvidence)
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  if (
    status !== "ANSWERED" &&
    status !== "EVIDENCE_ONLY" &&
    (facts.length > 0 ||
      inferences.length > 0 ||
      recommendations.length > 0 ||
      missingEvidence.length > 0 ||
      confirmedMemory.length > 0 ||
      sources.length > 0)
  ) {
    fail("STORED_RESPONSE_INVALID");
  }

  const normalized = {
    schemaVersion: 1 as const,
    status,
    code,
    message,
    ...(confirmedMemory.length > 0 ? { confirmedMemory } : {}),
    facts,
    inferences,
    recommendations,
    missingEvidence,
    sources,
  };
  return deepFreeze(normalized);
}

export function parseStoredOrganizationBrainResponse(
  content: string,
): StoredOrganizationBrainResponse {
  if (typeof content !== "string" || !isWellFormed(content)) {
    fail("STORED_RESPONSE_INVALID");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    fail("STORED_RESPONSE_INVALID");
  }
  const normalized = normalizeOrganizationBrainResponse(parsed);
  if (content !== canonicalResponseJson(normalized)) {
    fail("STORED_RESPONSE_INVALID");
  }
  return normalized;
}

function canonicalResponseJson(response: StoredOrganizationBrainResponse): string {
  const normalized = normalizeOrganizationBrainResponse(response);
  return JSON.stringify({
    schemaVersion: normalized.schemaVersion,
    status: normalized.status,
    code: normalized.code,
    message: normalized.message,
    ...(normalized.confirmedMemory && normalized.confirmedMemory.length > 0
      ? { confirmedMemory: normalized.confirmedMemory }
      : {}),
    facts: normalized.facts,
    inferences: normalized.inferences,
    recommendations: normalized.recommendations,
    missingEvidence: normalized.missingEvidence,
    sources: normalized.sources,
  });
}

const conversationSelect = {
  id: true,
  title: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.BrainConversationSelect;

const ownedConversationSelect = {
  id: true,
  organizationId: true,
  ownerId: true,
  title: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.BrainConversationSelect;

const messageSelect = {
  id: true,
  organizationId: true,
  conversationId: true,
  role: true,
  content: true,
  createdAt: true,
  updatedAt: true,
} as const satisfies Prisma.BrainMessageSelect;

type ConversationRow = Prisma.BrainConversationGetPayload<{
  select: typeof conversationSelect;
}>;
type OwnedConversationRow = Prisma.BrainConversationGetPayload<{
  select: typeof ownedConversationSelect;
}>;
type MessageRow = Prisma.BrainMessageGetPayload<{ select: typeof messageSelect }>;

function boundedIdentifier(value: string): boolean {
  return value.length > 0 && isWellFormed(value) && utf8Bytes(value) <= 191;
}

function validateActor(actor: ActorContext): void {
  if (
    !boundedIdentifier(actor.organizationId) ||
    !boundedIdentifier(actor.personId)
  ) {
    fail("ACCESS_DENIED");
  }
}

function summary(row: ConversationRow): OrganizationBrainConversationSummary {
  return Object.freeze({
    schemaVersion: 1 as const,
    id: row.id,
    title: row.title,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

function assertOwnedConversation(
  row: OwnedConversationRow | null,
  actor: ActorContext,
  expectedId: string,
): asserts row is OwnedConversationRow {
  if (
    !row ||
    row.id !== expectedId ||
    row.organizationId !== actor.organizationId ||
    row.ownerId !== actor.personId
  ) {
    fail("ACCESS_DENIED");
  }
}

function brainResult(
  row: MessageRow | null,
  actor: ActorContext,
  conversationId: string,
  brainMessageId: string,
): StoredOrganizationBrainResponse | null {
  if (!row) return null;
  if (
    row.id !== brainMessageId ||
    row.organizationId !== actor.organizationId ||
    row.conversationId !== conversationId ||
    row.role !== "BRAIN"
  ) {
    fail("STORED_RESPONSE_INVALID");
  }
  return parseStoredOrganizationBrainResponse(row.content);
}

function displayMessage(row: MessageRow): OrganizationBrainConversationMessage {
  if (row.role === "USER") {
    return Object.freeze({
      id: row.id,
      role: "USER" as const,
      content: row.content,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    });
  }
  if (row.role !== "BRAIN") fail("STORED_RESPONSE_INVALID");
  return Object.freeze({
    id: row.id,
    role: "BRAIN" as const,
    result: parseStoredOrganizationBrainResponse(row.content),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  });
}

async function persistenceBoundary<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof OrganizationBrainConversationStoreError) throw error;
    fail("PERSISTENCE_FAILED");
  }
}

export const organizationBrainConversationStore: OrganizationBrainConversationStore =
  Object.freeze({
    create: (actor, input) =>
      persistenceBoundary(async () => {
        validateActor(actor);
        if (!CONVERSATION_ID.test(input.conversationId)) {
          fail("PERSISTENCE_FAILED");
        }
        return prisma.$transaction(async (transaction) => {
          await transaction.brainConversation.createMany({
            data: [
              {
                id: input.conversationId,
                organizationId: actor.organizationId,
                ownerId: actor.personId,
                title: null,
              },
            ],
            skipDuplicates: true,
          });
          const row = await transaction.brainConversation.findUnique({
            where: { id: input.conversationId },
            select: ownedConversationSelect,
          });
          assertOwnedConversation(row, actor, input.conversationId);
          if (row.title !== null) fail("ACCESS_DENIED");
          return summary(row);
        });
      }),

    list: (actor, input) =>
      persistenceBoundary(async () => {
        validateActor(actor);
        if (!Number.isInteger(input.limit) || input.limit < 1 || input.limit > 50) {
          fail("PERSISTENCE_FAILED");
        }
        const rows = await prisma.brainConversation.findMany({
          where: {
            organizationId: actor.organizationId,
            ownerId: actor.personId,
          },
          orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
          take: input.limit,
          select: conversationSelect,
        });
        return Object.freeze({
          schemaVersion: 1 as const,
          conversations: Object.freeze(rows.map(summary)),
        });
      }),

    load: (actor, input) =>
      persistenceBoundary(async () => {
        validateActor(actor);
        if (
          !boundedIdentifier(input.conversationId) ||
          !Number.isInteger(input.messageLimit) ||
          input.messageLimit < 1 ||
          input.messageLimit > 100
        ) {
          fail("ACCESS_DENIED");
        }
        const conversation = await prisma.brainConversation.findFirst({
          where: {
            id: input.conversationId,
            organizationId: actor.organizationId,
            ownerId: actor.personId,
          },
          select: ownedConversationSelect,
        });
        assertOwnedConversation(conversation, actor, input.conversationId);
        const rows = await prisma.brainMessage.findMany({
          where: {
            organizationId: actor.organizationId,
            conversationId: input.conversationId,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: input.messageLimit + 1,
          select: messageSelect,
        });
        const hasMore = rows.length > input.messageLimit;
        const messages = rows.slice(0, input.messageLimit).reverse().map(displayMessage);
        return Object.freeze({
          schemaVersion: 1 as const,
          conversation: summary(conversation),
          messages: Object.freeze(messages),
          hasMore,
        });
      }),

    claim: (actor, input) =>
      persistenceBoundary(async () => {
        validateActor(actor);
        if (
          !boundedIdentifier(input.conversationId) ||
          !USER_MESSAGE_ID.test(input.userMessageId) ||
          !BRAIN_MESSAGE_ID.test(input.brainMessageId) ||
          !isWellFormed(input.question) ||
          input.question.trim() !== input.question ||
          utf8Bytes(input.question) < 1 ||
          utf8Bytes(input.question) > 2_048
        ) {
          fail("PERSISTENCE_FAILED");
        }
        return prisma.$transaction(async (transaction) => {
          const conversation = await transaction.brainConversation.findFirst({
            where: {
              id: input.conversationId,
              organizationId: actor.organizationId,
              ownerId: actor.personId,
            },
            select: ownedConversationSelect,
          });
          assertOwnedConversation(conversation, actor, input.conversationId);

          const inserted = await transaction.brainMessage.createMany({
            data: [
              {
                id: input.userMessageId,
                organizationId: actor.organizationId,
                conversationId: input.conversationId,
                role: "USER",
                content: input.question,
              },
            ],
            skipDuplicates: true,
          });
          const userMessage = await transaction.brainMessage.findUnique({
            where: { id: input.userMessageId },
            select: messageSelect,
          });
          if (
            !userMessage ||
            userMessage.organizationId !== actor.organizationId ||
            userMessage.conversationId !== input.conversationId
          ) {
            fail("ACCESS_DENIED");
          }
          if (
            userMessage.role !== "USER" ||
            userMessage.content !== input.question
          ) {
            fail("IDEMPOTENCY_CONFLICT");
          }
          if (inserted.count === 1) {
            const updated = await transaction.brainConversation.updateMany({
              where: {
                id: input.conversationId,
                organizationId: actor.organizationId,
                ownerId: actor.personId,
              },
              data: { updatedAt: new Date() },
            });
            if (updated.count !== 1) fail("ACCESS_DENIED");
          }
          const terminal = await transaction.brainMessage.findUnique({
            where: { id: input.brainMessageId },
            select: messageSelect,
          });
          return Object.freeze({
            terminal: brainResult(
              terminal,
              actor,
              input.conversationId,
              input.brainMessageId,
            ),
          });
        });
      }),

    complete: (actor, input) =>
      persistenceBoundary(async () => {
        validateActor(actor);
        if (
          !boundedIdentifier(input.conversationId) ||
          !USER_MESSAGE_ID.test(input.userMessageId) ||
          !BRAIN_MESSAGE_ID.test(input.brainMessageId)
        ) {
          fail("PERSISTENCE_FAILED");
        }
        const content = canonicalResponseJson(input.result);
        return prisma.$transaction(async (transaction) => {
          const conversation = await transaction.brainConversation.findFirst({
            where: {
              id: input.conversationId,
              organizationId: actor.organizationId,
              ownerId: actor.personId,
            },
            select: ownedConversationSelect,
          });
          assertOwnedConversation(conversation, actor, input.conversationId);
          const userMessage = await transaction.brainMessage.findUnique({
            where: { id: input.userMessageId },
            select: messageSelect,
          });
          if (
            !userMessage ||
            userMessage.organizationId !== actor.organizationId ||
            userMessage.conversationId !== input.conversationId ||
            userMessage.role !== "USER"
          ) {
            fail("ACCESS_DENIED");
          }
          await transaction.brainMessage.createMany({
            data: [
              {
                id: input.brainMessageId,
                organizationId: actor.organizationId,
                conversationId: input.conversationId,
                role: "BRAIN",
                content,
              },
            ],
            skipDuplicates: true,
          });
          const winner = await transaction.brainMessage.findUnique({
            where: { id: input.brainMessageId },
            select: messageSelect,
          });
          const result = brainResult(
            winner,
            actor,
            input.conversationId,
            input.brainMessageId,
          );
          if (!result) fail("PERSISTENCE_FAILED");
          return result;
        });
      }),
  });
