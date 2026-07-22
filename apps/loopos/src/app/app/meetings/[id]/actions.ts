"use server";

const RETIRED_TACTICAL_MUTATION_MESSAGE =
  "该直接处理入口已停用，请使用战术结果提案并由参会人记录会议结果";

export type ConvertInMeetingState = { error?: string; tensionId?: string } | null;
export type ConvertToDecisionState = { error?: string; decisionId?: string } | null;
export type ValidationResolutionState =
  | { error?: string; projectId?: string; actionId?: string; proposalId?: string; ok?: boolean }
  | null;

export async function assignTensionAction(
  _tensionId: string,
  _meetingId: string,
  _prev: ConvertInMeetingState,
  _formData: FormData
): Promise<ConvertInMeetingState> {
  void _tensionId;
  void _meetingId;
  void _prev;
  void _formData;
  return { error: RETIRED_TACTICAL_MUTATION_MESSAGE };
}

export async function convertTensionToDecision(
  _tensionId: string,
  _meetingId: string,
  _prev: ConvertToDecisionState,
  _formData: FormData
): Promise<ConvertToDecisionState> {
  void _tensionId;
  void _meetingId;
  void _prev;
  void _formData;
  return { error: RETIRED_TACTICAL_MUTATION_MESSAGE };
}

export async function resolveTensionInMeeting(
  _tensionId: string,
  _meetingId: string
): Promise<void> {
  void _tensionId;
  void _meetingId;
  throw new Error(RETIRED_TACTICAL_MUTATION_MESSAGE);
}

export async function createValidationProjectResolutionAction(
  _tensionId: string,
  _meetingId: string,
  _prev: ValidationResolutionState,
  _formData: FormData
): Promise<ValidationResolutionState> {
  void _tensionId;
  void _meetingId;
  void _prev;
  void _formData;
  return { error: RETIRED_TACTICAL_MUTATION_MESSAGE };
}

export async function createValidationActionResolutionAction(
  _tensionId: string,
  _meetingId: string,
  _prev: ValidationResolutionState,
  _formData: FormData
): Promise<ValidationResolutionState> {
  void _tensionId;
  void _meetingId;
  void _prev;
  void _formData;
  return { error: RETIRED_TACTICAL_MUTATION_MESSAGE };
}

export async function markValidationGovernanceCandidateAction(
  _tensionId: string,
  _meetingId: string,
  _prev: ValidationResolutionState,
  _formData: FormData
): Promise<ValidationResolutionState> {
  void _tensionId;
  void _meetingId;
  void _prev;
  void _formData;
  return { error: RETIRED_TACTICAL_MUTATION_MESSAGE };
}

export async function deferValidationResolutionAction(
  _tensionId: string,
  _meetingId: string,
  _prev: ValidationResolutionState,
  _formData: FormData
): Promise<ValidationResolutionState> {
  void _tensionId;
  void _meetingId;
  void _prev;
  void _formData;
  return { error: RETIRED_TACTICAL_MUTATION_MESSAGE };
}
