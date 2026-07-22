import Link from "next/link";
import { getCurrentPerson, getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { getWeeklyTrend, getCloseoutRate, getAdoptionHealth } from "@/lib/metrics";
import { queryWorkspaceGoalContext } from "@/lib/goals/workspace-read-model";
import { getWeeklyRhythm } from "@/lib/weekly-rhythm";
import { WeeklyRhythmQueue } from "@/components/weekly-rhythm/weekly-rhythm-queue";
import { WorkspaceGoalContext } from "@/components/weekly-rhythm/workspace-goal-context";
import { ArrowRight, FolderKanban, ListChecks, RefreshCw, Waves } from "lucide-react";

const levelLabel = {
  dormant: { label: "沉睡中", desc: "组织还没有开始呼吸", color: "text-muted-foreground" },
  waking: { label: "苏醒中", desc: "开始感知张力", color: "text-seed" },
  breathing: { label: "呼吸中", desc: "运转节奏建立", color: "text-growing" },
  thriving: { label: "茁壮", desc: "组织在持续进化", color: "text-moss" },
} as const;

function Trend({ thisWeek, lastWeek }: { thisWeek: number; lastWeek: number }) {
  if (lastWeek === 0 && thisWeek === 0)
    return <span className="text-xs text-muted-foreground">—</span>;
  if (lastWeek === 0)
    return <span className="text-xs text-growing">↑ 新增</span>;
  const diff = ((thisWeek - lastWeek) / lastWeek) * 100;
  const up = diff > 0;
  const same = Math.abs(diff) < 1;
  if (same) return <span className="text-xs text-muted-foreground">→ 持平</span>;
  return (
    <span className={`text-xs ${up ? "text-growing" : "text-needs-light"}`}>
      {up ? "↑" : "↓"} {Math.abs(diff).toFixed(0)}%
    </span>
  );
}

export default async function WorkspacePage() {
  const person = await getCurrentPerson();
  const orgId = await getCurrentOrgId();

  const [circleCount, openTensionCount, activeBlockerCount, trend, closeoutRate, health, weeklyRhythm, workspaceGoals, membership] =
    await Promise.all([
      prisma.circle.count({ where: { organizationId: orgId, status: { not: "ARCHIVED" } } }),
      prisma.tension.count({ where: { organizationId: orgId, status: "OPEN" } }),
      prisma.tension.count({
        where: {
          organizationId: orgId,
          status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS", "BLOCKED"] },
        },
      }),
      getWeeklyTrend(orgId),
      getCloseoutRate(orgId),
      getAdoptionHealth(orgId),
      getWeeklyRhythm(orgId, person!.id),
      queryWorkspaceGoalContext(
        { organizationId: orgId, viewerPersonId: person!.id },
        { prisma, now: new Date() },
      ),
      prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: person!.userId!,
            organizationId: orgId,
          },
        },
        select: { role: true },
      }),
    ]);

  const levelInfo = levelLabel[health.level];

  return (
    <div className="max-w-5xl mx-auto animate-fade-rise">
      {/* 欢迎语 + 采纳健康度 */}
      <div className="mb-8 flex flex-col items-start justify-between gap-5 sm:flex-row">
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full rounded-full bg-moss/40 animate-ping opacity-75" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-moss" />
            </span>
            <span className="text-xs text-muted-foreground">组织呼吸中</span>
          </div>
          <h1 className="font-serif text-3xl font-medium mb-2">
            你好，{person?.name}。
          </h1>
          <p className="text-muted-foreground">
            这是 {person?.organization.name} 的回路治理概览。
          </p>
        </div>

        {/* 采纳健康度卡片 */}
        <div className="w-full min-w-40 rounded-card border border-border bg-card p-5 text-center shadow-soft sm:w-auto">
          <p className="text-xs text-muted-foreground mb-1">采纳健康度</p>
          <p className={`font-serif text-3xl font-medium ${levelInfo.color}`}>
            {health.score}
          </p>
          <p className={`text-sm font-medium mt-1 ${levelInfo.color}`}>{levelInfo.label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{levelInfo.desc}</p>
        </div>
      </div>

      <WeeklyRhythmQueue items={weeklyRhythm} />

      <WorkspaceGoalContext projection={workspaceGoals} />

      <nav aria-label="常用工作" className="mb-8 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { href: "/app/projects", label: "项目", icon: FolderKanban },
          { href: "/app/tracker", label: "行动追踪", icon: ListChecks },
          { href: "/app/tensions", label: "张力", icon: Waves },
          { href: "/app/review", label: "本周回顾", icon: RefreshCw },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex min-h-11 items-center gap-2 rounded-input border border-border bg-card px-3 text-sm font-medium transition-colors hover:bg-muted/40"
            >
              <Icon aria-hidden="true" className="h-4 w-4 text-moss" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
              <ArrowRight aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
          );
        })}
      </nav>

      {/* 关键指标卡片（含趋势） */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        <Link
          href="/app/circles"
          className="rounded-card border border-border bg-card p-5 shadow-soft card-hover"
        >
          <span className="text-sm text-muted-foreground">活跃回路</span>
          <p className="font-serif text-3xl font-medium mt-1">{circleCount}</p>
        </Link>

        <Link
          href="/app/tensions"
          className="rounded-card border border-border bg-card p-5 shadow-soft card-hover"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">感知张力</span>
            <Trend thisWeek={trend.tensions.thisWeek} lastWeek={trend.tensions.lastWeek} />
          </div>
          <p className="font-serif text-3xl font-medium mt-1">{openTensionCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">本周 {trend.tensions.thisWeek} 新增</p>
        </Link>

        <Link
          href="/app/tracker"
          className="rounded-card border border-border bg-card p-5 shadow-soft card-hover"
        >
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">待闭环</span>
            <Trend thisWeek={trend.tensions.thisWeek} lastWeek={trend.tensions.lastWeek} />
          </div>
          <p className="font-serif text-3xl font-medium mt-1">{activeBlockerCount}</p>
          <p className="text-xs text-muted-foreground mt-0.5">本周闭环 {trend.closed.thisWeek}</p>
        </Link>

        <div className="rounded-card border border-border bg-card p-5 shadow-soft">
          <span className="text-sm text-muted-foreground">闭环率</span>
          <p className="font-serif text-3xl font-medium mt-1">
            {(closeoutRate * 100).toFixed(0)}<span className="text-lg">%</span>
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">目标 ≥70%</p>
        </div>
      </div>

      {/* 健康度明细 */}
      <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-8">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">
          健康度明细
        </h2>
        <div className="grid grid-cols-3 gap-4">
          {health.details.map((d) => (
            <div key={d.label}>
              <p className="text-xs text-muted-foreground mb-1">{d.label}</p>
              <p className={`text-lg font-medium ${
                d.status === "good" ? "text-growing" : d.status === "ok" ? "text-seed" : "text-needs-light"
              }`}>
                {d.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 空状态引导（新组织） */}
      {circleCount <= 1 && membership?.role === "ORG_ADMIN" && (
        <div className="rounded-card border border-dashed border-border bg-card/50 p-10 text-center">
          <div className="text-4xl mb-4 text-moss/60">◔</div>
          <h2 className="font-serif text-xl font-medium mb-2">
            你的组织刚刚发芽
          </h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            目前只有一个&quot;主回路&quot;。基于行业模板一键初始化回路制结构。
          </p>
          <p className="text-sm text-moss">
            请先进入左侧“组织”模块完成初始化。
          </p>
        </div>
      )}
    </div>
  );
}
