import Link from "next/link";
import { Brain, CircuitBoard, Clock3, FileStack, Inbox, Network, RotateCcw } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listCompletedLoopDesignSessions, listLoopInboxSessions, listRecentSessions } from "@/lib/sessions";
import { NewSessionButton } from "@/components/new-session-button";
import { AdminConsoleLink } from "@/components/admin-console-link";
import { SessionList } from "@/components/session-list";
import type { LoopDesignerSession } from "@/lib/session-types";

export default async function HomePage() {
  const user = await requireUser("/loop-designer");
  const [inboxSessions, sessions, completedLoopDesigns] = await Promise.all([
    listLoopInboxSessions(user),
    listRecentSessions(user),
    listCompletedLoopDesignSessions(user),
  ]);
  const unfinished = sessions.find((item) => item.status === "in_progress" || item.status === "failed");

  return (
    <main className="min-h-screen px-5 py-6 md:px-10 md:py-10">
      <header className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center border border-[var(--acid)] text-[var(--acid)]"><CircuitBoard size={20} /></span>
          <div>
            <div className="mono text-[10px] tracking-[.25em] text-white/42">LOOP OS / 组织回路管理系统</div>
            <div className="text-lg font-bold">组织回路管理系统</div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/profile" className="text-sm text-white/55 hover:text-[var(--acid)]">用户：{user.displayName}</Link>
          <AdminConsoleLink />
          <a href={(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000") + "/tools"} className="mono text-xs text-white/55 hover:text-[var(--acid)]">
            工具站 ↗
          </a>
          <form action="/loop-designer/api/auth/logout" method="post">
            <button className="mono text-xs text-white/55 hover:text-[var(--acid)]">退出</button>
          </form>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-7 py-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:py-14">
        <div className="rise">
          <div className="mono mb-5 inline-flex border border-[var(--signal)] px-3 py-1 text-[10px] tracking-[.2em] text-[var(--signal)]">
            START HERE
          </div>
          <h1 className="max-w-5xl text-4xl font-black leading-[1.08] md:text-6xl">
            构建一条新的业务回路
          </h1>
          <p className="mt-6 max-w-3xl text-lg leading-9 text-white/62">
            先从一个真实业务问题开始：明确目标，拆出关键步骤，再生成一版可以讨论和修改的人机协作回路方案。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <NewSessionButton label="开启新回路设计" loadingLabel="正在建立目标锚点..." />
            {unfinished ? (
              <Link href={`/sessions/${unfinished.id}`} className="inline-flex items-center gap-2 border border-white/20 px-6 py-4 font-bold text-white hover:border-[var(--cyan)]">
                <RotateCcw size={17} /> 继续上次设计
              </Link>
            ) : null}
          </div>
        </div>

        <div className="panel rise p-6 [animation-delay:120ms] md:p-8">
          <div className="mono flex items-center justify-between text-[10px] tracking-[.18em] text-white/40">
            <span>回路 Inbox</span><span>{inboxSessions.length}</span>
          </div>
          <div className="mt-6 space-y-4">
            {inboxSessions.length ? inboxSessions.map((session) => (
              <BlueprintInboxCard key={session.id} session={session} />
            )) : (
              <div className="border border-white/10 bg-black/20 p-5">
                <span className="grid h-10 w-10 place-items-center border border-white/12 text-white/38"><Inbox size={18} /></span>
                <h2 className="mt-5 text-xl font-black">暂无待深化回路</h2>
                <p className="mt-3 text-sm leading-7 text-white/48">蓝图工具锁定首选回路后，会出现在这里。你仍然可以直接开启新回路设计。</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {completedLoopDesigns.length ? <SessionList sessions={completedLoopDesigns} /> : null}

      <section className="mx-auto grid max-w-7xl gap-4 border-t border-white/10 py-8 md:grid-cols-2">
        <SystemCard
          icon={<Network size={22} />}
          title="回路资产台"
          text="当一条回路被确认后，它会进入这里，变成可复用的企业回路清单：能看版本、上下级关系、依赖关系和后续修改记录。"
          href="/assets"
          action="查看已沉淀回路"
        />
        <SystemCard
          icon={<Brain size={22} />}
          title="组织记忆"
          text="系统会从已确认回路中记住角色、业务术语、常见卡点和成功经验，让下一次设计不再从零开始。"
          href="/memory"
          action="查看可复用经验"
        />
      </section>

      <section className="mx-auto max-w-7xl border-t border-white/10 py-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Feature icon={<Network size={18} />} label="ASSETS" text="企业级 LoopAsset / LoopVersion 资产网络" />
          <Feature icon={<Brain size={18} />} label="MEMORY" text="生成时复用组织角色、术语和同域历史回路" />
          <Feature icon={<CircuitBoard size={18} />} label="MATRIX" text="Matrix Origin 启动、绑定和 DesignStudy 回流" />
          <Feature icon={<Clock3 size={18} />} label="DESIGN" text="保留单回路设计器作为资产生成入口" />
          <Feature icon={<FileStack size={18} />} label="EXPORTS" text="Markdown、PDF、飞书文档和审阅材料" />
        </div>
      </section>
    </main>
  );
}

function BlueprintInboxCard({ session }: { session: LoopDesignerSession }) {
  const blueprint = session.outputs.blueprint;
  const candidate = blueprint?.candidates.find((item) => item.id === blueprint.preferredCandidateId) ?? blueprint?.candidates[0] ?? null;
  if (!candidate) return null;
  return (
    <article className="border border-[var(--acid)]/25 bg-[var(--acid)]/8 p-5">
      <div className="mono text-[10px] tracking-[.16em] text-[var(--acid)]">BLUEPRINT LOCKED</div>
      <h2 className="mt-3 text-2xl font-black leading-tight">{candidate.title}</h2>
      <p className="mt-3 text-sm leading-7 text-white/58">{candidate.valueDescription}</p>
      <div className="mt-4 border-t border-white/10 pt-4 text-xs leading-6 text-white/42">
        成功标志：{candidate.successCriteria}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        <NewSessionButton
          sourceSessionId={session.id}
          label="开始此回路设计"
          loadingLabel="正在建立目标锚点..."
          className="inline-flex items-center gap-2 bg-[var(--acid)] px-4 py-3 text-sm font-black text-black hover:bg-white disabled:opacity-50"
        />
      </div>
    </article>
  );
}

function SystemCard({ icon, title, text, href, action }: { icon: React.ReactNode; title: string; text: string; href: string; action: string }) {
  return (
    <Link href={href} className="group flex min-h-56 flex-col justify-between border border-[var(--acid)]/35 bg-[var(--acid)]/8 p-5 hover:border-[var(--acid)]">
      <div>
        <span className="grid h-11 w-11 place-items-center border border-[var(--acid)]/35 text-[var(--acid)]">{icon}</span>
        <h2 className="mt-6 text-2xl font-black leading-tight">{title}</h2>
        <p className="mt-4 text-sm leading-7 text-white/58">{text}</p>
      </div>
      <span className="mt-6 text-sm font-bold text-[var(--acid)] group-hover:text-white">{action}</span>
    </Link>
  );
}

function Feature({ icon, label, text }: { icon: React.ReactNode; label: string; text: string }) {
  return <div className="grid grid-cols-[40px_90px_1fr] items-center gap-3"><span className="grid h-10 w-10 place-items-center border border-white/12 text-[var(--cyan)]">{icon}</span><b className="mono text-xs text-[var(--acid)]">{label}</b><span className="text-sm leading-6 text-white/58">{text}</span></div>;
}
