/**
 * 指标计算 helper
 *
 * 基于 review/v1 产品 P0-5：仪表板缺少趋势
 * 基于 review/v1 Sprint 3：北极星仪表盘
 *
 * 计算闭环率、周环比、采纳健康度等关键指标
 */
import { prisma } from "@/lib/db";

/** 计算某组织的闭环率 = 已闭环 / (已闭环 + 待闭环) */
export async function getCloseoutRate(orgId: string): Promise<number> {
  const [resolved, active] = await Promise.all([
    prisma.tension.count({
      where: { organizationId: orgId, status: "RESOLVED" },
    }),
    prisma.tension.count({
      where: {
        organizationId: orgId,
        status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "BLOCKED"] },
      },
    }),
  ]);

  const total = resolved + active;
  return total === 0 ? 0 : resolved / total;
}

/** 计算本周 vs 上周的计数对比 */
export async function getWeeklyTrend(orgId: string) {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);
  const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

  const [thisWeekTensions, lastWeekTensions, thisWeekClosed, lastWeekClosed] =
    await Promise.all([
      prisma.tension.count({
        where: { organizationId: orgId, createdAt: { gte: weekAgo } },
      }),
      prisma.tension.count({
        where: { organizationId: orgId, createdAt: { gte: twoWeeksAgo, lt: weekAgo } },
      }),
      prisma.tension.count({
        where: {
          organizationId: orgId,
          status: "RESOLVED",
          resolvedAt: { gte: weekAgo },
        },
      }),
      prisma.tension.count({
        where: {
          organizationId: orgId,
          status: "RESOLVED",
          resolvedAt: { gte: twoWeeksAgo, lt: weekAgo },
        },
      }),
    ]);

  return {
    tensions: { thisWeek: thisWeekTensions, lastWeek: lastWeekTensions },
    closed: { thisWeek: thisWeekClosed, lastWeek: lastWeekClosed },
  };
}

/** 采纳健康度评分（0-100）
 * 综合维度：张力提出频率、闭环率、治理会频率
 * 基于 review/v1 战略视角 Sprint 3
 */
export async function getAdoptionHealth(orgId: string): Promise<{
  score: number;
  level: "dormant" | "waking" | "breathing" | "thriving";
  details: { label: string; value: string; status: "good" | "ok" | "bad" }[];
}> {
  const closeoutRate = await getCloseoutRate(orgId);
  const trend = await getWeeklyTrend(orgId);

  // 周均张力提出（组织活跃度信号）
  const weeklyTensions = trend.tensions.thisWeek + trend.tensions.lastWeek;
  const avgTensions = weeklyTensions / 2;

  // 评分计算
  let score = 0;
  // 张力活跃度（0-30 分）：周均≥3 满分
  score += Math.min(30, avgTensions * 10);
  // 闭环率（0-40 分）
  score += closeoutRate * 40;
  // 闭环绝对数（0-30 分）：周均≥2 满分
  const weeklyClosed = (trend.closed.thisWeek + trend.closed.lastWeek) / 2;
  score += Math.min(30, weeklyClosed * 15);

  const rounded = Math.round(score);

  let level: "dormant" | "waking" | "breathing" | "thriving";
  if (rounded < 15) level = "dormant";
  else if (rounded < 35) level = "waking";
  else if (rounded < 60) level = "breathing";
  else level = "thriving";

  const details = [
    {
      label: "周均张力提出",
      value: avgTensions.toFixed(1),
      status: (avgTensions >= 3 ? "good" : avgTensions >= 1 ? "ok" : "bad") as "good" | "ok" | "bad",
    },
    {
      label: "闭环率",
      value: `${(closeoutRate * 100).toFixed(0)}%`,
      status: (closeoutRate >= 0.7 ? "good" : closeoutRate >= 0.4 ? "ok" : "bad") as "good" | "ok" | "bad",
    },
    {
      label: "周均闭环数",
      value: weeklyClosed.toFixed(1),
      status: (weeklyClosed >= 2 ? "good" : weeklyClosed >= 1 ? "ok" : "bad") as "good" | "ok" | "bad",
    },
  ];

  return { score: rounded, level, details };
}
