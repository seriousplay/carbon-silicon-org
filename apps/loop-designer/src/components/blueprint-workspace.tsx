"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Download, LoaderCircle, RotateCw } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import type { LoopDesignerSession } from "@/lib/session-types";
import {
  DIAGNOSIS_STEPS,
  STAGE_LADDER,
  type BlueprintCandidate,
  type BlueprintOutput,
  type BlueprintStrategicInsights,
  type ReadinessOutput,
  type StrategicBattlefieldOutput,
  type StrategicContext,
  getStageLadderItem,
} from "@/lib/workflow";

export function BlueprintWorkspace({ session }: { session: LoopDesignerSession }) {
  const router = useRouter();
  const [blueprint, setBlueprint] = useState<BlueprintOutput | undefined>(session.outputs.blueprint);
  const [busy, setBusy] = useState<"generate" | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<"markdown" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  async function generate() {
    setBusy("generate");
    setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${session.id}/blueprint/generate`, { method: "POST" });
      const payload = await readApiResponse<{ blueprint?: BlueprintOutput }>(response, "蓝图生成失败");
      if (!response.ok || !payload.blueprint) return setError(payload.error || "蓝图生成失败");
      setBlueprint(payload.blueprint);
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  async function editDiagnosis(stepIndex = 0) {
    setBusy(`diagnosis-${stepIndex}`);
    setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${session.id}/diagnosis`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepIndex }),
      });
      const payload = await readApiResponse<{ nextUrl?: string }>(response, "返回诊断失败");
      if (!response.ok || !payload.nextUrl) return setError(payload.error || "返回诊断失败");
      router.push(payload.nextUrl);
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  async function select(candidateId: string) {
    setBusy(candidateId);
    setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${session.id}/blueprint/preferred`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId }),
      });
      const payload = await readApiResponse<{ nextUrl?: string }>(response, "火种回路锁定失败");
      if (!response.ok || !payload.nextUrl) return setError(payload.error || "火种回路锁定失败");
      router.push(payload.nextUrl);
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setBusy(null);
    }
  }

  async function download(kind: "markdown" | "pdf") {
    setExporting(kind);
    setExportError(null);
    try {
      window.location.assign(`/loop-designer/api/sessions/${session.id}/blueprint/exports/${kind}`);
    } catch {
      setExportError("网络连接中断，请稍后重试。");
    } finally {
      setExporting(null);
    }
  }

  if (!blueprint) {
    return (
      <main className="min-h-screen px-5 py-8 md:px-10">
        <div className="mx-auto max-w-3xl">
          <div className="mono text-[10px] tracking-[.22em] text-[var(--acid)]">STRATEGIC BLUEPRINT / READY</div>
          <h1 className="mt-4 text-4xl font-black">生成 AI 化战略蓝图</h1>
          <section className="panel mt-8 p-8">
            <p className="leading-8 text-white/64">战略身份、组织能力、关键战场和准备度信息已进入同一个会话。现在生成第一战场蓝图和候选火种回路。</p>
            {error ? <p className="mt-4 text-sm text-orange-200">{error}</p> : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button disabled={busy !== null} onClick={() => editDiagnosis()} className="inline-flex items-center gap-2 border border-white/15 px-5 py-3 font-bold text-white/70 disabled:opacity-40">
                {busy === "diagnosis-0" ? <LoaderCircle className="animate-spin" size={16} /> : <ArrowLeft size={16} />}
                返回修改战略设计
              </button>
              <button disabled={busy !== null} onClick={generate} className="inline-flex items-center gap-2 bg-[var(--acid)] px-5 py-3 font-bold text-black disabled:opacity-40">
                {busy === "generate" ? <LoaderCircle className="animate-spin" size={16} /> : <RotateCw size={16} />}
                生成战略蓝图
              </button>
            </div>
          </section>
        </div>
      </main>
    );
  }

  const view = normalizeBlueprintView(blueprint);
  const recommended = view.recommendedSeedLoop;
  return (
    <main className="min-h-screen px-5 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mono text-[10px] tracking-[.22em] text-[var(--acid)]">AI STRATEGIC BLUEPRINT / {session.id.slice(0, 8)}</div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black">AI 化战略蓝图</h1>
            <p className="mt-3 text-white/56">{view.strategicContext.organizationName} · {view.strategicContext.industry} · {view.strategicContext.business}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button disabled={busy !== null || exporting !== null} onClick={() => download("markdown")} className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-sm disabled:opacity-40">
              <Download size={15} />
              {exporting === "markdown" ? "准备中..." : "Markdown"}
            </button>
            <button disabled={busy !== null || exporting !== null} onClick={() => download("pdf")} className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-sm disabled:opacity-40">
              <Download size={15} />
              {exporting === "pdf" ? "准备中..." : "PDF"}
            </button>
            <button disabled={busy !== null || exporting !== null} onClick={() => editDiagnosis()} className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-sm disabled:opacity-40">
              {busy === "diagnosis-0" ? <LoaderCircle className="animate-spin" size={15} /> : <ArrowLeft size={15} />}
              修改战略设计
            </button>
            <button disabled={busy !== null || exporting !== null} onClick={generate} className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-sm disabled:opacity-40">
              {busy === "generate" ? <LoaderCircle className="animate-spin" size={15} /> : <RotateCw size={15} />}
              重新生成
            </button>
          </div>
        </div>
        {exportError ? <div className="mt-4 border border-[var(--signal)]/50 bg-[var(--signal)]/10 px-4 py-3 text-sm text-orange-100">{exportError}</div> : null}

        <section className="mt-8 grid gap-4 lg:grid-cols-[1.3fr_.7fr]">
          <article className="panel p-6">
            <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">STRATEGIC NARRATIVE</div>
            <h2 className="mt-3 text-2xl font-black">为什么要打这场仗</h2>
            <p className="mt-4 leading-8 text-white/66">{view.strategicNarrative}</p>
          </article>
          <article className="panel p-6">
            <div className="mono text-[10px] tracking-[.18em] text-white/34">MISSION / VISION</div>
            <Block label="使命" value={view.strategicContext.mission} />
            <Block label="愿景" value={view.strategicContext.vision} />
            <Block label="组织能力聚焦" value={view.strategicContext.focusReason} />
          </article>
        </section>

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <Metric label="战略身份" value={view.strategicContext.businessEssence} detail={`${view.strategicContext.industry} · ${view.strategicContext.scale}`} />
          <Metric label="关键战场" value={view.battlefield.name} detail={`${view.battlefield.scopeLabel} · ${view.battlefield.strategicGoal}`} />
          <Metric label="准备度结论" value={`${view.readiness.averageScore}/5`} detail={view.readiness.conclusion} />
        </section>

        <StageLadderPanel blueprint={blueprint} />

        <StrategicInsightsPanel insights={view.strategicInsights} onRegenerate={generate} busy={busy === "generate"} disabled={busy !== null} />

        <section className="panel mt-8 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="mono text-[10px] tracking-[.18em] text-white/34">READINESS RADAR</div>
              <h2 className="mt-2 text-2xl font-black">组织准备度：结构 / 细胞 / 环境</h2>
            </div>
            <span className="border border-[var(--signal)]/40 px-3 py-2 text-xs text-[var(--signal)]">主要风险：{view.readiness.primaryRisk}</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            <ReadinessCard label="结构" score={view.readiness.structure.score} gap={view.readiness.structure.gap} />
            <ReadinessCard label="细胞" score={view.readiness.cell.score} gap={view.readiness.cell.gap} />
            <ReadinessCard label="环境" score={view.readiness.environment.score} gap={view.readiness.environment.gap} />
          </div>
        </section>

        {recommended ? (
          <section className="mt-8 border border-[var(--acid)]/35 bg-[var(--acid)]/8 p-6">
            <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">RECOMMENDED SEED LOOP</div>
            <h2 className="mt-3 text-3xl font-black">{recommended.title}</h2>
            <p className="mt-4 max-w-4xl leading-8 text-white/68">{recommended.valueDescription}</p>
          </section>
        ) : null}

        <section className="panel mt-8 p-5">
          <div className="mono text-[10px] tracking-[.18em] text-white/34">DIRECT EDIT</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {DIAGNOSIS_STEPS.map((step, index) => (
              <button key={step.id} disabled={busy !== null} onClick={() => editDiagnosis(index)} className="border border-white/12 px-3 py-2 text-xs text-white/58 hover:border-[var(--cyan)] hover:text-[var(--cyan)] disabled:opacity-40">
                {busy === `diagnosis-${index}` ? "跳转中..." : `修改${step.title}`}
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          {blueprint.candidates.map((candidate, index) => (
            <article key={candidate.id} className={`panel flex flex-col p-6 ${candidate.id === recommended?.id ? "border-[var(--acid)]/50" : ""}`}>
              <div className="mono text-[10px] tracking-[.2em] text-[var(--cyan)]">候选 0{index + 1} · HIGH VALUE SCORE {candidate.seedLoopWeightedScore ?? candidate.roiScore ?? candidate.score}</div>
              <h2 className="mt-4 text-2xl font-black leading-tight">{candidate.title}</h2>
              <p className="mt-4 text-sm leading-7 text-white/62">{candidate.valueDescription || candidate.evidence}</p>
              <div className="mt-4 grid grid-cols-2 gap-2 text-xs text-white/58">
                {candidate.seedLoopScores ? (
                  <>
                    <ScorePill label="痛点" value={candidate.seedLoopScores.pain} />
                    <ScorePill label="数据" value={candidate.seedLoopScores.data} />
                    <ScorePill label="复制潜力" value={candidate.seedLoopScores.replication} />
                    <ScorePill label="风险可控度" value={candidate.seedLoopScores.riskControl} />
                  </>
                ) : (
                  <>
                    <ScorePill label="战略相关性" value={candidateScore(candidate, "strategicFit")} />
                    <ScorePill label="ROI" value={candidateScore(candidate, "roi")} />
                    <ScorePill label="能力沉淀" value={candidateScore(candidate, "capabilityAccumulation")} />
                    <ScorePill label="准备度匹配" value={candidateScore(candidate, "readinessFit")} />
                    <ScorePill label="扩散潜力" value={candidateScore(candidate, "diffusionPotential")} />
                  </>
                )}
              </div>
              <div className="mt-5 space-y-4 text-sm leading-6 text-white/58">
                <Block label="AI 做什么" value={candidate.aiRole} />
                <Block label="人做什么" value={candidate.humanRole} />
                <Block label="成功标准" value={candidate.successCriteria} />
                <Block label="筛选依据" value={candidate.evidence} />
              </div>
              <button disabled={busy !== null} onClick={() => select(candidate.id)} className="mt-6 inline-flex items-center justify-center gap-2 bg-[var(--acid)] px-4 py-3 font-bold text-black disabled:opacity-40">
                {busy === candidate.id ? <LoaderCircle className="animate-spin" size={16} /> : <Check size={16} />}
                锁定第一火种回路
              </button>
            </article>
          ))}
        </section>

        <section className="panel mt-8 p-6">
          <h2 className="text-2xl font-black">周一启动清单</h2>
          <ul className="mt-4 grid gap-3 text-sm leading-6 text-white/62 md:grid-cols-3">
            {blueprint.mondayChecklist.map((item) => <li key={item} className="border border-white/10 p-4">{item}</li>)}
          </ul>
          <h2 className="mt-7 text-2xl font-black">团队简报</h2>
          <p className="mt-3 leading-8 text-white/64">{blueprint.teamBrief}</p>
          {error ? <p className="mt-4 text-sm text-orange-200">{error}</p> : null}
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <div className="panel p-5"><div className="mono text-[10px] tracking-[.16em] text-white/34">{label}</div><div className="mt-3 text-xl font-black">{value}</div><p className="mt-3 text-sm leading-6 text-white/50">{detail}</p></div>;
}

function ReadinessCard({ label, score, gap }: { label: string; score: number; gap: string }) {
  return <div className="border border-white/10 p-4"><div className="flex items-center justify-between"><b>{label}</b><span className="mono text-[var(--acid)]">{score}/5</span></div><div className="mt-3 h-2 bg-white/10"><div className="h-full bg-[var(--acid)]" style={{ width: `${score * 20}%` }} /></div><p className="mt-3 text-sm leading-6 text-white/55">{gap}</p></div>;
}

function StageLadderPanel({ blueprint }: { blueprint: BlueprintOutput }) {
  const current = getStageLadderItem(blueprint.diagnosis.stageLevel);
  const currentIndex = STAGE_LADDER.findIndex((item) => item.level === current.level);
  const next = currentIndex >= 0 ? STAGE_LADDER[currentIndex + 1] : undefined;
  return (
    <section className="panel mt-8 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">FIVE-LEVEL LADDER</div>
          <h2 className="mt-2 text-2xl font-black">五级阶梯：当前处在 {current.level} {current.name}</h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-white/58">{current.businessMeaning}</p>
        </div>
        <span className="border border-[var(--acid)]/40 px-3 py-2 text-xs text-[var(--acid)]">{current.level}</span>
      </div>
      <p className="mt-5 border border-white/10 bg-white/[0.03] p-4 text-sm leading-7 text-white/62">判断依据：{blueprint.diagnosis.stageReason}</p>
      <div className="mt-5 grid gap-3 md:grid-cols-5">
        {STAGE_LADDER.map((item) => {
          const active = item.level === current.level;
          return (
            <div key={item.level} className={`min-h-36 border p-4 ${active ? "border-[var(--acid)] bg-[var(--acid)]/10" : "border-white/10"}`}>
              <div className={`mono text-[10px] ${active ? "text-[var(--acid)]" : "text-white/34"}`}>{item.level}</div>
              <h3 className="mt-2 font-black">{item.name}</h3>
              <p className="mt-2 text-xs leading-5 text-white/50">{item.businessMeaning}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-5 border border-[var(--cyan)]/20 bg-[var(--cyan)]/5 p-4">
        <div className="mono text-[10px] tracking-[.16em] text-[var(--cyan)]">NEXT UPGRADE COST</div>
        <p className="mt-2 text-sm leading-7 text-white/62">{next ? `迈向 ${next.level} ${next.name}：${next.upgradeCost}` : current.upgradeCost}</p>
      </div>
    </section>
  );
}

function StrategicInsightsPanel({ insights, onRegenerate, busy, disabled }: { insights?: BlueprintStrategicInsights; onRegenerate: () => void; busy: boolean; disabled: boolean }) {
  if (!insights) {
    return (
      <section className="panel mt-8 border-[var(--cyan)]/20 p-6">
        <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">LLM STRATEGIC INSIGHTS</div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-2xl font-black">AI 生成洞察</h2>
          <button type="button" disabled={disabled} onClick={onRegenerate} className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-sm disabled:opacity-40">
            {busy ? <LoaderCircle className="animate-spin" size={15} /> : <RotateCw size={15} />}
            生成洞察
          </button>
        </div>
        <p className="mt-4 leading-7 text-white/55">当前蓝图尚未包含真实 LLM 生成的全局洞察。</p>
      </section>
    );
  }
  return (
    <section className="panel mt-8 border-[var(--cyan)]/20 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">LLM STRATEGIC INSIGHTS</div>
          <h2 className="mt-3 text-2xl font-black">AI 生成洞察</h2>
        </div>
        <div className="mono border border-white/10 px-3 py-2 text-[10px] text-white/38">{insights.modelLabel} · {new Date(insights.generatedAt).toLocaleString("zh-CN", { hour12: false })}</div>
      </div>
      <p className="mt-5 text-xl font-black leading-9 text-white/86">{insights.summary}</p>
      <p className="mt-4 leading-8 text-white/62">{insights.strategicJudgment}</p>
      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <InsightColumn title="关键洞察" items={insights.keyInsights.map((item) => ({ title: item.title, body: item.detail, meta: item.evidence }))} />
        <InsightColumn title="落地建议" items={insights.landingRecommendations.map((item) => ({ title: item.title, body: item.action, meta: `${item.timeframe} · ${item.owner}` }))} />
        <InsightColumn title="风险提醒" items={insights.riskAlerts.map((item) => ({ title: item.risk, body: item.whyItMatters, meta: item.mitigation }))} />
      </div>
    </section>
  );
}

function InsightColumn({ title, items }: { title: string; items: Array<{ title: string; body: string; meta: string }> }) {
  return (
    <div>
      <h3 className="text-lg font-black">{title}</h3>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <article key={`${title}-${item.title}`} className="border border-white/10 p-4">
            <h4 className="font-bold text-[var(--acid)]">{item.title}</h4>
            <p className="mt-2 text-sm leading-6 text-white/62">{item.body}</p>
            <p className="mt-3 text-xs leading-5 text-white/38">{item.meta}</p>
          </article>
        ))}
      </div>
    </div>
  );
}

function Block({ label, value }: { label: string; value: string }) {
  return <div className="mt-4"><div className="mono text-[10px] tracking-[.16em] text-white/34">{label}</div><p className="mt-1">{value}</p></div>;
}

function ScorePill({ label, value }: { label: string; value?: number }) {
  return <div className="border border-white/10 px-3 py-2"><span className="text-white/38">{label}</span><b className="ml-2 text-[var(--acid)]">{value ?? "-"}/5</b></div>;
}

function normalizeBlueprintView(blueprint: BlueprintOutput): {
  strategicContext: StrategicContext;
  battlefield: StrategicBattlefieldOutput;
  readiness: ReadinessOutput;
  strategicNarrative: string;
  strategicInsights?: BlueprintStrategicInsights;
  recommendedSeedLoop?: BlueprintCandidate;
} {
  const strategicContext = blueprint.strategicContext ?? {
    organizationName: blueprint.diagnosis.organizationName,
    industry: blueprint.diagnosis.industry,
    business: blueprint.diagnosis.business,
    scale: blueprint.diagnosis.scale,
    mission: `用 ${blueprint.diagnosis.business} 持续创造客户价值`,
    vision: `成为 ${blueprint.diagnosis.industry} 中更快响应、更强连接、更能自进化的组织`,
    businessEssence: "待补充",
    focus: blueprint.diagnosis.focus,
    focusLabel: blueprint.diagnosis.focusLabel,
    focusReason: blueprint.diagnosis.focusReason,
  };
  const battlefield = blueprint.battlefield ?? {
    name: `${strategicContext.business} AI 增长突破战`,
    scope: "core",
    scopeLabel: "主营业务战场",
    strategicGoal: blueprint.questionnaire.aiConcern,
    twelveMonthOutcome: "12 个月内形成可复制的 AI 化业务战法",
    urgency: "AI 冲击已经进入关键业务窗口期。",
  };
  const readiness = blueprint.readiness ?? {
    structure: { score: 3, gap: "关键战场的责任边界、决策权和复盘机制需要进一步明确。" },
    cell: { score: 3, gap: "一线业务细胞需要具备数据意识、AI 协作习惯和快速试错节奏。" },
    environment: { score: 3, gap: "数据、工具、激励和容错环境需要围绕第一战场重新配置。" },
    averageScore: 3,
    conclusion: "组织具备启动条件，但需要边打边补齐关键缺口。",
    primaryRisk: "关键战场的责任边界、决策权和复盘机制需要进一步明确。",
  };
  return {
    strategicContext,
    battlefield,
    readiness,
    strategicNarrative: blueprint.strategicNarrative ?? `${strategicContext.organizationName}需要围绕“${battlefield.name}”建立 AI 化第一战场，把组织能力聚焦转化为可验证的战略实验。`,
    strategicInsights: blueprint.strategicInsights,
    recommendedSeedLoop: blueprint.recommendedSeedLoop ?? blueprint.candidates[0],
  };
}

function candidateScore(candidate: BlueprintCandidate, key: keyof BlueprintCandidate["criteriaScores"]) {
  const scores = candidate.criteriaScores as BlueprintCandidate["criteriaScores"] & {
    valuePotential?: number;
    feasibility?: number;
    dataReadiness?: number;
    orgLeverage?: number;
  };
  if (typeof scores?.[key] === "number") return scores[key];
  if (key === "strategicFit") return scores?.valuePotential;
  if (key === "roi") return scores?.valuePotential;
  if (key === "capabilityAccumulation") return scores?.orgLeverage;
  if (key === "readinessFit") return scores?.feasibility;
  return scores?.dataReadiness;
}
