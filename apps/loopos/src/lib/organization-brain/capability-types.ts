import type {
  BrainCommandHumanDiff,
  BrainCommandInput,
  BrainCommandMetadata,
  BrainCommandName,
  BrainCommandResult,
  BrainCommandServerPayload,
  BrainCommandSourceBinding,
} from "./command-registry";

export type BrainCapabilityAuthority = "DRAFT" | "PROPOSE" | "APPEND_EVIDENCE";
export type BrainCapabilityProcessGate = "NONE" | "TACTICAL_MEETING" | "GOVERNANCE_MEETING" | "GOAL_CYCLE";
export type BrainCapabilityIdempotency = "REQUIRED" | "OPTIONAL";
export type BrainCapabilityArtifact =
  | "GOAL_PROPOSAL"
  | "GOAL_CHECK_IN"
  | "TENSION"
  | "TACTICAL_OUTCOME_PROPOSAL"
  | "MEETING_NOTES"
  | "GOVERNANCE_PROPOSAL"
  | "ROLE_APPLICATION";

export type BrainCapabilityHandlerId =
  | "goal-command-handler.create-goal-proposal"
  | "goal-command-handler.append-goal-proposal-revision"
  | "goal-command-handler.append-goal-check-in"
  | "goal-command-handler.raise-tension"
  | "goal-command-handler.submit-tactical-outcome-proposal"
  | "goal-command-handler.update-meeting-notes"
  | "goal-command-handler.create-governance-proposal"
  | "goal-command-handler.create-role-application";

export type BrainCapabilityDefinition = Readonly<{
  id: BrainCommandName;
  schemaVersion: 1;
  command: BrainCommandMetadata;
  reads: readonly string[];
  authority: BrainCapabilityAuthority;
  requiresConfirmation: true;
  processGate: BrainCapabilityProcessGate;
  handlerId: BrainCapabilityHandlerId;
  idempotency: BrainCapabilityIdempotency;
  auditEvent: string;
  artifact: BrainCapabilityArtifact;
  fallback: "EXPLAIN_AND_LINK" | "SAVE_DRAFT";
}>;

export type BrainCapabilityRequest = Readonly<{
  id: BrainCommandName;
  schemaVersion: number;
  input: unknown;
}>;

export type BrainCapabilityContract = Readonly<{
  definition: BrainCapabilityDefinition;
  parsedInput: BrainCommandInput["input"];
  serverPayload: BrainCommandServerPayload;
  sourceBindings: readonly BrainCommandSourceBinding[];
  humanDiff: BrainCommandHumanDiff;
  result: BrainCommandResult;
}>;
