"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { archiveTacticalHealthReviewAction, type CollaborationState } from "./collaboration-actions";

export function TacticalHealthReview({
  meetingId,
  isMeetingParticipant,
  goal,
  metrics,
  projects,
  actions,
}: {
  meetingId: string;
  isMeetingParticipant: boolean;
  goal: { title: string; intendedOutcome: string } | null;
  metrics: { id: string; name: string; status: string; actualValue: string | null; targetValue: string }[];
  projects: { id: string; name: string; status: string }[];
  actions: { id: string; title: string; status: string; owner: { name: string } | null }[];
}) {
  const action = archiveTacticalHealthReviewAction.bind(null, meetingId);
  const [state, formAction, pending] = useActionState<CollaborationState, FormData>(action, undefined);

  return (
    <section className="rounded-card border border-border bg-card p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">01 运营健康度回顾</p>
          <h3 className="mt-1 text-base font-semibold">先同步回路运行事实，再进入张力处理</h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
            团队可以基于当前回路的目标、指标、检查项、项目和行动补充判断。保存后会进入会议历史纪要，作为后续组织记忆的来源。
          </p>
        </div>
        <Link href="/app/goals" className="text-sm font-medium text-moss hover:underline">
          查看目标树
        </Link>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-4">
        <HealthSnapshot title="主目标" empty="本周期尚未设置主目标">
          {goal ? (
            <>
              <p className="text-sm font-medium">{goal.title}</p>
              <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">{goal.intendedOutcome}</p>
            </>
          ) : null}
        </HealthSnapshot>
        <HealthSnapshot title={`指标 · ${metrics.length}`} empty="暂无指标">
          {metrics.slice(0, 4).map((metric) => (
            <p key={metric.id} className="mt-1 text-xs leading-5">
              {metric.name} · {metric.actualValue ?? "未更新"}/{metric.targetValue} · {metric.status}
            </p>
          ))}
        </HealthSnapshot>
        <HealthSnapshot title={`进行中项目 · ${projects.length}`} empty="暂无项目">
          {projects.slice(0, 4).map((project) => (
            <p key={project.id} className="mt-1 truncate text-xs leading-5">{project.name} · {project.status}</p>
          ))}
        </HealthSnapshot>
        <HealthSnapshot title={`行动项 · ${actions.length}`} empty="暂无行动项">
          {actions.slice(0, 4).map((actionItem) => (
            <p key={actionItem.id} className="mt-1 truncate text-xs leading-5">
              {actionItem.title} · {actionItem.owner?.name ?? "未分配"}
            </p>
          ))}
        </HealthSnapshot>
      </div>

      <form action={formAction} className="mt-5 grid gap-4 border-t border-border pt-5">
        <div className="grid gap-4 md:grid-cols-2">
          <HealthInput name="summary" label="综合判断" placeholder="例如：本回路本周整体正常，但模型评估交付节奏有延迟风险。" />
          <HealthInput name="goalInput" label="目标回顾" placeholder="目标是否仍然有效？是否偏离？是否需要形成新张力？" />
          <HealthInput name="metricInput" label="指标回顾" placeholder="哪些指标需要更新、解释或触发行动？" />
          <HealthInput name="checklistInput" label="检查项" placeholder="固定检查项、例行承诺或本周必须确认的事项。" />
          <HealthInput name="projectInput" label="关键项目/行动" placeholder="需要同步的项目、行动进展、阻塞和下一步。" />
          <HealthInput name="riskInput" label="风险与张力线索" placeholder="记录可能进入下一步张力清单的信号。" />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs">
            {state?.error ? <span className="text-destructive">{state.error}</span> : null}
            {state?.ok ? <span className="text-moss">运营健康度已存档，可以进入张力处理。</span> : null}
            {!isMeetingParticipant ? <span className="text-muted-foreground">只有会议参与人可以保存健康度记录。</span> : null}
          </div>
          <Button type="submit" disabled={!isMeetingParticipant || pending}>
            {pending ? "保存中..." : "保存健康度记录"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function HealthSnapshot({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <p className="text-xs font-medium text-muted-foreground">{title}</p>
      <div className="mt-2 min-h-12">{children || <p className="text-xs text-muted-foreground">{empty}</p>}</div>
    </div>
  );
}

function HealthInput({ name, label, placeholder }: { name: string; label: string; placeholder: string }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Textarea name={name} placeholder={placeholder} className="min-h-24" />
    </label>
  );
}
