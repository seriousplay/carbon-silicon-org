import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import {
  evaluateOrganizationSetupReadiness,
  ORGANIZATION_SETUP_HARD_GATE_CODES,
  ORGANIZATION_SETUP_WARNING_CODES,
  type OrganizationSetupReadiness,
  type OrganizationSetupReadinessInput,
} from "./readiness";
import { DEFAULT_MAX_ATTEMPTS } from "./invitation-delivery-service";

const ACTIVATION_SCHEMA_VERSION = 1 as const;
const MAX_READINESS_RECORDS = 1_000;
const MAX_READINESS_ID_LENGTH = 512;
const MAX_READINESS_TEXT_LENGTH = 10_000;
const MAX_READINESS_MODEL_FIELD_LENGTH = 512;
const MAX_TRANSACTION_ATTEMPTS = 3;

export const ORGANIZATION_ACTIVATION_ERROR_CODES = [
  "ORGANIZATION_NOT_FOUND",
  "ACCESS_DENIED",
  "READINESS_FAILED",
  "ACTIVE_EVIDENCE_INVALID",
  "INTERNAL_ERROR",
] as const;

export type OrganizationActivationErrorCode =
  (typeof ORGANIZATION_ACTIVATION_ERROR_CODES)[number];

const ERROR_MESSAGES: Readonly<Record<OrganizationActivationErrorCode, string>> = {
  ORGANIZATION_NOT_FOUND: "Organization not found",
  ACCESS_DENIED: "Organization activation is not allowed",
  READINESS_FAILED: "Organization is not ready to activate",
  ACTIVE_EVIDENCE_INVALID: "Organization activation evidence is invalid",
  INTERNAL_ERROR: "Organization activation failed",
};

export class OrganizationActivationError extends Error {
  readonly code: OrganizationActivationErrorCode;

  constructor(code: OrganizationActivationErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "OrganizationActivationError";
    this.code = code;
    Object.freeze(this);
  }
}

export type OrganizationActivationActor = Readonly<{
  organizationId: string;
  userId: string;
  personId: string;
}>;

export type ActivationOrganizationSnapshot = Readonly<{
  schemaVersion: 1;
  organizationId: string;
  setupStartedAt: string;
  structureIds: readonly string[];
  rootStructureIds: readonly string[];
  activeRoleIds: readonly string[];
  keyRoleIds: readonly string[];
  humanAssignedKeyRoleIds: readonly string[];
  goalCycleIds: readonly string[];
  organizationGoalIds: readonly string[];
  brainProfileId: string | null;
  readinessFacts: Readonly<{
    organizationPurpose: string | null;
    structures: readonly Readonly<{
      id: string;
      parentId: string | null;
      leadPersonId: string | null;
      hasLead: boolean;
      tacticalCadence: string | null;
    }>[];
    roles: readonly Readonly<{
      id: string;
      status: string;
      key: boolean;
      purpose: string | null;
      accountabilities: string | null;
      assigneeIds: readonly string[];
      humanAssigneeIds: readonly string[];
    }>[];
    goalCycleIds: readonly string[];
    rootOrganizationGoalIds: readonly string[];
    brainModel: Readonly<{
      profileId: string | null;
      provider: string | null;
      modelName: string | null;
      keyConfigured: boolean;
      available: boolean;
    }>;
    heldInvitationCount: number;
  }>;
  counts: Readonly<{
    activeStructures: number;
    activeRoles: number;
    keyRoles: number;
    humanAssignedKeyRoles: number;
    goalCycles: number;
    organizationGoals: number;
    heldInvitations: number;
  }>;
}>;

export type OrganizationActivationEvidence = Readonly<{
  id: string;
  schemaVersion: 1;
  checksum: string;
  activatedAt: string;
  actorPersonId: string;
  readiness: OrganizationSetupReadiness;
  organizationSnapshot: ActivationOrganizationSnapshot;
}>;

export type OrganizationActivationResult = Readonly<{
  organizationId: string;
  status: "ACTIVATED" | "ALREADY_ACTIVE";
  activatedAt: string;
  activatedById: string;
  warningCodes: OrganizationSetupReadiness["warningCodes"];
  evidence: OrganizationActivationEvidence;
}>;

type LockedOrganization = Readonly<{
  id: string;
  lifecycleStatus: "SETUP" | "ACTIVE";
  purpose: string | null;
  setupStartedAt: Date;
  activatedAt: Date | null;
  activatedById: string | null;
  activatedByOrganizationId: string | null;
}>;

type ActivationReadinessState = Readonly<{
  organizationSnapshot: ActivationOrganizationSnapshot;
}>;

type StoredActivationSnapshot = Readonly<{
  id: string;
  organizationId: string;
  actorPersonId: string;
  schemaVersion: number;
  readiness: unknown;
  organizationSnapshot: unknown;
  checksum: string;
  activatedAt: Date;
}>;

