"use client";

import type { LegacyWorkflowNode } from "@/lib/process-transformation-core";

export function LegacyFlowComposer({
  nodes,
  onChange,
}: {
  nodes: LegacyWorkflowNode[];
  onChange: (nodes: LegacyWorkflowNode[]) => void;
}) {
  function updateNode(id: string, patch: Partial<LegacyWorkflowNode>) {
    onChange(nodes.map((node) => node.id === id ? { ...node, ...patch } : node));
  }
  function addNode() {
    const order = nodes.length + 1;
    onChange([...nodes, { id: `legacy-node-${order}`, order, action: "", owner: "", input: "", output: "" }]);
  }
  return (
    <section className="border border-white/10 bg-white/[.03] p-4">
      <div className="mono text-[10px] tracking-[.18em] text-[var(--cyan)]">LEGACY FLOW</div>
      <h3 className="mt-2 text-lg font-black">旧流程速写</h3>
      <div className="mt-4 space-y-3">
        {nodes.map((node) => (
          <div key={node.id} className="grid gap-2 border border-white/10 p-3 md:grid-cols-2">
            <input className="field" value={node.action} onChange={(event) => updateNode(node.id, { action: event.target.value })} placeholder="这一步实际在做什么" />
            <input className="field" value={node.owner} onChange={(event) => updateNode(node.id, { owner: event.target.value })} placeholder="谁执行，谁负责结果" />
            <input className="field" value={node.input} onChange={(event) => updateNode(node.id, { input: event.target.value })} placeholder="输入来自哪里" />
            <input className="field" value={node.output} onChange={(event) => updateNode(node.id, { output: event.target.value })} placeholder="输出交给谁" />
          </div>
        ))}
      </div>
      <button type="button" onClick={addNode} className="mt-3 border border-white/15 px-3 py-2 text-xs text-white/60">增加旧流程节点</button>
    </section>
  );
}
