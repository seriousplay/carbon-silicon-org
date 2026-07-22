import type { WorkflowValidationIssue } from "./protocol";

export const WORKFLOW_RESOURCE_LIMITS = {
  roles: 12,
  nodes: 40,
  edges: 80,
  depth: 12,
  entries: 1000,
  stringLength: 16_384,
  arrayLength: 100,
} as const;

export function validateWorkflowResourceBounds(input: unknown): WorkflowValidationIssue[] {
  const issues: WorkflowValidationIssue[] = [];
  if (!isObject(input)) return [{ code: "INVALID_SHAPE", path: "$", message: "Workflow must be an object" }];
  checkNamedCount(input.roles, "$.roles", WORKFLOW_RESOURCE_LIMITS.roles, issues);
  checkNamedCount(input.nodes, "$.nodes", WORKFLOW_RESOURCE_LIMITS.nodes, issues);
  checkNamedCount(input.edges, "$.edges", WORKFLOW_RESOURCE_LIMITS.edges, issues);
  let entries = 0;
  const pending: Array<{ value: unknown; path: string; depth: number }> = [{ value: input, path: "$", depth: 0 }];
  while (pending.length > 0 && issues.length === 0) {
    const current = pending.pop()!;
    if (current.depth > WORKFLOW_RESOURCE_LIMITS.depth) {
      issues.push({ code: "RESOURCE_DEPTH_EXCEEDED", path: current.path, message: `Nesting depth exceeds ${WORKFLOW_RESOURCE_LIMITS.depth}` });
      break;
    }
    if (typeof current.value === "string" && current.value.length > WORKFLOW_RESOURCE_LIMITS.stringLength) {
      issues.push({ code: "RESOURCE_STRING_EXCEEDED", path: current.path, message: `String exceeds ${WORKFLOW_RESOURCE_LIMITS.stringLength} characters` });
      break;
    }
    if (Array.isArray(current.value)) {
      if (current.value.length > WORKFLOW_RESOURCE_LIMITS.arrayLength && !["$.roles", "$.nodes", "$.edges"].includes(current.path)) {
        issues.push({ code: "RESOURCE_ARRAY_EXCEEDED", path: current.path, message: `Array exceeds ${WORKFLOW_RESOURCE_LIMITS.arrayLength} items` });
        break;
      }
      entries += current.value.length;
      current.value.forEach((value, index) => pending.push({ value, path: `${current.path}[${index}]`, depth: current.depth + 1 }));
    } else if (isObject(current.value)) {
      const values = Object.entries(current.value);
      entries += values.length;
      values.forEach(([key, value]) => pending.push({ value, path: `${current.path}.${key}`, depth: current.depth + 1 }));
    }
    if (entries > WORKFLOW_RESOURCE_LIMITS.entries) {
      issues.push({ code: "RESOURCE_ENTRIES_EXCEEDED", path: "$", message: `Total collection entries exceed ${WORKFLOW_RESOURCE_LIMITS.entries}` });
    }
  }
  return issues;
}

function checkNamedCount(value: unknown, path: string, limit: number, issues: WorkflowValidationIssue[]): void {
  if (Array.isArray(value) && value.length > limit) issues.push({ code: "RESOURCE_COUNT_EXCEEDED", path, message: `${path.slice(2)} exceeds ${limit} items` });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