type StoredActivationEvent = Readonly<{
  actorPersonId: string | null;
  payload: unknown;
}>;

export type OrganizationActivationTransaction = Readonly<{
  lockOrganization(organizationId: string): Promise<boolean>;
  getOrganization(organizationId: string): Promise<LockedOrganization | null>;
  actorIsBound(input: OrganizationActivationActor): Promise<boolean>;
  actorIsOrganizationAdmin(input: OrganizationActivationActor): Promise<boolean>;
  loadReadinessState(
    organization: LockedOrganization,
    now: Date,
  ): Promise<ActivationReadinessState>;
  getActivationSnapshots(organizationId: string): Promise<readonly StoredActivationSnapshot[]>;
  getActivationEvents(organizationId: string): Promise<readonly StoredActivationEvent[]>;
  createActivationSnapshot(input: Readonly<{
    id: string;
    organizationId: string;
    actorPersonId: string;
    readiness: OrganizationSetupReadiness;
    organizationSnapshot: ActivationOrganizationSnapshot;
    checksum: string;
    activatedAt: Date;
  }>): Promise<void>;
  appendActivationEvent(input: Readonly<{
    organizationId: string;
    actorPersonId: string;
    payload: Readonly<Record<string, string | number>>;
  }>): Promise<void>;
  releaseHeldInvitationsForActivation(input: Readonly<{
    organizationId: string;
    releasedAt: Date;
  }>): Promise<number>;
  activateOrganization(input: Readonly<{
    organizationId: string;
    actorPersonId: string;
    activatedAt: Date;
  }>): Promise<void>;
}>;

export type OrganizationActivationDependencies = Readonly<{
  transaction<T>(work: (tx: OrganizationActivationTransaction) => Promise<T>): Promise<T>;
  now(): Date;
  isRetryableTransactionError(error: unknown): boolean;
}>;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

function compareUtf16(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function sortedUnique(values: readonly string[]): readonly string[] {
  return [...new Set(values)].sort(compareUtf16);
}

function normalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(normalizeJson);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort(compareUtf16)
        .map((key) => [key, normalizeJson(value[key]!)]),
    );
  }
  return value;
}

export function canonicalActivationJson(value: JsonValue): string {
  return JSON.stringify(normalizeJson(value));
}

function activationChecksum(
  readiness: OrganizationSetupReadiness,
  organizationSnapshot: ActivationOrganizationSnapshot,
): string {
  return createHash("sha256")
    .update(canonicalActivationJson({
      organizationSnapshot: organizationSnapshot as unknown as JsonValue,
      readiness: readiness as unknown as JsonValue,
      schemaVersion: ACTIVATION_SCHEMA_VERSION,
    }))
    .digest("hex");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).sort(compareUtf16).join("\0") === [...keys].sort(compareUtf16).join("\0");
}

function isSortedUniqueStringArray(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length <= MAX_READINESS_RECORDS
    && value.every((item) => typeof item === "string"
      && item.length > 0
      && item.length <= MAX_READINESS_ID_LENGTH)
    && value.every((item, index) => index === 0 || compareUtf16(value[index - 1]!, item) < 0);
}

function isBoundedNullableText(value: unknown, maxLength = MAX_READINESS_TEXT_LENGTH): value is string | null {
  return value === null || (typeof value === "string" && value.length <= maxLength);
}

function isBoundedId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= MAX_READINESS_ID_LENGTH;
}

function readinessInputFromFacts(
  facts: ActivationOrganizationSnapshot["readinessFacts"],
): OrganizationSetupReadinessInput {
  return {
    organizationPurpose: facts.organizationPurpose,
    structures: facts.structures.map((structure) => ({
      id: structure.id,
      parentId: structure.parentId,
      active: true,
      hasLead: structure.hasLead,
    })),
    roles: facts.roles.map((role) => ({
      id: role.id,
      active: role.status === "ACTIVE",
      key: role.key,
      purpose: role.purpose,
      accountabilities: role.accountabilities,
      assigneeCount: role.assigneeIds.length,
      humanAssigneeCount: role.humanAssigneeIds.length,
    })),
    hasGoalCycle: facts.goalCycleIds.length > 0,
    hasOrganizationGoal: facts.rootOrganizationGoalIds.length > 0,
    meetingCadenceConfigured: facts.structures.length > 0
      && facts.structures.every((structure) => Boolean(structure.tacticalCadence?.trim())),
    brainModelAvailable: facts.brainModel.available,
    heldInvitationCount: facts.heldInvitationCount,
  };
}

