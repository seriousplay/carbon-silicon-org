import Link from "next/link";
import { ClipboardList, Download, ExternalLink } from "lucide-react";
import { MetricCard, SectionLabel } from "@/components/ui";
import { SummaryCharts } from "@/components/summary-charts";
import { AdminRunOperations } from "@/components/admin-run-operations";
import type { EventSummary } from "@/lib/assessment/types";
import type { AssessmentRun } from "@/lib/runs/types";
import { runStatusLabels, runTypeLabels } from "@/lib/runs/default-runs";
import type { ToolSessionSummary } from "@/lib/tools/sessions";

export function AdminRunDashboard({
  run,
  summary,
  toolSummary,
  entryUrl,
}: {
  run: AssessmentRun;
  summary: EventSummary;
  toolSummary: ToolSessionSummary;
  entryUrl: string;
}) {
  const preworkCount = toolSummary.byTool.find((item) => item.toolId === "super-individual-prework")?.count ?? 0;

  return (
    <>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <SectionLabel>{runTypeLabels[run.runType]} · {runStatusLabels[run.status]}</SectionLabel>
          <h1 className="text-4xl font-black text-white">{summary.title}</h1>
          <p className="mt-3 text-emerald-50/60">入口级匿名汇总报告，用于现场讨论、企业复盘和课后行动设计。</p>
          <div className="mt-4 flex flex-wrap gap-2 text-xs text-emerald-50/55">
            <span className="rounded-full border border-emerald-200/15 px-3 py-1">/{run.slug}</span>
            {run.audience ? <span className="rounded-full border border-emerald-200/15 px-3 py-1">{run.audience}</span> : null}
            <span className="rounded-full border border-emerald-200/15 px-3 py-1">{run.showOnHome ? "首页公开" : "仅链接访问"}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/e/${run.slug}`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200/20 px-5 py-3 text-sm font-black text-emerald-50"
          >
            <ExternalLink className="h-4 w-4" />
            打开测评入口
          </Link>
          <Link
            href={`/admin/runs/${run.slug}/report`}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-[#06110f]"
          >
            <Download className="h-4 w-4" />
            打开汇总报告
          </Link>
          <Link
            href={`/admin/runs/${run.slug}/prework`}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-emerald-200/20 px-5 py-3 text-sm font-black text-emerald-50"
          >
            <ClipboardList className="h-4 w-4" />
            课前问卷报告
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard label="参与人数" value={summary.participantCount} />
        <MetricCard label="完成测评" value={summary.completedCount} />
        <MetricCard label="链路准备均值" value={summary.averageChainScore.toFixed(1)} />
        <MetricCard label="宪章准备均值" value={summary.averageCharterScore.toFixed(1)} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <MetricCard label="工具使用记录" value={toolSummary.total} detail="单独工具与组合工具提交" />
        <MetricCard label="课前问卷" value={preworkCount} detail="超级个体工作坊提交" />
        <MetricCard label="使用工具数" value={toolSummary.byTool.length} detail="已产生数据的工具" />
        <MetricCard label="最高频工具" value={toolSummary.byTool[0]?.toolName ?? "暂无"} detail={toolSummary.byTool[0] ? `${toolSummary.byTool[0].count} 次提交` : "等待提交"} />
      </div>

      <div className="mt-8">
        <AdminRunOperations run={run} entryUrl={entryUrl} />
      </div>

      <div className="mt-8">
        <SummaryCharts summary={summary} />
      </div>

      <div className="mt-8 rounded-3xl border border-emerald-200/15 bg-[#0c201c]/75 p-6">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
          <div>
            <h2 className="text-2xl font-black text-white">工具使用数据池</h2>
            <p className="mt-2 text-sm leading-7 text-emerald-50/60">
              同一入口下，参与者单独使用或连续使用工具，都会沉淀到这里。后续可以用于企业复盘、工具热度分析和行动追踪。
            </p>
          </div>
          <Link
            href={`/api/runs/${run.slug}/tool-sessions/export`}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-emerald-200/20 px-5 py-3 text-sm font-black text-emerald-50"
          >
            <Download className="h-4 w-4" />
            导出工具数据
          </Link>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-2xl bg-white/[0.045] p-4">
            <h3 className="text-lg font-black text-white">工具使用分布</h3>
            <div className="mt-4 grid gap-3">
              {toolSummary.byTool.length ? (
                toolSummary.byTool.map((item) => (
                  <div key={item.toolId}>
                    <div className="flex justify-between gap-3 text-sm font-bold text-emerald-50/78">
                      <span>{item.toolName}</span>
                      <span>{item.count}</span>
                    </div>
                    <div className="mt-2 h-2 rounded-full bg-white/10">
                      <div className="h-full rounded-full bg-emerald-300" style={{ width: `${Math.max(12, (item.count / Math.max(1, toolSummary.total)) * 100)}%` }} />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm leading-7 text-emerald-50/55">暂无工具使用记录。</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.045] p-4">
            <h3 className="text-lg font-black text-white">最近提交</h3>
            <div className="mt-4 grid gap-3">
              {toolSummary.latest.length ? (
                toolSummary.latest.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-emerald-200/10 bg-black/16 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-black text-white">{item.toolName}</div>
                      <div className="text-xs text-emerald-50/45">{new Date(item.submittedAt).toLocaleString("zh-CN")}</div>
                    </div>
                    <p className="mt-2 text-sm leading-7 text-emerald-50/65">
                      {item.displayName}
                      {item.companyName ? ` · ${item.companyName}` : ""}
                      {item.teamName ? ` · ${item.teamName}` : ""}
                    </p>
                    {item.dataScope ? <p className="mt-2 text-sm leading-7 text-emerald-50/58">数据对象：{item.dataScope}</p> : null}
                    {item.useCase ? <p className="mt-2 text-sm leading-7 text-emerald-50/58">场景：{item.useCase}</p> : null}
                    {item.nextAction ? <p className="mt-2 text-sm leading-7 text-emerald-50/58">下一步：{item.nextAction}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-sm leading-7 text-emerald-50/55">暂无提交。可从前台入口的“企业工具组合”开始使用。</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 rounded-3xl border border-emerald-200/15 bg-[#0c201c]/75 p-6">
        <h2 className="text-2xl font-black text-white">开放题摘录</h2>
        <div className="mt-5 grid gap-3">
          {summary.openAnswerHighlights.length ? (
            summary.openAnswerHighlights.map((item, index) => (
              <div key={`${item}-${index}`} className="rounded-2xl bg-white/[0.045] p-4 text-sm leading-7 text-emerald-50/72">
                {item}
              </div>
            ))
          ) : (
            <div className="rounded-2xl bg-white/[0.045] p-4 text-sm leading-7 text-emerald-50/55">
              暂无开放题摘录。完成测评后，这里会显示入口内的真实组织问题。
            </div>
          )}
        </div>
      </div>
    </>
  );
}
