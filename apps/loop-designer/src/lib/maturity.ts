import type {
  AlignmentDimension,
  AlignmentScore,
  EvidenceItem,
  LoopMaturityMapping,
  LoopPlan,
  MaturityDimension,
  MaturityLevel,
  MaturityScore,
  UpgradeSuggestion,
} from "./plan-schema";

const MATURITY_LABELS: Record<MaturityLevel, string> = {
  1: "基础条件待补齐",
  2: "可以小范围试跑",
  3: "关键链路可运行",
  4: "跨角色协作较稳定",
  5: "可复用并持续进化",
};

const MATURITY_EXPLANATIONS: Record<MaturityDimension, string> = {
  loop_maturity: "这条业务链路是不是形成了完整闭环。",
  triple_alignment: "目标、边界和验证是不是互相支持。",
  orchestration: "人、AI、系统和接口是不是各就各位。",
  intelligence_density: "AI 是不是进入了关键节点，而不只是外围辅助。",
  eco_evolution: "这条回路是不是能复盘、迭代、扩散到下一条回路。",
};

const ALIGNMENT_EXPLANATIONS: Record<AlignmentDimension, string> = {
  goal: "这条回路是不是在服务真正重要的业务目标。",
  value: "人和 AI 的边界是不是清楚。",
  logic: "数据、接口和验收是不是能闭环。",
};

const CUSTOMER_DIMENSION_LABELS: Record<MaturityDimension | AlignmentDimension, string> = {
  goal: "业务目标",
  value: "人机边界",
  logic: "数据和验收闭环",
  loop_maturity: "闭环完整度",
  triple_alignment: "目标和分工对齐",
  orchestration: "协作衔接",
  intelligence_density: "AI 接管程度",
  eco_evolution: "复盘迭代能力",
};

const EVIDENCE_SOURCE_LABELS: Record<string, string> = {
  valueFlow: "业务起点、终点和目标速度",
  "governance.kpis": "衡量指标",
  "toBeLoopCells.acceptanceSignal": "每一步验收标准",
  hitlNodes: "人工接管节点",
  "organizationMap.agentRoles": "智能体职责和边界",
  "toBeLoopCells.humanRole": "人的判断和接管边界",
  "organizationMap.interfaces": "上下游交接规则",
  "organizationMap.systemRoles": "事实记录系统",
  "interfaces.auditRecord": "验收和审计记录",
  toBeLoopCells: "改造后的回路步骤",
  "toBeLoopCells.memoryRecord": "每一步的留痕和复盘记录",
  "governance.lifecycleRule": "回路运行和退出规则",
  organizationMap: "人、AI、系统的分工",
  launchReadiness: "启动前检查",
  "toBeLoopCells.aiRole": "每一步 AI 能做什么",
  roadmap: "周期行动路线",
  validationQuestions: "下一轮需要验证的问题",
  "governance.interlocks": "复盘经验沉淀和复用机制",
};

export function withMaturityMapping(plan: LoopPlan): LoopPlan {
  const maturityMapping = assessLoopMaturity(plan);
  return {
    ...plan,
    maturityMapping,
    roadmap: ensureReassessmentReminder(plan.roadmap),
  };
}

export function assessLoopMaturity(plan: LoopPlan): LoopMaturityMapping {
  const alignment = buildAlignmentScores(plan);
  const maturity = buildMaturityScores(plan, alignment);
  const lowest = maturity.reduce<MaturityScore>((current, item) =>
    item.level < current.level ? item : current,
  maturity[0]);
  const highlights = maturity
    .filter((item) => item.level >= 3 && item.dimension !== lowest.dimension)
    .sort((left, right) => right.level - left.level)
    .slice(0, 2)
    .map((item) => item.dimension);
  const bottlenecks = maturity
    .filter((item) => item.level === lowest.level)
    .map((item) => item.bottleneck || customerDimensionLabel(item.dimension));
  const upgradeSuggestions = buildUpgradeSuggestions(alignment, maturity);
  const recommendedAction = upgradeSuggestions.find((item) => item.priority === "critical") ?? upgradeSuggestions[0];
  return {
    assessedAt: new Date().toISOString(),
    assessmentMode: "algorithm_primary",
    alignment,
    maturity,
    overallLevel: lowest.level,
    oneLineDiagnosis: buildOneLineDiagnosis(lowest, highlights),
    highlightDimensions: highlights,
    bottlenecks,
    recommendedAction,
    upgradeSuggestions,
  };
}

