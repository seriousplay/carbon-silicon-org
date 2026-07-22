import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { executeSideEffectAction } from "@/app/app/interfaces/runs/[runId]/actions";
import {
  canAccessGovernanceRouteOnlyPage,
  persistedGovernanceRouteCommandKey,
  withInterfaceRunActionTestDependencies,
} from "@/app/app/interfaces/runs/[runId]/governance-route-boundary";
import { RunWorkspace } from "@/app/app/interfaces/runs/[runId]/run-workspace";
import type { AdvanceWorkflowRunInput, AdvanceWorkflowRunResult } from "@/lib/interface-workbench/runtime-types";

const organizationId = "org-a";
const runId = "run-a";
const meetingId = "meeting-a";
const proposalArtifactId = "proposal-artifact-a";
const participantId = "participant-no-interface-support";
const firstKey = "18ccbc75-d6f1-4b0a-b25d-127dfa945ca4";

class RedirectSignal extends Error {
  constructor(readonly destination: string) {
    super(destination);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fixture(actorId: string) {
  const selectedParticipants = new Set(["proposer", participantId]);
  const actorRoleIds = actorId === "coach" ? ["coach-role"] : [];
  const membershipRole = actorId === "admin" ? "ORG_ADMIN" : "ORG_MEMBER";
  const candidatePayload = {
    confirmed: true,
    sourceTensionArtifactId: "source-artifact-a",
    structuralCategory: "ACCOUNTABILITY",
    currentStructure: "Current",
    proposedStructure: "Proposed",
    rationale: "Rationale",
    expectedImpact: "Impact",
  };
  const candidateCommand = {
    id: "candidate-command-a",
    nodeId: "candidate",
    nodeVisit: 1,
    kind: "EXECUTE_SIDE_EFFECT",
    clientIdempotencyKey: "e8e8753e-8017-45e7-b22d-8af6dd6d5478",
    actorId: "proposer",
    payload: candidatePayload,
    status: "SUCCEEDED",
  };
  const run = {
    id: runId,
    status: "ACTIVE",
    revision: 1,
    currentNodeId: "route",
    version: { compiledSnapshot: { nodes: [{ id: "route", type: "route_governance_meeting", config: { roleId: "operator" } }] } },
    roleBindings: [],
    waitingRoleBinding: null,
    workbench: { interface: {
      organizationId,
      ownerId: "proposer",
      fromCircle: { leadPersonId: "lead" },
      toCircle: { leadPersonId: null },
      supportPeople: [{ id: "runtime-support" }],
      supportRoles: [{ id: "coach-role" }],
    } },
  };
  let failedRouteKey: string | null = null;
  let writes = 0;
  const advanceInputs: AdvanceWorkflowRunInput[] = [];
  const revalidated: string[] = [];

  const prisma = {
    membership: { findUnique: async () => ({ role: membershipRole }) },
    roleDef: { findMany: async () => actorRoleIds.map((id) => ({ id })) },
    interfaceWorkflowRun: { findFirst: async () => run },
    interfaceWorkflowCommand: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id === candidateCommand.id) return candidateCommand;
        return typeof where.clientIdempotencyKey === "string" && where.clientIdempotencyKey === failedRouteKey ? { nodeId: "route" } : null;
      },
    },
    interfaceWorkflowArtifact: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        if (where.id === proposalArtifactId) return {
          id: proposalArtifactId,
          artifactId: "proposal-a",
          relation: `governance-candidate:${candidateCommand.id}`,
          metadata: {
            schemaVersion: 1,
            commandId: candidateCommand.id,
            nodeId: candidateCommand.nodeId,
            nodeVisit: candidateCommand.nodeVisit,
            runId,
            revision: 0,
            sourceTensionArtifactId: "source-artifact-a",
            tensionId: "tension-a",
            proposalId: "proposal-a",
            proposerId: "proposer",
          },
        };
        if (where.id === "source-artifact-a") return { id: "source-artifact-a", artifactId: "tension-a" };
        return null;
      },
    },
    governanceProposal: {
      findFirst: async () => ({
        id: "proposal-a",
        tensionId: "tension-a",
        meetingId: null,
        type: "ACCOUNTABILITY",
        proposedChange: JSON.stringify({ schemaVersion: 1, structuralCategory: "ACCOUNTABILITY", currentStructure: "Current", proposedStructure: "Proposed", expectedImpact: "Impact" }),
        rationale: "Rationale",
        tension: { raiserId: "proposer", status: "OPEN" },
      }),
    },
    meeting: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => {
        const conditions = Array.isArray(where.AND) ? where.AND : [];
        const required = conditions.flatMap((condition) => {
          if (!isRecord(condition) || !isRecord(condition.participants) || !isRecord(condition.participants.some)) return [];
          return typeof condition.participants.some.id === "string" ? [condition.participants.some.id] : [];
        });
        return where.id === meetingId && where.organizationId === organizationId && where.type === "GOVERNANCE" && required.every((id) => selectedParticipants.has(id)) ? { id: meetingId } : null;
      },
    },
  };

  const dependencies = {
    prisma,
    requireSession: async () => ({ user: { id: `user-${actorId}` } }),
    getCurrentPerson: async () => ({ id: actorId, organizationId }),
    advanceWorkflowRun: async (input: AdvanceWorkflowRunInput): Promise<AdvanceWorkflowRunResult> => {
      advanceInputs.push(input);
      writes += 1;
      if (failedRouteKey === null) {
        failedRouteKey = input.clientIdempotencyKey;
        return { ok: false, error: "SIDE_EFFECT_FAILED", commandId: "route-command-a" };
      }
      return input.clientIdempotencyKey === failedRouteKey
        ? { ok: true, commandId: "route-command-a", artifactId: "route-artifact-a" }
        : { ok: false, error: "FORBIDDEN" };
    },
    createPrismaRuntimeDependencies: () => ({}),
    takeOverWorkflowRun: async () => ({ ok: false, error: "NOT_WAITING" }),
    revalidatePath: (path: string) => { revalidated.push(path); },
    redirect: (destination: string): never => { throw new RedirectSignal(destination); },
  };

  return {
    actorId,
    actorRoleIds,
    membershipRole,
    run,
    dependencies,
    advanceInputs,
    revalidated,
    get failedRouteKey() { return failedRouteKey; },
    get writes() { return writes; },
  };
}

