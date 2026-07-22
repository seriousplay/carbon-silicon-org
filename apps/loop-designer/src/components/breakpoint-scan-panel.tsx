import type { WorkflowBreakpoint } from "@/lib/process-transformation-core";

export function BreakpointScanPanel({ breakpoints }: { breakpoints: WorkflowBreakpoint[] }) {
  return (
    <section className="border border-white/10 bg-white/[.03] p-4">
      <div className="mono text-[10px] tracking-[.18em] text-[var(--signal)]">BREAKPOINTS</div>
      <h3 className="mt-2 text-lg font-black">断点扫描</h3>
      <div className="mt-4 space-y-2">
        {breakpoints.map((breakpoint) => (
          <div key={breakpoint.id} className="border border-white/10 p-3">
            <div className="text-sm font-bold text-white/75">{breakpointLabel(breakpoint.type)} · {breakpoint.severity}</div>
            <p className="mt-1 text-xs leading-5 text-white/45">{breakpoint.diagnosis}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function breakpointLabel(type: string) {
  if (type === "information_collapse") return "信息塌缩";
  if (type === "waiting_black_hole") return "等待黑洞";
  return "验证真空";
}
