import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";
import { createHash } from "node:crypto";

import { hashInvitationToken } from "@/lib/invitations";

const peopleActions = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");
const invitationDeliveryService = readFileSync(
  new URL("../../../lib/organization-setup/invitation-delivery-service.ts", import.meta.url),
  "utf8",
);
const inviteActions = readFileSync(new URL("../../invite/[token]/actions.ts", import.meta.url), "utf8");
const onboardingPage = readFileSync(new URL("../../onboarding/page.tsx", import.meta.url), "utf8");
const appLayout = readFileSync(new URL("../layout.tsx", import.meta.url), "utf8");

describe("RTW1-S1 invitations and onboarding", () => {
  test("invitation tokens are hashed and plaintext is not persisted", () => {
    assert.equal(hashInvitationToken("plain-token"), createHash("sha256").update("plain-token").digest("hex"));
    assert.match(peopleActions, /randomBytes\(32\)\.toString\("base64url"\)/);
    assert.match(peopleActions, /randomUUID\(\)/);
    assert.match(peopleActions, /tokenHash/);
    assert.match(peopleActions, /encryptInvitationToken\(token, \{/);
    assert.match(peopleActions, /tokenCiphertext/);
    assert.match(peopleActions, /createInvitationForDelivery\(\{/);
    assert.doesNotMatch(peopleActions.replaceAll("\n", " "), /data:\s*\{[^}]*token,/);
    assert.doesNotMatch(peopleActions, /targetUrl:\s*`\/invite\/\$\{token\}`/);
    assert.doesNotMatch(peopleActions, /sendInvitationEmail/);
    assert.doesNotMatch(peopleActions, /organizationInvitation\.create/);
  });

  test("invitation creation is admin-only and ORG_MEMBER-only", () => {
    assert.match(invitationDeliveryService, /membershipRole !== "ORG_ADMIN"/);
    assert.match(invitationDeliveryService, /'ORG_MEMBER'/);
    assert.match(peopleActions, /只有组织管理员可以邀请成员/);
  });

  test("invitation links include the configured application base path", () => {
    assert.match(peopleActions, /withBasePath\(`\/invite\/\$\{token\}`\)/);
    assert.match(peopleActions, /return \{ link: invitationPath \}/);
  });

  test("acceptance handles new and existing user paths without creating an organization", () => {
    assert.match(inviteActions, /tx\.user\.create/);
    assert.match(inviteActions, /tx\.user\.findUnique\(\{ where: \{ id: userId \}/);
    assert.match(inviteActions, /tx\.membership\.upsert/);
    assert.match(inviteActions, /tx\.person\.create/);
    assert.doesNotMatch(inviteActions, /organization\.create/);
  });

  test("expired revoked consumed email mismatch and cross-org existing person deny before terminal consume", () => {
    assert.match(inviteActions, /invitation\.revokedAt/);
    assert.match(inviteActions, /invitation\.consumedAt/);
    assert.match(inviteActions, /invitation\.expiresAt\.getTime\(\) <= Date\.now\(\)/);
    assert.match(inviteActions, /当前登录邮箱与邀请邮箱不一致/);
    assert.match(inviteActions, /existingPerson\.organizationId !== invitation\.organizationId/);
    assert.match(inviteActions, /consumedAt: null/);
  });

  test("authenticated orphan sessions have a recoverable onboarding route", () => {
    assert.match(appLayout, /redirect\("\/onboarding"\)/);
    assert.match(onboardingPage, /getCurrentPerson/);
    assert.match(onboardingPage, /organizationInvitation\.findMany/);
    assert.match(onboardingPage, /href="\/register"/);
  });
});
