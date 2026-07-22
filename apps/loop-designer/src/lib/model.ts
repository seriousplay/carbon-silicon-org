import "server-only";

import type { LoopPlan } from "./plan-schema";
import { parsePlan } from "./plan-parser";
import type { LoopDesignerSession } from "./session-types";
import type { BlueprintOutput, BlueprintStrategicInsights } from "./workflow";
import { safeLogError, sanitizeLog } from "./api-error";
import {
  buildScenarioDiagnosis,
  formatDesignBriefForPrompt,
  parseBusinessGoalAnchor,
  parseWorkflowInput,
} from "./design-brief";
import { buildProcessTransformation } from "./process-transformation-core";
import { formatIndustryLoopTemplateForPrompt } from "./industry-loop-templates";
import { formatMemoryContextForPrompt, type MemoryContextV1 } from "./memory-context-core";
import { withMaturityMapping } from "./maturity";
import {
  allowLocalModelFallback,
  getConfiguredModelCandidates,
  hasConfiguredModel,
  type ModelCandidate,
} from "./model-config";

const SYSTEM_PROMPT = `你是《碳硅组织》的业务回路设计器。你的任务不是写一份泛泛的 AI 咨询报告，而是把一条真实业务价值流改造成可运行、可治理、可验证的人机闭环。

规则：
1. 业务目标锚点优先级最高，所有方案都要回到意图、目标、输出、成功标志、周期和约束。
2. 以用户填写的回路单元为主线生成 To-Be 回路映射，不要把方案改写成方法论分阶段说明。
3. AI 角色来自可代理性诊断，但必须写成可执行职责：输入对象、处理动作、输出对象、不能越过的人类边界。
4. 人类角色必须是当前回路里的具体责任角色，例如销售负责人、产品负责人、交付负责人、品牌负责人、业务负责人；不要使用“回路主理人”这类抽象泛称。
5. 接口契约必须写清上游输入、下游输出、验收标准、责任边界和留痕方式；未知权限、API、字段或系统能力写“待技术确认”。
6. 每个 To-Be 回路单元必须明确人类、智能体、系统三类 actor 的参与方式，并估算处理时间、等待/交接时间和预期返工时间。
7. 每个 To-Be 回路单元必须输出 controlProfile：说明谁是主 actor、Agent 接管等级、人退到哪类边界、什么条件下自动推进、什么条件下进入 HITL。
8. 低风险、规则清楚、输入输出明确的 Cell 优先生成 agent_led_hitl 或 agent_autonomous；高风险承诺、价值取舍、异常裁决类 Cell 保持 human_led 或 agent_copilot。
9. 没有真实运行日志时，时间估算必须标记为 low confidence，不得声称来自系统日志、监控或真实数据。
10. 组织映射一律使用“角色”，不能输出姓名、岗位、职级或部门职位；可提出建议角色，但必须标记为“建议角色”或“待确认”。
11. HITL 必须写清触发条件、责任人、权限和工具；所有智能体必须有监督角色、失败降级和停用条件。
12. KPI 必须同时包含速度、质量、风险或学习信号；行动路线使用用户设定周期，不要固定写 60 天。
13. 模型只输出回路方案本体，不输出成熟度、评分或证据链，这些由本地算法计算。
14. organizationMap 中所有 sourceId、targetId、responsibleRoleId、acceptanceRoleId、ownerRoleId 和 supervisorRoleId 必须引用 humanRoles、agentRoles、systemRoles 中已经定义的 id；不要使用 Cell01、C01、客户、流程步骤名或自然语言。
15. 如果输入包含 processTransformation，必须先基于旧流程识别信息塌缩、等待黑洞、验证真空，再生成 To-Be；每个 To-Be 单元必须能追溯到旧节点或重构动作。
16. 结果必须保留 processTransformation，用于首屏 Before/After 展示；没有真实运行数据时，周期变化 confidence 必须为 low。
17. 不要把“流程更短”本身当成成功；必须说明验证信号和记忆资产如何增加。
18. 只输出 JSON，不要 Markdown，不要代码围栏。`;

