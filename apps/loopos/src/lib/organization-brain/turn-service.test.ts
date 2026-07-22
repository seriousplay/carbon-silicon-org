import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { after, before, describe, test } from "node:test";

import type { ActorContext } from "../authorization/actor-context-resolver";
import type { BrainEvidencePacket } from "./evidence";
import type {
  OrganizationBrainConversationStore,
  StoredOrganizationBrainResponse,
} from "./conversation-store";
import type { OrganizationBrainQueryResult } from "./query-broker";
import type { OrganizationBrainQueryPlannerResponse } from "./query-planner";
import type { RawPlanV1 } from "./query-planner-schema";
import {
  confirmedMemoryFromSharedEntry,
  type OrganizationBrainResponse,
} from "./response-schema";
import type { SharedMemoryEntry } from "./shared-memory-types";
import type { OrganizationBrainTurnServiceDependencies } from "./turn-service";

type TurnModule = typeof import("./turn-service");
type BrokerModule = typeof import("./query-broker");
type ReasonInput = Parameters<OrganizationBrainTurnServiceDependencies["reason"]>[0];

const require = createRequire(import.meta.url);
const originalNodePath = process.env.NODE_PATH;
const compiledModules = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../../node_modules/next/dist/compiled",
);
const moduleWithInitPaths = Module as typeof Module & { _initPaths(): void };
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let turnModule: TurnModule;
let brokerModule: BrokerModule;

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
  [turnModule, brokerModule] = await Promise.all([
    import("./turn-service"),
    import("./query-broker"),
  ]);
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
const conversationId = `bc_${"a".repeat(64)}`;
const now = "2026-07-14T08:00:00.000Z";
const truncationMarker =
  "More authorized rows existed than were returned; the answer is incomplete.";

function sharedMemoryEntry(index = 1): SharedMemoryEntry {
  return {
    schemaVersion: 1,
    candidateId: `mc-memory-${index}`,
    organizationId: actor.organizationId,
    claim: `本周期主目标是完成治理闭环 ${index}`,
    rationale: "已经通过授权流程确认。",
    authorityRoute: {
      kind: "GOVERNANCE",
      label: "治理会议确认",
      applicationUrl: `/app/governance/decisions/decision-${index}`,
    },
    sourceRefs: [{
      type: "decision",
      id: `decision-${index}`,
      label: "治理决议",
      applicationUrl: `/app/governance/decisions/decision-${index}`,
      observedAt: "2026-07-14T08:00:00.000Z",
    }],
    confirmedBy: {
      type: "person",
      id: actor.personId,
      label: "主回路成员",
    },
    validFrom: "2026-07-14T08:00:00.000Z",
    validUntil: null,
    supersededBy: null,
    confidence: "SOURCE_CONFIRMED",
    applicationUrl: `/app/brain/memory-candidates/mc-memory-${index}`,
    ranking: {
      routeRank: 1,
      sourceCount: 1,
      textMatchCount: 1,
      validFromTime: Date.parse("2026-07-14T08:00:00.000Z"),
      candidateId: `mc-memory-${index}`,
    },
  };
}

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

function noEvidence(): OrganizationBrainResponse {
  return {
    schemaVersion: 1,
    status: "INSUFFICIENT_EVIDENCE",
    code: "NO_AUTHORIZED_EVIDENCE",
    message: "当前没有可用于回答该问题的授权证据。",
    facts: [],
    inferences: [],
    recommendations: [],
    missingEvidence: [],
    sources: [],
  };
}

function packet(index: number, name = `圈子-${index}`): BrainEvidencePacket {
  const recordId = `circle-${index}`;
  return {
    evidenceId: `ev_${createHash("sha256")
      .update(actor.organizationId)
      .update("\0")
      .update("circles")
      .update("\0")
      .update(recordId)
      .digest("hex")}`,
    source: {
      resource: "circles",
      recordId,
      version: "2026-07-14T08:00:00.000Z",
    },
    display: { name, type: "GENERAL", purpose: "目标", status: "NORMAL" },
    truncatedFields: [],
    applicationUrl: `/loop-designer/app/circles/circle-${index}`,
  };
}

function evidenceOnly(
  values: readonly BrainEvidencePacket[],
  code: OrganizationBrainResponse["code"] = "PROVIDER_UNAVAILABLE",
): OrganizationBrainResponse {
  return {
    schemaVersion: 1,
    status: "EVIDENCE_ONLY",
    code,
    message: "模型回答不可用，以下仅展示已授权证据中的确定事实。",
    facts: values.map((value) => ({
        label: "事实",
        evidenceId: value.evidenceId,
        resource: value.source.resource,
        resourceLabel: "圈子",
        sourceVersion: value.source.version,
        recordId: value.source.recordId,
        applicationUrl: value.applicationUrl,
        fields: [
          { name: "name", label: "名称", value: value.display.name!, truncated: false },
          {
            name: "type",
            label: "类型",
            value: value.display.type!,
            truncated: false,
          },
          {
            name: "purpose",
            label: "目的",
            value: value.display.purpose!,
            truncated: false,
          },
          {
            name: "status",
            label: "状态",
            value: value.display.status!,
            truncated: false,
          },
        ],
      })),
    inferences: [],
    recommendations: [],
    missingEvidence: [],
    sources: values.map((value) => ({
        label: "来源",
        evidenceId: value.evidenceId,
        resource: value.source.resource,
        resourceLabel: "圈子",
        recordId: value.source.recordId,
        version: value.source.version,
        applicationUrl: value.applicationUrl,
      })),
  };
}

