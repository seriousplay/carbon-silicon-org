import { createHash } from "node:crypto";
import { parseGovernanceStructuralChange, type GovernanceStructuralChange } from "@/lib/governance-change";

const MAX_STRING_BYTES = 4096;
const MAX_ARRAY_ITEMS = 50;

export const BRAIN_COMMAND_SCHEMA_VERSION = 1;

export const BRAIN_COMMAND_NAMES = Object.freeze([
  "goal_proposal.create_draft",
  "goal_proposal.append_returned_revision",
  "goal_check_in.append",
  "tension.raise",
  "tactical_outcome.submit_proposal",
  "meeting_notes.update",
  "governance_proposal.create",
  "role_application.create",
] as const);

export type BrainCommandName = (typeof BRAIN_COMMAND_NAMES)[number];

export const BRAIN_COMMAND_PUBLIC_ERROR_CODES = Object.freeze([
  "INVALID_COMMAND",
  "INVALID_INPUT",
  "NOT_AVAILABLE",
  "ACCESS_DENIED",
  "PREVIEW_EXPIRED",
  "STALE_PREVIEW",
  "IDEMPOTENCY_CONFLICT",
  "INVALID_STATE",
  "RETRY_CONFLICT",
  "TEMPORARY_FAILURE",
] as const);

export type BrainCommandPublicErrorCode =
  (typeof BRAIN_COMMAND_PUBLIC_ERROR_CODES)[number];

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | readonly JsonValue[] | { readonly [key: string]: JsonValue };
type PlainObject = Record<string, unknown>;

export type BrainCommandTargetInput = Readonly<{
  position: number;
  label: string;
  kind: "NUMERIC" | "MILESTONE";
  baselineValue?: string;
  desiredValue?: string;
  unit?: string;
  acceptanceCriteria?: string;
  metricRef?: string;
}>;

export type BrainCommandInput =
  | Readonly<{
      schemaVersion: 1;
      command: "goal_proposal.create_draft";
      input: Readonly<{
        cycleRef: string;
        circleRef: string;
        ownerRoleRef: string;
        title: string;
        intendedOutcome: string;
        targets: readonly BrainCommandTargetInput[];
        parentGoalRef?: string;
        replacementProposalRef?: string;
      }>;
    }>
  | Readonly<{
      schemaVersion: 1;
      command: "goal_proposal.append_returned_revision";
      input: Readonly<{
        proposalRef: string;
        expectedRevision: number;
        title: string;
        intendedOutcome: string;
        rationale: string;
        targets: readonly BrainCommandTargetInput[];
      }>;
    }>
  | Readonly<{
      schemaVersion: 1;
      command: "goal_check_in.append";
      input: Readonly<{
        goalRef: string;
        targetRef: string;
        fact: string;
        evidenceSummary: string;
        assessment: "ON_TRACK" | "OFF_TRACK" | "AT_RISK" | "ACHIEVED";
        currentValue?: string;
        milestoneCompleted?: boolean;
        acceptanceEvidence?: string;
        meetingRef?: string;
        correctionOfCheckInRef?: string;
      }>;
    }>
  | Readonly<{
      schemaVersion: 1;
      command: "tension.raise";
      input: Readonly<{
        title: string;
        description: string;
        type: "PROBLEMATIC" | "CONSTRUCTIVE" | "CLARIFYING";
        circleRefs: readonly string[];
        handlingMode: "UNROUTED" | "TACTICAL" | "GOVERNANCE";
        routeCircleRef?: string;
        routeMeetingRef?: string;
      }>;
    }>
  | Readonly<{
      schemaVersion: 1;
      command: "tactical_outcome.submit_proposal";
      input: Readonly<{
        tensionRef: string;
        meetingRef: string;
        expectedRevision: number;
        kind: "PROJECT" | "ACTION";
        title: string;
        description: string;
        responsibility: string;
        dueDate?: string;
        sourceProjectRef?: string;
      }>;
    }>
  | Readonly<{
      schemaVersion: 1;
      command: "meeting_notes.update";
      input: Readonly<{
        meetingRef: string;
        expectedNotesRevision: number;
        notes: string;
      }>;
    }>
  | Readonly<{
      schemaVersion: 1;
      command: "governance_proposal.create";
      input: Readonly<{
        tensionRef: string;
        meetingRef: string;
        currentStructure: string;
        proposedStructure: string;
        rationale: string;
        expectedImpact: string;
        structuralChange: GovernanceStructuralChange;
      }>;
    }>
  | Readonly<{
      schemaVersion: 1;
      command: "role_application.create";
      input: Readonly<{
        roleRef: string;
        motivation: string;
        capabilitySummary: string;
        commitment: string;
      }>;
    }>;