const OUTPUT_SHAPE = `{
  "title": "string",
  "executiveSummary": "string",
  "loopType": "string",
  "processTransformation": {
    "generatedAt": "string",
    "legacyNodes": [],
    "breakpoints": [],
    "moves": [],
    "beforeAfter": {},
    "conceptBridge": []
  },
  "valueFlow": {"start": "string", "end": "string", "targetCycleTime": "string"},
  "toBeLoopCells": [{
    "cellId": "string",
    "cellLabel": "string",
    "action": "string",
    "currentGap": "string",
    "recommendedMode": "结构化入口|知识增强执行|异步共创审议|工具链编排|前置透明决策|模板化自动发布",
    "actorAssignments": [
      {"type": "human", "roleId": "human_loop_owner", "name": "string", "responsibility": "string"},
      {"type": "agent", "roleId": "agent_x", "name": "string", "responsibility": "string"},
      {"type": "system", "roleId": "system_x", "name": "string", "responsibility": "string"}
    ],
    "timeEstimate": {
      "processingMinutes": 0,
      "waitingMinutes": 0,
      "reworkMinutes": 0,
      "confidence": "high|medium|low",
      "bottleneckLevel": "low|medium|high",
      "bottleneckReason": "string"
    },
    "controlProfile": {
      "primaryActorType": "agent|human",
      "primaryActorRoleId": "actorAssignments 中的 roleId",
      "autonomyLevel": "human_led|agent_copilot|agent_led_hitl|agent_autonomous",
      "humanBoundary": "approval|exception|audit|decision|commitment",
      "agentExecutionRights": ["string"],
      "humanInterventionTriggers": ["string"],
      "canAutoProceedWhen": ["string"],
      "nextAutonomyUpgrade": "string"
    },
    "aiRole": "string",
    "humanRole": "string",
    "interfaceContract": "string",
    "governanceRule": "string",
    "memoryRecord": "string",
    "acceptanceSignal": "string",
    "nextValidation": "string"
  }],
  "hitlNodes": [{"node": "string", "owner": "string", "authority": "string", "trigger": "string", "tool": "string"}],
  "organizationMap": {
    "conflicts": ["string"],
    "roleChanges": ["string"],
    "reportingChanges": ["string"],
    "sharedDataLayer": "string",
    "humanRoles": [{
      "id": "human_responsible_actor",
      "name": "具体业务责任人，例如销售负责人/产品负责人/交付负责人/品牌负责人",
      "status": "已有角色|建议角色|待确认",
      "mission": "string",
      "responsibilityScope": ["string"],
      "responsibilities": ["string"],
      "exclusions": ["string"],
      "decisionRights": ["string"],
      "approvalRights": ["string"],
      "vetoRights": ["string"],
      "inputs": ["string"],
      "outputs": ["string"],
      "serviceLevel": "string",
      "availability": "string",
      "exceptionOwnership": "string",
      "escalationTo": "string",
      "suggestedCount": "string",
      "capabilities": ["string"]
    }],
    "agentRoles": [{
      "id": "agent_x",
      "name": "string",
      "status": "已有角色|建议角色|待确认",
      "mission": "string",
      "serves": ["human_loop_owner"],
      "responsibilityScope": ["string"],
      "tasks": ["string"],
      "autonomyLevel": "建议|受控执行|条件自治",
      "readableData": ["string"],
      "tools": ["string"],
      "outputs": ["string"],
      "qualityStandard": "string",
      "allowedActions": ["string"],
      "approvalRequiredActions": ["string"],
      "prohibitedActions": ["string"],
      "hitlTriggers": ["string"],
      "supervisorRoleId": "human_loop_owner",
      "fallback": "string",
      "shutdownCondition": "string",
      "cadence": "string",
      "contextSources": ["string"],
      "auditRequirements": ["string"]
    }],
    "systemRoles": [{
      "id": "system_x",
      "name": "string",
      "status": "已有角色|建议角色|待确认",
      "mission": "string",
      "responsibilityScope": ["string"],
      "businessObjects": ["string"],
      "records": ["string"],
      "capabilities": ["string"],
      "inputs": ["string"],
      "outputs": ["string"],
      "sourceOfTruth": true,
      "accessControl": "string",
      "integrationMode": "string或待技术确认",
      "constraints": ["string"],
      "manualFallback": "string"
    }],
    "interfaces": [{
      "id": "interface_x",
      "name": "string",
      "sourceId": "已定义节点id",
      "targetId": "已定义节点id",
      "riskLevel": "常规|HITL|高风险",
      "trigger": "string",
      "handoffObject": "string",
      "requiredInputs": ["string"],
      "expectedOutputs": ["string"],
      "responsibleRoleId": "已定义人类或智能体角色id",
      "acceptanceRoleId": "已定义人类角色id",
      "serviceLevel": "string",
      "acceptanceCriteria": ["string"],
      "failureModes": ["string"],
      "retryRule": "string",
      "timeoutEscalation": "string",
      "humanFallback": "string",
      "interfaceType": "人工交接|智能体调用|API|事件|批处理",
      "protocol": "string或待技术确认",
      "dataObject": "string",
      "minimumFields": ["string或待技术确认"],
      "authorization": "string或待技术确认",
      "idempotency": "string",
      "auditRecord": "string",
      "sourceOfTruth": "string"
    }],
    "assignmentChecklist": [{
      "roleId": "已定义角色id",
      "suggestedCount": "string",
      "requiredPermissions": ["string"],
      "readinessConditions": ["string"],
      "dueBy": "string",
      "status": "待指派|待确认|已就绪"
    }],
    "launchReadiness": {
      "checklist": [{
        "category": "角色到位|智能体配置|系统接通|数据可用|异常演练",
        "item": "string",
        "ownerRoleId": "已定义角色id",
        "evidence": "string",
        "status": "未开始|进行中|已就绪"
      }],
      "firstWeekCadence": [{
        "cadence": "string",
        "activity": "string",
        "ownerRoleId": "已定义角色id",
        "output": "string",
        "exitTrigger": "string"
      }]
    }
  },
  "governance": {
    "kpis": [{"name": "string", "current": "string", "target": "string", "cadence": "string"}],
    "arbitrationRules": ["string"],
    "interlocks": ["string"],
    "lifecycleRule": "string"
  },
  "roadmap": [{"week": 1, "theme": "string", "actions": ["string"], "milestone": "string", "checkpoint": "string"}],
  "assumptions": ["string"],
  "risks": ["string"],
  "validationQuestions": ["string"]
}`;

const BLUEPRINT_INSIGHT_SYSTEM_PROMPT = `你是《碳硅组织》的 AI 战略蓝图顾问。你需要基于用户已经填写的组织蓝图上下文，生成面向目标企业 AI 战略落地的全局洞察。

规则：
1. 必须紧扣用户输入的行业、主营业务、AI 焦虑、组织阶段、能力聚焦、关键战场、准备度和手动评分的火种回路。
2. 不要复述字段，不要写通用 AI 转型建议，不要虚构外部事实、行业数据或真实调研。
3. 可以做推理，但必须在 evidence 中说明推理来自哪些用户输入。
4. 建议必须能指导 30-90 天落地，优先服务第一战场和推荐火种回路。
5. 只输出 JSON，不要 Markdown，不要代码围栏。`;

const BLUEPRINT_INSIGHT_OUTPUT_SHAPE = `{
  "summary": "一句话概括这家企业当前 AI 战略落地的核心判断，40-80字",
  "strategicJudgment": "面向领导者的战略判断，说明这场仗为什么优先、组织能力要如何取舍，100-180字",
  "keyInsights": [
    {"title": "洞察标题", "detail": "洞察内容，60-120字", "evidence": "这条洞察来自哪些用户输入或评分"}
  ],
  "landingRecommendations": [
    {"title": "建议标题", "action": "具体动作，60-120字", "timeframe": "30天|60天|90天|4-6周", "owner": "业务负责人|运营负责人|产品负责人|交付负责人|待确认"}
  ],
  "riskAlerts": [
    {"risk": "风险标题", "whyItMatters": "为什么影响 AI 战略落地，40-100字", "mitigation": "如何降低风险，40-100字"}
  ]
}`;

export async function generatePlan(session: LoopDesignerSession, memoryContext?: MemoryContextV1): Promise<LoopPlan> {
  return (await generatePlanWithModel(session, memoryContext)).plan;
}

export async function generatePlanWithModel(
  session: LoopDesignerSession,
  memoryContext?: MemoryContextV1,
): Promise<{ plan: LoopPlan; modelLabel: string }> {
  if (!hasConfiguredModel()) {
    if (allowLocalModelFallback()) return { plan: buildFallbackPlan(session), modelLabel: "local-fallback" };
    throw new Error("模型服务未配置，无法生成真实 LLM 回路方案");
  }

  const templateContext = session.context.templateSnapshot
    ? `${formatIndustryLoopTemplateForPrompt(session.context.templateSnapshot)}\n\n`
    : "";
  const workflowContext = session.outputs.blueprint
    ? `闭门会蓝图上下文：\n${JSON.stringify(session.outputs.blueprint)}\n\n`
    : "";
  const organizationMemoryContext = memoryContext
    ? `${formatMemoryContextForPrompt(memoryContext)}\n\n`
    : "";
  const designBriefContext = `${formatDesignBriefForPrompt(session.responses)}\n\n`;
  const processTransformationContext = session.context.processTransformation
    ? `旧流程断点扫描与回路重构预览：\n${JSON.stringify(session.context.processTransformation, null, 2)}\n\n`
    : session.context.breakpointScan?.length || session.context.legacyFlow?.length
      ? `旧流程断点扫描上下文：\n${JSON.stringify({
          legacyNodes: session.context.legacyFlow ?? [],
          breakpoints: session.context.breakpointScan ?? [],
        }, null, 2)}\n\n`
      : "";
  const userPrompt = `根据以下企业输入生成回路方案：
${templateContext}
${workflowContext}
${organizationMemoryContext}
${designBriefContext}
${processTransformationContext}
回路类型：${session.context.loopType || "用户自定义"}
用户确认补充：${session.responses.diagnosis || "无"}

输出必须严格符合以下 JSON 形状。toBeLoopCells 必须逐一引用回路单元诊断，并为每个 cell 输出三类 actor、处理时间模拟和 controlProfile。actorAssignments、aiRole、humanRole、interfaceContract、governanceRule 必须引用该 cell 的真实动作、输入、输出、判断、系统、异常接管和记录字段，不能写“围绕某动作定义输入输出”这类占位模板。controlProfile 要把主 actor 从“参与者”中区分出来：agent 可主导执行，人更多作为审批、异常、审计、裁决或承诺边界。没有真实运行日志时，timeEstimate.confidence 必须为 low。launchReadiness.checklist 必须覆盖五类启动检查，roadmap 必须输出第 1 至 4 阶段共 4 项，最后一个 checkpoint 必须包含“重新评估成熟度”。行动路线周期必须使用用户设定周期：
${OUTPUT_SHAPE}`;
  const result = await requestValidatedPlan([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt },
  ]);
  return { plan: attachDesignBrief(result.plan, session), modelLabel: result.candidate.label };
}

