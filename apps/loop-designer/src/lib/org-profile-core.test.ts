import assert from "node:assert/strict";
import test from "node:test";
import { buildOrgProfileV1 } from "./org-profile-core";
import type { LoopAsset, LoopRelationship, LoopVersion } from "./loop-assets-core";
import type { LoopPlan, LoopMaturityMapping } from "./plan-schema";

const basePlan: LoopPlan = {
  title: "客户反馈闭环",
  executiveSummary: "把客户反馈转成可复盘的人机协同闭环。",
  loopType: "客户成功",
  valueFlow: { start: "客户反馈进入", end: "产品改进完成", targetCycleTime: "7 天" },
  toBeLoopCells: [{
    cellId: "cell-feedback",
    cellLabel: "Cell 01",
    action: "客户反馈进入并形成关闭结论。",
    currentGap: "反馈分散，关闭标准不一致。",
    recommendedMode: "结构化入口",
    actorAssignments: [
      { type: "human", roleId: "human-1", name: "回路主理人", responsibility: "审核高风险反馈和客户承诺。" },
      { type: "agent", roleId: "agent-1", name: "反馈整理智能体", responsibility: "整理反馈、提示风险并生成建议。" },
      { type: "system", roleId: "system-1", name: "反馈看板", responsibility: "记录反馈对象、关闭结论和复盘规则。" },
    ],
    timeEstimate: {
      processingMinutes: 45,
      waitingMinutes: 180,
      reworkMinutes: 60,
      confidence: "low",
      bottleneckLevel: "high",
      bottleneckReason: "反馈分散且关闭标准不一致，等待和返工需试运行校准。",
    },
    controlProfile: {
      primaryActorType: "agent",
      primaryActorRoleId: "agent-1",
      autonomyLevel: "agent_led_hitl",
      humanBoundary: "commitment",
      agentExecutionRights: ["整理反馈", "提示风险", "生成处理建议"],
      humanInterventionTriggers: ["涉及客户承诺", "风险等级高", "关闭结论有争议"],
      canAutoProceedWhen: ["反馈对象完整", "关闭标准明确", "未触发高风险承诺"],
      nextAutonomyUpgrade: "补齐关闭标准、审计记录和异常接管后，让 Agent 自动处理低风险反馈。",
    },
    aiRole: "AI 提取问题、归类风险并生成处理建议。",
    humanRole: "回路主理人审核高风险反馈和客户承诺。",
    interfaceContract: "反馈对象进入看板，由回路主理人验收关闭结论。",
    governanceRule: "涉及承诺或退款必须请示回路主理人。",
    memoryRecord: "沉淀反馈记录、处理建议、关闭结论和复盘规则。",
    acceptanceSignal: "反馈被关闭并进入复盘。",
    nextValidation: "验证反馈关闭周期是否降到 7 天。",
  }],
  hitlNodes: [{ node: "客户承诺", owner: "回路主理人", authority: "批准或驳回", trigger: "高风险反馈", tool: "反馈看板" }],
  organizationMap: {
    conflicts: ["反馈分散"],
    roleChanges: ["设置回路主理人"],
    reportingChanges: [],
    sharedDataLayer: "客户反馈对象",
    humanRoles: [{
      id: "human-1",
      name: "回路主理人",
      status: "建议角色",
      mission: "确保反馈闭环",
      responsibilityScope: ["反馈关闭", "高风险承诺"],
      responsibilities: ["审核反馈"],
      exclusions: ["直接承诺退款"],
      decisionRights: ["关闭反馈"],
      approvalRights: [],
      vetoRights: [],
      inputs: ["反馈对象"],
      outputs: ["关闭结论"],
      serviceLevel: "24 小时",
      availability: "工作日",
      exceptionOwnership: "高风险反馈",
      escalationTo: "业务负责人",
      suggestedCount: "1",
      capabilities: ["客户理解"],
    }],
    agentRoles: [{
      id: "agent-1",
      name: "反馈整理智能体",
      status: "建议角色",
      mission: "整理反馈",
      serves: ["回路主理人"],
      responsibilityScope: ["反馈整理", "风险提示"],
      tasks: ["提取问题"],
      autonomyLevel: "建议",
      readableData: ["反馈对象"],
      tools: ["反馈看板"],
      outputs: ["结构化问题"],
      qualityStandard: "可复核",
      allowedActions: ["生成摘要"],
      approvalRequiredActions: ["发送客户"],
      prohibitedActions: ["承诺退款"],
      hitlTriggers: ["高风险反馈"],
      supervisorRoleId: "human-1",
      fallback: "人工整理",
      shutdownCondition: "摘要错误",
      cadence: "每日",
      contextSources: ["历史反馈"],
      auditRequirements: ["保留摘要版本"],
    }],
    systemRoles: [{
      id: "system-1",
      name: "反馈看板",
      status: "已有角色",
      mission: "保存反馈状态",
      responsibilityScope: ["反馈记录", "状态流转"],
      businessObjects: ["客户反馈对象"],
      records: ["反馈记录"],
      capabilities: ["状态流转"],
      inputs: ["客户反馈"],
      outputs: ["反馈对象"],
      sourceOfTruth: true,
      accessControl: "按角色授权",
      integrationMode: "API",
      constraints: ["字段必须完整"],
      manualFallback: "人工录入",
    }],
    interfaces: [{
      id: "interface-1",
      name: "反馈交接",
      sourceId: "system-1",
      targetId: "agent-1",
      riskLevel: "常规",
      trigger: "新增反馈",
      handoffObject: "客户反馈对象",
      requiredInputs: ["原始反馈"],
      expectedOutputs: ["结构化问题"],
      responsibleRoleId: "agent-1",
      acceptanceRoleId: "human-1",
      serviceLevel: "4 小时",
      acceptanceCriteria: ["问题可复核"],
      failureModes: ["字段缺失"],
      retryRule: "补齐后重试",
      timeoutEscalation: "业务负责人",
      humanFallback: "人工整理",
      interfaceType: "API",
      protocol: "JSON",
      dataObject: "客户反馈对象",
      minimumFields: ["客户", "问题"],
      authorization: "服务账号",
      idempotency: "反馈 ID",
      auditRecord: "接口日志",
      sourceOfTruth: "反馈看板",
    }],
  },
  governance: {
    kpis: [{ name: "关闭周期", current: "14 天", target: "7 天", cadence: "每周" }],
    arbitrationRules: ["重大承诺由回路主理人裁决"],
    interlocks: ["沉淀到产品迭代回路"],
    lifecycleRule: "连续两轮未改善则重新设计接口",
  },
  roadmap: [1, 2, 3, 4].map((week) => ({ week, theme: `第${week}周`, actions: ["试运行"], milestone: "形成记录", checkpoint: "周复盘" })),
  assumptions: ["反馈来源可接入"],
  risks: ["数据口径不一致"],
  validationQuestions: ["谁负责关闭反馈？"],
};

