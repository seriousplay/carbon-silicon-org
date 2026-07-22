"use client";

import { useState, useCallback } from "react";
import {
  ChevronRight, CheckCircle2, Circle, Trophy, TrendingUp,
  BookOpen, Shield, Target, Star, Zap, ArrowRight, Menu, X,
  Users, Briefcase, GraduationCap, Heart, DollarSign, BarChart3
} from "lucide-react";

// ─── Course Structure ────────────────────────────────
const steps = [
  { id: "hr1", step: 1, time: "0-15min", section: "AI基础", title: "AI基础：四个核心能力", desc: "提示词、智能体、Skill、知识库——AI赋能HR的四大支柱。" },
  { id: "hr2", step: 2, time: "15-40min", section: "HR上手", title: "HR提示词上手", desc: "写好提示词的5个核心技巧，HR专用模板实战。" },
  { id: "hr3", step: 3, time: "40-70min", section: "HR上手", title: "HR工作流：拿到成品", desc: "从对话到交付物，用AI产出招聘JD、培训方案、绩效反馈。" },
  { id: "hr4", step: 4, time: "70-95min", section: "Skill成品", title: "Skill：从对话到成品", desc: "把常用工作流程封装为可复用的AI技能。" },
  { id: "hr5", step: 5, time: "95-115min", section: "风险边界", title: "HR审核与使用边界", desc: "什么判断不能交给AI？HR合规的八条红线。" },
  { id: "hr6", step: 6, time: "115-118min", section: "组织导入", title: "AI进入组织后的排异", desc: "为什么个人用得好、团队推不动？组织排异的四种模式。" },
  { id: "hr7", step: 7, time: "118-120min", section: "组织导入", title: "回路治理导入", desc: "用回路思维把个人AI能力变成组织资产。" },

  { id: "loop1", step: 8, time: "120-150min", section: "回路治理", title: "从流水线到神经系统", desc: "理解回路式组织与传统组织的七个根本差异——为什么你的公司不能只把AI当工具。" },
  { id: "loop2", step: 9, time: "150-170min", section: "回路治理", title: "锁定关键业务，设计你的回路", desc: "不需要自上而下的组织变革。选一个痛点业务，画出它的回路地图，定义人机角色。" },
  { id: "loop3", step: 10, time: "170-180min", section: "回路治理", title: "我的行动承诺", desc: "带回公司的不是一个概念，而是一个可执行的最小回路方案。" },
];

const tasks = [
  { id: "1", icon: Users, color: "emerald", label: "招聘回路", desc: "简历到面试的转化黑洞", output: "面试评估表Excel" },
  { id: "2", icon: GraduationCap, color: "blue", label: "培训回路", desc: "培训完就忘，没有行为改变", output: "培训方案PPT" },
  { id: "3", icon: BarChart3, color: "purple", label: "绩效回路", desc: "绩效面谈变成走过场", output: "绩效反馈Word" },
  { id: "4", icon: Heart, color: "rose", label: "员工关怀回路", desc: "福利发了，满意度没涨", output: "关怀方案文档" },
  { id: "5", icon: DollarSign, color: "amber", label: "薪酬回路", desc: "调薪靠拍脑袋，缺乏数据支撑", output: "薪酬分析报告" },
];

const colorMap: Record<string, string> = {
  emerald: "border-emerald-300/30 bg-emerald-300/10 text-emerald-200",
  blue: "border-blue-300/30 bg-blue-300/10 text-blue-200",
  purple: "border-purple-300/30 bg-purple-300/10 text-purple-200",
  rose: "border-rose-300/30 bg-rose-300/10 text-rose-200",
  amber: "border-amber-300/30 bg-amber-300/10 text-amber-200",
};

