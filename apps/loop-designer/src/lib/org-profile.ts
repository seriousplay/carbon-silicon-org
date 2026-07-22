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
  assetId: string;
  versionNumber: number;
  plan: PrismaJson;
  maturityMapping: PrismaJson | null;
  birthCertificate: PrismaJson | null;
  sourceSessionVersionId: string | null;
  changeReason: string | null;
  createdBy: string;
  createdAt: Date;
};

type PrismaJson = Record<string, unknown> | null;

type OrgProfileRow = {
  enterpriseId: string;
  profile: PrismaJson;
  computedAt: Date;
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

  const data = await admin.loopOsOrgProfile.findFirst({
    where: { enterpriseId: user.enterpriseId },
    select: { enterpriseId: true, profile: true, computedAt: true },
  });
  if (data) return normalizeOrgProfile(data as unknown as OrgProfileRow);
  return saveOrgProfileSnapshot(user);
}

export async function saveOrgProfileSnapshot(user: AppUser, profile?: OrgProfileV1): Promise<OrgProfileV1> {
  const admin = getAdminClient();
  const nextProfile = profile ?? await buildOrgProfileForEnterprise(user);
  if (!admin) return nextProfile;

  const computedAt = new Date();
  const data = await admin.loopOsOrgProfile.upsert({
    where: { enterpriseId: user.enterpriseId },
    create: {
      enterpriseId: user.enterpriseId,
      profile: nextProfile as PrismaJson,
      source: "loop_os_v1",
      computedAt,
      updatedAt: computedAt,
    },
    update: {
      profile: nextProfile as PrismaJson,
      computedAt,
      updatedAt: computedAt,
    },
    select: { enterpriseId: true, profile: true, computedAt: true },
  });
  return normalizeOrgProfile(data as unknown as OrgProfileRow);
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

  const data = await admin.loopOsVersion.findMany({
    where: {
      id: { in: versionIds },
      asset: { enterpriseId: user.enterpriseId },
    },
    include: { asset: { select: { enterpriseId: true } } },
  });
  return (data as unknown as LoopVersionRow[]).map(normalizeVersion);
}

function normalizeOrgProfile(row: OrgProfileRow): OrgProfileV1 {
  const profile = row.profile as Record<string, unknown>;
  return {
    ...(profile as unknown as OrgProfileV1),
    enterpriseId: row.enterpriseId,
    updatedAt: row.computedAt?.toISOString() || (profile as any)?.updatedAt,
  };
}

function normalizeVersion(row: LoopVersionRow): LoopVersion {
  return {
    id: row.id,
    assetId: row.assetId,
    versionNumber: row.versionNumber,
    plan: row.plan as LoopPlan,
    ...(row.maturityMapping ? { maturityMapping: row.maturityMapping as LoopMaturityMapping } : {}),
    ...(row.birthCertificate ? { birthCertificate: row.birthCertificate as LoopBirthCertificate } : {}),
    ...(row.sourceSessionVersionId ? { sourceSessionVersionId: row.sourceSessionVersionId } : {}),
    ...(row.changeReason ? { changeReason: row.changeReason } : {}),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
