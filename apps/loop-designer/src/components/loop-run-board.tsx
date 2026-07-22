"use client";

import { useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import type { LoopEvolutionEvent, RunRoundPayload } from "@/lib/evolution-events-core";

export function LoopRunBoard({ assetId, versionId, initialEvents }: { assetId: string; versionId?: string; initialEvents: LoopEvolutionEvent[] }) {
  const [events, setEvents] = useState(initialEvents);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextSequence = Math.max(0, ...events.filter((event) => event.eventType === "run_round").map((event) => event.runSequence ?? 0)) + 1;

  async function submit(formData: FormData) {
    if (!versionId) return setError("当前资产没有可运行版本。");
    setSaving(true); setError(null);
    const payload: RunRoundPayload = {
      runSequence: nextSequence,
      runMode: formData.get("runMode") === "production" ? "production" : "trial",
      loopVersionId: versionId,
      goal: String(formData.get("goal") || ""),
      metricSnapshot: [{ name: String(formData.get("metricName") || "核心指标"), current: String(formData.get("metricCurrent") || "待记录"), target: String(formData.get("metricTarget") || "") }],
      incidents: String(formData.get("incidents") || "").split("\n").map((item) => item.trim()).filter(Boolean),
      validatedLearning: String(formData.get("validatedLearning") || ""),
      nextChange: String(formData.get("nextChange") || ""),
      workflowChanged: formData.get("workflowChanged") === "on",
      acceptanceScriptChanged: formData.get("acceptanceScriptChanged") === "on",
      guardrailChanged: formData.get("guardrailChanged") === "on",
      interfaceChanged: formData.get("interfaceChanged") === "on",
      trueLoopSignal: formData.get("trueLoopSignal") === "strong" ? "strong" : formData.get("trueLoopSignal") === "missing" ? "missing" : "partial",
      releaseRecommendation: formData.get("releaseRecommendation") === "release_production" ? "release_production" : formData.get("releaseRecommendation") === "keep_production" ? "keep_production" : formData.get("releaseRecommendation") === "pause" ? "pause" : "continue_trial",
    };
    try {
      const response = await fetch(`/loop-designer/api/loop-assets/${assetId}/evolution-events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await readApiResponse<{ event?: LoopEvolutionEvent }>(response, "保存运行记录失败");
      if (!response.ok || !result.event) return setError(result.error || "保存运行记录失败");
      setEvents((current) => [result.event!, ...current]);
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border border-white/10 bg-black/20 p-6">
      <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">RUN RECORDS</div>
      <h2 className="mt-3 text-2xl font-black">运行记录</h2>
      <p className="mt-2 text-sm leading-6 text-white/45">每一轮都追加记录，不预设三轮上限。</p>
      <form action={submit} className="mt-5 grid gap-3">
        <div className="grid gap-3 md:grid-cols-2">
          <Field name="goal" label={`第 ${nextSequence} 轮目标`} placeholder="本轮要验证什么" />
          <Select name="runMode" label="运行模式" options={[["trial", "试运行"], ["production", "正式运行"]]} />
          <Field name="metricName" label="指标名称" placeholder="例如：确认周期" />
          <Field name="metricCurrent" label="当前值" placeholder="例如：3 天" />
          <Field name="metricTarget" label="目标值" placeholder="例如：48 小时" />
          <Select name="trueLoopSignal" label="真回路信号" options={[["partial", "部分形成"], ["strong", "强信号"], ["missing", "尚未形成"]]} />
        </div>
        <TextArea name="incidents" label="本轮异常" placeholder="一行一个异常" />
        <TextArea name="validatedLearning" label="验证结论" placeholder="哪条假设被证实或证伪" />
        <TextArea name="nextChange" label="下一轮先改什么" placeholder="下一轮最小改动" />
        <div className="grid gap-2 text-xs text-white/55 md:grid-cols-4">
          <Check name="workflowChanged" label="工作流变更" />
          <Check name="acceptanceScriptChanged" label="验收脚本变更" />
          <Check name="guardrailChanged" label="护栏变更" />
          <Check name="interfaceChanged" label="接口变更" />
        </div>
        <Select name="releaseRecommendation" label="阶段判断" options={[["continue_trial", "继续试运行"], ["release_production", "可发布正式版"], ["keep_production", "保持正式运行"], ["pause", "暂停"]]} />
        <button disabled={saving} className="inline-flex items-center justify-center gap-2 bg-[var(--acid)] px-4 py-3 text-sm font-bold text-black disabled:opacity-40">
          {saving ? <LoaderCircle className="animate-spin" size={15} /> : <Plus size={15} />} 追加运行记录
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-orange-200">{error}</p> : null}
      <div className="mt-6 space-y-3">
        {events.filter((event) => event.eventType === "run_round").map((event) => {
          const payload = event.payload as RunRoundPayload;
          return (
            <div key={event.id} className="border border-white/10 p-3">
              <div className="text-sm font-bold text-white/75">第 {payload.runSequence} 轮 · {payload.runMode === "trial" ? "试运行" : "正式运行"} · {signalLabel(payload.trueLoopSignal)}</div>
              <p className="mt-2 text-xs leading-5 text-white/45">{payload.validatedLearning}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Field({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return <label className="block"><span className="mono text-[10px] text-white/35">{label}</span><input name={name} className="field mt-1" placeholder={placeholder} /></label>;
}

function TextArea({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return <label className="block"><span className="mono text-[10px] text-white/35">{label}</span><textarea name={name} className="field mt-1 min-h-20 resize-y" placeholder={placeholder} /></label>;
}

function Select({ name, label, options }: { name: string; label: string; options: Array<[string, string]> }) {
  return <label className="block"><span className="mono text-[10px] text-white/35">{label}</span><select name={name} className="field mt-1">{options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>;
}

function Check({ name, label }: { name: string; label: string }) {
  return <label className="flex items-center gap-2 border border-white/10 p-2"><input name={name} type="checkbox" className="accent-[var(--acid)]" /> {label}</label>;
}

function signalLabel(signal: string) {
  if (signal === "strong") return "强信号";
  if (signal === "missing") return "尚未闭环";
  return "部分形成";
}
