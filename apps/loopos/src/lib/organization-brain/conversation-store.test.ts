import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";

import { prisma } from "@/lib/db";

import type { ActorContext } from "../authorization/actor-context-resolver";
import type { StoredOrganizationBrainResponse } from "./conversation-store";

type StoreModule = typeof import("./conversation-store");

const require = createRequire(import.meta.url);
const originalNodePath = process.env.NODE_PATH;
const compiledModules = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../node_modules/next/dist/compiled",
);
const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let storeModule: StoreModule;

before(async () => {
  process.env.NODE_PATH = originalNodePath
    ? `${compiledModules}:${originalNodePath}`
    : compiledModules;
  moduleWithInitPaths._initPaths();
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  storeModule = await import("./conversation-store");
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
  if (originalNodePath === undefined) delete process.env.NODE_PATH;
  else process.env.NODE_PATH = originalNodePath;
  moduleWithInitPaths._initPaths();
});

const actor: ActorContext = {
  organizationId: "org-a",
  userId: "user-a",
  personId: "person-a",
  membershipRole: "ORG_MEMBER",
  homeCircleId: "circle-a",
  assignedActiveRoleDefIds: [],
  ledActiveCircleIds: [],
};

const conversationId = `bc_${"1".repeat(64)}`;
const userMessageId = `bm_u_${"2".repeat(64)}`;
const brainMessageId = `bm_b_${"2".repeat(64)}`;
const now = new Date("2026-07-14T08:00:00.000Z");

function noPlan(): StoredOrganizationBrainResponse {
  return {
    schemaVersion: 1,
    status: "INSUFFICIENT_EVIDENCE",
    code: "NO_SUPPORTED_PLAN",
    message: "当前问题无法转换为受支持的组织查询。",
    facts: [],
    inferences: [],
    recommendations: [],
    missingEvidence: [],
    sources: [],
  };
}

function confirmedMemory() {
  return {
    label: "已确认组织记忆",
    candidateId: "mc-memory-1",
    claim: "本周期主目标是完成治理闭环",
    rationale: "已经通过授权流程确认。",
    authorityRoute: {
      kind: "GOVERNANCE",
      label: "治理会议确认",
      applicationUrl: "/app/governance/decisions/decision-1",
    },
    sourceRefs: [{
      type: "decision",
      id: "decision-1",
      label: "治理决议",
      applicationUrl: "/app/governance/decisions/decision-1",
      observedAt: "2026-07-14T08:00:00.000Z",
    }],
    confirmedBy: {
      type: "person",
      id: actor.personId,
      label: "主回路成员",
    },
    validFrom: "2026-07-14T08:00:00.000Z",
    validUntil: null,
    applicationUrl: "/app/brain/memory-candidates/mc-memory-1",
    correctionUrl: "/app/tensions/new?memoryCandidateId=mc-memory-1",
  } as const;
}

function ownedConversation() {
  return {
    id: conversationId,
    organizationId: actor.organizationId,
    ownerId: actor.personId,
    title: null,
    createdAt: now,
    updatedAt: now,
  };
}

function userMessage(content = "当前目标是什么？") {
  return {
    id: userMessageId,
    organizationId: actor.organizationId,
    conversationId,
    role: "USER" as const,
    content,
    createdAt: now,
    updatedAt: now,
  };
}

function brainMessage(content = JSON.stringify(noPlan())) {
  return {
    id: brainMessageId,
    organizationId: actor.organizationId,
    conversationId,
    role: "BRAIN" as const,
    content,
    createdAt: now,
    updatedAt: now,
  };
}

