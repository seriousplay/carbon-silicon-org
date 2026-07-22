import { cleanOrganizationName } from "./identity-labels";

export type WorkflowStage = "questionnaire" | "diagnosis" | "blueprint" | "loop_design";

export type QuestionnaireAnswers = {
  name: string;
  company: string;
  role: string;
  scale: string;
  industry: string;
  business: string;
  aiConcern: string;
  aiCurrentWork?: string;
  aiStageChoice: "A" | "B" | "C" | "D" | "E";
  aiScenarios?: string[];
  aiBlockers?: string[];
  ninetyDayPriorityChoice?: "A" | "B" | "C" | "D" | "E" | "F";
  aiAttitudeChoice: "A" | "B" | "C";
  orgManagementChoice?: "A" | "B" | "C" | "D" | "E";
  humanAiDivisionChoice?: "A" | "B" | "C" | "D" | "E";
  evolutionPathChoice?: "A" | "B" | "C" | "D";
  expectations?: string[];
  takeaway?: string;
  openQuestion?: string;
};

export type DiagnosisStep = {
  id: keyof DiagnosisResponses;
  title: string;
  prompt: string;
  placeholder: string;
};

export type DiagnosisResponses = {
  strategicIdentity?: string;
  focusStrategy?: string;
  strategicBattlefield?: string;
  readinessAssessment?: string;
  seedLoopSelection?: string;
  orgInfo?: string;
  businessEssence?: string;
  focusWeights?: string;
  focusCalibration?: string;
  stageAssessment?: string;
  loopDraft?: string;
  identityConfirm?: string;
  focusChoice?: "speed" | "structure" | "adaptation";
  focusReflection?: string;
  stageContinuity?: string;
  stageClosedLoop?: string;
  stageRuleUpdate?: string;
  stageConfirmation?: string;
  painPoint?: string;
};

export type FocusDirection = "speed" | "structure" | "adaptation";

export type StrategicIdentity = {
  company: string;
  industry: string;
  business: string;
  scale: string;
  mission: string;
  vision: string;
  businessEssence: string;
  essenceNote?: string;
};

export type FocusStrategy = {
  weights: { speed: number; connection: number; emergence: number };
  metric: string;
  tradeoff: string;
  pilot: string;
  visionAlignment: string;
};

export type StrategicBattlefield = {
  name: string;
  scope: "core" | "adjacent";
  strategicGoal: string;
  twelveMonthOutcome: string;
  urgency: string;
};

export type ReadinessAssessment = {
  structure: { score: 1 | 3 | 5; gap: string };
  cell: { score: 1 | 3 | 5; gap: string };
  environment: { score: 1 | 3 | 5; gap: string };
};

export type SeedLoopEvidenceKey = "pain" | "data" | "owner" | "shortLoop";
export type SeedLoopScoreKey = "pain" | "data" | "replication" | "riskControl";
export type SeedLoopScoreWeights = Record<SeedLoopScoreKey, number>;

export type SeedLoopCandidateInput = {
  id?: string;
  title: string;
  pain: string;
  data: string;
  owner: string;
  shortLoop: string;
  scores: Record<SeedLoopScoreKey, 1 | 3 | 5>;
};

export type SeedLoopSelection = {
  userSignal?: string;
  priority?: string;
  scoreWeights?: SeedLoopScoreWeights;
  manualCandidates?: SeedLoopCandidateInput[];
};

export type DiagnosisSummary = {
  organizationName: string;
  industry: string;
  business: string;
  scale: string;
  focus: FocusDirection;
  focusLabel: string;
  focusReason: string;
  benchmark: Array<{ focus: FocusDirection; label: string; ratio: number; averageWeeks: number }>;
  stageLevel: "L1" | "L2" | "L3" | "L4" | "L5";
  stageName: string;
  stageReason: string;
};

export type BlueprintCandidate = {
  id: "candidate_1" | "candidate_2" | "candidate_3" | "candidate_4" | "candidate_5";
  title: string;
  trigger: string;
  outcome: string;
  valueDescription: string;
  aiRole: string;
  humanRole: string;
  successCriteria: string;
  score: number;
  roiScore: number;
  criteriaScores: {
    strategicFit: number;
    roi: number;
    capabilityAccumulation: number;
    readinessFit: number;
    diffusionPotential: number;
  };
  seedLoopScores?: Record<SeedLoopScoreKey, 1 | 3 | 5>;
  seedLoopWeights?: SeedLoopScoreWeights;
  seedLoopWeightedScore?: number;
  seedLoopEvidence?: Record<SeedLoopEvidenceKey, string>;
  evidence: string;
  sourceTemplateId?: string;
  sourceTemplateTitle?: string;
  weekOneActions: string[];
};

export type BlueprintStrategicInsights = {
  generatedAt: string;
  modelLabel: string;
  summary: string;
  strategicJudgment: string;
  keyInsights: Array<{
    title: string;
    detail: string;
    evidence: string;
  }>;
  landingRecommendations: Array<{
    title: string;
    action: string;
    timeframe: string;
    owner: string;
  }>;
  riskAlerts: Array<{
    risk: string;
    whyItMatters: string;
    mitigation: string;
  }>;
};

