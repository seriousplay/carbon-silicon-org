import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Database,
  FileText,
  Layers3,
  Sparkles,
  Workflow,
} from "lucide-react";
import { AppShell, Container, GlassCard, PrimaryLink, SecondaryLink, SectionLabel } from "@/components/ui";
import { getHomeAssessmentRuns } from "@/lib/runs/server";
import { defaultRun, runTypeLabels } from "@/lib/runs/default-runs";
import { onlineSupportMeta, toolLibrary, toolTypeMeta, type ToolProduct } from "@/lib/tools/tool-library";

export const dynamic = "force-dynamic";

const readerPains = [
  {
    role: "CEO / 创始人",
    pain: "AI 项目很多，但组织能力没有同步长出来。",
    outcome: "判断企业究竟缺工具、缺流程，还是缺智能密度。",
  },
  {
    role: "HR 一号位 / OD 负责人",
    pain: "培训、人才和组织发展还停留在人头与岗位逻辑。",
    outcome: "把 AI 转型翻译成组织诊断、协作设计和干预工具。",
  },
  {
    role: "AI 转型负责人",
    pain: "应用上线容易，业务链路、责任边界和复盘机制难落地。",
    outcome: "用五级阶梯、三螺旋和人机链路定位真实卡点。",
  },
  {
    role: "业务负责人",
    pain: "团队都在试 AI，但结果无法沉淀为稳定生产力。",
    outcome: "把任务、接口、反馈和指标重新组织成可验证实验。",
  },
];

const bookQuestions = [
  "为什么 AI 工具越多，组织反而可能越混乱？",
  "为什么未来竞争优势不再只是招更多人，而是提高智能密度？",
  "当人与智能体共同工作，组织如何重新设计任务、权力、反馈和责任？",
];

const migrationShifts = [
  {
    from: "人力规模",
    to: "智能密度",
    note: "不再只看组织有多少人，而看每个单元能调用多少人类经验、机器智能和反馈数据。",
  },
  {
    from: "岗位分工",
    to: "任务单元",
    note: "把职位说明书拆成真实任务，把 AI 放进任务的输入、判断、执行和复盘环节。",
  },
  {
    from: "流程管控",
    to: "人机链路",
    note: "流程不只是审批路径，而是人、模型、数据、工具和责任共同组成的工作链路。",
  },
  {
    from: "工具采购",
    to: "能力建设",
    note: "AI 采购只是起点，真正的转型要沉淀组织可复用的判断、模板和协作方式。",
  },
  {
    from: "经验决策",
    to: "反馈闭环",
    note: "让每一次业务动作都能留下数据、形成复盘，并反过来校准下一轮判断。",
  },
  {
    from: "个人提效",
    to: "组织智能",
    note: "个人效率提升如果不能进入团队方法、流程资产和组织记忆，就很难变成竞争力。",
  },
  {
    from: "权责默认",
    to: "接口契约",
    note: "在人机协作里，谁判断、谁确认、谁负责、谁复核，必须被显性设计出来。",
  },
  {
    from: "一次性 AI 项目",
    to: "持续进化系统",
    note: "从项目制试点转向长期运营，把诊断、工具、数据和组织学习接成一个循环。",
  },
];

const bookModules = [
  {
    title: "模块一：换掉旧认知",
    description: "先看清 AI 不是效率插件，而是进入组织的新型智能体。",
    chapters: ["01 新认知", "02 新范式", "03 新物种"],
  },
  {
    title: "模块二：重写组织系统",
    description: "把结构、基建和隐性能量放在同一张组织图上重新设计。",
    chapters: ["04 新架构", "05 新基建", "06 隐性能量"],
  },
  {
    title: "模块三：形成能力闭环",
    description: "让个体、团队和领导力都能适应人机共生的新协作方式。",
    chapters: ["07 个体进化", "08 团队进化", "09 领导力进化"],
  },
  {
    title: "模块四：进入真实落地",
    description: "从企业跃迁、行业路径到 AI 宪章，完成组织级行动设计。",
    chapters: ["10 企业跃迁", "11 行业路径", "12 文明宪章"],
  },
];

const conceptAssets = [
  "异类智能",
  "三重对齐",
  "智能密度",
  "混合智能细胞",
  "三螺旋架构",
  "业务本体",
  "四根显性基建",
  "三股隐性能量",
  "超级个体",
  "组织 AI 宪章",
];

