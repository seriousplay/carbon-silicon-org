import assert from "node:assert/strict";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

import {
  GovernanceDecisionError,
  authorizeGovernanceOperation,
  authorizeProposerConfirmation,
  canonicalGovernanceJson,
  createPrismaGovernanceDecisionDependencies,
  executeGovernanceDecisionOperation,
  isGovernanceRoleTargetCircleStatus,
  parseGovernanceRoleCreatedPayload,
  parseGovernanceRevision,
  transitionGovernanceDecision,
  type GovernanceDecisionContext,
  type GovernanceDecisionDependencies,
  type GovernanceDecisionInput,
  type GovernanceDecisionOperation,
  type GovernanceDecisionOperationRecord,
  type GovernanceDecisionProcessSnapshot,
  type GovernanceDecisionState,
  type GovernanceDecisionTransaction,
  type GovernanceAdoptionWriteStep,
  type GovernanceProposalRevisionInput,
} from "../governance-decision";
import { MEETING_LIFECYCLE_DENIAL_CODE } from "../organization-setup/meeting-lifecycle-policy";

const proposer = "person-proposer";
const participant = "person-participant";

describe("GD1 six-state transition table", () => {
  const allowed: Array<{
    from: GovernanceDecisionState | null;
    operation: GovernanceDecisionOperation;
    to: GovernanceDecisionState;
  }> = [
    { from: null, operation: "INITIALIZE", to: "READY" },
    { from: "READY", operation: "REQUEST_CLARIFICATION", to: "CLARIFICATION_REQUIRED" },
    { from: "CLARIFICATION_REQUIRED", operation: "SUBMIT_REVISION", to: "READY" },
    { from: "READY", operation: "RAISE_OBJECTION", to: "OBJECTION_PENDING" },
    { from: "OBJECTION_PENDING", operation: "ASSESS_OBJECTION_INVALID", to: "READY" },
    { from: "OBJECTION_PENDING", operation: "ASSESS_OBJECTION_VALID", to: "AMENDMENT_REQUIRED" },
    { from: "AMENDMENT_REQUIRED", operation: "SUBMIT_REVISION", to: "READY" },
    { from: "READY", operation: "RECORD_NON_ADOPTION", to: "NOT_ADOPTED" },
    { from: "AMENDMENT_REQUIRED", operation: "RECORD_NON_ADOPTION", to: "NOT_ADOPTED" },
    { from: "NOT_ADOPTED", operation: "SUBMIT_REVISION", to: "READY" },
    { from: "READY", operation: "ADOPT_ROLE", to: "ADOPTED" },
  ];

  for (const row of allowed) {
    test(`${row.from ?? "NO_PROCESS"} + ${row.operation} -> ${row.to}`, () => {
      assert.equal(transitionGovernanceDecision(row.from, row.operation), row.to);
    });
  }

  test("invalid and terminal transitions are stable typed denials", () => {
    const states: Array<GovernanceDecisionState | null> = [null, "READY", "CLARIFICATION_REQUIRED", "OBJECTION_PENDING", "AMENDMENT_REQUIRED", "NOT_ADOPTED", "ADOPTED"];
    const operations: GovernanceDecisionOperation[] = ["INITIALIZE", "SUBMIT_REVISION", "REQUEST_CLARIFICATION", "RAISE_OBJECTION", "ASSESS_OBJECTION_INVALID", "ASSESS_OBJECTION_VALID", "RECORD_NON_ADOPTION", "ADOPT_ROLE"];
    const allowedPairs = new Set(allowed.map((row) => `${row.from ?? "NULL"}:${row.operation}`));
    for (const state of states) {
      for (const operation of operations) {
        if (allowedPairs.has(`${state ?? "NULL"}:${operation}`)) continue;
        assert.throws(
          () => transitionGovernanceDecision(state, operation),
          (error) => error instanceof GovernanceDecisionError && error.code === "INVALID_TRANSITION",
        );
      }
    }
  });
});

describe("distributed governance authority", () => {
  test("proposer confirmation is allowed after the meeting process gate", () => {
    assert.doesNotThrow(() => authorizeProposerConfirmation({ operation: "ADOPT_ROLE", actorId: proposer, proposerId: proposer, allowed: false }));
    assert.doesNotThrow(() => authorizeProposerConfirmation({ operation: "ADOPT_ROLE", actorId: participant, proposerId: proposer, allowed: false }));
    assert.doesNotThrow(() => authorizeProposerConfirmation({ operation: "ADOPT_ROLE", actorId: proposer, proposerId: proposer, allowed: true }));
  });
  test("only the immutable proposer authors revisions, without participant status", () => {
    for (const isParticipant of [true, false]) {
      assert.doesNotThrow(() => authorizeGovernanceOperation({ operation: "SUBMIT_REVISION", actorId: proposer, proposerId: proposer, isCurrentParticipant: isParticipant }));
    }
    assert.throws(
      () => authorizeGovernanceOperation({ operation: "SUBMIT_REVISION", actorId: participant, proposerId: proposer, isCurrentParticipant: true }),
      (error) => error instanceof GovernanceDecisionError && error.code === "PROPOSER_REQUIRED",
    );
  });

  test("every meeting result requires an actual current exact-meeting participant", () => {
    const results: GovernanceDecisionOperation[] = ["REQUEST_CLARIFICATION", "RAISE_OBJECTION", "ASSESS_OBJECTION_INVALID", "ASSESS_OBJECTION_VALID", "RECORD_NON_ADOPTION", "ADOPT_ROLE"];
    for (const operation of results) {
      assert.doesNotThrow(() => authorizeGovernanceOperation({ operation, actorId: participant, proposerId: proposer, isCurrentParticipant: true }));
      assert.doesNotThrow(() => authorizeGovernanceOperation({ operation, actorId: proposer, proposerId: proposer, isCurrentParticipant: true }));
      assert.throws(
        () => authorizeGovernanceOperation({ operation, actorId: proposer, proposerId: proposer, isCurrentParticipant: false }),
        (error) => error instanceof GovernanceDecisionError && error.code === "MEETING_PARTICIPANT_REQUIRED",
      );
    }
  });

  test("titles and runtime identity never substitute for participation", () => {
    for (const actorId of ["org-admin", "coach", "circle-lead", "recorder-title", "runtime-ai"]) {
      assert.throws(
        () => authorizeGovernanceOperation({ operation: "ADOPT_ROLE", actorId, proposerId: proposer, isCurrentParticipant: false }),
        (error) => error instanceof GovernanceDecisionError && error.code === "MEETING_PARTICIPANT_REQUIRED",
      );
    }
  });
});

