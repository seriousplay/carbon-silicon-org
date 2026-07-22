import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { StatusBadge } from "@/components/shared/status-badge";
import { MeetingTensionProcessor } from "./tension-processor";
import { GovernanceWorkbench } from "./governance-workbench";
import { MeetingAgentClient } from "./meeting-agent-client";
import { createPrismaMeetingFacilitationRepository } from "@/lib/meeting-facilitation/prisma-repository";
import { buildMeetingFacilitationReadModel } from "@/lib/meeting-facilitation/read-model";

export const dynamic = "force-dynamic";
import { AgendaAIButton, GuardReportButton } from "./ai-buttons";
import { MeetingCollaborationPanel } from "./meeting-collaboration-panel";
import { classifyTensionProvenance, resolveGovernanceCandidatesRoutedToMeeting, resolveOpenTensionsRoutedToMeeting } from "@/lib/domain-operations";
import { queryStrategicGoalMeeting } from "@/lib/goals/strategic-meeting-read-model";
import { queryTacticalGoalMeeting } from "@/lib/goals/tactical-meeting-read-model";
import { GoalStrategyWorkbench } from "./goal-strategy-workbench";
import { GoalTacticalWorkbench } from "./goal-tactical-workbench";
import { MeetingEndButton } from "./meeting-end-button";
import { TacticalHealthReview } from "./tactical-health-review";
import { TacticalMeetingFlow } from "./tactical-meeting-flow";

