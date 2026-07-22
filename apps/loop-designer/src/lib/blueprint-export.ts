import "server-only";

import { resolveChromiumExecutablePath } from "./chromium";
import { STAGE_LADDER, getStageLadderItem, type BlueprintCandidate, type BlueprintOutput, type BlueprintStrategicInsights } from "./workflow";

export function blueprintToMarkdown(blueprint: BlueprintOutput) {
  const lines = [
    `# ${blueprint.strategicContext.organizationName} AI 化战略蓝图`,
    "",
    `> ${blueprint.strategicNarrative}`,
    "",
    "## 战略身份",
    "",
    `- 组织名称：${blueprint.strategicContext.organizationName}`,
    `- 行业：${blueprint.strategicContext.industry}`,
    `- 主营业务：${blueprint.strategicContext.business}`,
    `- 团队规模：${blueprint.strategicContext.scale}`,
    `- 使命：${blueprint.strategicContext.mission}`,
    `- 愿景：${blueprint.strategicContext.vision}`,
    `- 业务本质：${blueprint.strategicContext.businessEssence}`,
    `- 组织能力聚焦：${blueprint.strategicContext.focusLabel}`,
    `- 聚焦理由：${blueprint.strategicContext.focusReason}`,
    "",
    "## 五级阶梯",
    "",
    ...stageLadderLines(blueprint),
    "",
    "## 关键战场",
    "",
    `- 战场名称：${blueprint.battlefield.name}`,
    `- 战场范围：${blueprint.battlefield.scopeLabel}`,
    `- 战略意图：${blueprint.battlefield.strategicGoal}`,
    `- 怎么才算赢：${blueprint.battlefield.twelveMonthOutcome}`,
    `- 紧迫性：${blueprint.battlefield.urgency}`,
    "",
    "## 组织准备度",
    "",
    `- 平均得分：${blueprint.readiness.averageScore}/5`,
    `- 结论：${blueprint.readiness.conclusion}`,
    `- 主要风险：${blueprint.readiness.primaryRisk}`,
    `- 结构：${blueprint.readiness.structure.score}/5，${blueprint.readiness.structure.gap}`,
    `- 细胞：${blueprint.readiness.cell.score}/5，${blueprint.readiness.cell.gap}`,
    `- 环境：${blueprint.readiness.environment.score}/5，${blueprint.readiness.environment.gap}`,
    "",
  ];

  appendStrategicInsights(lines, blueprint.strategicInsights);
  appendRecommendedSeedLoop(lines, blueprint.recommendedSeedLoop);
  appendCandidates(lines, blueprint.candidates);
  lines.push(
    "## 场景排序",
    "",
    `- 最快启动：${blueprint.scenarioRankings.fastestStart}`,
    `- 长期价值最高：${blueprint.scenarioRankings.highestLongTermValue}`,
    `- 组织依赖最低：${blueprint.scenarioRankings.lowestOrgDependency}`,
    "",
    "## 周一启动清单",
    "",
    ...blueprint.mondayChecklist.map((item) => `- ${item}`),
    "",
    "## 团队简报",
    "",
    blueprint.teamBrief,
    "",
    `生成时间：${formatDateTime(blueprint.generatedAt)}`,
  );
  return lines.join("\n");
}

export async function renderBlueprintPdf(blueprint: BlueprintOutput) {
  const executablePath = resolveChromiumExecutablePath();
  const { default: puppeteer } = await import("puppeteer-core");
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  try {
    const page = await browser.newPage();
    const escaped = escapeHtml(blueprintToMarkdown(blueprint));
    await page.setContent(`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><style>
      @page{size:A4;margin:18mm}
      body{font-family:"Noto Sans CJK SC","PingFang SC",sans-serif;color:#17211e;line-height:1.72}
      main{white-space:pre-wrap;font-size:12px}
      h1{font-size:26px;color:#0d6b56}
      footer{margin-top:32px;color:#667;font-size:10px}
    </style></head><body><main>${escaped}</main><footer>碳硅组织进化工作室生成</footer></body></html>`, { waitUntil: "load" });
    return Buffer.from(await page.pdf({ format: "A4", printBackground: true }));
  } finally {
    await browser.close();
  }
}

