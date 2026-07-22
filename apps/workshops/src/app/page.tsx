import Link from "next/link";
import { ArrowRight, CalendarDays, Sparkles, GraduationCap } from "lucide-react";
import { AppShell, Container, GlassCard, PrimaryLink, SectionLabel } from "@/components/ui";

const workshops = [
  {
    href: "/super-individual",
    icon: Sparkles,
    tag: "Workshop",
    title: "超级个体赋能工作坊",
    desc: "一天流程框架、核心术语、工具安装链接与课前问卷。从 Prompt 到 Skill 的完整路径。",
    highlight: "课前问卷",
  },
  {
    href: "/hr-bootcamp",
    icon: GraduationCap,
    tag: "Training",
    title: "AI赋能训练营 · HR篇",
    desc: "2小时HR AI个体赋能培训：提示词、智能体、Skill和知识库实战。先会用，再理解组织怎么接住AI。",
    highlight: "扫码加入",
    external: true,
  },
];

export default function WorkshopsHomePage() {
  return (
    <AppShell>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-emerald-200/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(45,212,191,0.22),transparent_28%),linear-gradient(135deg,rgba(3,16,15,0.98),rgba(5,35,30,0.9)_48%,rgba(5,10,9,0.98))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(116,242,202,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(116,242,202,0.05)_1px,transparent_1px)] bg-[size:72px_72px] opacity-45" />

        <Container className="relative py-20 text-center">
          <SectionLabel>Carbon-Silicon · Workshops</SectionLabel>
          <h1 className="mt-6 text-5xl font-black tracking-tight text-white sm:text-6xl">
            工作坊
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-emerald-50/65">
            碳硅组织系列工作坊，把书中的方法论变成可交付的现场体验。
            从课前准备到现场共创，一站式管理。
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <PrimaryLink href="/super-individual">
              超级个体工作坊 <ArrowRight className="ml-2 h-4 w-4" />
            </PrimaryLink>
          </div>
        </Container>
      </section>

      {/* Workshop Cards */}
      <Container className="py-14 lg:py-20">
        <SectionLabel>Available Workshops</SectionLabel>
        <h2 className="mt-3 text-3xl font-black text-white sm:text-4xl">当前可用工作坊</h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {workshops.map(({ href, icon: Icon, tag, title, desc, highlight, external }) => {
            const isExternal = external || href.startsWith("http");
            const Comp = isExternal ? "a" : Link;
            const extraProps = isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {};
            return (
            <Comp
              key={href}
              href={href.startsWith("http") ? href : `/workshops${href}`}
              className="group rounded-[28px] border border-emerald-200/14 bg-white/[0.035] p-6 transition hover:-translate-y-1 hover:border-emerald-200/35 hover:bg-white/[0.06]"
              {...extraProps}
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
            </Comp>
          )})}
        </div>
      </Container>

      {/* Assessment Entry */}
      <Container className="pb-20">
        <GlassCard className="p-8 text-center">
          <CalendarDays className="mx-auto h-10 w-10 text-emerald-300" />
          <h2 className="mt-6 text-2xl font-black text-white">组织 AI 诊断测评</h2>
          <p className="mt-3 text-emerald-50/60">
            基于螺旋模型与能量模型的在线测评，5 分钟定位组织进化阶段。
            支持工作坊现场采集和群体报告生成。
          </p>
          <div className="mt-8">
            <PrimaryLink href="/events/20260517-hr-od-workshop/start">
              开始诊断 <ArrowRight className="ml-2 h-4 w-4" />
            </PrimaryLink>
          </div>
        </GlassCard>
      </Container>
    </AppShell>
  );
}
