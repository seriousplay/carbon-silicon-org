import assert from "node:assert/strict";
import test from "node:test";
import { planToMarkdown } from "./markdown";
import { assessLoopMaturity } from "./maturity";
import { buildMethodologyAnalysis } from "./matrix-study-payload";
import { parsePlan } from "./plan-parser";
import type { LoopPlan } from "./plan-schema";

const sample: LoopPlan = {
  title: "测试企业 × 客户交付回路",
  executiveSummary: "把跨部门等待改造成可观察的人机闭环。",
  loopType: "客户交付回路",
  valueFlow: { start: "客户提出需求", end: "验收完成", targetCycleTime: "48 小时" },
  toBeLoopCells: [{
    cellId: "cell-1",
    cellLabel: "Cell 01",
    action: "客户提出需求。",
    currentGap: "异常接管人待确认。",
    recommendedMode: "结构化入口",
    actorAssignments: [
      { type: "human", roleId: "human_loop_owner", name: "回路主理人", responsibility: "确认最终承诺和异常接管。" },
      { type: "agent", roleId: "agent_brief", name: "需求结构化智能体", responsibility: "把原始需求整理成标准 brief。" },
      { type: "system", roleId: "system_record", name: "事实记录系统", responsibility: "记录需求对象、确认版本和复盘结果。" },
    ],
    timeEstimate: {
      processingMinutes: 30,
      waitingMinutes: 120,
      reworkMinutes: 45,
      confidence: "low",
      bottleneckLevel: "medium",
      bottleneckReason: "缺少真实运行日志，异常接管人待确认，等待时间需要试运行校准。",
    },
    controlProfile: {
      primaryActorType: "agent",
      primaryActorRoleId: "agent_brief",
      autonomyLevel: "agent_led_hitl",
      humanBoundary: "commitment",
      agentExecutionRights: ["提取原始需求字段", "生成标准 brief 草稿", "提示缺项问题"],
      humanInterventionTriggers: ["涉及高风险承诺", "客户输入缺少验收条件", "异常接管人待确认"],
      canAutoProceedWhen: ["brief 必填字段完整", "输出可被交付直接评估", "未触发高风险承诺"],
      nextAutonomyUpgrade: "补齐接管规则和验收清单后，让 Agent 自动推进低风险需求确认，人只处理承诺和异常。",
    },
    aiRole: "AI 可以把原始需求整理成标准 brief。",
    humanRole: "人确认最终承诺和异常接管。",
    interfaceContract: "需求 brief 进入事实记录系统，由回路主理人验收。",
    governanceRule: "高风险承诺必须请示回路主理人。",
    memoryRecord: "沉淀原始需求、AI 建议、人工修改和确认版本。",
    acceptanceSignal: "结构化需求单可被交付直接评估。",
    nextValidation: "先补齐接管规则。",
  }],
  hitlNodes: [{ node: "最终承诺", owner: "负责人", authority: "批准或驳回", trigger: "高风险", tool: "决策看板" }],
  businessGoalAnchor: {
    intent: "减少客户需求在角色之间反复澄清。",
    goal: "把需求确认周期压缩到 48 小时。",
    output: "结构化需求单和承诺版本。",
    successSignal: "一次确认率提升，返工率下降。",
    cycle: "一个项目交付周期",
    constraints: "高风险承诺必须由人确认。",
  },
  workflowInput: {
    mode: "current",
    narrative: "第一步客户提出需求。\n第二步业务整理给交付。\n第三步交付评估并反馈。",
  },
  scenarioDiagnosis: {
    summary: "围绕需求确认周期拆解当前工作流，重点关注手工搬运和事实源问题。",
    stageMapping: (["感知", "理解", "决策", "执行", "反馈"] as const).map((stage) => ({
      stage,
      sourceStep: `${stage}阶段的用户步骤`,
      actor: "客户、业务、交付、回路主理人",
      system: "群聊、CRM、项目表格",
      bottleneck: "手工搬运和事实源问题",
    })),
    collaborationOpportunities: [{
      type: "人工搬运" as const,
      currentLoad: "人在系统之间搬运需求信息。",
      aiSupport: "自动提取字段并生成结构化对象。",
      humanBoundary: "人确认最终承诺和异常接管。",
      governanceRule: "自动同步必须留痕并可回退。",
    }],
    cellDiagnostics: [{
      cellId: "cell-1",
      cellLabel: "Cell 01",
      action: "客户提出需求。",
      stage: "感知",
      heat: "yellow",
      heatLabel: "补齐条件后可接管",
      recommendedMode: "结构化入口",
      currentAiCapability: "AI 可以把原始需求整理成标准 brief。",
      blockers: ["异常是否有人接管：异常接管人待确认。"],
      humanBoundary: "人确认最终承诺和异常接管。",
      nextFill: ["brief 模板", "接管规则"],
      checks: [
        { label: "输入是否清楚", status: "具备", reason: "触发和输入已描述。" },
        { label: "上下文是否足够", status: "待补齐", reason: "知识来源待确认。" },
        { label: "输出能否被下游接收", status: "具备", reason: "输出已描述。" },
        { label: "异常是否有人接管", status: "缺失", reason: "异常接管人待确认。" },
        { label: "经验能否复用", status: "待补齐", reason: "复用记录待确认。" },
      ],
    }],
    priorityActions: [{
      cellId: "cell-1",
      cellLabel: "Cell 01",
      recommendedMode: "结构化入口",
      action: "先建立 brief、表单或卡片入口，把模糊输入转成可处理对象。",
      reason: "输入和异常接管需要补齐。",
    }],
  },
  organizationMap: { conflicts: ["信息重复传递"], roleChanges: ["设置回路主理人"], reportingChanges: [], sharedDataLayer: "统一需求对象" },
  governance: {
    kpis: [
      { name: "周期", current: "5 天", target: "48 小时", cadence: "每周" },
      { name: "返工率", current: "未知", target: "<10%", cadence: "每周" },
    ],
    arbitrationRules: ["重大承诺由负责人裁决"],
    interlocks: ["案例回灌知识库"],
    lifecycleRule: "连续两周不达标则回退人工模式",
  },
  roadmap: [1, 2, 3, 4].map((week) => ({ week, theme: `第${week}周`, actions: ["完成试运行"], milestone: "形成记录", checkpoint: "周复盘" })),
  assumptions: ["数据可接入"],
  risks: ["数据质量不足"],
  validationQuestions: ["谁对异常负责？"],
};

