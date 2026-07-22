export const CANDIDATE_TENSION_STATUSES = [
  "DETECTED",
  "CONFIRMED",
  "DISMISSED",
  "MERGED",
  "FALSE_POSITIVE",
] as const;

export const CANDIDATE_TENSION_SOURCE_KINDS = [
  "GOAL",
  "METRIC",
  "PROJECT",
  "ACTION",
  "ROLE",
  "BUSINESS_LOOP",
  "AI_EXECUTION_AUDIT",
  "MEMORY",
  "MEETING",
  "EXTERNAL_SIGNAL",
] as const;

export type CandidateTensionStatus = (typeof CANDIDATE_TENSION_STATUSES)[number];
export type CandidateTensionSourceKind = (typeof CANDIDATE_TENSION_SOURCE_KINDS)[number];
export type CandidateTensionSuggestedMode = "TACTICAL" | "GOVERNANCE";

export type CandidateTensionDraft = Readonly<{
  organizationId: string;
  title: string;
  evidenceSummary: string;
  sourceKind: CandidateTensionSourceKind;
  sourceRef: Record<string, unknown>;
  ownerRoleId: string;
  detectedById: string;
  suggestedMode?: CandidateTensionSuggestedMode | null;
}>;

export type CandidateTensionRecord = CandidateTensionDraft &
  Readonly<{
    id: string;
    status: CandidateTensionStatus;
    confirmedTensionId: string | null;
    confirmedById: string | null;
    terminalReason: string | null;
    mergedIntoId: string | null;
  }>;

export type CandidateTensionIssue =
  | "ORGANIZATION_REQUIRED"
  | "TITLE_REQUIRED"
  | "EVIDENCE_REQUIRED"
  | "OWNER_ROLE_REQUIRED"
  | "DETECTOR_REQUIRED"
  | "UNSUPPORTED_SOURCE_KIND"
  | "UNSUPPORTED_SUGGESTED_MODE"
  | "SOURCE_REF_REQUIRED";

export function isCandidateTensionSourceKind(value: unknown): value is CandidateTensionSourceKind {
  return typeof value === "string" && CANDIDATE_TENSION_SOURCE_KINDS.includes(value as CandidateTensionSourceKind);
}

export function isCandidateTensionStatus(value: unknown): value is CandidateTensionStatus {
  return typeof value === "string" && CANDIDATE_TENSION_STATUSES.includes(value as CandidateTensionStatus);
}

export function validateCandidateTensionDraft(
  draft: Readonly<{
    organizationId?: unknown;
    title?: unknown;
    evidenceSummary?: unknown;
    sourceKind?: unknown;
    sourceRef?: unknown;
    ownerRoleId?: unknown;
    detectedById?: unknown;
    suggestedMode?: unknown;
  }>,
): CandidateTensionIssue[] {
  const issues: CandidateTensionIssue[] = [];
  if (typeof draft.organizationId !== "string" || !draft.organizationId.trim()) issues.push("ORGANIZATION_REQUIRED");
  if (typeof draft.title !== "string" || !draft.title.trim()) issues.push("TITLE_REQUIRED");
  if (typeof draft.evidenceSummary !== "string" || !draft.evidenceSummary.trim()) issues.push("EVIDENCE_REQUIRED");
  if (typeof draft.ownerRoleId !== "string" || !draft.ownerRoleId.trim()) issues.push("OWNER_ROLE_REQUIRED");
  if (typeof draft.detectedById !== "string" || !draft.detectedById.trim()) issues.push("DETECTOR_REQUIRED");
  if (!isCandidateTensionSourceKind(draft.sourceKind)) issues.push("UNSUPPORTED_SOURCE_KIND");
  if (draft.suggestedMode !== undefined && draft.suggestedMode !== null && draft.suggestedMode !== "TACTICAL" && draft.suggestedMode !== "GOVERNANCE") {
    issues.push("UNSUPPORTED_SUGGESTED_MODE");
  }
  if (!draft.sourceRef || typeof draft.sourceRef !== "object" || Array.isArray(draft.sourceRef)) {
    issues.push("SOURCE_REF_REQUIRED");
  }
  return issues;
}

export function createDetectedCandidateTension(
  id: string,
  draft: CandidateTensionDraft,
): CandidateTensionRecord {
  const issues = validateCandidateTensionDraft(draft);
  if (issues.length > 0) throw new Error(issues[0]);
  return Object.freeze({
    ...draft,
    id,
    title: draft.title.trim(),
    evidenceSummary: draft.evidenceSummary.trim(),
    organizationId: draft.organizationId.trim(),
    ownerRoleId: draft.ownerRoleId.trim(),
    detectedById: draft.detectedById.trim(),
    suggestedMode: draft.suggestedMode ?? null,
    status: "DETECTED",
    confirmedTensionId: null,
    confirmedById: null,
    terminalReason: null,
    mergedIntoId: null,
  });
}

export function confirmCandidateTension(
  candidate: CandidateTensionRecord,
  input: Readonly<{ confirmedTensionId: string; confirmedById: string }>,
): CandidateTensionRecord {
  if (candidate.status !== "DETECTED") throw new Error("CANDIDATE_NOT_DETECTED");
  if (!input.confirmedTensionId.trim()) throw new Error("CONFIRMED_TENSION_REQUIRED");
  if (!input.confirmedById.trim()) throw new Error("CONFIRMER_REQUIRED");
  return Object.freeze({
    ...candidate,
    status: "CONFIRMED",
    confirmedTensionId: input.confirmedTensionId.trim(),
    confirmedById: input.confirmedById.trim(),
  });
}

export function dismissCandidateTension(
  candidate: CandidateTensionRecord,
  input: Readonly<{ reason: string; falsePositive?: boolean }>,
): CandidateTensionRecord {
  if (candidate.status !== "DETECTED") throw new Error("CANDIDATE_NOT_DETECTED");
  if (!input.reason.trim()) throw new Error("TERMINAL_REASON_REQUIRED");
  return Object.freeze({
    ...candidate,
    status: input.falsePositive ? "FALSE_POSITIVE" : "DISMISSED",
    terminalReason: input.reason.trim(),
  });
}

export function mergeCandidateTension(
  candidate: CandidateTensionRecord,
  input: Readonly<{ mergedIntoId: string; reason: string }>,
): CandidateTensionRecord {
  if (candidate.status !== "DETECTED") throw new Error("CANDIDATE_NOT_DETECTED");
  if (!input.mergedIntoId.trim()) throw new Error("MERGED_INTO_REQUIRED");
  if (input.mergedIntoId.trim() === candidate.id) throw new Error("CANNOT_MERGE_INTO_SELF");
  if (!input.reason.trim()) throw new Error("TERMINAL_REASON_REQUIRED");
  return Object.freeze({
    ...candidate,
    status: "MERGED",
    mergedIntoId: input.mergedIntoId.trim(),
    terminalReason: input.reason.trim(),
  });
}

export function candidateIsFormalTension(candidate: CandidateTensionRecord): false {
  void candidate;
  return false;
}
