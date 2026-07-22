import type {
  MemoryCandidate,
  MemoryCandidateActor,
  MemoryCandidateAuditEvent,
  MemoryCandidateAuthorityRoute,
  MemoryCandidateAuthorityRouteKind,
  MemoryCandidateSourceRef,
  MemoryCandidateSourceType,
  MemoryCandidateSupersessionRef,
} from "./memory-candidate-types";

export type MemoryCandidateLifecycleErrorCode =
  | "INVALID_INPUT"
  | "INVALID_ACTOR"
  | "INVALID_SOURCE"
  | "INVALID_ROUTE"
  | "INVALID_STATUS"
  | "UNAUTHORIZED_CONFIRMATION"
  | "OWNER_REQUIRED"
  | "INVALID_VALIDITY";

export class MemoryCandidateLifecycleError extends Error {
  readonly code: MemoryCandidateLifecycleErrorCode;

  constructor(code: MemoryCandidateLifecycleErrorCode, message: string) {
    super(message);
    this.name = "MemoryCandidateLifecycleError";
    this.code = code;
  }
}

export type CreateDraftMemoryCandidateInput = Readonly<{
  id: string;
  organizationId: string;
  ownerPersonId: string;
  claim: string;
  rationale: string;
  sourceRefs: readonly MemoryCandidateSourceRef[];
  actor: MemoryCandidateActor;
  now: Date;
}>;

export type SubmitMemoryCandidateInput = Readonly<{
  actor: MemoryCandidateActor;
  now: Date;
  reason?: string | null;
}>;

export type ConfirmMemoryCandidateInput = Readonly<{
  actor: MemoryCandidateActor;
  now: Date;
  validFrom: string;
  validUntil?: string | null;
  reason?: string | null;
}>;

export type RejectMemoryCandidateInput = Readonly<{
  actor: MemoryCandidateActor;
  now: Date;
  reason: string;
}>;

export type SupersedeMemoryCandidateInput = Readonly<{
  actor: MemoryCandidateActor;
  now: Date;
  supersededBy: MemoryCandidateSupersessionRef;
  reason: string;
}>;

