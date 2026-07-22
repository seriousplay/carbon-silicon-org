"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GitBranch } from "lucide-react";
import type { LoopAsset, LoopAssetStatus } from "@/lib/loop-assets-core";
import type { MaturityLevel } from "@/lib/plan-schema";

export type LoopAssetBoardCard = {
  asset: LoopAsset;
  maturityLevel: MaturityLevel | null;
  protocolSummary?: {
    total: number;
    active: number;
  };
};

const STATUS_OPTIONS: Array<{ value: "all" | LoopAssetStatus; label: string }> = [
  { value: "all", label: "全部状态" },
  { value: "incubating", label: "孵化中" },
  { value: "active", label: "运行中" },
  { value: "dormant", label: "沉睡" },
  { value: "retired", label: "退役" },
];

export function LoopAssetBoard({ cards }: { cards: LoopAssetBoardCard[] }) {
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]["value"]>("all");
  const [domain, setDomain] = useState("all");
  const [maturity, setMaturity] = useState<"all" | "1" | "2" | "3" | "4" | "5" | "none">("all");
  const domains = useMemo(() => Array.from(new Set(cards.map((card) => card.asset.domain))).sort(), [cards]);
  const filtered = cards.filter((card) => {
    if (status !== "all" && card.asset.status !== status) return false;
    if (domain !== "all" && card.asset.domain !== domain) return false;
    if (maturity === "none") return card.maturityLevel === null;
    if (maturity !== "all" && card.maturityLevel !== Number(maturity)) return false;
    return true;
  });

  return (
    <section className="mt-8">
      <div className="border border-white/10 bg-black/20 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <Filter label="状态" value={status} onChange={(value) => setStatus(value as typeof status)}>
            {STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </Filter>
          <Filter label="领域" value={domain} onChange={setDomain}>
            <option value="all">全部领域</option>
            {domains.map((item) => <option key={item} value={item}>{item}</option>)}
          </Filter>
          <Filter label="成熟度" value={maturity} onChange={(value) => setMaturity(value as typeof maturity)}>
            <option value="all">全部成熟度</option>
            <option value="none">未评估</option>
            {[1, 2, 3, 4, 5].map((level) => <option key={level} value={String(level)}>L{level}</option>)}
          </Filter>
        </div>
        <div className="mt-3 text-xs text-white/40">显示 {filtered.length} / {cards.length} 个回路资产</div>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {filtered.map(({ asset, maturityLevel, protocolSummary }) => (
          <article key={asset.id} className="border border-white/10 bg-black/20 p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mono text-[10px] text-white/35">{asset.domain}</div>
                <h2 className="mt-3 text-2xl font-black leading-tight">{asset.title}</h2>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className="border border-white/10 px-3 py-1 text-xs text-white/50">{statusLabel(asset.status)}</span>
                <span className="border border-white/10 px-3 py-1 text-xs text-[var(--cyan)]">{maturityLevel ? `L${maturityLevel}` : "未评估"}</span>
              </div>
            </div>
            <dl className="mt-5 grid gap-3 text-sm text-white/55 sm:grid-cols-2">
              <AssetField label="当前版本" value={asset.currentVersionId ? asset.currentVersionId.slice(0, 8) : "待写入"} />
              <AssetField label="来源会话" value={asset.sourceSessionId ? asset.sourceSessionId.slice(0, 8) : "手动创建"} />
              <AssetField label="更新时间" value={new Date(asset.updatedAt).toLocaleDateString("zh-CN")} />
              <AssetField label="Matrix Circuit" value={asset.matrixCircuitLogicalId || "未绑定"} />
              <AssetField label="接口协议" value={protocolStatus(protocolSummary)} />
            </dl>
            <Link href={`/assets/${asset.id}`} className="mt-5 inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/55 hover:border-[var(--acid)] hover:text-[var(--acid)]">
              查看详情
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}

function protocolStatus(summary: LoopAssetBoardCard["protocolSummary"]) {
  if (!summary || summary.total === 0) return "无协议/待补";
  if (summary.active > 0) return `${summary.active} 个已生效 / ${summary.total} 个版本`;
  return `${summary.total} 个草稿，待启用`;
}

function Filter({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mono text-[9px] tracking-[.16em] text-white/30">{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} className="field mt-2">
        {children}
      </select>
    </label>
  );
}

function AssetField({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-white/10 pt-3">
      <dt className="mono text-[9px] tracking-[.16em] text-white/30">{label}</dt>
      <dd className="mt-1 flex items-center gap-2 break-all">
        <GitBranch size={13} className="shrink-0 text-white/30" />
        {value}
      </dd>
    </div>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    incubating: "孵化中",
    active: "运行中",
    dormant: "沉睡",
    retired: "退役",
  };
  return labels[status] || status;
}
