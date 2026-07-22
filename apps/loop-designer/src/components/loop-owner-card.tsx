import type { LoopPlan } from "@/lib/plan-schema";

export function LoopOwnerCard({ plan }: { plan: LoopPlan }) {
  const ownerRole = plan.organizationMap.humanRoles?.[0]?.name || "回路负责人";
  return (
    <section className="border border-white/10 bg-black/20 p-6">
      <div className="mono text-[10px] tracking-[.18em] text-[var(--acid)]">LOOP OWNER</div>
      <h2 className="mt-3 text-2xl font-black">回路负责人角色卡</h2>
      <p className="mt-3 text-sm leading-6 text-white/52">{ownerRole} 不只是执行者，而是目标、边界、验收和异常裁决的责任人。</p>
      <div className="mt-5 space-y-3 text-sm leading-6 text-white/58">
        <div><b className="text-white/78">Day 0：</b>锁定旧流程、三类断点和第一轮验证信号。</div>
        <div><b className="text-white/78">Day 7：</b>发布试运行版，逐轮记录真实运行结果。</div>
        <div><b className="text-white/78">Day 30：</b>校准接口协议、护栏和验收脚本。</div>
        <div><b className="text-white/78">Day 90：</b>基于证据发布正式运行版，或明确回退条件。</div>
      </div>
    </section>
  );
}