export function maturityLevelLabel(level: MaturityLevel) {
  return MATURITY_LABELS[level];
}

export function dimensionLabel(dimension: MaturityDimension | AlignmentDimension) {
  return customerDimensionLabel(dimension);
}

export function customerDimensionLabel(dimension: MaturityDimension | AlignmentDimension) {
  return CUSTOMER_DIMENSION_LABELS[dimension];
}

export function evidenceSourceLabel(source: string) {
  return EVIDENCE_SOURCE_LABELS[source] ?? "方案中的相关证据";
}

export function customerFacingText(text: string | undefined) {
  if (!text) return "";
  let output = text;
  for (const [source, label] of Object.entries(EVIDENCE_SOURCE_LABELS).sort((left, right) => right[0].length - left[0].length)) {
    output = output.split(source).join(label);
  }
  for (const [dimension, label] of Object.entries(CUSTOMER_DIMENSION_LABELS)) {
    output = output.split(dimension).join(label);
  }
  output = output
    .replaceAll("生态进化性", CUSTOMER_DIMENSION_LABELS.eco_evolution)
    .replaceAll("三重对齐度", CUSTOMER_DIMENSION_LABELS.triple_alignment)
    .replaceAll("编排能力", CUSTOMER_DIMENSION_LABELS.orchestration)
    .replaceAll("智能密度", CUSTOMER_DIMENSION_LABELS.intelligence_density)
    .replaceAll("回路成熟度", CUSTOMER_DIMENSION_LABELS.loop_maturity);
  return output;
}

function buildAlignmentScores(plan: LoopPlan): AlignmentScore[] {
  const kpiCount = plan.governance.kpis.length;
  const hasOutcome = [plan.valueFlow.start, plan.valueFlow.end, plan.valueFlow.targetCycleTime].every(hasMeaningfulText);
  const hasCellAcceptance = plan.toBeLoopCells.every((cell) => hasMeaningfulText(cell.acceptanceSignal));
  const goalEvidence: EvidenceItem[] = [
    evidence("valueFlow", hasOutcome ? "起点、终点和目标速度已定义。" : "价值流边界不完整。", hasOutcome ? "strong" : "missing", hasOutcome ? undefined : "补齐起点、终点和目标速度。"),
    evidence("governance.kpis", kpiCount >= 2 ? "KPI 覆盖速度、质量或风险信号。" : "KPI 数量不足。", kpiCount >= 2 ? "strong" : "partial", kpiCount >= 2 ? undefined : "至少补齐 2 个可复盘 KPI。"),
    evidence("toBeLoopCells.acceptanceSignal", hasCellAcceptance ? "每个回路单元都有可验收信号。" : "部分回路单元缺少具体验收信号。", hasCellAcceptance ? "strong" : "partial", hasCellAcceptance ? undefined : "为每个回路单元写清可观察、可交接的验收信号。"),
  ];

  const enhanced = hasEnhancedOrganization(plan);
  const agents = plan.organizationMap.agentRoles ?? [];
  const hitlComplete = enhanced && agents.every((role) => role.supervisorRoleId && role.hitlTriggers.length && role.prohibitedActions.length);
  const valueEvidence: EvidenceItem[] = [
    evidence("hitlNodes", plan.hitlNodes.length ? "已定义需要人接管的节点和责任人。" : "缺少需要人接管的节点。", plan.hitlNodes.length ? "strong" : "missing", plan.hitlNodes.length ? undefined : "补齐高风险事项的人类接管节点。"),
    evidence("organizationMap.agentRoles", hitlComplete ? "智能体已有监督、请示和禁止动作。" : "智能体边界尚未完全可审计。", hitlComplete ? "strong" : "partial", hitlComplete ? undefined : "补齐智能体监督角色、请示动作和禁止动作。"),
    evidence("toBeLoopCells.humanRole", plan.toBeLoopCells.every((cell) => hasMeaningfulText(cell.humanRole)) ? "每个回路单元都定义了人类保留边界。" : "部分回路单元的人类边界不清楚。", plan.toBeLoopCells.every((cell) => hasMeaningfulText(cell.humanRole)) ? "strong" : "partial", plan.toBeLoopCells.every((cell) => hasMeaningfulText(cell.humanRole)) ? undefined : "补齐每个单元由人保留的判断、承诺和异常接管。"),
  ];

  const interfaces = plan.organizationMap.interfaces ?? [];
  const systems = plan.organizationMap.systemRoles ?? [];
  const hasAudit = interfaces.some((item) => hasMeaningfulText(item.auditRecord) && item.acceptanceCriteria.some(hasMeaningfulText));
  const logicEvidence: EvidenceItem[] = [
    evidence("organizationMap.interfaces", interfaces.length ? "已定义业务与系统接口契约。" : "缺少接口契约。", interfaces.length ? "strong" : "missing", interfaces.length ? undefined : "补齐关键交接对象、验收标准和异常处理。"),
    evidence("organizationMap.systemRoles", systems.some((item) => item.sourceOfTruth) ? "已有唯一事实源。" : "事实源不清楚。", systems.some((item) => item.sourceOfTruth) ? "strong" : "partial", systems.some((item) => item.sourceOfTruth) ? undefined : "明确哪个系统保存唯一事实记录。"),
    evidence("interfaces.auditRecord", hasAudit ? "接口保留审计记录和验收标准。" : "审计和验收证据不足。", hasAudit ? "strong" : "partial", hasAudit ? undefined : "补齐接口验收标准、审计记录和失败复盘机制。"),
  ];

  return [
    alignmentScore("goal", goalEvidence, "让业务目标、价值流和 KPI 对上。"),
    alignmentScore("value", valueEvidence, "让人和 AI 的责任、禁区和异常接管说清楚。"),
    alignmentScore("logic", logicEvidence, "让数据、接口、验收和审计形成闭环。"),
  ];
}

