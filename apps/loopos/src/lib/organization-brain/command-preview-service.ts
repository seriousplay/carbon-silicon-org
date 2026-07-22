import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { resolveActorContext } from "../authorization/actor-context";
import {
  confirmBrainCommandPreviewForActor,
  listBrainCommandPreviewsForActor,
  previewSummary,
  type BrainCommandPreviewConfirmOutput,
} from "./command-preview-core";
import {
  BrainCommandPreviewServiceError,
  type BrainCommandPreviewConfirmInput,
  type BrainCommandPreviewList,
  type BrainCommandPreviewListInput,
  type BrainCommandPreviewSummary,
} from "./command-preview-types";
import type { BrainGoalCommandActor } from "./goal-command-handler";
import {
  BRAIN_COMMAND_REGISTRY,
  hashBrainCommandBinding,
  parseBrainCommandServerPayload,
  type BrainCommandSourceBinding,
} from "./command-registry";
import { createLedgerForMeetingLifecycle } from "./meeting-preview-lifecycle-gate";

const DEFAULT_LIMIT = 12;
const MAX_LIMIT = 30;
const MAX_ID_BYTES = 191;
const MAX_MUTATION_KEY_BYTES = 128;
const PREVIEW_TTL_MS = 15 * 60_000;

const brainPreviewSelect = {
  id: true,
  conversationId: true,
  userMessageId: true,
  commandName: true,
  commandSchemaVersion: true,
  humanDiff: true,
  previewExpiresAt: true,
  createdAt: true,
  status: true,
  terminalCode: true,
  terminalResult: true,
} as const;

export {
  BrainCommandPreviewServiceError,
  type BrainCommandPreviewConfirmInput,
  type BrainCommandPreviewList,
  type BrainCommandPreviewListInput,
  type BrainCommandPreviewSummary,
} from "./command-preview-types";
export { type BrainCommandPreviewConfirmOutput } from "./command-preview-core";

export type GovernanceProposalPreviewInput = Readonly<{
  conversationId: string;
  userMessageId: string;
  tensionId: string;
  meetingId: string;
  currentStructure: string;
  proposedStructure: string;
  rationale: string;
  expectedImpact: string;
  structuralChange: unknown;
}>;

export type GovernanceProposalContext = Readonly<{
  tensions: readonly Readonly<{ id: string; title: string; description: string }>[],
  meetings: readonly Readonly<{ id: string; title: string; startedAt: string }>[],
  circles: readonly Readonly<{ id: string; name: string }>[],
  latestUserMessageId: string | null,
}>;

export type RoleApplicationPreviewInput = Readonly<{
  conversationId: string;
  userMessageId: string;
  roleId: string;
  motivation: string;
  capabilitySummary: string;
  commitment: string;
}>;

export type TensionRaiseContext = Readonly<{
  circles: readonly Readonly<{ id: string; name: string }>[];
  latestUserMessageId: string | null;
}>;

export type TensionRaisePreviewInput = Readonly<{
  conversationId: string;
  userMessageId: string;
  title: string;
  description: string;
  type: "PROBLEMATIC" | "CONSTRUCTIVE" | "CLARIFYING";
  circleIds: readonly string[];
  handlingMode: "UNROUTED" | "TACTICAL" | "GOVERNANCE";
}>;

export type TacticalOutcomeContext = Readonly<{
  tensions: readonly Readonly<{ id: string; title: string; description: string; revision: number }>[],
  meetings: readonly Readonly<{ id: string; title: string; startedAt: string }>[],
  circles: readonly Readonly<{ id: string; name: string }>[],
  people: readonly Readonly<{ id: string; name: string }>[],
  latestUserMessageId: string | null,
}>;

export type TacticalOutcomePreviewInput = Readonly<{
  conversationId: string;
  userMessageId: string;
  tensionId: string;
  meetingId: string;
  expectedRevision: number;
  kind: "PROJECT" | "ACTION";
  title: string;
  description: string;
  circleId: string;
  responsiblePersonId: string;
  dueDate?: string;
}>;