function parseReadinessFacts(
  value: unknown,
): ActivationOrganizationSnapshot["readinessFacts"] | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "organizationPurpose",
    "structures",
    "roles",
    "goalCycleIds",
    "rootOrganizationGoalIds",
    "brainModel",
    "heldInvitationCount",
  ])) return null;
  if (!isBoundedNullableText(value.organizationPurpose)
    || !Array.isArray(value.structures)
    || value.structures.length > MAX_READINESS_RECORDS
    || !Array.isArray(value.roles)
    || value.roles.length > MAX_READINESS_RECORDS
    || !isSortedUniqueStringArray(value.goalCycleIds)
    || !isSortedUniqueStringArray(value.rootOrganizationGoalIds)
    || !Number.isSafeInteger(value.heldInvitationCount)
    || Number(value.heldInvitationCount) < 0
    || Number(value.heldInvitationCount) > MAX_READINESS_RECORDS
    || !isRecord(value.brainModel)) return null;

  const structures: Array<ActivationOrganizationSnapshot["readinessFacts"]["structures"][number]> = [];
  for (const item of value.structures) {
    if (!isRecord(item) || !hasExactKeys(item, [
      "id", "parentId", "leadPersonId", "hasLead", "tacticalCadence",
    ])) return null;
    if (!isBoundedId(item.id)
      || (item.parentId !== null && !isBoundedId(item.parentId))
      || (item.leadPersonId !== null && !isBoundedId(item.leadPersonId))
      || typeof item.hasLead !== "boolean"
      || item.hasLead !== Boolean(item.leadPersonId)
      || !isBoundedNullableText(item.tacticalCadence)) return null;
    structures.push({
      id: item.id,
      parentId: item.parentId as string | null,
      leadPersonId: item.leadPersonId as string | null,
      hasLead: item.hasLead,
      tacticalCadence: item.tacticalCadence,
    });
  }
  if (!structures.every((item, index) => index === 0
    || compareUtf16(structures[index - 1]!.id, item.id) < 0)) return null;

  const roles: Array<ActivationOrganizationSnapshot["readinessFacts"]["roles"][number]> = [];
  let assignmentCount = 0;
  for (const item of value.roles) {
    if (!isRecord(item) || !hasExactKeys(item, [
      "id", "status", "key", "purpose", "accountabilities", "assigneeIds", "humanAssigneeIds",
    ])) return null;
    if (!isBoundedId(item.id)
      || !isBoundedId(item.status)
      || typeof item.key !== "boolean"
      || !isBoundedNullableText(item.purpose)
      || !isBoundedNullableText(item.accountabilities)
      || !isSortedUniqueStringArray(item.assigneeIds)
      || !isSortedUniqueStringArray(item.humanAssigneeIds)) return null;
    const assigneeIds = item.assigneeIds;
    const humanAssigneeIds = item.humanAssigneeIds;
    assignmentCount += assigneeIds.length;
    if (assignmentCount > MAX_READINESS_RECORDS
      || !humanAssigneeIds.every((id) => assigneeIds.includes(id))) return null;
    roles.push({
      id: item.id,
      status: item.status,
      key: item.key,
      purpose: item.purpose,
      accountabilities: item.accountabilities,
      assigneeIds: [...assigneeIds],
      humanAssigneeIds: [...humanAssigneeIds],
    });
  }
  if (!roles.every((item, index) => index === 0
    || compareUtf16(roles[index - 1]!.id, item.id) < 0)) return null;

  const brainModel = value.brainModel;
  if (!hasExactKeys(brainModel, [
    "profileId", "provider", "modelName", "keyConfigured", "available",
  ])
    || (brainModel.profileId !== null && !isBoundedId(brainModel.profileId))
    || !isBoundedNullableText(brainModel.provider, MAX_READINESS_MODEL_FIELD_LENGTH)
    || !isBoundedNullableText(brainModel.modelName, MAX_READINESS_MODEL_FIELD_LENGTH)
    || typeof brainModel.keyConfigured !== "boolean"
    || typeof brainModel.available !== "boolean") return null;
  const expectedAvailability = brainModel.profileId !== null && (
    brainModel.provider === "system"
    || Boolean(brainModel.modelName?.trim() && brainModel.keyConfigured)
  );
  if (brainModel.available !== expectedAvailability) return null;

  return deepFreeze({
    organizationPurpose: value.organizationPurpose,
    structures,
    roles,
    goalCycleIds: [...value.goalCycleIds],
    rootOrganizationGoalIds: [...value.rootOrganizationGoalIds],
    brainModel: {
      profileId: brainModel.profileId as string | null,
      provider: brainModel.provider,
      modelName: brainModel.modelName,
      keyConfigured: brainModel.keyConfigured,
      available: brainModel.available,
    },
    heldInvitationCount: Number(value.heldInvitationCount),
  });
}