describe("bounded typed ROLE_CREATED payload", () => {
  const valid = {
    schemaVersion: 1,
    operation: "ROLE_CREATED",
    circleId: "circle-home",
    name: " Data Steward ",
    purpose: " Keep training data trustworthy ",
    domain: null,
    accountabilities: " Validate provenance ",
    category: "OPERATIONS",
    ownershipType: "HOME",
  } as const;

  test("normalizes the exact unassigned HOME role contract", () => {
    assert.deepEqual(parseGovernanceRoleCreatedPayload(valid), {
      ...valid,
      name: "Data Steward",
      purpose: "Keep training data trustworthy",
      accountabilities: "Validate provenance",
    });
  });

  test("rejects aliases, extra fields, assignments, non-HOME and unsupported mutation types", () => {
    const invalid: unknown[] = [
      { ...valid, operation: "ROLE_MODIFIED" },
      { ...valid, ownershipType: "SUPPORT" },
      { ...valid, assigneeId: participant },
      { ...valid, contractId: "contract" },
      { ...valid, name: " " },
      { ...valid, domain: " ".repeat(600) },
      { ...valid, category: "NOT_A_ROLE_CATEGORY" },
    ];
    for (const payload of invalid) {
      assert.throws(
        () => parseGovernanceRoleCreatedPayload(payload),
        (error) => error instanceof GovernanceDecisionError && error.code === "INVALID_ROLE_PAYLOAD",
      );
    }
  });

  test("canonical JSON is recursively stable and preserves explicit null", () => {
    assert.equal(
      canonicalGovernanceJson({ z: 1, a: { y: null, x: [3, { b: 2, a: 1 }] } }),
      '{"a":{"x":[3,{"a":1,"b":2}],"y":null},"z":1}',
    );
  });

  test("normalized ROLE_CREATED revisions can be parsed after command preview persistence", () => {
    const revision = parseGovernanceRevision({
      currentStructure: "No role",
      proposedStructure: "Create role",
      rationale: "Clear ownership",
      expectedImpact: "Safe to try",
      typedChange: {
        schemaVersion: 1,
        operation: "ROLE_CREATED",
        targetId: null,
        name: "Evidence Owner",
        purpose: "Own evidence",
        domain: null,
        accountabilities: "Maintain evidence",
        category: "EXPERT",
        circleId: "circle-a",
        ownershipType: "HOME",
      },
    });
    assert.equal(revision.typedChange.operation, "ROLE_CREATED");
    assert.equal(revision.typedChange.name, "Evidence Owner");
  });

  test("only same-tenant adapter targets in NORMAL or WARNING status are eligible", () => {
    assert.equal(isGovernanceRoleTargetCircleStatus("NORMAL"), true);
    assert.equal(isGovernanceRoleTargetCircleStatus("WARNING"), true);
    assert.equal(isGovernanceRoleTargetCircleStatus("HALTED"), false);
    assert.equal(isGovernanceRoleTargetCircleStatus("ARCHIVED"), false);
  });
});

describe("structured material-harm objections and immutable revision semantics", () => {
  test("valid objection blocks the unchanged revision; invalid returns it READY", () => {
    assert.equal(transitionGovernanceDecision("OBJECTION_PENDING", "ASSESS_OBJECTION_VALID"), "AMENDMENT_REQUIRED");
    assert.equal(transitionGovernanceDecision("OBJECTION_PENDING", "ASSESS_OBJECTION_INVALID"), "READY");
  });

  test("non-adoption is revision-terminal while the process may accept a proposer revision", () => {
    assert.throws(() => transitionGovernanceDecision("NOT_ADOPTED", "ADOPT_ROLE"), GovernanceDecisionError);
    assert.equal(transitionGovernanceDecision("NOT_ADOPTED", "SUBMIT_REVISION"), "READY");
  });
});

const role: GovernanceProposalRevisionInput["typedChange"] = {
  schemaVersion: 1,
  operation: "ROLE_CREATED",
  circleId: "circle-home",
  name: "Data Steward",
  purpose: "Keep training data trustworthy",
  domain: null,
  accountabilities: "Validate provenance",
  category: "OPERATIONS",
  ownershipType: "HOME",
};

const revision: GovernanceProposalRevisionInput = {
  currentStructure: "No explicit data stewardship role",
  proposedStructure: "Create one unassigned home role",
  rationale: "The accountability is currently missing",
  expectedImpact: "Clear ownership of provenance quality",
  typedChange: role,
};

function process(state: GovernanceDecisionState = "READY"): GovernanceDecisionProcessSnapshot {
  return {
    id: "process-1",
    organizationId: "org-a",
    proposalId: "proposal-a",
    sourceTensionId: "tension-a",
    provenanceKind: "INTERFACE_RUN",
    runId: "run-a",
    meetingId: "meeting-a",
    sourceTensionArtifactId: "source-artifact",
    proposalArtifactId: "proposal-artifact",
    routeArtifactId: "route-artifact",
    proposerId: proposer,
    state,
    currentRevision: 1,
    currentRevisionId: "revision-1",
    activeClarification: null,
    activeObjection: null,
    activeObjectionSequence: null,
    outcomeRoleId: null,
    decisionId: null,
    changeLogId: null,
  };
}

function context(state: GovernanceDecisionState | null = "READY"): GovernanceDecisionContext {
  return {
    organizationId: "org-a",
    proposalId: "proposal-a",
    sourceTensionId: "tension-a",
    provenanceKind: "INTERFACE_RUN",
    proposerId: proposer,
    meetingId: "meeting-a",
    runId: "run-a",
    sourceTensionArtifactId: "source-artifact",
    proposalArtifactId: "proposal-artifact",
    routeArtifactId: "route-artifact",
    routeNodeId: "route-governance",
    routeNodeVisit: 1,
    sourceTensionStatus: "OPEN",
    process: state === null ? null : process(state),
    currentRevision: state === null ? null : structuredClone(revision),
  };
}

function operationInput(overrides: Partial<GovernanceDecisionInput> = {}): GovernanceDecisionInput {
  return {
    organizationId: "org-a",
    proposalId: "proposal-a",
    provenanceKind: "INTERFACE_RUN",
    runId: "run-a",
    meetingId: "meeting-a",
    proposalArtifactId: "proposal-artifact",
    routeArtifactId: "route-artifact",
    actorId: participant,
    expectedRevision: 1,
    operation: "ADOPT_ROLE",
    operationScope: "result",
    mutationKey: "key-1",
    note: "Adopted by the meeting process",
    ...overrides,
  } as GovernanceDecisionInput;
}

class FakeGovernanceStore {
  context: GovernanceDecisionContext;
  participants = new Set([participant]);
  operations: GovernanceDecisionOperationRecord[] = [];
  events: string[] = [];
  eventPayloads: Array<Record<string, unknown>> = [];
  effects: string[] = [];
  proposalWrites = 0;
  revisionHistory: GovernanceProposalRevisionInput[] = [structuredClone(revision)];
  now = new Date("2026-07-12T00:00:00.000Z");
  failAt: number | null = null;
  failAudit = false;
  failOperationClaim = false;
  isolationLevels: string[] = [];
  lifecycleStatus: "ACTIVE" | "SETUP" | null = "ACTIVE";
  lifecycleSequence: Array<"ACTIVE" | "SETUP" | null> = [];
  private id = 1;
  private queue: Promise<void> = Promise.resolve();

  constructor(state: GovernanceDecisionState | null = "READY") {
    this.context = context(state);
  }

  dependencies(): GovernanceDecisionDependencies {
    return {
      now: () => new Date(this.now),
      randomId: () => `generated-${this.id++}`,
      transaction: async (work, options) => {
        let release = () => {};
        const turn = new Promise<void>((resolve) => { release = resolve; });
        const previous = this.queue;
        this.queue = turn;
        await previous;
        this.isolationLevels.push(options?.isolationLevel ?? "none");
        const snapshot = structuredClone({ context: this.context, operations: this.operations, events: this.events, eventPayloads: this.eventPayloads, effects: this.effects, revisionHistory: this.revisionHistory, proposalWrites: this.proposalWrites });
        try {
          return await work(this.transaction());
        } catch (error) {
          this.context = snapshot.context;
          this.operations = snapshot.operations;
          this.events = snapshot.events;
          this.eventPayloads = snapshot.eventPayloads;
          this.effects = snapshot.effects;
          this.revisionHistory = snapshot.revisionHistory;
          this.proposalWrites = snapshot.proposalWrites;
          throw error;
        } finally {
          release();
        }
      },
    };
  }