export type BrainCommandServerPayload =
  | Readonly<{
      command: "goal_proposal.create_draft";
      cycleId: string;
      circleId: string;
      ownerRoleId: string;
      title: string;
      intendedOutcome: string;
      targets: readonly BrainCommandTargetPayload[];
      parentGoalId?: string;
      replacementProposalId?: string;
    }>
  | Readonly<{
      command: "goal_proposal.append_returned_revision";
      proposalId: string;
      expectedRevision: number;
      title: string;
      intendedOutcome: string;
      rationale: string;
      targets: readonly BrainCommandTargetPayload[];
    }>
  | Readonly<{
      command: "goal_check_in.append";
      goalId: string;
      targetId: string;
      fact: string;
      evidenceSummary: string;
      assessment: "ON_TRACK" | "OFF_TRACK" | "AT_RISK" | "ACHIEVED";
      currentValue?: string;
      milestoneCompleted?: boolean;
      acceptanceEvidence?: string;
      meetingId?: string;
      supersedesCheckInId?: string;
    }>
  | Readonly<{
      command: "tension.raise";
      title: string;
      description: string;
      type: "PROBLEMATIC" | "CONSTRUCTIVE" | "CLARIFYING";
      circleIds: readonly string[];
      handlingMode: "UNROUTED" | "TACTICAL" | "GOVERNANCE";
      routeCircleId?: string;
      routeMeetingId?: string;
    }>
  | Readonly<{
      command: "tactical_outcome.submit_proposal";
      tensionId: string;
      meetingId: string;
      expectedRevision: number;
      kind: "PROJECT" | "ACTION";
      title: string;
      description: string;
      responsibility: string;
      circleId: string;
      responsiblePersonId: string;
      dueDate?: string;
      sourceProjectId?: string;
    }>
  | Readonly<{
      command: "meeting_notes.update";
      meetingId: string;
      expectedNotesRevision: number;
      notes: string;
    }>
  | Readonly<{
      command: "governance_proposal.create";
      tensionId: string;
      meetingId: string;
      currentStructure: string;
      proposedStructure: string;
      rationale: string;
      expectedImpact: string;
      structuralChange: GovernanceStructuralChange;
    }>
  | Readonly<{
      command: "role_application.create";
      roleId: string;
      motivation: string;
      capabilitySummary: string;
      commitment: string;
    }>;

export type BrainCommandTargetPayload = BrainCommandTargetInput &
  Readonly<{ metricId?: string }>;

export type BrainCommandSourceBinding = Readonly<{
  objectType:
    | "goal_cycle"
    | "goal"
    | "goal_proposal"
    | "goal_target"
    | "goal_check_in"
    | "circle"
    | "role"
    | "metric"
    | "meeting"
    | "tension"
    | "governance_proposal"
    | "project";
  objectId: string;
  sourceVersionAt: string;
  revision?: number;
  status?: string;
  role?: string;
  meeting?: string;
  route?: string;
}>;

export type BrainCommandHumanDiff = readonly Readonly<{
  label: string;
  before: string | null;
  after: string | null;
}>[];

export type BrainCommandResult = Readonly<{
  resultId: string;
  status: "SUCCEEDED" | "REJECTED" | "EXPIRED";
  summary?: string;
}>;

