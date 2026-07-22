import { Prisma, type PrismaClient } from "@/generated/prisma/client";
import {
  authorizeGovernanceCandidateAuthor,
  authorizeGovernanceCandidateReplay as authorizeGovernanceCandidateReplayDomain,
  authorizeGovernanceRoute,
  authorizeGovernanceRouteReplay as authorizeGovernanceRouteReplayDomain,
  createGovernanceCandidate,
  raiseTension,
  resolveTacticalRoute,
  routeGovernanceCandidate,
  type GovernanceReplayCommand,
} from "@/lib/domain-operations";

import { transitionRuntime } from "./runtime-engine";
import type { RuntimeEvent, RuntimeEvidence, RuntimeEvidenceValue } from "./runtime-engine";
import type {
  AdvanceWorkflowRunInput,
  AdvanceWorkflowRunResult,
  LockedActiveRuntimeVersion,
  RuntimeCommandRecord,
  RuntimeEventWrite,
  RuntimeRunSnapshot,
  RuntimeServiceDependencies,
  RuntimeTransaction,
  StartWorkflowRunInput,
  StartWorkflowRunResult,
  StoredRuntimeRoleBinding,
  TakeOverWorkflowRunInput,
  TakeOverWorkflowRunResult,
  ValidatedRuntimeRoleBinding,
} from "./runtime-types";

export async function startWorkflowRun(
  input: StartWorkflowRunInput,
  dependencies: RuntimeServiceDependencies,
): Promise<StartWorkflowRunResult> {
  if (!hasUniqueValidBindings(input.bindings)) return { ok: false, error: "INVALID_BINDINGS" };

  return dependencies.transaction<StartWorkflowRunResult>(async (transaction) => {
    const active = await transaction.lockActiveVersion({
      organizationId: input.organizationId,
      workbenchId: input.workbenchId,
    });
    if (!active) return { ok: false, error: "NO_ACTIVE_VERSION" };
    if (!hasExactRoleBindings(input.bindings, active.roleIds)) {
      return { ok: false, error: "INVALID_BINDINGS" };
    }

    const evidence = input.evidence ?? {};
    const entry = active.workflow.nodes.find((node) => node.id === active.workflow.entryNodeId);
    const transitioned = entry?.type === "structured_evidence_input" || entry?.type === "human_confirmation"
      ? {
          ok: true as const,
          nextNodeId: entry.id,
          nextNodeVisit: 0,
          status: "ACTIVE" as const,
          evidencePatch: {},
          waitingRoleId: null,
          events: [],
        }
      : (dependencies.transition ?? transitionRuntime)({
          workflow: active.workflow,
          currentNodeId: active.workflow.entryNodeId,
          currentNodeVisit: 0,
          evidence,
          command: null,
        });
    if (!transitioned.ok) return { ok: false, error: "ENGINE_ERROR", engineError: transitioned.error };

    const created = await transaction.createRun({
      organizationId: input.organizationId,
      workbenchId: active.workbenchId,
      versionId: active.versionId,
      status: transitioned.status,
      currentNodeId: transitioned.nextNodeId,
      currentNodeVisit: transitioned.nextNodeVisit,
      evidence: mergeEvidence(evidence, transitioned.evidencePatch),
      revision: 0,
      starterId: input.starterId,
      lastActorId: input.starterId,
    });
    const bindings = await transaction.createRoleBindings({
      organizationId: input.organizationId,
      runId: created.id,
      bindings: input.bindings,
    });
    const waitingBinding = transitioned.waitingRoleId === null
      ? null
      : bindings.find((binding) => binding.roleId === transitioned.waitingRoleId) ?? null;
    if (transitioned.waitingRoleId !== null && !waitingBinding) {
      throw new InvalidRuntimeBindingsError(transitioned.waitingRoleId);
    }

    if (waitingBinding) {
      const updated = await transaction.updateRunProjection({
        organizationId: input.organizationId,
        runId: created.id,
        expectedRevision: 0,
        data: { waitingRoleBindingId: waitingBinding.id },
      });
      if (!updated) throw new Error("new runtime run projection could not be initialized");
    }

    await transaction.appendEvents([
      {
        organizationId: input.organizationId,
        runId: created.id,
        sequence: 1,
        type: "STARTED",
        nodeId: active.workflow.entryNodeId,
        nodeVisit: 0,
        actorId: input.starterId,
        payload: { versionId: active.versionId },
      },
      ...transitioned.events.map((event, index) => runtimeEventWrite(
        input.organizationId,
        created.id,
        input.starterId,
        index + 2,
        event,
      )),
    ]);
    return { ok: true, runId: created.id, versionId: active.versionId };
  }).catch((error: unknown) => {
    if (error instanceof InvalidRuntimeBindingsError) return { ok: false, error: "INVALID_BINDINGS" } as const;
    throw error;
  });
}

