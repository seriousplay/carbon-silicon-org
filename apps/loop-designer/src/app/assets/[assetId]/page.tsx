import { ArrowLeft, GitBranch, Network, Route } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLoopAssetDetails, listLoopAssets } from "@/lib/loop-assets";
import { listLoopEvolutionEvents } from "@/lib/evolution-events";
import { listAssetInterfaceProtocols } from "@/lib/interface-protocols";
import { listLoopRelationships } from "@/lib/loop-relationships";
import type { LoopAsset, LoopRelationship } from "@/lib/loop-assets-core";
import type { InterfaceProtocol } from "@/lib/interface-protocols-core";
import type { MaturityScore } from "@/lib/plan-schema";
import { customerDimensionLabel, customerFacingText } from "@/lib/maturity";
import { InterfaceProtocolPanel } from "@/components/interface-protocol-panel";
import { LoopAssetIterationButton } from "@/components/loop-asset-iteration-button";
import { LoopOwnerCard } from "@/components/loop-owner-card";
import { LoopReleasePanel } from "@/components/loop-release-panel";
import { LoopRunBoard } from "@/components/loop-run-board";
import { LoopAssetStatusForm } from "@/components/loop-asset-status-form";
import { LoopRelationshipForm } from "@/components/loop-relationship-form";

