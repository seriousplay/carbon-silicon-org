import type { SessionResponses } from "./session-types";

export const LOOP_STAGE_NAMES = ["感知", "理解", "决策", "执行", "反馈"] as const;
export const AGENTABILITY_CHECK_LABELS = ["输入是否清楚", "上下文是否足够", "输出能否被下游接收", "异常是否有人接管", "经验能否复用"] as const;
export const IMPROVEMENT_MODES = ["结构化入口", "知识增强执行", "异步共创审议", "工具链编排", "前置透明决策", "模板化自动发布"] as const;

export type BusinessGoalAnchor = {
  intent: string;
  goal: string;
  output: string;
  successSignal: string;
  cycle: string;
  constraints: string;
};

export type WorkflowInput = {
  mode: "current" | "future";
  narrative: string;
  cells?: LoopCellInput[];
};

export type LoopCellInput = {
  id: string;
  action: string;
  owner: string;
  trigger: string;
  input: string;
  output: string;
  decision: string;
  system: string;
  acceptance: string;
  exceptionOwner: string;
  memory: string;
  friction: string;
};

export type ScenarioDiagnosis = {
  summary: string;
  stageMapping: Array<{
    stage: (typeof LOOP_STAGE_NAMES)[number];
    sourceStep: string;
    actor: string;
    system: string;
    bottleneck: string;
  }>;
  collaborationOpportunities: Array<{
    type: "人工搬运" | "人工转译" | "人工过滤" | "经验记忆";
    currentLoad: string;
    aiSupport: string;
    humanBoundary: string;
    governanceRule: string;
  }>;
  cellDiagnostics: LoopCellDiagnosis[];
  priorityActions: Array<{
    cellId: string;
    cellLabel: string;
    recommendedMode: ImprovementMode;
    action: string;
    reason: string;
  }>;
};

export type AgentabilityStatus = "具备" | "待补齐" | "缺失";
export type AgentabilityHeat = "green" | "yellow" | "red";
export type ImprovementMode = (typeof IMPROVEMENT_MODES)[number];

export type LoopCellDiagnosis = {
  cellId: string;
  cellLabel: string;
  action: string;
  stage: (typeof LOOP_STAGE_NAMES)[number];
  heat: AgentabilityHeat;
  heatLabel: string;
  recommendedMode: ImprovementMode;
  currentAiCapability: string;
  blockers: string[];
  humanBoundary: string;
  nextFill: string[];
  checks: Array<{
    label: (typeof AGENTABILITY_CHECK_LABELS)[number];
    status: AgentabilityStatus;
    reason: string;
  }>;
};

const GOAL_LABELS: Record<keyof BusinessGoalAnchor, string> = {
  intent: "意图",
  goal: "目标",
  output: "输出",
  successSignal: "成功标志",
  cycle: "周期",
  constraints: "不可牺牲约束",
};

const WORKFLOW_LABELS: Record<keyof WorkflowInput, string> = {
  mode: "流程类型",
  narrative: "自然语言工作流",
  cells: "回路单元",
};

const CELL_LABELS: Record<keyof LoopCellInput, string> = {
  id: "单元ID",
  action: "动作",
  owner: "执行和责任",
  trigger: "触发",
  input: "输入",
  output: "输出",
  decision: "判断",
  system: "系统",
  acceptance: "完成标准",
  exceptionOwner: "异常接管",
  memory: "记录复用",
  friction: "费劲的地方",
};

const PARSE_LABELS = new Set<string>([
  ...Object.values(GOAL_LABELS),
  ...Object.values(WORKFLOW_LABELS),
]);