export async function advanceWorkflowRun(
  input: AdvanceWorkflowRunInput,
  dependencies: RuntimeServiceDependencies,
): Promise<AdvanceWorkflowRunResult> {
  if (!input.actorAuthorized) return { ok: false, error: "FORBIDDEN" };

  const preflight = await dependencies.readRun({ organizationId: input.organizationId, runId: input.runId });
  if (!preflight) return { ok: false, error: "NOT_FOUND" };
  const duplicate = await dependencies.findCommandByIdempotencyKey({
    organizationId: input.organizationId,
    runId: input.runId,
    clientIdempotencyKey: input.clientIdempotencyKey,
  });
  if (enabledSideEffectType(preflight) || (duplicate && sideEffectTypeForNode(preflight, duplicate.nodeId))) {
    return advanceSideEffectWorkflowRun(input, preflight, dependencies);
  }
  if (duplicate) return priorCommandResult(duplicate);
  const executed = await dependencies.findCommandByExecution({
    organizationId: input.organizationId,
    runId: input.runId,
    nodeId: preflight.currentNodeId,
    nodeVisit: preflight.currentNodeVisit,
    kind: input.command.kind,
  });
  if (executed) return { ok: false, error: "COMMAND_ALREADY_EXECUTED", commandId: executed.id };
  if (preflight.revision !== input.expectedRevision) {
    return { ok: false, error: "REVISION_CONFLICT", currentRevision: preflight.revision };
  }

  return dependencies.transaction(async (transaction) => {
    const run = await transaction.lockRun({ organizationId: input.organizationId, runId: input.runId });
    if (!run) return { ok: false, error: "NOT_FOUND" };
    const lockedDuplicate = await transaction.findCommandByIdempotencyKey({
      organizationId: input.organizationId,
      runId: input.runId,
      clientIdempotencyKey: input.clientIdempotencyKey,
    });
    if (lockedDuplicate) return priorCommandResult(lockedDuplicate);
    const lockedExecuted = await transaction.findCommandByExecution({
      organizationId: input.organizationId,
      runId: input.runId,
      nodeId: run.currentNodeId,
      nodeVisit: run.currentNodeVisit,
      kind: input.command.kind,
    });
    if (lockedExecuted) return { ok: false, error: "COMMAND_ALREADY_EXECUTED", commandId: lockedExecuted.id };
    if (run.revision !== input.expectedRevision) {
      return { ok: false, error: "REVISION_CONFLICT", currentRevision: run.revision };
    }

    const transitioned = (dependencies.transition ?? transitionRuntime)({
      workflow: run.workflow,
      currentNodeId: run.currentNodeId,
      currentNodeVisit: run.currentNodeVisit,
      evidence: run.evidence,
      command: input.command,
    });
    if (!transitioned.ok) return { ok: false, error: "ENGINE_ERROR", engineError: transitioned.error };

    const waitingBinding = transitioned.waitingRoleId === null
      ? null
      : await transaction.findRoleBinding({
        organizationId: input.organizationId,
        runId: input.runId,
        roleId: transitioned.waitingRoleId,
      });
    if (transitioned.waitingRoleId !== null && !waitingBinding) {
      throw new InvalidRuntimeBindingsError(transitioned.waitingRoleId);
    }
    const command = await transaction.createCommand({
      organizationId: input.organizationId,
      runId: input.runId,
      nodeId: run.currentNodeId,
      nodeVisit: run.currentNodeVisit,
      kind: input.command.kind,
      clientIdempotencyKey: input.clientIdempotencyKey,
      actorId: input.actorId,
      payload: input.command.payload ?? {},
      attempts: 1,
      status: "PROCESSING",
    });
    await transaction.appendEvents(transitioned.events.map((event, index) => runtimeEventWrite(
      input.organizationId,
      input.runId,
      input.actorId,
      run.lastEventSequence + index + 1,
      event,
    )));
    const updated = await transaction.updateRunProjection({
      organizationId: input.organizationId,
      runId: input.runId,
      expectedRevision: run.revision,
      data: {
        status: transitioned.status,
        currentNodeId: transitioned.nextNodeId,
        currentNodeVisit: transitioned.nextNodeVisit,
        evidence: mergeEvidence(run.evidence, transitioned.evidencePatch),
        revision: run.revision + 1,
        lastActorId: input.actorId,
        waitingRoleBindingId: waitingBinding?.id ?? null,
      },
    });
    if (!updated) throw new Error("locked runtime run revision changed unexpectedly");
    const commandSucceeded = await transaction.markCommandSucceeded({ organizationId: input.organizationId, commandId: command.id });
    if (!commandSucceeded) throw new Error("runtime command status could not be completed");
    return { ok: true, commandId: command.id };
  });
}

export const SIDE_EFFECT_PROCESSING_LEASE_MS = 5 * 60_000;

