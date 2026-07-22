import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(new URL("./actions.ts", import.meta.url), "utf8");

test("role applications are separate from current role assignments", () => {
  assert.match(source, /roleAssignmentApplication\.create/);
  assert.match(source, /organizationId/);
  assert.match(source, /applicantId/);
  assert.doesNotMatch(source, /roleDef\.update|role\.update/);
  assert.doesNotMatch(source, /assignees\s*:/);
});

test("withdrawal is scoped to the applicant, organization, and pending state", () => {
  assert.match(source, /where:\s*\{ id: applicationId, organizationId, applicantId: person\.id, status: "PENDING" \}/);
  assert.match(source, /status: "WITHDRAWN"/);
});
