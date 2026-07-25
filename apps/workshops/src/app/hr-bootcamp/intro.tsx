"use client";

import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function IntroModule({ onNext }: { onNext: () => void }) {
  const [slide, setSlide] = useState(0);
  const [poll, setPoll] = useState<string | null>(null);
  const totalSlides = 8;

  const next = useCallback(() => slide < totalSlides - 1 ? setSlide(slide + 1) : onNext(), [slide, onNext]);
  const prev = useCallback(() => slide > 0 && setSlide(slide - 1), [slide]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev]);

  return (
    <div className="flex h-full flex-col">
      {/* Slide Area */}
      <div className="relative flex-1 overflow-y-auto">
        <div key={slide} className="animate-[fadeIn_0.4s_ease-out] mx-auto flex min-h-full max-w-3xl flex-col justify-center px-6 py-10 sm:px-10">
          {slide === 0 && <Slide01 />}
          {slide === 1 && <Slide02 />}
          {slide === 2 && <Slide03 />}
          {slide === 3 && <Slide04 />}
          {slide === 4 && <Slide05 poll={poll} onPoll={setPoll} />}
          {slide === 5 && <Slide06 />}
          {slide === 6 && <Slide07 />}
          {slide === 7 && <Slide08 onNext={onNext} />}
        </div>
      </div>

      {/* Controls */}
      <div className="flex h-14 shrink-0 items-center justify-between border-t border-emerald-200/8 bg-[#0a1a16]/80 px-6 backdrop-blur">
        <button onClick={prev} disabled={slide === 0}
          className="flex items-center gap-1 rounded-full px-4 py-2 text-sm font-bold text-emerald-100/60 transition hover:bg-white/5 disabled:opacity-20">
          <ChevronLeft className="h-4 w-4" /> 上一页
        </button>

        {/* Dots */}
        <div className="flex items-center gap-1.5">
          {Array.from({ length: totalSlides }).map((_, i) => (
            <button key={i} onClick={() => setSlide(i)}
              className={`h-2 rounded-full transition-all ${i === slide ? "w-6 bg-emerald-300" : "w-2 bg-emerald-200/20 hover:bg-emerald-200/40"}`} />
          ))}
        </div>

        <button onClick={next}
          className="flex items-center gap-1 rounded-full bg-emerald-300/20 px-4 py-2 text-sm font-bold text-emerald-200 transition hover:bg-emerald-300/30">
          {slide === totalSlides - 1 ? "开始课程 →" : "下一页"} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Slides ───────────────────────────────────────────

function SlideWrapper({ children, eyebrow }: { children: React.ReactNode; eyebrow?: string }) {
  return (
    <>
      {eyebrow && <p className="mb-4 text-xs font-bold uppercase tracking-[0.2em] text-emerald-300/40">{eyebrow}</p>}
      {children}
    </>
  );
}

function Slide01() {
  return <SlideWrapper eyebrow="AI时代的组织迁徙地图">
    <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">
      晚上7点到清晨，<br />
      一个人完成了<br />
      <span className="text-emerald-300">十人团队三个月</span>的工作
    </h1>
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.03] p-6">
        <div className="text-3xl font-black text-amber-300">2003</div>
        <div className="mt-2 text-lg text-amber-100/60">10人团队 × 3个月<br />产品经理、架构师、工程师<br />会议、排期、协调</div>
      </div>
      <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-6">
        <div className="text-3xl font-black text-emerald-300">2025</div>
        <div className="mt-2 text-lg text-emerald-100/70">1个人 × 1夜<br />人 + 编程智能体</div>
      </div>
    </div>
    <p className="mt-6 text-lg text-emerald-100/40">这不是效率提升，这是<span className="text-amber-300 font-bold">生产力范式的断裂</span>。</p>
  </SlideWrapper>;
}

function Slide02() {
  return <SlideWrapper eyebrow="MIT 2025 · GenAI鸿沟">
    <h2 className="text-3xl font-black text-white sm:text-4xl">工具进步了，组织没变好</h2>
    <p className="mt-4 text-lg text-emerald-100/50">绝大多数企业的AI投入，没有换来损益表的变化。</p>
    <div className="mt-6 rounded-2xl border border-rose-300/10 bg-rose-300/[0.03] p-6">
      <div className="space-y-2 text-base text-rose-100/60">
        <p>🤖 AI生成了更多材料</p>
        <p>📉 业务结果没有变好</p>
        <p>⚙️ 工具越来越先进</p>
        <p>🐌 决策越来越慢</p>
        <p>😰 越会用AI的人越累</p>
        <p>🔄 省下的时间被会议和临时需求吞噬</p>
      </div>
    </div>
    <div className="mt-4 rounded-xl bg-amber-300/[0.05] border border-amber-300/10 px-5 py-3 text-base text-amber-100/70">
      一个人已经能跑闭环，组织却还让他走三层汇报、等四个部门对齐、填五张表。<br />
      <strong className="text-amber-300">"许多企业以为在做AI转型，其实只是用AI给旧组织续命。"</strong>
    </div>
  </SlideWrapper>;
}