export default async function MeetingDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const [orgId, currentPerson] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);

  const meeting = await prisma.meeting.findFirst({
    where: { id, organizationId: orgId },
    include: {
      circle: { select: { id: true, name: true } },
      participants: { select: { id: true, name: true, email: true } },
      endedBy: { select: { name: true } },
      decisions: {
        include: { decisionMaker: { select: { name: true } } },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!meeting) notFound();

  const meetingProposals = await prisma.governanceProposal.findMany({
    where: { organizationId: orgId, meetingId: meeting.id },
    include: {
      tension: { select: { id: true, title: true, raiser: { select: { id: true, name: true } } } },
      governanceDecisionProcess: { include: { currentRevisionRecord: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const strategicGoalProjection =
    meeting.type === "STRATEGY" && currentPerson
      ? await queryStrategicGoalMeeting(
          {
            organizationId: orgId,
            meetingId: meeting.id,
            viewerPersonId: currentPerson.id,
            proposalPage: parsePage(query.proposalPage),
            decisionPage: parsePage(query.decisionPage),
          },
          { prisma },
        )
      : ({ status: "NOT_AVAILABLE" } as const);
  const tacticalGoalProjection =
    meeting.type === "TACTICAL" && currentPerson
      ? await queryTacticalGoalMeeting(
          {
            organizationId: orgId,
            meetingId: meeting.id,
            viewerPersonId: currentPerson.id,
          },
          { prisma },
        )
      : ({ status: "NOT_AVAILABLE" } as const);

  // 查出组织内所有待处理张力（可用于本次会议讨论）
  // 以及本回路相关的张力优先显示
  const pilotUnresolvedValidationRunWhere = {
    status: { in: ["FAILED", "OVERDUE"] },
    tacticalResolution: null,
    interface: {
      OR: [
        {
          fromCircle: { name: { contains: "数据" } },
          toCircle: { name: { contains: "预训练" } },
        },
        {
          fromCircle: { name: { contains: "Data" } },
          toCircle: { name: { contains: "Pretraining" } },
        },
        {
          name: { contains: "Data -> Pretraining" },
        },
      ],
    },
  } satisfies Prisma.InterfaceValidationRunWhereInput;

  const [allTensions, people, circles, roles, projects, metrics, actions] = await Promise.all([
    meeting.type === "STRATEGY" ? Promise.resolve([]) : prisma.tension.findMany({
	      where:
	        meeting.type === "TACTICAL"
	          ? {
	              organizationId: orgId,
	              status: "OPEN",
	              ...(meeting.circleId ? { circles: { some: { id: meeting.circleId } } } : {}),
	              OR: [
	                { handlingMode: "TACTICAL" },
	                { validationRunsCreated: { some: pilotUnresolvedValidationRunWhere } },
	              ],
	            }
	          : {
	              organizationId: orgId,
	              status: "OPEN",
	              handlingMode: "GOVERNANCE",
	              ...(meeting.circleId ? { circles: { some: { id: meeting.circleId } } } : {}),
	            },
	      include: {
	        raiser: { select: { id: true, name: true } },
	        circles: { select: { id: true, name: true } },
	        validationRunsCreated: {
	          take: 1,
	          orderBy: { createdAt: "desc" },
	          where: meeting.type === "TACTICAL" ? pilotUnresolvedValidationRunWhere : undefined,
	          select: {
            id: true,
            dataVersion: true,
            status: true,
            tacticalResolution: true,
            deferReason: true,
            createdProject: { select: { id: true, name: true } },
            createdAction: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.person.findMany({
      where: { organizationId: orgId },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
    }),
    meeting.type === "STRATEGY" ? Promise.resolve([]) : prisma.circle.findMany({
      where: { organizationId: orgId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    meeting.type === "STRATEGY" ? Promise.resolve([]) : prisma.roleDef.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: { id: true, name: true, purpose: true, accountabilities: true, circleId: true },
      orderBy: { name: "asc" },
    }),
    meeting.type !== "TACTICAL" ? Promise.resolve([]) : prisma.project.findMany({
      where: { organizationId: orgId, status: "ACTIVE", ...(meeting.circleId ? { circleId: meeting.circleId } : {}) },
      select: { id: true, name: true, status: true, linkedDataVersion: true },
      orderBy: { updatedAt: "desc" },
    }),
    meeting.type !== "TACTICAL" ? Promise.resolve([]) : prisma.metric.findMany({ where: { organizationId: orgId, ...(meeting.circleId ? { circleId: meeting.circleId } : {}) }, select: { id: true, name: true, status: true, actualValue: true, targetValue: true }, orderBy: { updatedAt: "desc" } }),
    meeting.type !== "TACTICAL" ? Promise.resolve([]) : prisma.tension.findMany({ where: { organizationId: orgId, status: { not: "RESOLVED" }, ...(meeting.circleId ? { circleId: meeting.circleId } : {}), roleId: { not: null } }, select: { id: true, title: true, status: true, owner: { select: { name: true } } }, orderBy: { updatedAt: "desc" } }),
  ]);
  const ordinaryTensions = [];
  for (const tension of allTensions) {
    const provenance = await classifyTensionProvenance(prisma, { organizationId: orgId, tensionId: tension.id });
    if (provenance.provenance === "ORDINARY") ordinaryTensions.push(tension);
  }
  const ordinaryTensionIds = new Set(ordinaryTensions.map((tension) => tension.id));
  const routed = meeting.type === "TACTICAL"
    ? await resolveOpenTensionsRoutedToMeeting(prisma, { organizationId: orgId, meetingId: meeting.id })
    : [];
  const existingProposalRefs = meeting.type === "TACTICAL" ? await prisma.tacticalOutcomeProposal.findMany({
    where: { organizationId: orgId, meetingId: meeting.id },
    select: { tensionId: true },
  }) : [];
  const routedTensionIds = [...new Set([...routed.map((item) => item.tensionId), ...existingProposalRefs.map((item) => item.tensionId)])]
    .filter((tensionId) => !ordinaryTensionIds.has(tensionId));
  const genericRoutedTensions = routedTensionIds.length === 0 ? [] : await prisma.tension.findMany({
    where: { id: { in: routedTensionIds }, organizationId: orgId },
    include: {
      raiser: { select: { id: true, name: true } },
      circles: { select: { id: true, name: true } },
      validationRunsCreated: {
        take: 1,
        orderBy: { createdAt: "desc" },
        where: pilotUnresolvedValidationRunWhere,
        select: { id: true, dataVersion: true, status: true, tacticalResolution: true, deferReason: true, createdProject: { select: { id: true, name: true } }, createdAction: { select: { id: true, title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const visibleTensions = [...ordinaryTensions, ...genericRoutedTensions];
  const genericRoutedTensionIds = new Set(visibleTensions.map((tension) => tension.id));
  const tacticalOutcomeProposals = visibleTensions.length === 0 ? [] : await prisma.tacticalOutcomeProposal.findMany({
    where: { organizationId: orgId, meetingId: meeting.id, tensionId: { in: visibleTensions.map((tension) => tension.id) } },
    include: {
      proposer: { select: { id: true, name: true } },
      recordedBy: { select: { id: true, name: true } },
      circle: { select: { id: true, name: true } },
      responsiblePerson: { select: { id: true, name: true } },
      outcomeProject: { select: { id: true, name: true } },
      outcomeAction: { select: { id: true, title: true } },
    },
  });
  const tacticalOutcomeProposalByTension = new Map(tacticalOutcomeProposals.map((proposal) => [proposal.tensionId, proposal]));
  const routedGenericProposals = meeting.type === "GOVERNANCE"
    ? await exactRoutedGenericProposalIds(orgId, meeting.id)
    : new Map<string, { runId: string; proposalArtifactId: string; routeArtifactId: string }>();

  const meetingTypeLabel: Record<string, string> = {
    TACTICAL: "战术会",
    GOVERNANCE: "治理会",
    STRATEGY: "战略会",
  };

  const meetingTypeDesc: Record<string, string> = {
    TACTICAL: "处理运营卡点，当场到人。张力 → 行动项。",
    GOVERNANCE: "澄清组织结构与权责边界，通过规范治理流程完成调整。",
    STRATEGY: "审阅本回路目标提案，通过会议形成分布式决策。",
  };
  const isMeetingParticipant = Boolean(currentPerson && meeting.participants.some((participant) => participant.id === currentPerson.id));

  // 会议智能体数据
  const [agentParticipants, myAvailableRoles] = await Promise.all([
    prisma.meetingParticipant.findMany({
      where: { organizationId: orgId, meetingId: meeting.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        personId: true,
        roleLabel: true,
        status: true,
        person: { select: { name: true } },
        representedRoles: { select: { roleId: true, role: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      },
    }),
    currentPerson
      ? prisma.roleDef.findMany({
          where: { organizationId: orgId, status: "ACTIVE", assignees: { some: { id: currentPerson.id } } },
          select: { id: true, name: true, purpose: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);
  const myParticipant = agentParticipants.find((p) => p.personId === currentPerson?.id);
  const isOnline = myParticipant?.status === "ONLINE";
  const agentEnabled = meeting.type === "GOVERNANCE" || meeting.type === "TACTICAL";
  let initialSession = null;
  if (agentEnabled && isOnline && currentPerson) {
    try {
      initialSession = await createPrismaMeetingFacilitationRepository(prisma).getSnapshot({
        organizationId: orgId,
        meetingId: meeting.id,
        actorPersonId: currentPerson.id,
      });
    } catch (error) {
      if (!(error instanceof Error) || error.message !== "FACILITATION_SESSION_NOT_FOUND") throw error;
    }
  }
  const initialSnapshot = initialSession ? buildMeetingFacilitationReadModel(initialSession) : null;
  const initialEvents = initialSession
    ? await prisma.meetingFacilitationEvent.findMany({
        where: { organizationId: orgId, meetingId: meeting.id, sessionId: initialSession.id },
        orderBy: { sequence: "asc" },
        take: 100,
        select: { sequence: true, stateRevision: true, actorId: true, type: true, payload: true, createdAt: true },
      })
    : [];
  const cockpitParticipants = agentParticipants.map((participant) => ({
    id: participant.id,
    personId: participant.personId,
    name: participant.person.name,
    status: participant.status,
    roleIds: participant.representedRoles.map((item) => item.roleId),
    roleNames: participant.representedRoles.map((item) => item.role.name),
  }));
  const agendaSources = meeting.type === "TACTICAL"
    ? visibleTensions.map((tension) => ({ id: tension.id, label: tension.title, kind: "TENSION" as const }))
    : meeting.type === "GOVERNANCE"
      ? meetingProposals.map((proposal) => ({ id: proposal.id, label: proposal.tension.title, kind: "PROPOSAL" as const, revision: proposal.governanceDecisionProcess?.currentRevision ?? 1 }))
      : [];

  return (
    <div className={`${agentEnabled ? "max-w-[1440px]" : "max-w-4xl"} mx-auto animate-fade-rise`}>
      <Link
        href="/app/meetings"
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block"
      >
        ← 会议
      </Link>

      <div className="flex items-center gap-2 mb-3">
        <StatusBadge variant="growing" label={meetingTypeLabel[meeting.type]} />
        <span className="text-sm text-muted-foreground">
          {meeting.durationMin}min · {meeting.startedAt.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
        </span>
        <MeetingEndButton meetingId={meeting.id} endedAt={meeting.endedAt} isParticipant={isMeetingParticipant} />
      </div>

      <h1 className="font-serif text-2xl font-medium mb-2">{meeting.title}</h1>
      <p className="text-sm text-muted-foreground mb-4">{meetingTypeDesc[meeting.type]}</p>

      {/* 参与者状态条 */}
      {agentEnabled && (
        <div className="flex items-center gap-2 mb-4 text-xs flex-wrap">
          <span className="text-muted-foreground">参会角色：</span>
          {agentParticipants.map((p) => (
            <span key={p.id} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${
              p.status === "ONLINE" ? "bg-moss-pale/40 text-moss" : "bg-muted/40 text-muted-foreground"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${p.status === "ONLINE" ? "bg-moss" : "bg-muted-foreground/40"}`} />
              {p.representedRoles.map((item) => item.role.name).join(" / ") || p.roleLabel || p.person.name}
            </span>
          ))}
        </div>
      )}

      {/* 战术会：运营健康度回顾面板（顶部独立） */}
      {meeting.type === "TACTICAL" && !meeting.endedAt && (
        <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">运营健康度回顾</h2>
          <TacticalHealthReview meetingId={meeting.id} isMeetingParticipant={isMeetingParticipant} goal={tacticalGoalProjection.status === "READY" ? { title: tacticalGoalProjection.goal.title, intendedOutcome: tacticalGoalProjection.goal.intendedOutcome } : null} metrics={metrics} projects={projects} actions={actions} />
        </div>
      )}

      {/* 会议智能体视图 */}
      {(meeting.type === "TACTICAL" || meeting.type === "GOVERNANCE") && !meeting.endedAt && (
        <div className="rounded-card border border-border bg-card overflow-hidden mb-6">
          <MeetingAgentClient
            meetingId={meeting.id}
            meetingType={meeting.type}
            currentPersonId={currentPerson?.id ?? ""}
            isOnline={isOnline}
            participants={cockpitParticipants}
            availableRoles={myAvailableRoles}
            agendaSources={agendaSources}
            initialSnapshot={initialSnapshot}
            initialEvents={initialEvents.map((event) => ({
              sequence: event.sequence,
              stateRevision: event.stateRevision,
              actorPersonId: event.actorId,
              type: event.type,
              payload: event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload : {},
              createdAt: event.createdAt.toISOString(),
            }))}
          />
        </div>
      )}

      {/* ★ 工作台（仅STRATEGY显示经典模式；治理/战术会用会议智能体）*/}
      {meeting.type === "STRATEGY" && (
      <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              目标决策工作台
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              审阅本回路目标提案，并记录会议形成的分布式决策
            </p>
          </div>
          <Link href="/app/goals" className="text-xs text-moss hover:underline shrink-0">
            查看目标树
          </Link>
        </div>

        <GoalStrategyWorkbench projection={strategicGoalProjection} />
      </div>
      )}

      {/* 治理会历史记录（只读，会议结束后展示） */}
      {meeting.type === "GOVERNANCE" && meeting.endedAt && (
        <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">治理记录（已归档）</h2>
          <GovernanceWorkbench
            tensions={visibleTensions.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              type: t.type,
              raiserId: t.raiser.id,
            }))}
            proposals={meetingProposals.map((p) => ({
              id: p.id,
              type: p.type,
              targetId: p.targetId,
              proposedChange: p.proposedChange,
              rationale: p.rationale,
              status: p.status,
              proposer: p.tension.raiser,
              sourceTension: { id: p.tension.id, title: p.tension.title },
              isExactGenericRoute: p.status === "CANDIDATE" && routedGenericProposals.has(p.id),
              runId: routedGenericProposals.get(p.id)?.runId ?? p.governanceDecisionProcess?.runId ?? null,
              proposalArtifactId: routedGenericProposals.get(p.id)?.proposalArtifactId ?? null,
              routeArtifactId: routedGenericProposals.get(p.id)?.routeArtifactId ?? null,
              governanceDecisionProcess: p.governanceDecisionProcess,
            }))}
            roles={roles}
            circles={circles}
            meetingId={meeting.id}
            meetingCircleId={meeting.circleId}
            selectedProposalId={typeof query.proposal === "string" ? query.proposal : null}
            currentPersonId={currentPerson?.id ?? null}
            isMeetingParticipant={isMeetingParticipant}
            isMeetingEnded={!!meeting.endedAt}
          />
        </div>
      )}

      {/* 战术会历史记录（只读，会议结束后展示） */}
      {meeting.type === "TACTICAL" && meeting.endedAt && (
          <div className="min-w-0">
            <TacticalMeetingFlow
              health={<TacticalHealthReview meetingId={meeting.id} isMeetingParticipant={isMeetingParticipant} goal={tacticalGoalProjection.status === "READY" ? { title: tacticalGoalProjection.goal.title, intendedOutcome: tacticalGoalProjection.goal.intendedOutcome } : null} metrics={metrics} projects={projects} actions={actions} />}
              tensions={<><MeetingTensionProcessor
              tensions={visibleTensions.map((t) => ({
              id: t.id,
              title: t.title,
              description: t.description,
              type: t.type,
              status: t.status,
              raiser: t.raiser,
              circles: t.circles,
              validationRun: t.validationRunsCreated[0]
                ? {
                    id: t.validationRunsCreated[0].id,
                    dataVersion: t.validationRunsCreated[0].dataVersion,
                    status: t.validationRunsCreated[0].status,
                    tacticalResolution: t.validationRunsCreated[0].tacticalResolution,
                    deferReason: t.validationRunsCreated[0].deferReason,
                    createdProject: t.validationRunsCreated[0].createdProject,
                    createdAction: t.validationRunsCreated[0].createdAction,
                  }
                : null,
              isGenericRouted: genericRoutedTensionIds.has(t.id),
              genericProposal: tacticalOutcomeProposalByTension.get(t.id) ?? null,
            }))}
            people={people}
            circles={circles}
            roles={roles}
            projects={projects}
            meetingId={meeting.id}
            meetingType={meeting.type}
            circleId={meeting.circleId}
            currentPersonId={currentPerson?.id ?? null}
            isMeetingParticipant={isMeetingParticipant}
            />
              <GoalTacticalWorkbench projection={tacticalGoalProjection} />
              </>}
            />
          </div>
      )}

      <MeetingCollaborationPanel
        meeting={{
          id: meeting.id,
          notes: meeting.notes,
          notesRevision: meeting.notesRevision,
          endedAt: meeting.endedAt,
          endedBy: meeting.endedBy,
          participants: meeting.participants,
        }}
        people={people}
        isParticipant={isMeetingParticipant}
      />

      {/* 议程（含 AI 生成按钮）*/}
      <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">议程</h2>
          <AgendaAIButton meetingId={meeting.id} />
        </div>
        {meeting.agenda ? (
          <p className="text-sm leading-relaxed whitespace-pre-line">{meeting.agenda}</p>
        ) : (
          <p className="text-sm text-muted-foreground">尚未生成议程。点击“AI 生成议程”基于当前张力自动创建。</p>
        )}
      </div>

      {/* AI 守护者报告生成 */}
      <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">守护者报告</h2>
          <GuardReportButton meetingId={meeting.id} isParticipant={isMeetingParticipant} />
        </div>
        <p className="text-sm text-muted-foreground">基于当前保存的议程和共享纪要生成会后分析。</p>
      </div>

      {/* AI 守护者报告 */}
      {meeting.aiGuardReport && (
        <div className="rounded-card border border-needs-light/30 bg-needs-light-pale/30 p-6 mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-needs-light mb-2">
            会议守护者报告（AI 会后分析）
          </h2>
          <p className="text-sm leading-relaxed whitespace-pre-line">{meeting.aiGuardReport}</p>
        </div>
      )}

      {/* 已产出的决议 */}
      {meeting.decisions.length > 0 && (
        <div className="rounded-card border border-border bg-card p-6 shadow-soft mb-6">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
            本次会议产出的决议 ({meeting.decisions.length})
          </h2>
          <div className="space-y-3">
            {meeting.decisions.map((d) => (
              <div key={d.id} className="rounded-input border border-border p-3">
                <div className="flex items-center justify-between mb-1">
                  <StatusBadge variant="growing" label={
                    d.type === "ROLE_CHANGE" ? "角色修改" :
                    d.type === "STRATEGY_CHANGE" ? "策略修改" :
                    d.type === "CIRCLE_STRUCTURE_CHANGE" ? "回路结构" :
                    d.type === "CONFLICT_ADJUDICATION" ? "冲突裁决" : d.type
                  } />
                  {d.decisionMaker && (
                    <span className="text-xs text-muted-foreground">— {d.decisionMaker.name}</span>
                  )}
                </div>
                <p className="text-sm font-medium">{d.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function parsePage(value: string | string[] | undefined): number {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page <= 42_949_673 ? page : 1;
}

async function exactRoutedGenericProposalIds(organizationId: string, meetingId: string): Promise<Map<string, { runId: string; proposalArtifactId: string; routeArtifactId: string }>> {
  const routes = await resolveGovernanceCandidatesRoutedToMeeting(prisma, { organizationId, meetingId });
  return new Map(routes.map((route) => [route.proposalId, { runId: route.runId, proposalArtifactId: route.proposalArtifactId, routeArtifactId: route.routeArtifactId }]));
}
