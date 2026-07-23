"use client";

import { useState, useCallback, useEffect } from "react";
import { Menu, X, CheckCircle2, Circle, Trophy, Zap, ArrowRight, Star } from "lucide-react";
import { PromptModule } from "./prompt";
import { AgentModule } from "./agent";
import { SkillModule } from "./skill";
import { KBModule } from "./kb";
import { SafetyModule } from "./safety";
import { LoopModule } from "./loop";
import { ProjectModule } from "./project";
import { Gallery } from "./gallery";

// ─── Module Definitions ───────────────────────────────
const modules = [
  { id: "prompt", num: 1, icon: "💬", title: "提示词", subtitle: "给AI下一份清晰任务书——掌握对齐公式，一次输出可用结果。", points: 20 },
  { id: "agent", num: 2, icon: "🤖", title: "智能体", subtitle: "不只是问答，而是连续办事——交给AI一个目标，它自己拆步骤交付。", points: 20 },
  { id: "skill", num: 3, icon: "⚡", title: "技能", subtitle: "把经验变成可调用外挂——让AI稳定产出专业级交付物。", points: 20 },
  { id: "kb", num: 4, icon: "📚", title: "知识库", subtitle: "让AI基于你的资料回答——不再泛泛而谈，而是有据可查。", points: 20 },
  { id: "safety", num: 5, icon: "🛡️", title: "风险边界", subtitle: "什么判断不能交给AI？HR合规的六维度审核法与八条红线。", points: 20 },
  { id: "loop", num: 6, icon: "🔄", title: "回路治理", subtitle: "从金字塔到液态网络——锁定一个业务，跑通你的第一个回路。", points: 20 },
  { id: "project", num: 7, icon: "🚀", title: "实战项目", subtitle: "整合四步法——从对话澄清意图，到AI vibe coding自动生成应用。", points: 120 },
] as const;

const levels = [
  { name: "新手探索者", min: 0, icon: "🌱" },
  { name: "AI实践者", min: 60, icon: "🚀" },
  { name: "超级个体", min: 120, icon: "⭐" },
  { name: "碳硅共生者", min: 200, icon: "🌊" },
];

const badgeIcons: Record<string, string> = {
  prompt: "🎯", agent: "🤖", skill: "⚡", kb: "📖", safety: "🛡️", loop: "🔄", project: "🚀",
};

