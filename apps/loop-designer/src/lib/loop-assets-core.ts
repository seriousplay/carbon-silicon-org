import type { MatrixIntegrationContext } from "@carbon-silicon/types";
import type { AppUser } from "./app-session";
import type { LoopPlan, LoopMaturityMapping, MaturityDimension, MaturityLevel } from "./plan-schema";
import type { LoopDesignerSession } from "./session-types";
import { customerDimensionLabel } from "./maturity";

export type LoopAssetStatus = "incubating" | "active" | "dormant" | "retired";
export type LoopBirthSource = "manual" | "questionnaire" | "blueprint" | "matrix_origin";
export type LoopRelationshipType = "parent_child" | "dependency";
export type LoopRelationshipStrength = "critical" | "important" | "nice_to_have";

export type LoopBirthCertificate = {
  intent: string;
  source: LoopBirthSource;
  references: string[];
  lessonsFromHistory: string[];
  expectedMaturity?: MaturityLevel;
  createdAt: string;
  creatorId: string;
};

export type LoopAsset = {
  id: string;
  enterpriseId: string;
  title: string;
  domain: string;
  status: LoopAssetStatus;
  currentVersionId: string | null;
  sourceSessionId?: string;
  matrixWorkspaceId?: string;
  matrixCircuitLogicalId?: string;
  matrixBaseVersionId?: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type LoopVersion = {
  id: string;
  assetId: string;
  versionNumber: number;
  plan: LoopPlan;
  maturityMapping?: LoopMaturityMapping;
  birthCertificate?: LoopBirthCertificate;
  matrixReview?: LoopMatrixReview;
  sourceSessionVersionId?: string;
  changeReason?: string;
  createdBy: string;
  createdAt: string;
};

export type LoopMatrixReview = {
  studyId: string;
  status: string;
  returnUrl?: string;
  submittedAt: string;
};

export type LoopRelationship = {
  id: string;
  enterpriseId: string;
  sourceAssetId: string;
  targetAssetId: string;
  type: LoopRelationshipType;
  direction?: "source_to_target";
  interfaceName?: string;
  strength?: LoopRelationshipStrength;
  createdBy: string;
  createdAt: string;
};

export type LoopNetworkWarningType = "isolated_loop" | "dependency_concentration" | "dependency_cycle" | "parent_child_maturity_inversion";
export type LoopNetworkWarningSeverity = "info" | "warning" | "critical";

export type LoopNetworkWarning = {
  id: string;
  type: LoopNetworkWarningType;
  severity: LoopNetworkWarningSeverity;
  title: string;
  description: string;
  assetIds: string[];
  relationshipIds: string[];
};

export type LoopAssetDraft = {
  asset: Omit<LoopAsset, "id" | "currentVersionId" | "createdAt" | "updatedAt">;
  firstVersion: Omit<LoopVersion, "id" | "assetId" | "createdAt">;
};

export type LoopRelationshipDraft = Omit<LoopRelationship, "id" | "createdAt">;

export type BuildLoopAssetDraftInput = {
  user: Pick<AppUser, "id" | "enterpriseId">;
  session: LoopDesignerSession;
  title?: string;
  domain?: string;
  status?: LoopAssetStatus;
  now?: string;
};

export type BuildManualLoopAssetDraftInput = {
  user: Pick<AppUser, "id" | "enterpriseId">;
  title: string;
  domain?: string;
  status?: LoopAssetStatus;
};

export type BuildLoopBirthLessonsFromHistoryInput = {
  domain: string;
  assets: LoopAsset[];
  currentVersions: LoopVersion[];
  relationships: LoopRelationship[];
  maxLessons?: number;
};

export type BuildLoopNetworkWarningsInput = {
  assets: LoopAsset[];
  currentVersions: LoopVersion[];
  relationships: LoopRelationship[];
  dependencyConcentrationThreshold?: number;
};

export type BuildLoopRelationshipDraftInput = {
  user: Pick<AppUser, "id" | "enterpriseId">;
  sourceAssetId: string;
  targetAssetId: string;
  type: LoopRelationshipType;
  interfaceName?: string;
  strength?: LoopRelationshipStrength;
};

export type MatrixAssetBindingRef = {
  enterpriseId: string;
  matrixWorkspaceId: string;
  matrixCircuitLogicalId: string;
};

export function buildLoopAssetDraft(input: BuildLoopAssetDraftInput): LoopAssetDraft {
  const plan = input.session.outputs.currentPlan;
  if (!plan) throw new Error("当前会话还没有可沉淀的回路方案");
  if (input.session.enterpriseId !== input.user.enterpriseId) {
    throw new Error("当前会话不属于该企业");
  }

  const title = normalizeTitle(input.title || plan.title || input.session.context.loopType);
  const domain = normalizeDomain(input.domain || plan.loopType || input.session.context.loopType || title);
  const createdAt = input.now || new Date().toISOString();
  const latestSessionVersion = input.session.outputs.versions.at(-1);
  const birthCertificate = buildBirthCertificate({
    session: input.session,
    plan,
    userId: input.user.id,
    createdAt,
  });

  return {
    asset: {
      enterpriseId: input.user.enterpriseId,
      title,
      domain,
      status: input.status || "incubating",
      sourceSessionId: input.session.id,
      ...matrixRefs(input.session.matrixIntegration),
      createdBy: input.user.id,
    },
    firstVersion: {
      versionNumber: 1,
      plan,
      ...(plan.maturityMapping ? { maturityMapping: plan.maturityMapping } : {}),
      birthCertificate,
      ...(latestSessionVersion?.id ? { sourceSessionVersionId: latestSessionVersion.id } : {}),
      changeReason: "session_promoted_to_loop_asset",
      createdBy: input.user.id,
    },
  };
}

export function buildManualLoopAssetDraft(input: BuildManualLoopAssetDraftInput): Omit<LoopAsset, "id" | "currentVersionId" | "createdAt" | "updatedAt"> {
  const title = normalizeTitle(input.title);
  const domain = normalizeDomain(input.domain || title);
  return {
    enterpriseId: input.user.enterpriseId,
    title,
    domain,
    status: input.status || "incubating",
    createdBy: input.user.id,
  };
}

export function buildLoopBirthLessonsFromHistory(input: BuildLoopBirthLessonsFromHistoryInput): string[] {
  const versionsByAssetId = new Map(input.currentVersions.map((version) => [version.assetId, version]));
  const eligibleAssets = input.assets.filter((asset) => {
    const currentVersion = versionsByAssetId.get(asset.id);
    return asset.status !== "retired" && Boolean(asset.currentVersionId) && currentVersion?.id === asset.currentVersionId;
  });
  const assetById = new Map(eligibleAssets.map((asset) => [asset.id, asset]));
  const sameDomainAssets = eligibleAssets.filter((asset) => asset.domain === input.domain);
  const sameDomainVersions = sameDomainAssets
    .map((asset) => versionsByAssetId.get(asset.id))
    .filter((version): version is LoopVersion => Boolean(version));

  const lessons = [
    sameDomainAssets.length
      ? `同领域已沉淀回路：${sameDomainAssets.map((asset) => asset.title).slice(0, 3).join("、")}`
      : "",
    roleLesson(sameDomainVersions),
    weakDimensionLesson(sameDomainVersions),
    dependencyLesson(input.relationships, assetById, input.domain),
  ].filter(Boolean);

  return [...new Set(lessons)].slice(0, input.maxLessons ?? 6);
}

export function buildLoopNetworkWarnings(input: BuildLoopNetworkWarningsInput): LoopNetworkWarning[] {
  const versionByAssetId = new Map(input.currentVersions.map((version) => [version.assetId, version]));
  const eligibleAssets = input.assets.filter((asset) => {
    const currentVersion = versionByAssetId.get(asset.id);
    return asset.status !== "retired" && Boolean(asset.currentVersionId) && currentVersion?.id === asset.currentVersionId;
  });
  const eligibleAssetIds = new Set(eligibleAssets.map((asset) => asset.id));
  const assetById = new Map(eligibleAssets.map((asset) => [asset.id, asset]));
  const relationships = input.relationships.filter((relationship) =>
    eligibleAssetIds.has(relationship.sourceAssetId) && eligibleAssetIds.has(relationship.targetAssetId),
  );

  return [
    ...isolatedLoopWarnings(eligibleAssets, relationships),
    ...dependencyConcentrationWarnings(relationships, assetById, input.dependencyConcentrationThreshold ?? 3),
    ...dependencyCycleWarnings(relationships, assetById),
    ...parentChildMaturityInversionWarnings(relationships, assetById, versionByAssetId),
  ];
}

export function buildLoopRelationshipDraft(input: BuildLoopRelationshipDraftInput): LoopRelationshipDraft {
  const sourceAssetId = input.sourceAssetId.trim();
  const targetAssetId = input.targetAssetId.trim();
  if (!sourceAssetId || !targetAssetId) throw new Error("回路关系必须包含源资产和目标资产");
  if (sourceAssetId === targetAssetId) throw new Error("回路资产不能指向自己");
  if (input.type !== "parent_child" && input.type !== "dependency") throw new Error("回路关系类型无效");

  const interfaceName = input.interfaceName?.trim();
  if (input.type === "dependency" && !interfaceName) throw new Error("依赖关系必须填写接口名称");

  return {
    enterpriseId: input.user.enterpriseId,
    sourceAssetId,
    targetAssetId,
    type: input.type,
    direction: "source_to_target",
    ...(interfaceName ? { interfaceName: interfaceName.slice(0, 120) } : {}),
    strength: input.strength || "important",
    createdBy: input.user.id,
  };
}

function isolatedLoopWarnings(assets: LoopAsset[], relationships: LoopRelationship[]): LoopNetworkWarning[] {
  const connectedAssetIds = new Set(relationships.flatMap((relationship) => [relationship.sourceAssetId, relationship.targetAssetId]));
  return assets
    .filter((asset) => !connectedAssetIds.has(asset.id))
    .map((asset) => ({
      id: `isolated_loop:${asset.id}`,
      type: "isolated_loop",
      severity: "info",
      title: "孤立回路",
      description: `“${asset.title}”还没有父子或依赖关系，暂时无法进入组织级回路网络分析。`,
      assetIds: [asset.id],
      relationshipIds: [],
    }));
}

function dependencyConcentrationWarnings(
  relationships: LoopRelationship[],
  assetById: Map<string, LoopAsset>,
  threshold: number,
): LoopNetworkWarning[] {
  const dependencyIdsByAssetId = new Map<string, string[]>();
  for (const relationship of relationships) {
    if (relationship.type !== "dependency") continue;
    dependencyIdsByAssetId.set(relationship.sourceAssetId, [...(dependencyIdsByAssetId.get(relationship.sourceAssetId) || []), relationship.id]);
    dependencyIdsByAssetId.set(relationship.targetAssetId, [...(dependencyIdsByAssetId.get(relationship.targetAssetId) || []), relationship.id]);
  }

  return [...dependencyIdsByAssetId.entries()]
    .filter(([, relationshipIds]) => relationshipIds.length >= threshold)
    .map(([assetId, relationshipIds]) => {
      const asset = assetById.get(assetId);
      return {
        id: `dependency_concentration:${assetId}`,
        type: "dependency_concentration",
        severity: relationshipIds.length >= threshold + 2 ? "critical" : "warning",
        title: "依赖集中",
        description: `“${asset?.title || assetId}”连接了 ${relationshipIds.length} 条依赖，建议检查是否已经成为跨回路瓶颈或单点风险。`,
        assetIds: [assetId],
        relationshipIds,
      };
    });
}

function dependencyCycleWarnings(
  relationships: LoopRelationship[],
  assetById: Map<string, LoopAsset>,
): LoopNetworkWarning[] {
  const dependencies = relationships.filter((relationship) => relationship.type === "dependency");
  const dependencyIds = new Set(dependencies.map((relationship) => relationship.id));
  const dependencyById = new Map(dependencies.map((relationship) => [relationship.id, relationship]));
  const outgoingByAssetId = new Map<string, LoopRelationship[]>();
  for (const relationship of dependencies) {
    outgoingByAssetId.set(relationship.sourceAssetId, [...(outgoingByAssetId.get(relationship.sourceAssetId) || []), relationship]);
  }

  const warnings = new Map<string, LoopNetworkWarning>();
  for (const relationship of dependencies) {
    const returnPath = findDependencyPath(relationship.targetAssetId, relationship.sourceAssetId, outgoingByAssetId, new Set([relationship.id]));
    if (!returnPath.length) continue;
    const cycleRelationshipIds = [relationship.id, ...returnPath.map((item) => item.id)].filter((id) => dependencyIds.has(id));
    const key = cycleRelationshipIds.slice().sort().join(":");
    if (warnings.has(key)) continue;
    const assetIds = uniqueSorted(cycleRelationshipIds.flatMap((id) => {
      const cycleRelationship = dependencyById.get(id);
      return cycleRelationship ? [cycleRelationship.sourceAssetId, cycleRelationship.targetAssetId] : [];
    }));
    const titles = assetIds.map((assetId) => assetById.get(assetId)?.title || assetId);
    warnings.set(key, {
      id: `dependency_cycle:${key}`,
      type: "dependency_cycle",
      severity: "warning",
      title: "依赖成环",
      description: `“${titles.join("、")}”之间存在双向或闭合依赖，建议明确主导回路、验收接口和异常升级规则。`,
      assetIds,
      relationshipIds: cycleRelationshipIds,
    });
  }

  return [...warnings.values()];
}

function findDependencyPath(
  currentAssetId: string,
  targetAssetId: string,
  outgoingByAssetId: Map<string, LoopRelationship[]>,
  visitedRelationshipIds: Set<string>,
): LoopRelationship[] {
  for (const relationship of outgoingByAssetId.get(currentAssetId) || []) {
    if (visitedRelationshipIds.has(relationship.id)) continue;
    if (relationship.targetAssetId === targetAssetId) return [relationship];
    const path = findDependencyPath(
      relationship.targetAssetId,
      targetAssetId,
      outgoingByAssetId,
      new Set([...visitedRelationshipIds, relationship.id]),
    );
    if (path.length) return [relationship, ...path];
  }
  return [];
}

function parentChildMaturityInversionWarnings(
  relationships: LoopRelationship[],
  assetById: Map<string, LoopAsset>,
  versionByAssetId: Map<string, LoopVersion>,
): LoopNetworkWarning[] {
  return relationships.flatMap((relationship) => {
    if (relationship.type !== "parent_child") return [];
    const parent = assetById.get(relationship.sourceAssetId);
    const child = assetById.get(relationship.targetAssetId);
    const parentLevel = versionByAssetId.get(relationship.sourceAssetId)?.maturityMapping?.overallLevel;
    const childLevel = versionByAssetId.get(relationship.targetAssetId)?.maturityMapping?.overallLevel;
    if (!parentLevel || !childLevel || parentLevel >= childLevel) return [];
    return [{
      id: `parent_child_maturity_inversion:${relationship.id}`,
      type: "parent_child_maturity_inversion",
      severity: "warning",
      title: "父子成熟度倒挂",
      description: `父回路“${parent?.title || relationship.sourceAssetId}”为 L${parentLevel}，子回路“${child?.title || relationship.targetAssetId}”为 L${childLevel}，建议复核父回路是否支撑子回路扩展。`,
      assetIds: [relationship.sourceAssetId, relationship.targetAssetId],
      relationshipIds: [relationship.id],
    }];
  });
}

function roleLesson(versions: LoopVersion[]) {
  const roles = uniqueSorted(versions.flatMap((version) => [
    ...(version.plan.organizationMap.humanRoles?.map((role) => role.name) || []),
    ...(version.plan.organizationMap.agentRoles?.map((role) => role.name) || []),
    ...(version.plan.organizationMap.systemRoles?.map((role) => role.name) || []),
  ]));
  return roles.length ? `同领域常见角色：${roles.slice(0, 6).join("、")}` : "";
}

function weakDimensionLesson(versions: LoopVersion[]) {
  const dimensions = uniqueSorted(versions.flatMap((version) => (
    version.maturityMapping?.maturity
      .filter((item) => item.level <= 2)
      .map((item) => maturityDimensionLabel(item.dimension)) || []
  )));
  return dimensions.length ? `同领域常见短板：${dimensions.slice(0, 4).join("、")}` : "";
}

function dependencyLesson(relationships: LoopRelationship[], assetById: Map<string, LoopAsset>, domain: string) {
  const interfaces = uniqueSorted(relationships.flatMap((relationship) => {
    if (relationship.type !== "dependency" || !relationship.interfaceName) return [];
    const source = assetById.get(relationship.sourceAssetId);
    const target = assetById.get(relationship.targetAssetId);
    if (!source || !target) return [];
    if (source?.domain !== domain && target?.domain !== domain) return [];
    return [relationship.interfaceName];
  }));
  return interfaces.length ? `同领域已有依赖接口：${interfaces.slice(0, 4).join("、")}` : "";
}

function uniqueSorted(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right, "zh-CN"));
}