function answered(value: BrainEvidencePacket): OrganizationBrainResponse {
  return {
    schemaVersion: 1,
    status: "ANSWERED",
    code: "ANSWERED",
    message: "已基于授权证据生成回答。",
    facts: [
      {
        label: "事实",
        evidenceId: value.evidenceId,
        resource: value.source.resource,
        resourceLabel: "圈子",
        sourceVersion: value.source.version,
        recordId: value.source.recordId,
        applicationUrl: value.applicationUrl,
        fields: [
          { name: "name", label: "名称", value: value.display.name!, truncated: false },
        ],
      },
    ],
    inferences: [],
    recommendations: [],
    missingEvidence: [],
    sources: evidenceOnly([value]).sources,
  };
}

function plannerNoPlan(): OrganizationBrainQueryPlannerResponse {
  return { schemaVersion: 1, status: "NO_PLAN", code: "NO_SUPPORTED_PLAN", plans: [] };
}

function planned(count = 1): OrganizationBrainQueryPlannerResponse {
  return {
    schemaVersion: 1,
    status: "PLANNED",
    code: "PLANNED",
    plans: Array.from({ length: count }, (_, index) => ({
      schemaVersion: 1 as const,
      resource: "circles",
      filters: [{ field: "name", operator: "contains", value: `query-${index}` }],
      limit: 2,
    })),
  };
}

type StoreState = {
  calls: string[];
  completed: StoredOrganizationBrainResponse[];
  terminal: StoredOrganizationBrainResponse | null;
  claimDelay?: Promise<void>;
};

function fakeStore(
  state: StoreState,
  overrides: Partial<OrganizationBrainConversationStore> = {},
): OrganizationBrainConversationStore {
  const base: OrganizationBrainConversationStore = {
    create: async (_actor, input) => ({
      schemaVersion: 1,
      id: input.conversationId,
      title: null,
      createdAt: now,
      updatedAt: now,
    }),
    list: async (_actor, input) => {
      state.calls.push(`list:${input.limit}`);
      return { schemaVersion: 1, conversations: [] };
    },
    load: async (_actor, input) => {
      state.calls.push(`load:${input.conversationId}:${input.messageLimit}`);
      return {
        schemaVersion: 1,
        conversation: {
          schemaVersion: 1,
          id: input.conversationId,
          title: null,
          createdAt: now,
          updatedAt: now,
        },
        messages: [],
        hasMore: false,
      };
    },
    claim: async (_actor, input) => {
      state.calls.push(`claim:${input.question}`);
      await state.claimDelay;
      return { terminal: state.terminal };
    },
    complete: async (_actor, input) => {
      state.calls.push(`complete:${input.result.code}`);
      state.completed.push(input.result);
      return input.result;
    },
  };
  return Object.freeze({ ...base, ...overrides });
}

function service(
  options: Readonly<{
    state?: StoreState;
    store?: OrganizationBrainConversationStore;
    plan?: (
      actorValue: ActorContext,
      input: Readonly<{ schemaVersion: 1; question: string }>,
    ) => Promise<OrganizationBrainQueryPlannerResponse>;
    executeQuery?: (
      actorValue: ActorContext,
      conversationIdentity: string,
      userMessageId: string,
      plan: RawPlanV1,
    ) => Promise<OrganizationBrainQueryResult>;
    reason?: (input: ReasonInput) => Promise<OrganizationBrainResponse>;
    retrieveMemory?: (
      actorValue: ActorContext,
      input: Readonly<{ schemaVersion: 1; text: string | null; limit: number }>,
    ) => Promise<readonly SharedMemoryEntry[]>;
    resolveActor?: () => Promise<ActorContext>;
  }> = {},
) {
  const state = options.state ?? { calls: [], completed: [], terminal: null };
  const store = options.store ?? fakeStore(state);
  return {
    state,
    value: turnModule.createOrganizationBrainTurnService({
      resolveActor: options.resolveActor ?? (async () => actor),
      store,
      plan: options.plan ?? (async () => plannerNoPlan()),
      executeQuery:
        options.executeQuery ??
        (async () => ({ packets: [], hasMore: false })),
      reason: options.reason ?? (async () => noEvidence()),
      retrieveMemory: options.retrieveMemory ?? (async () => []),
    }),
  };
}

function turnInput(question = " 当前目标是什么？ ") {
  return {
    schemaVersion: 1 as const,
    conversationId,
    clientTurnId: "turn-1",
    question,
  };
}

