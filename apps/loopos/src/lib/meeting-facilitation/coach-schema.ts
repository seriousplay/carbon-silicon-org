export const COACH_INTERVENTIONS = [
  "PROMPT_TURN",
  "REDIRECT_DRIFT",
  "CLARIFY_NEED",
  "SUGGEST_OUTPUT",
  "ASSESS_OBJECTION",
  "EXPLAIN_PROCESS",
  "NONE",
] as const;

export type CoachIntervention = (typeof COACH_INTERVENTIONS)[number];

export const OBJECTION_CRITERIA = [
  "SUBSTANTIAL_HARM",
  "CAUSED_BY_PROPOSAL",
  "ROLE_RELEVANCE",
  "SAFE_TO_TRY",
] as const;

export type ObjectionCriterion = (typeof OBJECTION_CRITERIA)[number];

export type MeetingCoachSuggestion = Readonly<{
  speech: string;
  intervention: CoachIntervention;
  evidenceRefs: readonly string[];
  confidence: number;
  suggestedTransition?: string;
  suggestedOutput?: Readonly<Record<string, unknown>>;
  objectionAssessment?: Readonly<{
    validity: "VALID" | "INVALID" | "INSUFFICIENT_INFO";
    criteria: readonly Readonly<{
      criterion: ObjectionCriterion;
      result: "PASS" | "FAIL" | "UNCERTAIN";
      rationale: string;
      evidenceRefs: readonly string[];
    }>[];
    rationale: string;
  }>;
  source: "AI" | "DETERMINISTIC";
}>;

export class MeetingCoachSchemaError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "MeetingCoachSchemaError";
  }
}

export function parseMeetingCoachSuggestion(
  raw: string,
  allowedEvidenceRefs: ReadonlySet<string>,
): MeetingCoachSuggestion {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    throw new MeetingCoachSchemaError("COACH_RESPONSE_NOT_JSON");
  }
  const value = object(parsed, "COACH_RESPONSE_INVALID");
  const speech = text(value.speech, "COACH_SPEECH_REQUIRED");
  const intervention = enumValue(value.intervention, COACH_INTERVENTIONS, "COACH_INTERVENTION_INVALID");
  const evidenceRefs = stringArray(value.evidenceRefs, "COACH_EVIDENCE_REFS_INVALID");
  assertKnownEvidence(evidenceRefs, allowedEvidenceRefs);
  const confidence = number(value.confidence, "COACH_CONFIDENCE_INVALID");
  if (confidence < 0 || confidence > 1) throw new MeetingCoachSchemaError("COACH_CONFIDENCE_INVALID");

  const result: {
    speech: string;
    intervention: CoachIntervention;
    evidenceRefs: string[];
    confidence: number;
    suggestedTransition?: string;
    suggestedOutput?: Readonly<Record<string, unknown>>;
    objectionAssessment?: MeetingCoachSuggestion["objectionAssessment"];
    source: "AI";
  } = { speech, intervention, evidenceRefs, confidence, source: "AI" };

  if (value.suggestedTransition !== undefined) {
    result.suggestedTransition = text(value.suggestedTransition, "COACH_TRANSITION_INVALID");
  }
  if (value.suggestedOutput !== undefined) {
    result.suggestedOutput = object(value.suggestedOutput, "COACH_OUTPUT_INVALID");
  }
  if (value.objectionAssessment !== undefined) {
    result.objectionAssessment = parseObjectionAssessment(value.objectionAssessment, allowedEvidenceRefs);
  }

  if (["REDIRECT_DRIFT", "CLARIFY_NEED", "SUGGEST_OUTPUT", "ASSESS_OBJECTION"].includes(intervention) && evidenceRefs.length === 0) {
    throw new MeetingCoachSchemaError("COACH_EVIDENCE_REQUIRED");
  }
  if (intervention === "SUGGEST_OUTPUT" && !result.suggestedOutput) {
    throw new MeetingCoachSchemaError("COACH_OUTPUT_REQUIRED");
  }
  if (intervention === "ASSESS_OBJECTION" && !result.objectionAssessment) {
    throw new MeetingCoachSchemaError("OBJECTION_ASSESSMENT_REQUIRED");
  }
  return result;
}

function parseObjectionAssessment(
  input: unknown,
  allowedEvidenceRefs: ReadonlySet<string>,
): NonNullable<MeetingCoachSuggestion["objectionAssessment"]> {
  const value = object(input, "OBJECTION_ASSESSMENT_INVALID");
  const validity = enumValue(
    value.validity,
    ["VALID", "INVALID", "INSUFFICIENT_INFO"] as const,
    "OBJECTION_VALIDITY_INVALID",
  );
  if (!Array.isArray(value.criteria) || value.criteria.length !== OBJECTION_CRITERIA.length) {
    throw new MeetingCoachSchemaError("OBJECTION_CRITERIA_INCOMPLETE");
  }
  const seen = new Set<ObjectionCriterion>();
  const criteria = value.criteria.map((inputCriterion) => {
    const criterionValue = object(inputCriterion, "OBJECTION_CRITERION_INVALID");
    const criterion = enumValue(criterionValue.criterion, OBJECTION_CRITERIA, "OBJECTION_CRITERION_INVALID");
    if (seen.has(criterion)) throw new MeetingCoachSchemaError("OBJECTION_CRITERION_DUPLICATE");
    seen.add(criterion);
    const evidenceRefs = stringArray(criterionValue.evidenceRefs, "OBJECTION_EVIDENCE_REFS_INVALID");
    if (evidenceRefs.length === 0) throw new MeetingCoachSchemaError("OBJECTION_EVIDENCE_REQUIRED");
    assertKnownEvidence(evidenceRefs, allowedEvidenceRefs);
    return {
      criterion,
      result: enumValue(
        criterionValue.result,
        ["PASS", "FAIL", "UNCERTAIN"] as const,
        "OBJECTION_CRITERION_RESULT_INVALID",
      ),
      rationale: text(criterionValue.rationale, "OBJECTION_CRITERION_RATIONALE_REQUIRED"),
      evidenceRefs,
    };
  });
  return {
    validity,
    criteria,
    rationale: text(value.rationale, "OBJECTION_RATIONALE_REQUIRED"),
  };
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  return trimmed;
}

function object(value: unknown, code: string): Readonly<Record<string, unknown>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MeetingCoachSchemaError(code);
  return value as Readonly<Record<string, unknown>>;
}

function text(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw new MeetingCoachSchemaError(code);
  return value.trim();
}

function number(value: unknown, code: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new MeetingCoachSchemaError(code);
  return value;
}

function stringArray(value: unknown, code: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim())) {
    throw new MeetingCoachSchemaError(code);
  }
  return [...new Set(value.map((item) => (item as string).trim()))];
}

function enumValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  code: string,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) throw new MeetingCoachSchemaError(code);
  return value as Values[number];
}

function assertKnownEvidence(refs: readonly string[], allowed: ReadonlySet<string>): void {
  if (refs.some((ref) => !allowed.has(ref))) throw new MeetingCoachSchemaError("COACH_EVIDENCE_REF_UNKNOWN");
}
