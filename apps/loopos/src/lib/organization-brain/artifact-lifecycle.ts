import type { BrainArtifact, BrainArtifactActor, BrainArtifactSourceRef, BrainArtifactStatus, BrainArtifactType } from "./artifact-types";

export type BrainArtifactLifecycleErrorCode =
  | "INVALID_INPUT"
  | "INVALID_SOURCE"
  | "INVALID_STATE"
  | "EXPIRED"
  | "OWNER_REQUIRED"
  | "TERMINAL_IMMUTABLE";

export class BrainArtifactLifecycleError extends Error {
  constructor(public readonly code: BrainArtifactLifecycleErrorCode) {
    super(`Brain artifact lifecycle failed: ${code}`);
    this.name = "BrainArtifactLifecycleError";
  }
}

export type CreateBrainArtifactInput = Readonly<{
  id: string;
  organizationId: string;
  ownerPersonId: string;
  conversationId?: string | null;
  sourceMessageId?: string | null;
  linkedCommandOperationId?: string | null;
  supersedesArtifactId?: string | null;
  artifactType: BrainArtifactType;
  payload: Readonly<Record<string, unknown>>;
  sourceRefs: readonly BrainArtifactSourceRef[];
  actor: BrainArtifactActor;
  now: Date;
  expiresAt?: Date | null;
}>;

function fail(code: BrainArtifactLifecycleErrorCode): never {
  throw new BrainArtifactLifecycleError(code);
}

function text(value: string, max: number): string {
  if (typeof value !== "string" || value.trim().length === 0 || Buffer.byteLength(value, "utf8") > max) fail("INVALID_INPUT");
  return value.trim();
}

function boundedJson(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    fail("INVALID_INPUT");
  }
  if (Buffer.byteLength(serialized, "utf8") > 64_000) fail("INVALID_INPUT");
  return Object.freeze({ ...value });
}

function validatePayload(type: BrainArtifactType, payload: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  if (type !== "TENSION_DRAFT" || typeof payload.title !== "string" || Buffer.byteLength(payload.title.trim(), "utf8") < 1 || Buffer.byteLength(payload.title.trim(), "utf8") > 600) {
    fail("INVALID_INPUT");
  }
  return boundedJson(payload);
}

function timestamp(value: Date): string {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) fail("INVALID_INPUT");
  return value.toISOString();
}

function sourceRef(source: BrainArtifactSourceRef, organizationId: string, ownerPersonId: string): BrainArtifactSourceRef {
  if (!source || typeof source !== "object") fail("INVALID_SOURCE");
  const applicationUrl = text(source.applicationUrl, 512);
  if (!applicationUrl.startsWith("/app/")) fail("INVALID_SOURCE");
  const observedAt = timestamp(new Date(source.observedAt));
  if (source.organizationId !== organizationId || (source.ownerPersonId !== null && source.ownerPersonId !== ownerPersonId)) fail("INVALID_SOURCE");
  return Object.freeze({
    organizationId,
    ownerPersonId: source.ownerPersonId,
    type: text(source.type, 80),
    id: text(source.id, 191),
    label: text(source.label, 200),
    applicationUrl,
    observedAt,
  });
}

function actor(input: BrainArtifactActor, ownerPersonId: string): BrainArtifactActor {
  if (input.type !== "person" || input.id !== ownerPersonId) fail("OWNER_REQUIRED");
  return Object.freeze({ type: input.type, id: text(input.id, 191), label: text(input.label, 160) });
}

function transition(from: BrainArtifactStatus, to: BrainArtifactStatus): void {
  const allowed: Record<BrainArtifactStatus, readonly BrainArtifactStatus[]> = {
    DRAFT: ["READY"],
    READY: ["EXECUTING"],
    EXECUTING: ["SUCCEEDED", "FAILED"],
    SUCCEEDED: [],
    FAILED: [],
  };
  if (!allowed[from].includes(to)) fail(from === "SUCCEEDED" || from === "FAILED" ? "TERMINAL_IMMUTABLE" : "INVALID_STATE");
}

export function createBrainArtifact(input: CreateBrainArtifactInput): BrainArtifact {
  actor(input.actor, text(input.ownerPersonId, 191));
  const now = timestamp(input.now);
  const expiresAt = input.expiresAt ? timestamp(input.expiresAt) : null;
  if (expiresAt && Date.parse(expiresAt) <= Date.parse(now)) fail("EXPIRED");
  if (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)) fail("INVALID_INPUT");
  if (!Array.isArray(input.sourceRefs) || input.sourceRefs.length === 0 || input.sourceRefs.length > 20) fail("INVALID_SOURCE");
  return Object.freeze({
    id: text(input.id, 191),
    organizationId: text(input.organizationId, 191),
    ownerPersonId: text(input.ownerPersonId, 191),
    conversationId: input.conversationId ? text(input.conversationId, 191) : null,
    sourceMessageId: input.sourceMessageId ? text(input.sourceMessageId, 191) : null,
    linkedCommandOperationId: input.linkedCommandOperationId ? text(input.linkedCommandOperationId, 191) : null,
    supersedesArtifactId: input.supersedesArtifactId ? text(input.supersedesArtifactId, 191) : null,
    artifactType: input.artifactType,
    schemaVersion: 1,
    payload: validatePayload(input.artifactType, input.payload),
    sourceRefs: Object.freeze(input.sourceRefs.map((source) => sourceRef(source, input.organizationId, input.ownerPersonId))),
    status: "DRAFT",
    expiresAt,
    failureCode: null,
    terminalResult: null,
    createdAt: now,
    updatedAt: now,
    readyAt: null,
    executionStartedAt: null,
    completedAt: null,
  });
}

export function markBrainArtifactReady(artifact: BrainArtifact, now: Date): BrainArtifact {
  transition(artifact.status, "READY");
  if (artifact.expiresAt && Date.parse(artifact.expiresAt) <= now.getTime()) fail("EXPIRED");
  return Object.freeze({ ...artifact, status: "READY", readyAt: timestamp(now), updatedAt: timestamp(now) });
}

export function startBrainArtifactExecution(artifact: BrainArtifact, now: Date): BrainArtifact {
  transition(artifact.status, "EXECUTING");
  if (artifact.expiresAt && Date.parse(artifact.expiresAt) <= now.getTime()) fail("EXPIRED");
  return Object.freeze({ ...artifact, status: "EXECUTING", executionStartedAt: timestamp(now), updatedAt: timestamp(now) });
}

export function completeBrainArtifact(artifact: BrainArtifact, result: Readonly<Record<string, unknown>>, now: Date): BrainArtifact {
  transition(artifact.status, "SUCCEEDED");
  return Object.freeze({ ...artifact, status: "SUCCEEDED", terminalResult: Object.freeze({ ...result }), completedAt: timestamp(now), updatedAt: timestamp(now) });
}

export function failBrainArtifact(artifact: BrainArtifact, failureCode: string, now: Date): BrainArtifact {
  transition(artifact.status, "FAILED");
  return Object.freeze({ ...artifact, status: "FAILED", failureCode: text(failureCode, 120), completedAt: timestamp(now), updatedAt: timestamp(now) });
}