function buildMaturityScores(plan: LoopPlan, alignment: AlignmentScore[]): MaturityScore[] {
  const enhanced = hasEnhancedOrganization(plan);
  const agentableCells = plan.toBeLoopCells.filter((cell) => hasMeaningfulText(cell.aiRole));
  const memoryCells = plan.toBeLoopCells.filter((cell) => hasMeaningfulText(cell.memoryRecord));
  const loopEvidence = [
    evidence("toBeLoopCells", plan.toBeLoopCells.length ? "改造后回路已按业务单元展开。" : "缺少改造后回路单元。", plan.toBeLoopCells.length ? "strong" : "missing", plan.toBeLoopCells.length ? undefined : "补齐基于沙盘输入的改造后回路映射。"),
    evidence("toBeLoopCells.memoryRecord", memoryCells.length === plan.toBeLoopCells.length ? "每个单元都定义了可复用记录。" : "部分单元缺少组织记忆记录。", memoryCells.length === plan.toBeLoopCells.length ? "strong" : "partial", memoryCells.length === plan.toBeLoopCells.length ? undefined : "补齐每个单元的留痕、复盘和复用记录。"),
    evidence("governance.lifecycleRule", hasMeaningfulText(plan.governance.lifecycleRule) ? "已有生命周期规则。" : "缺少生命周期规则。", hasMeaningfulText(plan.governance.lifecycleRule) ? "strong" : "missing", hasMeaningfulText(plan.governance.lifecycleRule) ? undefined : "写清何时扩圈、回退或停用。"),
  ];
  const orchestrationEvidence = [
    evidence("organizationMap", enhanced ? "角色、智能体、系统和接口成组定义。" : "组织映射仍是旧版结构。", enhanced ? "strong" : "partial", enhanced ? undefined : "补齐人类角色、智能体、系统、接口和 RACI。"),
    evidence("launchReadiness", enhanced ? "启动检查覆盖角色、智能体、系统、数据和异常演练。" : "启动检查不足。", enhanced ? "strong" : "missing", enhanced ? undefined : "补齐启动检查和首周运行节奏。"),
  ];
  const intelligenceEvidence = [
    evidence("toBeLoopCells.aiRole", agentableCells.length === plan.toBeLoopCells.length ? "每个单元都定义了 AI 支持或接管方式。" : "部分单元缺少 AI 角色设计。", agentableCells.length === plan.toBeLoopCells.length ? "strong" : "partial", agentableCells.length === plan.toBeLoopCells.length ? undefined : "明确每个单元 AI 能做什么、不能做什么、下一步补什么。"),
    evidence("organizationMap.agentRoles", (plan.organizationMap.agentRoles?.length ?? 0) > 0 ? "已有明确智能体角色。" : "缺少智能体角色。", (plan.organizationMap.agentRoles?.length ?? 0) > 0 ? "strong" : "missing", (plan.organizationMap.agentRoles?.length ?? 0) > 0 ? undefined : "至少定义一个受控智能体角色。"),
  ];
  const evolutionEvidence = [
    evidence("roadmap", plan.roadmap.length === 4 ? "已有周期行动路线。" : "行动路线不完整。", plan.roadmap.length === 4 ? "strong" : "partial", plan.roadmap.length === 4 ? undefined : "补齐四阶段路线和检查点。"),
    evidence("validationQuestions", plan.validationQuestions.length ? "已有待验证问题。" : "缺少验证问题。", plan.validationQuestions.length ? "strong" : "missing", plan.validationQuestions.length ? undefined : "补齐下一轮验证问题。"),
    evidence("governance.interlocks", plan.governance.interlocks.length ? "已有回路互锁或知识回灌。" : "缺少扩散机制。", plan.governance.interlocks.length ? "partial" : "missing", "把复盘结果沉淀为可复用规则、模板或 Matrix 提案证据。"),
  ];

  const tripleScore = Math.round(alignment.reduce((sum, item) => sum + item.score, 0) / alignment.length);
  return [
    maturityScore("loop_maturity", scoreEvidence(loopEvidence), loopEvidence),
    maturityScore("triple_alignment", tripleScore, alignment.flatMap((item) => item.evidence.slice(0, 1))),
    maturityScore("orchestration", scoreEvidence(orchestrationEvidence), orchestrationEvidence),
    maturityScore("intelligence_density", scoreEvidence(intelligenceEvidence), intelligenceEvidence),
    maturityScore("eco_evolution", scoreEvidence(evolutionEvidence), evolutionEvidence),
  ];
}

