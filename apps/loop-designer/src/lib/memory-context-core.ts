import type { LoopAsset, LoopBirthCertificate, LoopVersion } from "./loop-assets-core";
import type { OrgProfileV1 } from "./org-profile-core";
import type { MaturityDimension } from "./plan-schema";

export type LoopReferenceCard = {
  assetId: string;
  versionId: string;
  title: string;
  domain: string;
  maturityLevel?: number;
  summary: string;
  whyRelevant: string;
};

export type LoopBirthCertificateMemory = {
  assetId: string;
  title: string;
  intent: string;
  source: LoopBirthCertificate["source"];
  references: string[];
  lessonsFromHistory: string[];
  createdAt: string;
};

export type MemoryContextV1 = {
  enterpriseId: string;
  generatedAt: string;
  loopCount: number;
  roleLibrary: {
    humanRoles: string[];
    agentRoles: string[];
    systemRoles: string[];
  };
  glossary: Record<string, string>;
  commonDependencies: OrgProfileV1["commonDependencies"];
  weakDimensions: OrgProfileV1["weakDimensions"];
  birthCertificates: LoopBirthCertificateMemory[];
  referenceLoops: LoopReferenceCard[];
};

export type BuildMemoryContextInput = {
  profile: OrgProfileV1;
  assets: LoopAsset[];
  currentVersions: LoopVersion[];
  draft?: {
    domain?: string;
    loopType?: string;
  };
  now?: string;
  maxReferenceLoops?: number;
};

export function buildMemoryContextV1(input: BuildMemoryContextInput): MemoryContextV1 {
  return {
    enterpriseId: input.profile.enterpriseId,
    generatedAt: input.now || new Date().toISOString(),
    loopCount: input.profile.loopCount,
    roleLibrary: {
      humanRoles: input.profile.humanRoles.slice(0, 24),
      agentRoles: input.profile.agentRoles.slice(0, 16),
      systemRoles: input.profile.systemRoles.slice(0, 16),
    },
    glossary: limitGlossary(input.profile.glossary, 40),
    commonDependencies: input.profile.commonDependencies.slice(0, 12),
    weakDimensions: input.profile.weakDimensions.slice(0, 8),
    birthCertificates: buildBirthCertificateMemory(input),
    referenceLoops: buildReferenceLoops(input),
  };
}

export function formatMemoryContextForPrompt(context: MemoryContextV1) {
  return [
    "组织记忆上下文（仅作为参考，不得覆盖用户本次输入）：",
    `- 已沉淀回路数：${context.loopCount}；参考回路：${context.referenceLoops.length ? "有可参考回路" : "暂无足够参考回路"}`,
    context.roleLibrary.humanRoles.length ? `- 人类角色库：${context.roleLibrary.humanRoles.join("、")}` : "",
    context.roleLibrary.agentRoles.length ? `- 智能体角色库：${context.roleLibrary.agentRoles.join("、")}` : "",
    context.roleLibrary.systemRoles.length ? `- 系统角色库：${context.roleLibrary.systemRoles.join("、")}` : "",
    context.commonDependencies.length
      ? `- 常见依赖：${context.commonDependencies.map((item) => `${item.sourceDomain}->${item.targetDomain}:${item.interfaceName}`).join("；")}`
      : "",
    context.weakDimensions.length
      ? `- 常见短板维度：${context.weakDimensions.map((item) => `${maturityDimensionLabel(item.dimension)}(${item.frequency})`).join("、")}`
      : "",
    Object.keys(context.glossary).length
      ? `- 组织术语：${Object.entries(context.glossary).map(([term, meaning]) => `${term}=${meaning}`).join("；")}`
      : "",
    context.birthCertificates.length
      ? [
        "- 回路出生证摘要：",
        ...context.birthCertificates.map((item) => `  * ${item.title}｜${item.source}｜创建意图：${item.intent}｜来源：${item.references.length ? item.references.join("、") : "暂无"}｜历史经验：${item.lessonsFromHistory.length ? item.lessonsFromHistory.join("；") : "暂无"}`),
      ].join("\n")
      : "",
    context.referenceLoops.length
      ? [
        "- 参考回路证据卡：",
        ...context.referenceLoops.map((item) => `  * ${item.title}｜版本：${item.versionId}｜${item.domain}｜${item.maturityLevel ? `L${item.maturityLevel}` : "未评级"}｜${item.whyRelevant}｜${item.summary}`),
      ].join("\n")
      : "",
    "使用规则：参考回路只能提供角色、术语、接口和治理经验；不能照抄为本次方案，也不能编造不存在的运行数据。",
  ].filter(Boolean).join("\n");
}

