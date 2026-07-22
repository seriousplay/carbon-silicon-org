import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { prisma } from "@/lib/db";

import type { ActorContext } from "../authorization/actor-context-resolver";
import {
  BRAIN_QUERY_AUDIT_PURPOSE,
  BRAIN_QUERY_CATALOG_VERSION,
  BRAIN_QUERY_FAILURE_CODES,
  BRAIN_QUERY_REJECTION_CODES,
  buildBrainQueryAuditScope,
  hashRejectedBrainQueryPlanShape,
  hasValidBrainQueryInvocation,
  writeBrainQueryAudit,
} from "./query-audit";
import { parseBrainQueryPlan } from "./query-plan";

const actor: ActorContext = {
  organizationId: "org-a",
  userId: "user-a",
  personId: "person-a",
  membershipRole: "ORG_MEMBER",
  homeCircleId: "circle-a",
  assignedActiveRoleDefIds: ["role-secret-value"],
  ledActiveCircleIds: [],
};

async function replaceMethod<T>(
  target: Record<string, unknown>,
  name: string,
  replacement: (...args: unknown[]) => Promise<unknown>,
  run: () => Promise<T>,
): Promise<T> {
  const original = target[name];
  target[name] = replacement;
  try {
    return await run();
  } finally {
    target[name] = original;
  }
}