function maturityDimensionLabel(dimension: MaturityDimension) {
  return customerDimensionLabel(dimension);
}

export function matchesMatrixAssetBinding(asset: LoopAsset, ref: MatrixAssetBindingRef) {
  return asset.enterpriseId === ref.enterpriseId
    && asset.status !== "retired"
    && asset.matrixWorkspaceId === ref.matrixWorkspaceId
    && asset.matrixCircuitLogicalId === ref.matrixCircuitLogicalId;
}

export function assertMatrixAssetBindingCompatible(asset: LoopAsset, integration: MatrixIntegrationContext | null | undefined) {
  if (!integration || !asset.matrixWorkspaceId || !asset.matrixCircuitLogicalId) return;
  const sameBinding = asset.matrixWorkspaceId === integration.matrixWorkspaceId
    && asset.matrixCircuitLogicalId === integration.circuitLogicalId;
  if (!sameBinding) {
    throw new Error("该回路资产已绑定另一个 Matrix Circuit，不能静默覆盖绑定关系");
  }
}

export function validateParentChildRelationshipDepth(
  draft: Pick<LoopRelationship, "sourceAssetId" | "targetAssetId" | "type">,
  existingRelationships: Array<Pick<LoopRelationship, "sourceAssetId" | "targetAssetId" | "type">>,
) {
  if (draft.type !== "parent_child") return;
  const parentByChild = new Map<string, string>();
  for (const relationship of existingRelationships) {
    if (relationship.type === "parent_child") parentByChild.set(relationship.targetAssetId, relationship.sourceAssetId);
  }
  if (parentByChild.has(draft.targetAssetId)) throw new Error("子回路已经存在父回路");
  parentByChild.set(draft.targetAssetId, draft.sourceAssetId);

  const childByParent = new Map<string, string[]>();
  for (const [child, parent] of parentByChild.entries()) {
    childByParent.set(parent, [...(childByParent.get(parent) || []), child]);
  }

  if (hasAncestor(parentByChild, draft.sourceAssetId, draft.targetAssetId)) {
    throw new Error("父子关系不能形成循环");
  }
  const root = findRoot(parentByChild, draft.targetAssetId);
  const maxDepth = maxTreeDepth(root, childByParent);
  if (maxDepth > 3) throw new Error("父子关系最多支持 3 层");
}

