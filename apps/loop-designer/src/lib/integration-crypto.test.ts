import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import test from "node:test";
import type { CircuitDesignStudyPayload, MatrixLaunchTicket } from "@carbon-silicon/types";
import {
  signCircuitDesignStudyPayload,
  signIntegrationPayload,
  verifyMatrixLaunchTicketToken,
} from "./integration-crypto";

const now = 1_800_000_000;

test("Matrix launch tickets verify signature, expiry and issued-at skew", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicPem = publicKey.export({ type: "spki", format: "pem" }).toString();
  const payload = ticket({ iat: now, exp: now + 300 });
  const token = signTicket(payload, privateKey);

  assert.equal(verifyMatrixLaunchTicketToken(token, publicPem, now).launchJti, "launch-1");
  assert.throws(() => verifyMatrixLaunchTicketToken(`${token}x`, publicPem, now), /签名无效/);
  assert.throws(() => verifyMatrixLaunchTicketToken(signTicket(ticket({ iat: now, exp: now }), privateKey), publicPem, now), /已过期/);
  assert.throws(
    () => verifyMatrixLaunchTicketToken(signTicket(ticket({ iat: now + 31, exp: now + 300 }), privateKey), publicPem, now),
    /已过期/,
  );
});

test("Loop callback signatures are deterministic HMACs over the exact JSON body", () => {
  const payload = { ticket: "ticket", loopUserId: "loop-user", loopEnterpriseId: "enterprise" };
  const signed = signIntegrationPayload(payload, "secret");

  assert.equal(signed.body, JSON.stringify(payload));
  assert.equal(signed.signature, createHmac("sha256", "secret").update(signed.body).digest("base64url"));
  assert.notEqual(signed.signature, createHmac("sha256", "secret").update(JSON.stringify({ ...payload, ticket: "other" })).digest("base64url"));
});

test("Design Study payload signing keeps the Matrix target and idempotency key intact", () => {
  const payload: CircuitDesignStudyPayload = {
    workspaceId: "workspace-1",
    circuitLogicalId: "circuit-1",
    baseVersionId: "version-1",
    matrixUserId: "matrix-user-1",
    loopDesignerSessionId: "session-1",
    loopPlan: { goal: "Improve handoff" },
    methodologyAnalysis: {},
    proposedOperations: [],
    warnings: [],
    idempotencyKey: "loop-study:session-1:v1",
    sourceArtifactUrl: "http://localhost:3020/matrix-origin",
  };

  const signed = signCircuitDesignStudyPayload(payload, "secret");
  assert.deepEqual(JSON.parse(signed.body), payload);
  assert.equal(signed.signature, createHmac("sha256", "secret").update(signed.body).digest("base64url"));
});

function ticket(overrides: Pick<MatrixLaunchTicket, "iat" | "exp">): MatrixLaunchTicket {
  return {
    matrixWorkspaceId: "workspace-1",
    circuitLogicalId: "circuit-1",
    baseVersionId: "version-1",
    matrixUserId: "matrix-user-1",
    integrationStatus: "linked",
    launchJti: "launch-1",
    returnUrl: "http://localhost:3020/matrix-origin",
    tenantKey: "tenant-1",
    openId: "open-1",
    unionId: "union-1",
    displayName: "Matrix User",
    avatarUrl: null,
    membershipRole: "owner",
    circuitName: "Growth Loop",
    circuitPurpose: "Improve growth",
    circuitSnapshot: {},
    ...overrides,
  };
}

function signTicket(payload: MatrixLaunchTicket, privateKey: KeyObject) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = sign(null, Buffer.from(encoded), privateKey).toString("base64url");
  return `${encoded}.${signature}`;
}
