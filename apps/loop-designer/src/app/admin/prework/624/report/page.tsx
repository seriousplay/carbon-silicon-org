import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, MessageSquareText, ShieldCheck, UsersRound } from "lucide-react";
import { requireAdmin } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import { isPlatformAdmin } from "@/lib/platform-admin";
import { getPrework624Report, type CountItem } from "@/lib/prework-report";

export const metadata: Metadata = {
  title: "6.24课前问卷报告 - Loop Designer",
};

export default async function Prework624ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ hideTests?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/?error=unauthorized");
  const params = await searchParams;

  const platformAdmin = await isPlatformAdmin(user);
  const hideTestAccounts = platformAdmin && params.hideTests !== "0";
  try {
    if (!platformAdmin) {
      await requireAdmin(user, ["view_audit_logs"]);
    }
  } catch {
    redirect("/?error=unauthorized");
  }

  const report = await getPrework624Report(
    platformAdmin
      ? { scope: "platform", hideTestAccounts }
      : { scope: "enterprise", enterpriseId: user.enterpriseId },
  );

  return (
    <main className="min-h-screen px-5 py-6 md:px-10 md:py-10">
      <header className="mx-auto flex max-w-7xl flex-wrap items-start justify-between gap-5 border-b border-white/10 pb-6">
        <div>
          <div className="mono text-[10px] tracking-[.24em] text-[var(--cyan)]">6.24 CLOSED-DOOR PREWORK REPORT</div>
          <h1 className="mt-3 text-4xl font-black leading-tight md:text-6xl">课前问卷数据报告</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-white/58">
            面向高维学堂闭门课现场分享，汇总参会者在 AI 应用阶段、组织阻碍、课程期待与 90 天优先事项上的共同信号。
          </p>
          <div className="mono mt-4 inline-flex border border-[var(--cyan)]/35 px-3 py-2 text-[10px] tracking-[.18em] text-[var(--cyan)]">
            {report.scope === "platform" ? "平台超级管理员 / 全平台数据" : "企业管理员 / 本企业数据"}
          </div>
          {platformAdmin ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
              <Link
                href={hideTestAccounts ? "?hideTests=0" : "?hideTests=1"}
                className="border border-[var(--acid)]/35 px-4 py-2 font-bold text-[var(--acid)] hover:bg-[var(--acid)]/10"
              >
                {hideTestAccounts ? "显示全部提交" : "隐藏测试账号"}
              </Link>
              <span className="text-white/45">
                {hideTestAccounts ? `已隐藏 ${report.hiddenTestAccountCount} 条测试账号提交` : "当前包含测试账号提交"}
              </span>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/enterprise" className="border border-white/15 px-4 py-3 text-sm text-white/70 hover:border-[var(--cyan)] hover:text-white">
            返回管理后台
          </Link>
          <Link href="/" className="border border-[var(--acid)]/35 px-4 py-3 text-sm font-bold text-[var(--acid)] hover:bg-[var(--acid)]/10">
            返回应用
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-4 py-8 sm:grid-cols-2 xl:grid-cols-4">
        <Metric icon={<UsersRound size={22} />} label="有效提交" value={`${report.total}`} detail="已填写课前问卷" />
        <Metric icon={<ShieldCheck size={22} />} label="填写企业" value={`${report.enterpriseCount}`} detail={`填报名称 ${report.companyCount} 个 / 行业 ${report.industryCount} 个`} />
        <Metric icon={<BarChart3 size={22} />} label="主导阶段" value={report.highlights.stageSignal} detail="按 AI 应用状态统计" />
        <Metric icon={<MessageSquareText size={22} />} label="最新提交" value={formatDate(report.latestSubmittedAt)} detail="数据实时来自提交记录" />
      </section>

      {report.total ? (
        <>
          <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[1fr_1fr]">
            <div className="panel p-6 md:p-7">
              <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">DISCUSSION SIGNALS</div>
              <h2 className="mt-3 text-2xl font-black">现场可直接展开的四个问题</h2>
              <div className="mt-6 grid gap-3">
                <Signal label="现在大家处在哪个 AI 阶段？" value={report.highlights.stageSignal} />
                <Signal label="AI 真正进入业务的最大阻碍是什么？" value={report.highlights.topBlocker} />
                <Signal label="大家最期待课堂解决什么？" value={report.highlights.topExpectation} />
                <Signal label="未来 90 天最想先改哪里？" value={report.highlights.ninetyDaySignal} />
              </div>
            </div>

            <div className="panel p-6 md:p-7">
              <div className="mono text-[10px] tracking-[.2em] text-[var(--cyan)]">READINESS SNAPSHOT</div>
              <h2 className="mt-3 text-2xl font-black">组织准备度快照</h2>
              <div className="mt-6 space-y-6">
                <MiniList title="组织管理方式" items={report.distributions.orgManagement.slice(0, 3)} />
                <MiniList title="人机分工清晰度" items={report.distributions.humanAiDivision.slice(0, 3)} />
                <MiniList title="进化路径判断" items={report.distributions.evolutionPaths.slice(0, 3)} />
              </div>
            </div>
          </section>

          <section className="mx-auto grid max-w-7xl gap-5 py-5 lg:grid-cols-2">
            <ChartPanel title="AI 应用状态" items={report.distributions.aiStage} />
            <ChartPanel title="90 天优先事项" items={report.distributions.ninetyDayPriorities} />
            <ChartPanel title="AI 应用最多的场景" items={report.distributions.aiScenarios.slice(0, 8)} />
            <ChartPanel title="当前最大阻碍" items={report.distributions.aiBlockers.slice(0, 8)} />
            <ChartPanel title="课程期待" items={report.distributions.expectations.slice(0, 8)} />
            <ChartPanel title="参会者角色" items={report.distributions.roles.slice(0, 8)} />
          </section>

          <section className="mx-auto grid max-w-7xl gap-5 lg:grid-cols-[.9fr_1.1fr]">
            <div className="panel p-6 md:p-7">
              <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">QUESTION WALL</div>
              <h2 className="mt-3 text-2xl font-black">参会者最真实的问题</h2>
              <div className="mt-6 space-y-3">
                {report.submissions.slice(0, 9).map((item) => (
                  <blockquote key={item.id} className="border-l-2 border-[var(--acid)]/60 bg-black/20 py-3 pl-4 pr-3">
                    <p className="text-sm leading-7 text-white/78">{item.aiConcern}</p>
                    <footer className="mt-2 text-xs text-white/38">{item.industry} / {item.role}</footer>
                  </blockquote>
                ))}
              </div>
            </div>

            <div className="panel overflow-hidden">
              <div className="border-b border-white/10 p-6 md:p-7">
                <div className="mono text-[10px] tracking-[.2em] text-[var(--cyan)]">SUBMISSION SUMMARY</div>
                <h2 className="mt-3 text-2xl font-black">提交明细</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-white/10 bg-white/5 text-xs text-white/48">
                    <tr>
                      <th className="px-4 py-3 font-medium">姓名</th>
                      <th className="px-4 py-3 font-medium">企业</th>
                      <th className="px-4 py-3 font-medium">角色</th>
                      <th className="px-4 py-3 font-medium">行业</th>
                      <th className="px-4 py-3 font-medium">AI阶段</th>
                      <th className="px-4 py-3 font-medium">提交时间</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {report.submissions.map((item) => (
                      <tr key={item.id} className="hover:bg-white/5">
                        <td className="px-4 py-3 font-medium">
                          {item.participantName}
                          {!hideTestAccounts && item.isTestAccount ? <span className="ml-2 text-xs text-[var(--signal)]">测试</span> : null}
                        </td>
                        <td className="px-4 py-3 text-white/62">{item.company}</td>
                        <td className="px-4 py-3 text-white/62">{item.role}</td>
                        <td className="px-4 py-3 text-white/62">{item.industry}</td>
                        <td className="px-4 py-3 text-white/62">{item.aiStageLabel}</td>
                        <td className="px-4 py-3 text-white/45">{formatDate(item.submittedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : (
        <section className="mx-auto max-w-7xl py-10">
          <div className="panel p-8">
            <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">NO DATA</div>
            <h2 className="mt-4 text-3xl font-black">暂无 6.24 课前问卷提交</h2>
            <p className="mt-3 text-sm leading-7 text-white/55">参会者通过 6.24 课前问卷入口提交后，这里会自动出现汇总报告。</p>
          </div>
        </section>
      )}
    </main>
  );
}

function Metric({ icon, label, value, detail }: { icon: ReactNode; label: string; value: string; detail: string }) {
  return (
    <div className="border border-white/10 bg-[#0b1d19]/82 p-5">
      <div className="flex items-center justify-between gap-4">
        <span className="grid h-11 w-11 place-items-center border border-[var(--acid)]/35 text-[var(--acid)]">{icon}</span>
        <span className="mono text-[10px] tracking-[.18em] text-white/38">{label}</span>
      </div>
      <div className="mt-6 text-3xl font-black leading-tight">{value}</div>
      <p className="mt-3 text-sm text-white/48">{detail}</p>
    </div>
  );
}

function Signal({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-2 border border-white/10 bg-black/20 p-4 md:grid-cols-[1fr_.85fr] md:items-center">
      <div className="text-sm text-white/55">{label}</div>
      <div className="font-bold text-[var(--acid)]">{value}</div>
    </div>
  );
}

function MiniList({ title, items }: { title: string; items: CountItem[] }) {
  return (
    <div>
      <h3 className="text-sm font-bold text-white/78">{title}</h3>
      <div className="mt-3 space-y-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
            <span className="text-white/55">{item.label}</span>
            <span className="mono text-[var(--acid)]">{item.count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChartPanel({ title, items }: { title: string; items: CountItem[] }) {
  return (
    <section className="panel p-6 md:p-7">
      <h2 className="text-xl font-black">{title}</h2>
      <div className="mt-5 space-y-4">
        {items.map((item) => (
          <div key={item.label}>
            <div className="mb-2 flex items-end justify-between gap-4 text-sm">
              <span className="leading-6 text-white/70">{item.label}</span>
              <span className="mono shrink-0 text-xs text-white/45">{item.count} / {Math.round(item.ratio * 100)}%</span>
            </div>
            <div className="h-2 bg-white/8">
              <div className="h-full bg-[var(--acid)]" style={{ width: `${Math.max(4, Math.round(item.ratio * 100))}%` }} />
            </div>
          </div>
        ))}
        {!items.length ? <p className="text-sm text-white/45">暂无数据</p> : null}
      </div>
    </section>
  );
}

function formatDate(value: string | null) {
  if (!value) return "暂无数据";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}
