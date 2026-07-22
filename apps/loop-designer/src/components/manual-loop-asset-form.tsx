"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Plus } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import type { LoopAsset, LoopAssetStatus } from "@/lib/loop-assets-core";

const STATUS_OPTIONS: Array<{ value: LoopAssetStatus; label: string }> = [
  { value: "incubating", label: "孵化中" },
  { value: "active", label: "运行中" },
  { value: "dormant", label: "沉睡" },
];

export function ManualLoopAssetForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [domain, setDomain] = useState("");
  const [status, setStatus] = useState<LoopAssetStatus>("incubating");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!title.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/loop-designer/api/loop-assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          domain: domain || undefined,
          status,
        }),
      });
      const payload = await readApiResponse<{ asset?: LoopAsset }>(response, "创建资产失败");
      if (!response.ok || !payload.asset) {
        setMessage(payload.error || "创建资产失败");
        return;
      }
      router.push(`/assets/${payload.asset.id}`);
      router.refresh();
    } catch {
      setMessage("网络连接中断，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-8 border border-white/10 bg-black/20 p-6">
      <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">NEW LOOP ASSET</div>
      <h2 className="mt-3 text-2xl font-black">手动登记回路资产</h2>
      <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_160px_auto]">
        <label className="block">
          <span className="mono text-[9px] tracking-[.16em] text-white/30">资产名称</span>
          <input value={title} onChange={(event) => setTitle(event.target.value)} className="field mt-2" placeholder="例如：客户反馈闭环" />
        </label>
        <label className="block">
          <span className="mono text-[9px] tracking-[.16em] text-white/30">领域</span>
          <input value={domain} onChange={(event) => setDomain(event.target.value)} className="field mt-2" placeholder="例如：客户成功" />
        </label>
        <label className="block">
          <span className="mono text-[9px] tracking-[.16em] text-white/30">状态</span>
          <select value={status} onChange={(event) => setStatus(event.target.value as LoopAssetStatus)} className="field mt-2">
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          onClick={submit}
          disabled={busy || !title.trim()}
          className="mt-6 inline-flex h-11 items-center justify-center gap-2 bg-[var(--acid)] px-4 text-sm font-bold text-black disabled:opacity-35 lg:self-end"
        >
          {busy ? <LoaderCircle className="animate-spin" size={15} /> : <Plus size={15} />}
          新建
        </button>
      </div>
      {message ? <p className="mt-3 text-sm text-white/50">{message}</p> : null}
    </section>
  );
}