  private transaction(): GovernanceDecisionTransaction {
    return {
      readOrganizationLifecycle: async (organizationId) => organizationId === "org-a"
        ? this.lifecycleSequence.shift() ?? this.lifecycleStatus
        : null,
      lockContext: async (input) => input.organizationId === this.context.organizationId && input.proposalId === this.context.proposalId && input.meetingId === this.context.meetingId && input.provenanceKind === this.context.provenanceKind && (input.provenanceKind === "ORDINARY_TENSION" ? input.sourceTensionId === this.context.sourceTensionId : input.runId === this.context.runId && input.proposalArtifactId === this.context.proposalArtifactId && input.routeArtifactId === this.context.routeArtifactId) ? structuredClone(this.context) : null,
      ensureOrdinaryProposal: async ({ input }) => { if (input.provenanceKind === "ORDINARY_TENSION" && this.proposalWrites === 0) this.proposalWrites += 1; },
      isCurrentParticipant: async (input) => input.organizationId === "org-a" && input.meetingId === "meeting-a" && this.participants.has(input.actorId),
      findOperationByKey: async (input) => structuredClone(this.operations.find((item) => item.organizationId === input.organizationId && item.mutationKey === input.mutationKey) ?? null),
      findOperationBySlot: async (binding) => structuredClone(this.operations.find((item) => item.organizationId === binding.organizationId && item.proposalId === binding.proposalId && item.meetingId === binding.meetingId && item.revision === binding.revision && item.operation === binding.operation && item.operationScope === binding.operationScope) ?? null),
      createOperation: async (input) => {
        if (this.failOperationClaim) throw new Error("INJECTED_OPERATION_CLAIM_FAILURE");
        const created: GovernanceDecisionOperationRecord = { ...input, status: "PROCESSING", attempt: 1, failureCode: null, resultEnvelope: null };
        this.operations.push(created);
        return structuredClone(created);
      },
      reclaimOperation: async (input) => {
        const row = this.operations.find((item) => item.id === input.id && item.status === input.expectedStatus && item.attempt === input.expectedAttempt);
        if (!row || (input.staleBefore && row.leaseExpiresAt.getTime() > input.staleBefore.getTime())) return null;
        row.status = "PROCESSING";
        row.attempt += 1;
        row.leaseToken = input.leaseToken;
        row.leaseExpiresAt = input.leaseExpiresAt;
        row.failureCode = null;
        row.resultEnvelope = null;
        return structuredClone(row);
      },
      lockOperation: async (input) => structuredClone(this.operations.find((item) => item.id === input.id && item.leaseToken === input.leaseToken) ?? null),
      initializeProcess: async (input) => {
        const created = process("READY");
        created.id = input.processId;
        created.currentRevisionId = input.revisionId;
        this.context.process = created;
        this.context.currentRevision = structuredClone(input.revision);
        this.revisionHistory = [structuredClone(input.revision)];
        return structuredClone(created);
      },
      createRevision: async (input) => { this.revisionHistory.push(structuredClone(input.revision)); },
      updateProcess: async (input) => {
        const current = this.context.process;
        if (!current || current.state !== input.expectedState || current.currentRevision !== input.process.currentRevision) throw new GovernanceDecisionError("PROCESS_STATE_CHANGED");
        current.state = input.state;
        if (input.nextRevisionId) {
          current.currentRevision += 1;
          current.currentRevisionId = input.nextRevisionId;
          this.context.currentRevision = structuredClone(this.revisionHistory.at(-1)!);
        }
        if (input.clarification !== undefined) current.activeClarification = input.clarification;
        if (input.objection !== undefined) current.activeObjection = input.objection;
        if (input.objectionSequence !== undefined) current.activeObjectionSequence = input.objectionSequence;
        return structuredClone(current);
      },
      appendEvents: async (input) => {
        this.events.push(...input.events.map((item) => item.type));
        this.eventPayloads.push(...input.events.map((item) => structuredClone(item.payload)));
      },
      applyRoleAdoption: async (input) => {
        assert.equal(input.role.ownershipType, "HOME");
        for (let step = 1; step <= 17; step += 1) {
          this.effects.push(`adoption-step-${step}`);
          if (this.failAt === step) throw new Error(`ADOPTION_STEP_${step}_FAILED`);
        }
        const current = this.context.process!;
        current.state = "ADOPTED";
        current.outcomeRoleId = "role-1";
        current.decisionId = "decision-1";
        current.changeLogId = "change-1";
        this.context.sourceTensionStatus = "RESOLVED";
        return { process: structuredClone(current), roleId: "role-1", decisionId: "decision-1", changeLogId: "change-1", artifactId: "artifact-1" };
      },
      markOperationSucceeded: async (input) => {
        if (this.failAt === 18) throw new Error("ADOPTION_STEP_18_FAILED");
        const row = this.operations.find((item) => item.id === input.id && item.leaseToken === input.leaseToken && item.status === "PROCESSING");
        if (!row) return false;
        row.status = "SUCCEEDED";
        row.resultEnvelope = structuredClone(input.result);
        return true;
      },
      markOperationFailed: async (input) => {
        if (this.failAudit) throw new Error("FAILURE_AUDIT_FAILED");
        const row = this.operations.find((item) => item.id === input.id && item.leaseToken === input.leaseToken && item.status === "PROCESSING");
        if (!row || this.context.process?.id !== input.processId || this.context.process.currentRevision !== input.expectedRevision) return false;
        row.status = "FAILED";
        row.failureCode = input.failureCode;
        this.events.push("COMMAND_FAILED");
        return true;
      },
    };
  }
}

async function rejectsCode(promise: Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(promise, (error) => error instanceof GovernanceDecisionError && error.code === code);
}

