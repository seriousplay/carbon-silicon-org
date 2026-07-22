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
  enterpriseId: string;
  sourceAssetId: string;
  targetAssetId: string;
  type: string;
  direction: string;
  interfaceName: string | null;
  strength: string;
  createdBy: string;
  createdAt: Date;
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

  const data = await admin.loopOsRelationship.findMany({
    where: { enterpriseId: user.enterpriseId },
    orderBy: { createdAt: "desc" },
  });

  const relationships = (data as unknown as LoopRelationshipRow[]).map(normalizeRelationship);
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

  try {
    const data = await admin.loopOsRelationship.create({
      data: {
        enterpriseId: draft.enterpriseId,
        sourceAssetId: draft.sourceAssetId,
        targetAssetId: draft.targetAssetId,
        type: draft.type,
        direction: draft.direction || "source_to_target",
        interfaceName: draft.interfaceName ?? null,
        strength: draft.strength || "important",
        createdBy: draft.createdBy,
      },
    });
    return normalizeRelationship(data as unknown as LoopRelationshipRow);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const existingRelationship = await findExistingLoopRelationship(user, draft);
      if (existingRelationship) return existingRelationship;
    }
    throw new Error(loopOsErrorMessage(error, "Unable to create loop relationship"));
  }
}

async function findExistingLoopRelationship(user: AppUser, draft: LoopRelationshipDraft): Promise<LoopRelationship | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const where: Record<string, unknown> = {
    enterpriseId: user.enterpriseId,
    sourceAssetId: draft.sourceAssetId,
    targetAssetId: draft.targetAssetId,
    type: draft.type,
  };
  if (draft.type === "dependency") {
    where.interfaceName = draft.interfaceName || "";
  }

  const data = await admin.loopOsRelationship.findFirst({ where: where as any });
  return data ? normalizeRelationship(data as unknown as LoopRelationshipRow) : null;
}

async function requireEnterpriseAssets(enterpriseId: string, assetIds: string[]) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const uniqueAssetIds = Array.from(new Set(assetIds));
  const data = await admin.loopOsAsset.findMany({
    where: {
      enterpriseId,
      id: { in: uniqueAssetIds },
    },
    select: { id: true },
  });
  const found = new Set(data.map((asset) => asset.id));
  const missing = uniqueAssetIds.filter((assetId) => !found.has(assetId));
  if (missing.length) throw new Error("回路关系只能连接当前企业内的资产");
}

function isUniqueViolation(error: unknown) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
}

function normalizeRelationship(row: LoopRelationshipRow): LoopRelationship {
  return {
    id: row.id,
    enterpriseId: row.enterpriseId,
    sourceAssetId: row.sourceAssetId,
    targetAssetId: row.targetAssetId,
    type: row.type as LoopRelationshipType,
    direction: row.direction as "source_to_target",
    ...(row.interfaceName ? { interfaceName: row.interfaceName } : {}),
    strength: row.strength as LoopRelationshipStrength,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