describe("V5-M1-E1 exact inputs and owner-bound conversation operations", () => {
  test("invalid turn input performs no actor, store, planner, query, or reasoner call", async () => {
    const calls: string[] = [];
    let accessorCalls = 0;
    const accessorInput = { ...turnInput() } as Record<string, unknown>;
    Object.defineProperty(accessorInput, "question", {
      enumerable: true,
      get() {
        accessorCalls += 1;
        return "must not execute";
      },
    });
    const throwingProxy = new Proxy(turnInput(), {
      getPrototypeOf() {
        throw new Error("proxy detail");
      },
    });
    const customPrototype = Object.assign(Object.create({ inherited: true }), turnInput());
    const { value } = service({
      resolveActor: async () => {
        calls.push("actor");
        return actor;
      },
      plan: async () => {
        calls.push("plan");
        return plannerNoPlan();
      },
    });
    for (const input of [
      { ...turnInput(), extra: true },
      { ...turnInput(), schemaVersion: 2 },
      { ...turnInput(), conversationId: "" },
      { ...turnInput(), clientTurnId: "x".repeat(129) },
      { ...turnInput(), question: " ".repeat(3) },
      { ...turnInput(), question: "问".repeat(683) },
      { ...turnInput(), question: "bad\ud800" },
      accessorInput,
      throwingProxy,
      customPrototype,
    ]) {
      await assert.rejects(
        value.executeTurn(input as never),
        (error: unknown) =>
          error instanceof turnModule.OrganizationBrainTurnServiceError &&
          error.code === "INVALID_INPUT",
      );
    }
    assert.deepEqual(calls, []);
    assert.equal(accessorCalls, 0);
  });

  test("derives stable private conversation IDs and applies list/load defaults", async () => {
    const state: StoreState = { calls: [], completed: [], terminal: null };
    let createdId = "";
    const store = fakeStore(state, {
      create: async (_actor, input) => {
        createdId = input.conversationId;
        return {
          schemaVersion: 1,
          id: input.conversationId,
          title: null,
          createdAt: now,
          updatedAt: now,
        };
      },
    });
    const { value } = service({ state, store });
    const first = await value.createConversation({
      schemaVersion: 1,
      clientConversationId: "browser-private-1",
    });
    const second = await value.createConversation({
      schemaVersion: 1,
      clientConversationId: "browser-private-1",
    });
    await value.listConversations({ schemaVersion: 1 });
    await value.loadConversation({ schemaVersion: 1, conversationId });
    assert.match(createdId, /^bc_[a-f0-9]{64}$/);
    assert.equal(first.id, second.id);
    assert.deepEqual(state.calls, [`list:20`, `load:${conversationId}:50`]);
  });

  test("authentication failures are indistinguishable ACCESS_DENIED errors", async () => {
    const { value } = service({
      resolveActor: async () => {
        throw new Error("missing user and tenant details");
      },
    });
    await assert.rejects(
      value.loadConversation({ schemaVersion: 1, conversationId }),
      (error: unknown) =>
        error instanceof turnModule.OrganizationBrainTurnServiceError &&
        error.code === "ACCESS_DENIED" &&
        !error.message.includes("tenant details"),
    );
  });
});

describe("V5-M1-E1 durable turn order, replay, and coalescing", () => {
  test("persists normalized USER before planning and returns deterministic IDs", async () => {
    const state: StoreState = { calls: [], completed: [], terminal: null };
    const { value } = service({
      state,
      plan: async (_actor, input) => {
        state.calls.push(`plan:${input.question}`);
        return plannerNoPlan();
      },
    });
    const result = await value.executeTurn(turnInput());
    assert.deepEqual(state.calls, [
      "claim:当前目标是什么？",
      "plan:当前目标是什么？",
      "complete:NO_SUPPORTED_PLAN",
    ]);
    assert.match(result.userMessageId, /^bm_u_[a-f0-9]{64}$/);
    assert.equal(
      result.brainMessageId,
      result.userMessageId.replace("bm_u_", "bm_b_"),
    );
    assert.equal(result.result.code, "NO_SUPPORTED_PLAN");
    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.result), true);
  });

  test("answers capability help questions without requiring organization evidence", async () => {
    const state: StoreState = { calls: [], completed: [], terminal: null };
    const { value } = service({
      state,
      retrieveMemory: async () => {
        throw new Error("must not run");
      },
      plan: async () => {
        throw new Error("must not run");
      },
      executeQuery: async () => {
        throw new Error("must not run");
      },
      reason: async () => {
        throw new Error("must not run");
      },
    });
    const result = await value.executeTurn(turnInput("你可以回答哪些问题"));
    assert.deepEqual(state.calls, [
      "claim:你可以回答哪些问题",
      "complete:CAPABILITY_HELP",
    ]);
    assert.equal(result.result.status, "ANSWERED");
    assert.equal(result.result.code, "CAPABILITY_HELP");
    assert.match(result.result.message, /LoopOS 已授权组织数据/);
    assert.match(result.result.message, /当前组织目标/);
    assert.match(result.result.message, /提交张力/);
    assert.equal(result.result.recommendations.length, 0);
    assert.equal(result.result.sources.length, 0);
    assert.equal(result.result.facts.length, 0);
  });

  test("terminal replay makes zero memory, planner, query, reasoner, or completion calls", async () => {
    const state: StoreState = { calls: [], completed: [], terminal: noPlan() };
    const { value } = service({
      state,
      retrieveMemory: async () => {
        throw new Error("must not run");
      },
      plan: async () => {
        throw new Error("must not run");
      },
      executeQuery: async () => {
        throw new Error("must not run");
      },
      reason: async () => {
        throw new Error("must not run");
      },
    });
    const result = await value.executeTurn(turnInput());
    assert.deepEqual(state.calls, ["claim:当前目标是什么？"]);
    assert.equal(result.result.code, "NO_SUPPORTED_PLAN");
  });

  test("retrieves confirmed memory after claim and passes it to D1 separately", async () => {
    const memory = sharedMemoryEntry();
    const reasonInputs: ReasonInput[] = [];
    const retrievalInputs: Array<Readonly<{ text: string | null; limit: number }>> = [];
    const { value } = service({
      retrieveMemory: async (_actor, input) => {
        retrievalInputs.push({ text: input.text, limit: input.limit });
        return [memory];
      },
      plan: async () => planned(),
      executeQuery: async () => ({ packets: [packet(1)], hasMore: false }),
      reason: async (input) => {
        reasonInputs.push(input);
        return {
          ...evidenceOnly(input.evidence.packets),
          confirmedMemory: input.confirmedMemory!.map(confirmedMemoryFromSharedEntry),
        };
      },
    });
    const result = await value.executeTurn(turnInput("当前目标是什么？".repeat(80)));
    assert.equal(retrievalInputs.length, 1);
    assert.equal(retrievalInputs[0]!.limit, 5);
    assert.ok(Buffer.byteLength(retrievalInputs[0]!.text ?? "", "utf8") <= 400);
    assert.deepEqual(reasonInputs[0]!.confirmedMemory, [memory]);
    assert.equal(result.result.status, "EVIDENCE_ONLY");
    assert.deepEqual(result.result.confirmedMemory, [
      confirmedMemoryFromSharedEntry(memory),
    ]);
    assert.deepEqual(result.result.facts, evidenceOnly([packet(1)]).facts);
  });

  test("same-process duplicate calls coalesce while conflicting content fails", async () => {
    let release!: () => void;
    const delay = new Promise<void>((resolveDelay) => {
      release = resolveDelay;
    });
    const state: StoreState = {
      calls: [],
      completed: [],
      terminal: null,
      claimDelay: delay,
    };
    const { value } = service({ state });
    const first = value.executeTurn(turnInput());
    const second = value.executeTurn(turnInput());
    const conflict = value.executeTurn(turnInput("不同问题"));
    await assert.rejects(
      conflict,
      (error: unknown) =>
        error instanceof turnModule.OrganizationBrainTurnServiceError &&
        error.code === "IDEMPOTENCY_CONFLICT",
    );
    release();
    const [left, right] = await Promise.all([first, second]);
    assert.deepEqual(left, right);
    assert.equal(state.calls.filter((call) => call.startsWith("claim:")).length, 1);
    assert.equal(state.completed.length, 1);
  });
});

