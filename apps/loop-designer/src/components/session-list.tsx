"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowUpRight, Pencil, Trash2 } from "lucide-react";
import { readApiResponse } from "@/lib/api-response";
import type { LoopDesignerSession } from "@/lib/session-types";
import { CONVERSATION_STEPS } from "@/lib/conversation";
import { DIAGNOSIS_STEPS } from "@/lib/workflow";

export function SessionList({ sessions }: { sessions: LoopDesignerSession[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function rename(session: LoopDesignerSession) {
    const title = editing?.title.trim();
    if (!title) return setError("标题不能为空。");
    setBusyId(session.id); setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title }),
      });
      const payload = await readApiResponse(response, "重命名失败");
      if (!response.ok || payload.error) return setError(payload.error || "重命名失败");
      setEditing(null);
      router.refresh();
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setBusyId(null);
    }
  }

  async function remove(session: LoopDesignerSession) {
    const title = sessionTitle(session);
    if (!window.confirm(`确认删除“${title}”？此操作会移除该回路草稿和生成结果。`)) return;
    setBusyId(session.id); setError(null);
    try {
      const response = await fetch(`/loop-designer/api/sessions/${session.id}`, { method: "DELETE" });
      const payload = await readApiResponse(response, "删除失败");
      if (!response.ok || payload.error) return setError(payload.error || "删除失败");
      router.refresh();
    } catch {
      setError("网络连接中断，请稍后重试。");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section className="mx-auto max-w-7xl border-t border-white/10 py-10">
      <div className="mono mb-5 text-[10px] tracking-[.2em] text-white/42">COMPLETED LOOP DESIGNS</div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {sessions.slice(0, 6).map((session) => {
          const title = sessionTitle(session);
          const href = sessionHref(session);
          const isEditing = editing?.id === session.id;
          return (
            <article key={session.id} className="group border border-white/10 bg-black/20 p-5 hover:border-[var(--acid)]/60">
              <div className="flex items-start justify-between gap-3">
                <span className="mono text-[10px] text-white/38">{new Date(session.createdAt).toLocaleDateString("zh-CN")}</span>
                <Link href={href} aria-label={`打开${title}`} className="text-white/35 group-hover:text-[var(--acid)]">
                  <ArrowUpRight size={16} />
                </Link>
              </div>
              {isEditing ? (
                <div className="mt-4">
                  <input
                    autoFocus
                    value={editing.title}
                    maxLength={120}
                    onChange={(event) => setEditing({ id: session.id, title: event.target.value })}
                    className="w-full border border-[var(--cyan)]/50 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button disabled={busyId === session.id} onClick={() => void rename(session)} className="border border-[var(--acid)] px-3 py-2 text-xs font-bold text-[var(--acid)] disabled:opacity-40">保存</button>
                    <button disabled={busyId === session.id} onClick={() => setEditing(null)} className="border border-white/15 px-3 py-2 text-xs text-white/55 disabled:opacity-40">取消</button>
                  </div>
                </div>
              ) : (
                <Link href={href} className="block">
                  <h2 className="mt-4 text-xl font-bold">{title}</h2>
                  <p className="mt-2 text-sm text-white/45">{sessionStatusText(session)}</p>
                </Link>
              )}
              <div className="mt-5 flex flex-wrap gap-2 border-t border-white/10 pt-4">
                <button
                  disabled={busyId === session.id}
                  onClick={() => setEditing({ id: session.id, title })}
                  className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/55 hover:border-[var(--cyan)] hover:text-[var(--cyan)] disabled:opacity-40"
                >
                  <Pencil size={13} /> 重命名
                </button>
                <button
                  disabled={busyId === session.id}
                  onClick={() => void remove(session)}
                  className="inline-flex items-center gap-2 border border-white/15 px-3 py-2 text-xs text-white/55 hover:border-[var(--signal)] hover:text-[var(--signal)] disabled:opacity-40"
                >
                  <Trash2 size={13} /> 删除
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {error ? <p className="mt-4 border border-[var(--signal)]/40 bg-[var(--signal)]/10 px-4 py-3 text-sm text-orange-100">{error}</p> : null}
    </section>
  );
}

function sessionTitle(session: LoopDesignerSession) {
  if (session.context.workflowStage === "questionnaire") return session.context.questionnaire?.company ? `课前问卷 · ${session.context.questionnaire.company}` : "课前问卷";
  if (session.context.workflowStage === "diagnosis") return "组织进化蓝图诊断";
  if (session.context.workflowStage === "blueprint") return session.outputs.blueprint?.diagnosis.organizationName ? `组织进化蓝图 · ${session.outputs.blueprint.diagnosis.organizationName}` : "组织进化蓝图";
  return session.outputs.currentPlan?.title || session.context.loopType || session.outputs.blueprint?.diagnosis.organizationName || "未命名回路";
}

function sessionStatusText(session: LoopDesignerSession) {
  if (session.context.workflowStage === "questionnaire") return session.context.questionnaire ? "问卷已提交" : "问卷填写中";
  if (session.context.workflowStage === "diagnosis") return `诊断进度 ${Math.min(session.context.diagnosisCurrentStep ?? 0, DIAGNOSIS_STEPS.length)}/${DIAGNOSIS_STEPS.length}`;
  if (session.context.workflowStage === "blueprint") return session.outputs.blueprint?.preferredCandidateId ? "已锁定首选回路" : "蓝图已生成";
  return session.status === "submitted" ? "方案已生成" : `采集进度 ${session.context.currentStep}/${CONVERSATION_STEPS.length}`;
}

function sessionHref(session: LoopDesignerSession) {
  if (session.context.workflowStage === "questionnaire") return `/sessions/${session.id}/questionnaire`;
  if (session.context.workflowStage === "diagnosis") return `/sessions/${session.id}/diagnosis`;
  if (session.context.workflowStage === "blueprint") return `/sessions/${session.id}/blueprint`;
  return `/sessions/${session.id}`;
}
