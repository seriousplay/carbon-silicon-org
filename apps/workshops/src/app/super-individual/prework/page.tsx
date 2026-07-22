export const dynamic = "force-dynamic";
import { ArrowLeft } from "lucide-react";
import { AppShell, Container, GlassCard, SecondaryLink, SectionLabel } from "@/components/ui";
import { prework, taskTracks } from "../content";
import { PreworkForm } from "../prework-form";

export const metadata = {
  title: "课前问卷｜超级个体赋能工作坊",
  description: "提交 AI 使用经验、真实工作任务与课前准备情况。",
};

export default function PreworkPage() {
  return (
    <AppShell>
      <Container className="py-10 lg:py-14">
        <SecondaryLink href="/super-individual-workshop" className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回入口主页
        </SecondaryLink>
        <section className="mb-10">
          <SectionLabel>Prework</SectionLabel>
          <h1 className="text-4xl font-black text-white sm:text-5xl">课前准备与问卷</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-emerald-50/64">
            预计 30-60 分钟。目标不是提前学会所有工具，而是带着一次真实体验和一个真实问题进场。
          </p>
        </section>

        <section className="mb-10">
          <GlassCard className="p-6 sm:p-8">
            <h2 className="text-2xl font-black text-white">进场前完成这 5 件事</h2>
            <div className="mt-5 grid gap-3">
              {prework.map((item, index) => (
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

        <section className="mb-10 grid gap-4 md:grid-cols-3">
          {taskTracks.map((track) => (
            <GlassCard key={track.title} className="p-5">
              <h2 className="text-xl font-black text-white">{track.title}</h2>
              <p className="mt-3 text-sm leading-7 text-emerald-50/62">{track.text}</p>
            </GlassCard>
          ))}
        </section>

        <PreworkForm />
      </Container>
    </AppShell>
  );
}