function parseReadiness(value: unknown): OrganizationSetupReadiness | null {
  if (!isRecord(value) || !hasExactKeys(value, [
    "readyToActivate",
    "hardGates",
    "failedHardGateCodes",
    "warningCodes",
  ])) return null;
  if (value.readyToActivate !== true || !isRecord(value.hardGates)) return null;
  const hardGates = value.hardGates as Record<string, unknown>;
  if (!hasExactKeys(hardGates, ORGANIZATION_SETUP_HARD_GATE_CODES)) return null;
  if (!ORGANIZATION_SETUP_HARD_GATE_CODES.every((code) => hardGates[code] === true)) return null;
  if (!Array.isArray(value.failedHardGateCodes) || value.failedHardGateCodes.length !== 0) return null;
  if (!Array.isArray(value.warningCodes)) return null;
  if (!value.warningCodes.every((code) => ORGANIZATION_SETUP_WARNING_CODES.includes(code as never))) return null;
  if (new Set(value.warningCodes).size !== value.warningCodes.length) return null;
  const warningOrder = new Map(ORGANIZATION_SETUP_WARNING_CODES.map((code, index) => [code, index]));
  if (!value.warningCodes.every((code, index, all) => index === 0
    || warningOrder.get(all[index - 1] as never)! < warningOrder.get(code as never)!)) return null;
  return deepFreeze({
    readyToActivate: true,
    hardGates: { ...hardGates } as OrganizationSetupReadiness["hardGates"],
    failedHardGateCodes: [],
    warningCodes: [...value.warningCodes] as OrganizationSetupReadiness["warningCodes"],
  });
}

function parseOrganizationSnapshot(value: unknown): ActivationOrganizationSnapshot | null {
  const keys = [
    "schemaVersion",
    "organizationId",
    "setupStartedAt",
    "structureIds",
    "rootStructureIds",
    "activeRoleIds",
    "keyRoleIds",
    "humanAssignedKeyRoleIds",
    "goalCycleIds",
    "organizationGoalIds",
    "brainProfileId",
    "readinessFacts",
    "counts",
  ] as const;
  if (!isRecord(value) || !hasExactKeys(value, keys)) return null;
  if (value.schemaVersion !== ACTIVATION_SCHEMA_VERSION) return null;
  if (typeof value.organizationId !== "string" || typeof value.setupStartedAt !== "string") return null;
  if (Number.isNaN(Date.parse(value.setupStartedAt))) return null;
  if (value.brainProfileId !== null && !isBoundedId(value.brainProfileId)) return null;
  const readinessFacts = parseReadinessFacts(value.readinessFacts);
  if (!readinessFacts) return null;
  const arrays = [
    value.structureIds,
    value.rootStructureIds,
    value.activeRoleIds,
    value.keyRoleIds,
    value.humanAssignedKeyRoleIds,
    value.goalCycleIds,
    value.organizationGoalIds,
  ];
  if (!arrays.every(isSortedUniqueStringArray) || !isRecord(value.counts)) return null;
  const countKeys = [
    "activeStructures",
    "activeRoles",
    "keyRoles",
    "humanAssignedKeyRoles",
    "goalCycles",
    "organizationGoals",
    "heldInvitations",
  ] as const;
  if (!hasExactKeys(value.counts, countKeys)) return null;
  const counts = value.counts as Record<string, unknown>;
  if (!countKeys.every((key) => Number.isSafeInteger(counts[key]) && Number(counts[key]) >= 0)) return null;
  const expectedLengths: ReadonlyArray<readonly [unknown, string]> = [
    [value.structureIds, "activeStructures"],
    [value.activeRoleIds, "activeRoles"],
    [value.keyRoleIds, "keyRoles"],
    [value.humanAssignedKeyRoleIds, "humanAssignedKeyRoles"],
    [value.goalCycleIds, "goalCycles"],
    [value.organizationGoalIds, "organizationGoals"],
  ];
  if (!expectedLengths.every(([array, key]) => (array as unknown[]).length === counts[key])) return null;
  const activeRoles = readinessFacts.roles.filter((role) => role.status === "ACTIVE");
  const keyRoles = activeRoles.filter((role) => role.key);
  const humanAssignedKeyRoles = keyRoles.filter((role) => role.humanAssigneeIds.length > 0);
  const matches = (left: unknown, right: unknown) => canonicalActivationJson(left as JsonValue)
    === canonicalActivationJson(right as JsonValue);
  if (!matches(value.structureIds, readinessFacts.structures.map((item) => item.id))
    || !matches(value.rootStructureIds, readinessFacts.structures
      .filter((item) => item.parentId === null).map((item) => item.id))
    || !matches(value.activeRoleIds, activeRoles.map((item) => item.id))
    || !matches(value.keyRoleIds, keyRoles.map((item) => item.id))
    || !matches(value.humanAssignedKeyRoleIds, humanAssignedKeyRoles.map((item) => item.id))
    || !matches(value.goalCycleIds, readinessFacts.goalCycleIds)
    || !matches(value.organizationGoalIds, readinessFacts.rootOrganizationGoalIds)
    || value.brainProfileId !== readinessFacts.brainModel.profileId
    || counts.heldInvitations !== readinessFacts.heldInvitationCount) return null;
  return deepFreeze({
    schemaVersion: ACTIVATION_SCHEMA_VERSION,
    organizationId: value.organizationId,
    setupStartedAt: value.setupStartedAt,
    structureIds: [...value.structureIds as string[]],
    rootStructureIds: [...value.rootStructureIds as string[]],
    activeRoleIds: [...value.activeRoleIds as string[]],
    keyRoleIds: [...value.keyRoleIds as string[]],
    humanAssignedKeyRoleIds: [...value.humanAssignedKeyRoleIds as string[]],
    goalCycleIds: [...value.goalCycleIds as string[]],
    organizationGoalIds: [...value.organizationGoalIds as string[]],
    brainProfileId: value.brainProfileId as string | null,
    readinessFacts,
    counts: { ...counts } as ActivationOrganizationSnapshot["counts"],
  });
}

