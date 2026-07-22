import type { LoopPlan } from "./plan-schema";
import { getOrganizationRelations, hasEnhancedOrganization, organizationRelationKindLabel } from "./organization-export";
import { customerDimensionLabel, customerFacingText, evidenceSourceLabel, maturityLevelLabel, withMaturityMapping } from "./maturity";

export function planToMarkdown(plan: LoopPlan) {
  const enrichedPlan = withMaturityMapping(plan);
  const lines = [
    `# ${enrichedPlan.title}`,
    "",
    `> ${enrichedPlan.executiveSummary}`,
    "",
    "## 优先阅读",
    "",
    "这份方案先看三件事：这条回路能不能先跑、哪里最容易出问题、下一步该修什么。",
    "",
    `亮点：${formatHighlights(enrichedPlan)}`,
    `短板：${customerFacingText(enrichedPlan.maturityMapping?.bottlenecks[0] || "目标、分工或验收标准还需要校准")}`,
    `推荐优先行动：${customerFacingText(enrichedPlan.maturityMapping?.recommendedAction.action || enrichedPlan.scenarioDiagnosis?.priorityActions?.[0]?.action || "先确认业务目标、关键步骤和异常接管人是否准确。")}`,
    "",
    "### 下一步任务",
    "",
    ...buildPriorityReadTasks(enrichedPlan).map((item) => `- ${item}`),
    "",
    "### 需要确认的问题",
    "",
    ...(enrichedPlan.validationQuestions.length ? enrichedPlan.validationQuestions.slice(0, 3).map((item) => `- ${item}`) : ["- 暂无额外问题，先按推荐优先行动小范围试运行。"]),
    "",
    "## 诊断执行摘要",
    "",
    customerFacingText(enrichedPlan.maturityMapping?.oneLineDiagnosis || "当前方案已生成运行诊断。"),
    "",
    `推荐优先行动：${customerFacingText(enrichedPlan.maturityMapping?.recommendedAction.action || "在设定周期结束时重新评估成熟度")}`,
    "",
    "## 回路总览",
    "",
    `- 回路类型：${enrichedPlan.loopType}`,
    `- 起点：${enrichedPlan.valueFlow.start}`,
    `- 终点：${enrichedPlan.valueFlow.end}`,
    `- 目标闭环速度：${enrichedPlan.valueFlow.targetCycleTime}`,
    "",
    "## 阅读方式",
    "",
    "这份报告先看哪些工作适合 AI 接管，再看人、AI、系统如何协作。",
    "",
    "- AI可以接管的工作：查看哪些步骤适合 AI 稳定帮忙，哪些还需要人接管。",
    "- 人机协作拓扑图：按人、AI、系统查看信息流向、决策责任、治理边界和系统事实源。",
    "",
  ];
  appendProcessTransformation(lines, enrichedPlan);
  appendDesignBrief(lines, enrichedPlan);
  appendMaturityDiagnosis(lines, enrichedPlan);
  lines.push("## 需要人确认的节点", "");
  enrichedPlan.hitlNodes.forEach((node) => lines.push(`- **${node.node}**：${node.owner}；权限：${node.authority}；触发：${node.trigger}；工具：${node.tool}`));
  lines.push(
    "",
    "## 人机协作拓扑图",
    "",
    "按人、AI、系统查看信息、决策和治理分工。网页和 PDF 会渲染拓扑图；Markdown 和飞书文档用下方摘要与矩阵承接。",
    "",
    "### 当前冲突",
    "",
    ...enrichedPlan.organizationMap.conflicts.map((x) => `- ${x}`),
  );
  lines.push("", "### 建议调整", "", ...enrichedPlan.organizationMap.roleChanges.map((x) => `- ${x}`));
  enrichedPlan.organizationMap.reportingChanges.forEach((x) => lines.push(`- ${x}`));
  lines.push("", `共享数据层：${enrichedPlan.organizationMap.sharedDataLayer}`);
  appendEnhancedOrganization(lines, enrichedPlan);
  lines.push("", "## 运行规则", "");
  enrichedPlan.governance.kpis.forEach((kpi) => lines.push(`- **${customerFacingText(kpi.name)}**：当前 ${customerFacingText(kpi.current)}；目标 ${customerFacingText(kpi.target)}；检查频率 ${customerFacingText(kpi.cadence)}`));
  lines.push("", "### 决策规则与回路衔接", "", ...enrichedPlan.governance.arbitrationRules.map((x) => `- ${customerFacingText(x)}`), ...enrichedPlan.governance.interlocks.map((x) => `- ${customerFacingText(x)}`));
  lines.push("", `运行和退出规则：${customerFacingText(enrichedPlan.governance.lifecycleRule)}`, "", "## 周期行动路线", "");
  enrichedPlan.roadmap.forEach((week) => {
    lines.push(`### Phase ${week.week}：${week.theme}`, "", ...week.actions.map((x) => `- ${x}`), `- 里程碑：${week.milestone}`, `- 检查点：${week.checkpoint}`, "");
  });
  lines.push("## 风险与验证", "", ...enrichedPlan.risks.map((x) => `- 风险：${x}`), ...enrichedPlan.validationQuestions.map((x) => `- 待验证：${x}`));
  return lines.join("\n");
}