export type BlueprintOutput = {
  generatedAt: string;
  questionnaire: QuestionnaireAnswers;
  diagnosis: DiagnosisSummary;
  strategicContext: StrategicContext;
  battlefield: StrategicBattlefieldOutput;
  readiness: ReadinessOutput;
  strategicNarrative: string;
  strategicInsights?: BlueprintStrategicInsights;
  candidates: BlueprintCandidate[];
  recommendedSeedLoop?: BlueprintCandidate;
  scenarioRankings: {
    fastestStart: string;
    highestLongTermValue: string;
    lowestOrgDependency: string;
  };
  mondayChecklist: string[];
  teamBrief: string;
  preferredCandidateId?: BlueprintCandidate["id"];
};

export type StrategicContext = {
  organizationName: string;
  industry: string;
  business: string;
  scale: string;
  mission: string;
  vision: string;
  businessEssence: string;
  focus: FocusDirection;
  focusLabel: string;
  focusReason: string;
};

export type StrategicBattlefieldOutput = StrategicBattlefield & {
  scopeLabel: string;
};

export type ReadinessOutput = ReadinessAssessment & {
  averageScore: number;
  conclusion: string;
  primaryRisk: string;
};

export const DIAGNOSIS_STEPS: DiagnosisStep[] = [
  {
    id: "strategicIdentity",
    title: "锁定战略身份",
    prompt: "先锁定行业、主营业务、企业使命、业务愿景和业务本质，让蓝图拥有战略上下文。",
    placeholder: "确认行业、主营业务、使命、愿景、业务本质。",
  },
  {
    id: "focusStrategy",
    title: "组织能力聚焦",
    prompt: "把速度、连接、涌现按 100% 分配，并说明这个组织能力选择如何服务长期业务愿景。",
    placeholder: "填写能力配比、战略指标、组织代价和愿景对齐。",
  },
  {
    id: "strategicBattlefield",
    title: "关键战场设计",
    prompt: "锁定 AI 转型第一战场：它可以是主营业务，也可以是非主营业务，但必须是战略级项目。",
    placeholder: "填写战场名称、战略意图、赢的标准和为什么现在必须打。",
  },
  {
    id: "readinessAssessment",
    title: "准备度分析",
    prompt: "按结构、细胞、环境评估当前组织打赢这场仗的准备度。",
    placeholder: "结构、细胞、环境分别按 1/3/5 评分，并写出关键缺口。",
  },
  {
    id: "seedLoopSelection",
    title: "火种回路选择",
    prompt: "手动写出 3 个候选火种回路，用真痛点、有数据、有人扛、闭环短校准，再按痛点、数据、复制潜力、风险可控度评分。",
    placeholder: "填写 3 个候选回路、四项检验依据和排序评分。",
  },
];

export const SEED_LOOP_EVIDENCE_GUIDES: Array<{
  key: SeedLoopEvidenceKey;
  label: string;
  description: string;
}> = [
  { key: "pain", label: "真痛点", description: "问题高频、具体、足够痛，不是为了 AI 而 AI。" },
  { key: "data", label: "有数据", description: "有可追踪的数据、过程记录或结果指标。" },
  { key: "owner", label: "有人扛", description: "有业务负责人愿意试，并直接承担结果。" },
  { key: "shortLoop", label: "闭环短", description: "4-6周能跑通，并且业务结果可被验证。" },
];

export const SEED_LOOP_SCORE_CRITERIA: Array<{
  key: SeedLoopScoreKey;
  label: string;
  defaultWeight: number;
  description: string;
}> = [
  { key: "pain", label: "痛点", defaultWeight: 40, description: "痛点越真实、高频、影响越大，分数越高。" },
  { key: "data", label: "数据", defaultWeight: 30, description: "数据越可得、可追踪、可验收，分数越高。" },
  { key: "replication", label: "复制潜力", defaultWeight: 20, description: "跑通后越容易复制到其他团队或业务链路，分数越高。" },
  { key: "riskControl", label: "风险可控度", defaultWeight: 10, description: "越能低风险试错、可回滚、可人工兜底，分数越高。" },
];

export const DEFAULT_SEED_LOOP_SCORE_WEIGHTS: SeedLoopScoreWeights = {
  pain: 40,
  data: 30,
  replication: 20,
  riskControl: 10,
};

const focusLabels: Record<FocusDirection, string> = {
  speed: "速度优先",
  structure: "结构优先",
  adaptation: "适应优先",
};

const stageMap: Record<QuestionnaireAnswers["aiStageChoice"], DiagnosisSummary["stageLevel"]> = {
  A: "L1",
  B: "L2",
  C: "L3",
  D: "L4",
  E: "L2",
};

const stageNames: Record<DiagnosisSummary["stageLevel"], string> = {
  L1: "工具上手",
  L2: "流程接入",
  L3: "团队重构",
  L4: "系统重写",
  L5: "碳硅共生",
};

