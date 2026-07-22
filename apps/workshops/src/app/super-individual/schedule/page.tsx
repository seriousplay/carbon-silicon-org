export const dynamic = "force-dynamic";
import { ArrowLeft } from "lucide-react";
import { AppShell, Container, SecondaryLink, SectionLabel } from "@/components/ui";
import { schedule } from "../content";

export const metadata = {
  title: "一天流程框架｜超级个体赋能工作坊",
  description: "9:30 到 17:00 的超级个体赋能工作坊流程安排。",
};

export default function SchedulePage() {
  return (
    <AppShell>
      <Container className="py-10 lg:py-14">
        <SecondaryLink href="/super-individual-workshop" className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回入口主页
        </SecondaryLink>
        <section>
          <div className="mb-6">
            <SectionLabel>One-Day Flow</SectionLabel>
            <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl">一天流程框架</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-emerald-50/64">
              上午先暴露普通 AI 输出的问题，再引入 Skill。下午每个人把自己的真实任务 Skill 化，用材料重跑内容，并在小班案例诊所里完成关键修正。
            </p>
          </div>
          <div className="grid gap-3">
            {schedule.map((item, index) => (
              <div
                key={`${item.time}-${item.title}`}
                className="grid gap-4 rounded-[28px] border border-emerald-200/14 bg-[#0c201c]/78 p-5 md:grid-cols-[8.5rem_1fr_8rem] md:items-start"
              >
                <div>
                  <div className="text-xs font-bold text-emerald-200/70">STEP {String(index + 1).padStart(2, "0")}</div>
                  <div className="mt-2 text-sm font-black text-white">{item.time}</div>
                </div>
                <div>
                  <h2 className="text-xl font-black text-white">{item.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-emerald-50/62">{item.text}</p>
                </div>
                <div className="rounded-2xl border border-emerald-200/12 bg-emerald-300/8 px-3 py-2 text-sm font-bold text-emerald-100">{item.output}</div>
              </div>
            ))}
          </div>
        </section>
      </Container>
    </AppShell>
  );
}