describe("V5-M1-E1 planner mappings", () => {
  test("returns memory-only answer for NO_PLAN when confirmed memory exists", async () => {
    let queryCalls = 0;
    let reasonCalls = 0;
    const memory = sharedMemoryEntry();
    const { value } = service({
      retrieveMemory: async () => [memory],
      plan: async () => plannerNoPlan(),
      executeQuery: async () => {
        queryCalls += 1;
        return { packets: [], hasMore: false };
      },
      reason: async () => {
        reasonCalls += 1;
        return noEvidence();
      },
    });
    const result = await value.executeTurn(turnInput());
    assert.equal(result.result.status, "ANSWERED");
    assert.equal(result.result.code, "ANSWERED");
    assert.deepEqual(result.result.confirmedMemory, [
      confirmedMemoryFromSharedEntry(memory),
    ]);
    assert.deepEqual(result.result.facts, []);
    assert.deepEqual(result.result.sources, []);
    assert.equal(queryCalls, 0);
    assert.equal(reasonCalls, 0);
  });

  test("maps NO_PLAN, UNAVAILABLE, and REJECTED without query or reasoner", async (context) => {
    const cases = [
      {
        name: "no plan",
        response: plannerNoPlan(),
        status: "INSUFFICIENT_EVIDENCE",
        code: "NO_SUPPORTED_PLAN",
      },
      {
        name: "unavailable",
        response: {
          schemaVersion: 1,
          status: "UNAVAILABLE",
          code: "PROVIDER_TIMEOUT",
          plans: [],
        } as const,
        status: "UNAVAILABLE",
        code: "PROVIDER_TIMEOUT",
      },
      {
        name: "rejected",
        response: {
          schemaVersion: 1,
          status: "REJECTED",
          code: "INVALID_FILTER",
          plans: [],
        } as const,
        status: "REJECTED",
        code: "INVALID_FILTER",
      },
    ];
    for (const entry of cases) {
      await context.test(entry.name, async () => {
        let queryCalls = 0;
        let reasonCalls = 0;
        const { value } = service({
          plan: async () => entry.response,
          executeQuery: async () => {
            queryCalls += 1;
            return { packets: [], hasMore: false };
          },
          reason: async () => {
            reasonCalls += 1;
            return noEvidence();
          },
        });
        const result = await value.executeTurn(turnInput());
        assert.equal(result.result.status, entry.status);
        assert.equal(result.result.code, entry.code);
        assert.equal(queryCalls, 0);
        assert.equal(reasonCalls, 0);
      });
    }
  });

  test("maps thrown and malformed planner outputs to distinct fixed failures", async (context) => {
    for (const entry of [
      {
        name: "execution",
        plan: async () => {
          throw new Error("provider secret");
        },
        code: "PLANNER_EXECUTION_FAILED",
      },
      {
        name: "response",
        plan: async () =>
          ({ schemaVersion: 1, status: "PLANNED", code: "PLANNED", plans: [] }) as never,
        code: "PLANNER_RESPONSE_INVALID",
      },
    ]) {
      await context.test(entry.name, async () => {
        const { value } = service({ plan: entry.plan });
        const result = await value.executeTurn(turnInput());
        assert.equal(result.result.status, "FAILED");
        assert.equal(result.result.code, entry.code);
        assert.equal(JSON.stringify(result).includes("provider secret"), false);
      });
    }
  });

  test("rejects injected plans that bypass D2 aggregate, semantic, or preflight rules", async (context) => {
    const basePlan = planned().plans[0]!;
    const highCostPlan = (suffix: string): RawPlanV1 => ({
      schemaVersion: 1,
      resource: "circles",
      filters: Array.from({ length: 6 }, (_, index) => ({
        field: index % 2 === 0 ? "name" : "purpose",
        operator: "contains",
        value: `${suffix}-${index}`,
      })),
      limit: 1,
    });
    const cases: ReadonlyArray<Readonly<{ name: string; plans: readonly RawPlanV1[] }>> = [
      {
        name: "total rows",
        plans: planned(3).plans.map((plan) => ({ ...plan, limit: 10 })),
      },
      { name: "total cost", plans: [highCostPlan("a"), highCostPlan("b")] },
      { name: "duplicate plan", plans: [basePlan, { ...basePlan }] },
      {
        name: "literal id not present in question",
        plans: [
          {
            schemaVersion: 1,
            resource: "circles",
            filters: [{ field: "id", operator: "eq", value: "circle-secret" }],
            limit: 1,
          },
        ],
      },
      {
        name: "id sort omitted from D2 projection",
        plans: [{ ...basePlan, sort: [{ field: "id", direction: "asc" }] }],
      },
      {
        name: "M1-C preflight rejection",
        plans: [
          {
            ...basePlan,
            filters: [{ field: "unknown", operator: "eq", value: "x" }],
          },
        ],
      },
    ];
    for (const entry of cases) {
      await context.test(entry.name, async () => {
        let queryCalls = 0;
        let reasonCalls = 0;
        const { value } = service({
          plan: async () =>
            ({
              schemaVersion: 1,
              status: "PLANNED",
              code: "PLANNED",
              plans: entry.plans,
            }) as OrganizationBrainQueryPlannerResponse,
          executeQuery: async () => {
            queryCalls += 1;
            return { packets: [], hasMore: false };
          },
          reason: async () => {
            reasonCalls += 1;
            return noEvidence();
          },
        });
        const result = await value.executeTurn(turnInput());
        assert.equal(result.result.status, "FAILED");
        assert.equal(result.result.code, "PLANNER_RESPONSE_INVALID");
        assert.equal(queryCalls, 0);
        assert.equal(reasonCalls, 0);
      });
    }
  });
});

