import { createHmac, createPublicKey, verify } from "node:crypto";
import type { CircuitDesignStudyPayload, MatrixLaunchTicket } from "@carbon-silicon/types";

export function verifyMatrixLaunchTicketToken(token: string, publicKey: string, now = Math.floor(Date.now() / 1000)) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) throw new Error("Matrix 启动票据格式无效");
  const valid = verify(
    null,
    Buffer.from(encoded),
    createPublicKey(normalizeKey(publicKey)),
    Buffer.from(signature, "base64url"),
  );
  if (!valid) throw new Error("Matrix 启动票据签名无效");
  const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as MatrixLaunchTicket;
  if (payload.exp <= now || payload.iat > now + 30) throw new Error("Matrix 启动票据已过期");
  return payload;
}

export function signCircuitDesignStudyPayload(payload: CircuitDesignStudyPayload, secret: string) {
  return signIntegrationPayload(payload, secret);
}

export function signIntegrationPayload(payload: unknown, secret: string) {
  const body = JSON.stringify(payload);
  return {
    body,
    signature: createHmac("sha256", secret).update(body).digest("base64url"),
  };
}

function normalizeKey(value: string) {
  return value.includes("BEGIN") ? value.replaceAll("\\n", "\n") : Buffer.from(value, "base64");
}
