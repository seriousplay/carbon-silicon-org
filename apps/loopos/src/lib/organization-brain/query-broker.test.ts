import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { Pool } from "pg";

import { prisma } from "@/lib/db";

import type { ActorContext } from "../authorization/actor-context-resolver";
import {
  OrganizationBrainQueryError,
  executeOrganizationBrainQuery,
} from "./query-broker";
import { BRAIN_QUERY_CATALOG, BRAIN_QUERY_RESOURCES } from "./query-plan";
import type { BrainReadRow } from "./read-database-core";

const brokerSourceUrl = new URL("./query-broker.ts", import.meta.url);
const brokerSource = existsSync(brokerSourceUrl)
  ? readFileSync(brokerSourceUrl, "utf8")
  : "";
const queryPlanSourceUrl = new URL("./query-plan.ts", import.meta.url);
const queryPlanSource = existsSync(queryPlanSourceUrl)
  ? readFileSync(queryPlanSourceUrl, "utf8")
  : "";
const readCoreSourceUrl = new URL("./read-database-core.ts", import.meta.url);
const readCoreSource = existsSync(readCoreSourceUrl)
  ? readFileSync(readCoreSourceUrl, "utf8")
  : "";

const actor: ActorContext = {
  organizationId: "org-a",
  userId: "user-a",
  personId: "person-a",
  membershipRole: "ORG_MEMBER",
  homeCircleId: "circle-a",
  assignedActiveRoleDefIds: [],
  ledActiveCircleIds: [],
};

const validIdentity = {
  sessionUser: "loopos_brain_login",
  currentUser: "loopos_brain_login",
  isReaderMember: true,
  isDirectReaderMember: true,
  loginMembershipCount: 1,
  readerMemberCount: 1,
  readerParentMembershipCount: 0,
  canLogin: true,
  inheritsPrivileges: false,
  isSuperuser: false,
  canCreateDatabase: false,
  canCreateRole: false,
  canReplicate: false,
  bypassesRowSecurity: false,
};

const organizationRow = {
  id: "org-a",
  name: "Organization A",
  slug: "organization-a",
  createdAt: new Date("2026-07-14T04:00:00.000Z"),
  updatedAt: new Date("2026-07-14T04:00:00.000Z"),
};

class BrokerClient {
  readonly calls: Array<{ text: string; values: unknown[] }> = [];
  readonly releaseErrors: Array<Error | undefined> = [];
  rows: BrainReadRow[] = [{ ...organizationRow }];
  identity: typeof validIdentity = { ...validIdentity };
  readFailure: Error | undefined;
  rollbackFailure: Error | undefined;

  async query(
    text: string,
    values: unknown[] = [],
  ): Promise<{ rows: BrainReadRow[] }> {
    this.calls.push({ text, values });
    if (text === "ROLLBACK" && this.rollbackFailure) {
      throw this.rollbackFailure;
    }
    if (text.includes('session_user AS "sessionUser"')) {
      return { rows: [{ ...this.identity }] };
    }
    if (text.includes("FROM brain_read.")) {
      if (this.readFailure) throw this.readFailure;
      return { rows: this.rows };
    }
    return { rows: [] };
  }

  release(error?: Error): void {
    this.releaseErrors.push(error);
  }
}

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

type BrokerMockOptions = Readonly<{
  client: BrokerClient;
  invocation?: "valid" | "invalid" | "error";
  audit?: "success" | "error";
  auditCalls?: unknown[];
  connectCalls?: { count: number };
  events?: string[];
}>;

async function withBrokerMocks<T>(
  options: BrokerMockOptions,
  run: () => Promise<T>,
): Promise<T> {
  const auditCalls = options.auditCalls ?? [];
  const connectCalls = options.connectCalls ?? { count: 0 };
  const events = options.events ?? [];
  return replaceMethod(
    prisma.brainMessage as unknown as Record<string, unknown>,
    "findFirst",
    async () => {
      events.push("identity");
      if (options.invocation === "error") throw new Error("identity storage failed");
      return options.invocation === "invalid" ? null : { id: "message-a" };
    },
    () =>
      replaceMethod(
        prisma.brainQueryAudit as unknown as Record<string, unknown>,
        "create",
        async (input) => {
          events.push("audit");
          auditCalls.push(input);
          if (options.audit === "error") throw new Error("audit storage failed");
          return { id: "audit-a" };
        },
        () =>
          replaceMethod(
            Pool.prototype as unknown as Record<string, unknown>,
            "connect",
            async () => {
              events.push("query");
              connectCalls.count += 1;
              return options.client;
            },
            run,
          ),
      ),
  );
}