function stageLadderLines(blueprint: BlueprintOutput) {
  const current = getStageLadderItem(blueprint.diagnosis.stageLevel);
  const currentIndex = STAGE_LADDER.findIndex((item) => item.level === current.level);
  const next = currentIndex >= 0 ? STAGE_LADDER[currentIndex + 1] : undefined;
  return [
    `- 当前阶段：${current.level} ${current.name}`,
    `- 业务解读：${current.businessMeaning}`,
    `- 判断依据：${blueprint.diagnosis.stageReason}`,
    `- 下一阶段升级代价：${next ? `迈向 ${next.level} ${next.name}：${next.upgradeCost}` : current.upgradeCost}`,
    "- 阶梯全貌：",
    ...STAGE_LADDER.map((item) => `  - ${item.level} ${item.name}：${item.businessMeaning}（升级代价：${item.upgradeCost}）`),
  ];
}

function appendStrategicInsights(lines: string[], insights?: BlueprintStrategicInsights) {
  lines.push("## AI 生成洞察", "");
  if (!insights) {
    lines.push("当前蓝图尚未包含真实 LLM 生成的全局洞察。", "");
    return;
  }
  lines.push(
    `- 生成模型：${insights.modelLabel}`,
    `- 生成时间：${formatDateTime(insights.generatedAt)}`,
    `- 摘要：${insights.summary}`,
    `- 战略判断：${insights.strategicJudgment}`,
    "",
    "### 关键洞察",
    "",
    ...insights.keyInsights.map((item) => `- **${item.title}**：${item.detail}（依据：${item.evidence}）`),
    "",
    "### 落地建议",
    "",
    ...insights.landingRecommendations.map((item) => `- **${item.title}**：${item.action}；周期：${item.timeframe}；负责人：${item.owner}`),
    "",
    "### 风险提醒",
    "",
    ...insights.riskAlerts.map((item) => `- **${item.risk}**：${item.whyItMatters}；缓解方式：${item.mitigation}`),
    "",
  );
}

function appendRecommendedSeedLoop(lines: string[], candidate: BlueprintCandidate | undefined) {
  lines.push("## 推荐火种回路", "");
  if (!candidate) {
    lines.push("尚未锁定推荐火种回路。", "");
    return;
  }
  appendCandidate(lines, candidate);
}

function appendCandidates(lines: string[], candidates: BlueprintCandidate[]) {
  lines.push("## 候选火种回路", "");
  candidates.forEach((candidate, index) => {
    lines.push(`### 候选 ${index + 1}：${candidate.title}`, "");
    appendCandidate(lines, candidate);
  });
}

function appendCandidate(lines: string[], candidate: BlueprintCandidate) {
  lines.push(
    `- 价值描述：${candidate.valueDescription}`,
    `- 触发源：${candidate.trigger}`,
    `- 业务结果：${candidate.outcome}`,
    `- AI 做什么：${candidate.aiRole}`,
    `- 人做什么：${candidate.humanRole}`,
    `- 成功标准：${candidate.successCriteria}`,
    `- 综合评分：${candidate.seedLoopWeightedScore ?? candidate.roiScore ?? candidate.score}`,
    `- 筛选依据：${candidate.evidence}`,
  );
  if (candidate.seedLoopScores) {
    lines.push(
      `- 真痛点评分：${candidate.seedLoopScores.pain}/5`,
      `- 数据评分：${candidate.seedLoopScores.data}/5`,
      `- 复制潜力评分：${candidate.seedLoopScores.replication}/5`,
      `- 风险可控度评分：${candidate.seedLoopScores.riskControl}/5`,
    );
  }
  if (candidate.seedLoopEvidence) {
    lines.push(
      `- 真痛点：${candidate.seedLoopEvidence.pain}`,
      `- 有数据：${candidate.seedLoopEvidence.data}`,
      `- 有人扛：${candidate.seedLoopEvidence.owner}`,
      `- 闭环短：${candidate.seedLoopEvidence.shortLoop}`,
    );
  }
  lines.push("- 周一行动：", ...candidate.weekOneActions.map((item) => `  - ${item}`), "");
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);
}
