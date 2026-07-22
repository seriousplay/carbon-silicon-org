"use client";

import { useState } from "react";
import { LoaderCircle, PlugZap } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import type { InterfaceProtocol, InterfaceProtocolPayload } from "@/lib/interface-protocols-core";

export function InterfaceProtocolPanel({ relationshipId, protocols }: { relationshipId: string; protocols: InterfaceProtocol[] }) {
  const [items, setItems] = useState(protocols);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    setSaving(true); setError(null);
    const payload: InterfaceProtocolPayload & { changeReason?: string } = {
      couplingType: formData.get("couplingType") === "hard" ? "hard" : formData.get("couplingType") === "soft" ? "soft" : "feedback",
      semanticProtocol: {
        meaning: String(formData.get("meaning") || ""),
        consumptionRule: String(formData.get("consumptionRule") || ""),
      },
      structuralProtocol: {
        dataObject: String(formData.get("dataObject") || ""),
        requiredFields: splitLines(String(formData.get("requiredFields") || "")),
        optionalFields: splitLines(String(formData.get("optionalFields") || "")),
        version: String(formData.get("version") || "1.0.0"),
        sourceOfTruth: String(formData.get("sourceOfTruth") || ""),
      },
      governanceProtocol: {
        ownerRole: String(formData.get("ownerRole") || ""),
        acceptanceRole: String(formData.get("acceptanceRole") || ""),
        failureReturnPath: String(formData.get("failureReturnPath") || ""),
        changeNotice: String(formData.get("changeNotice") || ""),
        emergencyRule: String(formData.get("emergencyRule") || ""),
      },
      changeReason: String(formData.get("changeReason") || ""),
    };
    try {
      const response = await fetch(`/loop-designer/api/loop-relationships/${relationshipId}/interface-protocols`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await readApiResponse<{ protocol?: InterfaceProtocol }>(response, "创建接口协议失败");
      if (!response.ok || !result.protocol) return setError(result.error || "创建接口协议失败");
      setItems((current) => [result.protocol!, ...current]);
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  async function activate(protocolId: string) {
    setSaving(true); setError(null);
    try {
      const response = await fetch(`/loop-designer/api/interface-protocols/${protocolId}/status`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
      const result = await readApiResponse<{ protocol?: InterfaceProtocol }>(response, "启用协议失败");
      if (!response.ok || !result.protocol) return setError(result.error || "启用协议失败");
      setItems((current) => current.map((item) =>
        item.id === protocolId ? result.protocol! : item.relationshipId === result.protocol!.relationshipId && item.status === "active" ? { ...item, status: "deprecated" } : item,
      ));
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-4 border border-white/10 bg-white/[.02] p-4">
      <div className="mono text-[10px] tracking-[.16em] text-[var(--cyan)]">INTERFACE PROTOCOL</div>
      <div className="mt-2 space-y-2">
        {items.map((protocol) => (
          <div key={protocol.id} className="border border-white/10 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-bold text-white/75">v{protocol.versionNumber} · {couplingLabel(protocol.couplingType)} · {statusLabel(protocol.status)}</span>
              {protocol.status !== "active" ? <button type="button" disabled={saving} onClick={() => activate(protocol.id)} className="border border-[var(--acid)]/40 px-2 py-1 text-xs text-[var(--acid)]">启用</button> : null}
            </div>
            <p className="mt-2 text-xs leading-5 text-white/45">{protocol.semanticProtocol.meaning}</p>
          </div>
        ))}
      </div>
      <details className="mt-3 border border-white/10 p-3">
        <summary className="cursor-pointer text-sm font-bold text-white/65">新增接口协议版本</summary>
        <form action={submit} className="mt-4 grid gap-3">
          <select name="couplingType" className="field"><option value="feedback">回灌咬合</option><option value="soft">软咬合</option><option value="hard">硬咬合</option></select>
          <input name="meaning" className="field" placeholder="语义：这个接口对象代表什么" />
          <input name="consumptionRule" className="field" placeholder="消费规则：下游如何使用" />
          <input name="dataObject" className="field" placeholder="数据对象，例如 commitment_record" />
          <textarea name="requiredFields" className="field min-h-16" placeholder="必填字段，一行一个" />
          <textarea name="optionalFields" className="field min-h-12" placeholder="可选字段，一行一个" />
          <input name="version" className="field" placeholder="结构版本，例如 1.0.0" />
          <input name="sourceOfTruth" className="field" placeholder="事实源" />
          <input name="ownerRole" className="field" placeholder="负责角色" />
          <input name="acceptanceRole" className="field" placeholder="验收角色" />
          <input name="failureReturnPath" className="field" placeholder="异常回传路径" />
          <input name="changeNotice" className="field" placeholder="变更通知规则" />
          <input name="emergencyRule" className="field" placeholder="紧急处理规则" />
          <input name="changeReason" className="field" placeholder="变更理由" />
          <button disabled={saving} className="inline-flex items-center justify-center gap-2 border border-[var(--cyan)] px-3 py-2 text-sm text-[var(--cyan)] disabled:opacity-40">
            {saving ? <LoaderCircle className="animate-spin" size={14} /> : <PlugZap size={14} />} 创建协议
          </button>
        </form>
      </details>
      {error ? <p className="mt-3 text-sm text-orange-200">{error}</p> : null}
    </div>
  );
}

function splitLines(value: string) {
  return value.split(/\n|,|，|、/).map((item) => item.trim()).filter(Boolean);
}

function couplingLabel(value: string) {
  if (value === "hard") return "硬咬合";
  if (value === "soft") return "软咬合";
  return "回灌咬合";
}

function statusLabel(value: string) {
  if (value === "active") return "已生效";
  if (value === "deprecated") return "已废弃";
  return "草稿";
}
