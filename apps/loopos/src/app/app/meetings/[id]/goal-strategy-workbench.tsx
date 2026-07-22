"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  ArrowDownLeft,
  CheckCircle2,
  CircleX,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Target,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { StrategicGoalMeetingProjection } from "@/lib/goals/strategic-meeting-read-model";
import { recordGoalDecisionAction } from "./goal-decision-actions";

type ReadyProjection = Extract<StrategicGoalMeetingProjection, { status: "READY" }>;
type Proposal = ReadyProjection["proposals"][number];
type Decision = ReadyProjection["decisions"][number];

const errorMessages = {
  INVALID_INPUT: "提交内容无效，请检查后重试。",
  NOT_AVAILABLE: "当前身份或会议状态不允许记录这项决策。",
  STALE_REVISION: "提案已更新，请刷新后基于最新修订决策。",
  INVALID_STATE: "提案当前状态不允许记录这项决策。",
  RETRY_CONFLICT: "决策发生并发冲突，请刷新后确认最新结果。",
  TEMPORARY_FAILURE: "暂时无法记录决策，请稍后重试。",
} as const;

export function GoalStrategyWorkbench({
  projection,
}: {
  projection: StrategicGoalMeetingProjection;
}) {
  if (projection.status === "NOT_AVAILABLE") {
    return (
      <p className="border-l-2 border-border py-2 pl-3 text-sm text-muted-foreground">
        目标决策数据当前不可用。请确认会议类型、所属回路和访问权限。
      </p>
    );
  }

  if (projection.status === "TRUNCATED") {
    return (
      <p className="border-l-2 border-amber-500 py-2 pl-3 text-sm text-muted-foreground">
        目标提案判据超出安全展示范围，当前不会显示不完整的提案或开放决策操作。
      </p>
    );
  }

  return (
    <div className="min-w-0 space-y-7">
      <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
        <Link className="break-words text-foreground hover:underline" href={projection.meeting.circle.url}>
          {projection.meeting.circle.name}
        </Link>
        <span>{projection.meeting.participantCount} 位会议参与人</span>
        {projection.meeting.endedAt ? <span>会议已结束，仅可查看</span> : null}
        {!projection.meeting.viewerIsParticipant ? <span>你不是本次会议参与人，仅可查看</span> : null}
      </div>

      <section aria-labelledby="pending-goal-proposals" className="min-w-0 space-y-4">
        <h3 id="pending-goal-proposals" className="text-sm font-medium">
          待决策提案 ({projection.proposals.length})
        </h3>
        {projection.proposals.length === 0 ? (
          <p className="border-y border-border py-5 text-sm text-muted-foreground">
            本回路没有待决策的目标提案。
          </p>
        ) : (
          <div className="divide-y divide-border border-y border-border">
            {projection.proposals.map((proposal) => (
              <ProposalBand key={proposal.id} meetingId={projection.meeting.id} proposal={proposal} />
            ))}
          </div>
        )}
        <PaginationLinks
          ariaLabel="待决策提案分页"
          meetingUrl={projection.meeting.url}
          pagination={projection.proposalPagination}
          proposalPage={projection.proposalPagination.page}
          decisionPage={projection.decisionPagination.page}
          pageKind="proposal"
        />
      </section>

      <section aria-labelledby="goal-decision-history" className="min-w-0 space-y-4">
        <h3 id="goal-decision-history" className="text-sm font-medium">
          本次会议已记录决策 ({projection.decisions.length})
        </h3>
        {projection.decisions.length === 0 ? (
          <p className="border-y border-border py-5 text-sm text-muted-foreground">尚未记录目标决策。</p>
        ) : (
          <ol className="divide-y divide-border border-y border-border">
            {projection.decisions.map((decision) => (
              <DecisionRow decision={decision} key={decision.id} />
            ))}
          </ol>
        )}
        <PaginationLinks
          ariaLabel="决策历史分页"
          meetingUrl={projection.meeting.url}
          pagination={projection.decisionPagination}
          proposalPage={projection.proposalPagination.page}
          decisionPage={projection.decisionPagination.page}
          pageKind="decision"
        />
      </section>
    </div>
  );
}