async function advanceSideEffectWorkflowRun(
  input: AdvanceWorkflowRunInput,
  preflight: RuntimeRunSnapshot,
  dependencies: RuntimeServiceDependencies,
): Promise<AdvanceWorkflowRunResult> {
  if (input.command.kind !== "EXECUTE_SIDE_EFFECT") {
    return { ok: false, error: "ENGINE_ERROR", engineError: { code: "INVALID_COMMAND", nodeId: preflight.currentNodeId, message: "Side effects require EXECUTE_SIDE_EFFECT" } };
  }
  const now = dependencies.now?.() ?? new Date();
  const claim = await dependencies.transaction(async (transaction) => {
    const run = await transaction.lockRun({ organizationId: input.organizationId, runId: input.runId });
    if (!run) return { ok: false as const, error: "NOT_FOUND" as const };
    const activeNodeType = enabledSideEffectType(run);
    const keyedCommand = await transaction.findCommandByIdempotencyKey({
      organizationId: input.organizationId,
      runId: input.runId,
      clientIdempotencyKey: input.clientIdempotencyKey,
    });
    const executedCommand = keyedCommand || !activeNodeType ? null : await transaction.findCommandByExecution({
      organizationId: input.organizationId,
      runId: input.runId,
      nodeId: run.currentNodeId,
      nodeVisit: run.currentNodeVisit,
      kind: input.command.kind,
    });
    const existing = keyedCommand ?? executedCommand;
    const nodeType = existing ? sideEffectTypeForNode(run, existing.nodeId) : activeNodeType;
    if (!nodeType) return { ok: false as const, error: "REVISION_CONFLICT" as const, currentRevision: run.revision };
    if (existing && (
      existing.clientIdempotencyKey !== input.clientIdempotencyKey
      || existing.kind !== input.command.kind
      || existing.actorId !== input.actorId
      || !samePayload(existing.payload, input.command.payload ?? {})
    )) {
      return { ok: false as const, error: "FORBIDDEN" as const };
    }
    if (nodeType === "mark_governance_candidate") {
      const candidate = governanceCandidatePayload(input.command.payload);
      if (!candidate) return { ok: false as const, error: "FORBIDDEN" as const };
      try {
        if (existing?.status === "SUCCEEDED") {
          await transaction.authorizeGovernanceCandidateReplay({ organizationId: input.organizationId, runId: input.runId, actorId: input.actorId, sourceTensionArtifactId: candidate.sourceTensionArtifactId, expectedRevision: input.expectedRevision, command: existing });
        } else {
          if (existing && (run.currentNodeId !== existing.nodeId || run.currentNodeVisit !== existing.nodeVisit || run.revision !== input.expectedRevision)) throw new Error("GOVERNANCE_CANDIDATE_REPLAY_FORBIDDEN");
          await transaction.authorizeGovernanceCandidate({ organizationId: input.organizationId, runId: input.runId, actorId: input.actorId, sourceTensionArtifactId: candidate.sourceTensionArtifactId });
        }
      } catch {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }
    }
    if (nodeType === "route_governance_meeting") {
      const route = governanceRoutePayload(input.command.payload);
      if (!route) return { ok: false as const, error: "FORBIDDEN" as const };
      try {
        if (existing?.status === "SUCCEEDED") {
          await transaction.authorizeGovernanceRouteReplay({ organizationId: input.organizationId, runId: input.runId, actorId: input.actorId, proposalArtifactId: route.proposalArtifactId, meetingId: route.meetingId, expectedRevision: input.expectedRevision, command: existing });
        } else {
          if (existing && (run.currentNodeId !== existing.nodeId || run.currentNodeVisit !== existing.nodeVisit || run.revision !== input.expectedRevision)) throw new Error("GOVERNANCE_ROUTE_REPLAY_FORBIDDEN");
          await transaction.authorizeGovernanceRoute({ organizationId: input.organizationId, runId: input.runId, actorId: input.actorId, proposalArtifactId: route.proposalArtifactId, meetingId: route.meetingId });
        }
      } catch {
        return { ok: false as const, error: "FORBIDDEN" as const };
      }
    }
    if (existing) {
      if (existing.status === "SUCCEEDED") return { ok: true as const, command: existing, prior: true as const };
      if (existing.status === "PENDING") return { ok: false as const, error: "COMMAND_IN_PROGRESS" as const };
      const isStale = existing.status === "PROCESSING" && existing.updatedAt.getTime() <= now.getTime() - SIDE_EFFECT_PROCESSING_LEASE_MS;
      if (existing.status === "PROCESSING" && !isStale) return { ok: false as const, error: "COMMAND_IN_PROGRESS" as const };
      const reclaimed = await transaction.reclaimCommand({
        organizationId: input.organizationId,
        commandId: existing.id,
        expectedStatus: existing.status,
        expectedUpdatedAt: existing.updatedAt,
        ...(isStale ? { staleBefore: new Date(now.getTime() - SIDE_EFFECT_PROCESSING_LEASE_MS) } : {}),
      });
      return reclaimed
        ? { ok: true as const, command: reclaimed, prior: false as const }
        : { ok: false as const, error: "COMMAND_IN_PROGRESS" as const };
    }
    if (run.revision !== input.expectedRevision) {
      return { ok: false as const, error: "REVISION_CONFLICT" as const, currentRevision: run.revision };
    }
    const command = await transaction.createCommand({
      organizationId: input.organizationId,
      runId: input.runId,
      nodeId: run.currentNodeId,
      nodeVisit: run.currentNodeVisit,
      kind: input.command.kind,
      clientIdempotencyKey: input.clientIdempotencyKey,
      actorId: input.actorId,
      payload: input.command.payload ?? {},
      attempts: 1,
      status: "PROCESSING",
    });
    return { ok: true as const, command, prior: false as const };
  });
  if (!claim.ok) return claim;
  if (claim.prior) return { ok: true, commandId: claim.command.id };

  try {
    return await dependencies.transaction(async (transaction) => {
      const run = await transaction.lockRun({ organizationId: input.organizationId, runId: input.runId });
      const command = await transaction.lockCommand({ organizationId: input.organizationId, commandId: claim.command.id });
      if (!run || !command) throw new Error("SIDE_EFFECT_LEASE_LOST");
      if (command.status !== "PROCESSING" || command.updatedAt.getTime() !== claim.command.updatedAt.getTime()) {
        throw new Error("SIDE_EFFECT_LEASE_LOST");
      }
      if (run.currentNodeId !== command.nodeId || run.currentNodeVisit !== command.nodeVisit || run.revision !== input.expectedRevision) {
        throw new Error("SIDE_EFFECT_RUN_CHANGED");
      }
      const nodeType = enabledSideEffectType(run);
      if (!nodeType) throw new Error("SIDE_EFFECT_NODE_CHANGED");

      let artifactType: "TENSION" | "GOVERNANCE_PROPOSAL" | "MEETING";
      let artifactId: string;
      let relation: string;
      let metadata: Record<string, unknown>;
      if (nodeType === "raise_tension") {
        const node = run.workflow.nodes.find((candidate) => candidate.id === run.currentNodeId)!;
        const config = node.config as { titleField: string; descriptionField: string };
        const title = runtimeEvidenceString(run.evidence[config.titleField]);
        const description = runtimeEvidenceString(run.evidence[config.descriptionField]);
        if (!title || !description || !emptyPayload(command.payload)) throw new Error("INVALID_RAISE_TENSION_INPUT");
        const tension = await transaction.raiseTension({ organizationId: input.organizationId, raiserId: input.actorId, title, description });
        artifactType = "TENSION";
        artifactId = tension.id;
        relation = "raised-tension";
        metadata = { schemaVersion: 1, commandId: command.id, nodeId: command.nodeId, nodeVisit: command.nodeVisit };
      } else if (nodeType === "route_tactical_meeting") {
        const routeInput = tacticalRoutePayload(command.payload);
        if (!routeInput) throw new Error("INVALID_TACTICAL_ROUTE_INPUT");
        const route = await transaction.resolveTacticalRoute({
          organizationId: input.organizationId,
          runId: input.runId,
          sourceTensionArtifactId: routeInput.sourceTensionArtifactId,
          meetingId: routeInput.meetingId,
        });
        artifactType = "MEETING";
        artifactId = route.meetingId;
        relation = `tactical-route:${command.id}`;
        metadata = { schemaVersion: 1, commandId: command.id, nodeId: command.nodeId, nodeVisit: command.nodeVisit, meetingType: "TACTICAL", sourceTensionArtifactId: route.sourceArtifactId };
      } else if (nodeType === "mark_governance_candidate") {
        const candidateInput = governanceCandidatePayload(command.payload);
        if (!candidateInput) throw new Error("INVALID_GOVERNANCE_CANDIDATE_INPUT");
        const candidate = await transaction.createGovernanceCandidate({
          organizationId: input.organizationId,
          runId: input.runId,
          actorId: input.actorId,
          sourceTensionArtifactId: candidateInput.sourceTensionArtifactId,
          draft: candidateInput.draft,
        });
        artifactType = "GOVERNANCE_PROPOSAL";
        artifactId = candidate.proposalId;
        relation = `governance-candidate:${command.id}`;
        metadata = { schemaVersion: 1, commandId: command.id, nodeId: command.nodeId, nodeVisit: command.nodeVisit, runId: input.runId, revision: run.revision, sourceTensionArtifactId: candidate.sourceArtifactId, tensionId: candidate.tensionId, proposalId: candidate.proposalId, proposerId: input.actorId };
      } else {
        const routeInput = governanceRoutePayload(command.payload);
        if (!routeInput) throw new Error("INVALID_GOVERNANCE_ROUTE_INPUT");
        const route = await transaction.routeGovernanceCandidate({
          organizationId: input.organizationId,
          runId: input.runId,
          actorId: input.actorId,
          proposalArtifactId: routeInput.proposalArtifactId,
          meetingId: routeInput.meetingId,
        });
        artifactType = "MEETING";
        artifactId = route.meetingId;
        relation = `governance-route:${command.id}`;
        metadata = { schemaVersion: 1, commandId: command.id, nodeId: command.nodeId, nodeVisit: command.nodeVisit, runId: input.runId, revision: run.revision, actorId: input.actorId, meetingType: "GOVERNANCE", proposalId: route.proposalId, proposalArtifactId: route.proposalArtifactId, sourceTensionArtifactId: route.sourceTensionArtifactId, tensionId: route.tensionId };
      }
      const artifact = await transaction.createArtifact({ organizationId: input.organizationId, runId: input.runId, artifactType, artifactId, relation, metadata });

      const transitioned = (dependencies.transition ?? transitionRuntime)({
        workflow: run.workflow,
        currentNodeId: run.currentNodeId,
        currentNodeVisit: run.currentNodeVisit,
        evidence: run.evidence,
        command: { kind: "EXECUTE_SIDE_EFFECT", payload: command.payload },
      });
      if (!transitioned.ok) throw new Error(`ENGINE_${transitioned.error.code}`);
      const waitingBinding = transitioned.waitingRoleId === null ? null : await transaction.findRoleBinding({ organizationId: input.organizationId, runId: input.runId, roleId: transitioned.waitingRoleId });
      if (transitioned.waitingRoleId !== null && !waitingBinding) throw new InvalidRuntimeBindingsError(transitioned.waitingRoleId);
      const eventWrites = transitioned.events.map((event, index) => runtimeEventWrite(input.organizationId, input.runId, input.actorId, run.lastEventSequence + index + 1, event));
      eventWrites.push({
        organizationId: input.organizationId,
        runId: input.runId,
        sequence: run.lastEventSequence + eventWrites.length + 1,
        type: "ARTIFACT_CREATED",
        nodeId: command.nodeId,
        nodeVisit: command.nodeVisit,
        actorId: input.actorId,
        payload: { artifactLinkId: artifact.id, artifactType, artifactId, relation },
      });
      await transaction.appendEvents(eventWrites);
      const updated = await transaction.updateRunProjection({
        organizationId: input.organizationId,
        runId: input.runId,
        expectedRevision: run.revision,
        data: { status: transitioned.status, currentNodeId: transitioned.nextNodeId, currentNodeVisit: transitioned.nextNodeVisit, evidence: mergeEvidence(run.evidence, transitioned.evidencePatch), revision: run.revision + 1, lastActorId: input.actorId, waitingRoleBindingId: waitingBinding?.id ?? null },
      });
      if (!updated) throw new Error("SIDE_EFFECT_PROJECTION_CONFLICT");
      const succeeded = await transaction.markCommandSucceeded({ organizationId: input.organizationId, commandId: command.id, leaseToken: claim.command.updatedAt });
      if (!succeeded) throw new Error("SIDE_EFFECT_LEASE_LOST");
      return { ok: true as const, commandId: command.id };
    });
  } catch (error) {
    const sanitized = sanitizeSideEffectError(error);
    await dependencies.transaction(async (transaction) => {
      const run = await transaction.lockRun({ organizationId: input.organizationId, runId: input.runId });
      const command = await transaction.lockCommand({ organizationId: input.organizationId, commandId: claim.command.id });
      if (!run || !command || command.status !== "PROCESSING" || command.updatedAt.getTime() !== claim.command.updatedAt.getTime()) return;
      const failed = await transaction.markCommandFailed({ organizationId: input.organizationId, commandId: command.id, leaseToken: claim.command.updatedAt, error: sanitized });
      if (!failed) return;
      await transaction.appendEvents([{
        organizationId: input.organizationId,
        runId: input.runId,
        sequence: run.lastEventSequence + 1,
        type: "COMMAND_FAILED",
        nodeId: command.nodeId,
        nodeVisit: command.nodeVisit,
        actorId: input.actorId,
        payload: { commandId: command.id, attempt: command.attempts, error: sanitized },
      }]);
    });
    return { ok: false, error: "SIDE_EFFECT_FAILED", commandId: claim.command.id };
  }
}

