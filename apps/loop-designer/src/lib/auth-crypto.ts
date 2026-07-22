import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type OAuthState = {
  state: string;
  verifier: string;
  next: string;
  expiresAt: number;
};

export type ExportGrant = {
  userId: string;
  sessionId: string;
  kind: "markdown" | "pdf";
  expiresAt: number;
};

function sign(value: string, secret: string) {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

export function createOpaqueToken() {
  return randomBytes(32).toString("base64url");
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function createPkcePair() {
  const verifier = randomBytes(48).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

/**
 * Normalize a return path to prevent open redirect attacks.
 * Only allows paths under /loop-designer. Rejects absolute URLs,
 * protocol-relative URLs, and path-injection attempts.
 */
export function normalizeReturnPath(value: string | null | undefined) {
  if (!value) return "/loop-designer";

  // Reject absolute URLs (http://, https://, //)
  if (/^https?:\/\//i.test(value) || value.startsWith("//")) {
    return "/loop-designer";
  }

  // Reject path-injection via @ or encoded characters
  if (/[@%]/.test(value)) {
    return "/loop-designer";
  }

  // Must start with /loop-designer
  if (!value.startsWith("/loop-designer")) {
    return "/loop-designer";
  }

  return value;
}

export function sealOAuthState(payload: OAuthState, secret: string) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function openOAuthState(value: string | undefined, secret: string, now = Date.now()) {
  if (!value) return null;
  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra) return null;
  const expected = sign(body, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    if (
      !payload.state ||
      !payload.verifier ||
      !payload.next ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt < now
    ) {
      return null;
    }
    return { ...payload, next: normalizeReturnPath(payload.next) };
  } catch {
    return null;
  }
}

export function sealExportGrant(payload: ExportGrant, secret: string) {
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body, secret)}`;
}

export function openExportGrant(value: string | null | undefined, secret: string, now = Date.now()) {
  if (!value) return null;
  const [body, signature, extra] = value.split(".");
  if (!body || !signature || extra) return null;
  const expected = sign(body, secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as ExportGrant;
    if (
      !payload.userId ||
      !payload.sessionId ||
      !["markdown", "pdf"].includes(payload.kind) ||
      !Number.isFinite(payload.expiresAt) ||
      payload.expiresAt < now
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
