import type { MeetingFacilitationCommand, ObjectionAssessmentDetails } from "./repository";
import { MeetingEngineError } from "./types";

export function parseMeetingFacilitationCommand(value: unknown): MeetingFacilitationCommand {
  const input = record(value, "MEETING_COMMAND_INVALID");
  const type = string(input.type, "MEETING_COMMAND_TYPE_REQUIRED");
  switch (type) {
    case "START":
    case "CONFIRM_AI_ASSESSMENTS":
    case "CONFIRM_DISTRIBUTED_REVIEW":
    case "CONFIRM_ADOPTION":
    case "RESUME":
    case "BACK":
    case "CONFIRM_END":
      return { type };
    case "COMPLETE_TURN":
      return {
        type,
        ...(input.content === undefined ? {} : { content: string(input.content, "TURN_CONTENT_INVALID") }),
      };
    case "ADD_AGENDA_ITEM":
      return {
        type,
        roleId: string(input.roleId, "ROLE_ID_REQUIRED"),
        label: string(input.label, "AGENDA_LABEL_REQUIRED"),
        ...optionalString(input.linkedTensionId, "linkedTensionId"),
        ...optionalString(input.linkedProposalId, "linkedProposalId"),
      };
    case "CONFIRM_NEED":
      return {
        type,
        itemId: string(input.itemId, "AGENDA_ITEM_ID_REQUIRED"),
        need: string(input.need, "AGENDA_NEED_REQUIRED"),
      };
    case "CONFIRM_OUTPUT":
      return {
        type,
        itemId: string(input.itemId, "AGENDA_ITEM_ID_REQUIRED"),
        ...(input.candidateOutput === undefined
          ? {}
          : { candidateOutput: record(input.candidateOutput, "CANDIDATE_OUTPUT_INVALID") }),
      };
    case "CONFIRM_NEED_MET":
      return { type, itemId: string(input.itemId, "AGENDA_ITEM_ID_REQUIRED") };
    case "PRESENT_PROPOSAL":
      return {
        type,
        itemId: string(input.itemId, "AGENDA_ITEM_ID_REQUIRED"),
        proposalRevision: integer(input.proposalRevision, "PROPOSAL_REVISION_INVALID"),
      };
    case "PROPOSER_DECISION":
      return {
        type,
        amended: boolean(input.amended, "PROPOSER_DECISION_INVALID"),
        proposalRevision: integer(input.proposalRevision, "PROPOSAL_REVISION_INVALID"),
      };
    case "RECORD_OBJECTION":
      return {
        type,
        objectionId: string(input.objectionId, "OBJECTION_ID_REQUIRED"),
        objectorRoleId: string(input.objectorRoleId, "OBJECTION_ROLE_REQUIRED"),
        statement: string(input.statement, "OBJECTION_STATEMENT_REQUIRED"),
        criteria: record(input.criteria, "OBJECTION_CRITERIA_INVALID"),
      };
    case "RECORD_AI_ASSESSMENT":
      return {
        type,
        objectionId: string(input.objectionId, "OBJECTION_ID_REQUIRED"),
        assessment: parseAssessment(input.assessment),
      };
    case "RECORD_HUMAN_STANCE":
      return {
        type,
        objectionId: string(input.objectionId, "OBJECTION_ID_REQUIRED"),
        validity: enumValue(input.validity, ["VALID", "INVALID"] as const, "HUMAN_STANCE_INVALID"),
        reason: string(input.reason, "HUMAN_STANCE_REASON_REQUIRED"),
      };
    case "CONFIRM_INTEGRATION":
      return {
        type,
        objectionId: string(input.objectionId, "OBJECTION_ID_REQUIRED"),
        capacity: enumValue(input.capacity, ["OBJECTOR", "PROPOSER"] as const, "INTEGRATION_CAPACITY_INVALID"),
        proposalRevision: integer(input.proposalRevision, "PROPOSAL_REVISION_INVALID"),
      };
    case "PAUSE":
      return { type, reason: string(input.reason, "PAUSE_REASON_REQUIRED") };
    default:
      throw new MeetingEngineError("MEETING_COMMAND_TYPE_INVALID");
  }
}

function parseAssessment(value: unknown): ObjectionAssessmentDetails {
  const input = record(value, "AI_ASSESSMENT_INVALID");
  return {
    validity: enumValue(
      input.validity,
      ["VALID", "INVALID", "INSUFFICIENT_INFO"] as const,
      "AI_ASSESSMENT_VALIDITY_INVALID",
    ),
    rationale: string(input.rationale, "AI_ASSESSMENT_RATIONALE_REQUIRED"),
    confidence: number(input.confidence, "AI_ASSESSMENT_CONFIDENCE_INVALID"),
    criteria: record(input.criteria, "AI_ASSESSMENT_CRITERIA_INVALID"),
    evidenceRefs: stringArray(input.evidenceRefs, "AI_ASSESSMENT_EVIDENCE_INVALID"),
  };
}

function record(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MeetingEngineError(code);
  return value as Readonly<Record<string, unknown>>;
}

function string(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new MeetingEngineError(code);
  return value.trim();
}

function optionalString(value: unknown, key: "linkedTensionId" | "linkedProposalId") {
  if (value === undefined || value === null || value === "") return {};
  return { [key]: string(value, `${key.toUpperCase()}_INVALID`) };
}

function integer(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isInteger(value)) throw new MeetingEngineError(code);
  return value;
}

function number(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new MeetingEngineError(code);
  return value;
}

function boolean(value: unknown, code: string): boolean {
  if (typeof value !== "boolean") throw new MeetingEngineError(code);
  return value;
}

function stringArray(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new MeetingEngineError(code);
  }
  return [...new Set(value.map((item) => (item as string).trim()))];
}

function enumValue<const Values extends readonly string[]>(value: unknown, values: Values, code: string): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) throw new MeetingEngineError(code);
  return value as Values[number];
}
