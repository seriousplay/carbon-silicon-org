import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, Download, FileText, HelpCircle, ListChecks, Wrench } from "lucide-react";
import { AppShell, Container, GlassCard, MetricCard, SectionLabel } from "@/components/ui";
import { getUserWorkspace, isOrganizationAdmin, requireUser } from "@/lib/auth/server";
import { getAssessmentRun } from "@/lib/runs/server";
import { getRunPreworkReport, type PreworkReport } from "@/lib/tools/sessions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminRunPreworkPage({ params }: { params: Promise<{ runSlug: string }> }) {
  const { runSlug } = await params;
  const user = await requireUser(`/admin/runs/${runSlug}/prework`);
  const workspace = await getUserWorkspace(user.id);
  const run = await getAssessmentRun(runSlug);

  if (!run) notFound();
  const membership = workspace.memberships.find((item) => item.organizationId === run.organizationId) ?? workspace.defaultMembership;
  if (!workspace.profile || !workspace.memberships.length) redirect("/onboarding");
  if (!isOrganizationAdmin(membership) || (run.organizationId && membership?.organizationId !== run.organizationId)) redirect("/dashboard");

  const report = await getRunPreworkReport(run.slug);
  const readyCount = report.readiness.reduce((sum, item) => sum + item.ready, 0);
  const issueCount = report.readiness.reduce((sum, item) => sum + item.issue + item.notReady, 0);

  return (
    <AppShell>
      <Container className="max-w-7xl py-10">
        <Link href={`/admin/runs/${run.slug}`} className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-emerald-200 hover:text-emerald-100">
          <ArrowLeft className="h-4 w-4" />
          返回工作坊管理
        </Link>

        <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div>
            <SectionLabel>Prework Report · {membership?.organizationName ?? "组织后台"}</SectionLabel>
            <h1 className="text-4xl font-black leading-tight text-white">超级个体课前问卷综合报告</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50/62">
              汇总 {run.title} 下的课前问卷提交，帮助主办方判断工具准备情况、现场任务类型和需要重点辅导的问题。
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-emerald-50/55">
              <span className="rounded-full border border-emerald-200/15 px-3 py-1">/{run.slug}</span>
              <span className="rounded-full border border-emerald-200/15 px-3 py-1">{membership?.organizationName ?? "当前组织"}</span>
              {report.lastSubmittedAt ? (
                <span className="rounded-full border border-emerald-200/15 px-3 py-1">最近提交：{formatDateTime(report.lastSubmittedAt)}</span>
              ) : null}
            </div>
          </div>
          <Link
            href={`/api/runs/${run.slug}/tool-sessions/export`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200/20 px-5 py-3 text-sm font-black text-emerald-50"
          >
            <Download className="h-4 w-4" />
            导出全部工具数据
          </Link>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <MetricCard label="问卷提交" value={report.total} detail="课前准备问卷" />
          <MetricCard label="工具已就绪" value={readyCount} detail="StepClaw / ima / Obsidian 合计" />
          <MetricCard label="需现场支持" value={issueCount} detail="未安装或安装遇到问题" />
          <MetricCard label="目标类型" value={report.multiChoice.goals.length} detail="参与者选择的学习结果" />
        </div>

        <section className="mt-8 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <GlassCard className="p-6">
            <SectionTitle icon={<Wrench className="h-5 w-5" />} title="工具准备度" />
            <div className="mt-5 grid gap-4">
              {report.readiness.map((item) => (
                <div key={item.tool} className="rounded-2xl border border-emerald-200/10 bg-black/18 p-4">
                  <div className="flex items-center justify-between gap-4">
                    <h2 className="text-lg font-black text-white">{item.tool}</h2>
                    <span className="text-xs font-bold text-emerald-50/55">{item.ready} / {report.total || 0} 已就绪</span>
                  </div>
                  <StackedBar ready={item.ready} issue={item.issue} notReady={item.notReady} unknown={item.unknown} total={report.total} />
                  <div className="mt-3 grid grid-cols-4 gap-2 text-xs text-emerald-50/58">
                    <span>已就绪 {item.ready}</span>
                    <span>有问题 {item.issue}</span>
                    <span>未安装 {item.notReady}</span>
                    <span>未填写 {item.unknown}</span>
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <SectionTitle icon={<ListChecks className="h-5 w-5" />} title="学习基础与目标" />
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <Distribution title="AI 使用频率" items={report.distributions.aiFrequency} total={report.total} />
              <Distribution title="是否带真实材料" items={report.distributions.bringMaterial} total={report.total} />
              <Distribution title="AI 已用场景" items={report.multiChoice.aiUses} total={report.total} />
              <Distribution title="工作坊目标" items={report.multiChoice.goals} total={report.total} />
            </div>
          </GlassCard>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <HighlightPanel icon={<FileText className="h-5 w-5" />} title="现场想完成的任务" items={report.highlights.targetTasks} />
          <HighlightPanel icon={<HelpCircle className="h-5 w-5" />} title="最想解决的问题" items={report.highlights.biggestQuestions} />
          <HighlightPanel icon={<Wrench className="h-5 w-5" />} title="工具安装问题" items={report.highlights.toolIssues} empty="暂无工具安装问题。" />
        </section>

        <GlassCard className="mt-8 p-6">
          <SectionTitle icon={<FileText className="h-5 w-5" />} title="逐条问卷记录" />
          <div className="mt-5 grid gap-4">
            {report.records.length ? (
              report.records.map((record) => <PreworkRecord key={record.id} record={record} />)
            ) : (
              <div className="rounded-2xl bg-white/[0.045] p-5 text-sm leading-7 text-emerald-50/58">
                暂无课前问卷提交。参与者从“超级个体赋能工作坊 / 课前准备与问卷”提交后，这里会自动出现汇总和明细。
              </div>
            )}
          </div>
        </GlassCard>
      </Container>
    </AppShell>
  );
}

function SectionTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-2xl font-black text-white">
      <span className="text-emerald-200">{icon}</span>
      {title}
    </div>
  );
}

function Distribution({ title, items, total }: { title: string; items: { label: string; count: number }[]; total: number }) {
  return (
    <div className="rounded-2xl border border-emerald-200/10 bg-black/18 p-4">
      <h2 className="text-base font-black text-white">{title}</h2>
      <div className="mt-4 grid gap-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.label}>
              <div className="flex justify-between gap-3 text-sm font-bold text-emerald-50/76">
                <span>{item.label}</span>
                <span>{item.count}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-emerald-300" style={{ width: `${barWidth(item.count, total)}%` }} />
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm leading-7 text-emerald-50/55">暂无数据。</p>
        )}
      </div>
    </div>
  );
}

