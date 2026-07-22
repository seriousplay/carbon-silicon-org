"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { requireOrgAdmin, saveDraftCas, validateDraftInput } from "@/lib/interface-workbench/admin";
import { compareVersionSnapshots } from "@/lib/interface-workbench/diff";
import { prepareThenPublish, publishDraft } from "@/lib/interface-workbench/publication";
import type { EditorLayout } from "@/lib/interface-workbench/dto";
import { validateSubmittedDefinition } from "@/lib/interface-workbench/editor-validation";

function parseJson(value: FormDataEntryValue | null): unknown { try { return JSON.parse(String(value ?? "")); } catch { return undefined; } }

export async function saveDraftAction(workbenchId: string, formData: FormData) {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return guard;
  const expectedRevision = Number(formData.get("expectedRevision"));
  const expectedHash = String(formData.get("expectedHash") ?? "");
  const definition = parseJson(formData.get("definition"));
  const layout = parseJson(formData.get("layout")) as EditorLayout;
  const scoped = { id: workbenchId, organizationId: guard.context.organizationId };
  const result = await saveDraftCas({ definition, layout, expectedRevision, expectedHash,
    readCurrent: async () => {
      const row = await prisma.interfaceWorkbench.findFirst({ where: scoped, select: { draftRevision: true, draftHash: true } });
      return row ? { revision: row.draftRevision, hash: row.draftHash } : null;
    },
    updateIfCurrent: async (values) => (await prisma.interfaceWorkbench.updateMany({
      where: { ...scoped, draftRevision: values.expectedRevision, draftHash: values.expectedHash },
      data: { draft: values.definition as Prisma.InputJsonValue, draftLayout: values.layout as Prisma.InputJsonValue, draftHash: values.hash, draftRevision: { increment: 1 } },
    })).count === 1,
  });
  if (result.ok) revalidatePath(`/app/interfaces/workbenches/${workbenchId}`);
  return result;
}

export async function validateDraftAction(workbenchId: string) {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return guard;
  const row = await prisma.interfaceWorkbench.findFirst({ where: { id: workbenchId, organizationId: guard.context.organizationId }, select: { draft: true } });
  return row ? validateDraftInput(row.draft) : { ok: false as const, error: "NOT_FOUND" as const };
}

export async function compareVersionsAction(workbenchId: string, beforeId: string, afterId: string) {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return guard;
  const versions = await prisma.interfaceWorkbenchVersion.findMany({
    where: { organizationId: guard.context.organizationId, workbenchId, id: { in: [beforeId, afterId] } },
    select: { id: true, sourceSnapshot: true },
  });
  return compareVersionSnapshots(beforeId, afterId, versions);
}