const featuredToolIds = [
  "ai-transformation-ladder",
  "spiral-diagnosis",
  "human-ai-chain",
  "interface-contract",
  "business-anchor-check",
  "ai-charter",
];

const dataFlow = [
  { title: "创建入口", text: "为企业、班级、工作坊或公开共学建立独立链接。" },
  { title: "完成测评", text: "个人在线提交诊断，或按工具手册完成结构化产出。" },
  { title: "生成报告", text: "个人获得行动建议，引导师获得群体汇总和开放题材料。" },
  { title: "沉淀资产", text: "把样本、案例、组织卡点和工具使用记录沉淀为企业知识库。" },
];

const platformCapabilities = [
  { icon: BookOpen, title: "书籍框架", text: "把 12 章内容转化为组织 AI 转型的路径图。" },
  { icon: Layers3, title: "工具产品", text: "22 个工具支持单点诊断、工作坊交付和团队复盘。" },
  { icon: FileText, title: "报告系统", text: "个人报告与群体报告连接到推荐工具。" },
  { icon: Database, title: "数据沉淀", text: "为企业形成连续样本、案例和组织行动记录。" },
];

function pickFeaturedTools() {
  return featuredToolIds
    .map((id) => toolLibrary.find((tool) => tool.id === id))
    .filter((tool): tool is ToolProduct => Boolean(tool));
}

