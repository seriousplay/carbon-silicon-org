import { AsyncLocalStorage } from "node:async_hooks";
import type { AdvanceWorkflowRunInput, AdvanceWorkflowRunResult } from "@/lib/interface-workbench/runtime-types";

const actionTestDependencies = new AsyncLocalStorage<unknown>();

export function currentInterfaceRunActionDependencies<T>(production: T): T {
  return (actionTestDependencies.getStore() as T | undefined) ?? production;
}

export function withInterfaceRunActionTestDependencies<TDependencies, TResult>(
  dependencies: TDependencies,
  work: () => Promise<TResult>,
): Promise<TResult> {
  return actionTestDependencies.run(dependencies, work);
}

type RouteCommand = {
  nodeId: string;
  nodeVisit: number;
  kind: string;
  status: string;
  clientIdempotencyKey: string;
};

export function persistedGovernanceRouteCommandKey(input: {
  nodeType: string | null;
  currentNodeId: string;
  currentNodeVisit: number;
  commands: RouteCommand[];
}): string | null {
  if (input.nodeType !== "route_governance_meeting") return null;
  const failed = input.commands.find((command) => command.nodeId === input.currentNodeId
    && command.nodeVisit === input.currentNodeVisit
    && command.kind === "EXECUTE_SIDE_EFFECT"
    && command.status === "FAILED");
  return failed?.clientIdempotencyKey ?? null;
}

export function canAccessGovernanceRouteOnlyPage(input: {
  canViewFullRun: boolean;
  nodeType: string | null;
  eligibleMeetingCount: number;
}): boolean {
  return !input.canViewFullRun && input.nodeType === "route_governance_meeting" && input.eligibleMeetingCount > 0;
}

export async function executeGovernanceRouteActionBoundary(
  input: {
    advanceInput: AdvanceWorkflowRunInput;
    meetingId: string;
    runUrl: string;
  },
  dependencies: {
    authorize(): Promise<void>;
    advance(input: AdvanceWorkflowRunInput): Promise<AdvanceWorkflowRunResult>;
  },
): Promise<string> {
  try {
    await dependencies.authorize();
  } catch {
    return `${input.runUrl}?message=denied`;
  }
  const result = await dependencies.advance(input.advanceInput);
  if (result.ok) return `/app/meetings/${encodeURIComponent(input.meetingId)}`;
  const message = result.error === "REVISION_CONFLICT"
    ? "conflict"
    : result.error === "FORBIDDEN"
      ? "denied"
      : result.error === "COMMAND_IN_PROGRESS"
        ? "in-progress"
        : result.error === "SIDE_EFFECT_FAILED"
          ? "retry"
          : "failed";
  return `${input.runUrl}?message=${message}`;
}