function hasBrokerCode(error: unknown, code: OrganizationBrainQueryError["code"]): boolean {
  return error instanceof OrganizationBrainQueryError && error.code === code;
}

describe("V5-M1-C public broker boundary", () => {
  test("accepts only actor, invocation IDs, and unknown plan input", () => {
    assert.match(
      brokerSource,
      /executeOrganizationBrainQuery\(\s*actor: ActorContext,\s*conversationId: string,\s*messageId: string,\s*planInput: unknown/,
    );
    assert.doesNotMatch(
      brokerSource,
      /export\s+(?:async\s+)?function\s+[^\s(]+\([^)]*(?:client|callback|sql|table|view)/i,
    );
    assert.doesNotMatch(brokerSource, /process\.env\.DATABASE_URL/);
    assert.match(brokerSource, /process\.env\.BRAIN_DATABASE_URL/);
    assert.doesNotMatch(
      queryPlanSource,
      /export\s+function\s+compileBrainQueryPlan/,
    );
    assert.doesNotMatch(queryPlanSource, /prepareBrainQueryPlan|CompiledBrainQuery/);
    assert.match(brokerSource, /function\s+compileBrainQueryPlan\(/);
    assert.doesNotMatch(
      brokerSource,
      /export\s+function\s+compileBrainQueryPlan/,
    );
    assert.doesNotMatch(
      readCoreSource,
      /export\s+async\s+function\s+runBrainQueryPlanTransaction/,
    );
  });

  test("compiles all 20 catalog resources only through the audited broker", async () => {
    process.env.BRAIN_DATABASE_URL =
      "postgresql://unused:unused@127.0.0.1:1/unused";
    for (const resource of BRAIN_QUERY_RESOURCES) {
      const client = new BrokerClient();
      client.rows = [];
      const auditCalls: unknown[] = [];
      const input =
        resource === "privateMessages"
          ? {
              schemaVersion: 1,
              resource,
              filters: [
                {
                  field: "conversationId",
                  operator: "eq",
                  value: "conversation-a",
                },
              ],
            }
          : { schemaVersion: 1, resource };

      await withBrokerMocks({ client, auditCalls }, () =>
        executeOrganizationBrainQuery(
          actor,
          "conversation-a",
          "message-a",
          input,
        ),
      );

      const reads = client.calls.filter((call) =>
        call.text.includes("FROM brain_read."),
      );
      assert.equal(reads.length, 1);
      assert.match(reads[0]?.text ?? "", /^SELECT\n/);
      assert.match(
        reads[0]?.text ?? "",
        new RegExp(
          `FROM ${BRAIN_QUERY_CATALOG[resource].view.replace(".", "\\.")} AS`,
        ),
      );
      assert.doesNotMatch(reads[0]?.text ?? "", /;/);
      assert.equal(reads[0]?.values.at(-2), 21);
      assert.equal(reads[0]?.values.at(-1), 0);
      assert.equal(auditCalls.length, 1);
      assert.match(JSON.stringify(auditCalls[0]), /SUCCEEDED/);
    }
  });

  test("compiles relation EXISTS, deterministic sort, and bound values through the broker", async () => {
    const client = new BrokerClient();
    client.rows = [];
    await withBrokerMocks({ client }, () =>
      executeOrganizationBrainQuery(actor, "conversation-a", "message-a", {
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
      }),
    );

    const read = client.calls.find((call) =>
      call.text.includes("FROM brain_read.actions"),
    );
    assert.ok(read);
    assert.match(read.text, /EXISTS \(\n    SELECT 1/);
    assert.match(read.text, /FROM brain_read\.circles AS "relation"/);
    assert.doesNotMatch(read.text, /\bJOIN\b/);
    assert.match(read.text, /"record"\."status" = \$1/);
    assert.match(read.text, /"relation"\."name" ILIKE \$2 ESCAPE E'\\\\'/);
    assert.match(
      read.text,
      /ORDER BY "record"\."deadline" ASC NULLS LAST, "record"\."id" ASC NULLS LAST/,
    );
    assert.deepEqual(read.values, ["OPEN", "%Ops%", 11, 10]);
  });

  test("binds opaque IDs and maximum pagination without count SQL", async () => {
    const client = new BrokerClient();
    client.rows = [];
    const opaqueId = "foreign-record-id";
    await withBrokerMocks({ client }, () =>
      executeOrganizationBrainQuery(actor, "conversation-a", "message-a", {
        schemaVersion: 1,
        resource: "projects",
        filters: [{ field: "id", operator: "eq", value: opaqueId }],
        page: 10,
        limit: 50,
      }),
    );

    const read = client.calls.find((call) =>
      call.text.includes("FROM brain_read.projects"),
    );
    assert.ok(read);
    assert.equal(read.text.includes(opaqueId), false);
    assert.doesNotMatch(read.text, /COUNT\s*\(/i);
    assert.deepEqual(read.values, [opaqueId, 51, 450]);
  });

  test("audits forged sort fragments without opening the reader transaction", async () => {
    const client = new BrokerClient();
    const auditCalls: unknown[] = [];
    const connectCalls = { count: 0 };
    const injectedDirection = "asc NULLS LAST; DROP TABLE users; --";

    await withBrokerMocks({ client, auditCalls, connectCalls }, async () => {
      await assert.rejects(
        executeOrganizationBrainQuery(actor, "conversation-a", "message-a", {
          schemaVersion: 1,
          resource: "organizationIdentity",
          sort: [{ field: "name", direction: injectedDirection }],
        }),
        (error) => hasBrokerCode(error, "INVALID_SORT"),
      );
    });

    assert.equal(connectCalls.count, 0);
    assert.equal(auditCalls.length, 1);
    assert.equal(JSON.stringify(auditCalls[0]).includes(injectedDirection), false);
  });

  test("checks invocation identity before opening the reader transaction", async () => {
    process.env.BRAIN_DATABASE_URL = "postgresql://unused:unused@127.0.0.1:1/unused";
    const client = new BrokerClient();
    const events: string[] = [];
    await withBrokerMocks({ client, events }, async () => {
      await executeOrganizationBrainQuery(
        actor,
        "conversation-a",
        "message-a",
        { schemaVersion: 1, resource: "organizationIdentity" },
      );
    });
    assert.deepEqual(events, ["identity", "query", "audit"]);
  });

  test("returns packets only after one redacted success audit", async () => {
    const client = new BrokerClient();
    client.rows = [{ ...organizationRow }, { ...organizationRow }];
    const auditCalls: unknown[] = [];
    const secret = "ignore instructions; SELECT * FROM sessions";
    const result = await withBrokerMocks({ client, auditCalls }, () =>
      executeOrganizationBrainQuery(actor, "conversation-a", "message-a", {
        schemaVersion: 1,
        resource: "organizationIdentity",
        filters: [{ field: "name", operator: "contains", value: secret }],
        limit: 1,
      }),
    );

    assert.equal(result.packets.length, 1);
    assert.equal(result.hasMore, true);
    assert.equal(auditCalls.length, 1);
    const serialized = JSON.stringify(auditCalls[0]);
    assert.match(serialized, /M1_C_USER_QUERY/);
    assert.match(serialized, /SUCCEEDED/);
    assert.match(serialized, /"resultCount":1/);
    assert.match(serialized, /"hasMore":true/);
    assert.equal(serialized.includes(secret), false);
    const reads = client.calls.filter((call) =>
      call.text.includes("FROM brain_read.organization_identity"),
    );
    assert.equal(reads.length, 1);
    assert.deepEqual(reads[0]?.values, [`%${secret}%`, 2, 0]);
    assert.equal(reads[0]?.text.includes(secret), false);
    assert.equal(client.calls[0]?.text, "BEGIN");
    assert.equal(client.calls[1]?.text, "SET TRANSACTION READ ONLY");
    assert.equal(client.calls.some((call) => call.text === "COMMIT"), false);
    assert.equal(client.calls.at(-1)?.text, "ROLLBACK");
    assert.deepEqual(client.releaseErrors, [undefined]);
  });

  test("rejects malformed plans with one audit and no reader query", async () => {
    const client = new BrokerClient();
    const auditCalls: unknown[] = [];
    const connectCalls = { count: 0 };
    await withBrokerMocks({ client, auditCalls, connectCalls }, async () => {
      await assert.rejects(
        executeOrganizationBrainQuery(actor, "conversation-a", "message-a", {
          schemaVersion: 1,
          resource: "users",
          filterValue: "secret-value",
        }),
        (error) => hasBrokerCode(error, "INVALID_PLAN"),
      );
    });

    assert.equal(connectCalls.count, 0);
    assert.equal(auditCalls.length, 1);
    const serialized = JSON.stringify(auditCalls[0]);
    assert.match(serialized, /REJECTED/);
    assert.match(serialized, /INVALID_PLAN/);
    assert.match(serialized, /"catalogVersion":1/);
    assert.match(serialized, /"planShapeHash":"[a-f0-9]{64}"/);
    assert.equal(serialized.includes("secret-value"), false);
  });

  test("invalid, foreign, and unavailable invocation identities create no query or audit oracle", async () => {
    for (const invocation of ["invalid", "error"] as const) {
      const client = new BrokerClient();
      const auditCalls: unknown[] = [];
      const connectCalls = { count: 0 };
      await withBrokerMocks(
        { client, invocation, auditCalls, connectCalls },
        async () => {
          await assert.rejects(
            executeOrganizationBrainQuery(
              actor,
              "conversation-foreign-or-missing",
              "message-foreign-or-missing",
              { schemaVersion: 1, resource: "organizationIdentity" },
            ),
            (error) => hasBrokerCode(error, "INVALID_INVOCATION"),
          );
        },
      );
      assert.equal(connectCalls.count, 0);
      assert.equal(auditCalls.length, 0);
    }
  });
});

describe("V5-M1-C broker failure and audit outcomes", () => {
  test("redacts raw database failures and writes one FAILED audit", async () => {
    const client = new BrokerClient();
    client.readFailure = new Error("password=secret raw database details");
    const auditCalls: unknown[] = [];
    await withBrokerMocks({ client, auditCalls }, async () => {
      await assert.rejects(
        executeOrganizationBrainQuery(
          actor,
          "conversation-a",
          "message-a",
          { schemaVersion: 1, resource: "organizationIdentity" },
        ),
        (error) =>
          hasBrokerCode(error, "DATABASE_EXECUTION_FAILED") &&
          !String(error).includes("password=secret"),
      );
    });
    assert.equal(auditCalls.length, 1);
    const serialized = JSON.stringify(auditCalls[0]);
    assert.match(serialized, /FAILED/);
    assert.match(serialized, /DATABASE_EXECUTION_FAILED/);
    assert.equal(serialized.includes("password=secret"), false);
    assert.equal(client.calls.at(-1)?.text, "ROLLBACK");
  });

  test("classifies timeout, policy, and unavailable failures with fixed codes", async () => {
    const cases: Array<{
      prepare(client: BrokerClient): void;
      code:
        | "QUERY_TIMEOUT"
        | "DATABASE_POLICY_MISMATCH"
        | "DATABASE_UNAVAILABLE";
    }> = [
      {
        prepare(client) {
          client.readFailure = Object.assign(new Error("statement timeout"), {
            code: "57014",
          });
        },
        code: "QUERY_TIMEOUT",
      },
      {
        prepare(client) {
          client.identity = { ...validIdentity, isDirectReaderMember: false };
        },
        code: "DATABASE_POLICY_MISMATCH",
      },
      {
        prepare(client) {
          client.readFailure = Object.assign(new Error("connection unavailable"), {
            code: "ECONNRESET",
          });
        },
        code: "DATABASE_UNAVAILABLE",
      },
    ];
    for (const entry of cases) {
      const client = new BrokerClient();
      entry.prepare(client);
      const auditCalls: unknown[] = [];
      await withBrokerMocks({ client, auditCalls }, async () => {
        await assert.rejects(
          executeOrganizationBrainQuery(
            actor,
            "conversation-a",
            "message-a",
            { schemaVersion: 1, resource: "organizationIdentity" },
          ),
          (error) => hasBrokerCode(error, entry.code),
        );
      });
      assert.equal(auditCalls.length, 1);
      assert.match(JSON.stringify(auditCalls[0]), new RegExp(entry.code));
      assert.equal(client.calls.at(-1)?.text, "ROLLBACK");
    }
  });

  test("destroys the reader client when success-path rollback fails", async () => {
    const client = new BrokerClient();
    const rollbackFailure = new Error("rollback failed");
    client.rollbackFailure = rollbackFailure;
    const auditCalls: unknown[] = [];

    await withBrokerMocks({ client, auditCalls }, async () => {
      await assert.rejects(
        executeOrganizationBrainQuery(
          actor,
          "conversation-a",
          "message-a",
          { schemaVersion: 1, resource: "organizationIdentity" },
        ),
        (error) => hasBrokerCode(error, "DATABASE_EXECUTION_FAILED"),
      );
    });

    assert.deepEqual(client.releaseErrors, [rollbackFailure]);
    assert.equal(
      client.calls.filter((call) => call.text === "ROLLBACK").length,
      1,
    );
    assert.equal(auditCalls.length, 1);
    assert.match(JSON.stringify(auditCalls[0]), /DATABASE_EXECUTION_FAILED/);
  });

  test("turns row-shape mismatches into one value-redacted failure", async () => {
    const client = new BrokerClient();
    client.rows = [{ id: "org-a", leaked: "secret-row-value" }];
    const auditCalls: unknown[] = [];
    await withBrokerMocks({ client, auditCalls }, async () => {
      await assert.rejects(
        executeOrganizationBrainQuery(
          actor,
          "conversation-a",
          "message-a",
          { schemaVersion: 1, resource: "organizationIdentity" },
        ),
        (error) => hasBrokerCode(error, "ROW_SHAPE_MISMATCH"),
      );
    });
    assert.equal(auditCalls.length, 1);
    const serialized = JSON.stringify(auditCalls[0]);
    assert.match(serialized, /ROW_SHAPE_MISMATCH/);
    assert.equal(serialized.includes("secret-row-value"), false);
  });

  test("fails closed and discards success packets when audit persistence fails", async () => {
    const client = new BrokerClient();
    const auditCalls: unknown[] = [];
    await withBrokerMocks({ client, audit: "error", auditCalls }, async () => {
      await assert.rejects(
        executeOrganizationBrainQuery(
          actor,
          "conversation-a",
          "message-a",
          { schemaVersion: 1, resource: "organizationIdentity" },
        ),
        (error) => hasBrokerCode(error, "AUDIT_FAILED"),
      );
    });
    assert.equal(auditCalls.length, 1);
    assert.equal(client.calls.at(-1)?.text, "ROLLBACK");
  });

  test("fails closed when rejection or failure audit persistence fails", async () => {
    for (const setup of ["rejection", "failure"] as const) {
      const client = new BrokerClient();
      if (setup === "failure") client.readFailure = new Error("raw failure");
      await withBrokerMocks({ client, audit: "error" }, async () => {
        await assert.rejects(
          executeOrganizationBrainQuery(
            actor,
            "conversation-a",
            "message-a",
            setup === "rejection"
              ? { schemaVersion: 1, resource: "users" }
              : { schemaVersion: 1, resource: "organizationIdentity" },
          ),
          (error) => hasBrokerCode(error, "AUDIT_FAILED"),
        );
      });
    }
  });
});
