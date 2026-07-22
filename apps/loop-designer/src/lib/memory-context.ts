import "server-only";

import type { AppUser } from "./app-session";
import { listLoopAssets } from "./loop-assets";
import { buildMemoryContextV1, type MemoryContextV1 } from "./memory-context-core";
import { getOrgProfileSnapshot, listCurrentLoopVersions } from "./org-profile";

export type BuildMemoryContextForEnterpriseInput = {
  domain?: string;
  loopType?: string;
};

export async function buildMemoryContextForEnterprise(
  user: AppUser,
  input: BuildMemoryContextForEnterpriseInput = {},
): Promise<MemoryContextV1> {
  const assets = await listLoopAssets(user);
  const currentVersions = await listCurrentLoopVersions(user, assets.map((asset) => asset.currentVersionId).filter((id): id is string => Boolean(id)));
  const profile = await getOrgProfileSnapshot(user);
  return buildMemoryContextV1({
    profile,
    assets,
    currentVersions,
    draft: input,
  });
}

export async function buildMemoryContextForEnterpriseBestEffort(
  user: AppUser,
  input: BuildMemoryContextForEnterpriseInput = {},
): Promise<MemoryContextV1 | undefined> {
  try {
    return await buildMemoryContextForEnterprise(user, input);
  } catch {
    return undefined;
  }
}