// ─── Main Component ───────────────────────────────────
export default function HRBootcampPage() {
  const [active, setActive] = useState("welcome");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [selectedTask, setSelectedTask] = useState<string | null>(null);

  const toggleComplete = useCallback((id: string) => {
    setCompleted(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);

  const progress = Math.round((completed.size / steps.length) * 100);

  return (
    <div className="flex h-screen overflow-hidden bg-[#07110f] text-[#f0fbf6]">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 transform border-r border-emerald-200/10 bg-[#0a1a16] transition-transform lg:relative lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-14 items-center justify-between border-b border-emerald-200/10 px-4">
          <span className="text-sm font-black text-emerald-200">AI赋能训练营 · HR篇</span>
          <button onClick={() => setSidebarOpen(false)} className="lg:hidden"><X className="h-5 w-5 text-emerald-400" /></button>
        </div>
        <nav className="h-[calc(100%-3.5rem)] overflow-y-auto p-3">
          <NavGroup label="首页" />
          <NavItem target="welcome" active={active === "welcome"} onClick={() => { setActive("welcome"); setSidebarOpen(false); }}>封面与课程总览</NavItem>

          <NavGroup label="AI基础 15min" />
          {steps.filter(s => s.section === "AI基础").map(s => (
            <NavItem key={s.id} target={s.id} step={s.step} active={active === s.id} completed={completed.has(s.id)} onClick={() => { setActive(s.id); setSidebarOpen(false); }}>
              {s.title.split("：")[1] || s.title}
            </NavItem>
          ))}

          <NavGroup label="HR上手 55min" />
          {steps.filter(s => s.section === "HR上手").map(s => (
            <NavItem key={s.id} target={s.id} step={s.step} active={active === s.id} completed={completed.has(s.id)} onClick={() => { setActive(s.id); setSidebarOpen(false); }}>
              {s.title.split("：")[1] || s.title}
            </NavItem>
          ))}

          <NavGroup label="Skill成品 25min" />
          {steps.filter(s => s.section === "Skill成品").map(s => (
            <NavItem key={s.id} target={s.id} step={s.step} active={active === s.id} completed={completed.has(s.id)} onClick={() => { setActive(s.id); setSidebarOpen(false); }}>
              {s.title.split("：")[1] || s.title}
            </NavItem>
          ))}

          <NavGroup label="风险边界 20min" />
          {steps.filter(s => s.section === "风险边界").map(s => (
            <NavItem key={s.id} target={s.id} step={s.step} active={active === s.id} completed={completed.has(s.id)} onClick={() => { setActive(s.id); setSidebarOpen(false); }}>
              {s.title.split("：")[1] || s.title}
            </NavItem>
          ))}

          <NavGroup label="组织导入 5min" />
          {steps.filter(s => s.section === "组织导入").map(s => (
            <NavItem key={s.id} target={s.id} step={s.step} active={active === s.id} completed={completed.has(s.id)} onClick={() => { setActive(s.id); setSidebarOpen(false); }}>
              {s.title.split("：")[1] || s.title}
            </NavItem>
          ))}

          <NavGroup label="回路治理 60min" />
          {steps.filter(s => s.section === "回路治理").map(s => (
            <NavItem key={s.id} target={s.id} step={s.step} active={active === s.id} completed={completed.has(s.id)} onClick={() => { setActive(s.id); setSidebarOpen(false); }}>
              {s.title.split("：")[1] || s.title}
            </NavItem>
          ))}

          <NavGroup label="扩展" />
          <NavItem target="choose" active={active === "choose"} onClick={() => { setActive("choose"); setSidebarOpen(false); }}>选择一个HR深化场景</NavItem>
          <NavItem target="governance" active={active === "governance"} onClick={() => { setActive("governance"); setSidebarOpen(false); }}>治理红线</NavItem>
        </nav>
      </aside>

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-emerald-200/10 bg-[#0a1a16]/80 px-4 backdrop-blur">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden"><Menu className="h-5 w-5 text-emerald-400" /></button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-emerald-200/10">
                <div className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-300 transition-all duration-500" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-xs font-bold text-emerald-300/70">{progress}%</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-300/70">
            <Trophy className="h-4 w-4" />
            <span>{completed.size}/{steps.length}步</span>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {active === "welcome" && <WelcomeSection onStart={() => setActive("hr1")} selectedTask={selectedTask} onSelectTask={setSelectedTask} />}
          {active === "choose" && <TaskSelectSection selectedTask={selectedTask} onSelectTask={(t) => { setSelectedTask(t); setActive("welcome"); }} />}
          {active === "governance" && <GovernanceSection />}
          {steps.map(s => (
            active === s.id && (
              <StepSection key={s.id} step={s} completed={completed.has(s.id)} onToggleComplete={() => toggleComplete(s.id)}
                onNext={() => { const idx = steps.findIndex(x => x.id === s.id); if (idx < steps.length - 1) setActive(steps[idx + 1].id); }}
                onPrev={() => { const idx = steps.findIndex(x => x.id === s.id); if (idx > 0) setActive(steps[idx - 1].id); }}
              />
            )
          ))}
        </div>
      </main>
    </div>
  );
}

// ─── Sub-Components ───────────────────────────────────

function NavGroup({ label }: { label: string }) {
  return <div className="mt-4 mb-1 px-2 text-[11px] font-bold uppercase tracking-widest text-emerald-300/40">{label}</div>;
}

function NavItem({ target, step, active, completed, onClick, children }: {
  target: string; step?: number; active: boolean; completed?: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition ${active ? "bg-emerald-300/10 text-emerald-200" : "text-emerald-100/60 hover:bg-white/[0.04] hover:text-emerald-100"}`}>
      {step ? (completed ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" /> : <Circle className="h-4 w-4 shrink-0 text-emerald-100/30" />) : <span className="w-4 shrink-0" />}
      <span className="truncate">{children}</span>
    </button>
  );
}

function WelcomeSection({ onStart, selectedTask, onSelectTask }: { onStart: () => void; selectedTask: string | null; onSelectTask: (t: string) => void }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl border border-emerald-300/20 bg-emerald-300/10">
          <Zap className="h-10 w-10 text-emerald-300" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300/50">AI · HR · 2小时微学习</p>
        <h1 className="mt-4 text-4xl font-black tracking-tight">AI赋能训练营<span className="text-emerald-300"> · HR篇</span></h1>
        <p className="mt-4 text-lg leading-relaxed text-emerald-100/60">
          先会用提示词、智能体、Skill和知识库，再理解组织如何接住AI。<br />
          2小时，7个步骤，5个HR场景任选。
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <button onClick={onStart} className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-8 py-3 text-sm font-black text-[#07110f] transition hover:bg-emerald-200">
            开始学习 <ArrowRight className="h-4 w-4" />
          </button>
          <button onClick={() => onSelectTask("")} className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 px-8 py-3 text-sm font-bold text-emerald-100 transition hover:bg-white/5">
            先选场景
          </button>
        </div>
        {selectedTask && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/10 px-4 py-2 text-sm font-bold text-emerald-200">
            <Target className="h-4 w-4" />
            当前场景：{tasks.find(t => t.id === selectedTask)?.label || selectedTask}
          </div>
        )}
      </div>

      <div className="mt-10 grid gap-3">
        {steps.map(s => (
          <div key={s.id} className="flex items-center gap-4 rounded-2xl border border-emerald-200/10 bg-white/[0.02] p-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-300/10 text-sm font-black text-emerald-200">{s.step}</div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-emerald-200/60">{s.section} · {s.time}</div>
              <div className="mt-0.5 font-bold truncate">{s.title}</div>
              <div className="mt-0.5 text-xs text-emerald-100/40">{s.desc}</div>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-emerald-100/30" />
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskSelectSection({ selectedTask, onSelectTask }: { selectedTask: string | null; onSelectTask: (t: string) => void }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h2 className="text-2xl font-black">选择一个HR深化场景</h2>
      <p className="mt-2 text-emerald-100/50">每个场景都有对应的提示词模板、AI工作流和成品产出。</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {tasks.map(t => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => onSelectTask(t.id)}
              className={`rounded-2xl border p-5 text-left transition ${selectedTask === t.id ? `${colorMap[t.color]} border-2` : "border-emerald-200/10 bg-white/[0.02] hover:bg-white/[0.04]"}`}>
              <div className="flex items-center gap-3">
                <Icon className="h-6 w-6 text-emerald-300" />
                <div>
                  <div className="font-bold">{t.label}</div>
                  <div className="text-xs text-emerald-100/40">{t.desc}</div>
                </div>
              </div>
              <div className="mt-3 rounded-full border border-emerald-200/10 bg-white/[0.03] px-3 py-1 text-xs text-emerald-200/70">成品：{t.output}</div>
            </button>
          );
        })}
      </div>
      <button onClick={() => onSelectTask(selectedTask || tasks[0].id)} className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-6 py-2 text-sm font-black text-[#07110f]">
        确认选择 <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function StepSection({ step: s, completed, onToggleComplete, onNext, onPrev }: {
  step: typeof steps[0]; completed: boolean; onToggleComplete: () => void; onNext: () => void; onPrev: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-6 flex items-center gap-2 text-xs font-bold text-emerald-200/60">
        <span>{s.section}</span><ChevronRight className="h-3 w-3" /><span>{s.time}</span>
      </div>
      <h2 className="text-3xl font-black">{s.title}</h2>
      <p className="mt-4 text-lg leading-relaxed text-emerald-100/60">{s.desc}</p>

      <div className="mt-8 space-y-6">
        {s.id === "hr1" && <HR1Content />}
        {s.id === "hr2" && <HR2Content />}
        {s.id === "hr3" && <HR3Content />}
        {s.id === "hr4" && <HR4Content />}
        {s.id === "hr5" && <HR5Content />}
        {s.id === "hr6" && <HR6Content />}
        {s.id === "hr7" && <HR7Content />}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <button onClick={onPrev} className="rounded-full border border-emerald-200/20 px-6 py-2 text-sm font-bold text-emerald-100 transition hover:bg-white/5">← 上一步</button>
        <button onClick={onToggleComplete}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-2 text-sm font-black transition ${completed ? "bg-emerald-300/20 text-emerald-300" : "bg-emerald-300 text-[#07110f] hover:bg-emerald-200"}`}>
          {completed ? <><CheckCircle2 className="h-4 w-4" /> 已完成</> : "标记完成"}
        </button>
        <button onClick={onNext} className="rounded-full border border-emerald-200/20 px-6 py-2 text-sm font-bold text-emerald-100 transition hover:bg-white/5">下一步 →</button>
      </div>
    </div>
  );
}

// ─── Step Content Components ──────────────────────────

function InfoBox({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-sm leading-relaxed text-emerald-100/80">{children}</div>;
}

function StepTable({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-emerald-200/10">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-emerald-200/10 bg-emerald-200/[0.04]">{headers.map(h => <th key={h} className="px-4 py-3 text-left font-bold text-emerald-200">{h}</th>)}</tr></thead>
        <tbody>{rows.map((row, i) => <tr key={i} className="border-b border-emerald-200/5 last:border-0">{row.map((cell, j) => <td key={j} className="px-4 py-3 text-emerald-100/70">{cell}</td>)}</tr>)}</tbody>
      </table>
    </div>
  );
}

function HR1Content() {
  return <>
    <InfoBox><strong className="text-emerald-200">先建立共同语言：</strong>HR 不需要先学复杂技术名词，但需要分清 AI 到底是在聊天、执行任务、生成文件，还是基于资料回答。</InfoBox>
    <StepTable
      headers={["能力", "一句话理解", "HR 场景", "上手判断"]}
      rows={[
        [<strong key="1">提示词 Prompt</strong>, "给 AI 下一份清晰任务书", "写 JD、绩效反馈、面试题", "有角色、对象、约束、输出格式"],
        [<strong key="2">智能体 Agent</strong>, "交目标后能拆步骤、调用工具、交付结果", "招聘助手串联 JD、简历筛选、面试问题", "不是问一句答一句，而是能连续办事"],
        [<strong key="3">技能 Skill</strong>, "可复用的专业能力包", "一句话生成 Excel、PPT、Word", "产出可下载、可编辑、可交付"],
        [<strong key="4">知识库 RAG</strong>, "先读你的资料，再基于资料回答", "员工手册问答、制度解释", "回答能引用来源，不靠泛泛经验"],
      ]}
    />
  </>;
}

function HR2Content() {
  return <>
    <InfoBox><strong className="text-emerald-200">HR提示词公式：</strong><code className="mx-1 rounded bg-emerald-200/10 px-2 py-0.5 text-emerald-200">角色 + 场景 + 目标 + 输入材料 + 约束边界 + 输出格式 + 审核标准</code></InfoBox>
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-xl border border-rose-300/10 bg-rose-300/[0.04] p-4">
        <div className="mb-2 text-xs font-bold text-rose-300/70">❌ 太笼统</div>
        <p className="text-sm text-rose-100/60">帮我写一个产品经理的 JD。</p>
      </div>
      <div className="rounded-xl border border-emerald-300/10 bg-emerald-300/[0.04] p-4">
        <div className="mb-2 text-xs font-bold text-emerald-300/70">✅ 可执行</div>
        <p className="text-sm text-emerald-100/70">你是一名资深招聘 HR。请为一家 200 人 SaaS 公司写高级产品经理 JD。输入：B 端产品、3 年以上经验、熟悉敏捷协作。输出：岗位职责 5 条、硬性要求、加分项、面试关注点。语气专业但不浮夸。</p>
      </div>
    </div>
    <div className="text-sm font-bold text-emerald-200">五类高频场景：招聘 JD · 绩效反馈 · 培训大纲 · 员工沟通 · 制度问答</div>
  </>;
}

function HR3Content() {
  return <>
    <InfoBox><strong className="text-emerald-200">现场学习方式：</strong>不要只听概念。选一个真实 HR 任务，跟步骤做，最后拿到一个能带回工作的成品。</InfoBox>
    <StepTable
      headers={["任务", "三步工作流", "成品"]}
      rows={[
        ["招聘", "写 JD → 筛简历 → 生成面试问题", "面试评估表"],
        ["培训", "诊断需求 → 设计大纲 → 生成课后行动任务", "培训方案 PPT"],
        ["绩效", "整理事实 → 生成反馈 → 改成面谈脚本", "绩效反馈 Word"],
        ["员工关怀", "识别信号 → 设计沟通 → 制定跟进动作", "关怀行动清单"],
        ["制度问答", "上传制度 → 提问 → 核对引用来源", "制度问答示例"],
      ]}
    />
  </>;
}

function HR4Content() {
  return <>
    <InfoBox><strong className="text-emerald-200">Skill 不是一条提示词，</strong>而是一组可复用的任务能力包。它把输入材料、处理步骤、输出格式和质量标准固化下来，让同类 HR 任务可以反复生成一致的成品。</InfoBox>
    <StepTable
      headers={["能力", "解决什么问题", "HR例子"]}
      rows={[
        ["提示词", "让 AI 明白这一次要做什么", "写一份高级产品经理 JD"],
        ["知识库", "让 AI 基于组织资料回答", "基于员工手册知识库解释请假制度"],
        [<strong key="s" className="text-emerald-300">Skill</strong>, <strong key="d" className="text-emerald-300">把同类任务变成稳定成品</strong>, <strong key="e" className="text-emerald-300">一键生成面试评估表 Excel、培训方案 PPT、绩效反馈 Word</strong>],
      ]}
    />
  </>;
}

function HR5Content() {
  const checks = [
    { dim: "合规性", check: "JD、评估和建议是否违反劳动法或公司制度？", fix: "请检查是否存在合规风险，并列出依据。" },
    { dim: "公平性", check: "是否存在性别、年龄、地域、婚育等偏见？", fix: "请检查筛选标准中的潜在歧视性表述。" },
    { dim: "准确性", check: "AI 有没有编造事实、岗位信息或制度条款？", fix: "请标注哪些结论来自输入材料，哪些是推断。" },
    { dim: "温度感", check: "绩效反馈、关怀沟通是否太冷、太机械？", fix: "请调整语气，保持专业但有尊重和同理心。" },
    { dim: "保密性", check: "是否包含员工隐私或薪酬等敏感信息？", fix: "请移除或脱敏处理涉及个人隐私的内容。" },
    { dim: "责任归属", check: "最终决策是否保留给人类 HR？", fix: "请明确标注'AI建议，需HR审核确认'。" },
  ];
  return <>
    <div className="rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4 text-sm text-amber-100/80">
      <strong className="text-amber-300">HR 使用 AI 的原则：</strong>AI 可以加速整理、生成和分析，但不能替代最终录用、绩效、薪酬、处分、解除劳动关系等责任判断。
    </div>
    <div className="text-sm font-bold text-emerald-200">AI初稿审核法（HR六维度）</div>
    <div className="grid gap-3">
      {checks.map(c => (
        <div key={c.dim} className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
          <div className="text-sm font-bold text-emerald-200">{c.dim}</div>
          <div className="mt-1 text-sm text-emerald-100/60">{c.check}</div>
          <div className="mt-1 text-xs text-emerald-100/30">🔧 {c.fix}</div>
        </div>
      ))}
    </div>
  </>;
}

function HR6Content() {
  return <>
    <InfoBox>今天我们解决的是<strong className="text-emerald-200">个体会不会用。</strong>但当每个 HR 都会用 AI 以后，组织还会遇到第二个问题：旧流程、旧审批、旧指标能不能接住这种新能力？</InfoBox>
    <StepTable
      headers={["HR模块", "个体会用AI之后", "组织可能的排异"]}
      rows={[
        ["招聘", "HR 能快速筛简历、生成面试题", "面试官仍按旧经验判断，AI 标注没有进入决策记录"],
        ["绩效", "HR 能整理事实和反馈稿", "绩效流程仍只看季度评分，日常证据没有被接入"],
        ["培训", "HR 能生成课程和行动任务", "培训后没有行为追踪，课程完成不代表能力改变"],
        ["员工关系", "HR 能识别风险信号和沟通建议", "信号没有触发责任人和跟进行动"],
      ]}
    />
  </>;
}

function HR7Content() {
  return <>
    <InfoBox><strong className="text-emerald-200">回路思维：</strong>个人 AI 能力 → 团队工作方法 → 组织流程资产 → 持续反馈改进。用回路把个人 AI 能力变成组织可复用的智能密度。</InfoBox>
    <div className="grid gap-4">
      {[
        { step: "1", title: "沉淀", desc: "把个人成功的 AI 对话、提示词模板、Skill 保存为团队共享资产" },
        { step: "2", title: "标准化", desc: "将高频 HR 任务的 AI 工作流固化为标准操作流程（SOP）" },
        { step: "3", title: "反馈", desc: "建立 AI 产出的质量评估机制，定期回顾和改进" },
        { step: "4", title: "迭代", desc: "根据业务变化和组织反馈，持续更新提示词库和 Skill" },
      ].map(item => (
        <div key={item.step} className="flex items-start gap-3 rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-sm font-black text-emerald-300">{item.step}</div>
          <div>
            <div className="font-bold text-emerald-100">{item.title}</div>
            <div className="text-sm text-emerald-100/50">{item.desc}</div>
          </div>
        </div>
      ))}
    </div>
  </>;
}

function GovernanceSection() {
  const rules = [
    { id: 1, text: "不得用AI做雇佣/解雇的最终决定" },
    { id: 2, text: "不得用AI独立处理员工投诉和纪律处分" },
    { id: 3, text: "不得用AI生成未经HR审核的薪酬调整方案" },
    { id: 4, text: "不得用AI访问或分析未经授权的员工隐私数据" },
    { id: 5, text: "不得用AI替代法定的劳动合规审查" },
    { id: 6, text: "不得用AI独立撰写具有法律效力的HR文件" },
    { id: 7, text: "不得将AI建议作为绩效评估的唯一依据" },
    { id: 8, text: "不得向AI透露员工身份证号、银行账号等敏感信息" },
  ];
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-rose-400" />
        <h2 className="text-2xl font-black">HR使用AI的八条红线</h2>
      </div>
      <p className="mt-2 text-emerald-100/50">这些判断必须由人类HR做出，AI只能提供参考信息。</p>
      <div className="mt-6 grid gap-3">
        {rules.map(r => (
          <div key={r.id} className="flex items-start gap-3 rounded-xl border border-rose-300/10 bg-rose-300/[0.03] p-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-300/10 text-sm font-black text-rose-300">{r.id}</div>
            <p className="pt-0.5 text-sm leading-relaxed text-rose-100/80">{r.text}</p>
          </div>
        ))}
      </div>
    </div>
  );

// ─── Loop Governance Module ───────────────────────────

function Loop1Content() {
  return (<>
    <InfoBox>
      <strong className="text-emerald-200">一个画面，两种组织：</strong>传统组织是一台<strong className="text-amber-300">机器</strong>——设计好流程，人按流程执行，管理层监督质量，出问题就修理流程。机器的上限是设计者的上限。回路组织是一个<strong className="text-emerald-300">生命体</strong>——设计好反馈回路，每次行动都产生学习信号，系统自动变得比上一次更聪明。生命体的上限是它学习了多少次。
    </InfoBox>

    <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-5">
      <div className="text-sm font-bold text-emerald-200 mb-4">七个维度的根本差异</div>
      <div className="grid gap-4">
        {[
          { dim: "核心隐喻", old: "公司 = 精密机器", new: "公司 = 神经系统" },
          { dim: "设计对象", old: "谁做什么？谁向谁汇报？", new: "AI做什么？人判断什么？反馈从哪来？" },
          { dim: "协调机制", old: "晨会、周报、审批流", new: "信号自动流动，AI直接从数据感知" },
          { dim: "能力归属", old: "能力存在人身上，人走能力走", new: "能力存在回路里，积累成组织资产" },
          { dim: "规模化逻辑", old: "业务翻倍，人头翻倍", new: "业务翻倍，AI更聪明，人效更高" },
          { dim: "变革方式", old: "几年一次组织架构调整", new: "持续校准回路，日常操作即进化" },
          { dim: "衡量标准", old: "执行质量：KPI是否达标", new: "学习速度：AI采纳率在上升吗？推翻率在下降吗？" },
        ].map(item => (
          <div key={item.dim} className="rounded-lg border border-emerald-200/5 bg-emerald-200/[0.02] p-3">
            <div className="text-xs font-bold text-emerald-300">{item.dim}</div>
            <div className="mt-1 grid grid-cols-2 gap-2 text-xs">
              <div><span className="text-rose-300/60">旧：</span><span className="text-rose-100/60">{item.old}</span></div>
              <div><span className="text-emerald-300/60">新：</span><span className="text-emerald-100/80">{item.new}</span></div>
            </div>
          </div>
        ))}
      </div>
    </div>

    <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4 text-sm leading-relaxed text-emerald-100/80">
      <strong className="text-emerald-300">对HR的含义：</strong>你不是在引入一个AI工具，你是在重新设计组织做判断的方式。让招聘、培训、绩效每一次决策都变成组织学习的养料。
    </div>
  </>);
}

function Loop2Content() {
  const loopSteps = [
    { num: "1", title: "选一个痛点业务", desc: "不要全面铺开。选一个高频、有数据、结果可衡量的HR业务。", tip: "问自己：这个业务有没有每次都需要老员工经验判断的环节？" },
    { num: "2", title: "画出回路地图", desc: "信号从哪来→AI做什么→人判断什么→决策怎么执行→反馈信号怎么回到起点", tip: "用一张A4纸画出节点和箭头。" },
    { num: "3", title: "定义人机角色", desc: "AI负责模式识别和生成建议。人负责审核、修正、处理情境信息。", tip: "AI建议，人确认。人推翻时必须记录原因——这是回路的学习材料。" },
    { num: "4", title: "定义反馈信号", desc: "什么数据能告诉你回路在越来越聪明？采纳率？推翻率？冷启动时间？", tip: "好的反馈信号是自动采集的——不需要人汇报。" },
  ];

  return (<>
    <InfoBox>
      <strong className="text-emerald-200">不需要自上而下的组织变革。</strong>锁定一个让团队真实疼痛的业务环节，跑通一条回路。当这条回路开始自己变聪明的时候，其他人会主动来找你。
    </InfoBox>

    <div className="text-sm font-bold text-emerald-200 mt-2">四步设计你的第一个回路</div>
    <div className="grid gap-4">
      {loopSteps.map(s => (
        <div key={s.num} className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-300/10 text-sm font-black text-emerald-300">{s.num}</div>
            <div className="flex-1">
              <div className="font-bold text-emerald-100">{s.title}</div>
              <div className="mt-1 text-sm text-emerald-100/60">{s.desc}</div>
              <div className="mt-2 rounded-lg bg-amber-300/[0.06] border border-amber-300/10 px-3 py-1.5 text-xs text-amber-200/70">💡 {s.tip}</div>
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-5">
      <div className="text-sm font-bold text-emerald-300 mb-3">示例：招聘筛选回路</div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-200">📥 简历流入</span>
        <span className="text-emerald-100/30">→</span>
        <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-200">🤖 AI初筛打分</span>
        <span className="text-emerald-100/30">→</span>
        <span className="rounded-full bg-amber-300/10 px-3 py-1 text-amber-200">👤 HR审核确认</span>
        <span className="text-emerald-100/30">→</span>
        <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-emerald-200">🔄 入职后跟踪匹配度</span>
      </div>
      <div className="mt-3 text-xs text-emerald-100/40">
        反馈信号：HR审核时推翻AI排序的原因被记录→模型学习HR偏好→下次更精准。入职后6个月绩效与面试评分相关性→校准模型。
      </div>
    </div>
  </>);
}

function Loop3Content() {
  return (<>
    <InfoBox>
      <strong className="text-emerald-200">今天的产出不是一个概念，是一个你可以带回公司、下周一就开始执行的方案。</strong>
    </InfoBox>

    <div className="grid gap-4">
      {[
        { q: "你要锁定的关键业务是什么？", hint: "选择一个高频、有痛点、你能直接影响的HR业务。" },
        { q: "这个业务上，AI可以帮你做什么？", hint: "数据处理？模式识别？生成初稿？批量筛选？不要想全面AI化——只想第一步。" },
        { q: "什么判断必须保留给人？", hint: "涉及合规风险？需要情境理解？涉及人的主观感受？" },
        { q: "什么数据可以作为反馈信号？", hint: "这个信号必须是自动可采集的——不需要额外的人工报告。" },
        { q: "你下周一要做的第一件事是什么？", hint: "约同事聊？选工具？整理数据？画回路图？" },
      ].map((item, i) => (
        <div key={i} className="rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 text-emerald-300 font-black">{i + 1}.</span>
            <div className="flex-1">
              <div className="font-bold text-sm text-emerald-100">{item.q}</div>
              <div className="mt-1 text-xs text-emerald-100/30">{item.hint}</div>
              <div className="mt-2 border-b border-dashed border-emerald-200/20 pt-2 pb-1 text-sm text-emerald-100/50 min-h-[1.5rem]"></div>
            </div>
          </div>
        </div>
      ))}
    </div>

    <div className="rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-5 mt-4">
      <div className="text-sm font-bold text-emerald-300 mb-2">送给每一位HR</div>
      <p className="text-sm leading-relaxed text-emerald-100/70">
        AI时代的HR，不是被AI替代的岗位——而是帮助组织长出智能的关键角色。你不需要成为技术专家。你需要的是：<strong className="text-emerald-200">识别关键业务回路、设计人机角色、定义反馈信号、让每一次判断都变成组织学习的养料。</strong>
      </p>
      <p className="mt-3 text-sm leading-relaxed text-emerald-100/50">
        回到公司后，不需要搞AI转型大项目。锁定一个业务痛点，跑通一条回路。当第一条回路开始自己变聪明的时候，变革就不再需要你去推动——它会自己生长。
      </p>
    </div>
  </>);
}
}
