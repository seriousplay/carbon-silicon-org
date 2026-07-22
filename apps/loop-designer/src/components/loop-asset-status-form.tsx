"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import type { LoopAssetStatus } from "@/lib/loop-assets-core";

const STATUS_OPTIONS: Array<{ value: LoopAssetStatus; label: string }> = [
  { value: "incubating", label: "孵化中" },
  { value: "active", label: "运行中" },
  { value: "dormant", label: "沉睡" },
  { value: "retired", label: "退役" },
];

export function LoopAssetStatusForm({ assetId, status }: { assetId: string; status: LoopAssetStatus }) {
  const router = useRouter();
  const [value, setValue] = useState<LoopAssetStatus>(status);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = value !== status;

  async function save() {
    if (!dirty || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/loop-designer/api/loop-assets/${assetId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: value }),
      });
      const payload = await readApiResponse<{ asset?: unknown }>(response, "状态更新失败");
      if (!response.ok || !payload.asset) {
        setMessage(payload.error || "状态更新失败");
        return;
      }
      setMessage("状态已更新");
      router.refresh();
    } catch {
      setMessage("网络连接中断，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="border border-white/10 p-3">
      <label className="block">
        <span className="mono text-[9px] tracking-[.16em] text-white/30">资产状态</span>
        <select value={value} onChange={(event) => setValue(event.target.value as LoopAssetStatus)} className="field mt-2">
          {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </label>
      <button
        type="button"
        onClick={save}
        disabled={!dirty || busy}
        className="mt-3 inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/62 hover:border-[var(--acid)] hover:text-[var(--acid)] disabled:opacity-35"
      >
        {busy ? <LoaderCircle className="animate-spin" size={14} /> : <Save size={14} />}
        保存状态
      </button>
      {message ? <p className="mt-2 text-xs text-white/45">{message}</p> : null}
    </div>
  );
}