function enabledSideEffectType(run: RuntimeRunSnapshot): "raise_tension" | "route_tactical_meeting" | "mark_governance_candidate" | "route_governance_meeting" | null {
  return sideEffectTypeForNode(run, run.currentNodeId);
}

function sideEffectTypeForNode(run: RuntimeRunSnapshot, nodeId: string): "raise_tension" | "route_tactical_meeting" | "mark_governance_candidate" | "route_governance_meeting" | null {
  const node = run.workflow.nodes.find((candidate) => candidate.id === nodeId);
  return node?.type === "raise_tension" || node?.type === "route_tactical_meeting" || node?.type === "mark_governance_candidate" || node?.type === "route_governance_meeting" ? node.type : null;
}

function runtimeEvidenceString(value: RuntimeEvidenceValue | undefined): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function emptyPayload(value: unknown): boolean {
  return isRecord(value) && Object.keys(value).length === 0;
}

function tacticalRoutePayload(value: unknown): { meetingId: string; sourceTensionArtifactId: string } | null {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "meetingId,sourceTensionArtifactId") return null;
  return typeof value.meetingId === "string" && value.meetingId && typeof value.sourceTensionArtifactId === "string" && value.sourceTensionArtifactId
    ? { meetingId: value.meetingId, sourceTensionArtifactId: value.sourceTensionArtifactId }
    : null;
}

