import "server-only";

import { randomUUID } from "node:crypto";

import { withBasePath } from "@/lib/base-path";
import { hashInvitationToken } from "@/lib/invitations";
import { sendInvitationEmail } from "@/lib/notifications/email";
import {
  claimInvitationDeliveryJob,
  completeInvitationDeliveryFailure,
  completeInvitationDeliverySuccess,
  getInvitationDeliveryProviderPayload,
  type InvitationDeliveryDependencies,
  type InvitationDeliveryErrorCode,
  type InvitationDeliveryFailureCode,
} from "./invitation-delivery-service";
import {
  decryptInvitationToken,
  InvitationTokenEnvelopeError,
} from "./invitation-token-envelope";

const DEFAULT_LEASE_DURATION_MS = 5 * 60 * 1_000;
const DEFAULT_RETRY_DELAY_MS = 5 * 60 * 1_000;
const MAX_RETRY_DELAY_MS = 24 * 60 * 60 * 1_000;

export type InvitationDeliveryEmailProvider = Readonly<{
  sendInvitationEmail(params: Readonly<{
    to: string;
    organizationName: string;
    invitationUrl: string;
  }>): Promise<boolean>;
}>;

export type ProcessInvitationDeliveryJobInput = Readonly<{
  organizationId: string;
  jobId: string;
  now?: Date;
  leaseDurationMs?: number;
  retryDelayMs?: number;
}>;

export type ProcessInvitationDeliveryJobResult =
  | Readonly<{ ok: true; status: "SENT"; jobId: string }>
  | Readonly<{ ok: true; status: "FAILED"; jobId: string; retryAt: string; attemptsExhausted: boolean }>
  | Readonly<{ ok: false; code: InvitationDeliveryErrorCode }>;

export type ProcessInvitationDeliveryJobDependencies = Readonly<{
  deliveryDependencies?: InvitationDeliveryDependencies;
  emailProvider?: InvitationDeliveryEmailProvider;
  newLeaseToken?: () => string;
}>;

function validDate(value: unknown): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

function validDuration(value: unknown, max: number): value is number {
  return Number.isInteger(value) && Number(value) >= 1_000 && Number(value) <= max;
}

function failureResult(code: InvitationDeliveryErrorCode): ProcessInvitationDeliveryJobResult {
  return Object.freeze({ ok: false as const, code });
}

function failureCodeForProviderError(error: unknown): InvitationDeliveryFailureCode {
  if (
    error instanceof InvitationTokenEnvelopeError
    && (error.code === "INVALID_INPUT" || error.code === "DECRYPTION_FAILED")
  ) {
    return "DELIVERY_PERMANENT";
  }
  return "PROVIDER_UNAVAILABLE";
}

export async function processInvitationDeliveryJob(
  input: ProcessInvitationDeliveryJobInput,
  dependencies: ProcessInvitationDeliveryJobDependencies = {},
): Promise<ProcessInvitationDeliveryJobResult> {
  const now = input.now ?? new Date();
  const leaseDurationMs = input.leaseDurationMs ?? DEFAULT_LEASE_DURATION_MS;
  const retryDelayMs = input.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS;
  if (
    !validDate(now)
    || !validDuration(leaseDurationMs, 15 * 60 * 1_000)
    || !validDuration(retryDelayMs, MAX_RETRY_DELAY_MS)
  ) {
    return failureResult("INVALID_INPUT");
  }

  const deliveryDependencies = dependencies.deliveryDependencies;
  const leaseToken = dependencies.newLeaseToken?.() ?? randomUUID();
  const claimed = await claimInvitationDeliveryJob({
    organizationId: input.organizationId,
    jobId: input.jobId,
    leaseToken,
    now,
    leaseDurationMs,
  }, deliveryDependencies);
  if (!claimed.ok) return failureResult(claimed.code);

  const payloadResult = await getInvitationDeliveryProviderPayload({
    organizationId: input.organizationId,
    jobId: input.jobId,
    leaseToken,
    now,
  }, deliveryDependencies);
  if (!payloadResult.ok) return failureResult(payloadResult.code);

  let failureCode: InvitationDeliveryFailureCode = "PROVIDER_UNAVAILABLE";
  try {
    const token = decryptInvitationToken(
      payloadResult.payload.invitation.deliveryTokenCiphertext,
      {
        organizationId: payloadResult.payload.invitation.organizationId,
        invitationId: payloadResult.payload.invitation.id,
      },
    );
    if (hashInvitationToken(token) !== payloadResult.payload.invitation.tokenHash) {
      failureCode = "DELIVERY_PERMANENT";
      throw new InvitationTokenEnvelopeError("DECRYPTION_FAILED");
    }
    const invitationUrl = withBasePath(`/invite/${token}`);
    const provider = dependencies.emailProvider ?? { sendInvitationEmail };
    const sent = await provider.sendInvitationEmail({
      to: payloadResult.payload.invitation.email,
      organizationName: payloadResult.payload.invitation.organizationName,
      invitationUrl,
    });
    if (!sent) {
      failureCode = "PROVIDER_UNAVAILABLE";
      throw new Error("invitation provider unavailable");
    }
  } catch (error) {
    failureCode = failureCode === "DELIVERY_PERMANENT"
      ? failureCode
      : failureCodeForProviderError(error);
    const failedAt = new Date(now.getTime() + 1);
    const retryAt = new Date(now.getTime() + retryDelayMs);
    const failed = await completeInvitationDeliveryFailure({
      organizationId: input.organizationId,
      jobId: input.jobId,
      leaseToken,
      now: failedAt,
      retryAt,
      errorCode: failureCode,
    }, deliveryDependencies);
    if (!failed.ok) return failureResult(failed.code);
    return Object.freeze({
      ok: true as const,
      status: "FAILED" as const,
      jobId: input.jobId,
      retryAt: failed.retryAt,
      attemptsExhausted: failed.attemptsExhausted,
    });
  }

  const completed = await completeInvitationDeliverySuccess({
    organizationId: input.organizationId,
    jobId: input.jobId,
    leaseToken,
    now: new Date(now.getTime() + 1),
  }, deliveryDependencies);
  if (!completed.ok) return failureResult(completed.code);
  return Object.freeze({ ok: true as const, status: "SENT" as const, jobId: input.jobId });
}