export const STAGE_LADDER: Array<{
  level: DiagnosisSummary["stageLevel"];
  name: string;
  businessMeaning: string;
  upgradeCost: string;
}> = [
  { level: "L1", name: "工具上手", businessMeaning: "AI 主要是个人提效工具，尚未进入真实业务流程。", upgradeCost: "低：选定一个高频场景，把工具使用接入可验收的业务动作。" },
  { level: "L2", name: "流程接入", businessMeaning: "AI 已进入局部流程，但责任边界、数据和复盘还不稳定。", upgradeCost: "中：补齐流程责任人、数据口径和反馈机制。" },
  { level: "L3", name: "团队重构", businessMeaning: "团队开始围绕人机分工重排岗位、协作和交付节奏。", upgradeCost: "中高：重设角色分工、授权边界和团队考核方式。" },
  { level: "L4", name: "系统重写", businessMeaning: "多条关键流程需要共享系统、数据对象、规则和异常处理机制。", upgradeCost: "高：需要组织级系统架构、治理机制和迁移节奏。" },
  { level: "L5", name: "碳硅共生", businessMeaning: "组织能让人、AI 和业务回路持续互相学习、审阅和进化。", upgradeCost: "持续：需要组织记忆、运行信号、治理审阅和文化机制共同沉淀。" },
];

export function getStageLadderItem(level: DiagnosisSummary["stageLevel"]) {
  return STAGE_LADDER.find((item) => item.level === level) ?? STAGE_LADDER[0];
}

export function parseQuestionnaire(input: unknown): QuestionnaireAnswers {
  const data = asRecord(input);
  const answers: QuestionnaireAnswers = {
    name: requiredText(data.name, "姓名"),
    company: requiredText(data.company, "企业名称"),
    role: requiredText(data.role, "职位"),
    scale: requiredText(data.scale, "员工规模"),
    industry: requiredText(data.industry, "行业"),
    business: requiredText(data.business, "主营业务"),
    aiConcern: requiredText(data.aiConcern, "最关注的问题"),
    aiCurrentWork: optionalText(data.aiCurrentWork),
    aiStageChoice: parseChoice(data.aiStageChoice, ["A", "B", "C", "D", "E"] as const, "组织现状"),
    aiScenarios: requiredTextList(data.aiScenarios, "AI 应用场景"),
    aiBlockers: requiredTextList(data.aiBlockers, "AI 推进阻碍"),
    ninetyDayPriorityChoice: parseChoice(data.ninetyDayPriorityChoice, ["A", "B", "C", "D", "E", "F"] as const, "90 天优先事项"),
    aiAttitudeChoice: parseChoice(data.aiAttitudeChoice, ["A", "B", "C"] as const, "AI 态度"),
    orgManagementChoice: parseChoice(data.orgManagementChoice, ["A", "B", "C", "D", "E"] as const, "组织管理方式"),
    humanAiDivisionChoice: parseChoice(data.humanAiDivisionChoice, ["A", "B", "C", "D", "E"] as const, "人机分工"),
    evolutionPathChoice: parseChoice(data.evolutionPathChoice, ["A", "B", "C", "D"] as const, "AI 组织进化路径"),
    expectations: requiredTextList(data.expectations, "课程期待"),
    takeaway: optionalText(data.takeaway),
    openQuestion: optionalText(data.openQuestion),
  };
  return answers;
}

export function normalizeDiagnosisAnswer(step: DiagnosisStep, raw: string) {
  const answer = raw.trim();
  if (!answer || answer.length > 6000) throw new Error("Answer must contain 1-6000 characters");
  if (["strategicIdentity", "focusStrategy", "strategicBattlefield", "readinessAssessment", "seedLoopSelection", "orgInfo", "businessEssence", "focusWeights", "focusCalibration", "stageAssessment", "loopDraft"].includes(step.id)) {
    JSON.parse(answer);
  }
  return answer;
}

export function buildDiagnosisSummary(questionnaire: QuestionnaireAnswers, responses: DiagnosisResponses): DiagnosisSummary {
  const strategicIdentity = getStrategicIdentity(questionnaire, responses);
  const focusStrategy = getFocusStrategy(questionnaire, responses);
  const stageAssessment = parseJson<Record<string, boolean | number>>(responses.stageAssessment);
  const focus = focusFromWeights(focusStrategy.weights) || responses.focusChoice || inferFocus(questionnaire);
  const stageLevel = stageFromAssessment(stageAssessment) || parseStageConfirmation(responses.stageConfirmation) || stageMap[questionnaire.aiStageChoice];
  return {
    organizationName: strategicIdentity.company,
    industry: strategicIdentity.industry,
    business: strategicIdentity.business,
    scale: strategicIdentity.scale,
    focus,
    focusLabel: focusLabels[focus],
    focusReason: buildFocusReason(questionnaire, focus, focusStrategy),
    benchmark: buildBenchmark(questionnaire.industry),
    stageLevel,
    stageName: stageNames[stageLevel],
    stageReason: buildStageReason(questionnaire, responses, stageLevel),
  };
}