function appendProcessTransformation(lines: string[], plan: LoopPlan) {
  const transformation = plan.processTransformation;
  if (!transformation) return;
  const metrics = transformation.beforeAfter;
  lines.push(
    "## 旧流程 vs 新回路",
    "",
    `- 旧流程节点数 -> 新回路节点数：${metrics.nodeCountBefore} -> ${metrics.nodeCountAfter}`,
    `- 人工执行节点数 -> 人工边界节点数：${metrics.humanExecutionNodesBefore} -> ${metrics.humanExecutionNodesAfter}`,
    `- 等待点数量：${metrics.waitingPointsBefore} -> ${metrics.waitingPointsAfter}`,
    `- 审批轮次：${metrics.approvalRoundsBefore} -> ${metrics.approvalRoundsAfter}`,
    `- AI 可接手节点数：${metrics.aiTakeoverNodesAfter}`,
    `- 验证信号数量：${metrics.validationSignalsBefore} -> ${metrics.validationSignalsAfter}`,
    `- 记忆资产数量：${metrics.memoryAssetsBefore} -> ${metrics.memoryAssetsAfter}`,
    `- 周期估算置信度：${metrics.confidence}`,
    "",
    "### 三类断点扫描",
    "",
  );
  transformation.breakpoints.forEach((breakpoint) => {
    if (breakpoint.userConfirmed === false) return;
    lines.push(
      `- **${breakpointTypeLabel(breakpoint.type)} / ${breakpoint.severity}**：${breakpoint.diagnosis}`,
      `  - 证据：${breakpoint.evidence}`,
      `  - 干预：${breakpoint.suggestedIntervention}`,
    );
  });
  lines.push("", "### 重构动作", "");
  transformation.moves.forEach((move) => {
    lines.push(
      `- **${move.title}**`,
      `  - 动作：${moveTypeLabel(move.type)}`,
      `  - 理由：${move.rationale}`,
      `  - 预期效果：${move.expectedEffect}`,
      ...(move.humanChange ? [`  - 人的变化：${move.humanChange}`] : []),
    );
  });
  lines.push("", "### 运行记录建议与发布条件", "", "- 先发布试运行版，逐轮记录目标、指标、异常、验证结论和下一轮改动。", "- 当目标、接口、护栏、验证信号和记忆沉淀稳定后，再发布正式运行版。", "");
}

function breakpointTypeLabel(type: NonNullable<LoopPlan["processTransformation"]>["breakpoints"][number]["type"]) {
  return ({
    information_collapse: "信息塌缩",
    waiting_black_hole: "等待黑洞",
    validation_vacuum: "验证真空",
  })[type];
}

function moveTypeLabel(type: NonNullable<LoopPlan["processTransformation"]>["moves"][number]["type"]) {
  return ({
    remove: "删掉",
    merge: "合并",
    agent_takeover: "AI 接手",
    human_boundary: "人退到边界",
    add_validation: "增加验证",
    add_memory: "增加记忆",
    add_interface_protocol: "增加接口协议",
  })[type];
}