function buildBirthCertificateMemory(input: BuildMemoryContextInput): LoopBirthCertificateMemory[] {
  const versionByAssetId = new Map(input.currentVersions.map((version) => [version.assetId, version]));
  return input.assets
    .flatMap((asset) => {
      const birthCertificate = currentVersionForAsset(asset, versionByAssetId)?.birthCertificate;
      if (!birthCertificate) return [];
      return [{
        assetId: asset.id,
        title: asset.title,
        intent: birthCertificate.intent,
        source: birthCertificate.source,
        references: birthCertificate.references.slice(0, 5),
        lessonsFromHistory: birthCertificate.lessonsFromHistory.slice(0, 5),
        createdAt: birthCertificate.createdAt,
      }];
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(0, 5);
}

function buildReferenceLoops(input: BuildMemoryContextInput): LoopReferenceCard[] {
  if (input.profile.loopCount < 2) return [];
  const versionByAssetId = new Map(input.currentVersions.map((version) => [version.assetId, version]));
  const targetDomain = normalize(input.draft?.domain);
  const targetLoopType = normalize(input.draft?.loopType);
  const max = input.maxReferenceLoops ?? 3;
  return input.assets
    .map((asset) => {
      const version = currentVersionForAsset(asset, versionByAssetId);
      const domainMatched = Boolean(targetDomain && normalize(asset.domain) === targetDomain);
      const typeMatched = Boolean((targetLoopType || targetDomain) && normalize(version?.plan.loopType) === (targetLoopType || targetDomain));
      return {
        asset,
        version,
        domainMatched,
        typeMatched,
        score: (domainMatched ? 2 : 0) + (typeMatched ? 1 : 0),
      };
    })
    .filter((item) => item.version && item.score > 0)
    .sort((left, right) => right.score - left.score || right.asset.updatedAt.localeCompare(left.asset.updatedAt))
    .slice(0, max)
    .map((item) => ({
      assetId: item.asset.id,
      versionId: item.version?.id || "",
      title: item.asset.title,
      domain: item.asset.domain,
      ...(item.version?.maturityMapping?.overallLevel ? { maturityLevel: item.version.maturityMapping.overallLevel } : {}),
      summary: item.version?.plan.executiveSummary || item.asset.title,
      whyRelevant: referenceReason(item.domainMatched, item.typeMatched),
    }));
}

function currentVersionForAsset(asset: LoopAsset, versionByAssetId: Map<string, LoopVersion>) {
  const version = versionByAssetId.get(asset.id);
  if (asset.status === "retired" || !asset.currentVersionId || version?.id !== asset.currentVersionId) return undefined;
  return version;
}

function referenceReason(domainMatched: boolean, typeMatched: boolean) {
  if (domainMatched && typeMatched) return "同领域、同类型回路，可作为组织经验参考。";
  if (domainMatched) return "同领域回路，可作为组织经验参考。";
  if (typeMatched) return "同类型回路，可作为组织经验参考。";
  return "企业已确认回路，可作为角色、接口和治理经验参考。";
}

function limitGlossary(glossary: Record<string, string>, max: number) {
  return Object.fromEntries(Object.entries(glossary).slice(0, max));
}

function normalize(value: string | undefined) {
  return value?.trim().toLowerCase();
}

function maturityDimensionLabel(dimension: MaturityDimension) {
  const labels: Record<MaturityDimension, string> = {
    loop_maturity: "闭环完整度",
    triple_alignment: "目标和分工对齐",
    orchestration: "协作衔接",
    intelligence_density: "AI 接管程度",
    eco_evolution: "复盘迭代能力",
  };
  return labels[dimension];
}
