import "server-only";

import { prisma } from "@/lib/db";
import { resolveActorContext } from "../authorization/actor-context";
import type { ActorContext } from "../authorization/actor-context-resolver";
import {
  buildPrivateBrief,
  type PrivateBriefCircleFact,
  type PrivateBriefDetectorInput,
  type PrivateBriefGoalFact,
  type PrivateBriefMeetingFact,
  type PrivateBriefTargetFact,
  type PrivateBriefTensionFact,
  type PrivateBriefWorkFact,
} from "./private-brief-detector";
import type { PrivateBrief } from "./private-brief-types";
import type { PrismaClient } from "@/generated/prisma/client";

const DEFAULT_WINDOW_DAYS = 7;
const MAX_WINDOW_DAYS = 31;
const DEFAULT_SIGNAL_LIMIT = 20;
const MAX_SIGNAL_LIMIT = 30;
const DEFAULT_FACT_LIMIT = 80;
const DAY_MS = 24 * 60 * 60 * 1000;

export type PrivateBriefServiceInput = Readonly<{
  schemaVersion: 1;
  windowDays?: number;
  maxSignals?: number;
}>;

export type PrivateBriefServiceErrorCode = "INVALID_INPUT" | "ACCESS_DENIED";

export class PrivateBriefServiceError extends Error {
  constructor(public readonly code: PrivateBriefServiceErrorCode) {
    super(`Private brief service failed: ${code}`);
    this.name = "PrivateBriefServiceError";
  }
}

export type TenantScoped<T> = T & Readonly<{ organizationId: string }>;

export type PrivateBriefSourceFacts = Readonly<{
  goals: readonly TenantScoped<PrivateBriefGoalFact>[];
  targets: readonly TenantScoped<PrivateBriefTargetFact>[];
  meetings: readonly TenantScoped<PrivateBriefMeetingFact>[];
  tensions: readonly TenantScoped<PrivateBriefTensionFact>[];
  work: readonly TenantScoped<PrivateBriefWorkFact>[];
  circles: readonly TenantScoped<PrivateBriefCircleFact>[];
}>;

export type PrivateBriefFactStore = Readonly<{
  loadFacts(
    actor: ActorContext,
    input: Readonly<{ now: Date; windowDays: number; maxFacts: number }>,
  ): Promise<PrivateBriefSourceFacts>;
}>;

export type PrivateBriefServiceDependencies = Readonly<{
  resolveActor(): Promise<ActorContext>;
  facts: PrivateBriefFactStore;
  now(): Date;
}>;

type ParsedInput = Readonly<{
  windowDays: number;
  maxSignals: number;
}>;

function fail(code: PrivateBriefServiceErrorCode): never {
  throw new PrivateBriefServiceError(code);
}

function parseInput(input: PrivateBriefServiceInput): ParsedInput {
  if (!input || input.schemaVersion !== 1) fail("INVALID_INPUT");
  return {
    windowDays: boundedInteger(input.windowDays, DEFAULT_WINDOW_DAYS, 1, MAX_WINDOW_DAYS),
    maxSignals: boundedInteger(input.maxSignals, DEFAULT_SIGNAL_LIMIT, 1, MAX_SIGNAL_LIMIT),
  };
}

function boundedInteger(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < min || value > max) fail("INVALID_INPUT");
  return value;
}

function sameOrganization<T extends { organizationId: string }>(
  actor: ActorContext,
  facts: readonly T[],
): T[] {
  return facts.filter((fact) => fact.organizationId === actor.organizationId);
}

function stripTenant<T extends { organizationId: string }>(
  fact: T,
): Omit<T, "organizationId"> {
  const { organizationId, ...rest } = fact;
  void organizationId;
  return rest;
}

function detectorInput(
  actor: ActorContext,
  now: Date,
  parsed: ParsedInput,
  facts: PrivateBriefSourceFacts,
): PrivateBriefDetectorInput {
  return {
    now,
    actorPersonId: actor.personId,
    windowDays: parsed.windowDays,
    maxSignals: parsed.maxSignals,
    goals: sameOrganization(actor, facts.goals).map(stripTenant),
    targets: sameOrganization(actor, facts.targets).map(stripTenant),
    meetings: sameOrganization(actor, facts.meetings).map(stripTenant),
    tensions: sameOrganization(actor, facts.tensions).map(stripTenant),
    work: sameOrganization(actor, facts.work)
      .filter((fact) => fact.ownerPersonId === actor.personId)
      .map(stripTenant),
    circles: sameOrganization(actor, facts.circles).map(stripTenant),
  };
}