function clonePlan<T>(value: LoopPlan) {
  return JSON.parse(JSON.stringify(value)) as T;
}

const enhancedOrganization = {
  ...sample.organizationMap,
  humanRoles: [{
    id: "human_loop_owner",
    name: "回路主理人",
    status: "建议角色" as const,
    mission: "对回路结果和异常闭环承担最终责任",
    responsibilityScope: ["整条客户交付回路", "关键承诺", "异常闭环"],
    responsibilities: ["确认目标", "处理异常"],
    exclusions: ["替代所有执行动作"],
    decisionRights: ["批准试运行范围"],
    approvalRights: ["高风险承诺"],
    vetoRights: ["数据证据不足时暂停自动执行"],
    inputs: ["回路运行摘要"],
    outputs: ["批准或回退决定"],
    serviceLevel: "高风险事项 2 小时内响应",
    availability: "工作时段可用",
    exceptionOwnership: "接管高风险异常",
    escalationTo: "待确认的治理角色",
    suggestedCount: "1 名承担者",
    capabilities: ["业务判断", "风险权衡"],
  }],
  agentRoles: [{
    id: "agent_interpreter",
    name: "需求理解智能体",
    status: "建议角色" as const,
    mission: "把非结构化输入转成可验证业务对象",
    serves: ["human_loop_owner"],
    responsibilityScope: ["需求结构化", "缺失信息识别", "风险提示"],
    tasks: ["提取约束", "识别缺失信息"],
    autonomyLevel: "建议" as const,
    readableData: ["原始需求"],
    tools: ["事实记录系统"],
    outputs: ["结构化需求"],
    qualityStandard: "字段完整且引用来源",
    allowedActions: ["生成建议"],
    approvalRequiredActions: ["修改承诺范围"],
    prohibitedActions: ["代表组织作出承诺"],
    hitlTriggers: ["关键信息冲突"],
    supervisorRoleId: "human_loop_owner",
    fallback: "由回路主理人手工整理",
    shutdownCondition: "连续两次输出无法通过验收",
    cadence: "每次新需求触发",
    contextSources: ["原始需求", "历史规则"],
    auditRequirements: ["保留输入、输出和版本"],
  }],
  systemRoles: [{
    id: "system_record",
    name: "事实记录系统",
    status: "待确认" as const,
    mission: "保存回路唯一可审计事实",
    responsibilityScope: ["需求对象", "承诺版本", "验收反馈"],
    businessObjects: ["需求对象"],
    records: ["版本", "审批", "异常"],
    capabilities: ["保存", "检索", "审计"],
    inputs: ["结构化需求"],
    outputs: ["版本化事实记录"],
    sourceOfTruth: true,
    accessControl: "最小权限，待技术确认",
    integrationMode: "API，待技术确认",
    constraints: ["字段定义待技术确认"],
    manualFallback: "使用受控表格记录并每日归档",
  }],
  interfaces: [{
    id: "interface_interpretation",
    name: "需求结构化交接",
    sourceId: "agent_interpreter",
    targetId: "system_record",
    riskLevel: "HITL" as const,
    trigger: "新需求进入",
    handoffObject: "结构化需求",
    requiredInputs: ["原始需求"],
    expectedOutputs: ["完整需求对象"],
    responsibleRoleId: "agent_interpreter",
    acceptanceRoleId: "human_loop_owner",
    serviceLevel: "10 分钟",
    acceptanceCriteria: ["必填字段完整"],
    failureModes: ["关键信息冲突"],
    retryRule: "补充上下文后重试一次",
    timeoutEscalation: "超时 20 分钟升级回路主理人",
    humanFallback: "回路主理人手工录入",
    interfaceType: "API" as const,
    protocol: "待技术确认",
    dataObject: "需求对象",
    minimumFields: ["来源", "目标", "约束"],
    authorization: "待技术确认",
    idempotency: "按需求唯一标识去重",
    auditRecord: "保留请求和响应摘要",
    sourceOfTruth: "事实记录系统",
  }],
  assignmentChecklist: [{
    roleId: "human_loop_owner",
    suggestedCount: "1 名承担者",
    requiredPermissions: ["查看全部回路记录"],
    readinessConditions: ["完成异常演练"],
    dueBy: "试运行前 2 天",
    status: "待指派" as const,
  }],
  launchReadiness: {
    checklist: (["角色到位", "智能体配置", "系统接通", "数据可用", "异常演练"] as const).map((category) => ({
      category,
      item: `${category}检查`,
      ownerRoleId: "human_loop_owner",
      evidence: "形成验收记录",
      status: "未开始" as const,
    })),
    firstWeekCadence: [{
      cadence: "每日",
      activity: "检查异常和权限边界",
      ownerRoleId: "human_loop_owner",
      output: "运行日报",
      exitTrigger: "出现高风险越权",
    }],
  },
};

