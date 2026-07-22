import { ArrowLeft, BookOpen, Brain, Network } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listLoopAssets } from "@/lib/loop-assets";
import { getOrgProfileSnapshot } from "@/lib/org-profile";
import { customerDimensionLabel } from "@/lib/maturity";

export default async function OrgMemoryPage() {
  const user = await requireUser("/loop-designer/memory");
  const [orgProfile, assets] = await Promise.all([
    getOrgProfileSnapshot(user),
    listLoopAssets(user),
  ]);
  const activeAssets = assets.filter((asset) => asset.status !== "retired");

  return (
    <main className="min-h-screen px-5 py-6 md:px-10 md:py-10">
      <header className="mx-auto flex max-w-7xl items-start justify-between border-b border-white/10 pb-5">
        <div>
          <Link href="/assets" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-[var(--acid)]">
            <ArrowLeft size={15} /> 返回资产台
          </Link>
          <div className="mono mt-6 text-[10px] tracking-[.25em] text-[var(--cyan)]">ORG PROFILE V1</div>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">组织记忆</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">
            这里只展示已确认回路资产计算出的结构化记忆，用于后续生成上下文、回路复用和治理审阅，不包含未确认草稿。
          </p>
        </div>
        <span className="hidden h-14 w-14 place-items-center border border-white/10 text-[var(--acid)] md:grid">
          <Brain size={26} />
        </span>
      </header>

      <section className="mx-auto max-w-7xl py-8">
        <div className="grid gap-4 md:grid-cols-4">
          <Metric label="参与回路" value={String(orgProfile.loopCount)} />
          <Metric label="活跃资产" value={String(activeAssets.length)} />
          <Metric label="角色条目" value={String(orgProfile.humanRoles.length + orgProfile.agentRoles.length + orgProfile.systemRoles.length)} />
          <Metric label="组织术语" value={String(Object.keys(orgProfile.glossary).length)} />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="space-y-6">
            <Panel eyebrow="ROLE LIBRARY" title="组织角色库" icon={<Brain size={18} />}>
              <div className="grid gap-4 md:grid-cols-3">
                <ListBlock title="人类角色" items={orgProfile.humanRoles} empty="暂无人类角色" />
                <ListBlock title="智能体角色" items={orgProfile.agentRoles} empty="暂无智能体角色" />
                <ListBlock title="系统角色" items={orgProfile.systemRoles} empty="暂无系统角色" />
              </div>
            </Panel>

            <Panel eyebrow="GLOSSARY" title="组织术语" icon={<BookOpen size={18} />}>
              {Object.keys(orgProfile.glossary).length ? (
                <div className="grid gap-3 md:grid-cols-2">
                  {Object.entries(orgProfile.glossary).slice(0, 24).map(([term, meaning]) => (
                    <div key={term} className="border border-white/10 p-4">
                      <div className="text-sm font-bold text-white/82">{term}</div>
                      <p className="mt-2 text-sm leading-6 text-white/50">{meaning}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyText>暂无组织术语。确认更多回路资产后会自动沉淀。</EmptyText>
              )}
            </Panel>
          </section>

          <aside className="space-y-6">
            <Panel eyebrow="MATURITY" title="成熟度分布" icon={<Network size={18} />}>
              <div className="space-y-3">
                {Object.entries(orgProfile.maturityDistribution).map(([level, count]) => (
                  <div key={level} className="flex items-center justify-between border border-white/10 px-4 py-3">
                    <span className="text-sm text-white/58">L{level}</span>
                    <span className="text-xl font-black text-[var(--acid)]">{count}</span>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel eyebrow="WEAK DIMENSIONS" title="主要弱维度" icon={<Network size={18} />}>
              <SimpleList
                items={orgProfile.weakDimensions.slice(0, 8).map((item) => `${dimensionLabel(item.dimension)} · ${item.frequency}`)}
                empty="暂无明显弱维度"
              />
            </Panel>

            <Panel eyebrow="DEPENDENCIES" title="常见依赖" icon={<Network size={18} />}>
              <SimpleList
                items={orgProfile.commonDependencies.slice(0, 8).map((item) => `${item.sourceDomain} -> ${item.targetDomain} · ${item.interfaceName}`)}
                empty="暂无已确认依赖"
              />
            </Panel>
          </aside>
        </div>
      </section>
    </main>
  );
}

function Panel({ eyebrow, title, icon, children }: { eyebrow: string; title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="border border-white/10 bg-black/20 p-6">
      <div className="flex items-center gap-2">
        <span className="text-[var(--cyan)]">{icon}</span>
        <span className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">{eyebrow}</span>
      </div>
      <h2 className="mt-3 text-2xl font-black">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/20 p-5">
      <div className="mono text-[10px] tracking-[.18em] text-white/35">{label}</div>
      <div className="mt-3 text-3xl font-black text-[var(--acid)]">{value}</div>
    </div>
  );
}

function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="border border-white/10 p-4">
      <div className="mono text-[9px] tracking-[.16em] text-white/30">{title}</div>
      <SimpleList items={items.slice(0, 12)} empty={empty} />
    </div>
  );
}

function SimpleList({ items, empty }: { items: string[]; empty: string }) {
  return (
    <ul className="space-y-2 text-sm text-white/55">
      {(items.length ? items : [empty]).map((item) => <li key={item}>- {item}</li>)}
    </ul>
  );
}

function EmptyText({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-7 text-white/45">{children}</p>;
}

function dimensionLabel(dimension: string) {
  return customerDimensionLabel(dimension as Parameters<typeof customerDimensionLabel>[0]) || "相关能力";
}