function buildPriorityReadTasks(plan: LoopPlan) {
  const tasks = [
    plan.businessGoalAnchor?.goal ? `确认业务目标是否准确：${plan.businessGoalAnchor.goal}` : "确认业务目标是否准确。",
    "查看“AI可以接管的工作”，确认哪些步骤适合 AI 稳定帮忙、哪些必须由人接管。",
    customerFacingText(plan.maturityMapping?.recommendedAction.action || plan.scenarioDiagnosis?.priorityActions?.[0]?.action || plan.roadmap[0]?.actions[0]),
  ].filter((item): item is string => Boolean(item));
  return Array.from(new Set(tasks)).slice(0, 3);
}

function appendDesignBrief(lines: string[], plan: LoopPlan) {
  if (plan.businessGoalAnchor) {
    const goal = plan.businessGoalAnchor;
    lines.push(
      "## 业务目标锚点",
      "",
      `- 意图：${goal.intent}`,
      `- 目标：${goal.goal}`,
      `- 输出：${goal.output}`,
      `- 成功标志：${goal.successSignal}`,
      `- 周期：${goal.cycle}`,
      `- 不可牺牲约束（不能为了效率牺牲的底线）：${goal.constraints}`,
      "",
    );
  }

  if (plan.scenarioDiagnosis) {
    const diagnosis = plan.scenarioDiagnosis;
    lines.push("## AI可以接管的工作", "", diagnosis.summary, "");
    if (diagnosis.cellDiagnostics?.length) {
      lines.push("### 可代理性热力图", "");
      diagnosis.cellDiagnostics.forEach((item) => {
        lines.push(
          `- **${item.cellLabel}｜${item.recommendedMode}**：${item.heatLabel}`,
          `  - 动作：${item.action}`,
          `  - 当前 AI 能做：${item.currentAiCapability}`,
          `  - 还不能接管：${item.blockers.length ? item.blockers.join("；") : "主要条件已具备"}`,
          `  - 人必须保留：${item.humanBoundary}`,
          `  - 下一步补齐：${item.nextFill.join("、")}`,
        );
      });
      lines.push("");
    }
    if (diagnosis.priorityActions?.length) {
      lines.push("### 优先改造顺序", "");
      diagnosis.priorityActions.forEach((item, index) => {
        lines.push(`- **P${index} / ${item.cellLabel} / ${item.recommendedMode}**：${item.action}；原因：${item.reason}`);
      });
      lines.push("");
    }
    lines.push("### AI 介入机会与治理规则", "");
    diagnosis.collaborationOpportunities.forEach((item) => {
      lines.push(`- **${item.type}**：${item.currentLoad}；AI 介入：${item.aiSupport}；人的边界：${item.humanBoundary}；治理规则：${item.governanceRule}`);
    });
    lines.push("");
  }
}

