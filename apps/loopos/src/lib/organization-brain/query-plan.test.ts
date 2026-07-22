import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type { ActorContext } from "../authorization/actor-context-resolver";
import {
  BRAIN_QUERY_CATALOG,
  BRAIN_QUERY_RESOURCES,
  BrainQueryPlanError,
  parseBrainQueryPlan,
  type BrainQueryPlanErrorCode,
} from "./query-plan";

const actor: ActorContext = {
  organizationId: "org-a",
  userId: "user-a",
  personId: "person-a",
  membershipRole: "ORG_MEMBER",
  homeCircleId: "circle-home",
  assignedActiveRoleDefIds: ["role-a", "role-b"],
  ledActiveCircleIds: ["circle-led"],
};

function rejectsPlan(
  input: unknown,
  code: BrainQueryPlanErrorCode,
  context = actor,
): void {
  assert.throws(
    () => parseBrainQueryPlan(input, context),
    (error) => error instanceof BrainQueryPlanError && error.code === code,
  );
}

describe("V5-M1-C immutable query catalog", () => {
  test("covers the accepted read resources with fixed projections", () => {
    assert.equal(BRAIN_QUERY_RESOURCES.length, 22);
    assert.deepEqual(Object.keys(BRAIN_QUERY_CATALOG), [...BRAIN_QUERY_RESOURCES]);
    assert.equal(Object.isFrozen(BRAIN_QUERY_CATALOG), true);

    for (const resource of BRAIN_QUERY_RESOURCES) {
      const definition = BRAIN_QUERY_CATALOG[resource];
      assert.equal(Object.isFrozen(definition), true);
      assert.equal(Object.isFrozen(definition.fields), true);
      assert.equal(Object.isFrozen(definition.projection), true);
      assert.deepEqual(definition.projection, Object.keys(definition.fields));
      assert.ok(definition.projection.includes(definition.recordIdField));
      assert.ok(
        definition.displayFields.every((field) =>
          definition.projection.includes(field),
        ),
      );
      assert.match(definition.view, /^brain_read\.[a-z_]+$/);
      assert.equal(
        definition.sourceVersionField === null ||
          definition.projection.includes(definition.sourceVersionField),
        true,
      );
    }
  });

  test("defines the exact V5-M3-B Goal read catalog", () => {
    const goalResources = [
      "goalCycles",
      "goals",
      "goalTargets",
      "goalEffectiveCheckIns",
      "goalActiveWorkLinks",
    ] as const;
    assert.deepEqual(BRAIN_QUERY_RESOURCES.slice(-5), goalResources);

    const expected = {
      goalCycles: {
        view: "brain_read.goal_cycles",
        fields: [
          ["organizationId", "id", false, ["eq", "in"], false],
          ["id", "id", false, ["eq", "in"], true],
          ["name", "string", false, ["eq", "in", "contains"], true],
          ["status", "string", false, ["eq", "in"], false],
          ["startAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], true],
          ["endAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], true],
          ["checkInCadenceDays", "number", false, ["eq", "in", "gt", "gte", "lt", "lte"], true],
          ["sourceVersionAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], true],
        ],
        displayFields: ["name", "status", "startAt", "endAt", "checkInCadenceDays"],
        defaultSort: [{ field: "startAt", direction: "desc" }, { field: "id", direction: "asc" }],
        relations: { goals: ["goals", '"relation"."cycleId" = "record"."id"'] },
        linkRule: "goal-cycle",
      },
      goals: {
        view: "brain_read.goals",
        fields: [
          ["organizationId", "id", false, ["eq", "in"], false],
          ["id", "id", false, ["eq", "in"], true],
          ["cycleId", "id", false, ["eq", "in"], false],
          ["circleId", "id", false, ["eq", "in"], false],
          ["title", "string", false, ["eq", "in", "contains"], false],
          ["intendedOutcome", "string", false, [], false],
          ["ownerRoleId", "id", false, ["eq", "in"], false],
          ["parentGoalId", "id", true, ["eq", "in"], false],
          ["status", "string", false, ["eq", "in"], false],
          ["createdAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], true],
          ["adoptedMeetingId", "id", false, ["eq", "in"], false],
          ["adoptedAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], false],
          ["terminalOutcome", "string", true, ["eq", "in"], false],
          ["terminalMeetingId", "id", true, ["eq", "in"], false],
          ["terminalAt", "datetime", true, ["eq", "in", "gt", "gte", "lt", "lte"], false],
          ["sourceVersionAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], false],
        ],
        displayFields: ["title", "intendedOutcome", "status", "createdAt", "adoptedAt", "terminalOutcome", "terminalAt"],
        defaultSort: [{ field: "createdAt", direction: "asc" }, { field: "id", direction: "asc" }],
        relations: {
          goalCycles: ["goalCycles", '"relation"."id" = "record"."cycleId"'],
          circles: ["circles", '"relation"."id" = "record"."circleId"'],
          roleDefinitions: ["roleDefinitions", '"relation"."id" = "record"."ownerRoleId"'],
          goals: ["goals", '"relation"."id" = "record"."parentGoalId"'],
        },
        linkRule: "goal",
      },
      goalTargets: {
        view: "brain_read.goal_targets",
        fields: [
          ["organizationId", "id", false, ["eq", "in"], false],
          ["id", "id", false, ["eq", "in"], true],
          ["cycleId", "id", false, ["eq", "in"], false],
          ["goalId", "id", false, ["eq", "in"], false],
          ["position", "number", false, ["eq", "in", "gt", "gte", "lt", "lte"], true],
          ["label", "string", false, ["eq", "in", "contains"], false],
          ["kind", "string", false, ["eq", "in"], false],
          ["baselineValue", "string", true, [], false],
          ["desiredValue", "string", true, [], false],
          ["unit", "string", true, [], false],
          ["acceptanceCriteria", "string", true, [], false],
          ["metricId", "id", true, ["eq", "in"], false],
          ["createdAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], false],
          ["sourceVersionAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], false],
        ],
        displayFields: ["position", "label", "kind", "baselineValue", "desiredValue", "unit", "acceptanceCriteria", "createdAt"],
        defaultSort: [{ field: "position", direction: "asc" }, { field: "id", direction: "asc" }],
        relations: { goals: ["goals", '"relation"."id" = "record"."goalId"'] },
        linkRule: "goal",
      },
      goalEffectiveCheckIns: {
        view: "brain_read.goal_effective_check_ins",
        fields: [
          ["organizationId", "id", false, ["eq", "in"], false],
          ["id", "id", false, ["eq", "in"], true],
          ["cycleId", "id", false, ["eq", "in"], false],
          ["goalId", "id", false, ["eq", "in"], false],
          ["targetId", "id", false, ["eq", "in"], false],
          ["fact", "string", false, [], false],
          ["evidenceSummary", "string", false, [], false],
          ["currentValue", "string", true, [], false],
          ["milestoneState", "string", true, ["eq", "in"], false],
          ["acceptanceEvidence", "string", true, [], false],
          ["assessment", "string", false, ["eq", "in"], false],
          ["recorderId", "id", false, ["eq", "in"], false],
          ["meetingId", "id", true, ["eq", "in"], false],
          ["recordedAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], true],
          ["sourceVersionAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], false],
        ],
        displayFields: ["fact", "evidenceSummary", "currentValue", "milestoneState", "acceptanceEvidence", "assessment", "recordedAt"],
        defaultSort: [{ field: "recordedAt", direction: "desc" }, { field: "id", direction: "desc" }],
        relations: {
          goals: ["goals", '"relation"."id" = "record"."goalId"'],
          goalTargets: ["goalTargets", '"relation"."id" = "record"."targetId"'],
        },
        linkRule: "goal",
      },
      goalActiveWorkLinks: {
        view: "brain_read.goal_active_work_links",
        fields: [
          ["organizationId", "id", false, ["eq", "in"], false],
          ["id", "id", false, ["eq", "in"], true],
          ["cycleId", "id", false, ["eq", "in"], false],
          ["goalId", "id", false, ["eq", "in"], false],
          ["kind", "string", false, ["eq", "in"], false],
          ["projectId", "id", true, ["eq", "in"], false],
          ["tensionId", "id", true, ["eq", "in"], false],
          ["objectLabel", "string", false, ["eq", "in", "contains"], false],
          ["objectStatus", "string", false, ["eq", "in"], false],
          ["createdAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], true],
          ["sourceVersionAt", "datetime", false, ["eq", "in", "gt", "gte", "lt", "lte"], false],
        ],
        displayFields: ["kind", "objectLabel", "objectStatus", "createdAt"],
        defaultSort: [{ field: "createdAt", direction: "desc" }, { field: "id", direction: "asc" }],
        relations: {
          goals: ["goals", '"relation"."id" = "record"."goalId"'],
          projects: ["projects", '"relation"."id" = "record"."projectId"'],
          unresolvedTensions: ["unresolvedTensions", '"relation"."id" = "record"."tensionId"'],
        },
        linkRule: "goal-work-link",
      },
    } as const;

    for (const resource of goalResources) {
      const definition = BRAIN_QUERY_CATALOG[resource];
      const contract = expected[resource];
      assert.equal(definition.view, contract.view);
      assert.equal(definition.sourceVersionField, "sourceVersionAt");
      assert.deepEqual(
        definition.projection.map((name) => {
          const field = definition.fields[name]!;
          assert.equal(field.column, `"${name}"`);
          return [name, field.type, field.nullable, [...field.filters], field.sortable];
        }),
        contract.fields,
      );
      assert.deepEqual(definition.displayFields, contract.displayFields);
      assert.equal(definition.recordIdField, "id");
      assert.deepEqual(definition.defaultSort, contract.defaultSort);
      assert.deepEqual(
        Object.fromEntries(
          Object.entries(definition.relations).map(([name, relation]) => [
            name,
            [relation.resource, relation.on],
          ]),
        ),
        contract.relations,
      );
      assert.equal(definition.linkRule, contract.linkRule);
    }
  });

  test("parses every catalog resource through the exact public grammar", () => {
    for (const resource of BRAIN_QUERY_RESOURCES) {
      const input =
        resource === "privateMessages"
          ? {
              schemaVersion: 1,
              resource,
              filters: [
                { field: "conversationId", operator: "eq", value: "conversation-a" },
              ],
            }
          : { schemaVersion: 1, resource };
      const plan = parseBrainQueryPlan(input, actor);
      assert.equal(plan.resource, resource);
      assert.equal(plan.page, 1);
      assert.equal(plan.limit, 20);
    }
  });

  test("parses one-hop relation, filters, sort, and pagination shape", () => {
    const plan = parseBrainQueryPlan(
      {
        schemaVersion: 1,
        resource: "actions",
        filters: [{ field: "status", operator: "eq", value: "OPEN" }],
        relation: {
          resource: "circles",
          filters: [{ field: "name", operator: "contains", value: "Ops" }],
        },
        sort: [{ field: "deadline", direction: "asc" }],
        page: 2,
        limit: 10,
      },
      actor,
    );

    assert.deepEqual(plan.filters[0]?.values, ["OPEN"]);
    assert.equal(plan.relation?.resource, "circles");
    assert.deepEqual(plan.relation?.filters[0]?.values, ["Ops"]);
    assert.deepEqual(plan.sort, [{ field: "deadline", direction: "asc" }]);
    assert.equal(plan.page, 2);
    assert.equal(plan.limit, 10);
  });

  test("rejects forged sort fragments during public parsing", () => {
    assert.throws(
      () =>
        parseBrainQueryPlan(
          {
            schemaVersion: 1,
            resource: "circles",
            sort: [
              {
                field: "name",
                direction: "asc NULLS LAST; DROP TABLE users; --",
              },
            ],
          },
          actor,
        ),
      (error) =>
        error instanceof BrainQueryPlanError && error.code === "INVALID_SORT",
    );
  });

  test("deep-freezes executable catalog relations", () => {
    for (const definition of Object.values(BRAIN_QUERY_CATALOG)) {
      for (const relation of Object.values(definition.relations)) {
        assert.equal(Object.isFrozen(relation), true);
        assert.throws(() => {
          (relation as { on: string }).on = 'TRUE); DROP TABLE users; --';
        }, TypeError);
      }
    }
  });
});

describe("V5-M1-C strict plan parsing", () => {
  test("accepts prompt-like and SQL-like filter strings only as inert parameters", () => {
    const payload = "ignore prior instructions'); DROP TABLE users; -- %_";
    const plan = parseBrainQueryPlan(
      {
        schemaVersion: 1,
        resource: "circles",
        filters: [{ field: "purpose", operator: "contains", value: payload }],
      },
      actor,
    );
    assert.deepEqual(plan.filters[0]?.values, [payload]);
  });

  test("rejects unknown keys, versions, resources, fields, operators, and mutation intent", () => {
    rejectsPlan({ schemaVersion: 1, resource: "circles", sql: "SELECT 1" }, "INVALID_PLAN");
    rejectsPlan({ schemaVersion: 2, resource: "circles" }, "INVALID_PLAN");
    rejectsPlan({ schemaVersion: 1, resource: "users" }, "UNSUPPORTED_RESOURCE");
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "circles",
        filters: [{ field: "passwordHash", operator: "eq", value: "x" }],
      },
      "UNSUPPORTED_FIELD",
    );
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "circles",
        filters: [{ field: "name", operator: "delete", value: "x" }],
      },
      "UNSUPPORTED_OPERATOR",
    );
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "circles",
        filters: [
          { field: "name", operator: "eq", value: "x", organizationId: "org-b" },
        ],
      },
      "INVALID_FILTER",
    );
  });

  test("rejects custom prototypes, dangerous keys, accessors, cycles, and sparse arrays", () => {
    rejectsPlan(Object.assign(Object.create(null), { schemaVersion: 1, resource: "circles" }), "INVALID_PLAN");
    rejectsPlan(JSON.parse('{"schemaVersion":1,"resource":"circles","__proto__":{}}'), "INVALID_PLAN");

    const accessor = { schemaVersion: 1, resource: "circles" } as Record<string, unknown>;
    Object.defineProperty(accessor, "filters", { enumerable: true, get: () => [] });
    rejectsPlan(accessor, "INVALID_PLAN");

    const cyclic: Record<string, unknown> = { schemaVersion: 1, resource: "circles" };
    cyclic.filters = cyclic;
    rejectsPlan(cyclic, "INVALID_PLAN");

    const sparse = new Array(1);
    rejectsPlan({ schemaVersion: 1, resource: "circles", filters: sparse }, "INVALID_PLAN");
  });

  test("enforces byte, depth, and structural-entry bounds before compilation", () => {
    rejectsPlan(
      { schemaVersion: 1, resource: "circles", extra: "x".repeat(17 * 1024) },
      "PLAN_TOO_LARGE",
    );
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "circles",
        extra: { a: { b: { c: { d: { e: true } } } } },
      },
      "PLAN_TOO_DEEP",
    );
    const complex: Record<string, unknown> = { schemaVersion: 1, resource: "circles" };
    for (let index = 0; index < 130; index += 1) complex[`x${index}`] = index;
    rejectsPlan(complex, "PLAN_TOO_COMPLEX");
  });

  test("rejects a huge sparse array before descriptor materialization", () => {
    let ownKeysCalls = 0;
    const sparse = new Proxy(new Array(10_000_000), {
      ownKeys() {
        ownKeysCalls += 1;
        throw new Error("array descriptors must not be materialized");
      },
    });

    rejectsPlan(
      { schemaVersion: 1, resource: "circles", filters: sparse },
      "PLAN_TOO_COMPLEX",
    );
    assert.equal(ownKeysCalls, 0);
  });

  test("rejects an oversized prompt before inspecting later properties", () => {
    let poisonDescriptorReads = 0;
    const target = {
      schemaVersion: 1,
      resource: "circles",
      filters: [
        {
          field: "purpose",
          operator: "contains",
          value: "prompt".repeat(3_000),
        },
      ],
      poison: true,
    };
    const input = new Proxy(target, {
      getOwnPropertyDescriptor(object, property) {
        if (property === "poison") {
          poisonDescriptorReads += 1;
          throw new Error("later descriptor must not be read");
        }
        return Reflect.getOwnPropertyDescriptor(object, property);
      },
    });

    rejectsPlan(input, "PLAN_TOO_LARGE");
    assert.equal(poisonDescriptorReads, 0);
  });

  test("fuzzes malformed primitive, collection, and object inputs without accepting any", () => {
    const malformed: unknown[] = [
      null,
      undefined,
      true,
      1,
      NaN,
      "circles",
      [],
      [1, 2],
      {},
      { schemaVersion: 1 },
      { resource: "circles" },
      { schemaVersion: 1, resource: [] },
      { schemaVersion: 1, resource: "circles", filters: {} },
      { schemaVersion: 1, resource: "circles", sort: [null] },
      { schemaVersion: 1, resource: "circles", page: 1.5 },
      { schemaVersion: 1, resource: "circles", limit: "10" },
    ];
    for (const input of malformed) {
      assert.throws(() => parseBrainQueryPlan(input, actor), BrainQueryPlanError);
    }
  });
});

describe("V5-M1-C bounds, cost, pagination, and actor references", () => {
  test("enforces filter, relation-filter, in-list, sort, page, and limit bounds", () => {
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "circles",
        filters: Array.from({ length: 9 }, (_, index) => ({
          field: "name",
          operator: "eq",
          value: `circle-${index}`,
        })),
      },
      "INVALID_FILTER",
    );
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "actions",
        relation: {
          resource: "circles",
          filters: Array.from({ length: 4 }, () => ({
            field: "name",
            operator: "eq",
            value: "Ops",
          })),
        },
      },
      "INVALID_FILTER",
    );
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "circles",
        filters: [
          {
            field: "id",
            operator: "in",
            value: Array.from({ length: 21 }, (_, index) => `circle-${index}`),
          },
        ],
      },
      "INVALID_FILTER",
    );
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "circles",
        sort: [
          { field: "name", direction: "asc" },
          { field: "status", direction: "asc" },
          { field: "number", direction: "asc" },
        ],
      },
      "INVALID_SORT",
    );
    rejectsPlan({ schemaVersion: 1, resource: "circles", page: 0 }, "INVALID_PAGE");
    rejectsPlan({ schemaVersion: 1, resource: "circles", page: 11 }, "INVALID_PAGE");
    rejectsPlan({ schemaVersion: 1, resource: "circles", limit: 0 }, "INVALID_LIMIT");
    rejectsPlan({ schemaVersion: 1, resource: "circles", limit: 51 }, "INVALID_LIMIT");
  });

  test("accepts the maximum page window", () => {
    const plan = parseBrainQueryPlan(
      { schemaVersion: 1, resource: "projects", page: 10, limit: 50 },
      actor,
    );
    assert.equal(plan.page * plan.limit, 500);
  });

  test("rejects estimated cost above 64", () => {
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "circles",
        filters: Array.from({ length: 8 }, (_, index) => ({
          field: index % 2 === 0 ? "purpose" : "domain",
          operator: "contains",
          value: `term-${index}`,
        })),
      },
      "QUERY_TOO_EXPENSIVE",
    );
  });

  test("expands only canonical actor references and caps expanded lists at 50", () => {
    const plan = parseBrainQueryPlan(
      {
        schemaVersion: 1,
        resource: "roleDefinitions",
        filters: [
          {
            field: "id",
            operator: "in",
            value: { actorRef: "assignedActiveRoleDefIds" },
          },
          {
            field: "circleId",
            operator: "eq",
            value: { actorRef: "homeCircleId" },
          },
        ],
      },
      actor,
    );
    assert.deepEqual(plan.filters[0]?.values, ["role-a", "role-b"]);
    assert.deepEqual(plan.filters[1]?.values, ["circle-home"]);

    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "roleDefinitions",
        filters: [
          {
            field: "id",
            operator: "in",
            value: { actorRef: "assignedActiveRoleDefIds" },
          },
        ],
      },
      "ACTOR_REFERENCE_LIMIT",
      {
        ...actor,
        assignedActiveRoleDefIds: Array.from(
          { length: 51 },
          (_, index) => `role-${index}`,
        ),
      },
    );
  });

  test("rejects actor references on incompatible fields or operators", () => {
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "projects",
        filters: [
          { field: "id", operator: "eq", value: { actorRef: "personId" } },
        ],
      },
      "INVALID_FILTER",
    );
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "circles",
        filters: [
          {
            field: "id",
            operator: "eq",
            value: { actorRef: "ledActiveCircleIds" },
          },
        ],
      },
      "INVALID_FILTER",
    );
  });

  test("requires exactly one private conversation equality filter", () => {
    rejectsPlan(
      { schemaVersion: 1, resource: "privateMessages" },
      "PRIVATE_MESSAGE_SCOPE_REQUIRED",
    );
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "privateMessages",
        filters: [
          { field: "conversationId", operator: "in", value: ["conversation-a"] },
        ],
      },
      "PRIVATE_MESSAGE_SCOPE_REQUIRED",
    );
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "privateMessages",
        filters: [
          { field: "conversationId", operator: "eq", value: "conversation-a" },
          { field: "conversationId", operator: "eq", value: "conversation-b" },
        ],
      },
      "PRIVATE_MESSAGE_SCOPE_REQUIRED",
    );
    rejectsPlan(
      {
        schemaVersion: 1,
        resource: "privateMessages",
        filters: [
          { field: "conversationId", operator: "eq", value: "conversation-a" },
          {
            field: "conversationId",
            operator: "in",
            value: ["conversation-a"],
          },
        ],
      },
      "PRIVATE_MESSAGE_SCOPE_REQUIRED",
    );
  });

  test("keeps opaque foreign IDs indistinguishable as ordinary parameters", () => {
    const plan = parseBrainQueryPlan(
      {
        schemaVersion: 1,
        resource: "projects",
        filters: [{ field: "id", operator: "eq", value: "foreign-record-id" }],
      },
      actor,
    );
    assert.deepEqual(plan.filters[0]?.values, ["foreign-record-id"]);
  });
});
