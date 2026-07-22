"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, Circle, LoaderCircle } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import { cleanOrganizationName } from "@/lib/identity-labels";
import type { LoopDesignerSession } from "@/lib/session-types";
import {
  DEFAULT_SEED_LOOP_SCORE_WEIGHTS,
  DIAGNOSIS_STEPS,
  SEED_LOOP_EVIDENCE_GUIDES,
  SEED_LOOP_SCORE_CRITERIA,
  type DiagnosisResponses,
  type FocusStrategy,
  type ReadinessAssessment,
  type SeedLoopCandidateInput,
  type SeedLoopSelection,
  type SeedLoopScoreKey,
  type SeedLoopScoreWeights,
  type StrategicBattlefield,
  type StrategicIdentity,
} from "@/lib/workflow";

type WeightKey = keyof FocusStrategy["weights"];
type DraftStatus = "idle" | "saving" | "saved" | "error";

const businessTypes = ["技术驱动", "产品驱动", "运营驱动", "服务驱动", "流程驱动", "其它"];
const defaultWeights: FocusStrategy["weights"] = { speed: 40, connection: 35, emergence: 25 };
const seedLoopOptionCount = 3;
const readinessLabels: Record<keyof ReadinessAssessment, { title: string; description: string }> = {
  structure: { title: "结构", description: "战略、组织架构、权责、流程、治理是否支持这场仗。" },
  cell: { title: "细胞", description: "一线团队、关键角色、AI 协作习惯和执行节奏是否具备。" },
  environment: { title: "环境", description: "数据、系统、工具、激励和容错环境是否到位。" },
};