export async function publishDraftAction(workbenchId: string, formData: FormData) {
  const guard = await requireOrgAdmin();
  if (!guard.ok) return guard;
  const orgId = guard.context.organizationId;
  const draft = await prisma.interfaceWorkbench.findFirst({ where: { id: workbenchId, organizationId: orgId }, select: { draft: true } });
  if (!draft) return { ok: false as const, error: "NOT_FOUND" as const };
  const result = await prepareThenPublish(draft.draft, (prepared) => prisma.$transaction(async (tx) => publishDraft({
      prepared, expectedRevision: Number(formData.get("expectedRevision")), expectedHash: String(formData.get("expectedHash") ?? ""), publisherId: guard.context.personId,
      lockWorkbench: async () => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "interface_workbenches" WHERE "id" = ${workbenchId} AND "organizationId" = ${orgId} FOR UPDATE`;
        if (!rows[0]) return null;
        const row = await tx.interfaceWorkbench.findFirst({ where: { id: workbenchId, organizationId: orgId }, select: { id: true, draft: true, draftLayout: true, draftRevision: true, draftHash: true, activeVersionId: true } });
        return row as Awaited<ReturnType<Parameters<typeof publishDraft>[0]["lockWorkbench"]>>;
      },
      latestVersion: () => tx.interfaceWorkbenchVersion.findFirst({ where: { workbenchId, organizationId: orgId }, orderBy: { version: "desc" }, select: { id: true, version: true, sourceHash: true } }),
      findBySourceHash: (sourceHash) => tx.interfaceWorkbenchVersion.findFirst({ where: { workbenchId, organizationId: orgId, sourceHash }, select: { id: true, version: true, sourceHash: true } }),
      createVersion: (data) => tx.interfaceWorkbenchVersion.create({ data: { ...data, organizationId: orgId, workbenchId } as Prisma.InterfaceWorkbenchVersionUncheckedCreateInput, select: { id: true } }),
      setActiveVersion: async (activeVersionId) => { await tx.interfaceWorkbench.updateMany({ where: { id: workbenchId, organizationId: orgId }, data: { activeVersionId } }); },
    })));
  if (result.ok) revalidatePath(`/app/interfaces/workbenches/${workbenchId}`);
  return result;
}

export type DesignerActionState =
  | { status: "idle" }
  | { status: "saved"; revision: number; hash: string }
  | { status: "published"; version: number }
  | { status: "valid"; sourceHash: string; compiledHash: string }
  | { status: "invalid"; issues: Array<{ code: string; path: string; message: string }> }
  | { status: "duplicate" }
  | { status: "stale"; currentRevision?: number; currentHash?: string }
  | { status: "error"; error: string };

export async function saveDesignerAction(workbenchId: string, _previous: DesignerActionState, formData: FormData): Promise<DesignerActionState> {
  const result = await saveDraftAction(workbenchId, formData);
  if (result.ok) return { status: "saved", revision: result.revision, hash: result.hash };
  if (result.error === "STALE_DRAFT") return { status: "stale", currentRevision: result.currentRevision, currentHash: result.currentHash };
  return { status: "error", error: result.error };
}

export async function validateDesignerAction(workbenchId: string, previous: DesignerActionState, formData: FormData): Promise<DesignerActionState> {
  void previous;
  const guard = await requireOrgAdmin();
  if (!guard.ok) return { status: "error", error: guard.error };
  const exists = await prisma.interfaceWorkbench.findFirst({ where: { id: workbenchId, organizationId: guard.context.organizationId }, select: { id: true } });
  if (!exists) return { status: "error", error: "NOT_FOUND" };
  const result = validateSubmittedDefinition(formData.get("definition"));
  if (result.ok) return { status: "valid", sourceHash: result.sourceHash, compiledHash: result.compiledHash };
  return { status: "invalid", issues: result.issues };
}

export async function publishDesignerAction(workbenchId: string, _previous: DesignerActionState, formData: FormData): Promise<DesignerActionState> {
  const result = await publishDraftAction(workbenchId, formData);
  if (result.ok) return { status: "published", version: result.version };
  if (result.error === "STALE_DRAFT") return { status: "stale" };
  if (result.error === "VALIDATION_FAILED") return { status: "invalid", issues: Array.isArray(result.issues) ? result.issues.filter(isValidationIssue) : [] };
  if (result.error === "DUPLICATE_SOURCE") return { status: "duplicate" };
  return { status: "error", error: result.error };
}

function isValidationIssue(value: unknown): value is { code: string; path: string; message: string } {
  return typeof value === "object" && value !== null
    && typeof (value as { code?: unknown }).code === "string"
    && typeof (value as { path?: unknown }).path === "string"
    && typeof (value as { message?: unknown }).message === "string";
}

export async function saveDraftFormAction(workbenchId: string, formData: FormData): Promise<void> {
  const result = await saveDraftAction(workbenchId, formData);
  redirectWithStatus(workbenchId, result.ok ? "saved" : result.error === "STALE_DRAFT" ? "stale" : result.error === "NOT_FOUND" || result.error === "FORBIDDEN" ? "not-found" : "invalid");
}

export async function validateDraftFormAction(workbenchId: string): Promise<void> {
  const result = await validateDraftAction(workbenchId);
  redirectWithStatus(workbenchId, result.ok ? "validation-ok" : "error" in result && (result.error === "NOT_FOUND" || result.error === "FORBIDDEN") ? "not-found" : "validation-failed");
}

export async function publishDraftFormAction(workbenchId: string, formData: FormData): Promise<void> {
  const result = await publishDraftAction(workbenchId, formData);
  redirectWithStatus(workbenchId, result.ok ? "published" : result.error === "STALE_DRAFT" ? "stale" : result.error === "VALIDATION_FAILED" ? "validation-failed" : result.error === "DUPLICATE_SOURCE" ? "duplicate" : "not-found");
}

function redirectWithStatus(workbenchId: string, status: string): never {
  redirect(`/app/interfaces/workbenches/${workbenchId}?status=${encodeURIComponent(status)}`);
}