function appendMaturityDiagnosis(lines: string[], plan: LoopPlan) {
  const mapping = plan.maturityMapping;
  if (!mapping) return;
  const actionRoute = [mapping.recommendedAction, ...mapping.upgradeSuggestions].filter((item, index, array) =>
    array.findIndex((candidate) => candidate.dimension === item.dimension && candidate.action === item.action) === index,
  ).slice(0, 4);
  lines.push(
    "## 对齐与成熟度诊断",
    "",
    "### 诊断摘要",
    "",
    `- 这条回路能跑吗：${runReadiness(mapping.overallLevel)}`,
    `- 一句话诊断：${customerFacingText(mapping.oneLineDiagnosis)}`,
    `- 亮点：${formatHighlights(plan)}`,
    `- 最容易出问题：${mapping.bottlenecks.map(customerFacingText).join("；") || "短板还不够具体，需要补充运行证据。"}`,
    `- 下一步先修：${customerFacingText(mapping.recommendedAction.action)}`,
    "",
    "### 三重对齐",
    "",
  );
  mapping.alignment.forEach((item) => {
    lines.push(
      `- **${customerDimensionLabel(item.dimension)}**：${maturityLevelLabel(item.level)}；${item.userExplanation}`,
      ...item.evidence.map((entry) => `  - ${entry.userLabel}：${entry.summary}${entry.gap ? `；缺口：${customerFacingText(entry.gap)}` : ""}（来源：${evidenceSourceLabel(entry.source)}）`),
    );
  });
  lines.push("", "### 五个诊断维度", "");
  mapping.maturity.forEach((item) => {
    lines.push(
      `- **${customerDimensionLabel(item.dimension)}**：${maturityLevelLabel(item.level)}；${item.userExplanation}`,
      ...item.evidence.map((entry) => `  - ${entry.userLabel}：${entry.summary}${entry.gap ? `；缺口：${customerFacingText(entry.gap)}` : ""}（来源：${evidenceSourceLabel(entry.source)}）`),
    );
  });
  lines.push("", "### 具体行动路线", "");
  actionRoute.forEach((item, index) => {
    lines.push(`- **第 ${index + 1} 步 / ${customerDimensionLabel(item.dimension)}**：${customerFacingText(item.action)}；预期效果：${customerFacingText(item.expectedEffect)}${item.riskIfIgnored ? `；不改的风险：${customerFacingText(item.riskIfIgnored)}` : ""}`);
  });
  lines.push("");
}

function formatHighlights(plan: LoopPlan) {
  const dimensions = plan.maturityMapping?.highlightDimensions ?? [];
  return dimensions.length ? dimensions.map(customerDimensionLabel).join("、") : "先跑通一条真实业务链路";
}

function runReadiness(level: number) {
  if (level >= 4) return "可以进入受控运行";
  if (level >= 3) return "可以先小范围试跑";
  if (level >= 2) return "先补关键条件再试跑";
  return "暂不建议直接运行";
}