export function DiagnosisWorkspace({ session }: { session: LoopDesignerSession }) {
  const router = useRouter();
  const [currentSession, setCurrentSession] = useState(session);
  const currentIndex = Math.min(currentSession.context.diagnosisCurrentStep ?? 0, DIAGNOSIS_STEPS.length - 1);
  const step = DIAGNOSIS_STEPS[currentIndex];
  const questionnaire = currentSession.context.questionnaire;
  const saved = readDiagnosisValues(currentSession);
  const [strategicIdentity, setStrategicIdentity] = useState<StrategicIdentity>(() => buildStrategicIdentityFallback(session));
  const [focusStrategy, setFocusStrategy] = useState<FocusStrategy>(() => buildFocusStrategyFallback(session));
  const [strategicBattlefield, setStrategicBattlefield] = useState<StrategicBattlefield>(() => readJson(saved.strategicBattlefield, {
    name: `${questionnaire?.business || "主营业务"} AI 增长突破战`,
    scope: "core",
    strategicGoal: questionnaire?.aiConcern ? `解决“${questionnaire.aiConcern}”，形成战略级 AI 化样板` : "",
    twelveMonthOutcome: "12 个月内形成可复制的 AI 化增长战法",
    urgency: "AI 冲击已经进入关键业务窗口期，继续观望会拉大组织学习速度差距。",
  }));
  const [readinessAssessment, setReadinessAssessment] = useState<ReadinessAssessment>(() => normalizeReadiness(readJson(saved.readinessAssessment, {
    structure: { score: 3, gap: "关键战场的责任边界、决策权和复盘机制需要进一步明确。" },
    cell: { score: 3, gap: "一线业务细胞需要具备数据意识、AI 协作习惯和快速试错节奏。" },
    environment: { score: 3, gap: "数据、工具、激励和容错环境需要围绕第一战场重新配置。" },
  })));
  const [seedLoopSelection, setSeedLoopSelection] = useState<SeedLoopSelection>(() => normalizeSeedLoopSelection(readJson(saved.seedLoopSelection, {
    userSignal: questionnaire?.aiConcern || "",
    priority: "优先选择用户手动确认的高价值火种回路。",
  })));
  const [busy, setBusy] = useState(false);
  const [jumpingStep, setJumpingStep] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const initialDraftPayloads = useRef<Record<string, string>>({});
  const lastSavedDraftPayloads = useRef<Record<string, string>>({});
  const progress = Math.round(((currentIndex + 1) / DIAGNOSIS_STEPS.length) * 100);
  const draftPayload = useMemo(
    () => payloadForStep(step.id, { strategicIdentity, focusStrategy, strategicBattlefield, readinessAssessment, seedLoopSelection }),
    [focusStrategy, readinessAssessment, seedLoopSelection, step.id, strategicBattlefield, strategicIdentity],
  );
  const editableStepIndexes = useMemo(() => {
    const diagnosis = currentSession.context.diagnosis ?? {};
    return DIAGNOSIS_STEPS
      .map((item, index) => index === currentIndex || diagnosis[item.id] ? index : null)
      .filter((index): index is number => index !== null);
  }, [currentIndex, currentSession.context.diagnosis]);

  useEffect(() => {
    const stepId = step.id;
    if (busy || jumpingStep !== null) return;
    if (!initialDraftPayloads.current[stepId]) {
      initialDraftPayloads.current[stepId] = draftPayload;
      lastSavedDraftPayloads.current[stepId] = draftPayload;
      return;
    }
    if (lastSavedDraftPayloads.current[stepId] === draftPayload) return;
    setDraftStatus("saving");
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(`/loop-designer/api/sessions/${currentSession.id}/diagnosis/draft`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ stepId, answer: draftPayload }),
          signal: controller.signal,
        });
        const payload = await readApiResponse<{ session?: LoopDesignerSession }>(response, "草稿保存失败");
        if (!response.ok || !payload.session) {
          setDraftStatus("error");
          return;
        }
        lastSavedDraftPayloads.current[stepId] = draftPayload;
        setCurrentSession(payload.session);
        setDraftStatus("saved");
      } catch {
        if (!controller.signal.aborted) setDraftStatus("error");
      }
    }, 800);
    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [busy, currentSession.id, draftPayload, jumpingStep, step.id]);

  async function jumpToStep(stepIndex: number) {
    if (stepIndex === currentIndex || busy || jumpingStep !== null) return;
    setJumpingStep(stepIndex);
    setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${currentSession.id}/diagnosis`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stepIndex }),
      });
      const payload = await readApiResponse<{ session?: LoopDesignerSession; nextUrl?: string }>(response, "跳转失败");
      if (!response.ok || !payload.session || !payload.nextUrl) return setError(payload.error || "跳转失败");
      setCurrentSession(payload.session);
      router.push(payload.nextUrl);
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setJumpingStep(null);
    }
  }

  async function submit() {
    const validation = validateStep(step.id, { strategicIdentity, focusStrategy, strategicBattlefield, readinessAssessment, seedLoopSelection });
    if (validation) return setError(validation);
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${currentSession.id}/diagnosis`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: draftPayload }),
      });
      const payload = await readApiResponse<{ session?: LoopDesignerSession; nextUrl?: string }>(response, "诊断保存失败");
      if (!response.ok || !payload.session || !payload.nextUrl) return setError(payload.error || "诊断保存失败");
      lastSavedDraftPayloads.current[step.id] = draftPayload;
      setDraftStatus("idle");
      setCurrentSession(payload.session);
      router.push(payload.nextUrl);
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen px-5 py-8 md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mono text-[10px] tracking-[.22em] text-[var(--acid)]">ORGANIZATION BLUEPRINT / STRATEGIC DESIGN</div>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black md:text-5xl">{step.title}</h1>
            <p className="mt-3 text-sm leading-6 text-white/48">第 {currentIndex + 1} 个环节，共 {DIAGNOSIS_STEPS.length} 个环节</p>
          </div>
          <div className="mono min-w-36 border border-white/10 px-4 py-3 text-right text-[10px] text-white/45">
            PROGRESS <b className="ml-2 text-[var(--acid)]">{progress}%</b>
          </div>
        </div>
        <div className="sticky top-3 z-20 mt-5 flex flex-wrap items-center justify-end gap-3 border border-white/10 bg-[#101416]/95 p-3 shadow-[0_16px_48px_rgba(0,0,0,.35)] backdrop-blur-xl md:top-4">
          {error ? <p className="mr-auto text-sm text-orange-200">{error}</p> : null}
          {!error ? <DraftStatusText status={draftStatus} /> : null}
          <button type="button" disabled={busy} onClick={submit} className="inline-flex items-center gap-2 bg-[var(--acid)] px-5 py-3 font-bold text-black disabled:opacity-40">
            {busy ? <LoaderCircle className="animate-spin" size={16} /> : null}
            {currentIndex + 1 >= DIAGNOSIS_STEPS.length ? "生成战略蓝图" : "保存并继续"}
            <ArrowRight size={16} />
          </button>
        </div>
        <div className="mt-8 grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <DiagnosisTree currentIndex={currentIndex} editableStepIndexes={editableStepIndexes} jumpingStep={jumpingStep} onJump={(index) => void jumpToStep(index)} />
          <section className="panel p-6 md:p-8">
            <div className="border-l-2 border-[var(--acid)] pl-5">
              <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">{currentStageLabel(currentIndex)}</div>
              <p className="mt-3 text-xl leading-9 text-white/78">{step.prompt}</p>
            </div>
            <div className="mt-7">
              {step.id === "strategicIdentity" ? <StrategicIdentityForm value={strategicIdentity} onChange={setStrategicIdentity} /> : null}
              {step.id === "focusStrategy" ? <FocusStrategyForm value={focusStrategy} onChange={setFocusStrategy} /> : null}
              {step.id === "strategicBattlefield" ? <StrategicBattlefieldForm value={strategicBattlefield} onChange={setStrategicBattlefield} /> : null}
              {step.id === "readinessAssessment" ? <ReadinessForm value={readinessAssessment} onChange={setReadinessAssessment} /> : null}
              {step.id === "seedLoopSelection" ? <SeedLoopForm value={seedLoopSelection} onChange={setSeedLoopSelection} battlefield={strategicBattlefield} /> : null}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function StrategicIdentityForm({ value, onChange }: { value: StrategicIdentity; onChange: (value: StrategicIdentity) => void }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="组织名称" value={value.company} onChange={(company) => onChange({ ...value, company })} />
        <Field label="所在行业" value={value.industry} onChange={(industry) => onChange({ ...value, industry })} />
        <Field label="主营业务" value={value.business} onChange={(business) => onChange({ ...value, business })} />
        <Field label="团队规模" value={value.scale} onChange={(scale) => onChange({ ...value, scale })} />
      </div>
      <Field label="企业使命" value={value.mission} onChange={(mission) => onChange({ ...value, mission })} textarea />
      <Field label="业务愿景" value={value.vision} onChange={(vision) => onChange({ ...value, vision })} textarea />
      <div>
        <div className="mono text-[10px] tracking-[.16em] text-white/38">业务本质</div>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          {businessTypes.map((item) => (
            <button key={item} type="button" onClick={() => onChange({ ...value, businessEssence: item })} className={`border px-4 py-3 text-left text-sm ${value.businessEssence === item ? "border-[var(--acid)] bg-[var(--acid)]/10 text-[var(--acid)]" : "border-white/10 text-white/55"}`}>
              {item}
            </button>
          ))}
        </div>
      </div>
      <Field label="业务本质判断依据" value={value.essenceNote || ""} onChange={(essenceNote) => onChange({ ...value, essenceNote })} textarea />
    </div>
  );
}

