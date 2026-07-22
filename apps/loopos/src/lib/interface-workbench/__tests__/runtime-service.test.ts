import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  WORKFLOW_COMPILER_VERSION,
  WORKFLOW_DEFINITION_SCHEMA_VERSION,
  WORKFLOW_PROTOCOL_VERSION,
  type CompiledRuntimeNode,
  type CompiledWorkflow,
  type WorkflowEdge,
} from "../protocol";
import { advanceWorkflowRun, startWorkflowRun, takeOverWorkflowRun } from "../runtime-service";
import type {
  LockedActiveRuntimeVersion,
  RuntimeCommandCreate,
  RuntimeCommandRecord,
  RuntimeEventWrite,
  RuntimeRunCreate,
  RuntimeRunProjectionUpdate,
  RuntimeRunSnapshot,
  RuntimeServiceDependencies,
  RuntimeTransaction,
  StoredRuntimeRoleBinding,
  ValidatedRuntimeRoleBinding,
} from "../runtime-types";

function workflow(nodes: CompiledRuntimeNode[], edges: WorkflowEdge[]): CompiledWorkflow {
  const adjacency: CompiledWorkflow["adjacency"] = Object.fromEntries(nodes.map((node) => [node.id, []]));
  for (const edge of edges) adjacency[edge.from].push({ edgeId: edge.id, to: edge.to, ...(edge.branch ? { branch: edge.branch } : {}) });
  return {
    protocolVersion: WORKFLOW_PROTOCOL_VERSION,
    definitionSchemaVersion: WORKFLOW_DEFINITION_SCHEMA_VERSION,
    compilerVersion: WORKFLOW_COMPILER_VERSION,
    entryNodeId: nodes[0].id,
    nodes,
    edges,
    adjacency,
    terminalNodeIds: nodes.filter((node) => node.type === "complete" || node.type === "terminate").map((node) => node.id),
    requiredCapabilities: [],
    hashes: { source: "source", semantics: "semantics" },
  };
}

const evidenceThenWait = workflow(
  [
    { id: "evidence", type: "structured_evidence_input", config: { fields: ["result"], roleId: "operator" } },
    { id: "wait", type: "wait_for_role", config: { roleId: "reviewer", request: "Review" } },
    { id: "done", type: "complete", config: { outcome: "accepted" } },
  ],
  [
    { id: "to-wait", from: "evidence", to: "wait" },
    { id: "to-done", from: "wait", to: "done" },
  ],
);

type FakeCommand = Omit<RuntimeCommandCreate, "status"> & RuntimeCommandRecord;

class FakeStore {
  active: LockedActiveRuntimeVersion | null;
  versions = new Map<string, CompiledWorkflow>();
  runs = new Map<string, RuntimeRunSnapshot>();
  bindings = new Map<string, StoredRuntimeRoleBinding>();
  events: RuntimeEventWrite[] = [];
  commands: FakeCommand[] = [];
  artifacts: Array<{ id: string; organizationId: string; runId: string; artifactType: "TENSION" | "GOVERNANCE_PROPOSAL" | "MEETING"; artifactId: string; relation: string; metadata: Record<string, unknown> }> = [];
  tensions: string[] = [];
  governanceProposals: Array<{ id: string; tensionId: string; meetingId: string | null; status: "CANDIDATE" }> = [];
  writes: string[] = [];
  now = new Date("2026-07-11T00:10:00.000Z");
  failAt: "artifact" | "projection" | "success" | "route" | null = null;
  stealLeaseAfterClaim = false;
  private nextRun = 1;
  private nextBinding = 1;
  private nextCommand = 1;

  constructor(active: LockedActiveRuntimeVersion) {
    this.active = active;
    this.versions.set(active.versionId, active.workflow);
  }

  dependencies(): RuntimeServiceDependencies {
    return {
      readRun: async ({ organizationId, runId }) => this.runs.get(runId)?.organizationId === organizationId ? this.runs.get(runId)! : null,
      findCommandByIdempotencyKey: async (input) => this.commandByKey(input.runId, input.clientIdempotencyKey)?.organizationId === input.organizationId ? this.commandByKey(input.runId, input.clientIdempotencyKey) : null,
      findCommandByExecution: async (input) => this.commandByExecution(input.runId, input.nodeId, input.nodeVisit, input.kind)?.organizationId === input.organizationId ? this.commandByExecution(input.runId, input.nodeId, input.nodeVisit, input.kind) : null,
      transaction: async (work) => {
        const snapshot = structuredClone({
          active: this.active,
          versions: [...this.versions],
          runs: [...this.runs],
          bindings: [...this.bindings],
          events: this.events,
          commands: this.commands,
          artifacts: this.artifacts,
          tensions: this.tensions,
          governanceProposals: this.governanceProposals,
          writes: this.writes,
          nextRun: this.nextRun,
          nextBinding: this.nextBinding,
          nextCommand: this.nextCommand,
        });
        try {
          const result = await work(this.transaction());
          if (this.stealLeaseAfterClaim) {
            const processing = this.commands.find((command) => command.status === "PROCESSING");
            if (processing) {
              processing.updatedAt = new Date(processing.updatedAt.getTime() + 1);
              this.stealLeaseAfterClaim = false;
            }
          }
          return result;
        } catch (error) {
          this.active = snapshot.active;
          this.versions = new Map(snapshot.versions);
          this.runs = new Map(snapshot.runs);
          this.bindings = new Map(snapshot.bindings);
          this.events = snapshot.events;
          this.commands = snapshot.commands;
          this.artifacts = snapshot.artifacts;
          this.tensions = snapshot.tensions;
          this.governanceProposals = snapshot.governanceProposals;
          this.writes = snapshot.writes;
          this.nextRun = snapshot.nextRun;
          this.nextBinding = snapshot.nextBinding;
          this.nextCommand = snapshot.nextCommand;
          throw error;
        }
      },
      now: () => this.now,
    };
  }

