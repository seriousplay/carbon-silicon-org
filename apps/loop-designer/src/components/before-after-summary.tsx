import type { ProcessTransformation } from "@/lib/process-transformation-core";

export function BeforeAfterSummaryCard({ transformation }: { transformation: ProcessTransformation }) {
  const metrics = transformation.beforeAfter;
  return (
    <section className="border border-white/10 bg-black/20 p-6">
      <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">BEFORE / AFTER</div>
      <h2 className="mt-3 text-2xl font-black">旧流程 vs 新回路</h2>
      <div className="mt-5 grid gap-3 md:grid-cols-4">
        <Item label="节点" value={`${metrics.nodeCountBefore} -> ${metrics.nodeCountAfter}`} />
        <Item label="人工执行" value={`${metrics.humanExecutionNodesBefore} -> ${metrics.humanExecutionNodesAfter}`} />
        <Item label="等待点" value={`${metrics.waitingPointsBefore} -> ${metrics.waitingPointsAfter}`} />
        <Item label="验证信号" value={`${metrics.validationSignalsBefore} -> ${metrics.validationSignalsAfter}`} />
      </div>
    </section>
  );
}

function Item({ label, value }: { label: string; value: string }) {
  return <div className="border border-white/10 p-3"><div className="mono text-[9px] text-white/30">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>;
}