async function replaceMethod<T>(
  target: Record<string, unknown>,
  name: string,
  replacement: (...args: never[]) => unknown,
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

async function withTransaction<T>(
  transaction: Record<string, unknown>,
  run: () => Promise<T>,
): Promise<T> {
  return replaceMethod(
    prisma as unknown as Record<string, unknown>,
    "$transaction",
    (work: never) =>
      (work as unknown as (client: Record<string, unknown>) => Promise<unknown>)(
        transaction,
      ),
    run,
  );
}

describe("V5-M1-E1 strict stored response", () => {
  test("accepts only the canonical nine-key response and deeply freezes it", () => {
    const parsed = storeModule.parseStoredOrganizationBrainResponse(
      JSON.stringify(noPlan()),
    );
    assert.deepEqual(Object.keys(parsed), [
      "schemaVersion",
      "status",
      "code",
      "message",
      "facts",
      "inferences",
      "recommendations",
      "missingEvidence",
      "sources",
    ]);
    assert.equal(Object.isFrozen(parsed), true);
    assert.equal(Object.isFrozen(parsed.facts), true);
  });

  test("accepts canonical confirmed-memory responses as a distinct stored section", () => {
    const response = {
      schemaVersion: 1,
      status: "ANSWERED",
      code: "ANSWERED",
      message: "已基于授权证据生成回答。",
      confirmedMemory: [confirmedMemory()],
      facts: [],
      inferences: [],
      recommendations: [],
      missingEvidence: [],
      sources: [],
    };
    const parsed = storeModule.parseStoredOrganizationBrainResponse(
      JSON.stringify(response),
    );
    assert.deepEqual(Object.keys(parsed), [
      "schemaVersion",
      "status",
      "code",
      "message",
      "confirmedMemory",
      "facts",
      "inferences",
      "recommendations",
      "missingEvidence",
      "sources",
    ]);
    assert.deepEqual(parsed.confirmedMemory, [confirmedMemory()]);
    assert.equal(Object.isFrozen(parsed.confirmedMemory), true);
  });

  test("rejects confirmed memory outside answer/evidence status or correction flow", () => {
    for (const response of [
      { ...noPlan(), confirmedMemory: [confirmedMemory()] },
      {
        schemaVersion: 1,
        status: "ANSWERED",
        code: "ANSWERED",
        message: "已基于授权证据生成回答。",
        confirmedMemory: [{
          ...confirmedMemory(),
          correctionUrl: "/app/brain/memory-candidates/mc-memory-1/edit",
        }],
        facts: [],
        inferences: [],
        recommendations: [],
        missingEvidence: [],
        sources: [],
      },
    ]) {
      assert.throws(
        () => storeModule.parseStoredOrganizationBrainResponse(JSON.stringify(response)),
        (error: unknown) =>
          error instanceof storeModule.OrganizationBrainConversationStoreError &&
          error.code === "STORED_RESPONSE_INVALID",
      );
    }
  });

  test("rejects reordered or non-compact stored response JSON", () => {
    const canonical = JSON.stringify(noPlan());
    const reordered = JSON.stringify({
      status: noPlan().status,
      schemaVersion: 1,
      code: noPlan().code,
      message: noPlan().message,
      facts: [],
      inferences: [],
      recommendations: [],
      missingEvidence: [],
      sources: [],
    });
    for (const value of [reordered, JSON.stringify(JSON.parse(canonical), null, 2)]) {
      assert.throws(
        () => storeModule.parseStoredOrganizationBrainResponse(value),
        (error: unknown) =>
          error instanceof storeModule.OrganizationBrainConversationStoreError &&
          error.code === "STORED_RESPONSE_INVALID",
      );
    }
  });

  test("fails closed for extra keys, raw error messages, and malformed JSON", () => {
    for (const value of [
      "not-json",
      JSON.stringify({ ...noPlan(), rawError: "SELECT secret" }),
      JSON.stringify({ ...noPlan(), message: "database password leaked" }),
      JSON.stringify({ ...noPlan(), status: "ANSWERED" }),
    ]) {
      assert.throws(
        () => storeModule.parseStoredOrganizationBrainResponse(value),
        (error: unknown) =>
          error instanceof storeModule.OrganizationBrainConversationStoreError &&
          error.code === "STORED_RESPONSE_INVALID",
      );
    }
  });

  test("revalidates D1 resource fields, canonical versions, and category bounds", () => {
    const evidenceId = `ev_${"3".repeat(64)}`;
    const source = {
      label: "来源",
      evidenceId,
      resource: "circles",
      resourceLabel: "圈子",
      recordId: "circle-a",
      version: "2026-07-14T08:00:00.000Z",
      applicationUrl: "/loop-designer/app/circles/circle-a",
    };
    const answered = {
      schemaVersion: 1,
      status: "ANSWERED",
      code: "ANSWERED",
      message: "已基于授权证据生成回答。",
      facts: [
        {
          label: "事实",
          evidenceId,
          resource: "circles",
          resourceLabel: "圈子",
          sourceVersion: source.version,
          recordId: source.recordId,
          applicationUrl: source.applicationUrl,
          fields: [
            { name: "name", label: "名称", value: "Circle A", truncated: false },
          ],
        },
      ],
      inferences: [],
      recommendations: [],
      missingEvidence: [],
      sources: [source],
    };
    assert.equal(
      storeModule.parseStoredOrganizationBrainResponse(JSON.stringify(answered))
        .code,
      "ANSWERED",
    );
    for (const invalid of [
      {
        ...answered,
        facts: [
          {
            ...answered.facts[0],
            fields: [
              { name: "goal", label: "目标", value: "wrong resource", truncated: false },
            ],
          },
        ],
      },
      {
        ...answered,
        sources: [{ ...source, version: "not-a-version" }],
      },
      {
        ...answered,
        missingEvidence: Array.from({ length: 7 }, (_, index) => ({
          label: "缺失证据",
          text: `missing-${index}`,
        })),
      },
      {
        ...answered,
        facts: [answered.facts[0], answered.facts[0]],
      },
    ]) {
      assert.throws(
        () =>
          storeModule.parseStoredOrganizationBrainResponse(JSON.stringify(invalid)),
        (error: unknown) =>
          error instanceof storeModule.OrganizationBrainConversationStoreError &&
          error.code === "STORED_RESPONSE_INVALID",
      );
    }
  });
});

describe("V5-M1-E1 bounded Prisma conversation store", () => {
  test("creates deterministically with title null and owner-verifies the winner", async () => {
    let createInput: unknown;
    const transaction = {
      brainConversation: {
        createMany: async (input: unknown) => {
          createInput = input;
          return { count: 1 };
        },
        findUnique: async () => ownedConversation(),
      },
    };
    const result = await withTransaction(transaction, () =>
      storeModule.organizationBrainConversationStore.create(actor, {
        conversationId,
      }),
    );
    assert.deepEqual(createInput, {
      data: [
        {
          id: conversationId,
          organizationId: "org-a",
          ownerId: "person-a",
          title: null,
        },
      ],
      skipDuplicates: true,
    });
    assert.deepEqual(result, {
      schemaVersion: 1,
      id: conversationId,
      title: null,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    assert.equal("organizationId" in result, false);
    assert.equal("ownerId" in result, false);
  });

  test("lists only the actor owner boundary in stable descending order", async () => {
    let captured: unknown;
    await replaceMethod(
      prisma.brainConversation as unknown as Record<string, unknown>,
      "findMany",
      async (input: unknown) => {
        captured = input;
        return [ownedConversation()];
      },
      async () => {
        const result = await storeModule.organizationBrainConversationStore.list(
          actor,
          { limit: 20 },
        );
        assert.equal(result.conversations.length, 1);
      },
    );
    assert.deepEqual(captured, {
      where: { organizationId: "org-a", ownerId: "person-a" },
      orderBy: [{ updatedAt: "desc" }, { id: "desc" }],
      take: 20,
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  });

  test("loads latest messages ascending and never returns raw BRAIN JSON", async () => {
    await replaceMethod(
      prisma.brainConversation as unknown as Record<string, unknown>,
      "findFirst",
      async () => ownedConversation(),
      () =>
        replaceMethod(
          prisma.brainMessage as unknown as Record<string, unknown>,
          "findMany",
          async () => [brainMessage(), userMessage()],
          async () => {
            const result = await storeModule.organizationBrainConversationStore.load(
              actor,
              { conversationId, messageLimit: 50 },
            );
            assert.deepEqual(
              result.messages.map((message) => message.role),
              ["USER", "BRAIN"],
            );
            assert.equal("content" in result.messages[1]!, false);
            assert.equal(
              result.messages[1]?.role === "BRAIN"
                ? result.messages[1].result.code
                : null,
              "NO_SUPPORTED_PLAN",
            );
          },
        ),
    );
  });

  test("claims USER before terminal lookup and updates activity only once", async () => {
    const order: string[] = [];
    const transaction = {
      brainConversation: {
        findFirst: async () => {
          order.push("owner");
          return ownedConversation();
        },
        updateMany: async () => {
          order.push("touch");
          return { count: 1 };
        },
      },
      brainMessage: {
        createMany: async () => {
          order.push("insert-user");
          return { count: 1 };
        },
        findUnique: async (input: { where: { id: string } }) => {
          if (input.where.id === userMessageId) {
            order.push("load-user");
            return userMessage();
          }
          order.push("load-brain");
          return null;
        },
      },
    };
    const result = await withTransaction(transaction, () =>
      storeModule.organizationBrainConversationStore.claim(actor, {
        conversationId,
        userMessageId,
        brainMessageId,
        question: "当前目标是什么？",
      }),
    );
    assert.deepEqual(order, [
      "owner",
      "insert-user",
      "load-user",
      "touch",
      "load-brain",
    ]);
    assert.equal(result.terminal, null);
  });

  test("rejects a reused turn identity with different normalized question", async () => {
    const transaction = {
      brainConversation: { findFirst: async () => ownedConversation() },
      brainMessage: {
        createMany: async () => ({ count: 0 }),
        findUnique: async () => userMessage("另一个问题"),
      },
    };
    await assert.rejects(
      withTransaction(transaction, () =>
        storeModule.organizationBrainConversationStore.claim(actor, {
          conversationId,
          userMessageId,
          brainMessageId,
          question: "当前目标是什么？",
        }),
      ),
      (error: unknown) =>
        error instanceof storeModule.OrganizationBrainConversationStoreError &&
        error.code === "IDEMPOTENCY_CONFLICT",
    );
  });

  test("completion inserts canonical JSON then strictly returns the committed winner", async () => {
    let persisted = "";
    const transaction = {
      brainConversation: { findFirst: async () => ownedConversation() },
      brainMessage: {
        createMany: async (input: {
          data: Array<{ content: string }>;
        }) => {
          persisted = input.data[0]?.content ?? "";
          return { count: 1 };
        },
        findUnique: async (input: { where: { id: string } }) =>
          input.where.id === userMessageId
            ? userMessage()
            : brainMessage(persisted),
      },
    };
    const result = await withTransaction(transaction, () =>
      storeModule.organizationBrainConversationStore.complete(actor, {
        conversationId,
        userMessageId,
        brainMessageId,
        result: noPlan(),
      }),
    );
    assert.deepEqual(Object.keys(JSON.parse(persisted)), [
      "schemaVersion",
      "status",
      "code",
      "message",
      "facts",
      "inferences",
      "recommendations",
      "missingEvidence",
      "sources",
    ]);
    assert.equal(result.code, "NO_SUPPORTED_PLAN");
  });
});

test("production store is server-only and exposes no generic write surface", () => {
  const source = readFileSync(
    new URL("./conversation-store.ts", import.meta.url),
    "utf8",
  );
  assert.equal(source.startsWith('import "server-only";'), true);
  assert.doesNotMatch(source, /\b(delete|updateMessage|writeMessage|executeRaw|queryRaw)\b/);
  assert.doesNotMatch(source, /\b(sql|callback|tool|action|command)\s*:/i);
});