const STRUCTURAL_CATEGORIES = new Set(["ROLE", "CIRCLE", "DOMAIN_AUTHORITY", "ACCOUNTABILITY", "POLICY", "INTERFACE_RELATIONSHIP"]);

function governanceCandidatePayload(value: unknown): {
  sourceTensionArtifactId: string;
  draft: { structuralCategory: "ROLE" | "CIRCLE" | "DOMAIN_AUTHORITY" | "ACCOUNTABILITY" | "POLICY" | "INTERFACE_RELATIONSHIP"; currentStructure: string; proposedStructure: string; expectedImpact: string; rationale: string };
} | null {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "confirmed,currentStructure,expectedImpact,proposedStructure,rationale,sourceTensionArtifactId,structuralCategory" || value.confirmed !== true) return null;
  if (typeof value.sourceTensionArtifactId !== "string" || !value.sourceTensionArtifactId || typeof value.structuralCategory !== "string" || !STRUCTURAL_CATEGORIES.has(value.structuralCategory)) return null;
  const textValues = [value.currentStructure, value.proposedStructure, value.expectedImpact, value.rationale];
  if (textValues.some((item) => typeof item !== "string" || !item.trim() || Buffer.byteLength(item.trim(), "utf8") > 8 * 1024)) return null;
  return {
    sourceTensionArtifactId: value.sourceTensionArtifactId,
    draft: {
      structuralCategory: value.structuralCategory as "ROLE" | "CIRCLE" | "DOMAIN_AUTHORITY" | "ACCOUNTABILITY" | "POLICY" | "INTERFACE_RELATIONSHIP",
      currentStructure: String(value.currentStructure).trim(),
      proposedStructure: String(value.proposedStructure).trim(),
      expectedImpact: String(value.expectedImpact).trim(),
      rationale: String(value.rationale).trim(),
    },
  };
}

