import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BRAIN_QUERY_CATALOG,
  BRAIN_QUERY_RESOURCES,
} from "./query-plan";
import {
  ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG,
  ORGANIZATION_BRAIN_QUERY_PLANNER_LIMITS,
} from "./query-planner-catalog";
import { ORGANIZATION_BRAIN_RESOURCE_LABELS } from "./response-schema";

function walk(
  value: unknown,
  visit: (key: string | null, value: unknown) => void,
  key: string | null = null,
): void {
  visit(key, value);
  if (Array.isArray(value)) {
    for (const entry of value) walk(entry, visit);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [entryKey, entryValue] of Object.entries(value)) {
      walk(entryValue, visit, entryKey);
    }
  }
}

function assertDeepFrozen(value: unknown): void {
  walk(value, (_key, entry) => {
    if (typeof entry === "object" && entry !== null) {
      assert.equal(Object.isFrozen(entry), true);
    }
  });
}

describe("V5-M1-D2 safe planner catalog projection", () => {
  test("derives all logical resources and Chinese labels from accepted catalogs", () => {
    assert.equal(ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG.schemaVersion, 1);
    assert.deepEqual(
      ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG.resources.map(
        (resource) => resource.resource,
      ),
      [...BRAIN_QUERY_RESOURCES],
    );

    for (const projected of ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG.resources) {
      assert.equal(
        projected.label,
        ORGANIZATION_BRAIN_RESOURCE_LABELS[projected.resource],
      );
      assert.deepEqual(
        projected.displayFields,
        BRAIN_QUERY_CATALOG[projected.resource].displayFields,
      );
    }
  });

  test("projects only filterable logical metadata and symbolic actor references", () => {
    for (const projected of ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG.resources) {
      const source = BRAIN_QUERY_CATALOG[projected.resource];
      const expected = Object.entries(source.fields)
        .filter(([, field]) => field.filters.length > 0)
        .map(([fieldName, field]) => ({
          field: fieldName,
          type: field.type,
          operators: [...field.filters],
          actorReferences: [...field.actorReferences],
        }));
      assert.deepEqual(projected.filterableFields, expected);
    }
  });

  test("projects only non-ID sortable fields and fixed logical directions", () => {
    for (const projected of ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG.resources) {
      const source = BRAIN_QUERY_CATALOG[projected.resource];
      const expected = Object.entries(source.fields)
        .filter(([, field]) => field.sortable && field.type !== "id")
        .map(([fieldName]) => ({
          field: fieldName,
          directions: ["asc", "desc"],
        }));
      assert.deepEqual(projected.sortableFields, expected);
      assert.equal(
        projected.sortableFields.some(
          (field) => source.fields[field.field]?.type === "id",
        ),
        false,
      );
    }
  });

  test("projects only one-hop relation resource tokens", () => {
    for (const projected of ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG.resources) {
      const expected = Object.values(
        BRAIN_QUERY_CATALOG[projected.resource].relations,
      ).map((relation) => relation.resource);
      assert.deepEqual(projected.relationResources, expected);
    }
  });

  test("publishes the locked D2 and inherited M1-C limits", () => {
    assert.deepEqual(ORGANIZATION_BRAIN_QUERY_PLANNER_LIMITS, {
      maxPlans: 3,
      maxPlanLimit: 10,
      maxTotalRows: 20,
      maxTotalCost: 96,
      pageForbidden: true,
      maxPlanBytes: 16 * 1024,
      maxDepth: 5,
      maxStructuralEntries: 128,
      maxFilters: 8,
      maxRelationFilters: 3,
      maxInValues: 20,
      maxRelations: 1,
      maxSortTerms: 2,
      maxFilterStringBytes: 256,
      maxIdBytes: 191,
      maxExpandedActorReferences: 50,
    });
    assert.equal(
      ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG.limits,
      ORGANIZATION_BRAIN_QUERY_PLANNER_LIMITS,
    );
  });

  test("contains none of the executable M1-C catalog keys", () => {
    const forbiddenKeys = new Set([
      "view",
      "column",
      "projection",
      "recordIdField",
      "defaultSort",
      "on",
      "linkRule",
      "sourceVersionField",
    ]);
    const found: string[] = [];
    walk(ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG, (key) => {
      if (key && forbiddenKeys.has(key)) found.push(key);
    });
    assert.deepEqual(found, []);
  });

  test("contains no executable values, URLs, credentials, or actual actor IDs", () => {
    const actualIds = [
      "org-secret-9f4b",
      "user-secret-3a2c",
      "person-secret-7d1e",
      "circle-secret-8c5f",
      "role-secret-2b6a",
      "conversation-secret-4e0d",
      "record-secret-1c9b",
    ];
    const unsafeStrings: string[] = [];
    const functions: unknown[] = [];

    walk(ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG, (_key, value) => {
      if (typeof value === "function") functions.push(value);
      if (
        typeof value === "string" &&
        (/brain_read|select\s|insert\s|update\s|delete\s|join\s|https?:\/\/|["'=;]/i.test(
          value,
        ) ||
          actualIds.some((id) => value.includes(id)) ||
          /api[_-]?key|credential|password|database_url/i.test(value))
      ) {
        unsafeStrings.push(value);
      }
    });

    assert.deepEqual(functions, []);
    assert.deepEqual(unsafeStrings, []);
  });

  test("is deeply frozen and rejects nested mutation", () => {
    assertDeepFrozen(ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG);
    const firstResource = ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG.resources[0]!;
    const firstField = firstResource.filterableFields[0]!;

    assert.throws(() => {
      (ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG.resources as unknown[]).push({});
    }, TypeError);
    assert.throws(() => {
      (firstField as { field: string }).field = "sql";
    }, TypeError);
    assert.throws(() => {
      (firstField.operators as string[]).push("execute");
    }, TypeError);
  });

  test("serializes as inert logical data without losing metadata", () => {
    const serialized = JSON.stringify(ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG);
    const roundTripped = JSON.parse(serialized);
    assert.deepEqual(roundTripped, ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG);
    assert.ok(Buffer.byteLength(serialized, "utf8") < 64 * 1024);
  });
});
