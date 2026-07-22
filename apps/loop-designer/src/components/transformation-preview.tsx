import type { ProcessTransformation } from "@/lib/process-transformation-core";

export function TransformationPreview({ transformation }: { transformation: ProcessTransformation }) {
  return (
    <section className="border border-white/10 bg-white/[.03] p-4">
      <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">TRANSFORMATION</div>
      <h3 className="mt-2 text-lg font-black">回路重构预览</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Metric label="节点" value={`${transformation.beforeAfter.nodeCountBefore} -> ${transformation.beforeAfter.nodeCountAfter}`} />
        <Metric label="等待" value={`${transformation.beforeAfter.waitingPointsBefore} -> ${transformation.beforeAfter.waitingPointsAfter}`} />
        <Metric label="验证" value={`${transformation.beforeAfter.validationSignalsBefore} -> ${transformation.beforeAfter.validationSignalsAfter}`} />
      </div>
      <div className="mt-4 space-y-2">
        {transformation.moves.slice(0, 4).map((move) => (
          <div key={move.id} className="border border-white/10 p-3 text-sm text-white/58">{move.title}</div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="border border-white/10 p-3"><div className="mono text-[9px] text-white/30">{label}</div><div className="mt-1 text-lg font-black">{value}</div></div>;
}
