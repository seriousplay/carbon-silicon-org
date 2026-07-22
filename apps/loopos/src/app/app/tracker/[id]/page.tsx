import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { blockerStatusMap } from "@/lib/constants";
import { StatusBadge } from "@/components/shared/status-badge";
import { TransitionButton } from "./transition-button";
import { canTransition } from "@/lib/statemachine";
import type { BlockerStatus } from "@/generated/prisma/client";

export default async function TensionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();

  const tension = await prisma.tension.findFirst({
    where: { id, organizationId: orgId },
    include: {
      owner: { select: { id: true, name: true } },
      circle: { select: { id: true, name: true } },
      role: { select: { id: true, name: true, purpose: true } },
      tacticalOutcomeActionProposal: { select: { id: true, status: true, kind: true, provenanceKind: true, proposer: { select: { name: true } }, recordedBy: { select: { name: true } }, meeting: { select: { id: true, title: true } }, run: { select: { id: true } } } },
      validationRunsCreated: {
        select: {
          id: true,
          dataVersion: true,
          status: true,
          tacticalResolution: true,
          deferReason: true,
          sourceTension: { select: { id: true, title: true } },
          createdTension: { select: { id: true, title: true } },
          resolutionMeeting: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      validationRunsCreatedActions: {
        select: {
          id: true,
          dataVersion: true,
          status: true,
          tacticalResolution: true,
          deferReason: true,
          sourceTension: { select: { id: true, title: true } },
          createdTension: { select: { id: true, title: true } },
          resolutionMeeting: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
      validationRunsAsSourceAction: {
        select: {
          id: true,
          dataVersion: true,
          status: true,
          tacticalResolution: true,
          deferReason: true,
          sourceTension: { select: { id: true, title: true } },
          createdTension: { select: { id: true, title: true } },
          resolutionMeeting: { select: { id: true, title: true } },
        },
        orderBy: { updatedAt: "desc" },
      },
    },
  });

  if (!tension) notFound();

  const info = blockerStatusMap[tension.status];
  const now = new Date().getTime();
  const daysToDeadline = tension.deadline
    ? (tension.deadline.getTime() - now) / 86400000
    : null;
  const overdue = (now - tension.updatedAt.getTime()) / 3600000 > 48;
  const approvedActionProposal =
    tension.tacticalOutcomeActionProposal?.status === "APPROVED"
    && tension.tacticalOutcomeActionProposal.kind === "ACTION"
      ? tension.tacticalOutcomeActionProposal
      : null;
  const canManage = tension.ownerId === person?.id && approvedActionProposal !== null;

  const allStatuses = Object.keys(blockerStatusMap) as BlockerStatus[];
  const possibleTransitions = allStatuses.filter((s) =>
    canTransition(tension.status, s)
  );
  const validationTraceRuns = Array.from(
    new Map(
      [
        ...tension.validationRunsCreated,
        ...tension.validationRunsCreatedActions,
        ...tension.validationRunsAsSourceAction,
      ].map((run) => [run.id, run])
    ).values()
  );

  return (
    <div className="max-w-3xl mx-auto animate-fade-rise">
      <Link
        href="/app/tracker"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block"
      >
        ← 追踪看板
      </Link>

      <div className="flex items-center gap-2 mb-3">
        <StatusBadge
          variant={info.badge as never}
          label={info.label}
          pulse={tension.status === "ESCALATED_L0_5"}
        />
        {overdue && <StatusBadge variant="urgent" label="48h 超时" pulse />}
        {canManage && (
          <Link
            href={`/app/tracker/${tension.id}/edit`}
            className="ml-auto text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            编辑
          </Link>
        )}
      </div>

      <h1 className="font-serif text-xl font-medium mb-6">{tension.title}</h1>
      {tension.description !== tension.title && (
        <p className="text-sm text-muted-foreground mb-6">{tension.description}</p>
      )}

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="rounded-card border border-border bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">验收标准</p>
          <p className="text-sm">{tension.acceptanceCriteria ?? "未设定"}</p>
          {tension.actionContext && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-0.5">行动归属</p>
              <p className="text-xs leading-relaxed bg-muted/30 rounded px-2 py-1.5">
                {tension.actionContext}
              </p>
            </div>
          )}
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">截止时间</p>
          <p className={`text-sm ${daysToDeadline !== null && daysToDeadline < 0 ? "text-urgent font-medium" : ""}`}>
            {tension.deadline?.toLocaleDateString("zh-CN") ?? "No time commitment"}
            {daysToDeadline !== null &&
              (daysToDeadline < 0
                ? "（已过）"
                : `（${Math.ceil(daysToDeadline)} 天）`)}
          </p>
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">负责人</p>
          <p className="text-sm font-medium">{tension.owner?.name ?? "未指派"}</p>
          {tension.role && (
            <div className="mt-2 pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground mb-0.5">以角色承担</p>
              <p className="text-sm font-medium text-moss">{tension.role.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{tension.role.purpose}</p>
            </div>
          )}
        </div>
        <div className="rounded-card border border-border bg-card p-4 shadow-soft">
          <p className="text-xs text-muted-foreground mb-1">所属回路</p>
          <p className="text-sm font-medium">{tension.circle?.name ?? "—"}</p>
        </div>
      </div>

      {tension.rootCause && (
        <div className="rounded-card border border-urgent/30 bg-urgent-pale/30 p-4 mb-6">
          <p className="text-xs font-medium uppercase tracking-wider text-urgent mb-1">根因</p>
          <p className="text-sm">{tension.rootCause}</p>
        </div>
      )}

      {validationTraceRuns.length > 0 && (
        <div className="rounded-card border border-border bg-card p-4 shadow-soft mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            验证来源
          </h2>
          <div className="space-y-2">
            {validationTraceRuns.map((run) => (
              <div key={run.id} className="rounded-input border border-border px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <Link href={`/app/interfaces/data-pretraining?run=${run.id}`} className="text-moss hover:underline">
                    {run.dataVersion}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {run.tacticalResolution ?? run.status}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {run.sourceTension || run.createdTension ? (
                    <Link
                      href={`/app/tensions/${(run.sourceTension ?? run.createdTension)?.id}`}
                      className="text-moss hover:underline"
                    >
                      来源张力：{(run.sourceTension ?? run.createdTension)?.title}
                    </Link>
                  ) : null}
                  {run.resolutionMeeting && (
                    <Link href={`/app/meetings/${run.resolutionMeeting.id}`} className="text-moss hover:underline">
                      来源会议：{run.resolutionMeeting.title}
                    </Link>
                  )}
                  {run.deferReason && <span>延期原因：{run.deferReason}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {approvedActionProposal ? (
        <div className="rounded-card border border-border bg-card p-4 shadow-soft mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">已通过的行动提案来源</h2>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <span>提出人：{approvedActionProposal.proposer.name}</span>
            <span>会议结果记录人：{approvedActionProposal.recordedBy?.name ?? "—"}</span>
            <Link className="text-moss hover:underline" href={`/app/meetings/${approvedActionProposal.meeting.id}`}>来源会议：{approvedActionProposal.meeting.title}</Link>
            {approvedActionProposal.provenanceKind === "INTERFACE_RUN" && approvedActionProposal.run ? <Link className="text-moss hover:underline" href={`/app/interfaces/runs/${approvedActionProposal.run.id}`}>查看接口运行来源</Link> : <span>普通张力来源</span>}
          </div>
        </div>
      ) : null}

      {/* 状态转移 */}
      {canManage && possibleTransitions.length > 0 && (
        <div className="rounded-card border border-border bg-card p-6 shadow-soft">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            更新状态
          </h2>
          <div className="flex flex-wrap gap-2">
            {possibleTransitions.map((s) => (
              <TransitionButton key={s} tensionId={tension.id} toStatus={s} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