describe("V5-M1-E1 sequential query and evidence semantics", () => {
  test("executes three plans sequentially with one USER identity, ORs hasMore, and deduplicates", async () => {
    const order: string[] = [];
    const shared = packet(1);
    const reasonInputs: ReasonInput[] = [];
    const { value } = service({
      plan: async () => planned(3),
      executeQuery: async (_actor, currentConversation, messageId, plan) => {
        const marker = String(plan.filters?.[0]?.value);
        order.push(`start:${marker}:${currentConversation}:${messageId}`);
        await Promise.resolve();
        order.push(`end:${marker}`);
        const index = Number(marker.at(-1));
        return {
          packets: index === 1 ? [shared] : [shared, packet(index + 2)],
          hasMore: index === 2,
        };
      },
      reason: async (input) => {
        reasonInputs.push(input);
        order.push("reason");
        return evidenceOnly(input.evidence.packets);
      },
    });
    const result = await value.executeTurn(turnInput());
    assert.deepEqual(
      order.map((entry) => entry.split(":").slice(0, 2).join(":")),
      [
        "start:query-0",
        "end:query-0",
        "start:query-1",
        "end:query-1",
        "start:query-2",
        "end:query-2",
        "reason",
      ],
    );
    const reasonInput = reasonInputs[0]!;
    assert.equal(reasonInput.evidence.hasMore, true);
    assert.deepEqual(
      reasonInput.evidence.packets.map((entry) => entry.evidenceId),
      [shared.evidenceId, packet(2).evidenceId, packet(4).evidenceId],
    );
    assert.equal(result.result.status, "EVIDENCE_ONLY");
    assert.equal(result.result.code, "PROVIDER_UNAVAILABLE");
    assert.deepEqual(result.result.missingEvidence, [
      { label: "缺失证据", text: truncationMarker },
    ]);
  });

  test("reserves the sixth missing-evidence slot for deterministic truncation", async () => {
    const packets = [packet(1), packet(2)];
    const modelMissing = Array.from({ length: 6 }, (_, index) => ({
      label: "缺失证据" as const,
      text: `模型缺失 ${index + 1}`,
    }));
    const { value } = service({
      plan: async () => planned(),
      executeQuery: async () => ({ packets, hasMore: true }),
      reason: async () => ({
        ...answered(packets[0]!),
        missingEvidence: modelMissing,
        sources: evidenceOnly(packets).sources,
      }),
    });

    const result = await value.executeTurn(turnInput());
    assert.equal(result.result.status, "ANSWERED");
    assert.deepEqual(result.result.missingEvidence, [
      ...modelMissing.slice(0, 5),
      { label: "缺失证据", text: truncationMarker },
    ]);
  });

  test("keeps the server truncation marker once when the model repeats it", async () => {
    for (const markerIndex of [0, 2, 4]) {
      const packets = [packet(1), packet(2)];
      const modelMissing = Array.from({ length: 6 }, (_, index) => ({
        label: "缺失证据" as const,
        text: index === markerIndex ? truncationMarker : `模型缺失 ${index + 1}`,
      }));
      const { value } = service({
        plan: async () => planned(),
        executeQuery: async () => ({ packets, hasMore: true }),
        reason: async () => ({
          ...answered(packets[0]!),
          missingEvidence: modelMissing,
          sources: evidenceOnly(packets).sources,
        }),
      });

      const result = await value.executeTurn(turnInput(`turn-marker-${markerIndex}`));
      assert.equal(result.result.status, "ANSWERED");
      assert.deepEqual(result.result.missingEvidence, [
        ...modelMissing
          .filter((item) => item.text !== truncationMarker)
          .slice(0, 5),
        { label: "缺失证据", text: truncationMarker },
      ]);
    }
  });

  test("deduplicates reconstructed packet content independent of object key order", async () => {
    const original = packet(1);
    const reordered = {
      applicationUrl: original.applicationUrl,
      truncatedFields: original.truncatedFields,
      display: {
        status: original.display.status,
        purpose: original.display.purpose,
        type: original.display.type,
        name: original.display.name,
      },
      source: {
        version: original.source.version,
        recordId: original.source.recordId,
        resource: original.source.resource,
      },
      evidenceId: original.evidenceId,
    } as BrainEvidencePacket;
    let queryCalls = 0;
    const { value } = service({
      plan: async () => planned(2),
      executeQuery: async () => ({
        packets: [queryCalls++ === 0 ? original : reordered],
        hasMore: false,
      }),
      reason: async (input) => {
        assert.equal(input.evidence.packets.length, 1);
        assert.deepEqual(Object.keys(input.evidence.packets[0]!.display), [
          "name",
          "type",
          "purpose",
          "status",
        ]);
        return evidenceOnly(input.evidence.packets);
      },
    });
    const result = await value.executeTurn(turnInput());
    assert.equal(queryCalls, 2);
    assert.equal(result.result.status, "EVIDENCE_ONLY");
  });

  test("rejects hostile broker packets before D1", async (context) => {
    const valid = packet(1);
    const cases: ReadonlyArray<Readonly<{ name: string; result: unknown }>> = [
      { name: "forged evidence id", result: { ...valid, evidenceId: `ev_${"0".repeat(64)}` } },
      {
        name: "source identity mismatch",
        result: { ...valid, source: { ...valid.source, recordId: "circle-forged" } },
      },
      {
        name: "noncanonical version",
        result: { ...valid, source: { ...valid.source, version: "2026-07-14" } },
      },
      {
        name: "missing catalog display field",
        result: { ...valid, display: { name: "圈子", purpose: "目标" } },
      },
      {
        name: "oversized display value",
        result: { ...valid, display: { ...valid.display, name: "x".repeat(2_049) } },
      },
      {
        name: "invalid truncated fields",
        result: { ...valid, truncatedFields: ["name", "name"] },
      },
      { name: "remote application url", result: { ...valid, applicationUrl: "https://evil" } },
    ];
    for (const entry of cases) {
      await context.test(entry.name, async () => {
        let reasonCalls = 0;
        const { value } = service({
          plan: async () => planned(),
          executeQuery: async () => ({
            packets: [entry.result] as never,
            hasMore: false,
          }),
          reason: async () => {
            reasonCalls += 1;
            return noEvidence();
          },
        });
        const result = await value.executeTurn(turnInput());
        assert.equal(result.result.status, "FAILED");
        assert.equal(result.result.code, "QUERY_EXECUTION_FAILED");
        assert.equal(reasonCalls, 0);
      });
    }

    await context.test("packet count and hasMore contract", async () => {
      let reasonCalls = 0;
      for (const queryResponse of [
        { packets: [packet(1), packet(2), packet(3)], hasMore: false },
        { packets: [packet(1)], hasMore: true },
      ]) {
        const { value } = service({
          plan: async () => planned(),
          executeQuery: async () => queryResponse,
          reason: async () => {
            reasonCalls += 1;
            return noEvidence();
          },
        });
        const result = await value.executeTurn(turnInput());
        assert.equal(result.result.code, "QUERY_EXECUTION_FAILED");
      }
      assert.equal(reasonCalls, 0);
    });
  });

  test("calls D1 exactly once for successful zero rows", async () => {
    let reasonCalls = 0;
    const { value } = service({
      plan: async () => planned(),
      executeQuery: async () => ({ packets: [], hasMore: false }),
      reason: async (input) => {
        reasonCalls += 1;
        assert.deepEqual(input.evidence, {
          status: "AUTHORIZED",
          packets: [],
          hasMore: false,
        });
        return noEvidence();
      },
    });
    const result = await value.executeTurn(turnInput());
    assert.equal(reasonCalls, 1);
    assert.equal(result.result.code, "NO_AUTHORIZED_EVIDENCE");
  });

  test("conflicting duplicate evidence fails closed after all queries and before D1", async () => {
    let queryCalls = 0;
    let reasonCalls = 0;
    const { value } = service({
      plan: async () => planned(3),
      executeQuery: async () => {
        queryCalls += 1;
        return {
          packets: [packet(1, queryCalls === 2 ? "不同内容" : "圈子-1")],
          hasMore: false,
        };
      },
      reason: async () => {
        reasonCalls += 1;
        return noEvidence();
      },
    });
    const result = await value.executeTurn(turnInput());
    assert.equal(queryCalls, 3);
    assert.equal(reasonCalls, 0);
    assert.equal(result.result.status, "FAILED");
    assert.equal(result.result.code, "EVIDENCE_CONFLICT");
  });

  test("stops at first query failure, discards partial packets, and skips D1", async () => {
    let queryCalls = 0;
    let reasonCalls = 0;
    const { value } = service({
      plan: async () => planned(3),
      executeQuery: async () => {
        queryCalls += 1;
        if (queryCalls === 2) {
          throw new brokerModule.OrganizationBrainQueryError("QUERY_TIMEOUT");
        }
        return { packets: [packet(1)], hasMore: false };
      },
      reason: async () => {
        reasonCalls += 1;
        return noEvidence();
      },
    });
    const result = await value.executeTurn(turnInput());
    assert.equal(queryCalls, 2);
    assert.equal(reasonCalls, 0);
    assert.equal(result.result.code, "QUERY_TIMEOUT");
    assert.deepEqual(result.result.sources, []);
  });
});

