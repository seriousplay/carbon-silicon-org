import { compileWorkflow, hashCanonical } from "./compiler";
import { WORKFLOW_COMPILER_VERSION, WORKFLOW_DEFINITION_SCHEMA_VERSION } from "./protocol";
import type { EditorLayout } from "./dto";

export type LockedWorkbench = { id: string; draft: unknown; draftLayout: EditorLayout; draftRevision: number; draftHash: string; activeVersionId: string | null };
export type PublishedVersion = { id: string; version: number; sourceHash: string };
export type PreparedPublication = {
  draftHash: string;
  sourceHash: string;
  compiledHash: string;
  sourceSnapshot: unknown;
  compiledSnapshot: unknown;
};

export type PublishResult =
  | { ok: true; versionId: string; version: number }
  | { ok: false; error: "NOT_FOUND" | "STALE_DRAFT" | "VALIDATION_FAILED" | "DUPLICATE_SOURCE"; issues?: unknown[]; versionId?: string; version?: number };

export function preparePublication(definition: unknown):
  | { ok: true; prepared: PreparedPublication }
  | { ok: false; error: "VALIDATION_FAILED"; issues: unknown[] } {
  const compiled = compileWorkflow(definition);
  if (!compiled.ok) return { ok: false, error: "VALIDATION_FAILED", issues: compiled.issues };
  return { ok: true, prepared: {
    draftHash: hashCanonical(definition),
    sourceHash: compiled.sourceHash,
    compiledHash: compiled.compiledHash,
    sourceSnapshot: compiled.snapshot,
    compiledSnapshot: compiled.compiled,
  } };
}

export async function prepareThenPublish(
  definition: unknown,
  publishPrepared: (prepared: PreparedPublication) => Promise<PublishResult>,
): Promise<PublishResult> {
  const result = preparePublication(definition);
  return result.ok ? publishPrepared(result.prepared) : result;
}

export async function publishDraft(input: {
  expectedRevision: number;
  expectedHash: string;
  publisherId: string;
  prepared: PreparedPublication;
  lockWorkbench: () => Promise<LockedWorkbench | null>;
  latestVersion: () => Promise<PublishedVersion | null>;
  findBySourceHash: (hash: string) => Promise<PublishedVersion | null>;
  createVersion: (data: Record<string, unknown>) => Promise<{ id: string }>;
  setActiveVersion: (versionId: string) => Promise<void>;
}): Promise<PublishResult> {
  const workbench = await input.lockWorkbench();
  if (!workbench) return { ok: false, error: "NOT_FOUND" };
  if (workbench.draftRevision !== input.expectedRevision || workbench.draftHash !== input.expectedHash || workbench.draftHash !== input.prepared.draftHash) return { ok: false, error: "STALE_DRAFT" };
  const duplicate = await input.findBySourceHash(input.prepared.sourceHash);
  if (duplicate) return { ok: false, error: "DUPLICATE_SOURCE", versionId: duplicate.id, version: duplicate.version };
  const latest = await input.latestVersion();
  const version = (latest?.version ?? 0) + 1;
  const created = await input.createVersion({
    version,
    parentVersionId: workbench.activeVersionId,
    publisherId: input.publisherId,
    sourceSnapshot: input.prepared.sourceSnapshot,
    compiledSnapshot: input.prepared.compiledSnapshot,
    editorLayout: workbench.draftLayout,
    validationResult: { ok: true, issues: [] },
    sourceHash: input.prepared.sourceHash,
    compiledHash: input.prepared.compiledHash,
    definitionSchemaVersion: WORKFLOW_DEFINITION_SCHEMA_VERSION,
    compilerVersion: WORKFLOW_COMPILER_VERSION,
  });
  await input.setActiveVersion(created.id);
  return { ok: true, versionId: created.id, version };
}