export type BrainCommandPublicError = Readonly<{
  code: BrainCommandPublicErrorCode;
  message: string;
  correlationId: string;
  previewId?: string;
  resultId?: string;
}>;

export type BrainCommandMetadata = Readonly<{
  command: BrainCommandName;
  schemaVersion: 1;
  parseInput(raw: unknown): BrainCommandInput["input"];
  parseServerPayload(raw: unknown): BrainCommandServerPayload;
  parseSourceBindings(raw: unknown): readonly BrainCommandSourceBinding[];
  formatHumanDiff(payload: BrainCommandServerPayload): BrainCommandHumanDiff;
  parseResult(raw: unknown): BrainCommandResult;
  publicErrors: Readonly<Record<BrainCommandPublicErrorCode, string>>;
}>;

const FORBIDDEN_INPUT_KEYS = new Set([
  "handler",
  "module",
  "table",
  "field",
  "sql",
  "callback",
  "databaseClient",
  "ActorContext",
  "actorContext",
  "organizationId",
  "personId",
  "userId",
  "actorId",
  "ownerId",
  "recorderId",
  "raiserId",
]);

const COMMAND_SET = new Set<string>(BRAIN_COMMAND_NAMES);
const PUBLIC_ERROR_SET = new Set<string>(BRAIN_COMMAND_PUBLIC_ERROR_CODES);

const PUBLIC_ERROR_MESSAGES: Readonly<Record<BrainCommandPublicErrorCode, string>> = Object.freeze({
  INVALID_COMMAND: "The requested command is not available.",
  INVALID_INPUT: "The command request is invalid.",
  NOT_AVAILABLE: "The requested item is not available.",
  ACCESS_DENIED: "You no longer have permission to confirm this command.",
  PREVIEW_EXPIRED: "The command preview expired.",
  STALE_PREVIEW: "The command preview is stale.",
  IDEMPOTENCY_CONFLICT: "This mutation key was already used for another command.",
  INVALID_STATE: "The requested command is not valid for the current state.",
  RETRY_CONFLICT: "This preview was already confirmed with another mutation key.",
  TEMPORARY_FAILURE: "The command could not be completed. Try again later.",
});

class BrainCommandValidationError extends Error {
  constructor(public readonly code: BrainCommandPublicErrorCode) {
    super(`Brain command rejected: ${code}`);
    this.name = "BrainCommandValidationError";
  }
}

export { BrainCommandValidationError };

function fail(code: BrainCommandPublicErrorCode = "INVALID_INPUT"): never {
  throw new BrainCommandValidationError(code);
}

function isPlainObject(value: unknown): value is PlainObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function assertExactObject(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): asserts value is PlainObject {
  if (!isPlainObject(value)) fail();
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(value);
  if (
    !required.every((key) => Object.hasOwn(value, key)) ||
    !keys.every((key) => allowed.has(key))
  ) {
    fail();
  }
}

function assertNoForbiddenInputKeys(value: unknown): void {
  if (Array.isArray(value)) {
    for (const item of value) assertNoForbiddenInputKeys(item);
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, nested] of Object.entries(value)) {
    if (FORBIDDEN_INPUT_KEYS.has(key)) fail();
    assertNoForbiddenInputKeys(nested);
  }
}

function assertString(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim() === "" || utf8Bytes(value) > MAX_STRING_BYTES) {
    fail();
  }
}

function assertOptionalString(value: unknown): asserts value is string | undefined {
  if (value !== undefined) assertString(value);
}

function assertInteger(value: unknown): asserts value is number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) fail();
}

function assertBoolean(value: unknown): asserts value is boolean {
  if (typeof value !== "boolean") fail();
}

function assertEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
): asserts value is T {
  if (typeof value !== "string" || !allowed.includes(value as T)) fail();
}

function assertStringArray(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ARRAY_ITEMS) {
    fail();
  }
  for (const item of value) assertString(item);
}