function buildUpgradeSuggestions(alignment: AlignmentScore[], maturity: MaturityScore[]): UpgradeSuggestion[] {
  const suggestions: UpgradeSuggestion[] = [];
  const weakAlignment = alignment.find((item) => item.level <= 2);
  if (weakAlignment) {
    suggestions.push({
      dimension: weakAlignment.dimension,
      priority: "critical",
      action: weakAlignment.dimension === "logic" ? "修复数据闭环问题" : weakAlignment.dimension === "value" ? "修复人机边界问题" : "修复业务目标不清",
      actionType: "regenerate_field",
      targetField: weakAlignment.dimension === "logic" ? "organizationMap.interfaces" : weakAlignment.dimension === "value" ? "toBeLoopCells" : "governance.kpis",
      riskIfIgnored: weakAlignment.dimension === "logic" ? "试运行时交接对象、验收标准或审计记录不清，异常会回到人工扯皮。" : weakAlignment.dimension === "value" ? "AI 可能越界执行或无人接管高风险承诺。" : "团队会围绕一个看似合理但无法验收的目标推进。",
      expectedEffect: weakAlignment.dimension === "logic" ? "让关键接口、事实源和验收标准形成闭环。" : weakAlignment.dimension === "value" ? "让人和 AI 的判断、承诺与接管边界可审计。" : "让价值流、KPI 和用户设定周期对齐同一个业务结果。",
    });
  }
  const weakestMaturity = maturity.reduce((current, item) => item.level < current.level ? item : current, maturity[0]);
  suggestions.push({
    dimension: weakestMaturity.dimension,
    priority: weakAlignment ? "important" : "critical",
    action: weakestMaturity.dimension === "eco_evolution" ? "把复盘和迭代动作写进行动路线" : `提升${customerDimensionLabel(weakestMaturity.dimension)}`,
    actionType: weakestMaturity.dimension === "eco_evolution" ? "apply_to_roadmap" : "regenerate_field",
    targetField: weakestMaturity.dimension === "eco_evolution" ? "roadmap" : undefined,
    riskIfIgnored: weakAlignment ? undefined : "短板维度会限制整条回路的成熟度，方案容易停留在试点而不能扩圈。",
    expectedEffect: `把${customerDimensionLabel(weakestMaturity.dimension)}从当前短板变成可复盘的升级项。`,
  });
  suggestions.push({
    dimension: "eco_evolution",
    priority: "optional",
    action: "在设定周期结束时重新评估成熟度",
    actionType: "manual",
    expectedEffect: "让本次设计沉淀为可追踪的回路演进记录。",
  });
  return suggestions;
}

