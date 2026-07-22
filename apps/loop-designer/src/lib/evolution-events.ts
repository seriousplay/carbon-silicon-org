import "server-only";

import type { AppUser } from "./app-session";
import {
  buildRunSummary,
  validateReleasePayload,
  validateRunRoundPayload,
  type LoopEvolutionEvent,
  type LoopEvolutionEventType,
  type LoopRunMode,
  type LoopRunReleasePayload,
  type RunRoundPayload,
} from "./evolution-events-core";
import { getLoopAssetDetails } from "./loop-assets";
import { loopOsErrorMessage } from "./loop-os-errors";
import { getAdminClient } from "./supabase";

type EvolutionEventRow = {
  id: string;
  enterpriseId: string;
  assetId: string;
  versionId: string | null;
  eventType: string;
  runSequence: number | null;
  runMode: string | null;
  payload: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
};

export async function listLoopEvolutionEvents(user: AppUser, assetId: string): Promise<LoopEvolutionEvent[]> {
  const admin = getAdminClient();
  if (!admin) return [];
  await requireAsset(user, assetId);
  const data = await admin.loopOsEvolutionEvent.findMany({
    where: { enterpriseId: user.enterpriseId, assetId },
    orderBy: { createdAt: "desc" },
  });
  return (data as unknown as EvolutionEventRow[]).map(normalizeEvolutionEvent);
}

export async function recordLoopRunRound(user: AppUser, assetId: string, payload: RunRoundPayload): Promise<LoopEvolutionEvent> {
  const validPayload = validateRunRoundPayload(payload);
  await requireVersion(user, assetId, validPayload.loopVersionId);
  return insertEvolutionEvent(user, assetId, {
    versionId: validPayload.loopVersionId,
    eventType: "run_round",
    runSequence: validPayload.runSequence,
    runMode: validPayload.runMode,
    payload: validPayload,
  });
}

export async function releaseLoopRunVersion(user: AppUser, assetId: string, payload: LoopRunReleasePayload): Promise<LoopEvolutionEvent> {
  const validPayload = validateReleasePayload(payload);
  await requireVersion(user, assetId, validPayload.loopVersionId);
  return insertEvolutionEvent(user, assetId, {
    versionId: validPayload.loopVersionId,
    eventType: "version_released",
    payload: validPayload,
  });
}

export async function getLoopRunSummary(user: AppUser, assetId: string) {
  return buildRunSummary(await listLoopEvolutionEvents(user, assetId));
}

async function insertEvolutionEvent(
  user: AppUser,
  assetId: string,
  input: {
    versionId?: string;
    eventType: LoopEvolutionEventType;
    runSequence?: number;
    runMode?: LoopRunMode;
    payload: Record<string, unknown>;
  },
) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  await requireAsset(user, assetId);
  const data = await admin.loopOsEvolutionEvent.create({
    data: {
      enterpriseId: user.enterpriseId,
      assetId,
      versionId: input.versionId ?? null,
      eventType: input.eventType,
      runSequence: input.runSequence ?? null,
      runMode: input.runMode ?? null,
      payload: input.payload,
      createdBy: user.id,
    },
  });
  return normalizeEvolutionEvent(data as unknown as EvolutionEventRow);
}

async function requireAsset(user: AppUser, assetId: string) {
  const details = await getLoopAssetDetails(user, assetId);
  if (!details) throw new Error("Loop asset not found");
  return details;
}

async function requireVersion(user: AppUser, assetId: string, versionId: string) {
  const details = await requireAsset(user, assetId);
  const version = details.versions.find((item) => item.id === versionId);
  if (!version) throw new Error("回路运行记录只能关联当前资产的版本");
  return version;
}

function normalizeEvolutionEvent(row: EvolutionEventRow): LoopEvolutionEvent {
  return {
    id: row.id,
    enterpriseId: row.enterpriseId,
    assetId: row.assetId,
    versionId: row.versionId,
    eventType: row.eventType as LoopEvolutionEventType,
    runSequence: row.runSequence,
    runMode: row.runMode as LoopRunMode | null,
    payload: row.payload as LoopEvolutionEvent["payload"],
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
