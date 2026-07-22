"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import type { LoopMaturityMapping, UpgradeSuggestion } from "@/lib/plan-schema";
import { customerDimensionLabel, customerFacingText, evidenceSourceLabel, maturityLevelLabel } from "@/lib/maturity";

type Props = {
  mapping: LoopMaturityMapping;
  onApplyAction: (suggestion: UpgradeSuggestion) => void;
};

export function MaturityAssessmentPanel({ mapping, onApplyAction }: Props) {
  const [open, setOpen] = useState(true);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [evidenceOpen, setEvidenceOpen] = useState(false);
  const [feedback, setFeedback] = useState<"too_high" | "accurate" | "too_low" | null>(null);
  const limitingDimension = mapping.maturity.find((item) => item.level === mapping.overallLevel);
  const topBottleneck = customerFacingText(mapping.bottlenecks[0] || limitingDimension?.bottleneck || "短板还不够具体，需要补充运行证据。");
  const highlights = mapping.highlightDimensions.length ? mapping.highlightDimensions.map(customerDimensionLabel).join("、") : "暂未形成明显亮点";
  const actionRoute = buildActionRoute(mapping);

  return (
    <section className="panel overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-start justify-between gap-5 border-b border-white/10 p-7 text-left md:p-8"
      >
        <div>
          <div className="mono flex flex-wrap items-center gap-3 text-[10px] tracking-[.2em] text-[var(--acid)]">
            <span>算法评估</span>
            <span className="border border-white/10 px-2 py-1 text-white/35">证据驱动</span>
          </div>
          <h2 className="mt-3 text-3xl font-black">对齐与成熟度诊断</h2>
          <p className="mt-2 text-sm leading-6 text-white/48">用来判断这条回路能不能先跑、哪里最容易出问题、下一步该先修什么，不是考试评分。</p>
          <p className="mt-3 max-w-4xl text-lg leading-8 text-white/72">{customerFacingText(mapping.oneLineDiagnosis)}</p>
        </div>
        <span className="mt-1 grid h-9 w-9 shrink-0 place-items-center border border-white/12 text-white/50">
          {open ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
        </span>
      </button>
      {open ? (
        <div className="space-y-6 p-7 md:p-8">
          <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
            <div className="border border-[var(--acid)]/35 bg-[var(--acid)]/8 p-5">
              <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">诊断摘要</div>
              <h3 className="mt-3 text-2xl font-black">{runReadiness(mapping.overallLevel)}</h3>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <DiagnosisFact label="亮点" value={highlights} />
                <DiagnosisFact label="最容易出问题" value={topBottleneck} />
                <DiagnosisFact label="下一步先修" value={customerFacingText(mapping.recommendedAction.action)} />
              </div>
              {limitingDimension ? (
                <p className="mt-4 border-t border-white/10 pt-4 text-sm leading-6 text-white/58">
                  本回路受 <b className="text-white">{customerDimensionLabel(limitingDimension.dimension)}</b> 限制。先修这个短板，比继续堆功能更有效。
                </p>
              ) : null}
            </div>
            <div className="border border-[var(--signal)]/35 bg-[var(--signal)]/8 p-5">
              <div className="flex items-center gap-2 text-[var(--signal)]">
                <AlertTriangle size={17} />
                <div className="mono text-[10px] tracking-[.18em]">推荐优先行动</div>
              </div>
              <h3 className="mt-3 text-xl font-black">{customerFacingText(mapping.recommendedAction.action)}</h3>
              <p className="mt-3 text-sm leading-6 text-white/62">{customerFacingText(mapping.recommendedAction.expectedEffect)}</p>
              {mapping.recommendedAction.riskIfIgnored ? (
                <p className="mt-3 text-xs leading-5 text-orange-100/82">不改的风险：{customerFacingText(mapping.recommendedAction.riskIfIgnored)}</p>
              ) : null}
              <button
                type="button"
                onClick={() => onApplyAction(mapping.recommendedAction)}
                className="mt-5 inline-flex items-center gap-2 bg-[var(--acid)] px-4 py-3 text-sm font-black text-black"
              >
                <Sparkles size={15} /> 应用到定向优化
              </button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {mapping.alignment.map((item) => (
              <div key={item.dimension} className="border border-white/10 p-4">
                <div className="mono text-[10px] tracking-[.16em] text-[var(--cyan)]">{customerDimensionLabel(item.dimension)}</div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-lg font-black">
                  <span>{maturityLevelLabel(item.level)}</span>
                  <span className="border border-white/10 px-2 py-1 text-[10px] text-white/45">{alignmentStatus(item.level)}</span>
                </div>
                <p className="mt-2 text-sm leading-6 text-white/55">{item.userExplanation}</p>
                {item.gap ? <p className="mt-3 text-xs leading-5 text-orange-100/75">缺口：{customerFacingText(item.gap)}</p> : null}
              </div>
            ))}
          </div>

          <div className="border border-white/10">
            <button
              type="button"
              onClick={() => setDetailsOpen((value) => !value)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="font-bold">亮点、短板、升级建议和行动路线</span>
              {detailsOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {detailsOpen ? (
              <div className="space-y-5 border-t border-white/10 p-5">
                <div>
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-xl font-black">五个诊断维度</h3>
                    <div className="text-xs text-white/38">不展示原始分数，只展示状态、证据和缺口。</div>
                  </div>
                  <div className="grid gap-3 lg:grid-cols-5">
                    {mapping.maturity.map((item) => (
                      <div key={item.dimension} className="border border-white/10 bg-white/[.025] p-4">
                        <div className="mono min-h-8 text-[10px] tracking-[.14em] text-white/35">{customerDimensionLabel(item.dimension)}</div>
                        <div className="mt-2 text-lg font-black text-white">{maturityLevelLabel(item.level)}</div>
                        <p className="mt-2 text-xs leading-5 text-white/48">{item.userExplanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="border border-white/10 p-5">
                    <h3 className="text-xl font-black">亮点与短板</h3>
                    <p className="mt-3 text-sm leading-6 text-white/58">
                      亮点：{highlights}
                    </p>
                    <ul className="mt-3 space-y-2 text-sm leading-6 text-white/58">
                      {mapping.bottlenecks.map((item) => <li key={item}>- {customerFacingText(item)}</li>)}
                    </ul>
                  </div>
                  <div className="border border-white/10 p-5">
                    <h3 className="text-xl font-black">具体行动路线</h3>
                    <div className="mt-4 space-y-3">
                      {actionRoute.map((item, index) => (
                        <button
                          key={`${item.dimension}-${index}`}
                          type="button"
                          onClick={() => onApplyAction(item)}
                          className="block w-full border border-white/10 p-3 text-left hover:border-[var(--acid)]/60"
                        >
                          <div className="mono text-[10px] tracking-[.14em] text-[var(--acid)]">第 {index + 1} 步 / {customerDimensionLabel(item.dimension)}</div>
                          <div className="mt-2 text-sm font-bold text-white">{customerFacingText(item.action)}</div>
                          <p className="mt-1 text-xs leading-5 text-white/45">{customerFacingText(item.expectedEffect)}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="border border-white/10">
            <button
              type="button"
              onClick={() => setEvidenceOpen((value) => !value)}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <span className="font-bold">证据链与推导来源</span>
              {evidenceOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            {evidenceOpen ? (
              <div className="border-t border-white/10 p-5">
                {[...mapping.alignment, ...mapping.maturity].map((item) => (
                  <div key={item.dimension} className="mb-5 last:mb-0">
                    <div className="mono mb-2 text-[10px] tracking-[.14em] text-[var(--cyan)]">{customerDimensionLabel(item.dimension)}</div>
                    <div className="space-y-2">
                      {item.evidence.map((entry) => (
                        <div key={`${item.dimension}-${entry.source}-${entry.summary}`} className="border-l border-white/12 pl-3 text-xs leading-5 text-white/52">
                          <b className="text-white/75">{entry.userLabel}</b> · {entry.summary}
                          <span className="text-white/28"> 来源：{evidenceSourceLabel(entry.source)} · 置信度：{entry.confidence}</span>
                          {entry.gap ? <div className="text-orange-100/70">缺口：{customerFacingText(entry.gap)}</div> : null}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 border border-white/10 p-4 text-sm text-white/48">
            <span>这次算法评估是否准确？</span>
            {(["too_low", "accurate", "too_high"] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFeedback(item)}
                className={`border px-3 py-2 text-xs ${feedback === item ? "border-[var(--acid)] text-[var(--acid)]" : "border-white/10 text-white/45"}`}
              >
                {item === "too_low" ? "偏低" : item === "too_high" ? "偏高" : "准确"}
              </button>
            ))}
            {feedback ? <span className="text-[var(--acid)]">已记录本次校准反馈。</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function alignmentStatus(level: number) {
  if (level >= 4) return "已对齐";
  if (level >= 3) return "部分对齐";
  return "存在缺口";
}

function runReadiness(level: number) {
  if (level >= 4) return "可以进入受控运行";
  if (level >= 3) return "可以先小范围试跑";
  if (level >= 2) return "先补关键条件再试跑";
  return "暂不建议直接运行";
}

function buildActionRoute(mapping: LoopMaturityMapping) {
  const unique = [mapping.recommendedAction, ...mapping.upgradeSuggestions].filter((item, index, array) =>
    array.findIndex((candidate) => candidate.dimension === item.dimension && candidate.action === item.action) === index,
  );
  return unique.slice(0, 4);
}

function DiagnosisFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/15 p-3">
      <div className="mono text-[9px] tracking-[.14em] text-white/32">{label}</div>
      <div className="mt-2 line-clamp-4 text-xs leading-5 text-white/62">{value}</div>
    </div>
  );
}