export async function listTacticalOutcomeContext(): Promise<TacticalOutcomeContext> {
  const actor = await resolveActorContext();
  const [tensions, meetings, circles, people, latest] = await Promise.all([
    prisma.tension.findMany({
      where: { organizationId: actor.organizationId, raiserId: actor.personId, status: "OPEN", handlingMode: "TACTICAL" },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: { id: true, title: true, description: true },
    }),
    prisma.meeting.findMany({ where: { organizationId: actor.organizationId, type: "TACTICAL", endedAt: null }, orderBy: { startedAt: "desc" }, take: 20, select: { id: true, title: true, startedAt: true } }),
    prisma.circle.findMany({ where: { organizationId: actor.organizationId, status: "NORMAL" }, orderBy: { name: "asc" }, take: 50, select: { id: true, name: true } }),
    prisma.person.findMany({ where: { organizationId: actor.organizationId }, orderBy: { name: "asc" }, take: 100, select: { id: true, name: true } }),
    prisma.brainMessage.findFirst({ where: { organizationId: actor.organizationId, role: "USER", conversation: { ownerId: actor.personId } }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);
  return Object.freeze({
    tensions: Object.freeze(tensions.map((tension) => Object.freeze({ ...tension, revision: 0 }))),
    meetings: Object.freeze(meetings.map((meeting) => Object.freeze({ ...meeting, startedAt: meeting.startedAt.toISOString() }))),
    circles: Object.freeze(circles),
    people: Object.freeze(people),
    latestUserMessageId: latest?.id ?? null,
  });
}

export async function createTacticalOutcomePreview(input: TacticalOutcomePreviewInput): Promise<BrainCommandPreviewSummary> {
  const actor = await resolveActorContext();
  const required = dataObject(input, ["conversationId", "userMessageId", "tensionId", "meetingId", "expectedRevision", "kind", "title", "description", "circleId", "responsiblePersonId"], ["dueDate"]);
  if (!required) fail("INVALID_INPUT");
  const [tension, meeting, circle, person, conversation, message] = await Promise.all([
    prisma.tension.findFirst({ where: { id: input.tensionId, organizationId: actor.organizationId, raiserId: actor.personId, status: "OPEN", handlingMode: "TACTICAL" }, select: { id: true, updatedAt: true } }),
    prisma.meeting.findFirst({ where: { id: input.meetingId, organizationId: actor.organizationId, type: "TACTICAL", endedAt: null }, select: { id: true, startedAt: true, createdAt: true } }),
    prisma.circle.findFirst({ where: { id: input.circleId, organizationId: actor.organizationId, status: "NORMAL" }, select: { id: true, updatedAt: true } }),
    prisma.person.findFirst({ where: { id: input.responsiblePersonId, organizationId: actor.organizationId }, select: { id: true, updatedAt: true } }),
    prisma.brainConversation.findFirst({ where: { id: input.conversationId, organizationId: actor.organizationId, ownerId: actor.personId }, select: { id: true } }),
    prisma.brainMessage.findFirst({ where: { id: input.userMessageId, conversationId: input.conversationId, organizationId: actor.organizationId, role: "USER" }, select: { id: true } }),
  ]);
  if (!tension || !meeting || !circle || !person || !conversation || !message || input.expectedRevision !== 0) fail("ACCESS_DENIED");
  const payload = parseBrainCommandServerPayload({
    command: "tactical_outcome.submit_proposal",
    tensionId: tension.id,
    meetingId: meeting.id,
    expectedRevision: 0,
    kind: input.kind,
    title: input.title,
    description: input.description,
    responsibility: `${input.circleId}:${input.responsiblePersonId}`,
    circleId: input.circleId,
    responsiblePersonId: input.responsiblePersonId,
    ...(input.dueDate ? { dueDate: input.dueDate } : {}),
  });
  const sourceBindings: readonly BrainCommandSourceBinding[] = [
    { objectType: "tension", objectId: tension.id, sourceVersionAt: tension.updatedAt.toISOString(), status: "OPEN", revision: 0 },
    { objectType: "meeting", objectId: meeting.id, sourceVersionAt: meeting.createdAt.toISOString() },
    { objectType: "circle", objectId: circle.id, sourceVersionAt: circle.updatedAt.toISOString(), status: "NORMAL" },
  ];
  const metadata = BRAIN_COMMAND_REGISTRY["tactical_outcome.submit_proposal"];
  const createdAt = new Date();
  const row = await createMeetingPreviewLedger(actor.organizationId, { data: { organizationId: actor.organizationId, ownerUserId: actor.userId, actorId: actor.personId, conversationId: conversation.id, userMessageId: message.id, commandName: payload.command, commandSchemaVersion: 1, serverPayload: payload, payloadHash: hashBrainCommandBinding(payload as never), sourceBindings, sourceBindingHash: hashBrainCommandBinding(sourceBindings as never), humanDiff: metadata.formatHumanDiff(payload), createdAt, previewExpiresAt: new Date(createdAt.getTime() + PREVIEW_TTL_MS) }, select: brainPreviewSelect });
  return previewSummary(row, createdAt);
}

export async function listTensionRaiseContext(): Promise<TensionRaiseContext> {
  const actor = await resolveActorContext();
  const circleIds = [...new Set([actor.homeCircleId, ...actor.ledActiveCircleIds])];
  const [circles, latest] = await Promise.all([
    prisma.circle.findMany({ where: { organizationId: actor.organizationId, id: { in: circleIds } }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brainMessage.findFirst({ where: { organizationId: actor.organizationId, role: "USER", conversation: { ownerId: actor.personId } }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);
  return Object.freeze({ circles: Object.freeze(circles), latestUserMessageId: latest?.id ?? null });
}

export async function createTensionRaisePreview(input: TensionRaisePreviewInput): Promise<BrainCommandPreviewSummary> {
  const actor = await resolveActorContext();
  const required = dataObject(input, ["conversationId", "userMessageId", "title", "description", "type", "circleIds", "handlingMode"]);
  if (!required) throw new BrainCommandPreviewServiceError("INVALID_INPUT");
  const circleIds = [...input.circleIds];
  const circles = await prisma.circle.findMany({ where: { organizationId: actor.organizationId, id: { in: circleIds } }, select: { id: true, updatedAt: true } });
  if (circles.length !== input.circleIds.length || circles.some((circle) => ![actor.homeCircleId, ...actor.ledActiveCircleIds].includes(circle.id))) throw new BrainCommandPreviewServiceError("ACCESS_DENIED");
  const [conversation, message] = await Promise.all([
    prisma.brainConversation.findFirst({ where: { id: input.conversationId, organizationId: actor.organizationId, ownerId: actor.personId }, select: { id: true } }),
    prisma.brainMessage.findFirst({ where: { id: input.userMessageId, conversationId: input.conversationId, organizationId: actor.organizationId, role: "USER" }, select: { id: true } }),
  ]);
  if (!conversation || !message) throw new BrainCommandPreviewServiceError("ACCESS_DENIED");
  const payload = parseBrainCommandServerPayload({ command: "tension.raise", title: input.title, description: input.description, type: input.type, circleIds: input.circleIds, handlingMode: input.handlingMode });
  const sourceBindings: readonly BrainCommandSourceBinding[] = circles.map((circle) => ({ objectType: "circle", objectId: circle.id, sourceVersionAt: circle.updatedAt.toISOString(), status: "ACTIVE" }));
  const metadata = BRAIN_COMMAND_REGISTRY["tension.raise"];
  const createdAt = new Date();
  const row = await prisma.brainCommandOperation.create({ data: { organizationId: actor.organizationId, ownerUserId: actor.userId, actorId: actor.personId, conversationId: conversation.id, userMessageId: message.id, commandName: payload.command, commandSchemaVersion: 1, serverPayload: payload, payloadHash: hashBrainCommandBinding(payload as never), sourceBindings, sourceBindingHash: hashBrainCommandBinding(sourceBindings as never), humanDiff: metadata.formatHumanDiff(payload), createdAt, previewExpiresAt: new Date(createdAt.getTime() + PREVIEW_TTL_MS) }, select: brainPreviewSelect });
  return previewSummary(row, createdAt);
}

export type RoleApplicationContext = Readonly<{
  roles: readonly Readonly<{ id: string; name: string; purpose: string; circleName: string }>[];
  latestUserMessageId: string | null;
}>;

export async function listRoleApplicationContext(): Promise<RoleApplicationContext> {
  const actorContext = await resolveActorContext();
  if (!actorContext) fail("ACCESS_DENIED");
  const [roles, latestMessage] = await Promise.all([
    prisma.roleDef.findMany({ where: { organizationId: actorContext.organizationId, status: "ACTIVE", assignees: { none: {} } }, select: { id: true, name: true, purpose: true, circle: { select: { name: true } } }, orderBy: { name: "asc" }, take: 50 }),
    prisma.brainMessage.findFirst({ where: { organizationId: actorContext.organizationId, role: "USER", conversation: { ownerId: actorContext.personId } }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);
  return Object.freeze({ roles: Object.freeze(roles.map((role) => Object.freeze({ id: role.id, name: role.name, purpose: role.purpose, circleName: role.circle.name }))), latestUserMessageId: latestMessage?.id ?? null });
}

export async function createRoleApplicationPreview(input: RoleApplicationPreviewInput): Promise<BrainCommandPreviewSummary> {
  const actorContext = await resolveActorContext();
  if (!actorContext) fail("ACCESS_DENIED");
  const required = dataObject(input, ["conversationId", "userMessageId", "roleId", "motivation", "capabilitySummary", "commitment"]);
  if (!required) fail("INVALID_INPUT");
  const [role, conversation, message] = await Promise.all([
    prisma.roleDef.findFirst({ where: { id: input.roleId, organizationId: actorContext.organizationId, status: "ACTIVE", assignees: { none: {} } }, select: { id: true, name: true, updatedAt: true } }),
    prisma.brainConversation.findFirst({ where: { id: input.conversationId, organizationId: actorContext.organizationId, ownerId: actorContext.personId }, select: { id: true } }),
    prisma.brainMessage.findFirst({ where: { id: input.userMessageId, conversationId: input.conversationId, organizationId: actorContext.organizationId, role: "USER" }, select: { id: true } }),
  ]);
  if (!role || !conversation || !message) fail("ACCESS_DENIED");
  const payload = { command: "role_application.create" as const, roleId: role.id, motivation: input.motivation, capabilitySummary: input.capabilitySummary, commitment: input.commitment };
  const sourceBindings: readonly BrainCommandSourceBinding[] = [{ objectType: "role", objectId: role.id, sourceVersionAt: role.updatedAt.toISOString(), status: "ACTIVE" }];
  const metadata = BRAIN_COMMAND_REGISTRY["role_application.create"];
  const createdAt = new Date();
  const row = await prisma.brainCommandOperation.create({ data: { organizationId: actorContext.organizationId, ownerUserId: actorContext.userId, actorId: actorContext.personId, conversationId: conversation.id, userMessageId: message.id, commandName: payload.command, commandSchemaVersion: 1, serverPayload: payload, payloadHash: hashBrainCommandBinding(payload), sourceBindings, sourceBindingHash: hashBrainCommandBinding(sourceBindings as never), humanDiff: metadata.formatHumanDiff(payload), createdAt, previewExpiresAt: new Date(createdAt.getTime() + PREVIEW_TTL_MS) }, select: brainPreviewSelect });
  return previewSummary(row, createdAt);
}

export async function listGovernanceProposalContext(): Promise<GovernanceProposalContext> {
  const actorContext = await resolveActorContext();
  if (!actorContext) fail("ACCESS_DENIED");
  const [tensions, meetings, circles, latestMessage] = await Promise.all([
    prisma.tension.findMany({ where: { organizationId: actorContext.organizationId, raiserId: actorContext.personId, status: "OPEN", handlingMode: "GOVERNANCE" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, title: true, description: true } }),
    prisma.meeting.findMany({ where: { organizationId: actorContext.organizationId, type: "GOVERNANCE", endedAt: null }, orderBy: { startedAt: "desc" }, take: 20, select: { id: true, title: true, startedAt: true } }),
    prisma.circle.findMany({ where: { organizationId: actorContext.organizationId, status: { in: ["NORMAL", "WARNING"] } }, orderBy: [{ number: "asc" }, { createdAt: "asc" }], take: 50, select: { id: true, name: true } }),
    prisma.brainMessage.findFirst({ where: { organizationId: actorContext.organizationId, role: "USER", conversation: { ownerId: actorContext.personId } }, orderBy: { createdAt: "desc" }, select: { id: true } }),
  ]);
  return Object.freeze({ tensions: Object.freeze(tensions), meetings: Object.freeze(meetings.map((meeting) => Object.freeze({ ...meeting, startedAt: meeting.startedAt.toISOString() }))), circles: Object.freeze(circles), latestUserMessageId: latestMessage?.id ?? null });
}

type PlainObject = Record<string, unknown>;

function fail(code: "INVALID_INPUT" | "ACCESS_DENIED"): never {
  throw new BrainCommandPreviewServiceError(code);
}

export async function createGovernanceProposalPreview(
  input: GovernanceProposalPreviewInput,
): Promise<BrainCommandPreviewSummary> {
  const actorContext = await resolveActorContext();
  if (!actorContext) fail("ACCESS_DENIED");
  const required = dataObject(input, ["conversationId", "userMessageId", "tensionId", "meetingId", "currentStructure", "proposedStructure", "rationale", "expectedImpact", "structuralChange"]);
  if (!required) fail("INVALID_INPUT");
  const tension = await prisma.tension.findFirst({ where: { id: input.tensionId, organizationId: actorContext.organizationId, status: "OPEN", raiserId: actorContext.personId }, select: { id: true, updatedAt: true } });
  const meeting = await prisma.meeting.findFirst({ where: { id: input.meetingId, organizationId: actorContext.organizationId, type: "GOVERNANCE", endedAt: null, participants: { some: { id: actorContext.personId, organizationId: actorContext.organizationId } } }, select: { id: true, startedAt: true, createdAt: true } });
  const conversation = await prisma.brainConversation.findFirst({ where: { id: input.conversationId, organizationId: actorContext.organizationId, ownerId: actorContext.personId }, select: { id: true } });
  const message = await prisma.brainMessage.findFirst({ where: { id: input.userMessageId, conversationId: input.conversationId, organizationId: actorContext.organizationId, role: "USER" }, select: { id: true } });
  if (!tension || !meeting || !conversation || !message) fail("ACCESS_DENIED");
  const payload = parseBrainCommandServerPayload({ command: "governance_proposal.create", tensionId: tension.id, meetingId: meeting.id, currentStructure: input.currentStructure, proposedStructure: input.proposedStructure, rationale: input.rationale, expectedImpact: input.expectedImpact, structuralChange: input.structuralChange });
  const sourceBindings: readonly BrainCommandSourceBinding[] = [
    { objectType: "tension", objectId: tension.id, sourceVersionAt: tension.updatedAt.toISOString(), status: "OPEN" },
    { objectType: "meeting", objectId: meeting.id, sourceVersionAt: meeting.createdAt.toISOString() },
  ];
  const metadata = BRAIN_COMMAND_REGISTRY["governance_proposal.create"];
  const createdAt = new Date();
  const row = await createMeetingPreviewLedger(actorContext.organizationId, { data: { organizationId: actorContext.organizationId, ownerUserId: actorContext.userId, actorId: actorContext.personId, conversationId: conversation.id, userMessageId: message.id, commandName: payload.command, commandSchemaVersion: 1, serverPayload: payload, payloadHash: hashBrainCommandBinding(payload as never), sourceBindings, sourceBindingHash: hashBrainCommandBinding(sourceBindings as never), humanDiff: metadata.formatHumanDiff(payload), createdAt, previewExpiresAt: new Date(createdAt.getTime() + PREVIEW_TTL_MS) }, select: brainPreviewSelect });
  return previewSummary(row, createdAt);
}

async function createMeetingPreviewLedger<Args extends Prisma.BrainCommandOperationCreateArgs>(
  organizationId: string,
  args: Args,
) {
  return prisma.$transaction(
    async (transaction) => {
      const organization = await transaction.organization.findUnique({
        where: { id: organizationId },
        select: { lifecycleStatus: true },
      });
      return createLedgerForMeetingLifecycle(
        organization?.lifecycleStatus,
        () => transaction.brainCommandOperation.create(args),
      );
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
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

function dataObject(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): PlainObject | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return null;
  }
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  if (
    !required.every((key) => Object.hasOwn(value, key)) ||
    !keys.every((key) => allowed.has(key))
  ) {
    return null;
  }
  return value as PlainObject;
}

function opaqueId(value: unknown, maxBytes = MAX_ID_BYTES): string {
  if (
    typeof value !== "string" ||
    !isWellFormed(value) ||
    utf8Bytes(value) < 1 ||
    utf8Bytes(value) > maxBytes
  ) {
    fail("INVALID_INPUT");
  }
  return value;
}

function parseLimit(value: unknown): number {
  if (value === undefined) return DEFAULT_LIMIT;
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_LIMIT
  ) {
    fail("INVALID_INPUT");
  }
  return value;
}

function parseListInput(input: unknown): Readonly<{ conversationId?: string; limit: number }> {
  const value = dataObject(input, ["schemaVersion"], ["conversationId", "limit"]);
  if (!value || value.schemaVersion !== 1) fail("INVALID_INPUT");
  return {
    ...(value.conversationId === undefined
      ? {}
      : { conversationId: opaqueId(value.conversationId) }),
    limit: parseLimit(value.limit),
  };
}

function parseConfirmInput(input: unknown): Readonly<{ previewId: string; mutationKey: string }> {
  const value = dataObject(input, ["schemaVersion", "previewId", "mutationKey"]);
  if (!value || value.schemaVersion !== 1) fail("INVALID_INPUT");
  return {
    previewId: opaqueId(value.previewId),
    mutationKey: opaqueId(value.mutationKey, MAX_MUTATION_KEY_BYTES),
  };
}

async function actorFromSession(): Promise<BrainGoalCommandActor> {
  try {
    const actor = await resolveActorContext();
    return {
      organizationId: actor.organizationId,
      userId: actor.userId,
      personId: actor.personId,
    };
  } catch {
    fail("ACCESS_DENIED");
  }
}

export async function listBrainCommandPreviews(
  input: BrainCommandPreviewListInput,
): Promise<BrainCommandPreviewList> {
  const parsed = parseListInput(input);
  const actor = await actorFromSession();
  return listBrainCommandPreviewsForActor(parsed, actor, prisma);
}

export async function confirmBrainCommandPreview(
  input: BrainCommandPreviewConfirmInput,
): Promise<BrainCommandPreviewConfirmOutput> {
  const parsed = parseConfirmInput(input);
  const actor = await actorFromSession();
  return confirmBrainCommandPreviewForActor(parsed, actor, prisma);
}