  setActive(versionId: string, compiled: CompiledWorkflow, roleIds: string[]) {
    this.versions.set(versionId, compiled);
    this.active = { workbenchId: "wb", versionId, workflow: compiled, roleIds };
  }

  private transaction(): RuntimeTransaction {
    return {
      lockActiveVersion: async () => this.active,
      lockRun: async ({ organizationId, runId }) => this.runs.get(runId)?.organizationId === organizationId ? this.runs.get(runId)! : null,
      findCommandByIdempotencyKey: async (input) => this.commandByKey(input.runId, input.clientIdempotencyKey)?.organizationId === input.organizationId ? this.commandByKey(input.runId, input.clientIdempotencyKey) : null,
      findCommandByExecution: async (input) => this.commandByExecution(input.runId, input.nodeId, input.nodeVisit, input.kind)?.organizationId === input.organizationId ? this.commandByExecution(input.runId, input.nodeId, input.nodeVisit, input.kind) : null,
      findRoleBinding: async (input) => [...this.bindings.values()].find((binding) => {
        const runBindingIds = this.bindingIds(input.runId);
        return runBindingIds.has(binding.id) && binding.roleId === input.roleId;
      }) ?? null,
      createRun: async (data) => this.createRun(data),
      createRoleBindings: async (input) => this.createBindings(input.runId, input.bindings),
      appendEvents: async (events) => {
        this.writes.push("events");
        this.events.push(...events);
        const run = this.runs.get(events[0]?.runId ?? "");
        if (run && events.length > 0) run.lastEventSequence = events.at(-1)!.sequence;
      },
      updateRunProjection: async (input) => {
        if (this.failAt === "projection") throw new Error("INJECTED_PROJECTION_FAILURE");
        const run = this.runs.get(input.runId);
        if (!run || run.revision !== input.expectedRevision) return false;
        this.writes.push("projection");
        this.applyProjection(run, input.data);
        return true;
      },
      createCommand: async (data) => {
        this.writes.push("command:PROCESSING");
        const command: FakeCommand = { ...data, id: `command-${this.nextCommand++}`, error: null, updatedAt: new Date(this.now) };
        this.commands.push(command);
        return structuredClone(command);
      },
      reclaimCommand: async (input) => {
        const command = this.commands.find((candidate) => candidate.id === input.commandId);
        if (!command || command.status !== input.expectedStatus || command.updatedAt.getTime() !== input.expectedUpdatedAt.getTime()) return null;
        if (input.staleBefore && command.updatedAt.getTime() > input.staleBefore.getTime()) return null;
        command.status = "PROCESSING";
        command.attempts += 1;
        command.error = null;
        command.updatedAt = new Date(this.now);
        this.writes.push("command:RECLAIMED");
        return structuredClone(command);
      },
      lockCommand: async ({ commandId }) => this.commands.find((candidate) => candidate.id === commandId) ?? null,
      markCommandSucceeded: async ({ commandId, leaseToken }) => {
        if (this.failAt === "success") throw new Error("INJECTED_SUCCESS_FAILURE");
        this.writes.push("command:SUCCEEDED");
        const command = this.commands.find((candidate) => candidate.id === commandId);
        if (leaseToken && command?.updatedAt.getTime() !== leaseToken.getTime()) return false;
        if (command) command.status = "SUCCEEDED";
        return command !== undefined;
      },
      markCommandFailed: async ({ commandId, leaseToken, error }) => {
        const command = this.commands.find((candidate) => candidate.id === commandId);
        if (!command || command.status !== "PROCESSING" || command.updatedAt.getTime() !== leaseToken.getTime()) return false;
        command.status = "FAILED";
        command.error = error;
        command.updatedAt = new Date(this.now.getTime() + 1);
        this.writes.push("command:FAILED");
        return true;
      },
      raiseTension: async () => {
        const id = `tension-${this.tensions.length + 1}`;
        this.tensions.push(id);
        this.writes.push("tension");
        return { id };
      },
      resolveTacticalRoute: async ({ runId, sourceTensionArtifactId, meetingId }) => {
        const source = this.artifacts.find((artifact) => artifact.id === sourceTensionArtifactId && artifact.runId === runId && artifact.artifactType === "TENSION" && artifact.relation === "raised-tension");
        if (!source || meetingId !== "meeting-tactical") throw new Error("INVALID_ROUTE");
        return { tensionId: source.artifactId, meetingId, sourceArtifactId: source.id };
      },
      authorizeGovernanceCandidate: async ({ actorId, sourceTensionArtifactId }) => {
        const source = this.artifacts.find((artifact) => artifact.id === sourceTensionArtifactId && artifact.artifactType === "TENSION" && artifact.relation === "raised-tension");
        if (!source || actorId !== "proposer") throw new Error("GOVERNANCE_CANDIDATE_AUTHOR_FORBIDDEN");
      },
      authorizeGovernanceRoute: async ({ actorId, proposalArtifactId, meetingId }) => {
        const artifact = this.artifacts.find((item) => item.id === proposalArtifactId && item.artifactType === "GOVERNANCE_PROPOSAL" && item.relation === `governance-candidate:${String(item.metadata.commandId)}`);
        const proposal = artifact ? this.governanceProposals.find((item) => item.id === artifact.artifactId && (item.meetingId === null || item.meetingId === meetingId)) : null;
        if (!artifact || !proposal || meetingId !== "meeting-governance" || !["proposer", "participant"].includes(actorId)) throw new Error("GOVERNANCE_ROUTE_PARTICIPANT_FORBIDDEN");
      },
      authorizeGovernanceCandidateReplay: async ({ actorId, sourceTensionArtifactId, expectedRevision, command }) => {
        const artifact = this.artifacts.find((item) => item.artifactType === "GOVERNANCE_PROPOSAL" && item.relation === `governance-candidate:${command.id}`);
        if (!artifact || actorId !== "proposer" || command.actorId !== actorId || command.status !== "SUCCEEDED" || command.clientIdempotencyKey === "" || artifact.metadata.sourceTensionArtifactId !== sourceTensionArtifactId || artifact.metadata.revision !== expectedRevision || artifact.metadata.nodeId !== command.nodeId || artifact.metadata.nodeVisit !== command.nodeVisit) throw new Error("GOVERNANCE_CANDIDATE_REPLAY_FORBIDDEN");
      },
      authorizeGovernanceRouteReplay: async ({ actorId, proposalArtifactId, meetingId, expectedRevision, command }) => {
        const proposalArtifact = this.artifacts.find((item) => item.id === proposalArtifactId && item.artifactType === "GOVERNANCE_PROPOSAL" && item.relation === `governance-candidate:${String(item.metadata.commandId)}`);
        const routeArtifact = this.artifacts.find((item) => item.artifactType === "MEETING" && item.artifactId === meetingId && item.relation === `governance-route:${command.id}`);
        const proposal = proposalArtifact ? this.governanceProposals.find((item) => item.id === proposalArtifact.artifactId && item.meetingId === meetingId) : null;
        if (!proposalArtifact || !routeArtifact || !proposal || !["proposer", "participant"].includes(actorId) || command.actorId !== actorId || command.status !== "SUCCEEDED" || routeArtifact.metadata.revision !== expectedRevision || routeArtifact.metadata.actorId !== actorId || routeArtifact.metadata.proposalArtifactId !== proposalArtifactId || routeArtifact.metadata.nodeId !== command.nodeId || routeArtifact.metadata.nodeVisit !== command.nodeVisit) throw new Error("GOVERNANCE_ROUTE_REPLAY_FORBIDDEN");
      },
      createGovernanceCandidate: async ({ actorId, sourceTensionArtifactId, draft }) => {
        const source = this.artifacts.find((artifact) => artifact.id === sourceTensionArtifactId && artifact.artifactType === "TENSION" && artifact.relation === "raised-tension");
        if (!source || actorId !== "proposer") throw new Error("GOVERNANCE_CANDIDATE_AUTHOR_FORBIDDEN");
        if (!draft.currentStructure || !draft.proposedStructure || !draft.expectedImpact || !draft.rationale) throw new Error("INVALID_GOVERNANCE_CANDIDATE_DRAFT");
        if (this.governanceProposals.some((proposal) => proposal.tensionId === source.artifactId)) throw new Error("GOVERNANCE_CANDIDATE_EXISTS");
        const proposal = { id: `proposal-${this.governanceProposals.length + 1}`, tensionId: source.artifactId, meetingId: null, status: "CANDIDATE" as const };
        this.governanceProposals.push(proposal);
        this.writes.push("governance:candidate");
        return { proposalId: proposal.id, tensionId: proposal.tensionId, sourceArtifactId: source.id };
      },
      routeGovernanceCandidate: async ({ actorId, proposalArtifactId, meetingId }) => {
        if (this.failAt === "route") throw new Error("INJECTED_ROUTE_FAILURE");
        const artifact = this.artifacts.find((item) => item.id === proposalArtifactId && item.artifactType === "GOVERNANCE_PROPOSAL" && item.relation === `governance-candidate:${String(item.metadata.commandId)}`);
        const proposal = artifact ? this.governanceProposals.find((item) => item.id === artifact.artifactId && item.meetingId === null) : null;
        if (!artifact || !proposal || meetingId !== "meeting-governance" || !["proposer", "participant"].includes(actorId)) throw new Error("GOVERNANCE_ROUTE_PARTICIPANT_FORBIDDEN");
        proposal.meetingId = meetingId;
        this.writes.push("governance:route");
        return { proposalId: proposal.id, proposalArtifactId: artifact.id, sourceTensionArtifactId: String(artifact.metadata.sourceTensionArtifactId), tensionId: proposal.tensionId, meetingId };
      },
      createArtifact: async (input) => {
        if (this.failAt === "artifact") throw new Error("INJECTED_ARTIFACT_FAILURE");
        const artifact = { id: `artifact-${this.artifacts.length + 1}`, ...input };
        this.artifacts.push(artifact);
        this.writes.push("artifact");
        return { id: artifact.id };
      },
      assignWaitingBinding: async ({ bindingId, personId }) => {
        this.writes.push("binding:takeover");
        const binding = this.bindings.get(bindingId);
        if (binding) Object.assign(binding, { personId, roleDefId: null });
        return binding !== undefined;
      },
    };
  }

