import { z } from "zod";

const stageNameSchema = z.enum(["感知", "理解", "决策", "执行", "反馈"]);
const nonEmptyStrings = z.array(z.string().min(1)).min(1);
const roleNameSchema = z.string().min(1).refine(
  (value) => !/(岗位|经理|总监|主管|专员|工程师|顾问|总裁|董事长|CEO|CTO|COO|CFO)/i.test(value),
  "角色名称不能使用岗位、职级或姓名式称谓",
);

export const loopStageSchema = z.object({
  name: stageNameSchema,
  currentState: z.string().min(1),
  aiDesign: z.string().min(1),
  humanRole: z.string().min(1),
  aiParticipation: z.number().int().min(0).max(100),
  hitlTrigger: z.string().min(1),
  successSignal: z.string().min(1),
});

const humanRoleSchema = z.object({
  id: z.string().min(1),
  name: roleNameSchema,
  status: z.enum(["已有角色", "建议角色", "待确认"]),
  mission: z.string().min(1),
  responsibilityScope: nonEmptyStrings,
  responsibilities: nonEmptyStrings,
  exclusions: nonEmptyStrings,
  decisionRights: nonEmptyStrings,
  approvalRights: z.array(z.string().min(1)),
  vetoRights: z.array(z.string().min(1)),
  inputs: nonEmptyStrings,
  outputs: nonEmptyStrings,
  serviceLevel: z.string().min(1),
  availability: z.string().min(1),
  exceptionOwnership: z.string().min(1),
  escalationTo: z.string().min(1),
  suggestedCount: z.string().min(1),
  capabilities: nonEmptyStrings,
});

const agentRoleSchema = z.object({
  id: z.string().min(1),
  name: roleNameSchema,
  status: z.enum(["已有角色", "建议角色", "待确认"]),
  mission: z.string().min(1),
  serves: nonEmptyStrings,
  responsibilityScope: nonEmptyStrings,
  tasks: nonEmptyStrings,
  autonomyLevel: z.enum(["建议", "受控执行", "条件自治"]),
  readableData: nonEmptyStrings,
  tools: nonEmptyStrings,
  outputs: nonEmptyStrings,
  qualityStandard: z.string().min(1),
  allowedActions: nonEmptyStrings,
  approvalRequiredActions: nonEmptyStrings,
  prohibitedActions: nonEmptyStrings,
  hitlTriggers: nonEmptyStrings,
  supervisorRoleId: z.string().min(1),
  fallback: z.string().min(1),
  shutdownCondition: z.string().min(1),
  cadence: z.string().min(1),
  contextSources: nonEmptyStrings,
  auditRequirements: nonEmptyStrings,
});

const systemRoleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["已有角色", "建议角色", "待确认"]),
  mission: z.string().min(1),
  responsibilityScope: nonEmptyStrings,
  businessObjects: nonEmptyStrings,
  records: nonEmptyStrings,
  capabilities: nonEmptyStrings,
  inputs: nonEmptyStrings,
  outputs: nonEmptyStrings,
  sourceOfTruth: z.boolean(),
  accessControl: z.string().min(1),
  integrationMode: z.string().min(1),
  constraints: nonEmptyStrings,
  manualFallback: z.string().min(1),
});

const interfaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  riskLevel: z.enum(["常规", "HITL", "高风险"]),
  trigger: z.string().min(1),
  handoffObject: z.string().min(1),
  requiredInputs: nonEmptyStrings,
  expectedOutputs: nonEmptyStrings,
  responsibleRoleId: z.string().min(1),
  acceptanceRoleId: z.string().min(1),
  serviceLevel: z.string().min(1),
  acceptanceCriteria: nonEmptyStrings,
  failureModes: nonEmptyStrings,
  retryRule: z.string().min(1),
  timeoutEscalation: z.string().min(1),
  humanFallback: z.string().min(1),
  interfaceType: z.enum(["人工交接", "智能体调用", "API", "事件", "批处理"]),
  protocol: z.string().min(1),
  dataObject: z.string().min(1),
  minimumFields: nonEmptyStrings,
  authorization: z.string().min(1),
  idempotency: z.string().min(1),
  auditRecord: z.string().min(1),
  sourceOfTruth: z.string().min(1),
});

