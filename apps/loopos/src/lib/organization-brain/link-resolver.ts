import { withBasePath } from "../base-path";
import {
  BRAIN_QUERY_CATALOG,
  type BrainQueryResource,
} from "./query-plan";

type EvidenceRow = Readonly<Record<string, unknown>>;

function identifier(row: EvidenceRow, field: string): string | null {
  const value = row[field];
  return typeof value === "string" &&
    value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= 191
    ? value
    : null;
}

function recordPath(prefix: `/${string}`, id: string): string {
  return withBasePath(`${prefix}${encodeURIComponent(id)}` as `/${string}`);
}

function goalPath(cycleId: string, goalId: string): string {
  return withBasePath(
    `/app/goals?cycle=${encodeURIComponent(cycleId)}&goal=${encodeURIComponent(goalId)}`,
  );
}

export function resolveBrainApplicationUrl(
  resource: BrainQueryResource,
  row: EvidenceRow,
): string | null {
  const rule = BRAIN_QUERY_CATALOG[resource].linkRule;
  if (rule === "none") return null;
  if (rule === "actor-home") return withBasePath("/app/me");
  if (rule === "organization-home") return withBasePath("/app/circles/map");

  if (rule === "role-definition") {
    const id =
      identifier(row, "roleDefinitionId") ?? identifier(row, "id");
    return id ? recordPath("/app/roles/", id) : null;
  }
  if (rule === "circle") {
    const id = identifier(row, "id");
    return id ? recordPath("/app/circles/", id) : null;
  }
  if (rule === "project") {
    const id = identifier(row, "id");
    return id ? recordPath("/app/projects/", id) : null;
  }
  if (rule === "action") {
    const id = identifier(row, "id");
    return id ? recordPath("/app/tracker/", id) : null;
  }
  if (rule === "tension") {
    const id = identifier(row, "id");
    return id ? recordPath("/app/tensions/", id) : null;
  }
  if (rule === "meeting") {
    const id = identifier(row, "id");
    return id ? recordPath("/app/meetings/", id) : null;
  }
  if (rule === "tactical-meeting") {
    const id = identifier(row, "meetingId");
    return id ? recordPath("/app/meetings/", id) : null;
  }
  if (rule === "governance-decision") {
    const id = identifier(row, "decisionId");
    return id
      ? withBasePath(
          `/app/governance#${encodeURIComponent(`decision-${id}`)}`,
        )
      : null;
  }
  if (rule === "goal-cycle") {
    const cycleId = identifier(row, "id");
    return cycleId ? goalPath(cycleId, "") : null;
  }
  if (rule === "goal") {
    const cycleId = identifier(row, "cycleId");
    const goalId = identifier(row, "goalId") ?? identifier(row, "id");
    return cycleId && goalId ? goalPath(cycleId, goalId) : null;
  }
  if (rule === "goal-work-link") {
    if (row.kind === "PROJECT") {
      const projectId = identifier(row, "projectId");
      return projectId ? recordPath("/app/projects/", projectId) : null;
    }
    if (row.kind === "ACTION") {
      const actionId = identifier(row, "tensionId");
      return actionId ? recordPath("/app/tracker/", actionId) : null;
    }
    if (row.kind === "BLOCKING_TENSION") {
      const tensionId = identifier(row, "tensionId");
      return tensionId ? recordPath("/app/tensions/", tensionId) : null;
    }
    return null;
  }

  return null;
}
