import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assertMatrixAssetBindingCompatible, buildLoopAssetDraft, buildLoopBirthLessonsFromHistory, buildLoopNetworkWarnings, buildLoopRelationshipDraft, buildManualLoopAssetDraft, matchesMatrixAssetBinding, validateParentChildRelationshipDepth } from "./loop-assets-core";
import type { AppUser } from "./app-session";
import type { LoopPlan, LoopMaturityMapping } from "./plan-schema";
import type { LoopAsset, LoopRelationship, LoopVersion } from "./loop-assets-core";
import type { LoopDesignerSession } from "./session-types";

const user: AppUser = {
  id: "user-1",
  tenantKey: "tenant-1",
  enterpriseId: "enterprise-1",
  openId: "open-1",
  unionId: null,
  feishuUserId: null,
  displayName: "测试用户",
  avatarUrl: null,
};

const plan: LoopPlan = {
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
      { type: "human", roleId: "human_loop_owner", name: "回路主理人", responsibility: "审核高风险反馈和客户承诺。" },
      { type: "agent", roleId: "agent_feedback", name: "反馈整理智能体", responsibility: "提取问题、归类风险并生成处理建议。" },
      { type: "system", roleId: "system_feedback", name: "反馈看板", responsibility: "记录反馈对象、关闭结论和复盘规则。" },
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
      primaryActorRoleId: "agent_feedback",
      autonomyLevel: "agent_led_hitl",
      humanBoundary: "commitment",
      agentExecutionRights: ["提取反馈字段", "归类风险", "生成处理建议"],
      humanInterventionTriggers: ["涉及客户承诺或退款", "风险等级高", "关闭标准冲突"],
      canAutoProceedWhen: ["反馈字段完整", "关闭标准明确", "未触发客户承诺"],
      nextAutonomyUpgrade: "补齐关闭标准和审计记录后，让 Agent 自动处理低风险反馈，人保留承诺和异常边界。",
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
  organizationMap: { conflicts: ["反馈分散"], roleChanges: ["设置回路主理人"], reportingChanges: [], sharedDataLayer: "客户反馈对象" },
  governance: {
    kpis: [
      { name: "关闭周期", current: "14 天", target: "7 天", cadence: "每周" },
      { name: "复发率", current: "未知", target: "<10%", cadence: "每月" },
    ],
    arbitrationRules: ["重大承诺由回路主理人裁决"],
    interlocks: ["沉淀到产品迭代回路"],
    lifecycleRule: "连续两轮未改善则重新设计接口",
  },
  roadmap: [1, 2, 3, 4].map((week) => ({ week, theme: `第${week}周`, actions: ["试运行"], milestone: "形成记录", checkpoint: "周复盘" })),
  assumptions: ["反馈来源可接入"],
  risks: ["数据口径不一致"],
  validationQuestions: ["谁负责关闭反馈？"],
};

function session(overrides: Partial<LoopDesignerSession> = {}): LoopDesignerSession {
  return {
    id: "session-1",
    status: "submitted",
    userId: user.id,
    enterpriseId: user.enterpriseId,
    participantSnapshot: {},
    context: { currentStep: 5, workflowStage: "loop_design", loopType: "客户反馈" },
    responses: {},
    outputs: {
      messages: [],
      currentPlan: plan,
      versions: [{ id: "session-version-1", createdAt: "2026-06-19T00:00:00.000Z", plan }],
      refinementCount: 0,
    },
    createdAt: "2026-06-19T00:00:00.000Z",
    submittedAt: "2026-06-19T00:00:00.000Z",
    matrixIntegration: null,
    ...overrides,
  };
}

test("buildLoopAssetDraft promotes a submitted session into an asset draft", () => {
  const draft = buildLoopAssetDraft({
    user,
    session: session(),
    now: "2026-06-19T12:00:00.000Z",
  });

  assert.equal(draft.asset.enterpriseId, "enterprise-1");
  assert.equal(draft.asset.title, "客户反馈闭环");
  assert.equal(draft.asset.domain, "客户成功");
  assert.equal(draft.asset.status, "incubating");
  assert.equal(draft.asset.sourceSessionId, "session-1");
  assert.equal(draft.firstVersion.versionNumber, 1);
  assert.equal(draft.firstVersion.sourceSessionVersionId, "session-version-1");
  assert.equal(draft.firstVersion.birthCertificate?.source, "manual");
  assert.deepEqual(draft.firstVersion.birthCertificate?.references, ["loop_designer_session:session-1"]);
});