function assertGovernanceChange(value: unknown): asserts value is GovernanceStructuralChange {
  try {
    parseGovernanceStructuralChange(value);
  } catch {
    fail();
  }
}

function assertTargetInput(value: unknown): asserts value is BrainCommandTargetInput {
  assertExactObject(
    value,
    ["position", "label", "kind"],
    [
      "baselineValue",
      "desiredValue",
      "unit",
      "acceptanceCriteria",
      "metricRef",
    ],
  );
  assertInteger(value.position);
  assertString(value.label);
  assertEnum(value.kind, ["NUMERIC", "MILESTONE"] as const);
  assertOptionalString(value.baselineValue);
  assertOptionalString(value.desiredValue);
  assertOptionalString(value.unit);
  assertOptionalString(value.acceptanceCriteria);
  assertOptionalString(value.metricRef);
}

function assertTargetPayload(value: unknown): asserts value is BrainCommandTargetPayload {
  assertExactObject(
    value,
    ["position", "label", "kind"],
    [
      "baselineValue",
      "desiredValue",
      "unit",
      "acceptanceCriteria",
      "metricId",
    ],
  );
  assertInteger(value.position);
  assertString(value.label);
  assertEnum(value.kind, ["NUMERIC", "MILESTONE"] as const);
  assertOptionalString(value.baselineValue);
  assertOptionalString(value.desiredValue);
  assertOptionalString(value.unit);
  assertOptionalString(value.acceptanceCriteria);
  assertOptionalString(value.metricId);
}

function assertTargetArray(
  value: unknown,
  targetValidator: (item: unknown) => void,
): void {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_ARRAY_ITEMS) {
    fail();
  }
  for (const item of value) targetValidator(item);
}

