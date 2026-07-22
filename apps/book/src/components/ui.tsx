import Link from "next/link";
import type { ReactNode } from "react";
import { HeaderAuth } from "@/components/header-auth";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen overflow-hidden bg-[#06110f] text-[#eef9f4]">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-14rem] top-[-16rem] h-[36rem] w-[36rem] rounded-full bg-emerald-400/15 blur-3xl" />
        <div className="absolute right-[-10rem] top-12 h-[28rem] w-[28rem] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(116,242,202,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(116,242,202,0.05)_1px,transparent_1px)] bg-[size:64px_64px] opacity-40" />
      </div>
      <header className="no-print relative z-10 border-b border-emerald-200/10 bg-black/20 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-full border border-emerald-300/30 bg-emerald-300/10 text-sm font-black text-emerald-200">
              CSi
            </span>
            <span>
              <span className="block text-sm font-semibold text-white">碳硅组织</span>
              <span className="block text-xs text-emerald-100/55">Book · Tools · Diagnostics</span>
            </span>
          </Link>
          <nav className="hidden items-center gap-2 text-sm text-emerald-50/70 sm:flex">
            <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/" prefetch={false}>
              首页
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/tools">
              工具库
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/super-individual-workshop">
              超级个体
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/glossary" prefetch={false}>
              术语表
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/admin/runs" prefetch={false}>
              入口管理
            </Link>
            <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/admin/runs/new" prefetch={false}>
              创建入口
            </Link>
            <HeaderAuth />
          </nav>
        </div>
      </header>
      <main className="relative z-10 flex-1">{children}</main>
    </div>
  );
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-7xl px-5 ${className}`}>{children}</div>;
}

export function GlassCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[28px] border border-emerald-200/15 bg-[#0c201c]/75 shadow-2xl shadow-black/20 backdrop-blur ${className}`}>
      {children}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-300/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-200">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" />
      {children}
    </div>
  );
}

export function PrimaryLink({ href, children, prefetch, className = "" }: { href: string; children: ReactNode; prefetch?: boolean; className?: string }) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={`inline-flex items-center justify-center rounded-full bg-emerald-300 px-5 py-3 text-sm font-bold text-[#06110f] shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-200 ${className}`}
    >
      {children}
    </Link>
  );
}

export function SecondaryLink({ href, children, prefetch, className = "" }: { href: string; children: ReactNode; prefetch?: boolean; className?: string }) {
  return (
    <Link
      href={href}
      prefetch={prefetch}
      className={`inline-flex items-center justify-center rounded-full border border-emerald-200/25 px-5 py-3 text-sm font-bold text-emerald-50 transition hover:bg-white/10 ${className}`}
    >
      {children}
    </Link>
  );
}

export function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail?: string;
}) {
  return (
    <div className="rounded-3xl border border-emerald-200/15 bg-white/[0.045] p-5">
      <div className="text-xs font-semibold text-emerald-200/70">{label}</div>
      <div className="mt-2 text-3xl font-black text-white">{value}</div>
      {detail ? <div className="mt-2 text-sm leading-6 text-emerald-50/60">{detail}</div> : null}
    </div>
  );
}