export default async function LoopAssetDetailPage({ params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const user = await requireUser(`/loop-designer/assets/${assetId}`);
  const details = await getLoopAssetDetails(user, assetId);
  if (!details) notFound();

  const relationships = await listLoopRelationships(user, assetId);
  const evolutionEvents = await listLoopEvolutionEvents(user, assetId);
  const interfaceProtocols = await listAssetInterfaceProtocols(user, assetId);
  const assets = await listLoopAssets(user);
  const assetById = new Map(assets.map((asset) => [asset.id, asset]));
  const candidateAssets = assets.filter((asset) => asset.id !== details.asset.id);
  const current = details.currentVersion;
  const birth = current?.birthCertificate;

  return (
    <main className="min-h-screen px-5 py-6 md:px-10 md:py-10">
      <header className="mx-auto max-w-7xl border-b border-white/10 pb-5">
        <Link href="/assets" className="inline-flex items-center gap-2 text-sm text-white/50 hover:text-[var(--acid)]">
          <ArrowLeft size={15} /> 返回资产台
        </Link>
        <div className="mono mt-6 text-[10px] tracking-[.25em] text-[var(--cyan)]">LOOP ASSET DETAIL</div>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-4xl font-black leading-tight md:text-5xl">{details.asset.title}</h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-white/55">
              {current?.plan.executiveSummary || "这个回路资产还没有可审阅版本。"}
            </p>
          </div>
          <div className="flex flex-col items-start gap-3 sm:items-end">
            <span className="border border-white/10 px-3 py-1 text-xs text-white/50">{statusLabel(details.asset.status)}</span>
            <LoopAssetIterationButton assetId={details.asset.id} disabled={!current} />
            <LoopAssetStatusForm assetId={details.asset.id} status={details.asset.status} />
          </div>
        </div>
      </header>

      <section className="mx-auto grid max-w-7xl gap-6 py-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <article className="space-y-6">
          <section className="border border-white/10 bg-black/20 p-6">
            <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">CURRENT VERSION</div>
            <h2 className="mt-3 text-2xl font-black">当前版本</h2>
            {current ? (
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <Fact label="版本" value={`v${current.versionNumber}`} />
                <Fact label="回路类型" value={current.plan.loopType} />
                <Fact label="成熟度" value={current.maturityMapping ? `L${current.maturityMapping.overallLevel}` : "未评估"} />
                <Fact label="起点" value={current.plan.valueFlow.start} />
                <Fact label="终点" value={current.plan.valueFlow.end} />
                <Fact label="目标速度" value={current.plan.valueFlow.targetCycleTime} />
              </div>
            ) : <p className="mt-4 text-sm text-white/45">暂无版本记录。</p>}
          </section>

          {current?.plan.processTransformation ? (
            <section className="border border-white/10 bg-black/20 p-6">
              <div className="mono text-[10px] tracking-[.18em] text-[var(--signal)]">BREAKPOINTS</div>
              <h2 className="mt-3 text-2xl font-black">断点扫描记录</h2>
              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <Fact label="旧流程节点" value={`${current.plan.processTransformation.beforeAfter.nodeCountBefore}`} />
                <Fact label="新回路节点" value={`${current.plan.processTransformation.beforeAfter.nodeCountAfter}`} />
                <Fact label="验证信号" value={`${current.plan.processTransformation.beforeAfter.validationSignalsBefore} -> ${current.plan.processTransformation.beforeAfter.validationSignalsAfter}`} />
              </div>
              <div className="mt-5 space-y-3">
                {current.plan.processTransformation.breakpoints.filter((breakpoint) => breakpoint.userConfirmed !== false).slice(0, 6).map((breakpoint) => (
                  <div key={breakpoint.id} className="border border-white/10 p-3">
                    <div className="text-sm font-bold text-white/72">{breakpointTypeLabel(breakpoint.type)} · {breakpoint.severity}</div>
                    <p className="mt-2 text-xs leading-5 text-white/45">{breakpoint.diagnosis}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <LoopRunBoard assetId={details.asset.id} versionId={current?.id} initialEvents={evolutionEvents} />
          <LoopReleasePanel assetId={details.asset.id} versionId={current?.id} />

          {current?.maturityMapping ? (
            <section className="border border-white/10 bg-black/20 p-6">
              <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">MATURITY</div>
              <h2 className="mt-3 text-2xl font-black">成熟度诊断</h2>
              <p className="mt-4 text-sm leading-7 text-white/58">{customerFacingText(current.maturityMapping.oneLineDiagnosis)}</p>
              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {current.maturityMapping.maturity.map((item: MaturityScore) => (
                  <Fact key={item.dimension} label={dimensionLabel(item.dimension)} value={`L${item.level} · ${item.score}`} />
                ))}
              </div>
            </section>
          ) : null}

          <section className="border border-white/10 bg-black/20 p-6">
            <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">RELATIONSHIPS</div>
            <h2 className="mt-3 text-2xl font-black">回路关系</h2>
            {relationships.length ? (
              <div className="mt-5 grid gap-3">
                {relationships.map((relationship) => (
                  <RelationshipRow
                    key={relationship.id}
                    relationship={relationship}
                    assetId={details.asset.id}
                    assetById={assetById}
                    protocols={interfaceProtocols.filter((protocol) => protocol.relationshipId === relationship.id)}
                  />
                ))}
              </div>
            ) : <p className="mt-4 text-sm text-white/45">暂无父子或依赖关系。</p>}
            <LoopRelationshipForm assetId={details.asset.id} candidateAssets={candidateAssets} />
          </section>
        </article>

        <aside className="space-y-6">
          {current ? <LoopOwnerCard plan={current.plan} /> : null}

          <section className="border border-white/10 bg-black/20 p-6">
            <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">BIRTH CERTIFICATE</div>
            <h2 className="mt-3 text-2xl font-black">出生证</h2>
            {birth ? (
              <dl className="mt-5 space-y-3 text-sm text-white/58">
                <Fact label="创建来源" value={birthSourceLabel(birth.source)} />
                <Fact label="创建意图" value={birth.intent} />
                <Fact label="参考来源" value={birth.references.length ? birth.references.join("、") : "暂无记录"} />
                <Fact label="历史经验" value={birth.lessonsFromHistory.length ? birth.lessonsFromHistory.join("；") : "暂无记录"} />
                <Fact label="预期成熟度" value={birth.expectedMaturity ? `L${birth.expectedMaturity}` : "未记录"} />
                <Fact label="创建时间" value={new Date(birth.createdAt).toLocaleString("zh-CN")} />
              </dl>
            ) : <p className="mt-4 text-sm text-white/45">暂无出生证。</p>}
          </section>

          <section className="border border-white/10 bg-black/20 p-6">
            <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">MATRIX</div>
            <h2 className="mt-3 text-2xl font-black">Matrix 引用</h2>
            <dl className="mt-5 space-y-3 text-sm text-white/58">
              <Fact label="Workspace" value={details.asset.matrixWorkspaceId || "未绑定"} />
              <Fact label="Circuit" value={details.asset.matrixCircuitLogicalId || "未绑定"} />
              <Fact label="Base Version" value={details.asset.matrixBaseVersionId || "未绑定"} />
              <Fact label="审阅状态" value={current?.matrixReview ? matrixReviewLabel(current.matrixReview.status) : "暂无审阅记录"} />
              {current?.matrixReview?.studyId ? <Fact label="Study" value={current.matrixReview.studyId} /> : null}
            </dl>
            {current?.matrixReview?.returnUrl ? (
              <a href={current.matrixReview.returnUrl} className="mt-5 inline-flex items-center gap-2 bg-[var(--cyan)] px-4 py-2 text-sm font-bold text-black">
                返回 Matrix 审阅
              </a>
            ) : null}
          </section>

          <section className="border border-white/10 bg-black/20 p-6">
            <div className="mono text-[10px] tracking-[.18em] text-white/35">VERSION HISTORY</div>
            <h2 className="mt-3 text-2xl font-black">版本记录</h2>
            <div className="mt-5 space-y-3">
              {details.versions.map((version) => (
                <div key={version.id} className="border border-white/10 p-3">
                  <div className="flex items-center gap-2 text-sm font-bold"><GitBranch size={14} /> v{version.versionNumber}</div>
                  <div className="mt-2 text-xs text-white/42">{new Date(version.createdAt).toLocaleString("zh-CN")}</div>
                  {version.changeReason ? <div className="mt-2 text-xs text-white/42">{version.changeReason}</div> : null}
                  {version.matrixReview ? <div className="mt-2 text-xs text-[var(--cyan)]">Matrix：{matrixReviewLabel(version.matrixReview.status)}</div> : null}
                </div>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}

function RelationshipRow({
  relationship,
  assetId,
  assetById,
  protocols,
}: {
  relationship: LoopRelationship;
  assetId: string;
  assetById: Map<string, LoopAsset>;
  protocols: InterfaceProtocol[];
}) {
  const outgoing = relationship.sourceAssetId === assetId;
  const relatedAssetId = outgoing ? relationship.targetAssetId : relationship.sourceAssetId;
  const relatedAsset = assetById.get(relatedAssetId);
  return (
    <div className="border border-white/10 p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm text-white/72">
        {relationship.type === "parent_child" ? <Network size={14} /> : <Route size={14} />}
        <span>{outgoing ? "指向" : "来自"}</span>
        <span className="font-bold">{relatedAsset?.title || relatedAssetId.slice(0, 8)}</span>
      </div>
      <div className="mt-2 text-xs text-white/42">
        {relationship.type === "parent_child" ? "父子关系" : `依赖关系 · ${relationship.interfaceName || "未命名接口"} · ${strengthLabel(relationship.strength || "important")}`}
      </div>
      {relationship.type === "dependency" ? <InterfaceProtocolPanel relationshipId={relationship.id} protocols={protocols} /> : null}
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-white/10 pt-3">
      <div className="mono text-[9px] tracking-[.16em] text-white/30">{label}</div>
      <div className="mt-1 break-words text-sm text-white/62">{value}</div>
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = { incubating: "孵化中", active: "运行中", dormant: "沉睡", retired: "退役" };
  return labels[status] || status;
}

function birthSourceLabel(source: string) {
  const labels: Record<string, string> = { manual: "手动创建", questionnaire: "问卷/诊断", blueprint: "蓝图", matrix_origin: "Matrix Origin" };
  return labels[source] || source;
}

function strengthLabel(strength: string) {
  const labels: Record<string, string> = { critical: "关键依赖", important: "重要依赖", nice_to_have: "可选依赖" };
  return labels[strength] || strength;
}

function dimensionLabel(dimension: string) {
  return customerDimensionLabel(dimension as Parameters<typeof customerDimensionLabel>[0]) || "相关能力";
}

function matrixReviewLabel(status: string) {
  const labels: Record<string, string> = {
    ready: "已就绪",
    mapping_review: "映射审阅中",
    promoted: "已发布",
    rejected: "已拒绝",
    stale: "基础版本过期",
    submitted: "已提交",
  };
  return labels[status] || status;
}

function breakpointTypeLabel(type: string) {
  const labels: Record<string, string> = {
    information_collapse: "信息塌缩",
    waiting_black_hole: "等待黑洞",
    validation_vacuum: "验证真空",
  };
  return labels[type] || type;
}
