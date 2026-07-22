"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, LoaderCircle } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";

export function LoopAssetIterationButton({ assetId, disabled = false }: { assetId: string; disabled?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function startIteration() {
    if (busy || disabled) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/loop-designer/api/loop-assets/${assetId}/iterations`, { method: "POST" });
      const payload = await readApiResponse<{ sessionId?: string }>(response, "无法启动迭代");
      if (response.ok && payload.sessionId) {
        router.push(`/sessions/${payload.sessionId}`);
        return;
      }
      setError(payload.error || "无法启动迭代");
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={startIteration}
        disabled={busy || disabled}
        className="inline-flex items-center gap-2 bg-[var(--acid)] px-4 py-3 text-sm font-black text-black hover:bg-white disabled:opacity-35"
      >
        {busy ? <LoaderCircle className="animate-spin" size={16} /> : <ArrowRight size={16} />}
        {busy ? "正在启动..." : "启动迭代"}
      </button>
      {error ? <p className="mt-3 text-sm text-orange-200">{error}</p> : null}
    </div>
  );
}