test("buildLoopAssetDraft preserves Matrix references and birth source", () => {
  const draft = buildLoopAssetDraft({
    user,
    session: session({
      context: {
        currentStep: 5,
        loopType: "客户反馈",
        loopPurpose: "缩短高风险客户反馈的闭环周期",
      },
      matrixIntegration: {
        matrixWorkspaceId: "workspace-1",
        circuitLogicalId: "circuit-feedback",
        baseVersionId: "version-1",
        matrixUserId: "matrix-user-1",
        integrationStatus: "designing",
        launchJti: "launch-1",
      },
    }),
  });

  assert.equal(draft.asset.matrixWorkspaceId, "workspace-1");
  assert.equal(draft.asset.matrixCircuitLogicalId, "circuit-feedback");
  assert.equal(draft.asset.matrixBaseVersionId, "version-1");
  assert.equal(draft.firstVersion.birthCertificate?.source, "matrix_origin");
  assert.equal(draft.firstVersion.birthCertificate?.intent, "缩短高风险客户反馈的闭环周期");
  assert.ok(draft.firstVersion.birthCertificate?.references.includes("matrix_circuit:circuit-feedback"));
});

test("buildManualLoopAssetDraft creates an asset shell without session references", () => {
  const draft = buildManualLoopAssetDraft({
    user,
    title: "  客户增长回路  ",
    domain: "  增长  ",
    status: "active",
  });

  assert.equal(draft.enterpriseId, "enterprise-1");
  assert.equal(draft.title, "客户增长回路");
  assert.equal(draft.domain, "增长");
  assert.equal(draft.status, "active");
  assert.equal(draft.createdBy, "user-1");
  assert.equal("sourceSessionId" in draft, false);
});

test("buildLoopBirthLessonsFromHistory derives lessons from existing loop assets", () => {
  const assets: LoopAsset[] = [
    {
      id: "asset-1",
      enterpriseId: "enterprise-1",
      title: "客户反馈闭环",
      domain: "客户成功",
      status: "active",
      currentVersionId: "version-1",
      createdBy: "user-1",
      createdAt: "2026-06-19T00:00:00.000Z",
      updatedAt: "2026-06-19T00:00:00.000Z",
    },
    {
      id: "asset-2",
      enterpriseId: "enterprise-1",
      title: "产品迭代回路",
      domain: "产品",
      status: "active",
      currentVersionId: "version-2",
      createdBy: "user-1",
      createdAt: "2026-06-19T00:00:00.000Z",
      updatedAt: "2026-06-19T00:00:00.000Z",
    },
  ];
  const currentVersions: LoopVersion[] = [{
    id: "version-1",
    assetId: "asset-1",
    versionNumber: 1,
    plan: {
      ...plan,
      organizationMap: {
        ...plan.organizationMap,
        humanRoles: [{
          id: "loop-owner",
          name: "回路主理人",
          status: "已有角色",
          mission: "负责客户反馈闭环的最终业务结果",
          responsibilityScope: ["客户反馈闭环", "关闭标准", "高风险承诺"],
          responsibilities: ["定义关闭标准"],
          exclusions: ["不直接承诺产品排期"],
          decisionRights: ["决定反馈优先级"],
          approvalRights: ["批准高风险承诺"],
          vetoRights: [],
          inputs: ["客户反馈"],
          outputs: ["关闭结论"],
          serviceLevel: "每周复盘",
          availability: "工作日响应",
          exceptionOwnership: "升级未关闭反馈",
          escalationTo: "经营例会",
          suggestedCount: "1 人",
          capabilities: ["客户理解", "跨部门协调"],
        }],
      },
    },
    maturityMapping: maturityMapping(),
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
  }, {
    id: "version-2",
    assetId: "asset-2",
    versionNumber: 1,
    plan,
    maturityMapping: maturityMapping(),
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
  }];
  const relationships: LoopRelationship[] = [{
    id: "relationship-1",
    enterpriseId: "enterprise-1",
    sourceAssetId: "asset-1",
    targetAssetId: "asset-2",
    type: "dependency",
    direction: "source_to_target",
    interfaceName: "客户反馈交接单",
    strength: "important",
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
  }];

  const lessons = buildLoopBirthLessonsFromHistory({
    domain: "客户成功",
    assets,
    currentVersions,
    relationships,
  });

  assert.ok(lessons.some((lesson) => lesson.includes("同领域已沉淀回路：客户反馈闭环")));
  assert.ok(lessons.some((lesson) => lesson.includes("同领域常见角色：回路主理人")));
  assert.ok(lessons.some((lesson) => lesson.includes("同领域常见短板：闭环完整度")));
  assert.ok(lessons.some((lesson) => lesson.includes("同领域已有依赖接口：客户反馈交接单")));
});

