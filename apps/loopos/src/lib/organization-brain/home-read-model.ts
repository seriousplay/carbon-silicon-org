import type { PrismaClient } from "@/generated/prisma/client";
import type { WorkspaceGoalProjection } from "@/lib/goals/workspace-read-model";
import type { ActorContext } from "@/lib/authorization/actor-context-resolver";
import type { PrivateBrief, PrivateBriefSignal } from "./private-brief-types";

const FOCUS_LIMIT = 3;
const HEALTHY_PROJECT_LIMIT = 3;
const FRESH_DAYS = 7;

export type BrainHomeSourceKind =
  | "goal"
  | "meeting"
  | "brain_work"
  | "project"
  | "action"
  | "tension"
  | "private_brief";

export type BrainHomeSource = Readonly<{
  kind: BrainHomeSourceKind;
  id: string;
  label: string;
  applicationUrl: string;
  observedAt: string | null;
  freshness: "FRESH" | "STALE" | "UNKNOWN";
  freshnessLabel: string;
}>;

export type BrainHomeFocusItem = Readonly<{
  id: string;
  kind: BrainHomeSourceKind;
  title: string;
  change: string;
  summary: string;
  relevance: string;
  evidence: BrainHomeSource;
  action: Readonly<{
    label: string;
    applicationUrl: string;
  }>;
}>;

export type BrainHomeHealthyState = Readonly<{
  goal: Readonly<{ id: string; title: string; applicationUrl: string }> | null;
  nextMeeting: Readonly<{
    id: string;
    title: string;
    startsAt: string;
    applicationUrl: string;
  }> | null;
  activeProjects: readonly Readonly<{
    id: string;
    title: string;
    applicationUrl: string;
  }>[];
}>;

export type OrganizationBrainHomeProjection =
  | Readonly<{
      status: "DENIED";
      focusItems: readonly BrainHomeFocusItem[];
      healthyState: null;
    }>
  | Readonly<{
      status: "READY";
      generatedAt: string;
      freshnessStatus: "CURRENT" | "LIMITED";
      freshnessLabel: string;
      focusItems: readonly BrainHomeFocusItem[];
      healthyState: BrainHomeHealthyState;
    }>;

export type BrainHomeOperationalFacts = Readonly<{
  primaryGoal: Readonly<{
    id: string;
    title: string;
    observedAt: string;
    applicationUrl: string;
  }> | null;
  nextMeeting: Readonly<{
    id: string;
    title: string;
    startsAt: string;
    updatedAt: string;
    applicationUrl: string;
  }> | null;
  unfinishedBrainWork: readonly Readonly<{
    id: string;
    title: string;
    updatedAt: string;
    applicationUrl: string;
  }>[];
  projects: readonly Readonly<{
    id: string;
    title: string;
    updatedAt: string;
    applicationUrl: string;
  }>[];
  actions: readonly Readonly<{
    id: string;
    title: string;
    updatedAt: string;
    deadline: string | null;
    applicationUrl: string;
  }>[];
  tensions: readonly Readonly<{
    id: string;
    title: string;
    updatedAt: string;
    applicationUrl: string;
  }>[];
}>;

export type BrainHomeWordingEnricher = (
  items: readonly BrainHomeFocusItem[],
) => Promise<Readonly<Record<string, Readonly<{ summary?: string; relevance?: string }>>>>;

export type OrganizationBrainHomeReadDependencies = Readonly<{
  resolveActor(): Promise<ActorContext>;
  loadOperationalFacts(actor: ActorContext, now: Date): Promise<BrainHomeOperationalFacts | null>;
  loadGoalContext(actor: ActorContext, now: Date): Promise<WorkspaceGoalProjection>;
  loadPrivateBrief(actor: ActorContext, now: Date): Promise<PrivateBrief>;
  now(): Date;
  enrichWording?: BrainHomeWordingEnricher;
}>;

type AvailableSources = Readonly<{
  operational: boolean;
  goals: boolean;
  privateBrief: boolean;
}>;

type ProjectionInput = Readonly<{
  actor: ActorContext;
  facts: BrainHomeOperationalFacts;
  goalContext: WorkspaceGoalProjection | null;
  privateBrief: PrivateBrief | null;
  available: AvailableSources;
}>;

