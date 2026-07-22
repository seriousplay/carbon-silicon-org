import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultOrganizationProfile, getOrganizationGovernanceConfig } from "../../../lib/organization-governance-config";

test("organization profile has a neutral custom default", () => {
  assert.equal(defaultOrganizationProfile.organizationType, "CUSTOM");
  assert.equal(defaultOrganizationProfile.meetingCadence, "WEEKLY");
  assert.ok(defaultOrganizationProfile.roleCategories.length > 0);
});

test("governance config derives profile from the versioned rule payload", async () => {
  const original = (await import("../../../lib/db")).prisma.organizationGovernanceConfigVersion.findFirst;
  (await import("../../../lib/db")).prisma.organizationGovernanceConfigVersion.findFirst = (async () => ({
    version: 3,
    terminologyPreferences: { circle: "团队" },
    governanceRules: { organizationProfile: { organizationType: "FUNCTIONAL", meetingCadence: "BIWEEKLY", roleCategories: ["职能"] } },
  })) as unknown as typeof original;
  try {
    const config = await getOrganizationGovernanceConfig("org");
    assert.equal(config.profile.organizationType, "FUNCTIONAL");
    assert.equal(config.profile.meetingCadence, "BIWEEKLY");
    assert.deepEqual(config.profile.roleCategories, ["职能"]);
  } finally {
    (await import("../../../lib/db")).prisma.organizationGovernanceConfigVersion.findFirst = original;
  }
});

test("governance config falls back for malformed profile values", async () => {
  const db = await import("../../../lib/db");
  const original = db.prisma.organizationGovernanceConfigVersion.findFirst;
  db.prisma.organizationGovernanceConfigVersion.findFirst = (async () => ({ version: 4, terminologyPreferences: {}, governanceRules: { organizationProfile: { organizationType: "UNKNOWN", roleCategories: "not-an-array" } } })) as unknown as typeof original;
  try {
    const config = await getOrganizationGovernanceConfig("org");
    assert.equal(config.profile.organizationType, "CUSTOM");
    assert.equal(config.profile.meetingCadence, "WEEKLY");
    assert.deepEqual(config.profile.roleCategories, defaultOrganizationProfile.roleCategories);
  } finally {
    db.prisma.organizationGovernanceConfigVersion.findFirst = original;
  }
});
