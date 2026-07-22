import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  OrganizationBrainPlannerOutputError,
  parseOrganizationBrainPlannerOutput,
  type OrganizationBrainPlannerOutputErrorCode,
} from "./query-planner-schema";

function plan(overrides: Readonly<Record<string, unknown>> = {}): unknown {
  return {
    schemaVersion: 1,
    resource: "circles",
    limit: 5,
    ...overrides,
  };
}

function raw(plans: readonly unknown[]): string {
  return JSON.stringify({ schemaVersion: 1, plans });
}

function rejectsOutput(
  output: unknown,
  code: OrganizationBrainPlannerOutputErrorCode,
): void {
  assert.throws(
    () => parseOrganizationBrainPlannerOutput(output),
    (error) =>
      error instanceof OrganizationBrainPlannerOutputError &&
      error.code === code,
  );
}

function assertDeepFrozen(value: unknown): void {
  if (typeof value !== "object" || value === null) return;
  assert.equal(Object.isFrozen(value), true);
  for (const entry of Object.values(value)) assertDeepFrozen(entry);
}

describe("V5-M1-D2 exact model output schema", () => {
  test("accepts unchanged exact outputs containing zero, one, or three plans", () => {
    for (const count of [0, 1, 3]) {
      const plans = Array.from({ length: count }, (_, index) =>
        plan({ resource: index === 1 ? "projects" : "circles", limit: index + 1 }),
      );
      const parsed = parseOrganizationBrainPlannerOutput(raw(plans));
      assert.deepEqual(parsed, { schemaVersion: 1, plans });
      assert.equal(parsed.plans.some((entry) => "page" in entry), false);
    }
  });

  test("deep-freezes the complete parsed output", () => {
    const parsed = parseOrganizationBrainPlannerOutput(
      raw([
        plan({
          filters: [
            { field: "id", operator: "in", value: ["circle-a", "circle-b"] },
            { field: "leadPersonId", operator: "eq", value: { actorRef: "personId" } },
          ],
          relation: {
            resource: "circles",
            filters: [{ field: "name", operator: "contains", value: "产品" }],
          },
          sort: [{ field: "name", direction: "asc" }],
        }),
      ]),
    );

    assertDeepFrozen(parsed);
    assert.throws(() => {
      (parsed.plans as unknown[]).push(plan());
    }, TypeError);
  });

  test("rejects four plans without salvaging the first three", () => {
    rejectsOutput(raw([plan(), plan(), plan(), plan()]), "PLAN_COUNT_EXCEEDED");
  });

  test("rejects output above 16 KiB before JSON parsing", () => {
    rejectsOutput("{" + "x".repeat(16 * 1024), "OUTPUT_LIMIT_EXCEEDED");
  });

  test("rejects non-string, malformed JSON, Markdown, and prose", () => {
    rejectsOutput(new String(raw([])), "OUTPUT_SCHEMA_INVALID");
    rejectsOutput("{not-json}", "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(`\`\`\`json\n${raw([])}\n\`\`\``, "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(`规划如下：${raw([])}`, "OUTPUT_SCHEMA_INVALID");
  });

  test("rejects direct and JSON-escaped invalid Unicode", () => {
    rejectsOutput(`${raw([])}\ud800`, "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(
      '{"schemaVersion":1,"plans":[{"schemaVersion":1,"resource":"circles","limit":1,"filters":[{"field":"name","operator":"eq","value":"\\ud800"}]}]}',
      "OUTPUT_SCHEMA_INVALID",
    );
  });

  test("requires exact top-level and plan keys and forbids page", () => {
    rejectsOutput(JSON.stringify({ schemaVersion: 1, plans: [], rationale: "x" }), "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(JSON.stringify({ schemaVersion: 1 }), "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(raw([plan({ page: 1 })]), "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(raw([plan({ action: "write" })]), "OUTPUT_SCHEMA_INVALID");
  });

  test("requires exact nested filter, relation, sort, and actor-reference keys", () => {
    rejectsOutput(
      raw([plan({ filters: [{ field: "name", operator: "eq", value: "x", sql: "x" }] })]),
      "OUTPUT_SCHEMA_INVALID",
    );
    rejectsOutput(
      raw([plan({ relation: { resource: "circles", on: "TRUE" } })]),
      "OUTPUT_SCHEMA_INVALID",
    );
    rejectsOutput(
      raw([plan({ sort: [{ field: "name", direction: "asc", nulls: "last" }] })]),
      "OUTPUT_SCHEMA_INVALID",
    );
    rejectsOutput(
      raw([plan({ filters: [{ field: "id", operator: "eq", value: { actorRef: "personId", id: "x" } }] })]),
      "OUTPUT_SCHEMA_INVALID",
    );
  });

  test("requires limit and rejects non-integer limit schema", () => {
    const missing = { schemaVersion: 1, resource: "circles" };
    rejectsOutput(raw([missing]), "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(raw([plan({ limit: "10" })]), "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(raw([plan({ limit: 1.5 })]), "OUTPUT_SCHEMA_INVALID");
  });

  test("maps numeric limit bounds to PLAN_LIMIT_EXCEEDED", () => {
    rejectsOutput(raw([plan({ limit: 0 })]), "PLAN_LIMIT_EXCEEDED");
    rejectsOutput(raw([plan({ limit: 11 })]), "PLAN_LIMIT_EXCEEDED");
  });

  test("rejects wrong collection and primitive member shapes", () => {
    rejectsOutput(JSON.stringify({ schemaVersion: 1, plans: {} }), "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(raw([plan({ filters: {} })]), "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(raw([plan({ filters: [null] })]), "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(raw([plan({ relation: [] })]), "OUTPUT_SCHEMA_INVALID");
    rejectsOutput(raw([plan({ sort: ["name"] })]), "OUTPUT_SCHEMA_INVALID");
  });

  test("accepts only scalar arrays or one exact symbolic actor reference as values", () => {
    const parsed = parseOrganizationBrainPlannerOutput(
      raw([
        plan({
          filters: [
            { field: "id", operator: "in", value: ["a", "b"] },
            { field: "leadPersonId", operator: "eq", value: { actorRef: "personId" } },
          ],
        }),
      ]),
    );
    assert.equal(parsed.plans.length, 1);
    rejectsOutput(
      raw([plan({ filters: [{ field: "id", operator: "eq", value: { id: "x" } }] })]),
      "OUTPUT_SCHEMA_INVALID",
    );
    rejectsOutput(
      raw([plan({ filters: [{ field: "id", operator: "in", value: [["x"]] }] })]),
      "OUTPUT_SCHEMA_INVALID",
    );
  });
});
