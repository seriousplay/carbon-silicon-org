import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, ClipboardList, Database, FileText, Route, ShieldCheck } from "lucide-react";
import { AppShell, Container, GlassCard, SectionLabel } from "@/components/ui";
import {
  chapterLabel,
  getRelatedTools,
  getTool,
  onlineSupportMeta,
  toolLibrary,
  toolTypeMeta,
} from "@/lib/tools/tool-library";
import type { ToolTemplatePrompt } from "@/lib/tools/tool-library";

export function generateStaticParams() {
  return toolLibrary.map((tool) => ({ toolSlug: tool.id }));
}

export default async function ToolDetailPage({ params }: { params: Promise<{ toolSlug: string }> }) {
  const { toolSlug } = await params;
  const tool = getTool(toolSlug);

  if (!tool) notFound();

  const related = getRelatedTools(tool, 3);
  const online = onlineSupportMeta[tool.onlineSupport];
  const type = toolTypeMeta[tool.toolType];

  return (
    <AppShell>
      <Container className="max-w-6xl py-12">
        <Link href="/tools" className="no-print mb-8 inline-flex items-center gap-2 text-sm font-bold text-emerald-200 hover:text-emerald-100">
          <ArrowLeft className="h-4 w-4" />
          返回工具库
        </Link>

        <div className="grid gap-6 lg:grid-cols-[1fr_0.38fr]">
          <GlassCard className="p-8">
            <SectionLabel>{chapterLabel(tool.chapter)} · {type.label}</SectionLabel>
            <h1 className="text-5xl font-black leading-tight text-white">{tool.name}</h1>
            <p className="mt-3 text-xl font-semibold text-emerald-100/78">{tool.subtitle}</p>
            <p className="mt-5 text-lg leading-9 text-emerald-50/70">{tool.purpose}</p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
              <InfoTile label="交付时长" value={tool.duration} />
              <InfoTile label="参与人数" value={tool.participants} />
              <InfoTile label="使用方式" value={online.shortLabel} />
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/tools/${tool.id}/use`}
                prefetch={false}
                className="inline-flex items-center justify-center rounded-full bg-emerald-300 px-5 py-3 text-sm font-black text-[#06110f] shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-200"
              >
                单独使用这个工具
              </Link>
              <Link
                href="/admin/runs/new"
                prefetch={false}
                className="inline-flex items-center justify-center rounded-full border border-emerald-200/25 px-5 py-3 text-sm font-black text-emerald-50 transition hover:bg-white/10"
              >
                创建企业/班级入口
              </Link>
            </div>
          </GlassCard>

          <div className="space-y-4">
            <GlassCard className="p-5">
              <div className="text-sm font-bold text-emerald-200">产出物</div>
              <p className="mt-3 text-base font-black leading-7 text-white">{tool.output}</p>
            </GlassCard>
            <GlassCard className="p-5">
              <div className="text-sm font-bold text-emerald-200">适用对象</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {tool.targetUsers.map((user) => (
                  <Pill key={user}>{user}</Pill>
                ))}
              </div>
            </GlassCard>
            <GlassCard className="p-5">
              <div className="text-sm font-bold text-emerald-200">数据沉淀</div>
              <p className="mt-3 text-sm leading-7 text-emerald-50/62">
                单独使用会留下个人工具记录；从企业/班级入口进入，会进入同一入口的数据池，便于团队复盘和组织议题追踪。
              </p>
            </GlassCard>
          </div>
        </div>

        <section className="mt-8 grid gap-5 lg:grid-cols-[0.92fr_1.08fr]">
          <GlassCard className="p-6">
            <SectionHeader icon={<ShieldCheck className="h-5 w-5" />} title="解决的问题" />
            <p className="mt-4 text-base leading-8 text-emerald-50/68">{tool.problem}</p>
          </GlassCard>

          <GlassCard className="p-6">
            <SectionHeader icon={<ClipboardList className="h-5 w-5" />} title="使用边界" />
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <ListBlock title="适合使用" items={tool.whenToUse} />
              <ListBlock title="不适合使用" items={tool.notFor} muted />
            </div>
          </GlassCard>
        </section>

        <section className="mt-8">
          <GlassCard className="p-6">
            <SectionHeader icon={<Route className="h-5 w-5" />} title="现场交付流程" />
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {tool.steps.map((step, index) => (
                <div key={step.title} className="rounded-[22px] border border-emerald-200/10 bg-black/18 p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-emerald-300 text-sm font-black text-[#06110f]">
                      {index + 1}
                    </span>
                    <h2 className="text-lg font-black text-white">{step.title}</h2>
                  </div>
                  <p className="mt-4 text-sm leading-7 text-emerald-50/66">{step.instruction}</p>
                  <div className="mt-4 rounded-2xl border border-emerald-200/10 bg-white/[0.035] p-3 text-xs font-bold text-emerald-100/70">
                    产出：{step.output}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-3">
          <GlassCard className="p-6">
            <SectionHeader icon={<CheckCircle2 className="h-5 w-5" />} title="解释口径" />
            <BulletList items={tool.scoring} />
          </GlassCard>
          <GlassCard className="p-6">
            <SectionHeader icon={<FileText className="h-5 w-5" />} title="引导师提示" />
            <BulletList items={tool.facilitatorTips} />
          </GlassCard>
          <GlassCard className="p-6">
            <SectionHeader icon={<ShieldCheck className="h-5 w-5" />} title="常见误区" />
            <BulletList items={tool.pitfalls} />
          </GlassCard>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <GlassCard className="p-6">
            <SectionHeader icon={<ClipboardList className="h-5 w-5" />} title="输出模板" />
            <div className="mt-5 grid gap-4">
              {tool.templateSections.map((section) => (
                <div key={section.title} className="rounded-[22px] border border-emerald-200/10 bg-black/18 p-5">
                  <h2 className="text-base font-black text-white">{section.title}</h2>
                  <TemplatePromptList prompts={section.prompts} />
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-6">
            <SectionHeader icon={<Database className="h-5 w-5" />} title="团队数据沉淀" />
            <div className="mt-5 grid gap-5">
              <ListBlock
                title="建议记录"
                items={[
                  "这个工具针对的团队、业务单元或组织流程",
                  "本次讨论形成的关键事实、评分、分歧或决策",
                  "下一次复盘要观察的进展信号",
                ]}
              />
              <ListBlock
                title="沉淀价值"
                items={[
                  "让一次工具使用变成可追踪的组织样本",
                  "帮助引导师比较不同团队的真实卡点",
                  "为后续测评、复盘和行动计划留下证据",
                ]}
              />
            </div>
          </GlassCard>
        </section>

        <section className="mt-8 grid gap-5 lg:grid-cols-[0.95fr_1.05fr]">
          <GlassCard className="p-6">
            <SectionHeader icon={<ArrowRight className="h-5 w-5" />} title="后续行动" />
            <BulletList items={tool.followUpActions} />
            <div className="mt-6 rounded-[22px] border border-emerald-200/10 bg-white/[0.035] p-4">
              <div className="text-sm font-black text-white">继续使用这个工具</div>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link
                  href={`/tools/${tool.id}/use`}
                  prefetch={false}
                  className="inline-flex items-center justify-center rounded-full bg-emerald-300 px-4 py-2 text-xs font-black text-[#06110f] transition hover:bg-emerald-200"
                >
                  开始在线使用
                </Link>
                <Link
                  href="/admin/runs/new"
                  prefetch={false}
                  className="inline-flex items-center justify-center rounded-full border border-emerald-200/20 px-4 py-2 text-xs font-black text-emerald-50 transition hover:bg-white/10"
                >
                  创建企业/班级入口
                </Link>
              </div>
            </div>
          </GlassCard>

          {related.length ? (
            <div>
              <h2 className="mb-4 text-xl font-black text-white">推荐搭配工具</h2>
              <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-1">
                {related.map((item) => (
                  <Link key={item.id} href={`/tools/${item.id}`}>
                    <GlassCard className="h-full p-5 transition hover:bg-white/[0.075]">
                      <div className="text-sm font-bold text-emerald-200">{chapterLabel(item.chapter)}</div>
                      <div className="mt-3 text-lg font-black text-white">{item.name}</div>
                      <p className="mt-2 text-sm leading-6 text-emerald-50/58">{item.purpose}</p>
                    </GlassCard>
                  </Link>
                ))}
              </div>
            </div>
          ) : null}
        </section>
      </Container>
    </AppShell>
  );
}

function InfoTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] bg-white/[0.045] p-5">
      <div className="text-sm font-bold text-emerald-200">{label}</div>
      <div className="mt-2 text-base font-black leading-7 text-white">{value}</div>
    </div>
  );
}

function Pill({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-emerald-200/15 px-3 py-1 text-sm text-emerald-50/65">{children}</span>;
}

function SectionHeader({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 text-lg font-black text-white">
      <span className="text-emerald-200">{icon}</span>
      {title}
    </div>
  );
}

function BulletList({ items, compact = false }: { items: string[]; compact?: boolean }) {
  return (
    <ul className={compact ? "mt-3 space-y-2" : "mt-5 space-y-3"}>
      {items.map((item) => (
        <li key={item} className="flex gap-3 text-sm leading-7 text-emerald-50/66">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function TemplatePromptList({ prompts }: { prompts: (string | ToolTemplatePrompt)[] }) {
  return (
    <div className="mt-4 grid gap-3">
      {prompts.map((prompt) => {
        const item = normalizeTemplatePrompt(prompt);
        return (
          <details key={item.label} className="group rounded-2xl border border-emerald-200/10 bg-white/[0.025]">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3">
              <span className="text-sm font-black text-white">{item.label}</span>
              {item.standard || item.example ? <span className="text-xs font-black text-emerald-100/60">填写提示</span> : null}
            </summary>
            {item.standard || item.example ? (
              <div className="grid gap-2 border-t border-emerald-200/10 px-4 pb-4 pt-3">
                {item.standard ? <p className="text-xs leading-6 text-emerald-50/58">标准：{item.standard}</p> : null}
                {item.example ? <p className="text-xs leading-6 text-emerald-100/76">示例：{item.example}</p> : null}
              </div>
            ) : null}
          </details>
        );
      })}
    </div>
  );
}

function normalizeTemplatePrompt(prompt: string | ToolTemplatePrompt): ToolTemplatePrompt {
  if (typeof prompt === "string") return { label: prompt };
  return prompt;
}

function ListBlock({ title, items, muted = false }: { title: string; items: string[]; muted?: boolean }) {
  return (
    <div>
      <h2 className="text-sm font-black text-white">{title}</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item} className={muted ? "text-sm leading-7 text-emerald-50/48" : "text-sm leading-7 text-emerald-50/66"}>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
