"use client";

import { useState, useEffect, useCallback } from "react";
import { CheckCircle2, Star, RefreshCw, Trophy, Send } from "lucide-react";
import { LearnBlock, StepTable, FlowDiagram, PracticeInput, ModulePage, InfoBox } from "./shared";

type Project = {
  id: string; authorName: string; authorRole: string | null;
  title: string; description: string; url: string | null;
  createdAt: string; voteCount: number; avgScore: number;
};

export function ProjectModule({ completed, onToggleComplete, onNext, onPrev }: {
  completed: boolean; onToggleComplete: () => void; onNext: () => void; onPrev: () => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Submission form state
  const [authorName, setAuthorName] = useState("");
  const [authorRole, setAuthorRole] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [url, setUrl] = useState("");

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/workshops/api/hr-bootcamp/projects");
      if (res.ok) setProjects(await res.json());
    } catch { /* offline */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const submitProject = async () => {
    if (!authorName || !title || !description) return;
    setSubmitting(true);
    try {
      const res = await fetch("/workshops/api/hr-bootcamp/projects", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authorName, authorRole, title, description, url }),
      });
      if (res.ok) { setShowForm(false); fetchProjects(); onToggleComplete(); }
    } catch {}
    setSubmitting(false);
  };

  const vote = async (projectId: string, score: number) => {
    const voterName = prompt("你的名字？（投票需要署名）");
    if (!voterName) return;
    try {
      await fetch(`/workshops/api/hr-bootcamp/projects/${projectId}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterName, score }),
      });
      fetchProjects();
    } catch {}
  };

  const top3 = [...projects].sort((a, b) => b.avgScore * b.voteCount - a.avgScore * a.voteCount).slice(0, 3);

  return <ModulePage title="🚀 实战项目" subtitle="整合提示词、智能体、Skill、知识库——打造你的第一个AI自动化工作流。">
    <InfoBox>
      <strong className="text-emerald-200">从学到用，一步跨越。</strong>这个实战项目让你把前面6个模块学到的所有能力整合成一个<strong className="text-emerald-300">真实可用的AI自动化工作流</strong>。完成后提交你的项目，让其他同学打分。排行榜前三名将获得加权积分。
    </InfoBox>

    <LearnBlock title="第一步：多轮对话，澄清意图">
      <p className="mb-4">选择一个<strong className="text-emerald-200">真实HR痛点</strong>，通过和AI多轮对话，澄清你的想法，最终输出一份<strong className="text-amber-300">产品设计和规范文档</strong>。</p>
      <div className="space-y-3">
        <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
          <div className="text-base font-bold text-emerald-200 mb-2">📋 操作步骤</div>
          <div className="space-y-2 text-base text-emerald-100/70">
            <p><strong>1.1</strong> 打开 DeepSeek 或 Claude，开启一个新对话。先告诉AI你的身份和背景。</p>
            <p><strong>1.2</strong> 进行3-5轮对话，逐步澄清：用户是谁？核心功能是什么？输入输出？边界条件？</p>
            <p><strong>1.3</strong> 最后让AI输出一份结构化的<strong>产品设计规范</strong>（PRD），包含产品目标、目标用户、核心功能、用户流程、技术要求。</p>
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-xl bg-emerald-300/[0.04] border border-emerald-300/10 p-4 text-sm text-emerald-100/60">
        <strong className="text-emerald-300">💡 整合Skill和知识库：</strong>对话过程中加载你之前创建的Skill和知识库，让AI在理解你业务上下文的基础上帮你设计。
      </div>
    </LearnBlock>

    <LearnBlock title="第二步：AI制定开发计划">
      <p className="mb-4">将PRD文档输入给 AI 编程工具（Zcode / Codex），制定详细的开发计划。</p>
      <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
        <div className="space-y-2 text-base text-emerald-100/70">
          <p><strong>2.1</strong> 打开 <a href="https://zcode.ai" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">Zcode ↗</a> 或 <a href="https://codex.ai" target="_blank" rel="noopener noreferrer" className="text-emerald-300 underline hover:text-emerald-200">Codex ↗</a></p>
          <p><strong>2.2</strong> 将PRD文档复制粘贴或上传</p>
          <p><strong>2.3</strong> 输入指令让AI制定完整开发计划，审核确认</p>
        </div>
      </div>
    </LearnBlock>

    <LearnBlock title="第三步：Vibe Coding">
      <p className="mb-4">使用 Zcode/Codex/Kimicode 按开发计划逐任务执行，AI自动生成代码。</p>
      <div className="rounded-xl bg-purple-300/[0.04] border border-purple-300/10 p-4 text-sm text-purple-100/60">
        <strong className="text-purple-300">🪄 关键心态：</strong>你是产品经理，AI是你的全栈工程师。描述你想要的效果，AI自己实现。
      </div>
    </LearnBlock>

    <LearnBlock title="第四步：测试与部署">
      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-3">
          <div className="font-bold text-emerald-200 mb-1">🧪 测试</div>
          <p className="text-emerald-100/50">预览→用真实数据测试→告诉AI修复→迭代2-3轮</p>
        </div>
        <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-3">
          <div className="font-bold text-amber-200 mb-1">🚀 部署</div>
          <p className="text-amber-100/50">问AI如何部署→跟随指引→获取公开URL</p>
        </div>
      </div>
    </LearnBlock>

    {/* ─── Peer Gallery & Scoring ─── */}
    <LearnBlock title="🏆 项目展示厅 · 同侪评分">
      <p className="mb-4 text-emerald-100/60">完成项目后，提交到展示厅。每个人可以对他人项目打分（1-5星）。<strong className="text-emerald-300">排行榜前三名将获得加权积分</strong>：🥇第1名+60分，🥈第2名+40分，🥉第3名+20分。</p>

      {/* Leaderboard */}
      {top3.length > 0 && (
        <div className="mb-5 grid grid-cols-3 gap-3">
          {top3.map((p, i) => (
            <div key={p.id} className={`rounded-2xl border p-4 text-center ${i === 0 ? "border-amber-300/30 bg-amber-300/[0.06]" : i === 1 ? "border-slate-300/20 bg-slate-300/[0.03]" : "border-orange-300/15 bg-orange-300/[0.03]"}`}>
              <div className="text-2xl">{["🥇","🥈","🥉"][i]}</div>
              <div className="mt-1 text-sm font-bold text-emerald-100 truncate">{p.title}</div>
              <div className="text-xs text-emerald-100/40">{p.authorName} · ⭐{p.avgScore} ({p.voteCount}票)</div>
            </div>
          ))}
        </div>
      )}

      {/* Submission Form */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} className="w-full rounded-xl border-2 border-dashed border-emerald-200/20 bg-white/[0.01] p-6 text-center transition hover:border-emerald-300/30 hover:bg-white/[0.03]">
          <span className="text-2xl">📤</span>
          <div className="mt-2 text-base font-bold text-emerald-200">提交我的项目</div>
          <div className="text-sm text-emerald-100/40">完成后点击这里分享你的作品</div>
        </button>
      ) : (
        <div className="rounded-2xl border border-emerald-300/20 bg-white/[0.02] p-5 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="rounded-xl border border-emerald-200/15 bg-black/20 px-4 py-2.5 text-base text-emerald-100 outline-none focus:border-emerald-300/40" placeholder="你的名字 *" value={authorName} onChange={e => setAuthorName(e.target.value)} />
            <input className="rounded-xl border border-emerald-200/15 bg-black/20 px-4 py-2.5 text-base text-emerald-100 outline-none focus:border-emerald-300/40" placeholder="你的职位（选填）" value={authorRole} onChange={e => setAuthorRole(e.target.value)} />
          </div>
          <input className="w-full rounded-xl border border-emerald-200/15 bg-black/20 px-4 py-2.5 text-base text-emerald-100 outline-none focus:border-emerald-300/40" placeholder="项目名称 *" value={title} onChange={e => setTitle(e.target.value)} />
          <textarea className="w-full rounded-xl border border-emerald-200/15 bg-black/20 px-4 py-3 text-base text-emerald-100 outline-none focus:border-emerald-300/40" rows={3} placeholder="项目描述：解决了什么问题？用了什么工具？效果如何？*" value={description} onChange={e => setDescription(e.target.value)} />
          <input className="w-full rounded-xl border border-emerald-200/15 bg-black/20 px-4 py-2.5 text-base text-emerald-100 outline-none focus:border-emerald-300/40" placeholder="项目链接（选填）" value={url} onChange={e => setUrl(e.target.value)} />
          <div className="flex gap-2">
            <button onClick={submitProject} disabled={submitting || !authorName || !title || !description}
              className="flex items-center gap-2 rounded-full bg-emerald-300 px-6 py-2.5 text-sm font-black text-[#07110f] transition hover:scale-105 disabled:opacity-40">
              <Send className="h-4 w-4" /> {submitting ? "提交中..." : "提交并分享 +40分"}
            </button>
            <button onClick={() => setShowForm(false)} className="rounded-full border border-emerald-200/20 px-5 py-2.5 text-sm text-emerald-100/50">取消</button>
          </div>
        </div>
      )}

      {/* Project Cards */}
      {loading ? (
        <div className="py-8 text-center text-emerald-100/30">加载中...</div>
      ) : projects.length === 0 ? (
        <div className="py-8 text-center text-emerald-100/30">还没有人提交项目。成为第一个！</div>
      ) : (
        <div className="mt-4 space-y-4">
          {projects.map(p => (
            <div key={p.id} className="rounded-2xl border border-emerald-200/10 bg-white/[0.02] p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold text-emerald-100">{p.title}</span>
                    {p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-xs text-emerald-300/60 underline hover:text-emerald-200">🔗</a>}
                  </div>
                  <p className="text-sm text-emerald-100/50 mb-2">{p.description}</p>
                  <div className="flex items-center gap-3 text-xs text-emerald-100/35">
                    <span>{p.authorName}</span>
                    {p.authorRole && <span>· {p.authorRole}</span>}
                    <span>· {new Date(p.createdAt).toLocaleDateString("zh-CN")}</span>
                  </div>
                </div>
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="flex items-center gap-0.5">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => vote(p.id, s)}
                        className={`text-lg transition hover:scale-125 ${s <= Math.round(p.avgScore) ? "text-amber-300" : "text-emerald-100/15 hover:text-amber-300/50"}`}
                        title={`${s}星`}>★</button>
                    ))}
                  </div>
                  <span className="text-xs text-emerald-100/30">⭐{p.avgScore} ({p.voteCount})</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      <button onClick={fetchProjects} className="mt-3 flex items-center gap-1 text-xs text-emerald-100/30 hover:text-emerald-200 transition">
        <RefreshCw className="h-3 w-3" /> 刷新
      </button>
    </LearnBlock>

    <div className="mt-10 flex items-center justify-between border-t border-emerald-200/8 pt-6">
      <button onClick={onPrev} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">← 上一模块</button>
      <div className="text-sm text-emerald-100/40">🏆 积分由同侪评分决定</div>
      <button onClick={onNext} className="rounded-full border border-emerald-200/15 px-5 py-2.5 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5">回到首页 →</button>
    </div>
  </ModulePage>;
}