function Slide03() {
  const pillars = [
    { name: "规模不经济", old: "内部交易成本低→规模优势", collapse: "沟通税：30人=435对连接，300人=45000对，100倍" },
    { name: "分工不闭环", old: "高层战略→中层拆解→基层执行", collapse: "认知迭代最快的在一线，但没有决策权" },
    { name: "审计黑洞", old: "质量靠QA、安全靠审计、合规靠法务", collapse: "AI需要递归式自主进化：清晰规则+可解释验证" },
    { name: "决策中心偏离", old: "精细化部门分工和岗位职责", collapse: "超级个体：一个人带着智能体完成价值闭环" },
  ];
  return <SlideWrapper eyebrow="经典管理的崩塌">
    <h2 className="text-3xl font-black text-white sm:text-4xl">四根支柱正在崩塌</h2>
    <div className="mt-6 grid gap-3 sm:grid-cols-2">
      {pillars.map(p => (
        <div key={p.name} className="rounded-2xl border border-emerald-200/10 bg-white/[0.02] p-5">
          <div className="text-lg font-bold text-emerald-300">{p.name}</div>
          <div className="mt-1 text-sm text-emerald-100/45">旧：{p.old}</div>
          <div className="mt-1 text-sm text-rose-200/55">⚠️ {p.collapse}</div>
        </div>
      ))}
    </div>
  </SlideWrapper>;
}

function Slide04() {
  return <SlideWrapper eyebrow="范式跃迁">
    <h2 className="text-3xl font-black text-white sm:text-4xl">从大陆文明，到海洋文明</h2>
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <div className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.03] p-6">
        <div className="text-2xl">🏰</div>
        <div className="mt-3 text-xl font-bold text-amber-300">大陆文明</div>
        <p className="mt-2 text-base text-amber-100/55">边界清晰、流程固定、权力自塔顶层层下发。<br />适合稳定扩张、大规模复制。<br />管理工具是<strong>城墙</strong>。</p>
      </div>
      <div className="rounded-2xl border border-emerald-300/15 bg-emerald-300/[0.04] p-6">
        <div className="text-2xl">🌊</div>
        <div className="mt-3 text-xl font-bold text-emerald-300">海洋文明</div>
        <p className="mt-2 text-base text-emerald-100/65">连接更密、边界重画、信息渗透。<br />机会与风险都来得更快。<br />管理工具是<strong>船队、航线、雷达</strong>。</p>
      </div>
    </div>
    <p className="mt-6 text-center text-lg text-emerald-100/50">
      你不能靠加固城墙管理风浪。<br />
      <span className="text-emerald-300 font-bold">海水已经涨上来了。</span>
    </p>
  </SlideWrapper>;
}

function Slide05({ poll, onPoll }: { poll: string | null; onPoll: (v: string) => void }) {
  return <SlideWrapper eyebrow="三条迁徙航线 · 互动投票">
    <h2 className="text-3xl font-black text-white sm:text-4xl">你的组织在哪条航线上？</h2>
    {poll ? (
      <div className="mt-8 text-center">
        <div className="text-6xl">{poll === "enhance" ? "🌍" : poll === "reconstruct" ? "🚢" : "⚓"}</div>
        <p className="mt-4 text-xl font-bold text-emerald-200">
          {poll === "enhance" && "增强型——你在大陆上，正在给城墙加装AI"}
          {poll === "reconstruct" && "重构型——你在海上，正在改写航线"}
          {poll === "native" && "原生型——你生在海上，没有城墙的包袱"}
        </p>
        <p className="mt-4 text-base text-emerald-100/40">无论哪条航线，今天的课程都会帮你找到下一步的起点。→</p>
      </div>
    ) : (
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <button onClick={() => onPoll("enhance")} className="rounded-2xl border-2 border-dashed border-amber-300/20 bg-amber-300/[0.02] p-8 text-center transition hover:border-amber-300/40 hover:bg-amber-300/[0.06] hover:scale-[1.02] active:scale-95">
          <span className="text-4xl">🌍</span>
          <div className="mt-3 text-lg font-bold text-amber-200">增强型</div>
          <div className="mt-1 text-sm text-amber-100/40">岗位+AI<br />个人会用但组织没变</div>
        </button>
        <button onClick={() => onPoll("reconstruct")} className="rounded-2xl border-2 border-dashed border-emerald-300/20 bg-emerald-300/[0.02] p-8 text-center transition hover:border-emerald-300/40 hover:bg-emerald-300/[0.06] hover:scale-[1.02] active:scale-95">
          <span className="text-4xl">🚢</span>
          <div className="mt-3 text-lg font-bold text-emerald-200">重构型</div>
          <div className="mt-1 text-sm text-emerald-100/40">AI进入核心流程<br />开始改权责</div>
        </button>
        <button onClick={() => onPoll("native")} className="rounded-2xl border-2 border-dashed border-purple-300/20 bg-purple-300/[0.02] p-8 text-center transition hover:border-purple-300/40 hover:bg-purple-300/[0.06] hover:scale-[1.02] active:scale-95">
          <span className="text-4xl">⚓</span>
          <div className="mt-3 text-lg font-bold text-purple-200">原生型</div>
          <div className="mt-1 text-sm text-purple-100/40">从第一天<br />为AI而生</div>
        </button>
      </div>
    )}
    <p className="mt-6 text-sm text-emerald-100/35">三条航线可以并存——主营业务做增强，关键链路做重构，新业务探索原生。</p>
  </SlideWrapper>;
}

