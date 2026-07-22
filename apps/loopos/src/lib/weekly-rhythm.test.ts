import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaClient } from "@/generated/prisma/client";
import { getWeeklyRhythm } from "./weekly-rhythm";

test("weekly rhythm returns only exact executable targets for the current person", async () => {
  const calls: Record<string, unknown> = {};
  const date = new Date("2026-07-10T00:00:00.000Z");
  const client = {
    meeting: {
      findMany: async (args: unknown) => {
        calls.meetings = args;
        return [{ id: "meeting-1", title: "每周战术会", type: "TACTICAL", startedAt: date }];
      },
    },
    tension: {
      findMany: async (args: { where: { handlingMode?: string } }) => {
        if (args.where.handlingMode === "UNROUTED") {
          calls.unrouted = args;
          return [{ id: "tension-1", title: "需要路由", updatedAt: date }];
        }
        calls.actions = args;
        return [{ id: "action-1", title: "交付样本", status: "IN_PROGRESS", deadline: null, updatedAt: date }];
      },
    },
    tacticalOutcomeProposal: {
      findMany: async (args: unknown) => {
        calls.tactical = args;
        return [{ id: "proposal-1", status: "RETURNED", updatedAt: date, sourceTension: { title: "补充验收标准" }, meeting: { id: "meeting-2", title: "产品战术会" } }];
      },
    },
    governanceDecisionProcess: {
      findMany: async (args: unknown) => {
        calls.governance = args;
        return [{ id: "process-1", state: "CLARIFICATION_REQUIRED", updatedAt: date, sourceTension: { title: "明确角色边界" }, meeting: { id: "meeting-3", title: "治理会" } }];
      },
    },
    project: {
      findMany: async (args: unknown) => {
        calls.projects = args;
        return [{ id: "project-1", name: "训练集更新", status: "ACTIVE", updatedAt: date }];
      },
    },
  } as unknown as Pick<PrismaClient, "meeting" | "tension" | "tacticalOutcomeProposal" | "governanceDecisionProcess" | "project">;

  const items = await getWeeklyRhythm("org-1", "person-1", client);

  assert.deepEqual(items.map((item) => item.href), [
    "/app/meetings/meeting-1",
    "/app/tensions/tension-1",
    "/app/meetings/meeting-2",
    "/app/meetings/meeting-3",
    "/app/tracker/action-1",
    "/app/projects/project-1",
  ]);
  assert.deepEqual((calls.meetings as { where: unknown }).where, {
    organizationId: "org-1",
    endedAt: null,
    participants: { some: { id: "person-1" } },
  });
  assert.deepEqual((calls.unrouted as { where: unknown }).where, {
    organizationId: "org-1",
    raiserId: "person-1",
    status: "OPEN",
    handlingMode: "UNROUTED",
  });
  assert.deepEqual((calls.actions as { where: unknown }).where, {
    organizationId: "org-1",
    ownerId: "person-1",
    status: { in: ["ASSIGNED", "IN_PROGRESS", "BLOCKED", "ESCALATED_L0_5", "ESCALATED_L2", "ESCALATED_L3", "ESCALATED_L4"] },
    tacticalOutcomeActionProposal: { is: { status: "APPROVED", kind: "ACTION" } },
  });
  assert.deepEqual((calls.projects as { where: unknown }).where, {
    organizationId: "org-1",
    bearerId: "person-1",
    status: { not: "COMPLETED" },
  });
});

test("weekly rhythm prioritizes overdue and blocked Actions and remains compact", async () => {
  const date = new Date("2026-07-10T00:00:00.000Z");
  const client = {
    meeting: { findMany: async () => [] },
    tacticalOutcomeProposal: { findMany: async () => [] },
    governanceDecisionProcess: { findMany: async () => [] },
    project: { findMany: async () => Array.from({ length: 8 }, (_, index) => ({ id: `project-${index}`, name: `Project ${index}`, status: "ACTIVE", updatedAt: date })) },
    tension: {
      findMany: async (args: { where: { handlingMode?: string } }) => args.where.handlingMode === "UNROUTED"
        ? []
        : [
            { id: "normal", title: "Normal", status: "ASSIGNED", deadline: null, updatedAt: date },
            { id: "blocked", title: "Blocked", status: "BLOCKED", deadline: null, updatedAt: date },
            { id: "overdue", title: "Overdue", status: "IN_PROGRESS", deadline: new Date("2020-01-01T00:00:00.000Z"), updatedAt: date },
          ],
    },
  } as unknown as Pick<PrismaClient, "meeting" | "tension" | "tacticalOutcomeProposal" | "governanceDecisionProcess" | "project">;

  const items = await getWeeklyRhythm("org-1", "person-1", client);

  assert.equal(items.length, 8);
  assert.deepEqual(items.slice(0, 3).map((item) => item.id), ["action:overdue", "action:blocked", "action:normal"]);
});
