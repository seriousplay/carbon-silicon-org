import { MetricCard } from "@/components/ui";
import { SummaryCharts } from "@/components/summary-charts";
import { PrintButton } from "@/components/print-button";
import type { EventSummary } from "@/lib/assessment/types";
import type { AssessmentRun } from "@/lib/runs/types";
import { runTypeLabels } from "@/lib/runs/default-runs";

export function SummaryReport({ run, summary }: { run: AssessmentRun; summary: EventSummary }) {
  return (
    <div className="print-page rounded-[32px] border border-emerald-200/15 bg-[#081411]/90 p-6 shadow-2xl print:bg-white print:text-slate-950">
      <div className="no-print mb-5 flex justify-end">
        <PrintButton />
      </div>
      <div className="text-sm font-bold text-emerald-200 print:text-emerald-700">
        {runTypeLabels[run.runType]}匿名汇总报告
      </div>
      <h1 className="mt-3 text-4xl font-black text-white print:text-slate-950">{summary.title}</h1>
      <p className="mt-3 text-emerald-50/62 print:text-slate-600">
        这份报告用于现场讨论、企业复盘和课后行动设计。所有数据按匿名方式汇总，开放题摘录应避免传播敏感信息。
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <MetricCard label="参与人数" value={summary.participantCount} />
        <MetricCard label="完成测评" value={summary.completedCount} />
        <MetricCard label="链路准备均值" value={summary.averageChainScore.toFixed(1)} />
        <MetricCard label="宪章准备均值" value={summary.averageCharterScore.toFixed(1)} />
      </div>

      <div className="mt-8">
        <SummaryCharts summary={summary} />
      </div>

      <div className="mt-8 rounded-3xl border border-emerald-200/12 bg-black/20 p-5 print:border-slate-200 print:bg-slate-50">
        <h2 className="text-2xl font-black text-white print:text-slate-950">最值得讨论的 3 个问题</h2>
        <ol className="mt-4 grid gap-3 text-sm leading-7 text-emerald-50/70 print:text-slate-700">
          <li>1. 当前群体最集中的转型阶段是什么？它对应的下一课是什么？</li>
          <li>2. 三螺旋和隐性能量里，哪个短板最容易被组织忽视？</li>
          <li>3. 哪一条真实人机链路最适合在两周内启动试验？</li>
        </ol>
      </div>

      <div className="mt-8 rounded-3xl border border-emerald-200/12 bg-black/20 p-5 print:border-slate-200 print:bg-slate-50">
        <h2 className="text-2xl font-black text-white print:text-slate-950">开放题摘录</h2>
        <div className="mt-4 grid gap-3 text-sm leading-7 text-emerald-50/70 print:text-slate-700">
          {summary.openAnswerHighlights.length ? (
            summary.openAnswerHighlights.map((item, index) => <p key={`${item}-${index}`}>{item}</p>)
          ) : (
            <p>暂无开放题摘录。</p>
          )}
        </div>
      </div>
    </div>
  );
}
