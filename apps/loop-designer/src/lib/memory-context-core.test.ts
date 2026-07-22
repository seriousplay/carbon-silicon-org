import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { buildMemoryContextV1, formatMemoryContextForPrompt } from "./memory-context-core";
import type { LoopAsset, LoopVersion } from "./loop-assets-core";
import type { OrgProfileV1 } from "./org-profile-core";
import type { LoopPlan } from "./plan-schema";

const profile: OrgProfileV1 = {
  enterpriseId: "enterprise-1",
  loopCount: 2,
  maturityDistribution: { 1: 0, 2: 1, 3: 1, 4: 0, 5: 0 },
  humanRoles: ["回路主理人"],
  agentRoles: ["反馈整理智能体"],
  systemRoles: ["反馈看板"],
  glossary: { 客户反馈对象: "业务对象", 反馈交接: "组织接口" },
  commonDependencies: [{ sourceDomain: "客户成功", targetDomain: "产品", interfaceName: "反馈交接", frequency: 2 }],
  weakDimensions: [{ dimension: "orchestration", frequency: 2 }],
  updatedAt: "2026-06-19T00:00:00.000Z",
};

function asset(id: string, domain: string, updatedAt = "2026-06-19T00:00:00.000Z"): LoopAsset {
  return {
    id,
    enterpriseId: "enterprise-1",
    title: id === "asset-1" ? "客户反馈闭环" : "产品迭代闭环",
    domain,
    status: "active",
    currentVersionId: `version-${id}`,
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt,
  };
}

function version(assetId: string, loopType: string): LoopVersion {
  return {
    id: `version-${assetId}`,
    assetId,
    versionNumber: 1,
    plan: {
      title: `${loopType}方案`,
      executiveSummary: `${loopType}的组织经验。`,
      loopType,
      valueFlow: { start: "输入", end: "输出", targetCycleTime: "7 天" },
      toBeLoopCells: [{
        cellId: "cell-memory",
        cellLabel: "Cell 01",
        action: `${loopType}关键单元`,
        currentGap: "待复盘",
        recommendedMode: "结构化入口",
        actorAssignments: [
          { type: "human", roleId: "human_loop_owner", name: "回路主理人", responsibility: "确认业务判断和异常接管。" },
          { type: "agent", roleId: "agent_memory", name: "经验整理智能体", responsibility: "整理输入和历史经验。" },
          { type: "system", roleId: "system_memory", name: "组织记忆库", responsibility: "记录处理过程和复盘经验。" },
        ],
        timeEstimate: {
          processingMinutes: 30,
          waitingMinutes: 60,
          reworkMinutes: 20,
          confidence: "low",
          bottleneckLevel: "medium",
          bottleneckReason: "历史回路没有真实运行日志，处理时间作为低置信估算。",
        },
        controlProfile: {
          primaryActorType: "agent",
          primaryActorRoleId: "agent_memory",
          autonomyLevel: "agent_led_hitl",
          humanBoundary: "exception",
          agentExecutionRights: ["整理输入", "匹配历史经验", "生成复盘建议"],
          humanInterventionTriggers: ["业务判断不明确", "历史经验冲突", "出现异常情况"],
          canAutoProceedWhen: ["输入完整", "历史经验可追溯", "未触发异常接管"],
          nextAutonomyUpgrade: "补齐复盘模板和异常接管规则后，让 Agent 自动整理低风险经验记录。",
        },
        aiRole: "整理输入和历史经验",
        humanRole: "确认业务判断",
        interfaceContract: "待技术确认",
        governanceRule: "高风险必须请示",
        memoryRecord: "沉淀处理记录",
        acceptanceSignal: "形成可复用经验",
        nextValidation: "复盘",
      }],
      hitlNodes: [],
      organizationMap: { conflicts: ["冲突"], roleChanges: ["角色变化"], reportingChanges: [], sharedDataLayer: "共享对象" },
      governance: { kpis: [], arbitrationRules: [], interlocks: [], lifecycleRule: "复盘" },
      roadmap: [],
      assumptions: [],
      risks: [],
      validationQuestions: [],
    } as LoopPlan,
    maturityMapping: {
      assessedAt: "2026-06-19T00:00:00.000Z",
      assessmentMode: "algorithm_primary",
      alignment: [],
      maturity: [],
      overallLevel: 3,
      oneLineDiagnosis: "可参考",
      highlightDimensions: [],
      bottlenecks: [],
      recommendedAction: { dimension: "orchestration", priority: "optional", action: "复盘", actionType: "manual", expectedEffect: "沉淀经验" },
      upgradeSuggestions: [{ dimension: "orchestration", priority: "optional", action: "复盘", actionType: "manual", expectedEffect: "沉淀经验" }],
    },
    birthCertificate: {
      intent: `${loopType}冷启动`,
      source: "manual",
      references: [`loop_designer_session:${assetId}`],
      lessonsFromHistory: ["保留人工验收节点"],
      expectedMaturity: 3,
      createdAt: assetId === "asset-1" ? "2026-06-19T00:00:00.000Z" : "2026-06-18T00:00:00.000Z",
      creatorId: "user-1",
    },
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
  };
}