export async function generateBlueprintStrategicInsightsWithModel(blueprint: BlueprintOutput): Promise<BlueprintStrategicInsights> {
  if (!hasConfiguredModel()) throw new Error("模型服务未配置，无法生成真实 LLM 蓝图洞察");
  const result = await requestBlueprintStrategicInsights(blueprint);
  return {
    ...result.insights,
    generatedAt: new Date().toISOString(),
    modelLabel: result.candidate.label,
  };
}

export async function refinePlan(
  session: LoopDesignerSession,
  focus: string,
  instruction: string,
): Promise<LoopPlan> {
  if (!session.outputs.currentPlan) throw new Error("No plan to refine");
  if (!hasConfiguredModel()) {
    if (!allowLocalModelFallback()) throw new Error("模型服务未配置，无法生成真实 LLM 优化方案");
    return withMaturityMapping({
      ...session.outputs.currentPlan,
      executiveSummary: `${session.outputs.currentPlan.executiveSummary} 本地演示模式已记录本轮优化要求：${instruction.slice(0, 80)}。`,
      risks: [...session.outputs.currentPlan.risks, "当前为本地演示方案，接入模型服务后可生成更贴近业务语境的新版本。"],
    });
  }

  const result = await requestValidatedPlan([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `这是当前方案：\n${JSON.stringify(session.outputs.currentPlan)}\n\n优化范围：${focus}\n用户要求：${instruction}\n保留未要求修改的部分，输出完整的新版本 JSON。`,
    },
  ]);
  return attachDesignBrief(result.plan, session);
}

async function requestValidatedPlan(messages: Array<{ role: string; content: string }>) {
  const candidates = getConfiguredModelCandidates();
  const failures: string[] = [];

  for (const candidate of candidates) {
    try {
      const first = await callChatCompletions(candidate, messages);
      const parsed = parsePlan(first, { repairOrganizationReferences: true });
      if (parsed.success) return { plan: parsed.data, candidate };

      const repair = await callChatCompletions(candidate, [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `下面的输出没有通过结构校验。请按目标形状修复为完整 JSON，保留原意，不要解释。
目标形状：
${OUTPUT_SHAPE}

错误：${parsed.error}
原输出：${first}`,
        },
      ]);
      const repaired = parsePlan(repair, { repairOrganizationReferences: true });
      if (repaired.success) return { plan: repaired.data, candidate };
      throw new Error(`模型输出结构无效：${repaired.error}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${candidate.label}(${candidate.model}): ${message}`);
      safeLogError("model-provider", error, { provider: candidate.id, model: candidate.model });
    }
  }

  throw new Error(`模型服务不可用：${failures.join("；") || "未找到可用模型"}`);
}

async function requestBlueprintStrategicInsights(blueprint: BlueprintOutput) {
  const candidates = getConfiguredModelCandidates();
  const failures: string[] = [];
  const userPrompt = buildBlueprintInsightPrompt(blueprint);

  for (const candidate of candidates) {
    try {
      const first = await callChatCompletions(candidate, [
        { role: "system", content: BLUEPRINT_INSIGHT_SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ]);
      const parsed = parseBlueprintStrategicInsightsResponse(first);
      if (parsed.success) return { insights: parsed.data, candidate };

      const repair = await callChatCompletions(candidate, [
        { role: "system", content: BLUEPRINT_INSIGHT_SYSTEM_PROMPT },
        {
          role: "user",
          content: `下面的输出没有通过结构校验。请修复为完整 JSON，保留原意，不要解释。
目标形状：
${BLUEPRINT_INSIGHT_OUTPUT_SHAPE}

错误：${parsed.error}
原输出：${first}`,
        },
      ]);
      const repaired = parseBlueprintStrategicInsightsResponse(repair);
      if (repaired.success) return { insights: repaired.data, candidate };
      throw new Error(`模型输出洞察结构无效：${repaired.error}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${candidate.label}(${candidate.model}): ${message}`);
      safeLogError("blueprint-insights-provider", error, { provider: candidate.id, model: candidate.model });
    }
  }

  throw new Error(`模型服务不可用：${failures.join("；") || "未找到可用模型"}`);
}

function buildBlueprintInsightPrompt(blueprint: BlueprintOutput) {
  const compactBlueprint = {
    questionnaire: {
      company: blueprint.questionnaire.company,
      role: blueprint.questionnaire.role,
      scale: blueprint.questionnaire.scale,
      industry: blueprint.questionnaire.industry,
      business: blueprint.questionnaire.business,
      aiConcern: blueprint.questionnaire.aiConcern,
      aiCurrentWork: blueprint.questionnaire.aiCurrentWork,
      aiScenarios: blueprint.questionnaire.aiScenarios,
      aiBlockers: blueprint.questionnaire.aiBlockers,
      expectations: blueprint.questionnaire.expectations,
    },
    diagnosis: blueprint.diagnosis,
    strategicContext: blueprint.strategicContext,
    battlefield: blueprint.battlefield,
    readiness: blueprint.readiness,
    strategicNarrative: blueprint.strategicNarrative,
    recommendedSeedLoop: blueprint.recommendedSeedLoop
      ? {
          title: blueprint.recommendedSeedLoop.title,
          valueDescription: blueprint.recommendedSeedLoop.valueDescription,
          successCriteria: blueprint.recommendedSeedLoop.successCriteria,
          seedLoopWeightedScore: blueprint.recommendedSeedLoop.seedLoopWeightedScore,
          seedLoopScores: blueprint.recommendedSeedLoop.seedLoopScores,
          seedLoopWeights: blueprint.recommendedSeedLoop.seedLoopWeights,
          seedLoopEvidence: blueprint.recommendedSeedLoop.seedLoopEvidence,
        }
      : null,
    candidates: blueprint.candidates.map((candidate) => ({
      title: candidate.title,
      score: candidate.seedLoopWeightedScore ?? candidate.roiScore ?? candidate.score,
      evidence: candidate.evidence,
      successCriteria: candidate.successCriteria,
    })),
    mondayChecklist: blueprint.mondayChecklist,
    teamBrief: blueprint.teamBrief,
  };
  return `请基于以下蓝图上下文，生成面向目标企业 AI 战略落地的全局洞察。

输出要求：
- summary 1 条。
- strategicJudgment 1 条。
- keyInsights 输出 3 条，每条必须写清 evidence。
- landingRecommendations 输出 3 条，覆盖 30 天、4-6周或 90 天节奏。
- riskAlerts 输出 2-3 条。
- 只输出 JSON，严格符合目标形状。

目标形状：
${BLUEPRINT_INSIGHT_OUTPUT_SHAPE}

蓝图上下文：
${JSON.stringify(compactBlueprint, null, 2)}`;
}

type BlueprintStrategicInsightsDraft = Omit<BlueprintStrategicInsights, "generatedAt" | "modelLabel">;

function parseBlueprintStrategicInsightsResponse(content: string): { success: true; data: BlueprintStrategicInsightsDraft } | { success: false; error: string } {
  try {
    const source = extractJsonObject(content);
    const data = JSON.parse(source) as unknown;
    const record = asModelRecord(data);
    const summary = cleanModelText(record.summary, 180);
    const strategicJudgment = cleanModelText(record.strategicJudgment, 360);
    const keyInsights = normalizeModelArray(record.keyInsights, (item) => {
      const entry = asModelRecord(item);
      return {
        title: cleanModelText(entry.title, 60),
        detail: cleanModelText(entry.detail, 220),
        evidence: cleanModelText(entry.evidence, 220),
      };
    }).filter((item) => item.title && item.detail && item.evidence).slice(0, 3);
    const landingRecommendations = normalizeModelArray(record.landingRecommendations, (item) => {
      const entry = asModelRecord(item);
      return {
        title: cleanModelText(entry.title, 60),
        action: cleanModelText(entry.action, 240),
        timeframe: cleanModelText(entry.timeframe, 40),
        owner: cleanModelText(entry.owner, 60),
      };
    }).filter((item) => item.title && item.action && item.timeframe && item.owner).slice(0, 3);
    const riskAlerts = normalizeModelArray(record.riskAlerts, (item) => {
      const entry = asModelRecord(item);
      return {
        risk: cleanModelText(entry.risk, 70),
        whyItMatters: cleanModelText(entry.whyItMatters, 180),
        mitigation: cleanModelText(entry.mitigation, 180),
      };
    }).filter((item) => item.risk && item.whyItMatters && item.mitigation).slice(0, 3);

    if (!summary) return { success: false, error: "summary 缺失" };
    if (!strategicJudgment) return { success: false, error: "strategicJudgment 缺失" };
    if (keyInsights.length < 2) return { success: false, error: "keyInsights 至少需要 2 条完整洞察" };
    if (landingRecommendations.length < 2) return { success: false, error: "landingRecommendations 至少需要 2 条完整建议" };
    if (riskAlerts.length < 1) return { success: false, error: "riskAlerts 至少需要 1 条完整风险提醒" };
    return { success: true, data: { summary, strategicJudgment, keyInsights, landingRecommendations, riskAlerts } };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "JSON 解析失败" };
  }
}

