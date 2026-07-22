import { type PrismaClient } from "@/generated/prisma/client";
import type { BrainCommandSourceBinding } from "./command-registry";
import type {
  BrainGoalCommandActor,
  BrainGoalCommandSourceValidator,
} from "./goal-command-handler";

export function createPrismaBrainCommandSourceValidator(
  client: PrismaClient,
): BrainGoalCommandSourceValidator {
  return {
    validate: async ({ actor, sourceBindings }) => {
      for (const binding of sourceBindings) {
        const ok = await validateBinding(client, actor, binding);
        if (!ok) return { ok: false, code: "STALE_PREVIEW" };
      }
      return { ok: true };
    },
  };
}

async function validateBinding(
  client: PrismaClient,
  actor: BrainGoalCommandActor,
  binding: BrainCommandSourceBinding,
): Promise<boolean> {
  switch (binding.objectType) {
    case "goal_cycle": {
      const row = await client.goalCycle.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { status: true, updatedAt: true },
      });
      return row ? matchesVersion(binding, row) : false;
    }
    case "goal": {
      const row = await client.goal.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { status: true, createdAt: true },
      });
      return row ? matchesVersion(binding, row) : false;
    }
    case "goal_proposal": {
      const row = await client.goalProposal.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { status: true, currentRevision: true, updatedAt: true },
      });
      return row ? matchesVersion(binding, { ...row, revision: row.currentRevision }) : false;
    }
    case "goal_target": {
      const row = await client.goalTarget.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { createdAt: true },
      });
      return row ? matchesVersion(binding, row) : false;
    }
    case "goal_check_in": {
      const row = await client.goalCheckIn.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { recordedAt: true },
      });
      return row ? matchesVersion(binding, row) : false;
    }
    case "circle": {
      const row = await client.circle.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { status: true, updatedAt: true },
      });
      return row ? matchesVersion(binding, row) : false;
    }
    case "role": {
      const row = await client.roleDef.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { status: true, updatedAt: true },
      });
      return row ? matchesVersion(binding, row) : false;
    }
    case "metric": {
      const row = await client.metric.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { status: true, updatedAt: true },
      });
      return row ? matchesVersion(binding, row) : false;
    }
    case "meeting": {
      const row = await client.meeting.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { notesRevision: true, endedAt: true, createdAt: true },
      });
      return row ? matchesVersion(binding, row) : false;
    }
    case "tension": {
      const row = await client.tension.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { status: true, handlingMode: true, updatedAt: true },
      });
      return row ? matchesVersion(binding, row) : false;
    }
    case "governance_proposal": {
      const row = await client.governanceProposal.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { status: true, createdAt: true },
      });
      return row ? matchesVersion(binding, row) : false;
    }
    case "project": {
      const row = await client.project.findFirst({
        where: { id: binding.objectId, organizationId: actor.organizationId },
        select: { status: true, updatedAt: true },
      });
      return row ? matchesVersion(binding, row) : false;
    }
  }
}

function matchesVersion(
  binding: BrainCommandSourceBinding,
  row: Readonly<Record<string, unknown>>,
): boolean {
  if (binding.status !== undefined && row.status !== binding.status) return false;
  if (binding.route !== undefined && row.handlingMode !== binding.route) return false;
  if (binding.revision !== undefined && row.revision !== undefined && row.revision !== binding.revision) {
    return false;
  }
  if (binding.sourceVersionAt === "active:true") {
    if (typeof row.status !== "string") return true;
    return row.status !== "ARCHIVED" && row.status !== "PAUSED";
  }
  if (binding.sourceVersionAt === "ended:false") return row.endedAt === null;
  if (binding.sourceVersionAt.startsWith("status:")) {
    return row.status === binding.sourceVersionAt.slice("status:".length);
  }
  if (binding.sourceVersionAt.startsWith("notesRevision:")) {
    const revision = Number.parseInt(binding.sourceVersionAt.slice("notesRevision:".length), 10);
    return Number.isInteger(revision) && row.notesRevision === revision;
  }
  if (binding.sourceVersionAt.startsWith("revision:")) {
    if (row.revision === undefined) return true;
    const revision = Number.parseInt(binding.sourceVersionAt.slice("revision:".length), 10);
    return Number.isInteger(revision) && row.revision === revision;
  }
  for (const key of ["updatedAt", "createdAt", "recordedAt"] as const) {
    const value = row[key];
    if (value instanceof Date && value.toISOString() === binding.sourceVersionAt) return true;
  }
  return false;
}
