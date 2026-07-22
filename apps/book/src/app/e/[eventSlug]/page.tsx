import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, LockKeyhole, UsersRound, Zap } from "lucide-react";
import { AppShell, Container, GlassCard, PrimaryLink, SectionLabel } from "@/components/ui";
import { getAssessmentRun } from "@/lib/runs/server";
import { runTypeLabels } from "@/lib/runs/default-runs";
import type { AssessmentRun } from "@/lib/runs/types";
import { recommendedToolSuite } from "@/lib/tools/sessions";

const runCopy: Record<AssessmentRun["runType"], { label: string; headline: string; points: [string, string][] }> = {
  workshop: {
    label: "Workshop Run",
    headline: "带着真实组织问题进入一次深度共创",
    points: [
      ["理解一套框架", "掌握 AI 时代组织进化的核心方法论。"],
      ["诊断一个现场", "识别结构、权力、信任和协作卡点。"],
      ["设计一次实验", "形成一条可回去试跑的人机协作链路方案。"],
    ],
  },
  organization_diagnosis: {
    label: "Organization Diagnosis",
    headline: "为企业 AI 转型建立一张可讨论的组织诊断图",
    points: [
      ["定位转型阶段", "判断组织从工具使用到碳硅共生的当前位置。"],
      ["识别系统短板", "看见结构层、细胞层、环境层和隐性能量的主要阻力。"],
      ["形成管理议题", "把个人反馈汇聚为管理团队可以决策的下一步行动。"],
    ],
  },
  cohort: {
    label: "Learning Cohort",
    headline: "让一个班级围绕同一套语言完成组织 AI 复盘",
    points: [
      ["建立共同语言", "把抽象的 AI 转型讨论落到组织现场。"],
      ["沉淀班级画像", "形成匿名汇总，支持课堂讨论和同伴学习。"],
      ["连接行动工具", "用推荐工具推动课后小实验。"],
    ],
  },
  public: {
    label: "Public Assessment",
    headline: "用 8-12 分钟完成一次组织 AI 转型自测",
    points: [
      ["看清当前位置", "获得当前阶段、下一阶段重点和关键短板。"],
      ["获得行动建议", "把诊断结果转化为两周内可试跑的小实验。"],
      ["进入工具库", "根据报告继续使用《碳硅组织》方法工具。"],
    ],
  },
};

export default async function EventPage({ params }: { params: Promise<{ eventSlug: string }> }) {
  const { eventSlug } = await params;
  const run = await getAssessmentRun(eventSlug);

  if (!run || !["active", "draft"].includes(run.status)) {
    notFound();
  }

  const copy = runCopy[run.runType] ?? runCopy.workshop;
  const tools = recommendedToolSuite();

  return (
    <AppShell>
      <Container className="py-14">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
          <GlassCard className="flex min-h-[520px] flex-col justify-between p-8">
            <div>
              <SectionLabel>{copy.label}</SectionLabel>
              <h1 className="text-5xl font-black leading-tight text-white">{run.title}</h1>
              <p className="mt-5 text-2xl font-bold leading-9 text-emerald-200">{copy.headline}</p>
              <p className="mt-8 text-lg leading-9 text-emerald-50/75">{run.description}</p>
            </div>
            <div className="mt-10 grid gap-3 rounded-3xl border border-emerald-200/15 bg-black/20 p-5 text-sm text-emerald-50/70">
              <div>类型：{runTypeLabels[run.runType]}</div>
              {run.dateLabel ? <div>时间：{run.dateLabel}</div> : null}
              {run.audience ? <div>对象：{run.audience}</div> : null}
              <div>入口：{run.slug}</div>
              {run.accessCode ? (
                <div className="flex items-center gap-2 text-emerald-200">
                  <LockKeyhole className="h-4 w-4" />
                  需要访问码
                </div>
              ) : null}
            </div>
          </GlassCard>

          <div className="grid gap-4">
            {copy.points.map(([title, text], index) => (
              <GlassCard key={title} className="p-6">
                <div className="text-sm font-black text-emerald-200">0{index + 1}</div>
                <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
                <p className="mt-2 text-base leading-8 text-emerald-50/68">{text}</p>
              </GlassCard>
            ))}
            <GlassCard className="overflow-hidden border-emerald-300/25 bg-gradient-to-br from-emerald-300/10 via-emerald-400/5 to-transparent p-0">
              <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
                <div className="flex-1">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-emerald-300/20 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-200">
                    <Zap className="h-3.5 w-3.5" />
                    准备好了吗？
                  </div>
                  <h2 className="text-3xl font-black text-white">开始你的测评</h2>
                  <p className="mt-3 text-base leading-7 text-emerald-50/75">
                    8-12 分钟完成核心问卷，立即获得个人诊断报告。
                    <span className="mt-2 block text-sm text-emerald-100/60">
                      数据将进入{run.title.includes("工作坊") ? "工作坊匿名汇总池，用于现场讨论" : "你的个人工作台"}。
                    </span>
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-col gap-3 md:items-end">
                  <PrimaryLink
                    href={`/e/${eventSlug}/start`}
                    className="group relative overflow-hidden bg-emerald-300 px-8 py-5 text-base font-black text-[#06110f] shadow-2xl shadow-emerald-900/50 transition-all hover:scale-[1.02] hover:bg-emerald-200"
                  >
                    <span className="relative z-10 flex items-center gap-2">
                      开始测评
                      <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
                    </span>
                  </PrimaryLink>
                  {run.accessCode ? (
                    <div className="flex items-center gap-2 text-sm text-emerald-200/80">
                      <LockKeyhole className="h-4 w-4" />
                      需要访问码
                    </div>
                  ) : null}
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        <section className="mt-10">
          <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <SectionLabel>Tool Suite</SectionLabel>
              <h2 className="text-3xl font-black text-white">企业工具组合</h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-emerald-50/62">
                这些工具可以单独使用，也可以在同一个入口下连续使用。所有提交都会进入该入口的数据池，便于企业复盘和后续行动追踪。
              </p>
            </div>
            <PrimaryLink href="/tools">查看完整工具库</PrimaryLink>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tools.map((tool) => (
              <GlassCard key={tool.id} className="p-5">
                <div className="text-sm font-bold text-emerald-200">第 {tool.chapter} 章</div>
                <h3 className="mt-3 text-xl font-black text-white">{tool.name}</h3>
                <p className="mt-2 text-sm leading-7 text-emerald-50/62">{tool.purpose}</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/tools/${tool.id}/use?run=${run.slug}`}
                    className="inline-flex rounded-full bg-emerald-300 px-4 py-2 text-sm font-black text-[#06110f]"
                  >
                    在本入口使用
                  </Link>
                  <Link href={`/tools/${tool.id}`} className="inline-flex rounded-full border border-emerald-200/20 px-4 py-2 text-sm font-black text-emerald-50">
                    查看说明
                  </Link>
                </div>
              </GlassCard>
            ))}
          </div>
        </section>
      </Container>
    </AppShell>
  );
}