test("buildLoopBirthLessonsFromHistory ignores asset shells without matching current versions", () => {
  const assets: LoopAsset[] = [
    loopAsset("confirmed", "客户反馈闭环", "客户成功"),
    { ...loopAsset("shell", "空壳反馈回路", "客户成功"), currentVersionId: null },
    { ...loopAsset("stale", "旧版反馈回路", "客户成功"), currentVersionId: "missing-version" },
  ];
  const relationships: LoopRelationship[] = [
    relationship("rel-shell", "confirmed", "shell", "dependency"),
    relationship("rel-stale", "stale", "confirmed", "dependency"),
  ];

  const lessons = buildLoopBirthLessonsFromHistory({
    domain: "客户成功",
    assets,
    currentVersions: [loopVersion("confirmed", 3), loopVersion("stale", 3)],
    relationships,
  });

  assert.ok(lessons.some((lesson) => lesson.includes("同领域已沉淀回路：客户反馈闭环")));
  assert.ok(!lessons.some((lesson) => lesson.includes("空壳反馈回路")));
  assert.ok(!lessons.some((lesson) => lesson.includes("旧版反馈回路")));
  assert.ok(!lessons.some((lesson) => lesson.includes("同领域已有依赖接口")));
});

test("buildLoopNetworkWarnings detects isolated, concentrated, cyclic and inverted loop risks", () => {
  const assets: LoopAsset[] = [
    loopAsset("parent", "客户总回路", "客户成功"),
    loopAsset("child", "客户反馈子回路", "客户成功"),
    loopAsset("product", "产品迭代回路", "产品"),
    loopAsset("sales", "销售线索回路", "销售"),
    loopAsset("isolated", "孤立实验回路", "实验"),
  ];
  const currentVersions: LoopVersion[] = [
    loopVersion("parent", 2),
    loopVersion("child", 4),
    loopVersion("product", 3),
    loopVersion("sales", 3),
    loopVersion("isolated", 3),
  ];
  const relationships: LoopRelationship[] = [
    relationship("rel-parent", "parent", "child", "parent_child"),
    relationship("rel-product", "parent", "product", "dependency"),
    relationship("rel-product-sales", "product", "sales", "dependency"),
    relationship("rel-sales", "sales", "parent", "dependency"),
  ];

  const warnings = buildLoopNetworkWarnings({
    assets,
    currentVersions,
    relationships,
    dependencyConcentrationThreshold: 2,
  });

  assert.ok(warnings.some((warning) => warning.type === "isolated_loop" && warning.assetIds.includes("isolated")));
  assert.ok(warnings.some((warning) => warning.type === "dependency_concentration" && warning.assetIds.includes("parent")));
  assert.ok(warnings.some((warning) => warning.type === "dependency_cycle" && warning.relationshipIds.includes("rel-product-sales")));
  assert.ok(warnings.some((warning) => warning.type === "parent_child_maturity_inversion" && warning.relationshipIds.includes("rel-parent")));
});

test("buildLoopNetworkWarnings ignores asset shells and stale current version references", () => {
  const assets: LoopAsset[] = [
    loopAsset("confirmed", "客户反馈闭环", "客户成功"),
    { ...loopAsset("shell", "空壳回路", "客户成功"), currentVersionId: null },
    { ...loopAsset("stale", "旧版回路", "客户成功"), currentVersionId: "missing-version" },
  ];
  const warnings = buildLoopNetworkWarnings({
    assets,
    currentVersions: [loopVersion("confirmed", 3), loopVersion("stale", 3)],
    relationships: [
      relationship("rel-shell", "confirmed", "shell", "dependency"),
      relationship("rel-stale", "stale", "confirmed", "dependency"),
    ],
  });

  assert.ok(warnings.some((warning) => warning.type === "isolated_loop" && warning.assetIds.includes("confirmed")));
  assert.ok(!warnings.some((warning) => warning.assetIds.includes("shell")));
  assert.ok(!warnings.some((warning) => warning.assetIds.includes("stale")));
  assert.ok(!warnings.some((warning) => warning.relationshipIds.includes("rel-shell") || warning.relationshipIds.includes("rel-stale")));
});