describe("V5-M1-E1 broker and reasoner failure mappings", () => {
  test("maps every typed broker plan code to REJECTED with the same code", async (context) => {
    const codes = [
      "INVALID_PLAN",
      "PLAN_TOO_LARGE",
      "PLAN_TOO_DEEP",
      "PLAN_TOO_COMPLEX",
      "UNSUPPORTED_RESOURCE",
      "UNSUPPORTED_FIELD",
      "UNSUPPORTED_OPERATOR",
      "INVALID_FILTER",
      "INVALID_RELATION",
      "INVALID_SORT",
      "INVALID_PAGE",
      "INVALID_LIMIT",
      "PRIVATE_MESSAGE_SCOPE_REQUIRED",
      "ACTOR_REFERENCE_LIMIT",
      "QUERY_TOO_EXPENSIVE",
    ] as const;
    for (const code of codes) {
      await context.test(code, async () => {
        const { value } = service({
          plan: async () => planned(),
          executeQuery: async () => {
            throw new brokerModule.OrganizationBrainQueryError(code);
          },
        });
        const result = await value.executeTurn(turnInput());
        assert.equal(result.result.status, "REJECTED");
        assert.equal(result.result.code, code);
      });
    }
  });

  test("maps invocation denial, every broker failure, and unexpected errors", async (context) => {
    const cases = [
      { code: "INVALID_INVOCATION", status: "DENIED", stored: "ACCESS_DENIED" },
      { code: "AUDIT_FAILED", status: "FAILED", stored: "AUDIT_FAILED" },
      { code: "QUERY_TIMEOUT", status: "FAILED", stored: "QUERY_TIMEOUT" },
      {
        code: "DATABASE_POLICY_MISMATCH",
        status: "FAILED",
        stored: "DATABASE_POLICY_MISMATCH",
      },
      {
        code: "DATABASE_UNAVAILABLE",
        status: "FAILED",
        stored: "DATABASE_UNAVAILABLE",
      },
      { code: "ROW_SHAPE_MISMATCH", status: "FAILED", stored: "ROW_SHAPE_MISMATCH" },
      {
        code: "DATABASE_EXECUTION_FAILED",
        status: "FAILED",
        stored: "DATABASE_EXECUTION_FAILED",
      },
      { code: null, status: "FAILED", stored: "QUERY_EXECUTION_FAILED" },
    ] as const;
    for (const entry of cases) {
      await context.test(entry.stored, async () => {
        const { value } = service({
          plan: async () => planned(),
          executeQuery: async () => {
            if (entry.code === null) throw new Error("raw database password");
            throw new brokerModule.OrganizationBrainQueryError(entry.code);
          },
        });
        const result = await value.executeTurn(turnInput());
        assert.equal(result.result.status, entry.status);
        assert.equal(result.result.code, entry.stored);
        assert.equal(JSON.stringify(result).includes("password"), false);
      });
    }
  });

  test("persists packet-derived evidence for reasoner failures without raw details", async (context) => {
    const supplied = [packet(1), packet(2)];
    for (const entry of [
      {
        name: "execution",
        reason: async () => {
          throw new Error("model credential");
        },
        code: "PROVIDER_FAILURE",
        secret: "credential",
      },
      {
        name: "timeout",
        reason: async () => {
          throw new Error("provider timed out with credential");
        },
        code: "PROVIDER_TIMEOUT",
        secret: "credential",
      },
      {
        name: "response",
        reason: async () => ({ ...noEvidence(), raw: "secret" }) as never,
        code: "OUTPUT_SCHEMA_INVALID",
        secret: "secret",
      },
    ]) {
      await context.test(entry.name, async () => {
        const { value } = service({
          plan: async () => planned(),
          executeQuery: async () => ({ packets: supplied, hasMore: true }),
          reason: entry.reason,
        });
        const result = await value.executeTurn(turnInput());
        assert.equal(result.result.status, "EVIDENCE_ONLY");
        assert.equal(result.result.code, entry.code);
        assert.deepEqual(result.result.facts, evidenceOnly(supplied).facts);
        assert.deepEqual(result.result.sources, evidenceOnly(supplied).sources);
        assert.deepEqual(result.result.missingEvidence, [
          { label: "缺失证据", text: truncationMarker },
        ]);
        assert.equal(JSON.stringify(result).includes(entry.secret), false);
      });
    }
  });

  test("rejects D1 output that is not congruent with the exact supplied evidence", async (context) => {
    const supplied = packet(1);
    const fallback = evidenceOnly([supplied]);
    const supportedAnswer = answered(supplied);
    const cases: ReadonlyArray<
      Readonly<{ name: string; response: OrganizationBrainResponse }>
    > = [
      {
        name: "fabricated but internally consistent source",
        response: answered(packet(99)),
      },
      {
        name: "fabricated fact value",
        response: {
          ...supportedAnswer,
          facts: [
            {
              ...supportedAnswer.facts[0]!,
              fields: [
                {
                  ...supportedAnswer.facts[0]!.fields[0]!,
                  value: "未由 broker 返回",
                },
              ],
            },
          ],
        },
      },
      {
        name: "evidence-only inference",
        response: {
          ...fallback,
          inferences: [{ label: "推断", text: "推断", citations: [supplied.evidenceId] }],
        },
      },
      {
        name: "evidence-only recommendation",
        response: {
          ...fallback,
          recommendations: [
            { label: "建议", text: "建议", citations: [supplied.evidenceId] },
          ],
        },
      },
      {
        name: "evidence-only missing evidence",
        response: {
          ...fallback,
          missingEvidence: [{ label: "缺失证据", text: "缺失" }],
        },
      },
      {
        name: "evidence-only partial fact",
        response: {
          ...fallback,
          facts: [
            {
              ...fallback.facts[0]!,
              fields: [fallback.facts[0]!.fields[0]!],
            },
          ],
        },
      },
    ];
    for (const entry of cases) {
      await context.test(entry.name, async () => {
        const state: StoreState = { calls: [], completed: [], terminal: null };
        const { value } = service({
          state,
          plan: async () => planned(),
          executeQuery: async () => ({ packets: [supplied], hasMore: false }),
          reason: async () => entry.response,
        });
        const result = await value.executeTurn(turnInput());
        assert.equal(result.result.status, "EVIDENCE_ONLY");
        assert.equal(result.result.code, "OUTPUT_SCHEMA_INVALID");
        assert.deepEqual(result.result.facts, evidenceOnly([supplied]).facts);
        assert.deepEqual(result.result.sources, evidenceOnly([supplied]).sources);
        assert.equal(state.completed.at(-1)?.code, "OUTPUT_SCHEMA_INVALID");
      });
    }
  });

  test("rejects D1 output that omits or alters confirmed memory", async () => {
    const supplied = packet(1);
    const memory = sharedMemoryEntry();
    const { value } = service({
      retrieveMemory: async () => [memory],
      plan: async () => planned(),
      executeQuery: async () => ({ packets: [supplied], hasMore: false }),
      reason: async () => evidenceOnly([supplied]),
    });
    const result = await value.executeTurn(turnInput());
    assert.equal(result.result.status, "EVIDENCE_ONLY");
    assert.equal(result.result.code, "OUTPUT_SCHEMA_INVALID");
    assert.deepEqual(result.result.confirmedMemory, [
      confirmedMemoryFromSharedEntry(memory),
    ]);
    assert.deepEqual(result.result.facts, evidenceOnly([supplied]).facts);
  });
});

