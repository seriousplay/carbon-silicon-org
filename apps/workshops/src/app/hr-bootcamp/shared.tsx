"use client";

import { useState } from "react";
import { ThumbsUp, Lightbulb, ChevronDown, ChevronUp } from "lucide-react";

// ─── Typography & Layout ──────────────────────────────

export function LearnBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-emerald-200/10 bg-white/[0.015] p-6 sm:p-7">
      <div className="mb-4 flex items-center gap-2.5">
        <div className="h-[3px] w-5 rounded-full bg-emerald-400/60" />
        <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-300/80">{title}</h3>
      </div>
      <div className="text-base leading-8 text-emerald-100/75">{children}</div>
    </section>
  );
}

export function InfoBox({ children, variant = "emerald" }: { children: React.ReactNode; variant?: "emerald" | "amber" | "rose" }) {
  const styles = {
    emerald: "border-emerald-300/20 bg-emerald-300/[0.05] text-emerald-100/85",
    amber: "border-amber-300/20 bg-amber-300/[0.05] text-amber-100/85",
    rose: "border-rose-300/20 bg-rose-300/[0.05] text-rose-100/85",
  };
  return <div className={`rounded-2xl border p-5 text-base leading-8 ${styles[variant]}`}>{children}</div>;
}

export function StepTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-emerald-200/10">
      <table className="w-full text-base">
        <thead>
          <tr className="border-b border-emerald-200/10 bg-emerald-200/[0.03]">
            {headers.map(h => <th key={h} className="px-5 py-3.5 text-left text-sm font-bold text-emerald-200">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-emerald-200/5 last:border-0">
              {row.map((cell, j) => <td key={j} className="px-5 py-3.5 text-emerald-100/70">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CompareCard({ bad, good }: { bad: { label: string; text: string }; good: { label: string; text: string } }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-2xl border border-rose-300/10 bg-rose-300/[0.03] p-5">
        <div className="mb-2 text-sm font-bold text-rose-300/70">❌ {bad.label}</div>
        <p className="text-base leading-8 text-rose-100/60">{bad.text}</p>
      </div>
      <div className="rounded-2xl border border-emerald-300/10 bg-emerald-300/[0.04] p-5">
        <div className="mb-2 text-sm font-bold text-emerald-300/70">✅ {good.label}</div>
        <p className="text-base leading-8 text-emerald-100/75">{good.text}</p>
      </div>
    </div>
  );
}

export function FlowDiagram({ steps }: { steps: { icon: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {steps.map((s, i) => (
        <span key={i} className="flex items-center gap-2">
          <span className="rounded-full bg-emerald-300/10 px-3 py-1.5 text-emerald-200">{s.icon} {s.label}</span>
          {i < steps.length - 1 && <span className="text-emerald-100/25">→</span>}
        </span>
      ))}
    </div>
  );
}

// ─── Gamification: Vote Bar ────────────────────────────

export function VoteBar({ module }: { module: string }) {
  const [voted, setVoted] = useState<"got" | "need" | null>(null);

  return (
    <div className="mt-8 rounded-2xl border border-emerald-200/10 bg-white/[0.02] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-emerald-300" />
        <span className="text-base font-bold text-emerald-100">这个概念你理解了吗？</span>
      </div>
      {voted ? (
        <div className="rounded-xl bg-emerald-300/[0.06] border border-emerald-300/10 p-4 text-base text-emerald-100/70">
          {voted === "got"
            ? "👍 你已标记为「理解了」。试着把学到的用到实际工作中。"
            : "💡 你已标记为「还需练习」。建议重新看一遍概念理解部分，或复习实践练习。"}
        </div>
      ) : (
        <div className="flex gap-3">
          <button onClick={() => setVoted("got")} className="flex-1 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] py-3 text-base font-bold text-emerald-200 transition hover:bg-emerald-300/15 hover:scale-[1.02] active:scale-95">
            <ThumbsUp className="mr-2 inline h-4 w-4" /> 理解了
          </button>
          <button onClick={() => setVoted("need")} className="flex-1 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] py-3 text-base font-bold text-amber-200 transition hover:bg-amber-300/15 hover:scale-[1.02] active:scale-95">
            <Lightbulb className="mr-2 inline h-4 w-4" /> 还需练习
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Gamification: Peer Answers ───────────────────────

export function PeerAnswers({ answers }: { answers: { author: string; role: string; text: string; likes: number }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-4 rounded-2xl border border-emerald-200/8 bg-white/[0.01] p-5">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between text-left">
        <span className="text-base font-bold text-emerald-200">👥 查看其他同学的答案 ({answers.length})</span>
        {open ? <ChevronUp className="h-5 w-5 text-emerald-300" /> : <ChevronDown className="h-5 w-5 text-emerald-300" />}
      </button>
      {open && (
        <div className="mt-4 space-y-3">
          {answers.map((a, i) => (
            <div key={i} className="rounded-xl border border-emerald-200/8 bg-white/[0.02] p-4">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-300/10 text-sm font-bold text-emerald-300">
                  {a.author.charAt(0)}
                </div>
                <div>
                  <div className="text-sm font-bold text-emerald-100">{a.author}</div>
                  <div className="text-xs text-emerald-100/35">{a.role}</div>
                </div>
                <span className="ml-auto flex items-center gap-1 text-xs text-emerald-300/60">
                  <ThumbsUp className="h-3 w-3" /> {a.likes}
                </span>
              </div>
              <p className="text-base leading-8 text-emerald-100/65">{a.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Gamification: Practice Input ─────────────────────

export function PracticeInput({ placeholder, lines = 3 }: { placeholder: string; lines?: number }) {
  const [value, setValue] = useState("");
  const [submitted, setSubmitted] = useState(false);
  return (
    <div>
      <textarea
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={placeholder}
        rows={lines}
        className="w-full rounded-xl border border-emerald-200/15 bg-black/20 p-4 text-base leading-8 text-emerald-100 outline-none transition focus:border-emerald-300/40 focus:bg-black/30"
      />
      <button
        onClick={() => value.trim() && setSubmitted(true)}
        className="mt-2 rounded-full bg-emerald-300/20 px-5 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-300/30 disabled:opacity-30"
        disabled={!value.trim()}
      >
        {submitted ? "✅ 已提交 +10分" : "提交答案"}
      </button>
    </div>
  );
}

// ─── Module Wrapper ───────────────────────────────────

export function ModulePage({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <h2 className="text-3xl font-black tracking-tight text-white">{title}</h2>
      <p className="mt-3 text-lg leading-8 text-emerald-100/55">{subtitle}</p>
      <div className="mt-8 space-y-6">{children}</div>
    </div>
  );
}