describe("authoritative claim, replay, concurrency, and failure recovery", () => {
  test("SETUP and missing organizations deny governance operations before proposal or ledger writes", async () => {
    for (const lifecycleStatus of ["SETUP", null] as const) {
      const store = new FakeGovernanceStore();
      store.lifecycleStatus = lifecycleStatus;
      await rejectsCode(
        executeGovernanceDecisionOperation(operationInput(), store.dependencies()),
        MEETING_LIFECYCLE_DENIAL_CODE,
      );
      assert.deepEqual({
        proposals: store.proposalWrites,
        operations: store.operations.length,
        effects: store.effects.length,
        events: store.events.length,
      }, { proposals: 0, operations: 0, effects: 0, events: 0 });
    }
  });

  test("apply and failure-audit transactions repeat the lifecycle gate before formal writes", async () => {
    const applyDenied = new FakeGovernanceStore();
    applyDenied.lifecycleSequence = ["ACTIVE", "SETUP", "SETUP"];
    await rejectsCode(
      executeGovernanceDecisionOperation(operationInput(), applyDenied.dependencies()),
      MEETING_LIFECYCLE_DENIAL_CODE,
    );
    assert.deepEqual(applyDenied.effects, []);
    assert.deepEqual(applyDenied.events, []);
    assert.equal(applyDenied.operations[0]?.status, "PROCESSING");

    const auditDenied = new FakeGovernanceStore();
    auditDenied.lifecycleSequence = ["ACTIVE", "ACTIVE", "SETUP"];
    auditDenied.failAt = 1;
    await assert.rejects(
      executeGovernanceDecisionOperation(operationInput(), auditDenied.dependencies()),
      /ADOPTION_STEP_1_FAILED/,
    );
    assert.equal(auditDenied.operations[0]?.status, "PROCESSING");
    assert.doesNotMatch(auditDenied.events.join(","), /COMMAND_FAILED/);
  });

  test("ordinary tension provenance executes without runtime bindings while mixed provenance is denied before claim", async () => {
    const store = new FakeGovernanceStore();
    store.context = { ...store.context, provenanceKind: "ORDINARY_TENSION", runId: null, sourceTensionArtifactId: null, proposalArtifactId: null, routeArtifactId: null, routeNodeId: null, routeNodeVisit: null };
    const ordinary = operationInput({ provenanceKind: "ORDINARY_TENSION", sourceTensionId: "tension-a", runId: undefined, proposalArtifactId: undefined, routeArtifactId: undefined });
    assert.equal((await executeGovernanceDecisionOperation(ordinary, store.dependencies())).state, "ADOPTED");

    const mixed = new FakeGovernanceStore();
    mixed.context = { ...mixed.context, provenanceKind: "ORDINARY_TENSION", runId: null, sourceTensionArtifactId: null, proposalArtifactId: null, routeArtifactId: null, routeNodeId: null, routeNodeVisit: null };
    await rejectsCode(executeGovernanceDecisionOperation(operationInput(), mixed.dependencies()), "PROVENANCE_MISMATCH");
    assert.equal(mixed.operations.length, 0);
  });

  test("invalid ordinary input and executor failure roll back proposal, operation, and process writes", async () => {
    const invalid = new FakeGovernanceStore(null);
    invalid.context = { ...invalid.context, provenanceKind: "ORDINARY_TENSION", runId: null, sourceTensionArtifactId: null, proposalArtifactId: null, routeArtifactId: null, routeNodeId: null, routeNodeVisit: null };
    // missing required currentStructure key
    const badRevision = { proposedStructure: revision.proposedStructure, typedChange: revision.typedChange } as any;
    await rejectsCode(executeGovernanceDecisionOperation(operationInput({ provenanceKind: "ORDINARY_TENSION", sourceTensionId: "tension-a", runId: undefined, proposalArtifactId: undefined, routeArtifactId: undefined, operation: "INITIALIZE", actorId: proposer, revision: badRevision }), invalid.dependencies()), "INVALID_REVISION_PAYLOAD");
    assert.deepEqual({ proposals: invalid.proposalWrites, operations: invalid.operations.length, process: invalid.context.process }, { proposals: 0, operations: 0, process: null });

    const failed = new FakeGovernanceStore(null);
    failed.context = { ...failed.context, provenanceKind: "ORDINARY_TENSION", runId: null, sourceTensionArtifactId: null, proposalArtifactId: null, routeArtifactId: null, routeNodeId: null, routeNodeVisit: null };
    failed.failOperationClaim = true;
    await assert.rejects(executeGovernanceDecisionOperation(operationInput({ provenanceKind: "ORDINARY_TENSION", sourceTensionId: "tension-a", runId: undefined, proposalArtifactId: undefined, routeArtifactId: undefined, operation: "INITIALIZE", actorId: proposer, revision }), failed.dependencies()), /INJECTED_OPERATION_CLAIM_FAILURE/);
    assert.deepEqual({ proposals: failed.proposalWrites, operations: failed.operations.length, process: failed.context.process }, { proposals: 0, operations: 0, process: null });
  });
  test("Prisma operation claims, reclaims, and failure audits use database NULL envelopes", () => {
    const source = fs.readFileSync(new URL("../governance-decision.ts", import.meta.url), "utf8");
    assert.equal((source.match(/resultEnvelope: Prisma\.DbNull/g) ?? []).length, 3);
    assert.equal(source.includes("resultEnvelope: Prisma.JsonNull"), false);
  });

  test("initialization and every non-adoption transition preserve immutable revision rules", async () => {
    const initialized = new FakeGovernanceStore(null);
    const initialize = operationInput({ actorId: proposer, operation: "INITIALIZE", operationScope: "initialize", mutationKey: "initialize-key", revision });
    const initializedResult = await executeGovernanceDecisionOperation(initialize, initialized.dependencies());
    assert.equal(initializedResult.state, "READY");
    assert.equal(initialized.context.process?.currentRevision, 1);
    assert.deepEqual(initialized.events, ["GOVERNANCE_PROCESS_INITIALIZED"]);
    assert.deepEqual(await executeGovernanceDecisionOperation(initialize, initialized.dependencies()), initializedResult);
    assert.equal(initialized.operations.length, 1);

    const clarification = new FakeGovernanceStore();
    await executeGovernanceDecisionOperation(operationInput({ operation: "REQUEST_CLARIFICATION", operationScope: "clarification-1", mutationKey: "clarification-key", clarification: { question: "Who owns provenance?", reason: "The proposal must be explicit" } }), clarification.dependencies());
    assert.equal(clarification.context.process?.state, "CLARIFICATION_REQUIRED");
    const clarified = operationInput({ actorId: proposer, operation: "SUBMIT_REVISION", operationScope: "revision-2", mutationKey: "clarified-key", revision });
    assert.equal((await executeGovernanceDecisionOperation(clarified, clarification.dependencies())).revision, 2);
    assert.equal(clarification.revisionHistory.length, 2);
    assert.equal(clarification.eventPayloads.at(-1)?.revision, 2);

    const objection = { materialHarm: "The role could centralize a distributed check", factVsWorry: "No separation-of-duty field exists", reversibility: "The unassigned role can be archived by a later decision", safeToTry: "Pilot it unassigned for one cycle" };
    const invalid = new FakeGovernanceStore();
    await executeGovernanceDecisionOperation(operationInput({ operation: "RAISE_OBJECTION", operationScope: "objection-1", mutationKey: "objection-key", objection }), invalid.dependencies());
    assert.equal(invalid.context.process?.state, "OBJECTION_PENDING");
    await executeGovernanceDecisionOperation(operationInput({ operation: "ASSESS_OBJECTION_INVALID", operationScope: "assessment-1", mutationKey: "assessment-key", assessment: { ...objection, validity: "INVALID", assessmentNote: "The concern does not show material regression" } }), invalid.dependencies());
    assert.equal(invalid.context.process?.state, "READY");
    assert.equal(invalid.context.process?.currentRevision, 1);

    const valid = new FakeGovernanceStore();
    await executeGovernanceDecisionOperation(operationInput({ operation: "RAISE_OBJECTION", operationScope: "objection-1", mutationKey: "objection-key", objection }), valid.dependencies());
    await executeGovernanceDecisionOperation(operationInput({ operation: "ASSESS_OBJECTION_VALID", operationScope: "assessment-1", mutationKey: "assessment-key", assessment: { ...objection, validity: "VALID", assessmentNote: "The regression is material" } }), valid.dependencies());
    assert.equal(valid.context.process?.state, "AMENDMENT_REQUIRED");
    await rejectsCode(executeGovernanceDecisionOperation(operationInput({ mutationKey: "blocked-adoption" }), valid.dependencies()), "INVALID_TRANSITION");
    assert.equal((await executeGovernanceDecisionOperation(operationInput({ actorId: proposer, operation: "SUBMIT_REVISION", operationScope: "revision-2", mutationKey: "amendment-key", revision }), valid.dependencies())).state, "READY");

    const nonAdopted = new FakeGovernanceStore();
    assert.equal((await executeGovernanceDecisionOperation(operationInput({ operation: "RECORD_NON_ADOPTION", operationScope: "result", mutationKey: "non-adopt-key", note: "Not safe to adopt this revision" }), nonAdopted.dependencies())).state, "NOT_ADOPTED");
    assert.equal(nonAdopted.context.sourceTensionStatus, "OPEN");
    assert.equal(nonAdopted.effects.length, 0);
    assert.equal((await executeGovernanceDecisionOperation(operationInput({ actorId: proposer, operation: "SUBMIT_REVISION", operationScope: "revision-2", mutationKey: "post-non-adopt-key", revision }), nonAdopted.dependencies())).state, "READY");
  });

  test("wrong tenant, meeting, route, stale revision, and forged actor consume zero ledger rows", async () => {
    const denied: Array<[Partial<GovernanceDecisionInput>, string]> = [
      [{ organizationId: "org-b" }, MEETING_LIFECYCLE_DENIAL_CODE],
      [{ proposalId: "proposal-forged" }, "PROVENANCE_MISMATCH"],
      [{ runId: "run-forged" }, "PROVENANCE_MISMATCH"],
      [{ meetingId: "meeting-wrong" }, "PROVENANCE_MISMATCH"],
      [{ proposalArtifactId: "proposal-artifact-forged" }, "PROVENANCE_MISMATCH"],
      [{ routeArtifactId: "route-forged" }, "PROVENANCE_MISMATCH"],
      [{ expectedRevision: 2 }, "STALE_REVISION"],
      [{ actorId: "org-admin" }, "MEETING_PARTICIPANT_REQUIRED"],
    ];
    for (const [overrides, code] of denied) {
      const store = new FakeGovernanceStore();
      await rejectsCode(executeGovernanceDecisionOperation(operationInput(overrides), store.dependencies()), code);
      assert.equal(store.operations.length, 0);
      assert.equal(store.effects.length, 0);
    }
  });

  test("meeting-result terminal replay reauthorizes current exact-meeting participation", async () => {
    const store = new FakeGovernanceStore();
    const input = operationInput();
    const adopted = await executeGovernanceDecisionOperation(input, store.dependencies());
    store.participants.delete(participant);
    await rejectsCode(executeGovernanceDecisionOperation(input, store.dependencies()), "MEETING_PARTICIPANT_REQUIRED");
    assert.equal(store.operations.length, 1);
    store.participants.add(participant);
    assert.deepEqual(await executeGovernanceDecisionOperation(input, store.dependencies()), adopted);
    assert.equal(store.effects.length, 17);
  });

  test("revision replay remains proposer-authorized after the proposer leaves the meeting", async () => {
    const store = new FakeGovernanceStore("CLARIFICATION_REQUIRED");
    const input = operationInput({ actorId: proposer, operation: "SUBMIT_REVISION", operationScope: "revision-2", mutationKey: "revision-key", revision });
    const authored = await executeGovernanceDecisionOperation(input, store.dependencies());
    assert.equal(authored.revision, 2);
    assert.deepEqual(await executeGovernanceDecisionOperation(input, store.dependencies()), authored);
    assert.equal(store.operations.length, 1);
    assert.equal(store.revisionHistory.length, 2);
  });

  test("same key changed payload conflicts and fresh key cannot take an existing logical slot", async () => {
    const store = new FakeGovernanceStore();
    await executeGovernanceDecisionOperation(operationInput(), store.dependencies());
    await rejectsCode(executeGovernanceDecisionOperation(operationInput({ note: "changed" }), store.dependencies()), "IDEMPOTENCY_BINDING_CONFLICT");
    await rejectsCode(executeGovernanceDecisionOperation(operationInput({ mutationKey: "fresh-key" }), store.dependencies()), "INVALID_TRANSITION");
    assert.equal(store.operations.length, 1);
  });

  test("adoption binding rejects immutable revision identity or typed role drift before replay", async () => {
    const identityDrift = new FakeGovernanceStore();
    const input = operationInput();
    await executeGovernanceDecisionOperation(input, identityDrift.dependencies());
    identityDrift.context.process!.currentRevisionId = "forged-revision-id";
    await rejectsCode(executeGovernanceDecisionOperation(input, identityDrift.dependencies()), "IDEMPOTENCY_BINDING_CONFLICT");
    assert.equal(identityDrift.effects.length, 17);

    const roleDrift = new FakeGovernanceStore();
    await executeGovernanceDecisionOperation(input, roleDrift.dependencies());
    roleDrift.context.currentRevision = { ...revision, typedChange: { ...role, purpose: "Drifted purpose" } };
    await rejectsCode(executeGovernanceDecisionOperation(input, roleDrift.dependencies()), "IDEMPOTENCY_BINDING_CONFLICT");
    assert.equal(roleDrift.effects.length, 17);
  });

  test("objection assessment must equal the locked active immutable objection before claim", async () => {
    const store = new FakeGovernanceStore("OBJECTION_PENDING");
    const active = { materialHarm: "Material regression", factVsWorry: "Observed fact", reversibility: "Reversible", safeToTry: "Not safe yet" };
    store.context.process!.activeObjection = active;
    const assessment = { ...active, materialHarm: "Caller substituted facts", validity: "VALID" as const, assessmentNote: "Assessment" };
    await rejectsCode(executeGovernanceDecisionOperation(operationInput({ operation: "ASSESS_OBJECTION_VALID", operationScope: "assessment-1", mutationKey: "assessment-drift", assessment }), store.dependencies()), "OBJECTION_BINDING_MISMATCH");
    assert.equal(store.operations.length, 0);
    assert.equal(store.context.process?.state, "OBJECTION_PENDING");
  });

  test("concurrent recorders create one terminal role outcome", async () => {
    const store = new FakeGovernanceStore();
    store.participants.add("participant-two");
    const settled = await Promise.allSettled([
      executeGovernanceDecisionOperation(operationInput({ mutationKey: "race-a", actorId: participant }), store.dependencies()),
      executeGovernanceDecisionOperation(operationInput({ mutationKey: "race-b", actorId: "participant-two" }), store.dependencies()),
    ]);
    assert.equal(settled.filter((item) => item.status === "fulfilled").length, 1);
    assert.equal(store.operations.length, 1);
    assert.equal(store.context.process?.outcomeRoleId, "role-1");
  });

  test("all adoption application failure points roll back effects and persist mandatory audit", async () => {
    for (let failure = 1; failure <= 18; failure += 1) {
      const store = new FakeGovernanceStore();
      store.failAt = failure;
      await assert.rejects(executeGovernanceDecisionOperation(operationInput(), store.dependencies()));
      assert.equal(store.effects.length, 0, `failure ${failure}`);
      assert.equal(store.context.process?.state, "READY", `failure ${failure}`);
      assert.equal(store.context.sourceTensionStatus, "OPEN", `failure ${failure}`);
      assert.equal(store.operations[0]?.status, "FAILED", `failure ${failure}`);
      assert.deepEqual(store.events, ["COMMAND_FAILED"], `failure ${failure}`);
    }
  });

  test("FAILED retries only with the same key; failed audit leaves PROCESSING for expired same-key reclaim", async () => {
    const store = new FakeGovernanceStore();
    store.failAt = 3;
    await assert.rejects(executeGovernanceDecisionOperation(operationInput(), store.dependencies()));
    await rejectsCode(executeGovernanceDecisionOperation(operationInput({ mutationKey: "fresh-key" }), store.dependencies()), "LOGICAL_SLOT_ALREADY_CLAIMED");
    store.failAt = null;
    assert.equal((await executeGovernanceDecisionOperation(operationInput(), store.dependencies())).state, "ADOPTED");
    assert.equal(store.operations[0]?.attempt, 2);

    const auditFailure = new FakeGovernanceStore();
    auditFailure.failAt = 2;
    auditFailure.failAudit = true;
    await assert.rejects(executeGovernanceDecisionOperation(operationInput(), auditFailure.dependencies()));
    assert.equal(auditFailure.operations[0]?.status, "PROCESSING");
    auditFailure.failAt = null;
    auditFailure.failAudit = false;
    auditFailure.now = new Date(auditFailure.now.getTime() + 6 * 60_000);
    assert.equal((await executeGovernanceDecisionOperation(operationInput(), auditFailure.dependencies())).state, "ADOPTED");
    assert.equal(auditFailure.operations[0]?.attempt, 2);
    assert.ok(auditFailure.isolationLevels.every((level) => level === "Serializable"));
  });
});