function routeForm(idempotencyKey: string): FormData {
  const formData = new FormData();
  formData.set("expectedRevision", "1");
  formData.set("idempotencyKey", idempotencyKey);
  formData.set("meetingId", meetingId);
  formData.set("proposalArtifactId", proposalArtifactId);
  formData.set("confirmed", "yes");
  return formData;
}

async function invokeAction(testFixture: ReturnType<typeof fixture>, idempotencyKey: string): Promise<string> {
  try {
    await withInterfaceRunActionTestDependencies(testFixture.dependencies, () => executeSideEffectAction(runId, routeForm(idempotencyKey)));
    assert.fail("executeSideEffectAction must redirect");
  } catch (error) {
    if (error instanceof RedirectSignal) return error.destination;
    throw error;
  }
}

describe("discovered executeSideEffectAction governance boundary", () => {
  test("participant without interface support retries the actual action with the failed command key persisted by rerender", async () => {
    const testFixture = fixture(participantId);
    assert.equal(testFixture.membershipRole, "ORG_MEMBER");
    assert.deepEqual(testFixture.actorRoleIds, []);
    assert.notEqual(testFixture.run.workbench.interface.ownerId, participantId);
    assert.notEqual(testFixture.run.workbench.interface.fromCircle.leadPersonId, participantId);
    assert.equal(testFixture.run.workbench.interface.supportPeople.some((person) => person.id === participantId), false);
    assert.equal(canAccessGovernanceRouteOnlyPage({ canViewFullRun: false, nodeType: "route_governance_meeting", eligibleMeetingCount: 1 }), true);

    assert.equal(await invokeAction(testFixture, firstKey), `/app/interfaces/runs/${runId}?message=retry`);
    assert.equal(testFixture.failedRouteKey, firstKey);

    const persistedKey = persistedGovernanceRouteCommandKey({
      nodeType: "route_governance_meeting",
      currentNodeId: "route",
      currentNodeVisit: 2,
      commands: [{ nodeId: "route", nodeVisit: 2, kind: "EXECUTE_SIDE_EFFECT", status: "FAILED", clientIdempotencyKey: testFixture.failedRouteKey! }],
    });
    assert.equal(persistedKey, firstKey);
    const markup = renderToStaticMarkup(createElement(RunWorkspace, {
      routeOnly: true,
      retryIdempotencyKey: persistedKey,
      run: { id: runId, status: "ACTIVE", revision: 1, evidence: {}, interfaceName: "Route", fromCircleName: "From", toCircleName: "To", version: 1, contractContent: "Contract", acceptanceCriteria: "Acceptance" },
      node: { type: "route_governance_meeting", prompt: null, request: null, fields: [], outcome: null, reason: null },
      responsibility: null,
      canAct: true,
      canTakeOver: false,
      events: [],
      commands: [],
      artifacts: [{ id: proposalArtifactId, artifactType: "GOVERNANCE_PROPOSAL", artifactId: "proposal-a", relation: "governance-candidate:candidate-command-a", createdAt: new Date("2026-07-11T00:00:00Z"), href: "/app/tensions/tension-a", label: "Candidate" }],
      tacticalMeetings: [],
      governanceMeetings: [{ id: meetingId, title: "Selected governance", startedAt: new Date("2026-07-11T00:00:00Z") }],
    }));
    assert.match(markup, new RegExp(`name="idempotencyKey" value="${firstKey}"`));

    assert.equal(await invokeAction(testFixture, persistedKey!), `/app/meetings/${meetingId}`);
    assert.deepEqual(testFixture.advanceInputs.map((input) => input.clientIdempotencyKey), [firstKey, firstKey]);
    assert.equal(testFixture.writes, 2);
    assert.deepEqual(testFixture.revalidated, [`/app/interfaces/runs/${runId}`, "/app/interfaces/runs", `/app/interfaces/runs/${runId}`, "/app/interfaces/runs"]);
  });

  test("nonparticipant and admin, coach, or lead title-only actors are denied by the actual action before writes", async () => {
    for (const actorId of ["nonparticipant", "admin", "coach", "lead"]) {
      const testFixture = fixture(actorId);
      if (actorId === "admin") assert.equal(testFixture.membershipRole, "ORG_ADMIN");
      if (actorId === "coach") assert.deepEqual(testFixture.actorRoleIds, ["coach-role"]);
      if (actorId === "lead") assert.equal(testFixture.run.workbench.interface.fromCircle.leadPersonId, actorId);
      assert.equal(await invokeAction(testFixture, firstKey), `/app/interfaces/runs/${runId}?message=denied`);
      assert.equal(testFixture.writes, 0);
      assert.deepEqual(testFixture.advanceInputs, []);
    }
  });
});