function governanceRoutePayload(value: unknown): { meetingId: string; proposalArtifactId: string } | null {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "confirmed,meetingId,proposalArtifactId" || value.confirmed !== true) return null;
  return typeof value.meetingId === "string" && value.meetingId && typeof value.proposalArtifactId === "string" && value.proposalArtifactId
    ? { meetingId: value.meetingId, proposalArtifactId: value.proposalArtifactId }
    : null;
}

function samePayload(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function sanitizeSideEffectError(error: unknown): string {
  const message = error instanceof Error ? error.message : "SIDE_EFFECT_FAILED";
  return /^[A-Z0-9_:-]+$/.test(message) ? message.slice(0, 160) : "SIDE_EFFECT_FAILED";
}

export async function takeOverWorkflowRun(
  input: TakeOverWorkflowRunInput,
  dependencies: RuntimeServiceDependencies,
): Promise<TakeOverWorkflowRunResult> {
  if (!input.actorAuthorized) return { ok: false, error: "FORBIDDEN" };

  return dependencies.transaction(async (transaction) => {
    const run = await transaction.lockRun({ organizationId: input.organizationId, runId: input.runId });
    if (!run) return { ok: false, error: "NOT_FOUND" };
    if (run.revision !== input.expectedRevision) {
      return { ok: false, error: "REVISION_CONFLICT", currentRevision: run.revision };
    }
    if (run.status !== "WAITING" || !run.waitingRoleBinding) return { ok: false, error: "NOT_WAITING" };
    const previousBinding = { ...run.waitingRoleBinding };

    const assigned = await transaction.assignWaitingBinding({
      organizationId: input.organizationId,
      bindingId: previousBinding.id,
      personId: input.actorId,
    });
    if (!assigned) throw new Error("waiting runtime binding could not be reassigned");
    await transaction.appendEvents([{
      organizationId: input.organizationId,
      runId: input.runId,
      sequence: run.lastEventSequence + 1,
      type: "TAKEOVER",
      nodeId: run.currentNodeId,
      nodeVisit: run.currentNodeVisit,
      actorId: input.actorId,
      payload: {
        bindingId: previousBinding.id,
        roleId: previousBinding.roleId,
        previousPersonId: previousBinding.personId,
        previousRoleDefId: previousBinding.roleDefId,
      },
    }]);
    const nextRevision = run.revision + 1;
    const updated = await transaction.updateRunProjection({
      organizationId: input.organizationId,
      runId: input.runId,
      expectedRevision: run.revision,
      data: { revision: nextRevision, lastActorId: input.actorId },
    });
    if (!updated) throw new Error("locked runtime run revision changed unexpectedly");
    return { ok: true, revision: nextRevision };
  });
}

function priorCommandResult(command: RuntimeCommandRecord): AdvanceWorkflowRunResult {
  return command.status === "SUCCEEDED"
    ? { ok: true, commandId: command.id }
    : { ok: false, error: "COMMAND_IN_PROGRESS" };
}

function hasUniqueValidBindings(bindings: ValidatedRuntimeRoleBinding[]): boolean {
  const roleIds = new Set<string>();
  for (const binding of bindings) {
    if (!binding.roleId || roleIds.has(binding.roleId)) return false;
    const hasPersonId = typeof binding.personId === "string" && binding.personId.length > 0;
    const hasRoleDefId = typeof binding.roleDefId === "string" && binding.roleDefId.length > 0;
    if (hasPersonId === hasRoleDefId) return false;
    roleIds.add(binding.roleId);
  }
  return true;
}

function hasExactRoleBindings(bindings: ValidatedRuntimeRoleBinding[], expectedRoleIds: string[]): boolean {
  if (bindings.length !== expectedRoleIds.length || new Set(expectedRoleIds).size !== expectedRoleIds.length) return false;
  const submittedRoleIds = new Set(bindings.map((binding) => binding.roleId));
  return expectedRoleIds.every((roleId) => roleId.length > 0 && submittedRoleIds.has(roleId));
}

function sourceRoleIds(value: unknown): string[] | null {
  if (!isRecord(value) || !Array.isArray(value.roles)) return null;
  const roleIds = value.roles.map((role) => isRecord(role) && typeof role.id === "string" && role.id ? role.id : null);
  return roleIds.every((roleId) => roleId !== null) && new Set(roleIds).size === roleIds.length ? roleIds : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mergeEvidence(
  evidence: RuntimeEvidence,
  patch: Record<string, RuntimeEvidenceValue>,
): RuntimeEvidence {
  return { ...evidence, ...patch };
}

function runtimeEventWrite(
  organizationId: string,
  runId: string,
  actorId: string,
  sequence: number,
  event: RuntimeEvent,
): RuntimeEventWrite {
  if (event.type === "NODE_TRANSITIONED") {
    return {
      organizationId,
      runId,
      sequence,
      type: event.type,
      nodeId: event.fromNodeId,
      nodeVisit: event.toNodeVisit - 1,
      actorId,
      payload: { edgeId: event.edgeId, fromNodeId: event.fromNodeId, toNodeId: event.toNodeId, toNodeVisit: event.toNodeVisit },
    };
  }
  const { type, nodeId, nodeVisit, ...payload } = event;
  return { organizationId, runId, sequence, type, nodeId, nodeVisit, actorId, payload };
}

class InvalidRuntimeBindingsError extends Error {
  constructor(roleId: string) {
    super(`No validated binding exists for runtime role ${roleId}`);
  }
}

type PrismaTransactionClient = Prisma.TransactionClient;
type PrismaReadClient = PrismaClient | PrismaTransactionClient;

export function createPrismaRuntimeDependencies(client: PrismaClient): RuntimeServiceDependencies {
  const reads = prismaReads(client);
  return {
    ...reads,
    transaction: (work) => client.$transaction((transaction) => work(prismaTransaction(transaction)), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }),
  };
}

function prismaReads(client: PrismaReadClient): Pick<RuntimeServiceDependencies, "readRun" | "findCommandByIdempotencyKey" | "findCommandByExecution"> {
  return {
    readRun: (input) => readPrismaRun(client, input),
    findCommandByIdempotencyKey: async (input) => client.interfaceWorkflowCommand.findFirst({
      where: { organizationId: input.organizationId, runId: input.runId, clientIdempotencyKey: input.clientIdempotencyKey },
      select: runtimeCommandSelect,
    }),
    findCommandByExecution: async (input) => client.interfaceWorkflowCommand.findFirst({
      where: { organizationId: input.organizationId, runId: input.runId, nodeId: input.nodeId, nodeVisit: input.nodeVisit, kind: input.kind },
      select: runtimeCommandSelect,
    }),
  };
}

function prismaTransaction(client: PrismaTransactionClient): RuntimeTransaction {
  const reads = prismaReads(client);
  return {
    lockActiveVersion: async (input) => {
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "interface_workbenches" WHERE "id" = ${input.workbenchId} AND "organizationId" = ${input.organizationId} FOR UPDATE`);
      const row = await client.interfaceWorkbench.findFirst({
        where: { id: input.workbenchId, organizationId: input.organizationId, activeVersionId: { not: null } },
        select: { id: true, activeVersion: { select: { id: true, compiledSnapshot: true, sourceSnapshot: true } } },
      });
      if (!row?.activeVersion) return null;
      const roleIds = sourceRoleIds(row.activeVersion.sourceSnapshot);
      return roleIds ? {
        workbenchId: row.id,
        versionId: row.activeVersion.id,
        workflow: row.activeVersion.compiledSnapshot as unknown as LockedActiveRuntimeVersion["workflow"],
        roleIds,
      } : null;
    },
    lockRun: async (input) => {
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "interface_workflow_runs" WHERE "id" = ${input.runId} AND "organizationId" = ${input.organizationId} FOR UPDATE`);
      return readPrismaRun(client, input);
    },
    findCommandByIdempotencyKey: reads.findCommandByIdempotencyKey,
    findCommandByExecution: reads.findCommandByExecution,
    findRoleBinding: async (input) => client.interfaceWorkflowRunRoleBinding.findFirst({
      where: { organizationId: input.organizationId, runId: input.runId, roleId: input.roleId },
      select: { id: true, roleId: true, personId: true, roleDefId: true },
    }),
    createRun: (data) => client.interfaceWorkflowRun.create({
      data: { ...data, evidence: data.evidence as Prisma.InputJsonValue },
      select: { id: true },
    }),
    createRoleBindings: async (input) => {
      const created: StoredRuntimeRoleBinding[] = [];
      for (const binding of input.bindings) {
        created.push(await client.interfaceWorkflowRunRoleBinding.create({
          data: { ...binding, organizationId: input.organizationId, runId: input.runId },
          select: { id: true, roleId: true, personId: true, roleDefId: true },
        }));
      }
      return created;
    },
    appendEvents: async (events) => {
      if (events.length === 0) return;
      await client.interfaceWorkflowRunEvent.createMany({
        data: events.map((event) => ({ ...event, payload: event.payload as Prisma.InputJsonValue })),
      });
    },
    updateRunProjection: async (input) => (await client.interfaceWorkflowRun.updateMany({
      where: { id: input.runId, organizationId: input.organizationId, revision: input.expectedRevision },
      data: {
        ...input.data,
        ...(input.data.evidence ? { evidence: input.data.evidence as Prisma.InputJsonValue } : {}),
      },
    })).count === 1,
    createCommand: (data) => client.interfaceWorkflowCommand.create({
      data: { ...data, payload: data.payload as Prisma.InputJsonValue },
      select: runtimeCommandSelect,
    }),
    reclaimCommand: async (input) => {
      const reclaimed = await client.interfaceWorkflowCommand.updateMany({
        where: {
          id: input.commandId,
          organizationId: input.organizationId,
          status: input.expectedStatus,
          updatedAt: input.expectedUpdatedAt,
          ...(input.staleBefore ? { updatedAt: { equals: input.expectedUpdatedAt, lte: input.staleBefore } } : {}),
        },
        data: { status: "PROCESSING", attempts: { increment: 1 }, error: null },
      });
      return reclaimed.count === 1
        ? client.interfaceWorkflowCommand.findFirst({ where: { id: input.commandId, organizationId: input.organizationId }, select: runtimeCommandSelect })
        : null;
    },
    lockCommand: async (input) => {
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "interface_workflow_commands" WHERE "id" = ${input.commandId} AND "organizationId" = ${input.organizationId} FOR UPDATE`);
      return client.interfaceWorkflowCommand.findFirst({ where: { id: input.commandId, organizationId: input.organizationId }, select: runtimeCommandSelect });
    },
    markCommandSucceeded: async (input) => (await client.interfaceWorkflowCommand.updateMany({
        where: { id: input.commandId, organizationId: input.organizationId, status: "PROCESSING", ...(input.leaseToken ? { updatedAt: input.leaseToken } : {}) },
        data: { status: "SUCCEEDED", error: null },
      })).count === 1,
    markCommandFailed: async (input) => (await client.interfaceWorkflowCommand.updateMany({
      where: { id: input.commandId, organizationId: input.organizationId, status: "PROCESSING", updatedAt: input.leaseToken },
      data: { status: "FAILED", error: input.error },
    })).count === 1,
    raiseTension: (input) => raiseTension(client, { ...input, type: "PROBLEMATIC", source: "BOT" }),
    resolveTacticalRoute: (input) => resolveTacticalRoute(client, input),
    authorizeGovernanceCandidate: async (input) => { await authorizeGovernanceCandidateAuthor(client, input); },
    authorizeGovernanceRoute: async (input) => { await authorizeGovernanceRoute(client, input); },
    authorizeGovernanceCandidateReplay: async (input) => {
      if (input.command.status !== "SUCCEEDED") throw new Error("GOVERNANCE_CANDIDATE_REPLAY_FORBIDDEN");
      await authorizeGovernanceCandidateReplayDomain(client, { ...input, command: input.command as GovernanceReplayCommand });
    },
    authorizeGovernanceRouteReplay: async (input) => {
      if (input.command.status !== "SUCCEEDED") throw new Error("GOVERNANCE_ROUTE_REPLAY_FORBIDDEN");
      await authorizeGovernanceRouteReplayDomain(client, { ...input, command: input.command as GovernanceReplayCommand });
    },
    createGovernanceCandidate: (input) => createGovernanceCandidate(client, input),
    routeGovernanceCandidate: (input) => routeGovernanceCandidate(client, input),
    createArtifact: (input) => client.interfaceWorkflowArtifact.create({
      data: { ...input, metadata: input.metadata as Prisma.InputJsonValue },
      select: { id: true },
    }),
    assignWaitingBinding: async (input) => (await client.interfaceWorkflowRunRoleBinding.updateMany({
        where: { id: input.bindingId, organizationId: input.organizationId },
        data: { personId: input.personId, roleDefId: null },
      })).count === 1,
  };
}

const runtimeCommandSelect = {
  id: true,
  organizationId: true,
  runId: true,
  nodeId: true,
  nodeVisit: true,
  kind: true,
  clientIdempotencyKey: true,
  actorId: true,
  payload: true,
  attempts: true,
  status: true,
  error: true,
  updatedAt: true,
} satisfies Prisma.InterfaceWorkflowCommandSelect;

async function readPrismaRun(
  client: PrismaReadClient,
  input: { organizationId: string; runId: string },
): Promise<RuntimeRunSnapshot | null> {
  const row = await client.interfaceWorkflowRun.findFirst({
    where: { id: input.runId, organizationId: input.organizationId },
    select: {
      id: true,
      organizationId: true,
      workbenchId: true,
      versionId: true,
      status: true,
      currentNodeId: true,
      currentNodeVisit: true,
      evidence: true,
      revision: true,
      version: { select: { compiledSnapshot: true } },
      waitingRoleBinding: { select: { id: true, roleId: true, personId: true, roleDefId: true } },
      events: { orderBy: { sequence: "desc" }, take: 1, select: { sequence: true } },
    },
  });
  if (!row) return null;
  return {
    id: row.id,
    organizationId: row.organizationId,
    workbenchId: row.workbenchId,
    versionId: row.versionId,
    workflow: row.version.compiledSnapshot as unknown as RuntimeRunSnapshot["workflow"],
    status: row.status,
    currentNodeId: row.currentNodeId,
    currentNodeVisit: row.currentNodeVisit,
    evidence: row.evidence as RuntimeEvidence,
    revision: row.revision,
    waitingRoleBinding: row.waitingRoleBinding,
    lastEventSequence: row.events[0]?.sequence ?? 0,
  };
}
