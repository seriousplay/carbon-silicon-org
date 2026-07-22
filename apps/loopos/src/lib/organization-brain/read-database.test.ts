import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  runBrainFoundationReadTransaction,
  type BrainFoundationReadRequest,
  type BrainReadClient,
  type BrainReadRow,
} from "./read-database-core";

const wrapperUrl = new URL("./read-database.ts", import.meta.url);
const coreUrl = new URL("./read-database-core.ts", import.meta.url);
const wrapper = existsSync(wrapperUrl) ? readFileSync(wrapperUrl, "utf8") : "";
const core = existsSync(coreUrl) ? readFileSync(coreUrl, "utf8") : "";

const actor = {
  organizationId: "org-1",
  userId: "user-1",
  personId: "person-1",
} as const;

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

class RecordingClient implements BrainReadClient {
  readonly calls: Array<{ text: string; values: unknown[] }> = [];
  releaseCount = 0;
  readonly releaseErrors: Array<Error | undefined> = [];
  identity: typeof validIdentity = { ...validIdentity };
  failWhen: ((text: string) => boolean) | undefined;
  failureFor: ((text: string) => Error | undefined) | undefined;

  async query(
    text: string,
    values: unknown[] = [],
  ): Promise<{ rows: BrainReadRow[] }> {
    this.calls.push({ text, values });
    const failure = this.failureFor?.(text);
    if (failure) throw failure;
    if (this.failWhen?.(text)) throw new Error(`query failed: ${text}`);
    if (text.includes('session_user AS "sessionUser"')) {
      return { rows: [{ ...this.identity }] };
    }
    if (text.includes("FROM brain_read.")) {
      return { rows: [{ marker: "foundation-row" }] };
    }
    return { rows: [] };
  }

  release(error?: Error): void {
    this.releaseCount += 1;
    this.releaseErrors.push(error);
  }
}

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