function parseInputFor(command: BrainCommandName, input: unknown): BrainCommandInput["input"] {
  assertNoForbiddenInputKeys(input);

  switch (command) {
    case "goal_proposal.create_draft":
      assertExactObject(
        input,
        ["cycleRef", "circleRef", "ownerRoleRef", "title", "intendedOutcome", "targets"],
        ["parentGoalRef", "replacementProposalRef"],
      );
      assertString(input.cycleRef);
      assertString(input.circleRef);
      assertString(input.ownerRoleRef);
      assertString(input.title);
      assertString(input.intendedOutcome);
      assertTargetArray(input.targets, assertTargetInput);
      assertOptionalString(input.parentGoalRef);
      assertOptionalString(input.replacementProposalRef);
      return deepFreeze(input) as Extract<BrainCommandInput, { command: typeof command }>["input"];
    case "goal_proposal.append_returned_revision":
      assertExactObject(input, ["proposalRef", "expectedRevision", "title", "intendedOutcome", "rationale", "targets"]);
      assertString(input.proposalRef);
      assertInteger(input.expectedRevision);
      assertString(input.title);
      assertString(input.intendedOutcome);
      assertString(input.rationale);
      assertTargetArray(input.targets, assertTargetInput);
      return deepFreeze(input) as Extract<BrainCommandInput, { command: typeof command }>["input"];
    case "goal_check_in.append":
      assertExactObject(
        input,
        ["goalRef", "targetRef", "fact", "evidenceSummary", "assessment"],
        ["currentValue", "milestoneCompleted", "acceptanceEvidence", "meetingRef", "correctionOfCheckInRef"],
      );
      assertString(input.goalRef);
      assertString(input.targetRef);
      assertString(input.fact);
      assertString(input.evidenceSummary);
      assertEnum(input.assessment, ["ON_TRACK", "OFF_TRACK", "AT_RISK", "ACHIEVED"] as const);
      assertOptionalString(input.currentValue);
      if (input.milestoneCompleted !== undefined) assertBoolean(input.milestoneCompleted);
      assertOptionalString(input.acceptanceEvidence);
      assertOptionalString(input.meetingRef);
      assertOptionalString(input.correctionOfCheckInRef);
      return deepFreeze(input) as Extract<BrainCommandInput, { command: typeof command }>["input"];
    case "tension.raise":
      assertExactObject(
        input,
        ["title", "description", "type", "circleRefs", "handlingMode"],
        ["routeCircleRef", "routeMeetingRef"],
      );
      assertString(input.title);
      assertString(input.description);
      assertEnum(input.type, ["PROBLEMATIC", "CONSTRUCTIVE", "CLARIFYING"] as const);
      assertStringArray(input.circleRefs);
      assertEnum(input.handlingMode, ["UNROUTED", "TACTICAL", "GOVERNANCE"] as const);
      assertOptionalString(input.routeCircleRef);
      assertOptionalString(input.routeMeetingRef);
      return deepFreeze(input) as Extract<BrainCommandInput, { command: typeof command }>["input"];
    case "tactical_outcome.submit_proposal":
      assertExactObject(
        input,
        ["tensionRef", "meetingRef", "expectedRevision", "kind", "title", "description", "responsibility"],
        ["dueDate", "sourceProjectRef"],
      );
      assertString(input.tensionRef);
      assertString(input.meetingRef);
      assertInteger(input.expectedRevision);
      assertEnum(input.kind, ["PROJECT", "ACTION"] as const);
      assertString(input.title);
      assertString(input.description);
      assertString(input.responsibility);
      assertOptionalString(input.dueDate);
      assertOptionalString(input.sourceProjectRef);
      return deepFreeze(input) as Extract<BrainCommandInput, { command: typeof command }>["input"];
    case "meeting_notes.update":
      assertExactObject(input, ["meetingRef", "expectedNotesRevision", "notes"]);
      assertString(input.meetingRef);
      assertInteger(input.expectedNotesRevision);
      assertString(input.notes);
      return deepFreeze(input) as Extract<BrainCommandInput, { command: typeof command }>["input"];
    case "governance_proposal.create":
      assertExactObject(input, ["tensionRef", "meetingRef", "currentStructure", "proposedStructure", "rationale", "expectedImpact", "structuralChange"]);
      assertString(input.tensionRef);
      assertString(input.meetingRef);
      assertString(input.currentStructure);
      assertString(input.proposedStructure);
      assertString(input.rationale);
      assertString(input.expectedImpact);
      assertGovernanceChange(input.structuralChange);
      return deepFreeze(input) as Extract<BrainCommandInput, { command: typeof command }>["input"];
    case "role_application.create":
      assertExactObject(input, ["roleRef", "motivation", "capabilitySummary", "commitment"]);
      assertString(input.roleRef);
      assertString(input.motivation);
      assertString(input.capabilitySummary);
      assertString(input.commitment);
      return deepFreeze(input) as Extract<BrainCommandInput, { command: typeof command }>["input"];
  }
}

