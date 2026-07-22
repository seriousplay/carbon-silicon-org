import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, ClipboardList, Plus } from "lucide-react";
import { AppShell, Container, GlassCard, MetricCard, PrimaryLink, SectionLabel } from "@/components/ui";
import { getUserWorkspace, isOrganizationAdmin, requireUser } from "@/lib/auth/server";
import { getAssessmentRunsForOrganization } from "@/lib/runs/server";
import { runStatusLabels, runTypeLabels } from "@/lib/runs/default-runs";
import { getRunToolSessionSummary } from "@/lib/tools/sessions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const preworkReportRunSlugs = new Set(["20260517-hr-od-workshop"]);

export default async function AdminRunsPage() {
  const user = await requireUser("/admin/runs");
  const workspace = await getUserWorkspace(user.id);
  const membership = workspace.defaultMembership ?? workspace.memberships.find((item) => item.memberRole === "admin") ?? null;
  if (!workspace.profile || !workspace.memberships.length) redirect("/onboarding");
  if (!isOrganizationAdmin(membership)) redirect("/dashboard");

  const runs = await getAssessmentRunsForOrganization(membership.organizationId);
  const activeCount = runs.filter((run) => run.status === "active").length;
  const completedCount = runs.reduce((sum, run) => sum + (run.completedCount ?? 0), 0);
  const preworkRun = runs.find((run) => preworkReportRunSlugs.has(run.slug));
  const preworkToolSummary = preworkRun ? await getRunToolSessionSummary(preworkRun.slug) : null;
  const preworkCount = preworkToolSummary?.byTool.find((item) => item.toolId === "super-individual-prework")?.count ?? 0;

  return (
    <AppShell>
      <Container className="py-10">
        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <SectionLabel>Assessment Runs</SectionLabel>
            <h1 className="text-4xl font-black text-white">测评入口管理</h1>
            <p className="mt-3 max-w-2xl text-emerald-50/60">
              为 {membership.organizationName} 创建工作坊、企业诊断、内部班级或公开自测入口。每个入口拥有自己的参与者数据、个人报告和汇总后台。
            </p>
          </div>
          <PrimaryLink href="/admin/runs/new">
            创建入口 <Plus className="ml-2 h-4 w-4" />
          </PrimaryLink>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <MetricCard label="入口总数" value={runs.length} />
          <MetricCard label="启用入口" value={activeCount} />
          <MetricCard label="累计报告" value={completedCount} />
        </div>

        {preworkRun ? (
          <GlassCard className="mt-8 overflow-hidden p-0">
            <div className="grid gap-0 lg:grid-cols-[1fr_auto]">
              <div className="p-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/18 bg-emerald-300/10 px-3 py-1.5 text-xs font-black text-emerald-200">
                  <ClipboardList className="h-4 w-4" />
                  超级个体工作坊数据入口
                </div>
                <h2 className="mt-4 text-3xl font-black text-white">课前问卷综合报告</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50/62">
                  查看参与者提交的 AI 使用基础、StepClaw / ima / Obsidian 准备情况、现场任务、材料类型和开放问题。
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold text-emerald-50/55">
                  <span className="rounded-full bg-white/[0.055] px-3 py-1">{preworkRun.title}</span>
                  <span className="rounded-full bg-white/[0.055] px-3 py-1">{preworkCount} 条问卷提交</span>
                </div>
              </div>
              <Link
                href={`/admin/runs/${preworkRun.slug}/prework`}
                className="flex min-h-40 items-center justify-center bg-emerald-300 px-8 text-base font-black text-[#06110f] transition hover:bg-emerald-200 lg:min-w-[280px]"
              >
                打开问卷报告 <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </div>
          </GlassCard>
        ) : null}

        <div className="mt-8 grid gap-4">
          {runs.map((run) => (
            <GlassCard key={run.slug} className="p-5">
              <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <div className="flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-full bg-emerald-300/12 px-3 py-1 text-emerald-200">{runTypeLabels[run.runType]}</span>
                    <span className="rounded-full bg-white/[0.055] px-3 py-1 text-emerald-50/65">{runStatusLabels[run.status]}</span>
                    <span className="rounded-full bg-white/[0.055] px-3 py-1 text-emerald-50/45">/{run.slug}</span>
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-white">{run.title}</h2>
                  <p className="mt-2 max-w-3xl text-sm leading-7 text-emerald-50/62">{run.description}</p>
                </div>
                <div className={`grid gap-3 sm:grid-cols-3 ${preworkReportRunSlugs.has(run.slug) ? "lg:min-w-[560px] lg:grid-cols-4" : "lg:min-w-[430px]"}`}>
                  <MetricCard label="参与" value={run.participantCount ?? 0} />
                  <MetricCard label="完成" value={run.completedCount ?? 0} />
                  {preworkReportRunSlugs.has(run.slug) ? (
                    <Link
                      href={`/admin/runs/${run.slug}/prework`}
                      className="inline-flex min-h-28 items-center justify-center rounded-3xl border border-emerald-200/15 bg-white/[0.055] px-5 text-center text-sm font-black text-emerald-50 transition hover:bg-white/10"
                    >
                      问卷报告 <ClipboardList className="ml-2 h-4 w-4" />
                    </Link>
                  ) : null}
                  <Link
                    href={`/admin/runs/${run.slug}`}
                    className="inline-flex min-h-28 items-center justify-center rounded-3xl border border-emerald-200/15 bg-emerald-300 px-5 text-sm font-black text-[#06110f]"
                  >
                    管理 <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </Container>
    </AppShell>
  );
}