export function buildBlueprint(
  questionnaire: QuestionnaireAnswers,
  responses: DiagnosisResponses,
): BlueprintOutput {
  const diagnosis = buildDiagnosisSummary(questionnaire, responses);
  const strategicContext = buildStrategicContext(questionnaire, responses, diagnosis);
  const battlefield = buildBattlefield(questionnaire, responses, strategicContext);
  const readiness = buildReadiness(responses, battlefield);
  const seedLoopSelection = parseJson<SeedLoopSelection>(responses.seedLoopSelection);
  const scoreWeights = normalizeSeedLoopScoreWeights(seedLoopSelection?.scoreWeights);
  if (sumSeedLoopScoreWeights(scoreWeights) !== 100) throw new Error("评分权重合计必须等于 100%。");
  const manualCandidates = buildManualSeedLoopCandidates(seedLoopSelection, diagnosis, strategicContext, battlefield, readiness, scoreWeights);
  if (manualCandidates.length !== 3) throw new Error("请完整填写 3 个候选火种回路。");
  const candidates = manualCandidates;
  const recommendedSeedLoop = candidates[0];
  return {
    generatedAt: new Date().toISOString(),
    questionnaire,
    diagnosis,
    strategicContext,
    battlefield,
    readiness,
    strategicNarrative: buildStrategicNarrative(strategicContext, battlefield, readiness),
    candidates,
    recommendedSeedLoop,
    scenarioRankings: {
      fastestStart: candidates[0]?.id || "candidate_1",
      highestLongTermValue: candidates[1]?.id || candidates[0]?.id || "candidate_1",
      lowestOrgDependency: candidates[2]?.id || candidates[0]?.id || "candidate_1",
    },
    mondayChecklist: candidates[0]?.weekOneActions || defaultWeekOneActions(diagnosis),
    teamBrief: buildTeamBrief(diagnosis, responses, candidates[0]),
  };
}

export function scoreSeedLoopCandidate(candidate: SeedLoopCandidateInput, weights: SeedLoopScoreWeights = DEFAULT_SEED_LOOP_SCORE_WEIGHTS) {
  const scores = normalizeSeedLoopScores(candidate.scores);
  const scoreWeights = normalizeSeedLoopScoreWeights(weights);
  return SEED_LOOP_SCORE_CRITERIA.reduce((total, criterion) => total + (scores[criterion.key] / 5) * scoreWeights[criterion.key], 0);
}

export function applyPreferredCandidate(blueprint: BlueprintOutput, candidateId: string): BlueprintOutput {
  const candidate = blueprint.candidates.find((item) => item.id === candidateId);
  if (!candidate) throw new Error("Candidate not found");
  return {
    ...blueprint,
    preferredCandidateId: candidate.id,
    mondayChecklist: candidate.weekOneActions,
    teamBrief: buildTeamBrief(blueprint.diagnosis, {}, candidate),
  };
}

export function getPreferredCandidate(blueprint: BlueprintOutput) {
  return blueprint.candidates.find((item) => item.id === blueprint.preferredCandidateId) ?? blueprint.candidates[0] ?? null;
}

export function buildLoopSeed(candidate: BlueprintCandidate, blueprint: BlueprintOutput) {
  return [
    `关键战场：${blueprint.battlefield?.name || blueprint.questionnaire.business}`,
    `战略目标：${blueprint.battlefield?.strategicGoal || "待在蓝图中确认"}`,
    `准备度缺口：${blueprint.readiness?.primaryRisk || "待补充"}`,
    `建议回路：${candidate.title}`,
    `价值描述：${candidate.valueDescription}`,
    `当前痛点：${blueprint.questionnaire.aiConcern}`,
    blueprint.questionnaire.aiCurrentWork ? `AI 应用现状：${blueprint.questionnaire.aiCurrentWork}` : "",
    `AI 做什么：${candidate.aiRole}`,
    `人做什么：${candidate.humanRole}`,
    `成功标准：${candidate.successCriteria}`,
  ].filter(Boolean).join("\n");
}

