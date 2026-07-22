import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import { after, afterEach, before, describe, test } from "node:test";

type EnvelopeModule = typeof import("./invitation-token-envelope");

const require = createRequire(import.meta.url);
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let envelope: EnvelopeModule;
const originalInvitationSecret = process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;
const originalAuthSecret = process.env.AUTH_SECRET;

before(async () => {
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  envelope = await import("./invitation-token-envelope");
  process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = "dedicated-invitation-secret-for-tests";
  delete process.env.AUTH_SECRET;
});

after(() => {
  if (originalInvitationSecret === undefined) delete process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;
  else process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = originalInvitationSecret;
  if (originalAuthSecret === undefined) delete process.env.AUTH_SECRET;
  else process.env.AUTH_SECRET = originalAuthSecret;
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
});

afterEach(() => {
  process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = "dedicated-invitation-secret-for-tests";
  delete process.env.AUTH_SECRET;
});

const context = { organizationId: "organization-1", invitationId: "invitation-1" };

function envelopeError(code: EnvelopeModule["INVITATION_TOKEN_ENVELOPE_ERROR_CODES"][number]) {
  return (error: unknown) => {
    assert.ok(error instanceof envelope.InvitationTokenEnvelopeError);
    assert.equal(error.code, code);
    assert.doesNotMatch(error.message, /dedicated|plain-token|secret/i);
    return true;
  };
}

describe("invitation token envelope", () => {
  test("round trips with a random IV and excludes plaintext", () => {
    const token = "plain-token-that-must-not-appear";
    const first = envelope.encryptInvitationToken(token, context);
    const second = envelope.encryptInvitationToken(token, context);
    assert.notEqual(first, second);
    assert.equal(envelope.decryptInvitationToken(first, context), token);
    assert.equal(envelope.decryptInvitationToken(second, context), token);
    assert.ok(envelope.isInvitationTokenCiphertextEnvelope(first));
    assert.doesNotMatch(first, new RegExp(token));
  });

  test("binds authentication to organization and invitation identity", () => {
    const encrypted = envelope.encryptInvitationToken("bound-token", context);
    for (const wrongContext of [
      { ...context, organizationId: "organization-2" },
      { ...context, invitationId: "invitation-2" },
    ]) {
      assert.throws(
        () => envelope.decryptInvitationToken(encrypted, wrongContext),
        envelopeError("DECRYPTION_FAILED"),
      );
    }
  });

  test("uses collision-free AAD for contexts containing NUL", () => {
    const originalContext = { organizationId: "a", invitationId: "b\0c" };
    const collidingUnderDelimitedEncoding = { organizationId: "a\0b", invitationId: "c" };
    const encrypted = envelope.encryptInvitationToken("nul-bound-token", originalContext);
    assert.equal(envelope.decryptInvitationToken(encrypted, originalContext), "nul-bound-token");
    assert.throws(
      () => envelope.decryptInvitationToken(encrypted, collidingUnderDelimitedEncoding),
      envelopeError("DECRYPTION_FAILED"),
    );
  });

  test("bounds context by well-formed UTF-8 bytes", () => {
    const exactly512Bytes = `${"界".repeat(170)}aa`;
    const over512Bytes = `${exactly512Bytes}a`;
    assert.equal(Buffer.byteLength(exactly512Bytes, "utf8"), 512);
    assert.equal(Buffer.byteLength(over512Bytes, "utf8"), 513);
    const boundaryContext = { organizationId: exactly512Bytes, invitationId: "invitation" };
    const encrypted = envelope.encryptInvitationToken("boundary-token", boundaryContext);
    assert.equal(envelope.decryptInvitationToken(encrypted, boundaryContext), "boundary-token");

    for (const invalidOrganizationId of [over512Bytes, "\ud800", "\udc00"]) {
      assert.throws(
        () => envelope.encryptInvitationToken("token", {
          organizationId: invalidOrganizationId,
          invitationId: "invitation",
        }),
        envelopeError("INVALID_INPUT"),
      );
    }
  });

  test("rejects tampering, malformed input, and oversize values with fixed errors", () => {
    const encrypted = envelope.encryptInvitationToken("tamper-token", context);
    const tamperedParts = encrypted.split(".");
    const encryptedPart = tamperedParts[2]!;
    tamperedParts[2] = `${encryptedPart[0] === "A" ? "B" : "A"}${encryptedPart.slice(1)}`;
    const tampered = tamperedParts.join(".");
    assert.throws(
      () => envelope.decryptInvitationToken(tampered, context),
      envelopeError("DECRYPTION_FAILED"),
    );
    for (const malformed of ["", "v2.a.b.c", `v1.${"A".repeat(2_100)}`]) {
      assert.equal(envelope.isInvitationTokenCiphertextEnvelope(malformed), false);
      assert.throws(
        () => envelope.decryptInvitationToken(malformed, context),
        envelopeError("INVALID_INPUT"),
      );
    }
    assert.throws(
      () => envelope.encryptInvitationToken("x".repeat(1_025), context),
      envelopeError("INVALID_INPUT"),
    );
    assert.throws(
      () => envelope.encryptInvitationToken("token", { ...context, invitationId: "x".repeat(513) }),
      envelopeError("INVALID_INPUT"),
    );
  });

  test("enforces secret strength by well-formed UTF-8 bytes", () => {
    for (const invalidSecret of [
      "x",
      "x".repeat(31),
      " ".repeat(32),
      "x".repeat(4_097),
      `${"密".repeat(10)}a`,
    ]) {
      process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = invalidSecret;
      assert.throws(
        () => envelope.encryptInvitationToken("token", context),
        envelopeError("SECRET_MISSING"),
      );
    }

    for (const validSecret of [
      "x".repeat(32),
      `${"密".repeat(10)}ab`,
      "x".repeat(4_096),
    ]) {
      process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = validSecret;
      const encrypted = envelope.encryptInvitationToken("token", context);
      assert.equal(envelope.decryptInvitationToken(encrypted, context), "token");
    }
    assert.equal(Buffer.byteLength(`${"密".repeat(10)}a`, "utf8"), 31);
    assert.equal(Buffer.byteLength(`${"密".repeat(10)}ab`, "utf8"), 32);
  });

  test("uses AUTH_SECRET fallback but fails closed for an invalid dedicated secret", () => {
    delete process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;
    process.env.AUTH_SECRET = "fallback-auth-secret-that-is-long-enough";
    const encrypted = envelope.encryptInvitationToken("fallback-token", context);
    assert.equal(envelope.decryptInvitationToken(encrypted, context), "fallback-token");

    process.env.INVITATION_TOKEN_ENCRYPTION_SECRET = "invalid";
    assert.throws(
      () => envelope.encryptInvitationToken("token", context),
      envelopeError("SECRET_MISSING"),
    );

    delete process.env.INVITATION_TOKEN_ENCRYPTION_SECRET;
    delete process.env.AUTH_SECRET;
    assert.throws(
      () => envelope.encryptInvitationToken("token", context),
      envelopeError("SECRET_MISSING"),
    );
  });
});
