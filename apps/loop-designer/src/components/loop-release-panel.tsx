"use client";

import { useState } from "react";
import { LoaderCircle, Rocket } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import type { LoopEvolutionEvent, LoopRunReleasePayload } from "@/lib/evolution-events-core";

export function LoopReleasePanel({ assetId, versionId }: { assetId: string; versionId?: string }) {
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function submit(formData: FormData) {
    if (!versionId) return setNotice("当前资产没有可发布版本。");
    setSaving(true); setNotice(null);
    const payload: LoopRunReleasePayload = {
      loopVersionId: versionId,
      releaseStage: formData.get("releaseStage") === "production" ? "production" : "trial",
      releaseReason: String(formData.get("releaseReason") || ""),
      readinessEvidence: String(formData.get("readinessEvidence") || "").split("\n").map((item) => item.trim()).filter(Boolean),
      ownerRole: String(formData.get("ownerRole") || ""),
      releaseAt: new Date().toISOString(),
    };
    try {
      const response = await fetch(`/loop-designer/api/loop-assets/${assetId}/releases`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await readApiResponse<{ event?: LoopEvolutionEvent }>(response, "发布失败");
      setNotice(response.ok && result.event ? "版本发布记录已保存" : result.error || "发布失败");
    } catch {
      setNotice("网络连接中断，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="border border-white/10 bg-black/20 p-6">
      <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">RELEASE</div>
      <h2 className="mt-3 text-2xl font-black">版本发布</h2>
      <form action={submit} className="mt-5 grid gap-3">
        <label className="block"><span className="mono text-[10px] text-white/35">发布阶段</span><select name="releaseStage" className="field mt-1"><option value="trial">试运行版</option><option value="production">正式运行版</option></select></label>
        <label className="block"><span className="mono text-[10px] text-white/35">负责人角色</span><input name="ownerRole" className="field mt-1" placeholder="例如：回路负责人" /></label>
        <label className="block"><span className="mono text-[10px] text-white/35">发布理由</span><textarea name="releaseReason" className="field mt-1 min-h-16" placeholder="为什么现在可以发布这个版本" /></label>
        <label className="block"><span className="mono text-[10px] text-white/35">就绪证据</span><textarea name="readinessEvidence" className="field mt-1 min-h-20" placeholder="一行一条证据" /></label>
        <button disabled={saving} className="inline-flex items-center justify-center gap-2 border border-[var(--cyan)] bg-[var(--cyan)]/10 px-4 py-3 text-sm font-bold text-[var(--cyan)] disabled:opacity-40">
          {saving ? <LoaderCircle className="animate-spin" size={15} /> : <Rocket size={15} />} 保存发布记录
        </button>
      </form>
      {notice ? <p className="mt-3 text-sm text-white/55">{notice}</p> : null}
    </section>
  );
}