function buildBirthCertificate(input: {
  session: LoopDesignerSession;
  plan: LoopPlan;
  userId: string;
  createdAt: string;
}): LoopBirthCertificate {
  return {
    intent: input.session.context.loopPurpose || input.session.context.loopType || input.plan.loopType || input.plan.title,
    source: birthSource(input.session),
    references: birthReferences(input.session),
    lessonsFromHistory: [],
    expectedMaturity: input.plan.maturityMapping?.overallLevel,
    createdAt: input.createdAt,
    creatorId: input.userId,
  };
}

function hasAncestor(parentByChild: Map<string, string>, node: string, expectedAncestor: string) {
  let cursor = parentByChild.get(node);
  const visited = new Set<string>();
  while (cursor) {
    if (cursor === expectedAncestor) return true;
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = parentByChild.get(cursor);
  }
  return false;
}

function findRoot(parentByChild: Map<string, string>, node: string) {
  let root = node;
  const visited = new Set<string>();
  while (parentByChild.has(root) && !visited.has(root)) {
    visited.add(root);
    root = parentByChild.get(root) || root;
  }
  return root;
}

function maxTreeDepth(root: string, childByParent: Map<string, string[]>) {
  const walk = (node: string, depth: number): number => {
    const children = childByParent.get(node) || [];
    if (!children.length) return depth;
    return Math.max(...children.map((child) => walk(child, depth + 1)));
  };
  return walk(root, 1);
}