function alignmentScore(dimension: AlignmentDimension, evidenceItems: EvidenceItem[], recommendation: string): AlignmentScore {
  const score = scoreEvidence(evidenceItems);
  return {
    dimension,
    score,
    level: scoreToLevel(score, evidenceItems.length),
    userExplanation: ALIGNMENT_EXPLANATIONS[dimension],
    evidence: evidenceItems,
    gap: evidenceItems.find((item) => item.gap)?.gap,
    recommendation,
  };
}

function maturityScore(dimension: MaturityDimension, score: number, evidenceItems: EvidenceItem[]): MaturityScore {
  return {
    dimension,
    score,
    level: scoreToLevel(score, evidenceItems.length),
    userExplanation: MATURITY_EXPLANATIONS[dimension],
    evidence: evidenceItems,
    bottleneck: evidenceItems.find((item) => item.gap)?.gap,
  };
}

function evidence(source: string, summary: string, strength: EvidenceItem["strength"], gap?: string): EvidenceItem {
  const userLabel = strength === "strong" ? "有支撑" : strength === "partial" ? "部分支撑" : "证据不足";
  const normalizedGap = gap ? customerFacingText(gap) : undefined;
  return {
    source,
    summary,
    strength,
    userLabel,
    confidence: strength === "strong" ? "high" : strength === "partial" ? "medium" : "low",
    ...(normalizedGap ? { gap: normalizedGap } : {}),
  };
}

function scoreEvidence(evidenceItems: EvidenceItem[]) {
  const rawScores = evidenceItems.map((item) => evidenceStrengthScore(item.strength));
  const average = Math.round(rawScores.reduce((sum, score) => sum + score, 0) / rawScores.length);
  const lowest = Math.min(...rawScores);
  return Math.min(average, lowest + 20);
}

function evidenceStrengthScore(strength: EvidenceItem["strength"]) {
  if (strength === "strong") return 85;
  if (strength === "partial") return 55;
  return 25;
}

function scoreToLevel(score: number, evidenceCount: number): MaturityLevel {
  let level: MaturityLevel;
  if (score >= 85) level = 5;
  else if (score >= 70) level = 4;
  else if (score >= 55) level = 3;
  else if (score >= 40) level = 2;
  else level = 1;
  if (evidenceCount < 2 && level >= 4) return 3;
  return level;
}

function buildOneLineDiagnosis(lowest: MaturityScore, highlights: MaturityDimension[]) {
  const level = maturityLevelLabel(lowest.level);
  const highlight = highlights.length ? `亮点在${highlights.map(customerDimensionLabel).join("、")}，` : "";
  const bottleneck = customerFacingText(lowest.bottleneck || lowest.evidence.find((item) => item.gap)?.gap || "补齐当前最低成熟度维度的关键证据。");
  return `这条回路目前处于${level}，${highlight}但受${customerDimensionLabel(lowest.dimension)}限制，建议先处理：${bottleneck}。`;
}

function hasMeaningfulText(value: string | undefined) {
  return Boolean(value && value.trim().length >= 6);
}

function hasEnhancedOrganization(plan: LoopPlan) {
  const organization = plan.organizationMap;
  return Boolean(
    organization.humanRoles?.length &&
    organization.agentRoles?.length &&
    organization.systemRoles?.length &&
    organization.interfaces?.length &&
    organization.assignmentChecklist?.length &&
    organization.launchReadiness,
  );
}

function ensureReassessmentReminder(roadmap: LoopPlan["roadmap"]) {
  return roadmap.map((week) => {
    if (week.week !== 4 || /重新评估|复评|成熟度/.test(week.checkpoint)) return week;
    return { ...week, checkpoint: `${week.checkpoint}；在设定周期结束时重新评估成熟度` };
  });
}
