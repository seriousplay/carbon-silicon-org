"use client";

import { useEffect, useRef, useState } from "react";
import { Bar, BarChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";
import type { EventSummary } from "@/lib/assessment/types";

function toRows(record: Record<string, number>) {
  return Object.entries(record).map(([name, value]) => ({ name, value }));
}

function toFixedRows(record: Record<string, number>, orderedNames: string[]) {
  const knownNames = new Set(orderedNames);
  const baseRows = orderedNames.map((name) => ({ name, value: record[name] ?? 0 }));
  const extraRows = toRows(record)
    .filter((row) => !knownNames.has(row.name))
    .sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));

  return [...baseRows, ...extraRows];
}

function toStageRows(record: Record<string, number>) {
  return toRows(record).sort((a, b) => stageOrder(a.name) - stageOrder(b.name) || a.name.localeCompare(b.name, "zh-CN"));
}

function stageOrder(name: string) {
  const match = name.match(/^L([0-5])\b/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

export function SummaryCharts({ summary }: { summary: EventSummary }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ChartCard title="AI 转型阶段分布" data={toStageRows(summary.stageDistribution)} />
      <ChartCard title="三螺旋短板分布" data={toFixedRows(summary.spiralBottlenecks, ["结构层", "细胞层", "环境层"])} />
      <ChartCard title="隐性能量卡点分布" data={toFixedRows(summary.energyBottlenecks, ["意义", "权力", "信任"])} />
      <div className="rounded-3xl border border-emerald-200/15 bg-[#0c201c]/75 p-5">
        <h3 className="text-lg font-black text-white">链路与宪章均值</h3>
        <div className="mt-5 grid grid-cols-2 gap-4">
          <Score label="人机链路准备度" value={summary.averageChainScore} />
          <Score label="AI 宪章准备度" value={summary.averageCharterScore} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, data }: { title: string; data: { name: string; value: number }[] }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.floor(entry.contentRect.width));
    });

    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="rounded-3xl border border-emerald-200/15 bg-[#0c201c]/75 p-5">
      <h3 className="text-lg font-black text-white">{title}</h3>
      <div ref={frameRef} className="mt-4 h-64 min-w-0">
        {width > 0 ? (
          <BarChart width={width} height={256} data={data} margin={{ top: 10, right: 8, bottom: 45, left: 0 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="name" angle={-18} textAnchor="end" interval={0} tick={{ fill: "#c7f9e9", fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fill: "#c7f9e9", fontSize: 11 }} />
            <Tooltip contentStyle={{ background: "#07110f", border: "1px solid rgba(110,231,183,0.3)", borderRadius: 12 }} />
            <Bar dataKey="value" fill="#6ee7b7" radius={[8, 8, 0, 0]} />
          </BarChart>
        ) : null}
      </div>
    </div>
  );
}

function Score({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/[0.055] p-5">
      <div className="text-sm text-emerald-50/60">{label}</div>
      <div className="mt-2 text-4xl font-black text-white">{value.toFixed(1)}</div>
      <div className="mt-3 h-2 rounded-full bg-white/10">
        <div className="h-full rounded-full bg-emerald-300" style={{ width: `${(value / 5) * 100}%` }} />
      </div>
    </div>
  );
}