function Slide06() {
  return <SlideWrapper eyebrow="案例 · 筑龙学社">
    <h2 className="text-3xl font-black text-white sm:text-4xl">传统企业接住了AI</h2>
    <p className="mt-3 text-lg text-emerald-100/50">建筑行业剧烈收缩，三十多个训练营一个接一个停掉。他们做了什么？</p>
    <div className="mt-6 space-y-3">
      <div className="rounded-xl bg-white/[0.03] p-4"><span className="text-lg">🌱 </span><span className="text-base text-emerald-100/70"><strong className="text-emerald-200">起点：</strong>每周一句"来，说说你用AI做了什么"。没有强制、没有考核——六七个月后才开始改造流程。</span></div>
      <div className="rounded-xl bg-white/[0.03] p-4"><span className="text-lg">📊 </span><span className="text-base text-emerald-100/70"><strong className="text-emerald-200">销售：</strong>AI自动识别聊天、打标签、执行SOP。20人服务100万企微好友。</span></div>
      <div className="rounded-xl bg-white/[0.03] p-4"><span className="text-lg">📚 </span><span className="text-base text-emerald-100/70"><strong className="text-emerald-200">教研：</strong>教辅生产从1个月缩到1周。老师转为审稿者和判断者。</span></div>
      <div className="rounded-xl bg-white/[0.03] p-4"><span className="text-lg">🔑 </span><span className="text-base text-emerald-100/70"><strong className="text-emerald-200">真正的秘密：</strong>2018年引入阿米巴——项目负责人独立核算利润。AI到来前，闭环负责人已经被"预训练"好了。<strong className="text-amber-300">AI放大的是训练过的闭环负责人。</strong></span></div>
    </div>
    <div className="mt-4 rounded-xl bg-emerald-300/[0.05] border border-emerald-300/10 p-4 text-center text-lg text-emerald-100/70">
      团队 200人 → 30人 · AI业务贡献约 1/3 收入
    </div>
  </SlideWrapper>;
}

function Slide07() {
  return <SlideWrapper eyebrow="90天试航">
    <h2 className="text-3xl font-black text-white sm:text-4xl">你的第一艘船</h2>
    <p className="mt-3 text-lg text-emerald-100/50">不需要一夜推倒重构。你需要的是一个能跑、能验、能复制的<strong className="text-emerald-200">业务闭环</strong>。</p>
    <div className="mt-6 space-y-3">
      {[
        ["①", "重新定义问题", "选一个真实、具体、反复发生、可衡量的业务问题"],
        ["②", "画出完整闭环", "看闭环在哪里断，而不是哪个节点提效"],
        ["③", "任命并保护负责人", "给智能体、数据、工具和90天保护期——不只给任务不给权力"],
        ["④", "写下人机接口契约", "输入、输出、完成标准、升级边界、修正责任"],
        ["⑤", "沉淀成组织记忆", "接口、规则、提示词、验证清单、复盘资产"],
      ].map(([num, title, desc]) => (
        <div key={num} className="flex items-start gap-3 rounded-xl border border-emerald-200/10 bg-white/[0.02] p-4">
          <span className="text-2xl text-emerald-300">{num}</span>
          <div><div className="font-bold text-emerald-100">{title}</div><div className="text-sm text-emerald-100/50">{desc}</div></div>
        </div>
      ))}
    </div>
  </SlideWrapper>;
}

function Slide08({ onNext }: { onNext: () => void }) {
  return <SlideWrapper eyebrow="开始旅程">
    <div className="text-center">
      <h2 className="text-3xl font-black text-white sm:text-4xl">
        接下来6个模块<br />
        <span className="text-emerald-300">你会逐一掌握</span>
      </h2>
      <div className="mt-8 flex flex-wrap justify-center gap-3 text-base">
        {["💬 提示词", "🤖 智能体", "⚡ Skill", "📚 知识库", "🛡️ 风险", "🔄 回路"].map(label => (
          <span key={label} className="rounded-full border border-emerald-300/15 bg-emerald-300/[0.05] px-4 py-2 text-emerald-200">{label}</span>
        ))}
      </div>
      <p className="mt-8 text-xl text-emerald-100/60">
        最后完成实战项目——打造你的<br />
        <strong className="text-amber-300">第一个AI自动化工作流</strong>
      </p>
      <p className="mt-6 text-base text-emerald-100/40">
        不是学会用工具，<br />
        是学会让组织接住新生产力。
      </p>
      <button onClick={onNext}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-10 py-4 text-lg font-black text-[#07110f] transition hover:scale-105 active:scale-95">
        开始模块一：提示词 →
      </button>
    </div>
  </SlideWrapper>;
}
