import { buildSummary } from "./scoring";
import { demoReports } from "./demo-data";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { createNamespacedCache } from "@/lib/cache";
import type { AssessmentModule, EventSummary, QuestionDistribution, RunResponse, Insight, PaginatedResponses } from "./types";

type ReportRow = {
  stage_level: string | null;
  spiral_scores: { key: string; label: string; score: number }[] | null;
  energy_scores: { key: string; label: string; score: number }[] | null;
  chain_score: number | null;
  charter_score: number | null;
  primary_bottleneck: string | null;
};

// In-memory TTL caches for different data types
// Caches reduce database load and improve response times
// Note: In PM2 cluster mode, each worker has its own cache (use Redis for shared cache)
const eventSummaryCache = createNamespacedCache<EventSummary>("event", {
  ttl: 60_000, // 1 minute
  maxSize: 100,
});

const runResponsesCache = createNamespacedCache<PaginatedResponses>("runResponses", {
  ttl: 30_000, // 30 seconds
  maxSize: 50,
});

const questionDistributionsCache = createNamespacedCache<QuestionDistribution[]>("questionDistributions", {
  ttl: 60_000, // 1 minute
  maxSize: 100,
});

const stageAnswerScores: Record<string, number> = {
  not_yet: 1,
  occasional: 3,
  stable: 5,
};

function toDistributionScore(answer: number | string | null, module: string): number | null {
  if (typeof answer === "number") return answer;
  if (module === "stage" && typeof answer === "string") {
    return stageAnswerScores[answer] ?? null;
  }
  return null;
}

function countLowestDimensionScores(
  rows: ReportRow[],
  scoreField: "spiral_scores" | "energy_scores",
  labels: Record<string, string>,
): Record<string, number> {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const scores = row[scoreField] ?? [];
    const validScores = scores.filter((score) => Number.isFinite(Number(score.score)) && labels[score.key]);
    if (!validScores.length) return acc;

    const lowestScore = [...validScores].sort((a, b) => Number(a.score) - Number(b.score))[0];
    const key = labels[lowestScore.key] ?? lowestScore.label ?? lowestScore.key;
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

export async function getEventSummary(eventSlug: string): Promise<EventSummary> {
  // Check cache first (fast path for repeat requests)
  const cached = eventSummaryCache.getSync(eventSlug);
  if (cached) {
    return cached;
  }

  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    const summary = buildSummary(eventSlug, demoReports());
    eventSummaryCache.set(eventSlug, summary);
    return summary;
  }

  const { data: event } = await supabase.from("events").select("id,title,slug").eq("slug", eventSlug).maybeSingle();

  if (!event?.id) {
    const summary = buildSummary(eventSlug, demoReports());
    eventSummaryCache.set(eventSlug, summary);
    return summary;
  }

  // Get assessments
  const { data: assessments } = await supabase
    .from("assessments")
    .select("id")
    .eq("event_id", event.id)
    .eq("status", "submitted");

  const assessmentIds = (assessments ?? []).map((item: { id: string }) => item.id);

  if (!assessmentIds.length) {
    // Return empty summary when database is accessible but no assessments yet
    const emptySummary = {
      eventSlug,
      title: event.title ?? "碳硅共生：AI时代的组织进化工作坊",
      participantCount: 0,
      completedCount: 0,
      stageDistribution: {},
      spiralBottlenecks: {},
      energyBottlenecks: {},
      averageChainScore: 0,
      averageCharterScore: 0,
      openAnswerHighlights: [],
    };
    eventSummaryCache.set(eventSlug, emptySummary);
    return emptySummary;
  }

  // Parallelize independent queries (reports + open answers)
  // This reduces total time from 4 sequential queries to ~2 parallel queries
  const [reportsResult, openAnswersResult] = await Promise.all([
    // Get all reports for these assessments
    supabase
      .from("reports")
      .select("stage_level, spiral_scores, energy_scores, chain_score, charter_score, primary_bottleneck")
      .in("assessment_id", assessmentIds),

    // Get open-ended answers
    supabase
      .from("assessment_answers")
      .select("text_value")
      .in("assessment_id", assessmentIds)
      .in("question_id", ["open_scenario", "open_workflow", "open_blocker"])
      .limit(12),
  ]);

  const reports = reportsResult.data;
  const openAnswers = openAnswersResult.data;

  const rows = (reports ?? []) as ReportRow[];

  const stageDistribution = rows.reduce<Record<string, number>>((acc, row) => {
    const key = row.stage_level ?? "未判断";
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  const bottleneckLabels: Record<string, string> = {
    structure: "结构层",
    cell: "细胞层",
    environment: "环境层",
    meaning: "意义",
    power: "权力",
    trust: "信任",
    chain: "人机链路准备度",
    charter: "AI 宪章准备度",
  };

  const spiralBottlenecks = countLowestDimensionScores(rows, "spiral_scores", {
    structure: bottleneckLabels.structure,
    cell: bottleneckLabels.cell,
    environment: bottleneckLabels.environment,
  });

  const energyBottlenecks = countLowestDimensionScores(rows, "energy_scores", {
    meaning: bottleneckLabels.meaning,
    power: bottleneckLabels.power,
    trust: bottleneckLabels.trust,
  });

  const average = (values: number[]) =>
    values.length ? Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1)) : 0;

  const summary: EventSummary = {
    eventSlug,
    title: event.title ?? "碳硅共生：AI时代的组织进化工作坊",
    participantCount: assessmentIds.length,
    completedCount: rows.length,
    stageDistribution,
    spiralBottlenecks,
    energyBottlenecks,
    averageChainScore: average(rows.map((row) => Number(row.chain_score ?? 0)).filter(Boolean)),
    averageCharterScore: average(rows.map((row) => Number(row.charter_score ?? 0)).filter(Boolean)),
    openAnswerHighlights: (openAnswers ?? [])
      .map((row: { text_value: string | null }) => row.text_value)
      .filter((value): value is string => Boolean(value)),
  };

  // Cache the result for future requests
  eventSummaryCache.set(eventSlug, summary);

  return summary;
}

