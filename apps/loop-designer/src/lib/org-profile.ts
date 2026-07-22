import "server-only";

import type { AppUser } from "./app-session";
import { listLoopAssets } from "./loop-assets";
import type { LoopBirthCertificate, LoopVersion } from "./loop-assets-core";
import { listLoopRelationships } from "./loop-relationships";
import { buildOrgProfileV1, type OrgProfileV1 } from "./org-profile-core";
import { loopOsErrorMessage } from "./loop-os-errors";
import type { LoopPlan, LoopMaturityMapping } from "./plan-schema";
import { getAdminClient } from "./supabase";

type LoopVersionRow = {
  id: string;
  asset_id: string;
  version_number: number;
  plan: LoopPlan;
  maturity_mapping: LoopMaturityMapping | null;
  birth_certificate: LoopBirthCertificate | null;
  source_session_version_id: string | null;
  change_reason: string | null;
  created_by: string;
  created_at: string;
};

type OrgProfileRow = {
  enterprise_id: string;
  profile: OrgProfileV1;
  computed_at: string;
};

export async function buildOrgProfileForEnterprise(user: AppUser): Promise<OrgProfileV1> {
  const assets = await listLoopAssets(user);
  const relationships = await listLoopRelationships(user);
  const currentVersions = await listCurrentLoopVersions(user, assets.map((asset) => asset.currentVersionId).filter((id): id is string => Boolean(id)));
  return buildOrgProfileV1({
    enterpriseId: user.enterpriseId,
    assets,
    currentVersions,
    relationships,
  });
}

export async function getOrgProfileSnapshot(user: AppUser): Promise<OrgProfileV1> {
  const admin = getAdminClient();
  if (!admin) return buildOrgProfileForEnterprise(user);

  const { data, error } = await admin
    .from("loop_os_org_profiles")
    .select("enterprise_id, profile, computed_at")
    .eq("enterprise_id", user.enterpriseId)
    .maybeSingle();
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to get org profile snapshot"));
  if (data) return normalizeOrgProfile(data as OrgProfileRow);
  return saveOrgProfileSnapshot(user);
}

export async function saveOrgProfileSnapshot(user: AppUser, profile?: OrgProfileV1): Promise<OrgProfileV1> {
  const admin = getAdminClient();
  const nextProfile = profile ?? await buildOrgProfileForEnterprise(user);
  if (!admin) return nextProfile;

  const computedAt = new Date().toISOString();
  const { data, error } = await admin
    .from("loop_os_org_profiles")
    .upsert({
      enterprise_id: user.enterpriseId,
      profile: nextProfile,
      computed_at: computedAt,
      updated_at: computedAt,
      source: "loop_os_v1",
    }, { onConflict: "enterprise_id" })
    .select("enterprise_id, profile, computed_at")
    .single();
  if (error || !data) throw new Error(loopOsErrorMessage(error, "Unable to save org profile snapshot"));
  return normalizeOrgProfile(data as OrgProfileRow);
}

export async function refreshOrgProfileSnapshotBestEffort(user: AppUser): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await saveOrgProfileSnapshot(user);
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Unable to refresh org profile snapshot" };
  }
}

export async function listCurrentLoopVersions(user: AppUser, versionIds: string[]): Promise<LoopVersion[]> {
  const admin = getAdminClient();
  if (!admin || !versionIds.length) return [];

  const { data, error } = await admin
    .from("loop_os_versions")
    .select("*, loop_os_assets!inner(enterprise_id)")
    .in("id", versionIds)
    .eq("loop_os_assets.enterprise_id", user.enterpriseId);
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to list current loop versions"));
  return ((data ?? []) as LoopVersionRow[]).map(normalizeVersion);
}

function normalizeOrgProfile(row: OrgProfileRow): OrgProfileV1 {
  return {
    ...row.profile,
    enterpriseId: row.enterprise_id,
    updatedAt: row.computed_at || row.profile.updatedAt,
  };
}

function normalizeVersion(row: LoopVersionRow): LoopVersion {
  return {
    id: row.id,
    assetId: row.asset_id,
    versionNumber: row.version_number,
    plan: row.plan,
    ...(row.maturity_mapping ? { maturityMapping: row.maturity_mapping } : {}),
    ...(row.birth_certificate ? { birthCertificate: row.birth_certificate } : {}),
    ...(row.source_session_version_id ? { sourceSessionVersionId: row.source_session_version_id } : {}),
    ...(row.change_reason ? { changeReason: row.change_reason } : {}),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
