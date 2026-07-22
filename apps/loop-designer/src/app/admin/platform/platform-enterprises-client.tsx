"use client";

import { useState } from "react";

type PlatformEnterprise = {
  id: string;
  tenantKey: string;
  companyName: string;
  subscriptionTier: string;
  seatLimit: number;
  usedSeats: number;
  isActive: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  authSource: string | null;
  createdAt: string;
};

export function PlatformEnterprisesClient({ initialEnterprises }: { initialEnterprises: PlatformEnterprise[] }) {
  const [enterprises, setEnterprises] = useState<PlatformEnterprise[]>(initialEnterprises);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadEnterprises() {
    setError(null);
    try {
      const response = await fetch("/loop-designer/api/platform/enterprises", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "获取租户列表失败");
      }
      setEnterprises(payload.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "获取租户列表失败");
    }
  }

  async function setAccess(enterprise: PlatformEnterprise, isActive: boolean) {
    const label = isActive ? "恢复" : "关闭";
    if (!window.confirm(`确认${label}「${enterprise.companyName}」的访问权限？`)) return;
    setSavingId(enterprise.id);
    try {
      const response = await fetch("/loop-designer/api/platform/enterprises", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enterpriseId: enterprise.id, isActive }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "更新租户访问失败");
      }
      await loadEnterprises();
    } catch (err) {
      alert(err instanceof Error ? err.message : "更新租户访问失败");
    } finally {
      setSavingId(null);
    }
  }

  if (error) return <div className="text-red-400">{error}</div>;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-3">
        <Summary label="总租户" value={enterprises.length} />
        <Summary label="可访问" value={enterprises.filter((item) => item.isActive).length} />
        <Summary label="已关闭" value={enterprises.filter((item) => !item.isActive).length} />
      </div>

      <div className="overflow-hidden border border-white/10 bg-black/20">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase tracking-[.18em] text-white/42">
            <tr>
              <th className="px-4 py-3">企业</th>
              <th className="px-4 py-3">Tenant Key</th>
              <th className="px-4 py-3">席位</th>
              <th className="px-4 py-3">状态</th>
              <th className="px-4 py-3">创建时间</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/8">
            {enterprises.map((enterprise) => (
              <tr key={enterprise.id} className="text-white/70">
                <td className="px-4 py-4">
                  <div className="font-bold text-white">{enterprise.companyName}</div>
                  <div className="mt-1 flex flex-wrap gap-2 text-xs text-white/40">
                    <span>{enterprise.subscriptionTier}</span>
                    {enterprise.authSource === "event_quick_login" && (
                      <span className="text-[var(--acid)]">手机号登录</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-4 font-mono text-xs text-white/45">{enterprise.tenantKey}</td>
                <td className="px-4 py-4">
                  {enterprise.usedSeats} / {enterprise.seatLimit >= 999 ? "∞" : enterprise.seatLimit}
                </td>
                <td className="px-4 py-4">
                  <span className={enterprise.isActive ? "text-[var(--acid)]" : "text-red-400"}>
                    {enterprise.isActive ? "可访问" : "已关闭"}
                  </span>
                </td>
                <td className="px-4 py-4 text-white/45">
                  {new Date(enterprise.createdAt).toLocaleString("zh-CN")}
                </td>
                <td className="px-4 py-4 text-right">
                  {enterprise.isActive ? (
                    <button
                      disabled={savingId === enterprise.id}
                      onClick={() => void setAccess(enterprise, false)}
                      className="border border-red-400/40 px-3 py-2 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-40"
                    >
                      关闭访问
                    </button>
                  ) : (
                    <button
                      disabled={savingId === enterprise.id}
                      onClick={() => void setAccess(enterprise, true)}
                      className="border border-[var(--acid)]/40 px-3 py-2 text-xs text-[var(--acid)] hover:bg-white/10 disabled:opacity-40"
                    >
                      恢复访问
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-white/10 bg-white/5 p-5">
      <div className="mono text-[10px] tracking-[.18em] text-white/40">{label}</div>
      <div className="mt-3 text-3xl font-black">{value}</div>
    </div>
  );
}