function parseServerPayloadFor(command: BrainCommandName, raw: unknown): BrainCommandServerPayload {
  if (!isPlainObject(raw)) fail();
  if (raw.command !== command) fail();

  switch (command) {
    case "goal_proposal.create_draft":
      assertExactObject(
        raw,
        ["command", "cycleId", "circleId", "ownerRoleId", "title", "intendedOutcome", "targets"],
        ["parentGoalId", "replacementProposalId"],
      );
      assertString(raw.cycleId);
      assertString(raw.circleId);
      assertString(raw.ownerRoleId);
      assertString(raw.title);
      assertString(raw.intendedOutcome);
      assertTargetArray(raw.targets, assertTargetPayload);
      assertOptionalString(raw.parentGoalId);
      assertOptionalString(raw.replacementProposalId);
      break;
    case "goal_proposal.append_returned_revision":
      assertExactObject(raw, ["command", "proposalId", "expectedRevision", "title", "intendedOutcome", "rationale", "targets"]);
      assertString(raw.proposalId);
      assertInteger(raw.expectedRevision);
      assertString(raw.title);
      assertString(raw.intendedOutcome);
      assertString(raw.rationale);
      assertTargetArray(raw.targets, assertTargetPayload);
      break;
    case "goal_check_in.append":
      assertExactObject(
        raw,
        ["command", "goalId", "targetId", "fact", "evidenceSummary", "assessment"],
        ["currentValue", "milestoneCompleted", "acceptanceEvidence", "meetingId", "supersedesCheckInId"],
      );
      assertString(raw.goalId);
      assertString(raw.targetId);
      assertString(raw.fact);
      assertString(raw.evidenceSummary);
      assertEnum(raw.assessment, ["ON_TRACK", "OFF_TRACK", "AT_RISK", "ACHIEVED"] as const);
      assertOptionalString(raw.currentValue);
      if (raw.milestoneCompleted !== undefined) assertBoolean(raw.milestoneCompleted);
      assertOptionalString(raw.acceptanceEvidence);
      assertOptionalString(raw.meetingId);
      assertOptionalString(raw.supersedesCheckInId);
      break;
    case "tension.raise":
      assertExactObject(
        raw,
        ["command", "title", "description", "type", "circleIds", "handlingMode"],
        ["routeCircleId", "routeMeetingId"],
      );
      assertString(raw.title);
      assertString(raw.description);
      assertEnum(raw.type, ["PROBLEMATIC", "CONSTRUCTIVE", "CLARIFYING"] as const);
      assertStringArray(raw.circleIds);
      assertEnum(raw.handlingMode, ["UNROUTED", "TACTICAL", "GOVERNANCE"] as const);
      assertOptionalString(raw.routeCircleId);
      assertOptionalString(raw.routeMeetingId);
      break;
    case "tactical_outcome.submit_proposal":
      assertExactObject(
        raw,
        ["command", "tensionId", "meetingId", "expectedRevision", "kind", "title", "description", "responsibility", "circleId", "responsiblePersonId"],
        ["dueDate", "sourceProjectId"],
      );
      assertString(raw.tensionId);
      assertString(raw.meetingId);
      assertInteger(raw.expectedRevision);
      assertEnum(raw.kind, ["PROJECT", "ACTION"] as const);
      assertString(raw.title);
      assertString(raw.description);
      assertString(raw.responsibility);
      assertString(raw.circleId);
      assertString(raw.responsiblePersonId);
      assertOptionalString(raw.dueDate);
      assertOptionalString(raw.sourceProjectId);
      break;
    case "meeting_notes.update":
      assertExactObject(raw, ["command", "meetingId", "expectedNotesRevision", "notes"]);
      assertString(raw.meetingId);
      assertInteger(raw.expectedNotesRevision);
      assertString(raw.notes);
      break;
    case "governance_proposal.create":
      assertExactObject(raw, ["command", "tensionId", "meetingId", "currentStructure", "proposedStructure", "rationale", "expectedImpact", "structuralChange"]);
      assertString(raw.tensionId);
      assertString(raw.meetingId);
      assertString(raw.currentStructure);
      assertString(raw.proposedStructure);
      assertString(raw.rationale);
      assertString(raw.expectedImpact);
      assertGovernanceChange(raw.structuralChange);
      break;
    case "role_application.create":
      assertExactObject(raw, ["command", "roleId", "motivation", "capabilitySummary", "commitment"]);
      assertString(raw.roleId);
      assertString(raw.motivation);
      assertString(raw.capabilitySummary);
      assertString(raw.commitment);
      break;
  }

  return deepFreeze(raw) as BrainCommandServerPayload;
}

const SOURCE_BINDING_OBJECT_TYPES = {
  "goal_proposal.create_draft": [
    "goal_cycle",
    "circle",
    "role",
    "goal",
    "metric",
  ],
  "goal_proposal.append_returned_revision": [
    "goal_proposal",
  ],
  "goal_check_in.append": [
    "goal",
    "goal_target",
    "goal_check_in",
    "meeting",
    "role",
  ],
  "tension.raise": ["circle"],
  "tactical_outcome.submit_proposal": [
    "tension",
    "meeting",
    "circle",
    "project",
  ],
  "meeting_notes.update": ["meeting"],
  "governance_proposal.create": ["tension", "meeting"],
  "role_application.create": ["role"],
} as const satisfies Readonly<
  Record<BrainCommandName, readonly BrainCommandSourceBinding["objectType"][]>
