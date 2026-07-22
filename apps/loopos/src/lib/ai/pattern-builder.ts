/**
 * AI 机制建设者：治理日志起草
 *
 * 基于 docs/06-AI能力边界与降级.md 2.3 节
 * - 月度从追踪表+会议+变更自动起草治理日志
 * - 模式假设列表优先（docs/06 治理 P1-2 质量保证）
 * - 可信度评分（数据量、确认率）
 * - 100% 人工审核后发布
 */
import { askAI, isAIAvailable } from "./provider";
import { prisma } from "@/lib/db";

export type GovernanceLogDraft = {
  title: string;
  content: string;
  patterns: string[];
  risks: string;
  credibilityScore: number;
};

/**
 * 从组织过去一个月的数据起草治理日志
 * 返回 null 表示 AI 不可用或数据不足
 */
export async function draftGovernanceLog(
  orgId: string,
  period: string // "2026-07"
): Promise<GovernanceLogDraft | null> {
  if (!isAIAvailable()) return null;

  // 计算时间范围
  const [year, month] = period.split("-").map(Number);
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);

  // 收集本月数据
  const [tensions, blockers, decisions, changes, meetings] = await Promise.all([
    prisma.tension.findMany({
      where: { organizationId: orgId, createdAt: { gte: start, lt: end } },
      include: { circles: { select: { name: true } } },
      take: 50,
    }),
    prisma.tension.findMany({
      where: { organizationId: orgId, createdAt: { gte: start, lt: end } },
      include: { circle: { select: { name: true } }, owner: { select: { name: true } } },
      take: 50,
    }),
    prisma.decisionRecord.findMany({
      where: { organizationId: orgId, effectiveAt: { gte: start, lt: end } },
      take: 30,
    }),
    prisma.changeLog.findMany({
      where: { organizationId: orgId, effectiveAt: { gte: start, lt: end } },
      take: 30,
    }),
    prisma.meeting.findMany({
      where: { organizationId: orgId, startedAt: { gte: start, lt: end } },
      take: 20,
    }),
  ]);

  // 可信度评估（docs/06 质量保证）
  const dataPoints = tensions.length + blockers.length + decisions.length;
  const credibilityScore = dataPoints < 5 ? 0.3 : dataPoints < 15 ? 0.6 : 0.8;

  // 构建上下文
  const tensionSummary = tensions
    .slice(0, 10)
    .map((t) => `- [${t.circles[0]?.name ?? "未分类"}] ${t.title}（${t.status}）`)
    .join("\n");

  const blockerSummary = blockers
    .slice(0, 10)
    .map((b) => `- [${b.circle?.name ?? "未分配"}] ${b.description.slice(0, 50)}（${b.status}，负责人 ${b.owner?.name ?? "未指派"}）`)
    .join("\n");

  const decisionSummary = decisions
    .slice(0, 5)
    .map((d) => `- ${d.title}: ${d.content.slice(0, 60)}`)
    .join("\n");

  const prompt = `请基于以下 ${period} 月度数据，起草一份治理日志。

## 本月张力（${tensions.length} 条）
${tensionSummary || "（无）"}

## 本月阻塞点（${blockers.length} 条）
${blockerSummary || "（无）"}

## 本月决议（${decisions.length} 条）
${decisionSummary || "（无）"}

## 本月变更（${changes.length} 条）+ 会议（${meetings.length} 次）

请输出 JSON：
{
  "title": "治理日志标题",
  "content": "正文，包含：本月概览、关键事件、闭环情况评估",
  "patterns": ["重复出现的模式1", "模式2"],
  "risks": "下月重点系统性风险"
}

用中文。识别真正的模式，不要泛泛而谈。`;

  try {
    const result = await askAI(
      "你是回路制的机制建设者。你的职责是从组织的运转数据中识别真正的模式——重复出现的阻塞类型、回路间反复的张力、决策的规律。这些模式是组织进化的燃料。不要罗列事件，要提炼洞察。",
      prompt,
      { temperature: 0.4, maxTokens: 4000 }
    );

    const jsonStr = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);

    return {
      title: parsed.title ?? `${period} 治理日志`,
      content: parsed.content ?? "",
      patterns: Array.isArray(parsed.patterns) ? parsed.patterns : [],
      risks: parsed.risks ?? "",
      credibilityScore,
    };
  } catch (e) {
    console.error("治理日志起草失败:", e);
    return null;
  }
}