function PaginationLinks({
  ariaLabel,
  meetingUrl,
  pagination,
  proposalPage,
  decisionPage,
  pageKind,
}: {
  ariaLabel: string;
  meetingUrl: string;
  pagination: ReadyProjection["proposalPagination"];
  proposalPage: number;
  decisionPage: number;
  pageKind: "proposal" | "decision";
}) {
  const pageHref = (page: number) => {
    const params = new URLSearchParams();
    const nextProposalPage = pageKind === "proposal" ? page : proposalPage;
    const nextDecisionPage = pageKind === "decision" ? page : decisionPage;
    if (nextProposalPage > 1) params.set("proposalPage", String(nextProposalPage));
    if (nextDecisionPage > 1) params.set("decisionPage", String(nextDecisionPage));
    const query = params.toString();
    return query ? `${meetingUrl}?${query}` : meetingUrl;
  };

  return (
    <nav aria-label={ariaLabel} className="flex items-center justify-between gap-3 text-sm">
      {pagination.hasPrevious ? (
        <Link className="inline-flex items-center gap-1 hover:underline" href={pageHref(pagination.page - 1)}>
          <ChevronLeft aria-hidden="true" className="size-4" /> 上一页
        </Link>
      ) : <span />}
      <span className="text-xs text-muted-foreground">第 {pagination.page} 页</span>
      {pagination.hasNext ? (
        <Link className="inline-flex items-center gap-1 hover:underline" href={pageHref(pagination.page + 1)}>
          下一页 <ChevronRight aria-hidden="true" className="size-4" />
        </Link>
      ) : <span />}
    </nav>
  );
}