test("matchesMatrixAssetBinding finds active assets for the same Matrix circuit", () => {
  const asset = {
    id: "asset-1",
    enterpriseId: "enterprise-1",
    title: "客户反馈闭环",
    domain: "客户成功",
    status: "active" as const,
    currentVersionId: "version-1",
    matrixWorkspaceId: "workspace-1",
    matrixCircuitLogicalId: "circuit-feedback",
    matrixBaseVersionId: "base-1",
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
  };

  assert.equal(matchesMatrixAssetBinding(asset, {
    enterpriseId: "enterprise-1",
    matrixWorkspaceId: "workspace-1",
    matrixCircuitLogicalId: "circuit-feedback",
  }), true);
  assert.equal(matchesMatrixAssetBinding({ ...asset, status: "retired" }, {
    enterpriseId: "enterprise-1",
    matrixWorkspaceId: "workspace-1",
    matrixCircuitLogicalId: "circuit-feedback",
  }), false);
  assert.equal(matchesMatrixAssetBinding(asset, {
    enterpriseId: "other-enterprise",
    matrixWorkspaceId: "workspace-1",
    matrixCircuitLogicalId: "circuit-feedback",
  }), false);
});

test("assertMatrixAssetBindingCompatible blocks silent Matrix circuit rebinding", () => {
  const asset = {
    id: "asset-1",
    enterpriseId: "enterprise-1",
    title: "客户反馈闭环",
    domain: "客户成功",
    status: "active" as const,
    currentVersionId: "version-1",
    matrixWorkspaceId: "workspace-1",
    matrixCircuitLogicalId: "circuit-feedback",
    matrixBaseVersionId: "base-1",
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
  };
  const integration = {
    matrixWorkspaceId: "workspace-1",
    circuitLogicalId: "circuit-feedback",
    baseVersionId: "base-2",
    matrixUserId: "matrix-user-1",
    integrationStatus: "designing" as const,
    launchJti: "launch-1",
  };

  assert.doesNotThrow(() => assertMatrixAssetBindingCompatible(asset, integration));
  assert.doesNotThrow(() => assertMatrixAssetBindingCompatible({ ...asset, matrixWorkspaceId: undefined, matrixCircuitLogicalId: undefined }, integration));
  assert.throws(
    () => assertMatrixAssetBindingCompatible(asset, { ...integration, circuitLogicalId: "circuit-other" }),
    /另一个 Matrix Circuit/,
  );
});

test("buildLoopAssetDraft rejects sessions without a current plan", () => {
  assert.throws(
    () => buildLoopAssetDraft({
      user,
      session: session({ outputs: { messages: [], versions: [], refinementCount: 0 } }),
    }),
    /还没有可沉淀的回路方案/,
  );
});

test("buildLoopAssetDraft enforces enterprise ownership", () => {
  assert.throws(
    () => buildLoopAssetDraft({
      user,
      session: session({ enterpriseId: "other-enterprise" }),
    }),
    /不属于该企业/,
  );
});

test("buildLoopRelationshipDraft requires dependency interface names", () => {
  assert.throws(
    () => buildLoopRelationshipDraft({
      user,
      sourceAssetId: "asset-1",
      targetAssetId: "asset-2",
      type: "dependency",
    }),
    /接口名称/,
  );
});

test("buildLoopRelationshipDraft rejects self references", () => {
  assert.throws(
    () => buildLoopRelationshipDraft({
      user,
      sourceAssetId: "asset-1",
      targetAssetId: "asset-1",
      type: "parent_child",
    }),
    /不能指向自己/,
  );
});

test("validateParentChildRelationshipDepth keeps parent-child trees within three levels", () => {
  assert.throws(
    () => validateParentChildRelationshipDepth(
      { sourceAssetId: "asset-3", targetAssetId: "asset-4", type: "parent_child" },
      [
        { sourceAssetId: "asset-1", targetAssetId: "asset-2", type: "parent_child" },
        { sourceAssetId: "asset-2", targetAssetId: "asset-3", type: "parent_child" },
      ],
    ),
    /最多支持 3 层/,
  );
});

test("validateParentChildRelationshipDepth rejects parent-child cycles", () => {
  assert.throws(
    () => validateParentChildRelationshipDepth(
      { sourceAssetId: "asset-3", targetAssetId: "asset-1", type: "parent_child" },
      [
        { sourceAssetId: "asset-1", targetAssetId: "asset-2", type: "parent_child" },
        { sourceAssetId: "asset-2", targetAssetId: "asset-3", type: "parent_child" },
      ],
    ),
    /不能形成循环/,
  );
});

test("Loop asset detail API exposes a read endpoint", () => {
  const route = readFileSync("src/app/api/loop-assets/[assetId]/route.ts", "utf8");
  assert.match(route, /export async function GET/);
  assert.match(route, /getLoopAssetDetails/);
  assert.match(route, /Loop asset not found/);
});