export default async function Home() {
  const runs = await getHomeAssessmentRuns();
  const activeRuns = runs.filter((run) => run.status === "active").slice(0, 3);
  const primaryRun = activeRuns[0] ?? defaultRun;
  const featuredTools = pickFeaturedTools();
  const onlineCount = toolLibrary.filter((tool) => tool.onlineSupport === "assessment").length;

  return (
    <AppShell>
      <section className="relative overflow-hidden border-b border-emerald-200/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_18%,rgba(45,212,191,0.22),transparent_28%),linear-gradient(135deg,rgba(3,16,15,0.98),rgba(5,35,30,0.9)_48%,rgba(5,10,9,0.98))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(116,242,202,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(116,242,202,0.05)_1px,transparent_1px)] bg-[size:72px_72px] opacity-45" />
        <div className="absolute bottom-[-8rem] right-[-2rem] hidden h-[34rem] w-[34rem] rotate-[-10deg] rounded-[3rem] border border-emerald-200/15 bg-black/25 shadow-2xl shadow-emerald-950/50 lg:block" />
        <div className="absolute bottom-[-6rem] right-[3vw] hidden w-[30rem] rotate-[-6deg] overflow-hidden rounded-[2rem] border border-emerald-200/20 shadow-[0_0_80px_rgba(45,212,191,0.15)] lg:block">
          <Image
            src="/book/hero-desktop.webp"
            alt="碳硅组织封面视觉"
            width={1600}
            height={1000}
            priority
            sizes="(max-width: 1024px) 0px, 480px"
            className="h-auto w-full opacity-[0.92] saturate-110"
          />
        </div>

        <Container className="relative py-16 sm:py-20 lg:py-24">
          <div className="max-w-4xl">
            <SectionLabel>Book · Methodology · OD Toolkit</SectionLabel>
            <h1 className="max-w-4xl text-5xl font-black leading-[1.04] tracking-tight text-white sm:text-6xl lg:text-7xl">
              碳硅组织
              <span className="mt-3 block text-3xl leading-tight text-emerald-100 sm:text-4xl lg:text-5xl">
                从人力规模，到智能密度
              </span>
            </h1>
            <p className="mt-6 max-w-2xl text-xl font-semibold leading-9 text-emerald-50/86">
              AI 不只是工具，它正在重写组织的基本单位。
            </p>
            <p className="mt-4 max-w-2xl text-base leading-8 text-emerald-50/66 sm:text-lg">
              《碳硅组织》写给正在推动 AI 转型的管理者、HR 一号位、OD 负责人和业务负责人。它把书中的组织进化框架，延伸成可诊断、可交付、可沉淀数据的工具系统。
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <PrimaryLink href={`/e/${primaryRun.slug}`}>
                进入组织 AI 自测 <ArrowRight className="ml-2 h-4 w-4" />
              </PrimaryLink>
              <SecondaryLink href="/tools">浏览 22 个工具</SecondaryLink>
              <SecondaryLink href="/super-individual-workshop">超级个体工作坊</SecondaryLink>
              <SecondaryLink href="/admin/runs/new" prefetch={false}>创建企业/班级入口</SecondaryLink>
            </div>

            <div className="mt-10 grid max-w-3xl grid-cols-3 gap-px overflow-hidden rounded-3xl border border-emerald-200/15 bg-emerald-200/15">
              {[
                ["12", "章组织进化路径"],
                [toolLibrary.length, "个 OD 工具产品"],
                ["2", "类报告沉淀"],
              ].map(([value, label]) => (
                <div key={label} className="bg-[#06110f]/72 px-4 py-5 backdrop-blur">
                  <div className="text-3xl font-black text-white">{value}</div>
                  <div className="mt-1 text-xs font-semibold text-emerald-100/62">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-8 lg:hidden">
            <Image
              src="/book/hero-mobile.webp"
              alt="碳硅组织封面视觉"
              width={800}
              height={500}
              loading="lazy"
              sizes="100vw"
              className="w-full rounded-[24px] border border-emerald-200/15 shadow-xl shadow-black/30"
            />
          </div>
        </Container>
      </section>

      <Container className="py-14 lg:py-20">
        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
          <div>
            <SectionLabel>Core Proposition</SectionLabel>
            <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">
              这不是一本教你使用 AI 工具的书。
            </h2>
            <p className="mt-4 text-base leading-8 text-emerald-50/65">
              它真正处理的是组织升级问题：当 AI 进入知识工作、判断流程和协作系统之后，企业竞争不再只看人头规模，而要看每个组织单元能调用多少智能、沉淀多少判断、跑通多少反馈闭环。
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {bookQuestions.map((question, index) => (
              <GlassCard key={question} className="p-5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200/20 bg-emerald-300/10 text-sm font-black text-emerald-200">
                  0{index + 1}
                </div>
                <p className="mt-5 text-base font-bold leading-7 text-white">{question}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
            <div>
              <SectionLabel>Migration Map</SectionLabel>
              <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">
                向碳硅组织迁移的 8 个转变
              </h2>
              <p className="mt-4 text-base leading-8 text-emerald-50/64">
                这张路径图把书中的核心判断压缩成一组可讨论、可诊断、可行动的组织迁移动作。用户不必先理解全部概念，也能看见企业 AI 转型要从哪里出发、往哪里去。
              </p>
            </div>
            <div className="rounded-[28px] border border-emerald-200/14 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(6,17,15,0.74))] p-5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-emerald-200/75">
                <span>From</span>
                <span />
                <span>To</span>
              </div>
              <div className="mt-4 grid gap-3">
                {migrationShifts.map((shift, index) => (
                  <div
                    key={`${shift.from}-${shift.to}`}
                    className="grid gap-3 rounded-3xl border border-emerald-200/12 bg-[#071611]/72 p-4 md:grid-cols-[1fr_auto_1fr]"
                  >
                    <div>
                      <div className="text-xs font-semibold text-emerald-50/45">旧范式 0{index + 1}</div>
                      <div className="mt-1 text-lg font-black text-emerald-50">{shift.from}</div>
                    </div>
                    <div className="flex items-center justify-start md:justify-center">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200/20 bg-emerald-300/10 text-emerald-200">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-emerald-200/70">碳硅组织</div>
                      <div className="mt-1 text-lg font-black text-white">{shift.to}</div>
                      <p className="mt-2 text-sm leading-6 text-emerald-50/58">{shift.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-16">
          <SectionLabel>Reader Pain Points</SectionLabel>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {readerPains.map((item) => (
              <GlassCard key={item.role} className="p-5">
                <div className="text-xs font-bold text-emerald-200">{item.role}</div>
                <h3 className="mt-4 text-lg font-black leading-7 text-white">{item.pain}</h3>
                <p className="mt-4 text-sm leading-7 text-emerald-50/62">{item.outcome}</p>
              </GlassCard>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="grid gap-5 lg:grid-cols-[0.8fr_1.2fr] lg:items-end">
            <div>
              <SectionLabel>12-Chapter Map</SectionLabel>
              <h2 className="text-3xl font-black text-white sm:text-4xl">全书四大模块</h2>
              <p className="mt-4 text-base leading-8 text-emerald-50/64">
                从认知、系统、能力到落地，形成一条从书籍阅读到组织干预的路径。
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-emerald-50/70 sm:grid-cols-5">
              {conceptAssets.map((concept) => (
                <div key={concept} className="rounded-full border border-emerald-200/15 bg-white/[0.045] px-3 py-2 text-center font-semibold">
                  {concept}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-4">
            {bookModules.map((module, index) => (
              <div
                key={module.title}
                className="relative overflow-hidden rounded-[28px] border border-emerald-200/14 bg-[#0b1d19]/82 p-5 shadow-xl shadow-black/15"
              >
                <div className="absolute right-4 top-4 text-5xl font-black text-emerald-200/[0.06]">0{index + 1}</div>
                <div className="relative">
                  <h3 className="text-lg font-black text-white">{module.title}</h3>
                  <p className="mt-3 min-h-20 text-sm leading-7 text-emerald-50/62">{module.description}</p>
                  <div className="mt-5 grid gap-2">
                    {module.chapters.map((chapter) => (
                      <div key={chapter} className="rounded-2xl border border-emerald-200/10 bg-white/[0.045] px-3 py-2 text-sm font-bold text-emerald-50/82">
                        {chapter}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-16">
          <div className="grid gap-6 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
            <div>
              <SectionLabel>OD Tool Products</SectionLabel>
              <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">
                22 个配套工具，把方法论变成交付动作。
              </h2>
              <p className="mt-4 text-base leading-8 text-emerald-50/64">
                工具库覆盖认知定位、组织诊断、任务重写、接口契约、领导力练习和 AI 宪章，既能单独使用，也能组合成企业项目和工作坊流程。
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <div className="rounded-3xl border border-emerald-200/15 bg-white/[0.045] p-4">
                  <div className="text-3xl font-black text-white">{onlineCount}</div>
                  <div className="mt-1 text-xs font-semibold text-emerald-100/62">个已接入在线测评</div>
                </div>
                <div className="rounded-3xl border border-emerald-200/15 bg-white/[0.045] p-4">
                  <div className="text-3xl font-black text-white">{toolLibrary.length}</div>
                  <div className="mt-1 text-xs font-semibold text-emerald-100/62">份产品化工具手册</div>
                </div>
              </div>
              <div className="mt-6">
                <PrimaryLink href="/tools">
                  进入工具库 <ArrowRight className="ml-2 h-4 w-4" />
                </PrimaryLink>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              {featuredTools.map((tool) => (
                <Link
                  key={tool.id}
                  href={`/tools/${tool.id}`}
                  className="group rounded-[28px] border border-emerald-200/14 bg-[#0c201c]/75 p-5 shadow-xl shadow-black/15 transition hover:-translate-y-1 hover:border-emerald-200/35 hover:bg-[#102b25]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="rounded-full border border-emerald-200/15 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
                      {toolTypeMeta[tool.toolType].label}
                    </div>
                    <div className="text-xs font-bold text-emerald-50/55">{onlineSupportMeta[tool.onlineSupport].shortLabel}</div>
                  </div>
                  <h3 className="mt-4 text-xl font-black leading-7 text-white group-hover:text-emerald-100">{tool.name}</h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-7 text-emerald-50/62">{tool.purpose}</p>
                  <div className="mt-5 flex items-center gap-2 text-sm font-bold text-emerald-200">
                    查看工具 <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-16">
          <GlassCard className="overflow-hidden p-0">
            <div className="grid gap-0 lg:grid-cols-[0.9fr_1.1fr]">
              <div className="border-b border-emerald-200/10 p-6 sm:p-8 lg:border-b-0 lg:border-r lg:border-r-emerald-200/10">
                <SectionLabel>Enterprise Data Layer</SectionLabel>
                <h2 className="text-3xl font-black leading-tight text-white sm:text-4xl">
                  企业用户可以单独使用工具，也可以组合使用并统一沉淀数据。
                </h2>
                <p className="mt-4 text-base leading-8 text-emerald-50/64">
                  每个企业、班级或工作坊入口都拥有独立样本池。个人报告解决“我下一步做什么”，汇总报告解决“这个组织真正卡在哪里”。
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <PrimaryLink href="/admin/runs/new" prefetch={false}>
                    创建企业/班级入口 <Workflow className="ml-2 h-4 w-4" />
                  </PrimaryLink>
                  <SecondaryLink href={`/e/${primaryRun.slug}`}>体验组织 AI 自测</SecondaryLink>
                </div>
              </div>

              <div className="grid gap-px bg-emerald-200/10 sm:grid-cols-2">
                {dataFlow.map((item, index) => (
                  <div key={item.title} className="bg-[#071611]/88 p-6">
                    <div className="flex items-center gap-3">
                      <div className="grid h-10 w-10 place-items-center rounded-full border border-emerald-200/20 bg-emerald-300/10 text-sm font-black text-emerald-200">
                        {index + 1}
                      </div>
                      <h3 className="text-lg font-black text-white">{item.title}</h3>
                    </div>
                    <p className="mt-4 text-sm leading-7 text-emerald-50/62">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </section>

        <section className="mt-16">
          <div className="grid gap-5 lg:grid-cols-[0.82fr_1.18fr] lg:items-start">
            <div>
              <SectionLabel>Start Here</SectionLabel>
              <h2 className="text-3xl font-black text-white sm:text-4xl">当前可用入口</h2>
              <p className="mt-4 text-base leading-8 text-emerald-50/64">
                这里仅展示管理员选择公开的入口。企业、班级和工作坊入口创建后会生成独立链接，可直接发送给参与者。
              </p>
            </div>
            <div className="grid gap-3">
              <Link
                href="/super-individual-workshop"
                className="grid gap-4 rounded-[28px] border border-emerald-300/25 bg-emerald-300/10 p-5 transition hover:border-emerald-200/45 hover:bg-emerald-300/15 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="rounded-full border border-emerald-200/20 bg-emerald-300/15 px-3 py-1 text-xs font-bold text-emerald-100">
                      Workshop
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-50/58">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
                      从 Prompt 到 Skill
                    </span>
                  </div>
                  <h3 className="mt-3 text-xl font-black leading-tight text-white">超级个体赋能工作坊</h3>
                  <p className="mt-2 line-clamp-2 text-sm leading-6 text-emerald-50/68">
                    一天流程框架、核心术语、工具安装链接与课前问卷。
                  </p>
                </div>
                <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
                  进入 <ArrowRight className="h-4 w-4" />
                </div>
              </Link>
              {activeRuns.length ? (
                activeRuns.map((run) => (
                  <Link
                    key={run.slug}
                    href={`/e/${run.slug}`}
                    className="grid gap-4 rounded-[28px] border border-emerald-200/14 bg-white/[0.045] p-5 transition hover:border-emerald-200/35 hover:bg-white/[0.075] md:grid-cols-[1fr_auto] md:items-center"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="rounded-full border border-emerald-200/15 bg-emerald-300/10 px-3 py-1 text-xs font-bold text-emerald-200">
                          {runTypeLabels[run.runType]}
                        </span>
                        <span className="text-xs font-semibold text-emerald-50/45">{run.completedCount ?? 0} 份报告</span>
                      </div>
                      <h3 className="mt-3 text-xl font-black leading-tight text-white">{run.title}</h3>
                      <p className="mt-2 line-clamp-2 text-sm leading-6 text-emerald-50/60">{run.audience}</p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-bold text-emerald-200">
                      进入 <ArrowRight className="h-4 w-4" />
                    </div>
                  </Link>
                ))
              ) : (
                <div className="rounded-[28px] border border-emerald-200/14 bg-white/[0.045] p-5 text-sm leading-7 text-emerald-50/65">
                  暂无启用入口。进入后台创建第一个企业诊断、内部班级或工作坊入口。
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="mt-16 grid gap-4 md:grid-cols-4">
          {platformCapabilities.map(({ icon: Icon, title, text }) => (
            <GlassCard key={title} className="p-5">
              <Icon className="h-6 w-6 text-emerald-200" />
              <h3 className="mt-5 text-lg font-black text-white">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-emerald-50/62">{text}</p>
            </GlassCard>
          ))}
        </section>
      </Container>
    </AppShell>
  );
}
