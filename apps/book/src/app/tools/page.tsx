import Link from "next/link";
import { ArrowRight, Filter, Search, SlidersHorizontal } from "lucide-react";
import { AppShell, Container, GlassCard, SectionLabel } from "@/components/ui";
import {
  chapterLabel,
  onlineSupportMeta,
  toolLibrary,
  toolTypeMeta,
} from "@/lib/tools/tool-library";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function hrefWith(params: Record<string, string | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value && value !== "all") query.set(key, value);
  });
  const serialized = query.toString();
  return serialized ? `/tools?${serialized}` : "/tools";
}

const scenarios = ["核心测评", "工作坊主工具", "AI 试点落地", "业务本体", "组织诊断", "领导力发展", "AI 治理"];

export default async function ToolsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selectedChapter = first(params.chapter) ?? "all";
  const selectedType = first(params.type) ?? "all";
  const selectedOnline = first(params.online) ?? "all";
  const selectedScenario = first(params.scene) ?? "all";

  const filteredTools = toolLibrary.filter((tool) => {
    const chapterMatch = selectedChapter === "all" || String(tool.chapter) === selectedChapter;
    const typeMatch = selectedType === "all" || tool.toolType === selectedType;
    const onlineMatch = selectedOnline === "all" || tool.onlineSupport === selectedOnline;
    const sceneMatch = selectedScenario === "all" || tool.scenarioTags.includes(selectedScenario);
    return chapterMatch && typeMatch && onlineMatch && sceneMatch;
  });

  const chapters = Array.from(new Set(toolLibrary.map((tool) => tool.chapter))).sort((a, b) => a - b);
  const types = Array.from(new Set(toolLibrary.map((tool) => tool.toolType)));
  const onlineStates = Array.from(new Set(toolLibrary.map((tool) => tool.onlineSupport)));

  return (
    <AppShell>
      <Container className="py-12">
        <SectionLabel>OD Product Library</SectionLabel>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <h1 className="text-5xl font-black leading-tight text-white">《碳硅组织》OD 工具产品库</h1>
            <p className="mt-4 max-w-3xl text-base leading-8 text-emerald-50/65">
              {toolLibrary.length} 个工具覆盖认知对齐、组织诊断、任务重写、业务本体、人机链路、领导力练习和 AI 治理。每个工具都说明何时使用、怎么操作、产出什么，以及如何沉淀团队与组织数据。
            </p>
          </div>
          <div className="rounded-full border border-emerald-200/15 bg-black/20 px-4 py-3 text-sm text-emerald-50/60">
            <Search className="mr-2 inline h-4 w-4 text-emerald-200" />
            {filteredTools.length} / {toolLibrary.length} 个工具
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-emerald-200/12 bg-black/20 p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-black text-white">
            <SlidersHorizontal className="h-4 w-4 text-emerald-200" />
            筛选工具
          </div>
          <FilterGroup
            label="章节"
            options={[
              { value: "all", label: "全部章节" },
              ...chapters.map((chapter) => ({ value: String(chapter), label: chapterLabel(chapter) })),
            ]}
            selected={selectedChapter}
            next={(value) => hrefWith({ chapter: value, type: selectedType, online: selectedOnline, scene: selectedScenario })}
          />
          <FilterGroup
            label="场景"
            options={[{ value: "all", label: "全部场景" }, ...scenarios.map((scene) => ({ value: scene, label: scene }))]}
            selected={selectedScenario}
            next={(value) => hrefWith({ chapter: selectedChapter, type: selectedType, online: selectedOnline, scene: value })}
          />
          <FilterGroup
            label="类型"
            options={[
              { value: "all", label: "全部类型" },
              ...types.map((type) => ({ value: type, label: toolTypeMeta[type].label })),
            ]}
            selected={selectedType}
            next={(value) => hrefWith({ chapter: selectedChapter, type: value, online: selectedOnline, scene: selectedScenario })}
          />
          <FilterGroup
            label="使用方式"
            options={[
              { value: "all", label: "全部方式" },
              ...onlineStates.map((state) => ({ value: state, label: onlineSupportMeta[state].shortLabel })),
            ]}
            selected={selectedOnline}
            next={(value) => hrefWith({ chapter: selectedChapter, type: selectedType, online: value, scene: selectedScenario })}
          />
        </div>

        <a href="/loop-designer" className="mt-8 block">
          <GlassCard className="overflow-hidden border-lime-200/25 bg-[linear-gradient(115deg,rgba(183,243,74,0.13),rgba(7,17,15,0.72)_45%)] p-0 transition hover:-translate-y-1 hover:border-lime-200/45">
            <div className="grid gap-5 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-lime-200">Loop OS · New</div>
                <h2 className="mt-3 text-3xl font-black text-white">组织回路管理系统</h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-emerald-50/65">
                  管理已确认业务回路、回路版本、资产关系和组织记忆，让每次设计沉淀为可复用的企业回路资产。
                </p>
              </div>
              <span className="inline-flex items-center justify-center gap-2 rounded-full bg-lime-300 px-5 py-3 text-sm font-black text-[#06110f]">
                进入 Loop OS
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </GlassCard>
        </a>

        <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTools.map((tool) => (
            <Link key={tool.id} href={`/tools/${tool.id}`}>
              <GlassCard className="flex h-full flex-col p-5 transition hover:-translate-y-1 hover:border-emerald-200/35">
                <div className="flex items-center justify-between gap-3">
                  <span className="rounded-full bg-emerald-300/12 px-3 py-1 text-xs font-black text-emerald-200">
                    {chapterLabel(tool.chapter)}
                  </span>
                  <ArrowRight className="h-4 w-4 text-emerald-200/70" />
                </div>
                <h2 className="mt-5 text-xl font-black leading-snug text-white">{tool.name}</h2>
                <p className="mt-2 text-sm font-semibold text-emerald-100/70">{tool.subtitle}</p>
                <p className="mt-3 flex-1 text-sm leading-7 text-emerald-50/62">{tool.purpose}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full border border-emerald-200/15 bg-white/[0.035] px-2.5 py-1 text-xs text-emerald-50/62">
                    {toolTypeMeta[tool.toolType].label}
                  </span>
                  <span className="rounded-full border border-emerald-200/15 bg-white/[0.035] px-2.5 py-1 text-xs text-emerald-50/62">
                    {onlineSupportMeta[tool.onlineSupport].shortLabel}
                  </span>
                  {tool.tags.slice(0, 2).map((tag) => (
                    <span key={tag} className="rounded-full border border-emerald-200/12 px-2.5 py-1 text-xs text-emerald-50/55">
                      {tag}
                    </span>
                  ))}
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>

        {!filteredTools.length ? (
          <div className="mt-10 rounded-[28px] border border-emerald-200/12 bg-black/20 p-8 text-center">
            <Filter className="mx-auto h-8 w-8 text-emerald-200/70" />
            <h2 className="mt-4 text-2xl font-black text-white">没有匹配的工具</h2>
            <p className="mt-2 text-sm text-emerald-50/60">调整筛选条件，或返回完整工具库。</p>
            <Link href="/tools" className="mt-5 inline-flex rounded-full bg-emerald-300 px-4 py-2 text-sm font-black text-[#06110f]">
              查看全部工具
            </Link>
          </div>
        ) : null}
      </Container>
    </AppShell>
  );
}

function FilterGroup({
  label,
  options,
  selected,
  next,
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string;
  next: (value: string) => string;
}) {
  return (
    <div className="border-t border-emerald-200/10 py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-emerald-200/70">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const active = option.value === selected;
          return (
            <Link
              key={option.value}
              href={next(option.value)}
              className={
                active
                  ? "rounded-full bg-emerald-300 px-3 py-1.5 text-xs font-black text-[#06110f]"
                  : "rounded-full border border-emerald-200/12 px-3 py-1.5 text-xs font-bold text-emerald-50/62 hover:border-emerald-200/30 hover:text-white"
              }
            >
              {option.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
