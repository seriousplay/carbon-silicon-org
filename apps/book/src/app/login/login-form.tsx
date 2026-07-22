"use client";

import { useState } from "react";
import { ArrowRight, MailCheck } from "lucide-react";
import { signIn } from "next-auth/react";

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await signIn("email", {
        email: email.trim(),
        redirect: false,
        callbackUrl: nextPath ? `/book${nextPath}` : "/book/dashboard",
      });

      if (result?.error) {
        setError(result.error);
      } else if (result?.ok) {
        setSent(true);
      }
    } catch {
      setError("发送登录邮件失败，请稍后再试。");
    } finally {
      setSubmitting(false);
    }
  }

  if (sent) {
    return (
      <div className="mt-8 rounded-3xl border border-emerald-200/15 bg-white/[0.045] p-6">
        <MailCheck className="h-9 w-9 text-emerald-300" />
        <h2 className="mt-4 text-2xl font-black text-white">
          登录邮件已发送
        </h2>
        <p className="mt-2 text-sm leading-7 text-emerald-50/62">
          请打开邮箱中的登录链接，回到本站后即可继续使用。
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-8 grid gap-4">
      <label className="grid gap-2">
        <span className="text-sm font-bold text-emerald-100/80">邮箱</span>
        <input
          className="input"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="name@company.com"
          required
        />
      </label>
      {error ? (
        <div className="rounded-2xl border border-red-300/25 bg-red-500/10 p-4 text-sm text-red-100">
          {error}
        </div>
      ) : null}
      <button
        disabled={submitting}
        className="inline-flex items-center justify-center rounded-full bg-emerald-300 px-6 py-3 text-sm font-black text-[#06110f] transition hover:bg-emerald-200 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting ? "发送中..." : "发送登录邮件"}
        <ArrowRight className="ml-2 h-4 w-4" />
      </button>
    </form>
  );
}
