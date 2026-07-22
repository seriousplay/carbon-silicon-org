import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const ENVELOPE_VERSION = "v1";
const ENVELOPE_DOMAIN = "loopos.invitation-token.v1";
const MAX_CONTEXT_BYTES = 512;
const MAX_TOKEN_BYTES = 1_024;
const MAX_CIPHERTEXT_LENGTH = 2_048;
const MIN_SECRET_BYTES = 32;
const MAX_SECRET_BYTES = 4_096;
const IV_BYTES = 12;
const TAG_BYTES = 16;
const ENVELOPE_PATTERN = /^v1\.([A-Za-z0-9_-]{16})\.([A-Za-z0-9_-]{2,1366})\.([A-Za-z0-9_-]{22})$/;

export const INVITATION_TOKEN_ENVELOPE_ERROR_CODES = [
  "INVALID_INPUT",
  "SECRET_MISSING",
  "ENCRYPTION_FAILED",
  "DECRYPTION_FAILED",
] as const;

export type InvitationTokenEnvelopeErrorCode =
  (typeof INVITATION_TOKEN_ENVELOPE_ERROR_CODES)[number];

const ERROR_MESSAGES: Readonly<Record<InvitationTokenEnvelopeErrorCode, string>> = {
  INVALID_INPUT: "Invitation token envelope input is invalid",
  SECRET_MISSING: "Invitation token encryption is not configured",
  ENCRYPTION_FAILED: "Invitation token encryption failed",
  DECRYPTION_FAILED: "Invitation token decryption failed",
};

export class InvitationTokenEnvelopeError extends Error {
  readonly code: InvitationTokenEnvelopeErrorCode;

  constructor(code: InvitationTokenEnvelopeErrorCode) {
    super(ERROR_MESSAGES[code]);
    this.name = "InvitationTokenEnvelopeError";
    this.code = code;
    Object.freeze(this);
  }
}

export type InvitationTokenEnvelopeContext = Readonly<{
  organizationId: string;
  invitationId: string;
}>;

function isWellFormedUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const next = value.charCodeAt(index + 1);
      if (next < 0xdc00 || next > 0xdfff) return false;
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function validContextPart(value: unknown): value is string {
  if (typeof value !== "string" || !isWellFormedUnicode(value)) return false;
  const byteLength = Buffer.byteLength(value, "utf8");
  return byteLength >= 1 && byteLength <= MAX_CONTEXT_BYTES;
}

function lengthPrefixed(value: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(value.length);
  return Buffer.concat([length, value]);
}

function contextBytes(context: InvitationTokenEnvelopeContext): Buffer {
  if (!validContextPart(context?.organizationId) || !validContextPart(context?.invitationId)) {
    throw new InvitationTokenEnvelopeError("INVALID_INPUT");
  }
  return Buffer.concat([
    lengthPrefixed(Buffer.from(ENVELOPE_DOMAIN, "utf8")),
    lengthPrefixed(Buffer.from(context.organizationId, "utf8")),
    lengthPrefixed(Buffer.from(context.invitationId, "utf8")),
  ]);
}

function encryptionKey(): Buffer {
  const dedicatedSecret = process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;
  const secret = dedicatedSecret === undefined ? process.env.AUTH_SECRET : dedicatedSecret;
  const secretBytes = typeof secret === "string" && isWellFormedUnicode(secret)
    ? Buffer.byteLength(secret, "utf8")
    : 0;
  if (
    typeof secret !== "string"
    || secret.trim().length === 0
    || secretBytes < MIN_SECRET_BYTES
    || secretBytes > MAX_SECRET_BYTES
  ) {
    throw new InvitationTokenEnvelopeError("SECRET_MISSING");
  }
  return createHash("sha256")
    .update(`${ENVELOPE_DOMAIN}\0key\0`, "utf8")
    .update(secret, "utf8")
    .digest();
}

function decodeCanonicalBase64Url(value: string, expectedBytes?: number): Buffer | null {
  try {
    const decoded = Buffer.from(value, "base64url");
    if (decoded.toString("base64url") !== value) return null;
    if (expectedBytes !== undefined && decoded.length !== expectedBytes) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function isInvitationTokenCiphertextEnvelope(value: unknown): value is string {
  if (typeof value !== "string" || value.length > MAX_CIPHERTEXT_LENGTH) return false;
  const match = ENVELOPE_PATTERN.exec(value);
  if (!match) return false;
  const iv = decodeCanonicalBase64Url(match[1]!, IV_BYTES);
  const encrypted = decodeCanonicalBase64Url(match[2]!);
  const tag = decodeCanonicalBase64Url(match[3]!, TAG_BYTES);
  return iv !== null
    && encrypted !== null
    && encrypted.length >= 1
    && encrypted.length <= MAX_TOKEN_BYTES
    && tag !== null;
}

export function encryptInvitationToken(
  token: string,
  context: InvitationTokenEnvelopeContext,
): string {
  const tokenBytes = typeof token === "string" ? Buffer.from(token, "utf8") : Buffer.alloc(0);
  if (tokenBytes.length < 1 || tokenBytes.length > MAX_TOKEN_BYTES) {
    throw new InvitationTokenEnvelopeError("INVALID_INPUT");
  }
  const aad = contextBytes(context);
  try {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
    cipher.setAAD(aad);
    const encrypted = Buffer.concat([cipher.update(tokenBytes), cipher.final()]);
    const tag = cipher.getAuthTag();
    const envelope = [
      ENVELOPE_VERSION,
      iv.toString("base64url"),
      encrypted.toString("base64url"),
      tag.toString("base64url"),
    ].join(".");
    if (!isInvitationTokenCiphertextEnvelope(envelope)) {
      throw new InvitationTokenEnvelopeError("ENCRYPTION_FAILED");
    }
    return envelope;
  } catch (error) {
    if (error instanceof InvitationTokenEnvelopeError) throw error;
    throw new InvitationTokenEnvelopeError("ENCRYPTION_FAILED");
  }
}

export function decryptInvitationToken(
  envelope: string,
  context: InvitationTokenEnvelopeContext,
): string {
  if (!isInvitationTokenCiphertextEnvelope(envelope)) {
    throw new InvitationTokenEnvelopeError("INVALID_INPUT");
  }
  const aad = contextBytes(context);
  const [, ivPart, encryptedPart, tagPart] = envelope.split(".");
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(ivPart!, "base64url"),
    );
    decipher.setAAD(aad);
    decipher.setAuthTag(Buffer.from(tagPart!, "base64url"));
    const plaintext = Buffer.concat([
      decipher.update(Buffer.from(encryptedPart!, "base64url")),
      decipher.final(),
    ]);
    if (plaintext.length < 1 || plaintext.length > MAX_TOKEN_BYTES) {
      throw new InvitationTokenEnvelopeError("DECRYPTION_FAILED");
    }
    return plaintext.toString("utf8");
  } catch (error) {
    if (error instanceof InvitationTokenEnvelopeError) throw error;
    throw new InvitationTokenEnvelopeError("DECRYPTION_FAILED");
  }
}
