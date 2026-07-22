"use client";

import { useState } from "react";
import { flushSync } from "react-dom";

export function PreworkLoginForm({ error }: { error?: string }) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  return (
    <form
      action="/loop-designer/api/prework/624/login"
      method="post"
      className="panel space-y-5 p-6 md:p-7"
      onSubmit={() => flushSync(() => setIsSubmitting(true))}
    >
      <div>
        <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">QUESTIONNAIRE LOGIN</div>
        <h2 className="mt-3 text-2xl font-black">课前问卷入口</h2>
      </div>
      {error ? <div className="border border-[var(--signal)]/40 bg-[var(--signal)]/10 p-3 text-sm text-orange-100">{error}</div> : null}
      <input type="hidden" name="accessCode" value="CSI2026SZ" />
      <label className="block">
        <span className="mono text-[10px] tracking-[.16em] text-white/38">真实手机号</span>
        <input
          name="phone"
          type="tel"
          required
          inputMode="tel"
          placeholder="请输入您的手机号"
          className="field mt-2 w-full font-mono"
          readOnly={isSubmitting}
          aria-disabled={isSubmitting}
        />
      </label>
      <button
        type="submit"
        disabled={isSubmitting}
        className="flex w-full items-center justify-center gap-2 bg-[var(--acid)] py-3 font-bold text-black transition disabled:cursor-wait disabled:opacity-80"
      >
        {isSubmitting ? (
          <>
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-black/25 border-t-black" aria-hidden="true" />
            正在进入问卷...
          </>
        ) : (
          "进入问卷"
        )}
      </button>
      {isSubmitting ? <p className="text-center text-xs text-white/45">正在为您加载专属问卷，请不要重复点击。</p> : null}
    </form>
  );
}