function buildManualSeedLoopCandidates(
  selection: SeedLoopSelection | null,
  diagnosis: DiagnosisSummary,
  strategicContext: StrategicContext,
  battlefield: StrategicBattlefieldOutput,
  readiness: ReadinessOutput,
  scoreWeights: SeedLoopScoreWeights,
): BlueprintCandidate[] {
  const manualInputs = selection?.manualCandidates
    ?.map(normalizeSeedLoopCandidateInput)
    .filter(isCompleteSeedLoopCandidateInput)
    .sort((left, right) => scoreSeedLoopCandidate(right, scoreWeights) - scoreSeedLoopCandidate(left, scoreWeights)) ?? [];

  return manualInputs.slice(0, 5).map((candidate, index) => {
    const id = `candidate_${index + 1}` as BlueprintCandidate["id"];
    const scores = normalizeSeedLoopScores(candidate.scores);
    const weightedScore = Math.round(scoreSeedLoopCandidate({ ...candidate, scores }, scoreWeights));
    const criteriaScores = {
      strategicFit: scores.pain,
      roi: scores.data,
      capabilityAccumulation: scores.replication,
      readinessFit: scores.riskControl,
      diffusionPotential: scores.replication,
    };
    return {
      id,
      title: candidate.title,
      trigger: candidate.pain || battlefield.strategicGoal,
      outcome: candidate.shortLoop || battlefield.twelveMonthOutcome,
      valueDescription: buildManualSeedLoopValueDescription(candidate, strategicContext, battlefield, readiness),
      aiRole: `围绕“${candidate.title}”整理输入、生成初稿、追踪指标变化，并把异常暴露给业务负责人。`,
      humanRole: candidate.owner || "业务负责人确认判断、处理例外，并承担最终业务结果。",
      successCriteria: candidate.data ? `用“${candidate.data}”作为验收口径，4-6周内跑出可验证的业务结果。` : `服务“${battlefield.name}”，4-6周内跑出可验证的业务结果。`,
      score: weightedScore,
      roiScore: weightedScore,
      criteriaScores,
      seedLoopScores: scores,
      seedLoopWeights: scoreWeights,
      seedLoopWeightedScore: weightedScore,
      seedLoopEvidence: {
        pain: candidate.pain,
        data: candidate.data,
        owner: candidate.owner,
        shortLoop: candidate.shortLoop,
      },
      evidence: `用户手动评分：痛点 ${scores.pain}/5，数据 ${scores.data}/5，复制潜力 ${scores.replication}/5，风险可控度 ${scores.riskControl}/5；按痛点 ${scoreWeights.pain}%、数据 ${scoreWeights.data}%、复制潜力 ${scoreWeights.replication}%、风险可控度 ${scoreWeights.riskControl}% 得到 ${weightedScore}/100。`,
      weekOneActions: [
        `请“${candidate.owner || "业务负责人"}”确认这条回路的责任边界。`,
        `把“${candidate.data || "关键过程数据"}”定义成第一轮验收口径。`,
        `用“${candidate.shortLoop || diagnosis.business}”跑一次最小闭环，并记录卡点。`,
      ],
    };
  });
}

function normalizeSeedLoopCandidateInput(candidate: SeedLoopCandidateInput | undefined | null): SeedLoopCandidateInput | null {
  if (!candidate) return null;
  return {
    id: candidate.id,
    title: cleanText(candidate.title),
    pain: cleanText(candidate.pain),
    data: cleanText(candidate.data),
    owner: cleanText(candidate.owner),
    shortLoop: cleanText(candidate.shortLoop),
    scores: normalizeSeedLoopScores(candidate.scores),
  };
}

function isCompleteSeedLoopCandidateInput(candidate: SeedLoopCandidateInput | null): candidate is SeedLoopCandidateInput {
  return Boolean(candidate?.title && candidate.pain && candidate.data && candidate.owner && candidate.shortLoop);
}

function normalizeSeedLoopScores(scores: Partial<Record<SeedLoopScoreKey, number>> | undefined): Record<SeedLoopScoreKey, 1 | 3 | 5> {
  return {
    pain: normalizeSeedLoopScore(scores?.pain),
    data: normalizeSeedLoopScore(scores?.data),
    replication: normalizeSeedLoopScore(scores?.replication),
    riskControl: normalizeSeedLoopScore(scores?.riskControl),
  };
}

function normalizeSeedLoopScoreWeights(weights: Partial<SeedLoopScoreWeights> | undefined): SeedLoopScoreWeights {
  return {
    pain: normalizeSeedLoopWeight(weights?.pain, DEFAULT_SEED_LOOP_SCORE_WEIGHTS.pain),
    data: normalizeSeedLoopWeight(weights?.data, DEFAULT_SEED_LOOP_SCORE_WEIGHTS.data),
    replication: normalizeSeedLoopWeight(weights?.replication, DEFAULT_SEED_LOOP_SCORE_WEIGHTS.replication),
    riskControl: normalizeSeedLoopWeight(weights?.riskControl, DEFAULT_SEED_LOOP_SCORE_WEIGHTS.riskControl),
  };
}

function normalizeSeedLoopScore(score: number | undefined): 1 | 3 | 5 {
  return score === 1 || score === 5 ? score : 3;
}

function normalizeSeedLoopWeight(weight: number | undefined, fallback: number) {
  return Number.isFinite(weight) ? Math.max(0, Math.min(100, Math.round(weight || 0))) : fallback;
}

function sumSeedLoopScoreWeights(weights: SeedLoopScoreWeights) {
  return weights.pain + weights.data + weights.replication + weights.riskControl;
}

