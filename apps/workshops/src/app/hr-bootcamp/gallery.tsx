"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw, Send, Trophy, Star } from "lucide-react";
import { ModulePage, LearnBlock } from "./shared";

type Project = {
  id: string; authorName: string; authorRole: string | null;
  title: string; description: string; url: string | null;
  createdAt: string; voteCount: number; avgScore: number;
};

export function Gallery({ userName }: { userName: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [authorName] = useState(userName);
  const [authorRole, setAuthorRole] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try { const res = await fetch("/workshops/api/hr-bootcamp/projects"); if (res.ok) setProjects(await res.json()); } catch {}
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const submitProject = async () => {
    if (!title || !description) return;
    setSubmitting(true);
    try {
      await fetch("/workshops/api/hr-bootcamp/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName: authorName || "匿名", authorRole, title, description, url }),
      });
      setShowForm(false); setTitle(""); setDescription(""); setUrl(""); setAuthorRole(""); fetchProjects();
    } catch {}
    setSubmitting(false);
  };

  const vote = async (projectId: string, score: number) => {
    if (!userName) return alert("请先在顶部设置你的名字");
    try {
      await fetch(`/workshops/api/hr-bootcamp/projects/${projectId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterName: userName, score }),
      });
      fetchProjects();
    } catch {}
  };

  const top3 = [...projects].sort((a, b) => b.avgScore * b.voteCount - a.avgScore * a.voteCount).slice(0, 3);

  return (
    <div className="mx-auto max-w-2xl px-5 py-10 sm:px-8 sm:py-14">
      <h2 className="text-3xl font-black tracking-tight text-white">🏆 项目展示厅</h2>
      <p className="mt-3 text-lg leading-8 text-emerald-100/55">
        每位学员的实战项目都在这里。为喜欢的项目打星，帮助优秀作品脱颖而出。
      </p>
      <div className="mt-3 rounded-2xl border border-amber-300/20 bg-amber-300/[0.05] p-4 text-base text-amber-100/80">
        <strong className="text-amber-300">🏅 排行榜阶梯积分：</strong>🥇第1名+120分 · 🥈第2名+100分 · 🥉第3名+80分
      </div>

      {/* Leaderboard */}
      {top3.length > 0 && (
        <div className="mt-6 grid grid-cols-3 gap-3">
          {top3.map((p, i) => (
            <div key={p.id} className={`rounded-2xl border p-4 text-center ${i === 0 ? "border-amber-300/30 bg-amber-300/[0.06]" : i === 1 ? "border-slate-300/20 bg-slate-300/[0.03]" : "border-orange-300/15 bg-orange-300/[0.03]"}`}>
              <div className="text-2xl">{["🥇","🥈","🥉"][i]}</div>
              <div className="mt-1 text-sm font-bold text-emerald-100 truncate">{p.title}</div>
              <div className="text-xs text-emerald-100/40">{p.authorName} · ⭐{p.avgScore} ({p.voteCount}票)</div>
            </div>
          ))}
        </div>
      )}

      {/* Submit */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)}
          className="mt-6 w-full rounded-2xl border-2 border-dashed border-emerald-200/20 bg-white/[0.01] p-8 text-center transition hover:border-emerald-300/30 hover:bg-white/[0.03]">
          <span className="text-3xl">📤</span>
          <div className="mt-3 text-lg font-bold text-emerald-200">提交我的项目 +120分</div>
          <div className="mt-1 text-base text-emerald-100/40">完成实战项目后，在这里分享你的作品</div>
        </button>
      ) : (
        <div className="mt-6 rounded-2xl border border-emerald-300/20 bg-white/[0.02] p-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-xl border border-emerald-200/15 bg-black/20 px-4 py-2.5 text-base text-emerald-100 outline-none focus:border-emerald-300/40" placeholder={`你的名字：${authorName || "请设置"}`} value={authorName} disabled />
            <input className="rounded-xl border border-emerald-200/15 bg-black/20 px-4 py-2.5 text-base text-emerald-100 outline-none focus:border-emerald-300/40" placeholder="你的职位（选填）" value={authorRole} onChange={e => setAuthorRole(e.target.value)} />
          </div>
          <input className="w-full rounded-xl border border-emerald-200/15 bg-black/20 px-4 py-2.5 text-base text-emerald-100 outline-none focus:border-emerald-300/40" placeholder="项目名称 *" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className="w-full rounded-xl border border-emerald-200/15 bg-black/20 px-4 py-3 text-base text-emerald-100 outline-none focus:border-emerald-300/40" rows={3} placeholder="项目描述：什么问题？什么工具？效果如何？*" value={description} onChange={e => setDescription(e.target.value)} />
          <input className="w-full rounded-xl border border-emerald-200/15 bg-black/20 px-4 py-2.5 text-base text-emerald-100 outline-none focus:border-emerald-300/40" placeholder="项目链接（选填）" value={url} onChange={e => setUrl(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={submitProject} disabled={submitting || !title || !description}
              className="flex items-center gap-2 rounded-full bg-emerald-300 px-6 py-2.5 text-sm font-black text-[#07110f] transition hover:scale-105 disabled:opacity-40">
              <Send className="h-4 w-4" /> {submitting ? "提交中..." : "提交 +120分"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-full border border-emerald-200/20 px-5 py-2.5 text-sm text-emerald-100/50">取消</button>
          </div>
        </div>
      )}

      {/* Project Cards */}
      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="py-8 text-center text-emerald-100/30">加载中...</div>
        ) : projects.length === 0 ? (
          <div className="py-8 text-center text-emerald-100/30">还没有人提交项目。成为第一个！</div>
        ) : (
          projects.map(p => (
            <div key={p.id} className="rounded-2xl border border-emerald-200/10 bg-white/[0.02] p-5 transition hover:border-emerald-200/25">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-base font-bold text-emerald-100">{p.title}</span>
                    {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-300/60 underline hover:text-emerald-200">🔗</a>}
                  </div>
                  <p className="text-base leading-7 text-emerald-100/50 mb-2">{p.description}</p>
                  <div className="flex items-center gap-3 text-sm text-emerald-100/35">
                    <span>{p.authorName}</span>
                    {p.authorRole && <span>· {p.authorRole}</span>}
                    <span>· {new Date(p.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => vote(p.id, s)}
                        className={`text-xl transition hover:scale-125 ${s <= Math.round(p.avgScore) ? "text-amber-300" : "text-emerald-100/15 hover:text-amber-300/50"}`}
                        title={`${s}星`}>★</button>
                    ))}
                  </div>
                  <span className="text-sm text-emerald-100/30">⭐{p.avgScore} ({p.voteCount})</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
      <button onClick={fetchProjects} className="mt-4 flex items-center gap-1 text-sm text-emerald-100/30 hover:text-emerald-200 transition">
        <RefreshCw className="h-4 w-4" /> 刷新
      </button>
    </div>
  );
}
