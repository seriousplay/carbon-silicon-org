"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoopDesignerLogo } from "@/components/loop-designer-logo";

export default function LoginClient() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/loop-designer";
  const publicNext = toPublicPath(next);
  const eventLoginAction = `/loop-designer/api/auth/event/quick-login?next=${encodeURIComponent(publicNext)}`;

  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== passwordConfirm) {
      setError("两次输入的密码不一致");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/loop-designer/api/auth/event/quick-login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, password, passwordConfirm }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "操作失败");
        return;
      }

      window.location.assign(publicNext);
    } catch {
      setError("网络连接失败");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <LoopDesignerLogo className="mx-auto mb-4 h-16 w-16" />
          <div className="mono text-[10px] tracking-[.25em] text-white/42">CARBON SILICON ORG STUDIO</div>
          <h1 className="mt-3 text-3xl font-black">碳硅组织设计工作室</h1>
        </div>

        <form action={eventLoginAction} method="post" onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="rounded border border-[var(--signal)]/50 bg-[var(--signal)]/10 p-3 text-sm text-orange-100">{error}</div>}

          <div>
            <label className="mb-1 block text-xs text-white/55">手机号</label>
            <input name="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value.trim())} className="field w-full font-mono" placeholder="用于登录碳硅组织设计工作室的唯一标识" required />
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/55">登录密码</label>
            <input name="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="field w-full" placeholder="首次登录将设置密码，之后用手机号和密码登录" required minLength={8} />
            <p className="mt-2 text-xs leading-5 text-white/38">至少 8 位，并包含字母和数字。</p>
          </div>
          <div>
            <label className="mb-1 block text-xs text-white/55">确认密码</label>
            <input name="passwordConfirm" type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} className="field w-full" placeholder="再次输入密码，避免首次设置错误" required minLength={8} />
          </div>

          <button type="submit" disabled={loading} className="w-full bg-[var(--acid)] py-3 font-bold text-black disabled:opacity-50">
            {loading ? "处理中..." : "进入设计工作室"}
          </button>
        </form>
      </div>
    </main>
  );
}

function toPublicPath(value: string) {
  if (value === "/loop-designer" || value.startsWith("/loop-designer/")) return value;
  if (value.startsWith("/")) return `/loop-designer${value === "/" ? "" : value}`;
  return "/loop-designer";
}