function activationResult(
  status: OrganizationActivationResult["status"],
  organization: LockedOrganization,
  evidence: OrganizationActivationEvidence,
): OrganizationActivationResult {
  return deepFreeze({
    organizationId: organization.id,
    status,
    activatedAt: evidence.activatedAt,
    activatedById: evidence.actorPersonId,
    warningCodes: [...evidence.readiness.warningCodes],
    evidence,
  });
}

async function validateActiveEvidence(
  tx: OrganizationActivationTransaction,
  organization: LockedOrganization,
): Promise<OrganizationActivationResult> {
  if (!organization.activatedAt
    || !organization.activatedById
    || organization.activatedByOrganizationId !== organization.id) {
    throw new OrganizationActivationError("ACTIVE_EVIDENCE_INVALID");
  }
  const [snapshots, events] = await Promise.all([
    tx.getActivationSnapshots(organization.id),
    tx.getActivationEvents(organization.id),
  ]);
  if (snapshots.length !== 1 || events.length !== 1) {
    throw new OrganizationActivationError("ACTIVE_EVIDENCE_INVALID");
  }
  const stored = snapshots[0]!;
  const readiness = parseReadiness(stored.readiness);
  const organizationSnapshot = parseOrganizationSnapshot(stored.organizationSnapshot);
  const recomputedReadiness = organizationSnapshot
    ? evaluateOrganizationSetupReadiness(readinessInputFromFacts(organizationSnapshot.readinessFacts))
    : null;
  if (!readiness || !organizationSnapshot
    || !recomputedReadiness
    || canonicalActivationJson(readiness as unknown as JsonValue)
      !== canonicalActivationJson(recomputedReadiness as unknown as JsonValue)
    || stored.schemaVersion !== ACTIVATION_SCHEMA_VERSION
    || stored.organizationId !== organization.id
    || stored.actorPersonId !== organization.activatedById
    || organizationSnapshot.organizationId !== organization.id
    || stored.activatedAt.getTime() !== organization.activatedAt.getTime()
    || !/^[a-f0-9]{64}$/.test(stored.checksum)
    || activationChecksum(readiness, organizationSnapshot) !== stored.checksum) {
    throw new OrganizationActivationError("ACTIVE_EVIDENCE_INVALID");
  }
  const event = events[0]!;
  const expectedPayload = {
    activatedAt: stored.activatedAt.toISOString(),
    activationSnapshotId: stored.id,
    checksum: stored.checksum,
    schemaVersion: ACTIVATION_SCHEMA_VERSION,
  };
  if (event.actorPersonId !== stored.actorPersonId
    || canonicalActivationJson(event.payload as JsonValue) !== canonicalActivationJson(expectedPayload)) {
    throw new OrganizationActivationError("ACTIVE_EVIDENCE_INVALID");
  }
  const evidence = deepFreeze({
    id: stored.id,
    schemaVersion: ACTIVATION_SCHEMA_VERSION,
    checksum: stored.checksum,
    activatedAt: stored.activatedAt.toISOString(),
    actorPersonId: stored.actorPersonId,
    readiness,
    organizationSnapshot,
  });
  return activationResult("ALREADY_ACTIVE", organization, evidence);
}

function validateActorInput(actor: OrganizationActivationActor): void {
  if (!actor.organizationId.trim() || !actor.userId.trim() || !actor.personId.trim()) {
    throw new OrganizationActivationError("ACCESS_DENIED");
  }
}

