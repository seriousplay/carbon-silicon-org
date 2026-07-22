import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import { isAIAvailable } from "@/lib/ai/provider";
import { weeklyReviewPeriod } from "@/lib/ai/weekly-review";
import { WeeklyReviewDraft } from "./review-draft";

export default async function WeeklyReviewPage() {
  const orgId = await getCurrentOrgId();
  const period = weeklyReviewPeriod();
  const [existing, tensions, meetings, decisions, projects] = await Promise.all([
    prisma.governanceLog.findUnique({
      where: { organizationId_period: { organizationId: orgId, period: period.key } },
      include: { confirmedBy: { select: { name: true } } },
    }),
    prisma.tension.count({ where: { organizationId: orgId, updatedAt: { gte: period.start, lt: period.end } } }),
    prisma.meeting.count({ where: { organizationId: orgId, startedAt: { gte: period.start, lt: period.end } } }),
    prisma.decisionRecord.count({ where: { organizationId: orgId, effectiveAt: { gte: period.start, lt: period.end } } }),
    prisma.project.count({ where: { organizationId: orgId, updatedAt: { gte: period.start, lt: period.end } } }),
  ]);
  const nextWeekFocus: string[] = existing ? (() => { try { return JSON.parse(existing.patterns); } catch { return []; } })() : [];

  return (
    <div className="mx-auto max-w-4xl animate-fade-rise space-y-8">
      <header>
        <h1 className="font-serif text-2xl font-medium">本周回顾</h1>
        <p className="mt-1 text-sm text-muted-foreground">{period.label} · 从张力、会议、决策和 Projects 回看组织运行。</p>
      </header>

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-label="本周事实">
        {[["张力与行动", tensions], ["会议", meetings], ["治理决策", decisions], ["Projects", projects]].map(([label, value]) => (
          <div key={String(label)} className="rounded-card border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-medium tabular-nums">{value}</p>
          </div>
        ))}
      </section>

      {existing ? (
        <section className="space-y-4 border-t border-border pt-6">
          <div>
            <p className="text-xs text-muted-foreground">已由 {existing.confirmedBy?.name ?? "成员"} 确认</p>
            <h2 className="mt-1 font-serif text-xl font-medium">{existing.title}</h2>
          </div>
          <p className="whitespace-pre-line text-sm leading-6">{existing.content}</p>
          {nextWeekFocus.length > 0 && <div><h3 className="text-sm font-medium">下周关注</h3><ul className="mt-2 space-y-1">{nextWeekFocus.map((item) => <li key={item} className="text-sm text-muted-foreground">· {item}</li>)}</ul></div>}
          {existing.risks && <div><h3 className="text-sm font-medium">风险</h3><p className="mt-1 text-sm text-muted-foreground">{existing.risks}</p></div>}
        </section>
      ) : (
        <section className="border-t border-border pt-6">
          <h2 className="mb-4 font-serif text-lg font-medium">形成周回顾</h2>
          <WeeklyReviewDraft period={period.key} aiOn={isAIAvailable()} />
        </section>
      )}
    </div>
  );
}