function appendEnhancedOrganization(lines: string[], plan: LoopPlan) {
  const organization = plan.organizationMap;
  if (!hasEnhancedOrganization(organization)) {
    lines.push("", "> 当前为旧版协作映射，可通过“定向优化组织映射”升级为角色、智能体、系统与协作接口映射。");
    return;
  }
  const roleNames = new Map([
    ...(organization.humanRoles ?? []).map((role) => [role.id, role.name] as const),
    ...(organization.agentRoles ?? []).map((role) => [role.id, role.name] as const),
    ...(organization.systemRoles ?? []).map((role) => [role.id, role.name] as const),
  ]);
  const name = (id: string) => roleNames.get(id) ?? id;
  const interfaceFlows = (organization.interfaces ?? []).map((item) => `${name(item.sourceId)} → ${name(item.targetId)}`);
  const relations = getOrganizationRelations(organization);
  const relationKinds = ["interface", "supervision", "service", "system"] as const;

  lines.push(
    "",
    "### 图解摘要",
    "",
    `- 人类角色：${summarizeList((organization.humanRoles ?? []).map((role) => role.name))}`,
    `- AI / 智能体角色：${summarizeList((organization.agentRoles ?? []).map((role) => role.name))}`,
    `- 系统角色：${summarizeList((organization.systemRoles ?? []).map((role) => role.name))}`,
    `- 关键接口：${summarizeList(interfaceFlows)}`,
    `- 关系属性：${relationKinds.map((kind) => `${organizationRelationKindLabel(kind)} ${relations.filter((item) => item.kind === kind).length}`).join("、")}`,
  );

  lines.push("", "### 关系属性矩阵", "", "| 属性 | 来源 → 目标 | 标签 | 说明 |", "|---|---|---|---|");
  relations.forEach((item) => lines.push(
    `| ${organizationRelationKindLabel(item.kind)} | ${cell(`${name(item.sourceId)} → ${name(item.targetId)}`)} | ${cell(item.label)} | ${cell(item.detail)} |`,
  ));

  lines.push("", "### 人类角色", "", "| 角色 | 状态 | 使命 | 决策权 | 输入 → 输出 | SLA / 异常接管 |", "|---|---|---|---|---|---|");
  (organization.humanRoles ?? []).forEach((role) => lines.push(
    `| ${cell(role.name)} | ${cell(role.status)} | ${cell(role.mission)} | ${cell(role.decisionRights.join("；"))} | ${cell(`${role.inputs.join("、")} → ${role.outputs.join("、")}`)} | ${cell(`${role.serviceLevel}；${role.exceptionOwnership}`)} |`,
  ));

  lines.push("", "### 智能体角色", "", "| 角色 | 自主等级 | 服务对象 | 可执行任务 | 请示 / 监督 | 失败降级 |", "|---|---|---|---|---|---|");
  (organization.agentRoles ?? []).forEach((role) => lines.push(
    `| ${cell(role.name)} | ${cell(role.autonomyLevel)} | ${cell(role.serves.map(name).join("、"))} | ${cell(role.tasks.join("；"))} | ${cell(`${role.hitlTriggers.join("；")} / ${name(role.supervisorRoleId)}`)} | ${cell(role.fallback)} |`,
  ));

  lines.push("", "### 系统角色", "", "| 角色 | 业务对象 | 事实记录 | 唯一事实源 | 集成与权限 | 人工替代 |", "|---|---|---|---|---|---|");
  (organization.systemRoles ?? []).forEach((role) => lines.push(
    `| ${cell(role.name)} | ${cell(role.businessObjects.join("、"))} | ${cell(role.records.join("、"))} | ${role.sourceOfTruth ? "是" : "否"} | ${cell(`${role.integrationMode}；${role.accessControl}`)} | ${cell(role.manualFallback)} |`,
  ));

  lines.push("", "### 业务与系统接口契约", "", "| 接口 | 来源 → 目标 | 类型 / 风险 | 交接对象 | SLA / 验收 | 技术契约 | 异常处理 |", "|---|---|---|---|---|---|---|");
  (organization.interfaces ?? []).forEach((item) => lines.push(
    `| ${cell(item.name)} | ${cell(`${name(item.sourceId)} → ${name(item.targetId)}`)} | ${cell(`${item.interfaceType} / ${item.riskLevel}`)} | ${cell(item.handoffObject)} | ${cell(`${item.serviceLevel}；${item.acceptanceCriteria.join("；")}`)} | ${cell(`${item.protocol}；${item.dataObject}；字段：${item.minimumFields.join("、")}；权限：${item.authorization}`)} | ${cell(`${item.retryRule}；${item.timeoutEscalation}；兜底：${item.humanFallback}`)} |`,
  ));

  lines.push("", "### 待指派清单", "", "| 角色 | 人数 | 权限 | 准备条件 | 截止 | 状态 |", "|---|---|---|---|---|---|");
  (organization.assignmentChecklist ?? []).forEach((item) => lines.push(
    `| ${cell(name(item.roleId))} | ${cell(item.suggestedCount)} | ${cell(item.requiredPermissions.join("、"))} | ${cell(item.readinessConditions.join("；"))} | ${cell(item.dueBy)} | ${item.status} |`,
  ));

  lines.push("", "### 启动检查", "");
  (organization.launchReadiness?.checklist ?? []).forEach((item) =>
    lines.push(`- **${item.category}**：${item.item}；责任角色：${name(item.ownerRoleId)}；证据：${item.evidence}；状态：${item.status}`),
  );
  lines.push("", "### 首周运行节奏", "");
  (organization.launchReadiness?.firstWeekCadence ?? []).forEach((item) =>
    lines.push(`- **${item.cadence}**：${item.activity}；责任角色：${name(item.ownerRoleId)}；产出：${item.output}；退出触发：${item.exitTrigger}`),
  );
}

function cell(value: string) {
  return value.replace(/\|/g, "｜").replace(/\n/g, " ");
}

function summarizeList(items: string[], limit = 6) {
  if (!items.length) return "待补充";
  const visible = items.slice(0, limit).join("、");
  return items.length > limit ? `${visible} 等 ${items.length} 项` : visible;
}