function FocusStrategyForm({ value, onChange }: { value: FocusStrategy; onChange: (value: FocusStrategy) => void }) {
  const total = value.weights.speed + value.weights.connection + value.weights.emergence;
  function updateWeight(key: WeightKey, nextValue: number) {
    const normalized = Number.isFinite(nextValue) ? Math.max(0, Math.min(100, Math.round(nextValue))) : 0;
    const next = { ...value.weights, [key]: normalized };
    let overflow = next.speed + next.connection + next.emergence - 100;
    if (overflow > 0) {
      const otherKeys = (Object.keys(next) as WeightKey[])
        .filter((itemKey) => itemKey !== key)
        .sort((left, right) => next[right] - next[left]);
      for (const itemKey of otherKeys) {
        const reduction = Math.min(next[itemKey], overflow);
        next[itemKey] -= reduction;
        overflow -= reduction;
        if (overflow <= 0) break;
      }
    }
    onChange({ ...value, weights: next });
  }

  return (
    <div className="space-y-5">
      <div className={`mono inline-flex border px-3 py-2 text-xs ${total === 100 ? "border-[var(--acid)] text-[var(--acid)]" : "border-[var(--signal)] text-[var(--signal)]"}`}>合计 {total}% / 剩余 {100 - total}%</div>
      <WeightSlider label="速度" value={value.weights.speed} onChange={(speed) => updateWeight("speed", speed)} />
      <WeightSlider label="连接" value={value.weights.connection} onChange={(connection) => updateWeight("connection", connection)} />
      <WeightSlider label="涌现" value={value.weights.emergence} onChange={(emergence) => updateWeight("emergence", emergence)} />
      <div className="grid gap-3 lg:grid-cols-3">
        <FocusCard title="速度 · 海豹型" text="聚焦短闭环、高密度协作和快速反馈。代价是更依赖少数精锐，知识必须结构化沉淀。" />
        <FocusCard title="连接 · 珊瑚礁型" text="聚焦信息中枢、平台底座、异步协作和 Agent 挂载。代价是必须重排协作机制和治理边界。" />
        <FocusCard title="涌现 · 章鱼型" text="聚焦分布式触腕和系统路由，让业务单元自发响应。代价是治理、审计和中枢神经必须先行。" />
      </div>
      <Field
        label="基于这个组织能力聚焦方向，最需要提升的战略指标？"
        value={value.metric}
        onChange={(metric) => onChange({ ...value, metric })}
        placeholder="写一个能被业务验收的指标，可以是响应周期、转化率、复购率、交付周期或决策周期。例如：报价响应周期从 3 天缩短到 4 小时；客户问题首次响应率提升到 90%。"
      />
      <Field
        label="为此，组织上短时间必须要接受的代价？"
        value={value.tradeoff}
        onChange={(tradeoff) => onChange({ ...value, tradeoff })}
        textarea
        placeholder="写真实取舍，不用写口号。常见代价包括减少并行项目、重排职责、牺牲局部效率、接受试点扰动。例如：未来 6 周减少非关键项目并行，允许销售、交付和数据团队重排职责。"
      />
      <Field
        label="这个能力聚焦方向与长期业务愿景的关系？"
        value={value.visionAlignment}
        onChange={(visionAlignment) => onChange({ ...value, visionAlignment })}
        textarea
        placeholder="说明这次能力聚焦如何服务未来 12 个月结果，以及它会沉淀成哪种长期组织能力。例如：先把报价响应做成可复制闭环，未来才能支撑柔性制造和更高客户定制能力。"
      />
    </div>
  );
}

