import { ArrowRight, BookOpenCheck, CalendarClock, ClipboardCheck, Download, FileText, ShieldCheck } from "lucide-react";
import { AppShell, Container, GlassCard, PrimaryLink, SecondaryLink, SectionLabel } from "@/components/ui";

export const metadata = {
  title: "超级个体赋能工作坊｜碳硅组织",
  description: "一天工作坊：从 Prompt 到 Skill，用 AI 输出高质量内容。",
};

const gateways = [
  {
    href: "/super-individual-workshop/concepts",
    icon: BookOpenCheck,
    label: "先学概念",
    title: "AI 入门迷你课",
    text: "用模块卡理解 AI 套娃、数据厨房、学习范式、大模型、Agent、Skills、Harness 和真实产品。",
    cta: "进入迷你课",
  },
  {
    href: "/super-individual-workshop/setup",
    icon: Download,
    label: "课前安装",
    title: "工具准备",
    text: "统一使用 StepClaw，同时准备 ima 远程知识库和 Obsidian 本地知识库。",
    cta: "查看安装清单",
  },
  {
    href: "/super-individual-workshop/schedule",
    icon: CalendarClock,
    label: "现场安排",
    title: "一天流程框架",
    text: "上午校准任务与 Skill，下午用真实材料重跑内容并完成案例诊所。",
    cta: "查看一天流程",
  },
  {
    href: "/super-individual-workshop/prework",
    icon: ClipboardCheck,
    label: "提交准备",
    title: "课前问卷",
    text: "提交 AI 经验、真实工作场景、现场任务和想带进来的非敏感材料。",
    cta: "填写课前问卷",
  },
];

export default function SuperIndividualWorkshopPage() {
  return (
    <AppShell>
      <section className="relative overflow-hidden border-b border-emerald-200/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_16%,rgba(103,240,199,0.18),transparent_30%),linear-gradient(135deg,rgba(3,16,15,0.98),rgba(5,35,30,0.92)_52%,rgba(5,10,9,0.98))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(116,242,202,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(116,242,202,0.05)_1px,transparent_1px)] bg-[size:72px_72px] opacity-45" />
        <Container className="relative py-16 sm:py-20 lg:py-24">
          <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr] lg:items-end">
            <div>
              <SectionLabel>Super Individual Workshop</SectionLabel>
              <h1 className="max-w-4xl text-5xl font-black leading-[1.03] tracking-tight text-white sm:text-6xl lg:text-7xl">
                超级个体赋能工作坊
                <span className="mt-4 block text-3xl leading-tight text-emerald-100 sm:text-4xl">从 AI 入门到可复用 Skill</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-emerald-50/72 sm:text-xl">
                入口页只保留学习路径。按顺序完成概念速读、工具准备、流程了解和课前问卷，带着真实体验与真实任务进场。
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <PrimaryLink href="/super-individual-workshop/concepts">
                  开始 AI 入门迷你课 <ArrowRight className="ml-2 h-4 w-4" />
                </PrimaryLink>
                <SecondaryLink href="/super-individual-workshop/prework">直接填写问卷</SecondaryLink>
              </div>
            </div>
            <GlassCard className="p-6 sm:p-7">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["12人以内", "小班案例诊所"],
                  ["9:30-17:00", "含 90 分钟午休"],
                  ["3件产出", "内容初稿、Skill、工作流"],
                ].map(([value, label]) => (
                  <div key={label} className="rounded-3xl border border-emerald-200/12 bg-black/20 p-4">
                    <div className="text-2xl font-black text-white">{value}</div>
                    <div className="mt-2 text-xs font-semibold text-emerald-100/58">{label}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 rounded-[24px] border border-emerald-200/12 bg-white/[0.045] p-5">
                <h2 className="text-2xl font-black text-white">最终带走什么</h2>
                <div className="mt-4 grid gap-3">
                  {["一份真实内容初稿 v0.8", "一个个人 Skill 雏形", "一页纸 AI 内容工作流模板", "课后作业：个人 AI 协作卡片"].map((item) => (
                    <div key={item} className="flex items-start gap-3 text-sm leading-6 text-emerald-50/75">
                      <ClipboardCheck className="mt-0.5 h-4 w-4 flex-none text-emerald-200" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </GlassCard>
          </div>
        </Container>
      </section>

      <Container className="py-14 lg:py-20">
        <section>
          <div className="mb-6">
            <SectionLabel>Learning Path</SectionLabel>
            <h2 className="text-3xl font-black text-white sm:text-4xl">课前进入顺序</h2>
            <p className="mt-4 max-w-3xl text-base leading-8 text-emerald-50/64">
              每个入口都是一个独立页面。不要在主页里一次性塞完所有内容，学员只需要按当前任务点击进入。
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {gateways.map((item, index) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.href}
                  href={item.href}
                  className="group rounded-[30px] border border-emerald-200/14 bg-[#0c201c]/75 p-5 shadow-2xl shadow-black/15 transition hover:-translate-y-1 hover:border-emerald-200/35 hover:bg-[#102b25]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/16 bg-emerald-300/10 px-3 py-1 text-xs font-black text-emerald-200">
                      {String(index + 1).padStart(2, "0")} · {item.label}
                    </div>
                    <div className="grid h-11 w-11 flex-none place-items-center rounded-2xl border border-emerald-200/16 bg-black/20 text-emerald-200">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="mt-5 text-2xl font-black text-white">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-emerald-50/62">{item.text}</p>
                  <div className="mt-5 inline-flex items-center text-sm font-black text-emerald-200">
                    {item.cta}
                    <ArrowRight className="ml-2 h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </a>
              );
            })}
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-3">
          {[
            { icon: FileText, title: "方案 / 表达", text: "培训方案、招聘方案、文章、发言稿、课程大纲。" },
            { icon: BookOpenCheck, title: "分析 / 总结", text: "会议纪要、访谈总结、调研报告、问题诊断。" },
            { icon: ShieldCheck, title: "真实但脱敏", text: "可带真实材料进场，但不建议使用公司敏感信息。" },
          ].map(({ icon: Icon, title, text }) => (
            <GlassCard key={title} className="p-5">
              <Icon className="h-6 w-6 text-emerald-200" />
              <h3 className="mt-5 text-xl font-black text-white">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-emerald-50/62">{text}</p>
            </GlassCard>
          ))}
        </section>
      </Container>
    </AppShell>
  );
}