const assignmentItemSchema = z.object({
  roleId: z.string().min(1),
  suggestedCount: z.string().min(1),
  requiredPermissions: nonEmptyStrings,
  readinessConditions: nonEmptyStrings,
  dueBy: z.string().min(1),
  status: z.enum(["待指派", "待确认", "已就绪"]),
});

const launchReadinessSchema = z.object({
  checklist: z.array(z.object({
    category: z.enum(["角色到位", "智能体配置", "系统接通", "数据可用", "异常演练"]),
    item: z.string().min(1),
    ownerRoleId: z.string().min(1),
    evidence: z.string().min(1),
    status: z.enum(["未开始", "进行中", "已就绪"]),
  })).min(5),
  firstWeekCadence: z.array(z.object({
    cadence: z.string().min(1),
    activity: z.string().min(1),
    ownerRoleId: z.string().min(1),
    output: z.string().min(1),
    exitTrigger: z.string().min(1),
  })).min(1),
});

const maturityLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
const alignmentDimensionSchema = z.enum(["goal", "value", "logic"]);
const maturityDimensionSchema = z.enum(["loop_maturity", "triple_alignment", "orchestration", "intelligence_density", "eco_evolution"]);
const evidenceItemSchema = z.object({
  source: z.string().min(1),
  summary: z.string().min(1),
  userLabel: z.string().min(1),
  strength: z.enum(["strong", "partial", "missing"]),
  confidence: z.enum(["high", "medium", "low"]),
  gap: z.string().min(1).optional(),
}).superRefine((item, context) => {
  if ((item.strength === "partial" || item.strength === "missing") && !item.gap) {
    context.addIssue({ code: "custom", path: ["gap"], message: "partial/missing 证据必须写明缺口" });
  }
});

const alignmentScoreSchema = z.object({
  dimension: alignmentDimensionSchema,
  score: z.number().int().min(0).max(100),
  level: maturityLevelSchema,
  userExplanation: z.string().min(1),
  evidence: z.array(evidenceItemSchema).min(1),
  gap: z.string().min(1).optional(),
  recommendation: z.string().min(1).optional(),
});

const maturityScoreSchema = z.object({
  dimension: maturityDimensionSchema,
  level: maturityLevelSchema,
  score: z.number().int().min(0).max(100),
  userExplanation: z.string().min(1),
  evidence: z.array(evidenceItemSchema).min(1),
  bottleneck: z.string().min(1).optional(),
});

const upgradeSuggestionSchema = z.object({
  dimension: z.union([maturityDimensionSchema, alignmentDimensionSchema]),
  priority: z.enum(["critical", "important", "optional"]),
  action: z.string().min(1),
  actionType: z.enum(["regenerate_field", "add_field", "apply_to_roadmap", "manual"]),
  targetField: z.string().min(1).optional(),
  riskIfIgnored: z.string().min(1).optional(),
  expectedEffect: z.string().min(1),
}).superRefine((item, context) => {
  if (item.priority === "critical" && !item.riskIfIgnored) {
    context.addIssue({ code: "custom", path: ["riskIfIgnored"], message: "critical 建议必须说明不改的风险" });
  }
});

const loopMaturityMappingSchema = z.object({
  assessedAt: z.string().min(1),
  assessmentMode: z.enum(["model_primary", "algorithm_primary", "hybrid"]),
  alignment: z.array(alignmentScoreSchema).length(3),
  maturity: z.array(maturityScoreSchema).length(5),
  overallLevel: maturityLevelSchema,
  oneLineDiagnosis: z.string().min(1),
  highlightDimensions: z.array(maturityDimensionSchema),
  bottlenecks: z.array(z.string().min(1)),
  recommendedAction: upgradeSuggestionSchema,
  upgradeSuggestions: z.array(upgradeSuggestionSchema).min(1),
  calibrationFeedback: z.object({
    userRating: z.enum(["too_high", "accurate", "too_low"]).optional(),
    note: z.string().min(1).optional(),
  }).optional(),
}).superRefine((mapping, context) => {
  const alignmentDimensions = new Set(mapping.alignment.map((item) => item.dimension));
  if (alignmentDimensions.size !== mapping.alignment.length) {
    context.addIssue({ code: "custom", path: ["alignment"], message: "三重对齐维度不能重复" });
  }
  const maturityDimensions = new Set(mapping.maturity.map((item) => item.dimension));
  if (maturityDimensions.size !== mapping.maturity.length) {
    context.addIssue({ code: "custom", path: ["maturity"], message: "成熟度维度不能重复" });
  }
});

