"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bot, Boxes, Check, CircleUserRound, Copy, Download, ExternalLink, GripVertical, LoaderCircle, PanelRightOpen, Plus, RotateCw, Send, ServerCog, ShieldCheck, Trash2, X, Zap } from "lucide-react";
import { CONVERSATION_STEPS } from "@/lib/conversation";
import {
  buildScenarioDiagnosis,
  parseBusinessGoalAnchor,
  parseWorkflowInput,
  serializeBusinessGoalAnchor,
  serializeScenarioDiagnosis,
  serializeWorkflowStepLines,
  serializeWorkflowInput,
  type BusinessGoalAnchor,
  type LoopCellInput,
  type ScenarioDiagnosis,
  type WorkflowInput,
  normalizeLoopCells,
} from "@/lib/design-brief";
import type { LoopDesignerSession, PlanGenerationJob } from "@/lib/session-types";
import type { LoopPlan } from "@/lib/plan-schema";
import { legacyNodesFromLoopCells, scanWorkflowBreakpoints, type BreakpointType } from "@/lib/process-transformation-core";
import { planToMarkdown } from "@/lib/markdown";
import { customerDimensionLabel, customerFacingText, maturityLevelLabel, withMaturityMapping } from "@/lib/maturity";
import { readApiResponse } from "@/lib/api-response";
import { LoopDesignerLogo } from "./loop-designer-logo";
import { MaturityAssessmentPanel } from "./maturity-assessment-panel";
import { OrganizationArchitecture } from "./organization-architecture";

type EditableStepId = "business_goal" | "workflow" | "diagnosis";

function createEmptyBusinessGoal(): BusinessGoalAnchor {
  return { intent: "", goal: "", output: "", successSignal: "", cycle: "", constraints: "" };
}

function createEmptyWorkflow(): WorkflowInput {
  return { mode: "current", narrative: "", cells: [createEmptyLoopCell("cell-1")] };
}

function createEmptyLoopCell(id: string): LoopCellInput {
  return {
    id,
    action: "",
    owner: "",
    trigger: "",
    input: "",
    output: "",
    decision: "",
    system: "",
    acceptance: "",
    exceptionOwner: "",
    memory: "",
    friction: "",
  };
}

function createInitialBusinessGoal(session: LoopDesignerSession): BusinessGoalAnchor {
  return parseBusinessGoalAnchor(session.responses.business_goal) ?? createEmptyBusinessGoal();
}

function createInitialWorkflow(session: LoopDesignerSession): WorkflowInput {
  return parseWorkflowInput(session.responses.workflow) ?? createEmptyWorkflow();
}

function createInitialDiagnosisNote(session: LoopDesignerSession) {
  return session.responses.diagnosis?.match(/用户补充：([\s\S]*)$/)?.[1]?.trim() ?? "";
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function userFacingWorkspaceError(error: string | undefined) {
  if (!error) return null;
  if (error.includes("模型输出结构无效") || error.includes("未定义角色")) {
    return "模型已返回方案草稿，但角色引用没有通过校验。请重新点击生成，系统会重新生成并自动修复角色引用。";
  }
  if (error.includes("模型服务不可用")) return "模型服务暂时不可用，请稍后重试。";
  return error;
}

function userMessageForChat(content: string, responses: Record<string, string>) {
  const normalizedContent = content.trim();
  const matchedStep = CONVERSATION_STEPS.find((step) => responses[step.id]?.trim() === normalizedContent);
  if (matchedStep) return chatSummaryForStep(matchedStep.id, normalizedContent);
  if (/业务目标锚点：|自然语言工作流：|回路单元：|诊断摘要：|AI可以接管的工作/.test(normalizedContent)) {
    return "已保存：资料输入\n完整内容见右侧摘要。";
  }
  return content;
}

function chatSummaryForStep(stepId: string, content: string) {
  if (stepId === "business_goal") return "已保存：业务目标锚点\n完整字段见右侧摘要。";
  if (stepId === "workflow") {
    const workflow = parseWorkflowInput(content);
    const cellCount = workflow ? normalizeLoopCells(workflow).length : 0;
    return `已保存：业务回路单元${cellCount ? `（${cellCount} 个单元）` : ""}\n完整步骤和单元事实见右侧摘要。`;
  }
  if (stepId === "diagnosis") return "已保存：拆解确认与补充说明\n完整确认内容见右侧摘要。";
  return "已保存：用户输入\n完整内容见右侧摘要。";
}

export function DesignerWorkspace({ initialSession, initialGenerationJob, editable }: { initialSession: LoopDesignerSession; initialGenerationJob?: PlanGenerationJob | null; editable: boolean }) {
  const [session, setSession] = useState(initialSession);
  const [generationJob, setGenerationJob] = useState<PlanGenerationJob | null>(initialGenerationJob ?? null);
  const [answer, setAnswer] = useState("");
  const [businessGoal, setBusinessGoal] = useState<BusinessGoalAnchor>(() => createInitialBusinessGoal(initialSession));
  const [workflow, setWorkflow] = useState<WorkflowInput>(() => createInitialWorkflow(initialSession));
  const [diagnosisNote, setDiagnosisNote] = useState(() => createInitialDiagnosisNote(initialSession));
  const [busy, setBusy] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(() => {
    const activeJob = initialGenerationJob?.status === "queued" || initialGenerationJob?.status === "running";
    return (initialSession.status === "generating" || activeJob) && !initialSession.outputs.currentPlan;
  });
  const [error, setError] = useState<string | null>(() => userFacingWorkspaceError(initialSession.context.lastError));
  const [focus, setFocus] = useState("组织映射");
  const [instruction, setInstruction] = useState("");
  const [useOrgMemory, setUseOrgMemory] = useState(true);
  const complete = session.context.currentStep >= CONVERSATION_STEPS.length;
  const current = CONVERSATION_STEPS[Math.min(session.context.currentStep, CONVERSATION_STEPS.length - 1)];
  const plan = session.outputs.currentPlan;

  const summary = useMemo(() => CONVERSATION_STEPS.map((step) => ({ ...step, value: session.responses[step.id] })), [session.responses]);
  const diagnosis = useMemo(() => buildScenarioDiagnosis(session.responses), [session.responses]);
  const currentAnswer = useMemo(() => {
    if (current.id === "business_goal") return serializeBusinessGoalAnchor(businessGoal);
    if (current.id === "workflow") return serializeWorkflowInput(workflow);
    if (current.id === "diagnosis") {
      return [
        serializeScenarioDiagnosis(diagnosis),
        diagnosisNote.trim() ? `\n用户补充：${diagnosisNote.trim()}` : "",
      ].join("");
    }
    return answer;
  }, [answer, businessGoal, current.id, diagnosis, diagnosisNote, workflow]);

  async function sendAnswer() {
    if (!currentAnswer.trim() || busy) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${session.id}/answer`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer: currentAnswer }),
      });
      const payload = await readApiResponse<{ session?: LoopDesignerSession }>(response, "保存失败");
      if (!response.ok || !payload.session) return setError(payload.error || "保存失败");
      setSession(payload.session);
      setAnswer("");
      if (current.id === "business_goal") setBusinessGoal(createEmptyBusinessGoal());
      if (current.id === "workflow") setWorkflow(createEmptyWorkflow());
      if (current.id === "diagnosis") setDiagnosisNote("");
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!generatingPlan || session.outputs.currentPlan) return;
    let cancelled = false;
    async function pollPlanStatus() {
      const deadline = Date.now() + 8 * 60 * 1000;
      while (!cancelled && Date.now() < deadline) {
        await sleep(3000);
        const response = await fetch(`/loop-designer/api/sessions/${session.id}`, { cache: "no-store" });
        const payload = await readApiResponse<{ session?: LoopDesignerSession; generationJob?: PlanGenerationJob | null }>(response, "无法获取生成状态");
        if (!response.ok || !payload.session) throw new Error(payload.error || "无法获取生成状态");
        if (cancelled) return;
        setSession(payload.session);
        setGenerationJob(payload.generationJob ?? null);
        if (payload.session.outputs.currentPlan) {
          setError(null);
          setGeneratingPlan(false);
          return;
        }
        if (payload.generationJob?.status === "failed" || payload.session.status === "failed") {
          setError(userFacingWorkspaceError(payload.generationJob?.lastError || payload.session.context.lastError) || "生成失败，请调整输入后重试。");
          setGeneratingPlan(false);
          return;
        }
      }
      if (!cancelled) {
        setError("生成仍在后台进行。你可以稍后刷新页面查看结果，或重新点击生成。");
        setGeneratingPlan(false);
      }
    }
    pollPlanStatus().catch(() => {
      if (!cancelled) {
        setError("无法获取生成状态。请刷新页面确认是否已经生成完成。");
        setGeneratingPlan(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [generatingPlan, session.id, session.outputs.currentPlan]);

  async function generate() {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${session.id}/generate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ useOrgMemory, async: true }),
      });
      const payload = await readApiResponse<{ session?: LoopDesignerSession; generationJob?: PlanGenerationJob | null }>(response, "生成失败");
      if (!response.ok || !payload.session) {
        setGeneratingPlan(false);
        return setError(userFacingWorkspaceError(payload.error) || "生成失败");
      }
      setSession(payload.session);
      setGenerationJob(payload.generationJob ?? null);
      setGeneratingPlan(true);
    } catch {
      setGeneratingPlan(false);
      setError("生成请求中断。请刷新页面确认状态；如果仍无方案，请重新点击生成。");
    } finally {
      setBusy(false);
    }
  }

  async function refine() {
    if (!instruction.trim()) return;
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${session.id}/refine`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ focus, instruction }),
      });
      const payload = await readApiResponse<{ outputs?: LoopDesignerSession["outputs"] }>(response, "优化失败");
      if (!response.ok || !payload.outputs) return setError(payload.error || "优化失败");
      setSession((currentSession) => ({ ...currentSession, outputs: payload.outputs! }));
      setInstruction("");
    } catch {
      setError("网络连接中断，优化可能仍在后台进行。请稍后刷新页面查看结果。");
    } finally {
      setBusy(false);
    }
  }

  function loadDraftState(nextSession: LoopDesignerSession) {
    setBusinessGoal(createInitialBusinessGoal(nextSession));
    setWorkflow(createInitialWorkflow(nextSession));
    setDiagnosisNote(createInitialDiagnosisNote(nextSession));
  }

  async function reopenForEditing(stepId: EditableStepId) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "reopen", stepId }),
      });
      const payload = await readApiResponse<{ session?: LoopDesignerSession }>(response, "无法回到输入编辑");
      if (!response.ok || !payload.session) return setError(payload.error || "无法回到输入编辑");
      loadDraftState(payload.session);
      setGeneratingPlan(false);
      setSession(payload.session);
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  if (plan) return <PlanWorkspace session={session} plan={plan} busy={busy} error={error} editable={editable} focus={focus} setFocus={setFocus} instruction={instruction} setInstruction={setInstruction} refine={refine} onReopenStep={reopenForEditing} onSessionUpdate={setSession} />;

  return (
    <main className="min-h-screen">
      <header className="flex h-16 items-center justify-between border-b border-white/10 px-5 md:px-8">
        <Link href="/" className="inline-flex items-center gap-2.5 text-sm text-white/55 hover:text-white">
          <ArrowLeft size={16} />
          <LoopDesignerLogo className="h-7 w-7" />
          业务回路设计器
        </Link>
        <div className="mono text-[10px] tracking-[.18em] text-white/38">SESSION {session.id.slice(0, 8)}</div>
      </header>
      <div className="grid min-h-[calc(100vh-64px)] lg:grid-cols-[240px_minmax(0,1fr)_330px]">
        <aside className="hidden border-r border-white/10 p-6 lg:block">
          <div className="mono mb-7 text-[10px] tracking-[.2em] text-white/38">LOOP SEQUENCE</div>
          <div className="space-y-7">
            {CONVERSATION_STEPS.map((step, index) => <div key={step.id} className="blueprint-line flex gap-3"><span className={`relative z-10 grid h-8 w-8 place-items-center border mono text-xs ${index < session.context.currentStep ? "border-[var(--acid)] bg-[var(--acid)] text-black" : index === session.context.currentStep ? "border-[var(--cyan)] text-[var(--cyan)]" : "border-white/15 text-white/25"}`}>{index < session.context.currentStep ? <Check size={14} /> : `0${index + 1}`}</span><div><div className={index === session.context.currentStep ? "font-bold text-white" : "text-white/38"}>{step.title}</div><div className="mono mt-1 text-[9px] text-white/22">{step.id.toUpperCase()}</div></div></div>)}
          </div>
        </aside>
        <section className="flex min-w-0 flex-col">
          <div className="flex-1 overflow-y-auto p-5 md:p-10">
            <div className="mx-auto max-w-3xl">
              {session.context.templateSnapshot ? (
                <div className="mb-7 border border-[var(--acid)]/35 bg-[var(--acid)]/8 p-4">
                  <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">REFERENCE TEMPLATE</div>
                  <div className="mt-2 font-bold">{session.context.templateSnapshot.title} · {session.context.templateSnapshot.industry}</div>
                  <p className="mt-2 text-sm leading-6 text-white/55">
                    {session.context.templateSnapshot.definition || "模板会作为行业参考，不替代你的真实组织输入。"}
                  </p>
                </div>
              ) : null}
              {session.outputs.messages.map((message) => {
                const displayContent = message.role === "user" ? userMessageForChat(message.content, session.responses) : message.content;
                return (
                  <div key={message.id} className={`mb-7 ${message.role === "user" ? "ml-auto max-w-[86%]" : "max-w-[92%]"}`}>
                    <div className="mono mb-2 text-[9px] tracking-[.18em] text-white/30">{message.role === "assistant" ? "LOOP DESIGNER" : "YOU"}</div>
                    <div className={message.role === "assistant" ? "border-l-2 border-[var(--cyan)] pl-5 text-lg leading-8 text-white/76" : "bg-white/[.07] p-5 leading-7 text-white/82 whitespace-pre-line"}>{displayContent}</div>
                  </div>
                );
              })}
              {error ? <div className="border border-[var(--signal)]/50 bg-[var(--signal)]/10 p-4 text-sm text-orange-100">{error}</div> : null}
            </div>
          </div>
          {editable ? <div className="border-t border-white/10 bg-[#08110f]/94 p-5 md:p-7">
            <div className="mx-auto max-w-3xl">
              {!complete ? current.id === "business_goal" ? (
                <BusinessGoalComposer value={businessGoal} onChange={setBusinessGoal} onSubmit={sendAnswer} busy={busy} />
              ) : current.id === "workflow" ? (
                <WorkflowComposer value={workflow} onChange={setWorkflow} onSubmit={sendAnswer} busy={busy} />
              ) : (
                <ScenarioDiagnosisReview diagnosis={diagnosis} note={diagnosisNote} onNoteChange={setDiagnosisNote} onSubmit={sendAnswer} busy={busy} />
              ) : (
                <div className="space-y-3">
                  <GenerationProgressPanel active={generatingPlan} job={generationJob} />
                  <label className="flex items-center gap-3 border border-white/10 p-3 text-sm text-white/58">
                    <input
                      type="checkbox"
                      checked={useOrgMemory}
                      onChange={(event) => setUseOrgMemory(event.target.checked)}
                      disabled={generatingPlan}
                      className="h-4 w-4 accent-[var(--acid)]"
                    />
                    使用组织记忆
                  </label>
                  <button onClick={generate} disabled={busy || generatingPlan} className="flex w-full items-center justify-center gap-3 bg-[var(--acid)] px-6 py-4 font-black text-black disabled:opacity-50">
                    {generatingPlan ? <LoaderCircle className="animate-spin" /> : <RotateCw size={18} />}
                    {generatingPlan ? "后台生成中..." : "生成完整回路方案"}
                  </button>
                </div>
              )}
            </div>
          </div> : null}
        </section>
        <LiveDossier items={summary} />
      </div>
    </main>
  );
}