function StackedBar({ ready, issue, notReady, unknown, total }: { ready: number; issue: number; notReady: number; unknown: number; total: number }) {
  const denominator = Math.max(1, total);
  return (
    <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/10">
      <div className="bg-emerald-300" style={{ width: `${(ready / denominator) * 100}%` }} />
      <div className="bg-amber-300" style={{ width: `${(issue / denominator) * 100}%` }} />
      <div className="bg-rose-300" style={{ width: `${(notReady / denominator) * 100}%` }} />
      <div className="bg-white/25" style={{ width: `${(unknown / denominator) * 100}%` }} />
    </div>
  );
}

function HighlightPanel({ icon, title, items, empty = "暂无提交。" }: { icon: ReactNode; title: string; items: string[]; empty?: string }) {
  return (
    <GlassCard className="p-6">
      <SectionTitle icon={icon} title={title} />
      <div className="mt-5 grid gap-3">
        {items.length ? (
          items.map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-2xl border border-emerald-200/10 bg-black/18 p-4 text-sm leading-7 text-emerald-50/70">
              {item}
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-white/[0.045] p-4 text-sm leading-7 text-emerald-50/55">{empty}</div>
        )}
      </div>
    </GlassCard>
  );
}

function PreworkRecord({ record }: { record: PreworkReport["records"][number] }) {
  return (
    <div className="rounded-2xl border border-emerald-200/10 bg-black/18 p-5">
      <div className="flex flex-col justify-between gap-2 md:flex-row md:items-start">
        <div>
          <h2 className="text-xl font-black text-white">{record.displayName}</h2>
          <p className="mt-1 text-sm leading-6 text-emerald-50/55">
            {record.role || "未填写工作场景"} · {formatDateTime(record.submittedAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold text-emerald-50/60">
          {record.aiFrequency ? <span className="rounded-full bg-white/[0.055] px-3 py-1">{record.aiFrequency}</span> : null}
          {record.bringMaterial ? <span className="rounded-full bg-white/[0.055] px-3 py-1">{record.bringMaterial}</span> : null}
        </div>
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <KeyValue label="StepClaw" value={record.stepclaw} />
        <KeyValue label="ima" value={record.ima} />
        <KeyValue label="Obsidian" value={record.obsidian} />
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <KeyValue label="AI 已用场景" value={record.aiUses} multiline />
        <KeyValue label="预期结果" value={record.goals} multiline />
        <KeyValue label="现场任务" value={record.targetTask} multiline />
        <KeyValue label="最想解决的问题" value={record.biggestQuestion} multiline />
        <KeyValue label="材料类型" value={record.materialType} multiline />
        <KeyValue label="工具问题" value={record.toolIssue} multiline />
      </div>
    </div>
  );
}

function KeyValue({ label, value, multiline = false }: { label: string; value?: string; multiline?: boolean }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-200/70">{label}</div>
      <div className={`mt-2 text-sm leading-7 text-emerald-50/68 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value || "未填写"}</div>
    </div>
  );
}

function barWidth(count: number, total: number) {
  if (!total) return 0;
  return Math.max(8, (count / total) * 100);
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}