test("buildMemoryContextV1 carries structured org memory and same-domain references", () => {
  const context = buildMemoryContextV1({
    profile,
    assets: [asset("asset-1", "客户成功"), asset("asset-2", "产品", "2026-06-18T00:00:00.000Z")],
    currentVersions: [version("asset-1", "客户成功"), version("asset-2", "产品")],
    draft: { domain: "客户成功" },
    now: "2026-06-19T12:00:00.000Z",
  });

  assert.deepEqual(context.roleLibrary.humanRoles, ["回路主理人"]);
  assert.equal(context.loopCount, 2);
  assert.equal(context.glossary["客户反馈对象"], "业务对象");
  assert.equal(context.commonDependencies[0]?.interfaceName, "反馈交接");
  assert.equal(context.weakDimensions[0]?.dimension, "orchestration");
  assert.equal(context.birthCertificates[0]?.assetId, "asset-1");
  assert.equal(context.birthCertificates[0]?.lessonsFromHistory[0], "保留人工验收节点");
  assert.equal(context.referenceLoops[0]?.assetId, "asset-1");
  assert.equal(context.referenceLoops[0]?.versionId, "version-asset-1");
  assert.equal(context.referenceLoops[0]?.whyRelevant, "同领域、同类型回路，可作为组织经验参考。");
  assert.equal(context.referenceLoops[0]?.maturityLevel, 3);
});

test("buildMemoryContextV1 explains type-only reference relevance", () => {
  const context = buildMemoryContextV1({
    profile,
    assets: [asset("asset-1", "客户成功"), asset("asset-2", "产品", "2026-06-18T00:00:00.000Z")],
    currentVersions: [version("asset-1", "客户成功"), version("asset-2", "产品")],
    draft: { domain: "增长", loopType: "产品" },
    now: "2026-06-19T12:00:00.000Z",
  });

  assert.equal(context.referenceLoops[0]?.assetId, "asset-2");
  assert.equal(context.referenceLoops[0]?.whyRelevant, "同类型回路，可作为组织经验参考。");
});

test("buildMemoryContextV1 does not fabricate reference loops before enough assets exist", () => {
  const context = buildMemoryContextV1({
    profile: { ...profile, loopCount: 1 },
    assets: [asset("asset-1", "客户成功")],
    currentVersions: [version("asset-1", "客户成功")],
  });

  assert.deepEqual(context.referenceLoops, []);
  assert.equal(context.birthCertificates[0]?.intent, "客户成功冷启动");
});

test("buildMemoryContextV1 returns no references or birth cards for empty org memory", () => {
  const context = buildMemoryContextV1({
    profile: {
      ...profile,
      loopCount: 0,
      maturityDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      humanRoles: [],
      agentRoles: [],
      systemRoles: [],
      glossary: {},
      commonDependencies: [],
      weakDimensions: [],
    },
    assets: [],
    currentVersions: [],
    draft: { domain: "客户成功", loopType: "客户成功" },
    now: "2026-06-19T12:00:00.000Z",
  });

  assert.equal(context.loopCount, 0);
  assert.deepEqual(context.referenceLoops, []);
  assert.deepEqual(context.birthCertificates, []);
});

test("buildMemoryContextV1 only keeps domain or type matched assets as references", () => {
  const context = buildMemoryContextV1({
    profile: { ...profile, loopCount: 3 },
    assets: [
      asset("asset-1", "客户成功"),
      asset("asset-2", "产品", "2026-06-18T00:00:00.000Z"),
      asset("asset-3", "销售", "2026-06-17T00:00:00.000Z"),
    ],
    currentVersions: [
      version("asset-1", "客户成功"),
      version("asset-2", "产品"),
      version("asset-3", "销售"),
    ],
    draft: { domain: "客户成功", loopType: "客户成功" },
    now: "2026-06-19T12:00:00.000Z",
  });

  assert.deepEqual(context.referenceLoops.map((item) => item.assetId), ["asset-1"]);
  assert.equal(context.referenceLoops[0]?.whyRelevant, "同领域、同类型回路，可作为组织经验参考。");
});

test("buildMemoryContextV1 does not inject unrelated reference loops", () => {
  const context = buildMemoryContextV1({
    profile: { ...profile, loopCount: 3 },
    assets: [
      asset("asset-1", "客户成功"),
      asset("asset-2", "产品", "2026-06-18T00:00:00.000Z"),
      asset("asset-3", "销售", "2026-06-17T00:00:00.000Z"),
    ],
    currentVersions: [
      version("asset-1", "客户成功"),
      version("asset-2", "产品"),
      version("asset-3", "销售"),
    ],
    draft: { domain: "财务", loopType: "法务" },
    now: "2026-06-19T12:00:00.000Z",
  });

  assert.deepEqual(context.referenceLoops, []);
  assert.deepEqual(context.roleLibrary.humanRoles, ["回路主理人"]);
});

