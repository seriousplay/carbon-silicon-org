export const dynamic = "force-dynamic";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import { AppShell, Container, GlassCard, SecondaryLink, SectionLabel } from "@/components/ui";
import { prework, tools } from "../content";

export const metadata = {
  title: "工具准备｜超级个体赋能工作坊",
  description: "StepClaw、ima、Obsidian 与 OpenClaw 的课前安装说明。",
};

export default function SetupPage() {
  return (
    <AppShell>
      <Container className="py-10 lg:py-14">
        <SecondaryLink href="/super-individual-workshop" className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回入口主页
        </SecondaryLink>
        <section className="grid gap-6 lg:grid-cols-[0.76fr_1.24fr] lg:items-start">
          <div>
            <SectionLabel>Setup</SectionLabel>
            <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">工具准备</h1>
            <p className="mt-4 text-base leading-8 text-emerald-50/64">
              现场统一使用 StepClaw。ima 和 Obsidian 分别承担远程知识库与本地沉淀功能。OpenClaw 可作为进阶替代，不作为现场必修。
            </p>
            <div className="mt-5 rounded-[24px] border border-amber-200/20 bg-amber-300/8 p-4 text-sm leading-7 text-amber-50/78">
              <ShieldCheck className="mb-2 h-5 w-5 text-amber-100" />
              请不要上传公司敏感信息、客户隐私、员工个人信息或未公开业务数据。真实材料请先脱敏。
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {tools.map((tool) => (
              <a
                key={tool.name}
                href={tool.href}
                target="_blank"
                rel="noreferrer"
                className="group rounded-[28px] border border-emerald-200/14 bg-[#0c201c]/75 p-5 shadow-xl shadow-black/15 transition hover:-translate-y-1 hover:border-emerald-200/35 hover:bg-[#102b25]"
              >
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-full border border-emerald-200/15 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
                    {tool.label}
                  </span>
                  <Download className="h-5 w-5 text-emerald-200/70 transition group-hover:translate-y-0.5" />
                </div>
                <h2 className="mt-4 text-2xl font-black text-white">{tool.name}</h2>
                <p className="mt-3 text-sm leading-7 text-emerald-50/62">{tool.text}</p>
              </a>
            ))}
          </div>
        </section>

        <section className="mt-12">
          <GlassCard className="p-6 sm:p-8">
            <SectionLabel>Checklist</SectionLabel>
            <h2 className="text-3xl font-black text-white">课前准备清单</h2>
            <div className="mt-5 grid gap-3">
              {prework.slice(1, 4).map((item, index) => (
                <div key={item} className="flex gap-3 rounded-3xl border border-emerald-200/12 bg-black/18 p-4 text-sm leading-7 text-emerald-50/72">
                  <div className="grid h-8 w-8 flex-none place-items-center rounded-full border border-emerald-200/20 bg-emerald-300/10 text-xs font-black text-emerald-200">
                    {index + 1}
                  </div>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>
      </Container>
    </AppShell>
  );
}