const WORKFLOW_STEP_NUMERALS = ["一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];

export function serializeBusinessGoalAnchor(value: Partial<BusinessGoalAnchor>) {
  return [
    "业务目标锚点：",
    `意图：${fieldText(value.intent)}`,
    `目标：${fieldText(value.goal)}`,
    `输出：${fieldText(value.output)}`,
    `成功标志：${fieldText(value.successSignal)}`,
    `周期：${fieldText(value.cycle)}`,
    `不可牺牲约束：${fieldText(value.constraints)}`,
  ].join("\n");
}

export function serializeWorkflowInput(value: Partial<WorkflowInput>) {
  const cells = normalizeLoopCells(value);
  const narrative = fieldText(value.narrative || serializeWorkflowStepLines(cells.map((cell) => cell.action)));
  return [
    "自然语言工作流：",
    `自然语言工作流：${narrative}`,
    "回路单元：",
    serializeLoopCells(cells),
  ].join("\n");
}

export function stepsFromWorkflowNarrative(value: string | undefined) {
  return splitWorkflowSteps(value || "");
}

export function normalizeLoopCells(value: Partial<WorkflowInput>): LoopCellInput[] {
  const explicit = (value.cells || []).map((cell, index) => normalizeLoopCell(cell, index));
  const explicitWithContent = explicit.filter(hasCellContent);
  if (explicitWithContent.length) return explicitWithContent;
  return stepsFromWorkflowNarrative(value.narrative).map((action, index) => normalizeLoopCell({ action }, index));
}

export function serializeWorkflowStepLines(steps: string[]) {
  return steps
    .map((step) => step.trim())
    .filter(Boolean)
    .map((step, index) => `${workflowStepLabel(index)}${step}`)
    .join("\n");
}

export function parseBusinessGoalAnchor(value: string | undefined): BusinessGoalAnchor | null {
  if (!value) return null;
  const parsed = parseLabeledText(value);
  const anchor: BusinessGoalAnchor = {
    intent: parsed[GOAL_LABELS.intent] || "",
    goal: parsed[GOAL_LABELS.goal] || "",
    output: parsed[GOAL_LABELS.output] || "",
    successSignal: parsed[GOAL_LABELS.successSignal] || "",
    cycle: parsed[GOAL_LABELS.cycle] || "",
    constraints: parsed[GOAL_LABELS.constraints] || "",
  };
  return Object.values(anchor).some(Boolean) ? anchor : null;
}

export function parseWorkflowInput(value: string | undefined): WorkflowInput | null {
  if (!value) return null;
  const parsed = parseLabeledText(value);
  const modeLabel = parsed[WORKFLOW_LABELS.mode] || "";
  const cells = parseLoopCells(value);
  const narrative = parsed[WORKFLOW_LABELS.narrative] || serializeWorkflowStepLines(cells.map((cell) => cell.action));
  const workflow: WorkflowInput = {
    mode: modeLabel.includes("设想") ? "future" : "current",
    narrative,
    ...(cells.length ? { cells } : {}),
  };
  return workflow.narrative || cells.length ? workflow : null;
}

export function buildScenarioDiagnosis(responses: SessionResponses): ScenarioDiagnosis {
  const goal = parseBusinessGoalAnchor(responses.business_goal);
  const workflow = parseWorkflowInput(responses.workflow);
  const cells = workflow ? normalizeLoopCells(workflow) : stepsFromWorkflowNarrative(responses.workflow).map((action, index) => normalizeLoopCell({ action }, index));
  const steps = cells.length ? cells.map((cell) => cell.action).filter(Boolean) : splitWorkflowSteps(workflow?.narrative || responses.workflow || "");
  const participants = summarizeCellField(cells, "owner") || "待用户确认的业务参与方";
  const systems = summarizeCellField(cells, "system") || "待用户确认的系统或数据源";
  const handoffProblems = summarizeCellField(cells, "friction") || "交接标准、事实源和异常接管仍需确认";
  const cellDiagnostics = cells.map((cell, index) => buildLoopCellDiagnosis(cell, index, workflow, handoffProblems));
  const priorityActions = buildPriorityActions(cellDiagnostics);
  const summary = [
    goal?.goal ? `围绕“${goal.goal}”` : "围绕当前业务目标",
    "拆解业务回路单元",
    `重点关注：${handoffProblems}`,
  ].join("，");

  return {
    summary,
    stageMapping: LOOP_STAGE_NAMES.map((stage, index) => ({
      stage,
      sourceStep: steps[index] || inferStageStep(stage, goal),
      actor: inferActor(stage, participants),
      system: systems,
      bottleneck: inferBottleneck(stage, handoffProblems),
    })),
    collaborationOpportunities: buildCollaborationOpportunities(workflow, handoffProblems),
    cellDiagnostics,
    priorityActions,
  };
}

export function serializeScenarioDiagnosis(diagnosis: ScenarioDiagnosis) {
  return [
    "AI 现状拆解确认：",
    `诊断摘要：${diagnosis.summary}`,
    "",
    "人机协作机会：",
    ...diagnosis.collaborationOpportunities.map((item) =>
      `- ${item.type}：当前负载=${item.currentLoad}；AI支持=${item.aiSupport}；人的边界=${item.humanBoundary}；治理规则=${item.governanceRule}`,
    ),
    "",
    "AI可以接管的工作：",
    ...diagnosis.cellDiagnostics.map((item) =>
      `- ${item.cellLabel} ${item.action}：状态=${item.heatLabel}；推荐改造模式=${item.recommendedMode}；当前AI能做=${item.currentAiCapability}；还不能接管=${item.blockers.join("、") || "主要条件已具备"}；人必须保留=${item.humanBoundary}；下一步=${item.nextFill.join("、")}`,
    ),
    "",
    "优先改造顺序：",
    ...diagnosis.priorityActions.map((item) => `- ${item.cellLabel}：${item.recommendedMode}；${item.action}；原因：${item.reason}`),
  ].join("\n");
}

export function formatDesignBriefForPrompt(responses: SessionResponses) {
  const goal = parseBusinessGoalAnchor(responses.business_goal);
  const workflow = parseWorkflowInput(responses.workflow);
  const diagnosis = buildScenarioDiagnosis(responses);
  return [
    "单回路设计输入：",
    goal ? [
      "- 业务目标锚点：",
      `  * 意图：${goal.intent}`,
      `  * 目标：${goal.goal}`,
      `  * 输出：${goal.output}`,
      `  * 成功标志：${goal.successSignal}`,
      `  * 用户设定周期：${goal.cycle}`,
      `  * 不可牺牲约束：${goal.constraints}`,
    ].join("\n") : "",
    workflow ? [
      "- 用户自然语言工作流：",
      `  * 步骤：${workflow.narrative}`,
      "  * 回路单元事实：",
      ...normalizeLoopCells(workflow).map((cell, index) => [
        `    - ${cellLabel(index)} ${fieldOrPending(cell.action)}`,
        `      执行/责任：${fieldOrPending(cell.owner)}；触发：${fieldOrPending(cell.trigger)}；输入：${fieldOrPending(cell.input)}；输出：${fieldOrPending(cell.output)}`,
        `      判断：${fieldOrPending(cell.decision)}；系统：${fieldOrPending(cell.system)}；完成标准：${fieldOrPending(cell.acceptance)}`,
        `      异常接管：${fieldOrPending(cell.exceptionOwner)}；记录复用：${fieldOrPending(cell.memory)}；费劲的地方：${fieldOrPending(cell.friction)}`,
      ].join("\n")),
    ].join("\n") : "",
    "- AI 拆解确认：",
    serializeScenarioDiagnosis(diagnosis),
    "使用规则：业务目标锚点优先级最高；To-Be 方案必须回指具体回路单元的可代理性诊断；缺失字段只能写待确认或列入验证问题，不要虚构 API、权限、数据质量或责任人；行动路线必须使用用户设定周期，不要固定写 60 天。",
  ].filter(Boolean).join("\n");
}

function parseLabeledText(value: string) {
  const result: Record<string, string> = {};
  let activeKey = "";
  for (const line of value.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.endsWith("：")) {
      activeKey = "";
      continue;
    }
    const match = /^([^：:]+)[：:](.*)$/.exec(trimmed);
    if (match && PARSE_LABELS.has(match[1].trim())) {
      activeKey = match[1].trim();
      result[activeKey] = match[2].trim();
    } else if (match) {
      activeKey = "";
    } else if (activeKey) {
      result[activeKey] = `${result[activeKey]}\n${trimmed}`.trim();
    }
  }
  return result;
}