test("buildMemoryContextV1 caps five assets to three reference loops while retaining five birth cards", () => {
  const context = buildMemoryContextV1({
    profile: { ...profile, loopCount: 5 },
    assets: [
      asset("asset-1", "客户成功"),
      asset("asset-2", "产品", "2026-06-18T00:00:00.000Z"),
      asset("asset-3", "销售", "2026-06-17T00:00:00.000Z"),
      asset("asset-4", "运营", "2026-06-16T00:00:00.000Z"),
      asset("asset-5", "财务", "2026-06-15T00:00:00.000Z"),
    ],
    currentVersions: [
      version("asset-1", "客户成功"),
      version("asset-2", "产品"),
      version("asset-3", "销售"),
      version("asset-4", "运营"),
      version("asset-5", "财务"),
    ],
    draft: { domain: "客户成功", loopType: "客户成功" },
    now: "2026-06-19T12:00:00.000Z",
  });

  assert.deepEqual(context.referenceLoops.map((item) => item.assetId), ["asset-1"]);
  assert.deepEqual(context.birthCertificates.map((item) => item.assetId), ["asset-1", "asset-2", "asset-3", "asset-4", "asset-5"]);
});

test("buildMemoryContextV1 ignores asset shells and stale current version references", () => {
  const shell = { ...asset("asset-shell", "客户成功"), title: "空壳回路", currentVersionId: null };
  const stale = { ...asset("asset-stale", "客户成功"), title: "旧版本回路", currentVersionId: "missing-version" };
  const context = buildMemoryContextV1({
    profile: { ...profile, loopCount: 3 },
    assets: [asset("asset-1", "客户成功"), shell, stale],
    currentVersions: [
      version("asset-1", "客户成功"),
      version("asset-stale", "客户成功"),
    ],
    draft: { domain: "客户成功", loopType: "客户成功" },
    now: "2026-06-19T12:00:00.000Z",
  });

  assert.deepEqual(context.referenceLoops.map((item) => item.assetId), ["asset-1"]);
  assert.deepEqual(context.birthCertificates.map((item) => item.assetId), ["asset-1"]);
});

test("formatMemoryContextForPrompt serializes memory with guardrails", () => {
  const context = buildMemoryContextV1({
    profile,
    assets: [asset("asset-1", "客户成功"), asset("asset-2", "产品", "2026-06-18T00:00:00.000Z")],
    currentVersions: [version("asset-1", "客户成功"), version("asset-2", "产品")],
    draft: { domain: "客户成功" },
    now: "2026-06-19T12:00:00.000Z",
  });
  const prompt = formatMemoryContextForPrompt(context);

  assert.match(prompt, /组织记忆上下文/);
  assert.match(prompt, /已沉淀回路数：2；参考回路：有可参考回路/);
  assert.match(prompt, /人类角色库：回路主理人/);
  assert.match(prompt, /常见短板维度：协作衔接\(2\)/);
  assert.doesNotMatch(prompt, /orchestration\(2\)/);
  assert.match(prompt, /回路出生证摘要/);
  assert.match(prompt, /来源：loop_designer_session:asset-1/);
  assert.match(prompt, /历史经验：保留人工验收节点/);
  assert.match(prompt, /参考回路证据卡/);
  assert.match(prompt, /版本：version-asset-1/);
  assert.match(prompt, /同领域、同类型回路，可作为组织经验参考/);
  assert.match(prompt, /不得覆盖用户本次输入/);
  assert.match(prompt, /不能编造不存在的运行数据/);
});

test("designer generation can start from blank without org memory", () => {
  const workspace = readFileSync("src/components/designer-workspace.tsx", "utf8");
  const route = readFileSync("src/app/api/sessions/[sessionId]/generate/route.ts", "utf8");
  const generationJobs = readFileSync("src/lib/generation-jobs.ts", "utf8");
  assert.match(workspace, /useOrgMemory/);
  assert.match(workspace, /使用组织记忆/);
  assert.match(route, /useOrgMemory !== false/);
  assert.match(route, /enqueuePlanGenerationJob/);
  assert.match(generationJobs, /buildMemoryContextForEnterpriseBestEffort/);
  assert.match(generationJobs, /memoryContext = job\.useOrgMemory/);
});

test("memory context API only returns org context without invoking generation", () => {
  const route = readFileSync("src/app/api/memory/context/route.ts", "utf8");

  assert.match(route, /export async function POST/);
  assert.match(route, /getCurrentUser/);
  assert.match(route, /Unauthorized/);
  assert.match(route, /buildMemoryContextForEnterprise/);
  assert.match(route, /return NextResponse\.json\(\{ memoryContext \}\)/);
  assert.doesNotMatch(route, /generatePlan|callModel|completeChat|MODEL_API|model\.ts/);
});