  private createRun(data: RuntimeRunCreate): { id: string } {
    this.writes.push("run");
    const id = `run-${this.nextRun++}`;
    this.runs.set(id, {
      id,
      organizationId: data.organizationId,
      workbenchId: data.workbenchId,
      versionId: data.versionId,
      workflow: this.versions.get(data.versionId)!,
      status: data.status,
      currentNodeId: data.currentNodeId,
      currentNodeVisit: data.currentNodeVisit,
      evidence: data.evidence,
      revision: data.revision,
      waitingRoleBinding: null,
      lastEventSequence: 0,
    });
    return { id };
  }

  private createBindings(runId: string, bindings: ValidatedRuntimeRoleBinding[]): StoredRuntimeRoleBinding[] {
    this.writes.push("bindings");
    return bindings.map((binding) => {
      const stored: StoredRuntimeRoleBinding = {
        id: `${runId}:binding-${this.nextBinding++}`,
        roleId: binding.roleId,
        personId: binding.personId ?? null,
        roleDefId: binding.roleDefId ?? null,
      };
      this.bindings.set(stored.id, stored);
      return stored;
    });
  }

  private bindingIds(runId: string): Set<string> {
    return new Set([...this.bindings.keys()].filter((id) => id.startsWith(`${runId}:`)));
  }

