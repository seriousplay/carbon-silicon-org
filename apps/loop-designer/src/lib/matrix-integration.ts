import "server-only";

import type { CircuitDesignStudyPayload } from "@carbon-silicon/types";
import {
  signCircuitDesignStudyPayload,
  signIntegrationPayload,
  verifyMatrixLaunchTicketToken,
} from "./integration-crypto";

export function verifyMatrixLaunchTicket(token: string) {
  const key = process.env.MATRIX_ORIGIN_ED25519_PUBLIC_KEY;
  if (!key) throw new Error("未配置 MATRIX_ORIGIN_ED25519_PUBLIC_KEY");
  return verifyMatrixLaunchTicketToken(token, key);
}

export function signStudyPayload(payload: CircuitDesignStudyPayload) {
  const secret = process.env.MATRIX_LOOP_CALLBACK_SECRET;
  if (!secret) throw new Error("未配置 MATRIX_LOOP_CALLBACK_SECRET");
  return signCircuitDesignStudyPayload(payload, secret);
}

export function signIntegrationBody(payload: unknown) {
  const secret = process.env.MATRIX_LOOP_CALLBACK_SECRET;
  if (!secret) throw new Error("未配置 MATRIX_LOOP_CALLBACK_SECRET");
  return signIntegrationPayload(payload, secret);
}