>;

function parseSourceBindingsFor(
  command: BrainCommandName,
  raw: unknown,
): readonly BrainCommandSourceBinding[] {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ARRAY_ITEMS) fail();
  const allowedObjectTypes = SOURCE_BINDING_OBJECT_TYPES[command];
  for (const binding of raw) {
    assertExactObject(
      binding,
      ["objectType", "objectId", "sourceVersionAt"],
      ["revision", "status", "role", "meeting", "route"],
    );
    assertEnum(binding.objectType, allowedObjectTypes);
    assertString(binding.objectId);
    assertString(binding.sourceVersionAt);
    if (binding.revision !== undefined) assertInteger(binding.revision);
    assertOptionalString(binding.status);
    assertOptionalString(binding.role);
    assertOptionalString(binding.meeting);
    assertOptionalString(binding.route);
  }
  return deepFreeze(raw) as readonly BrainCommandSourceBinding[];
}

function parseResult(raw: unknown): BrainCommandResult {
  assertExactObject(raw, ["resultId", "status"], ["summary"]);
  assertString(raw.resultId);
  assertEnum(raw.status, ["SUCCEEDED", "REJECTED", "EXPIRED"] as const);
  assertOptionalString(raw.summary);
  return deepFreeze(raw) as BrainCommandResult;
}

function formatHumanDiff(payload: BrainCommandServerPayload): BrainCommandHumanDiff {
  switch (payload.command) {
    case "goal_proposal.create_draft":
    case "goal_proposal.append_returned_revision":
      return freezeDiff([
        ["Title", null, payload.title],
        ["Intended outcome", null, payload.intendedOutcome],
        ["Targets", null, String(payload.targets.length)],
      ]);
    case "goal_check_in.append":
      return freezeDiff([
        ["Fact", null, payload.fact],
        ["Assessment", null, payload.assessment],
      ]);
    case "tension.raise":
      return freezeDiff([
        ["Title", null, payload.title],
        ["Handling mode", null, payload.handlingMode],
        ["Route", null, payload.routeCircleId ?? payload.routeMeetingId ?? null],
      ]);
    case "tactical_outcome.submit_proposal":
      return freezeDiff([
        ["Kind", null, payload.kind],
        ["Title", null, payload.title],
        ["Responsibility", null, payload.responsibility],
        ["Due date", null, payload.dueDate ?? null],
      ]);
    case "meeting_notes.update":
      return freezeDiff([
        ["Notes revision", String(payload.expectedNotesRevision), String(payload.expectedNotesRevision + 1)],
        ["Notes", null, payload.notes],
      ]);
    case "governance_proposal.create":
      return freezeDiff([
        ["Governance change", null, payload.structuralChange.operation],
        ["Meeting", null, payload.meetingId],
        ["Rationale", null, payload.rationale],
      ]);
    case "role_application.create":
      return freezeDiff([
        ["Role", null, payload.roleId],
        ["Motivation", null, payload.motivation],
        ["Capability", null, payload.capabilitySummary],
        ["Commitment", null, payload.commitment],
      ]);
  }
}

function freezeDiff(rows: readonly (readonly [string, string | null, string | null])[]): BrainCommandHumanDiff {
  return Object.freeze(
    rows.map(([label, before, after]) =>
      Object.freeze({ label, before, after }),
    ),
  );
}