test("Loop asset creation API accepts sourceSessionId while preserving sessionId compatibility", () => {
  const route = readFileSync("src/app/api/loop-assets/route.ts", "utf8");

  assert.match(route, /sourceSessionId\?: string/);
  assert.match(route, /const sourceSessionId = body\.sourceSessionId \|\| body\.sessionId/);
  assert.match(route, /sessionId: sourceSessionId/);
  assert.doesNotMatch(route, /if \(!body\.sessionId\)/);
});

test("Loop asset promotion recovers source-session uniqueness races as idempotent returns", () => {
  const service = readFileSync("src/lib/loop-assets.ts", "utf8");

  assert.match(service, /function isUniqueViolation/);
  assert.match(service, /error\?\.code === "23505"/);
  assert.match(service, /const racedAsset = await findAssetBySourceSession\(user\.enterpriseId, input\.sessionId\)/);
  assert.match(service, /if \(racedAsset && racedVersion\) return \{ asset: racedAsset, currentVersion: racedVersion, created: false \}/);
});

test("Loop relationship creation recovers uniqueness races as idempotent returns", () => {
  const service = readFileSync("src/lib/loop-relationships.ts", "utf8");

  assert.match(service, /function isUniqueViolation/);
  assert.match(service, /error\?\.code === "23505"/);
  assert.match(service, /const existingRelationship = await findExistingLoopRelationship\(user, draft\)/);
  assert.match(service, /if \(existingRelationship\) return existingRelationship/);
  assert.match(service, /\.eq\("source_asset_id", draft\.sourceAssetId\)/);
  assert.match(service, /\.eq\("target_asset_id", draft\.targetAssetId\)/);
  assert.match(service, /\.eq\("interface_name", draft\.interfaceName \|\| ""\)/);
});

test("Loop asset detail page exposes birth certificate references and lessons", () => {
  const page = readFileSync("src/app/assets/[assetId]/page.tsx", "utf8");

  assert.match(page, /参考来源/);
  assert.match(page, /birth\.references/);
  assert.match(page, /历史经验/);
  assert.match(page, /birth\.lessonsFromHistory/);
});

test("Loop asset status updates require enterprise asset admin permission", () => {
  const route = readFileSync("src/app/api/loop-assets/[assetId]/route.ts", "utf8");
  const adminAuth = readFileSync("src/lib/admin-auth.ts", "utf8");
  assert.match(adminAuth, /manage_loop_assets/);
  assert.match(route, /requireAdmin\(user, \["manage_loop_assets"\]\)/);
  assert.ok(route.indexOf("requireAdmin(user, [\"manage_loop_assets\"])") < route.indexOf("const asset = await updateLoopAssetStatus"));
});

test("Loop asset versions API publishes iteration sessions", () => {
  const route = readFileSync("src/app/api/loop-assets/[assetId]/versions/route.ts", "utf8");
  assert.match(route, /export async function POST/);
  assert.match(route, /createLoopAssetVersionFromSession/);
  assert.match(route, /sessionId is required/);
  assert.match(route, /sourceSessionId\?: string/);
  assert.match(route, /const sourceSessionId = body\.sourceSessionId \|\| body\.sessionId/);
  assert.match(route, /sessionId: sourceSessionId/);
});

test("asset iteration sessions keep asset domain for memory matching", () => {
  const service = readFileSync("src/lib/loop-assets.ts", "utf8");
  const iterationCreator = service.slice(
    service.indexOf("export async function createLoopAssetIterationSession"),
    service.indexOf("async function createVersionFromIterationSession"),
  );

  assert.match(iterationCreator, /loopType: details\.asset\.domain/);
  assert.match(iterationCreator, /loopPurpose: `从 Loop OS 资产迭代：\$\{details\.asset\.title\}`/);
  assert.match(iterationCreator, /sourceAssetId: details\.asset\.id/);
  assert.match(iterationCreator, /sourceAssetVersionId: details\.currentVersion\.id/);
  assert.doesNotMatch(iterationCreator, /loopType: details\.asset\.title/);
});

test("asset iteration version promotion refreshes the session Matrix version reference", () => {
  const service = readFileSync("src/lib/loop-assets.ts", "utf8");

  assert.match(service, /updateSessionAssetVersionRef/);
  assert.match(service, /sourceAssetVersionId:\s*versionId/);
  assert.ok(
    service.indexOf("await updateSessionAssetVersionRef(user, session, currentVersion.id)")
      < service.indexOf("versionCreated: true"),
    "the session version ref must be updated before returning a promoted version",
  );
});