type RankedCandidate = Readonly<{
  item: BrainHomeFocusItem;
  materiality: number;
  time: number;
  roleRelevance: number;
  processReadiness: number;
}>;

const DENIED: OrganizationBrainHomeProjection = Object.freeze({
  status: "DENIED",
  focusItems: Object.freeze([]),
  healthyState: null,
});

export async function loadOrganizationBrainHomeReadModel(
  dependencies: OrganizationBrainHomeReadDependencies,
): Promise<OrganizationBrainHomeProjection> {
  let actor: ActorContext;
  let now: Date;
  try {
    actor = await dependencies.resolveActor();
    now = dependencies.now();
  } catch {
    return DENIED;
  }
  if (!isValidDate(now)) return DENIED;

  let facts: BrainHomeOperationalFacts | null;
  let operationalAvailable = true;
  try {
    facts = await dependencies.loadOperationalFacts(actor, now);
  } catch {
    facts = emptyOperationalFacts();
    operationalAvailable = false;
  }
  if (facts === null) return DENIED;

  const [goalResult, briefResult] = await Promise.allSettled([
    dependencies.loadGoalContext(actor, now),
    dependencies.loadPrivateBrief(actor, now),
  ]);
  const goalContext = goalResult.status === "fulfilled" ? goalResult.value : null;
  const privateBrief = briefResult.status === "fulfilled" ? briefResult.value : null;
  const projection = buildOrganizationBrainHomeProjection(
    {
      actor,
      facts,
      goalContext,
      privateBrief,
      available: {
        operational: operationalAvailable,
        goals: goalResult.status === "fulfilled" && goalSourceAvailable(goalResult.value),
        privateBrief: briefResult.status === "fulfilled",
      },
    },
    now,
  );

  if (!dependencies.enrichWording || projection.status !== "READY") return projection;
  try {
    const wording = await dependencies.enrichWording(projection.focusItems);
    return {
      ...projection,
      focusItems: projection.focusItems.map((item) => ({
        ...item,
        summary: wording[item.id]?.summary?.trim() || item.summary,
        relevance: wording[item.id]?.relevance?.trim() || item.relevance,
      })),
    };
  } catch {
    return projection;
  }
}

export function buildOrganizationBrainHomeProjection(
  input: ProjectionInput,
  now: Date,
): OrganizationBrainHomeProjection {
  if (!isValidActor(input.actor) || !isValidDate(now)) return DENIED;

  const workspaceGoal = primaryGoal(input.goalContext);
  const goal = input.facts.primaryGoal ?? (workspaceGoal
    ? { id: workspaceGoal.id, title: workspaceGoal.title, applicationUrl: workspaceGoal.url }
    : null);
  const candidates = [
    ...privateBriefCandidates(input.privateBrief, now),
    ...goalCandidates(workspaceGoal, now),
    ...meetingCandidates(input.facts, now),
    ...brainWorkCandidates(input.facts, now),
    ...actionCandidates(input.facts, now),
    ...tensionCandidates(input.facts, now),
    ...projectCandidates(input.facts, now),
  ];
  const focusItems = deduplicateCandidates(candidates)
    .sort(compareCandidates)
    .slice(0, FOCUS_LIMIT)
    .map((candidate) => candidate.item);
  const limited = Object.values(input.available).some((available) => !available);

  return {
    status: "READY",
    generatedAt: now.toISOString(),
    freshnessStatus: limited ? "LIMITED" : "CURRENT",
    freshnessLabel: limited
      ? "部分动态来源暂时不可用；以下仅展示已确认事实，更新时间可能不完整。"
      : "已基于当前可用的授权事实生成。",
    focusItems,
    healthyState: {
      goal: goal ? {
        id: goal.id,
        title: goal.title,
        applicationUrl: appPath(goal.applicationUrl, "/app/goals"),
      } : null,
      nextMeeting: input.facts.nextMeeting
        ? {
            id: input.facts.nextMeeting.id,
            title: input.facts.nextMeeting.title,
            startsAt: input.facts.nextMeeting.startsAt,
            applicationUrl: appPath(input.facts.nextMeeting.applicationUrl, "/app/meetings"),
          }
        : null,
      activeProjects: input.facts.projects.slice(0, HEALTHY_PROJECT_LIMIT).map((project) => ({
        id: project.id,
        title: project.title,
        applicationUrl: appPath(project.applicationUrl, "/app/projects"),
      })),
    },
  };
}