const enhancedOrganizationShape = {
  humanRoles: z.array(humanRoleSchema).min(1),
  agentRoles: z.array(agentRoleSchema).min(1),
  systemRoles: z.array(systemRoleSchema).min(1),
  interfaces: z.array(interfaceSchema).min(1),
  assignmentChecklist: z.array(assignmentItemSchema).min(1),
  launchReadiness: launchReadinessSchema,
};

const organizationMapSchema = z.object({
  conflicts: nonEmptyStrings,
  roleChanges: nonEmptyStrings,
  reportingChanges: z.array(z.string().min(1)),
  sharedDataLayer: z.string().min(1),
  humanRoles: enhancedOrganizationShape.humanRoles.optional(),
  agentRoles: enhancedOrganizationShape.agentRoles.optional(),
  systemRoles: enhancedOrganizationShape.systemRoles.optional(),
  interfaces: enhancedOrganizationShape.interfaces.optional(),
  assignmentChecklist: enhancedOrganizationShape.assignmentChecklist.optional(),
  launchReadiness: enhancedOrganizationShape.launchReadiness.optional(),
}).superRefine((organization, context) => {
  const enhancedKeys = Object.keys(enhancedOrganizationShape) as Array<keyof typeof enhancedOrganizationShape>;
  const present = enhancedKeys.filter((key) => organization[key] !== undefined);
  if (present.length === 0) return;
  if (present.length !== enhancedKeys.length) {
    context.addIssue({
      code: "custom",
      message: "增强组织映射字段必须成组提供",
    });
    return;
  }

  const nodeIds = new Set([
    ...(organization.humanRoles ?? []).map((role) => role.id),
    ...(organization.agentRoles ?? []).map((role) => role.id),
    ...(organization.systemRoles ?? []).map((role) => role.id),
  ]);
  const humanIds = new Set((organization.humanRoles ?? []).map((role) => role.id));
  const roleIds = new Set([
    ...(organization.humanRoles ?? []).map((role) => role.id),
    ...(organization.agentRoles ?? []).map((role) => role.id),
  ]);
  const requireId = (id: string, path: Array<string | number>, allowed: Set<string>, label: string) => {
    if (!allowed.has(id)) context.addIssue({ code: "custom", path, message: `${label}引用了未定义角色：${id}` });
  };

  (organization.agentRoles ?? []).forEach((role, index) =>
    requireId(role.supervisorRoleId, ["agentRoles", index, "supervisorRoleId"], humanIds, "监督角色"),
  );
  (organization.interfaces ?? []).forEach((item, index) => {
    requireId(item.sourceId, ["interfaces", index, "sourceId"], nodeIds, "接口来源");
    requireId(item.targetId, ["interfaces", index, "targetId"], nodeIds, "接口目标");
    requireId(item.responsibleRoleId, ["interfaces", index, "responsibleRoleId"], roleIds, "接口责任方");
    requireId(item.acceptanceRoleId, ["interfaces", index, "acceptanceRoleId"], humanIds, "接口验收方");
  });
  (organization.assignmentChecklist ?? []).forEach((item, index) =>
    requireId(item.roleId, ["assignmentChecklist", index, "roleId"], roleIds, "待指派角色"),
  );
  (organization.launchReadiness?.checklist ?? []).forEach((item, index) =>
    requireId(item.ownerRoleId, ["launchReadiness", "checklist", index, "ownerRoleId"], roleIds, "启动检查责任角色"),
  );
  (organization.launchReadiness?.firstWeekCadence ?? []).forEach((item, index) =>
    requireId(item.ownerRoleId, ["launchReadiness", "firstWeekCadence", index, "ownerRoleId"], roleIds, "首周节奏责任角色"),
  );
});

const businessGoalAnchorSchema = z.object({
  intent: z.string().min(1),
  goal: z.string().min(1),
  output: z.string().min(1),
  successSignal: z.string().min(1),
  cycle: z.string().min(1),
  constraints: z.string().min(1),
});

