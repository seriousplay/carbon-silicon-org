import type { WorkflowDefinition, WorkflowValidationIssue } from "./protocol";

export type EditorLayout = Record<string, { x: number; y: number }>;

export type WorkbenchListItemDto = {
  id: string;
  interfaceId: string;
  interfaceName: string;
  draftRevision: number;
  activeVersion: number | null;
  updatedAt: string;
};

export type WorkbenchVersionDto = {
  id: string;
  version: number;
  parentVersionId: string | null;
  sourceHash: string;
  publishedAt: string;
  source: WorkflowDefinition;
  editorLayout: EditorLayout;
};

export type WorkbenchEditorDto = {
  id: string;
  interfaceId: string;
  interfaceName: string;
  draft: WorkflowDefinition;
  draftLayout: EditorLayout;
  draftHash: string;
  draftRevision: number;
  activeVersionId: string | null;
  versions: WorkbenchVersionDto[];
};

export type ValidationDto =
  | { ok: true; sourceHash: string; compiledHash: string }
  | { ok: false; issues: WorkflowValidationIssue[] };

export type WorkbenchActionError = "FORBIDDEN" | "NOT_FOUND" | "INVALID_INPUT";
