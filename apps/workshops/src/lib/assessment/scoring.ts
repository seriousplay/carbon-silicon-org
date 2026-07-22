import { questions } from "./questions";
import type {
  AnswerValue,
  AssessmentAnswers,
  DimensionScore,
  EventSummary,
  ParticipantProfile,
  Report,
  StageAnswer,
} from "./types";

const stageLabels: Record<string, string> = {
  L0: "L0 尚未启动",
  L1: "L1 工具上手",
  L2: "L2 流程嵌入",
  L3: "L3 团队重构",
  L4: "L4 系统重写",
  L5: "L5 碳硅共生",
};

const spiralLabels: Record<string, string> = {
  structure: "结构层",
  cell: "细胞层",
  environment: "环境层",
};

const energyLabels: Record<string, string> = {
  meaning: "意义",
  power: "权力",
  trust: "信任",
};

function asNumber(value: AnswerValue | undefined): number {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function average(values: number[]): number {
  if (!values.length) return 0;
  return Number((values.reduce((sum, value) => sum + value, 0) / values.length).toFixed(1));
}

function readinessAverage(answers: AssessmentAnswers): number {
  return average(
    questions
      .filter((question) => question.type === "scale")
      .map((question) => asNumber(answers[question.id])),
  );
}

function calculateStage(answers: AssessmentAnswers) {
  const stageIds = ["stage_l1", "stage_l2", "stage_l3", "stage_l4", "stage_l5"];
  let stableCount = 0;

  for (const id of stageIds) {
    if ((answers[id] as StageAnswer) === "stable") {
      stableCount += 1;
    } else {
      break;
    }
  }

  const nextStageAnswer = stableCount < stageIds.length ? (answers[stageIds[stableCount]] as StageAnswer | undefined) : undefined;
  const hasStrongReadinessSignal = stableCount === 0 && readinessAverage(answers) >= 3.5;
  const inProgressCount =
    stableCount < 5 && (nextStageAnswer === "occasional" || hasStrongReadinessSignal) ? stableCount + 1 : stableCount;
  const current = `L${inProgressCount}`;
  const next = stableCount >= 5 ? "L5" : `L${stableCount + 1}`;
  const isInProgress = inProgressCount > stableCount;

  const summaries: Record<string, string> = {
    L0: "组织还没有形成可验证的 AI 使用事实，适合先从真实任务和第一批先行者开始。",
    L1: "组织已经开始工具上手，但还需要把个人效率转化为流程能力。",
    L2: "AI 已经进入部分流程，下一步要把人机分工、验收和复用机制做扎实。",
    L3: "组织已经出现人机混合团队雏形，下一步会触及权力、激励和治理规则。",
    L4: "AI 转型已经进入系统重写阶段，关键在于让治理、责任和组织记忆稳定运行。",
    L5: "AI 协作正在成为默认工作方式，下一步重点是边界、责任和长期进化机制。",
  };

  const inProgressSummaries: Record<string, string> = {
    L1: "组织已经出现 AI 使用或较强准备度信号，但 L1 还没有稳定成立。下一步重点不是继续打分，而是把工具上手变成跨关键部门可复跑的使用事实。",
    L2: "组织已经触碰到流程嵌入，但 L2 还没有稳定成立。下一步要把 AI 输出写进标准工作流，并明确输入、输出和验收标准。",
    L3: "组织已经出现人机混合团队的雏形，但 L3 还没有稳定成立。下一步要让协作方式能被第二个团队复用。",
    L4: "组织已经开始进入系统重写议题，但 L4 还没有稳定成立。下一步要把验收标准、跨职能联盟和业务结果绑定起来。",
    L5: "组织已经接近碳硅共生状态，但 L5 还没有稳定成立。下一步要让治理、责任和长期进化机制成为默认工作方式。",
  };

  return {
    current,
    currentLabel: isInProgress ? `${stageLabels[current]}（进行中）` : stageLabels[current],
    next,
    nextLabel: isInProgress ? `${stageLabels[next]}（稳定化）` : stageLabels[next],
    summary: isInProgress ? inProgressSummaries[current] : summaries[current],
  };
}

function scoresByDimension(
  answers: AssessmentAnswers,
  module: "spiral" | "energy",
  labels: Record<string, string>,
): DimensionScore[] {
  const grouped = new Map<string, number[]>();

  questions
    .filter((question) => question.module === module && question.dimension)
    .forEach((question) => {
      const key = question.dimension as string;
      const values = grouped.get(key) ?? [];
      values.push(asNumber(answers[question.id]));
      grouped.set(key, values);
    });

  return Array.from(grouped.entries()).map(([key, values]) => ({
    key,
    label: labels[key] ?? key,
    score: average(values),
  }));
}

function scoreModule(answers: AssessmentAnswers, module: "chain" | "charter"): number {
  return average(
    questions
      .filter((question) => question.module === module)
      .map((question) => asNumber(answers[question.id])),
  );
}

function lowest(
  items: { key: string; label: string; score: number; category: string }[],
) {
  return [...items].sort((a, b) => a.score - b.score)[0];
}

function recommendationFor(stage: string, bottleneck: string) {
  if (stage === "L0" || stage === "L1") {
    return {
      title: "先把 AI 从个人试用推进到一条真实流程",
      rationale: "当前最重要的不是继续增加工具培训，而是选择一条高频、可回滚、有明确价值信号的工作流。",
      steps: [
        "选出一条 7-30 天内能试跑的 HR/OD 或业务流程。",
        "写清输入、输出、负责人和最小验收标准。",
        "让一个小团队完成两轮复跑，并沉淀模板或清单。",
      ],
    };
  }

  const map: Record<string, { title: string; rationale: string; steps: string[] }> = {
    structure: {
      title: "先补业务锚点和价值流动",
      rationale: "结构层偏弱时，AI 项目容易停在工具试用或技术展示，无法进入真实业务结果。",
      steps: [
        "为一个 AI 试点绑定明确业务负责人。",
        "把项目成功标准从使用次数改成业务或组织指标。",
        "清理一个跨部门卡点，明确输入、输出和责任归属。",
      ],
    },
    cell: {
      title: "设计第一个人机混合任务单元",
      rationale: "细胞层偏弱时，AI 只是在末端辅助个人，组织没有长出可复制的协作单元。",
      steps: [
        "选一条任务链路，写出人、AI、自动化分别负责什么。",
        "为 AI 输出配置验收清单和人工裁决点。",
        "复跑两轮，把接口文档和提示词沉淀为资产包。",
      ],
    },
    environment: {
      title: "先处理意义、授权和试错条件",
      rationale: "环境层偏弱时，人人都说支持 AI，但流程和权力会系统性防守。",
      steps: [
        "把试点目标翻译成团队能听懂的业务意义。",
        "明确试点团队拥有的决策权、资源权和容错边界。",
        "建立一次复盘机制，把错误沉淀为规则而不是追责。",
      ],
    },
    meaning: {
      title: "把 AI 项目翻译成组织为什么要做",
      rationale: "意义偏弱时，员工只会看到工具压力或替代风险，很难形成主动参与。",
      steps: [
        "写清 AI 试点解决谁的什么痛点。",
        "说明这条链路成功后，人的角色会如何升级。",
        "把目标嵌入一次团队复盘或管理层沟通。",
      ],
    },
    power: {
      title: "重新划定试点团队的权力边界",
      rationale: "权力偏弱时，AI 试点会被旧流程反复拉回原状。",
      steps: [
        "列出试点团队必须拥有的三类权力：决策、资源、容错。",
        "明确哪些事项可以自主决定，哪些必须升级审批。",
        "让业务负责人为最终结果背书。",
      ],
    },
    trust: {
      title: "用接口契约和验证回路建立信任",
      rationale: "信任偏弱时，AI 输出和跨部门协作都会变成反复确认和责任漂移。",
      steps: [
        "为一条协作链路写输入、输出、标准、时间窗和责任归属。",
        "为关键 AI 输出设置日志、复核和回滚机制。",
        "下一轮协作只按契约执行，并复盘哪里需要修订。",
      ],
    },
    chain: {
      title: "先把工作流切小，再谈规模化",
      rationale: "人机链路准备度偏低时，直接推大项目会放大不确定性。",
      steps: [
        "选择一条允许回滚的真实工作流。",
        "把链路拆成 4-6 个关键节点。",
        "只在一个节点先引入 AI，并定义验收信号。",
      ],
    },
    charter: {
      title: "先写出 AI 使用边界和责任主体",
      rationale: "宪章准备度偏低时，高风险 HR/OD 场景容易损害组织信任。",
      steps: [
        "列出正在使用或计划使用 AI 的场景。",
        "为高风险场景写出禁用事项和人工复核要求。",
        "明确 AI 出错后的责任人、证据保留和申诉通道。",
      ],
    },
  };

  return map[bottleneck] ?? map.chain;
}

function toolsFor(stage: string, bottleneck: string): string[] {
  const base = ["ai-transformation-ladder", "spiral-diagnosis"];
  const byBottleneck: Record<string, string[]> = {
    structure: ["business-anchor-check", "human-ai-chain"],
    cell: ["hybrid-intelligence-cell", "human-ai-chain"],
    environment: ["meaning-alignment", "power-boundary", "ai-charter"],
    meaning: ["meaning-alignment", "trust-interface-workshop"],
    power: ["power-boundary", "business-anchor-check"],
    trust: ["interface-contract", "ai-charter"],
    chain: ["human-ai-chain", "hybrid-intelligence-cell"],
    charter: ["ai-charter", "interface-contract"],
  };

  if (stage === "L0" || stage === "L1") {
    return ["ai-transformation-ladder", "human-ai-chain", "business-anchor-check"];
  }

  return Array.from(new Set([...base, ...(byBottleneck[bottleneck] ?? [])])).slice(0, 4);
}

export function buildReport(
  eventSlug: string,
  participant: ParticipantProfile,
  answers: AssessmentAnswers,
  id = `local-${Date.now()}`,
): Report {
  const stage = calculateStage(answers);
  const spiralScores = scoresByDimension(answers, "spiral", spiralLabels);
  const energyScores = scoresByDimension(answers, "energy", energyLabels);
  const chainScore = scoreModule(answers, "chain");
  const charterScore = scoreModule(answers, "charter");

  const primaryBottleneck = lowest([
    ...spiralScores.map((score) => ({ ...score, category: "三螺旋" })),
    ...energyScores.map((score) => ({ ...score, category: "隐性能量" })),
    { key: "chain", label: "人机链路准备度", score: chainScore, category: "链路实验" },
    { key: "charter", label: "AI 宪章准备度", score: charterScore, category: "治理边界" },
  ]);

  return {
    id,
    eventSlug,
    participant,
    createdAt: new Date().toISOString(),
    stageLevel: stage.currentLabel,
    nextLevel: stage.nextLabel,
    stageSummary: stage.summary,
    spiralScores,
    energyScores,
    chainScore,
    charterScore,
    primaryBottleneck,
    actionRecommendation: recommendationFor(stage.current, primaryBottleneck.key),
    recommendedTools: toolsFor(stage.current, primaryBottleneck.key),
    openAnswers: {
      scenario: answers.open_scenario as string | undefined,
      workflow: answers.open_workflow as string | undefined,
      blocker: answers.open_blocker as string | undefined,
    },
  };
}

export function buildSummary(eventSlug: string, reports: Report[], title = "碳硅共生：AI时代的组织进化工作坊"): EventSummary {
  const countBy = (items: string[]) =>
    items.reduce<Record<string, number>>((acc, item) => {
      acc[item] = (acc[item] ?? 0) + 1;
      return acc;
    }, {});

  const countLowest = (scoreGroups: DimensionScore[][]) =>
    scoreGroups.reduce<Record<string, number>>((acc, scores) => {
      if (!scores.length) return acc;
      const lowestScore = [...scores].sort((a, b) => a.score - b.score)[0];
      acc[lowestScore.label] = (acc[lowestScore.label] ?? 0) + 1;
      return acc;
    }, {});

  return {
    eventSlug,
    title,
    participantCount: reports.length,
    completedCount: reports.length,
    stageDistribution: countBy(reports.map((report) => report.stageLevel)),
    spiralBottlenecks: countLowest(reports.map((report) => report.spiralScores)),
    energyBottlenecks: countLowest(reports.map((report) => report.energyScores)),
    averageChainScore: average(reports.map((report) => report.chainScore)),
    averageCharterScore: average(reports.map((report) => report.charterScore)),
    openAnswerHighlights: reports
      .flatMap((report) => [report.openAnswers.scenario, report.openAnswers.workflow, report.openAnswers.blocker])
      .filter((answer): answer is string => Boolean(answer && answer.trim()))
      .slice(0, 12),
  };
}

export const demoParticipant: ParticipantProfile = {
  displayName: "工作坊参与者",
  role: "HR 一号位",
  industry: "科技 / 制造 / 专业服务",
  orgSize: "500-2000 人",
};