function fieldText(value: string | undefined) {
  return value?.trim() || "待补齐";
}

function splitWorkflowSteps(value: string) {
  const normalized = value.replace(/\r/g, "\n").trim();
  if (!normalized) return [];
  const lines = normalized.split("\n").map((item) => item.trim()).filter(Boolean);
  if (lines.length >= 2) return lines.map(cleanStepLabel).filter(Boolean).slice(0, 8);
  return normalized
    .split(/(?=第[一二三四五六七八九十0-9]+步[：:、.])|(?=\d+[.、]\s*)/)
    .map(cleanStepLabel)
    .filter(Boolean)
    .slice(0, 8);
}

function cleanStepLabel(value: string) {
  return value.replace(/^[-*]\s*/, "").replace(/^(第[一二三四五六七八九十0-9]+步|[0-9]+)[：:、.\s]*/, "").trim();
}

function workflowStepLabel(index: number) {
  return `第${WORKFLOW_STEP_NUMERALS[index] || index + 1}步`;
}

function cellLabel(index: number) {
  return `Cell ${String(index + 1).padStart(2, "0")}`;
}

function normalizeLoopCell(value: Partial<LoopCellInput>, index: number): LoopCellInput {
  return {
    id: value.id?.trim() || `cell-${index + 1}`,
    action: value.action?.trim() || "",
    owner: value.owner?.trim() || "",
    trigger: value.trigger?.trim() || "",
    input: value.input?.trim() || "",
    output: value.output?.trim() || "",
    decision: value.decision?.trim() || "",
    system: value.system?.trim() || "",
    acceptance: value.acceptance?.trim() || "",
    exceptionOwner: value.exceptionOwner?.trim() || "",
    memory: value.memory?.trim() || "",
    friction: value.friction?.trim() || "",
  };
}

