"use client";

import { useMemo, useState } from "react";
import { Bot, CircleUserRound, Network, PanelRightOpen, ServerCog, X } from "lucide-react";
import type {
  AgentRole,
  HumanRole,
  OrganizationInterface,
  OrganizationMap,
  SystemRole,
} from "@/lib/plan-schema";

type NodeType = "human" | "agent" | "system";
type GraphNode = {
  id: string;
  name: string;
  type: NodeType;
  status: string;
  mission: string;
  responsibilityScope: string[];
  source: HumanRole | AgentRole | SystemRole;
};
type RelationKind = "interface" | "supervision" | "service" | "system";
type GraphEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  kind: RelationKind;
  label: string;
  detail: string;
  evidence?: string[];
  interface?: OrganizationInterface;
};
type GraphSelection = { type: "node"; id: string } | { type: "interface"; id: string } | { type: "edge"; id: string };

const TYPE_META = {
  human: { label: "人类角色", color: "#62d9cf", icon: CircleUserRound },
  agent: { label: "智能体角色", color: "#b7f34a", icon: Bot },
  system: { label: "系统角色", color: "#ff8a5c", icon: ServerCog },
};
const RELATION_META = {
  interface: { label: "接口", color: "#71847e" },
  supervision: { label: "人工", color: "#62d9cf" },
  service: { label: "服务", color: "#b7f34a" },
  system: { label: "系统支持", color: "#ff8a5c" },
} satisfies Record<RelationKind, { label: string; color: string }>;

export function hasEnhancedOrganizationMap(
  organization: OrganizationMap,
): organization is OrganizationMap & Required<Pick<
  OrganizationMap,
  "humanRoles" | "agentRoles" | "systemRoles" | "interfaces" | "assignmentChecklist" | "launchReadiness"
>> {
  return Boolean(
    organization.humanRoles?.length &&
    organization.agentRoles?.length &&
    organization.systemRoles?.length &&
    organization.interfaces?.length &&
    organization.assignmentChecklist?.length &&
    organization.launchReadiness,
  );
}

export function OrganizationArchitecture({ organization }: { organization: OrganizationMap }) {
  if (!hasEnhancedOrganizationMap(organization)) {
    return (
      <section className="panel p-7">
        <div className="flex items-center gap-3">
          <Network className="text-[var(--cyan)]" size={22} />
          <h2 className="text-2xl font-black">人机协作拓扑图</h2>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <List title="当前冲突" items={organization.conflicts} />
          <List title="建议调整" items={[...organization.roleChanges, ...organization.reportingChanges]} />
        </div>
        <p className="mt-6 border border-[var(--acid)]/25 bg-[var(--acid)]/5 p-4 text-sm leading-6 text-white/58">
          当前只有旧版回路协作映射。可在右侧选择“组织映射”进行一次定向优化，升级为角色、智能体、系统与协作接口映射。
        </p>
      </section>
    );
  }

  return <EnhancedOrganizationArchitecture organization={organization} />;
}

