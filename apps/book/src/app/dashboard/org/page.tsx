import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Plus, UsersRound } from "lucide-react";
import { AppShell, Container, GlassCard, MetricCard, PrimaryLink, SectionLabel } from "@/components/ui";
import { getUserWorkspace, isOrganizationAdmin, requireUser } from "@/lib/auth/server";
import { getOrganizationDashboardData } from "@/lib/organizations/server";
import { InviteButton } from "./invite-button";

export const dynamic = "force-dynamic";

export default async function OrganizationDashboardPage() {
  const user = await requireUser("/dashboard/org");
  const workspace = await getUserWorkspace(user.id);

  if (!workspace.profile || !workspace.memberships.length) {
    redirect("/onboarding");
  }

  const data = await getOrganizationDashboardData(user.id);

  if (!data.membership || !isOrganizationAdmin(data.membership)) {
    return (
      <AppShell>
        <Container className="max-w-3xl py-16">
          <GlassCard className="p-8">
            <SectionLabel>Organization</SectionLabel>
            <h1 className="text-4xl font-black text-white">需要组织管理员权限</h1>
            <p className="mt-4 text-base leading-8 text-emerald-50/65">你可以在个人工作台查看自己的报告和工具记录。组织级数据仅对组织管理员开放。</p>
            <div className="mt-6">
              <PrimaryLink href="/dashboard">返回我的工作台</PrimaryLink>
            </div>
          </GlassCard>
        </Container>
      </AppShell>
    );
  }

  const membership = data.membership;

  return (
    <AppShell>
      <Container className="py-10">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <SectionLabel>Organization Data</SectionLabel>
            <h1 className="text-4xl font-black text-white">{membership.organizationName}</h1>
            <p className="mt-3 max-w-2xl text-emerald-50/60">
              组织管理员可以查看成员明细、测评报告、工具记录和企业/班级入口，并导出组织数据。
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <InviteButton />
            <Link href="/api/dashboard/org/export" className="inline-flex items-center justify-center rounded-full border border-emerald-200/25 px-5 py-3 text-sm font-bold text-emerald-50 transition hover:bg-white/10">
              <Download className="mr-2 h-4 w-4" />
              导出组织数据
            </Link>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="成员" value={data.members.length} />
          <MetricCard label="入口" value={data.runs.length} />
          <MetricCard label="报告" value={data.reports.length} />
          <MetricCard label="工具记录" value={data.toolSessions.length} />
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <GlassCard className="p-6">
            <div className="flex items-center gap-3">
              <UsersRound className="h-5 w-5 text-emerald-200" />
              <h2 className="text-2xl font-black text-white">成员与邀请码</h2>
            </div>
            <div className="mt-5 grid gap-3">
              {data.members.map((member) => (
                <div key={member.userId} className="rounded-2xl border border-emerald-200/10 bg-black/18 p-4">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div className="font-black text-white">{member.displayName ?? member.email ?? "未命名成员"}</div>
                    <div className="text-xs font-bold text-emerald-200">{member.memberRole === "admin" ? "管理员" : "成员"}</div>
                  </div>
                  <p className="mt-2 text-sm text-emerald-50/55">{member.role ?? member.email}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl border border-emerald-200/10 bg-white/[0.035] p-4">
              <div className="text-sm font-black text-white">可用邀请码</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {data.invites.length ? data.invites.map((invite) => (
                  <span key={invite.code} className="rounded-full border border-emerald-200/15 px-3 py-1 text-sm font-black text-emerald-100">
                    {invite.code}
                  </span>
                )) : <span className="text-sm text-emerald-50/55">暂无邀请码。</span>}
              </div>
            </div>
          </GlassCard>

          <div className="grid gap-6">
            <GlassCard className="p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="text-2xl font-black text-white">企业/班级入口</h2>
                <Link href="/admin/runs/new" prefetch={false} className="inline-flex items-center rounded-full bg-emerald-300 px-4 py-2 text-xs font-black text-[#06110f]">
                  <Plus className="mr-1 h-4 w-4" />
                  创建入口
                </Link>
              </div>
              <div className="grid gap-3">
                {data.runs.length ? data.runs.map((run) => (
                  <Link key={run.slug} href={`/admin/runs/${run.slug}`} prefetch={false} className="rounded-2xl border border-emerald-200/10 bg-black/18 p-4 transition hover:bg-white/[0.07]">
                    <div className="font-black text-white">{run.title}</div>
                    <p className="mt-2 text-sm text-emerald-50/55">/{run.slug} · {run.status}</p>
                  </Link>
                )) : <p className="text-sm leading-7 text-emerald-50/55">暂无入口。</p>}
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <h2 className="text-2xl font-black text-white">最近组织数据</h2>
              <div className="mt-5 grid gap-3">
                {[...data.reports.slice(0, 5).map((report) => ({ id: report.id, title: `测评报告 · ${report.stageLevel ?? "阶段判断"}`, meta: report.createdAt, href: `/report/${report.id}` })),
                  ...data.toolSessions.slice(0, 5).map((session) => ({ id: session.id, title: `工具记录 · ${session.toolName}`, meta: session.submittedAt, href: `/tools/sessions/${session.id}` }))].slice(0, 8).map((item) => (
                  <Link key={item.id} href={item.href} className="rounded-2xl border border-emerald-200/10 bg-black/18 p-4 transition hover:bg-white/[0.07]">
                    <div className="font-black text-white">{item.title}</div>
                    <p className="mt-2 text-xs text-emerald-50/45">{new Date(item.meta).toLocaleString("zh-CN")}</p>
                  </Link>
                ))}
                {!data.reports.length && !data.toolSessions.length ? <p className="text-sm leading-7 text-emerald-50/55">暂无组织数据。</p> : null}
              </div>
            </GlassCard>
          </div>
        </div>
      </Container>
    </AppShell>
  );
}
