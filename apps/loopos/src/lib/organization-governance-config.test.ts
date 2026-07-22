import assert from "node:assert/strict";
import { test } from "node:test";
import { defaultOrganizationProfile, organizationRoleCategoryLabel } from "./organization-governance-config";

test("role category labels use the configured organization vocabulary", () => {
  const profile = { ...defaultOrganizationProfile, roleCategories: ["协调者", "专业者", "运营者", "流程引导者"] };
  assert.equal(organizationRoleCategoryLabel(profile, "CIRCLE_LEAD"), "协调者");
  assert.equal(organizationRoleCategoryLabel(profile, "EXPERT"), "专业者");
  assert.equal(organizationRoleCategoryLabel(profile, "UNKNOWN"), "UNKNOWN");
});
