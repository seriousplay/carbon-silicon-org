"use client";

import { useState } from "react";
import { Trash2, ChevronDown, ChevronUp, Filter } from "lucide-react";
import { DeleteConfirmationDialog } from "./delete-response-button";
import type { RunResponse } from "@/lib/assessment/types";

export function ResponsesTable({
  responses,
  pagination,
}: {
  responses: RunResponse[];
  pagination: { page: number; total: number; pageSize: number; totalPages: number };
}) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [filterStage, setFilterStage] = useState<string>("");
  const [filterBottleneck, setFilterBottleneck] = useState<string>("");

  const toggleRow = (id: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedRows.size === filtered.length) {
      setSelectedRows(new Set());
    } else {
      setSelectedRows(new Set(filtered.map((r) => r.assessmentId)));
    }
  };

  // Filter responses
  const filtered = responses.filter((r) => {
    if (filterStage && r.stageLevel !== filterStage) return false;
    if (filterBottleneck && r.primaryBottleneck !== filterBottleneck) return false;
    return true;
  });

  // Get unique stages and bottlenecks for filters
  const stages = Array.from(new Set(responses.map((r) => r.stageLevel))).sort();
  const bottlenecks = Array.from(new Set(responses.map((r) => r.primaryBottleneck))).sort();

  return (
    <div className="mt-8 rounded-3xl border border-emerald-200/15 bg-[#0c201c]/75">
      {/* Header */}
      <div className="border-b border-emerald-200/10 p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-lg font-black text-white">所有测评回复</h3>
            <p className="mt-1 text-sm text-emerald-50/60">
              共 {pagination.total} 条记录，显示第 {(pagination.page - 1) * pagination.pageSize + 1}-
              {Math.min(pagination.page * pagination.pageSize, pagination.total)} 条
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filters */}
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-emerald-50/60" />
              <select
                value={filterStage}
                onChange={(e) => setFilterStage(e.target.value)}
                className="rounded-lg border border-emerald-200/15 bg-black/30 px-3 py-2 text-sm text-white"
              >
                <option value="">所有阶段</option>
                {stages.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>

              <select
                value={filterBottleneck}
                onChange={(e) => setFilterBottleneck(e.target.value)}
                className="rounded-lg border border-emerald-200/15 bg-black/30 px-3 py-2 text-sm text-white"
              >
                <option value="">所有瓶颈</option>
                {bottlenecks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>

            {/* Delete button */}
            <DeleteConfirmationDialog
              selectedCount={selectedRows.size}
              assessmentIds={Array.from(selectedRows)}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-emerald-200/10 bg-white/[0.02] text-emerald-50/60">
            <tr>
              <th className="px-4 py-3 text-left">
                <input
                  type="checkbox"
                  checked={selectedRows.size === filtered.length && filtered.length > 0}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 rounded border-emerald-200/30 bg-black/20"
                />
              </th>
              <th className="px-4 py-3 text-left font-bold">姓名</th>
              <th className="px-4 py-3 text-left font-bold">角色</th>
              <th className="px-4 py-3 text-left font-bold">行业</th>
              <th className="px-4 py-3 text-left font-bold">阶段</th>
              <th className="px-4 py-3 text-left font-bold">主要瓶颈</th>
              <th className="px-4 py-3 text-left font-bold">链路</th>
              <th className="px-4 py-3 text-left font-bold">宪章</th>
              <th className="px-4 py-3 text-left font-bold">提交时间</th>
              <th className="px-4 py-3 text-center font-bold">详情</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-200/10">
            {filtered.map((response) => (
              <>
                <tr key={response.assessmentId} className="hover:bg-white/[0.02]">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(response.assessmentId)}
                      onChange={() => toggleSelect(response.assessmentId)}
                      className="h-4 w-4 rounded border-emerald-200/30 bg-black/20"
                    />
                  </td>
                  <td className="px-4 py-3 font-bold text-white">{response.participantName}</td>
                  <td className="px-4 py-3 text-emerald-50/70">{response.role || "-"}</td>
                  <td className="px-4 py-3 text-emerald-50/70">{response.industry || "-"}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-full bg-emerald-300/15 px-2 py-1 text-xs font-bold text-emerald-200">
                      {response.stageLevel}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <BottleneckBadge bottleneck={response.primaryBottleneck} />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreCell value={response.chainScore} />
                  </td>
                  <td className="px-4 py-3">
                    <ScoreCell value={response.charterScore} />
                  </td>
                  <td className="px-4 py-3 text-emerald-50/60">
                    {new Date(response.submittedAt).toLocaleDateString("zh-CN")}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => toggleRow(response.assessmentId)}
                      className="rounded-lg p-1 text-emerald-50/60 hover:bg-white/10 hover:text-white"
                    >
                      {expandedRows.has(response.assessmentId) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                </tr>
                {expandedRows.has(response.assessmentId) && (
                  <tr key={`${response.assessmentId}-expanded`}>
                    <td colSpan={10} className="px-4 pb-4">
                      <ExpandedRow response={response} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="border-t border-emerald-200/10 p-4">
          <Pagination pagination={pagination} />
        </div>
      )}
    </div>
  );
}

function ScoreCell({ value }: { value: number }) {
  const colorClass =
    value >= 4 ? "text-emerald-300" : value >= 3 ? "text-yellow-300" : value >= 2 ? "text-orange-300" : "text-red-300";

  return <span className={`font-bold ${colorClass}`}>{value.toFixed(1)}</span>;
}

function BottleneckBadge({ bottleneck }: { bottleneck: string }) {
  const colorMap: Record<string, string> = {
    structure: "bg-blue-300/15 text-blue-200",
    cell: "bg-purple-300/15 text-purple-200",
    environment: "bg-cyan-300/15 text-cyan-200",
    meaning: "bg-pink-300/15 text-pink-200",
    power: "bg-red-300/15 text-red-200",
    trust: "bg-yellow-300/15 text-yellow-200",
  };

  const labelMap: Record<string, string> = {
    structure: "结构层",
    cell: "细胞层",
    environment: "环境层",
    meaning: "意义",
    power: "权力",
    trust: "信任",
  };

  const colorClass = colorMap[bottleneck] ?? "bg-gray-300/15 text-gray-200";
  const label = labelMap[bottleneck] ?? bottleneck;

  return (
    <span className={`rounded-full px-2 py-1 text-xs font-bold ${colorClass}`}>
      {label}
    </span>
  );
}

function ExpandedRow({ response }: { response: RunResponse }) {
  return (
    <div className="rounded-2xl border border-emerald-200/12 bg-black/30 p-5">
      <h4 className="mb-3 text-sm font-bold text-emerald-50/80">所有答案详情</h4>
      <div className="grid gap-2 text-xs">
        {Object.entries(response.answers).map(([questionId, value]) => {
          const questionText = getQuestionText(questionId);
          return (
            <div key={questionId} className="flex gap-3 rounded-lg bg-white/[0.02] p-2">
              <span className="w-8 flex-shrink-0 font-mono text-emerald-50/40">{questionId.split("_").pop()}</span>
              <span className="flex-1 text-emerald-50/70">{questionText}</span>
              <span className="flex-shrink-0 font-bold text-emerald-50/90">
                {typeof value === "number" ? value.toFixed(1) : value ?? "-"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getQuestionText(id: string): string {
  const questionMap: Record<string, string> = {
    stage_l1: "每个关键部门至少有一个 AI 工具在日常工作中被实质性使用",
    stage_l2: "至少有一个核心流程中，AI 输出已经进入标准工作流",
    stage_l3: "至少有一个人机混合试点团队，且协作方式可以被第二个团队复用",
    stage_l4: "公司层面已形成跨职能 AI 转型联盟，AI 项目验收标准从'工具使用'转向'业务结果'",
    stage_l5: "团队中很少再把相关工作称为'AI 项目'，因为 AI 已经成为默认工作方式",
  };

  if (id.startsWith("spiral_") || id.startsWith("energy_") || id.startsWith("chain_") || id.startsWith("charter_")) {
    return `问题 ${id}`;
  }

  return questionMap[id] ?? id;
}

function Pagination({
  pagination,
}: {
  pagination: { page: number; total: number; pageSize: number; totalPages: number };
}) {
  const pages = Array.from({ length: pagination.totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-between">
      <div className="text-sm text-emerald-50/60">
        第 {pagination.page} / {pagination.totalPages} 页
      </div>
      <div className="flex gap-2">
        {pages.map((page) => (
          <button
            key={page}
            onClick={() => {
              window.location.href = `?page=${page}`;
            }}
            className={`rounded-lg px-3 py-1 text-sm font-bold transition ${
              page === pagination.page
                ? "bg-emerald-300 text-[#06110f]"
                : "border border-emerald-200/20 text-emerald-50/70 hover:bg-white/10"
            }`}
          >
            {page}
          </button>
        ))}
      </div>
    </div>
  );
}