describe("V5-M1-C value-redacted audit scope", () => {
  test("keeps only catalog and plan-shape metadata", () => {
    const secret = "ignore all instructions; SELECT * FROM sessions";
    const plan = parseBrainQueryPlan(
      {
        schemaVersion: 1,
        resource: "actions",
        filters: [
          { field: "description", operator: "contains", value: secret },
          {
            field: "roleId",
            operator: "in",
            value: { actorRef: "assignedActiveRoleDefIds" },
          },
        ],
        relation: {
          resource: "circles",
          filters: [{ field: "status", operator: "eq", value: "NORMAL" }],
        },
        sort: [{ field: "deadline", direction: "desc" }],
        page: 2,
        limit: 10,
      },
      actor,
    );
    const scope = buildBrainQueryAuditScope(plan, 12.6, true);
    const sameShape = parseBrainQueryPlan(
      {
        schemaVersion: 1,
        resource: "actions",
        filters: [
          { field: "description", operator: "contains", value: "different" },
          {
            field: "roleId",
            operator: "in",
            value: { actorRef: "assignedActiveRoleDefIds" },
          },
        ],
        relation: {
          resource: "circles",
          filters: [{ field: "status", operator: "eq", value: "ABNORMAL" }],
        },
        sort: [{ field: "deadline", direction: "desc" }],
        page: 2,
        limit: 10,
      },
      actor,
    );
    const serialized = JSON.stringify(scope);

    assert.deepEqual(Object.keys(scope), [
      "catalogVersion",
      "schemaVersion",
      "resource",
      "filters",
      "relation",
      "sort",
      "page",
      "limit",
      "estimatedCost",
      "planShapeHash",
      "latencyMs",
      "timeoutMs",
      "hasMore",
    ]);
    assert.equal(scope.catalogVersion, BRAIN_QUERY_CATALOG_VERSION);
    assert.match(scope.planShapeHash, /^[a-f0-9]{64}$/);
    assert.equal(
      scope.planShapeHash,
      buildBrainQueryAuditScope(sameShape, 999, false).planShapeHash,
    );
    assert.deepEqual(scope.filters, [
      { field: "description", operator: "contains" },
      { field: "roleId", operator: "in" },
    ]);
    assert.deepEqual(scope.relation, {
      resource: "circles",
      filters: [{ field: "status", operator: "eq" }],
    });
    assert.deepEqual(scope.sort, [{ field: "deadline", direction: "desc" }]);
    assert.equal(scope.latencyMs, 13);
    assert.equal(scope.timeoutMs, 5_000);
    assert.equal(scope.hasMore, true);
    assert.equal(serialized.includes(secret), false);
    assert.equal(serialized.includes("role-secret-value"), false);
    assert.equal(serialized.includes("NORMAL"), false);
    assert.equal(serialized.includes("SELECT"), false);
  });

  test("uses a bounded empty shape when parsing was rejected", () => {
    const first = hashRejectedBrainQueryPlanShape({
      schemaVersion: 1,
      resource: "users",
      filters: [{ field: "secret", operator: "eq", value: "value-a" }],
    });
    const sameShape = hashRejectedBrainQueryPlanShape({
      schemaVersion: 9,
      resource: "credentials",
      filters: [{ field: "prompt", operator: "delete", value: "value-b" }],
    });
    const differentShape = hashRejectedBrainQueryPlanShape({
      schemaVersion: 1,
      resource: "users",
    });
    assert.equal(first, sameShape);
    assert.notEqual(first, differentShape);
    assert.deepEqual(buildBrainQueryAuditScope(null, -1, false, first), {
      catalogVersion: 1,
      schemaVersion: 1,
      resource: null,
      filters: [],
      relation: null,
      sort: [],
      page: null,
      limit: null,
      estimatedCost: null,
      planShapeHash: first,
      latencyMs: 0,
      timeoutMs: 5_000,
      hasMore: false,
    });
  });

  test("shape-hashes oversized rejected input without materializing array descriptors", () => {
    let ownKeysCalls = 0;
    const sparse = new Proxy(new Array(10_000_000), {
      ownKeys() {
        ownKeysCalls += 1;
        throw new Error("array descriptors must not be materialized");
      },
    });
    const sparseHash = hashRejectedBrainQueryPlanShape({
      schemaVersion: 1,
      resource: "circles",
      filters: sparse,
    });
    assert.match(sparseHash, /^[a-f0-9]{64}$/);
    assert.equal(ownKeysCalls, 0);

    const firstPrompt = hashRejectedBrainQueryPlanShape({
      schemaVersion: 1,
      resource: "circles",
      filters: ["value-a".repeat(3_000)],
    });
    const secondPrompt = hashRejectedBrainQueryPlanShape({
      schemaVersion: 1,
      resource: "circles",
      filters: ["value-b".repeat(3_000)],
    });
    assert.equal(firstPrompt, secondPrompt);
  });

  test("defines fixed rejection and failure allowlists", () => {
    assert.equal(Object.isFrozen(BRAIN_QUERY_REJECTION_CODES), true);
    assert.equal(Object.isFrozen(BRAIN_QUERY_FAILURE_CODES), true);
    assert.ok(BRAIN_QUERY_REJECTION_CODES.includes("INVALID_PLAN"));
    assert.ok(BRAIN_QUERY_REJECTION_CODES.includes("QUERY_TOO_EXPENSIVE"));
    assert.deepEqual(BRAIN_QUERY_FAILURE_CODES, [
      "QUERY_TIMEOUT",
      "DATABASE_POLICY_MISMATCH",
      "DATABASE_UNAVAILABLE",
      "ROW_SHAPE_MISMATCH",
      "DATABASE_EXECUTION_FAILED",
    ]);
  });
});