describe("V5-M1-B2b read-only database wrapper contract", () => {
  test("is server-only, uses only BRAIN_DATABASE_URL, and exposes no SQL callback or client", () => {
    assert.match(wrapper, /^import "server-only";/);
    assert.match(wrapper, /process\.env\.BRAIN_DATABASE_URL/);
    assert.doesNotMatch(wrapper, /process\.env\.DATABASE_URL/);
    assert.match(wrapper, /new Pool\(\{[\s\S]*?connectionString[\s\S]*?max:\s*[1-3]\b/);
    assert.match(wrapper, /runBrainFoundationReadTransaction/);
    assert.doesNotMatch(wrapper, /\bcallback\b|BrainReadQuery|PoolClient/);
    assert.doesNotMatch(wrapper, /export\s+[^;]*(?:Pool|Client|query)/i);
    assert.doesNotMatch(wrapper, /\b(password|credential)\b/i);
  });

  test("hardcodes exactly the six B2a and nine B2b resources", () => {
    const b2aResources = [
      "currentActor",
      "organizationIdentity",
      "organizationBrainProfile",
      "currentActorRoleAssignments",
      "privateConversations",
      "privateMessages",
    ] as const;
    const b2bResources = [
      "circles",
      "roleDefinitions",
      "projects",
      "actions",
      "unresolvedTensions",
      "meetingDrafts",
      "approvedTacticalOutcomes",
      "adoptedGovernanceDecisions",
      "publishedGovernanceLogs",
    ] as const;
    for (const resource of [...b2aResources, ...b2bResources]) {
      assert.match(core, new RegExp(`resource: "${resource}"`));
    }

    const expectedViews = [
      "current_actor",
      "organization_identity",
      "organization_brain_profile",
      "current_actor_role_assignments",
      "current_actor_role_applications",
      "current_actor_role_assignment_history",
      "private_conversations",
      "private_messages",
      "circles",
      "role_definitions",
      "projects",
      "actions",
      "unresolved_tensions",
      "meeting_drafts",
      "approved_tactical_outcomes",
      "adopted_governance_decisions",
      "published_governance_logs",
    ] as const;
    const fixedViews = [
      ...core.matchAll(/FROM brain_read\.([a-z_]+)\b/g),
    ].map((match) => match[1]);
    assert.deepEqual(fixedViews, [...expectedViews]);
    assert.equal(new Set(fixedViews).size, 17);
    assert.doesNotMatch(
      core,
      /brain_read\.(?:confirmed_meeting_results|meetings|decision_records|change_logs|governance_proposals|governance_logs)\b/,
    );
    assert.doesNotMatch(
      core,
      /\b(?:rootCause|linkedDataVersion|aiTranslation|aiHandlingSuggestion|aiGuardReport|mutationKey|payloadHash|leaseToken|resultEnvelope|agentModel|agentEndpoint|agentAbilities|agentConfig)\b/,
    );
    assert.doesNotMatch(core, /\$\{[^}]*resource|request\.[a-zA-Z]+[^\n]*FROM/i);
  });
});

describe("V5-M1-B2b transaction behavior", () => {
  test("validates connection identity before role switch, sets local policy, reads once, and commits", async () => {
    const client = new RecordingClient();

    const rows = await runBrainFoundationReadTransaction(client, actor, {
      resource: "privateMessages",
      conversationId: "conversation-1",
      limit: 25,
    });

    assert.deepEqual(rows, [{ marker: "foundation-row" }]);
    assert.equal(client.releaseCount, 1);
    assert.equal(client.calls.length, 7);
    assert.equal(client.calls[0]?.text, "BEGIN");
    assert.equal(client.calls[1]?.text, "SET TRANSACTION READ ONLY");
    assert.match(compact(client.calls[2]?.text ?? ""), /session_user AS "sessionUser"/);
    assert.match(compact(client.calls[2]?.text ?? ""), /current_user AS "currentUser"/);
    assert.match(compact(client.calls[2]?.text ?? ""), /pg_has_role\(session_user, 'loopos_brain_reader', 'MEMBER'\)/);
    assert.match(compact(client.calls[2]?.text ?? ""), /pg_auth_members/);
    assert.equal(client.calls[3]?.text, "SET LOCAL ROLE loopos_brain_reader");
    assert.match(client.calls[4]?.text ?? "", /set_config\('loopos\.organization_id', \$1, true\)/);
    assert.match(client.calls[4]?.text ?? "", /set_config\('statement_timeout', \$4, true\)/);
    assert.deepEqual(client.calls[4]?.values, [
      "org-1",
      "user-1",
      "person-1",
      "5000ms",
    ]);
    assert.match(compact(client.calls[5]?.text ?? ""), /FROM brain_read\.private_messages/);
    assert.match(compact(client.calls[5]?.text ?? ""), /WHERE "conversationId" = \$1/);
    assert.match(compact(client.calls[5]?.text ?? ""), /LIMIT \$2$/);
    assert.deepEqual(client.calls[5]?.values, ["conversation-1", 25]);
    assert.equal(client.calls[6]?.text, "COMMIT");
  });

  test("maps every allowed resource to one fixed statement", async () => {
    const cases: Array<{
      request: BrainFoundationReadRequest;
      view: string;
    }> = [
      { request: { resource: "currentActor" }, view: "current_actor" },
      {
        request: { resource: "organizationIdentity" },
        view: "organization_identity",
      },
      {
        request: { resource: "organizationBrainProfile" },
        view: "organization_brain_profile",
      },
      {
        request: { resource: "currentActorRoleAssignments", limit: 10 },
        view: "current_actor_role_assignments",
      },
      {
        request: { resource: "privateConversations", limit: 10 },
        view: "private_conversations",
      },
      {
        request: {
          resource: "privateMessages",
          conversationId: "conversation-1",
          limit: 10,
        },
        view: "private_messages",
      },
      { request: { resource: "circles", limit: 10 }, view: "circles" },
      {
        request: { resource: "roleDefinitions", limit: 10 },
        view: "role_definitions",
      },
      { request: { resource: "projects", limit: 10 }, view: "projects" },
      { request: { resource: "actions", limit: 10 }, view: "actions" },
      {
        request: { resource: "unresolvedTensions", limit: 10 },
        view: "unresolved_tensions",
      },
      {
        request: { resource: "meetingDrafts", limit: 10 },
        view: "meeting_drafts",
      },
      {
        request: { resource: "approvedTacticalOutcomes", limit: 10 },
        view: "approved_tactical_outcomes",
      },
      {
        request: { resource: "adoptedGovernanceDecisions", limit: 10 },
        view: "adopted_governance_decisions",
      },
      {
        request: { resource: "publishedGovernanceLogs", limit: 10 },
        view: "published_governance_logs",
      },
    ];

    assert.equal(cases.length, 15);

    for (const entry of cases) {
      const client = new RecordingClient();
      await runBrainFoundationReadTransaction(client, actor, entry.request);
      const foundationReads = client.calls.filter((call) =>
        call.text.includes("FROM brain_read."),
      );
      assert.equal(foundationReads.length, 1);
      assert.match(foundationReads[0]?.text ?? "", new RegExp(`brain_read\\.${entry.view}\\b`));
      assert.equal(client.releaseCount, 1);
    }
  });

  test("rejects unknown resources and out-of-bounds parameters before opening a transaction", async () => {
    const requests = [
      { resource: "confirmedMeetingResults" },
      { resource: "privateConversations", limit: 0 },
      { resource: "privateConversations", limit: 101 },
      { resource: "projects", limit: 0 },
      { resource: "projects", limit: 101 },
      { resource: "projects", limit: 1.5 },
      {
        resource: "privateMessages",
        conversationId: "",
        limit: 10,
      },
      {
        resource: "privateMessages",
        conversationId: "x".repeat(192),
        limit: 10,
      },
    ];

    for (const request of requests) {
      const client = new RecordingClient();
      await assert.rejects(
        runBrainFoundationReadTransaction(
          client,
          actor,
          request as BrainFoundationReadRequest,
        ),
        /invalid|unsupported/i,
      );
      assert.deepEqual(client.calls, []);
      assert.equal(client.releaseCount, 1);
    }
  });

  test("rejects a mismatched or privileged login before SET LOCAL ROLE", async () => {
    const invalidIdentities = [
      { currentUser: "already_switched" },
      { isReaderMember: false },
      { isDirectReaderMember: false },
      { loginMembershipCount: 2 },
      { readerMemberCount: 2 },
      { readerParentMembershipCount: 1 },
      { canLogin: false },
      { inheritsPrivileges: true },
      { isSuperuser: true },
      { canCreateDatabase: true },
      { canCreateRole: true },
      { canReplicate: true },
      { bypassesRowSecurity: true },
    ];

    for (const identityPatch of invalidIdentities) {
      const client = new RecordingClient();
      client.identity = { ...validIdentity, ...identityPatch };

      await assert.rejects(
        runBrainFoundationReadTransaction(client, actor, {
          resource: "currentActor",
        }),
        /dedicated brain reader login/i,
      );
      assert.equal(
        client.calls.some((call) => call.text.startsWith("SET LOCAL ROLE")),
        false,
      );
      assert.equal(client.calls.at(-1)?.text, "ROLLBACK");
      assert.equal(client.releaseCount, 1);
    }
  });

  test("rolls back and releases when the fixed read fails", async () => {
    const client = new RecordingClient();
    client.failWhen = (text) => text.includes("FROM brain_read.current_actor");

    await assert.rejects(
      runBrainFoundationReadTransaction(client, actor, {
        resource: "currentActor",
      }),
      /query failed/,
    );

    assert.equal(client.calls.at(-1)?.text, "ROLLBACK");
    assert.equal(client.calls.some((call) => call.text === "COMMIT"), false);
    assert.equal(client.releaseCount, 1);
    assert.deepEqual(client.releaseErrors, [undefined]);
  });

  test("preserves the primary error and destroys the client when ROLLBACK fails", async () => {
    const client = new RecordingClient();
    const primaryError = new Error("foundation read failed");
    const rollbackError = new Error("rollback failed");
    client.failureFor = (text) => {
      if (text.includes("FROM brain_read.current_actor")) return primaryError;
      if (text === "ROLLBACK") return rollbackError;
      return undefined;
    };

    let caught: unknown;
    try {
      await runBrainFoundationReadTransaction(client, actor, {
        resource: "currentActor",
      });
    } catch (error) {
      caught = error;
    }

    assert.equal(caught, primaryError);
    assert.equal(
      (caught as Error & { rollbackError?: Error }).rollbackError,
      rollbackError,
    );
    assert.deepEqual(client.releaseErrors, [rollbackError]);
  });

  test("does not claim transaction ownership when BEGIN fails but still releases", async () => {
    const client = new RecordingClient();
    client.failWhen = (text) => text === "BEGIN";

    await assert.rejects(
      runBrainFoundationReadTransaction(client, actor, {
        resource: "currentActor",
      }),
      /query failed: BEGIN/,
    );

    assert.deepEqual(client.calls.map((call) => call.text), ["BEGIN"]);
    assert.equal(client.releaseCount, 1);
  });
});