const workflowInputSchema = z.object({
  mode: z.enum(["current", "future"]),
  narrative: z.string().min(1),
  cells: z.array(z.object({
    id: z.string().min(1),
    action: z.string(),
    owner: z.string(),
    trigger: z.string(),
    input: z.string(),
    output: z.string(),
    decision: z.string(),
    system: z.string(),
    acceptance: z.string(),
    exceptionOwner: z.string(),
    memory: z.string(),
    friction: z.string(),
  })).optional(),
});

const breakpointTypeSchema = z.enum(["information_collapse", "waiting_black_hole", "validation_vacuum"]);
const breakpointSeveritySchema = z.enum(["low", "medium", "high"]);
const transformationMoveTypeSchema = z.enum([
  "remove",
  "merge",
  "agent_takeover",
  "human_boundary",
  "add_validation",
  "add_memory",
  "add_interface_protocol",
]);

export const legacyWorkflowNodeSchema = z.object({
  id: z.string().min(1),
  order: z.number().int().min(1),
  action: z.string(),
  owner: z.string(),
  input: z.string(),
  output: z.string(),
  handoffTo: z.string().min(1).optional(),
  waitFor: z.string().min(1).optional(),
  decision: z.string().min(1).optional(),
  approval: z.string().min(1).optional(),
  system: z.string().min(1).optional(),
  acceptance: z.string().min(1).optional(),
  verification: z.string().min(1).optional(),
  painNote: z.string().min(1).optional(),
});

export const workflowBreakpointSchema = z.object({
  id: z.string().min(1),
  nodeId: z.string().min(1),
  type: breakpointTypeSchema,
  severity: breakpointSeveritySchema,
  diagnosis: z.string().min(1),
  evidence: z.string().min(1),
  suggestedIntervention: z.string().min(1),
  confidence: z.enum(["high", "medium", "low"]),
  userConfirmed: z.boolean().optional(),
});

export const loopTransformationMoveSchema = z.object({
  id: z.string().min(1),
  type: transformationMoveTypeSchema,
  sourceNodeIds: z.array(z.string().min(1)).min(1),
  targetCellId: z.string().min(1).optional(),
  title: z.string().min(1),
  rationale: z.string().min(1),
  expectedEffect: z.string().min(1),
  humanChange: z.string().min(1).optional(),
});