function buildManualSeedLoopValueDescription(candidate: SeedLoopCandidateInput, strategicContext: StrategicContext, battlefield: StrategicBattlefieldOutput, readiness: ReadinessOutput) {
  const pain = candidate.pain ? `真痛点是“${candidate.pain}”` : "真痛点需要在首轮访谈中确认";
  const data = candidate.data ? `可用“${candidate.data}”追踪` : "数据口径需要先补齐";
  const owner = candidate.owner ? `由“${candidate.owner}”扛结果` : "需要明确业务负责人";
  const shortLoop = candidate.shortLoop ? `闭环方式是“${candidate.shortLoop}”` : "闭环周期要压缩到 4-6周，并且业务结果可被验证";
  return `${candidate.title} 是 ${strategicContext.organizationName} 面向“${battlefield.name}”手动锁定的候选火种回路：${pain}，${data}，${owner}，${shortLoop}。它优先补齐“${readiness.primaryRisk}”，并把第一场仗转成可验证的 AI 落地动作。`;
}

function inferFocus(questionnaire: QuestionnaireAnswers): FocusDirection {
  if (questionnaire.aiAttitudeChoice === "C") return "adaptation";
  if (/慢|等待|响应|速度|效率|机会/.test(questionnaire.aiConcern)) return "speed";
  if (/部门|流程|协同|系统|数据|结构/.test(questionnaire.aiConcern)) return "structure";
  return "speed";
}

function getStrategicIdentity(questionnaire: QuestionnaireAnswers, responses: DiagnosisResponses): StrategicIdentity {
  const strategic = parseJson<StrategicIdentity>(responses.strategicIdentity);
  if (strategic) return normalizeStrategicIdentity(questionnaire, strategic);
  const orgInfo = parseJson<Record<string, string>>(responses.orgInfo);
  const essence = parseJson<{ type?: string; note?: string }>(responses.businessEssence);
  return normalizeStrategicIdentity(questionnaire, {
    company: orgInfo?.company || questionnaire.company,
    industry: orgInfo?.industry || questionnaire.industry,
    business: orgInfo?.business || questionnaire.business,
    scale: orgInfo?.scale || questionnaire.scale,
    mission: `用 ${questionnaire.business} 持续创造客户价值`,
    vision: `成为 ${questionnaire.industry} 中更快响应、更强连接、更能自进化的组织`,
    businessEssence: essence?.type || "运营驱动",
    essenceNote: essence?.note,
  });
}

function normalizeStrategicIdentity(questionnaire: QuestionnaireAnswers, value: StrategicIdentity): StrategicIdentity {
  return {
    company: cleanOrganizationName(value.company) || cleanOrganizationName(questionnaire.company) || "待补充组织名称",
    industry: value.industry || questionnaire.industry,
    business: value.business || questionnaire.business,
    scale: value.scale || questionnaire.scale,
    mission: value.mission || `用 ${questionnaire.business} 持续创造客户价值`,
    vision: value.vision || `成为 ${questionnaire.industry} 中更快响应、更强连接、更能自进化的组织`,
    businessEssence: value.businessEssence || "运营驱动",
    essenceNote: value.essenceNote,
  };
}

function getFocusStrategy(questionnaire: QuestionnaireAnswers, responses: DiagnosisResponses): FocusStrategy {
  const strategic = parseJson<FocusStrategy>(responses.focusStrategy);
  if (strategic) return normalizeFocusStrategy(questionnaire, strategic);
  const weights = parseJson<{ speed: number; connection: number; emergence: number }>(responses.focusWeights) || { speed: 40, connection: 35, emergence: 25 };
  const calibration = parseJson<{ metric?: string; tradeoff?: string; pilot?: string }>(responses.focusCalibration);
  return normalizeFocusStrategy(questionnaire, {
    weights,
    metric: calibration?.metric || "关键业务响应速度",
    tradeoff: calibration?.tradeoff || "接受短期职责和流程重排",
    pilot: calibration?.pilot || questionnaire.business,
    visionAlignment: `该聚焦服务于“${questionnaire.business}”的长期竞争力提升。`,
  });
}

function normalizeFocusStrategy(questionnaire: QuestionnaireAnswers, value: FocusStrategy): FocusStrategy {
  const weights = value.weights || { speed: 40, connection: 35, emergence: 25 };
  return {
    weights: {
      speed: clampPercent(weights.speed),
      connection: clampPercent(weights.connection),
      emergence: clampPercent(weights.emergence),
    },
    metric: value.metric || "关键业务响应速度",
    tradeoff: value.tradeoff || "接受短期职责和流程重排",
    pilot: value.pilot || questionnaire.business,
    visionAlignment: value.visionAlignment || `该聚焦服务于“${questionnaire.business}”的长期竞争力提升。`,
  };
}

function clampPercent(value: number | undefined) {
  return Number.isFinite(value) ? Math.max(0, Math.min(100, Math.round(value || 0))) : 0;
}

function buildStrategicContext(questionnaire: QuestionnaireAnswers, responses: DiagnosisResponses, diagnosis: DiagnosisSummary): StrategicContext {
  const identity = getStrategicIdentity(questionnaire, responses);
  return {
    organizationName: identity.company,
    industry: identity.industry,
    business: identity.business,
    scale: identity.scale,
    mission: identity.mission,
    vision: identity.vision,
    businessEssence: identity.businessEssence,
    focus: diagnosis.focus,
    focusLabel: diagnosis.focusLabel,
    focusReason: diagnosis.focusReason,
  };
}

