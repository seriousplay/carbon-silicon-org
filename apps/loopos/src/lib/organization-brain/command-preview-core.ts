import { type PrismaClient } from "@/generated/prisma/client";
import {
  BRAIN_COMMAND_REGISTRY,
  parseBrainCommandPublicError,
  type BrainCommandHumanDiff,
  type BrainCommandName,
} from "./command-registry";
import { resolveBrainCapability } from "./capability-registry";
import { createPrismaBrainCommandSourceValidator } from "./command-source-validator";
import {
  confirmGoalCommandPreview,
  createPrismaBrainGoalCommandDependencies,
  type BrainGoalCommandActor,
  type BrainGoalCommandConfirmResult,
} from "./goal-command-handler";
import {
  BrainCommandPreviewServiceError,
  type BrainCommandPreviewList,
  type BrainCommandPreviewSummary,
  type ParsedBrainCommandPreviewConfirmInput,
  type ParsedBrainCommandPreviewListInput,
} from "./command-preview-types";

type PlainObject = Record<string, unknown>;

function fail(): never {
  throw new BrainCommandPreviewServiceError("PERSISTENCE_FAILED");
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

function parseHumanDiff(value: unknown): BrainCommandHumanDiff {
  if (!Array.isArray(value)) fail();
  return value.map((row) => {
    const item = dataObject(row, ["label", "before", "after"]);
    if (
      !item ||
      typeof item.label !== "string" ||
      (item.before !== null && typeof item.before !== "string") ||
      (item.after !== null && typeof item.after !== "string")
    ) {
      fail();
    }
    return Object.freeze({
      label: item.label,
      before: item.before,
      after: item.after,
    });
  });
}

function normalizeTerminalResult(value: unknown): unknown {
  if (value === null) return null;
  try {
    const parsed = dataObject(value, ["schemaVersion", "ok", "code"], ["result", "error"]);
    if (!parsed || parsed.schemaVersion !== 1 || typeof parsed.ok !== "boolean") return null;
    if (parsed.ok === true) return parsed.result ?? null;
    if (parsed.error !== undefined) return parseBrainCommandPublicError(parsed.error);
    return null;
  } catch {
    return null;
  }
}

export function previewSummary(
  row: Readonly<{
    id: string;
    conversationId: string;
    userMessageId: string;
    commandName: string;
    commandSchemaVersion: number;
    humanDiff: unknown;
    previewExpiresAt: Date;
    createdAt: Date;
    status: "PREVIEWED" | "SUCCEEDED" | "REJECTED" | "EXPIRED";
    terminalCode: string | null;
    terminalResult: unknown;
  }>,
  now: Date,
): BrainCommandPreviewSummary {
  if (!Object.hasOwn(BRAIN_COMMAND_REGISTRY, row.commandName)) fail();
  const commandName = row.commandName as BrainCommandName;
  resolveBrainCapability({ id: commandName, schemaVersion: row.commandSchemaVersion });
  return Object.freeze({
    id: row.id,
    conversationId: row.conversationId,
    userMessageId: row.userMessageId,
    commandName,
    status: row.status,
    humanDiff: parseHumanDiff(row.humanDiff),
    previewExpiresAt: row.previewExpiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    terminalCode: row.terminalCode,
    terminalResult: normalizeTerminalResult(row.terminalResult),
    expired: row.status === "PREVIEWED" && row.previewExpiresAt.getTime() <= now.getTime(),
  });
}

export async function listBrainCommandPreviewsForActor(
  parsed: ParsedBrainCommandPreviewListInput,
  actor: BrainGoalCommandActor,
  client: PrismaClient,
): Promise<BrainCommandPreviewList> {
  const now = new Date();
  try {
    const rows = await client.brainCommandOperation.findMany({
      where: {
        organizationId: actor.organizationId,
        ownerUserId: actor.userId,
        actorId: actor.personId,
        ...(parsed.conversationId === undefined ? {} : { conversationId: parsed.conversationId }),
      },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      take: parsed.limit,
      select: {
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
      },
    });
    return Object.freeze({
      schemaVersion: 1,
      previews: Object.freeze(rows.map((row) => previewSummary(row, now))),
    });
  } catch (error) {
    if (error instanceof BrainCommandPreviewServiceError) throw error;
    fail();
  }
}

export type BrainCommandPreviewConfirmOutput = Readonly<{
  schemaVersion: 1;
  confirmation: BrainGoalCommandConfirmResult;
}>;

export async function confirmBrainCommandPreviewForActor(
  parsed: ParsedBrainCommandPreviewConfirmInput,
  actor: BrainGoalCommandActor,
  client: PrismaClient,
): Promise<BrainCommandPreviewConfirmOutput> {
  try {
    const confirmation = await confirmGoalCommandPreview(
      {
        previewId: parsed.previewId,
        mutationKey: parsed.mutationKey,
        actor,
      },
      createPrismaBrainGoalCommandDependencies(
        client,
        createPrismaBrainCommandSourceValidator(client),
      ),
    );
    return Object.freeze({ schemaVersion: 1, confirmation });
  } catch (error) {
    if (error instanceof BrainCommandPreviewServiceError) throw error;
    fail();
  }
}
