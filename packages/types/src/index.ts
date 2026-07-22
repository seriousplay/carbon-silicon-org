// Branded ID types
export type WorkspaceId = string & { readonly __brand: "WorkspaceId" };
export type CircuitId = string & { readonly __brand: "CircuitId" };
export type VersionId = string & { readonly __brand: "VersionId" };
export type UserId = string & { readonly __brand: "UserId" };
export type SessionId = string & { readonly __brand: "SessionId" };

// Maturity assessment types
export type MaturityLevel = "initial" | "managed" | "defined" | "measured" | "optimizing";

export interface MaturityDimension {
  name: string;
  level: MaturityLevel;
  score: number;
  evidence: string[];
}

export interface MaturityScore {
  overall: number;
  dimensions: MaturityDimension[];
  assessedAt: string;
  assessedBy: UserId;
}

export interface AlignmentDimension {
  name: string;
  current: number;
  target: number;
  gap: number;
}

export interface AlignmentScore {
  overall: number;
  dimensions: AlignmentDimension[];
  assessedAt: string;
}

export interface LoopMaturityMapping {
  loopId: string;
  maturity: MaturityScore;
  alignment: AlignmentScore;
}

// Integration status types
export type IntegrationStatus = "pending" | "in_progress" | "completed" | "failed" | "cancelled";

export const INTEGRATION_STATUS = {
  PENDING: "pending" as IntegrationStatus,
  IN_PROGRESS: "in_progress" as IntegrationStatus,
  COMPLETED: "completed" as IntegrationStatus,
  FAILED: "failed" as IntegrationStatus,
  CANCELLED: "cancelled" as IntegrationStatus,
} as const;

// Design study types
export type DesignStudyStatus = "submitted" | "under_review" | "promoted" | "rejected";

export const DESIGN_STUDY_STATUS = {
  SUBMITTED: "submitted" as DesignStudyStatus,
  UNDER_REVIEW: "under_review" as DesignStudyStatus,
  PROMOTED: "promoted" as DesignStudyStatus,
  REJECTED: "rejected" as DesignStudyStatus,
} as const;

export interface CircuitDesignStudyPayload {
  studyId: string;
  circuitId: CircuitId;
  loopPlan: Record<string, unknown>;
  maturityAnalysis: MaturityScore;
  methodologyCoverage: number;
  submittedAt: string;
  submittedBy: UserId;
}

// Mapping types
export type MappingWarningCode = 
  | "MISMATCHED_CIRCUIT"
  | "MISSING_DIMENSION"
  | "VERSION_CONFLICT"
  | "STALE_EVIDENCE";

export const MAPPING_WARNING_CODES: Record<MappingWarningCode, string> = {
  MISMATCHED_CIRCUIT: "Circuit mapping mismatch between Matrix and Loop",
  MISSING_DIMENSION: "Required dimension missing in maturity assessment",
  VERSION_CONFLICT: "Version conflict detected in network baseline",
  STALE_EVIDENCE: "Evidence is older than assessment threshold",
};

export interface MappingWarning {
  code: MappingWarningCode;
  message: string;
  severity: "warning" | "error";
  context?: Record<string, unknown>;
}

// Integration error codes
export type IntegrationErrorCode = 
  | "INVALID_TICKET"
  | "SIGNATURE_VERIFICATION_FAILED"
  | "TICKET_EXPIRED"
  | "TICKET_ALREADY_CONSUMED"
  | "WORKSPACE_NOT_FOUND"
  | "USER_MAPPING_FAILED"
  | "ENTERPRISE_MAPPING_FAILED";

export const INTEGRATION_ERROR_CODES: Record<IntegrationErrorCode, string> = {
  INVALID_TICKET: "Launch ticket is invalid or malformed",
  SIGNATURE_VERIFICATION_FAILED: "Ed25519 signature verification failed",
  TICKET_EXPIRED: "Launch ticket has expired",
  TICKET_ALREADY_CONSUMED: "Launch ticket has already been consumed",
  WORKSPACE_NOT_FOUND: "Target workspace not found",
  USER_MAPPING_FAILED: "Failed to map user identity between systems",
  ENTERPRISE_MAPPING_FAILED: "Failed to map enterprise to workspace",
};

// Integration context
export interface MatrixIntegrationContext {
  matrixWorkspaceId: WorkspaceId;
  circuitLogicalId: CircuitId;
  baseVersionId: VersionId;
  designBriefId: string;
}

export interface MatrixLaunchTicket {
  ticket: string;
  workspaceId: WorkspaceId;
  circuitLogicalId: CircuitId;
  versionId: VersionId;
  designBriefId: string;
  userId: UserId;
  tenantKey: string;
  openId: string;
  issuedAt: number;
  expiresAt: number;
}