// Test participant filter pattern
const TEST_PATTERN = /测试|test|codex|验收|演示|demo|smoke/i;

function isTestParticipant(name: string, company: string | null, contact: string | null): boolean {
  const text = `${name} ${company ?? ""} ${contact ?? ""}`.toLowerCase();
  return TEST_PATTERN.test(text);
}

// Get all responses with full detail for admin table
export async function getRunResponses(
  eventSlug: string,
  options?: { page?: number; pageSize?: number; excludeTest?: boolean },
): Promise<PaginatedResponses> {
  const page = options?.page ?? 1;
  const pageSize = options?.pageSize ?? 50;
  const excludeTest = options?.excludeTest ?? true;

  // Check cache first (fast path for repeat requests)
  const cacheKey = `${eventSlug}:${page}:${pageSize}:${excludeTest}`;
  const cached = runResponsesCache.getSync(cacheKey);
  if (cached) {
    return cached;
  }

  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    return { responses: [], pagination: { page: 1, total: 0, pageSize, totalPages: 0 } };
  }

  const { data: event } = await supabase.from("events").select("id").eq("slug", eventSlug).maybeSingle();
  if (!event?.id) {
    return { responses: [], pagination: { page: 1, total: 0, pageSize, totalPages: 0 } };
  }

  // Fetch all participants (with optional test filtering)
  const participantsQuery = supabase
    .from("participants")
    .select("id,display_name,role,industry,org_size,company_name,contact,created_at")
    .eq("event_id", event.id)
    .order("created_at", { ascending: false });

  const { data: allParticipants } = await participantsQuery;
  const participants = (allParticipants ?? []).filter((p) =>
    !excludeTest || !isTestParticipant(p.display_name, p.company_name, p.contact),
  );

  // Fetch all submitted assessments
  const { data: assessments } = await supabase
    .from("assessments")
    .select("id,participant_id,submitted_at")
    .eq("event_id", event.id)
    .eq("status", "submitted");

  const assessmentMap = new Map((assessments ?? []).map((a) => [a.participant_id, a]));

  // Fetch all reports and answers in parallel
  const submittedAssessmentIds = (assessments ?? []).map((a) => a.id);
  const [reportsResult, answersResult] = await Promise.all([
    supabase
      .from("reports")
      .select("assessment_id,stage_level,next_level,spiral_scores,energy_scores,chain_score,charter_score,primary_bottleneck")
      .in("assessment_id", submittedAssessmentIds),

    supabase
      .from("assessment_answers")
      .select("assessment_id,question_id,numeric_value,text_value")
      .in("assessment_id", submittedAssessmentIds),
  ]);

  const reports = reportsResult.data;
  const answers = answersResult.data;

  const reportMap = new Map((reports ?? []).map((r) => [r.assessment_id, r]));

  const answersByAssessment = new Map<string, Record<string, number | string | null>>();
  for (const answer of answers ?? []) {
    const existing = answersByAssessment.get(answer.assessment_id) ?? {};
    existing[answer.question_id] = answer.numeric_value ?? answer.text_value ?? null;
    answersByAssessment.set(answer.assessment_id, existing);
  }

  // Build responses array with explicit typing
  const responsesRaw: (RunResponse | null)[] = participants.map((participant) => {
    const assessment = assessmentMap.get(participant.id);
    if (!assessment) return null;

    const report = reportMap.get(assessment.id);
    if (!report) return null;

    return {
      assessmentId: assessment.id,
      participantId: participant.id,
      participantName: participant.display_name,
      role: participant.role,
      industry: participant.industry,
      orgSize: participant.org_size,
      companyName: participant.company_name,
      submittedAt: assessment.submitted_at ?? participant.created_at,
      stageLevel: report.stage_level ?? "N/A",
      nextLevel: report.next_level ?? "N/A",
      spiralScores: (report.spiral_scores as { key: string; label: string; score: number }[] | null) ?? [],
      energyScores: (report.energy_scores as { key: string; label: string; score: number }[] | null) ?? [],
      chainScore: Number(report.chain_score ?? 0),
      charterScore: Number(report.charter_score ?? 0),
      primaryBottleneck: report.primary_bottleneck ?? "N/A",
      answers: answersByAssessment.get(assessment.id) ?? {},
    };
  });

  const responsesList = responsesRaw.filter((r): r is RunResponse => r !== null);
  responsesList.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  // Pagination
  const total = responsesList.length;
  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize;
  const paginatedResponses = responsesList.slice(start, start + pageSize);

  const result = {
    responses: paginatedResponses,
    pagination: { page, total, pageSize, totalPages },
  };

  // Cache the result for future requests
  runResponsesCache.set(cacheKey, result);

  return result;
}