// ─── Main Component ───────────────────────────────────
export default function HRBootcampPage() {
  const [active, setActive] = useState("welcome");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [bonusPoints, setBonusPoints] = useState(0);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [userName, setUserName] = useState<string>("");
  const [nameInput, setNameInput] = useState("");

  // Identity: sessionStorage for cross-session persistence
  useEffect(() => { setUserName(sessionStorage.getItem("hrbc_name") || ""); }, []);
  const saveName = () => {
    if (!nameInput.trim()) return;
    sessionStorage.setItem("hrbc_name", nameInput.trim());
    setUserName(nameInput.trim());
  };

  const totalPoints = modules.filter(m => completed.has(m.id)).reduce((sum, m) => sum + m.points, 0) + bonusPoints;
  const currentLevel = [...levels].reverse().find(l => totalPoints >= l.min)!;
  const nextLevel = levels.find(l => l.min > totalPoints);
  const progressPct = nextLevel ? Math.round(((totalPoints - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100) : 100;

  const toggleComplete = useCallback((id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); setShowLevelUp(true); }
      return next;
    });
  }, []);

  const addBonus = useCallback(() => setBonusPoints(p => p + 10), []);

  useEffect(() => {
    if (showLevelUp) { const t = setTimeout(() => setShowLevelUp(false), 2500); return () => clearTimeout(t); }
  }, [showLevelUp]);

  const goNext = () => {
    const idx = modules.findIndex(m => m.id === active);
    if (idx < modules.length - 1) { setActive(modules[idx + 1].id); setSidebarOpen(false); }
  };
  const goPrev = () => {
    const idx = modules.findIndex(m => m.id === active);
    if (idx > 0) { setActive(modules[idx - 1].id); setSidebarOpen(false); }
  };

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-[#07110f] text-[#f0fbf6]">
      {/* ─── Sidebar ─── */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform border-r border-emerald-200/8 bg-[#0a1a16] transition-transform duration-300 lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center justify-between border-b border-emerald-200/8 px-5">
          <div>
            <div className="text-sm font-black text-emerald-200">从工具赋能，到碳硅共生</div>
            <div className="text-xs text-emerald-100/35">AI for HR · 精英赋能营</div>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X className="h-5 w-5 text-emerald-400" /></button>
        </div>

        {/* Level HUD */}
        <div className="border-b border-emerald-200/8 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl">{currentLevel.icon}</span>
            <div className="flex-1">
              <div className="text-sm font-bold text-emerald-100">{currentLevel.name}</div>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-emerald-200/10">
                  <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-700" style={{ width: `${progressPct}%` }} />
                </div>
                <span className="text-xs font-bold text-emerald-300/70">{totalPoints}pt</span>
              </div>
            </div>
          </div>
        </div>

        <nav className="h-[calc(100%-9rem)] overflow-y-auto p-3">
          <NavBtn active={active === "welcome"} onClick={() => { setActive("welcome"); setSidebarOpen(false); }}>
            <span className="text-base">🏠</span> 封面与课程总览
          </NavBtn>

          <div className="mt-5 mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-emerald-300/35">工具赋能</div>
          {modules.slice(0, 4).map(m => (
            <ModuleNavBtn key={m.id} module={m} active={active === m.id} completed={completed.has(m.id)} onClick={() => { setActive(m.id); setSidebarOpen(false); }} />
          ))}

          <div className="mt-5 mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-emerald-300/35">认知升级</div>
          {modules.slice(4, 6).map(m => (
            <ModuleNavBtn key={m.id} module={m} active={active === m.id} completed={completed.has(m.id)} onClick={() => { setActive(m.id); setSidebarOpen(false); }} />
          ))}
          <div className="mt-5 mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-emerald-300/35">实战输出</div>
          {modules.slice(6).map(m => (
            <ModuleNavBtn key={m.id} module={m} active={active === m.id} completed={completed.has(m.id)} onClick={() => { setActive(m.id); setSidebarOpen(false); }} />
          ))}

          <div className="mt-5 mb-2 px-3 text-[11px] font-bold uppercase tracking-widest text-emerald-300/35">社区</div>
          <NavBtn active={active === "gallery"} onClick={() => { setActive("gallery"); setSidebarOpen(false); }}>
            <span className="text-base">🏆</span> 项目展示厅
          </NavBtn>
        </nav>
      </aside>

      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* ─── Main ─── */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-emerald-200/8 bg-[#0a1a16]/70 px-5 backdrop-blur-md">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu className="h-5 w-5 text-emerald-400" /></button>
          <div className="flex flex-1 items-center gap-3">
            <div className="h-2 max-w-xs flex-1 overflow-hidden rounded-full bg-emerald-200/10">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-700" style={{ width: `${(completed.size / modules.length) * 100}%` }} />
            </div>
            <span className="text-xs font-bold text-emerald-300/60">{completed.size}/{modules.length} 模块</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-emerald-300/10 px-3 py-1.5">
              <Trophy className="h-4 w-4 text-emerald-300" />
              <span className="text-sm font-bold text-emerald-200">{totalPoints}</span>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto scroll-smooth">
          <div key={active} className="animate-[fadeIn_0.3s_ease-out]">
            {active === "welcome" && <WelcomeSection completed={completed} onStart={() => setActive("prompt")} />}
            {active === "prompt" && <PromptModule completed={completed.has("prompt")} onToggleComplete={() => toggleComplete("prompt")} onNext={goNext} onPrev={goPrev} />}
            {active === "agent" && <AgentModule completed={completed.has("agent")} onToggleComplete={() => toggleComplete("agent")} onNext={goNext} onPrev={goPrev} />}
            {active === "skill" && <SkillModule completed={completed.has("skill")} onToggleComplete={() => toggleComplete("skill")} onNext={goNext} onPrev={goPrev} />}
            {active === "kb" && <KBModule completed={completed.has("kb")} onToggleComplete={() => toggleComplete("kb")} onNext={goNext} onPrev={goPrev} />}
            {active === "safety" && <SafetyModule completed={completed.has("safety")} onToggleComplete={() => toggleComplete("safety")} onNext={goNext} onPrev={goPrev} />}
            {active === "loop" && <LoopModule completed={completed.has("loop")} onToggleComplete={() => toggleComplete("loop")} onNext={goNext} onPrev={goPrev} />}
            {active === "project" && <ProjectModule completed={completed.has("project")} onToggleComplete={() => toggleComplete("project")} onNext={goNext} onPrev={goPrev} />}
            {active === "gallery" && (
              userName ? <Gallery userName={userName} /> :
              <div className="flex items-center justify-center min-h-[60vh]">
                <div className="rounded-2xl border border-emerald-200/10 bg-white/[0.02] p-8 text-center max-w-md">
                  <span className="text-4xl">👋</span>
                  <h2 className="mt-4 text-xl font-black text-white">先介绍一下你自己</h2>
                  <p className="mt-2 text-base text-emerald-100/50">设置你的名字后，就可以提交项目和参与投票了。</p>
                  <div className="mt-6 flex gap-2">
                    <input className="flex-1 rounded-xl border border-emerald-200/15 bg-black/20 px-4 py-2.5 text-base text-emerald-100 outline-none focus:border-emerald-300/40" placeholder="你的名字" value={nameInput} onChange={e => setNameInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveName()} />
                    <button onClick={saveName} className="rounded-full bg-emerald-300 px-6 py-2.5 text-sm font-black text-[#07110f] transition hover:scale-105">确认</button>
                  </div>
                  <p className="mt-4 text-sm text-emerald-100/30">不需要密码。名字用于项目署名和投票，可随时修改。</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Level-up Toast */}
      {showLevelUp && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-[slideUp_0.4s_ease-out]">
          <div className="flex items-center gap-3 rounded-full border border-emerald-300/30 bg-emerald-300/15 px-6 py-3 backdrop-blur-md">
            <Zap className="h-5 w-5 text-emerald-300" />
            <span className="text-sm font-black text-emerald-100">+{modules.find(m => m.id === active)?.points || 20} 积分！继续加油 💪</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translate(-50%, 20px); } to { opacity: 1; transform: translate(-50%, 0); } }
      `}</style>
    </div>
  );
}

// ─── Nav Components ───────────────────────────────────

function NavBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-base transition ${active ? "bg-emerald-300/10 text-emerald-200" : "text-emerald-100/55 hover:bg-white/[0.03] hover:text-emerald-100"}`}>
      {children}
    </button>
  );
}

function ModuleNavBtn({ module: m, active, completed, onClick }: { module: typeof modules[0]; active: boolean; completed: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition ${active ? "bg-emerald-300/10 ring-1 ring-emerald-300/20" : "hover:bg-white/[0.03]"}`}>
      <span className="text-xl shrink-0">{m.icon}</span>
      <div className="flex-1 min-w-0">
        <div className={`text-base font-bold ${active ? "text-emerald-200" : completed ? "text-emerald-100/80" : "text-emerald-100/55"}`}>{m.title}</div>
        <div className="truncate text-xs text-emerald-100/30">{m.subtitle.split("——")[0]}</div>
      </div>
      {completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="h-4 w-4 shrink-0 text-emerald-100/15" />}
    </button>
  );
}

// ─── Welcome / Home ───────────────────────────────────

function WelcomeSection({ completed, onStart }: { completed: Set<string>; onStart: () => void }) {
  return (
    <div className="mx-auto max-w-2xl px-5 py-12 sm:px-8 sm:py-16">
      <div className="text-center">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-300/10">
          <Zap className="h-10 w-10 text-emerald-300" />
        </div>
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-300/50">AI for HR · 精英赋能营</p>
        <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">从工具赋能<span className="text-emerald-300">，到碳硅共生</span></h1>
        <p className="mt-5 text-lg leading-8 text-emerald-100/55">
          6个学习模块，每个都是一个完整的闭环：概念理解 → HR场景 → 实践练习 → 模板工具。<br />
          完成后你将带走一个可执行的最小回路方案。
        </p>
        <div className="mt-8">
          <button onClick={onStart} className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-8 py-3.5 text-base font-black text-[#07110f] transition hover:scale-105 hover:bg-emerald-200 active:scale-95">
            开始学习 <ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Module Roadmap */}
      <div className="mt-12 grid gap-3">
        {modules.map(m => {
          const done = completed.has(m.id);
          return (
            <button key={m.id} onClick={onStart} className="group flex items-center gap-4 rounded-2xl border border-emerald-200/8 bg-white/[0.015] p-5 text-left transition hover:border-emerald-200/25 hover:bg-white/[0.04]">
              <span className="text-2xl">{m.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-emerald-300/40">模块{m.num}</span>
                  {done && <span className="rounded-full bg-emerald-300/15 px-2 py-0.5 text-xs font-bold text-emerald-300">已完成</span>}
                </div>
                <div className="mt-0.5 text-lg font-bold text-emerald-100">{m.title}</div>
                <div className="mt-0.5 text-sm leading-7 text-emerald-100/40">{m.subtitle}</div>
              </div>
              {done ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" /> : <ArrowRight className="h-4 w-4 shrink-0 text-emerald-100/20 transition group-hover:translate-x-1 group-hover:text-emerald-300" />}
            </button>
          );
        })}
      </div>

      {/* Badge Wall */}
      {completed.size > 0 && (
        <div className="mt-10 rounded-2xl border border-emerald-200/10 bg-white/[0.02] p-6">
          <div className="mb-4 flex items-center gap-2">
            <Star className="h-5 w-5 text-emerald-300" />
            <span className="text-base font-bold text-emerald-100">我的徽章墙</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {modules.map(m => (
              <div key={m.id} className={`flex flex-col items-center gap-1 rounded-2xl border p-4 transition ${completed.has(m.id) ? "border-emerald-300/30 bg-emerald-300/10" : "border-emerald-200/8 bg-white/[0.01] opacity-30"}`}>
                <span className="text-3xl">{badgeIcons[m.id]}</span>
                <span className="text-xs font-bold text-emerald-100/70">{m.title}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
