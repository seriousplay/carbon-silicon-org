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
  enterprise_id: string;
  asset_id: string;
  version_id: string | null;
  event_type: LoopEvolutionEventType;
  run_sequence: number | null;
  run_mode: LoopRunMode | null;
  payload: LoopEvolutionEvent["payload"];
  created_by: string;
  created_at: string;
};

export async function listLoopEvolutionEvents(user: AppUser, assetId: string): Promise<LoopEvolutionEvent[]> {
  const admin = getAdminClient();
  if (!admin) return [];
  await requireAsset(user, assetId);
  const { data, error } = await admin
    .from("loop_os_evolution_events")
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .eq("asset_id", assetId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to list loop evolution events"));
  return ((data ?? []) as EvolutionEventRow[]).map(normalizeEvolutionEvent);
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
    payload: LoopEvolutionEvent["payload"];
  },
) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  await requireAsset(user, assetId);
  const { data, error } = await admin
    .from("loop_os_evolution_events")
    .insert({
      enterprise_id: user.enterpriseId,
      asset_id: assetId,
      version_id: input.versionId ?? null,
      event_type: input.eventType,
      run_sequence: input.runSequence ?? null,
      run_mode: input.runMode ?? null,
      payload: input.payload,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(loopOsErrorMessage(error, "Unable to record loop evolution event"));
  return normalizeEvolutionEvent(data as EvolutionEventRow);
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
    enterpriseId: row.enterprise_id,
    assetId: row.asset_id,
    versionId: row.version_id,
    eventType: row.event_type,
    runSequence: row.run_sequence,
    runMode: row.run_mode,
    payload: row.payload,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
