"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import {
  Activity,
  CheckCircle2,
  ExternalLink,
  History,
  Link2,
  RotateCcw,
  Target,
  Unlink,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  TacticalGoalEvidence,
  TacticalGoalMeetingProjection,
  TacticalGoalTarget,
} from "@/lib/goals/tactical-meeting-read-model";
import {
  appendGoalCheckInAction,
  createGoalWorkLinkAction,
  removeGoalWorkLinkAction,
} from "./goal-follow-up-actions";

type ReadyProjection = Extract<TacticalGoalMeetingProjection, { status: "READY" }>;
type ActionState = Awaited<ReturnType<typeof appendGoalCheckInAction>>;
type CandidateKind = "PROJECT" | "ACTION" | "BLOCKING_TENSION";

const errorMessages = {
  INVALID_INPUT: "提交内容无效，请检查必填项和证据格式。",
  NOT_AVAILABLE: "当前会议、目标或工作项已不可操作，请刷新后确认。",
  CONFLICT: "记录发生冲突，请刷新后确认最新状态。",
  TEMPORARY_FAILURE: "暂时无法保存，请稍后再提交。",
} as const;

export function GoalTacticalWorkbench({
  projection,
}: {
  projection: TacticalGoalMeetingProjection;
}) {
  if (projection.status === "NOT_AVAILABLE") {
    return <EmptyState>目标跟进数据当前不可用。请确认会议类型与访问范围。</EmptyState>;
  }
  if (projection.status === "NO_CIRCLE") {
    return <EmptyState>本次战术会尚未关联回路，无法确定需要跟进的主目标。</EmptyState>;
  }
  if (projection.status === "NO_ACTIVE_GOAL") {
    return (
      <EmptyState>
        本回路在当前周期没有进行中的主目标。可前往
        <Link className="mx-1 text-moss hover:underline" href="/app/goals">目标树</Link>
        查看战略提案状态。
      </EmptyState>
    );
  }

  const { goal, meeting } = projection;
  return (
    <section aria-labelledby="tactical-goal-heading" className="mt-8 min-w-0 border-t border-border pt-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{projection.cycle.name}</span>
            <span>·</span>
            <Link className="hover:underline" href={meeting.circle.url}>{meeting.circle.name}</Link>
            <span>·</span>
            <span>{healthLabel(goal.health)}</span>
          </div>
          <h3 id="tactical-goal-heading" className="mt-1 break-words text-base font-medium">
            {goal.title}
          </h3>
          <p className="mt-1 break-words text-sm leading-relaxed text-muted-foreground">
            {goal.intendedOutcome}
          </p>
        </div>
        <Link className="inline-flex shrink-0 items-center gap-1 text-sm text-moss hover:underline" href={goal.url}>
          在目标树查看 <ExternalLink aria-hidden="true" className="size-3.5" />
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
        <span>承担角色：<Link className="text-foreground hover:underline" href={goal.ownerRole.url}>{goal.ownerRole.name}</Link></span>
        <span>
          当前承担人：{goal.ownerRole.assignees.map((person) => person.name).join("、") || "未分配"}
          {goal.ownerRole.assigneeCount > 0 ? (
            <>（共 {goal.ownerRole.assigneeCount} 位{goal.ownerRole.assigneesHasMore ? "，还有更多" : ""}）</>
          ) : null}
        </span>
        <span>检查节奏：每 {projection.cycle.checkInCadenceDays} 天</span>
      </div>
      {meeting.endedAt ? (
        <ReadOnlyNotice>{meeting.canAppendEvidence ? "会议已结束；目标承担角色仍可追加证据，但不能管理工作关联。" : "会议已结束，仅可查看。"}</ReadOnlyNotice>
      ) : null}
      {!meeting.viewerIsParticipant ? (
        <ReadOnlyNotice>{meeting.canAppendEvidence ? "你不是本次会议参与人；目标承担角色仍可追加证据，但不能管理工作关联。" : "你不是本次会议参与人，仅可查看。"}</ReadOnlyNotice>
      ) : null}

      <div className="mt-7 grid min-w-0 grid-cols-1 gap-8 lg:grid-cols-2">
        <section aria-labelledby="goal-evidence-heading" className="min-w-0">
          <SectionHeading icon={Activity} id="goal-evidence-heading" title="目标证据" />
          <div className="mt-3 divide-y divide-border border-y border-border">
            {goal.targets.map((target) => (
              <TargetEvidence
                canAppendEvidence={meeting.canAppendEvidence}
                goalId={goal.id}
                goalUrl={goal.url}
                key={target.id}
                meetingId={meeting.id}
                target={target}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="goal-work-heading" className="min-w-0">
          <SectionHeading icon={Link2} id="goal-work-heading" title="关联工作" />
          {meeting.canManageWorkLinks ? (
            <CreateWorkLinkForm
              candidates={projection.candidates}
              goalId={goal.id}
              meetingId={meeting.id}
            />
          ) : null}
          <div className="mt-4 divide-y divide-border border-y border-border">
            {goal.workLinks.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">尚未关联项目、行动或阻塞张力。</p>
            ) : goal.workLinks.map((link) => (
              <WorkLinkRow
                canManageWorkLinks={meeting.canManageWorkLinks}
                goalId={goal.id}
                key={link.id}
                link={link}
                meetingId={meeting.id}
              />
            ))}
          </div>
          {goal.workLinksHasMore ? (
            <p className="mt-2 text-xs text-muted-foreground">仅显示最近 50 条关联记录；请在 <Link className="hover:underline" href={goal.url}>目标树</Link> 查看来源上下文。</p>
          ) : null}
        </section>
      </div>
    </section>
  );
}

function TargetEvidence({
  canAppendEvidence,
  goalId,
  goalUrl,
  meetingId,
  target,
}: {
  canAppendEvidence: boolean;
  goalId: string;
  goalUrl: string;
  meetingId: string;
  target: TacticalGoalTarget;
}) {
  const [correction, setCorrection] = useState<TacticalGoalEvidence | null>(null);
  return (
    <article className="min-w-0 py-5 first:pt-4 last:pb-4">
      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <Target aria-hidden="true" className="size-4 shrink-0" />
            <span className="break-words">{target.position + 1}. {target.label}</span>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{targetDescription(target)}</p>
        </div>
        <span className="text-xs text-muted-foreground">
          {target.effectiveEvidence
            ? `${assessmentLabel(target.effectiveEvidence.assessment)} · ${target.effectiveEvidence.ageLabel}`
            : "尚无证据"}
          {target.evidenceIsStale ? " · 已超检查节奏" : ""}
        </span>
      </div>

      {canAppendEvidence ? (
        <EvidenceForm
          correction={correction}
          goalId={goalId}
          meetingId={meetingId}
          onCancelCorrection={() => setCorrection(null)}
          target={target}
        />
      ) : null}

      <div className="mt-4">
        <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <History aria-hidden="true" className="size-3.5" /> 证据历史 ({target.evidence.length})
        </p>
        {target.evidence.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">还没有记录。</p>
        ) : (
          <ol className="mt-2 divide-y divide-border border-t border-border">
            {target.evidence.map((evidence) => (
              <EvidenceRow
                canCorrect={canAppendEvidence && !evidence.isSuperseded}
                evidence={evidence}
                key={evidence.id}
                onCorrect={() => setCorrection(evidence)}
              />
            ))}
          </ol>
        )}
        {target.evidenceHasMore ? (
          <p className="mt-2 text-xs text-muted-foreground">仅显示最近 50 条证据记录；请在 <Link className="hover:underline" href={goalUrl}>目标树</Link> 查看来源上下文。</p>
        ) : null}
      </div>
    </article>
  );
}

function EvidenceForm({
  correction,
  goalId,
  meetingId,
  onCancelCorrection,
  target,
}: {
  correction: TacticalGoalEvidence | null;
  goalId: string;
  meetingId: string;
  onCancelCorrection: () => void;
  target: TacticalGoalTarget;
}) {
  const action = appendGoalCheckInAction.bind(null, meetingId, goalId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [assessment, setAssessment] = useState("ON_TRACK");
  const [milestoneCompleted, setMilestoneCompleted] = useState("false");

  return (
    <form action={formAction} className="mt-4 space-y-3 border-l-2 border-border pl-3">
      <input name="targetId" type="hidden" value={target.id} />
      {correction ? <input name="supersedesCheckInId" type="hidden" value={correction.id} /> : null}
      {correction ? (
        <div className="flex items-center justify-between gap-3 text-xs">
          <span>正在追加一条纠正记录，原记录会保留。</span>
          <Button disabled={pending} onClick={onCancelCorrection} size="xs" type="button" variant="ghost">取消</Button>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">
          判断
          <select
            className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
            disabled={pending}
            name="assessment"
            onChange={(event) => setAssessment(event.target.value)}
            value={assessment}
          >
            <option value="ON_TRACK">进展正常</option>
            <option value="AT_RISK">存在风险</option>
            <option value="OFF_TRACK">偏离目标</option>
            <option value="ACHIEVED">已经达成</option>
          </select>
        </label>
        {target.kind === "NUMERIC" ? (
          <label className="text-xs font-medium">
            当前值
            <Input disabled={pending} inputMode="decimal" name="currentValue" required type="text" />
          </label>
        ) : (
          <label className="text-xs font-medium">
            里程碑状态
            <select
              className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
              disabled={pending}
              name="milestoneCompleted"
              onChange={(event) => setMilestoneCompleted(event.target.value)}
              value={milestoneCompleted}
            >
              <option value="false">尚未完成</option>
              <option value="true">已经完成</option>
            </select>
          </label>
        )}
      </div>
      <label className="block text-xs font-medium">
        已发生的事实
        <Textarea disabled={pending} maxLength={4000} name="fact" required rows={2} />
      </label>
      <label className="block text-xs font-medium">
        证据摘要
        <Textarea disabled={pending} maxLength={4000} name="evidenceSummary" required rows={2} />
      </label>
      {target.kind === "MILESTONE" ? (
        <label className="block text-xs font-medium">
          验收证据{assessment === "ACHIEVED" ? "（达成时必填）" : "（可选）"}
          <Textarea
            disabled={pending}
            maxLength={4000}
            name="acceptanceEvidence"
            required={assessment === "ACHIEVED" && milestoneCompleted === "true"}
            rows={2}
          />
        </label>
      ) : null}
      <label className="block text-xs font-medium">
        来源链接（可选）
        <Input disabled={pending} maxLength={2000} name="sourceUrl" placeholder="https://" type="url" />
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending} type="submit">
          {correction ? <RotateCcw aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
          {pending ? "正在保存" : correction ? "追加纠正" : "记录证据"}
        </Button>
        <ActionFeedback pending={pending} state={state} success="证据已记录。" />
      </div>
    </form>
  );
}

function EvidenceRow({
  canCorrect,
  evidence,
  onCorrect,
}: {
  canCorrect: boolean;
  evidence: TacticalGoalEvidence;
  onCorrect: () => void;
}) {
  return (
    <li className="min-w-0 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{assessmentLabel(evidence.assessment)}</span>
        <span>{formatDateTime(evidence.recordedAt)}</span>
        <span>{evidence.recorder.name}</span>
        {evidence.isSuperseded ? <span>已被后续记录纠正</span> : null}
        {evidence.supersedesCheckInId ? <span>纠正记录</span> : null}
      </div>
      <p className="mt-1 break-words">{evidence.fact}</p>
      <p className="mt-1 break-words text-muted-foreground">{evidence.evidenceSummary}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
        {evidence.meetingUrl ? <Link className="hover:underline" href={evidence.meetingUrl}>{evidence.meetingTitle ?? "来源会议"}</Link> : null}
        {evidence.sourceUrl ? <a className="inline-flex items-center gap-1 hover:underline" href={evidence.sourceUrl} rel="noreferrer" target="_blank">来源证据 <ExternalLink aria-hidden="true" className="size-3" /></a> : null}
        {canCorrect ? <Button onClick={onCorrect} size="xs" type="button" variant="ghost">纠正此条证据</Button> : null}
      </div>
    </li>
  );
}

function CreateWorkLinkForm({
  candidates,
  goalId,
  meetingId,
}: {
  candidates: ReadyProjection["candidates"];
  goalId: string;
  meetingId: string;
}) {
  const action = createGoalWorkLinkAction.bind(null, meetingId, goalId);
  const [state, formAction, pending] = useActionState(action, undefined);
  const [kind, setKind] = useState<CandidateKind>("PROJECT");
  const options = useMemo(() => candidateOptions(candidates, kind), [candidates, kind]);

  return (
    <form action={formAction} className="mt-3 space-y-3 border-l-2 border-border pl-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs font-medium">
          工作类型
          <select
            className="mt-1 h-8 w-full rounded-lg border border-input bg-background px-2 text-sm"
            disabled={pending}
            name="kind"
            onChange={(event) => setKind(event.target.value as CandidateKind)}
            value={kind}
          >
            <option value="PROJECT">项目</option>
            <option value="ACTION">行动</option>
            <option value="BLOCKING_TENSION">阻塞张力</option>
          </select>
        </label>
        <label className="text-xs font-medium">
          已审核工作
          <select
            className="mt-1 h-8 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm"
            disabled={pending || options.length === 0}
            key={kind}
            name="workObjectId"
            required
          >
            <option value="">{options.length === 0 ? "没有可关联项" : "选择工作项"}</option>
            {options.map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={pending || options.length === 0} type="submit"><Link2 aria-hidden="true" />{pending ? "正在关联" : "关联到目标"}</Button>
        <ActionFeedback pending={pending} state={state} success="工作已关联。" />
      </div>
      {options.length > 0 ? (
        <ul className="space-y-1 text-xs text-muted-foreground">
          {options.map((option) => (
            <li className="min-w-0" key={option.id}>
              <Link className="break-words text-foreground hover:underline" href={option.url ?? "#"}>{option.title}</Link>
              {"sourceTension" in option ? <span> · 来源：<Link className="hover:underline" href={option.sourceTension.url ?? "#"}>{option.sourceTension.title}</Link></span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      {(kind === "BLOCKING_TENSION" ? candidates.blockingTensionsHasMore : candidates.approvedOutcomesHasMore) ? (
        <p className="text-xs text-muted-foreground">
          仍有更多候选；请从 <Link className="hover:underline" href={kind === "PROJECT" ? "/app/projects" : "/app/tensions"}>来源页</Link> 继续查看。
        </p>
      ) : null}
    </form>
  );
}

function WorkLinkRow({
  canManageWorkLinks,
  goalId,
  link,
  meetingId,
}: {
  canManageWorkLinks: boolean;
  goalId: string;
  link: ReadyProjection["goal"]["workLinks"][number];
  meetingId: string;
}) {
  const action = removeGoalWorkLinkAction.bind(null, meetingId, goalId);
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <article className="min-w-0 py-4">
      <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
        <span className="text-xs text-muted-foreground">{workKindLabel(link.kind)}</span>
        {link.work.url ? <Link className="break-words font-medium hover:underline" href={link.work.url}>{link.work.title}</Link> : <span>{link.work.title}</span>}
        <span className="text-xs text-muted-foreground">{link.status === "ACTIVE" ? "关联中" : "已移除"}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {link.createdBy.name} 于 {formatDateTime(link.createdAt)} 关联
        {link.createdMeetingUrl ? <> · <Link className="hover:underline" href={link.createdMeetingUrl}>{link.createdMeetingTitle ?? "来源会议"}</Link></> : null}
      </p>
      {link.removedBy ? (
        <p className="mt-1 text-xs text-muted-foreground">
          {link.removedBy.name} 于 {link.removedAt ? formatDateTime(link.removedAt) : "稍早"} 移除
          {link.removalReason ? ` · 原因：${link.removalReason}` : ""}
          {link.removedMeetingUrl ? <> · <Link className="hover:underline" href={link.removedMeetingUrl}>{link.removedMeetingTitle ?? "移除会议"}</Link></> : null}
        </p>
      ) : null}
      {link.status === "ACTIVE" && canManageWorkLinks ? (
        <form action={formAction} className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:items-end">
          <input name="linkId" type="hidden" value={link.id} />
          <label className="min-w-0 flex-1 text-xs font-medium">
            移除原因
            <Input disabled={pending} maxLength={2000} name="reason" required />
          </label>
          <Button disabled={pending} type="submit" variant="outline"><Unlink aria-hidden="true" />移除关联</Button>
          <ActionFeedback pending={pending} state={state} success="关联已移除。" />
        </form>
      ) : null}
    </article>
  );
}

function ActionFeedback({ pending, state, success }: { pending: boolean; state: ActionState; success: string }) {
  if (pending) return <span aria-live="polite" className="text-xs text-muted-foreground">正在提交…</span>;
  if (!state) return null;
  if (state.status === "ERROR") return <span aria-live="polite" className="text-xs text-destructive" role="alert">{errorMessages[state.code]}</span>;
  return <span aria-live="polite" className="text-xs text-foreground">{success}</span>;
}

function candidateOptions(candidates: ReadyProjection["candidates"], kind: CandidateKind) {
  if (kind === "PROJECT") return candidates.projects;
  if (kind === "ACTION") return candidates.actions;
  return candidates.blockingTensions;
}

function EmptyState({ children }: { children: React.ReactNode }) {
  return <p className="border-l-2 border-border py-2 pl-3 text-sm text-muted-foreground">{children}</p>;
}

function ReadOnlyNotice({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 border-l-2 border-border pl-3 text-sm text-muted-foreground">{children}</p>;
}

function SectionHeading({ icon: Icon, id, title }: { icon: typeof Activity; id: string; title: string }) {
  return <h4 className="flex items-center gap-1.5 text-sm font-medium" id={id}><Icon aria-hidden="true" className="size-4" />{title}</h4>;
}

function healthLabel(status: ReadyProjection["goal"]["health"]): string {
  return {
    NOT_UPDATED: "尚未更新",
    OFF_TRACK: "偏离目标",
    AT_RISK: "存在风险",
    ON_TRACK: "进展正常",
    ACHIEVED: "已经达成",
    SUPERSEDED: "已被替换",
    NOT_ACHIEVED: "未达成",
  }[status];
}

function assessmentLabel(status: TacticalGoalEvidence["assessment"]): string {
  return { ON_TRACK: "进展正常", AT_RISK: "存在风险", OFF_TRACK: "偏离目标", ACHIEVED: "已经达成" }[status];
}

function workKindLabel(kind: ReadyProjection["goal"]["workLinks"][number]["kind"]): string {
  return { PROJECT: "项目", ACTION: "行动", BLOCKING_TENSION: "阻塞张力" }[kind];
}

function targetDescription(target: TacticalGoalTarget): string {
  if (target.kind === "MILESTONE") return target.acceptanceCriteria ?? "里程碑";
  return `${target.baselineValue ?? "?"} → ${target.desiredValue ?? "?"}${target.unit ? ` ${target.unit}` : ""}`;
}

function formatDateTime(value: Date): string {
  return new Date(value).toLocaleString("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Shanghai",
  });
}
