import { askAI, isAIAvailable } from "./provider";
import { prisma } from "@/lib/db";

export type WeeklyReviewDraft = {
  title: string;
  content: string;
  nextWeekFocus: string[];
  risks: string;
  credibilityScore: number;
};

export function weeklyReviewPeriod(now = new Date()): { key: string; start: Date; end: Date; label: string } {
  const start = new Date(now);
  const day = start.getDay() || 7;
  start.setDate(start.getDate() - day + 1);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  const yearStart = new Date(start.getFullYear(), 0, 1);
  const firstMonday = new Date(yearStart);
  const firstDay = firstMonday.getDay() || 7;
  firstMonday.setDate(firstMonday.getDate() - firstDay + 1);
  firstMonday.setHours(0, 0, 0, 0);
  const week = Math.floor((start.getTime() - firstMonday.getTime()) / 604800000) + 1;
  const key = `${start.getFullYear()}-W${String(week).padStart(2, "0")}`;

  return {
    key,
    start,
    end,
    label: `${start.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })} - ${new Date(end.getTime() - 1).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}`,
  };
}

export async function draftWeeklyReview(orgId: string, now = new Date()): Promise<WeeklyReviewDraft | null> {
  if (!isAIAvailable()) return null;
  const period = weeklyReviewPeriod(now);

  const [tensions, meetings, tacticalOutcomes, decisions, projects] = await Promise.all([
    prisma.tension.findMany({
      where: {
        organizationId: orgId,
        OR: [
          { createdAt: { gte: period.start, lt: period.end } },
          { resolvedAt: { gte: period.start, lt: period.end } },
          { updatedAt: { gte: period.start, lt: period.end } },
        ],
      },
      select: { title: true, status: true, owner: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.meeting.findMany({
      where: { organizationId: orgId, startedAt: { gte: period.start, lt: period.end } },
      select: { title: true, type: true, endedAt: true, notes: true },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.tacticalOutcomeProposal.findMany({
      where: { organizationId: orgId, recordedAt: { gte: period.start, lt: period.end } },
      select: { title: true, kind: true, status: true, responsiblePerson: { select: { name: true } } },
      orderBy: { recordedAt: "desc" },
      take: 30,
    }),
    prisma.decisionRecord.findMany({
      where: { organizationId: orgId, effectiveAt: { gte: period.start, lt: period.end } },
      select: { title: true, status: true },
      orderBy: { effectiveAt: "desc" },
      take: 30,
    }),
    prisma.project.findMany({
      where: { organizationId: orgId, updatedAt: { gte: period.start, lt: period.end } },
      select: { name: true, status: true, bearer: { select: { name: true } } },
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);

  const dataPoints = tensions.length + meetings.length + tacticalOutcomes.length + decisions.length + projects.length;
  const credibilityScore = dataPoints < 5 ? 0.3 : dataPoints < 15 ? 0.6 : 0.8;
  const lines = (items: string[]) => items.length ? items.join("\n") : "（无）";
  const prompt = `请基于 ${period.label} 的组织运行事实起草一份周回顾。不要替组织做决策，只总结事实并提出下周关注建议。

张力与行动：
${lines(tensions.map((item) => `- ${item.title}（${item.status}，负责人 ${item.owner?.name ?? "未分配"}）`))}

会议：
${lines(meetings.map((item) => `- ${item.title}（${item.type}，${item.endedAt ? "已结束" : "进行中"}，${item.notes ? "有纪要" : "无纪要"}）`))}

战术产出：
${lines(tacticalOutcomes.map((item) => `- ${item.kind}：${item.title}（${item.status}，承担人 ${item.responsiblePerson.name}）`))}

治理决策：
${lines(decisions.map((item) => `- ${item.title}（${item.status}）`))}

Projects：
${lines(projects.map((item) => `- ${item.name}（${item.status}，承担人 ${item.bearer?.name ?? "未分配"}）`))}

输出 JSON：
{"title":"标题","content":"事实回顾与闭环情况","nextWeekFocus":["建议1","建议2"],"risks":"需要团队关注的风险"}`;

  try {
    const result = await askAI(
      "你是组织周回顾助手。只依据输入事实归纳，不发明信息，不替成员或会议作出决定。建议必须明确标为建议。",
      prompt,
      { temperature: 0.3, maxTokens: 3000 },
    );
    const parsed = JSON.parse(result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    return {
      title: String(parsed.title || `${period.key} 组织周回顾`),
      content: String(parsed.content || ""),
      nextWeekFocus: Array.isArray(parsed.nextWeekFocus) ? parsed.nextWeekFocus.map(String).slice(0, 8) : [],
      risks: String(parsed.risks || ""),
      credibilityScore,
    };
  } catch (error) {
    console.error("周回顾起草失败:", error);
    return null;
  }
}
