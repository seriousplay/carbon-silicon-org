import { createHash } from "node:crypto";

type MutationOperation = "SUBMIT" | "DECIDE";

export type TacticalOutcomeMutationBinding = {
  schemaVersion: 1;
  operation: MutationOperation;
  organizationId: string;
  actorId: string;
  meetingId: string;
  subjectId: string;
  expectedRevision: number;
  mutationKey: string;
  payloadHash: string;
};

const AUTHORIZED_MUTATION = Symbol("AUTHORIZED_TACTICAL_OUTCOME_MUTATION");

export type AuthorizedTacticalOutcomeMutation = {
  readonly [AUTHORIZED_MUTATION]: true;
  readonly binding: TacticalOutcomeMutationBinding;
};

type BaseAuthorityInput = {
  organizationId: string;
  actorId: string;
  meetingId: string;
  subjectId: string;
  expectedRevision: number;
  mutationKey: string;
  payload: Record<string, unknown>;
};

export function authorizeSubmitMutation(input: BaseAuthorityInput & {
  tensionRaiserId: string;
  existingProposerId: string | null;
  isSelectedTacticalMeetingParticipant: boolean;
}): AuthorizedTacticalOutcomeMutation {
  if (input.tensionRaiserId !== input.actorId || (input.existingProposerId !== null && input.existingProposerId !== input.actorId)) {
    throw new Error("只有张力提出人可以提交或修改提案");
  }
  if (!input.isSelectedTacticalMeetingParticipant) {
    throw new Error("只有选定战术会的实际参与人可以提交或修改提案");
  }
  return authorizedBinding("SUBMIT", input);
}

export function authorizeDecisionMutation(input: BaseAuthorityInput & {
  proposalMeetingId: string;
  isSelectedTacticalMeetingParticipant: boolean;
}): AuthorizedTacticalOutcomeMutation {
  if (input.proposalMeetingId !== input.meetingId) {
    throw new Error("会议与提案选定会议不一致");
  }
  if (!input.isSelectedTacticalMeetingParticipant) {
    throw new Error("只有选定战术会的实际参与人可以记录会议结果");
  }
  return authorizedBinding("DECIDE", input);
}

export function storedMutationEnvelope(
  authorization: AuthorizedTacticalOutcomeMutation,
  result: Record<string, unknown>,
): Record<string, unknown> {
  return {
    schemaVersion: 1,
    binding: authorization.binding,
    result,
  };
}

export function readAuthorizedMutationReplay(
  authorization: AuthorizedTacticalOutcomeMutation,
  storedMutationKey: string | null,
  storedValue: unknown,
): unknown | null {
  if (storedMutationKey !== authorization.binding.mutationKey) return null;
  if (!isRecord(storedValue) || storedValue.schemaVersion !== 1 || !isRecord(storedValue.binding) || !isRecord(storedValue.result)) {
    throw new Error("幂等键缺少可验证的原请求绑定");
  }
  if (stableJson(storedValue.binding) !== stableJson(authorization.binding)) {
    throw new Error("幂等键与原请求不一致");
  }
  return storedValue.result;
}

export async function runAuthorizedMutation<Context, Result>(input: {
  authorize: () => Promise<{ authorization: AuthorizedTacticalOutcomeMutation; context: Context }>;
  replay: (authorized: { authorization: AuthorizedTacticalOutcomeMutation; context: Context }) => Promise<Result | null>;
  validateFresh: (authorized: { authorization: AuthorizedTacticalOutcomeMutation; context: Context }) => Promise<void> | void;
  mutate: (authorized: { authorization: AuthorizedTacticalOutcomeMutation; context: Context }) => Promise<Result>;
}): Promise<Result> {
  const authorized = await input.authorize();
  const replay = await input.replay(authorized);
  if (replay !== null) return replay;
  await input.validateFresh(authorized);
  return input.mutate(authorized);
}

function authorizedBinding(operation: MutationOperation, input: BaseAuthorityInput): AuthorizedTacticalOutcomeMutation {
  return {
    [AUTHORIZED_MUTATION]: true,
    binding: {
      schemaVersion: 1,
      operation,
      organizationId: input.organizationId,
      actorId: input.actorId,
      meetingId: input.meetingId,
      subjectId: input.subjectId,
      expectedRevision: input.expectedRevision,
      mutationKey: input.mutationKey,
      payloadHash: createHash("sha256").update(stableJson(input.payload)).digest("hex"),
    },
  };
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