function hasCellContent(cell: LoopCellInput) {
  return Object.entries(cell).some(([key, value]) => key !== "id" && Boolean(value.trim()));
}

function serializeLoopCells(cells: LoopCellInput[]) {
  return cells.map((cell, index) => [
    `${cellLabel(index)}：`,
    `${CELL_LABELS.id}：${fieldOrPending(cell.id)}`,
    `${CELL_LABELS.action}：${fieldOrPending(cell.action)}`,
    `${CELL_LABELS.owner}：${fieldOrPending(cell.owner)}`,
    `${CELL_LABELS.trigger}：${fieldOrPending(cell.trigger)}`,
    `${CELL_LABELS.input}：${fieldOrPending(cell.input)}`,
    `${CELL_LABELS.output}：${fieldOrPending(cell.output)}`,
    `${CELL_LABELS.decision}：${fieldOrPending(cell.decision)}`,
    `${CELL_LABELS.system}：${fieldOrPending(cell.system)}`,
    `${CELL_LABELS.acceptance}：${fieldOrPending(cell.acceptance)}`,
    `${CELL_LABELS.exceptionOwner}：${fieldOrPending(cell.exceptionOwner)}`,
    `${CELL_LABELS.memory}：${fieldOrPending(cell.memory)}`,
    `${CELL_LABELS.friction}：${fieldOrPending(cell.friction)}`,
  ].join("\n")).join("\n");
}

function parseLoopCells(value: string) {
  const cellSection = value.split(/\n回路单元[：:]\n/)[1];
  if (!cellSection) return [];
  return cellSection
    .split(/\n(?=Cell\s+\d+[：:])/)
    .map((block, index) => parseLoopCellBlock(block, index))
    .filter(hasCellContent);
}

function parseLoopCellBlock(block: string, index: number): LoopCellInput {
  const cell: Partial<LoopCellInput> = {};
  for (const line of block.split("\n")) {
    const match = /^([^：:]+)[：:](.*)$/.exec(line.trim());
    if (!match) continue;
    const label = match[1].trim();
    const key = (Object.keys(CELL_LABELS) as Array<keyof LoopCellInput>).find((item) => CELL_LABELS[item] === label);
    if (key) cell[key] = clearPending(match[2]) as never;
  }
  return normalizeLoopCell(cell, index);
}

function fieldOrPending(value: string | undefined) {
  return value?.trim() || "待确认";
}

function clearPending(value: string | undefined) {
  const text = value?.trim() || "";
  return text === "待确认" ? "" : text;
}

function isMissing(value: string | undefined) {
  return !value?.trim() || /^(待确认|不清楚|未知|暂无|无)$/.test(value.trim());
}

function summarizeCellField(cells: LoopCellInput[], key: keyof Pick<LoopCellInput, "owner" | "system" | "friction">) {
  return [...new Set(cells.map((cell) => cell[key].trim()).filter((value) => value && !isMissing(value)))].slice(0, 6).join("；");
}

