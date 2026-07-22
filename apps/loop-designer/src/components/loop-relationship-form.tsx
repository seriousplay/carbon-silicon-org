"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoaderCircle, Plus } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import type { LoopAsset, LoopRelationshipStrength, LoopRelationshipType } from "@/lib/loop-assets-core";

export function LoopRelationshipForm({
  assetId,
  candidateAssets,
}: {
  assetId: string;
  candidateAssets: Pick<LoopAsset, "id" | "title" | "domain">[];
}) {
  const router = useRouter();
  const [targetAssetId, setTargetAssetId] = useState(candidateAssets[0]?.id || "");
  const [type, setType] = useState<LoopRelationshipType>("dependency");
  const [strength, setStrength] = useState<LoopRelationshipStrength>("important");
  const [interfaceName, setInterfaceName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit() {
    if (!targetAssetId || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/loop-designer/api/loop-assets/${assetId}/relationships`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          targetAssetId,
          type,
          strength,
          interfaceName: type === "dependency" ? interfaceName : undefined,
        }),
      });
      const payload = await readApiResponse<{ relationship?: unknown }>(response, "创建关系失败");
      if (!response.ok || !payload.relationship) {
        setMessage(payload.error || "创建关系失败");
        return;
      }
      setInterfaceName("");
      setMessage("关系已创建");
      router.refresh();
    } catch {
      setMessage("网络连接中断，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  if (!candidateAssets.length) {
    return <p className="mt-4 text-sm text-white/45">至少需要两个回路资产，才能创建关系。</p>;
  }

  return (
    <div className="mt-5 border border-white/10 p-4">
      <div className="grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mono text-[9px] tracking-[.16em] text-white/30">目标资产</span>
          <select value={targetAssetId} onChange={(event) => setTargetAssetId(event.target.value)} className="field mt-2">
            {candidateAssets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.title} · {asset.domain}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mono text-[9px] tracking-[.16em] text-white/30">关系类型</span>
          <select value={type} onChange={(event) => setType(event.target.value as LoopRelationshipType)} className="field mt-2">
            <option value="dependency">依赖关系</option>
            <option value="parent_child">父子关系</option>
          </select>
        </label>
        <label className="block">
          <span className="mono text-[9px] tracking-[.16em] text-white/30">强度</span>
          <select value={strength} onChange={(event) => setStrength(event.target.value as LoopRelationshipStrength)} className="field mt-2">
            <option value="critical">关键依赖</option>
            <option value="important">重要依赖</option>
            <option value="nice_to_have">可选依赖</option>
          </select>
        </label>
        <label className="block">
          <span className="mono text-[9px] tracking-[.16em] text-white/30">接口名称</span>
          <input
            value={interfaceName}
            onChange={(event) => setInterfaceName(event.target.value)}
            disabled={type !== "dependency"}
            className="field mt-2"
            placeholder={type === "dependency" ? "例如：客户反馈交接" : "父子关系无需填写"}
          />
        </label>
      </div>
      {message ? <p className="mt-3 text-sm text-white/50">{message}</p> : null}
      <button
        type="button"
        onClick={submit}
        disabled={busy || !targetAssetId || (type === "dependency" && !interfaceName.trim())}
        className="mt-4 inline-flex items-center gap-2 bg-[var(--acid)] px-4 py-2 text-sm font-bold text-black disabled:opacity-35"
      >
        {busy ? <LoaderCircle className="animate-spin" size={15} /> : <Plus size={15} />} 新增关系
      </button>
    </div>
  );
}
