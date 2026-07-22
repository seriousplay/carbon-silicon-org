"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { FlowLines } from "./flow-lines";

export type CircleNodeData = {
  id: string;
  name: string;
  type: string;
  status: string;
  purpose: string;
  roles: {
    id: string;
    name: string;
    purpose: string;
    assigneeCount: number;
  }[];
  memberCount: number;
  tensionCount: number;
  blockerCount: number;
  parentId: string | null;
};

export type InterfaceData = {
  fromId: string;
  toId: string;
  name: string;
  status: string;
};

const statusColor: Record<string, string> = {
  NORMAL: "#4a7c59",
  WARNING: "#c97b5e",
  HALTED: "#b85450",
  ARCHIVED: "#a8927c",
};

const typeIcon: Record<string, string> = {
  STRATEGY: "◇",
  PRODUCTION: "❋",
  INFRA: "▣",
  CROSSCUTTING: "⬡",
};

const typeLabel: Record<string, string> = {
  STRATEGY: "战略",
  PRODUCTION: "生产",
  INFRA: "基座",
  CROSSCUTTING: "横切",
};

type CellPos = { x: number; y: number; vx: number; vy: number };

function createInitialPositions(
  circles: CircleNodeData[],
  center: number,
  outerRadius: number,
  cellRadius: number,
) {
  const positions = new Map<string, CellPos>();
  const n = circles.length;
  circles.forEach((circle, i) => {
    const angle = n <= 1 ? 0 : (i / n) * 2 * Math.PI - Math.PI / 2;
    const r = (outerRadius - cellRadius - 20) * 0.65;
    positions.set(circle.id, {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      vx: 0,
      vy: 0,
    });
  });
  return positions;
}

function clonePositions(positions: Map<string, CellPos>) {
  return new Map(Array.from(positions, ([id, pos]) => [id, { ...pos }]));
}

/**
 * 回路地图 —— 圈层视角 + 弹性物理布局
 *
 * 细胞间有力导向排斥，彼此隔离不重叠
 * 可拖动细胞，松手后弹性归位
 */