export function parseBrainCommandInput(raw: unknown): BrainCommandInput {
  assertNoForbiddenInputKeys(raw);
  assertExactObject(raw, ["schemaVersion", "command", "input"]);
  if (raw.schemaVersion !== BRAIN_COMMAND_SCHEMA_VERSION) fail();
  if (typeof raw.command !== "string" || !COMMAND_SET.has(raw.command)) {
    fail("INVALID_COMMAND");
  }
  const command = raw.command as BrainCommandName;
  return deepFreeze({
    schemaVersion: BRAIN_COMMAND_SCHEMA_VERSION,
    command,
    input: parseInputFor(command, raw.input),
  }) as BrainCommandInput;
}

export function parseBrainCommandServerPayload(raw: unknown): BrainCommandServerPayload {
  if (!isPlainObject(raw)) fail();
  if (typeof raw.command !== "string" || !COMMAND_SET.has(raw.command)) {
    fail("INVALID_COMMAND");
  }
  return parseServerPayloadFor(raw.command as BrainCommandName, raw);
}

export function parseBrainCommandPublicError(raw: unknown): BrainCommandPublicError {
  assertExactObject(raw, ["code", "message", "correlationId"], ["previewId", "resultId"]);
  if (typeof raw.code !== "string" || !PUBLIC_ERROR_SET.has(raw.code)) fail();
  assertString(raw.message);
  assertString(raw.correlationId);
  assertOptionalString(raw.previewId);
  assertOptionalString(raw.resultId);
  return deepFreeze(raw) as BrainCommandPublicError;
}

export function publicBrainCommandError(input: Readonly<{
  code: BrainCommandPublicErrorCode;
  correlationId: string;
  previewId?: string;
  resultId?: string;
}>): BrainCommandPublicError {
  assertEnum(input.code, BRAIN_COMMAND_PUBLIC_ERROR_CODES);
  assertString(input.correlationId);
  assertOptionalString(input.previewId);
  assertOptionalString(input.resultId);
  return deepFreeze({
    code: input.code,
    message: PUBLIC_ERROR_MESSAGES[input.code],
    correlationId: input.correlationId,
    ...(input.previewId === undefined ? {} : { previewId: input.previewId }),
    ...(input.resultId === undefined ? {} : { resultId: input.resultId }),
  });
}

export function canonicalizeBrainCommandBinding(value: JsonValue): string {
  return JSON.stringify(canonicalJson(value));
}

export function hashBrainCommandBinding(value: JsonValue): string {
  return createHash("sha256")
    .update(canonicalizeBrainCommandBinding(value))
    .digest("hex");
}

function canonicalJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value === null || typeof value !== "object") return value;
  const objectValue = value as { readonly [key: string]: JsonValue };
  return Object.fromEntries(
    Object.keys(objectValue)
      .sort()
      .map((key) => [key, canonicalJson(objectValue[key])]),
  );
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value)) deepFreeze(nested);
  return Object.freeze(value);
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function metadata(command: BrainCommandName): BrainCommandMetadata {
  return Object.freeze({
    command,
    schemaVersion: 1,
    parseInput: (raw) => parseInputFor(command, raw),
    parseServerPayload: (raw) => parseServerPayloadFor(command, raw),
    parseSourceBindings: (raw) => parseSourceBindingsFor(command, raw),
    formatHumanDiff: (payload) => formatHumanDiff(payload),
    parseResult,
    publicErrors: PUBLIC_ERROR_MESSAGES,
  });
}

export const BRAIN_COMMAND_REGISTRY: Readonly<Record<BrainCommandName, BrainCommandMetadata>> = Object.freeze({
  "goal_proposal.create_draft": metadata("goal_proposal.create_draft"),
  "goal_proposal.append_returned_revision": metadata("goal_proposal.append_returned_revision"),
  "goal_check_in.append": metadata("goal_check_in.append"),
  "tension.raise": metadata("tension.raise"),
  "tactical_outcome.submit_proposal": metadata("tactical_outcome.submit_proposal"),
  "meeting_notes.update": metadata("meeting_notes.update"),
  "governance_proposal.create": metadata("governance_proposal.create"),
  "role_application.create": metadata("role_application.create"),
});