test("asset iteration version promotion recovers source-version uniqueness races", () => {
  const service = readFileSync("src/lib/loop-assets.ts", "utf8");

  assert.match(service, /findAssetVersionBySourceSessionVersion/);
  assert.match(service, /isUniqueViolation\(versionError\) && latestSessionVersion\?\.id/);
  assert.match(service, /const asset = await updateAssetCurrentVersion\(user, details\.asset\.id, racedVersion\.id\)/);
  assert.match(service, /await updateSessionAssetVersionRef\(user, session, racedVersion\.id\)/);
  assert.match(service, /versionCreated: false/);
  assert.ok(
    service.indexOf("const asset = await updateAssetCurrentVersion(user, details.asset.id, racedVersion.id)")
      < service.indexOf("await updateSessionAssetVersionRef(user, session, racedVersion.id)"),
    "race recovery must stabilize the asset current version before updating the session version ref",
  );
});

test("Loop asset version promotion has a database idempotency guard", () => {
  const migration = readFileSync("supabase/migrations/202606200001_loop_os_version_source_idempotency.sql", "utf8");

  assert.match(migration, /create unique index if not exists idx_loop_os_versions_source_session_version_unique/);
  assert.match(migration, /on public\.loop_os_versions\(asset_id, source_session_version_id\)/);
  assert.match(migration, /where source_session_version_id is not null/);
});

test("Matrix circuit asset binding has a database uniqueness guard", () => {
  const migration = readFileSync("supabase/migrations/202606200002_loop_os_matrix_binding_unique.sql", "utf8");

  assert.match(migration, /create unique index if not exists idx_loop_os_assets_matrix_circuit_active_unique/);
  assert.match(migration, /on public\.loop_os_assets\(enterprise_id, matrix_workspace_id, matrix_circuit_logical_id\)/);
  assert.match(migration, /matrix_workspace_id is not null/);
  assert.match(migration, /matrix_circuit_logical_id is not null/);
  assert.match(migration, /status <> 'retired'/);
});

test("Matrix review snapshot updates verify enterprise asset ownership first", () => {
  const service = readFileSync("src/lib/loop-assets.ts", "utf8");
  const reviewRecorder = service.slice(
    service.indexOf("export async function recordLoopVersionMatrixReview"),
    service.indexOf("export async function getLoopAssetDetails"),
  );

  assert.match(reviewRecorder, /const details = await getLoopAssetDetails\(user, input\.assetId\)/);
  assert.match(reviewRecorder, /if \(!details\) throw new Error\("Loop asset not found"\)/);
  assert.ok(
    reviewRecorder.indexOf("const details = await getLoopAssetDetails(user, input.assetId)")
      < reviewRecorder.indexOf(".update({ matrix_review: input.review })"),
    "Matrix review status must only be written after enterprise-scoped asset ownership is verified",
  );
  assert.doesNotMatch(reviewRecorder, /loop_os_assets\.enterprise_id/);
});

test("Loop relationship persistence has database uniqueness guards", () => {
  const migration = readFileSync("supabase/migrations/202606190002_loop_os_relationships.sql", "utf8");

  assert.match(migration, /idx_loop_os_relationships_parent_child_unique/);
  assert.match(migration, /on public\.loop_os_relationships\(enterprise_id, target_asset_id\)/);
  assert.match(migration, /idx_loop_os_relationships_dependency_unique/);
  assert.match(migration, /on public\.loop_os_relationships\(enterprise_id, source_asset_id, target_asset_id, interface_name\)/);
});

test("Loop OS services surface migration guidance when schema cache is stale", () => {
  const errorHelper = readFileSync("src/lib/loop-os-errors.ts", "utf8");
  const assetService = readFileSync("src/lib/loop-assets.ts", "utf8");
  const relationshipService = readFileSync("src/lib/loop-relationships.ts", "utf8");
  const orgProfileService = readFileSync("src/lib/org-profile.ts", "utf8");

  assert.match(errorHelper, /PGRST205/);
  assert.match(errorHelper, /schema cache/);
  assert.match(errorHelper, /node scripts\/apply-loop-os-v1-migration\.mjs/);
  assert.match(errorHelper, /node scripts\/print-loop-os-v1-migration\.mjs/);
  assert.match(errorHelper, /node scripts\/verify-loop-os-v1\.mjs/);
  assert.match(assetService, /loopOsErrorMessage/);
  assert.match(relationshipService, /loopOsErrorMessage/);
  assert.match(orgProfileService, /loopOsErrorMessage/);
});

