import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles, QrCode } from "lucide-react";

export const metadata: Metadata = {
  title: "碳硅组织工作坊 | Workshops",
  description: "碳硅组织系列工作坊入口 — 超级个体赋能、现场共创、组织诊断与 HR 赋能。",
};

const workshops = [
  {
    href: "/workshops/super-individual",
    icon: Sparkles,
    tag: "Workshop",
    title: "超级个体赋能工作坊",
    desc: "一天流程框架、核心术语、工具安装链接与课前问卷。从 Prompt 到 Skill 的完整路径。",
    highlight: "课前问卷",
  },
  {
    href: "/workshops/cocreate",
    icon: QrCode,
    tag: "PWA",
    title: "现场共创台",
    desc: "扫码即进的现场 H5。AI 生成 3 条备选业务回路，现场编辑锁定，5 分钟出结果。",
    highlight: "扫码进入",
  },
];

export default function WorkshopsHomePage() {
  return (
    <main className="min-h-screen bg-[#06110f] text-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-emerald-200/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(45,212,191,0.18),transparent_30%)]" />
        <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
          <p className="text-sm font-medium tracking-widest text-emerald-300/70">
            CARBON-SILICON · WORKSHOPS
          </p>
          <h1 className="mt-6 text-5xl font-black tracking-tight sm:text-6xl">
            工作坊
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-emerald-50/65">
            碳硅组织系列工作坊，把书中的方法论变成可交付的现场体验。
            从课前准备到现场共创，一站式管理。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href="/workshops/super-individual"
              className="inline-flex items-center gap-2 rounded-full bg-emerald-300 px-8 py-3 text-sm font-black text-[#06110f] transition hover:bg-emerald-200"
            >
              超级个体工作坊 <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/workshops/cocreate"
              className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 px-8 py-3 text-sm font-bold text-emerald-100 transition hover:bg-white/5"
            >
              现场共创台
            </Link>
          </div>
        </div>
      </section>

      {/* Workshop Cards */}
      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="text-2xl font-black text-white">当前可用工作坊</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {workshops.map(({ href, icon: Icon, tag, title, desc, highlight }) => (
            <Link
              key={href}
              href={href}
              className="group rounded-[28px] border border-emerald-200/14 bg-white/[0.035] p-6 transition hover:-translate-y-1 hover:border-emerald-200/35 hover:bg-white/[0.06]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="rounded-full border border-emerald-200/15 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
                  {tag}
                </div>
                <Icon className="h-5 w-5 text-emerald-300" />
              </div>
              <h3 className="mt-4 text-xl font-black leading-7 text-white group-hover:text-emerald-100">
                {title}
              </h3>
              <p className="mt-3 text-sm leading-7 text-emerald-50/62">{desc}</p>
              <div className="mt-5 flex items-center justify-between">
                <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
                  {highlight}
                </span>
                <span className="flex items-center gap-1 text-sm font-bold text-emerald-200">
                  进入 <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Assessment Entry */}
      <section className="border-t border-emerald-200/10">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-emerald-300" />
          <h2 className="mt-6 text-2xl font-black">组织 AI 诊断测评</h2>
          <p className="mt-3 text-emerald-50/60">
            基于螺旋模型与能量模型的在线测评，5 分钟定位组织进化阶段。
            支持工作坊现场采集和群体报告生成。
          </p>
          <Link
            href="/workshops/events/20260517-hr-od-workshop/start"
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-emerald-300 px-8 py-3 text-sm font-black text-[#06110f] transition hover:bg-emerald-200"
          >
            开始诊断 <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>
    </main>
  );
}