test("parsePlan extracts JSON from wrapped model output", () => {
  const result = parsePlan(`结果如下：\n\`\`\`json\n${JSON.stringify(sample)}\n\`\`\``);
  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.toBeLoopCells.length, 1);
    assert.ok(result.data.maturityMapping);
    assert.match(result.data.roadmap[3].checkpoint, /重新评估成熟度/);
  }
});

test("parsePlan normalizes string KPIs returned by routed models", () => {
  const routedOutput = {
    ...sample,
    governance: {
      ...sample.governance,
      kpis: ["闭环周期缩短至 48 小时", "返工率控制在 10% 以下"],
    },
  };
  const result = parsePlan(JSON.stringify(routedOutput));
  assert.equal(result.success, true);
  if (result.success) {
    assert.deepEqual(result.data.governance.kpis[0], {
      name: "闭环周期缩短至 48 小时",
      current: "待建立基线",
      target: "闭环周期缩短至 48 小时",
      cadence: "每周复盘",
    });
  }
});

test("parsePlan requires To-Be actor assignments", () => {
  const invalid = clonePlan<{ toBeLoopCells: Array<Record<string, unknown>> }>(sample);
  delete invalid.toBeLoopCells[0].actorAssignments;
  const result = parsePlan(JSON.stringify(invalid));
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /actorAssignments/);
});