describe("V5-M1-E1 persistence failure boundary", () => {
  test("never returns an unpersisted answer when completion fails", async () => {
    const state: StoreState = { calls: [], completed: [], terminal: null };
    const store = fakeStore(state, {
      complete: async () => {
        throw new Error("database raw detail");
      },
    });
    const { value } = service({ state, store });
    await assert.rejects(
      value.executeTurn(turnInput()),
      (error: unknown) =>
        error instanceof turnModule.OrganizationBrainTurnServiceError &&
        error.code === "PERSISTENCE_FAILED" &&
        !error.message.includes("raw detail"),
    );
  });

  test("preserves the fixed pre-claim store error allowlist", async () => {
    for (const code of [
      "ACCESS_DENIED",
      "IDEMPOTENCY_CONFLICT",
      "PERSISTENCE_FAILED",
      "STORED_RESPONSE_INVALID",
    ] as const) {
      const state: StoreState = { calls: [], completed: [], terminal: null };
      const store = fakeStore(state, {
        claim: async () => {
          throw new (await import("./conversation-store")).OrganizationBrainConversationStoreError(
            code,
          );
        },
      });
      const { value } = service({ state, store });
      await assert.rejects(
        value.executeTurn(turnInput()),
        (error: unknown) =>
          error instanceof turnModule.OrganizationBrainTurnServiceError &&
          error.code === code,
      );
    }
  });
});

test("turn service is server-only, bounded to approved dependencies, and has no generic capability input", () => {
  const source = readFileSync(new URL("./turn-service.ts", import.meta.url), "utf8");
  assert.equal(source.startsWith('import "server-only";'), true);
  assert.match(source, /resolveActorContext/);
  assert.match(source, /organizationBrainConversationStore/);
  assert.match(source, /planOrganizationQuestion/);
  assert.match(source, /executeOrganizationBrainQuery/);
  assert.match(source, /reasonOrganizationQuestion/);
  assert.doesNotMatch(source, /\b(executeRaw|queryRaw|deleteMessage|updateMessage)\b/);
  const publicInputs = Array.from(
    source.matchAll(
      /export type OrganizationBrain(?:ConversationCreate|ConversationList|ConversationLoad|Turn)Input = Readonly<\{[\s\S]*?\n\}>;/g,
    ),
    (match) => match[0],
  ).join("\n");
  assert.equal(publicInputs.length > 0, true);
  assert.doesNotMatch(
    publicInputs,
    /(?:actor|tenant|owner|role|history|evidence|sql|url|tool|action|command|database|callback)\??\s*:/i,
  );
});
