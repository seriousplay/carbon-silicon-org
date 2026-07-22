import { prisma } from "@/lib/db";
import { getCurrentOrgId } from "@/lib/session";
import { OrganizationSubnav } from "../organization-subnav";
import { CircuitDesignWizard } from "@/components/circles/circuit-design-wizard";
import { LoopVisualization, type LoopData } from "@/components/circles/loop-visualization";
import { CircuitBoard, Sparkles } from "lucide-react";

export default async function OrganizationBusinessLoopsPage() {
  const organizationId = await getCurrentOrgId();

  // 获取已创建的业务回路（含节点/边/迭代/记忆统计）
  const businessLoops = await prisma.businessLoop.findMany({
    where: { organizationId, status: "ACTIVE" },
    include: {
      nodes: { orderBy: { position: "asc" } },
      edges: { orderBy: { position: "asc" } },
      _count: { select: { iterations: true, memories: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  const loopDataList: LoopData[] = businessLoops.map((loop) => ({
    id: loop.id,
    name: loop.name,
    purpose: loop.purpose,
    version: 1, // BusinessLoop doesn't have a version field directly; versions are in BusinessLoopVersion
    coreMetrics: loop.coreMetrics as any,
    cadence: loop.cadence,
    cadenceDetail: loop.cadenceDetail,
    leadRoleLabel: loop.leadRoleLabel,
    inputs: loop.inputs as any,
    outputs: loop.outputs as any,
    acceptanceCriteria: loop.acceptanceCriteria as any,
    nodes: loop.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      nodeType: n.nodeType,
      responsibility: n.responsibility,
      agentCapabilities: n.agentCapabilities,
      deliverables: n.deliverables as any,
      personId: n.personId,
      position: n.position,
    })),
    edges: loop.edges.map((e) => ({
      id: e.id,
      fromNodeId: e.fromNodeId,
      toNodeId: e.toNodeId,
      label: e.label,
      edgeType: e.edgeType,
      cadence: e.cadence,
      volume: e.volume,
      sla: e.sla,
    })),
    iterationCount: loop._count.iterations,
    memoryCount: loop._count.memories,
    createdAt: loop.createdAt.toISOString(),
    updatedAt: loop.updatedAt.toISOString(),
  }));

  return (
    <div className="mx-auto max-w-6xl animate-fade-rise space-y-6">
      <OrganizationSubnav active="business-loops" />

      <header>
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">组织</p>
        <h1 className="mt-2 font-serif text-3xl font-medium">业务回路</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          AI 辅助设计并持续运营业务价值回路——看清组织的增长飞轮。
        </p>
      </header>

      {/* 已创建的回路 */}
      <section>
        {loopDataList.length === 0 ? (
          <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
            <CircuitBoard className="w-10 h-10 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm text-muted-foreground">还没有创建业务回路</p>
            <p className="text-xs text-muted-foreground/70 mt-1">使用底部的 AI 助手设计你的第一条回路</p>
          </div>
        ) : (
          <div className="space-y-4">
            {loopDataList.map((loop) => (
              <LoopVisualization key={loop.id} loop={loop} />
            ))}
          </div>
        )}
      </section>

      {/* AI 辅助设计回路（底部可折叠） */}
      <details className="rounded-card border border-border bg-card overflow-hidden group">
        <summary className="px-5 py-3 cursor-pointer hover:bg-muted/30 transition-colors flex items-center gap-2 select-none">
          <Sparkles className="w-4 h-4 text-moss" />
          <span className="text-sm font-medium">AI 辅助设计回路</span>
          <span className="text-[10px] bg-moss/10 text-moss rounded-full px-2 py-0.5">Beta</span>
          <span className="text-xs text-muted-foreground ml-auto">点击展开</span>
        </summary>
        <div className="px-5 pb-5 pt-2 border-t border-border">
          <CircuitDesignWizard />
        </div>
      </details>
    </div>
  );
}