// Get question-level distribution analysis
export async function getQuestionDistributions(eventSlug: string): Promise<QuestionDistribution[]> {
  // Check cache first
  const cached = questionDistributionsCache.getSync(eventSlug);
  if (cached) {
    return cached;
  }

  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    return [];
  }

  const { data: event } = await supabase.from("events").select("id").eq("slug", eventSlug).maybeSingle();
  if (!event?.id) return [];

  const { data: assessments } = await supabase
    .from("assessments")
    .select("id")
    .eq("event_id", event.id)
    .eq("status", "submitted");

  const assessmentIds = (assessments ?? []).map((a: { id: string }) => a.id);
  if (!assessmentIds.length) return [];

  // Parallelize independent queries (answers + questions)
  const [answersResult, questionsResult] = await Promise.all([
    supabase
      .from("assessment_answers")
      .select("question_id,numeric_value,text_value")
      .in("assessment_id", assessmentIds),

    supabase.from("questions").select("id,title,module,dimension,sort_order").order("sort_order"),
  ]);

  const answers = answersResult.data;
  const questions = questionsResult.data;

  if (!questions?.length) return [];

  // Group answers by question
  const answersByQuestion = new Map<string, (number | string | null)[]>();
  for (const answer of answers ?? []) {
    const existing = answersByQuestion.get(answer.question_id) ?? [];
    existing.push(answer.numeric_value ?? answer.text_value ?? null);
    answersByQuestion.set(answer.question_id, existing);
  }

  // Module title mapping
  const moduleTitles: Record<string, string> = {
    stage: "五级阶梯",
    spiral: "三螺旋",
    energy: "意义-权力-信任",
    chain: "人机链路准备度",
    charter: "AI 宪章准备度",
  };

  const distributions = (questions as { id: string; title: string; module: string; dimension?: string; sort_order: number }[])
    .filter((q) => q.module !== "open")
    .map((question) => {
      const questionAnswers = answersByQuestion.get(question.id) ?? [];
      const numericAnswers = questionAnswers
        .map((answer) => toDistributionScore(answer, question.module))
        .filter((answer): answer is number => answer !== null);

      // Calculate distribution (for scale questions, 1-5)
      const distribution: Record<string, number> = {};
      for (const answer of numericAnswers) {
        const key = String(Math.round(answer));
        distribution[key] = (distribution[key] ?? 0) + 1;
      }

      // Calculate average
      const average = numericAnswers.length
        ? Number((numericAnswers.reduce((sum, v) => sum + v, 0) / numericAnswers.length).toFixed(2))
        : 0;

      // Detect outliers (questions with very high or low average compared to expected)
      const outliers: string[] = [];
      if (average >= 4.5) {
        outliers.push("平均分极高（≥4.5），可能群体在此问题上普遍较强");
      } else if (average <= 1.5) {
        outliers.push("平均分极低（≤1.5），可能群体在此问题上普遍较弱");
      }

      return {
        questionId: question.id,
        questionText: question.title,
        module: question.module as AssessmentModule,
        dimension: question.dimension,
        moduleTitle: moduleTitles[question.module] ?? question.module,
        sortOrder: question.sort_order,
        responseCount: questionAnswers.length,
        distribution,
        averageScore: average,
        outliers,
      };
    })
    .sort((a, b) => {
      const order = ["stage", "spiral", "energy", "chain", "charter"];
      return order.indexOf(a.module) - order.indexOf(b.module) || a.sortOrder - b.sortOrder;
    });

  // Cache the result before returning
  questionDistributionsCache.set(eventSlug, distributions);
  return distributions;
}
export async function generateInsightsForRun(eventSlug: string): Promise<Insight[]> {
  const summary = await getEventSummary(eventSlug);
  const distributions = await getQuestionDistributions(eventSlug);

  const insights: Insight[] = [];

  // 1. Key finding: Stage distribution
  const stageEntries = Object.entries(summary.stageDistribution);
  if (stageEntries.length > 0) {
    const [topStage, topCount] = stageEntries.sort((a, b) => b[1] - a[1])[0];
    const percentage = ((topCount / summary.completedCount) * 100).toFixed(0);
    insights.push({
      type: "finding",
      priority: "high",
      title: `群体最集中的阶段：${topStage}`,
      description: `${topCount} 人（${percentage}%）处于 ${topStage} 阶段，这是当前群体的主要转型位置。`,
      supportingData: [topStage, `${topCount}/${summary.completedCount}`, `${percentage}%`],
      discussionQuestions: [
        `${topStage} 对应的转型任务是什么？这个群体已经具备了哪些基础？`,
        "哪些外部因素或内部条件让大部分参与者停留在这一阶段？",
      ],
    });
  }

  // 2. Progression analysis: Check if stuck at same level
  const stageQuestions = distributions.filter((d) => d.module === "stage");
  if (stageQuestions.length >= 2) {
    const scores = stageQuestions.map((q) => q.averageScore);
    const variance = scores.reduce((sum, s) => sum + Math.pow(s - average(scores), 2), 0) / scores.length;
    const stdDev = Math.sqrt(variance);

    if (stdDev < 0.5 && average(scores) < 3) {
      insights.push({
        type: "progression",
        priority: "high",
        title: "群体转型进展相对停滞",
        description: `五级阶梯问题标准差仅 ${stdDev.toFixed(2)}，说明群体在多个阶段上的感知相近，可能处于转型 plateau 期。`,
        supportingData: stageQuestions.map((q) => `${q.dimension}: ${q.averageScore.toFixed(2)}`),
        discussionQuestions: [
          "这种'全面偏低但差异不大'的模式，反映的是资源不足还是方向不清？",
          "如果只能推进一个阶段的突破，应该选哪一个？",
        ],
      });
    }
  }

  // 3. Gap analysis: Chain vs Charter
  const gap = summary.averageChainScore - summary.averageCharterScore;
  const absGap = Math.abs(gap);
  if (absGap >= 1) {
    const direction = gap > 0 ? "实验能力强，治理能力弱" : "治理能力强，实验能力弱";
    insights.push({
      type: "gap",
      priority: "high",
      title: direction,
      description: `人机链路准备度 (${summary.averageChainScore}) 与 AI 宪章准备度 (${summary.averageCharterScore}) 相差 ${absGap.toFixed(1)} 分，说明组织在实验和治理两个维度上的发展不均衡。`,
      supportingData: [
        `链路均值: ${summary.averageChainScore}/5.0`,
        `宪章均值: ${summary.averageCharterScore}/5.0`,
        `差距: ${absGap.toFixed(1)} 分`,
      ],
      discussionQuestions: [
        "这个差距反映了组织的什么现实？",
        "如果先加强薄弱项，会对整体转型有什么影响？",
      ],
    });
  }

  // 4. Bottleneck clustering
  const spiralEntries = Object.entries(summary.spiralBottlenecks);
  if (spiralEntries.length > 0) {
    const [topBottleneck, topCount] = spiralEntries.sort((a, b) => b[1] - a[1])[0];
    const percentage = ((topCount / summary.completedCount) * 100).toFixed(0);
    insights.push({
      type: "finding",
      priority: "medium",
      title: `三螺旋主要短板：${topBottleneck}`,
      description: `${topCount} 人（${percentage}%）的主要瓶颈在 ${topBottleneck}，这是当前群体最需要关注的结构性挑战。`,
      supportingData: spiralEntries.map(([k, v]) => `${k}: ${v}人`),
      discussionQuestions: [
        `${topBottleneck} 在你们的组织中具体表现是什么？`,
        "解决这一层瓶颈需要哪些条件？",
      ],
    });
  }

  // 5. Energy bottleneck analysis
  const energyEntries = Object.entries(summary.energyBottlenecks);
  if (energyEntries.length > 0) {
    const [topEnergyBottleneck, topCount] = energyEntries.sort((a, b) => b[1] - a[1])[0];
    const percentage = ((topCount / summary.completedCount) * 100).toFixed(0);

    if (topEnergyBottleneck === "权力" || topEnergyBottleneck === "意义") {
      insights.push({
        type: "finding",
        priority: "high",
        title: `隐性能量卡点：${topEnergyBottleneck}冲突显著`,
        description: `${topCount} 人（${percentage}%）的主要隐性能量卡点在 ${topEnergyBottleneck}，这可能意味着组织在决策权或价值对齐层面存在深层张力。`,
        supportingData: energyEntries.map(([k, v]) => `${k}: ${v}人`),
        discussionQuestions: [
          `${topEnergyBottleneck} 冲突的具体场景是什么？`,
          "如果这个问题得不到解决，会对转型产生什么阻碍？",
        ],
      });
    } else {
      insights.push({
        type: "finding",
        priority: "medium",
        title: `隐性能量卡点：${topEnergyBottleneck}需要关注`,
        description: `${topCount} 人（${percentage}%）的主要隐性能量卡点在 ${topEnergyBottleneck}。`,
        supportingData: energyEntries.map(([k, v]) => `${k}: ${v}人`),
        discussionQuestions: [`${topEnergyBottleneck} 在你们的组织中具体表现是什么？`],
      });
    }
  }

  // 6. Identify lowest scoring questions
  const lowScoringQuestions = distributions
    .filter((d) => d.module !== "stage" && d.averageScore < 2.5)
    .sort((a, b) => a.averageScore - b.averageScore)
    .slice(0, 3);

  if (lowScoringQuestions.length > 0) {
    insights.push({
      type: "finding",
      priority: "medium",
      title: "得分最低的三个问题",
      description: "以下问题平均分低于 2.5，可能是组织需要优先改进的领域。",
      supportingData: lowScoringQuestions.map((q) => `${q.moduleTitle} - ${q.questionText.substring(0, 30)}...: ${q.averageScore.toFixed(2)}`),
      discussionQuestions: [
        "这些问题得分低是因为缺乏意识、缺乏资源还是缺乏能力？",
        "如果这些问题得到改善，会对其他模块产生什么连锁反应？",
      ],
    });
  }

  // 7. Chain-Charter balance recommendation
  if (absGap < 1 && summary.averageChainScore >= 3.5 && summary.averageCharterScore >= 3.5) {
    insights.push({
      type: "action",
      priority: "low",
      title: "实验与治理能力相对均衡",
      description: `链路 (${summary.averageChainScore}) 和宪章 (${summary.averageCharterScore}) 均值都在 3.5 以上，说明组织在实验和治理两个维度上都有一定基础。`,
      supportingData: [
        `链路均值: ${summary.averageChainScore}`,
        `宪章均值: ${summary.averageCharterScore}`,
        `差距: ${absGap.toFixed(1)} 分`,
      ],
      discussionQuestions: [
        "这种平衡状态在你们的组织中是如何实现的？",
        "下一步是继续加强实验能力还是治理能力？",
      ],
    });
  }

  // 8. High-performing questions
  const highScoringQuestions = distributions
    .filter((d) => d.module !== "stage" && d.averageScore >= 4)
    .sort((a, b) => b.averageScore - a.averageScore)
    .slice(0, 3);

  if (highScoringQuestions.length > 0) {
    insights.push({
      type: "finding",
      priority: "low",
      title: "群体优势领域",
      description: "以下问题得分较高（≥4.0），反映了群体的组织优势。",
      supportingData: highScoringQuestions.map((q) => `${q.moduleTitle} - ${q.questionText.substring(0, 30)}...: ${q.averageScore.toFixed(2)}`),
      discussionQuestions: [
        "这些优势如何帮助组织在 AI 转型中加速？",
        "如何将这些优势复制到其他薄弱领域？",
      ],
    });
  }

  return insights;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(2));
}

// Recalculate summary (placeholder - can be extended for caching)
export async function recalculateSummary(eventSlug: string): Promise<EventSummary> {
  return getEventSummary(eventSlug);
}
