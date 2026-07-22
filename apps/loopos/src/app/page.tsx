import Link from "next/link";

/**
 * LoopOS 落地页 V7+ — 人机协作的组织操作系统
 * 核心价值三角：人机协作回路 / 组织大脑 / 持续进化
 * 视觉：自定义 SVG 图标系统，无系统缺省 emoji
 */

/* ─── 自定义 SVG 图标系统 ─── */
function IconNeural({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" opacity="0.2" />
      <circle cx="24" cy="14" r="3" fill="currentColor" opacity="0.9" />
      <circle cx="14" cy="30" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="34" cy="30" r="3" fill="currentColor" opacity="0.7" />
      <circle cx="24" cy="38" r="2.5" fill="currentColor" opacity="0.5" />
      <line x1="24" y1="17" x2="14" y2="27" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="24" y1="17" x2="34" y2="27" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="14" y1="33" x2="24" y2="35.5" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <line x1="34" y1="33" x2="24" y2="35.5" stroke="currentColor" strokeWidth="1" opacity="0.3" />
      <circle cx="24" cy="24" r="1.5" fill="currentColor" />
    </svg>
  );
}

function IconHumanAgent({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <circle cx="16" cy="18" r="5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M16 23 Q10 28 8 36 L8 40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
      <path d="M16 23 Q22 28 24 36 L24 40" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

function IconSiliconAgent({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <rect x="14" y="10" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="19" cy="17" r="1.5" fill="currentColor" />
      <circle cx="29" cy="17" r="1.5" fill="currentColor" />
      <line x1="19" y1="23" x2="29" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="24" y1="30" x2="24" y2="36" stroke="currentColor" strokeWidth="1.5" />
      <line x1="20" y1="36" x2="28" y2="36" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconLoop({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <path d="M12 24 Q12 14 24 14 Q34 14 36 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M36 24 Q36 34 24 34 Q14 34 12 28" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" />
      <polygon points="33,17 38,20 33,23" fill="currentColor" />
      <polygon points="15,31 10,28 15,25" fill="currentColor" />
    </svg>
  );
}

function IconTension({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <path d="M24 8 L24 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M24 32 L24 40" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M8 24 L16 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M32 24 L40 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="24" cy="24" r="6" stroke="currentColor" strokeWidth="2" fill="none" />
      <circle cx="24" cy="24" r="2" fill="currentColor" />
    </svg>
  );
}

function IconEvolution({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <path d="M10 34 Q16 28 24 28 Q32 28 38 34" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.4" />
      <path d="M10 26 Q16 20 24 20 Q32 20 38 26" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.6" />
      <path d="M10 18 Q16 12 24 12 Q32 12 38 18" stroke="currentColor" strokeWidth="1.5" fill="none" opacity="0.8" />
      <circle cx="24" cy="12" r="2.5" fill="currentColor" />
      <circle cx="24" cy="20" r="2" fill="currentColor" opacity="0.6" />
      <circle cx="24" cy="28" r="1.5" fill="currentColor" opacity="0.4" />
    </svg>
  );
}

function IconShield({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" fill="none" className={className}>
      <path d="M24 8 L36 14 L36 24 Q36 34 24 40 Q12 34 12 24 L12 14 Z" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M18 24 L22 28 L30 20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

/* ─── 品牌标识 ─── */
function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 36 36" fill="none">
        <circle cx="18" cy="18" r="16" stroke="#4a7c59" strokeWidth="1.5" opacity="0.25" />
        <circle cx="18" cy="18" r="10" stroke="#4a7c59" strokeWidth="1" opacity="0.4" strokeDasharray="2 3" />
        <circle cx="18" cy="8" r="2.5" fill="#4a7c59" />
        <circle cx="10" cy="22" r="2" fill="#4a7c59" opacity="0.7" />
        <circle cx="26" cy="22" r="2" fill="#4a7c59" opacity="0.7" />
        <line x1="18" y1="10.5" x2="11" y2="20" stroke="#4a7c59" strokeWidth="0.8" opacity="0.4" />
        <line x1="18" y1="10.5" x2="25" y2="20" stroke="#4a7c59" strokeWidth="0.8" opacity="0.4" />
        <circle cx="18" cy="18" r="1.5" fill="#4a7c59" />
      </svg>
      <span className="font-serif text-lg font-medium tracking-tight">LoopOS</span>
    </div>
  );
}

/* ─── 页面 ─── */
export default function Home() {
  return (
    <main className="flex flex-1 flex-col">
      {/* 导航 */}
      <nav className="flex items-center justify-between px-6 py-5 md:px-12">
        <BrandMark />
        <div className="flex items-center gap-6">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">登录</Link>
          <Link href="/register" className="rounded-button bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity">免费开始</Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="flex flex-1 flex-col items-center justify-center px-6 py-16 md:py-24">
        <div className="max-w-3xl text-center">
          {/* 呼吸的品牌标识 */}
          <div className="mb-8 flex justify-center">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 rounded-full border-2 border-moss/30 animate-breathe" />
              <div className="absolute inset-3 rounded-full bg-moss/15" />
              <IconNeural className="absolute inset-0 h-16 w-16 text-moss" />
            </div>
          </div>

          <div className="inline-flex items-center gap-2 rounded-full border border-moss/20 bg-moss-pale/30 px-3 py-1 mb-6">
            <span className="text-xs font-medium text-moss">AI 原生的组织操作系统</span>
          </div>

          <h1 className="font-serif text-4xl font-medium leading-tight tracking-tight md:text-5xl">
            未来的组织，<br />
            <span className="text-moss">人类与智能体协同进化。</span>
          </h1>

          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
            LoopOS 让人机协作的回路成为组织运转的核心——<span className="text-foreground">组织大脑</span>实时感知张力，
            <span className="text-foreground">人机协同</span>推动决策，每个层级持续进化。
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register" className="rounded-button bg-primary px-8 py-3 text-base font-medium text-primary-foreground hover:opacity-90 transition-opacity">
              免费创建组织
            </Link>
            <Link href="#how" className="rounded-button border border-border px-8 py-3 text-base font-medium hover:bg-muted transition-colors">
              了解运作方式
            </Link>
          </div>
        </div>
      </section>

      {/* 核心价值三角 */}
      <section className="border-t border-border bg-card/30 px-6 py-20 md:px-12">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-3 text-center font-serif text-2xl font-medium">三个核心能力</h2>
          <p className="mb-12 text-center text-sm text-muted-foreground">让组织从"管控机器"进化为"有感知、有节奏、会进化的生命体"</p>

          <div className="grid gap-6 md:grid-cols-3">
            {/* 人机协作回路 */}
            <div className="rounded-card border border-border bg-card p-7 shadow-soft card-hover animate-fade-rise">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex items-center -space-x-1">
                  <IconHumanAgent className="h-10 w-10 text-moss" />
                  <IconSiliconAgent className="h-10 w-10 text-moss/70" />
                </div>
                <IconLoop className="h-6 w-6 text-moss/40" />
              </div>
              <h3 className="mb-2 font-serif text-lg font-medium">人机协作回路</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                人类与硅基智能体在同一治理结构中协同——智能体可被正式分配角色、感知数据异常、提交候选张力。人始终拥有最终决策权。
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="text-[10px] rounded-full bg-moss-pale px-2 py-0.5 text-moss">硅基员工</span>
                <span className="text-[10px] rounded-full bg-moss-pale px-2 py-0.5 text-moss">角色分配</span>
                <span className="text-[10px] rounded-full bg-moss-pale px-2 py-0.5 text-moss">人在回路</span>
              </div>
            </div>

            {/* 组织大脑 */}
            <div className="rounded-card border border-border bg-card p-7 shadow-soft card-hover animate-fade-rise" style={{ animationDelay: "80ms" }}>
              <div className="mb-4">
                <IconNeural className="h-12 w-12 text-moss" />
              </div>
              <h3 className="mb-2 font-serif text-lg font-medium">组织大脑</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                一个实时感知组织状态的 AI 中枢——看见张力在哪、哪些回路在瓶颈、哪些角色在空转。每个回答都有证据溯源，不猜测、不编造。
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="text-[10px] rounded-full bg-moss-pale px-2 py-0.5 text-moss">实时感知</span>
                <span className="text-[10px] rounded-full bg-moss-pale px-2 py-0.5 text-moss">证据溯源</span>
                <span className="text-[10px] rounded-full bg-moss-pale px-2 py-0.5 text-moss">预览确认</span>
              </div>
            </div>

            {/* 持续进化 */}
            <div className="rounded-card border border-border bg-card p-7 shadow-soft card-hover animate-fade-rise" style={{ animationDelay: "160ms" }}>
              <div className="mb-4">
                <IconEvolution className="h-12 w-12 text-moss" />
              </div>
              <h3 className="mb-2 font-serif text-lg font-medium">持续进化</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">
                张力是组织感知差距的信号。从战术会到治理会，从月度日志到季度宪章——组织结构像 DNA 一样，基于真实运转数据持续迭代。
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <span className="text-[10px] rounded-full bg-moss-pale px-2 py-0.5 text-moss">张力驱动</span>
                <span className="text-[10px] rounded-full bg-moss-pale px-2 py-0.5 text-moss">治理会议</span>
                <span className="text-[10px] rounded-full bg-moss-pale px-2 py-0.5 text-moss">宪章迭代</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 运作方式 */}
      <section id="how" className="px-6 py-20 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-3 text-center font-serif text-2xl font-medium">一个回路，持续运转</h2>
          <p className="mb-12 text-center text-sm text-muted-foreground">从感知到进化，四个环节构成组织的呼吸节奏</p>

          {/* 流程图 */}
          <div className="grid gap-4 md:grid-cols-4">
            {[
              { icon: IconTension, title: "感知张力", desc: "人或智能体发现'现实与期望的差距'，提交张力信号", step: "01" },
              { icon: IconNeural, title: "大脑分析", desc: "组织大脑检索上下文，翻译张力，起草结构化提案", step: "02" },
              { icon: IconShield, title: "会议裁决", desc: "战术会产出行动项，治理会走 IDM 流程修改组织结构", step: "03" },
              { icon: IconEvolution, title: "结构进化", desc: "采纳的提案自动修改角色/回路/归属，审计全程可追溯", step: "04" },
            ].map((item, i) => (
              <div key={i} className="relative animate-fade-rise" style={{ animationDelay: `${i * 60}ms` }}>
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 -right-2 z-10">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8 L13 8" stroke="#4a7c59" strokeWidth="1" opacity="0.3" />
                      <polygon points="10,5 13,8 10,11" fill="#4a7c59" opacity="0.3" />
                    </svg>
                  </div>
                )}
                <div className="rounded-card border border-border bg-card p-5 shadow-soft">
                  <div className="flex items-center justify-between mb-3">
                    <item.icon className="h-10 w-10 text-moss" />
                    <span className="font-serif text-2xl text-moss/20 font-medium">{item.step}</span>
                  </div>
                  <h3 className="mb-1.5 text-sm font-medium">{item.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 产品一瞥：回路地图 */}
      <section className="border-t border-border bg-card/30 px-6 py-20 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-3 text-center font-serif text-2xl font-medium">看见你的组织</h2>
          <p className="mb-8 text-center text-sm text-muted-foreground">每个回路是一个自闭环的细胞，人机协作在细胞内发生</p>

          <div className="rounded-card border border-border bg-background p-8 shadow-card">
            <svg viewBox="0 0 500 320" className="w-full h-auto" style={{ maxHeight: "340px" }}>
              <defs>
                <radialGradient id="organism" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#4a7c59" stopOpacity="0.06" />
                  <stop offset="100%" stopColor="#4a7c59" stopOpacity="0.02" />
                </radialGradient>
                <radialGradient id="cell-prod" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#4a7c59" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#4a7c59" stopOpacity="0.03" />
                </radialGradient>
                <radialGradient id="cell-infra" cx="50%" cy="40%" r="60%">
                  <stop offset="0%" stopColor="#a8927c" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#a8927c" stopOpacity="0.03" />
                </radialGradient>
              </defs>

              {/* 组织边界 */}
              <circle cx="250" cy="175" r="140" fill="url(#organism)" stroke="#4a7c59" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.4" />
              <text x="250" y="20" textAnchor="middle" style={{ fontSize: "13px", fontWeight: 600, fill: "#4a7c59", fontFamily: "serif" }}>
                ❋ 组织
              </text>

              {/* 数据回路 */}
              <circle cx="160" cy="130" r="35" fill="url(#cell-prod)" stroke="#4a7c59" strokeWidth="2" />
              <text x="160" y="128" textAnchor="middle" style={{ fontSize: "10px", fontWeight: 600, fill: "#1f1b16" }}>数据</text>
              <text x="160" y="140" textAnchor="middle" style={{ fontSize: "8px", fill: "#6b6259" }}>3人</text>
              <circle cx="150" cy="120" r="2.5" fill="#4a7c59" />
              <circle cx="157" cy="118" r="2.5" fill="#4a7c59" />
              <rect x="164" y="116" width="4" height="4" rx="0.8" fill="#4a7c59" opacity="0.6" />

              {/* 预训练回路 */}
              <circle cx="340" cy="125" r="35" fill="url(#cell-prod)" stroke="#4a7c59" strokeWidth="2" />
              <text x="340" y="123" textAnchor="middle" style={{ fontSize: "10px", fontWeight: 600, fill: "#1f1b16" }}>预训练</text>
              <text x="340" y="135" textAnchor="middle" style={{ fontSize: "8px", fill: "#6b6259" }}>5人</text>
              <circle cx="330" cy="115" r="2.5" fill="#4a7c59" />
              <circle cx="337" cy="113" r="2.5" fill="#4a7c59" />
              <circle cx="344" cy="112" r="2.5" fill="#4a7c59" />
              <rect x="350" y="111" width="4" height="4" rx="0.8" fill="#4a7c59" opacity="0.6" />

              {/* 工程基座 */}
              <circle cx="175" cy="225" r="33" fill="url(#cell-infra)" stroke="#a8927c" strokeWidth="2" />
              <text x="175" y="223" textAnchor="middle" style={{ fontSize: "10px", fontWeight: 600, fill: "#1f1b16" }}>工程基座</text>
              <text x="175" y="235" textAnchor="middle" style={{ fontSize: "8px", fill: "#6b6259" }}>4人</text>
              <circle cx="165" cy="216" r="2.5" fill="#a8927c" />
              <circle cx="172" cy="214" r="2.5" fill="#a8927c" />

              {/* 后训练 */}
              <circle cx="335" cy="225" r="33" fill="url(#cell-prod)" stroke="#4a7c59" strokeWidth="2" />
              <text x="335" y="223" textAnchor="middle" style={{ fontSize: "10px", fontWeight: 600, fill: "#1f1b16" }}>后训练</text>
              <text x="335" y="235" textAnchor="middle" style={{ fontSize: "8px", fill: "#6b6259" }}>3人</text>
              <circle cx="325" cy="216" r="2.5" fill="#4a7c59" />
              <rect x="332" y="214" width="4" height="4" rx="0.8" fill="#4a7c59" opacity="0.6" />

              {/* 张力信号 */}
              <g opacity="0.7">
                <circle cx="250" cy="175" r="4" fill="none" stroke="#c97b5e" strokeWidth="1.5">
                  <animate attributeName="r" values="4;12;4" dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.7;0;0.7" dur="2.5s" repeatCount="indefinite" />
                </circle>
                <text x="260" y="172" style={{ fontSize: "9px", fill: "#c97b5e" }}>张力</text>
              </g>

              {/* 图例 */}
              <g transform="translate(20, 300)">
                <circle cx="4" cy="0" r="3" fill="#4a7c59" />
                <text x="12" y="3" style={{ fontSize: "9px", fill: "#6b6259" }}>人类成员</text>
                <rect x="68" y="-2.5" width="5" height="5" rx="1" fill="#4a7c59" opacity="0.6" />
                <text x="78" y="3" style={{ fontSize: "9px", fill: "#6b6259" }}>硅基成员</text>
              </g>
            </svg>
          </div>
        </div>
      </section>

      {/* AI 安全承诺 */}
      <section className="px-6 py-16 md:px-12">
        <div className="mx-auto max-w-3xl text-center">
          <div className="mb-4 flex justify-center">
            <IconShield className="h-12 w-12 text-moss/60" />
          </div>
          <h2 className="mb-3 font-serif text-xl font-medium">AI 做教练，不做决策者</h2>
          <p className="text-sm leading-relaxed text-muted-foreground max-w-xl mx-auto">
            组织大脑的每一次写操作都经过"预览→人工确认→审计"三阶段。AI 起草提案、翻译张力、守护会议纪律——但采纳或否决的权力永远在参会人手中。所有 AI 行为可审计、可追溯、可回滚。
          </p>
        </div>
      </section>

      {/* 底部 CTA */}
      <section className="border-t border-border px-6 py-20 md:px-12 text-center">
        <div className="mx-auto max-w-2xl">
          <div className="mb-6 flex justify-center">
            <div className="relative h-12 w-12">
              <div className="absolute inset-0 rounded-full border-2 border-moss/30 animate-breathe" />
              <div className="absolute inset-3 rounded-full bg-moss/20" />
              <div className="absolute inset-4 rounded-full bg-moss" />
            </div>
          </div>
          <h2 className="font-serif text-2xl font-medium mb-4">让组织学会自我生长</h2>
          <p className="text-sm text-muted-foreground mb-8">3 分钟创建组织，一键初始化回路结构，立即开始第一次张力。</p>
          <Link href="/register" className="inline-block rounded-button bg-primary px-8 py-3 text-base font-medium text-primary-foreground hover:opacity-90 transition-opacity">
            免费创建组织
          </Link>
        </div>
      </section>

      {/* 页脚 */}
      <footer className="border-t border-border px-6 py-8 text-center">
        <div className="flex items-center justify-center gap-2 mb-2">
          <BrandMark size={24} />
        </div>
        <p className="text-xs text-muted-foreground">人机协作的组织操作系统 · 让人类与智能体协同进化</p>
      </footer>
    </main>
  );
}