async function activateInTransaction(
  actor: OrganizationActivationActor,
  now: Date,
  tx: OrganizationActivationTransaction,
): Promise<OrganizationActivationResult> {
  const locked = await tx.lockOrganization(actor.organizationId);
  if (!locked) throw new OrganizationActivationError("ORGANIZATION_NOT_FOUND");
  const organization = await tx.getOrganization(actor.organizationId);
  if (!organization) throw new OrganizationActivationError("ORGANIZATION_NOT_FOUND");
  if (!await tx.actorIsBound(actor) || !await tx.actorIsOrganizationAdmin(actor)) {
    throw new OrganizationActivationError("ACCESS_DENIED");
  }
  if (organization.lifecycleStatus === "ACTIVE") {
    return validateActiveEvidence(tx, organization);
  }

  const state = await tx.loadReadinessState(organization, now);
  const organizationSnapshot = parseOrganizationSnapshot(state.organizationSnapshot);
  if (!organizationSnapshot) throw new Error("activation readiness facts are invalid or exceed limits");
  const readiness = deepFreeze(evaluateOrganizationSetupReadiness(
    readinessInputFromFacts(organizationSnapshot.readinessFacts),
  ));
  if (!readiness.readyToActivate) throw new OrganizationActivationError("READINESS_FAILED");

  const checksum = activationChecksum(readiness, organizationSnapshot);
  const snapshotId = randomUUID();
  await tx.createActivationSnapshot({
    id: snapshotId,
    organizationId: organization.id,
    actorPersonId: actor.personId,
    readiness,
    organizationSnapshot,
    checksum,
    activatedAt: now,
  });
  await tx.appendActivationEvent({
    organizationId: organization.id,
    actorPersonId: actor.personId,
    payload: {
      activatedAt: now.toISOString(),
      activationSnapshotId: snapshotId,
      checksum,
      schemaVersion: ACTIVATION_SCHEMA_VERSION,
    },
  });
  await tx.releaseHeldInvitationsForActivation({
    organizationId: organization.id,
    releasedAt: now,
  });
  await tx.activateOrganization({
    organizationId: organization.id,
    actorPersonId: actor.personId,
    activatedAt: now,
  });

  const evidence = deepFreeze({
    id: snapshotId,
    schemaVersion: ACTIVATION_SCHEMA_VERSION,
    checksum,
    activatedAt: now.toISOString(),
    actorPersonId: actor.personId,
    readiness,
    organizationSnapshot,
  });
  return activationResult("ACTIVATED", {
    ...organization,
    lifecycleStatus: "ACTIVE",
    activatedAt: now,
    activatedById: actor.personId,
    activatedByOrganizationId: organization.id,
  }, evidence);
}

export async function activateOrganization(
  actor: OrganizationActivationActor,
  dependencies: OrganizationActivationDependencies = createPrismaOrganizationActivationDependencies(),
): Promise<OrganizationActivationResult> {
  try {
    validateActorInput(actor);
  } catch (error) {
    if (error instanceof OrganizationActivationError) throw error;
    throw new OrganizationActivationError("ACCESS_DENIED");
  }

  for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt += 1) {
    try {
      const now = dependencies.now();
      return await dependencies.transaction((tx) => activateInTransaction(actor, now, tx));
    } catch (error) {
      if (error instanceof OrganizationActivationError) throw error;
      if (attempt < MAX_TRANSACTION_ATTEMPTS && dependencies.isRetryableTransactionError(error)) continue;
      throw new OrganizationActivationError("INTERNAL_ERROR");
    }
  }
  throw new OrganizationActivationError("INTERNAL_ERROR");
}