function birthSource(session: LoopDesignerSession): LoopBirthSource {
  if (session.matrixIntegration) return "matrix_origin";
  if (session.context.workflowStage === "questionnaire" || session.context.workflowStage === "diagnosis") return "questionnaire";
  if (session.outputs.blueprint) return "blueprint";
  return "manual";
}

function birthReferences(session: LoopDesignerSession) {
  return [
    `loop_designer_session:${session.id}`,
    ...(session.context.templateId ? [`industry_template:${session.context.templateId}`] : []),
    ...(session.outputs.blueprint?.preferredCandidateId ? [`blueprint_candidate:${session.outputs.blueprint.preferredCandidateId}`] : []),
    ...(session.matrixIntegration ? [`matrix_circuit:${session.matrixIntegration.circuitLogicalId}`] : []),
  ];
}

function matrixRefs(integration: MatrixIntegrationContext | null) {
  if (!integration) return {};
  return {
    matrixWorkspaceId: integration.matrixWorkspaceId,
    matrixCircuitLogicalId: integration.circuitLogicalId,
    matrixBaseVersionId: integration.baseVersionId,
  };
}

function normalizeTitle(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) throw new Error("回路资产标题不能为空");
  if (normalized.length > 160) return normalized.slice(0, 160);
  return normalized;
}

function normalizeDomain(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return "未分类";
  return normalized.length > 80 ? normalized.slice(0, 80) : normalized;
}