export function CircleMapClient({
  circles,
  interfaces,
  focusCircleId,
  childCounts,
  onDrillDown,
  transitionDir,
  showFlowLines,
}: {
  circles: CircleNodeData[];
  interfaces: InterfaceData[];
  focusCircleId?: string | null;
  childCounts?: Map<string, number>;
  onDrillDown?: (circleId: string) => void;
  transitionDir?: "in" | "out";
  showFlowLines?: boolean;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const roots = circles.filter((c) => !c.parentId);
  const childrenOf = useMemo(() => {
    const map = new Map<string, CircleNodeData[]>();
    for (const c of circles) {
      if (c.parentId) {
        const arr = map.get(c.parentId) ?? [];
        arr.push(c);
        map.set(c.parentId, arr);
      }
    }
    return map;
  }, [circles]);

  // 确定要渲染的 organism 视图列表
  // focusCircleId 模式：单 organism + 其子细胞
  // 正常模式：所有根节点各为一个 organism
  const focusCircle = focusCircleId ? circles.find((c) => c.id === focusCircleId) : null;
  const organismViews: { organism: CircleNodeData | null; children: CircleNodeData[] }[] = [];

  if (focusCircle) {
    // 钻取模式：focusCircle 是 organism 边界，其直接子回路是细胞
    const directChildren = circles.filter(
      (c) => c.parentId === focusCircle.id
    );
    organismViews.push({ organism: focusCircle, children: directChildren });
  } else {
    // 正常模式：每个根节点是一个 organism
    for (const root of roots) {
      const children = childrenOf.get(root.id) ?? [];
      organismViews.push({ organism: root, children });
    }
  }

  if (roots.length === 0 && !focusCircle) {
    return (
      <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
        <p className="text-sm text-muted-foreground">还没有回路</p>
      </div>
    );
  }

  if (organismViews.length === 0) {
    return (
      <div className="rounded-card border border-dashed border-border bg-card/50 p-12 text-center">
        <p className="text-sm text-muted-foreground">此回路下暂无子回路</p>
      </div>
    );
  }

  const selectedCircle = selectedId ? circles.find((c) => c.id === selectedId) : null;
  const selectedInterfaces = selectedCircle
    ? interfaces.filter((i) => i.fromId === selectedCircle.id || i.toId === selectedCircle.id)
    : [];

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-6">
      <div className="space-y-8">
        {organismViews.map(({ organism, children }) => (
          <OrganismView
            key={organism?.id ?? "root"}
            root={organism!}
            childCircles={children}
            selectedId={selectedId}
            onSelect={setSelectedId}
            childCounts={childCounts}
            onDrillDown={onDrillDown}
            transitionDir={transitionDir}
            interfaces={showFlowLines ? interfaces : undefined}
          />
        ))}
      </div>

      <div>
        {selectedCircle ? (
          <CellDetail
            circle={selectedCircle}
            interfaces={selectedInterfaces}
            allCircles={circles}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="rounded-card border border-dashed border-border bg-card/50 p-6 text-center sticky top-4">
            <div className="text-2xl mb-3 text-muted-foreground/40">❋</div>
            <p className="text-sm text-muted-foreground">点击细胞查看详情</p>
            <p className="text-xs text-muted-foreground/70 mt-1">可拖动细胞调整位置</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OrganismView({
  root,
  childCircles,
  selectedId,
  onSelect,
  childCounts,
  onDrillDown,
  transitionDir,
  interfaces,
}: {
  root: CircleNodeData;
  childCircles: CircleNodeData[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  childCounts?: Map<string, number>;
  onDrillDown?: (circleId: string) => void;
  transitionDir?: "in" | "out";
  interfaces?: InterfaceData[];
}) {
  const viewSize = 640;
  const center = viewSize / 2;
  const outerRadius = 282;
  const cellRadius = 82;
  const minDistance = cellRadius * 2 + 12; // 细胞间最小距离
  const initialPositions = useMemo(
    () => createInitialPositions(childCircles, center, outerRadius, cellRadius),
    [cellRadius, center, childCircles, outerRadius],
  );
  const [positions, setPositions] = useState(initialPositions);
  const [draggingCircleId, setDraggingCircleId] = useState<string | null>(null);
  const draggingIdRef = useRef<string | null>(null);
  const dragOffsetRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });
  const svgRef = useRef<SVGSVGElement>(null);
  const animRef = useRef<number>(0);
  const positionsRef = useRef<Map<string, CellPos>>(clonePositions(initialPositions));
  const simulateRef = useRef<() => void>(() => {});

  const ensurePositions = useCallback((posMap: Map<string, CellPos>) => {
    const n = childCircles.length;
    childCircles.forEach((circle, i) => {
      if (!posMap.has(circle.id)) {
        const angle = n <= 1 ? 0 : (i / n) * 2 * Math.PI - Math.PI / 2;
        const r = (outerRadius - cellRadius - 20) * 0.65;
        posMap.set(circle.id, {
          x: center + r * Math.cos(angle),
          y: center + r * Math.sin(angle),
          vx: 0,
          vy: 0,
        });
      }
    });
  }, [cellRadius, center, childCircles, outerRadius]);

  const syncPositions = useCallback(() => {
    setPositions(clonePositions(positionsRef.current));
  }, []);

  // 力导向模拟：细胞间排斥 + 向中心吸引 + 边界约束
  const simulate = useCallback(() => {
    const posMap = positionsRef.current;
    ensurePositions(posMap);
    if (posMap.size === 0) return;

    const childIds = childCircles.map((c) => c.id);

    // 1. 细胞间排斥力
    for (let i = 0; i < childIds.length; i++) {
      const a = posMap.get(childIds[i]);
      if (!a) continue;
      for (let j = i + 1; j < childIds.length; j++) {
        const b = posMap.get(childIds[j]);
        if (!b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (dist < minDistance) {
          // 重叠或太近：施加排斥力
          const force = (minDistance - dist) * 0.3;
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          if (draggingIdRef.current !== childIds[i]) {
            a.vx -= fx;
            a.vy -= fy;
          }
          if (draggingIdRef.current !== childIds[j]) {
            b.vx += fx;
            b.vy += fy;
          }
        }
      }
    }

    // 2. 向中心吸引 + 边界约束 + 阻尼
    for (const id of childIds) {
      const p = posMap.get(id);
      if (!p) continue;
      if (draggingIdRef.current === id) continue; // 拖动中不施加力

      // 向中心弱吸引
      const toCenterX = (center - p.x) * 0.008;
      const toCenterY = (center - p.y) * 0.008;
      p.vx += toCenterX;
      p.vy += toCenterY;

      // 阻尼
      p.vx *= 0.82;
      p.vy *= 0.82;

      // 更新位置
      p.x += p.vx;
      p.y += p.vy;

      // 边界约束（不超出大圆）
      const dx = p.x - center;
      const dy = p.y - center;
      const distFromCenter = Math.sqrt(dx * dx + dy * dy);
      const maxDist = outerRadius - cellRadius - 10;
      if (distFromCenter > maxDist) {
        p.x = center + (dx / distFromCenter) * maxDist;
        p.y = center + (dy / distFromCenter) * maxDist;
        p.vx *= -0.3; // 边界反弹
        p.vy *= -0.3;
      }
    }

    // 检查是否还有显著运动
    let totalV = 0;
    for (const id of childIds) {
      const p = posMap.get(id);
      if (p) totalV += Math.abs(p.vx) + Math.abs(p.vy);
    }

    syncPositions();

    if (totalV > 0.5 || draggingIdRef.current) {
      animRef.current = requestAnimationFrame(() => simulateRef.current());
    } else {
      animRef.current = 0;
    }
  }, [center, childCircles, ensurePositions, minDistance, outerRadius, syncPositions]);

  useEffect(() => {
    simulateRef.current = simulate;
  }, [simulate]);

  // 启动模拟
  const startSim = useCallback(() => {
    if (!animRef.current) {
      animRef.current = requestAnimationFrame(() => simulateRef.current());
    }
  }, []);

  useEffect(() => {
    startSim();
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [startSim]);

  // 鼠标/触摸交互
  const getSVGPoint = useCallback((e: React.PointerEvent) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const transformed = pt.matrixTransform(ctm.inverse());
    return { x: transformed.x, y: transformed.y };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent, circleId: string) => {
    e.stopPropagation();
    const pt = getSVGPoint(e);
    const pos = positionsRef.current.get(circleId);
    if (!pos) return;
    draggingIdRef.current = circleId;
    setDraggingCircleId(circleId);
    dragOffsetRef.current = { dx: pt.x - pos.x, dy: pt.y - pos.y };
    (e.target as Element).setPointerCapture(e.pointerId);
    onSelect(circleId);
    startSim();
  }, [getSVGPoint, onSelect, startSim]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingIdRef.current) return;
    const pt = getSVGPoint(e);
    const pos = positionsRef.current.get(draggingIdRef.current);
    if (!pos) return;
    pos.x = pt.x - dragOffsetRef.current.dx;
    pos.y = pt.y - dragOffsetRef.current.dy;
    pos.vx = 0;
    pos.vy = 0;
    syncPositions();
  }, [getSVGPoint, syncPositions]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (draggingIdRef.current) {
      (e.target as Element).releasePointerCapture(e.pointerId);
      draggingIdRef.current = null;
      setDraggingCircleId(null);
      startSim(); // 松手后弹性归位
    }
  }, [startSim]);

  const handleSelectKey = useCallback(
    (event: React.KeyboardEvent<SVGGElement>, circleId: string) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        onSelect(circleId);
      }
    },
    [onSelect],
  );

  const rootColor = statusColor[root.status] ?? "#a8927c";

  return (
    <div className="rounded-card border border-border bg-card overflow-hidden">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewSize} ${viewSize}`}
        className="w-full h-auto"
        style={{ maxHeight: "650px", touchAction: "none" }}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <defs>
          <radialGradient id={`organism-bg-${root.id}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={rootColor} stopOpacity="0.04" />
            <stop offset="70%" stopColor={rootColor} stopOpacity="0.06" />
            <stop offset="100%" stopColor={rootColor} stopOpacity="0.02" />
          </radialGradient>
          {childCircles.map((c) => {
            const color = statusColor[c.status] ?? "#a8927c";
            return (
              <radialGradient key={c.id} id={`cell-bg-${c.id}`} cx="50%" cy="40%" r="60%">
                <stop offset="0%" stopColor={color} stopOpacity={selectedId === c.id ? "0.25" : "0.15"} />
                <stop offset="100%" stopColor={color} stopOpacity="0.04" />
              </radialGradient>
            );
          })}
        </defs>

        {/* 主回路大圆 */}
        <g
          role="button"
          tabIndex={0}
          aria-label={`选择回路 ${root.name}`}
          className="cursor-pointer"
          onClick={() => onSelect(root.id)}
          onFocus={() => onSelect(root.id)}
          onKeyDown={(event) => handleSelectKey(event, root.id)}
        >
          <circle
            cx={center}
            cy={center}
            r={outerRadius}
            fill={`url(#organism-bg-${root.id})`}
            stroke={rootColor}
            strokeWidth={selectedId === root.id ? "5" : root.roles.length > 0 ? "3.5" : "2"}
            strokeDasharray="2 4"
            opacity="0.5"
          />
          {root.roles.length > 0 ? (
            <circle cx={center} cy={center} r={outerRadius - 11} fill="none" stroke={rootColor} strokeWidth="1.4" opacity="0.18" />
          ) : null}

          {/* 主回路标签 */}
          <text x={center} y={center - outerRadius + 55} textAnchor="middle" style={{ fontSize: "16px", fontWeight: 600, fill: rootColor, fontFamily: "serif" }}>
            {typeIcon[root.type]} {root.name}
          </text>
          <text x={center} y={center - outerRadius + 74} textAnchor="middle" style={{ fontSize: "10px", fill: "#6b6259" }}>
            {root.purpose}
          </text>
          <RoleGlyphs roles={root.roles} containerCx={center} containerCy={center} containerRadius={outerRadius} textBottomY={center - outerRadius + 95} />
        </g>

        {/* 子回路细胞 */}
        {childCircles.map((circle) => {
          const pos = positions.get(circle.id);
          if (!pos) return null;
          const color = statusColor[circle.status] ?? "#a8927c";
          const hasActivity = circle.blockerCount > 0;
          const totalActivity = circle.tensionCount + circle.blockerCount;
          const isSelected = selectedId === circle.id;
          const isDragging = draggingCircleId === circle.id;
          const hasRoles = circle.roles.length > 0;
          const childCount = childCounts?.get(circle.id) ?? 0;
          const hasChildren = childCount > 0;
          const canDrillDown = hasChildren && !!onDrillDown;

          const handleCellClick = (e: React.MouseEvent) => {
            e.stopPropagation();
            if (canDrillDown) {
              onDrillDown!(circle.id);
            } else {
              onSelect(circle.id);
            }
          };

          return (
            <g
              key={circle.id}
              transform={`translate(${pos.x}, ${pos.y})`}
              className="cursor-grab"
              style={{ cursor: canDrillDown ? "pointer" : isDragging ? "grabbing" : "grab" }}
              role="button"
              tabIndex={0}
              aria-label={`${canDrillDown ? "展开" : "选择"}回路 ${circle.name}`}
              onPointerDown={(e) => handlePointerDown(e, circle.id)}
              onClick={handleCellClick}
              onFocus={() => onSelect(circle.id)}
              onKeyDown={(event) => handleSelectKey(event, circle.id)}
            >
              {/* 呼吸光晕 */}
              {hasActivity && (
                <circle cx="0" cy="0" r={cellRadius} fill="none" stroke={color} strokeWidth="2" opacity="0.3">
                  <animate attributeName="r" values={`${cellRadius};${cellRadius + 8};${cellRadius}`} dur="2.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.3;0;0.3" dur="2.5s" repeatCount="indefinite" />
                </circle>
              )}

              {/* 选中光环 */}
              {isSelected && (
                <circle cx="0" cy="0" r={cellRadius + 6} fill="none" stroke={color} strokeWidth="2" opacity="0.4" />
              )}

              {/* 细胞主体 */}
              <circle
                cx="0"
                cy="0"
                r={cellRadius}
                fill={`url(#cell-bg-${circle.id})`}
                stroke={color}
                strokeWidth={isSelected ? "4" : hasRoles ? "3.5" : "2"}
              />
              {hasRoles ? (
                <circle cx="0" cy="0" r={cellRadius - 7} fill="none" stroke={color} strokeWidth="1" opacity="0.22" />
              ) : null}

              <text x="0" y={-cellRadius * 0.3} textAnchor="middle" style={{ fontSize: "20px", fill: color }}>
                {typeIcon[circle.type] ?? "❋"}
              </text>
              <text x="0" y={cellRadius * 0.08} textAnchor="middle" style={{ fontSize: "13px", fontWeight: 600, fill: "#1f1b16" }}>
                {circle.name.length > 7 ? circle.name.slice(0, 6) + "…" : circle.name}
              </text>
              <text x="0" y={cellRadius * 0.28} textAnchor="middle" style={{ fontSize: "11px", fill: "#6b6259" }}>
                {circle.memberCount}人
              </text>
              <RoleGlyphs roles={circle.roles} containerCx={0} containerCy={0} containerRadius={cellRadius} textBottomY={cellRadius * 0.40} compact />

              {totalActivity > 0 && (
                <g transform={`translate(${cellRadius * 0.6}, ${-cellRadius * 0.6})`}>
                  <circle cx="0" cy="0" r="12" fill={color} opacity="0.9" />
                  <text x="0" y="4" textAnchor="middle" style={{ fontSize: "10px", fill: "white", fontWeight: 600 }}>
                    {totalActivity}
                  </text>
                </g>
              )}

              {/* 钻取展开指示器 */}
              {canDrillDown && (
                <g transform={`translate(${cellRadius * 0.72}, ${cellRadius * 0.72})`}>
                  <circle cx="0" cy="0" r="10" fill="#faf6f0" stroke="#4a7c59" strokeWidth="1.5" opacity="0.92" />
                  <text x="0" y="3.5" textAnchor="middle" style={{ fontSize: "10px", fill: "#4a7c59", fontWeight: 700 }}>
                    {childCount > 9 ? "9+" : childCount}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        <circle cx={center} cy={center} r="3" fill={rootColor} opacity="0.3" />

        {/* 回路间价值流连线 */}
        {interfaces && interfaces.length > 0 && (
          <FlowLines
            interfaces={interfaces}
            positions={positionsRef.current}
            circleIds={new Set(childCircles.map((c) => c.id))}
            organismCenter={{ x: center, y: center }}
          />
        )}
      </svg>

      <div className="flex flex-wrap gap-4 px-6 py-3 border-t border-border text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: "#4a7c59" }} /> 正常
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-full border-2" style={{ borderColor: "#c97b5e" }} /> 预警
        </span>
        <span className="text-muted-foreground/60">拖动细胞 · 点击钻取或查看详情</span>
      </div>
    </div>
  );
}

/**
 * 计算圆内下半部分的最大内切矩形
 * 返回矩形区域：{ left, top, width, height }，保证完全在半径为 R 的圆内
 */
function inscribedRectInCircle(cx: number, cy: number, radius: number, topOffset: number, bottomPadding: number) {
  const top = cy + topOffset;
  const bottom = cy + radius - bottomPadding;
  const height = Math.max(4, bottom - top);
  // 矩形上下边缘在圆内的弦长
  const halfWTop = Math.sqrt(Math.max(0, radius * radius - (top - cy) * (top - cy)));
  const halfWBottom = Math.sqrt(Math.max(0, radius * radius - (bottom - cy) * (bottom - cy)));
  const halfW = Math.min(halfWTop, halfWBottom);
  const width = Math.max(4, halfW * 2);
  return { left: cx - width / 2, top, width, height };
}

function RoleGlyphs({
  roles,
  containerCx,
  containerCy,
  containerRadius,
  textBottomY,
  compact = false,
}: {
  roles: CircleNodeData["roles"];
  containerCx: number;
  containerCy: number;
  containerRadius: number;
  textBottomY: number;
  compact?: boolean;
}) {
  if (roles.length === 0) return null;
  const count = roles.length;

  // 计算内切矩形安全区域
  const bottomPadding = compact ? 5 : 10;
  const topOffset = textBottomY - containerCy + (compact ? 2 : 6);
  const rect = inscribedRectInCircle(containerCx, containerCy, containerRadius - (compact ? 1 : 4), topOffset, bottomPadding);

  // 网格布局
  // 紧凑模式：最多 2 列，给角色圆点更多横向空间
  // 非紧凑模式：动态列数以充分利用空间
  const columns = compact
    ? (count <= 2 ? count : 2)
    : Math.min(8, Math.max(1, Math.ceil(Math.sqrt(count * 1.15))));
  const rows = Math.ceil(count / columns);
  const gap = Math.max(2, compact ? 5 : 7);
  const cellWidth = Math.max(4, (rect.width - gap * (columns - 1)) / columns);
  const cellHeight = Math.max(4, (rect.height - gap * (rows - 1)) / rows);

  // 角色圆点大小：在允许范围内尽量大
  const maxRadius = compact
    ? (count <= 2 ? 18 : count <= 4 ? 14 : count <= 6 ? 12 : 9)
    : (count <= 3 ? 22 : count <= 6 ? 17 : count <= 10 ? 14 : 12);
  const minRadius = compact ? (count <= 2 ? 9 : count <= 4 ? 7 : 5.5) : (count <= 4 ? 11 : 7);
  const cellSpace = Math.min(cellWidth, cellHeight);
  const roleRadius = Math.max(minRadius, Math.min(maxRadius, (cellSpace / 2) - 1.5));

  const fontSize = Math.max(compact ? 7 : 7, Math.min(compact ? 10 : 12, roleRadius * 0.62));
  const showText = roleRadius >= (compact ? 9.5 : 10.5);

  const startX = rect.left + cellWidth / 2;
  const startY = rect.top + cellHeight / 2;

  return (
    <g aria-label={`角色 ${roles.map((role) => role.name).join("、")}`} pointerEvents="none">
      {roles.map((role, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const itemX = startX + column * (cellWidth + gap);
        const itemY = startY + row * (cellHeight + gap);
        const filled = role.assigneeCount > 0;
        return (
        <g key={role.id} transform={`translate(${itemX}, ${itemY})`}>
          <circle r={roleRadius} fill={filled ? "#ffffff" : "#f7f2eb"} opacity="0.95" stroke={filled ? "#4a7c59" : "#c9b8a5"} strokeWidth={Math.max(1, roleRadius * 0.15)} />
          <circle r={Math.max(1.4, roleRadius * 0.24)} fill={filled ? "#4a7c59" : "#c9b8a5"} opacity={showText ? "0.16" : "0.85"} />
          {showText ? (
            <text x="0" y={fontSize * 0.36} textAnchor="middle" style={{ fontSize, fontWeight: 700, fill: "#2f2923" }}>
              {truncateSvgText(role.name, Math.max(1, Math.floor((roleRadius * 1.6) / (fontSize * 0.55))))}
            </text>
          ) : null}
        </g>
        );
      })}
    </g>
  );
}

function truncateSvgText(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;
}

// ─── 细胞详情面板 ───────────────────────────────────────────
function CellDetail({
  circle,
  interfaces,
  allCircles,
  onClose,
}: {
  circle: CircleNodeData;
  interfaces: InterfaceData[];
  allCircles: CircleNodeData[];
  onClose: () => void;
}) {
  const color = statusColor[circle.status] ?? "#a8927c";
  const statusLabel: Record<string, string> = {
    NORMAL: "正常", WARNING: "预警", HALTED: "停摆", ARCHIVED: "归档",
  };
  const parent = circle.parentId ? allCircles.find((c) => c.id === circle.parentId) : null;
  const siblings = circle.parentId
    ? allCircles.filter((c) => c.parentId === circle.parentId && c.id !== circle.id)
    : [];

  return (
    <div className="rounded-card border border-border bg-card p-5 shadow-soft sticky top-4 animate-fade-rise">
      <button onClick={onClose} className="float-right text-muted-foreground hover:text-foreground text-sm">✕</button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 40, height: 40, background: `${color}22`, color }}>
          <span style={{ fontSize: 18 }}>{typeIcon[circle.type] ?? "❋"}</span>
        </div>
        <div className="min-w-0">
          <h3 className="font-serif text-base font-medium leading-tight">{circle.name}</h3>
          <p className="text-xs text-muted-foreground">{typeLabel[circle.type]} · {statusLabel[circle.status]}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">目的</p>
        <p className="text-sm leading-relaxed">{circle.purpose}</p>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-input border border-border p-2 text-center">
          <p className="text-xs text-muted-foreground">成员</p>
          <p className="text-sm font-medium">{circle.memberCount}</p>
        </div>
        <div className="rounded-input border border-border p-2 text-center">
          <p className="text-xs text-muted-foreground">张力</p>
          <p className="text-sm font-medium text-needs-light">{circle.tensionCount}</p>
        </div>
        <div className="rounded-input border border-border p-2 text-center">
          <p className="text-xs text-muted-foreground">阻塞</p>
          <p className="text-sm font-medium text-seed">{circle.blockerCount}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">角色 ({circle.roles.length})</p>
        {circle.roles.length === 0 ? (
          <div className="rounded-input border border-dashed border-border p-3 text-xs text-muted-foreground">
            当前圈子还没有活跃角色。
          </div>
        ) : (
          <div className="space-y-2">
            {circle.roles.map((role) => (
              <Link key={role.id} href={`/app/roles/${role.id}`} className="block rounded-input border border-border p-3 transition hover:bg-muted/40">
                <span className="block text-sm font-medium">{role.name}</span>
                <span className="mt-1 line-clamp-2 block text-xs text-muted-foreground">{role.purpose || "暂无目的描述"}</span>
                <span className="mt-2 block text-[11px] text-muted-foreground">{role.assigneeCount > 0 ? `${role.assigneeCount} 个承担者` : "空缺"}</span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="mb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">节点位置</p>
        <div className="space-y-1.5 text-xs">
          {parent && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">归属于</span>
              <span className="font-medium text-moss">{parent.name}</span>
            </div>
          )}
          {siblings.length > 0 && (
            <div>
              <p className="text-muted-foreground mb-1">同级细胞</p>
              <div className="flex flex-wrap gap-1">
                {siblings.map((s) => (
                  <span key={s.id} className="text-[10px] bg-muted/50 rounded px-1.5 py-0.5">{s.name}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {interfaces.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">接口关系 ({interfaces.length})</p>
          <div className="space-y-1.5">
            {interfaces.map((intf, i) => {
              const isFrom = intf.fromId === circle.id;
              const otherId = isFrom ? intf.toId : intf.fromId;
              const other = allCircles.find((c) => c.id === otherId);
              const intfColor = intf.status === "DELAYED" || intf.status === "BLOCKED" ? "#c97b5e" : "#4a7c59";
              return (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <span style={{ color: intfColor }}>{isFrom ? "→" : "←"}</span>
                  <span className="text-muted-foreground truncate flex-1">{intf.name}</span>
                  <span className="font-medium shrink-0">{other?.name ?? "—"}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Link href={`/app/circles/${circle.id}`} className="block text-center text-sm text-moss hover:underline pt-3 border-t border-border">
        查看回路详情 →
      </Link>
    </div>
  );
}