export const beforeAfterMetricsSchema = z.object({
  nodeCountBefore: z.number().int().min(0),
  nodeCountAfter: z.number().int().min(0),
  humanExecutionNodesBefore: z.number().int().min(0),
  humanExecutionNodesAfter: z.number().int().min(0),
  waitingPointsBefore: z.number().int().min(0),
  waitingPointsAfter: z.number().int().min(0),
  approvalRoundsBefore: z.number().int().min(0),
  approvalRoundsAfter: z.number().int().min(0),
  aiTakeoverNodesAfter: z.number().int().min(0),
  validationSignalsBefore: z.number().int().min(0),
  validationSignalsAfter: z.number().int().min(0),
  memoryAssetsBefore: z.number().int().min(0),
  memoryAssetsAfter: z.number().int().min(0),
  estimatedCycleBefore: z.string().min(1).optional(),
  estimatedCycleAfter: z.string().min(1).optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

export const processTransformationSchema = z.object({
  generatedAt: z.string().min(1),
  legacyNodes: z.array(legacyWorkflowNodeSchema),
  breakpoints: z.array(workflowBreakpointSchema),
  moves: z.array(loopTransformationMoveSchema),
  beforeAfter: beforeAfterMetricsSchema,
  conceptBridge: z.array(z.object({
    oldTerm: z.string().min(1),
    newTerm: z.string().min(1),
    explanation: z.string().min(1),
  })).min(1),
});

const scenarioDiagnosisSchema = z.object({
  summary: z.string().min(1),
  stageMapping: z.array(z.object({
    stage: stageNameSchema,
    sourceStep: z.string().min(1),
    actor: z.string().min(1),
    system: z.string().min(1),
    bottleneck: z.string().min(1),
  })).length(5),
  collaborationOpportunities: z.array(z.object({
    type: z.enum(["人工搬运", "人工转译", "人工过滤", "经验记忆"]),
    currentLoad: z.string().min(1),
    aiSupport: z.string().min(1),
    humanBoundary: z.string().min(1),
    governanceRule: z.string().min(1),
  })).min(1),
  cellDiagnostics: z.array(z.object({
    cellId: z.string().min(1),
    cellLabel: z.string().min(1),
    action: z.string().min(1),
    stage: stageNameSchema,
    heat: z.enum(["green", "yellow", "red"]),
    heatLabel: z.string().min(1),
    recommendedMode: z.enum(["结构化入口", "知识增强执行", "异步共创审议", "工具链编排", "前置透明决策", "模板化自动发布"]),
    currentAiCapability: z.string().min(1),
    blockers: z.array(z.string().min(1)),
    humanBoundary: z.string().min(1),
    nextFill: z.array(z.string().min(1)),
    checks: z.array(z.object({
      label: z.enum(["输入是否清楚", "上下文是否足够", "输出能否被下游接收", "异常是否有人接管", "经验能否复用"]),
      status: z.enum(["具备", "待补齐", "缺失"]),
      reason: z.string().min(1),
    })).length(5),
  })).optional(),
  priorityActions: z.array(z.object({
    cellId: z.string().min(1),
    cellLabel: z.string().min(1),
    recommendedMode: z.enum(["结构化入口", "知识增强执行", "异步共创审议", "工具链编排", "前置透明决策", "模板化自动发布"]),
    action: z.string().min(1),
    reason: z.string().min(1),
  })).optional(),
});

export const toBeActorAssignmentSchema = z.object({
  type: z.enum(["human", "agent", "system"]),
  roleId: z.string().min(1).optional(),
  name: z.string().min(1),
  responsibility: z.string().min(1),
});

export const toBeTimeEstimateSchema = z.object({
  processingMinutes: z.number().int().min(0),
  waitingMinutes: z.number().int().min(0),
  reworkMinutes: z.number().int().min(0),
  confidence: z.enum(["high", "medium", "low"]),
  bottleneckLevel: z.enum(["low", "medium", "high"]),
  bottleneckReason: z.string().min(1),
});

export const toBeControlProfileSchema = z.object({
  primaryActorType: z.enum(["agent", "human"]),
  primaryActorRoleId: z.string().min(1),
  autonomyLevel: z.enum(["human_led", "agent_copilot", "agent_led_hitl", "agent_autonomous"]),
  humanBoundary: z.enum(["approval", "exception", "audit", "decision", "commitment"]),
  agentExecutionRights: z.array(z.string().min(1)).min(1),
  humanInterventionTriggers: z.array(z.string().min(1)).min(1),
  canAutoProceedWhen: z.array(z.string().min(1)).min(1),
  nextAutonomyUpgrade: z.string().min(1),
});

const toBeLoopCellSchema = z.object({
  cellId: z.string().min(1),
  cellLabel: z.string().min(1),
  action: z.string().min(1),
  currentGap: z.string().min(1),
  recommendedMode: z.enum(["结构化入口", "知识增强执行", "异步共创审议", "工具链编排", "前置透明决策", "模板化自动发布"]),
  actorAssignments: z.array(toBeActorAssignmentSchema).min(3),
  timeEstimate: toBeTimeEstimateSchema,
  controlProfile: toBeControlProfileSchema,
  aiRole: z.string().min(1),
  humanRole: z.string().min(1),
  interfaceContract: z.string().min(1),
  governanceRule: z.string().min(1),
  memoryRecord: z.string().min(1),
  acceptanceSignal: z.string().min(1),
  nextValidation: z.string().min(1),
}).superRefine((cell, context) => {
  const types = new Set(cell.actorAssignments.map((item) => item.type));
  const typeLabels: Record<"human" | "agent" | "system", string> = {
    human: "人类角色",
    agent: "智能体角色",
    system: "系统角色",
  };
  (["human", "agent", "system"] as const).forEach((type) => {
    if (!types.has(type)) {
      context.addIssue({ code: "custom", path: ["actorAssignments"], message: `改造后回路单元必须包含${typeLabels[type]}` });
    }
  });
  const primaryActor = cell.actorAssignments.find((item) => item.roleId === cell.controlProfile.primaryActorRoleId);
  if (!primaryActor) {
    context.addIssue({ code: "custom", path: ["controlProfile", "primaryActorRoleId"], message: "主要处理者必须引用参与角色中的 roleId" });
  } else if (primaryActor.type !== cell.controlProfile.primaryActorType) {
    context.addIssue({ code: "custom", path: ["controlProfile", "primaryActorType"], message: "主要处理者类型必须与引用角色一致" });
  }
  if (
    cell.controlProfile.autonomyLevel === "agent_autonomous" &&
    !["audit", "exception"].includes(cell.controlProfile.humanBoundary)
  ) {
    context.addIssue({ code: "custom", path: ["controlProfile", "humanBoundary"], message: "AI 自动处理单元必须保留审计或异常接管边界" });
  }
});

export const loopPlanSchema = z.object({
  title: z.string().min(1),
  executiveSummary: z.string().min(1),
  loopType: z.string().min(1),
  businessGoalAnchor: businessGoalAnchorSchema.optional(),
  workflowInput: workflowInputSchema.optional(),
  processTransformation: processTransformationSchema.optional(),
  scenarioDiagnosis: scenarioDiagnosisSchema.optional(),
  valueFlow: z.object({
    start: z.string().min(1),
    end: z.string().min(1),
    targetCycleTime: z.string().min(1),
  }),
  toBeLoopCells: z.array(toBeLoopCellSchema).min(1),
  hitlNodes: z.array(z.object({
    node: z.string().min(1),
    owner: z.string().min(1),
    authority: z.string().min(1),
    trigger: z.string().min(1),
    tool: z.string().min(1),
  })).min(1),
  organizationMap: organizationMapSchema,
  governance: z.object({
    kpis: z.array(z.object({
      name: z.string().min(1),
      current: z.string().min(1),
      target: z.string().min(1),
      cadence: z.string().min(1),
    })).min(2),
    arbitrationRules: z.array(z.string().min(1)).min(1),
    interlocks: z.array(z.string().min(1)),
    lifecycleRule: z.string().min(1),
  }),
  roadmap: z.array(z.object({
    week: z.number().int().min(1).max(4),
    theme: z.string().min(1),
    actions: z.array(z.string().min(1)).min(1),
    milestone: z.string().min(1),
    checkpoint: z.string().min(1),
  })).length(4),
  assumptions: z.array(z.string().min(1)),
  risks: z.array(z.string().min(1)).min(1),
  validationQuestions: z.array(z.string().min(1)).min(1),
  maturityMapping: loopMaturityMappingSchema.optional(),
});

export type LoopPlan = z.infer<typeof loopPlanSchema>;
export type LoopStage = z.infer<typeof loopStageSchema>;
export type ToBeLoopCell = z.infer<typeof toBeLoopCellSchema>;
export type OrganizationMap = LoopPlan["organizationMap"];
export type HumanRole = NonNullable<OrganizationMap["humanRoles"]>[number];
export type AgentRole = NonNullable<OrganizationMap["agentRoles"]>[number];
export type SystemRole = NonNullable<OrganizationMap["systemRoles"]>[number];
export type OrganizationInterface = NonNullable<OrganizationMap["interfaces"]>[number];
export type MaturityLevel = z.infer<typeof maturityLevelSchema>;
export type AlignmentDimension = z.infer<typeof alignmentDimensionSchema>;
export type MaturityDimension = z.infer<typeof maturityDimensionSchema>;
export type EvidenceItem = z.infer<typeof evidenceItemSchema>;
export type AlignmentScore = z.infer<typeof alignmentScoreSchema>;
export type MaturityScore = z.infer<typeof maturityScoreSchema>;
export type UpgradeSuggestion = z.infer<typeof upgradeSuggestionSchema>;
export type LoopMaturityMapping = z.infer<typeof loopMaturityMappingSchema>;
export type BusinessGoalAnchor = z.infer<typeof businessGoalAnchorSchema>;
export type WorkflowInput = z.infer<typeof workflowInputSchema>;
export type ScenarioDiagnosis = z.infer<typeof scenarioDiagnosisSchema>;
export type BreakpointType = z.infer<typeof breakpointTypeSchema>;
export type BreakpointSeverity = z.infer<typeof breakpointSeveritySchema>;
export type LegacyWorkflowNode = z.infer<typeof legacyWorkflowNodeSchema>;
export type WorkflowBreakpoint = z.infer<typeof workflowBreakpointSchema>;
export type TransformationMoveType = z.infer<typeof transformationMoveTypeSchema>;
export type LoopTransformationMove = z.infer<typeof loopTransformationMoveSchema>;
export type BeforeAfterMetrics = z.infer<typeof beforeAfterMetricsSchema>;
export type ProcessTransformation = z.infer<typeof processTransformationSchema>;
