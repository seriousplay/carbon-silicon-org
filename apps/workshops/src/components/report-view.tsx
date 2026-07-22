"use client";

import Link from "next/link";
import { GlassCard, MetricCard } from "@/components/ui";
import { getTool, onlineSupportMeta } from "@/lib/tools/tool-library";
import type { Report } from "@/lib/assessment/types";
import { PrintButton } from "./print-button";

export function ReportView({ report }: { report: Report }) {
  return (
    <div className="print-page rounded-[32px] border border-emerald-200/15 bg-[#081411]/90 p-6 shadow-2xl shadow-black/30 print:bg-white print:text-slate-950">
      <div className="no-print mb-5 flex justify-end gap-3">
        <PrintButton variant="ghost" />
        <PrintButton />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_0.72fr]">
        <div>
          <div className="text-sm font-bold text-emerald-200 print:text-emerald-700">个人诊断报告</div>
          <h1 className="mt-3 text-4xl font-black leading-tight text-white print:text-slate-950">
            {report.participant.displayName} 的组织 AI 转型诊断
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-emerald-50/68 print:text-slate-700">
            {report.stageSummary}
          </p>
        </div>
        <GlassCard className="p-5 print:border print:border-slate-200 print:bg-slate-50">
          <div className="text-sm text-emerald-50/60 print:text-slate-500">当前阶段</div>
          <div className="mt-2 text-3xl font-black text-white print:text-slate-950">{report.stageLevel}</div>
          <div className="mt-3 text-sm leading-6 text-emerald-50/62 print:text-slate-600">下一阶段重点：{report.nextLevel}</div>
        </GlassCard>
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <MetricCard label="主要短板" value={report.primaryBottleneck.label} detail={report.primaryBottleneck.category} />
        <MetricCard label="短板得分" value={report.primaryBottleneck.score.toFixed(1)} detail="1-5 分" />
        <MetricCard label="链路准备度" value={report.chainScore.toFixed(1)} detail="是否能启动真实工作流" />
        <MetricCard label="宪章准备度" value={report.charterScore.toFixed(1)} detail="边界、责任与复核" />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <ScoreBlock title="三螺旋组织诊断" scores={report.spiralScores} />
        <ScoreBlock title="意义、权力、信任" scores={report.energyScores} />
      </div>

      <div className="mt-8 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <GlassCard className="p-6 print:border print:border-slate-200 print:bg-white">
          <div className="text-sm font-bold text-emerald-200 print:text-emerald-700">优先行动</div>
          <h2 className="mt-2 text-2xl font-black text-white print:text-slate-950">{report.actionRecommendation.title}</h2>
          <p className="mt-3 text-sm leading-7 text-emerald-50/65 print:text-slate-700">{report.actionRecommendation.rationale}</p>
          <ol className="mt-5 grid gap-3">
            {report.actionRecommendation.steps.map((step, index) => (
              <li key={step} className="flex gap-3 text-sm leading-7 text-emerald-50/78 print:text-slate-700">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-emerald-300 font-black text-[#06110f]">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </GlassCard>

        <GlassCard className="p-6 print:border print:border-slate-200 print:bg-white">
          <div className="text-sm font-bold text-emerald-200 print:text-emerald-700">推荐工具</div>
          <div className="mt-4 grid gap-3">
            {report.recommendedTools.map((toolId) => {
              const tool = getTool(toolId);
              if (!tool) return null;
              return (
                <Link
                  key={tool.id}
                  href={`/tools/${tool.id}`}
                  className="rounded-2xl border border-emerald-200/12 bg-white/[0.045] p-4 transition hover:bg-white/10 print:border-slate-200 print:bg-slate-50"
                >
                  <div className="text-sm font-black text-white print:text-slate-950">{tool.name}</div>
                  <div className="mt-1 text-xs leading-5 text-emerald-50/55 print:text-slate-600">{tool.purpose}</div>
                  <div className="mt-3 inline-flex rounded-full border border-emerald-200/15 px-2.5 py-1 text-[11px] font-bold text-emerald-100/70 print:border-slate-300 print:text-slate-600">
                    {onlineSupportMeta[tool.onlineSupport].label}
                  </div>
                </Link>
              );
            })}
          </div>
        </GlassCard>
      </div>

      <div className="mt-8 rounded-3xl border border-emerald-200/12 bg-black/20 p-5 print:border-slate-200 print:bg-slate-50">
        <div className="text-sm font-bold text-emerald-200 print:text-emerald-700">真实现场摘录</div>
        <div className="mt-3 grid gap-3 text-sm leading-7 text-emerald-50/65 print:text-slate-700">
          {report.openAnswers.scenario ? <p>场景：{report.openAnswers.scenario}</p> : null}
          {report.openAnswers.workflow ? <p>优先链路：{report.openAnswers.workflow}</p> : null}
          {report.openAnswers.blocker ? <p>阻力判断：{report.openAnswers.blocker}</p> : null}
        </div>
      </div>
    </div>
  );
}

function ScoreBlock({ title, scores }: { title: string; scores: { label: string; score: number }[] }) {
  return (
    <GlassCard className="p-6 print:border print:border-slate-200 print:bg-white">
      <h2 className="text-xl font-black text-white print:text-slate-950">{title}</h2>
      <div className="mt-5 grid gap-4">
        {scores.map((score) => (
          <div key={score.label}>
            <div className="flex justify-between text-sm font-bold text-emerald-50/78 print:text-slate-700">
              <span>{score.label}</span>
              <span>{score.score.toFixed(1)}</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-white/10 print:bg-slate-200">
              <div className="h-full rounded-full bg-emerald-300" style={{ width: `${(score.score / 5) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