  private applyProjection(run: RuntimeRunSnapshot, data: RuntimeRunProjectionUpdate) {
    if (data.status !== undefined) run.status = data.status;
    if (data.currentNodeId !== undefined) run.currentNodeId = data.currentNodeId;
    if (data.currentNodeVisit !== undefined) run.currentNodeVisit = data.currentNodeVisit;
    if (data.evidence !== undefined) run.evidence = data.evidence;
    if (data.revision !== undefined) run.revision = data.revision;
    if (data.waitingRoleBindingId !== undefined) run.waitingRoleBinding = data.waitingRoleBindingId === null ? null : this.bindings.get(data.waitingRoleBindingId) ?? null;
  }

  private commandByKey(runId: string, key: string) {
    return this.commands.find((command) => command.runId === runId && command.clientIdempotencyKey === key) ?? null;
  }

  private commandByExecution(runId: string, nodeId: string, nodeVisit: number, kind: string) {
    return this.commands.find((command) => command.runId === runId && command.nodeId === nodeId && command.nodeVisit === nodeVisit && command.kind === kind) ?? null;
  }
}

const bindings: ValidatedRuntimeRoleBinding[] = [
  { roleId: "operator", personId: "operator-person" },
  { roleId: "reviewer", roleDefId: "reviewer-role" },
];

async function startedStore() {
  const store = new FakeStore({ workbenchId: "wb", versionId: "v1", workflow: evidenceThenWait, roleIds: ["operator", "reviewer"] });
  const result = await startWorkflowRun({ organizationId: "org", workbenchId: "wb", starterId: "starter", bindings }, store.dependencies());
  assert.equal(result.ok, true);
  if (!result.ok) throw new Error("fixture failed");
  return { store, runId: result.runId };
}