function inferStageStep(stage: (typeof LOOP_STAGE_NAMES)[number], goal: BusinessGoalAnchor | null) {
  const output = goal?.output || "目标输出";
  const map: Record<(typeof LOOP_STAGE_NAMES)[number], string> = {
    感知: "识别需求、异常、机会或触发事件。",
    理解: "把输入整理成可判断的业务对象和约束。",
    决策: "确认是否推进、谁负责、承诺什么结果。",
    执行: `完成${output}并留下过程记录。`,
    反馈: "用成功标志复盘结果，并更新下一轮规则。",
  };
  return map[stage];
}

function inferActor(stage: (typeof LOOP_STAGE_NAMES)[number], participants: string) {
  if (stage === "决策" || stage === "反馈") return `${participants}；需要明确最终负责者`;
  return participants;
}

function inferBottleneck(stage: (typeof LOOP_STAGE_NAMES)[number], handoffProblems: string) {
  if (stage === "反馈") return `${handoffProblems}；复盘是否能回到下一轮规则仍需确认`;
  if (stage === "决策") return `${handoffProblems}；承诺权和异常接管需要显式化`;
  return handoffProblems;
}

function buildLoopCellDiagnosis(cell: LoopCellInput, index: number, workflow: WorkflowInput | null, handoffProblems: string): LoopCellDiagnosis {
  const checks = buildAgentabilityChecks(cell, workflow);
  const missingCount = checks.filter((item) => item.status === "缺失").length;
  const partialCount = checks.filter((item) => item.status === "待补齐").length;
  const heat: AgentabilityHeat = missingCount >= 2 ? "red" : missingCount === 0 && partialCount <= 1 ? "green" : "yellow";
  const recommendedMode = inferImprovementMode(cell, index);
  const blockers = checks.filter((item) => item.status !== "具备").map((item) => `${item.label}：${item.reason}`);
  const nextFill = buildNextFill(checks, recommendedMode);

  return {
    cellId: cell.id,
    cellLabel: cellLabel(index),
    action: cell.action || "待确认动作",
    stage: inferCellStage(cell, index),
    heat,
    heatLabel: heatLabel(heat),
    recommendedMode,
    currentAiCapability: aiCapabilityForMode(recommendedMode, cell),
    blockers,
    humanBoundary: humanBoundaryForCell(cell, handoffProblems),
    nextFill,
    checks,
  };
}

function buildAgentabilityChecks(cell: LoopCellInput, workflow: WorkflowInput | null): LoopCellDiagnosis["checks"] {
  void workflow;
  const inputStatus = isMissing(cell.action) || isMissing(cell.input) || isMissing(cell.trigger)
    ? isMissing(cell.action)
      ? "缺失"
      : "待补齐"
    : "具备";
  const contextStatus = isMissing(cell.owner) || isMissing(cell.system) || isMissing(cell.decision)
    ? isMissing(cell.owner)
      ? "缺失"
      : "待补齐"
    : "具备";
  const outputStatus = isMissing(cell.output) || isMissing(cell.acceptance)
    ? isMissing(cell.output)
      ? "缺失"
      : "待补齐"
    : "具备";
  const exceptionStatus = isMissing(cell.exceptionOwner) ? "缺失" : "具备";
  const memoryStatus = isMissing(cell.memory) ? "缺失" : "具备";

  return [
    {
      label: "输入是否清楚",
      status: inputStatus,
      reason: inputStatus === "具备" ? "触发条件、输入对象和动作已描述。" : "需要补齐触发条件、输入对象或原始信息来源。",
    },
    {
      label: "上下文是否足够",
      status: contextStatus,
      reason: contextStatus === "具备" ? "执行责任、判断事项和系统上下文已描述。" : "需要补齐责任人、判断依据、工具系统或知识来源。",
    },
    {
      label: "输出能否被下游接收",
      status: outputStatus,
      reason: outputStatus === "具备" ? "输出对象和完成标准已描述。" : "需要补齐交接输出、验收标准或下游接收条件。",
    },
    {
      label: "异常是否有人接管",
      status: exceptionStatus,
      reason: exceptionStatus === "具备" ? "异常接管人或接管角色已描述。" : "异常、争议、超时或失败后的接管人待确认。",
    },
    {
      label: "经验能否复用",
      status: memoryStatus,
      reason: memoryStatus === "具备" ? "该步骤会留下可复用记录。" : "需要明确留下什么记录，供下一轮复用。",
    },
  ];
}

