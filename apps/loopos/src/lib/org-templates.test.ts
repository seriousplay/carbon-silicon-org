import assert from "node:assert/strict";
import { test } from "node:test";
import { allTemplates, functionalTeamTemplate, leanTeamTemplate, professionalServicesTemplate } from "./org-templates";

test("lean team template starts with one circle and three complementary roles", () => {
  assert.equal(leanTeamTemplate.circles.length, 1);
  assert.equal(leanTeamTemplate.circles[0]?.roles.length, 3);
  assert.equal(leanTeamTemplate.interfaces.length, 0);
  assert.ok(allTemplates.some((template) => template.id === "lean-team"));
});

test("general platform exposes distinct non-foundation-model starting templates", () => {
  assert.deepEqual(
    allTemplates.map((template) => template.id),
    ["lean-team", "professional-services", "functional-team", "llm-team"],
  );
  assert.equal(professionalServicesTemplate.circles[1]?.name, "项目交付回路");
  assert.equal(functionalTeamTemplate.circles[1]?.name, "运营回路");
  for (const template of [professionalServicesTemplate, functionalTeamTemplate]) {
    assert.ok(template.circles.some((circle) => circle.isRoot));
    assert.ok(template.circles.some((circle) => circle.roles.length > 0));
    assert.ok(template.description.length > 0);
  }
});

test("templates are starting structures rather than governance decisions", () => {
  for (const template of allTemplates) {
    assert.ok(template.circles.length > 0);
    assert.ok(template.circles.some((circle) => circle.isRoot));
    assert.ok(template.circles.every((circle) => circle.key && circle.name && circle.purpose));
    assert.ok(template.circles.every((circle) => circle.roles.every((role) => role.name && role.accountabilities)));
  }
});
