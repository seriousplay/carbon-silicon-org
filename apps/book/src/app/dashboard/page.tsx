import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Building2, FileText, Wrench } from "lucide-react";
import { AppShell, Container, GlassCard, MetricCard, PrimaryLink, SectionLabel } from "@/components/ui";
import { getUserWorkspace, requireUser } from "@/lib/auth/server";
import { getPersonalDashboardData } from "@/lib/organizations/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const workspace = await getUserWorkspace(user.id);

  if (!workspace.profile || !workspace.memberships.length) {
    redirect("/onboarding");
  }

  const data = await getPersonalDashboardData(user.id);

  return (
    <AppShell>
      <Container className="py-10">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <SectionLabel>Workspace</SectionLabel>
            <h1 className="text-4xl font-black text-white">我的工作台</h1>
            <p className="mt-3 max-w-2xl text-emerald-50/60">
              找回你的测评报告、工具使用记录，以及所属组织的数据空间。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <PrimaryLink href="/tools">继续使用工具</PrimaryLink>
            {workspace.defaultMembership?.memberRole === "admin" ? (
              <Link href="/dashboard/org" prefetch={false} className="inline-flex items-center justify-center rounded-full border border-emerald-200/25 px-5 py-3 text-sm font-bold text-emerald-50 transition hover:bg-white/10">
                组织数据 <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            ) : null}
            <Link href="/auth/signout" prefetch={false} className="inline-flex items-center justify-center rounded-full border border-emerald-200/15 px-5 py-3 text-sm font-bold text-emerald-50/70 transition hover:bg-white/10 hover:text-white">
              退出登录
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="我的报告" value={data.reports.length} />
          <MetricCard label="工具记录" value={data.toolSessions.length} />
          <MetricCard label="所属组织" value={workspace.memberships.length} detail={workspace.defaultMembership?.organizationName} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <GlassCard className="p-6">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-emerald-200" />
              <h2 className="text-2xl font-black text-white">我的测评报告</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {data.reports.length ? (
                data.reports.map((report) => (
                  <Link key={report.id} href={`/report/${report.id}`} className="rounded-2xl border border-emerald-200/10 bg-black/18 p-4 transition hover:bg-white/[0.07]">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div className="font-black text-white">{report.stageLevel ?? "阶段报告"}</div>
                      <div className="text-xs text-emerald-50/45">{formatDate(report.createdAt)}</div>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-emerald-50/58">
                      下一阶段：{report.nextLevel ?? "待判断"} · 关键卡点：{report.primaryBottleneck ?? "待判断"}
                    </p>
                  </Link>
                ))
              ) : (
                <EmptyState text="暂无测评报告。" href="/tools/ai-positioning-spectrum" action="先浏览工具库" />
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <div className="flex items-center gap-3">
              <Wrench className="h-5 w-5 text-emerald-200" />
              <h2 className="text-2xl font-black text-white">我的工具记录</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {data.toolSessions.length ? (
                data.toolSessions.map((session) => (
                  <Link key={session.id} href={`/tools/sessions/${session.id}`} className="rounded-2xl border border-emerald-200/10 bg-black/18 p-4 transition hover:bg-white/[0.07]">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div className="font-black text-white">{session.toolName}</div>
                      <div className="text-xs text-emerald-50/45">{formatDate(session.submittedAt)}</div>
                    </div>
                    {session.useCase ? <p className="mt-2 text-sm leading-7 text-emerald-50/58">场景：{session.useCase}</p> : null}
                    {session.nextAction ? <p className="mt-1 text-sm leading-7 text-emerald-50/58">下一步：{session.nextAction}</p> : null}
                  </Link>
                ))
              ) : (
                <EmptyState text="暂无工具记录。" href="/tools" action="开始使用工具" />
              )}
            </div>
          </GlassCard>
        </div>

        <GlassCard className="mt-8 p-6">
          <div className="flex items-start gap-3">
            <Building2 className="mt-1 h-5 w-5 text-emerald-200" />
            <div>
              <h2 className="text-2xl font-black text-white">组织空间</h2>
              <p className="mt-2 text-sm leading-7 text-emerald-50/62">
                当前默认组织：{workspace.defaultMembership?.organizationName ?? "未设置"}。组织管理员可查看组织内成员明细、工具记录、测评报告和数据导出。
              </p>
            </div>
          </div>
        </GlassCard>
      </Container>
    </AppShell>
  );
}

function EmptyState({ text, href, action }: { text: string; href: string; action: string }) {
  return (
    <div className="rounded-2xl border border-emerald-200/10 bg-white/[0.035] p-4">
      <p className="text-sm leading-7 text-emerald-50/58">{text}</p>
      <Link href={href} className="mt-3 inline-flex text-sm font-black text-emerald-200">
        {action} <ArrowRight className="ml-1 h-4 w-4" />
      </Link>
    </div>
  );
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
