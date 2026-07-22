import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { ActorContext } from "../authorization/actor-context-resolver";
import type { WorkspaceGoalProjection } from "../goals/workspace-read-model";
import type { PrivateBrief } from "./private-brief-types";
import {
  buildOrganizationBrainHomeProjection,
  createPrismaBrainHomeOperationalFactLoader,
  loadOrganizationBrainHomeReadModel,
  type BrainHomeOperationalFacts,
} from "./home-read-model";

const now = new Date("2026-07-17T12:00:00.000Z");
const actor: ActorContext = {
  organizationId: "org-a",
  userId: "user-a",
  personId: "person-a",
  membershipRole: "ORG_MEMBER",
  homeCircleId: "circle-a",
  assignedActiveRoleDefIds: ["role-a"],
  ledActiveCircleIds: [],
};

function operational(overrides: Partial<BrainHomeOperationalFacts> = {}): BrainHomeOperationalFacts {
  return {
    primaryGoal: {
      id: "goal-a",
      title: "交付可用版本",
      observedAt: "2026-07-15T12:00:00.000Z",
      applicationUrl: "/app/goals?goal=goal-a",
    },
    nextMeeting: {
      id: "meeting-a",
      title: "模型回路战术会",
      startsAt: "2026-07-18T08:00:00.000Z",
      updatedAt: "2026-07-16T08:00:00.000Z",
      applicationUrl: "/app/meetings/meeting-a",
    },
    unfinishedBrainWork: [],
    projects: [{
      id: "project-a",
      title: "试运行准备",
      updatedAt: "2026-07-16T12:00:00.000Z",
      applicationUrl: "/app/projects/project-a",
    }],
    actions: [],
    tensions: [],
    ...overrides,
  };
}

function goalContext(health: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED" = "ON_TRACK") {
  return {
    status: "READY",
    cycle: {
      id: "cycle-a",
      name: "2026 Q3",
      startAt: new Date("2026-07-01T00:00:00.000Z"),
      endAt: new Date("2026-09-30T00:00:00.000Z"),
      checkInCadenceDays: 7,
      url: "/app/goals?cycle=cycle-a",
    },
    goals: [{
      id: "goal-a",
      title: "交付可用版本",
      intendedOutcome: "真实团队可运行",
      health,
      url: "/app/goals?goal=goal-a",
      circle: { id: "circle-a", name: "模型回路", url: "/app/circles/circle-a" },
      ownerRole: {
        id: "role-a",
        name: "负责人",
        status: "ACTIVE",
        assigneeCount: 1,
        viewerAssigned: true,
        url: "/app/roles/role-a",
      },
      meetings: [],
      meetingCount: 0,
      meetingsHasMore: false,
      meetingsUrl: "/app/meetings",
      targets: [],
      targetCount: 0,
      targetsHasMore: false,
      workLinks: [],
      workLinkCount: 0,
      workLinksHasMore: false,
    }],
    hasMore: false,
    allGoalsUrl: "/app/goals?cycle=cycle-a",
  } satisfies WorkspaceGoalProjection;
}

const emptyBrief: PrivateBrief = {
  schemaVersion: 1,
  generatedAt: now.toISOString(),
  windowDays: 7,
  signals: [],
  truncated: false,
};