const GENERATION_PROGRESS_STEPS = [
  "排队进入模型生成通道",
  "整理业务目标和组织记忆",
  "分析每个回路单元能否由 AI 稳定帮忙",
  "生成改造后的人机协作控制回路图",
  "提取优先行动和下一步任务",
];

function GenerationProgressPanel({ active, job }: { active: boolean; job: PlanGenerationJob | null }) {
  if (!active) return null;
  const statusText = job?.status === "queued"
    ? "任务已提交，正在排队"
    : job?.status === "running"
      ? "Worker 正在生成方案"
      : "等待后台 Worker 领取任务";
  return (
    <div className="border border-[var(--cyan)]/35 bg-[var(--cyan)]/8 p-4">
      <div className="flex gap-3">
        <LoaderCircle className="mt-0.5 shrink-0 animate-spin text-[var(--cyan)]" size={18} />
        <div className="min-w-0">
          <div className="font-bold text-white/82">正在后台生成完整方案</div>
          <div className="mt-1 text-xs font-bold text-[var(--cyan)]">{statusText}</div>
          <p className="mt-1 text-xs leading-5 text-white/48">
            系统正在整理目标、每一步的分工和下一步行动。高峰时会排队生成；你可以稍后回到本页刷新查看结果，留在当前页会自动更新。
          </p>
        </div>
      </div>
      <div className="mt-4 grid gap-2">
        {GENERATION_PROGRESS_STEPS.map((step) => (
          <div key={step} className="flex items-center gap-2 text-xs text-white/58">
            <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[var(--acid)]" />
            <span>{step}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

type LiveDossierItem = {
  id: string;
  title: string;
  value?: string;
};

function LiveDossier({ items }: { items: LiveDossierItem[] }) {
  return (
    <aside className="hidden border-l border-white/10 bg-black/15 p-6 lg:block">
      <div className="mono mb-2 text-[10px] tracking-[.2em] text-[var(--acid)]">INPUT SUMMARY</div>
      <p className="mb-5 text-xs leading-5 text-white/38">完整输入统一保存在这里。聊天区只显示保存主题和下一步提示。</p>
      <div className="space-y-4">
        {items.map((item, index) => {
          const filled = Boolean(item.value?.trim());
          const value = item.value?.trim() || "等待输入";
          return (
            <details key={item.id} className="border border-white/10 bg-white/[.025] p-3">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-3">
                  <div className="mono text-[9px] text-white/30">0{index + 1} / {item.title}</div>
                  <div className={`mono shrink-0 border px-2 py-1 text-[9px] ${filled ? "border-[var(--acid)]/35 text-[var(--acid)]" : "border-white/12 text-white/30"}`}>
                    {filled ? "已保存" : "待填写"}
                  </div>
                </div>
                <p className="mt-3 break-words text-sm leading-6 text-white/58">{filled ? dossierPreview(item.id, value) : "完成该步骤后，这里会保留完整输入。"}</p>
                <div className="mono mt-3 text-[9px] text-[var(--cyan)]">{filled ? "展开完整输入" : "等待输入"}</div>
              </summary>
              {filled ? (
                <div className="mt-3 max-h-72 overflow-y-auto whitespace-pre-wrap break-words border border-white/10 bg-black/25 p-3 text-sm leading-6 text-white/68">
                  {value}
                </div>
              ) : null}
            </details>
          );
        })}
      </div>
    </aside>
  );
}

function dossierPreview(id: string, value: string) {
  if (id === "business_goal") return "业务目标锚点已收集，后续方案会以这些字段校验方向、输出和成功标志。";
  if (id === "workflow") {
    const workflow = parseWorkflowInput(value);
    const cellCount = workflow ? normalizeLoopCells(workflow).length : 0;
    return `业务回路单元已收集${cellCount ? `，共 ${cellCount} 个单元` : ""}。展开可查看每一步动作、输入、输出、异常和记录。`;
  }
  if (id === "diagnosis") return "现状拆解、可代理性缺口和补充说明已确认。展开可查看完整诊断输入。";
  return "该步骤输入已保存。展开可查看完整内容。";
}

function BusinessGoalComposer({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: BusinessGoalAnchor;
  onChange: (value: BusinessGoalAnchor) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const complete = ["intent", "goal", "output", "successSignal", "cycle"].every((key) => value[key as keyof BusinessGoalAnchor].trim());
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">GOAL ANCHOR</div>
          <div className="mt-2 text-lg font-black">业务目标锚点</div>
          <p className="mt-1 text-sm leading-6 text-white/45">这一步决定三重对齐。后续方案、诊断和行动建议都会回到这些字段校验。</p>
        </div>
        <button
          type="button"
          onClick={() => onChange({
            intent: "减少定制需求在销售、产品和交付之间反复澄清。",
            goal: "把需求确认周期从 5 天压缩到 48 小时，并降低交付返工。",
            output: "结构化需求单、承诺版本和验收记录。",
            successSignal: "需求一次确认率提升，返工率下降，高风险异常有人接管。",
            cycle: "一个项目交付周期",
            constraints: "不能由 AI 直接对客户做高风险承诺，关键变更必须留痕。",
          })}
          className="border border-white/15 px-3 py-2 text-xs text-white/60 hover:border-white/35 hover:text-white"
        >
          填入示例
        </button>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <InputBlock label="意图" value={value.intent} onChange={(intent) => onChange({ ...value, intent })} placeholder="为什么要设计这条回路。" />
        <InputBlock label="目标" value={value.goal} onChange={(goal) => onChange({ ...value, goal })} placeholder="业务上要变好的结果。" />
        <InputBlock label="输出" value={value.output} onChange={(output) => onChange({ ...value, output })} placeholder="回路最终产出什么。" />
        <InputBlock label="成功标志" value={value.successSignal} onChange={(successSignal) => onChange({ ...value, successSignal })} placeholder="怎么判断这条回路设计成功。" />
        <InputBlock label="周期" value={value.cycle} onChange={(cycle) => onChange({ ...value, cycle })} placeholder="例如：2 周、30 天、一个季度、一次活动周期。" />
        <InputBlock label="不可牺牲约束（不能为了效率牺牲的底线）" value={value.constraints} onChange={(constraints) => onChange({ ...value, constraints })} placeholder="哪些风险、体验、责任边界不能被牺牲。" />
      </div>
      <button type="button" onClick={onSubmit} disabled={busy || !complete} className="flex w-full items-center justify-center gap-2 bg-[var(--acid)] px-4 py-3 font-bold text-black disabled:opacity-30">
        {busy ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />} 保存业务目标
      </button>
      {!complete ? <p className="text-xs text-white/35">至少补齐意图、目标、输出、成功标志和周期。</p> : null}
    </div>
  );
}

type WorkflowCellDraft = LoopCellInput;

let newWorkflowCellCounter = 0;

function createWorkflowCellDrafts(workflow: WorkflowInput) {
  const cells = normalizeLoopCells(workflow);
  return cells.length ? cells.map((cell, index) => createWorkflowCellDraft(cell, index)) : [createBlankWorkflowCellDraft()];
}

function createWorkflowCellDraft(cell: LoopCellInput, index: number): WorkflowCellDraft {
  return { ...cell, id: cell.id || `workflow-cell-${index}-${hashCellText(cell.action)}` };
}

function createBlankWorkflowCellDraft(): WorkflowCellDraft {
  newWorkflowCellCounter += 1;
  return createEmptyLoopCell(`workflow-cell-new-${newWorkflowCellCounter}`);
}

function hashCellText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100000;
  }
  return hash;
}

function workflowNarrativeFromCells(cells: WorkflowCellDraft[]) {
  return serializeWorkflowStepLines(cells.map((cell) => cell.action));
}

function reorderWorkflowCells(cells: WorkflowCellDraft[], fromIndex: number, toIndex: number) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0 || fromIndex >= cells.length || toIndex >= cells.length) return cells;
  const next = [...cells];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function WorkflowComposer({
  value,
  onChange,
  onSubmit,
  busy,
}: {
  value: WorkflowInput;
  onChange: (value: WorkflowInput) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  const [cells, setCells] = useState<WorkflowCellDraft[]>(() => createWorkflowCellDrafts(value));
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const syncedNarrative = useRef(workflowNarrativeFromCells(cells));
  const complete = workflowNarrativeFromCells(cells).trim().length >= 12;

  useEffect(() => {
    if (value.narrative !== syncedNarrative.current) {
      const nextCells = createWorkflowCellDrafts(value);
      setCells(nextCells);
      syncedNarrative.current = workflowNarrativeFromCells(nextCells);
    }
  }, [value]);

  function commitCells(nextCells: WorkflowCellDraft[]) {
    const normalized = nextCells.length ? nextCells : [createBlankWorkflowCellDraft()];
    const narrative = workflowNarrativeFromCells(normalized);
    setCells(normalized);
    syncedNarrative.current = narrative;
    onChange({ ...value, narrative, cells: normalized });
  }

  function fillSampleWorkflow() {
    const sampleCells = [
      {
        action: "客户在群里或表单里提出定制需求。",
        owner: "客户发起，销售接收并负责进入回路。",
        trigger: "客户提出新需求或补充要求。",
        input: "原始需求、截图、参考案例。",
        output: "待确认需求 brief。",
        decision: "判断是否需要补问关键信息。",
        system: "群聊、表单。",
        acceptance: "需求 brief 字段完整，可以交给产品判断。",
        exceptionOwner: "销售负责人。",
        memory: "保留原始需求、补问记录和最终 brief。",
        friction: "口头和群聊描述容易丢失上下文。",
      },
      {
        action: "销售把需求整理成文字发给产品。",
        owner: "销售负责整理，产品负责接收。",
        trigger: "需求 brief 初步形成。",
        input: "客户原始需求和销售理解。",
        output: "产品可判断的需求说明。",
        decision: "判断客户承诺是否超出标准能力。",
        system: "CRM、项目管理表格。",
        acceptance: "产品能直接判断范围、风险和缺口。",
        exceptionOwner: "业务负责人。",
        memory: "沉淀需求字段、承诺版本和争议点。",
        friction: "销售在系统之间手工搬运信息。",
      },
      {
        action: "产品补问细节并判断能不能做。",
        owner: "产品负责能力判断，交付参与风险确认。",
        trigger: "收到销售整理后的需求说明。",
        input: "需求说明、历史案例、产品能力边界。",
        output: "可做/不可做/需降级的判断。",
        decision: "判断范围、风险、优先级和替代方案。",
        system: "知识库、项目管理表格。",
        acceptance: "判断结论可被交付评估和客户承诺引用。",
        exceptionOwner: "产品负责人。",
        memory: "记录判断依据和能力边界。",
        friction: "历史判断依据留在人脑里，复用困难。",
      },
      {
        action: "交付评估周期和成本。",
        owner: "交付负责评估并说明约束。",
        trigger: "产品给出可做范围。",
        input: "范围判断、资源情况、过往交付记录。",
        output: "周期、成本、风险和前置条件。",
        decision: "判断交付承诺是否可控。",
        system: "项目管理表格、资源排期。",
        acceptance: "评估结果可被销售用于对外承诺。",
        exceptionOwner: "交付负责人。",
        memory: "沉淀估算依据、偏差和复盘结论。",
        friction: "风险判断无人统一接管。",
      },
      {
        action: "销售向客户承诺并跟进验收。",
        owner: "销售负责客户承诺，销售负责人负责异常接管。",
        trigger: "交付评估完成。",
        input: "产品判断、交付评估、客户约束。",
        output: "客户承诺版本和验收反馈。",
        decision: "判断是否承诺、降级或升级审批。",
        system: "CRM、项目管理表格。",
        acceptance: "客户确认承诺版本，验收反馈进入复盘。",
        exceptionOwner: "销售负责人。",
        memory: "记录承诺版本、验收结果和异常原因。",
        friction: "承诺版本没有唯一事实源。",
      },
    ].map((cell, index) => createWorkflowCellDraft({ ...createEmptyLoopCell(`workflow-cell-sample-${index + 1}`), ...cell }, index));
    const narrative = workflowNarrativeFromCells(sampleCells);
    setCells(sampleCells);
    syncedNarrative.current = narrative;
    onChange({
      mode: "current",
      narrative,
      cells: sampleCells,
    });
  }

  function updateCell(id: string, patch: Partial<WorkflowCellDraft>) {
    commitCells(cells.map((cell) => cell.id === id ? { ...cell, ...patch } : cell));
  }

  function addCell() {
    commitCells([...cells, createBlankWorkflowCellDraft()]);
  }

  function insertCellAfter(id: string) {
    const index = cells.findIndex((cell) => cell.id === id);
    if (index < 0) return addCell();
    const next = [...cells];
    next.splice(index + 1, 0, createBlankWorkflowCellDraft());
    commitCells(next);
  }

  function removeCell(id: string) {
    commitCells(cells.filter((cell) => cell.id !== id));
  }

  function moveCell(id: string, offset: number) {
    const fromIndex = cells.findIndex((cell) => cell.id === id);
    commitCells(reorderWorkflowCells(cells, fromIndex, fromIndex + offset));
  }

  function dropCell(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    const fromIndex = cells.findIndex((cell) => cell.id === draggingId);
    const toIndex = cells.findIndex((cell) => cell.id === targetId);
    commitCells(reorderWorkflowCells(cells, fromIndex, toIndex));
    setDraggingId(null);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">WORKFLOW</div>
          <div className="mt-2 text-lg font-black">描述这条业务回路如何运行</div>
          <p className="mt-1 text-sm leading-6 text-white/45">把真实业务过程拆成一个个回路单元。每个单元只需要写清动作、执行责任、输入、输出、异常接管和可复用记录。</p>
        </div>
        <button
          type="button"
          onClick={fillSampleWorkflow}
          className="border border-white/15 px-3 py-2 text-xs text-white/60 hover:border-white/35 hover:text-white"
        >
          填入示例
        </button>
      </div>
      <WorkflowCellSandbox
        cells={cells}
        draggingId={draggingId}
        onAddCell={addCell}
        onInsertCellAfter={insertCellAfter}
        onUpdateCell={updateCell}
        onRemoveCell={removeCell}
        onMoveCell={moveCell}
        onDragStart={setDraggingId}
        onDragEnd={() => setDraggingId(null)}
        onDropCell={dropCell}
      />
      <BreakpointPreview cells={cells} />
      <button type="button" onClick={onSubmit} disabled={busy || !complete} className="flex w-full items-center justify-center gap-2 bg-[var(--acid)] px-4 py-3 font-bold text-black disabled:opacity-30">
        {busy ? <LoaderCircle className="animate-spin" size={17} /> : <Send size={17} />} 保存工作流
      </button>
    </div>
  );
}

function BreakpointPreview({ cells }: { cells: WorkflowCellDraft[] }) {
  const legacyNodes = legacyNodesFromLoopCells(cells);
  const breakpoints = scanWorkflowBreakpoints(legacyNodes);
  const counts: Record<BreakpointType, number> = {
    information_collapse: breakpoints.filter((item) => item.type === "information_collapse").length,
    waiting_black_hole: breakpoints.filter((item) => item.type === "waiting_black_hole").length,
    validation_vacuum: breakpoints.filter((item) => item.type === "validation_vacuum").length,
  };
  return (
    <section className="border border-[var(--cyan)]/25 bg-[var(--cyan)]/6 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">BREAKPOINT SCAN</div>
          <h3 className="mt-2 text-lg font-black">断点预览</h3>
          <p className="mt-1 text-xs leading-5 text-white/45">流程图回答谁接着谁做；这里先看哪里丢信息、哪里等人、哪里没有验证。</p>
        </div>
        <div className="mono border border-white/10 px-3 py-2 text-[10px] text-white/42">{breakpoints.length} 个候选断点</div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <BreakpointCountCard label="信息塌缩" count={counts.information_collapse} detail="转述、汇总、上报导致上下文变薄" />
        <BreakpointCountCard label="等待黑洞" count={counts.waiting_black_hole} detail="审批、排期、跨部门确认没有 SLA" />
        <BreakpointCountCard label="验证真空" count={counts.validation_vacuum} detail="交付后没有真实结果回验" />
      </div>
      {breakpoints.length ? (
        <div className="mt-4 space-y-2">
          {breakpoints.slice(0, 4).map((breakpoint) => {
            const node = legacyNodes.find((item) => item.id === breakpoint.nodeId);
            return (
              <div key={breakpoint.id} className="border border-white/8 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-white/78">{breakpointTypeLabel(breakpoint.type)} · {node ? `第 ${node.order} 步` : "旧节点"}</span>
                  <span className="mono text-[10px] text-[var(--signal)]">{breakpoint.severity}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-white/48">{breakpoint.suggestedIntervention}</p>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-4 text-xs leading-5 text-white/42">补充每一步的输入、输出、等待、完成标准和验证方式后，系统会自动显示候选断点。</p>
      )}
    </section>
  );
}

function BreakpointCountCard({ label, count, detail }: { label: string; count: number; detail: string }) {
  return (
    <div className="border border-white/10 bg-black/15 p-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-bold text-white/78">{label}</span>
        <span className="mono text-xl text-[var(--acid)]">{count}</span>
      </div>
      <p className="mt-2 text-xs leading-5 text-white/42">{detail}</p>
    </div>
  );
}

function WorkflowCellSandbox({
  cells,
  draggingId,
  onAddCell,
  onInsertCellAfter,
  onUpdateCell,
  onRemoveCell,
  onMoveCell,
  onDragStart,
  onDragEnd,
  onDropCell,
}: {
  cells: WorkflowCellDraft[];
  draggingId: string | null;
  onAddCell: () => void;
  onInsertCellAfter: (id: string) => void;
  onUpdateCell: (id: string, patch: Partial<WorkflowCellDraft>) => void;
  onRemoveCell: (id: string) => void;
  onMoveCell: (id: string, offset: number) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  onDropCell: (id: string) => void;
}) {
  return (
    <section className="border border-white/10 bg-white/[.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">LOOP SANDBOX</div>
          <div className="mt-1 text-base font-black">业务回路沙盘</div>
          <p className="mt-1 text-xs leading-5 text-white/42">像画手稿一样拆步骤。系统会用这些事实判断：AI 能不能接住这步工作，人要在哪些地方确认或接管。</p>
        </div>
        <button
          type="button"
          onClick={onAddCell}
          className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/62 hover:border-[var(--acid)] hover:text-[var(--acid)]"
        >
          <Plus size={14} />
          增加单元
        </button>
      </div>
      <div className="mt-4 grid gap-2 text-xs leading-5 text-white/44 md:grid-cols-4">
        <FieldHint label="触发" text="这一步从什么情况开始" />
        <FieldHint label="完成标准" text="交给下游时怎样算合格" />
        <FieldHint label="异常接管" text="出错、争议或超时后谁兜底" />
        <FieldHint label="记录复用" text="留下什么让下次不从零开始" />
      </div>
      <div className="mt-4 space-y-3">
        {cells.map((cell, index) => (
          <div key={cell.id}>
            <div
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                onDropCell(cell.id);
              }}
              className={`grid gap-3 border p-3 transition lg:grid-cols-[44px_minmax(0,1fr)_116px] ${draggingId === cell.id ? "border-[var(--acid)] bg-[var(--acid)]/8 opacity-75" : "border-white/10 bg-black/20"}`}
            >
              <button
                type="button"
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", cell.id);
                  onDragStart(cell.id);
                }}
                onDragEnd={onDragEnd}
                aria-label={`拖拽第 ${index + 1} 个单元排序`}
                title="拖拽排序"
                className="grid h-10 w-10 place-items-center border border-white/10 text-white/35 hover:border-white/30 hover:text-white"
              >
                <GripVertical size={17} />
              </button>
              <div className="min-w-0">
                <div className="mono text-[10px] tracking-[.14em] text-[var(--cyan)]">回路单元 {String(index + 1).padStart(2, "0")}</div>
                <label className="mt-2 block">
                  <span className="text-xs font-bold text-white/52">这一步实际在做什么</span>
                  <textarea
                    value={cell.action}
                    onChange={(event) => onUpdateCell(cell.id, { action: event.target.value })}
                    className="field mt-2 min-h-16 resize-y"
                    placeholder={index === 0 ? "例如：客户在群里提出定制需求。" : "继续补充这个单元的动作。"}
                  />
                </label>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  <MiniField label="执行和责任" value={cell.owner} onChange={(owner) => onUpdateCell(cell.id, { owner })} placeholder="谁执行，谁负责结果" />
                  <MiniField label="输入" value={cell.input} onChange={(input) => onUpdateCell(cell.id, { input })} placeholder="信息、对象、材料从哪里来" />
                  <MiniField label="输出" value={cell.output} onChange={(output) => onUpdateCell(cell.id, { output })} placeholder="产出什么，交给谁" />
                </div>
                <details className="mt-3 border border-white/8 bg-white/[.02] p-3" open={index === 0}>
                  <summary className="cursor-pointer text-xs font-bold text-white/54">补充 AI 能否接住这步的事实</summary>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <MiniField label="触发" value={cell.trigger} onChange={(trigger) => onUpdateCell(cell.id, { trigger })} placeholder="什么事件或条件让这一步开始" />
                    <MiniField label="判断" value={cell.decision} onChange={(decision) => onUpdateCell(cell.id, { decision })} placeholder="需要什么判断、取舍或承诺" />
                    <MiniField label="系统" value={cell.system} onChange={(system) => onUpdateCell(cell.id, { system })} placeholder="工具、系统、数据源或知识库" />
                    <MiniField label="完成标准" value={cell.acceptance} onChange={(acceptance) => onUpdateCell(cell.id, { acceptance })} placeholder="怎样算完成，下游可以直接接收" />
                    <MiniField label="异常接管" value={cell.exceptionOwner} onChange={(exceptionOwner) => onUpdateCell(cell.id, { exceptionOwner })} placeholder="争议、超时、失败后谁接管" />
                    <MiniField label="记录复用" value={cell.memory} onChange={(memory) => onUpdateCell(cell.id, { memory })} placeholder="留下什么记录，供下次直接复用" />
                    <div className="md:col-span-2">
                      <MiniField label="费劲的地方" value={cell.friction} onChange={(friction) => onUpdateCell(cell.id, { friction })} placeholder="哪里费时间、容易出错、反复沟通或需要人工搬运" />
                    </div>
                  </div>
                </details>
              </div>
              <div className="flex gap-2 lg:justify-end">
                <button
                  type="button"
                  onClick={() => onMoveCell(cell.id, -1)}
                  disabled={index === 0}
                  aria-label={`上移第 ${index + 1} 个单元`}
                  className="grid h-9 w-9 place-items-center border border-white/10 text-white/45 hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                >
                  <ArrowUp size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onMoveCell(cell.id, 1)}
                  disabled={index === cells.length - 1}
                  aria-label={`下移第 ${index + 1} 个单元`}
                  className="grid h-9 w-9 place-items-center border border-white/10 text-white/45 hover:border-white/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-25"
                >
                  <ArrowDown size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveCell(cell.id)}
                  aria-label={`删除第 ${index + 1} 个单元`}
                  className="grid h-9 w-9 place-items-center border border-white/10 text-white/45 hover:border-[var(--signal)]/60 hover:text-[var(--signal)]"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onInsertCellAfter(cell.id)}
              className="mx-auto mt-2 flex items-center gap-2 border border-dashed border-white/14 px-3 py-2 text-xs text-white/42 hover:border-[var(--acid)]/50 hover:text-[var(--acid)]"
            >
              <Plus size={13} /> 在下方增加一步
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}

function FieldHint({ label, text }: { label: string; text: string }) {
  return (
    <div className="border border-white/8 bg-black/15 p-3">
      <b className="text-white/68">{label}</b>
      <span className="mt-1 block">{text}</span>
    </div>
  );
}

function MiniField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="block">
      <span className="mono text-[10px] tracking-[.12em] text-white/30">{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} className="field mt-1 min-h-14 resize-y text-sm" placeholder={placeholder} />
    </label>
  );
}

function ScenarioDiagnosisReview({
  diagnosis,
  note,
  onNoteChange,
  onSubmit,
  busy,
}: {
  diagnosis: ScenarioDiagnosis;
  note: string;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  return (
    <div className="space-y-4">
        <div>
          <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">AI DIAGNOSIS</div>
          <div className="mt-2 text-lg font-black">确认 AI 拆解</div>
        <p className="mt-1 text-sm leading-6 text-white/45">系统会判断每个回路单元为什么还不能稳定由 AI 帮忙，并给出推荐改造模式。确认后再生成改造后的回路。</p>
      </div>
      <ScenarioDiagnosisPanel diagnosis={diagnosis} compact />
      <FieldBlock label="补充或修正" value={note} onChange={onNoteChange} placeholder="例如：客户异议必须由业务负责人接管；某个系统暂时不能接 API。" />
      <button type="button" onClick={onSubmit} disabled={busy} className="flex w-full items-center justify-center gap-2 bg-[var(--acid)] px-4 py-3 font-bold text-black disabled:opacity-30">
        {busy ? <LoaderCircle className="animate-spin" size={17} /> : <Check size={17} />} 确认拆解并进入生成
      </button>
    </div>
  );
}

function InputBlock({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="mono text-[10px] tracking-[.14em] text-white/32">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} className="field mt-2" placeholder={placeholder} />
    </label>
  );
}

function FieldBlock({
  label,
  value,
  onChange,
  placeholder,
  compact = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  compact?: boolean;
}) {
  return (
    <label className="mt-3 block">
      <span className="mono text-[10px] tracking-[.14em] text-white/32">{label}</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`field mt-2 resize-y ${compact ? "min-h-24" : "min-h-20"}`}
        placeholder={placeholder}
      />
    </label>
  );
}

function BusinessGoalAnchorPanel({ goal }: { goal: NonNullable<LoopPlan["businessGoalAnchor"]> }) {
  return (
    <section className="panel p-6">
      <div className="mono text-[10px] tracking-[.2em] text-[var(--cyan)]">GOAL ANCHOR</div>
      <h2 className="mt-3 text-2xl font-black">业务目标锚点</h2>
      <p className="mt-2 text-sm leading-6 text-white/50">先确认这组目标是否准确；它用来判断后面的设计有没有跑偏。</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <Metric label="意图" value={goal.intent} />
        <Metric label="目标" value={goal.goal} />
        <Metric label="输出" value={goal.output} />
        <Metric label="成功标志" value={goal.successSignal} />
        <Metric label="周期" value={goal.cycle} />
        <Metric label="不可牺牲约束（底线）" value={goal.constraints} />
      </div>
    </section>
  );
}

function ScenarioDiagnosisPanel({
  diagnosis,
  compact = false,
}: {
  diagnosis: ScenarioDiagnosis;
  compact?: boolean;
}) {
  const [selectedCellId, setSelectedCellId] = useState(diagnosis.cellDiagnostics[0]?.cellId ?? "");
  const selectedCell = diagnosis.cellDiagnostics.find((item) => item.cellId === selectedCellId) ?? diagnosis.cellDiagnostics[0];
  return (
    <div className={compact ? "border border-white/10 bg-white/[.03] p-4" : "panel p-6"}>
      <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">AI DECOMPOSITION</div>
      <h2 className="mt-3 text-2xl font-black">AI可以接管的工作</h2>
      <p className="mt-2 text-sm leading-6 text-white/50">这一块用来判断哪些步骤适合 AI 稳定帮忙，哪些还需要人接管。</p>
      <p className="mt-3 text-sm leading-6 text-white/56">{diagnosis.summary}</p>
      {diagnosis.cellDiagnostics.length ? (
        <>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {diagnosis.cellDiagnostics.map((item) => (
              <button
                key={item.cellId}
                type="button"
                onClick={() => setSelectedCellId(item.cellId)}
                className={`min-h-40 border p-4 text-left transition ${heatCardClass(item.heat, selectedCell?.cellId === item.cellId)}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="mono text-[10px] tracking-[.14em] text-white/42">{item.cellLabel}</span>
                  <span className={`whitespace-nowrap border px-2 py-1 text-[10px] font-bold ${heatBadgeClass(item.heat)}`}>{item.heatLabel}</span>
                </div>
                <p className="mt-3 text-sm font-bold leading-6 text-white/78">{item.action}</p>
                <div className="mt-3 text-xs leading-5 text-[var(--acid)]">推荐改造模式：{item.recommendedMode}</div>
              </button>
            ))}
          </div>

          {selectedCell ? (
            <div className="mt-5 border border-white/10 bg-black/25 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="mono text-[10px] tracking-[.16em] text-[var(--cyan)]">{selectedCell.cellLabel}</div>
                  <h3 className="mt-2 text-xl font-black">{selectedCell.recommendedMode}</h3>
                </div>
                <span className={`border px-3 py-2 text-xs font-bold ${heatBadgeClass(selectedCell.heat)}`}>{selectedCell.heatLabel}</span>
              </div>
              <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div>
                  <div className="text-sm font-bold text-white/82">当前 AI 能做什么</div>
                  <p className="mt-2 text-sm leading-7 text-white/58">{selectedCell.currentAiCapability}</p>
                </div>
                <div>
                  <div className="text-sm font-bold text-white/82">人必须保留什么</div>
                  <p className="mt-2 text-sm leading-7 text-white/58">{selectedCell.humanBoundary}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <DiagnosticList title="还不能接管的原因" items={selectedCell.blockers.length ? selectedCell.blockers : ["主要条件已具备，可以小范围试运行。"]} />
                <DiagnosticList title="下一步补什么" items={selectedCell.nextFill} accent />
              </div>
              <div className="mt-5 grid gap-2 md:grid-cols-5">
                {selectedCell.checks.map((check) => (
                  <div key={check.label} className={`border p-3 ${checkClass(check.status)}`}>
                    <div className="text-xs font-bold">{check.label}</div>
                    <div className="mt-2 mono text-[10px]">{check.status}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {diagnosis.priorityActions.length ? (
            <div className="mt-5 border border-white/10 p-4">
              <div className="mono text-[10px] tracking-[.16em] text-white/36">PRIORITY</div>
              <h3 className="mt-2 text-lg font-black">优先改造顺序</h3>
              <div className="mt-3 space-y-3">
                {diagnosis.priorityActions.map((item, index) => (
                  <div key={`${item.cellId}-${item.recommendedMode}`} className="grid gap-3 border border-white/8 bg-white/[.02] p-3 md:grid-cols-[48px_150px_1fr]">
                    <div className="mono text-sm text-[var(--acid)]">P{index}</div>
                    <div className="text-sm font-bold text-white/78">{item.recommendedMode}</div>
                    <div className="text-sm leading-6 text-white/56">{item.action}<span className="text-white/35"> 原因：{item.reason}</span></div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="mt-5 border border-white/10 p-4 text-sm leading-6 text-white/50">请先在业务回路沙盘中补充至少一个回路单元。</div>
      )}
    </div>
  );
}

function DiagnosticList({ title, items, accent = false }: { title: string; items: string[]; accent?: boolean }) {
  return (
    <div>
      <div className="text-sm font-bold text-white/82">{title}</div>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item} className={`border-l pl-3 text-sm leading-6 ${accent ? "border-[var(--acid)] text-white/70" : "border-[var(--signal)]/60 text-white/56"}`}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function heatCardClass(heat: "green" | "yellow" | "red", selected: boolean) {
  const selectedClass = selected ? "ring-1 ring-white/30" : "";
  if (heat === "green") return `border-[var(--acid)]/35 bg-[var(--acid)]/8 hover:border-[var(--acid)] ${selectedClass}`;
  if (heat === "yellow") return `border-[var(--cyan)]/35 bg-[var(--cyan)]/8 hover:border-[var(--cyan)] ${selectedClass}`;
  return `border-[var(--signal)]/35 bg-[var(--signal)]/8 hover:border-[var(--signal)] ${selectedClass}`;
}

function heatBadgeClass(heat: "green" | "yellow" | "red") {
  if (heat === "green") return "border-[var(--acid)]/40 text-[var(--acid)]";
  if (heat === "yellow") return "border-[var(--cyan)]/40 text-[var(--cyan)]";
  return "border-[var(--signal)]/50 text-[var(--signal)]";
}

function checkClass(status: "具备" | "待补齐" | "缺失") {
  if (status === "具备") return "border-[var(--acid)]/25 text-[var(--acid)]";
  if (status === "待补齐") return "border-[var(--cyan)]/25 text-[var(--cyan)]";
  return "border-[var(--signal)]/30 text-[var(--signal)]";
}

function completeScenarioDiagnosis(diagnosis: NonNullable<LoopPlan["scenarioDiagnosis"]>): ScenarioDiagnosis {
  return {
    ...diagnosis,
    cellDiagnostics: diagnosis.cellDiagnostics ?? [],
    priorityActions: diagnosis.priorityActions ?? [],
  };
}

type ToBeLoopCell = LoopPlan["toBeLoopCells"][number];
type ToBeMode = ToBeLoopCell["recommendedMode"];
type ToBeActorType = ToBeLoopCell["actorAssignments"][number]["type"];
type ToBeAutonomyLevel = ToBeLoopCell["controlProfile"]["autonomyLevel"];
type ToBeHumanBoundary = ToBeLoopCell["controlProfile"]["humanBoundary"];

const TO_BE_MODE_META: Record<ToBeMode, { color: string; label: string }> = {
  结构化入口: { color: "#62d9cf", label: "结构化入口" },
  知识增强执行: { color: "#b7f34a", label: "知识增强执行" },
  异步共创审议: { color: "#8fd2ff", label: "异步共创审议" },
  工具链编排: { color: "#ff8a5c", label: "工具链编排" },
  前置透明决策: { color: "#f4c95d", label: "前置透明决策" },
  模板化自动发布: { color: "#8edb75", label: "模板化自动发布" },
};

const TO_BE_ACTOR_META: Record<ToBeActorType, { label: string; color: string }> = {
  human: { label: "人类角色", color: "#62d9cf" },
  agent: { label: "智能体", color: "#b7f34a" },
  system: { label: "系统角色", color: "#ff8a5c" },
};

const CONTROL_AUTONOMY_META: Record<ToBeAutonomyLevel, { label: string; color: string; intensity: number }> = {
  human_led: { label: "人主导", color: "#62d9cf", intensity: 12 },
  agent_copilot: { label: "AI 副驾", color: "#8fd2ff", intensity: 38 },
  agent_led_hitl: { label: "AI 先处理，人确认关键点", color: "#b7f34a", intensity: 72 },
  agent_autonomous: { label: "AI 自动处理，人抽查", color: "#f4c95d", intensity: 92 },
};

const HUMAN_BOUNDARY_META: Record<ToBeHumanBoundary, { label: string; shortLabel: string; color: string }> = {
  approval: { label: "审批边界", shortLabel: "审批", color: "#62d9cf" },
  exception: { label: "异常接管", shortLabel: "异常", color: "#ff8a5c" },
  audit: { label: "审计边界", shortLabel: "审计", color: "#f4c95d" },
  decision: { label: "裁决边界", shortLabel: "裁决", color: "#8fd2ff" },
  commitment: { label: "承诺边界", shortLabel: "承诺", color: "#d7ff72" },
};

const TIME_SEGMENT_META = [
  { key: "processingMinutes", label: "处理", color: "#b7f34a" },
  { key: "waitingMinutes", label: "等待", color: "#62d9cf" },
  { key: "reworkMinutes", label: "返工", color: "#ff8a5c" },
] as const;

function ToBeLoopCellsPanel({
  sessionId,
  cells,
  workflowCells,
  editable,
  onSessionUpdate,
}: {
  sessionId: string;
  cells: LoopPlan["toBeLoopCells"];
  workflowCells: LoopCellInput[];
  editable: boolean;
  onSessionUpdate: (session: LoopDesignerSession) => void;
}) {
  const [selectedCellId, setSelectedCellId] = useState(cells[0]?.cellId ?? "");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [savingRuntime, setSavingRuntime] = useState(false);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const selectedCell = cells.find((cell) => cell.cellId === selectedCellId) ?? cells[0];
  const [timeDraftState, setTimeDraftState] = useState<{ cellId: string; timeEstimate?: ToBeLoopCell["timeEstimate"] }>(() => ({
    cellId: cells[0]?.cellId ?? "",
    timeEstimate: cells[0]?.timeEstimate,
  }));
  const timeDraft = selectedCell && timeDraftState.cellId === selectedCell.cellId ? timeDraftState.timeEstimate : selectedCell?.timeEstimate;

  if (!selectedCell || !timeDraft) return null;

  const activeCell = selectedCell;
  const activeTimeDraft = timeDraft;
  const activeWorkflowCell = findWorkflowCell(activeCell, workflowCells);
  const runtimeInvalid = !activeTimeDraft.bottleneckReason.trim();

  function selectCell(cellId: string) {
    setSelectedCellId(cellId);
    setDetailsOpen(true);
    setRuntimeError(null);
  }

  function updateTimeDraft(value: ToBeLoopCell["timeEstimate"]) {
    setTimeDraftState({ cellId: activeCell.cellId, timeEstimate: value });
    setRuntimeError(null);
  }

  async function saveRuntime() {
    if (runtimeInvalid) return setRuntimeError("请先填写瓶颈原因。");
    setSavingRuntime(true); setRuntimeError(null);
    try {
      const nextTimeEstimate = { ...activeTimeDraft, bottleneckReason: activeTimeDraft.bottleneckReason.trim() };
      const response = await fetch(`/loop-designer/api/sessions/${sessionId}/plan/cells`, {
        method: "PATCH",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ cellId: activeCell.cellId, timeEstimate: nextTimeEstimate }),
      });
      const payload = await readApiResponse<{ session?: LoopDesignerSession }>(response, "保存处理时间失败");
      if (!response.ok || !payload.session) return setRuntimeError(payload.error || "保存处理时间失败");
      onSessionUpdate(payload.session);
    } catch {
      setRuntimeError("网络连接中断，请稍后重试。");
    } finally {
      setSavingRuntime(false);
    }
  }

  return (
    <section className="space-y-5">
      <div className="panel overflow-hidden">
        <div className="border-b border-white/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">BUSINESS LOOP PROCESS</div>
              <h2 className="mt-2 text-3xl font-black">业务回路进程图</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/48">
                按细胞单元查看业务怎么跑、每一步主要由谁处理，以及什么时候必须请人确认。
              </p>
            </div>
            <div className="mono border border-white/10 px-3 py-2 text-[10px] text-white/38">
              {agentLedCellCount(cells)} AI 主导 / {cells.length} 个步骤
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {(Object.keys(CONTROL_AUTONOMY_META) as ToBeAutonomyLevel[]).map((level) => (
              <span key={level} className="inline-flex items-center gap-2 border border-white/8 px-3 py-2 text-xs text-white/54">
                <span className="h-2 w-5" style={{ background: CONTROL_AUTONOMY_META[level].color }} />
                {CONTROL_AUTONOMY_META[level].label}
              </span>
            ))}
            <span className="inline-flex items-center gap-2 border border-white/8 px-3 py-2 text-xs text-white/54">
              <ShieldCheck size={13} className="text-[var(--cyan)]" /> 人类确认边界
            </span>
            <span className="inline-flex items-center gap-2 border border-white/8 px-3 py-2 text-xs text-white/54">
              <ServerCog size={13} className="text-[var(--signal)]" /> 系统事实轨道
            </span>
          </div>
        </div>

        <div className={`relative ${detailsOpen ? "grid xl:grid-cols-[minmax(0,1fr)_360px]" : "grid"}`}>
          <div className={`overflow-x-auto p-4 ${detailsOpen ? "border-b border-white/10 xl:border-b-0 xl:border-r" : ""}`}>
            <AgenticControlLoopGraph
              cells={cells}
              selectedCellId={activeCell.cellId}
              onSelect={selectCell}
            />
          </div>
          {detailsOpen ? (
            <div className="sticky bottom-0 z-20 max-h-[68vh] min-h-80 overflow-y-auto border-t border-white/10 bg-[#101416]/95 p-6 shadow-[0_-18px_48px_rgba(0,0,0,.45)] backdrop-blur-xl xl:static xl:max-h-none xl:overflow-visible xl:border-t-0 xl:bg-black/15 xl:shadow-none xl:backdrop-blur-none">
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="float-right grid h-9 w-9 place-items-center border border-white/12 text-white/42 hover:border-white/35 hover:text-white"
                aria-label="收起回路单元详情"
                title="收起详情"
              >
                <X size={16} />
              </button>
		              <ToBeLoopCellDetail
		                cell={activeCell}
		                workflowCell={activeWorkflowCell}
		                editable={editable}
		                timeDraft={activeTimeDraft}
	                onTimeDraftChange={updateTimeDraft}
                onSaveRuntime={saveRuntime}
                saving={savingRuntime}
                invalid={runtimeInvalid}
                error={runtimeError}
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="absolute right-7 mt-5 hidden items-center gap-2 border border-white/12 bg-[#0b1714]/90 px-3 py-2 text-xs text-white/50 hover:border-[var(--cyan)]/50 hover:text-white xl:inline-flex"
            >
              <PanelRightOpen size={15} /> 查看单元详情
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function AgenticControlLoopGraph({
  cells,
  selectedCellId,
  onSelect,
}: {
  cells: ToBeLoopCell[];
  selectedCellId: string;
  onSelect: (cellId: string) => void;
}) {
  const maxMinutes = Math.max(...cells.map(totalCellMinutes), 1);
  const gridTemplateColumns = `repeat(${cells.length}, minmax(260px, 300px))`;
  return (
    <div className="min-w-[960px]">
      <div className="grid gap-4" style={{ gridTemplateColumns }}>
        {cells.map((cell, index) => (
          <ControlLoopCellNode
            key={cell.cellId}
            cell={cell}
            index={index}
            maxMinutes={maxMinutes}
            selected={cell.cellId === selectedCellId}
            isLast={index === cells.length - 1}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  );
}

function ControlLoopCellNode({
  cell,
  index,
  maxMinutes,
  selected,
  isLast,
  onSelect,
}: {
  cell: ToBeLoopCell;
  index: number;
  maxMinutes: number;
  selected: boolean;
  isLast: boolean;
  onSelect: (cellId: string) => void;
}) {
  const mode = TO_BE_MODE_META[cell.recommendedMode];
  const control = cell.controlProfile;
  const autonomy = CONTROL_AUTONOMY_META[control.autonomyLevel];
  const boundary = HUMAN_BOUNDARY_META[control.humanBoundary];
  const primaryActor = primaryActorForCell(cell);
  const systemActors = actorsByType(cell, "system");
  const supportAgents = actorsByType(cell, "agent").filter((actor) => actor.roleId !== primaryActor?.roleId);
  const actorColor = control.primaryActorType === "agent" ? TO_BE_ACTOR_META.agent.color : TO_BE_ACTOR_META.human.color;
  const Icon = control.primaryActorType === "agent" ? Bot : CircleUserRound;
  const borderColor = cell.timeEstimate.bottleneckLevel === "high"
    ? "rgba(255,138,92,.82)"
    : selected ? autonomy.color : "rgba(255,255,255,.12)";
  return (
    <button
      type="button"
      onClick={() => onSelect(cell.cellId)}
      className={`relative flex min-h-[520px] flex-col border bg-white/[.024] p-4 text-left transition ${selected ? "ring-1 ring-white/35" : "hover:bg-white/[.045]"}`}
      style={{ borderColor }}
    >
      {!isLast ? <span className="pointer-events-none absolute -right-4 top-32 h-px w-4 bg-white/22" /> : null}
      {!isLast ? <span className="pointer-events-none absolute -right-[17px] top-[123px] h-3 w-3 rotate-45 border-r border-t border-white/22" /> : null}
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mono text-[9px] tracking-[.16em]" style={{ color: mode.color }}>{cell.cellLabel || `CELL ${index + 1}`}</div>
          <div className="mt-2 line-clamp-2 text-sm font-black leading-5 text-white/86">{cell.action}</div>
        </div>
        {cell.timeEstimate.bottleneckLevel === "high" ? (
          <span className="mono shrink-0 border border-[var(--signal)]/50 px-2 py-1 text-[8px] text-[var(--signal)]">BOTTLENECK</span>
        ) : null}
      </div>

      <div className="mt-4 border border-white/8 bg-black/15 p-3">
        <div className="flex items-center justify-between gap-3">
          <span className="mono text-[9px] tracking-[.16em] text-white/30">主要处理者</span>
          <span className="border px-2 py-1 text-[11px] font-bold" style={{ borderColor: `${autonomy.color}66`, color: autonomy.color }}>
            {autonomy.label}
          </span>
        </div>
        <div className="mt-4 grid place-items-center">
          <div
            className="grid h-32 w-32 place-items-center border bg-[#0e1514]"
            style={{ borderColor: actorColor, boxShadow: `0 0 0 1px ${actorColor}22, inset 0 0 36px ${actorColor}18` }}
          >
            <Icon size={30} style={{ color: actorColor }} />
            <div className="mt-2 max-w-24 truncate text-center text-sm font-black" style={{ color: actorColor }}>{primaryActor ? displayActorName(primaryActor, cell) : "主要处理者待定"}</div>
            <div className="mono mt-1 text-[8px] tracking-[.12em] text-white/34">{TO_BE_ACTOR_META[control.primaryActorType].label}</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-white/45">
            <span>AI 接管强度</span>
            <span className="mono" style={{ color: autonomy.color }}>{autonomy.intensity}%</span>
          </div>
          <div className="mt-2 h-2 border border-white/10 bg-black/25">
            <span className="block h-full" style={{ width: `${autonomy.intensity}%`, background: autonomy.color }} />
          </div>
        </div>
      </div>

      <div className="mt-4 border p-3" style={{ borderColor: `${boundary.color}4d`, background: `${boundary.color}0f` }}>
        <div className="flex items-center gap-2">
          <ShieldCheck size={15} style={{ color: boundary.color }} />
          <span className="text-sm font-bold" style={{ color: boundary.color }}>{boundary.label}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-5 text-white/50">{replaceGenericLoopOwner(control.humanInterventionTriggers[0], cell)}</p>
      </div>

      <div className="mt-4 border-t border-white/8 pt-3">
        <div className="flex items-center gap-2">
          <ServerCog size={14} className="text-[var(--signal)]" />
          <span className="mono text-[9px] tracking-[.14em] text-white/30">SYSTEM FACT RAIL</span>
        </div>
        <div className="mt-2 space-y-2">
          {systemActors.length ? systemActors.slice(0, 2).map((actor) => (
            <div key={actor.roleId || actor.name} className="min-w-0 border border-white/8 bg-black/10 px-2 py-2">
              <div className="truncate text-xs font-bold text-white/66">{actor.name}</div>
              <div className="mt-1 line-clamp-2 text-[11px] leading-4 text-white/38">{replaceGenericLoopOwner(actor.responsibility, cell)}</div>
            </div>
          )) : <span className="text-xs text-white/25">事实轨道待确认</span>}
        </div>
      </div>

      <div className="mt-auto pt-4">
        {supportAgents.length ? (
          <div className="mb-3 flex min-w-0 items-center gap-2 border border-[var(--acid)]/20 bg-[var(--acid)]/5 px-2 py-2">
            <Zap size={13} className="shrink-0 text-[var(--acid)]" />
            <span className="truncate text-xs text-white/52">{supportAgents.map((actor) => actor.name).join("、")}</span>
          </div>
        ) : null}
        <MiniLatencyBar estimate={cell.timeEstimate} maxMinutes={maxMinutes} />
      </div>
    </button>
  );
}

function primaryActorForCell(cell: ToBeLoopCell) {
  return (
    cell.actorAssignments.find((actor) => actor.roleId === cell.controlProfile.primaryActorRoleId) ??
    cell.actorAssignments.find((actor) => actor.type === cell.controlProfile.primaryActorType) ??
    cell.actorAssignments[0]
  );
}

function findWorkflowCell(cell: ToBeLoopCell, workflowCells: LoopCellInput[]) {
  const targetAction = normalizeActionText(cell.action);
  if (!targetAction) return undefined;
  return workflowCells.find((item) => item.id === cell.cellId) ??
    workflowCells.find((item) => normalizeActionText(item.action) === targetAction) ??
    workflowCells.find((item) => {
      const candidateAction = normalizeActionText(item.action);
      return Boolean(candidateAction) && (targetAction.includes(candidateAction) || candidateAction.includes(targetAction));
    });
}

function normalizeActionText(value: string) {
  return value.replace(/[。！？\s]/g, "");
}

function actorsByType(cell: ToBeLoopCell, type: ToBeActorType) {
  return cell.actorAssignments.filter((actor) => actor.type === type);
}

function agentLedCellCount(cells: ToBeLoopCell[]) {
  return cells.filter((cell) => cell.controlProfile.primaryActorType === "agent").length;
}

function displayActorName(actor: ToBeLoopCell["actorAssignments"][number], cell: ToBeLoopCell) {
  if (actor.name !== "回路主理人") return actor.name;
  return concreteHumanRoleForCell(cell);
}

function concreteHumanRoleForCell(cell: ToBeLoopCell) {
  const source = `${cell.action} ${cell.humanRole} ${cell.actorAssignments.map((actor) => `${actor.name} ${actor.responsibility}`).join(" ")}`;
  if (/销售|客户承诺|客户跟进/.test(source)) return "销售负责人";
  if (/品牌|视频|发布|对外口径/.test(source)) return "品牌负责人";
  if (/产品|范围|能力|需求判断/.test(source)) return "产品负责人";
  if (/交付|验收|实施|排期/.test(source)) return "交付负责人";
  if (/客户成功|续约|反馈/.test(source)) return "客户成功负责人";
  return "业务负责人";
}

function replaceGenericLoopOwner(value: string, cell: ToBeLoopCell) {
  return value.replace(/回路主理人/g, concreteHumanRoleForCell(cell));
}

function MiniLatencyBar({ estimate, maxMinutes }: { estimate: ToBeLoopCell["timeEstimate"]; maxMinutes: number }) {
  const total = Math.max(estimate.processingMinutes + estimate.waitingMinutes + estimate.reworkMinutes, 1);
  const scaledWidth = `${Math.max(18, Math.round((total / maxMinutes) * 100))}%`;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[11px] text-white/42">
        <span>处理时间模拟</span>
        <span className={`mono border px-2 py-1 text-[8px] ${bottleneckBadgeClass(estimate.bottleneckLevel)}`}>{formatMinutes(total)}</span>
      </div>
      <div className="mt-2 h-3 border border-white/10 bg-black/25">
        <div className="flex h-full" style={{ width: scaledWidth }}>
          {TIME_SEGMENT_META.map((segment) => estimate[segment.key] > 0 ? (
            <span
              key={segment.key}
              title={`${segment.label} ${formatMinutes(estimate[segment.key])}`}
              style={{
                width: `${Math.max(4, Math.round((estimate[segment.key] / total) * 100))}%`,
                background: segment.color,
              }}
            />
          ) : null)}
        </div>
      </div>
    </div>
  );
}

function ToBeLoopCellDetail({
  cell,
  workflowCell,
  editable,
  timeDraft,
  onTimeDraftChange,
  onSaveRuntime,
  saving,
  invalid,
  error,
}: {
  cell: ToBeLoopCell;
  workflowCell?: LoopCellInput;
  editable: boolean;
  timeDraft: ToBeLoopCell["timeEstimate"];
  onTimeDraftChange: (value: ToBeLoopCell["timeEstimate"]) => void;
  onSaveRuntime: () => void;
  saving: boolean;
  invalid: boolean;
  error: string | null;
}) {
  const meta = TO_BE_MODE_META[cell.recommendedMode];
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center border" style={{ borderColor: meta.color, color: meta.color }}><Boxes size={19} /></span>
        <div>
          <div className="mono text-[9px] tracking-[.18em]" style={{ color: meta.color }}>{cell.recommendedMode}</div>
          <h3 className="mt-1 text-2xl font-black">{cell.cellLabel}</h3>
        </div>
      </div>
      <p className="mt-5 leading-7 text-white/62">{cell.action}</p>
      <ControlProfileDetail cell={cell} />
      <div className="mt-5 border border-white/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="mono text-[9px] tracking-[.14em] text-white/28">处理时间模拟</div>
            <div className="mt-1 text-sm text-white/62">总耗时 {formatMinutes(timeDraft.processingMinutes + timeDraft.waitingMinutes + timeDraft.reworkMinutes)} · 置信度 {timeConfidenceLabel(timeDraft.confidence)}</div>
          </div>
          <span className={`mono border px-2 py-1 text-[9px] ${bottleneckBadgeClass(timeDraft.bottleneckLevel)}`}>{timeDraft.bottleneckLevel.toUpperCase()}</span>
        </div>
        <TimeEditor value={timeDraft} onChange={onTimeDraftChange} editable={editable} />
        {error ? <p className="mt-3 border border-[var(--signal)]/40 bg-[var(--signal)]/10 p-3 text-xs leading-5 text-orange-100">{error}</p> : null}
        <button
          type="button"
          onClick={onSaveRuntime}
          disabled={!editable || saving || invalid}
          className="mt-4 flex w-full items-center justify-center gap-2 bg-[var(--acid)] px-4 py-3 text-sm font-bold text-black disabled:opacity-35"
        >
          {saving ? <LoaderCircle className="animate-spin" size={15} /> : <Check size={15} />} 保存时间校准
        </button>
      </div>
      <RoleDefinitionList cell={cell} workflowCell={workflowCell} />
      <ImplementationRulesDisclosure cell={cell} workflowCell={workflowCell} />
    </div>
  );
}

function ControlProfileDetail({ cell }: { cell: ToBeLoopCell }) {
  const control = cell.controlProfile;
  const primaryActor = primaryActorForCell(cell);
  const autonomy = CONTROL_AUTONOMY_META[control.autonomyLevel];
  const boundary = HUMAN_BOUNDARY_META[control.humanBoundary];
  return (
    <div className="mt-5 border border-white/10 bg-black/10 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="mono text-[9px] tracking-[.14em] text-white/28">人机控制权</div>
          <div className="mt-1 text-sm font-bold text-white/76">
            主要处理者：{primaryActor ? displayActorName(primaryActor, cell) : control.primaryActorRoleId}
          </div>
        </div>
        <span className="border px-2 py-1 text-[11px] font-bold" style={{ borderColor: `${autonomy.color}66`, color: autonomy.color }}>
          {autonomy.label}
        </span>
      </div>
      <div className="mt-4 grid gap-2 text-xs leading-5 text-white/56">
        <div className="border border-white/8 p-3">
          <div className="flex items-center gap-2 font-bold" style={{ color: boundary.color }}>
            <ShieldCheck size={14} /> {boundary.label}
          </div>
          <p className="mt-2 text-white/48">{primaryActor ? replaceGenericLoopOwner(primaryActor.responsibility, cell) : "主要处理者责任待确认。"}</p>
        </div>
        <DetailListCompact title="Agent 可执行权" items={control.agentExecutionRights.map((item) => replaceGenericLoopOwner(item, cell))} />
        <DetailListCompact title="必须请示 / 接管条件" items={control.humanInterventionTriggers.map((item) => replaceGenericLoopOwner(item, cell))} />
        <DetailListCompact title="自动推进条件" items={control.canAutoProceedWhen.map((item) => replaceGenericLoopOwner(item, cell))} />
      </div>
      <ToBeDetailRow label="下一步接管升级" value={replaceGenericLoopOwner(control.nextAutonomyUpgrade, cell)} accent={autonomy.color} />
    </div>
  );
}

function RoleDefinitionList({ cell, workflowCell }: { cell: ToBeLoopCell; workflowCell?: LoopCellInput }) {
  return (
    <div className="mt-5 border-t border-white/8 pt-4">
      <div className="mono text-[9px] tracking-[.14em] text-white/28">参与角色</div>
      <div className="mt-3 space-y-3">
        {cell.actorAssignments.map((actor) => {
          const definition = roleDefinitionForActor(actor, cell, workflowCell);
          const meta = TO_BE_ACTOR_META[actor.type];
          return (
            <div key={`${actor.type}-${actor.roleId || actor.name}`} className="border border-white/10 bg-white/[.018] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-black" style={{ color: meta.color }}>{meta.label}｜{definition.name}</div>
                  <p className="mt-2 text-sm leading-6 text-white/58">{definition.mission}</p>
                </div>
                <span className="mono border px-2 py-1 text-[9px] text-white/36" style={{ borderColor: `${meta.color}55` }}>{meta.label}</span>
              </div>
              <ul className="mt-3 space-y-2 text-xs leading-5 text-white/50">
                {definition.responsibilities.map((item) => <li key={item}>- {item}</li>)}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ImplementationRulesDisclosure({ cell, workflowCell }: { cell: ToBeLoopCell; workflowCell?: LoopCellInput }) {
  const rules = implementationRulesForCell(cell, workflowCell);
  return (
    <details className="mt-5 border border-white/10 bg-black/10 p-4">
      <summary className="cursor-pointer text-sm font-bold text-white/72">
        落地规则
        <span className="ml-2 text-xs font-normal text-white/35">输入、输出、验收、需要人确认、留痕</span>
      </summary>
      <div className="mt-4 grid gap-2">
        {rules.map((item) => (
          <div key={item.label} className="grid gap-1 border-t border-white/8 pt-3 md:grid-cols-[88px_minmax(0,1fr)]">
            <div className="mono text-[9px] tracking-[.12em] text-white/30">{item.label}</div>
            <div className="text-xs leading-5 text-white/54">{item.value}</div>
          </div>
        ))}
      </div>
    </details>
  );
}

function roleDefinitionForActor(actor: ToBeLoopCell["actorAssignments"][number], cell: ToBeLoopCell, workflowCell?: LoopCellInput) {
  const actorName = displayActorName(actor, cell);
  const action = workflowCell?.action || cell.action;
  const decision = workflowCell?.decision || stripTemplatePrefix(cell.humanRole);
  const input = workflowCell?.input || "当前单元输入对象";
  const output = workflowCell?.output || cell.acceptanceSignal;
  const acceptance = workflowCell?.acceptance || cell.acceptanceSignal;
  const exceptionOwner = workflowCell?.exceptionOwner || actorName;
  const system = workflowCell?.system || "事实记录系统";
  const memory = workflowCell?.memory || cell.memoryRecord;
  if (actor.type === "human") {
    return {
      name: actorName,
      mission: `对「${action}」中的业务判断、对外承诺和异常接管负责，确保输出能被下游使用。`,
      responsibilities: [
        `确认判断口径：${decision}`,
        `验收本单元输出：${output}`,
        `在异常、争议或高风险承诺出现时接管：${exceptionOwner}`,
        `确认可复用记录进入组织记忆：${memory}`,
      ],
    };
  }
  if (actor.type === "agent") {
    return {
      name: actor.name,
      mission: `围绕「${action}」承担可自动化的整理、检查、生成和联动任务，但不替代人的承诺和裁决。`,
      responsibilities: [
        `读取并结构化输入：${input}`,
        `生成或校验输出草稿：${output}`,
        `执行权限内动作：${cell.controlProfile.agentExecutionRights.join("；")}`,
        `遇到触发条件时请示人类：${cell.controlProfile.humanInterventionTriggers.join("；")}`,
      ].map((item) => replaceGenericLoopOwner(item, cell)),
    };
  }
  return {
    name: actor.name,
    mission: `作为「${action}」的事实源和状态载体，承载输入、输出、权限、版本和复盘记录。`,
    responsibilities: [
      `保存输入对象：${input}`,
      `保存输出对象：${output}`,
      `支持验收标准：${acceptance}`,
      `承载系统或数据源：${system}`,
    ],
  };
}

function implementationRulesForCell(cell: ToBeLoopCell, workflowCell?: LoopCellInput) {
  const input = workflowCell?.input || "待确认输入对象";
  const output = workflowCell?.output || cell.acceptanceSignal;
  const acceptance = workflowCell?.acceptance || cell.acceptanceSignal;
  const exceptionOwner = workflowCell?.exceptionOwner || concreteHumanRoleForCell(cell);
  const memory = workflowCell?.memory || cell.memoryRecord;
  return [
    {
      label: "输入",
      value: input,
    },
    {
      label: "输出",
      value: output,
    },
    {
      label: "验收",
      value: acceptance,
    },
    {
      label: "需要人确认",
      value: replaceGenericLoopOwner(`${exceptionOwner}接管；触发条件：${cell.controlProfile.humanInterventionTriggers.join("；")}`, cell),
    },
    {
      label: "留痕",
      value: replaceGenericLoopOwner(memory, cell),
    },
  ];
}

function stripTemplatePrefix(value: string) {
  return value
    .replace(/^人保留/, "")
    .replace(/相关的判断、承诺和责任。?$/, "")
    .replace(/[“”]/g, "")
    .trim() || value;
}

function TimeEditor({
  value,
  onChange,
  editable,
}: {
  value: ToBeLoopCell["timeEstimate"];
  onChange: (value: ToBeLoopCell["timeEstimate"]) => void;
  editable: boolean;
}) {
  function updateNumber(key: "processingMinutes" | "waitingMinutes" | "reworkMinutes", raw: string) {
    onChange({ ...value, [key]: Math.max(0, Math.round(Number(raw) || 0)) });
  }
  return (
    <div className="mt-4 space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <TimeNumberInput label="处理" value={value.processingMinutes} disabled={!editable} onChange={(raw) => updateNumber("processingMinutes", raw)} />
        <TimeNumberInput label="等待" value={value.waitingMinutes} disabled={!editable} onChange={(raw) => updateNumber("waitingMinutes", raw)} />
        <TimeNumberInput label="返工" value={value.reworkMinutes} disabled={!editable} onChange={(raw) => updateNumber("reworkMinutes", raw)} />
      </div>
      <div className="grid gap-2 md:grid-cols-2">
        <select disabled={!editable} value={value.confidence} onChange={(event) => onChange({ ...value, confidence: event.target.value as ToBeLoopCell["timeEstimate"]["confidence"] })} className="field">
          <option value="low">低置信估算</option>
          <option value="medium">中置信估算</option>
          <option value="high">高置信估算</option>
        </select>
        <select disabled={!editable} value={value.bottleneckLevel} onChange={(event) => onChange({ ...value, bottleneckLevel: event.target.value as ToBeLoopCell["timeEstimate"]["bottleneckLevel"] })} className="field">
          <option value="low">低卡点</option>
          <option value="medium">中卡点</option>
          <option value="high">高卡点</option>
        </select>
      </div>
      <textarea
        disabled={!editable}
        value={value.bottleneckReason}
        onChange={(event) => onChange({ ...value, bottleneckReason: event.target.value })}
        className="field min-h-24"
        placeholder="写明为什么这里可能卡住。"
      />
    </div>
  );
}

function TimeNumberInput({ label, value, disabled, onChange }: { label: string; value: number; disabled: boolean; onChange: (value: string) => void }) {
  return (
    <label className="block">
      <span className="mono text-[9px] tracking-[.14em] text-white/28">{label}</span>
      <input disabled={disabled} type="number" min={0} value={value} onChange={(event) => onChange(event.target.value)} className="field mt-1 h-10 px-2 text-sm" />
    </label>
  );
}

function ToBeDetailRow({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="mt-4 border-t border-white/8 pt-3">
      <div className="mono text-[9px] tracking-[.14em]" style={{ color: accent ?? "rgba(255,255,255,.28)" }}>{label}</div>
      <p className="mt-1 text-sm leading-6 text-white/62">{value}</p>
    </div>
  );
}

function DetailListCompact({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-4 border-t border-white/8 pt-3">
      <div className="mono text-[9px] tracking-[.14em] text-white/28">{title}</div>
      <ul className="mt-2 space-y-2">
        {items.map((item) => <li key={item} className="text-sm leading-6 text-white/62">{item}</li>)}
      </ul>
    </div>
  );
}

function totalCellMinutes(cell: ToBeLoopCell) {
  return cell.timeEstimate.processingMinutes + cell.timeEstimate.waitingMinutes + cell.timeEstimate.reworkMinutes;
}

function formatMinutes(minutes: number) {
  if (minutes >= 1440) {
    const days = minutes / 1440;
    return `${Number.isInteger(days) ? days : days.toFixed(1)} 天`;
  }
  if (minutes >= 60) {
    const hours = minutes / 60;
    return `${Number.isInteger(hours) ? hours : hours.toFixed(1)} 小时`;
  }
  return `${minutes} 分钟`;
}

function timeConfidenceLabel(value: ToBeLoopCell["timeEstimate"]["confidence"]) {
  return value === "high" ? "高" : value === "medium" ? "中" : "低";
}

function bottleneckBadgeClass(value: ToBeLoopCell["timeEstimate"]["bottleneckLevel"]) {
  if (value === "high") return "border-[var(--signal)]/50 text-[var(--signal)]";
  if (value === "medium") return "border-[var(--cyan)]/45 text-[var(--cyan)]";
  return "border-[var(--acid)]/45 text-[var(--acid)]";
}

type PlanWorkspaceProps = {
  session: LoopDesignerSession;
  plan: LoopPlan;
  busy: boolean;
  error: string | null;
  editable: boolean;
  focus: string;
  setFocus: (x: string) => void;
  instruction: string;
  setInstruction: (x: string) => void;
  refine: () => void;
  onReopenStep: (stepId: EditableStepId) => void;
  onSessionUpdate: (session: LoopDesignerSession) => void;
};

function hasCurrentToBeRuntimeShape(plan: LoopPlan) {
  return plan.toBeLoopCells.every((cell) =>
    Array.isArray((cell as Partial<ToBeLoopCell>).actorAssignments) &&
    (cell as Partial<ToBeLoopCell>).controlProfile &&
    (cell as Partial<ToBeLoopCell>).timeEstimate,
  );
}

function PlanWorkspace(props: PlanWorkspaceProps) {
  const planLike = props.plan as { toBeLoopCells?: unknown };
  if (!Array.isArray(planLike.toBeLoopCells) || planLike.toBeLoopCells.length === 0 || !hasCurrentToBeRuntimeShape(props.plan)) {
    return <LegacyPlanNotice sessionId={props.session.id} />;
  }
  return <CurrentPlanWorkspace {...props} />;
}

function LegacyPlanNotice({ sessionId }: { sessionId: string }) {
  return (
    <main className="min-h-screen px-4 py-5 md:px-8">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <Link href="/" className="inline-flex items-center gap-2.5 text-sm text-white/55">
          <ArrowLeft size={16} />
          <LoopDesignerLogo className="h-7 w-7" />
          全部回路
        </Link>
      </header>
      <section className="panel mx-auto mt-9 max-w-3xl p-8">
        <div className="mono text-[10px] tracking-[.2em] text-[var(--signal)]">OLD TEST DATA</div>
        <h1 className="mt-3 text-3xl font-black">旧测试方案需要重新生成</h1>
        <p className="mt-4 text-sm leading-7 text-white/58">
          当前会话保存的是旧版五阶段方案结构，不包含新的改造后回路单元映射。请从回路 Inbox 新建一条回路，或删除这条测试会话后重新设计。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="inline-flex items-center gap-2 bg-[var(--acid)] px-4 py-3 text-sm font-bold text-black">
            返回回路 Inbox <ArrowRight size={15} />
          </Link>
          <span className="border border-white/10 px-4 py-3 text-xs text-white/35">Session {sessionId}</span>
        </div>
      </section>
    </main>
  );
}

function CurrentPlanWorkspace(props: PlanWorkspaceProps) {
  const { session, plan, busy, error, editable, focus, setFocus, instruction, setInstruction, refine, onReopenStep, onSessionUpdate } = props;
  const enrichedPlan = useMemo(() => withMaturityMapping(plan), [plan]);
  const maturityChangeSummary = useMemo(() => {
    const previousPlan = session.outputs.versions.at(-2)?.plan;
    return previousPlan ? buildMaturityChangeSummary(withMaturityMapping(previousPlan), enrichedPlan) : null;
  }, [enrichedPlan, session.outputs.versions]);
  const showBusinessLoopProcess = false;
  const [copied, setCopied] = useState(false);
  const [exporting, setExporting] = useState<"markdown" | "pdf" | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [studyStatus, setStudyStatus] = useState<string | null>(session.matrixIntegration?.integrationStatus || null);
  const [submittingStudy, setSubmittingStudy] = useState(false);
  const [studyReturnUrl, setStudyReturnUrl] = useState<string | null>(null);
  const [promotingAsset, setPromotingAsset] = useState(false);
  const [assetNotice, setAssetNotice] = useState<string | null>(null);
  const [assetUrl, setAssetUrl] = useState<string | null>(null);
  async function copy() { await navigator.clipboard.writeText(planToMarkdown(enrichedPlan)); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  async function download(kind: "markdown" | "pdf") {
    setExporting(kind); setExportError(null);
    try {
      window.location.assign(`/loop-designer/api/sessions/${session.id}/exports/${kind}`);
    } catch {
      setExportError("网络连接中断，请稍后重试。");
    } finally {
      setExporting(null);
    }
  }
  async function submitStudy() {
    setSubmittingStudy(true); setExportError(null);
    try {
      const response = await fetch("/loop-designer/api/integrations/matrix-origin/design-studies", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const payload = await readApiResponse<{ study?: { status: string }; returnUrl?: string }>(response, "提交 Matrix 失败");
      if (!response.ok || !payload.study) return setExportError(payload.error || "提交 Matrix 失败");
      setStudyStatus(payload.study.status);
      setStudyReturnUrl(payload.returnUrl || session.matrixIntegration?.returnUrl || null);
    } catch {
      setExportError("网络连接中断，请稍后重试。");
    } finally {
      setSubmittingStudy(false);
    }
  }
  async function promoteAsset() {
    setPromotingAsset(true); setExportError(null); setAssetNotice(null);
    try {
      const response = await fetch("/loop-designer/api/loop-assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: session.id }),
      });
      const payload = await readApiResponse<{ created?: boolean; asset?: { id: string } }>(response, "沉淀资产失败");
      if (!response.ok || !payload.asset) return setExportError(payload.error || "沉淀资产失败");
      setAssetNotice(payload.created ? "已沉淀为企业回路资产" : "这条方案已经是企业回路资产");
      setAssetUrl("/loop-designer/assets");
    } catch {
      setExportError("网络连接中断，请稍后重试。");
    } finally {
      setPromotingAsset(false);
    }
  }
  function applyMaturitySuggestion(suggestion: NonNullable<LoopPlan["maturityMapping"]>["recommendedAction"]) {
    const focusLabel = suggestion.actionType === "apply_to_roadmap"
      ? "应用诊断建议到行动路线"
      : suggestion.dimension === "goal"
        ? "修复业务目标不清"
        : suggestion.dimension === "value"
          ? "修复人机边界问题"
          : suggestion.dimension === "logic"
            ? "修复数据闭环问题"
            : `提升${customerDimensionLabel(suggestion.dimension)}`;
    setFocus(focusLabel);
    setInstruction([
      `请按诊断建议执行：${customerFacingText(suggestion.action)}`,
      `只修改与“${customerDimensionLabel(suggestion.dimension)}”相关的字段，保留未要求修改的模块。`,
      suggestion.riskIfIgnored ? `不改的风险：${customerFacingText(suggestion.riskIfIgnored)}` : "",
      `预期效果：${customerFacingText(suggestion.expectedEffect)}`,
      "生成后请重新评估成熟度，并输出变化摘要。",
    ].filter(Boolean).join("\n"));
  }
  return <main className="min-h-screen px-4 py-5 md:px-8">
    <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
      <Link href="/" className="inline-flex items-center gap-2.5 text-sm text-white/55">
        <ArrowLeft size={16} />
        <LoopDesignerLogo className="h-7 w-7" />
        全部回路
      </Link>
      <div className="flex flex-wrap gap-2">
        {session.matrixIntegration ? <span className="inline-flex items-center border border-[var(--cyan)]/40 px-4 py-2 text-sm text-[var(--cyan)]">Matrix 关联 · {studyStatus || "designing"}</span> : null}
        <button onClick={copy} className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-sm"><Copy size={15} />{copied ? "已复制" : "复制"}</button>
        {assetUrl ? <a href={assetUrl} className="inline-flex items-center gap-2 bg-[var(--acid)] px-4 py-2 text-sm font-bold text-black">查看资产台 <ExternalLink size={15} /></a> : <button disabled={!editable || promotingAsset} onClick={promoteAsset} className="inline-flex items-center gap-2 bg-[var(--acid)] px-4 py-2 text-sm font-bold text-black disabled:opacity-40">{promotingAsset ? "沉淀中..." : "沉淀为回路资产"} <Boxes size={15} /></button>}
        <button disabled={exporting !== null} onClick={() => download("markdown")} className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-sm disabled:opacity-40"><Download size={15} />{exporting === "markdown" ? "准备中..." : "Markdown"}</button>
        <button disabled={exporting !== null} onClick={() => download("pdf")} className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-sm disabled:opacity-40"><Download size={15} />{exporting === "pdf" ? "准备中..." : "PDF"}</button>
        <button disabled title="手机号登录用户暂不支持飞书文档导出" className="inline-flex items-center gap-2 border border-white/10 px-4 py-2 text-sm font-bold text-white/28" aria-disabled="true">飞书导出暂不可用 <ExternalLink size={15} /></button>
        {session.matrixIntegration && !studyReturnUrl ? <button disabled={submittingStudy} onClick={submitStudy} className="inline-flex items-center gap-2 bg-[var(--cyan)] px-4 py-2 text-sm font-bold text-black disabled:opacity-40">{submittingStudy ? "提交中..." : "提交为回路设计提案"} <ArrowRight size={15} /></button> : null}
        {studyReturnUrl ? <a href={studyReturnUrl} className="inline-flex items-center gap-2 bg-[var(--cyan)] px-4 py-2 text-sm font-bold text-black">返回 Matrix 审阅 <ExternalLink size={15} /></a> : null}
      </div>
      {exportError ? <div className="w-full border border-[var(--signal)]/50 bg-[var(--signal)]/10 px-4 py-3 text-sm text-orange-100">{exportError}</div> : null}
      {assetNotice ? <div className="w-full border border-[var(--acid)]/35 bg-[var(--acid)]/10 px-4 py-3 text-sm text-[var(--acid)]">{assetNotice}</div> : null}
      {session.matrixIntegration ? (
        <div className="w-full border border-[var(--cyan)]/30 bg-[var(--cyan)]/10 px-4 py-3 text-sm leading-6 text-[var(--cyan)]">
          提交后只会进入 Matrix Origin 的映射审阅队列；不会直接修改组织拓扑、扩大权限或发布新版本。
        </div>
      ) : null}
    </header>
    <div className="mx-auto grid max-w-7xl gap-7 py-9 xl:grid-cols-[minmax(0,1fr)_340px]">
      <article className="space-y-7">
        <section className="panel p-7 md:p-10"><div className="mono text-[10px] tracking-[.2em] text-[var(--signal)]">LOOP BLUEPRINT</div><h1 className="mt-4 text-4xl font-black leading-tight md:text-5xl">{enrichedPlan.title}</h1><p className="mt-5 max-w-4xl text-lg leading-8 text-white/60">{enrichedPlan.executiveSummary}</p><div className="mt-7 grid gap-3 sm:grid-cols-3"><Metric label="起点" value={enrichedPlan.valueFlow.start} /><Metric label="终点" value={enrichedPlan.valueFlow.end} /><Metric label="目标速度" value={enrichedPlan.valueFlow.targetCycleTime} /></div></section>
        {enrichedPlan.processTransformation ? <BeforeAfterSummary transformation={enrichedPlan.processTransformation} /> : null}
        <PlanReadingGuide plan={enrichedPlan} onApplyAction={applyMaturitySuggestion} />
        {enrichedPlan.businessGoalAnchor ? <BusinessGoalAnchorPanel goal={enrichedPlan.businessGoalAnchor} /> : null}
        {enrichedPlan.scenarioDiagnosis ? <ScenarioDiagnosisPanel diagnosis={completeScenarioDiagnosis(enrichedPlan.scenarioDiagnosis)} /> : null}
        {showBusinessLoopProcess ? <ToBeLoopCellsPanel sessionId={session.id} cells={enrichedPlan.toBeLoopCells} workflowCells={enrichedPlan.workflowInput?.cells ?? []} editable={editable} onSessionUpdate={onSessionUpdate} /> : null}
        <OrganizationArchitecture organization={enrichedPlan.organizationMap} />
        {enrichedPlan.maturityMapping ? <MaturityAssessmentPanel mapping={enrichedPlan.maturityMapping} onApplyAction={applyMaturitySuggestion} /> : null}
        {maturityChangeSummary ? <MaturityChangeSummary summary={maturityChangeSummary} /> : null}
      </article>
      <aside className="space-y-5">
        <div className="panel sticky top-5 p-6">
          <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">EDIT INPUTS</div>
          <h2 className="mt-3 text-2xl font-black">回到输入重新编辑</h2>
          <p className="mt-2 text-sm leading-6 text-white/48">上一版方案会保留。修改输入后重新生成，会得到一版更贴近真实情况的新方案。</p>
          <div className="mt-5 space-y-2">
            <button type="button" disabled={!editable || busy} onClick={() => onReopenStep("business_goal")} className="w-full border border-white/12 p-3 text-left text-sm hover:border-[var(--acid)] disabled:opacity-35">
              <b className="block text-white/82">修改业务目标</b>
              <span className="mt-1 block text-xs leading-5 text-white/42">意图、目标、输出、成功标志、周期和底线。</span>
            </button>
            <button type="button" disabled={!editable || busy} onClick={() => onReopenStep("workflow")} className="w-full border border-white/12 p-3 text-left text-sm hover:border-[var(--acid)] disabled:opacity-35">
              <b className="block text-white/82">修改业务回路沙盘</b>
              <span className="mt-1 block text-xs leading-5 text-white/42">重新调整步骤、补充单元、拖拽顺序和交接事实。</span>
            </button>
            <button type="button" disabled={!editable || busy} onClick={() => onReopenStep("diagnosis")} className="w-full border border-white/12 p-3 text-left text-sm hover:border-[var(--acid)] disabled:opacity-35">
              <b className="block text-white/82">补充诊断说明</b>
              <span className="mt-1 block text-xs leading-5 text-white/42">补充哪里不准确、哪些风险和判断需要人工确认。</span>
            </button>
          </div>
          {error ? <p className="mt-3 text-sm text-orange-200">{error}</p> : null}
          <details className="mt-5 border border-white/10 bg-white/[.02] p-4">
            <summary className="cursor-pointer text-xs font-bold text-white/48">高级：只针对报告局部优化</summary>
            <div className="mono mt-4 text-[10px] tracking-[.2em] text-[var(--acid)]">REFINEMENT {session.outputs.refinementCount}/3</div>
            <h3 className="mt-2 text-lg font-black">定向优化</h3>
            <p className="mt-2 text-xs leading-5 text-white/42">适合已经看懂报告、只想改某个局部的人。多数情况下建议先回到输入重新编辑。</p>
          {session.context.templateSnapshot ? (
            <div className="mt-5 border border-white/10 bg-white/[.03] p-4">
              <div className="mono text-[10px] tracking-[.16em] text-[var(--cyan)]">参考模板</div>
              <div className="mt-2 text-sm font-bold">{session.context.templateSnapshot.title}</div>
              <p className="mt-2 text-xs leading-5 text-white/45">
                {session.context.templateSnapshot.industry} · {session.context.templateSnapshot.marginalEffectRating || "未评分"}
              </p>
              <p className="mt-3 text-xs leading-5 text-white/38">模板仅作为行业模式参考，最终方案以本次会话输入为准。</p>
            </div>
          ) : null}
          <select value={focus} onChange={(e) => setFocus(e.target.value)} className="field mt-5">{["修复业务目标不清","修复人机边界问题","修复数据闭环问题","提升闭环完整度","应用诊断建议到行动路线","数据入口与事实层","AI 能否接住工作","需要人确认与决策权限"].map((x) => <option key={x}>{x}</option>)}</select>
          <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} className="field mt-3 min-h-32" placeholder="写清你担心什么，或希望怎么调整。" />
          <button onClick={refine} disabled={!editable || busy || !instruction.trim() || session.outputs.refinementCount >= 3} className="mt-3 flex w-full items-center justify-center gap-2 bg-[var(--acid)] px-4 py-3 font-bold text-black disabled:opacity-30">{busy ? <LoaderCircle className="animate-spin" size={17} /> : <ArrowRight size={17} />}生成新版本</button>
          </details>
        </div>
      </aside>
    </div>
  </main>;
}

function BeforeAfterSummary({ transformation }: { transformation: NonNullable<LoopPlan["processTransformation"]> }) {
  const metrics = transformation.beforeAfter;
  const confirmedBreakpoints = transformation.breakpoints.filter((breakpoint) => breakpoint.userConfirmed !== false);
  const topMoves = transformation.moves.slice(0, 3);
  return (
    <section className="panel p-6">
      <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">BEFORE / AFTER</div>
      <h2 className="mt-3 text-3xl font-black">旧流程 vs 新回路</h2>
      <p className="mt-2 text-sm leading-6 text-white/50">先看旧流程为什么不是回路：哪里丢信息、哪里等待、哪里没有验证，以及系统建议怎么改。</p>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Metric label="节点数" value={`${metrics.nodeCountBefore} -> ${metrics.nodeCountAfter}`} />
        <Metric label="人工执行" value={`${metrics.humanExecutionNodesBefore} -> ${metrics.humanExecutionNodesAfter}`} />
        <Metric label="等待点" value={`${metrics.waitingPointsBefore} -> ${metrics.waitingPointsAfter}`} />
        <Metric label="验证信号" value={`${metrics.validationSignalsBefore} -> ${metrics.validationSignalsAfter}`} />
        <Metric label="审批轮次" value={`${metrics.approvalRoundsBefore} -> ${metrics.approvalRoundsAfter}`} />
        <Metric label="AI 可接手" value={`${metrics.aiTakeoverNodesAfter}`} />
        <Metric label="记忆资产" value={`${metrics.memoryAssetsBefore} -> ${metrics.memoryAssetsAfter}`} />
        <Metric label="置信度" value={metrics.confidence} />
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-bold text-white/80">三类断点命中</div>
          <div className="mt-3 space-y-3">
            {confirmedBreakpoints.slice(0, 6).map((breakpoint) => (
              <div key={breakpoint.id} className="border-l border-[var(--signal)]/70 pl-3">
                <div className="text-sm font-bold text-white/78">{breakpointTypeLabel(breakpoint.type)} · {breakpoint.severity}</div>
                <p className="mt-1 text-xs leading-5 text-white/48">{breakpoint.diagnosis}</p>
              </div>
            ))}
            {!confirmedBreakpoints.length ? <p className="text-sm text-white/45">暂无已确认断点。</p> : null}
          </div>
        </div>
        <div className="border border-white/10 bg-black/20 p-4">
          <div className="text-sm font-bold text-white/80">最关键的重构动作</div>
          <div className="mt-3 space-y-3">
            {topMoves.map((move) => (
              <div key={move.id} className="border-l border-[var(--acid)]/70 pl-3">
                <div className="text-sm font-bold text-white/78">{move.title}</div>
                <p className="mt-1 text-xs leading-5 text-white/48">{move.expectedEffect}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function breakpointTypeLabel(type: NonNullable<LoopPlan["processTransformation"]>["breakpoints"][number]["type"]) {
  return ({
    information_collapse: "信息塌缩",
    waiting_black_hole: "等待黑洞",
    validation_vacuum: "验证真空",
  })[type];
}

function Label({ children, className = "" }: { children: React.ReactNode; className?: string }) { return <div className={`mono text-[10px] tracking-[.16em] text-white/32 ${className}`}>{children}</div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="border border-white/10 p-4"><Label>{label}</Label><div className="mt-2 text-sm leading-6 text-white/72">{value}</div></div>; }

function PlanReadingGuide({
  plan,
  onApplyAction,
}: {
  plan: LoopPlan;
  onApplyAction: (suggestion: NonNullable<LoopPlan["maturityMapping"]>["recommendedAction"]) => void;
}) {
  const action = plan.maturityMapping?.recommendedAction;
  const tasks = buildNextActionItems(plan);
  const highlight = plan.maturityMapping?.highlightDimensions.length
    ? plan.maturityMapping.highlightDimensions.map(customerDimensionLabel).join("、")
    : "先跑通一条真实业务链路";
  const bottleneck = customerFacingText(plan.maturityMapping?.bottlenecks[0] || "目标、分工或验收标准还需要校准");
  return (
    <section className="panel border-[var(--acid)]/25 p-6">
      <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">优先阅读</div>
      <h2 className="mt-3 text-2xl font-black">优化优先级清单</h2>
      <p className="mt-2 text-sm leading-6 text-white/52">
        先看三件事：这条回路能不能先跑、哪里最容易出问题、下一步该修什么。如果看不懂，先按这张清单行动。
      </p>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <Metric label="亮点是什么" value={highlight} />
        <Metric label="短板是什么" value={bottleneck} />
        <Metric label="下一步先修什么" value={customerFacingText(action?.action || tasks[0] || "先选择一个短板做小范围试运行。")} />
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_.9fr]">
        <div className="border border-white/10 bg-black/15 p-4">
          <div className="text-sm font-bold text-white/82">下一步任务</div>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-white/58">
            {tasks.map((item) => <li key={item}>- {item}</li>)}
          </ul>
        </div>
        <div className="border border-[var(--signal)]/35 bg-[var(--signal)]/8 p-4">
          <div className="text-sm font-bold text-[var(--signal)]">推荐优先行动</div>
          <p className="mt-3 text-sm leading-6 text-white/66">{customerFacingText(action?.action || "先确认业务目标、关键步骤和异常接管人是否准确。")}</p>
          {action?.expectedEffect ? <p className="mt-2 text-xs leading-5 text-white/45">{customerFacingText(action.expectedEffect)}</p> : null}
          {action ? (
            <button
              type="button"
              onClick={() => onApplyAction(action)}
              className="mt-4 inline-flex items-center gap-2 bg-[var(--acid)] px-4 py-3 text-sm font-black text-black"
            >
              <ArrowRight size={15} /> 先处理这个短板
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function buildNextActionItems(plan: LoopPlan) {
  const items = [
    plan.businessGoalAnchor?.goal ? `确认业务目标是否准确：${plan.businessGoalAnchor.goal}` : "确认业务目标是否准确。",
    "查看“AI可以接管的工作”，确认哪些步骤适合 AI 稳定帮忙、哪些必须由人接管。",
    customerFacingText(plan.maturityMapping?.recommendedAction.action || plan.scenarioDiagnosis?.priorityActions?.[0]?.action || plan.roadmap[0]?.actions[0]),
    plan.validationQuestions[0] ? `补充一个待确认问题：${plan.validationQuestions[0]}` : undefined,
  ].filter((item): item is string => Boolean(item));
  return Array.from(new Set(items)).slice(0, 3);
}

type MaturityChange = {
  level: string;
  bottleneck: string;
  changes: string[];
};

function buildMaturityChangeSummary(previousPlan: LoopPlan, currentPlan: LoopPlan): MaturityChange | null {
  const previous = previousPlan.maturityMapping;
  const current = currentPlan.maturityMapping;
  if (!previous || !current) return null;

  const changes = current.maturity
    .map((item) => {
      const before = previous.maturity.find((candidate) => candidate.dimension === item.dimension);
      if (!before || before.level === item.level) return null;
      return `${customerDimensionLabel(item.dimension)} ${levelLabel(before.level)} -> ${levelLabel(item.level)}`;
    })
    .filter((item): item is string => Boolean(item));

  return {
    level: `综合成熟度 ${levelLabel(previous.overallLevel)} -> ${levelLabel(current.overallLevel)}`,
    bottleneck: `最大短板：${customerFacingText(previous.bottlenecks[0] || "未识别")} -> ${customerFacingText(current.bottlenecks[0] || "未识别")}`,
    changes: changes.length ? changes.slice(0, 3) : ["五维层级暂未变化，请查看证据链和短板是否变得更具体。"],
  };
}

function MaturityChangeSummary({ summary }: { summary: MaturityChange }) {
  return (
    <section className="panel border-[var(--cyan)]/25 p-6">
      <div className="mono text-[10px] tracking-[.2em] text-[var(--cyan)]">REFINEMENT RESULT</div>
      <h2 className="mt-3 text-2xl font-black">本次成熟度变化</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="border border-white/10 p-4 text-sm font-bold text-white/82">{summary.level}</div>
        <div className="border border-white/10 p-4 text-sm leading-6 text-white/62">{summary.bottleneck}</div>
      </div>
      <ul className="mt-4 space-y-2 text-sm leading-6 text-white/58">
        {summary.changes.map((item) => <li key={item}>— {item}</li>)}
      </ul>
    </section>
  );
}

function levelLabel(level: number) {
  return maturityLevelLabel(level as 1 | 2 | 3 | 4 | 5);
}
