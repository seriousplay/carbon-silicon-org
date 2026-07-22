"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

type Mode = "create" | "join";

export function OnboardingForm({ email }: { email: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("create");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState("");
  const [organizationName, setOrganizationName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!displayName.trim() || (mode === "create" && !organizationName.trim()) || (mode === "join" && !inviteCode.trim())) {
      setError("请补充必填信息。");
      return;
    }

    setSubmitting(true);
    const response = await fetch("/api/onboarding", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode,
        displayName: displayName.trim(),
        role: role.trim() || undefined,
        organizationName: organizationName.trim() || undefined,
        inviteCode: inviteCode.trim() || undefined,
      }),
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; reason?: string } | null;
    setSubmitting(false);

    if (!response.ok || !payload?.ok) {
      setError(payload?.reason ?? "设置失败，请稍后重试。");
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-6">
      <div className="grid gap-3 rounded-3xl border border-emerald-200/10 bg-black/18 p-2 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => setMode("create")}
          className={`rounded-2xl px-4 py-3 text-sm font-black transition ${mode === "create" ? "bg-emerald-300 text-[#06110f]" : "text-emerald-50/70 hover:bg-white/10"}`}
        >
          创建组织
        </button>
        <button
          type="button"
          onClick={() => setMode("join")}
          className={`rounded-2xl px-4 py-3 text-sm font-black transition ${mode === "join" ? "bg-emerald-300 text-[#06110f]" : "text-emerald-50/70 hover:bg-white/10"}`}
        >
          加入组织
        </button>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="登录邮箱">
          <input className="input" value={email} readOnly />
        </Field>
        <Field label="姓名/称呼">
          <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="例如：李明" />
        </Field>
      </div>

      <Field label="角色">
        <input className="input" value={role} onChange={(event) => setRole(event.target.value)} placeholder="例如：HRD / OD / 外部顾问 / 团队教练" />
      </Field>

      {mode === "create" ? (
        <Field label="组织名称">
          <input className="input" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="例如：某某科技有限公司" />
        </Field>
      ) : (
        <Field label="组织邀请码">
          <input className="input uppercase" value={inviteCode} onChange={(event) => setInviteCode(event.target.value.toUpperCase())} placeholder="请输入组织管理员提供的邀请码" />
        </Field>
      )}

      <div className="rounded-2xl border border-emerald-200/10 bg-white/[0.035] p-4 text-sm leading-7 text-emerald-50/62">
        组织管理员默认可查看组织空间内的成员明细、工具记录和测评报告，用于企业复盘、诊断汇总和后续行动追踪。
      </div>

      {error ? <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm text-red-100">{error}</div> : null}

      <button
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-full bg-emerald-300 px-6 py-3 text-sm font-black text-[#06110f] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "保存中..." : "进入工作台"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-2">
      <span className="text-sm font-bold text-emerald-100/80">{label}</span>
      {children}
    </label>
  );
}
