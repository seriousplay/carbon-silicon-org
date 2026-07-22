"use client";

import { useState } from "react";
import { Check, Pencil, X } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import type { UserProfile } from "@/lib/user-profile";

export function ProfileCard({ profile }: { profile: UserProfile }) {
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPasswordConfirm, setNewPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (newPassword && newPassword !== newPasswordConfirm) {
      setError("两次输入的新密码不一致");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/loop-designer/api/user/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          displayName,
          companyName,
          currentPassword: currentPassword || undefined,
          newPassword: newPassword || undefined,
          newPasswordConfirm: newPasswordConfirm || undefined,
        }),
      });
      const payload = await readApiResponse<{ profile?: UserProfile }>(response, "资料保存失败");
      if (!response.ok || !payload.profile) return setError(payload.error || "资料保存失败");
      setDisplayName(payload.profile.displayName);
      setCompanyName(payload.profile.companyName);
      setCurrentPassword("");
      setNewPassword("");
      setNewPasswordConfirm("");
      setEditing(false);
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="border border-white/10 bg-black/20 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">PROFILE</div>
          <h2 className="mt-3 text-2xl font-black">{displayName || "未填写用户名"}</h2>
          <p className="mt-2 text-sm text-white/50">{companyName || "未填写企业名称"}</p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/55 hover:border-[var(--cyan)] hover:text-[var(--cyan)]">
            <Pencil size={13} /> 修改
          </button>
        ) : null}
      </div>
      {editing ? (
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <label>
            <span className="mono text-[10px] tracking-[.16em] text-white/38">用户名</span>
            <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="field mt-2" />
          </label>
          <label>
            <span className="mono text-[10px] tracking-[.16em] text-white/38">公司信息</span>
            <input value={companyName} onChange={(event) => setCompanyName(event.target.value)} className="field mt-2" />
          </label>
          <label>
            <span className="mono text-[10px] tracking-[.16em] text-white/38">当前密码</span>
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} className="field mt-2" placeholder="修改密码时填写" />
          </label>
          <label>
            <span className="mono text-[10px] tracking-[.16em] text-white/38">新密码</span>
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} className="field mt-2" placeholder="至少 8 位，包含字母和数字" />
          </label>
          <label>
            <span className="mono text-[10px] tracking-[.16em] text-white/38">确认新密码</span>
            <input type="password" value={newPasswordConfirm} onChange={(event) => setNewPasswordConfirm(event.target.value)} className="field mt-2" placeholder="再次输入新密码" />
          </label>
          <div className="flex gap-2 md:col-span-2">
            <button disabled={busy} onClick={save} className="inline-flex items-center gap-2 bg-[var(--acid)] px-4 py-2 text-sm font-bold text-black disabled:opacity-40">
              <Check size={15} /> 保存
            </button>
            <button disabled={busy} onClick={() => setEditing(false)} className="inline-flex items-center gap-2 border border-white/15 px-4 py-2 text-sm text-white/55 disabled:opacity-40">
              <X size={15} /> 取消
            </button>
          </div>
        </div>
      ) : null}
      {error ? <p className="mt-3 text-sm text-orange-200">{error}</p> : null}
    </section>
  );
}