function StrategicBattlefieldForm({ value, onChange }: { value: StrategicBattlefield; onChange: (value: StrategicBattlefield) => void }) {
  return (
    <div className="space-y-5">
      <Field label="关键战场名称" value={value.name} onChange={(name) => onChange({ ...value, name })} />
      <div>
        <div className="mono text-[10px] tracking-[.16em] text-white/38">战场归属</div>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <button type="button" onClick={() => onChange({ ...value, scope: "core" })} className={`border px-4 py-4 text-left ${value.scope === "core" ? "border-[var(--acid)] bg-[var(--acid)]/10 text-[var(--acid)]" : "border-white/10 text-white/55"}`}>
            主营业务战场
            <span className="mt-2 block text-xs leading-5 text-white/45">直接服务现有主营业务增长、效率或客户价值。</span>
          </button>
          <button type="button" onClick={() => onChange({ ...value, scope: "adjacent" })} className={`border px-4 py-4 text-left ${value.scope === "adjacent" ? "border-[var(--acid)] bg-[var(--acid)]/10 text-[var(--acid)]" : "border-white/10 text-white/55"}`}>
            非主营战略项目
            <span className="mt-2 block text-xs leading-5 text-white/45">不一定是当前主营，但决定未来能力迁移和战略窗口。</span>
          </button>
        </div>
      </div>
      <Field label="通过这场仗，核心要实现的战略意图？" value={value.strategicGoal} onChange={(strategicGoal) => onChange({ ...value, strategicGoal })} textarea />
      <Field label="怎么才算赢（必须要拿到的结果）？" value={value.twelveMonthOutcome} onChange={(twelveMonthOutcome) => onChange({ ...value, twelveMonthOutcome })} textarea />
      <Field label="为什么现在必须打" value={value.urgency} onChange={(urgency) => onChange({ ...value, urgency })} textarea />
    </div>
  );
}

function ReadinessForm({ value, onChange }: { value: ReadinessAssessment; onChange: (value: ReadinessAssessment) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-2 border border-white/10 bg-white/[0.03] p-4 text-sm leading-6 text-white/58 md:grid-cols-3">
        <span><b className="text-white">1 分</b>：准备不足</span>
        <span><b className="text-white">3 分</b>：基本具备</span>
        <span><b className="text-white">5 分</b>：高度匹配</span>
      </div>
      {(Object.keys(readinessLabels) as Array<keyof ReadinessAssessment>).map((key) => {
        const meta = readinessLabels[key];
        const item = value[key];
        return (
          <section key={key} className="border border-white/10 p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="max-w-xl">
                <b>{meta.title}</b>
                <p className="mt-2 text-sm leading-6 text-white/55">{meta.description}</p>
              </div>
              <div className="grid min-w-64 grid-cols-3 gap-2">
                {([1, 3, 5] as const).map((score) => (
                  <button key={score} type="button" onClick={() => onChange({ ...value, [key]: { ...item, score } })} className={`border px-3 py-3 text-center ${item.score === score ? "border-[var(--acid)] bg-[var(--acid)]/10 text-[var(--acid)]" : "border-white/10 text-white/50"}`}>
                    <span className="block text-lg font-black">{score}</span>
                    <span className="mt-1 block text-[10px]">{score === 1 ? "准备不足" : score === 3 ? "基本具备" : "高度匹配"}</span>
                  </button>
                ))}
              </div>
            </div>
            <Field label={`${meta.title}关键缺口`} value={item.gap} onChange={(gap) => onChange({ ...value, [key]: { ...item, gap } })} textarea />
          </section>
        );
      })}
    </div>
  );
}

