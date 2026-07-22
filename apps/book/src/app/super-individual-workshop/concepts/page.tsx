import { ArrowLeft } from "lucide-react";
import { AppShell, Container, SecondaryLink, SectionLabel } from "@/components/ui";
import { ConceptLearningCards } from "../concept-learning-cards";

export const metadata = {
  title: "AI 入门迷你课｜超级个体赋能工作坊",
  description: "通过模块卡和下方学习测试面板掌握 AI、机器学习、大模型、Agent、Skills、Harness 与真实产品案例。",
};

export default function ConceptsPage() {
  return (
    <AppShell>
      <Container className="py-10 lg:py-14">
        <SecondaryLink href="/super-individual-workshop" className="mb-8">
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回入口主页
        </SecondaryLink>
        <section className="mb-8">
          <SectionLabel>Mini Course</SectionLabel>
          <h1 className="max-w-4xl text-4xl font-black leading-tight text-white sm:text-5xl">AI 入门迷你课</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-emerald-50/64">
            上方选择一个课程模块，下方学习与测试面板会同步切换。完成 3 题并全部答对后，对应模块会显示“已通过”。课前先建立直觉，现场再用真实任务把概念跑一遍。
          </p>
        </section>
        <ConceptLearningCards />
      </Container>
    </AppShell>
  );
}