function prismaTransactionStore(tx: Prisma.TransactionClient): OrganizationActivationTransaction {
  return {
    async lockOrganization(organizationId) {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT "id" FROM "organizations" WHERE "id" = ${organizationId} FOR UPDATE`,
      );
      return rows.length === 1;
    },
    getOrganization(organizationId) {
      return tx.organization.findUnique({
        where: { id: organizationId },
        select: {
          id: true,
          lifecycleStatus: true,
          purpose: true,
          setupStartedAt: true,
          activatedAt: true,
          activatedById: true,
          activatedByOrganizationId: true,
        },
      });
    },
    async actorIsBound(input) {
      return Boolean(await tx.person.findFirst({
        where: {
          id: input.personId,
          organizationId: input.organizationId,
          userId: input.userId,
        },
        select: { id: true },
      }));
    },
    async actorIsOrganizationAdmin(input) {
      const membership = await tx.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: input.userId,
            organizationId: input.organizationId,
          },
        },
        select: { role: true },
      });
      return membership?.role === "ORG_ADMIN";
    },
    async loadReadinessState(organization, now) {
      const [circles, roles, goalCycles, brainProfile, heldInvitationCount] = await Promise.all([
        tx.circle.findMany({
          where: { organizationId: organization.id, status: { not: "ARCHIVED" } },
          orderBy: { id: "asc" },
          take: MAX_READINESS_RECORDS + 1,
          select: {
            id: true,
            parentId: true,
            leadPersonId: true,
            tacticalCadence: true,
          },
        }),
        tx.roleDef.findMany({
          where: { organizationId: organization.id },
          orderBy: { id: "asc" },
          take: MAX_READINESS_RECORDS + 1,
          select: {
            id: true,
            status: true,
            category: true,
            purpose: true,
            accountabilities: true,
            assignees: {
              where: { organizationId: organization.id },
              orderBy: { id: "asc" },
              take: MAX_READINESS_RECORDS + 1,
              select: { id: true, entityType: true },
            },
          },
        }),
        tx.goalCycle.findMany({
          where: { organizationId: organization.id, status: { in: ["PLANNED", "ACTIVE"] } },
          orderBy: { id: "asc" },
          take: MAX_READINESS_RECORDS + 1,
          select: { id: true },
        }),
        tx.organizationBrainProfile.findUnique({
          where: { organizationId: organization.id },
          select: {
            id: true,
            modelProvider: true,
            modelName: true,
            modelApiKeyCiphertext: true,
          },
        }),
        tx.organizationInvitation.count({
          where: {
            organizationId: organization.id,
            revokedAt: null,
            consumedAt: null,
            expiresAt: { gt: now },
          },
        }),
      ]);
      if (circles.length > MAX_READINESS_RECORDS
        || roles.length > MAX_READINESS_RECORDS
        || goalCycles.length > MAX_READINESS_RECORDS
        || roles.reduce((count, role) => count + role.assignees.length, 0) > MAX_READINESS_RECORDS
        || heldInvitationCount > MAX_READINESS_RECORDS) {
        throw new Error("activation evidence exceeds bounded record limit");
      }
      const rootStructureIds = circles.filter((circle) => circle.parentId === null).map((circle) => circle.id);
      const organizationGoals = rootStructureIds.length === 0 ? [] : await tx.goal.findMany({
        where: {
          organizationId: organization.id,
          status: "ACTIVE",
          circleId: { in: rootStructureIds },
        },
        orderBy: { id: "asc" },
        take: MAX_READINESS_RECORDS + 1,
        select: { id: true },
      });
      if (organizationGoals.length > MAX_READINESS_RECORDS) {
        throw new Error("activation evidence exceeds bounded record limit");
      }
      const activeRoles = roles.filter((role) => role.status === "ACTIVE");
      const keyRoles = activeRoles.filter((role) => role.category === "CIRCLE_LEAD");
      const humanAssignedKeyRoles = keyRoles.filter((role) => role.assignees.some(
        (assignee) => assignee.entityType === "HUMAN",
      ));
      const brainModelAvailable = Boolean(brainProfile && (
        brainProfile.modelProvider === "system"
        || (brainProfile.modelName?.trim() && brainProfile.modelApiKeyCiphertext)
      ));
      const readinessFacts: ActivationOrganizationSnapshot["readinessFacts"] = {
        organizationPurpose: organization.purpose,
        structures: circles.map((circle) => ({
          id: circle.id,
          parentId: circle.parentId,
          leadPersonId: circle.leadPersonId,
          hasLead: Boolean(circle.leadPersonId),
          tacticalCadence: circle.tacticalCadence,
        })).sort((left, right) => compareUtf16(left.id, right.id)),
        roles: roles.map((role) => ({
          id: role.id,
          status: role.status,
          key: role.category === "CIRCLE_LEAD",
          purpose: role.purpose,
          accountabilities: role.accountabilities,
          assigneeIds: sortedUnique(role.assignees.map((assignee) => assignee.id)),
          humanAssigneeIds: sortedUnique(role.assignees
            .filter((assignee) => assignee.entityType === "HUMAN")
            .map((assignee) => assignee.id)),
        })).sort((left, right) => compareUtf16(left.id, right.id)),
        goalCycleIds: sortedUnique(goalCycles.map((cycle) => cycle.id)),
        rootOrganizationGoalIds: sortedUnique(organizationGoals.map((goal) => goal.id)),
        brainModel: {
          profileId: brainProfile?.id ?? null,
          provider: brainProfile?.modelProvider ?? null,
          modelName: brainProfile?.modelName ?? null,
          keyConfigured: Boolean(brainProfile?.modelApiKeyCiphertext),
          available: brainModelAvailable,
        },
        heldInvitationCount,
      };
      const rawSnapshot = {
        schemaVersion: ACTIVATION_SCHEMA_VERSION,
        organizationId: organization.id,
        setupStartedAt: organization.setupStartedAt.toISOString(),
        structureIds: sortedUnique(circles.map((circle) => circle.id)),
        rootStructureIds: sortedUnique(rootStructureIds),
        activeRoleIds: sortedUnique(activeRoles.map((role) => role.id)),
        keyRoleIds: sortedUnique(keyRoles.map((role) => role.id)),
        humanAssignedKeyRoleIds: sortedUnique(humanAssignedKeyRoles.map((role) => role.id)),
        goalCycleIds: sortedUnique(goalCycles.map((cycle) => cycle.id)),
        organizationGoalIds: sortedUnique(organizationGoals.map((goal) => goal.id)),
        brainProfileId: brainProfile?.id ?? null,
        readinessFacts,
        counts: {
          activeStructures: circles.length,
          activeRoles: activeRoles.length,
          keyRoles: keyRoles.length,
          humanAssignedKeyRoles: humanAssignedKeyRoles.length,
          goalCycles: goalCycles.length,
          organizationGoals: organizationGoals.length,
          heldInvitations: heldInvitationCount,
        },
      };
      const organizationSnapshot = parseOrganizationSnapshot(rawSnapshot);
      if (!organizationSnapshot) throw new Error("activation readiness facts are invalid or exceed limits");
      return { organizationSnapshot };
    },
    getActivationSnapshots(organizationId) {
      return tx.organizationActivationSnapshot.findMany({
        where: { organizationId },
        orderBy: { id: "asc" },
        take: 2,
        select: {
          id: true,
          organizationId: true,
          actorPersonId: true,
          schemaVersion: true,
          readiness: true,
          organizationSnapshot: true,
          checksum: true,
          activatedAt: true,
        },
      });
    },
    getActivationEvents(organizationId) {
      return tx.organizationSetupEvent.findMany({
        where: { organizationId, type: "ACTIVATED" },
        orderBy: { id: "asc" },
        take: 2,
        select: { actorPersonId: true, payload: true },
      });
    },
    async createActivationSnapshot(input) {
      await tx.organizationActivationSnapshot.create({
        data: {
          id: input.id,
          organizationId: input.organizationId,
          actorPersonId: input.actorPersonId,
          schemaVersion: ACTIVATION_SCHEMA_VERSION,
          readiness: input.readiness as unknown as Prisma.InputJsonValue,
          organizationSnapshot: input.organizationSnapshot as unknown as Prisma.InputJsonValue,
          checksum: input.checksum,
          activatedAt: input.activatedAt,
        },
        select: { id: true },
      });
    },
    async appendActivationEvent(input) {
      await tx.organizationSetupEvent.create({
        data: {
          organizationId: input.organizationId,
          type: "ACTIVATED",
          actorPersonId: input.actorPersonId,
          payload: input.payload as Prisma.InputJsonValue,
        },
        select: { id: true },
      });
    },
    async releaseHeldInvitationsForActivation(input) {
      const rows = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
        WITH eligible AS (
          SELECT "id"
          FROM "organization_invitations"
          WHERE "organizationId" = ${input.organizationId}
            AND "deliveryMode" = 'HELD'
            AND "releasedAt" IS NULL
            AND "deliveryCompletedAt" IS NULL
            AND "revokedAt" IS NULL
            AND "consumedAt" IS NULL
            AND "expiresAt" > ${input.releasedAt}
            AND "deliveryTokenCiphertext" IS NOT NULL
          FOR UPDATE
        ), released AS (
          UPDATE "organization_invitations" invitation
          SET "deliveryMode" = 'IMMEDIATE',
              "releasedAt" = ${input.releasedAt},
              "updatedAt" = ${input.releasedAt}
          FROM eligible
          WHERE invitation."id" = eligible."id"
            AND invitation."organizationId" = ${input.organizationId}
          RETURNING invitation."id"
        )
        INSERT INTO "organization_invitation_delivery_jobs" (
          "id", "organizationId", "invitationId", "status", "attemptCount", "maxAttempts",
          "availableAt", "createdAt", "updatedAt"
        )
        SELECT
          gen_random_uuid()::text,
          ${input.organizationId},
          released."id",
          'PENDING',
          0,
          ${DEFAULT_MAX_ATTEMPTS},
          ${input.releasedAt},
          ${input.releasedAt},
          ${input.releasedAt}
        FROM released
        ON CONFLICT ("invitationId") DO NOTHING
        RETURNING "invitationId" AS "id"
      `);
      return rows.length;
    },
    async activateOrganization(input) {
      await tx.organization.update({
        where: { id: input.organizationId },
        data: {
          lifecycleStatus: "ACTIVE",
          activatedAt: input.activatedAt,
          activatedById: input.actorPersonId,
          activatedByOrganizationId: input.organizationId,
        },
        select: { id: true },
      });
    },
  };
}

export function createPrismaOrganizationActivationDependencies(
  client: PrismaClient = prisma,
): OrganizationActivationDependencies {
  return {
    transaction(work) {
      return client.$transaction(
        (tx) => work(prismaTransactionStore(tx)),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    },
    now: () => new Date(),
    isRetryableTransactionError(error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        return error.code === "P2034"
          || (error.code === "P2010" && (error.message.includes("40001") || error.message.includes("40P01")));
      }
      if (!isRecord(error)) return false;
      if (error.code === "40001" || error.code === "40P01") return true;
      const cause = isRecord(error.cause) ? error.cause : null;
      return cause?.originalCode === "40001" || cause?.originalCode === "40P01";
    },
  };
}