test("Loop OS v1 verifier matches organization profile migration columns", () => {
  const verifier = readFileSync("scripts/verify-loop-os-v1.mjs", "utf8");
  const contract = readFileSync("scripts/loop-os-v1-schema-contract.mjs", "utf8");
  const migration = readFileSync("supabase/migrations/202606190005_loop_os_org_profiles.sql", "utf8");

  assert.match(migration, /computed_at timestamptz/);
  assert.match(contract, /enterprise_id,profile,source,computed_at,updated_at/);
  assert.match(verifier, /LOOP_OS_V1_SCHEMA_CHECKS/);
  assert.doesNotMatch(verifier, /profile_version|source_asset_count|source_version_ids|generated_at/);
});

test("Loop OS v1 schema contract covers all runtime tables", () => {
  const contract = readFileSync("scripts/loop-os-v1-schema-contract.mjs", "utf8");
  const runtimeStatus = readFileSync("src/lib/loop-os-schema-status.ts", "utf8");

  for (const table of ["loop_os_assets", "loop_os_versions", "loop_os_relationships", "loop_os_org_profiles"]) {
    assert.match(contract, new RegExp(`table: "${table}"`));
    assert.match(runtimeStatus, new RegExp(`table: "${table}"`));
  }
  assert.match(contract, /matrix_review/);
  assert.match(contract, /matrix_workspace_id/);
  assert.match(runtimeStatus, /matrix_review/);
  assert.match(runtimeStatus, /matrix_workspace_id/);
});

test("Loop OS v1 exposes a schema status endpoint for deployment checks", () => {
  const route = readFileSync("src/app/api/loop-os/status/route.ts", "utf8");
  const statusService = readFileSync("src/lib/loop-os-schema-status.ts", "utf8");

  assert.match(route, /getLoopOsSchemaStatus/);
  assert.match(route, /result\.status === "ok" \? 200 : 503/);
  assert.match(statusService, /LOOP_OS_SCHEMA_MISSING_MESSAGE/);
  assert.match(statusService, /loopOsErrorMessage/);
  assert.match(statusService, /Supabase service role is not configured/);
});

test("Loop OS v1 migration chain reloads the API schema cache", () => {
  const migration = readFileSync("supabase/migrations/202606200003_loop_os_api_schema_reload.sql", "utf8");
  const verifier = readFileSync("scripts/verify-loop-os-v1.mjs", "utf8");

  assert.match(migration, /pg_notify\('pgrst', 'reload schema'\)/);
  assert.match(verifier, /print-loop-os-v1-migration\.mjs/);
});

test("Loop OS v1 migration bundle prints the full ordered migration chain", () => {
  const printer = readFileSync("scripts/print-loop-os-v1-migration.mjs", "utf8");
  const orderedMigrations = [
    "202606190001_loop_os_assets.sql",
    "202606190002_loop_os_relationships.sql",
    "202606190004_loop_os_matrix_review.sql",
    "202606190005_loop_os_org_profiles.sql",
    "202606200001_loop_os_version_source_idempotency.sql",
    "202606200002_loop_os_matrix_binding_unique.sql",
    "202606200003_loop_os_api_schema_reload.sql",
  ];

  let lastIndex = -1;
  for (const migration of orderedMigrations) {
    const currentIndex = printer.indexOf(migration);
    assert.ok(currentIndex > lastIndex, `${migration} must appear after the previous migration`);
    lastIndex = currentIndex;
  }
  assert.match(printer, /buildLoopOsV1MigrationBundle/);
  assert.match(printer, /import\.meta\.url === pathToFileURL\(process\.argv\[1\]\)\.href/);
});

