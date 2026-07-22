import { compileWorkflow, hashCanonical } from "./compiler";
import type { EditorLayout, ValidationDto, WorkbenchActionError } from "./dto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getCurrentPerson } from "@/lib/session";
import { validateWorkflowResourceBounds } from "./bounds";

const MAX_DEFINITION_BYTES = 256 * 1024;
const MAX_LAYOUT_BYTES = 128 * 1024;

export type AdminContext = { userId: string; organizationId: string; personId: string };
export type GuardResult = { ok: true; context: AdminContext } | { ok: false; error: WorkbenchActionError };

export async function authorizeOrgAdmin(
  userId: string | null | undefined,
  organizationId: string,
  lookup: (userId: string, organizationId: string) => Promise<{ role: string; personId: string | null } | null>,
): Promise<GuardResult> {
  if (!userId) return { ok: false, error: "FORBIDDEN" };
  const membership = await lookup(userId, organizationId);
  if (!membership || membership.role !== "ORG_ADMIN" || !membership.personId) {
    return { ok: false, error: "FORBIDDEN" };
  }
  return { ok: true, context: { userId, organizationId, personId: membership.personId } };
}

export async function authorizeCurrentPersonAdmin(
  userId: string | null | undefined,
  person: { id: string; organizationId: string } | null,
  lookup: (userId: string, organizationId: string) => Promise<{ role: string } | null>,
): Promise<GuardResult> {
  if (!userId || !person) return { ok: false, error: "FORBIDDEN" };
  return authorizeOrgAdmin(userId, person.organizationId, async (exactUserId, exactOrganizationId) => {
    const membership = await lookup(exactUserId, exactOrganizationId);
    return membership ? { role: membership.role, personId: person.id } : null;
  });
}

export async function requireOrgAdmin(): Promise<GuardResult> {
  const session = await auth();
  if (!session?.user?.id) return { ok: false, error: "FORBIDDEN" };
  const person = await getCurrentPerson();
  return authorizeCurrentPersonAdmin(session.user.id, person, async (userId, organizationId) => {
    return prisma.membership.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { role: true },
    });
  });
}

export function validateDraftInput(definition: unknown): ValidationDto {
  if (!withinBound(definition, MAX_DEFINITION_BYTES)) return { ok: false, issues: [{ code: "INPUT_TOO_LARGE", path: "$", message: "Definition exceeds 256 KiB" }] };
  const result = compileWorkflow(definition);
  return result.ok
    ? { ok: true, sourceHash: result.sourceHash, compiledHash: result.compiledHash }
    : { ok: false, issues: result.issues };
}

export type SaveDraftResult =
  | { ok: true; revision: number; hash: string }
  | { ok: false; error: "INVALID_INPUT"; validation?: ValidationDto }
  | { ok: false; error: "NOT_FOUND" }
  | { ok: false; error: "STALE_DRAFT"; currentRevision: number; currentHash: string };

export async function saveDraftCas(input: {
  definition: unknown;
  layout: EditorLayout;
  expectedRevision: number;
  expectedHash: string;
  readCurrent: () => Promise<{ revision: number; hash: string } | null>;
  updateIfCurrent: (values: { definition: unknown; layout: EditorLayout; hash: string; expectedRevision: number; expectedHash: string }) => Promise<boolean>;
}): Promise<SaveDraftResult> {
  if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 0 || !/^[a-f0-9]{64}$/.test(input.expectedHash) || !validLayout(input.layout) || !withinBound(input.layout, MAX_LAYOUT_BYTES)) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  if (!validJsonObject(input.definition) || !withinBound(input.definition, MAX_DEFINITION_BYTES) || validateWorkflowResourceBounds(input.definition).length > 0) {
    return { ok: false, error: "INVALID_INPUT" };
  }
  const hash = hashCanonical(input.definition);
  if (await input.updateIfCurrent({ definition: input.definition, layout: input.layout, hash, expectedRevision: input.expectedRevision, expectedHash: input.expectedHash })) {
    return { ok: true, revision: input.expectedRevision + 1, hash };
  }
  const current = await input.readCurrent();
  return current
    ? { ok: false, error: "STALE_DRAFT", currentRevision: current.revision, currentHash: current.hash }
    : { ok: false, error: "NOT_FOUND" };
}

export function minimalDefinition(name: string) {
  return {
    protocolVersion: 1,
    definitionSchemaVersion: 1,
    name,
    entryNodeId: "start",
    roles: [{ id: "operator", capabilities: ["collect_evidence"] }],
    nodes: [
      { id: "start", type: "structured_evidence_input", config: { fields: ["summary"], roleId: "operator" } },
      { id: "complete", type: "complete", config: { outcome: "complete" } },
    ],
    edges: [{ id: "start-to-complete", from: "start", to: "complete" }],
  } as const;
}

function withinBound(value: unknown, bytes: number): boolean {
  try { return Buffer.byteLength(JSON.stringify(value), "utf8") <= bytes; } catch { return false; }
}

function validLayout(value: unknown): value is EditorLayout {
  return typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every((position) =>
    typeof position === "object" && position !== null && !Array.isArray(position)
      && Object.keys(position).every((key) => key === "x" || key === "y")
      && typeof (position as { x?: unknown }).x === "number" && Number.isFinite((position as { x: number }).x)
      && typeof (position as { y?: unknown }).y === "number" && Number.isFinite((position as { y: number }).y));
}

function validJsonObject(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  try {
    const serialized = JSON.stringify(value);
    return serialized !== undefined && JSON.parse(serialized) !== null;
  } catch {
    return false;
  }
}