function SeedLoopForm({ value, onChange, battlefield }: { value: SeedLoopSelection; onChange: (value: SeedLoopSelection) => void; battlefield: StrategicBattlefield }) {
  const normalizedValue = normalizeSeedLoopSelection(value);
  const candidates = normalizedValue.manualCandidates ?? [];
  const scoreWeights = normalizedValue.scoreWeights ?? DEFAULT_SEED_LOOP_SCORE_WEIGHTS;
  const weightTotal = sumSeedLoopScoreWeights(scoreWeights);
  function updateCandidate(index: number, patch: Partial<SeedLoopCandidateInput>) {
    onChange({
      ...normalizedValue,
      manualCandidates: candidates.map((candidate, candidateIndex) => candidateIndex === index ? { ...candidate, ...patch } : candidate),
    });
  }
  function updateCandidateScore(index: number, key: SeedLoopScoreKey, score: 1 | 3 | 5) {
    const candidate = candidates[index];
    updateCandidate(index, { scores: { ...candidate.scores, [key]: score } });
  }
  function updateScoreWeight(key: SeedLoopScoreKey, weight: number) {
    onChange({ ...normalizedValue, scoreWeights: { ...scoreWeights, [key]: normalizeSeedLoopWeight(weight) } });
  }

  return (
    <div className="space-y-5">
      <div className="border border-[var(--cyan)]/20 bg-[var(--cyan)]/5 p-5">
        <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">FIRST BATTLEFIELD</div>
        <h2 className="mt-3 text-2xl font-black">{battlefield.name}</h2>
        <p className="mt-3 text-sm leading-7 text-white/58">{battlefield.strategicGoal}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        {SEED_LOOP_EVIDENCE_GUIDES.map((criterion) => (
          <div key={criterion.key} className="border border-white/10 p-4">
            <h3 className="font-bold text-[var(--acid)]">{criterion.label}</h3>
            <p className="mt-2 text-xs leading-5 text-white/52">{criterion.description}</p>
          </div>
        ))}
      </div>
      <div className="border border-white/10 bg-white/[0.03] p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-bold">排序权重</h3>
            <p className="mt-1 text-sm leading-6 text-white/55">系统会按当前权重计算高价值评分，并把最高分候选作为推荐火种回路。</p>
          </div>
          <div className={`mono border px-3 py-2 text-xs ${weightTotal === 100 ? "border-[var(--acid)] text-[var(--acid)]" : "border-[var(--signal)] text-[var(--signal)]"}`}>合计 {weightTotal}%</div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-4">
          {SEED_LOOP_SCORE_CRITERIA.map((criterion) => (
            <label key={criterion.key} className="block">
              <span className="mono text-[10px] tracking-[.16em] text-white/38">{criterion.label}</span>
              <input type="number" min="0" max="100" value={scoreWeights[criterion.key]} onChange={(event) => updateScoreWeight(criterion.key, Number(event.target.value))} className="field mt-2 py-2" />
            </label>
          ))}
        </div>
      </div>
      <div className="space-y-6">
        {candidates.map((candidate, index) => (
          <section key={candidate.id ?? index} className="border border-white/10 p-5">
            <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">LOOP OPTION 0{index + 1}</div>
            <Field label="回路选项名称" value={candidate.title} onChange={(title) => updateCandidate(index, { title })} />
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Field label="真痛点" value={candidate.pain} onChange={(pain) => updateCandidate(index, { pain })} textarea />
              <Field label="有数据" value={candidate.data} onChange={(data) => updateCandidate(index, { data })} textarea />
              <Field label="有人扛" value={candidate.owner} onChange={(owner) => updateCandidate(index, { owner })} textarea />
              <Field label="闭环短" value={candidate.shortLoop} onChange={(shortLoop) => updateCandidate(index, { shortLoop })} textarea />
            </div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {SEED_LOOP_SCORE_CRITERIA.map((criterion) => (
                <div key={criterion.key} className="border border-white/10 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <b>{criterion.label}</b>
                      <p className="mt-1 text-xs leading-5 text-white/45">{criterion.description}</p>
                    </div>
                    <span className="mono text-[10px] text-[var(--acid)]">{scoreWeights[criterion.key]}%</span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {([1, 3, 5] as const).map((score) => (
                      <button
                        key={score}
                        type="button"
                        onClick={() => updateCandidateScore(index, criterion.key, score)}
                        className={`border px-3 py-2 text-center text-sm ${candidate.scores[criterion.key] === score ? "border-[var(--acid)] bg-[var(--acid)]/10 text-[var(--acid)]" : "border-white/10 text-white/50"}`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

const diagnosisTree = [
  { title: "战略身份", detail: "行业 / 主营业务 / 使命愿景", steps: [0] },
  { title: "能力聚焦", detail: "速度 / 连接 / 涌现与愿景对齐", steps: [1] },
  { title: "关键战场", detail: "AI 转型第一场仗", steps: [2] },
  { title: "准备度分析", detail: "结构 / 细胞 / 环境", steps: [3] },
  { title: "火种回路", detail: "高 ROI 候选回路约束", steps: [4] },
];

function DraftStatusText({ status }: { status: DraftStatus }) {
  if (status === "saving") return <p className="mr-auto text-xs text-white/38">自动保存草稿中...</p>;
  if (status === "saved") return <p className="mr-auto text-xs text-[var(--acid)]">草稿已自动保存</p>;
  if (status === "error") return <p className="mr-auto text-xs text-orange-200">草稿保存失败，请先点“保存并继续”。</p>;
  return null;
}

function DiagnosisTree({
  currentIndex,
  editableStepIndexes,
  jumpingStep,
  onJump,
}: {
  currentIndex: number;
  editableStepIndexes: number[];
  jumpingStep: number | null;
  onJump: (stepIndex: number) => void;
}) {
  const editable = new Set(editableStepIndexes);
  return (
    <aside className="border border-white/10 bg-black/20 p-5">
      <div className="mono mb-5 text-[10px] tracking-[.2em] text-white/38">STRATEGIC BLUEPRINT TREE</div>
      <div className="space-y-5">
        {diagnosisTree.map((stage, stageIndex) => {
          const active = stage.steps.includes(currentIndex);
          const done = stage.steps.every((index) => index < currentIndex);
          return (
            <section key={stage.title} className="relative pl-9">
              <span className={`absolute left-0 top-0 grid h-6 w-6 place-items-center border ${done ? "border-[var(--acid)] bg-[var(--acid)] text-black" : active ? "border-[var(--cyan)] text-[var(--cyan)]" : "border-white/15 text-white/25"}`}>
                {done ? <Check size={13} /> : <span className="mono text-[10px]">{stageIndex + 1}</span>}
              </span>
              {stageIndex < diagnosisTree.length - 1 ? <span className="absolute left-[11px] top-7 h-[calc(100%+12px)] w-px bg-white/10" /> : null}
              <div className={active ? "text-white" : "text-white/50"}>
                <h2 className="font-bold">{stage.title}</h2>
                <p className="mt-1 text-xs text-white/35">{stage.detail}</p>
              </div>
              <div className="mt-3 space-y-2">
                {stage.steps.map((stepIndex) => {
                  const step = DIAGNOSIS_STEPS[stepIndex];
                  const stepActive = stepIndex === currentIndex;
                  const stepDone = stepIndex < currentIndex;
                  const canJump = editable.has(stepIndex) && !stepActive;
                  return (
                    <button
                      key={step.id}
                      type="button"
                      disabled={!canJump || jumpingStep !== null}
                      onClick={() => onJump(stepIndex)}
                      className={`flex w-full items-center justify-between gap-2 border px-3 py-2 text-left text-xs disabled:cursor-default ${stepActive ? "border-[var(--cyan)] bg-[var(--cyan)]/8 text-[var(--cyan)]" : stepDone || editable.has(stepIndex) ? "border-[var(--acid)]/30 text-[var(--acid)]" : "border-white/10 text-white/35"}`}
                    >
                      <span className="flex items-center gap-2">
                        {stepDone ? <Check size={12} /> : <Circle size={10} />}
                        <span>{step.title}</span>
                      </span>
                      {canJump ? <span className="text-[10px] text-white/35">{jumpingStep === stepIndex ? "跳转中" : "修改"}</span> : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </aside>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder = "",
  help,
  textarea = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  help?: string;
  textarea?: boolean;
}) {
  return (
    <label className="mt-4 block">
      <span className="mono text-[10px] tracking-[.16em] text-white/38">{label}</span>
      {help ? <span className="mt-2 block text-xs leading-5 text-white/42">{help}</span> : null}
      {textarea ? (
        <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="field mt-2 min-h-28" />
      ) : (
        <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="field mt-2" />
      )}
    </label>
  );
}

function WeightSlider({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-3 md:grid-cols-[70px_1fr_90px] md:items-center">
      <span className="font-bold">{label}</span>
      <div>
        <input type="range" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full" />
        <div className="mono mt-1 text-[10px] text-white/30">当前 {value}% · 提高本项会自动压缩其它项</div>
      </div>
      <input type="number" min="0" max="100" value={value} onChange={(event) => onChange(Number(event.target.value))} className="field py-2" />
    </label>
  );
}

function FocusCard({ title, text }: { title: string; text: string }) {
  return <div className="border border-white/10 p-4"><h3 className="font-bold text-[var(--acid)]">{title}</h3><p className="mt-2 text-xs leading-6 text-white/54">{text}</p></div>;
}

function currentStageLabel(currentIndex: number) {
  const stage = diagnosisTree.find((item) => item.steps.includes(currentIndex));
  return stage ? stage.title : "诊断";
}

function payloadForStep(stepId: string, state: { strategicIdentity: StrategicIdentity; focusStrategy: FocusStrategy; strategicBattlefield: StrategicBattlefield; readinessAssessment: ReadinessAssessment; seedLoopSelection: SeedLoopSelection }) {
  if (stepId === "strategicIdentity") return JSON.stringify(state.strategicIdentity);
  if (stepId === "focusStrategy") return JSON.stringify(state.focusStrategy);
  if (stepId === "strategicBattlefield") return JSON.stringify(state.strategicBattlefield);
  if (stepId === "readinessAssessment") return JSON.stringify(state.readinessAssessment);
  return JSON.stringify(state.seedLoopSelection);
}

function validateStep(stepId: string, state: { strategicIdentity: StrategicIdentity; focusStrategy: FocusStrategy; strategicBattlefield: StrategicBattlefield; readinessAssessment: ReadinessAssessment; seedLoopSelection: SeedLoopSelection }) {
  if (stepId === "strategicIdentity" && (!state.strategicIdentity.company || !state.strategicIdentity.industry || !state.strategicIdentity.business || !state.strategicIdentity.mission || !state.strategicIdentity.vision || !state.strategicIdentity.businessEssence)) return "请完整填写战略身份。";
  if (stepId === "focusStrategy" && state.focusStrategy.weights.speed + state.focusStrategy.weights.connection + state.focusStrategy.weights.emergence !== 100) return "速度、连接、涌现的合计必须等于 100%。";
  if (stepId === "focusStrategy" && (!state.focusStrategy.metric || !state.focusStrategy.tradeoff || !state.focusStrategy.visionAlignment)) return "请完成能力聚焦校准。";
  if (stepId === "strategicBattlefield" && (!state.strategicBattlefield.name || !state.strategicBattlefield.strategicGoal || !state.strategicBattlefield.twelveMonthOutcome || !state.strategicBattlefield.urgency)) return "请完整填写关键战场。";
  if (stepId === "readinessAssessment" && !Object.values(state.readinessAssessment).every((item) => (item.score === 1 || item.score === 3 || item.score === 5) && item.gap)) return "请按 1、3、5 分完成准备度评分，并填写关键缺口。";
  if (stepId === "seedLoopSelection") {
    const seedLoopSelection = normalizeSeedLoopSelection(state.seedLoopSelection);
    if (seedLoopSelection.scoreWeights && sumSeedLoopScoreWeights(seedLoopSelection.scoreWeights) !== 100) return "评分权重合计必须等于 100%。";
    if (!seedLoopSelection.manualCandidates?.every(isSeedLoopCandidateComplete)) return "请完整填写 3 个候选火种回路。";
  }
  return null;
}

function isSeedLoopCandidateComplete(candidate: SeedLoopCandidateInput) {
  return Boolean(candidate.title && candidate.pain && candidate.data && candidate.owner && candidate.shortLoop);
}

function buildStrategicIdentityFallback(session: LoopDesignerSession): StrategicIdentity {
  const questionnaire = session.context.questionnaire;
  const saved = readDiagnosisValues(session);
  const strategic = readJson<StrategicIdentity | null>(saved.strategicIdentity, null);
  if (strategic) return { ...strategic, company: cleanOrganizationName(strategic.company) };
  const orgInfo = readJson<Record<string, string> | null>(saved.orgInfo, null);
  const essence = readJson<{ type?: string; note?: string } | null>(saved.businessEssence, null);
  const business = orgInfo?.business || questionnaire?.business || "";
  const industry = orgInfo?.industry || questionnaire?.industry || "";
  return {
    company: cleanOrganizationName(orgInfo?.company || questionnaire?.company || ""),
    industry,
    business,
    scale: orgInfo?.scale || questionnaire?.scale || "",
    mission: `用 ${business || "主营业务"} 持续创造客户价值`,
    vision: `成为 ${industry || "所在行业"} 中更快响应、更强连接、更能自进化的组织`,
    businessEssence: essence?.type || "运营驱动",
    essenceNote: essence?.note || "",
  };
}

function buildFocusStrategyFallback(session: LoopDesignerSession): FocusStrategy {
  const saved = readDiagnosisValues(session);
  const strategic = readJson<FocusStrategy | null>(saved.focusStrategy, null);
  if (strategic) return strategic;
  const weights = readJson<FocusStrategy["weights"] | null>(saved.focusWeights, null) || defaultWeights;
  const calibration = readJson<{ metric?: string; tradeoff?: string; pilot?: string } | null>(saved.focusCalibration, null);
  return {
    weights,
    metric: calibration?.metric || "",
    tradeoff: calibration?.tradeoff || "",
    pilot: calibration?.pilot || "",
    visionAlignment: "",
  };
}

function readDiagnosisValues(session: LoopDesignerSession): Partial<DiagnosisResponses> {
  return {
    ...(session.context.diagnosis ?? {}),
    ...(session.context.diagnosisDrafts ?? {}),
  };
}

function normalizeSeedLoopSelection(value: SeedLoopSelection): SeedLoopSelection {
  const manualCandidates = Array.from({ length: seedLoopOptionCount }, (_, index) => normalizeSeedLoopCandidate(value.manualCandidates?.[index], index));
  return { ...value, scoreWeights: normalizeSeedLoopScoreWeights(value.scoreWeights), manualCandidates };
}

function normalizeSeedLoopCandidate(candidate: Partial<SeedLoopCandidateInput> | undefined, index: number): SeedLoopCandidateInput {
  const scores = candidate?.scores as Partial<Record<SeedLoopScoreKey, number>> | undefined;
  return {
    id: candidate?.id || `seed-loop-option-${index + 1}`,
    title: candidate?.title || "",
    pain: candidate?.pain || "",
    data: candidate?.data || "",
    owner: candidate?.owner || "",
    shortLoop: candidate?.shortLoop || "",
    scores: {
      pain: normalizeSeedLoopScore(scores?.pain),
      data: normalizeSeedLoopScore(scores?.data),
      replication: normalizeSeedLoopScore(scores?.replication),
      riskControl: normalizeSeedLoopScore(scores?.riskControl),
    },
  };
}

function normalizeSeedLoopScore(score: number | undefined): 1 | 3 | 5 {
  return score === 1 || score === 5 ? score : 3;
}

function normalizeSeedLoopScoreWeights(weights: Partial<SeedLoopScoreWeights> | undefined): SeedLoopScoreWeights {
  return {
    pain: normalizeSeedLoopWeight(weights?.pain, DEFAULT_SEED_LOOP_SCORE_WEIGHTS.pain),
    data: normalizeSeedLoopWeight(weights?.data, DEFAULT_SEED_LOOP_SCORE_WEIGHTS.data),
    replication: normalizeSeedLoopWeight(weights?.replication, DEFAULT_SEED_LOOP_SCORE_WEIGHTS.replication),
    riskControl: normalizeSeedLoopWeight(weights?.riskControl, DEFAULT_SEED_LOOP_SCORE_WEIGHTS.riskControl),
  };
}

function normalizeSeedLoopWeight(weight: number | undefined, fallback = 0) {
  return Number.isFinite(weight) ? Math.max(0, Math.min(100, Math.round(weight || 0))) : fallback;
}

function sumSeedLoopScoreWeights(weights: SeedLoopScoreWeights) {
  return weights.pain + weights.data + weights.replication + weights.riskControl;
}

function normalizeReadiness(value: ReadinessAssessment): ReadinessAssessment {
  return {
    structure: normalizeReadinessItem(value.structure, "关键战场的责任边界、决策权和复盘机制需要进一步明确。"),
    cell: normalizeReadinessItem(value.cell, "一线业务细胞需要具备数据意识、AI 协作习惯和快速试错节奏。"),
    environment: normalizeReadinessItem(value.environment, "数据、工具、激励和容错环境需要围绕第一战场重新配置。"),
  };
}

function normalizeReadinessItem(value: { score?: number; gap?: string }, fallbackGap: string) {
  const score: 1 | 3 | 5 = value.score === 1 || value.score === 3 || value.score === 5 ? value.score : 3;
  return { score, gap: value.gap || fallbackGap };
}

function readJson<T>(value: string | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
