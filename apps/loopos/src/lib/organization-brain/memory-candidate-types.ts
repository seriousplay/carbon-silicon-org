export type MemoryCandidateStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CONFIRMED"
  | "REJECTED"
  | "SUPERSEDED";

export type MemoryCandidateSourceType =
  | "goal"
  | "target"
  | "circle"
  | "role"
  | "accountability"
  | "domain"
  | "policy"
  | "project"
  | "action"
  | "meeting"
  | "decision"
  | "tension"
  | "unknown";

export type MemoryCandidateAuthorityRouteKind =
  | "GOAL_STRATEGY"
  | "GOVERNANCE"
  | "TACTICAL"
  | "MEETING_RECORD"
  | "TENSION";

export type MemoryCandidateLifecycleEventType =
  | "CREATED"
  | "SUBMITTED"
  | "CONFIRMED"
  | "REJECTED"
  | "SUPERSEDED";

export type MemoryCandidateActor = Readonly<{
  type: "person" | "meeting" | "process";
  id: string;
  label: string;
}>;

export type MemoryCandidateSourceRef = Readonly<{
  type: MemoryCandidateSourceType;
  id: string;
  label: string;
  applicationUrl: string;
  observedAt: string;
}>;

export type MemoryCandidateAuthorityRoute = Readonly<{
  kind: MemoryCandidateAuthorityRouteKind;
  label: string;
  applicationUrl: string;
}>;

export type MemoryCandidateSupersessionRef = Readonly<{
  type: "memoryCandidate" | "sourceRecord";
  id: string;
  label: string;
  applicationUrl: string;
}>;

export type MemoryCandidateAuditEvent = Readonly<{
  type: MemoryCandidateLifecycleEventType;
  actor: MemoryCandidateActor;
  occurredAt: string;
  reason: string | null;
}>;

export type MemoryCandidate = Readonly<{
  schemaVersion: 1;
  id: string;
  organizationId: string;
  ownerPersonId: string;
  claim: string;
  rationale: string;
  sourceRefs: readonly MemoryCandidateSourceRef[];
  authorityRoute: MemoryCandidateAuthorityRoute;
  status: MemoryCandidateStatus;
  submittedBy: MemoryCandidateActor | null;
  confirmedBy: MemoryCandidateActor | null;
  supersededBy: MemoryCandidateSupersessionRef | null;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  auditTrail: readonly MemoryCandidateAuditEvent[];
}>;