export async function getOrganizationBrainHomeReadModel(): Promise<OrganizationBrainHomeProjection> {
  const [actorModule, dbModule, goalsModule, briefModule] = await Promise.all([
    import("@/lib/authorization/actor-context"),
    import("@/lib/db"),
    import("@/lib/goals/workspace-read-model"),
    import("./private-brief-service"),
  ]);
  const factStore = briefModule.createPrismaPrivateBriefFactStore(dbModule.prisma);

  return loadOrganizationBrainHomeReadModel({
    resolveActor: actorModule.resolveActorContext,
    loadOperationalFacts: createPrismaBrainHomeOperationalFactLoader(dbModule.prisma),
    loadGoalContext: (actor, now) => goalsModule.queryWorkspaceGoalContext(
      { organizationId: actor.organizationId, viewerPersonId: actor.personId },
      { prisma: dbModule.prisma, now },
    ),
    loadPrivateBrief: (actor, now) => briefModule.buildPrivateBriefForCurrentActor(
      { schemaVersion: 1, maxSignals: 20 },
      { resolveActor: async () => actor, facts: factStore, now: () => now },
    ),
    now: () => new Date(),
  });
}

export function createPrismaBrainHomeOperationalFactLoader(client: PrismaClient) {
  return async (actor: ActorContext, now: Date): Promise<BrainHomeOperationalFacts | null> => {
    const viewer = await client.person.findFirst({
      where: { id: actor.personId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!viewer) return null;

    const [primaryGoal, meeting, conversations, projects, actions, tensions] = await Promise.all([
      client.goal.findFirst({
        where: {
          organizationId: actor.organizationId,
          status: "ACTIVE",
          parentGoalId: null,
          cycle: { status: "ACTIVE" },
          ...(actor.membershipRole === "ORG_ADMIN"
            ? {}
            : {
                OR: [
                  { ownerRoleId: { in: [...actor.assignedActiveRoleDefIds] } },
                  {
                    circleId: {
                      in: [actor.homeCircleId, ...actor.ledActiveCircleIds],
                    },
                  },
                ],
              }),
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { id: true, title: true, createdAt: true, cycleId: true },
      }),
      client.meeting.findFirst({
        where: {
          organizationId: actor.organizationId,
          endedAt: null,
          startedAt: { gt: now },
          participants: { some: { id: actor.personId, organizationId: actor.organizationId } },
        },
        orderBy: [{ startedAt: "asc" }, { id: "asc" }],
        select: { id: true, title: true, startedAt: true, createdAt: true },
      }),
      client.brainConversation.findMany({
        where: {
          organizationId: actor.organizationId,
          ownerId: actor.personId,
          updatedAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 10,
        select: {
          id: true,
          organizationId: true,
          ownerId: true,
          title: true,
          updatedAt: true,
          messages: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: { role: true },
          },
        },
      }),
      client.project.findMany({
        where: {
          organizationId: actor.organizationId,
          bearerId: actor.personId,
          status: "ACTIVE",
          tacticalOutcomeProposal: { status: "APPROVED", kind: "PROJECT" },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 20,
        select: { id: true, name: true, updatedAt: true },
      }),
      client.tension.findMany({
        where: {
          organizationId: actor.organizationId,
          ownerId: actor.personId,
          status: { notIn: ["RESOLVED", "REJECTED"] },
          tacticalOutcomeActionProposal: { status: "APPROVED", kind: "ACTION" },
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 20,
        select: { id: true, title: true, updatedAt: true, deadline: true },
      }),
      client.tension.findMany({
        where: {
          organizationId: actor.organizationId,
          status: { notIn: ["RESOLVED", "REJECTED"] },
          ...(actor.membershipRole === "ORG_ADMIN"
            ? {}
            : {
                OR: [
                  { raiserId: actor.personId },
                  { ownerId: actor.personId },
                  { roleId: { in: [...actor.assignedActiveRoleDefIds] } },
                  { circle: { leadPersonId: actor.personId } },
                  { circles: { some: { leadPersonId: actor.personId } } },
                ],
              }),
        },
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
        take: 20,
        select: { id: true, title: true, updatedAt: true },
      }),
    ]);

    return {
      primaryGoal: primaryGoal
        ? {
            id: primaryGoal.id,
            title: primaryGoal.title,
            observedAt: primaryGoal.createdAt.toISOString(),
            applicationUrl: `/app/goals?cycle=${encodeURIComponent(primaryGoal.cycleId)}&goal=${encodeURIComponent(primaryGoal.id)}`,
          }
        : null,
      nextMeeting: meeting
        ? {
            id: meeting.id,
            title: meeting.title,
            startsAt: meeting.startedAt.toISOString(),
            updatedAt: meeting.createdAt.toISOString(),
            applicationUrl: `/app/meetings/${meeting.id}`,
          }
        : null,
      unfinishedBrainWork: conversations
        .filter((conversation) =>
          conversation.organizationId === actor.organizationId
          && conversation.ownerId === actor.personId
          && conversation.messages[0]?.role === "USER"
        )
        .map((conversation) => ({
          id: conversation.id,
          title: conversation.title?.trim() || "未完成的组织大脑对话",
          updatedAt: conversation.updatedAt.toISOString(),
          applicationUrl: "/app#brain-workspace",
        })),
      projects: projects.map((project) => ({
        id: project.id,
        title: project.name,
        updatedAt: project.updatedAt.toISOString(),
        applicationUrl: `/app/projects/${project.id}`,
      })),
      actions: actions.map((action) => ({
        id: action.id,
        title: action.title,
        updatedAt: action.updatedAt.toISOString(),
        deadline: action.deadline?.toISOString() ?? null,
        applicationUrl: `/app/tensions/${action.id}`,
      })),
      tensions: tensions.map((tension) => ({
        id: tension.id,
        title: tension.title,
        updatedAt: tension.updatedAt.toISOString(),
        applicationUrl: `/app/tensions/${tension.id}`,
      })),
    };
  };
}

function primaryGoal(context: WorkspaceGoalProjection | null) {
  return context?.status === "READY" ? context.goals[0] ?? null : null;
}

function goalSourceAvailable(context: WorkspaceGoalProjection): boolean {
  return context.status !== "NOT_AVAILABLE" || context.reason === "ACTIVE_CYCLE_NOT_FOUND";
}

function privateBriefCandidates(brief: PrivateBrief | null, now: Date): RankedCandidate[] {
  return brief?.signals.map((signal) => candidateFromBrief(signal, now)) ?? [];
}

function candidateFromBrief(signal: PrivateBriefSignal, now: Date): RankedCandidate {
  const source = signal.sources[0];
  const observedAt = source?.observedAt ?? null;
  return ranked(
    {
      id: `private_brief:${signal.dedupeKey}`,
      kind: "private_brief",
      title: signal.title,
      change: "组织事实触发了一条新的确定性信号。",
      summary: signal.reason,
      relevance: "这是基于你当前角色和组织事实生成的确定性提醒。",
      evidence: evidence(
        briefSourceKind(source?.type),
        source?.id ?? signal.dedupeKey,
        source?.label ?? "组织大脑私有简报",
        appPath(source?.applicationUrl ?? signal.action.applicationUrl, "/app"),
        observedAt,
        now,
      ),
      action: {
        label: signal.action.label,
        applicationUrl: appPath(signal.action.applicationUrl, "/app"),
      },
    },
    signal.severity === "risk" ? 5 : 4,
    timeScore(observedAt, now),
    3,
    3,
  );
}

function goalCandidates(goal: ReturnType<typeof primaryGoal>, now: Date): RankedCandidate[] {
  if (!goal || goal.health === "ON_TRACK" || goal.health === "ACHIEVED") return [];
  const observedAt = goal.targets
    .map((target) => target.effectiveEvidence?.recordedAt.toISOString() ?? null)
    .find(Boolean) ?? null;
  return [ranked({
    id: `goal:${goal.id}`,
    kind: "goal",
    title: goal.title,
    change: goal.health === "OFF_TRACK"
      ? "最新目标证据显示当前状态为偏离预期。"
      : "最新目标证据显示当前状态存在风险。",
    summary: goal.health === "OFF_TRACK" ? "主目标当前偏离预期，需要查看证据。" : "主目标存在风险，需要查看最新证据。",
    relevance: "这是与你当前角色关联的本周期目标。",
    evidence: evidence("goal", goal.id, goal.title, goal.url, observedAt, now),
    action: { label: "查看目标", applicationUrl: appPath(goal.url, "/app/goals") },
  }, goal.health === "OFF_TRACK" ? 5 : 4, timeScore(observedAt, now), 3, 3)];
}

function meetingCandidates(facts: BrainHomeOperationalFacts, now: Date): RankedCandidate[] {
  const meeting = facts.nextMeeting;
  if (!meeting) return [];
  return [ranked({
    id: `meeting:${meeting.id}`,
    kind: "meeting",
    title: meeting.title,
    change: "会议已进入你的待开始队列。",
    summary: "你参与的下一场会议已安排，可提前进入查看。",
    relevance: "你是该会议的参与者。",
    evidence: evidence("meeting", meeting.id, meeting.title, meeting.applicationUrl, meeting.updatedAt, now),
    action: { label: "进入会议", applicationUrl: appPath(meeting.applicationUrl, "/app/meetings") },
  }, 3, upcomingTimeScore(meeting.startsAt, now), 3, 4)];
}

function brainWorkCandidates(facts: BrainHomeOperationalFacts, now: Date): RankedCandidate[] {
  return facts.unfinishedBrainWork.map((work) => ranked({
    id: `brain_work:${work.id}`,
    kind: "brain_work",
    title: work.title,
    change: "最近一条对话消息来自你，仍等待组织大脑回复。",
    summary: "这段仅你可见的组织大脑对话仍等待继续。",
    relevance: "这是你本人最近未完成的私有工作。",
    evidence: evidence("brain_work", work.id, work.title, work.applicationUrl, work.updatedAt, now),
    action: { label: "查看对话列表", applicationUrl: appPath(work.applicationUrl, "/app#brain-workspace") },
  }, 3, timeScore(work.updatedAt, now), 3, 4));
}

function actionCandidates(facts: BrainHomeOperationalFacts, now: Date): RankedCandidate[] {
  return facts.actions.map((action) => ranked({
    id: `action:${action.id}`,
    kind: "action",
    title: action.title,
    change: action.deadline && Date.parse(action.deadline) < now.getTime()
      ? "行动已越过约定期限且仍未闭环。"
      : "行动在最近一次更新后仍未闭环。",
    summary: action.deadline && Date.parse(action.deadline) < now.getTime()
      ? "你承担的行动已超过期限。"
      : "你承担的行动仍待完成。",
    relevance: "该行动由你本人承担。",
    evidence: evidence("action", action.id, action.title, action.applicationUrl, action.updatedAt, now),
    action: { label: "查看行动", applicationUrl: appPath(action.applicationUrl, "/app/tracker") },
  }, action.deadline && Date.parse(action.deadline) < now.getTime() ? 5 : 4,
  action.deadline ? upcomingTimeScore(action.deadline, now) : timeScore(action.updatedAt, now), 4, 4));
}

function tensionCandidates(facts: BrainHomeOperationalFacts, now: Date): RankedCandidate[] {
  return facts.tensions.map((tension) => ranked({
    id: `tension:${tension.id}`,
    kind: "tension",
    title: tension.title,
    change: "张力在最近一次更新后仍处于未解决状态。",
    summary: "与你的角色或回路相关的张力尚未解决。",
    relevance: "你是提出者、承担者、角色承担者或相关回路负责人。",
    evidence: evidence("tension", tension.id, tension.title, tension.applicationUrl, tension.updatedAt, now),
    action: { label: "查看张力", applicationUrl: appPath(tension.applicationUrl, "/app/tensions") },
  }, 4, timeScore(tension.updatedAt, now), 3, 3));
}

function projectCandidates(facts: BrainHomeOperationalFacts, now: Date): RankedCandidate[] {
  return facts.projects.map((project) => ranked({
    id: `project:${project.id}`,
    kind: "project",
    title: project.title,
    change: "项目在最近一次更新后仍处于进行中状态。",
    summary: "你承担的项目仍在进行中。",
    relevance: "你是该项目的承担者。",
    evidence: evidence("project", project.id, project.title, project.applicationUrl, project.updatedAt, now),
    action: { label: "查看项目", applicationUrl: appPath(project.applicationUrl, "/app/projects") },
  }, 2, timeScore(project.updatedAt, now), 4, 3));
}

function ranked(
  item: BrainHomeFocusItem,
  materiality: number,
  time: number,
  roleRelevance: number,
  processReadiness: number,
): RankedCandidate {
  return { item, materiality, time, roleRelevance, processReadiness };
}

function compareCandidates(left: RankedCandidate, right: RankedCandidate): number {
  return right.materiality - left.materiality
    || right.time - left.time
    || right.roleRelevance - left.roleRelevance
    || right.processReadiness - left.processReadiness
    || left.item.id.localeCompare(right.item.id);
}

function deduplicateCandidates(candidates: readonly RankedCandidate[]): RankedCandidate[] {
  const seenSources = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.item.evidence.kind}:${candidate.item.evidence.id}`;
    if (seenSources.has(key)) return false;
    seenSources.add(key);
    return true;
  });
}

function evidence(
  kind: BrainHomeSourceKind,
  id: string,
  label: string,
  applicationUrl: string,
  observedAt: string | null,
  now: Date,
): BrainHomeSource {
  const freshness = freshnessOf(observedAt, now);
  return {
    kind,
    id,
    label,
    applicationUrl: appPath(applicationUrl, "/app"),
    observedAt,
    freshness,
    freshnessLabel: freshness === "FRESH"
      ? "7 天内更新"
      : freshness === "STALE"
        ? "超过 7 天未更新"
        : "来源未提供可靠更新时间",
  };
}

function freshnessOf(observedAt: string | null, now: Date): BrainHomeSource["freshness"] {
  if (!observedAt) return "UNKNOWN";
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return "UNKNOWN";
  return now.getTime() - timestamp <= FRESH_DAYS * 86_400_000 ? "FRESH" : "STALE";
}

function briefSourceKind(value: PrivateBriefSignal["sources"][number]["type"] | undefined): BrainHomeSourceKind {
  if (
    value === "goal"
    || value === "meeting"
    || value === "tension"
    || value === "project"
    || value === "action"
  ) {
    return value;
  }
  return "private_brief";
}

function timeScore(observedAt: string | null, now: Date): number {
  if (!observedAt) return 0;
  const timestamp = Date.parse(observedAt);
  if (!Number.isFinite(timestamp)) return 0;
  const ageDays = Math.max(0, (now.getTime() - timestamp) / 86_400_000);
  if (ageDays <= 1) return 4;
  if (ageDays <= 3) return 3;
  if (ageDays <= 7) return 2;
  return 1;
}

function upcomingTimeScore(value: string, now: Date): number {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return 0;
  const distanceDays = Math.abs(timestamp - now.getTime()) / 86_400_000;
  if (distanceDays <= 1) return 4;
  if (distanceDays <= 3) return 3;
  if (distanceDays <= 7) return 2;
  return 1;
}

function emptyOperationalFacts(): BrainHomeOperationalFacts {
  return {
    primaryGoal: null,
    nextMeeting: null,
    unfinishedBrainWork: [],
    projects: [],
    actions: [],
    tensions: [],
  };
}

function isValidActor(actor: ActorContext): boolean {
  return Boolean(actor.organizationId.trim() && actor.userId.trim() && actor.personId.trim());
}

function isValidDate(value: Date): boolean {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

function appPath(value: string, fallback: string): string {
  const path = value.trim();
  return path === "/app"
    || path.startsWith("/app/")
    || path.startsWith("/app?")
    || path.startsWith("/app#")
    ? path
    : fallback;
}
