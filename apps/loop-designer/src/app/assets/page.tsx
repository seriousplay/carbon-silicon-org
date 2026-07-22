import { ArrowLeft, Boxes, Brain, Network } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { getLoopAssetDetails, listLoopAssets } from "@/lib/loop-assets";
import { listAssetInterfaceProtocols } from "@/lib/interface-protocols";
import { buildLoopNetworkWarnings, type LoopNetworkWarning } from "@/lib/loop-assets-core";
import { listLoopRelationships } from "@/lib/loop-relationships";
import { getOrgProfileSnapshot } from "@/lib/org-profile";
import { customerDimensionLabel } from "@/lib/maturity";
import { LoopAssetBoard } from "@/components/loop-asset-board";
import { ManualLoopAssetForm } from "@/components/manual-loop-asset-form";

export default async function LoopAssetsPage() {
  const user = await requireUser("/loop-designer/assets");
  const assets = await listLoopAssets(user);
  const relationships = await listLoopRelationships(user);
  const orgProfile = await getOrgProfileSnapshot(user);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const assetRecords = await Promise.all(assets.map(async (asset) => {
    const details = await getLoopAssetDetails(user, asset.id);
    const protocols = await listAssetInterfaceProtocols(user, asset.id);
    return {
      asset,
      currentVersion: details?.currentVersion ?? null,
      protocolSummary: {
        total: protocols.length,
        active: protocols.filter((protocol) => protocol.status === "active").length,
      },
    };
  }));
  const assetCards = assetRecords.map((record) => ({
    asset: record.asset,
    maturityLevel: record.currentVersion?.maturityMapping?.overallLevel ?? null,
    protocolSummary: record.protocolSummary,
  }));
  const networkWarnings = buildLoopNetworkWarnings({
    assets,
    currentVersions: assetRecords.flatMap((record) => record.currentVersion ? [record.currentVersion] : []),
    relationships,
  });

  return (
    <main className="min-h-screen px-5 py-6 md:px-10 md:py-10">
      <header className="mx-auto flex max-w-7xl items-center justify-between border-b border-white/10 pb-5">
        <div>
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-[var(--acid)]">
            <ArrowLeft size={15} /> 返回工作室
          </Link>
          <div className="mono mt-6 text-[10px] tracking-[.25em] text-[var(--cyan)]">LOOP OS ASSETS</div>
          <h1 className="mt-3 text-4xl font-black md:text-5xl">回路资产台</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">
            已确认的业务回路会沉淀为企业资产，用于后续组织记忆、回路复用和 Matrix Origin 审阅回流。
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/memory" className="hidden items-center gap-2 border border-white/10 px-4 py-3 text-sm text-white/55 hover:border-[var(--acid)] hover:text-[var(--acid)] md:inline-flex">
            <Brain size={16} /> 组织记忆
          </Link>
          <span className="hidden h-14 w-14 place-items-center border border-white/10 text-[var(--acid)] md:grid">
            <Boxes size={26} />
          </span>
        </div>
      </header>

      <section className="mx-auto max-w-7xl py-8">
        <div className="grid gap-4 md:grid-cols-3">
          <Metric label="资产数量" value={String(assets.length)} />
          <Metric label="父子关系" value={String(relationships.filter((relationship) => relationship.type === "parent_child").length)} />
          <Metric label="依赖关系" value={String(relationships.filter((relationship) => relationship.type === "dependency").length)} />
        </div>

        <section className="mt-8 border border-white/10 bg-black/20 p-6">
          <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">ORG PROFILE V1</div>
          <h2 className="mt-3 text-2xl font-black">组织记忆摘要</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            <ProfileMetric label="参与回路" value={String(orgProfile.loopCount)} />
            <ProfileMetric label="人类角色" value={String(orgProfile.humanRoles.length)} />
            <ProfileMetric label="智能体角色" value={String(orgProfile.agentRoles.length)} />
            <ProfileMetric label="组织术语" value={String(Object.keys(orgProfile.glossary).length)} />
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <ProfileList title="主要弱维度" items={orgProfile.weakDimensions.slice(0, 5).map((item) => `${dimensionLabel(item.dimension)} · ${item.frequency}`)} empty="暂无明显弱维度" />
            <ProfileList title="常见依赖" items={orgProfile.commonDependencies.slice(0, 5).map((item) => `${item.sourceDomain} → ${item.targetDomain} · ${item.interfaceName}`)} empty="暂无已确认依赖" />
          </div>
        </section>

        <ManualLoopAssetForm />

        {assets.length ? (
          <>
            <NetworkWarnings warnings={networkWarnings} />

            {relationships.length ? (
              <section className="mt-8 border border-white/10 bg-black/20 p-6">
                <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">LOOP NETWORK</div>
                <h2 className="mt-3 text-2xl font-black">轻量关系拓扑</h2>
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {relationships.map((relationship) => {
                    const source = assetById.get(relationship.sourceAssetId);
                    const target = assetById.get(relationship.targetAssetId);
                    return (
                      <div key={relationship.id} className="border border-white/10 p-4">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-bold text-white/82">{source?.title || relationship.sourceAssetId.slice(0, 8)}</span>
                          <span className="text-[var(--acid)]">→</span>
                          <span className="font-bold text-white/82">{target?.title || relationship.targetAssetId.slice(0, 8)}</span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-white/45">
                          <span className="border border-white/10 px-2 py-1">{relationship.type === "parent_child" ? "父子关系" : "依赖关系"}</span>
                          {relationship.interfaceName ? <span className="border border-white/10 px-2 py-1">接口：{relationship.interfaceName}</span> : null}
                          <span className="border border-white/10 px-2 py-1">{strengthLabel(relationship.strength || "important")}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ) : null}

            <LoopAssetBoard cards={assetCards} />
          </>
        ) : (
          <div className="mt-8 border border-white/10 bg-black/20 p-8">
            <Network className="text-[var(--cyan)]" size={28} />
            <h2 className="mt-5 text-2xl font-black">还没有企业回路资产</h2>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-white/52">
              先完成一条业务回路设计，再通过资产沉淀接口把确认后的方案转成 Loop OS 资产。未确认的草稿不会进入组织记忆。
            </p>
          </div>
        )}
      </section>
    </main>
  );
}

function NetworkWarnings({ warnings }: { warnings: LoopNetworkWarning[] }) {
  if (!warnings.length) {
    return (
      <section className="mt-8 border border-white/10 bg-black/20 p-6">
        <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">NETWORK WARNINGS</div>
        <h2 className="mt-3 text-2xl font-black">网络预警</h2>
        <p className="mt-4 text-sm leading-7 text-white/50">当前未发现孤立回路、依赖集中或父子成熟度倒挂。</p>
      </section>
    );
  }

  return (
    <section className="mt-8 border border-white/10 bg-black/20 p-6">
      <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">NETWORK WARNINGS</div>
      <h2 className="mt-3 text-2xl font-black">网络预警</h2>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {warnings.slice(0, 8).map((warning) => (
          <div key={warning.id} className="border border-white/10 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-white/82">{warning.title}</span>
              <span className="border border-white/10 px-2 py-1 text-[10px] text-[var(--cyan)]">{severityLabel(warning.severity)}</span>
            </div>
            <p className="mt-3 text-sm leading-6 text-white/55">{warning.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function dimensionLabel(dimension: string) {
  return customerDimensionLabel(dimension as Parameters<typeof customerDimensionLabel>[0]) || "相关能力";
}

function ProfileMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 p-4">
      <div className="mono text-[9px] tracking-[.16em] text-white/30">{label}</div>
      <div className="mt-2 text-2xl font-black text-white/82">{value}</div>
    </div>
  );
}

function ProfileList({ title, items, empty }: { title: string; items: string[]; empty: string }) {
  return (
    <div className="border border-white/10 p-4">
      <div className="mono text-[9px] tracking-[.16em] text-white/30">{title}</div>
      <ul className="mt-3 space-y-2 text-sm text-white/55">
        {(items.length ? items : [empty]).map((item) => <li key={item}>— {item}</li>)}
      </ul>
    </div>
  );
}

function strengthLabel(strength: string) {
  const labels: Record<string, string> = {
    critical: "关键依赖",
    important: "重要依赖",
    nice_to_have: "可选依赖",
  };
  return labels[strength] || strength;
}

function severityLabel(severity: string) {
  const labels: Record<string, string> = {
    info: "提示",
    warning: "预警",
    critical: "关键",
  };
  return labels[severity] || severity;
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-white/10 bg-black/20 p-5">
      <div className="mono text-[10px] tracking-[.18em] text-white/35">{label}</div>
      <div className="mt-3 text-3xl font-black text-[var(--acid)]">{value}</div>
    </div>
  );
}