test("Loop OS v1 migration applier runs the ordered bundle through psql", () => {
  const applier = readFileSync("scripts/apply-loop-os-v1-migration.mjs", "utf8");

  assert.match(applier, /LOOP_OS_DATABASE_URL \|\| process\.env\.DATABASE_URL \|\| process\.env\.SUPABASE_DB_URL/);
  assert.match(applier, /supabase\/\.temp\/pooler-url/);
  assert.match(applier, /PGPASSWORD \|\| process\.env\.SUPABASE_DB_PASSWORD \|\| process\.env\.POSTGRES_PASSWORD/);
  assert.match(applier, /spawnSync\("psql"/);
  assert.match(applier, /"ON_ERROR_STOP=1"/);
  assert.match(applier, /buildLoopOsV1MigrationBundle\(\)/);
});

test("Loop OS v1 migration runbook preserves the operational acceptance path", () => {
  const runbook = readFileSync("docs/loop-os-v1-migration-runbook.md", "utf8");

  assert.match(runbook, /node scripts\/apply-loop-os-v1-migration\.mjs/);
  assert.match(runbook, /node scripts\/print-loop-os-v1-migration\.mjs/);
  assert.match(runbook, /node scripts\/verify-loop-os-v1\.mjs --write-probe/);
  assert.match(runbook, /\/loop-designer\/api\/loop-os\/status/);
  assert.match(runbook, /npm run verify:matrix-loop/);
});

test("Loop asset details do not fall back to stale versions as current", () => {
  const service = readFileSync("src/lib/loop-assets.ts", "utf8");

  assert.match(service, /currentVersion: versions\.find\(\(version\) => version\.id === asset\.currentVersionId\) \?\? null/);
  assert.doesNotMatch(service, /currentVersion: versions\.find\(\(version\) => version\.id === asset\.currentVersionId\) \?\? versions\[0\]/);
});

test("Loop asset write APIs refresh org profiles without blocking primary writes", () => {
  const routes = [
    "src/app/api/loop-assets/route.ts",
    "src/app/api/loop-assets/[assetId]/route.ts",
    "src/app/api/loop-assets/[assetId]/versions/route.ts",
    "src/app/api/loop-assets/[assetId]/relationships/route.ts",
  ];

  for (const routePath of routes) {
    const route = readFileSync(routePath, "utf8");
    assert.match(route, /refreshOrgProfileSnapshotBestEffort/);
    assert.doesNotMatch(route, /saveOrgProfileSnapshot/);
  }
});

function maturityMapping(): LoopMaturityMapping {
  return {
    assessedAt: "2026-06-19T00:00:00.000Z",
    assessmentMode: "algorithm_primary",
    alignment: [
      alignmentScore("goal", 3),
      alignmentScore("value", 3),
      alignmentScore("logic", 3),
    ],
    maturity: [
      maturityScore("loop_maturity", 2),
      maturityScore("triple_alignment", 3),
      maturityScore("orchestration", 3),
      maturityScore("intelligence_density", 3),
      maturityScore("eco_evolution", 3),
    ],
    overallLevel: 3,
    oneLineDiagnosis: "客户反馈回路仍处于早期沉淀阶段",
    highlightDimensions: ["loop_maturity"],
    bottlenecks: ["关闭标准尚未稳定"],
    recommendedAction: {
      dimension: "loop_maturity",
      priority: "important",
      action: "补齐反馈关闭标准",
      actionType: "manual",
      expectedEffect: "提升回路成熟度",
    },
    upgradeSuggestions: [{
      dimension: "loop_maturity",
      priority: "important",
      action: "建立每周复盘机制",
      actionType: "apply_to_roadmap",
      expectedEffect: "减少反馈复发",
    }],
  };
}

function loopAsset(id: string, title: string, domain: string): LoopAsset {
  return {
    id,
    enterpriseId: "enterprise-1",
    title,
    domain,
    status: "active",
    currentVersionId: `version-${id}`,
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
    updatedAt: "2026-06-19T00:00:00.000Z",
  };
}

function loopVersion(assetId: string, overallLevel: LoopMaturityMapping["overallLevel"]): LoopVersion {
  return {
    id: `version-${assetId}`,
    assetId,
    versionNumber: 1,
    plan,
    maturityMapping: { ...maturityMapping(), overallLevel },
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
  };
}

function relationship(
  id: string,
  sourceAssetId: string,
  targetAssetId: string,
  type: LoopRelationship["type"],
): LoopRelationship {
  return {
    id,
    enterpriseId: "enterprise-1",
    sourceAssetId,
    targetAssetId,
    type,
    direction: "source_to_target",
    ...(type === "dependency" ? { interfaceName: "跨回路交接" } : {}),
    strength: "important",
    createdBy: "user-1",
    createdAt: "2026-06-19T00:00:00.000Z",
  };
}

function alignmentScore(
  dimension: LoopMaturityMapping["alignment"][number]["dimension"],
  level: LoopMaturityMapping["alignment"][number]["level"],
): LoopMaturityMapping["alignment"][number] {
  return {
    dimension,
    level,
    score: level * 20,
    userExplanation: "测试评分",
    evidence: evidence(),
  };
}

function maturityScore(
  dimension: LoopMaturityMapping["maturity"][number]["dimension"],
  level: LoopMaturityMapping["maturity"][number]["level"],
): LoopMaturityMapping["maturity"][number] {
  return {
    dimension,
    level,
    score: level * 20,
    userExplanation: "测试评分",
    evidence: evidence(),
  };
}

function evidence(): LoopMaturityMapping["alignment"][number]["evidence"] {
  return [{
    source: "test",
    summary: "测试证据",
    userLabel: "测试",
    strength: "partial",
    confidence: "medium",
    gap: "仍需补充运行证据",
  }];
}
