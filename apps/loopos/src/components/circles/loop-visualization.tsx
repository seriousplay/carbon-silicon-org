"use client";

import { useState } from "react";
import { Users, GitBranch, ArrowRight, Clock, BookOpen, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

type LoopNode = {
  id: string;
  name: string;
  nodeType: string;
  responsibility: string;
  agentCapabilities: string | null;
  deliverables: any;
  personId: string | null;
  position: number;
};

type LoopEdge = {
  id: string;
  fromNodeId: string | null;
  toNodeId: string | null;
  label: string;
  edgeType: string;
  cadence: string | null;
  volume: string | null;
  sla: string | null;
};

export type LoopData = {
  id: string;
  name: string;
  purpose: string | null;
  version: number;
  coreMetrics: any;
  cadence: string | null;
  cadenceDetail: string | null;
  leadRoleLabel: string | null;
  inputs: any;
  outputs: any;
  acceptanceCriteria: any;
  nodes: LoopNode[];
  edges: LoopEdge[];
  iterationCount: number;
  memoryCount: number;
  createdAt: string;
  updatedAt: string;
};

const cadenceLabels: Record<string, string> = {
  WEEKLY: "每周", BIWEEKLY: "每两周", MONTHLY: "每月", CONTINUOUS: "持续运转",
};

const edgeColors: Record<string, string> = {
  VALUE: "#4a7c59", DATA: "#6b8e7f", SIGNAL: "#c97b5e", DECISION_SIGNAL: "#a8927c", EVIDENCE: "#8b9e8b",
};

const statusLabels: Record<string, string> = {
  DRAFT: "草稿", ACTIVE: "运转中", ARCHIVED: "已归档",
};

export function LoopVisualization({ loop }: { loop: LoopData }) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const svgW = 680;
  const svgH = 300;
  const cx = svgW / 2;
  const cy = svgH / 2;

  const nodePositions = loop.nodes.map((node, i) => {
    const count = loop.nodes.length || 1;
    const angle = (i / count) * 2 * Math.PI - Math.PI / 2;
    const radius = Math.min(115, count <= 2 ? 95 : count <= 4 ? 105 : 115);
    return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle), ...node };
  });

  const nodeMap = new Map(nodePositions.map((n) => [n.id, n]));
  const selectedNode = selectedNodeId ? loop.nodes.find((n) => n.id === selectedNodeId) : null;
  const metrics: Array<{ name: string; target: string; unit: string }> = Array.isArray(loop.coreMetrics) ? loop.coreMetrics : [];
  const inputs: Array<{ label: string; source: string }> = Array.isArray(loop.inputs) ? loop.inputs : [];
  const outputs: Array<{ label: string; consumer: string }> = Array.isArray(loop.outputs) ? loop.outputs : [];
  const criteria: Array<{ condition: string; measure: string }> = Array.isArray(loop.acceptanceCriteria) ? loop.acceptanceCriteria : [];

  return (
    <div className="rounded-card border border-border bg-card overflow-hidden">
      {/* 头部 */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-lg font-medium">{loop.name}</h2>
              <span className="text-[10px] bg-moss/10 text-moss rounded-full px-2 py-0.5">v{loop.version}</span>
            </div>
            {loop.purpose && <p className="text-sm text-muted-foreground mt-1">{loop.purpose}</p>}
          </div>
          <button onClick={() => setShowDetail(!showDetail)} className="shrink-0 text-xs text-moss hover:underline flex items-center gap-1">
            {showDetail ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showDetail ? "收起详情" : "回路详情"}
          </button>
        </div>

        {/* 指标标签 + 统计 */}
        <div className="flex flex-wrap items-center gap-2 mt-3">
          {metrics.map((m, i) => (
            <span key={i} className="text-[10px] bg-moss-pale/40 text-moss rounded-full px-2 py-0.5">
              {m.name}: {m.target}{m.unit}
            </span>
          ))}
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <Users className="w-3 h-3" />{loop.nodes.length} 节点
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <GitBranch className="w-3 h-3" />{loop.edges.length} 连接
          </span>
          {loop.cadence && <span className="text-[10px] text-muted-foreground">· {cadenceLabels[loop.cadence] || loop.cadence}</span>}
          {loop.leadRoleLabel && <span className="text-[10px] text-muted-foreground">· 负责人: {loop.leadRoleLabel}</span>}
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <RefreshCw className="w-3 h-3" />{loop.iterationCount} 次迭代
          </span>
          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
            <BookOpen className="w-3 h-3" />{loop.memoryCount} 条经验
          </span>
        </div>
      </div>

      {/* 回路详情面板（可展开） */}
      {showDetail && (
        <div className="px-5 py-4 border-b border-border bg-muted/20 grid gap-4 md:grid-cols-3 text-sm">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">版本与时间</p>
            <div className="space-y-1 text-xs">
              <p>设计版本: v{loop.version}</p>
              <p>创建时间: {new Date(loop.createdAt).toLocaleDateString("zh-CN")}</p>
              <p>最近更新: {new Date(loop.updatedAt).toLocaleDateString("zh-CN")}</p>
              <p>迭代记录: {loop.iterationCount} 次</p>
              <p>组织经验: {loop.memoryCount} 条</p>
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">输入 / 输出</p>
            <div className="space-y-1.5 text-xs">
              {inputs.length === 0 && outputs.length === 0 && <p className="text-muted-foreground/60">暂无定义</p>}
              {inputs.map((inp, i) => (
                <p key={i}>📥 {inp.label} ← {inp.source}</p>
              ))}
              {outputs.map((out, i) => (
                <p key={i}>📤 {out.label} → {out.consumer}</p>
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">验收标准</p>
            <div className="space-y-1 text-xs">
              {criteria.length === 0 && <p className="text-muted-foreground/60">暂无定义</p>}
              {criteria.map((c, i) => (
                <p key={i}>✓ {c.condition}（{c.measure}）</p>
              ))}
            </div>
            {loop.cadenceDetail && (
              <div className="mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">运转节奏</p>
                <p className="text-xs">{loop.cadenceDetail}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SVG 可视化 + 节点面板 */}
      <div className="grid lg:grid-cols-[1fr_260px]">
        <svg viewBox={`0 0 ${svgW} ${svgH}`} className="w-full h-auto" style={{ maxHeight: "340px" }}>
          <defs>
            <radialGradient id={`loop-bg-${loop.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#4a7c59" stopOpacity="0.04" />
              <stop offset="100%" stopColor="#4a7c59" stopOpacity="0.01" />
            </radialGradient>
          </defs>

          <circle cx={cx} cy={cy} r={140} fill={`url(#loop-bg-${loop.id})`} stroke="#4a7c59" strokeWidth="1.5" strokeDasharray="3 5" opacity="0.35" />

          {/* 连线 */}
          {loop.edges.map((edge) => {
            const from = nodeMap.get(edge.fromNodeId || "");
            const to = nodeMap.get(edge.toNodeId || "");
            if (!from || !to) return null;
            const color = edgeColors[edge.edgeType] || "#4a7c59";
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const qx = mx - (dy / len) * 16;
            const qy = my + (dx / len) * 16;
            return (
              <g key={edge.id}>
                <path d={`M ${from.x} ${from.y} Q ${qx} ${qy} ${to.x} ${to.y}`} fill="none" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.45" className="flow-line" />
                <text x={qx} y={qy - 5} textAnchor="middle" style={{ fontSize: "9px", fill: color }} opacity="0.75">
                  {edge.label}
                </text>
              </g>
            );
          })}

          {/* 节点 */}
          {nodePositions.map((node) => {
            const isSelected = selectedNodeId === node.id;
            return (
              <g key={node.id} className="cursor-pointer" onClick={() => setSelectedNodeId(isSelected ? null : node.id)}>
                <circle cx={node.x} cy={node.y} r={isSelected ? 40 : 35} fill="white" stroke={isSelected ? "#4a7c59" : "#c9b8a5"} strokeWidth={isSelected ? "3" : "1.5"} />
                <text x={node.x} y={node.y - 5} textAnchor="middle" style={{ fontSize: "14px" }}>
                  {node.nodeType === "AI_AGENT" ? "🤖" : "👤"}
                </text>
                <text x={node.x} y={node.y + 13} textAnchor="middle" style={{ fontSize: "10px", fontWeight: 600, fill: "#1f1b16" }}>
                  {node.name.length > 7 ? node.name.slice(0, 6) + "…" : node.name}
                </text>
              </g>
            );
          })}

          <text x={cx} y={cy + 4} textAnchor="middle" style={{ fontSize: "11px", fill: "#4a7c59", fontWeight: 600 }}>
            {loop.name}
          </text>
        </svg>

        {/* 节点详情面板 */}
        <div className="border-l border-border p-4">
          {selectedNode ? (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-lg">{selectedNode.nodeType === "AI_AGENT" ? "🤖" : "👤"}</span>
                <div>
                  <p className="font-medium">{selectedNode.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {selectedNode.nodeType === "AI_AGENT" ? "AI 智能体" : "人类角色"}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-[10px] font-medium uppercase text-muted-foreground">职责</p>
                <p className="text-xs mt-0.5">{selectedNode.responsibility || "暂无定义"}</p>
              </div>

              {selectedNode.nodeType === "AI_AGENT" && selectedNode.agentCapabilities && (
                <div>
                  <p className="text-[10px] font-medium uppercase text-muted-foreground">能力边界</p>
                  <p className="text-xs mt-0.5">{selectedNode.agentCapabilities}</p>
                </div>
              )}

              {/* 节点相关连线 */}
              {loop.edges.filter((e) => e.fromNodeId === selectedNode.id || e.toNodeId === selectedNode.id).length > 0 && (
                <div>
                  <p className="text-[10px] font-medium uppercase text-muted-foreground mb-1">连接</p>
                  <div className="space-y-1">
                    {loop.edges.filter((e) => e.fromNodeId === selectedNode.id || e.toNodeId === selectedNode.id).map((e) => {
                      const other = e.fromNodeId === selectedNode.id ? nodeMap.get(e.toNodeId || "") : nodeMap.get(e.fromNodeId || "");
                      return (
                        <div key={e.id} className="flex items-center gap-1 text-[10px] bg-muted/30 rounded px-1.5 py-0.5">
                          <ArrowRight className={`w-3 h-3 ${e.fromNodeId === selectedNode.id ? "text-moss" : "text-moss rotate-180"}`} />
                          <span>{other?.name || "?"}</span>
                          <span className="text-muted-foreground/70 ml-auto">· {e.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <p className="text-xs text-muted-foreground">点击节点查看详情</p>
              <p className="text-[10px] text-muted-foreground/70 mt-1">或点击右上角「回路详情」</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