function buildBattlefield(questionnaire: QuestionnaireAnswers, responses: DiagnosisResponses, strategicContext: StrategicContext): StrategicBattlefieldOutput {
  const battlefield = parseJson<StrategicBattlefield>(responses.strategicBattlefield);
  const fallback: StrategicBattlefield = {
    name: `${strategicContext.business} AI 增长突破战`,
    scope: "core",
    strategicGoal: `围绕“${questionnaire.aiConcern}”建立可复制的 AI 化业务突破样板`,
    twelveMonthOutcome: `12 个月内形成一条支撑“${strategicContext.vision}”的可复制业务战法`,
    urgency: "AI 冲击已经进入核心业务，继续观望会让组织学习速度落后于市场变化。",
  };
  const value = battlefield || fallback;
  return {
    name: value.name || fallback.name,
    scope: value.scope === "adjacent" ? "adjacent" : "core",
    scopeLabel: value.scope === "adjacent" ? "非主营战略项目" : "主营业务战场",
    strategicGoal: value.strategicGoal || fallback.strategicGoal,
    twelveMonthOutcome: value.twelveMonthOutcome || fallback.twelveMonthOutcome,
    urgency: value.urgency || fallback.urgency,
  };
}

function buildReadiness(responses: DiagnosisResponses, battlefield: StrategicBattlefieldOutput): ReadinessOutput {
  const value = parseJson<ReadinessAssessment>(responses.readinessAssessment);
  const readiness: ReadinessAssessment = value || {
    structure: { score: 3, gap: "关键战场的责任边界、决策权和复盘机制需要进一步明确。" },
    cell: { score: 3, gap: "一线业务细胞需要具备数据意识、AI 协作习惯和快速试错节奏。" },
    environment: { score: 3, gap: "数据、工具、激励和容错环境需要围绕第一战场重新配置。" },
  };
  const normalized = {
    structure: normalizeReadinessItem(readiness.structure, "结构准备度需要围绕关键战场重排。"),
    cell: normalizeReadinessItem(readiness.cell, "业务细胞需要形成可执行的 AI 协同能力。"),
    environment: normalizeReadinessItem(readiness.environment, "数据、工具和激励环境需要补齐。"),
  };
  const averageScore = Math.round(((normalized.structure.score + normalized.cell.score + normalized.environment.score) / 3) * 10) / 10;
  const primary = Object.entries(normalized).sort((left, right) => left[1].score - right[1].score)[0]?.[1];
  return {
    ...normalized,
    averageScore,
    primaryRisk: primary?.gap || `打赢“${battlefield.name}”前需要补齐组织准备度缺口。`,
    conclusion: averageScore >= 4 ? "组织准备度较高，可以直接启动第一火种回路。" : averageScore >= 3 ? "组织具备启动条件，但需要边打边补齐关键缺口。" : "组织准备度偏低，应先缩小战场并降低试点复杂度。",
  };
}

function normalizeReadinessItem(value: { score?: number; gap?: string } | undefined, fallbackGap: string) {
  const raw = value?.score;
  const score: 1 | 3 | 5 = raw === 5 || raw === 3 || raw === 1 ? raw : 3;
  return { score, gap: value?.gap || fallbackGap };
}

function buildStrategicNarrative(strategicContext: StrategicContext, battlefield: StrategicBattlefieldOutput, readiness: ReadinessOutput) {
  return `${strategicContext.organizationName}的长期愿景是“${strategicContext.vision}”。在 AI 时代，第一场仗不应从工具试用开始，而应从“${battlefield.name}”这个战略战场切入：它直接服务于“${battlefield.strategicGoal}”，并能在 12 个月内形成“${battlefield.twelveMonthOutcome}”。当前组织准备度为 ${readiness.averageScore}/5，判断是：${readiness.conclusion}`;
}

function parseStageConfirmation(value: string | undefined): DiagnosisSummary["stageLevel"] | null {
  const match = value?.toUpperCase().match(/L[1-5]/);
  return (match?.[0] as DiagnosisSummary["stageLevel"] | undefined) ?? null;
}

function buildFocusReason(questionnaire: QuestionnaireAnswers, focus: FocusDirection, focusStrategy?: FocusStrategy) {
  const weightContext = "这不是价值判断，而是当前阶段的能力取舍。";
  const alignment = focusStrategy?.visionAlignment ? ` ${focusStrategy.visionAlignment}` : "";
  if (focus === "speed") return `当前选择速度优先。${weightContext} 你的关键压力来自“${questionnaire.aiConcern}”，优先缩短发现到响应的距离。${alignment}`;
  if (focus === "structure") return `当前选择结构优先。${weightContext} 你的关键压力来自“${questionnaire.aiConcern}”，优先把信息、系统和责任接成闭环。${alignment}`;
  return `当前选择适应优先。${weightContext} 你的关键压力来自“${questionnaire.aiConcern}”，优先让团队在变化中形成自我调节能力。${alignment}`;
}