type DbClient = { prisma: PrismaClient; pool: Pool };
type DbFixture = {
  organizationId: string;
  processId: string;
  tensionId: string;
  participantTwoId: string;
  adoption: GovernanceDecisionInput;
};

function requiredDisposableDatabaseUrl(): string {
  const value = globalThis.process.env.GD1_GOVERNANCE_TEST_DATABASE_URL;
  assert.ok(value, "GD1_GOVERNANCE_TEST_DATABASE_URL is required and must name an isolated disposable database");
  const databaseName = decodeURIComponent(new URL(value).pathname.replace(/^\//, ""));
  assert.match(databaseName, /^loopos_gd1_correction_[a-z0-9_]+$/, "required DB mode refuses a non-disposable database name");
  return value;
}

function dbClient(connectionString: string, timezone: string): DbClient {
  const pool = new Pool({ connectionString, max: 1, options: `-c timezone=${timezone}` });
  return { pool, prisma: new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) }) };
}

async function databaseTimezone(prisma: PrismaClient): Promise<string> {
  const [row] = await prisma.$queryRawUnsafe<Array<{ TimeZone: string }>>("SHOW TIME ZONE");
  assert.ok(row);
  return row.TimeZone;
}

async function createDbFixture(prisma: PrismaClient): Promise<DbFixture> {
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const seeded = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({ data: { name: `GD1 correction ${suffix}`, slug: `gd1-correction-${suffix}` } });
    const [sourceCircle, roleCircle] = await Promise.all([
      tx.circle.create({ data: { organizationId: organization.id, name: "Source", number: "CUSTOM", type: "PRODUCTION", purpose: "Raise governance evidence" } }),
      tx.circle.create({ data: { organizationId: organization.id, name: "Role target", number: "CUSTOM", type: "PRODUCTION", purpose: "Own the adopted role", status: "NORMAL" } }),
    ]);
    const [proposer, participant, participantTwo] = await Promise.all([
      tx.person.create({ data: { organizationId: organization.id, name: "Proposer", homeCircleId: sourceCircle.id } }),
      tx.person.create({ data: { organizationId: organization.id, name: "Recorder one", homeCircleId: sourceCircle.id } }),
      tx.person.create({ data: { organizationId: organization.id, name: "Recorder two", homeCircleId: sourceCircle.id } }),
    ]);
    const circleInterface = await tx.circleInterface.create({ data: { organizationId: organization.id, name: "Governance fixture interface", contractContent: "Fixture contract", sla: "Fixture SLA", acceptanceCriteria: "Fixture accepted", fromCircleId: sourceCircle.id, toCircleId: roleCircle.id, ownerId: proposer.id } });
    const workbench = await tx.interfaceWorkbench.create({ data: { organizationId: organization.id, interfaceId: circleInterface.id, draft: {}, draftLayout: {}, draftHash: `draft-${suffix}` } });
    const version = await tx.interfaceWorkbenchVersion.create({ data: { organizationId: organization.id, workbenchId: workbench.id, version: 1, publisherId: proposer.id, sourceSnapshot: {}, compiledSnapshot: {}, editorLayout: {}, validationResult: { ok: true }, sourceHash: `source-${suffix}`, compiledHash: `compiled-${suffix}`, definitionSchemaVersion: 1, compilerVersion: "gd1-correction-test" } });
    await tx.interfaceWorkbench.update({ where: { id: workbench.id }, data: { activeVersionId: version.id } });
    const run = await tx.interfaceWorkflowRun.create({ data: { organizationId: organization.id, workbenchId: workbench.id, versionId: version.id, status: "ACTIVE", currentNodeId: "route-node", currentNodeVisit: 1, evidence: {}, revision: 2, starterId: proposer.id, lastActorId: participant.id } });
    const meeting = await tx.meeting.create({ data: { organizationId: organization.id, title: "GD1 correction governance meeting", type: "GOVERNANCE", agenda: "Test exact governance adoption", durationMin: 90, startedAt: new Date(), participants: { connect: [{ id: proposer.id }, { id: participant.id }, { id: participantTwo.id }] } } });
    const tension = await tx.tension.create({ data: { organizationId: organization.id, title: "Missing data stewardship", description: "No role owns provenance", type: "CONSTRUCTIVE", source: "FORM", raiserId: proposer.id } });
    const candidateCommand = await tx.interfaceWorkflowCommand.create({ data: { organizationId: organization.id, runId: run.id, nodeId: "candidate-node", nodeVisit: 0, kind: "EXECUTE_SIDE_EFFECT", clientIdempotencyKey: `candidate-${suffix}`, actorId: proposer.id, payload: { confirmed: true, sourceTensionArtifactId: "pending", structuralCategory: "ROLE", currentStructure: "No role", proposedStructure: "Create stewardship role", rationale: "Ownership is missing", expectedImpact: "Clear accountability" }, attempts: 1, status: "SUCCEEDED" } });
    const sourceArtifact = await tx.interfaceWorkflowArtifact.create({ data: { organizationId: organization.id, runId: run.id, artifactType: "TENSION", artifactId: tension.id, relation: "raised-tension", metadata: {} } });
    await tx.interfaceWorkflowCommand.update({ where: { id: candidateCommand.id }, data: { payload: { confirmed: true, sourceTensionArtifactId: sourceArtifact.id, structuralCategory: "ROLE", currentStructure: "No role", proposedStructure: "Create stewardship role", rationale: "Ownership is missing", expectedImpact: "Clear accountability" } } });
    const proposal = await tx.governanceProposal.create({ data: { organizationId: organization.id, type: "ROLE", proposedChange: JSON.stringify({ schemaVersion: 1, structuralCategory: "ROLE", currentStructure: "No role", proposedStructure: "Create stewardship role", expectedImpact: "Clear accountability" }), rationale: "Ownership is missing", status: "CANDIDATE", tensionId: tension.id, meetingId: meeting.id } });
    const proposalArtifact = await tx.interfaceWorkflowArtifact.create({ data: { organizationId: organization.id, runId: run.id, artifactType: "GOVERNANCE_PROPOSAL", artifactId: proposal.id, relation: `governance-candidate:${candidateCommand.id}`, metadata: { schemaVersion: 1, commandId: candidateCommand.id, nodeId: candidateCommand.nodeId, nodeVisit: candidateCommand.nodeVisit, runId: run.id, revision: 0, sourceTensionArtifactId: sourceArtifact.id, tensionId: tension.id, proposalId: proposal.id, proposerId: proposer.id } } });
    const routeCommand = await tx.interfaceWorkflowCommand.create({ data: { organizationId: organization.id, runId: run.id, nodeId: "route-node", nodeVisit: 1, kind: "EXECUTE_SIDE_EFFECT", clientIdempotencyKey: `route-${suffix}`, actorId: participant.id, payload: { confirmed: true, meetingId: meeting.id, proposalArtifactId: proposalArtifact.id }, attempts: 1, status: "SUCCEEDED" } });
    const routeArtifact = await tx.interfaceWorkflowArtifact.create({ data: { organizationId: organization.id, runId: run.id, artifactType: "MEETING", artifactId: meeting.id, relation: `governance-route:${routeCommand.id}`, metadata: { schemaVersion: 1, commandId: routeCommand.id, nodeId: routeCommand.nodeId, nodeVisit: routeCommand.nodeVisit, runId: run.id, revision: 1, actorId: participant.id, meetingType: "GOVERNANCE", proposalId: proposal.id, proposalArtifactId: proposalArtifact.id, sourceTensionArtifactId: sourceArtifact.id, tensionId: tension.id } } });
    return { organization, roleCircle, proposer, participant, participantTwo, run, meeting, tension, proposal, proposalArtifact, routeArtifact };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  const initialize: GovernanceDecisionInput = {
    organizationId: seeded.organization.id,
    proposalId: seeded.proposal.id,
    provenanceKind: "INTERFACE_RUN",
    runId: seeded.run.id,
    meetingId: seeded.meeting.id,
    proposalArtifactId: seeded.proposalArtifact.id,
    routeArtifactId: seeded.routeArtifact.id,
    actorId: seeded.proposer.id,
    expectedRevision: 1,
    operation: "INITIALIZE",
    operationScope: "initialize",
    mutationKey: `initialize-${suffix}`,
    revision: { currentStructure: "No role", proposedStructure: "Create stewardship role", rationale: "Ownership is missing", expectedImpact: "Clear accountability", typedChange: { ...role, circleId: seeded.roleCircle.id } },
  };
  const initialized = await executeGovernanceDecisionOperation(initialize, createPrismaGovernanceDecisionDependencies(prisma));
  return {
    organizationId: seeded.organization.id,
    processId: initialized.processId,
    tensionId: seeded.tension.id,
    participantTwoId: seeded.participantTwo.id,
    adoption: { ...initialize, actorId: seeded.participant.id, operation: "ADOPT_ROLE", operationScope: "result", mutationKey: `adopt-${suffix}`, revision: undefined, note: "Adopted in disposable DB" },
  };
}

