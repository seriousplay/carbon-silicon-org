export type PrivateBriefSignalKind =
  | "STALE_GOAL_CHECK_IN"
  | "MISSING_TARGET_EVIDENCE"
  | "UNRESOLVED_MEETING_OUTPUT"
  | "REPEATED_TENSION"
  | "ROLE_WORK_MISMATCH"
  | "MISSING_CHILD_GOAL";

export type PrivateBriefSourceType =
  | "goal"
  | "target"
  | "meeting"
  | "tension"
  | "project"
  | "action"
  | "circle"
  | "role";

export type PrivateBriefSeverity = "attention" | "risk";

export type PrivateBriefSource = Readonly<{
  type: PrivateBriefSourceType;
  id: string;
  label: string;
  applicationUrl: string | null;
  observedAt: string;
}>;

export type PrivateBriefSafeActionKind =
  | "OPEN_SOURCE"
  | "OPEN_GOAL_TREE"
  | "OPEN_MEETING"
  | "RAISE_TENSION"
  | "PREPARE_COMMAND_PREVIEW";

export type PrivateBriefSafeAction = Readonly<{
  kind: PrivateBriefSafeActionKind;
  label: string;
  applicationUrl: string;
}>;

export type PrivateBriefSignal = Readonly<{
  kind: PrivateBriefSignalKind;
  dedupeKey: string;
  title: string;
  reason: string;
  severity: PrivateBriefSeverity;
  evidenceAgeDays: number | null;
  sources: readonly PrivateBriefSource[];
  action: PrivateBriefSafeAction;
}>;

export type PrivateBrief = Readonly<{
  schemaVersion: 1;
  generatedAt: string;
  windowDays: number;
  signals: readonly PrivateBriefSignal[];
  truncated: boolean;
}>;
