type JsonObject = Record<string, unknown>;

export type StructuralDiff = {
  kind: "ADDED" | "REMOVED" | "CHANGED";
  path: string;
  before?: unknown;
  after?: unknown;
};

export function structuralDiff(before: unknown, after: unknown): StructuralDiff[] {
  const changes: StructuralDiff[] = [];
  walk(before, after, "$", changes);
  return changes.sort((a, b) => compare(a.path, b.path) || compare(a.kind, b.kind));
}

export function compareVersionSnapshots(
  beforeId: string,
  afterId: string,
  versions: Array<{ id: string; sourceSnapshot: unknown }>,
): { ok: true; changes: StructuralDiff[] } | { ok: false; error: "NOT_FOUND" } {
  const expectedCount = new Set([beforeId, afterId]).size;
  if (versions.length !== expectedCount) return { ok: false, error: "NOT_FOUND" };
  if (beforeId === afterId) return { ok: true, changes: [] };
  const before = versions.find((version) => version.id === beforeId);
  const after = versions.find((version) => version.id === afterId);
  if (!before || !after) return { ok: false, error: "NOT_FOUND" };
  return { ok: true, changes: structuralDiff(before.sourceSnapshot, after.sourceSnapshot) };
}

function walk(before: unknown, after: unknown, path: string, changes: StructuralDiff[]): void {
  if (Object.is(before, after)) return;
  if (isStableIdArray(before) && isStableIdArray(after)) {
    const left = new Map(before.map((value) => [value.id, value]));
    const right = new Map(after.map((value) => [value.id, value]));
    for (const id of [...new Set([...left.keys(), ...right.keys()])].sort(compare)) {
      walk(left.get(id), right.get(id), `${path}[id=${JSON.stringify(id)}]`, changes);
    }
    return;
  }
  if (isObject(before) && isObject(after)) {
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(compare)) {
      walk(before[key], after[key], `${path}.${key}`, changes);
    }
    return;
  }
  if (before === undefined) changes.push({ kind: "ADDED", path, after });
  else if (after === undefined) changes.push({ kind: "REMOVED", path, before });
  else changes.push({ kind: "CHANGED", path, before, after });
}

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStableIdArray(value: unknown): value is Array<JsonObject & { id: string }> {
  return Array.isArray(value) && value.every((item) => isObject(item) && typeof item.id === "string");
}

function compare(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
