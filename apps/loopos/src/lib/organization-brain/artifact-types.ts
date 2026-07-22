export type BrainArtifactStatus = "DRAFT" | "READY" | "EXECUTING" | "SUCCEEDED" | "FAILED";
export type BrainArtifactType = "TENSION_DRAFT";

export type BrainArtifactSourceRef = Readonly<{
  organizationId: string;
  ownerPersonId: string | null;
  type: string;
  id: string;
  label: string;
  applicationUrl: string;
  observedAt: string;
}>;

export type BrainArtifact = Readonly<{
  id: string;
  organizationId: string;
  ownerPersonId: string;
  conversationId: string | null;
  sourceMessageId: string | null;
  linkedCommandOperationId: string | null;
  supersedesArtifactId: string | null;
  artifactType: BrainArtifactType;
  schemaVersion: 1;
  payload: Readonly<Record<string, unknown>>;
  sourceRefs: readonly BrainArtifactSourceRef[];
  status: BrainArtifactStatus;
  expiresAt: string | null;
  failureCode: string | null;
  terminalResult: Readonly<Record<string, unknown>> | null;
  createdAt: string;
  updatedAt: string;
  readyAt: string | null;
  executionStartedAt: string | null;
  completedAt: string | null;
}>;

export type BrainArtifactActor = Readonly<{ type: "person"; id: string; label: string }>;