function inferCellStage(cell: LoopCellInput, index: number): (typeof LOOP_STAGE_NAMES)[number] {
  const source = cellText(cell);
  if (/反馈|复盘|验收|回访|评价|总结/.test(source)) return "反馈";
  if (/执行|制作|交付|发布|同步|修改|生成|录入|上传|下载/.test(source)) return "执行";
  if (/判断|确认|审批|审定|终审|承诺|决策|批准/.test(source)) return "决策";
  if (/整理|理解|分析|评估|脚本|方案|翻译|转译/.test(source)) return "理解";
  if (/发起|触发|提出|接收|收集|识别|进入/.test(source)) return "感知";
  return LOOP_STAGE_NAMES[Math.min(index, LOOP_STAGE_NAMES.length - 1)];
}

function inferImprovementMode(cell: LoopCellInput, index: number): ImprovementMode {
  const source = cellText(cell);
  if (/发布|上线|推送|通知|多平台|分发/.test(source)) return "模板化自动发布";
  if (/CEO|终审|老板|高层|裁决|最终决策|最终确认/.test(source)) return "前置透明决策";
  if (/视频初稿|素材|剪映|即梦|工具|API|接口|搬运|同步|上传|下载|录入/.test(source)) return "工具链编排";
  if (/脚本初稿|初稿|撰写|写作|生成方案|知识库|历史案例|模板/.test(source)) return "知识增强执行";
  if (/审定|审核|评审|修改|意见|批注|版本|群聊反馈|争议/.test(source)) return "异步共创审议";
  if (/需求|口头|brief|表单|卡片|发起|输入/.test(source) || index <= 1) return "结构化入口";
  return "知识增强执行";
}

function buildPriorityActions(diagnostics: LoopCellDiagnosis[]): ScenarioDiagnosis["priorityActions"] {
  const heatRank: Record<AgentabilityHeat, number> = { yellow: 0, red: 1, green: 2 };
  return [...diagnostics]
    .sort((a, b) => heatRank[a.heat] - heatRank[b.heat])
    .slice(0, 4)
    .map((item) => ({
      cellId: item.cellId,
      cellLabel: item.cellLabel,
      recommendedMode: item.recommendedMode,
      action: priorityActionForMode(item.recommendedMode),
      reason: item.blockers[0] || "主要执行条件已经具备，适合先做低风险试运行。",
    }));
}

function buildNextFill(checks: LoopCellDiagnosis["checks"], mode: ImprovementMode) {
  const missing = checks.filter((item) => item.status !== "具备").map((item) => nextFillForCheck(item.label));
  const byMode = nextFillForMode(mode);
  return [...new Set([...missing, byMode])].slice(0, 4);
}

function priorityActionForMode(mode: ImprovementMode) {
  const map: Record<ImprovementMode, string> = {
    结构化入口: "先建立 brief、表单或卡片入口，把模糊输入转成可处理对象。",
    知识增强执行: "先接入知识卡片、历史案例和标准模板，让 AI 产出可审稿件。",
    异步共创审议: "先把群聊意见改成可归并、可追踪、可验收的异步审议。",
    工具链编排: "先梳理工具权限、半自动节点和人工兜底，减少跨系统搬运。",
    前置透明决策: "先让关键决策人提前看到方向、争议和风险，减少末端返工。",
    模板化自动发布: "先固化发布模板、检查清单和留痕规则，低风险自动化。",
  };
  return map[mode];
}

function nextFillForMode(mode: ImprovementMode) {
  const map: Record<ImprovementMode, string> = {
    结构化入口: "brief 模板",
    知识增强执行: "知识卡片",
    异步共创审议: "审核清单",
    工具链编排: "权限接入",
    前置透明决策: "争议摘要",
    模板化自动发布: "发布模板",
  };
  return map[mode];
}

function nextFillForCheck(label: (typeof AGENTABILITY_CHECK_LABELS)[number]) {
  const map: Record<(typeof AGENTABILITY_CHECK_LABELS)[number], string> = {
    输入是否清楚: "输入模板",
    上下文是否足够: "知识来源",
    输出能否被下游接收: "接口契约",
    异常是否有人接管: "接管规则",
    经验能否复用: "记录表",
  };
  return map[label];
}