function EnhancedOrganizationArchitecture({
  organization,
}: {
  organization: OrganizationMap & Required<Pick<
    OrganizationMap,
    "humanRoles" | "agentRoles" | "systemRoles" | "interfaces" | "assignmentChecklist" | "launchReadiness"
  >>;
}) {
  const nodes = useMemo<GraphNode[]>(() => [
    ...organization.humanRoles.map((source) => ({ id: source.id, name: source.name, type: "human" as const, status: source.status, mission: source.mission, responsibilityScope: source.responsibilityScope, source })),
    ...organization.agentRoles.map((source) => ({ id: source.id, name: source.name, type: "agent" as const, status: source.status, mission: source.mission, responsibilityScope: source.responsibilityScope, source })),
    ...organization.systemRoles.map((source) => ({ id: source.id, name: source.name, type: "system" as const, status: source.status, mission: source.mission, responsibilityScope: source.responsibilityScope, source })),
  ], [organization]);
  const [visibleTypes, setVisibleTypes] = useState<Record<NodeType, boolean>>({ human: true, agent: true, system: true });
  const [visibleRelations, setVisibleRelations] = useState<Record<RelationKind, boolean>>({
    interface: true,
    supervision: true,
    service: true,
    system: true,
  });
  const [selection, setSelection] = useState<GraphSelection>({
    type: "node",
    id: nodes[0].id,
  });
  const [detailsOpen, setDetailsOpen] = useState(false);

  const visibleNodes = nodes.filter((node) => visibleTypes[node.type]);
  const visibleIds = new Set(visibleNodes.map((node) => node.id));
  const visibleInterfaces = organization.interfaces.filter((item) =>
    visibleIds.has(item.sourceId) &&
    visibleIds.has(item.targetId),
  );
  const allVisibleEdges: GraphEdge[] = [
    ...visibleInterfaces.map((item) => ({
      id: item.id,
      sourceId: item.sourceId,
      targetId: item.targetId,
      kind: "interface" as const,
      label: item.name,
      detail: `${item.interfaceType} · ${item.riskLevel}`,
      interface: item,
    })),
    ...organization.agentRoles.flatMap((agent) => [
      {
        id: `supervision-${agent.id}-${agent.supervisorRoleId}`,
        sourceId: agent.supervisorRoleId,
        targetId: agent.id,
        kind: "supervision" as const,
        label: "人工监督",
        detail: `${roleName(agent.supervisorRoleId, nodes)} 监督 ${agent.name} 的授权边界、异常接管和停用条件。`,
      },
      ...agent.serves.map((roleId) => ({
        id: `service-${agent.id}-${roleId}`,
        sourceId: agent.id,
        targetId: roleId,
        kind: "service" as const,
        label: "服务对象",
        detail: `${agent.name} 为 ${roleName(roleId, nodes)} 提供任务执行、建议生成或信息整理支持。`,
      })),
    ]),
    ...buildAgentSystemEdges(organization.agentRoles, organization.systemRoles, organization.interfaces),
  ].filter((edge) => visibleIds.has(edge.sourceId) && visibleIds.has(edge.targetId));
  const visibleEdges = allVisibleEdges.filter((edge) => visibleRelations[edge.kind]);
  const relationCounts = Object.fromEntries(
    (Object.keys(RELATION_META) as RelationKind[]).map((kind) => [
      kind,
      allVisibleEdges.filter((edge) => edge.kind === kind).length,
    ]),
  ) as Record<RelationKind, number>;
  const selectedNode = selection.type === "node" ? nodes.find((node) => node.id === selection.id) : undefined;
  const selectedInterface = selection.type === "interface" && visibleEdges.some((edge) => edge.kind === "interface" && edge.id === selection.id)
    ? organization.interfaces.find((item) => item.id === selection.id)
    : undefined;
  const selectedEdge = selection.type === "edge" ? visibleEdges.find((edge) => edge.id === selection.id) : undefined;

  return (
    <section className="space-y-5">
      <div className="panel overflow-hidden">
        <div className="border-b border-white/10 p-6">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">HUMAN-AI TOPOLOGY MAP</div>
              <h2 className="mt-2 text-3xl font-black">人机协作拓扑图</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-white/48">
                按人、AI、系统查看信息、决策和治理分工。线条包含接口契约、智能体服务对象、人工监督和系统支撑关系，可按角色或关系属性筛选。
              </p>
            </div>
            <div className="mono border border-white/10 px-3 py-2 text-[10px] text-white/38">
              {nodes.length} NODES / {visibleEdges.length} RELATIONS
            </div>
          </div>
          <div className="mt-5 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="mono w-16 text-[9px] tracking-[.16em] text-white/28">角色图例</span>
              {(Object.keys(TYPE_META) as NodeType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setVisibleTypes((current) => ({ ...current, [type]: !current[type] }))}
                  className={`inline-flex items-center gap-2 border px-3 py-2 text-xs ${visibleTypes[type] ? "text-white/75" : "border-white/5 text-white/20"}`}
                  style={{ borderColor: visibleTypes[type] ? TYPE_META[type].color : undefined }}
                >
                  <span className="h-2 w-2" style={{ background: TYPE_META[type].color }} />
                  {TYPE_META[type].label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
              <span className="mono w-16 text-[9px] tracking-[.16em] text-white/28">关系属性</span>
              {(Object.keys(RELATION_META) as RelationKind[]).map((kind) => (
                <button
                  key={kind}
                  type="button"
                  onClick={() => setVisibleRelations((current) => ({ ...current, [kind]: !current[kind] }))}
                  className={`inline-flex items-center gap-1.5 border bg-black/15 px-2 py-1.5 transition ${visibleRelations[kind] ? "text-white/72" : "border-white/5 text-white/20"}`}
                  style={{ borderColor: visibleRelations[kind] ? RELATION_META[kind].color : undefined, fontSize: 10, lineHeight: 1.1 }}
                  aria-pressed={visibleRelations[kind]}
                  title={`${RELATION_META[kind].label}：${relationCounts[kind]} 条`}
                >
                  <span className="relative h-2.5 w-7 shrink-0" aria-hidden="true">
                    <span
                      className="absolute left-0 top-1/2 h-px w-6 -translate-y-1/2"
                      style={{ background: RELATION_META[kind].color, opacity: visibleRelations[kind] ? 1 : .28 }}
                    />
                    <span
                      className="absolute right-0 top-1/2 h-1 w-1 -translate-y-1/2 rotate-45 border-r border-t"
                      style={{ borderColor: RELATION_META[kind].color, opacity: visibleRelations[kind] ? 1 : .28 }}
                    />
                  </span>
                  <span>{RELATION_META[kind].label}</span>
                  <span className="mono border border-white/10 px-1 py-0.5 text-[8px] text-white/42">{relationCounts[kind]}</span>
                  <span
                    className={`ml-0.5 flex h-2.5 w-5 items-center border p-[2px] ${visibleRelations[kind] ? "justify-end" : "justify-start"}`}
                    style={{ borderColor: visibleRelations[kind] ? RELATION_META[kind].color : "rgba(255,255,255,.12)" }}
                    aria-hidden="true"
                  >
                    <span
                      className="block h-1 w-1"
                      style={{ background: visibleRelations[kind] ? RELATION_META[kind].color : "rgba(255,255,255,.22)" }}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`relative ${detailsOpen ? "grid xl:grid-cols-[minmax(0,1fr)_360px]" : "grid"}`}>
          <div className={`overflow-x-auto p-4 ${detailsOpen ? "border-b border-white/10 xl:border-b-0 xl:border-r" : ""}`}>
            <OrganizationGraph
              nodes={visibleNodes}
              edges={visibleEdges}
              selected={selection}
              onSelect={(nextSelection) => {
                setSelection(nextSelection);
                setDetailsOpen(true);
              }}
            />
          </div>
          {detailsOpen ? (
            <div className="sticky bottom-0 z-20 max-h-[68vh] min-h-80 overflow-y-auto border-t border-white/10 bg-[#101416]/95 p-6 shadow-[0_-18px_48px_rgba(0,0,0,.45)] backdrop-blur-xl xl:static xl:max-h-none xl:overflow-visible xl:border-t-0 xl:bg-black/15 xl:shadow-none xl:backdrop-blur-none">
              <button
                type="button"
                onClick={() => setDetailsOpen(false)}
                className="float-right grid h-9 w-9 place-items-center border border-white/12 text-white/42 hover:border-white/35 hover:text-white"
                aria-label="收起角色详情"
                title="收起详情"
              >
                <X size={16} />
              </button>
              {selectedNode ? <NodeDetail node={selectedNode} nodes={nodes} /> : null}
              {selectedInterface ? <InterfaceDetail item={selectedInterface} nodes={nodes} /> : null}
              {selectedEdge ? <RelationDetail edge={selectedEdge} nodes={nodes} /> : null}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDetailsOpen(true)}
              className="absolute right-7 mt-5 hidden items-center gap-2 border border-white/12 bg-[#0b1714]/90 px-3 py-2 text-xs text-white/50 hover:border-[var(--cyan)]/50 hover:text-white xl:inline-flex"
            >
              <PanelRightOpen size={15} /> 查看详情
            </button>
          )}
        </div>
      </div>

      <InterfaceCards
        interfaces={organization.interfaces}
        nodes={nodes}
      />
      <LaunchConfiguration organization={organization} nodes={nodes} />
    </section>
  );
}

function OrganizationGraph({
  nodes,
  edges,
  selected,
  onSelect,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selected: GraphSelection;
  onSelect: (selection: GraphSelection) => void;
}) {
  const columns: Record<NodeType, GraphNode[]> = {
    human: nodes.filter((node) => node.type === "human"),
    agent: nodes.filter((node) => node.type === "agent"),
    system: nodes.filter((node) => node.type === "system"),
  };
  const columnX = { human: 50, agent: 345, system: 640 };
  const positions = new Map<string, { x: number; y: number }>();
  (Object.keys(columns) as NodeType[]).forEach((type) =>
    columns[type].forEach((node, index) => positions.set(node.id, { x: columnX[type], y: 82 + index * 128 })),
  );
  const height = Math.max(460, ...Object.values(columns).map((items) => 130 + items.length * 128));

  return (
    <svg width="900" height={height} viewBox={`0 0 900 ${height}`} role="img" aria-label="人机协作拓扑图">
      <defs>
        <pattern id="org-grid" width="28" height="28" patternUnits="userSpaceOnUse">
          <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(98,217,207,.06)" strokeWidth="1" />
        </pattern>
        <marker id="org-arrow" markerWidth="10" markerHeight="10" refX="8" refY="5" orient="auto">
          <path d="M0,0 L10,5 L0,10 z" fill="#8fa19a" />
        </marker>
      </defs>
      <rect width="900" height={height} fill="url(#org-grid)" />
      {(Object.keys(TYPE_META) as NodeType[]).map((type) => (
        <g key={type}>
          <text x={columnX[type]} y="34" fill={TYPE_META[type].color} fontSize="11" letterSpacing="2">{TYPE_META[type].label.toUpperCase()}</text>
          <line x1={columnX[type]} y1="50" x2={columnX[type] + 210} y2="50" stroke={TYPE_META[type].color} strokeOpacity=".25" />
        </g>
      ))}
      {edges.map((item, index) => {
        const source = positions.get(item.sourceId);
        const target = positions.get(item.targetId);
        if (!source || !target) return null;
        const geometry = edgeGeometry(source, target, index);
        const riskColor = edgeColor(item);
        const isSelected = isSelectedRelation(item, selected);
        const label = truncate(item.label, 12);
        const labelWidth = relationLabelWidth(label);
        const labelSelection = selectionForEdge(item);
        return (
          <g
            key={item.id}
            onClick={() => onSelect(labelSelection)}
            className="cursor-pointer"
            opacity={item.kind === "interface" ? 1 : .78}
          >
            <path d={geometry.path} fill="none" stroke="transparent" strokeWidth="16" />
            <path
              d={geometry.path}
              fill="none"
              stroke={isSelected ? "#fff" : riskColor}
              strokeWidth={isSelected ? 4 : item.kind === "interface" ? 2.8 : 2.2}
              strokeDasharray={edgeDash(item)}
              markerEnd="url(#org-arrow)"
              pointerEvents="none"
            />
            <g transform={`translate(${geometry.labelX} ${geometry.labelY})`}>
              <rect
                x={-labelWidth / 2}
                y="-11"
                width={labelWidth}
                height="22"
                rx="4"
                fill={isSelected ? "#edf5ef" : "#0b1714"}
                stroke={isSelected ? "#edf5ef" : riskColor}
                strokeOpacity={isSelected ? 1 : .78}
              />
              <text
                x="0"
                y="4"
                textAnchor="middle"
                fill={isSelected ? "#101416" : "#edf5ef"}
                fontSize="10"
                fontWeight="700"
              >
                {label}
              </text>
            </g>
          </g>
        );
      })}
      {nodes.map((node) => {
        const position = positions.get(node.id);
        if (!position) return null;
        const color = TYPE_META[node.type].color;
        const isSelected = selected.type === "node" && selected.id === node.id;
        const missionLines = wrapSvgText(node.mission, 13, 2);
        return (
          <g key={node.id} transform={`translate(${position.x} ${position.y})`} onClick={() => onSelect({ type: "node", id: node.id })} className="cursor-pointer">
            <rect width="210" height="88" fill={isSelected ? `${color}18` : "#0b1714"} stroke={color} strokeWidth={isSelected ? 3 : 1} />
            <rect width="5" height="88" fill={color} />
            <text x="18" y="27" fill="#edf5ef" fontSize="15" fontWeight="700">{truncate(node.name, 14)}</text>
            <text x="18" y="51" fill="#879890" fontSize="10">
              {missionLines.map((line, index) => (
                <tspan key={`${node.id}-mission-${index}`} x="18" dy={index === 0 ? 0 : 15}>{line}</tspan>
              ))}
            </text>
            <circle cx="193" cy="16" r="5" fill={node.status === "已有角色" ? color : "transparent"} stroke={color} />
          </g>
        );
      })}
    </svg>
  );
}

function edgeGeometry(source: { x: number; y: number }, target: { x: number; y: number }, index: number) {
  const nodeWidth = 210;
  const midpointOffset = (index % 4) * 10;
  const sy = source.y + 44;
  const ty = target.y + 44;
  if (source.x === target.x) {
    const sx = source.x + nodeWidth;
    const tx = target.x + nodeWidth;
    const laneX = Math.min(source.x + nodeWidth + 42 + midpointOffset, 888);
    return {
      path: `M ${sx} ${sy} C ${laneX} ${sy}, ${laneX} ${ty}, ${tx} ${ty}`,
      labelX: laneX,
      labelY: (sy + ty) / 2,
    };
  }
  if (source.x < target.x) {
    const sx = source.x + nodeWidth;
    const tx = target.x;
    const control = Math.max(54, Math.min(86 + midpointOffset, Math.max((target.x - sx) / 2, 54)));
    return {
      path: `M ${sx} ${sy} C ${sx + control} ${sy}, ${tx - control} ${ty}, ${tx} ${ty}`,
      labelX: (sx + tx) / 2,
      labelY: (sy + ty) / 2 - 8 + midpointOffset / 3,
    };
  }
  const sx = source.x;
  const tx = target.x + nodeWidth;
  const control = 58 + midpointOffset;
  return {
    path: `M ${sx} ${sy} C ${sx - control} ${sy}, ${tx + control} ${ty}, ${tx} ${ty}`,
    labelX: (sx + tx) / 2,
    labelY: (sy + ty) / 2 + 8 + midpointOffset / 3,
  };
}

function edgeColor(edge: GraphEdge) {
  if (edge.kind === "supervision") return "#62d9cf";
  if (edge.kind === "service") return "#b7f34a";
  if (edge.kind === "system") return "#ff8a5c";
  if (edge.interface?.riskLevel === "高风险") return "#ff6a3d";
  if (edge.interface?.riskLevel === "HITL") return "#f4c95d";
  return "#71847e";
}

function edgeDash(edge: GraphEdge) {
  if (edge.kind === "supervision") return "3 4";
  if (edge.kind === "service") return "2 6";
  if (edge.kind === "system") return "6 4";
  return edge.interface && ["API", "事件", "批处理", "智能体调用"].includes(edge.interface.interfaceType) ? "7 5" : undefined;
}

function selectionForEdge(edge: GraphEdge): GraphSelection {
  return edge.kind === "interface" ? { type: "interface", id: edge.id } : { type: "edge", id: edge.id };
}

function isSelectedRelation(edge: GraphEdge, selection: GraphSelection) {
  if (selection.type === "interface") return edge.kind === "interface" && edge.id === selection.id;
  if (selection.type === "edge") return edge.id === selection.id;
  return false;
}

function relationLabelWidth(label: string) {
  return Math.max(58, Math.min(148, Array.from(label).length * 12 + 18));
}

function buildAgentSystemEdges(
  agents: AgentRole[],
  systems: SystemRole[],
  interfaces: OrganizationInterface[],
): GraphEdge[] {
  const interfacePairs = new Set(interfaces.map((item) => pairKey(item.sourceId, item.targetId)));

  return agents.flatMap((agent) =>
    systems.flatMap((system) => {
      if (interfacePairs.has(pairKey(agent.id, system.id))) return [];
      const evidence = agentSystemEvidence(agent, system);
      if (!evidence.length) return [];
      return [{
        id: `system-${agent.id}-${system.id}`,
        sourceId: agent.id,
        targetId: system.id,
        kind: "system" as const,
        label: "系统支撑",
        detail: `${agent.name} 需要 ${system.name} 提供工具、上下文、事实记录或数据流转支撑。`,
        evidence,
      }];
    }),
  );
}

function pairKey(sourceId: string, targetId: string) {
  return `${sourceId}->${targetId}`;
}

function agentSystemEvidence(agent: AgentRole, system: SystemRole) {
  const agentGroups = [
    ["工具", agent.tools],
    ["上下文", agent.contextSources],
    ["可读数据", agent.readableData],
    ["输出", agent.outputs],
  ] as const;
  const systemGroups = [
    ["系统", [system.name]],
    ["业务对象", system.businessObjects],
    ["事实记录", system.records],
    ["能力", system.capabilities],
    ["输入", system.inputs],
    ["输出", system.outputs],
  ] as const;
  const evidence = new Set<string>();

  for (const [agentLabel, agentTerms] of agentGroups) {
    for (const agentTerm of agentTerms) {
      for (const [systemLabel, systemTerms] of systemGroups) {
        for (const systemTerm of systemTerms) {
          if (hasMeaningfulOverlap(agentTerm, systemTerm)) {
            evidence.add(`${agentLabel}:${agentTerm} ↔ ${systemLabel}:${systemTerm}`);
            if (evidence.size >= 3) return [...evidence];
          }
        }
      }
    }
  }

  return [...evidence];
}

function hasMeaningfulOverlap(left: string, right: string) {
  const leftTerm = normalizeRelationTerm(left);
  const rightTerm = normalizeRelationTerm(right);
  if (!isUsefulRelationTerm(leftTerm) || !isUsefulRelationTerm(rightTerm)) return false;
  if (leftTerm.includes(rightTerm) || rightTerm.includes(leftTerm)) {
    return Math.min(leftTerm.length, rightTerm.length) >= 3;
  }
  return longestCommonSubstringLength(leftTerm, rightTerm) >= 3;
}

function normalizeRelationTerm(value: string) {
  return value
    .toLowerCase()
    .replace(/待技术确认/g, "")
    .replace(/[\s,，.。:：;；/\\|()[\]{}（）《》“”"'`·-]/g, "");
}

function isUsefulRelationTerm(value: string) {
  if (value.length < 3) return false;
  return !["待确认", "数据", "系统", "记录", "输出", "输入", "保存", "检索", "审计", "同步", "建议"].includes(value);
}

function longestCommonSubstringLength(left: string, right: string) {
  let longest = 0;
  const previous = Array(right.length + 1).fill(0) as number[];
  const current = Array(right.length + 1).fill(0) as number[];
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      if (left[leftIndex - 1] === right[rightIndex - 1]) {
        current[rightIndex] = previous[rightIndex - 1] + 1;
        longest = Math.max(longest, current[rightIndex]);
      } else {
        current[rightIndex] = 0;
      }
    }
    for (let index = 1; index < current.length; index += 1) {
      previous[index] = current[index];
      current[index] = 0;
    }
  }
  return longest;
}

function NodeDetail({ node, nodes }: { node: GraphNode; nodes: GraphNode[] }) {
  const meta = TYPE_META[node.type];
  const Icon = meta.icon;
  const source = node.source;
  return (
    <div>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center border" style={{ borderColor: meta.color, color: meta.color }}><Icon size={19} /></span>
        <div>
          <div className="mono text-[9px] tracking-[.18em]" style={{ color: meta.color }}>{meta.label}</div>
          <h3 className="mt-1 text-2xl font-black">{node.name}</h3>
        </div>
      </div>
      <p className="mt-5 leading-7 text-white/62">{node.mission}</p>
      <DetailRow label="状态" value={node.status} />
      <DetailRow label="责任范围" value={node.responsibilityScope.join(" / ")} />
      {"responsibilities" in source ? (
        <>
          <DetailList label="核心职责" items={source.responsibilities} />
          <DetailList label="禁止承担" items={source.exclusions} />
          <DetailList label="决策权" items={source.decisionRights} />
          <DetailRow label="服务水平" value={source.serviceLevel} />
          <DetailRow label="异常接管" value={source.exceptionOwnership} />
          <DetailRow label="升级至" value={source.escalationTo} />
        </>
      ) : null}
      {"tasks" in source ? (
        <>
          <DetailList label="可执行任务" items={source.tasks} />
          <DetailRow label="自主等级" value={source.autonomyLevel} />
          <DetailList label="必须请示" items={source.approvalRequiredActions} />
          <DetailList label="明确禁止" items={source.prohibitedActions} />
          <DetailList label="需要人确认" items={source.hitlTriggers} />
          <DetailRow label="监督角色" value={roleName(source.supervisorRoleId, nodes)} />
          <DetailRow label="失败降级" value={source.fallback} />
          <DetailRow label="停用条件" value={source.shutdownCondition} />
        </>
      ) : null}
      {"businessObjects" in source ? (
        <>
          <DetailList label="业务对象" items={source.businessObjects} />
          <DetailList label="事实记录" items={source.records} />
          <DetailRow label="事实源" value={source.sourceOfTruth ? "是，作为唯一事实源" : "否，需引用外部事实源"} />
          <DetailRow label="集成方式" value={source.integrationMode} />
          <DetailRow label="访问控制" value={source.accessControl} />
          <DetailRow label="人工替代" value={source.manualFallback} />
        </>
      ) : null}
    </div>
  );
}

function RelationDetail({ edge, nodes }: { edge: GraphEdge; nodes: GraphNode[] }) {
  return (
    <div>
      <div className="mono text-[9px] tracking-[.18em] text-[var(--acid)]">RELATIONSHIP</div>
      <h3 className="mt-2 text-2xl font-black">{edge.label}</h3>
      <p className="mt-3 text-sm text-white/45">{roleName(edge.sourceId, nodes)} → {roleName(edge.targetId, nodes)}</p>
      <DetailRow label="关系类型" value={relationKindLabel(edge.kind)} />
      <DetailRow label="说明" value={edge.detail} />
      {edge.evidence?.length ? <DetailList label="匹配依据" items={edge.evidence} /> : null}
    </div>
  );
}

function relationKindLabel(kind: GraphEdge["kind"]) {
  if (kind === "supervision") return "人工监督";
  if (kind === "service") return "智能体服务对象";
  if (kind === "system") return "智能体与系统支撑";
  return "接口契约";
}

function InterfaceDetail({ item, nodes }: { item: OrganizationInterface; nodes: GraphNode[] }) {
  return (
    <div>
      <div className="mono text-[9px] tracking-[.18em] text-[var(--signal)]">INTERFACE CONTRACT</div>
      <h3 className="mt-2 text-2xl font-black">{item.name}</h3>
      <p className="mt-3 text-sm text-white/45">{roleName(item.sourceId, nodes)} → {roleName(item.targetId, nodes)}</p>
      <DetailRow label="风险等级" value={item.riskLevel} />
      <DetailRow label="触发事件" value={item.trigger} />
      <DetailRow label="交接对象" value={item.handoffObject} />
      <DetailList label="必要输入" items={item.requiredInputs} />
      <DetailList label="预期输出" items={item.expectedOutputs} />
      <DetailRow label="责任 / 验收" value={`${roleName(item.responsibleRoleId, nodes)} / ${roleName(item.acceptanceRoleId, nodes)}`} />
      <DetailRow label="SLA" value={item.serviceLevel} />
      <DetailList label="验收条件" items={item.acceptanceCriteria} />
      <DetailRow label="技术接口" value={`${item.interfaceType} · ${item.protocol}`} />
      <DetailRow label="数据对象" value={item.dataObject} />
      <DetailList label="最低字段" items={item.minimumFields} />
      <DetailRow label="权限方式" value={item.authorization} />
      <DetailRow label="超时升级" value={item.timeoutEscalation} />
      <DetailRow label="人工兜底" value={item.humanFallback} />
    </div>
  );
}

function InterfaceCards({
  interfaces,
  nodes,
}: {
  interfaces: OrganizationInterface[];
  nodes: GraphNode[];
}) {
  const [selectedInterfaceId, setSelectedInterfaceId] = useState<string | null>(null);
  const selectedInterface = selectedInterfaceId
    ? interfaces.find((item) => item.id === selectedInterfaceId)
    : undefined;

  return (
    <section className="panel p-6 md:p-7">
      <div className="mono text-[10px] tracking-[.2em] text-[var(--signal)]">INTERFACE REGISTER</div>
      <h2 className="mt-2 text-2xl font-black">业务与系统接口契约</h2>
      <div className={`mt-6 grid gap-5 ${selectedInterface ? "xl:grid-cols-[minmax(0,1fr)_360px]" : ""}`}>
        <div className="grid gap-3 lg:grid-cols-2">
          {interfaces.map((item) => {
            const isSelected = selectedInterfaceId === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedInterfaceId(item.id)}
                className={`border p-5 text-left hover:border-[var(--cyan)]/55 ${isSelected ? "border-[var(--signal)] bg-[var(--signal)]/6" : "border-white/10"}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <b>{item.name}</b>
                  <span className="mono text-[9px] text-[var(--signal)]">{item.riskLevel}</span>
                </div>
                <p className="mt-2 text-sm text-white/42">{roleName(item.sourceId, nodes)} → {roleName(item.targetId, nodes)}</p>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <MetricCell label="接口" value={item.interfaceType} />
                  <MetricCell label="SLA" value={item.serviceLevel} />
                  <MetricCell label="交接对象" value={item.handoffObject} />
                  <MetricCell label="事实源" value={item.sourceOfTruth} />
                </div>
              </button>
            );
          })}
        </div>
        {selectedInterface ? (
          <aside className="border border-[var(--signal)]/35 bg-black/18 p-5">
            <button
              type="button"
              onClick={() => setSelectedInterfaceId(null)}
              className="float-right grid h-8 w-8 place-items-center border border-white/12 text-white/42 hover:border-white/35 hover:text-white"
              aria-label="收起接口详情"
              title="收起详情"
            >
              <X size={15} />
            </button>
            <InterfaceDetail item={selectedInterface} nodes={nodes} />
          </aside>
        ) : null}
      </div>
    </section>
  );
}

function LaunchConfiguration({
  organization,
  nodes,
}: {
  organization: OrganizationMap & {
    assignmentChecklist: NonNullable<OrganizationMap["assignmentChecklist"]>;
    launchReadiness: NonNullable<OrganizationMap["launchReadiness"]>;
  };
  nodes: GraphNode[];
}) {
  return (
    <section className="grid gap-5 xl:grid-cols-2">
      <div className="panel p-6 md:p-7">
        <div className="mono text-[10px] tracking-[.2em] text-[var(--acid)]">ASSIGNMENT</div>
        <h2 className="mt-2 text-2xl font-black">待指派清单</h2>
        <div className="mt-5 space-y-3">
          {organization.assignmentChecklist.map((item) => (
            <div key={item.roleId} className="border border-white/10 p-4">
              <div className="flex items-center justify-between gap-3">
                <b>{roleName(item.roleId, nodes)}</b>
                <span className="text-xs text-[var(--acid)]">{item.status}</span>
              </div>
              <p className="mt-2 text-sm text-white/48">建议人数：{item.suggestedCount} · 完成期限：{item.dueBy}</p>
              <p className="mt-2 text-sm leading-6 text-white/58">所需权限：{item.requiredPermissions.join("、")}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="panel p-6 md:p-7">
        <div className="mono text-[10px] tracking-[.2em] text-[var(--cyan)]">LAUNCH READINESS</div>
        <h2 className="mt-2 text-2xl font-black">启动检查与首周节奏</h2>
        <div className="mt-5 space-y-3">
          {organization.launchReadiness.checklist.map((item) => (
            <div key={`${item.category}-${item.item}`} className="grid grid-cols-[90px_1fr] gap-3 border-b border-white/8 pb-3 text-sm">
              <span className="text-[var(--cyan)]">{item.category}</span>
              <span className="text-white/60">{item.item}<small className="mt-1 block text-white/30">证据：{item.evidence}</small></span>
            </div>
          ))}
        </div>
        <div className="mt-6 border-t border-white/10 pt-5">
          {organization.launchReadiness.firstWeekCadence.map((item) => (
            <div key={`${item.cadence}-${item.activity}`} className="mb-4">
              <b className="text-sm">{item.cadence} · {item.activity}</b>
              <p className="mt-1 text-xs leading-5 text-white/42">责任：{roleName(item.ownerRoleId, nodes)} · 产出：{item.output} · 退出触发：{item.exitTrigger}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <div className="mt-4 border-t border-white/8 pt-3"><div className="mono text-[9px] tracking-[.14em] text-white/28">{label}</div><p className="mt-1 text-sm leading-6 text-white/62">{value}</p></div>;
}

function DetailList({ label, items }: { label: string; items: string[] }) {
  return <div className="mt-4 border-t border-white/8 pt-3"><div className="mono text-[9px] tracking-[.14em] text-white/28">{label}</div><ul className="mt-2 space-y-1 text-sm leading-6 text-white/62">{items.map((item) => <li key={item}>— {item}</li>)}</ul></div>;
}

function MetricCell({ label, value }: { label: string; value: string }) {
  return <div><span className="mono block text-[9px] text-white/25">{label}</span><span className="mt-1 block line-clamp-2 text-white/55">{value}</span></div>;
}

function List({ title, items }: { title: string; items: string[] }) {
  return <div><div className="mono text-[10px] tracking-[.16em] text-white/32">{title}</div><ul className="mt-3 space-y-3 text-white/60">{items.map((item) => <li key={item}>— {item}</li>)}</ul></div>;
}

function roleName(id: string, nodes: GraphNode[]) {
  return nodes.find((node) => node.id === id)?.name ?? id;
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
}

function wrapSvgText(value: string, lineLength: number, maxLines: number) {
  const characters = Array.from(value);
  const lines = Array.from({ length: maxLines }, (_, index) =>
    characters.slice(index * lineLength, (index + 1) * lineLength).join(""),
  ).filter(Boolean);
  if (characters.length > lineLength * maxLines && lines.length) {
    lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
  }
  return lines;
}