function extractJsonObject(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? content;
  const start = fenced.indexOf("{");
  const end = fenced.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("模型输出不是 JSON 对象");
  return fenced.slice(start, end + 1);
}

function normalizeModelArray<T>(value: unknown, mapper: (item: unknown) => T) {
  return Array.isArray(value) ? value.map(mapper) : [];
}

function asModelRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("模型输出结构不是对象");
  return value as Record<string, unknown>;
}

function cleanModelText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

async function callChatCompletions(candidate: ModelCandidate, messages: Array<{ role: string; content: string }>) {
  const usesResponsesApi = candidate.endpoint.endsWith("/responses");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), candidate.timeoutMs);
  try {
    const body: Record<string, unknown> = usesResponsesApi
      ? { model: candidate.model, input: messages, temperature: 0.25 }
      : { model: candidate.model, messages, temperature: 0.25 };
    if (candidate.reasoningEffort) body.reasoning_effort = candidate.reasoningEffort;
    if (candidate.thinking) body.thinking = { type: "enabled" };

    const response = await fetch(candidate.endpoint, {
      method: "POST",
      headers: {
        authorization: `Bearer ${candidate.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawPayload = await response.text();
    let payload: {
      error?: { message?: string };
      output_text?: string;
      output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
      choices?: Array<{ message?: { content?: string } }>;
    };
    try {
      payload = JSON.parse(rawPayload) as typeof payload;
    } catch {
      const detail = rawPayload.trim().slice(0, 160);
      throw new Error(`模型服务返回非 JSON 响应 (${response.status})${detail ? `：${detail}` : ""}`);
    }
    if (!response.ok) {
      const detail = payload.error?.message ? `：${payload.error.message}` : "";
      safeLogError("model-call", new Error(`模型服务返回 ${response.status}${detail}`));
      throw new Error(`模型服务返回错误 (${response.status})${detail}`);
    }
    const content = usesResponsesApi
      ? payload.output_text ||
        payload.output
          ?.flatMap((item) => item.content || [])
          .filter((item) => item.type === "output_text")
          .map((item) => item.text)
          .filter(Boolean)
          .join("")
      : payload.choices?.[0]?.message?.content;
    if (!content) throw new Error("模型服务没有返回内容");
    return content;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw new Error("模型生成超时，请重试");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function probeConfiguredModels(timeoutMs = Number(process.env.MODEL_PROBE_TIMEOUT_MS || 10000)) {
  const candidates = getConfiguredModelCandidates();
  return Promise.all(candidates.map(async (candidate) => {
    const startedAt = Date.now();
    try {
      const content = await callChatCompletions({ ...candidate, timeoutMs: Math.min(candidate.timeoutMs, timeoutMs) }, [
        { role: "system", content: "只回复 OK。" },
        { role: "user", content: "模型连通性检查。只回复 OK。" },
      ]);
      return {
        provider: candidate.id,
        label: candidate.label,
        model: candidate.model,
        status: "ok" as const,
        latencyMs: Date.now() - startedAt,
        sample: content.slice(0, 32),
      };
    } catch (error) {
      return {
        provider: candidate.id,
        label: candidate.label,
        model: candidate.model,
        status: "down" as const,
        latencyMs: Date.now() - startedAt,
        error: sanitizeLog(error instanceof Error ? error.message : String(error)),
      };
    }
  }));
}

type FallbackActorCell = Pick<LoopPlan["toBeLoopCells"][number], "action" | "recommendedMode" | "aiRole" | "humanRole"> | {
  action: string;
  recommendedMode: LoopPlan["toBeLoopCells"][number]["recommendedMode"];
  currentAiCapability: string;
  humanBoundary: string;
};

type FallbackTimeCell = {
  recommendedMode: LoopPlan["toBeLoopCells"][number]["recommendedMode"];
  heat?: "green" | "yellow" | "red";
  blockers: string[];
  nextFill?: string[];
};

type FallbackControlCell = {
  action: string;
  recommendedMode: LoopPlan["toBeLoopCells"][number]["recommendedMode"];
  heat?: "green" | "yellow" | "red";
  blockers: string[];
  nextFill?: string[];
};

type FallbackDesignDetailCell = FallbackControlCell & {
  currentAiCapability?: string;
  humanBoundary?: string;
};

function fallbackActorAssignments(cell: FallbackActorCell): LoopPlan["toBeLoopCells"][number]["actorAssignments"] {
  const aiRole = "aiRole" in cell ? cell.aiRole : cell.currentAiCapability;
  const humanRole = "humanRole" in cell ? cell.humanRole : cell.humanBoundary;
  return [
    {
      type: "human",
      roleId: "human_loop_owner",
      name: humanActorNameForFallback(cell, humanRole),
      responsibility: humanRole,
    },
    {
      type: "agent",
      roleId: "agent_requirement_interpreter",
      name: agentNameForMode(cell.recommendedMode),
      responsibility: aiRole,
    },
    {
      type: "system",
      roleId: "system_fact_record",
      name: "事实记录系统",
      responsibility: `记录“${cell.action}”的输入、输出、验收、异常和复盘结果。`,
    },
  ];
}

function humanActorNameForFallback(cell: FallbackActorCell, humanRole: string) {
  const source = `${cell.action} ${humanRole}`;
  if (/销售|客户承诺|客户跟进/.test(source)) return "销售负责人";
  if (/品牌|视频|发布|对外口径/.test(source)) return "品牌负责人";
  if (/产品|范围|能力|需求判断/.test(source)) return "产品负责人";
  if (/交付|验收|实施|排期/.test(source)) return "交付负责人";
  if (/客户成功|续约|反馈/.test(source)) return "客户成功负责人";
  return "业务负责人";
}

function agentNameForMode(mode: LoopPlan["toBeLoopCells"][number]["recommendedMode"]) {
  return ({
    结构化入口: "入口结构化智能体",
    知识增强执行: "知识执行智能体",
    异步共创审议: "审议归并智能体",
    工具链编排: "工具编排智能体",
    前置透明决策: "决策摘要智能体",
    模板化自动发布: "发布检查智能体",
  })[mode];
}

function fallbackTimeEstimate(cell: FallbackTimeCell): LoopPlan["toBeLoopCells"][number]["timeEstimate"] {
  const processingMinutes = ({
    结构化入口: 20,
    知识增强执行: 45,
    异步共创审议: 60,
    工具链编排: 35,
    前置透明决策: 90,
    模板化自动发布: 15,
  })[cell.recommendedMode];
  const waitingMinutes = cell.heat === "red" ? 240 : cell.heat === "green" ? 20 : 90;
  const exceptionPenalty = cell.blockers.some((item) => item.includes("异常") || item.includes("接管")) ? 60 : 0;
  const reworkMinutes = cell.heat === "red" ? 120 : cell.heat === "green" ? 10 : 45;
  const totalDelay = waitingMinutes + exceptionPenalty + reworkMinutes;
  const bottleneckLevel = cell.heat === "red" || totalDelay >= 240 ? "high" : totalDelay >= 90 ? "medium" : "low";
  const blocker = cell.blockers[0] || (cell.nextFill?.length ? `需要补齐：${cell.nextFill.join("、")}` : "缺少真实运行日志，需通过试运行校准。");
  return {
    processingMinutes,
    waitingMinutes: waitingMinutes + exceptionPenalty,
    reworkMinutes,
    confidence: "low",
    bottleneckLevel,
    bottleneckReason: `基于回路单元描述的低置信估算：${blocker}`,
  };
}

function fallbackControlProfile(cell: FallbackControlCell): LoopPlan["toBeLoopCells"][number]["controlProfile"] {
  const source = `${cell.action} ${cell.blockers.join(" ")}`;
  const highJudgmentRisk = /承诺|审批|批准|裁决|终审|价值|取舍|高风险|异常/.test(source)
    || cell.recommendedMode === "前置透明决策";
  const lacksExecutionBasis = cell.heat === "red" || cell.blockers.some((item) => /权限|上下文|验收|输出|接管/.test(item));
  const agentNativeMode = ["结构化入口", "工具链编排", "模板化自动发布"].includes(cell.recommendedMode);
  const primaryActorType = highJudgmentRisk ? "human" : "agent";
  const autonomyLevel: LoopPlan["toBeLoopCells"][number]["controlProfile"]["autonomyLevel"] = highJudgmentRisk
    ? "agent_copilot"
    : cell.recommendedMode === "模板化自动发布" && !lacksExecutionBasis
      ? "agent_autonomous"
      : agentNativeMode || cell.heat === "green"
        ? "agent_led_hitl"
        : "agent_copilot";
  const humanBoundary = boundaryForFallbackControl(cell.recommendedMode, source, autonomyLevel);
  return {
    primaryActorType,
    primaryActorRoleId: primaryActorType === "agent" ? "agent_requirement_interpreter" : "human_loop_owner",
    autonomyLevel,
    humanBoundary,
    agentExecutionRights: agentExecutionRightsForMode(cell.recommendedMode),
    humanInterventionTriggers: humanTriggersForBoundary(humanBoundary, cell.blockers),
    canAutoProceedWhen: canAutoProceedWhenForMode(cell.recommendedMode, cell.nextFill ?? []),
    nextAutonomyUpgrade: nextAutonomyUpgradeForMode(cell.recommendedMode, autonomyLevel, cell.nextFill ?? []),
  };
}

function boundaryForFallbackControl(
  mode: LoopPlan["toBeLoopCells"][number]["recommendedMode"],
  source: string,
  autonomyLevel: LoopPlan["toBeLoopCells"][number]["controlProfile"]["autonomyLevel"],
): LoopPlan["toBeLoopCells"][number]["controlProfile"]["humanBoundary"] {
  if (autonomyLevel === "agent_autonomous") return "audit";
  if (/承诺|对外|客户/.test(source)) return "commitment";
  if (/审批|批准|审定|审核/.test(source)) return "approval";
  if (/裁决|判断|决策|取舍|风险/.test(source) || mode === "前置透明决策") return "decision";
  return "exception";
}

function agentExecutionRightsForMode(mode: LoopPlan["toBeLoopCells"][number]["recommendedMode"]) {
  const map: Record<LoopPlan["toBeLoopCells"][number]["recommendedMode"], string[]> = {
    结构化入口: ["提取原始输入字段", "生成标准 brief 草稿", "提示缺项问题", "写入待确认记录"],
    知识增强执行: ["检索知识卡片和历史案例", "生成初稿或判断依据", "标注引用来源", "提交给人类验收"],
    异步共创审议: ["归并意见", "标记冲突和未决问题", "维护版本脉络", "生成审议摘要"],
    工具链编排: ["生成操作清单", "检查字段完整性", "提示半自动执行步骤", "在权限确认后触发受控工具动作"],
    前置透明决策: ["汇总方向、争议和风险", "生成待裁决选项", "提示关键决策人提前介入"],
    模板化自动发布: ["按模板生成发布内容", "执行缺项检查", "准备同步记录", "低风险通知可自动排队"],
  };
  return map[mode];
}

function humanTriggersForBoundary(
  boundary: LoopPlan["toBeLoopCells"][number]["controlProfile"]["humanBoundary"],
  blockers: string[],
) {
  const base = {
    approval: "涉及审批、对外承诺或规则例外时必须请示",
    exception: "出现异常、超时、字段冲突或连续失败时必须接管",
    audit: "进入批量自动执行前后必须抽检审计记录",
    decision: "涉及价值取舍、优先级改变或高风险判断时必须裁决",
    commitment: "需要代表组织对客户或下游作出承诺时必须确认",
  }[boundary];
  return [base, ...(blockers.length ? blockers.slice(0, 2) : ["置信度不足或缺少验收证据时必须请人确认或接管"])];
}

function canAutoProceedWhenForMode(mode: LoopPlan["toBeLoopCells"][number]["recommendedMode"], nextFill: string[]) {
  const modeCondition = {
    结构化入口: "brief 必填字段完整且来源可追溯",
    知识增强执行: "知识来源、引用和验收标准齐备",
    异步共创审议: "冲突意见已归并且未出现高风险争议",
    工具链编排: "权限、字段和人工兜底路径已确认",
    前置透明决策: "关键争议已被标记且只生成建议不自动承诺",
    模板化自动发布: "模板、检查清单和回退规则全部通过",
  }[mode];
  return [modeCondition, "未触发人类介入条件", ...(nextFill.length ? [`已补齐：${nextFill.join("、")}`] : ["已形成可审计记录"])];
}

function nextAutonomyUpgradeForMode(
  mode: LoopPlan["toBeLoopCells"][number]["recommendedMode"],
  autonomyLevel: LoopPlan["toBeLoopCells"][number]["controlProfile"]["autonomyLevel"],
  nextFill: string[],
) {
  if (autonomyLevel === "agent_autonomous") return "继续保留抽检审计和异常接管，扩大到更多低风险样例。";
  const fill = nextFill.length ? `补齐${nextFill.join("、")}` : "补齐验收样例、失败记录和接管规则";
  const target = mode === "前置透明决策" ? "AI 副驾" : "AI 先处理、人确认关键点";
  return `${fill}后，将该单元升级为${target}，让人只处理例外、审批或审计。`;
}

function fallbackAiRoleDetail(cell: FallbackDesignDetailCell) {
  const modeActions: Record<LoopPlan["toBeLoopCells"][number]["recommendedMode"], string> = {
    结构化入口: "把模糊输入转成字段完整、来源可追溯的 brief，并列出待补问题",
    知识增强执行: "调用知识卡片、历史案例和标准模板，生成可审阅的判断依据或初稿",
    异步共创审议: "归并多方意见、识别冲突、维护版本差异并生成待确认修改清单",
    工具链编排: "检查字段完整性、准备跨系统操作清单，并在权限确认后提示半自动执行",
    前置透明决策: "提前汇总方向、争议、风险和待裁决事项，帮助责任人更早介入",
    模板化自动发布: "按已确认模板生成发布内容，完成缺项检查、同步准备和审计记录",
  };
  return `针对“${cell.action}”，AI 负责${modeActions[cell.recommendedMode]}。`;
}

function fallbackHumanBoundaryDetail(cell: FallbackDesignDetailCell) {
  const humanBoundary = cell.humanBoundary?.replace(/^人保留/, "").replace(/相关的判断、承诺和责任。?$/, "").replace(/[“”]/g, "").trim();
  const judgment = humanBoundary || "业务判断、对外承诺、异常接管和价值取舍";
  return `具体业务责任人负责${judgment}；AI 只能提交建议、草稿或检查结果，不能替代责任人作出承诺。`;
}

function fallbackInterfaceContractDetail(cell: FallbackDesignDetailCell) {
  const fill = cell.nextFill?.length ? `下一步必须补齐：${cell.nextFill.join("、")}。` : "下一步需要用试运行样例校准字段和验收口径。";
  return `交接对象是“${cell.action}”产生的可验收业务对象；上游需保留原始输入和来源，下游需确认接收口径、责任人、验收标准和留痕位置。${fill}`;
}

function fallbackGovernanceRuleDetail(cell: FallbackDesignDetailCell) {
  const blockers = cell.blockers.length ? `当前缺口：${cell.blockers.join("；")}。` : "当前主要条件已具备。";
  const highRisk = /承诺|审批|批准|裁决|高风险|异常|客户/.test(`${cell.action} ${cell.blockers.join(" ")}`);
  return highRisk
    ? `${blockers}涉及承诺、裁决、异常或客户影响时必须请人确认或接管，由具体业务责任人确认后才能推进。`
    : `${blockers}AI 可在记录可追溯、输出可验收、未触发异常接管条件时自动推进到下一步。`;
}

function buildFallbackPlan(session: LoopDesignerSession): LoopPlan {
  const goal = parseBusinessGoalAnchor(session.responses.business_goal);
  const workflow = parseWorkflowInput(session.responses.workflow);
  const diagnosis = buildScenarioDiagnosis(session.responses);
  const loop = goal?.output || goal?.goal || session.context.loopType || "客户需求到交付验收";
  const pain = diagnosis.summary || "跨角色等待、异常责任不清、反馈难以回灌。";
  const target = goal?.goal || "先跑通一条低风险试点回路。";
  const cycle = goal?.cycle || "设定周期";
  const toBeLoopCells = diagnosis.cellDiagnostics.length
    ? diagnosis.cellDiagnostics.map((cell) => ({
        cellId: cell.cellId,
        cellLabel: cell.cellLabel,
        action: cell.action,
        currentGap: cell.blockers.join("；") || "主要条件已具备，适合做低风险试运行。",
	        recommendedMode: cell.recommendedMode,
	        actorAssignments: fallbackActorAssignments(cell),
	        timeEstimate: fallbackTimeEstimate(cell),
	        controlProfile: fallbackControlProfile(cell),
	        aiRole: fallbackAiRoleDetail(cell),
        humanRole: fallbackHumanBoundaryDetail(cell),
        interfaceContract: fallbackInterfaceContractDetail(cell),
        governanceRule: fallbackGovernanceRuleDetail(cell),
        memoryRecord: cell.nextFill.includes("记录表") ? "补齐记录表后沉淀输入、输出、人工修改和采纳结果。" : "保留输入、AI 建议、人工确认、输出版本和复盘结论。",
        acceptanceSignal: `该单元输出能被下游直接接收，并能用“${goal?.successSignal || "用户设定成功标志"}”复盘。`,
        nextValidation: cell.nextFill.length ? `先补齐：${cell.nextFill.join("、")}` : "选择低风险样例试运行并记录人工修改率。",
      }))
    : [{
        cellId: "cell-1",
        cellLabel: "Cell 01",
        action: firstLine(loop),
        currentGap: diagnosis.summary,
        recommendedMode: "结构化入口" as const,
        actorAssignments: fallbackActorAssignments({
          action: firstLine(loop),
          recommendedMode: "结构化入口",
          currentAiCapability: "AI 可以把原始输入整理成标准 brief、缺项问题和可追踪对象。",
          humanBoundary: "人保留最终承诺、价值取舍和异常接管。",
        }),
	        timeEstimate: fallbackTimeEstimate({
	          recommendedMode: "结构化入口",
	          heat: "yellow",
	          blockers: ["缺少真实运行日志，处理时间需要试运行校准。"],
	          nextFill: ["brief 模板", "记录表"],
	        }),
	        controlProfile: fallbackControlProfile({
	          action: firstLine(loop),
	          recommendedMode: "结构化入口",
	          heat: "yellow",
	          blockers: ["缺少真实运行日志，处理时间需要试运行校准。"],
	          nextFill: ["brief 模板", "记录表"],
	        }),
	        aiRole: fallbackAiRoleDetail({
	          action: firstLine(loop),
	          recommendedMode: "结构化入口",
	          heat: "yellow",
	          blockers: ["缺少真实运行日志，处理时间需要试运行校准。"],
	          nextFill: ["brief 模板", "记录表"],
	        }),
        humanRole: fallbackHumanBoundaryDetail({
          action: firstLine(loop),
          recommendedMode: "结构化入口",
          heat: "yellow",
          blockers: ["缺少真实运行日志，处理时间需要试运行校准。"],
          nextFill: ["brief 模板", "记录表"],
          humanBoundary: "最终承诺、价值取舍和异常接管",
        }),
        interfaceContract: fallbackInterfaceContractDetail({
          action: firstLine(loop),
          recommendedMode: "结构化入口",
          heat: "yellow",
          blockers: ["缺少真实运行日志，处理时间需要试运行校准。"],
          nextFill: ["brief 模板", "记录表"],
        }),
        governanceRule: fallbackGovernanceRuleDetail({
          action: firstLine(loop),
          recommendedMode: "结构化入口",
          heat: "yellow",
          blockers: ["缺少真实运行日志，处理时间需要试运行校准。"],
          nextFill: ["brief 模板", "记录表"],
        }),
        memoryRecord: "保留输入、AI 建议、人工确认、输出版本和复盘结论。",
        acceptanceSignal: goal?.successSignal || "输出被下游接收并形成复盘记录。",
        nextValidation: "补齐回路单元后再生成更具体的改造后回路映射。",
      }];

  const plan: LoopPlan = {
    title: `${firstLine(loop)}回路`,
    executiveSummary: `本地演示模式生成的可运行初版。系统已根据业务目标锚点和回路单元诊断生成改造后回路映射、人机分工和治理检查项；接入模型服务后，可基于同一输入生成更贴近业务语境的版本。`,
    loopType: session.context.loopType || "业务回路",
    ...(goal ? { businessGoalAnchor: goal } : {}),
    ...(workflow ? { workflowInput: workflow } : {}),
    ...(sessionProcessTransformation(session) ? { processTransformation: sessionProcessTransformation(session) } : {}),
    scenarioDiagnosis: diagnosis,
    valueFlow: {
      start: diagnosis.stageMapping[0]?.sourceStep || "客户或一线提出需求/异常",
      end: goal?.output || "交付验收并形成复盘记录",
      targetCycleTime: cycle,
    },
    toBeLoopCells,
    hitlNodes: [
      { node: "高风险承诺", owner: "业务负责人", authority: "批准、驳回或要求补充证据", trigger: "金额、周期、客户影响或合规风险超过阈值", tool: "决策看板" },
    ],
    organizationMap: {
      conflicts: [pain],
      roleChanges: ["明确当前回路中的具体业务责任人", "引入需求理解智能体", "建立事实记录系统"],
      reportingChanges: ["异常由具体业务责任人接管，不再在部门之间来回转派"],
      sharedDataLayer: "统一需求对象、承诺版本、任务状态和验收反馈",
      humanRoles: [
        {
          id: "human_loop_owner",
          name: "业务负责人",
          status: "建议角色",
          mission: "对回路结果、关键承诺和异常闭环承担最终责任。",
          responsibilityScope: ["整条回路结果", "关键承诺", "异常闭环", "规则复盘"],
          responsibilities: ["确认业务边界", "批准关键承诺", "组织复盘"],
          exclusions: ["替代所有执行动作", "绕过必要审批"],
          decisionRights: ["批准试运行范围", "决定异常升级方式"],
          approvalRights: ["高风险承诺", "规则更新"],
          vetoRights: ["证据不足时暂停自动执行"],
          inputs: ["结构化需求", "风险提示", "验收反馈"],
          outputs: ["承诺版本", "异常裁决", "复盘结论"],
          serviceLevel: "工作日 4 小时内响应高风险事项。",
          availability: "试运行期每日检查，稳定后每周复盘。",
          exceptionOwnership: "负责无人接管、客户异议和系统记录冲突。",
          escalationTo: "业务负责人",
          suggestedCount: "1 人",
          capabilities: ["业务判断", "跨角色协调", "复盘改进"],
        },
        {
          id: "human_exception_arbitrator",
          name: "异常仲裁者",
          status: "待确认",
          mission: "处理业务负责人无法单独裁决的高风险争议。",
          responsibilityScope: ["高风险争议", "降级方案", "重大异常复盘"],
          responsibilities: ["处理争议", "确认降级方案"],
          exclusions: ["日常任务派发"],
          decisionRights: ["批准降级或暂停"],
          approvalRights: ["重大异常处理"],
          vetoRights: ["客户影响不可控时暂停试点"],
          inputs: ["异常记录", "影响评估"],
          outputs: ["仲裁结论", "降级指令"],
          serviceLevel: "24 小时内给出处理结论。",
          availability: "按异常触发。",
          exceptionOwnership: "负责重大客户影响和跨团队争议。",
          escalationTo: "经营负责人",
          suggestedCount: "1 人",
          capabilities: ["风险判断", "跨团队裁决"],
        },
      ],
      agentRoles: [
        {
          id: "agent_requirement_interpreter",
          name: "需求理解智能体",
          status: "建议角色",
          mission: "把原始输入整理为可判断、可执行、可追踪的需求对象。",
          serves: ["human_loop_owner"],
          responsibilityScope: ["结构化输入", "风险提示", "复盘摘要"],
          tasks: ["提取需求字段", "识别缺口", "生成风险提示", "总结复盘模式"],
          autonomyLevel: "建议",
          readableData: ["客户输入", "历史记录", "交付标准"],
          tools: ["知识库", "任务系统", "决策看板"],
          outputs: ["结构化需求", "风险提示", "复盘摘要"],
          qualityStandard: "所有建议必须可追溯到输入证据。",
          allowedActions: ["生成摘要", "提出建议", "标记风险"],
          approvalRequiredActions: ["修改承诺", "触发客户通知"],
          prohibitedActions: ["替人做最终承诺", "删除原始证据"],
          hitlTriggers: ["字段缺失", "高风险承诺", "客户异议"],
          supervisorRoleId: "human_loop_owner",
          fallback: "模型不可用时由业务负责人使用人工模板处理。",
          shutdownCondition: "连续两次输出无证据或误导业务判断。",
          cadence: "随需求触发，试运行期每日复盘。",
          contextSources: ["需求记录", "承诺版本", "验收反馈"],
          auditRequirements: ["保存输入、建议、采纳结果和人工修改痕迹"],
        },
      ],
      systemRoles: [
        {
          id: "system_fact_record",
          name: "事实记录系统",
          status: "待确认",
          mission: "保存回路唯一事实源和审计记录。",
          responsibilityScope: ["需求对象", "承诺版本", "任务状态", "验收反馈"],
          businessObjects: ["需求对象", "承诺版本", "任务状态", "验收反馈"],
          records: ["触发源", "审批记录", "异常记录", "复盘结论"],
          capabilities: ["保存", "检索", "审计", "同步"],
          inputs: ["原始需求", "AI 建议", "人工裁决"],
          outputs: ["看板状态", "审计记录", "知识沉淀"],
          sourceOfTruth: true,
          accessControl: "按角色授权，关键承诺仅具体业务责任人可批准。",
          integrationMode: "先用表格/任务系统试运行，后续接入 API。",
          constraints: ["字段标准待确认", "历史数据质量不稳定"],
          manualFallback: "系统不可用时使用统一模板记录并在 24 小时内补录。",
        },
      ],
      interfaces: [
        {
          id: "interface_requirement_to_owner",
          name: "需求对象交接",
          sourceId: "agent_requirement_interpreter",
          targetId: "human_loop_owner",
          riskLevel: "HITL",
          trigger: "需求字段补齐或发现高风险信号。",
          handoffObject: "结构化需求对象",
          requiredInputs: ["原始输入", "缺失字段", "风险提示"],
          expectedOutputs: ["确认范围", "承诺建议", "待补证据"],
          responsibleRoleId: "agent_requirement_interpreter",
          acceptanceRoleId: "human_loop_owner",
          serviceLevel: "2 小时内完成初判。",
          acceptanceCriteria: ["字段完整", "风险可解释", "下一步明确"],
          failureModes: ["字段缺失", "误判风险", "无人确认"],
          retryRule: "缺少关键字段时退回输入端补证。",
          timeoutEscalation: "超过 4 小时未确认，升级给异常仲裁者。",
          humanFallback: "业务负责人按人工模板整理需求。",
          interfaceType: "智能体调用",
          protocol: "待技术确认",
          dataObject: "需求对象",
          minimumFields: ["触发源", "客户", "目标", "约束", "风险"],
          authorization: "业务负责人可查看和确认。",
          idempotency: "同一触发源和时间窗口只生成一个需求对象版本。",
          auditRecord: "保存输入、输出、确认人、时间和修改记录。",
          sourceOfTruth: "事实记录系统",
        },
      ],
      assignmentChecklist: [
        { roleId: "human_loop_owner", suggestedCount: "1 人", requiredPermissions: ["查看全链路记录", "批准关键承诺"], readinessConditions: ["明确授权", "熟悉试点目标"], dueBy: "第 1 周", status: "待指派" },
        { roleId: "agent_requirement_interpreter", suggestedCount: "1 个", requiredPermissions: ["读取需求记录", "写入建议"], readinessConditions: ["提示词和知识库完成初版"], dueBy: "第 1 周", status: "待确认" },
      ],
      launchReadiness: {
        checklist: [
          { category: "角色到位", item: "确认当前回路的具体业务责任人", ownerRoleId: "human_loop_owner", evidence: "授权记录", status: "未开始" },
          { category: "智能体配置", item: "配置需求理解智能体", ownerRoleId: "agent_requirement_interpreter", evidence: "提示词和测试样例", status: "未开始" },
          { category: "系统接通", item: "建立事实记录表", ownerRoleId: "human_loop_owner", evidence: "字段模板", status: "进行中" },
          { category: "数据可用", item: "整理 10 条历史样例", ownerRoleId: "human_loop_owner", evidence: "样例清单", status: "未开始" },
          { category: "异常演练", item: "演练高风险承诺接管", ownerRoleId: "human_exception_arbitrator", evidence: "演练记录", status: "未开始" },
        ],
        firstWeekCadence: [
          { cadence: "每日", activity: "检查需求对象、异常和人工修改", ownerRoleId: "human_loop_owner", output: "试运行日报", exitTrigger: "连续 5 天无无人接管事项" },
        ],
      },
    },
    governance: {
      kpis: [
        { name: "闭环周期", current: "待测量", target: "48 小时内形成明确承诺", cadence: "每周" },
        { name: "异常接管时长", current: "待测量", target: "4 小时内有人接管", cadence: "每日" },
        ...(goal?.successSignal ? [{ name: "业务成功标志", current: "待建立基线", target: goal.successSignal, cadence: "按用户设定周期复盘" }] : []),
      ],
      arbitrationRules: ["高风险承诺必须由具体业务责任人批准，重大争议升级给异常仲裁者。"],
      interlocks: ["复盘结论进入知识库，并更新下一轮需求理解规则。"],
      lifecycleRule: "连续两周达成 KPI 后扩展到相邻回路；连续两周不达标则回退人工模板并复盘。",
    },
    roadmap: [
      { week: 1, theme: "锁定试点", actions: ["确认角色", "建立事实记录模板", "选择 10 条样例"], milestone: "试点回路可记录", checkpoint: "角色和字段完成确认" },
      { week: 2, theme: "小范围试跑", actions: ["运行 5 条真实需求", "记录 AI 建议和人工修改"], milestone: "形成第一轮运行证据", checkpoint: "检查异常是否有人接管" },
      { week: 3, theme: "规则校准", actions: ["复盘误判和缺字段", "更新提示词和字段标准"], milestone: "形成稳定处理模板", checkpoint: "检查闭环周期和返工点" },
      { week: 4, theme: "复盘扩圈", actions: [`按“${cycle}”评估 KPI`, "决定扩展或回退"], milestone: "形成下一轮推广建议", checkpoint: "在用户设定周期结束时重新评估成熟度" },
    ],
    assumptions: ["当前输入足以形成试点版回路。", "业务团队愿意先用轻量记录方式跑通闭环。"],
    risks: ["模型服务尚未配置，当前为本地演示方案。", "真实系统接口、权限和历史数据质量仍需确认。"],
    validationQuestions: [
      "谁对关键承诺承担最终责任？",
      "事实记录系统是否能成为唯一可信来源？",
      "异常超过多久必须升级？",
      target,
    ],
  };

  return withMaturityMapping(plan);
}

function attachDesignBrief(plan: LoopPlan, session: LoopDesignerSession): LoopPlan {
  const goal = parseBusinessGoalAnchor(session.responses.business_goal);
  const workflow = parseWorkflowInput(session.responses.workflow);
  const diagnosis = buildScenarioDiagnosis(session.responses);
  return withMaturityMapping({
    ...plan,
    ...(goal ? { businessGoalAnchor: goal } : {}),
    ...(workflow ? { workflowInput: workflow } : {}),
    ...(sessionProcessTransformation(session) ? { processTransformation: sessionProcessTransformation(session) } : {}),
    scenarioDiagnosis: diagnosis,
  });
}

function sessionProcessTransformation(session: LoopDesignerSession) {
  if (session.context.processTransformation) return session.context.processTransformation;
  if (!session.context.legacyFlow?.length) return undefined;
  return buildProcessTransformation({
    legacyNodes: session.context.legacyFlow,
    confirmedBreakpoints: session.context.breakpointScan,
    successSignal: parseBusinessGoalAnchor(session.responses.business_goal)?.successSignal,
  });
}

function firstLine(value: string) {
  return value.split(/\n|；|。/).map((item) => item.trim()).find(Boolean)?.slice(0, 24) || "业务价值流";
}