async function assertNoAdoptionEffects(prisma: PrismaClient, fixture: DbFixture): Promise<void> {
  const [roles, decisions, changes, artifacts, adoptionEvents, proposal, processRow, tension] = await Promise.all([
    prisma.roleDef.count({ where: { organizationId: fixture.organizationId } }),
    prisma.decisionRecord.count({ where: { organizationId: fixture.organizationId } }),
    prisma.changeLog.count({ where: { organizationId: fixture.organizationId } }),
    prisma.interfaceWorkflowArtifact.count({ where: { organizationId: fixture.organizationId, artifactType: "ROLE" } }),
    prisma.interfaceWorkflowRunEvent.count({ where: { organizationId: fixture.organizationId, type: { in: ["GOVERNANCE_ADOPTION_RECORDED", "GOVERNANCE_STRUCTURE_APPLIED", "ARTIFACT_CREATED"] } } }),
    prisma.governanceProposal.findUniqueOrThrow({ where: { id: fixture.adoption.proposalId }, select: { status: true, decisionId: true } }),
    prisma.governanceDecisionProcess.findUniqueOrThrow({ where: { id: fixture.processId }, select: { state: true, outcomeRoleId: true, decisionId: true, changeLogId: true } }),
    prisma.tension.findUniqueOrThrow({ where: { id: fixture.tensionId }, select: { status: true, resolvedAt: true } }),
  ]);
  assert.deepEqual({ roles, decisions, changes, artifacts, adoptionEvents }, { roles: 0, decisions: 0, changes: 0, artifacts: 0, adoptionEvents: 0 });
  assert.deepEqual(proposal, { status: "CANDIDATE", decisionId: null });
  assert.deepEqual(processRow, { state: "READY", outcomeRoleId: null, decisionId: null, changeLogId: null });
  assert.equal(tension.status, "OPEN");
  assert.equal(tension.resolvedAt, null);
}