test("parsePlan rejects negative To-Be time estimates", () => {
  const invalid = clonePlan<{ toBeLoopCells: Array<{ timeEstimate: { processingMinutes: number } }> }>(sample);
  invalid.toBeLoopCells[0].timeEstimate.processingMinutes = -1;
  const result = parsePlan(JSON.stringify(invalid));
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /processingMinutes/);
});

test("parsePlan requires To-Be control profile", () => {
  const invalid = clonePlan<{ toBeLoopCells: Array<Record<string, unknown>> }>(sample);
  delete invalid.toBeLoopCells[0].controlProfile;
  const result = parsePlan(JSON.stringify(invalid));
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /controlProfile/);
});

test("parsePlan rejects control profiles with unknown primary actor ids", () => {
  const invalid = clonePlan<LoopPlan>(sample);
  invalid.toBeLoopCells[0].controlProfile.primaryActorRoleId = "agent-missing";
  const result = parsePlan(JSON.stringify(invalid));
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /primaryActorRoleId/);
});

test("parsePlan rejects autonomous cells without audit or exception boundary", () => {
  const invalid = clonePlan<LoopPlan>(sample);
  invalid.toBeLoopCells[0].controlProfile.autonomyLevel = "agent_autonomous";
  invalid.toBeLoopCells[0].controlProfile.humanBoundary = "approval";
  const result = parsePlan(JSON.stringify(invalid));
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /humanBoundary/);
});

test("parsePlan accepts low confidence To-Be time estimates with a bottleneck reason", () => {
  const lowConfidence = clonePlan<LoopPlan>(sample);
  lowConfidence.toBeLoopCells[0].timeEstimate = {
    processingMinutes: 20,
    waitingMinutes: 40,
    reworkMinutes: 10,
    confidence: "low",
    bottleneckLevel: "low",
    bottleneckReason: "没有真实系统日志，只能作为试运行前的低置信估算。",
  };
  const result = parsePlan(JSON.stringify(lowConfidence));
  assert.equal(result.success, true);
});

test("markdown contains the operational sections", () => {
  const markdown = planToMarkdown(sample);
  assert.match(markdown, /诊断执行摘要/);
  assert.match(markdown, /优先阅读/);
  assert.match(markdown, /下一步任务/);
  assert.match(markdown, /对齐与成熟度诊断/);
  assert.match(markdown, /推荐优先行动/);
  assert.match(markdown, /业务目标锚点/);
  assert.match(markdown, /AI可以接管的工作/);
  assert.match(markdown, /结构化入口/);
  assert.match(markdown, /阅读方式/);
  assert.match(markdown, /人机协作拓扑图/);
  assert.doesNotMatch(markdown, /业务回路进程图/);
  assert.doesNotMatch(markdown, /人机控制权/);
  assert.doesNotMatch(markdown, /处理时间模拟/);
  assert.match(markdown, /需要人确认的节点/);
  assert.doesNotMatch(markdown, /主 actor/);
  assert.doesNotMatch(markdown, /Agent 主导 \+ HITL/);
  assert.match(markdown, /周期行动路线/);
  assert.match(markdown, /重新评估成熟度/);
  assert.doesNotMatch(markdown, /score/);
});