const CLAIM_MAX_BYTES = 600;
const RATIONALE_MAX_BYTES = 1200;
const REASON_MAX_BYTES = 600;
const ID_MAX_BYTES = 191;
const SOURCE_TYPES = new Set<MemoryCandidateSourceType>([
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
const ROUTE_KINDS = new Set<MemoryCandidateAuthorityRouteKind>([
  "GOAL_STRATEGY",
  "GOVERNANCE",
  "TACTICAL",
  "MEETING_RECORD",
  "TENSION",
]);
const ROUTE_RANK: Record<MemoryCandidateAuthorityRouteKind, number> = Object.freeze({
  TENSION: 0,
  MEETING_RECORD: 1,
  TACTICAL: 2,
  GOVERNANCE: 3,
  GOAL_STRATEGY: 4,
});
const CONFIRMING_ACTOR_PREFIX: Record<MemoryCandidateAuthorityRouteKind, string> = Object.freeze({
  GOAL_STRATEGY: "goal:",
  GOVERNANCE: "governance:",
  TACTICAL: "tactical:",
  MEETING_RECORD: "meeting:",
  TENSION: "tension:",
});

function fail(code: MemoryCandidateLifecycleErrorCode, message: string): never {
  throw new MemoryCandidateLifecycleError(code, message);
}

function bytes(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function boundedText(
  value: string,
  maxBytes: number,
  code: MemoryCandidateLifecycleErrorCode,
  name: string,
): string {
  const trimmed = value.trim();
  if (trimmed.length === 0 || bytes(trimmed) > maxBytes) {
    fail(code, `${name} is invalid`);
  }
  return trimmed;
}

function optionalReason(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return boundedText(value, REASON_MAX_BYTES, "INVALID_INPUT", "reason");
}

function boundedId(value: string, code: MemoryCandidateLifecycleErrorCode, name: string): string {
  return boundedText(value, ID_MAX_BYTES, code, name);
}

function iso(value: Date): string {
  const time = value.getTime();
  if (!Number.isFinite(time)) fail("INVALID_INPUT", "timestamp is invalid");
  return value.toISOString();
}

function validIso(value: string, code: MemoryCandidateLifecycleErrorCode, name: string): string {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) fail(code, `${name} is invalid`);
  return new Date(time).toISOString();
}

function requireApplicationUrl(value: string, code: MemoryCandidateLifecycleErrorCode, name: string): string {
  const trimmed = boundedText(value, 512, code, name);
  if (!trimmed.startsWith("/app/")) fail(code, `${name} must be an application URL`);
  return trimmed;
}

function actor(input: MemoryCandidateActor): MemoryCandidateActor {
  if (input.type !== "person" && input.type !== "meeting" && input.type !== "process") {
    fail("INVALID_ACTOR", "actor type is invalid");
  }
  return Object.freeze({
    type: input.type,
    id: boundedId(input.id, "INVALID_ACTOR", "actor id"),
    label: boundedText(input.label, 160, "INVALID_ACTOR", "actor label"),
  });
}

function sourceRef(input: MemoryCandidateSourceRef): MemoryCandidateSourceRef {
  if (!SOURCE_TYPES.has(input.type)) fail("INVALID_SOURCE", "source type is invalid");
  return Object.freeze({
    type: input.type,
    id: boundedId(input.id, "INVALID_SOURCE", "source id"),
    label: boundedText(input.label, 200, "INVALID_SOURCE", "source label"),
    applicationUrl: requireApplicationUrl(input.applicationUrl, "INVALID_SOURCE", "source URL"),
    observedAt: validIso(input.observedAt, "INVALID_SOURCE", "source observedAt"),
  });
}

function authorityRoute(input: MemoryCandidateAuthorityRoute): MemoryCandidateAuthorityRoute {
  if (!ROUTE_KINDS.has(input.kind)) fail("INVALID_ROUTE", "route kind is invalid");
  return Object.freeze({
    kind: input.kind,
    label: boundedText(input.label, 160, "INVALID_ROUTE", "route label"),
    applicationUrl: requireApplicationUrl(input.applicationUrl, "INVALID_ROUTE", "route URL"),
  });
}

function supersessionRef(input: MemoryCandidateSupersessionRef): MemoryCandidateSupersessionRef {
  if (input.type !== "memoryCandidate" && input.type !== "sourceRecord") {
    fail("INVALID_INPUT", "supersession type is invalid");
  }
  return Object.freeze({
    type: input.type,
    id: boundedId(input.id, "INVALID_INPUT", "supersession id"),
    label: boundedText(input.label, 200, "INVALID_INPUT", "supersession label"),
    applicationUrl: requireApplicationUrl(input.applicationUrl, "INVALID_INPUT", "supersession URL"),
  });
}

function auditEvent(
  type: MemoryCandidateAuditEvent["type"],
  inputActor: MemoryCandidateActor,
  occurredAt: string,
  reason: string | null,
): MemoryCandidateAuditEvent {
  return Object.freeze({
    type,
    actor: actor(inputActor),
    occurredAt,
    reason,
  });
}

function freezeCandidate(candidate: MemoryCandidate): MemoryCandidate {
  return Object.freeze({
    ...candidate,
    sourceRefs: Object.freeze(candidate.sourceRefs.map((entry) => Object.freeze({ ...entry }))),
    authorityRoute: Object.freeze({ ...candidate.authorityRoute }),
    submittedBy: candidate.submittedBy ? Object.freeze({ ...candidate.submittedBy }) : null,
    confirmedBy: candidate.confirmedBy ? Object.freeze({ ...candidate.confirmedBy }) : null,
    supersededBy: candidate.supersededBy ? Object.freeze({ ...candidate.supersededBy }) : null,
    auditTrail: Object.freeze(candidate.auditTrail.map((event) => Object.freeze({
      ...event,
      actor: Object.freeze({ ...event.actor }),
    }))),
  });
}

function assertStatus(candidate: MemoryCandidate, expected: MemoryCandidate["status"]): void {
  if (candidate.status !== expected) {
    fail("INVALID_STATUS", `candidate must be ${expected}`);
  }
}

function appendEvent(
  candidate: MemoryCandidate,
  eventType: MemoryCandidateAuditEvent["type"],
  eventActor: MemoryCandidateActor,
  now: string,
  reason: string | null,
): readonly MemoryCandidateAuditEvent[] {
  return Object.freeze([
    ...candidate.auditTrail,
    auditEvent(eventType, eventActor, now, reason),
  ]);
}

export function classifyMemoryCandidateAuthorityRoute(
  sourceRefs: readonly Pick<MemoryCandidateSourceRef, "type" | "applicationUrl">[],
): MemoryCandidateAuthorityRoute {
  let selected: MemoryCandidateAuthorityRoute | null = null;
  for (const source of sourceRefs) {
    const route = routeForSource(source);
    if (!selected || ROUTE_RANK[route.kind] > ROUTE_RANK[selected.kind]) {
      selected = route;
    }
  }
  return selected ?? authorityRoute({
    kind: "TENSION",
    label: "Raise as a tension",
    applicationUrl: "/app/tensions/new",
  });
}

function routeForSource(
  source: Pick<MemoryCandidateSourceRef, "type" | "applicationUrl">,
): MemoryCandidateAuthorityRoute {
  if (source.type === "goal" || source.type === "target") {
    return authorityRoute({
      kind: "GOAL_STRATEGY",
      label: "Strategic or Goal process",
      applicationUrl: "/app/goals",
    });
  }
  if (
    source.type === "circle" ||
    source.type === "role" ||
    source.type === "accountability" ||
    source.type === "domain" ||
    source.type === "policy"
  ) {
    return authorityRoute({
      kind: "GOVERNANCE",
      label: "Governance process",
      applicationUrl: "/app/meetings",
    });
  }
  if (source.type === "project" || source.type === "action") {
    return authorityRoute({
      kind: "TACTICAL",
      label: "Bearer or tactical process",
      applicationUrl: "/app/meetings",
    });
  }
  if (source.type === "meeting" || source.type === "decision") {
    const applicationUrl = source.applicationUrl?.startsWith("/app/")
      ? source.applicationUrl
      : "/app/meetings";
    return authorityRoute({
      kind: "MEETING_RECORD",
      label: "Official meeting record",
      applicationUrl,
    });
  }
  return authorityRoute({
    kind: "TENSION",
    label: "Raise as a tension",
    applicationUrl: "/app/tensions/new",
  });
}

function assertConfirmingActor(
  candidate: MemoryCandidate,
  inputActor: MemoryCandidateActor,
): MemoryCandidateActor {
  const confirmer = actor(inputActor);
  const requiredPrefix = CONFIRMING_ACTOR_PREFIX[candidate.authorityRoute.kind];
  if (confirmer.type !== "process" || !confirmer.id.startsWith(requiredPrefix)) {
    fail("UNAUTHORIZED_CONFIRMATION", "actor cannot confirm this authority route");
  }
  return confirmer;
}

export function createDraftMemoryCandidate(input: CreateDraftMemoryCandidateInput): MemoryCandidate {
  const now = iso(input.now);
  const createdBy = actor(input.actor);
  const refs = input.sourceRefs.map(sourceRef);
  if (refs.length === 0) fail("INVALID_SOURCE", "candidate requires at least one source");
  const ownerPersonId = boundedId(input.ownerPersonId, "INVALID_INPUT", "owner person id");
  if (createdBy.type !== "person" || createdBy.id !== ownerPersonId) {
    fail("OWNER_REQUIRED", "draft actor must be the owner person");
  }
  const route = classifyMemoryCandidateAuthorityRoute(refs);

  return freezeCandidate({
    schemaVersion: 1,
    id: boundedId(input.id, "INVALID_INPUT", "candidate id"),
    organizationId: boundedId(input.organizationId, "INVALID_INPUT", "organization id"),
    ownerPersonId,
    claim: boundedText(input.claim, CLAIM_MAX_BYTES, "INVALID_INPUT", "claim"),
    rationale: boundedText(input.rationale, RATIONALE_MAX_BYTES, "INVALID_INPUT", "rationale"),
    sourceRefs: Object.freeze(refs),
    authorityRoute: route,
    status: "DRAFT",
    submittedBy: null,
    confirmedBy: null,
    supersededBy: null,
    validFrom: null,
    validUntil: null,
    createdAt: now,
    updatedAt: now,
    auditTrail: Object.freeze([auditEvent("CREATED", createdBy, now, null)]),
  });
}

export function submitMemoryCandidate(
  candidate: MemoryCandidate,
  input: SubmitMemoryCandidateInput,
): MemoryCandidate {
  assertStatus(candidate, "DRAFT");
  const submitter = actor(input.actor);
  if (submitter.type !== "person" || submitter.id !== candidate.ownerPersonId) {
    fail("OWNER_REQUIRED", "only the owner can submit a draft");
  }
  const now = iso(input.now);
  return freezeCandidate({
    ...candidate,
    status: "SUBMITTED",
    submittedBy: submitter,
    updatedAt: now,
    auditTrail: appendEvent(candidate, "SUBMITTED", submitter, now, optionalReason(input.reason)),
  });
}

export function confirmMemoryCandidate(
  candidate: MemoryCandidate,
  input: ConfirmMemoryCandidateInput,
): MemoryCandidate {
  assertStatus(candidate, "SUBMITTED");
  const confirmer = assertConfirmingActor(candidate, input.actor);
  const now = iso(input.now);
  const validFrom = validIso(input.validFrom, "INVALID_VALIDITY", "validFrom");
  const validUntil = input.validUntil ? validIso(input.validUntil, "INVALID_VALIDITY", "validUntil") : null;
  if (validUntil && Date.parse(validUntil) <= Date.parse(validFrom)) {
    fail("INVALID_VALIDITY", "validUntil must be after validFrom");
  }
  return freezeCandidate({
    ...candidate,
    status: "CONFIRMED",
    confirmedBy: confirmer,
    validFrom,
    validUntil,
    updatedAt: now,
    auditTrail: appendEvent(candidate, "CONFIRMED", confirmer, now, optionalReason(input.reason)),
  });
}

export function rejectMemoryCandidate(
  candidate: MemoryCandidate,
  input: RejectMemoryCandidateInput,
): MemoryCandidate {
  assertStatus(candidate, "SUBMITTED");
  const now = iso(input.now);
  const rejector = actor(input.actor);
  return freezeCandidate({
    ...candidate,
    status: "REJECTED",
    updatedAt: now,
    auditTrail: appendEvent(candidate, "REJECTED", rejector, now, optionalReason(input.reason)),
  });
}

export function supersedeMemoryCandidate(
  candidate: MemoryCandidate,
  input: SupersedeMemoryCandidateInput,
): MemoryCandidate {
  assertStatus(candidate, "CONFIRMED");
  const now = iso(input.now);
  const superseder = actor(input.actor);
  return freezeCandidate({
    ...candidate,
    status: "SUPERSEDED",
    supersededBy: supersessionRef(input.supersededBy),
    updatedAt: now,
    auditTrail: appendEvent(candidate, "SUPERSEDED", superseder, now, optionalReason(input.reason)),
  });
}

export function isMemoryCandidateExpired(candidate: MemoryCandidate, now: Date): boolean {
  if (!candidate.validUntil) return false;
  const nowTime = now.getTime();
  const validUntilTime = Date.parse(candidate.validUntil);
  if (!Number.isFinite(nowTime) || !Number.isFinite(validUntilTime)) {
    fail("INVALID_VALIDITY", "validUntil is invalid");
  }
  return nowTime >= validUntilTime;
}
