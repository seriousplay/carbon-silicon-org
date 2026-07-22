import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const setupPageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const modelFormSource = readFileSync(new URL("./model-settings-form.tsx", import.meta.url), "utf8");

test("setup page exposes the organization brain model settings entry", () => {
  assert.match(setupPageSource, /getOrganizationModelSettingsSummary\(orgId\)/);
  assert.match(setupPageSource, /<ModelSettingsForm summary=\{modelSettings\} canEdit=\{canEditModelSettings\} \/>/);
  assert.match(setupPageSource, /membership\?\.role === "ORG_ADMIN"/);
});

test("model settings form never renders a saved plaintext API key", () => {
  assert.match(modelFormSource, /type="password"/);
  assert.match(modelFormSource, /页面不会显示已保存的明文/);
  assert.doesNotMatch(modelFormSource, /value=\{summary\.[^}]*apiKey/);
});