function adoptionBarrier(step: GovernanceAdoptionWriteStep) {
  let enteredResolve = () => {};
  let releaseResolve = () => {};
  const entered = new Promise<void>((resolve) => { enteredResolve = resolve; });
  const released = new Promise<void>((resolve) => { releaseResolve = resolve; });
  return { entered, release: releaseResolve, hook: async (current: GovernanceAdoptionWriteStep) => { if (current === step) { enteredResolve(); await released; } } };
}

if (globalThis.process.env.GD1_GOVERNANCE_DB_REQUIRED === "1") {
  describe("required disposable PostgreSQL governance service", { concurrency: 1 }, () => {
    let first: DbClient;
    let second: DbClient;

    before(() => {
      const connectionString = requiredDisposableDatabaseUrl();
      first = dbClient(connectionString, "Asia/Shanghai");
      second = dbClient(connectionString, "America/New_York");
    });

    after(async () => {
      await Promise.all([first.prisma.$disconnect(), second.prisma.$disconnect()]);
      await Promise.all([first.pool.end(), second.pool.end()]);
    });

    test("governance leases use transaction-local UTC without changing pooled session timezones", async () => {
      assert.equal(await databaseTimezone(first.prisma), "Asia/Shanghai");
      assert.equal(await databaseTimezone(second.prisma), "America/New_York");
      const positiveOffset = await createDbFixture(first.prisma);
      const negativeOffset = await createDbFixture(second.prisma);
      assert.equal((await executeGovernanceDecisionOperation(positiveOffset.adoption, createPrismaGovernanceDecisionDependencies(first.prisma))).state, "ADOPTED");
      assert.equal((await executeGovernanceDecisionOperation(negativeOffset.adoption, createPrismaGovernanceDecisionDependencies(second.prisma))).state, "ADOPTED");
      assert.equal(await databaseTimezone(first.prisma), "Asia/Shanghai");
      assert.equal(await databaseTimezone(second.prisma), "America/New_York");
    });

    test("two clients serialize same-key and same-logical-slot races to one role", async () => {
      const sameKey = await createDbFixture(first.prisma);
      const barrier = adoptionBarrier("CREATE_ROLE");
      const winner = executeGovernanceDecisionOperation(sameKey.adoption, createPrismaGovernanceDecisionDependencies(first.prisma, { beforeAdoptionStep: barrier.hook }));
      await barrier.entered;
      const contender = executeGovernanceDecisionOperation(sameKey.adoption, createPrismaGovernanceDecisionDependencies(second.prisma));
      barrier.release();
      const result = await winner;
      await assert.rejects(contender, (error) => error instanceof GovernanceDecisionError && error.code === "SERIALIZATION_CONFLICT");
      assert.deepEqual(await executeGovernanceDecisionOperation(sameKey.adoption, createPrismaGovernanceDecisionDependencies(second.prisma)), result);
      assert.equal(await first.prisma.roleDef.count({ where: { organizationId: sameKey.organizationId } }), 1);

      const sameSlot = await createDbFixture(first.prisma);
      const slotBarrier = adoptionBarrier("CREATE_ROLE");
      const slotWinner = executeGovernanceDecisionOperation(sameSlot.adoption, createPrismaGovernanceDecisionDependencies(first.prisma, { beforeAdoptionStep: slotBarrier.hook }));
      await slotBarrier.entered;
      const slotContender = executeGovernanceDecisionOperation({ ...sameSlot.adoption, actorId: sameSlot.participantTwoId, mutationKey: `${sameSlot.adoption.mutationKey}-other` }, createPrismaGovernanceDecisionDependencies(second.prisma));
      slotBarrier.release();
      await Promise.all([
        slotWinner,
        assert.rejects(slotContender, (error) => error instanceof GovernanceDecisionError && error.code === "SERIALIZATION_CONFLICT"),
      ]);
      assert.equal(await first.prisma.roleDef.count({ where: { organizationId: sameSlot.organizationId } }), 1);
    });

    test("every real adoption write boundary rolls back and persists mandatory failure audit", async () => {
      const steps: GovernanceAdoptionWriteStep[] = ["CREATE_ROLE", "CREATE_DECISION", "CREATE_CHANGE_LOG", "UPDATE_PROPOSAL", "UPDATE_PROCESS", "RESOLVE_TENSION", "CREATE_ROLE_ARTIFACT", "APPEND_EVENTS", "MARK_OPERATION_SUCCEEDED"];
      for (const step of steps) {
        const fixture = await createDbFixture(first.prisma);
        await assert.rejects(executeGovernanceDecisionOperation(fixture.adoption, createPrismaGovernanceDecisionDependencies(first.prisma, { beforeAdoptionStep: (current) => { if (current === step) throw new Error(`INJECTED_${step}`); } })));
        await assertNoAdoptionEffects(first.prisma, fixture);
        const [operation, processRow, failedEvents] = await Promise.all([
          first.prisma.governanceDecisionOperation.findUniqueOrThrow({ where: { organizationId_mutationKey: { organizationId: fixture.organizationId, mutationKey: fixture.adoption.mutationKey } }, select: { status: true, failureCode: true, resultEnvelope: true } }),
          first.prisma.governanceDecisionProcess.findUniqueOrThrow({ where: { id: fixture.processId }, select: { applicationAttempts: true, lastApplicationError: true } }),
          first.prisma.interfaceWorkflowRunEvent.count({ where: { organizationId: fixture.organizationId, type: "COMMAND_FAILED" } }),
        ]);
        assert.equal(operation.status, "FAILED", step);
        assert.equal(operation.resultEnvelope, null, step);
        assert.equal(processRow.applicationAttempts, 1, step);
        assert.equal(failedEvents, 1, step);
      }
    });

    test("same-key retry rotates lease, succeeds once, and terminal replay is exact", async () => {
      const fixture = await createDbFixture(first.prisma);
      await assert.rejects(executeGovernanceDecisionOperation(fixture.adoption, createPrismaGovernanceDecisionDependencies(first.prisma, { beforeAdoptionStep: (step) => { if (step === "CREATE_DECISION") throw new Error("INJECTED_CREATE_DECISION"); } })));
      const failed = await first.prisma.governanceDecisionOperation.findUniqueOrThrow({ where: { organizationId_mutationKey: { organizationId: fixture.organizationId, mutationKey: fixture.adoption.mutationKey } }, select: { id: true, status: true, attempt: true, leaseToken: true, resultEnvelope: true } });
      assert.deepEqual({ status: failed.status, attempt: failed.attempt, resultEnvelope: failed.resultEnvelope }, { status: "FAILED", attempt: 1, resultEnvelope: null });
      const recovered = await executeGovernanceDecisionOperation(fixture.adoption, createPrismaGovernanceDecisionDependencies(second.prisma));
      const replayed = await executeGovernanceDecisionOperation(fixture.adoption, createPrismaGovernanceDecisionDependencies(first.prisma));
      assert.deepEqual(replayed, recovered);
      const succeeded = await first.prisma.governanceDecisionOperation.findUniqueOrThrow({ where: { id: failed.id }, select: { status: true, attempt: true, leaseToken: true, resultEnvelope: true } });
      assert.equal(succeeded.status, "SUCCEEDED");
      assert.equal(succeeded.attempt, 2);
      assert.notEqual(succeeded.leaseToken, failed.leaseToken);
      assert.notEqual(succeeded.resultEnvelope, null);
      assert.equal(await first.prisma.roleDef.count({ where: { organizationId: fixture.organizationId } }), 1);
      const staleTokenWrite = await first.prisma.governanceDecisionOperation.updateMany({ where: { id: failed.id, leaseToken: failed.leaseToken, status: "PROCESSING" }, data: { failureCode: "STALE_TOKEN" } });
      assert.equal(staleTokenWrite.count, 0);
    });

    test("expired PROCESSING lease permits only exact same-key reclaim", async () => {
      const fixture = await createDbFixture(first.prisma);
      const shortLease = 1_500;
      await assert.rejects(executeGovernanceDecisionOperation(fixture.adoption, createPrismaGovernanceDecisionDependencies(first.prisma, { leaseMs: shortLease, beforeAdoptionStep: (step) => { if (step === "CREATE_ROLE") throw new Error("INJECTED_CREATE_ROLE"); }, beforeFailureAudit: () => { throw new Error("INJECTED_FAILURE_AUDIT"); } })));
      const processing = await first.prisma.governanceDecisionOperation.findUniqueOrThrow({ where: { organizationId_mutationKey: { organizationId: fixture.organizationId, mutationKey: fixture.adoption.mutationKey } }, select: { id: true, status: true, attempt: true, leaseToken: true, resultEnvelope: true } });
      assert.deepEqual({ status: processing.status, attempt: processing.attempt, resultEnvelope: processing.resultEnvelope }, { status: "PROCESSING", attempt: 1, resultEnvelope: null });
      await assert.rejects(executeGovernanceDecisionOperation({ ...fixture.adoption, mutationKey: `${fixture.adoption.mutationKey}-fresh` }, createPrismaGovernanceDecisionDependencies(second.prisma)), (error) => error instanceof GovernanceDecisionError && error.code === "LOGICAL_SLOT_ALREADY_CLAIMED");
      await new Promise((resolve) => setTimeout(resolve, shortLease + 300));
      const recovered = await executeGovernanceDecisionOperation(fixture.adoption, createPrismaGovernanceDecisionDependencies(second.prisma, { leaseMs: shortLease }));
      assert.equal(recovered.state, "ADOPTED");
      const reclaimed = await first.prisma.governanceDecisionOperation.findUniqueOrThrow({ where: { id: processing.id }, select: { status: true, attempt: true, leaseToken: true } });
      assert.equal(reclaimed.status, "SUCCEEDED");
      assert.equal(reclaimed.attempt, 2);
      assert.notEqual(reclaimed.leaseToken, processing.leaseToken);
    });
  });
}