describe("V5-M1-C invocation identity and audit persistence", () => {
  test("checks the exact tenant, owner, conversation, message, and USER role", async () => {
    let captured: unknown;
    await replaceMethod(
      prisma.brainMessage as unknown as Record<string, unknown>,
      "findFirst",
      async (input) => {
        captured = input;
        return { id: "message-a" };
      },
      async () => {
        assert.equal(
          await hasValidBrainQueryInvocation(actor, "conversation-a", "message-a"),
          true,
        );
      },
    );
    assert.deepEqual(captured, {
      where: {
        id: "message-a",
        conversationId: "conversation-a",
        organizationId: "org-a",
        role: "USER",
        conversation: {
          is: {
            id: "conversation-a",
            organizationId: "org-a",
            ownerId: "person-a",
          },
        },
      },
      select: { id: true },
    });
  });

  test("returns the same false result for missing, foreign, and invalid IDs", async () => {
    let calls = 0;
    await replaceMethod(
      prisma.brainMessage as unknown as Record<string, unknown>,
      "findFirst",
      async () => {
        calls += 1;
        return null;
      },
      async () => {
        assert.equal(
          await hasValidBrainQueryInvocation(actor, "conversation-missing", "message-missing"),
          false,
        );
        assert.equal(
          await hasValidBrainQueryInvocation(actor, "conversation-foreign", "message-foreign"),
          false,
        );
        assert.equal(await hasValidBrainQueryInvocation(actor, "", "message-a"), false);
        assert.equal(
          await hasValidBrainQueryInvocation(actor, "conversation-a", "x".repeat(192)),
          false,
        );
      },
    );
    assert.equal(calls, 2);
  });

  test("writes exactly the bounded M1_C_USER_QUERY record", async () => {
    const plan = parseBrainQueryPlan(
      { schemaVersion: 1, resource: "circles", limit: 10 },
      actor,
    );
    const calls: unknown[] = [];
    await replaceMethod(
      prisma.brainQueryAudit as unknown as Record<string, unknown>,
      "create",
      async (input) => {
        calls.push(input);
        return { id: "audit-a" };
      },
      async () => {
        await writeBrainQueryAudit(actor, "conversation-a", "message-a", {
          status: "SUCCEEDED",
          errorCode: null,
          resultCount: 2,
          plan,
          latencyMs: 9,
          hasMore: true,
        });
      },
    );

    assert.equal(calls.length, 1);
    const call = calls[0] as {
      data: Record<string, unknown>;
      select: Record<string, unknown>;
    };
    assert.equal(call.data.organizationId, "org-a");
    assert.equal(call.data.actorId, "person-a");
    assert.equal(call.data.conversationId, "conversation-a");
    assert.equal(call.data.messageId, "message-a");
    assert.equal(call.data.purpose, BRAIN_QUERY_AUDIT_PURPOSE);
    assert.equal(call.data.status, "SUCCEEDED");
    assert.equal(call.data.errorCode, null);
    assert.equal(call.data.resultCount, 2);
    assert.equal(
      (call.data.scope as Record<string, unknown>).catalogVersion,
      1,
    );
    assert.match(
      String((call.data.scope as Record<string, unknown>).planShapeHash),
      /^[a-f0-9]{64}$/,
    );
    assert.deepEqual(call.select, { id: true });
  });

  test("rejects invalid status/code/count combinations before persistence", async () => {
    let calls = 0;
    await replaceMethod(
      prisma.brainQueryAudit as unknown as Record<string, unknown>,
      "create",
      async () => {
        calls += 1;
        return { id: "audit-a" };
      },
      async () => {
        await assert.rejects(
          writeBrainQueryAudit(actor, "conversation-a", "message-a", {
            status: "SUCCEEDED",
            errorCode: "DATABASE_EXECUTION_FAILED",
            resultCount: 0,
            plan: null,
            latencyMs: 1,
            hasMore: false,
          }),
          /invalid Brain query audit input/,
        );
        await assert.rejects(
          writeBrainQueryAudit(actor, "conversation-a", "message-a", {
            status: "REJECTED",
            errorCode: "DATABASE_EXECUTION_FAILED",
            resultCount: 0,
            plan: null,
            latencyMs: 1,
            hasMore: false,
          }),
          /invalid Brain query audit input/,
        );
        await assert.rejects(
          writeBrainQueryAudit(actor, "conversation-a", "message-a", {
            status: "FAILED",
            errorCode: "DATABASE_EXECUTION_FAILED",
            resultCount: 51,
            plan: null,
            latencyMs: 1,
            hasMore: false,
          }),
          /invalid Brain query audit input/,
        );
      },
    );
    assert.equal(calls, 0);
  });

  test("propagates audit persistence failure for fail-closed handling", async () => {
    const plan = parseBrainQueryPlan(
      { schemaVersion: 1, resource: "circles" },
      actor,
    );
    await replaceMethod(
      prisma.brainQueryAudit as unknown as Record<string, unknown>,
      "create",
      async () => {
        throw new Error("storage unavailable with raw details");
      },
      async () => {
        await assert.rejects(
          writeBrainQueryAudit(actor, "conversation-a", "message-a", {
            status: "FAILED",
            errorCode: "DATABASE_EXECUTION_FAILED",
            resultCount: 0,
            plan,
            latencyMs: 1,
            hasMore: false,
          }),
          /storage unavailable/,
        );
      },
    );
  });
});
