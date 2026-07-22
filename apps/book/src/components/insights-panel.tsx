"use client";

import type { Insight } from "@/lib/assessment/types";
import { Lightbulb, TrendingUp, AlertTriangle, Target, Zap } from "lucide-react";

const typeConfig: Record<string, { icon: typeof Lightbulb; color: string; label: string }> = {
  finding: { icon: Lightbulb, color: "emerald", label: "核心发现" },
  progression: { icon: TrendingUp, color: "blue", label: "阶段分析" },
  gap: { icon: AlertTriangle, color: "orange", label: "能力差距" },
  theme: { icon: Zap, color: "purple", label: "主题洞察" },
  action: { icon: Target, color: "green", label: "行动建议" },
};

const priorityConfig: Record<string, { border: string; bg: string }> = {
  high: { border: "border-red-300/30", bg: "bg-red-300/5" },
  medium: { border: "border-yellow-300/30", bg: "bg-yellow-300/5" },
  low: { border: "border-emerald-300/20", bg: "bg-emerald-300/5" },
};

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (!insights.length) {
    return (
      <div className="rounded-3xl border border-emerald-200/15 bg-[#0c201c]/75 p-8 text-center">
        <p className="text-emerald-50/50">暂无洞察数据，请确保有足够的测评回复。</p>
      </div>
    );
  }

  const grouped = insights.reduce<Record<string, Insight[]>>((acc, insight) => {
    if (!acc[insight.priority]) acc[insight.priority] = [];
    acc[insight.priority].push(insight);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-black text-white">整体洞察</h2>
        <p className="mt-2 text-sm text-emerald-50/60">基于数据自动生成的讨论引导要点</p>
      </div>

      {/* High priority insights */}
      {grouped.high?.length ? (
        <InsightGroup insights={grouped.high} title="高优先级" priority="high" />
      ) : null}

      {/* Medium priority insights */}
      {grouped.medium?.length ? (
        <InsightGroup insights={grouped.medium} title="中优先级" priority="medium" />
      ) : null}

      {/* Low priority insights */}
      {grouped.low?.length ? (
        <InsightGroup insights={grouped.low} title="参考信息" priority="low" />
      ) : null}
    </div>
  );
}

function InsightGroup({ insights, title, priority }: { insights: Insight[]; title: string; priority: string }) {
  const config = priorityConfig[priority];

  return (
    <div className={`rounded-3xl border ${config.border} ${config.bg} p-6`}>
      <h3 className="mb-4 text-lg font-black text-white">{title}</h3>
      <div className="space-y-4">
        {insights.map((insight, index) => (
          <InsightCard key={`${insight.type}-${index}`} insight={insight} />
        ))}
      </div>
    </div>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const typeConf = typeConfig[insight.type] ?? typeConfig.finding;
  const Icon = typeConf.icon;

  return (
    <div className="rounded-2xl border border-emerald-200/12 bg-black/20 p-5">
      <div className="flex items-start gap-3">
        <div className={`rounded-lg bg-${typeConf.color}-300/15 p-2 text-${typeConf.color}-200`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase tracking-wider text-${typeConf.color}-200/70`}>
              {typeConf.label}
            </span>
          </div>
          <h4 className="mt-1 text-lg font-black text-white">{insight.title}</h4>
          <p className="mt-2 text-sm leading-7 text-emerald-50/70">{insight.description}</p>

          {insight.supportingData.length > 0 && (
            <div className="mt-3 rounded-lg bg-black/30 p-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-50/50">数据依据</p>
              <div className="space-y-1">
                {insight.supportingData.map((data, i) => (
                  <div key={i} className="text-xs font-mono text-emerald-50/70">
                    • {data}
                  </div>
                ))}
              </div>
            </div>
          )}

          {insight.discussionQuestions.length > 0 && (
            <div className="mt-4 border-t border-emerald-200/10 pt-3">
              <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-50/50">建议讨论问题</p>
              <ul className="space-y-2">
                {insight.discussionQuestions.map((question, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-emerald-50/80">
                    <span className="mt-1 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-300/20 text-[10px] font-black text-emerald-200">
                      {i + 1}
                    </span>
                    <span className="flex-1">{question}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