test("enhanced organization map validates references and exports implementation tables", () => {
  const enhanced = { ...sample, organizationMap: enhancedOrganization };
  const result = parsePlan(JSON.stringify(enhanced));
  assert.equal(result.success, true);
  const markdown = planToMarkdown(enhanced);
  assert.match(markdown, /图解摘要/);
  assert.match(markdown, /AI \/ 智能体角色/);
  assert.match(markdown, /人类角色/);
  assert.match(markdown, /关系属性矩阵/);
  assert.match(markdown, /系统支持/);
  assert.match(markdown, /人工监督/);
  assert.match(markdown, /业务与系统接口契约/);
  assert.match(markdown, /启动检查/);
});

test("enhanced organization map rejects interfaces that reference undefined nodes", () => {
  const invalid = {
    ...sample,
    organizationMap: {
      ...enhancedOrganization,
      interfaces: [{ ...enhancedOrganization.interfaces[0], targetId: "missing_system" }],
    },
  };
  const result = parsePlan(JSON.stringify(invalid));
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /未定义角色/);
});

test("parsePlan can repair model organization references when explicitly enabled", () => {
  const modelOutput = {
    ...sample,
    organizationMap: {
      ...enhancedOrganization,
      agentRoles: [{ ...enhancedOrganization.agentRoles[0], supervisorRoleId: "human_product_owner", approvalRequiredActions: [] }],
      interfaces: [{ ...enhancedOrganization.interfaces[0], sourceId: "Cell01", targetId: "C02", responsibleRoleId: "客户", acceptanceRoleId: "C03" }],
      assignmentChecklist: [{ ...enhancedOrganization.assignmentChecklist[0], roleId: "C04" }],
      launchReadiness: {
        checklist: enhancedOrganization.launchReadiness.checklist.map((item) => ({ ...item, ownerRoleId: "system_crm_form" })),
        firstWeekCadence: [{ ...enhancedOrganization.launchReadiness.firstWeekCadence[0], ownerRoleId: "C05" }],
      },
    },
  };
  const strict = parsePlan(JSON.stringify(modelOutput));
  assert.equal(strict.success, false);
  const repaired = parsePlan(JSON.stringify(modelOutput), { repairOrganizationReferences: true });
  assert.equal(repaired.success, true);
  if (repaired.success) {
    const organization = repaired.data.organizationMap;
    assert.equal(organization.agentRoles?.[0].supervisorRoleId, "human_loop_owner");
    assert.deepEqual(organization.agentRoles?.[0].approvalRequiredActions, ["待确认"]);
    assert.equal(organization.interfaces?.[0].sourceId, "agent_interpreter");
    assert.equal(organization.interfaces?.[0].targetId, "system_record");
    assert.equal(organization.launchReadiness?.checklist[0].ownerRoleId, "human_loop_owner");
  }
});

