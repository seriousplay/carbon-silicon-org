import "server-only";

import type { AppUser } from "./app-session";
import {
  buildLoopRelationshipDraft,
  validateParentChildRelationshipDepth,
  type LoopRelationship,
  type LoopRelationshipDraft,
  type LoopRelationshipStrength,
  type LoopRelationshipType,
} from "./loop-assets-core";
import { loopOsErrorMessage } from "./loop-os-errors";
import { getAdminClient } from "./supabase";

type LoopRelationshipRow = {
  id: string;
  enterprise_id: string;
  source_asset_id: string;
  target_asset_id: string;
  type: LoopRelationshipType;
  direction: "source_to_target";
  interface_name: string | null;
  strength: LoopRelationshipStrength;
  created_by: string;
  created_at: string;
};

export type CreateLoopRelationshipInput = {
  sourceAssetId: string;
  targetAssetId: string;
  type: LoopRelationshipType;
  interfaceName?: string;
  strength?: LoopRelationshipStrength;
};

export async function listLoopRelationships(user: AppUser, assetId?: string): Promise<LoopRelationship[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("loop_os_relationships")
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to list loop relationships"));

  const relationships = ((data ?? []) as LoopRelationshipRow[]).map(normalizeRelationship);
  if (!assetId) return relationships;
  return relationships.filter((relationship) => relationship.sourceAssetId === assetId || relationship.targetAssetId === assetId);
}

export async function createLoopRelationship(user: AppUser, input: CreateLoopRelationshipInput): Promise<LoopRelationship> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const draft = buildLoopRelationshipDraft({ user, ...input });
  await requireEnterpriseAssets(user.enterpriseId, [draft.sourceAssetId, draft.targetAssetId]);

  const existingRelationships = await listLoopRelationships(user);
  validateParentChildRelationshipDepth(draft, existingRelationships);

  const { data, error } = await admin
    .from("loop_os_relationships")
    .insert({
      enterprise_id: draft.enterpriseId,
      source_asset_id: draft.sourceAssetId,
      target_asset_id: draft.targetAssetId,
      type: draft.type,
      direction: draft.direction || "source_to_target",
      interface_name: draft.interfaceName ?? null,
      strength: draft.strength || "important",
      created_by: draft.createdBy,
    })
    .select("*")
    .single();
  if (isUniqueViolation(error)) {
    const existingRelationship = await findExistingLoopRelationship(user, draft);
    if (existingRelationship) return existingRelationship;
  }
  if (error || !data) throw new Error(loopOsErrorMessage(error, "Unable to create loop relationship"));
  return normalizeRelationship(data as LoopRelationshipRow);
}

async function findExistingLoopRelationship(user: AppUser, draft: LoopRelationshipDraft): Promise<LoopRelationship | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  let query = admin
    .from("loop_os_relationships")
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .eq("source_asset_id", draft.sourceAssetId)
    .eq("target_asset_id", draft.targetAssetId)
    .eq("type", draft.type);
  if (draft.type === "dependency") query = query.eq("interface_name", draft.interfaceName || "");

  const { data, error } = await query.maybeSingle();
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to find loop relationship"));
  return data ? normalizeRelationship(data as LoopRelationshipRow) : null;
}

async function requireEnterpriseAssets(enterpriseId: string, assetIds: string[]) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const uniqueAssetIds = Array.from(new Set(assetIds));
  const { data, error } = await admin
    .from("loop_os_assets")
    .select("id")
    .eq("enterprise_id", enterpriseId)
    .in("id", uniqueAssetIds);
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to require enterprise assets"));
  const found = new Set(((data ?? []) as Array<{ id: string }>).map((asset) => asset.id));
  const missing = uniqueAssetIds.filter((assetId) => !found.has(assetId));
  if (missing.length) throw new Error("回路关系只能连接当前企业内的资产");
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

function normalizeRelationship(row: LoopRelationshipRow): LoopRelationship {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    sourceAssetId: row.source_asset_id,
    targetAssetId: row.target_asset_id,
    type: row.type,
    direction: row.direction,
    ...(row.interface_name ? { interfaceName: row.interface_name } : {}),
    strength: row.strength,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