function buildBenchmark(industry: string): DiagnosisSummary["benchmark"] {
  const base = industry.includes("制造") ? [32, 43, 25] : industry.includes("教育") ? [38, 29, 33] : [42, 34, 24];
  return [
    { focus: "speed", label: focusLabels.speed, ratio: base[0], averageWeeks: 4 },
    { focus: "structure", label: focusLabels.structure, ratio: base[1], averageWeeks: 6 },
    { focus: "adaptation", label: focusLabels.adaptation, ratio: base[2], averageWeeks: 8 },
  ];
}

function buildStageReason(questionnaire: QuestionnaireAnswers, responses: DiagnosisResponses, stageLevel: DiagnosisSummary["stageLevel"]) {
  const assessment = parseJson<Record<string, boolean | number>>(responses.stageAssessment);
  if (assessment) {
    const scores = normalizeStageScores(assessment);
    const summary = (["L1", "L2", "L3", "L4", "L5"] as const).map((level) => `${level} ${scores[level]}分`).join("，");
    return `五阶段自检按 1/3/5 分评分：${summary}。系统据此锁定为 ${stageLevel}。`;
  }
  const weakSignal = responses.stageContinuity || responses.stageClosedLoop || responses.stageRuleUpdate || questionnaire.aiConcern;
  return `问卷初始信号指向 ${stageMap[questionnaire.aiStageChoice]}，现场三问信号中最需要关注的是：${weakSignal}。当前锁定为 ${stageLevel}。`;
}

function focusFromWeights(weights: { speed: number; connection: number; emergence: number } | null): FocusDirection | null {
  if (!weights) return null;
  if (weights.connection >= weights.speed && weights.connection >= weights.emergence) return "structure";
  if (weights.emergence >= weights.speed && weights.emergence >= weights.connection) return "adaptation";
  return "speed";
}

function stageFromAssessment(assessment: Record<string, boolean | number> | null): DiagnosisSummary["stageLevel"] | null {
  if (!assessment) return null;
  const order = ["L1", "L2", "L3", "L4", "L5"] as const;
  const scores = normalizeStageScores(assessment);
  const highest = Math.max(...order.map((level) => scores[level]));
  if (highest <= 1) return "L1";
  return order.filter((level) => scores[level] === highest).at(-1) ?? "L1";
}

function normalizeStageScores(assessment: Record<string, boolean | number>) {
  const order = ["L1", "L2", "L3", "L4", "L5"] as const;
  return order.reduce((scores, level) => {
    const value = assessment[level];
    scores[level] = value === true ? 3 : value === 5 || value === 3 || value === 1 ? value : 1;
    return scores;
  }, {} as Record<(typeof order)[number], 1 | 3 | 5>);
}

function parseJson<T>(value: string | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function defaultWeekOneActions(diagnosis: DiagnosisSummary) {
  return [
    `找一位最懂“${diagnosis.business}”链路的一线骨干，问清当前最卡的一步。`,
    "确认第一步所需数据是否已经能拿到；拿不到先定位数据守门人。",
    "定义一个输入指标、一个过程指标和一个硬业务结果，作为首轮试运行验收口径。",
  ];
}

function buildTeamBrief(diagnosis: DiagnosisSummary, responses: DiagnosisResponses, candidate?: BlueprintCandidate) {
  const reflection = responses.focusReflection || "我们需要把 AI 从个人工具推进到业务闭环。";
  const loop = candidate?.seedLoopWeightedScore
    ? `第一火种回路根据用户手动评分锁定“${candidate.title}”，高价值评分 ${candidate.seedLoopWeightedScore}/100。`
    : candidate ? `第一火种回路建议锁定“${candidate.title}”，因为它最能把战略战场转化为可验证的业务实验。` : "第一火种回路将在蓝图中锁定。";
  return `我们选择${diagnosis.focusLabel}，因为${diagnosis.focusReason}${reflection} 当前判断为 ${diagnosis.stageLevel} ${diagnosis.stageName}。${loop}`;
}

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim().slice(0, 1000) : "";
}

function asRecord(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object") throw new Error("Invalid payload");
  return input as Record<string, unknown>;
}

function requiredText(value: unknown, label: string) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > 500) throw new Error(`${label} must contain 1-500 characters`);
  return text;
}

function optionalText(value: unknown) {
  const text = typeof value === "string" ? value.trim() : "";
  return text ? text.slice(0, 1000) : undefined;
}

function parseChoice<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value === "string" && allowed.includes(value as T)) return value as T;
  throw new Error(`${label} choice is invalid`);
}

function optionalTextList(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const list = value.map((item) => optionalText(item)).filter((item): item is string => Boolean(item));
  return list.length ? list : undefined;
}

function requiredTextList(value: unknown, label: string) {
  const list = optionalTextList(value);
  if (!list?.length) throw new Error(`${label} must contain at least one item`);
  return list;
}
