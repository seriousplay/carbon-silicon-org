"use client";

import { useState, useEffect } from "react";
import { MetricCard } from "@/components/ui";
import { SummaryCharts } from "@/components/summary-charts";
import { PrintButton } from "@/components/print-button";
import { QuestionDistributions } from "@/components/question-distributions";
import { InsightsPanel } from "@/components/insights-panel";
import { ResponsesTable } from "@/components/responses-table";
import { Copy, Eye, EyeOff } from "lucide-react";
import type { AssessmentRun } from "@/lib/runs/types";
import type { EventSummary, QuestionDistribution, Insight, RunResponse, PaginatedResponses } from "@/lib/assessment/types";

export function EnhancedSummaryReport({
  run,
  initialSummary,
}: {
  run: AssessmentRun;
  initialSummary: EventSummary;
}) {
  const [distributions, setDistributions] = useState<QuestionDistribution[]>([]);
  const [responses, setResponses] = useState<PaginatedResponses | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectionMode, setProjectionMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "insights" | "questions" | "responses">("overview");

  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`/api/runs/${run.slug}/analytics`);
        if (res.ok) {
          const data = await res.json();
          setDistributions(data.distributions || []);
          setResponses(data.responses || null);
          setInsights(data.insights || []);
        }
      } catch (error) {
        console.error("Failed to load analytics:", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [run.slug]);

  const copyDiscussionPoints = () => {
    const text = formatInsightsForCopy(insights, run);
    navigator.clipboard.writeText(text);
    alert("讨论要点已复制到剪贴板！");
  };

  return (
    <div className="print-page rounded-[32px] border border-emerald-200/15 bg-[#081411]/90 p-6 shadow-2xl print:bg-white print:text-slate-950">
      {/* Header */}
      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <PrintButton />
        <div className="flex items-center gap-3">
          <button
            onClick={copyDiscussionPoints}
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200/25 px-4 py-2 text-sm font-bold text-emerald-50 transition hover:bg-white/10"
          >
            <Copy className="h-4 w-4" />
            复制讨论要点
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-emerald-50/70">投影模式</span>
            <button
              onClick={() => setProjectionMode(!projectionMode)}
              className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
                projectionMode ? "bg-emerald-300" : "bg-white/20"
              }`}
            >
              <span
                className={`inline-block h-6 w-6 transform rounded-full bg-white transition-transform ${
                  projectionMode ? "translate-x-7" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      <div className={`${projectionMode ? "text-xl" : ""}`}>
        <div className="text-sm font-bold text-emerald-200 print:text-emerald-700">
          工作坊匿名汇总报告
        </div>
        <h1 className={`mt-3 font-black text-white print:text-slate-950 ${projectionMode ? "text-5xl" : "text-4xl"}`}>
          {initialSummary.title}
        </h1>
        <p className="mt-3 text-emerald-50/62 print:text-slate-600">
          这份报告用于现场讨论、企业复盘和课后行动设计。所有数据按匿名方式汇总，开放题摘录应避免传播敏感信息。
        </p>
      </div>

      {/* Key Metrics */}
      <div className={`mt-8 grid gap-4 ${projectionMode ? "md:grid-cols-4" : "md:grid-cols-4"}`}>
        <MetricCard label="参与人数" value={initialSummary.participantCount} />
        <MetricCard label="完成测评" value={initialSummary.completedCount} />
        <MetricCard label="链路准备均值" value={initialSummary.averageChainScore.toFixed(1)} />
        <MetricCard label="宪章准备均值" value={initialSummary.averageCharterScore.toFixed(1)} />
      </div>

      {/* Tab Navigation */}
      <div className="no-print mt-8 flex gap-2 border-b border-emerald-200/15">
        {[
          { key: "overview", label: "总览" },
          { key: "insights", label: "整体洞察" },
          { key: "questions", label: "问题分布" },
          { key: "responses", label: "所有回复" },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`rounded-t-lg px-4 py-2 text-sm font-bold transition ${
              activeTab === tab.key
                ? "border-b-2 border-emerald-300 bg-emerald-300/10 text-emerald-200"
                : "text-emerald-50/60 hover:bg-white/5 hover:text-emerald-50"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === "overview" && (
          <div className="space-y-8">
            <SummaryCharts summary={initialSummary} />

            <div className="rounded-3xl border border-emerald-200/12 bg-black/20 p-5 print:border-slate-200 print:bg-slate-50">
              <h2 className="text-2xl font-black text-white print:text-slate-950">最值得讨论的 3 个问题</h2>
              <ol className="mt-4 grid gap-3 text-sm leading-7 text-emerald-50/70 print:text-slate-700">
                <li>1. 当前群体最集中的转型阶段是什么？它对应的下一课是什么？</li>
                <li>2. 三螺旋和隐性能量里，哪个短板最容易被组织忽视？</li>
                <li>3. 哪一条真实人机链路最适合在两周内启动试验？</li>
              </ol>
            </div>

            {initialSummary.openAnswerHighlights.length > 0 && (
              <div className="rounded-3xl border border-emerald-200/12 bg-black/20 p-5 print:border-slate-200 print:bg-slate-50">
                <h2 className="text-2xl font-black text-white print:text-slate-950">开放题摘录</h2>
                <div className="mt-4 grid gap-3 text-sm leading-7 text-emerald-50/70 print:text-slate-700">
                  {initialSummary.openAnswerHighlights.map((item, index) => (
                    <p key={index}>{item}</p>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "insights" && (
          <div className="mt-6">
            {loading ? (
              <div className="py-12 text-center text-emerald-50/50">加载洞察中...</div>
            ) : (
              <InsightsPanel insights={insights} />
            )}
          </div>
        )}

        {activeTab === "questions" && (
          <div className="mt-6">
            {loading ? (
              <div className="py-12 text-center text-emerald-50/50">加载问题分布中...</div>
            ) : (
              <QuestionDistributions distributions={distributions} />
            )}
          </div>
        )}

        {activeTab === "responses" && (
          <div className="mt-6">
            {loading ? (
              <div className="py-12 text-center text-emerald-50/50">加载回复数据中...</div>
            ) : responses ? (
              <ResponsesTable
                responses={responses.responses}
                pagination={responses.pagination}
              />
            ) : (
              <div className="py-12 text-center text-emerald-50/50">暂无回复数据</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function formatInsightsForCopy(insights: Insight[], run: AssessmentRun): string {
  const sections = [
    `【${run.title}】工作坊讨论要点`,
    `生成时间: ${new Date().toLocaleString("zh-CN")}`,
    "",
    "=== 核心发现 ===",
    ...insights
      .filter((i) => i.type === "finding")
      .map((i) => `• ${i.title}\n  ${i.description}`),
    "",
    "=== 阶段进展分析 ===",
    ...insights
      .filter((i) => i.type === "progression")
      .map((i) => `• ${i.title}\n  ${i.description}`),
    "",
    "=== 能力差距 ===",
    ...insights
      .filter((i) => i.type === "gap")
      .map((i) => `• ${i.title}\n  ${i.description}`),
    "",
    "=== 建议讨论问题 ===",
    ...insights.flatMap((i) => i.discussionQuestions).map((q) => `• ${q}`),
  ];

  return sections.join("\n");
}