test("parsePlan repairs routed model cell ids and system owners at production scale", () => {
  const humanRoles = [
    { ...enhancedOrganization.humanRoles[0], id: "human_product_owner", name: "产品负责人" },
    { ...enhancedOrganization.humanRoles[0], id: "human_delivery_owner", name: "交付负责人" },
  ];
  const agentRoles = [
    {
      ...enhancedOrganization.agentRoles[0],
      id: "agent_review",
      supervisorRoleId: "human_product_owner 或 human_delivery_owner",
      serves: ["human_product_owner 或 human_delivery_owner"],
    },
    {
      ...enhancedOrganization.agentRoles[0],
      id: "agent_sync",
      supervisorRoleId: "客户",
      serves: ["C01"],
    },
  ];
  const systemRoles = [
    { ...enhancedOrganization.systemRoles[0], id: "system_record" },
    { ...enhancedOrganization.systemRoles[0], id: "system_crm_form" },
    { ...enhancedOrganization.systemRoles[0], id: "system_knowledge_base" },
  ];
  const interfaces = [0, 1, 2, 3, 4].map((index) => ({
    ...enhancedOrganization.interfaces[0],
    id: `interface_${index + 1}`,
    sourceId: index === 0 ? "客户" : `C0${index}`,
    targetId: `C0${index + 1}`,
    responsibleRoleId: `Cell0${index + 1}`,
    acceptanceRoleId: "客户",
  }));
  const modelOutput = {
    ...sample,
    organizationMap: {
      ...enhancedOrganization,
      humanRoles,
      agentRoles,
      systemRoles,
      interfaces,
      assignmentChecklist: [{ ...enhancedOrganization.assignmentChecklist[0], roleId: "Cell03" }],
      launchReadiness: {
        checklist: [
          { ...enhancedOrganization.launchReadiness.checklist[0], ownerRoleId: "human_product_owner 或 human_delivery_owner" },
          { ...enhancedOrganization.launchReadiness.checklist[1], ownerRoleId: "agent_sync" },
          { ...enhancedOrganization.launchReadiness.checklist[2], ownerRoleId: "system_crm_form" },
          { ...enhancedOrganization.launchReadiness.checklist[3], ownerRoleId: "system_knowledge_base" },
          { ...enhancedOrganization.launchReadiness.checklist[4], ownerRoleId: "C05" },
        ],
        firstWeekCadence: [{ ...enhancedOrganization.launchReadiness.firstWeekCadence[0], ownerRoleId: "system_knowledge_base" }],
      },
    },
  };

  const strict = parsePlan(JSON.stringify(modelOutput));
  assert.equal(strict.success, false);
  const repaired = parsePlan(JSON.stringify(modelOutput), { repairOrganizationReferences: true });
  assert.equal(repaired.success, true);
  if (repaired.success) {
    const organization = repaired.data.organizationMap;
    const humanIds = new Set(organization.humanRoles?.map((role) => role.id) || []);
    const roleIds = new Set([
      ...(organization.humanRoles?.map((role) => role.id) || []),
      ...(organization.agentRoles?.map((role) => role.id) || []),
    ]);
    const nodeIds = new Set([
      ...Array.from(roleIds),
      ...(organization.systemRoles?.map((role) => role.id) || []),
    ]);
    assert.equal(organization.agentRoles?.[0].supervisorRoleId, "human_product_owner");
    assert.deepEqual(organization.agentRoles?.[0].serves, ["human_product_owner"]);
    assert.ok(organization.interfaces?.every((item) => nodeIds.has(item.sourceId) && nodeIds.has(item.targetId)));
    assert.ok(organization.interfaces?.every((item) => roleIds.has(item.responsibleRoleId) && humanIds.has(item.acceptanceRoleId)));
    assert.ok(organization.launchReadiness?.checklist.every((item) => roleIds.has(item.ownerRoleId)));
    assert.ok(organization.launchReadiness?.firstWeekCadence.every((item) => roleIds.has(item.ownerRoleId)));
  }
});

test("enhanced organization map rejects job titles used as role names", () => {
  const invalid = {
    ...sample,
    organizationMap: {
      ...enhancedOrganization,
      humanRoles: [{ ...enhancedOrganization.humanRoles[0], name: "销售经理" }],
    },
  };
  const result = parsePlan(JSON.stringify(invalid));
  assert.equal(result.success, false);
  if (!result.success) assert.match(result.error, /不能使用岗位/);
});

test("maturity assessment returns evidence gaps and critical action risk", () => {
  const mapping = assessLoopMaturity(sample);
  assert.equal(mapping.alignment.length, 3);
  assert.equal(mapping.maturity.length, 5);
  assert.ok(mapping.oneLineDiagnosis.length > 10);
  assert.equal(mapping.recommendedAction.priority, "critical");
  assert.ok(mapping.recommendedAction.riskIfIgnored);
  const weakEvidence = [...mapping.alignment, ...mapping.maturity].flatMap((item) => item.evidence).filter((item) => item.strength !== "strong");
  assert.ok(weakEvidence.length > 0);
  assert.ok(weakEvidence.every((item) => item.gap));
});