export async function buildPrivateBriefForCurrentActor(
  input: PrivateBriefServiceInput,
  dependencies: PrivateBriefServiceDependencies,
): Promise<PrivateBrief> {
  const parsed = parseInput(input);
  let actor: ActorContext;
  try {
    actor = await dependencies.resolveActor();
  } catch {
    fail("ACCESS_DENIED");
  }

  const now = dependencies.now();
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) fail("INVALID_INPUT");
  const facts = await dependencies.facts.loadFacts(actor, {
    now,
    windowDays: parsed.windowDays,
    maxFacts: DEFAULT_FACT_LIMIT,
  });

  return buildPrivateBrief(detectorInput(actor, now, parsed, facts));
}

export async function getPrivateBrief(
  input: PrivateBriefServiceInput,
): Promise<PrivateBrief> {
  return buildPrivateBriefForCurrentActor(input, {
    resolveActor: resolveActorContext,
    facts: createPrismaPrivateBriefFactStore(prisma),
    now: () => new Date(),
  });
}

export function createPrismaPrivateBriefFactStore(client: PrismaClient): PrivateBriefFactStore {
  return {
    async loadFacts(actor, input) {
      const maxFacts = input.maxFacts;
      const recentBoundary = new Date(input.now.getTime() - input.windowDays * DAY_MS);
      const roleRows = await client.roleDef.findMany({
        where: {
          organizationId: actor.organizationId,
          id: { in: [...actor.assignedActiveRoleDefIds] },
          status: "ACTIVE",
        },
        select: { id: true, circleId: true },
      });
      const actorCircleIds = [...new Set([
        actor.homeCircleId,
        ...actor.ledActiveCircleIds,
        ...roleRows.map((role) => role.circleId),
      ])];
      const relatedCircleFilter = actor.membershipRole === "ORG_ADMIN"
        ? {}
        : { OR: [{ id: { in: actorCircleIds } }, { parentId: { in: actorCircleIds } }] };

      const activeCycle = await client.goalCycle.findFirst({
        where: { organizationId: actor.organizationId, status: "ACTIVE" },
        orderBy: [{ startAt: "desc" }, { id: "asc" }],
        select: { id: true },
      });

      const [circleRows, goalRows, meetingRows, tensionRows, projectRows, actionRows] = await Promise.all([
        client.circle.findMany({
          where: { organizationId: actor.organizationId, ...relatedCircleFilter },
          orderBy: [{ name: "asc" }, { id: "asc" }],
          take: maxFacts,
          select: { id: true, organizationId: true, name: true, parentId: true },
        }),
        activeCycle
          ? client.goal.findMany({
              where: {
                organizationId: actor.organizationId,
                cycleId: activeCycle.id,
                status: "ACTIVE",
                ...(actor.membershipRole === "ORG_ADMIN"
                  ? {}
                  : {
                      OR: [
                        { circleId: { in: actorCircleIds } },
                        { ownerRoleId: { in: [...actor.assignedActiveRoleDefIds] } },
                      ],
                    }),
              },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              take: maxFacts,
              select: {
                id: true,
                organizationId: true,
                cycleId: true,
                circleId: true,
                title: true,
                parentGoalId: true,
                checkIns: {
                  where: { organizationId: actor.organizationId, supersededBy: null },
                  orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
                  take: 1,
                  select: { recordedAt: true },
                },
                targets: {
                  where: { organizationId: actor.organizationId },
                  orderBy: [{ position: "asc" }, { id: "asc" }],
                  take: maxFacts,
                  select: {
                    id: true,
                    organizationId: true,
                    goalId: true,
                    label: true,
                    checkIns: {
                      where: { organizationId: actor.organizationId, supersededBy: null },
                      orderBy: [{ recordedAt: "desc" }, { id: "desc" }],
                      take: 1,
                      select: { recordedAt: true },
                    },
                  },
                },
                circle: { select: { name: true } },
              },
            })
          : Promise.resolve([]),
        client.meeting.findMany({
          where: {
            organizationId: actor.organizationId,
            startedAt: { gte: recentBoundary },
            participants: { some: { id: actor.personId } },
          },
          orderBy: [{ startedAt: "desc" }, { id: "asc" }],
          take: maxFacts,
          select: {
            id: true,
            organizationId: true,
            title: true,
            type: true,
            circleId: true,
            startedAt: true,
            tacticalOutcomeProposals: {
              where: { status: { in: ["PROPOSED", "RETURNED"] } },
              select: { id: true },
            },
            governanceDecisionProcesses: {
              where: {
                state: {
                  in: [
                    "READY",
                    "CLARIFICATION_REQUIRED",
                    "OBJECTION_PENDING",
                    "AMENDMENT_REQUIRED",
                  ],
                },
              },
              select: { id: true },
            },
            goalDecisions: { select: { id: true } },
          },
        }),
        client.tension.findMany({
          where: {
            organizationId: actor.organizationId,
            status: { notIn: ["RESOLVED", "REJECTED"] },
            createdAt: { gte: new Date(input.now.getTime() - 30 * DAY_MS) },
            ...(actor.membershipRole === "ORG_ADMIN"
              ? {}
              : {
                  OR: [
                    { raiserId: actor.personId },
                    { ownerId: actor.personId },
                    { circle: { leadPersonId: actor.personId } },
                    { circles: { some: { leadPersonId: actor.personId } } },
                  ],
                }),
          },
          orderBy: [{ createdAt: "desc" }, { id: "asc" }],
          take: maxFacts,
          select: {
            id: true,
            organizationId: true,
            title: true,
            status: true,
            circleId: true,
            createdAt: true,
            circle: { select: { id: true, name: true } },
            circles: { select: { id: true, name: true } },
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
          take: maxFacts,
          select: {
            id: true,
            organizationId: true,
            name: true,
            status: true,
            bearerId: true,
            circleId: true,
          },
        }),
        client.tension.findMany({
          where: {
            organizationId: actor.organizationId,
            ownerId: actor.personId,
            status: { notIn: ["RESOLVED", "REJECTED"] },
            tacticalOutcomeActionProposal: { status: "APPROVED", kind: "ACTION" },
          },
          orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
          take: maxFacts,
          select: {
            id: true,
            organizationId: true,
            title: true,
            status: true,
            ownerId: true,
            roleId: true,
            circleId: true,
          },
        }),
      ]);

      return {
        circles: circleRows.map((circle) => ({
          organizationId: circle.organizationId,
          id: circle.id,
          name: circle.name,
          parentCircleId: circle.parentId,
          applicationUrl: `/app/circles/${circle.id}`,
        })),
        goals: goalRows.map((goal) => ({
          organizationId: goal.organizationId,
          id: goal.id,
          title: goal.title,
          circleId: goal.circleId,
          circleName: goal.circle.name,
          cycleId: goal.cycleId,
          status: "ACTIVE",
          isPrimary: goal.parentGoalId === null,
          lastCheckInAt: goal.checkIns[0]?.recordedAt.toISOString() ?? null,
          applicationUrl: goalUrl(goal.cycleId, goal.id),
        })),
        targets: goalRows.flatMap((goal) =>
          goal.targets.map((target) => ({
            organizationId: target.organizationId,
            id: target.id,
            goalId: target.goalId,
            goalTitle: goal.title,
            label: target.label,
            evidenceAt: target.checkIns[0]?.recordedAt.toISOString() ?? null,
            applicationUrl: `${goalUrl(goal.cycleId, goal.id)}#target-${target.id}`,
          })),
        ),
        meetings: meetingRows.flatMap((meeting) => {
          const unresolvedOutputCount =
            meeting.tacticalOutcomeProposals.length +
            meeting.governanceDecisionProcesses.length;
          if (unresolvedOutputCount <= 0) return [];
          return [{
            organizationId: meeting.organizationId,
            id: meeting.id,
            title: meeting.title,
            type: meeting.type,
            circleId: meeting.circleId ?? actor.homeCircleId,
            startedAt: meeting.startedAt.toISOString(),
            unresolvedOutputCount,
            applicationUrl: `/app/meetings/${meeting.id}`,
          }];
        }),
        tensions: tensionRows.flatMap((tension) => {
          const circle = tension.circle ?? tension.circles[0];
          if (!circle) return [];
          return [{
            organizationId: tension.organizationId,
            id: tension.id,
            title: tension.title,
            circleId: circle.id,
            circleName: circle.name,
            status: "OPEN",
            similarityKey: similarityKey(tension.title),
            createdAt: tension.createdAt.toISOString(),
            applicationUrl: `/app/tensions/${tension.id}`,
          }];
        }),
        work: [
          ...projectRows.map((project) => ({
            organizationId: project.organizationId,
            id: project.id,
            kind: "PROJECT" as const,
            title: project.name,
            status: "ACTIVE" as const,
            ownerPersonId: project.bearerId,
            roleId: null,
            circleId: project.circleId,
            applicationUrl: `/app/projects/${project.id}`,
          })),
          ...actionRows.map((action) => ({
            organizationId: action.organizationId,
            id: action.id,
            kind: "ACTION" as const,
            title: action.title,
            status: "ACTIVE" as const,
            ownerPersonId: action.ownerId,
            roleId: action.roleId,
            circleId: action.circleId,
            applicationUrl: `/app/tensions/${action.id}`,
          })),
        ],
      };
    },
  };
}

function goalUrl(cycleId: string, goalId: string): string {
  return `/app/goals?cycle=${encodeURIComponent(cycleId)}&goal=${encodeURIComponent(goalId)}`;
}

function similarityKey(title: string): string | null {
  const normalized = title.trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return normalized.length > 0 ? normalized.slice(0, 80) : null;
}