describe("M6-1B Organization Brain home read model", () => {
  test("denies missing actors and nonexistent tenant viewers without loading organization facts", async () => {
    let called = false;
    const missingActor = await loadOrganizationBrainHomeReadModel({
      resolveActor: async () => { throw new Error("missing session"); },
      loadOperationalFacts: async () => { called = true; return operational(); },
      loadGoalContext: async () => goalContext(),
      loadPrivateBrief: async () => emptyBrief,
      now: () => now,
    });
    assert.equal(missingActor.status, "DENIED");
    assert.equal(called, false);

    const nonexistentViewer = await loadOrganizationBrainHomeReadModel({
      resolveActor: async () => actor,
      loadOperationalFacts: async () => null,
      loadGoalContext: async () => assert.fail("goal facts must not load"),
      loadPrivateBrief: async () => assert.fail("brief facts must not load"),
      now: () => now,
    });
    assert.deepEqual(nonexistentViewer, {
      status: "DENIED",
      focusItems: [],
      healthyState: null,
    });
  });

  test("ranks actor-owned ready actions above active projects and caps output at three", () => {
    const projection = buildOrganizationBrainHomeProjection({
      actor,
      facts: operational({
        nextMeeting: null,
        actions: ["d", "b", "a", "c"].map((id) => ({
          id,
          title: `行动 ${id}`,
          updatedAt: "2026-07-17T08:00:00.000Z",
          deadline: null,
          applicationUrl: `/app/tensions/${id}`,
        })),
        projects: [{
          id: "project-z",
          title: "进行中项目",
          updatedAt: "2026-07-17T08:00:00.000Z",
          applicationUrl: "/app/projects/project-z",
        }],
      }),
      goalContext: goalContext(),
      privateBrief: emptyBrief,
      available: { operational: true, goals: true, privateBrief: true },
    }, now);

    assert.equal(projection.status, "READY");
    if (projection.status !== "READY") return;
    assert.equal(projection.focusItems.length, 3);
    assert.deepEqual(projection.focusItems.map((item) => item.id), ["action:a", "action:b", "action:c"]);
    assert.equal(projection.focusItems.every((item) => item.relevance.includes("本人承担")), true);
    assert.equal(projection.focusItems.every((item) => item.change.includes("仍未闭环")), true);
  });

  test("uses a stable identifier as the final deterministic ranking key", () => {
    const input = {
      actor,
      facts: operational({
        primaryGoal: null,
        nextMeeting: null,
        projects: [],
        tensions: ["z", "a", "m"].map((id) => ({
          id,
          title: `张力 ${id}`,
          updatedAt: "2026-07-16T12:00:00.000Z",
          applicationUrl: `/app/tensions/${id}`,
        })),
      }),
      goalContext: null,
      privateBrief: emptyBrief,
      available: { operational: true, goals: true, privateBrief: true },
    } as const;
    const first = buildOrganizationBrainHomeProjection(input, now);
    const second = buildOrganizationBrainHomeProjection(input, now);
    assert.deepEqual(first, second);
    if (first.status === "READY") {
      assert.deepEqual(first.focusItems.map((item) => item.id), ["tension:a", "tension:m", "tension:z"]);
    }
  });

  test("exposes current primary Goal, next meeting, and actor-owned active Projects as healthy state", () => {
    const projection = buildOrganizationBrainHomeProjection({
      actor,
      facts: operational(),
      goalContext: goalContext(),
      privateBrief: emptyBrief,
      available: { operational: true, goals: true, privateBrief: true },
    }, now);
    assert.equal(projection.status, "READY");
    if (projection.status !== "READY") return;
    assert.deepEqual(projection.healthyState.goal, {
      id: "goal-a",
      title: "交付可用版本",
      applicationUrl: "/app/goals?goal=goal-a",
    });
    assert.equal(projection.healthyState.nextMeeting?.id, "meeting-a");
    assert.deepEqual(projection.healthyState.activeProjects.map((project) => project.id), ["project-a"]);
  });

  test("keeps confirmed facts with explicit stale and dynamic-source-unavailable labels", () => {
    const projection = buildOrganizationBrainHomeProjection({
      actor,
      facts: operational({
        nextMeeting: null,
        projects: [],
        tensions: [{
          id: "tension-old",
          title: "旧张力",
          updatedAt: "2026-06-01T12:00:00.000Z",
          applicationUrl: "/app/tensions/tension-old",
        }],
      }),
      goalContext: null,
      privateBrief: null,
      available: { operational: true, goals: false, privateBrief: false },
    }, now);
    assert.equal(projection.status, "READY");
    if (projection.status !== "READY") return;
    assert.equal(projection.freshnessStatus, "LIMITED");
    assert.match(projection.freshnessLabel, /动态来源暂时不可用|更新时间可能不完整/);
    assert.equal(projection.focusItems[0].evidence.freshness, "STALE");
    assert.match(projection.focusItems[0].evidence.freshnessLabel, /超过 7 天/);
  });

  test("treats a confirmed missing active Goal cycle as healthy absence, not a source outage", async () => {
    const projection = await loadOrganizationBrainHomeReadModel({
      resolveActor: async () => actor,
      loadOperationalFacts: async () => operational({ primaryGoal: null }),
      loadGoalContext: async () => ({
        status: "NOT_AVAILABLE",
        reason: "ACTIVE_CYCLE_NOT_FOUND",
        allGoalsUrl: "/app/goals",
      }),
      loadPrivateBrief: async () => emptyBrief,
      now: () => now,
    });

    assert.equal(projection.status, "READY");
    if (projection.status !== "READY") return;
    assert.equal(projection.freshnessStatus, "CURRENT");
    assert.equal(projection.healthyState.goal, null);
  });

  test("model-off and failed wording enrichment preserve deterministic fallback and ranking", async () => {
    const dependencies = {
      resolveActor: async () => actor,
      loadOperationalFacts: async () => operational({ nextMeeting: null }),
      loadGoalContext: async () => goalContext("AT_RISK"),
      loadPrivateBrief: async () => emptyBrief,
      now: () => now,
    };
    const modelOff = await loadOrganizationBrainHomeReadModel(dependencies);
    const modelFailed = await loadOrganizationBrainHomeReadModel({
      ...dependencies,
      enrichWording: async () => { throw new Error("provider unavailable"); },
    });
    assert.deepEqual(modelFailed, modelOff);
    assert.equal(modelOff.status, "READY");
    if (modelOff.status === "READY") assert.match(modelOff.focusItems[0].summary, /主目标/);
  });

  test("wording enrichment cannot change ids, ranking, evidence, actions, or internal navigation paths", async () => {
    const dependencies = {
      resolveActor: async () => actor,
      loadOperationalFacts: async () => operational({
        nextMeeting: null,
        actions: [{
          id: "action-a",
          title: "完成验证",
          updatedAt: "2026-07-17T08:00:00.000Z",
          deadline: null,
          applicationUrl: "https://outside.example/action-a",
        }],
      }),
      loadGoalContext: async () => goalContext(),
      loadPrivateBrief: async () => emptyBrief,
      now: () => now,
    };
    const baseline = await loadOrganizationBrainHomeReadModel(dependencies);
    const enriched = await loadOrganizationBrainHomeReadModel({
      ...dependencies,
      enrichWording: async (items) => Object.fromEntries(items.map((item) => [item.id, {
        summary: "改写后的摘要",
        relevance: "改写后的相关性",
        id: "forged-id",
        evidence: { applicationUrl: "https://outside.example/evidence" },
        action: { applicationUrl: "https://outside.example/action" },
      }])) as never,
    });
    assert.equal(baseline.status, "READY");
    assert.equal(enriched.status, "READY");
    if (baseline.status !== "READY" || enriched.status !== "READY") return;
    assert.deepEqual(enriched.focusItems.map((item) => item.id), baseline.focusItems.map((item) => item.id));
    assert.deepEqual(enriched.focusItems.map((item) => item.change), baseline.focusItems.map((item) => item.change));
    assert.deepEqual(enriched.focusItems.map((item) => item.evidence), baseline.focusItems.map((item) => item.evidence));
    assert.deepEqual(enriched.focusItems.map((item) => item.action), baseline.focusItems.map((item) => item.action));
    assert.equal(enriched.focusItems[0].summary, "改写后的摘要");
    for (const item of enriched.focusItems) {
      assert.match(item.evidence.applicationUrl, /^\/app(?:[/?#]|$)/);
      assert.match(item.action.applicationUrl, /^\/app(?:[/?#]|$)/);
    }
  });

  test("Prisma loader verifies actor existence and tenant before any organization read", async () => {
    const calls: unknown[] = [];
    const loader = createPrismaBrainHomeOperationalFactLoader({
      person: {
        findFirst: async (args: unknown) => {
          calls.push(args);
          return null;
        },
      },
    } as never);
    assert.equal(await loader(actor, now), null);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], {
      where: { id: "person-a", organizationId: "org-a" },
      select: { id: true },
    });
  });

  test("every production operational query remains scoped to the actor tenant and person", async () => {
    const calls: Array<{ model: string; args: Record<string, unknown> }> = [];
    const read = (model: string, value: unknown) => async (args: Record<string, unknown>) => {
      calls.push({ model, args });
      return value;
    };
    const loader = createPrismaBrainHomeOperationalFactLoader({
      person: { findFirst: read("person", { id: "person-a" }) },
      goal: { findFirst: read("goal", null) },
      meeting: { findFirst: read("meeting", null) },
      brainConversation: { findMany: read("brainConversation", []) },
      project: { findMany: read("project", []) },
      tension: { findMany: read("tension", []) },
    } as never);
    const facts = await loader(actor, now);

    assert.notEqual(facts, null);
    assert.equal(calls.length, 7);
    for (const call of calls) {
      assert.match(JSON.stringify(call.args.where), /"organizationId":"org-a"/);
      assert.doesNotMatch(JSON.stringify(call.args.where), /org-b|person-b/);
    }
    assert.match(JSON.stringify(calls.find((call) => call.model === "brainConversation")?.args.where), /"ownerId":"person-a"/);
    const projectWhere = JSON.stringify(calls.find((call) => call.model === "project")?.args.where);
    assert.match(projectWhere, /"bearerId":"person-a"/);
    assert.match(projectWhere, /"tacticalOutcomeProposal":\{"status":"APPROVED","kind":"PROJECT"\}/);
    const tensionWhere = calls
      .filter((call) => call.model === "tension")
      .map((call) => JSON.stringify(call.args.where));
    assert.equal(tensionWhere.some((where) => where.includes('"roleId":{"in":["role-a"]}')), true);
    const meetingWhere = calls.find((call) => call.model === "meeting")?.args.where;
    assert.deepEqual(meetingWhere, {
      organizationId: "org-a",
      endedAt: null,
      startedAt: { gt: now },
      participants: { some: { id: "person-a", organizationId: "org-a" } },
    });
    const roleTensionProjection = buildOrganizationBrainHomeProjection({
      actor,
      facts: operational({
        primaryGoal: null,
        nextMeeting: null,
        projects: [],
        tensions: [{
          id: "role-tension",
          title: "角色张力",
          updatedAt: now.toISOString(),
          applicationUrl: "/app/tensions/role-tension",
        }],
      }),
      goalContext: null,
      privateBrief: emptyBrief,
      available: { operational: true, goals: true, privateBrief: true },
    }, now);
    assert.equal(roleTensionProjection.status, "READY");
    if (roleTensionProjection.status === "READY") {
      assert.match(roleTensionProjection.focusItems[0].relevance, /角色承担者/);
    }
  });

  test("unfinished Brain work is current-tenant, current-owner, and latest-message USER only", async () => {
    const calls: Array<{ model: string; args: Record<string, unknown> }> = [];
    const read = (model: string, value: unknown) => async (args: Record<string, unknown>) => {
      calls.push({ model, args });
      return value;
    };
    const conversations = [
      {
        id: "brain-valid",
        organizationId: "org-a",
        ownerId: "person-a",
        title: "继续验证",
        updatedAt: now,
        messages: [{ role: "USER" }],
      },
      {
        id: "brain-other-owner",
        organizationId: "org-a",
        ownerId: "person-b",
        title: "其他人的对话",
        updatedAt: now,
        messages: [{ role: "USER" }],
      },
      {
        id: "brain-other-tenant",
        organizationId: "org-b",
        ownerId: "person-a",
        title: "其他组织的对话",
        updatedAt: now,
        messages: [{ role: "USER" }],
      },
      {
        id: "brain-complete",
        organizationId: "org-a",
        ownerId: "person-a",
        title: "已有回复",
        updatedAt: now,
        messages: [{ role: "BRAIN" }],
      },
    ];
    const loader = createPrismaBrainHomeOperationalFactLoader({
      person: { findFirst: read("person", { id: "person-a" }) },
      goal: { findFirst: read("goal", null) },
      meeting: { findFirst: read("meeting", null) },
      brainConversation: { findMany: read("brainConversation", conversations) },
      project: { findMany: read("project", []) },
      tension: { findMany: read("tension", []) },
    } as never);
    const facts = await loader(actor, now);

    assert.deepEqual(facts?.unfinishedBrainWork.map((work) => work.id), ["brain-valid"]);
    const brainCall = calls.find((call) => call.model === "brainConversation");
    assert.deepEqual(brainCall?.args.where, {
      organizationId: "org-a",
      ownerId: "person-a",
      updatedAt: { gte: new Date("2026-06-17T12:00:00.000Z") },
    });
    assert.deepEqual(
      (brainCall?.args.select as { messages: { orderBy: unknown; take: number; select: unknown } }).messages,
      {
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 1,
        select: { role: true },
      },
    );
  });
});