function aiCapabilityForMode(mode: ImprovementMode, cell: LoopCellInput) {
  const action = cell.action || "这一步";
  const input = isMissing(cell.input) ? "原始输入" : cell.input;
  const output = isMissing(cell.output) ? "下游可接收的输出" : cell.output;
  const system = isMissing(cell.system) ? "待确认系统" : cell.system;
  const map: Record<ImprovementMode, string> = {
    结构化入口: `AI 将“${input}”整理为“${output}”，同时列出缺项问题和来源记录。`,
    知识增强执行: `AI 基于知识卡片、历史案例和模板，为“${action}”生成可审阅的“${output}”。`,
    异步共创审议: `AI 归并围绕“${output}”的意见、冲突和版本差异，形成待确认修改清单。`,
    工具链编排: `AI 检查“${input}”到“${output}”的字段完整性，并在“${system}”中提示或准备受控操作。`,
    前置透明决策: `AI 提前汇总“${action}”的方向、争议、风险和待裁决事项，让责任人提前介入。`,
    模板化自动发布: `AI 按已确认模板生成“${output}”，完成缺项检查、同步准备和审计记录。`,
  };
  return map[mode];
}

function humanBoundaryForCell(cell: LoopCellInput, handoffProblems: string) {
  const owner = isMissing(cell.exceptionOwner) ? "业务负责人" : cell.exceptionOwner;
  if (!isMissing(cell.decision)) return `${owner}负责判断“${cell.decision}”，并确认是否可以对下游或客户承诺。`;
  if (!isMissing(cell.acceptance)) return `${owner}负责验收“${cell.acceptance}”，并在异常时接管。`;
  return `业务负责人保留价值取舍、高风险承诺和异常接管；当前需特别确认：${handoffProblems}`;
}

function heatLabel(heat: AgentabilityHeat) {
  if (heat === "green") return "AI 可辅助或接管";
  if (heat === "yellow") return "补齐条件后可接管";
  return "必须先补基础条件";
}

function cellText(cell: LoopCellInput) {
  return [
    cell.action,
    cell.owner,
    cell.trigger,
    cell.input,
    cell.output,
    cell.decision,
    cell.system,
    cell.acceptance,
    cell.exceptionOwner,
    cell.memory,
    cell.friction,
  ].join(" ");
}

function buildCollaborationOpportunities(workflow: WorkflowInput | null, handoffProblems: string) {
  const source = `${workflow?.narrative || ""} ${handoffProblems}`;
  const opportunities: ScenarioDiagnosis["collaborationOpportunities"] = [];
  if (/复制|搬|录入|同步|表格|系统|传/.test(source)) {
    opportunities.push({
      type: "人工搬运",
      currentLoad: "人在系统、表格或群聊之间搬运信息。",
      aiSupport: "自动提取字段、生成结构化对象、同步状态和提醒缺项。",
      humanBoundary: "人确认高风险字段和最终承诺，不做重复搬运。",
      governanceRule: "每次自动同步必须保留来源、时间、操作者和回退方式。",
    });
  }
  if (/翻译|转述|解释|需求|业务|技术|口头|脚本/.test(source)) {
    opportunities.push({
      type: "人工转译",
      currentLoad: "人在业务语言、执行语言和系统字段之间反复转译。",
      aiSupport: "把原始描述转成标准 brief、待确认问题和执行口径。",
      humanBoundary: "人保留语义确认、价值判断和对外承诺。",
      governanceRule: "AI 转译结果必须可追溯到原始输入，并由责任人验收。",
    });
  }
  if (/筛选|判断|优先|汇总|意见|审批|风险/.test(source)) {
    opportunities.push({
      type: "人工过滤",
      currentLoad: "人在碎片信息中汇总、排序和判断优先级。",
      aiSupport: "聚合证据、标记风险、提出优先级建议。",
      humanBoundary: "人决定取舍、批准例外和承担结果责任。",
      governanceRule: "高影响、高不确定、高成本动作必须进入 HITL。",
    });
  }
  if (/经验|知识|复盘|记忆|案例|历史|规则/.test(source) || opportunities.length === 0) {
    opportunities.push({
      type: "经验记忆",
      currentLoad: "关键经验留在人脑或零散文档里，难以复用。",
      aiSupport: "从每次处理结果中沉淀规则、案例和下次可调用的上下文。",
      humanBoundary: "人判断哪些经验有效、过期或只适用于特定场景。",
      governanceRule: "只有经过确认的经验进入组织记忆，草稿不自动复用。",
    });
  }
  return opportunities.slice(0, 4);
}