function ProposalBand({ meetingId, proposal }: { meetingId: string; proposal: Proposal }) {
  const [mutationKey] = useState(() => crypto.randomUUID());
  const [note, setNote] = useState("");
  const action = recordGoalDecisionAction.bind(null, proposal.id, meetingId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const error = state && "code" in state ? errorMessages[state.code] : null;
  const success = state && !("code" in state) ? state : null;
  const revision = proposal.currentRevision;
  const noteBytes = new TextEncoder().encode(note.trim()).byteLength;
  const noteTooLong = noteBytes > 2_000;

  return (
    <section className="min-w-0 py-5 first:pt-4 last:pb-4" aria-labelledby={`goal-proposal-${proposal.id}`}>
      <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-3 lg:max-w-2xl">
          <div className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{kindLabel(proposal.kind)}</span>
            <span>修订 {revision.revision}</span>
            <span>提案人 {proposal.proposer.name}</span>
            <Link className="hover:underline" href={proposal.cycle.url}>{proposal.cycle.name}</Link>
            <Link aria-label="在目标树查看提案" className="inline-flex items-center gap-1 hover:underline" href={proposal.url}>
              目标树 <ExternalLink aria-hidden="true" className="size-3" />
            </Link>
          </div>

          <div>
            <h4 id={`goal-proposal-${proposal.id}`} className="break-words text-base font-medium">
              {revision.title ?? closeTitle(proposal)}
            </h4>
            {revision.intendedOutcome ? (
              <p className="mt-1 break-words text-sm leading-relaxed">期望结果：{revision.intendedOutcome}</p>
            ) : null}
            {revision.closeResult ? (
              <p className="mt-1 text-sm">关闭结果：{revision.closeResult === "ACHIEVED" ? "已达成" : "未达成"}</p>
            ) : null}
            {revision.conclusion ? (
              <p className="mt-1 break-words text-sm text-muted-foreground">结论：{revision.conclusion}</p>
            ) : null}
          </div>

          {proposal.replacedGoal ? (
            <FactLine label={proposal.kind === "CLOSE" ? "待关闭当前目标" : "待替换当前目标"}>
              <Link className="break-words hover:underline" href={proposal.replacedGoal.url}>
                {proposal.replacedGoal.title}
              </Link>
              <span className="text-muted-foreground"> · {goalStatusLabel(proposal.replacedGoal.status)}</span>
              <p className="break-words text-muted-foreground">{proposal.replacedGoal.intendedOutcome}</p>
            </FactLine>
          ) : proposal.kind !== "CREATE" ? (
            <FactLine label="当前目标">未找到可供替换或关闭的当前目标。</FactLine>
          ) : null}

          <dl className="grid min-w-0 gap-2 text-sm sm:grid-cols-2">
            <Fact label="承担角色">
              {revision.ownerRole ? (
                <Link className="break-words hover:underline" href={revision.ownerRole.url}>
                  {revision.ownerRole.name} · {roleStatusLabel(revision.ownerRole.status)}
                </Link>
              ) : "未指定"}
            </Fact>
            <Fact label="上级目标">
              {revision.parentGoal ? (
                <Link className="break-words hover:underline" href={revision.parentGoal.url}>
                  {revision.parentGoal.title} · {goalStatusLabel(revision.parentGoal.status)}
                </Link>
              ) : "无"}
            </Fact>
          </dl>

          <div className="min-w-0 space-y-2">
            <p className="inline-flex items-center gap-1.5 text-sm font-medium">
              <Target aria-hidden="true" className="size-4" /> 目标判据
            </p>
            {proposal.currentRevision.targets.length === 0 ? (
              <p className="text-sm text-muted-foreground">未设置目标判据。</p>
            ) : (
              <ol className="space-y-1 text-sm">
                {proposal.currentRevision.targets.map((target) => (
                  <li className="break-words border-l-2 border-border pl-3" key={target.id}>
                    <span className="font-medium">{target.position + 1}. {target.label}</span>
                    <span className="text-muted-foreground"> · {targetLabel(target)}</span>
                    {target.metric ? <span className="text-muted-foreground"> · 指标 {target.metric.name}</span> : null}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>

        <div className="w-full min-w-0 lg:w-72 lg:shrink-0">
          {proposal.canRecord ? (
            <form action={formAction} className="min-w-0 space-y-3 border-l-2 border-border pl-4">
              <input name="expectedRevision" value={proposal.currentRevision.revision} type="hidden" />
              <input name="mutationKey" value={mutationKey} type="hidden" />
              <label className="block text-sm font-medium" htmlFor={`goal-decision-note-${proposal.id}`}>
                会议说明（可选）
              </label>
              <Textarea
                disabled={pending}
                id={`goal-decision-note-${proposal.id}`}
                maxLength={2000}
                name="note"
                onChange={(event) => setNote(event.target.value)}
                placeholder="记录决策依据或需要补充的内容"
                rows={3}
                value={note}
              />
              {noteTooLong ? (
                <p className="text-xs text-destructive" role="alert">
                  会议说明超过 2000 UTF-8 字节（当前 {noteBytes} 字节），请缩短后提交。
                </p>
              ) : null}
              {!proposal.canAdopt ? (
                <p className="text-xs text-muted-foreground">
                  周期未激活，当前不能通过，可退回或不采纳。
                </p>
              ) : null}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:grid-cols-1">
                <Button disabled={pending || !proposal.canAdopt || noteTooLong} name="outcome" type="submit" value="ADOPTED">
                  <CheckCircle2 aria-hidden="true" /> 通过
                </Button>
                <Button disabled={pending || noteTooLong} name="outcome" type="submit" value="RETURNED" variant="outline">
                  <RotateCcw aria-hidden="true" /> 退回修订
                </Button>
                <Button disabled={pending || noteTooLong} name="outcome" type="submit" value="DECLINED" variant="destructive">
                  <CircleX aria-hidden="true" /> 不采纳
                </Button>
              </div>
              <div aria-live="polite" className="min-h-5 text-xs">
                {pending ? <p className="text-muted-foreground">正在记录决策…</p> : null}
                {error ? <p className="text-destructive" role="alert">{error}</p> : null}
                {success ? (
                  <p className="text-foreground">
                    决策已记录：{outcomeLabel(success.outcome)}，修订 {success.revision}。
                  </p>
                ) : null}
              </div>
            </form>
          ) : (
            <DeniedReason proposal={proposal} />
          )}
        </div>
      </div>
    </section>
  );
}

function DeniedReason({ proposal }: { proposal: Proposal }) {
  const reason = !proposal.proposerIsParticipant
    ? "提案人不在本次会议参与人中，不能记录该提案的决策。"
    : "你不能在当前会议状态下记录该提案的决策。";
  return <p className="border-l-2 border-border py-1 pl-3 text-sm text-muted-foreground">{reason}</p>;
}

function DecisionRow({ decision }: { decision: Decision }) {
  const provenance = decision.adoptedGoal ?? decision.terminalGoal;
  return (
    <li className="min-w-0 space-y-2 py-4 first:pt-3 last:pb-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
        <span className="font-medium">{outcomeLabel(decision.outcome)}</span>
        <span className="text-muted-foreground">{kindLabel(decision.proposalKind)} · 修订 {decision.revision}</span>
        <Link className="inline-flex items-center gap-1 break-words hover:underline" href={decision.proposalUrl}>
          {decision.revisionTitle ?? "关闭目标提案"} <ExternalLink aria-hidden="true" className="size-3" />
        </Link>
      </div>
      <p className="break-words text-xs text-muted-foreground">
        记录人 {decision.recorder.name} · {formatDateTime(decision.decidedAt)}
      </p>
      {decision.note ? <p className="break-words text-sm">会议说明：{decision.note}</p> : null}
      {provenance ? (
        <p className="flex min-w-0 items-start gap-1.5 text-sm">
          <ArrowDownLeft aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span className="min-w-0">
            {decision.adoptedGoal ? "生成目标" : "终结目标"}：
            <Link className="break-words hover:underline" href={provenance.url}>{provenance.title}</Link>
            <span className="text-muted-foreground"> · {goalStatusLabel(provenance.status)}</span>
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">未生成或终结目标。</p>
      )}
    </li>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words">{children}</dd>
    </div>
  );
}

function FactLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 border-l-2 border-border pl-3 text-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-0.5 break-words">{children}</div>
    </div>
  );
}

function kindLabel(kind: Proposal["kind"] | Decision["proposalKind"]): string {
  return { CREATE: "新建目标", REPLACE: "替换目标", CLOSE: "关闭目标" }[kind];
}

function outcomeLabel(outcome: Decision["outcome"]): string {
  return { ADOPTED: "通过", RETURNED: "退回修订", DECLINED: "不采纳" }[outcome];
}

function goalStatusLabel(status: NonNullable<Proposal["replacedGoal"]>["status"]): string {
  return { ACTIVE: "进行中", SUPERSEDED: "已替换", ACHIEVED: "已达成", NOT_ACHIEVED: "未达成" }[status];
}

function roleStatusLabel(status: NonNullable<Proposal["currentRevision"]["ownerRole"]>["status"]): string {
  return { ACTIVE: "启用", PAUSED: "暂停", ARCHIVED: "归档" }[status];
}

function closeTitle(proposal: Proposal): string {
  return proposal.replacedGoal ? `关闭：${proposal.replacedGoal.title}` : "关闭目标提案";
}

function targetLabel(target: Proposal["currentRevision"]["targets"][number]): string {
  if (target.kind === "MILESTONE") return target.acceptanceCriteria ?? "里程碑";
  const range = [target.baselineValue, target.desiredValue].filter(Boolean).join(" → ");
  return `${range || "数值目标"}${target.unit ? ` ${target.unit}` : ""}`;
}

function formatDateTime(value: Date): string {
  return new Date(value).toLocaleString("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  });
}
