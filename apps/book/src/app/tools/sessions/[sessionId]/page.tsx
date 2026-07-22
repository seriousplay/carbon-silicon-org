import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, ClipboardList, Lightbulb, ShieldAlert } from "lucide-react";
import { AppShell, Container, GlassCard, SectionLabel } from "@/components/ui";
import { requireUser } from "@/lib/auth/server";
import { getToolSessionDetail } from "@/lib/tools/sessions";

export const dynamic = "force-dynamic";

export default async function ToolSessionDetailPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await requireUser(`/tools/sessions/${sessionId}`);
  const session = await getToolSessionDetail(user.id, sessionId);

  if (!session) notFound();

  return (
    <AppShell>
      <Container className="max-w-6xl py-12">
        <Link href="/dashboard" className="mb-8 inline-flex items-center gap-2 text-sm font-bold text-emerald-200 hover:text-emerald-100">
          <ArrowLeft className="h-4 w-4" />
          返回工作台
        </Link>

        <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <GlassCard className="p-8">
            <SectionLabel>Tool Session</SectionLabel>
            <h1 className="text-4xl font-black leading-tight text-white">{session.toolName}</h1>
            <p className="mt-3 text-sm text-emerald-50/55">{new Date(session.submittedAt).toLocaleString("zh-CN")}</p>
            <p className="mt-5 text-base leading-8 text-emerald-50/68">{session.report.summary}</p>
            {session.report.scores ? (
              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                {Object.entries(session.report.scores).map(([label, score]) => (
                  <div key={label} className="rounded-2xl border border-emerald-200/10 bg-white/[0.035] p-4">
                    <div className="text-xs font-bold text-emerald-200">{label}</div>
                    <div className="mt-2 text-3xl font-black text-white">{score}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </GlassCard>

          <GlassCard className="p-8">
            <SectionHeader icon={<Lightbulb className="h-5 w-5" />} title="洞察报告" />
            <ReportBlock title="关键发现" items={session.report.keyFindings} />
            <ReportBlock title="风险信号" items={session.report.riskSignals} />
            <ReportBlock title="建议动作" items={session.report.recommendedActions} />
          </GlassCard>
        </div>

        <section className="mt-8 grid gap-6 lg:grid-cols-[0.82fr_1.18fr]">
          <GlassCard className="p-6">
            <SectionHeader icon={<ClipboardList className="h-5 w-5" />} title="基础信息" />
            <KeyValue label="姓名/称呼" value={session.participantSnapshot.displayName} />
            <KeyValue label="角色" value={session.participantSnapshot.role} />
            <KeyValue label="企业/组织" value={session.participantSnapshot.companyName} />
            <KeyValue label="团队/部门" value={session.participantSnapshot.teamName} />
            <KeyValue label="联系方式" value={session.participantSnapshot.contact} />
          </GlassCard>

          <GlassCard className="p-6">
            <SectionHeader icon={<ShieldAlert className="h-5 w-5" />} title="使用现场" />
            <KeyValue label="本次使用场景" value={session.context.useCase} multiline />
            <KeyValue label="数据沉淀对象" value={session.context.dataScope} multiline />
            <KeyValue label="当前现场" value={session.context.currentSituation} multiline />
            <KeyValue label="复盘观察信号" value={session.context.evidenceSignal} multiline />
            <KeyValue label="期待产出" value={session.context.expectedOutput} multiline />
          </GlassCard>
        </section>

        <GlassCard className="mt-8 p-6">
          <SectionHeader icon={<ClipboardList className="h-5 w-5" />} title="完整输入" />
          <div className="mt-5 grid gap-4">
            {Object.entries(session.responses).map(([key, value]) => (
              <div key={key} className="rounded-2xl border border-emerald-200/10 bg-black/18 p-4">
                <div className="text-sm font-black text-white">{key}</div>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-emerald-50/66">{value}</p>
              </div>
            ))}
          </div>
        </GlassCard>
      </Container>
    </AppShell>
  );
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="mb-5 flex items-center gap-2 text-xl font-black text-white">
      <span className="text-emerald-200">{icon}</span>
      {title}
    </div>
  );
}

function ReportBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-5">
      <h2 className="text-sm font-black text-emerald-200">{title}</h2>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li key={item} className="rounded-2xl border border-emerald-200/10 bg-black/18 p-4 text-sm leading-7 text-emerald-50/68">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function KeyValue({ label, value, multiline = false }: { label: string; value?: string | null; multiline?: boolean }) {
  return (
    <div className="border-t border-emerald-200/10 py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="text-xs font-bold uppercase tracking-[0.12em] text-emerald-200/70">{label}</div>
      <div className={`mt-2 text-sm leading-7 text-emerald-50/68 ${multiline ? "whitespace-pre-wrap" : ""}`}>{value || "未填写"}</div>
    </div>
  );
}
