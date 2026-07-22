import type { LoopAsset, LoopRelationship, LoopVersion } from "./loop-assets-core";
import type { MaturityDimension, MaturityLevel } from "./plan-schema";

export type OrgProfileV1 = {
  enterpriseId: string;
  loopCount: number;
  maturityDistribution: Record<MaturityLevel, number>;
  humanRoles: string[];
  agentRoles: string[];
  systemRoles: string[];
  glossary: Record<string, string>;
  commonDependencies: Array<{
    sourceDomain: string;
    targetDomain: string;
    interfaceName: string;
    frequency: number;
  }>;
  weakDimensions: Array<{
    dimension: MaturityDimension;
    frequency: number;
  }>;
  updatedAt: string;
};

export type BuildOrgProfileInput = {
  enterpriseId: string;
  assets: LoopAsset[];
  currentVersions: LoopVersion[];
  relationships: LoopRelationship[];
  now?: string;
};

const PROFILE_ASSET_STATUSES = new Set(["incubating", "active", "dormant"]);

export function buildOrgProfileV1(input: BuildOrgProfileInput): OrgProfileV1 {
  const currentVersionByAssetId = new Map(input.currentVersions.map((version) => [version.assetId, version]));
  const eligibleAssets = input.assets.filter((asset) => {
    const currentVersion = currentVersionByAssetId.get(asset.id);
    return PROFILE_ASSET_STATUSES.has(asset.status) && Boolean(asset.currentVersionId) && currentVersion?.id === asset.currentVersionId;
  });
  const assetById = new Map(eligibleAssets.map((asset) => [asset.id, asset]));
  const versions = eligibleAssets
    .map((asset) => currentVersionByAssetId.get(asset.id))
    .filter((version): version is LoopVersion => Boolean(version));

  return {
    enterpriseId: input.enterpriseId,
    loopCount: eligibleAssets.length,
    maturityDistribution: buildMaturityDistribution(versions),
    humanRoles: uniqueSorted(versions.flatMap((version) => version.plan.organizationMap.humanRoles?.map((role) => role.name) || [])),
    agentRoles: uniqueSorted(versions.flatMap((version) => version.plan.organizationMap.agentRoles?.map((role) => role.name) || [])),
    systemRoles: uniqueSorted(versions.flatMap((version) => version.plan.organizationMap.systemRoles?.map((role) => role.name) || [])),
    glossary: buildGlossary(eligibleAssets, versions),
    commonDependencies: buildCommonDependencies(input.relationships, assetById),
    weakDimensions: buildWeakDimensions(versions),
    updatedAt: input.now || new Date().toISOString(),
  };
}

function buildMaturityDistribution(versions: LoopVersion[]): Record<MaturityLevel, number> {
  const distribution: Record<MaturityLevel, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const version of versions) {
    const level = version.maturityMapping?.overallLevel;
    if (level) distribution[level] += 1;
  }
  return distribution;
}

function buildGlossary(assets: LoopAsset[], versions: LoopVersion[]) {
  const glossary: Record<string, string> = {};
  for (const asset of assets) {
    glossary[asset.domain] = "回路领域";
    glossary[asset.title] = "回路资产";
  }
  for (const version of versions) {
    const plan = version.plan;
    glossary[plan.loopType] = "回路类型";
    glossary[plan.organizationMap.sharedDataLayer] = "共享数据层";
    for (const item of plan.organizationMap.interfaces || []) {
      glossary[item.name] = "组织接口";
      glossary[item.dataObject] = "业务对象";
    }
  }
  return Object.fromEntries(Object.entries(glossary).filter(([term]) => term.trim().length > 0).sort(([left], [right]) => left.localeCompare(right, "zh-CN")));
}

function buildCommonDependencies(relationships: LoopRelationship[], assetById: Map<string, LoopAsset>) {
  const dependencyCounts = new Map<string, {
    sourceDomain: string;
    targetDomain: string;
    interfaceName: string;
    frequency: number;
  }>();

  for (const relationship of relationships) {
    if (relationship.type !== "dependency" || !relationship.interfaceName) continue;
    const source = assetById.get(relationship.sourceAssetId);
    const target = assetById.get(relationship.targetAssetId);
    if (!source || !target) continue;
    const key = `${source.domain}|||${target.domain}|||${relationship.interfaceName}`;
    const current = dependencyCounts.get(key) || {
      sourceDomain: source.domain,
      targetDomain: target.domain,
      interfaceName: relationship.interfaceName,
      frequency: 0,
    };
    current.frequency += 1;
    dependencyCounts.set(key, current);
  }

  return [...dependencyCounts.values()].sort((left, right) => right.frequency - left.frequency || left.interfaceName.localeCompare(right.interfaceName, "zh-CN"));
}

function buildWeakDimensions(versions: LoopVersion[]) {
  const counts = new Map<MaturityDimension, number>();
  for (const version of versions) {
    for (const item of version.maturityMapping?.maturity || []) {
      if (item.level > 2) continue;
      counts.set(item.dimension, (counts.get(item.dimension) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([dimension, frequency]) => ({ dimension, frequency }))
    .sort((left, right) => right.frequency - left.frequency || left.dimension.localeCompare(right.dimension));
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort((left, right) => left.localeCompare(right, "zh-CN"));
}