const weakMapping: LoopMaturityMapping = {
  assessedAt: "2026-06-19T00:00:00.000Z",
  assessmentMode: "algorithm_primary",
  alignment: [],
  maturity: [
    { dimension: "loop_maturity", level: 2, score: 45, userExplanation: "闭环弱", evidence: [] },
    { dimension: "orchestration", level: 1, score: 35, userExplanation: "编排弱", evidence: [] },
  ],
  overallLevel: 2,
  oneLineDiagnosis: "成熟度不足",
  highlightDimensions: [],
  bottlenecks: ["编排弱"],
  recommendedAction: { dimension: "orchestration", priority: "critical", action: "补齐编排", actionType: "manual", expectedEffect: "更清晰" },
  upgradeSuggestions: [{ dimension: "orchestration", priority: "critical", action: "补齐编排", actionType: "manual", expectedEffect: "更清晰" }],
};

function asset(id: string, status: LoopAsset["status"] = "active"): LoopAsset {
  return {
    id,
    enterpriseId: "enterprise-1",
    title: id === "asset-1" ? "客户反馈闭环" : "产品迭代闭环",
    domain: id === "asset-1" ? "客户成功" : "产品",
    status,
    currentVersionId: `version-${id}`,
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
  };
}

function version(assetId: string): LoopVersion {
  return {
    id: `version-${assetId}`,
    assetId,
    versionNumber: 1,
    plan: basePlan,
    maturityMapping: weakMapping,
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
  };
}

test("buildOrgProfileV1 builds structured memory from active loop assets", () => {
  const relationships: LoopRelationship[] = [{
    id: "relationship-1",
    enterpriseId: "enterprise-1",
    sourceAssetId: "asset-1",
    targetAssetId: "asset-2",
    type: "dependency",
    interfaceName: "反馈交接",
    strength: "critical",
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
  }];

  const profile = buildOrgProfileV1({
    enterpriseId: "enterprise-1",
    assets: [asset("asset-1"), asset("asset-2"), asset("asset-3", "retired")],
    currentVersions: [version("asset-1"), version("asset-2"), version("asset-3")],
    relationships,
    now: "2026-06-19T12:00:00.000Z",
  });

  assert.equal(profile.loopCount, 2);
  assert.equal(profile.maturityDistribution[2], 2);
  assert.deepEqual(profile.humanRoles, ["回路主理人"]);
  assert.deepEqual(profile.agentRoles, ["反馈整理智能体"]);
  assert.deepEqual(profile.systemRoles, ["反馈看板"]);
  assert.equal(profile.glossary["客户反馈对象"], "业务对象");
  assert.deepEqual(profile.commonDependencies, [{
    sourceDomain: "客户成功",
    targetDomain: "产品",
    interfaceName: "反馈交接",
    frequency: 1,
  }]);
  assert.deepEqual(profile.weakDimensions, [
    { dimension: "loop_maturity", frequency: 2 },
    { dimension: "orchestration", frequency: 2 },
  ]);
});

test("buildOrgProfileV1 ignores asset shells without matching current versions", () => {
  const shellAsset: LoopAsset = {
    ...asset("asset-4"),
    title: "空壳回路",
    domain: "未确认领域",
    currentVersionId: null,
  };
  const staleAsset: LoopAsset = {
    ...asset("asset-5"),
    title: "旧版本回路",
    domain: "旧领域",
    currentVersionId: "missing-version",
  };
  const relationships: LoopRelationship[] = [{
    id: "relationship-1",
    enterpriseId: "enterprise-1",
    sourceAssetId: "asset-1",
    targetAssetId: "asset-4",
    type: "dependency",
    interfaceName: "未确认交接",
    strength: "critical",
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
  }];

  const profile = buildOrgProfileV1({
    enterpriseId: "enterprise-1",
    assets: [asset("asset-1"), shellAsset, staleAsset],
    currentVersions: [version("asset-1"), version("asset-5")],
    relationships,
    now: "2026-06-19T12:00:00.000Z",
  });

  assert.equal(profile.loopCount, 1);
  assert.equal(profile.glossary["空壳回路"], undefined);
  assert.equal(profile.glossary["未确认领域"], undefined);
  assert.equal(profile.glossary["旧版本回路"], undefined);
  assert.deepEqual(profile.commonDependencies, []);
});