describe("transactional runtime service", () => {
  test("pins the active immutable version at each start even when v2 later becomes active", async () => {
    const store = new FakeStore({ workbenchId: "wb", versionId: "v1", workflow: evidenceThenWait, roleIds: ["operator", "reviewer"] });
    const first = await startWorkflowRun({ organizationId: "org", workbenchId: "wb", starterId: "starter", bindings }, store.dependencies());
    assert.equal(first.ok, true);
    store.setActive("v2", workflow([{ id: "done-v2", type: "complete", config: { outcome: "v2" } }], []), ["operator", "reviewer"]);
    const second = await startWorkflowRun({ organizationId: "org", workbenchId: "wb", starterId: "starter", bindings }, store.dependencies());
    assert.equal(second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(store.runs.get(first.runId)?.versionId, "v1");
    assert.equal(store.runs.get(first.runId)?.workflow.entryNodeId, "evidence");
    assert.equal(store.runs.get(second.runId)?.versionId, "v2");
    assert.deepEqual(store.events.filter((event) => event.runId === first.runId).map((event) => event.type), ["STARTED"]);
  });

  test("rejects binding mismatches and a v1-bindings/v2-locked race before writes", async () => {
    const invalidCases: ValidatedRuntimeRoleBinding[][] = [
      [{ roleId: "operator", personId: "operator-person" }],
      [...bindings, { roleId: "extra", personId: "extra-person" }],
      [bindings[0], bindings[0]],
      [{ roleId: "", personId: "operator-person" }, bindings[1]],
      [{ roleId: "operator", personId: "" }, bindings[1]],
      [bindings[0], { roleId: "reviewer", roleDefId: "" }],
      [{ roleId: "operator", personId: "operator-person", roleDefId: "operator-role" } as unknown as ValidatedRuntimeRoleBinding, bindings[1]],
    ];
    for (const invalidBindings of invalidCases) {
      const store = new FakeStore({ workbenchId: "wb", versionId: "v1", workflow: evidenceThenWait, roleIds: ["operator", "reviewer"] });
      const result = await startWorkflowRun({ organizationId: "org", workbenchId: "wb", starterId: "starter", bindings: invalidBindings }, store.dependencies());
      assert.deepEqual(result, { ok: false, error: "INVALID_BINDINGS" });
      assert.deepEqual(store.writes, []);
    }

    const raced = new FakeStore({ workbenchId: "wb", versionId: "v2", workflow: evidenceThenWait, roleIds: ["operator", "approver"] });
    const result = await startWorkflowRun({ organizationId: "org", workbenchId: "wb", starterId: "starter", bindings }, raced.dependencies());
    assert.deepEqual(result, { ok: false, error: "INVALID_BINDINGS" });
    assert.deepEqual(raced.writes, []);
  });

  test("rejects stale revision before any writes", async () => {
    const { store, runId } = await startedStore();
    const before = store.writes.length;
    const result = await advanceWorkflowRun({
      organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true,
      expectedRevision: 9, clientIdempotencyKey: "stale", command: { kind: "SUBMIT_EVIDENCE", payload: { evidence: { result: "pass" } } },
    }, store.dependencies());
    assert.deepEqual(result, { ok: false, error: "REVISION_CONFLICT", currentRevision: 0 });
    assert.equal(store.writes.length, before);
  });

  test("returns the prior command result for a duplicate key without new events", async () => {
    const { store, runId } = await startedStore();
    const input = {
      organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true,
      expectedRevision: 0, clientIdempotencyKey: "same", command: { kind: "SUBMIT_EVIDENCE", payload: { evidence: { result: "pass" } } },
    } as const;
    const first = await advanceWorkflowRun(input, store.dependencies());
    const eventCount = store.events.length;
    const second = await advanceWorkflowRun(input, store.dependencies());
    assert.deepEqual(second, first);
    assert.equal(store.events.length, eventCount);
    assert.equal(store.commands.length, 1);
    assert.deepEqual(store.writes.slice(-4), ["command:PROCESSING", "events", "projection", "command:SUCCEEDED"]);
  });

  test("appends engine events in order and projects waiting responsibility", async () => {
    const { store, runId } = await startedStore();
    const result = await advanceWorkflowRun({
      organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true,
      expectedRevision: 0, clientIdempotencyKey: "advance", command: { kind: "SUBMIT_EVIDENCE", payload: { evidence: { result: "pass" } } },
    }, store.dependencies());
    assert.equal(result.ok, true);
    assert.deepEqual(store.events.filter((event) => event.runId === runId).map((event) => [event.sequence, event.type]), [
      [1, "STARTED"],
      [2, "COMMAND_ACCEPTED"],
      [3, "EVIDENCE_RECORDED"],
      [4, "NODE_TRANSITIONED"],
      [5, "WAITING_FOR_ROLE"],
    ]);
    const run = store.runs.get(runId)!;
    assert.equal(run.status, "WAITING");
    assert.equal(run.waitingRoleBinding?.roleId, "reviewer");
    assert.equal(run.waitingRoleBinding?.roleDefId, "reviewer-role");
  });

  test("authorized takeover reassigns only the waiting binding and records TAKEOVER", async () => {
    const { store, runId } = await startedStore();
    await advanceWorkflowRun({
      organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true,
      expectedRevision: 0, clientIdempotencyKey: "advance", command: { kind: "SUBMIT_EVIDENCE", payload: { evidence: { result: "pass" } } },
    }, store.dependencies());
    const deniedWrites = store.writes.length;
    assert.deepEqual(await takeOverWorkflowRun({ organizationId: "org", runId, actorId: "lead", actorAuthorized: false, expectedRevision: 1 }, store.dependencies()), { ok: false, error: "FORBIDDEN" });
    assert.equal(store.writes.length, deniedWrites);
    assert.deepEqual(await takeOverWorkflowRun({ organizationId: "org", runId, actorId: "lead", actorAuthorized: true, expectedRevision: 1 }, store.dependencies()), { ok: true, revision: 2 });
    assert.equal(store.runs.get(runId)?.waitingRoleBinding?.personId, "lead");
    assert.equal(store.runs.get(runId)?.waitingRoleBinding?.roleDefId, null);
    assert.equal(store.events.at(-1)?.type, "TAKEOVER");
    assert.deepEqual(store.events.at(-1)?.payload, { bindingId: store.runs.get(runId)?.waitingRoleBinding?.id, roleId: "reviewer", previousPersonId: null, previousRoleDefId: "reviewer-role" });
  });

  test("engine error rolls back with no command, event, or projection writes", async () => {
    const { store, runId } = await startedStore();
    const before = { writes: store.writes.length, events: store.events.length, commands: store.commands.length, revision: store.runs.get(runId)?.revision };
    const result = await advanceWorkflowRun({
      organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true,
      expectedRevision: 0, clientIdempotencyKey: "bad", command: { kind: "CONFIRM" },
    }, store.dependencies());
    assert.equal(result.ok, false);
    if (!result.ok) assert.equal(result.error, "ENGINE_ERROR");
    assert.deepEqual({ writes: store.writes.length, events: store.events.length, commands: store.commands.length, revision: store.runs.get(runId)?.revision }, before);
  });

  test("failed authorization and same-visit duplicate checks perform no writes", async () => {
    const { store, runId } = await startedStore();
    const deniedBefore = store.writes.length;
    assert.deepEqual(await advanceWorkflowRun({
      organizationId: "org", runId, actorId: "stranger", actorAuthorized: false,
      expectedRevision: 0, clientIdempotencyKey: "denied", command: { kind: "SUBMIT_EVIDENCE", payload: { evidence: { result: "pass" } } },
    }, store.dependencies()), { ok: false, error: "FORBIDDEN" });
    assert.equal(store.writes.length, deniedBefore);

    await advanceWorkflowRun({
      organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true,
      expectedRevision: 0, clientIdempotencyKey: "first", command: { kind: "SUBMIT_EVIDENCE", payload: { evidence: { result: "pass" } } },
    }, store.dependencies());
    const run = store.runs.get(runId)!;
    run.revision = 0;
    run.currentNodeId = "evidence";
    run.currentNodeVisit = 0;
    const duplicateBefore = store.writes.length;
    const duplicate = await advanceWorkflowRun({
      organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true,
      expectedRevision: 0, clientIdempotencyKey: "different", command: { kind: "SUBMIT_EVIDENCE", payload: { evidence: { result: "pass" } } },
    }, store.dependencies());
    assert.equal(duplicate.ok, false);
    if (!duplicate.ok) assert.equal(duplicate.error, "COMMAND_ALREADY_EXECUTED");
    assert.equal(store.writes.length, duplicateBefore);
  });
});

const sideEffectWorkflow = workflow(
  [
    { id: "confirm-raise", type: "human_confirmation", config: { prompt: "Raise?", roleId: "operator" } },
    { id: "raise", type: "raise_tension", config: { confirmationNodeId: "confirm-raise", roleId: "operator", titleField: "title", descriptionField: "description" } },
    { id: "confirm-route", type: "human_confirmation", config: { prompt: "Route?", roleId: "operator" } },
    { id: "route", type: "route_tactical_meeting", config: { confirmationNodeId: "confirm-route", roleId: "operator" } },
    { id: "done", type: "complete", config: { outcome: "routed" } },
  ],
  [
    { id: "to-raise", from: "confirm-raise", to: "raise" },
    { id: "to-confirm-route", from: "raise", to: "confirm-route" },
    { id: "to-route", from: "confirm-route", to: "route" },
    { id: "to-done", from: "route", to: "done" },
  ],
);

async function sideEffectStore() {
  const store = new FakeStore({ workbenchId: "wb-side", versionId: "v-side", workflow: sideEffectWorkflow, roleIds: ["operator"] });
  const started = await startWorkflowRun({ organizationId: "org", workbenchId: "wb-side", starterId: "operator-person", bindings: [{ roleId: "operator", personId: "operator-person" }], evidence: { title: "Raised title", description: "Raised description" } }, store.dependencies());
  assert.equal(started.ok, true);
  if (!started.ok) throw new Error("fixture failed");
  const confirmed = await advanceWorkflowRun({ organizationId: "org", runId: started.runId, actorId: "operator-person", actorAuthorized: true, expectedRevision: 0, clientIdempotencyKey: "confirm-raise", command: { kind: "CONFIRM" } }, store.dependencies());
  assert.equal(confirmed.ok, true);
  return { store, runId: started.runId };
}

describe("leased side-effect commands", () => {
  test("duplicate raise command creates one tension and one artifact", async () => {
    const { store, runId } = await sideEffectStore();
    const input = { organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true, expectedRevision: 1, clientIdempotencyKey: "raise-once", command: { kind: "EXECUTE_SIDE_EFFECT" } } as const;
    const first = await advanceWorkflowRun(input, store.dependencies());
    const duplicate = await advanceWorkflowRun(input, store.dependencies());
    assert.equal(first.ok, true);
    assert.deepEqual(duplicate, first);
    assert.equal(store.tensions.length, 1);
    assert.equal(store.artifacts.filter((artifact) => artifact.relation === "raised-tension").length, 1);
    assert.deepEqual(store.artifacts[0].metadata, { schemaVersion: 1, commandId: store.commands.at(-1)?.id, nodeId: "raise", nodeVisit: 1 });
  });

  test("duplicate tactical route creates one exact command-linked route artifact", async () => {
    const { store, runId } = await sideEffectStore();
    await advanceWorkflowRun({ organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true, expectedRevision: 1, clientIdempotencyKey: "raise", command: { kind: "EXECUTE_SIDE_EFFECT" } }, store.dependencies());
    await advanceWorkflowRun({ organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true, expectedRevision: 2, clientIdempotencyKey: "confirm-route", command: { kind: "CONFIRM" } }, store.dependencies());
    const source = store.artifacts.find((artifact) => artifact.artifactType === "TENSION")!;
    const input = { organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true, expectedRevision: 3, clientIdempotencyKey: "route-once", command: { kind: "EXECUTE_SIDE_EFFECT", payload: { meetingId: "meeting-tactical", sourceTensionArtifactId: source.id } } } as const;
    const first = await advanceWorkflowRun(input, store.dependencies());
    const duplicate = await advanceWorkflowRun(input, store.dependencies());
    assert.equal(first.ok, true);
    assert.deepEqual(duplicate, first);
    const routes = store.artifacts.filter((artifact) => artifact.artifactType === "MEETING");
    assert.equal(routes.length, 1);
    assert.equal(routes[0].relation, `tactical-route:${store.commands.at(-1)?.id}`);
    assert.equal(routes[0].metadata.sourceTensionArtifactId, source.id);
  });

  test("FAILED is persisted, immediately reclaimed, and succeeds without duplicate domain writes", async () => {
    const { store, runId } = await sideEffectStore();
    const input = { organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true, expectedRevision: 1, clientIdempotencyKey: "retry", command: { kind: "EXECUTE_SIDE_EFFECT" } } as const;
    store.failAt = "artifact";
    const failed = await advanceWorkflowRun(input, store.dependencies());
    assert.equal(failed.ok, false);
    assert.equal(store.commands[1].status, "FAILED");
    assert.equal(store.tensions.length, 0);
    assert.equal(store.artifacts.length, 0);
    assert.equal(store.runs.get(runId)?.revision, 1);
    assert.equal(store.events.at(-1)?.type, "COMMAND_FAILED");
    store.failAt = null;
    const retried = await advanceWorkflowRun(input, store.dependencies());
    assert.equal(retried.ok, true);
    assert.equal(store.commands[1].attempts, 2);
    assert.equal(store.tensions.length, 1);
    assert.equal(store.artifacts.length, 1);
  });

  test("fresh PROCESSING is blocked while stale PROCESSING is atomically reclaimed after five minutes", async () => {
    const fresh = await sideEffectStore();
    fresh.store.commands.push({ id: "processing", organizationId: "org", runId: fresh.runId, nodeId: "raise", nodeVisit: 1, kind: "EXECUTE_SIDE_EFFECT", clientIdempotencyKey: "lease", actorId: "operator-person", payload: {}, attempts: 1, status: "PROCESSING", error: null, updatedAt: new Date(fresh.store.now) });
    const input = { organizationId: "org", runId: fresh.runId, actorId: "operator-person", actorAuthorized: true, expectedRevision: 1, clientIdempotencyKey: "lease", command: { kind: "EXECUTE_SIDE_EFFECT" } } as const;
    assert.deepEqual(await advanceWorkflowRun(input, fresh.store.dependencies()), { ok: false, error: "COMMAND_IN_PROGRESS" });
    fresh.store.commands[1].updatedAt = new Date(fresh.store.now.getTime() - 5 * 60_000);
    const reclaimed = await advanceWorkflowRun(input, fresh.store.dependencies());
    assert.equal(reclaimed.ok, true);
    assert.equal(fresh.store.commands[1].attempts, 2);
  });

  test("domain, artifact, events, projection, and success roll back together when finalization fails", async () => {
    const { store, runId } = await sideEffectStore();
    const beforeEvents = store.events.length;
    store.failAt = "success";
    const result = await advanceWorkflowRun({ organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true, expectedRevision: 1, clientIdempotencyKey: "atomic", command: { kind: "EXECUTE_SIDE_EFFECT" } }, store.dependencies());
    assert.equal(result.ok, false);
    assert.equal(store.tensions.length, 0);
    assert.equal(store.artifacts.length, 0);
    assert.equal(store.runs.get(runId)?.revision, 1);
    assert.deepEqual(store.events.slice(beforeEvents).map((event) => event.type), ["COMMAND_FAILED"]);
    assert.equal(store.commands[1].status, "FAILED");
  });

  test("a stale lease token cannot execute or finalize the side effect", async () => {
    const { store, runId } = await sideEffectStore();
    store.stealLeaseAfterClaim = true;
    const result = await advanceWorkflowRun({ organizationId: "org", runId, actorId: "operator-person", actorAuthorized: true, expectedRevision: 1, clientIdempotencyKey: "stale-worker", command: { kind: "EXECUTE_SIDE_EFFECT" } }, store.dependencies());
    assert.equal(result.ok, false);
    assert.equal(store.tensions.length, 0);
    assert.equal(store.artifacts.length, 0);
    assert.equal(store.runs.get(runId)?.revision, 1);
    assert.equal(store.commands[1].status, "PROCESSING");
  });
});

const governanceWorkflow = workflow(
  [
    { id: "candidate", type: "mark_governance_candidate", config: { confirmationNodeId: "confirmed", rationaleField: "rationale", roleId: "operator" } },
    { id: "route-governance", type: "route_governance_meeting", config: { confirmationNodeId: "candidate", roleId: "operator" } },
    { id: "governance-done", type: "complete", config: { outcome: "routed" } },
  ],
  [
    { id: "candidate-to-route", from: "candidate", to: "route-governance" },
    { id: "route-to-done", from: "route-governance", to: "governance-done" },
  ],
);

async function governanceStore() {
  const store = new FakeStore({ workbenchId: "wb-governance", versionId: "v-governance", workflow: governanceWorkflow, roleIds: ["operator"] });
  const started = await startWorkflowRun({ organizationId: "org", workbenchId: "wb-governance", starterId: "proposer", bindings: [{ roleId: "operator", personId: "proposer" }] }, store.dependencies());
  assert.equal(started.ok, true);
  if (!started.ok) throw new Error("fixture failed");
  store.artifacts.push({ id: "source-tension", organizationId: "org", runId: started.runId, artifactType: "TENSION", artifactId: "tension-open", relation: "raised-tension", metadata: { schemaVersion: 1 } });
  return { store, runId: started.runId };
}

const candidatePayload = {
  confirmed: true,
  sourceTensionArtifactId: "source-tension",
  structuralCategory: "ACCOUNTABILITY",
  currentStructure: "当前职责边界不清",
  proposedStructure: "明确数据验收职责",
  rationale: "持续出现交付争议",
  expectedImpact: "减少接口返工",
} as const;

describe("generic governance candidate and explicit routing", () => {
  test("only the tension raiser can create one durable candidate and exact duplicates replay without writes", async () => {
    const { store, runId } = await governanceStore();
    const deniedBefore = store.writes.length;
    const denied = await advanceWorkflowRun({ organizationId: "org", runId, actorId: "coach", actorAuthorized: true, expectedRevision: 0, clientIdempotencyKey: "wrong-author", command: { kind: "EXECUTE_SIDE_EFFECT", payload: candidatePayload } }, store.dependencies());
    assert.equal(denied.ok, false);
    assert.equal(store.governanceProposals.length, 0);
    assert.equal(store.writes.filter((write) => write === "governance:candidate").length, 0);
    assert.equal(store.runs.get(runId)?.revision, 0);
    assert.equal(store.writes.length, deniedBefore);

    const input = { organizationId: "org", runId, actorId: "proposer", actorAuthorized: true, expectedRevision: 0, clientIdempotencyKey: "candidate-once", command: { kind: "EXECUTE_SIDE_EFFECT", payload: candidatePayload } } as const;
    const first = await advanceWorkflowRun(input, store.dependencies());
    const beforeReplay = store.writes.length;
    const replay = await advanceWorkflowRun(input, store.dependencies());
    assert.equal(first.ok, true);
    assert.deepEqual(replay, first);
    assert.equal(store.writes.length, beforeReplay);
    assert.equal(store.governanceProposals.length, 1);
    assert.equal(store.governanceProposals[0].meetingId, null);
    assert.equal(store.artifacts.filter((artifact) => artifact.artifactType === "GOVERNANCE_PROPOSAL").length, 1);
  });

  test("changed actor or payload cannot reuse a successful command key", async () => {
    const { store, runId } = await governanceStore();
    const input = { organizationId: "org", runId, actorId: "proposer", actorAuthorized: true, expectedRevision: 0, clientIdempotencyKey: "bound-candidate", command: { kind: "EXECUTE_SIDE_EFFECT", payload: candidatePayload } } as const;
    await advanceWorkflowRun(input, store.dependencies());
    const before = store.writes.length;
    assert.deepEqual(await advanceWorkflowRun({ ...input, actorId: "participant" }, store.dependencies()), { ok: false, error: "FORBIDDEN" });
    assert.deepEqual(await advanceWorkflowRun({ ...input, command: { kind: "EXECUTE_SIDE_EFFECT", payload: { ...candidatePayload, rationale: "changed" } } }, store.dependencies()), { ok: false, error: "FORBIDDEN" });
    assert.equal(store.writes.length, before);
  });

  test("route failure preserves the unrouted candidate and selected participant retry creates one exact route", async () => {
    const { store, runId } = await governanceStore();
    await advanceWorkflowRun({ organizationId: "org", runId, actorId: "proposer", actorAuthorized: true, expectedRevision: 0, clientIdempotencyKey: "candidate", command: { kind: "EXECUTE_SIDE_EFFECT", payload: candidatePayload } }, store.dependencies());
    const proposalArtifact = store.artifacts.find((artifact) => artifact.artifactType === "GOVERNANCE_PROPOSAL")!;
    const routeInput = { organizationId: "org", runId, actorId: "participant", actorAuthorized: true, expectedRevision: 1, clientIdempotencyKey: "route", command: { kind: "EXECUTE_SIDE_EFFECT", payload: { confirmed: true, meetingId: "meeting-governance", proposalArtifactId: proposalArtifact.id } } } as const;
    store.failAt = "artifact";
    const failed = await advanceWorkflowRun(routeInput, store.dependencies());
    assert.equal(failed.ok, false);
    assert.equal(store.governanceProposals[0].meetingId, null);
    assert.equal(store.artifacts.filter((artifact) => artifact.relation.startsWith("governance-route:")).length, 0);
    store.failAt = null;
    const retried = await advanceWorkflowRun(routeInput, store.dependencies());
    assert.equal(retried.ok, true);
    assert.equal(store.governanceProposals[0].meetingId, "meeting-governance");
    const routes = store.artifacts.filter((artifact) => artifact.relation.startsWith("governance-route:"));
    assert.equal(routes.length, 1);
    assert.equal(routes[0].metadata.proposalArtifactId, proposalArtifact.id);
    const beforeReplay = store.writes.length;
    assert.deepEqual(await advanceWorkflowRun(routeInput, store.dependencies()), retried);
    assert.deepEqual(await advanceWorkflowRun({ ...routeInput, actorId: "nonparticipant" }, store.dependencies()), { ok: false, error: "FORBIDDEN" });
    assert.deepEqual(await advanceWorkflowRun({ ...routeInput, organizationId: "org-b" }, store.dependencies()), { ok: false, error: "NOT_FOUND" });
    assert.deepEqual(await advanceWorkflowRun({ ...routeInput, expectedRevision: 2 }, store.dependencies()), { ok: false, error: "FORBIDDEN" });
    assert.deepEqual(await advanceWorkflowRun({ ...routeInput, command: { kind: "EXECUTE_SIDE_EFFECT", payload: { confirmed: true, meetingId: "meeting-other", proposalArtifactId: proposalArtifact.id } } }, store.dependencies()), { ok: false, error: "FORBIDDEN" });
    assert.equal(store.writes.length, beforeReplay);
  });
});