test("parsePlan ignores model supplied maturity mapping and recalculates locally", () => {
  const modelOutput = {
    ...sample,
    maturityMapping: {
      assessedAt: new Date().toISOString(),
      assessmentMode: "model_primary",
      alignment: (["goal", "value", "logic"] as const).map((dimension) => ({
        dimension,
        score: 100,
        level: 5,
        userExplanation: "模型伪造解释",
        evidence: [{ source: "fake.path", summary: "模型伪造证据", userLabel: "有支撑", strength: "strong", confidence: "high" }],
      })),
      maturity: (["loop_maturity", "triple_alignment", "orchestration", "intelligence_density", "eco_evolution"] as const).map((dimension) => ({
        dimension,
        level: 5,
        score: 100,
        userExplanation: "模型伪造成熟度",
        evidence: [{ source: "fake.path", summary: "模型伪造证据", userLabel: "有支撑", strength: "strong", confidence: "high" }],
      })),
      overallLevel: 5,
      oneLineDiagnosis: "模型自评满分",
      highlightDimensions: ["eco_evolution"],
      bottlenecks: [],
      recommendedAction: {
        dimension: "eco_evolution",
        priority: "critical",
        action: "无需改进",
        actionType: "manual",
        riskIfIgnored: "无",
        expectedEffect: "无",
      },
      upgradeSuggestions: [{
        dimension: "eco_evolution",
        priority: "critical",
        action: "无需改进",
        actionType: "manual",
        riskIfIgnored: "无",
        expectedEffect: "无",
      }],
    },
  };
  const result = parsePlan(JSON.stringify(modelOutput));
  assert.equal(result.success, true);
  if (result.success) {
    const maturityMapping = result.data.maturityMapping;
    assert.ok(maturityMapping);
    assert.equal(maturityMapping.assessmentMode, "algorithm_primary");
    assert.notEqual(maturityMapping.oneLineDiagnosis, "模型自评满分");
    assert.ok(maturityMapping.alignment.every((item) => item.evidence.every((entry) => !entry.source.startsWith("fake"))));
  }
});

test("maturity scoring keeps a missing evidence item from being hidden by strong evidence", () => {
  const weak = assessLoopMaturity({
    ...sample,
    governance: { ...sample.governance, lifecycleRule: "" },
  } as LoopPlan);
  const loopMaturity = weak.maturity.find((item) => item.dimension === "loop_maturity");
  assert.ok(loopMaturity);
  assert.ok(loopMaturity.score <= 45);
  assert.ok(loopMaturity.level <= 2);
  const lifecycleEvidence = loopMaturity.evidence.find((item) => item.source === "governance.lifecycleRule");
  assert.ok(lifecycleEvidence?.gap?.includes("回路运行和退出规则") || lifecycleEvidence?.gap?.includes("写清何时扩圈"));
  assert.doesNotMatch(lifecycleEvidence?.gap ?? "", /governance\.lifecycleRule/);
});

test("maturity report language hides system field names from users", () => {
  const markdown = planToMarkdown(sample);
  assert.match(markdown, /复盘经验沉淀和复用机制|复盘迭代能力/);
  assert.doesNotMatch(markdown, /governance\.interlocks|governance\.lifecycleRule|生态进化性/);
});

test("matrix methodology analysis carries maturity evidence and review boundary note", () => {
  const analysis = buildMethodologyAnalysis(sample);
  assert.ok(analysis.alignment);
  assert.ok(analysis.maturity);
  assert.ok(analysis.recommendedAction);
  assert.deepEqual(analysis.coverage.loopCells[0].actorAssignments, sample.toBeLoopCells[0].actorAssignments);
  assert.deepEqual(analysis.coverage.loopCells[0].controlProfile, sample.toBeLoopCells[0].controlProfile);
  assert.deepEqual(analysis.coverage.loopCells[0].timeEstimate, sample.toBeLoopCells[0].timeEstimate);
  assert.match(String(analysis.note), /ChangeSet/);
});
