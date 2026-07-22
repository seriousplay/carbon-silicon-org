"use client";

import type { InterfaceData } from "./circle-map";

const interfaceStatusColor: Record<string, string> = {
  READY: "#4a7c59",
  DELAYED: "#c97b5e",
  BLOCKED: "#b85450",
  NORMAL: "#4a7c59",
  WARNING: "#c97b5e",
  HALTED: "#b85450",
};

/**
 * 回路间价值流连线
 *
 * 在 organism 视图上绘制子回路之间的接口连线，
 * 使用流动虚线动画表达数据/价值在回路间持续流动。
 */
export function FlowLines({
  interfaces,
  positions,
  circleIds,
  organismCenter,
}: {
  interfaces: InterfaceData[];
  positions: Map<string, { x: number; y: number }>;
  circleIds: Set<string>;
  organismCenter: { x: number; y: number };
}) {
  // 筛选两端都在当前视图内的接口
  const visibleInterfaces = interfaces.filter(
    (intf) => circleIds.has(intf.fromId) && circleIds.has(intf.toId)
  );

  if (visibleInterfaces.length === 0) return null;

  return (
    <g pointerEvents="none" opacity={0.55}>
      <defs>
        <marker
          id="flow-arrow"
          viewBox="0 0 6 6"
          refX="3"
          refY="3"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 6 3 L 0 6 Z" fill="#4a7c59" opacity="0.7" />
        </marker>
      </defs>
      {visibleInterfaces.map((intf, idx) => {
        const from = positions.get(intf.fromId);
        const to = positions.get(intf.toId);
        if (!from || !to) return null;

        const color = interfaceStatusColor[intf.status] ?? "#4a7c59";

        // 计算连线路径：使用微弧线避免与细胞重叠
        const midX = (from.x + to.x) / 2;
        const midY = (from.y + to.y) / 2;

        // 对弧线添加偏移，使得连线在 organism 中心的反方向弯曲
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const len = Math.sqrt(dx * dx + dy * dy) || 1;
        const nx = -dy / len; // 法线方向
        const ny = dx / len;

        // 判断弯曲方向：背离 organism 中心
        const toCenterX = organismCenter.x - midX;
        const toCenterY = organismCenter.y - midY;
        const dotProduct = nx * toCenterX + ny * toCenterY;
        const bendSign = dotProduct > 0 ? -1 : 1;
        const bendAmount = Math.min(25, len * 0.18);

        const cx = midX + nx * bendAmount * bendSign;
        const cy = midY + ny * bendAmount * bendSign;

        return (
          <g key={`${intf.fromId}-${intf.toId}-${idx}`}>
            {/* 底层：较宽的半透明线 */}
            <path
              d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
              fill="none"
              stroke={color}
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0.12}
            />
            {/* 上层：流动虚线 */}
            <path
              d={`M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`}
              fill="none"
              stroke={color}
              strokeWidth={1.4}
              strokeLinecap="round"
              strokeDasharray="5 5"
              className="flow-line"
              markerEnd="url(#flow-arrow)"
            />
          </g>
        );
      })}
    </g>
  );
}
