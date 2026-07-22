import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { after, before, describe, test } from "node:test";

import {
  authorizeDecisionMutation,
  authorizeSubmitMutation,
  readAuthorizedMutationReplay,
  runAuthorizedMutation,
  storedMutationEnvelope,
  type AuthorizedTacticalOutcomeMutation,
} from "./tactical-outcome-authority";
import { withTacticalOutcomeActionTestDependencies } from "./tactical-outcome-action-dependencies";

type RecordDecisionAction = typeof import("./tactical-outcome-actions").recordTacticalOutcomeDecisionAction;

const require = createRequire(import.meta.url);
let originalServerOnlyModule: NodeJS.Module | undefined;
let serverOnlyPath = "";
let recordTacticalOutcomeDecisionAction: RecordDecisionAction;

before(async () => {
  serverOnlyPath = require.resolve("server-only");
  originalServerOnlyModule = require.cache[serverOnlyPath];
  const serverOnlyShim = new Module(serverOnlyPath);
  serverOnlyShim.filename = serverOnlyPath;
  serverOnlyShim.loaded = true;
  require.cache[serverOnlyPath] = serverOnlyShim;
  ({ recordTacticalOutcomeDecisionAction } = await import("./tactical-outcome-actions"));
});

after(() => {
  if (originalServerOnlyModule) require.cache[serverOnlyPath] = originalServerOnlyModule;
  else delete require.cache[serverOnlyPath];
});

const actions = readFileSync(new URL("./tactical-outcome-actions.ts", import.meta.url), "utf8");
const component = readFileSync(new URL("./tactical-outcome-proposal.tsx", import.meta.url), "utf8");
const domainOperations = readFileSync(new URL("../../../../lib/domain-operations.ts", import.meta.url), "utf8");
const trackerActions = readFileSync(new URL("../../tracker/actions.ts", import.meta.url), "utf8");
const trackerEditAction = readFileSync(new URL("../../tracker/[id]/edit-action.ts", import.meta.url), "utf8");

type Proposal = {
  id: string;
  organizationId: string;
  tensionId: string;
  proposerId: string;
  meetingId: string;
  revision: number;
  status: "PROPOSED" | "RETURNED" | "REJECTED" | "APPROVED";
  lastMutationKey: string | null;
  lastMutationResult: unknown;
};

type Meeting = {
  id: string;
  organizationId: string;
  type: "TACTICAL" | "GOVERNANCE";
  participantIds: string[];
};

type SubmitInput = {
  organizationId: string;
  actorId: string;
  tensionId: string;
  tensionRaiserId: string;
  meetingId: string;
  expectedRevision: number;
  mutationKey: string;
  payload: Record<string, unknown>;
};

type DecisionInput = {
  organizationId: string;
  actorId: string;
  proposalId: string;
  meetingId: string;
  expectedRevision: number;
  mutationKey: string;
  decision: "APPROVED" | "RETURNED" | "REJECTED";
  note: string;
};

class BehavioralStore {
  writes: string[] = [];
  proposals: Proposal[] = [];
  meetings: Meeting[] = [
    { id: "meeting-selected", organizationId: "org-a", type: "TACTICAL", participantIds: ["proposer", "participant"] },
    { id: "meeting-wrong", organizationId: "org-a", type: "TACTICAL", participantIds: ["proposer", "participant"] },
    { id: "meeting-without-proposer", organizationId: "org-a", type: "TACTICAL", participantIds: ["participant"] },
  ];

  async submit(input: SubmitInput) {
    return runAuthorizedMutation({
      authorize: async () => {
        const existing = this.proposals.find((proposal) => proposal.organizationId === input.organizationId && proposal.tensionId === input.tensionId) ?? null;
        const meeting = this.meetings.find((candidate) => candidate.id === input.meetingId && candidate.organizationId === input.organizationId && candidate.type === "TACTICAL");
        const authorization = authorizeSubmitMutation({
          organizationId: input.organizationId,
          actorId: input.actorId,
          meetingId: input.meetingId,
          subjectId: input.tensionId,
          expectedRevision: input.expectedRevision,
          mutationKey: input.mutationKey,
          payload: input.payload,
          tensionRaiserId: input.tensionRaiserId,
          existingProposerId: existing?.proposerId ?? null,
          isSelectedTacticalMeetingParticipant: meeting?.participantIds.includes(input.actorId) === true,
        });
        return { authorization, context: { existing } };
      },
      replay: async ({ authorization, context }) => this.replay(input.organizationId, input.mutationKey, context.existing?.id ?? null, authorization),
      validateFresh: ({ context }) => {
        if (!context.existing && input.expectedRevision !== 0) throw new Error("STALE_REVISION");
        if (context.existing && context.existing.revision !== input.expectedRevision) throw new Error("STALE_REVISION");
      },
      mutate: async ({ authorization, context }) => {
        this.requireTenantUnusedKey(input.organizationId, input.mutationKey, context.existing?.id ?? null);
        const result = { ok: true, proposalId: context.existing?.id ?? `proposal-${this.proposals.length + 1}`, revision: context.existing ? context.existing.revision + 1 : 1, status: "PROPOSED" };
        this.writes.push("proposal");
        if (context.existing) {
          Object.assign(context.existing, { revision: result.revision, status: "PROPOSED", lastMutationKey: input.mutationKey, lastMutationResult: storedMutationEnvelope(authorization, result) });
        } else {
          this.proposals.push({ id: result.proposalId, organizationId: input.organizationId, tensionId: input.tensionId, proposerId: input.actorId, meetingId: input.meetingId, revision: 1, status: "PROPOSED", lastMutationKey: input.mutationKey, lastMutationResult: storedMutationEnvelope(authorization, result) });
        }
        return result;
      },
    });
  }

  async decide(input: DecisionInput) {
    return runAuthorizedMutation({
      authorize: async () => {
        const proposal = this.proposals.find((candidate) => candidate.id === input.proposalId && candidate.organizationId === input.organizationId);
        if (!proposal) throw new Error("PROPOSAL_NOT_FOUND");
        const meeting = this.meetings.find((candidate) => candidate.id === input.meetingId && candidate.organizationId === input.organizationId && candidate.type === "TACTICAL");
        const authorization = authorizeDecisionMutation({
          organizationId: input.organizationId,
          actorId: input.actorId,
          meetingId: input.meetingId,
          subjectId: input.proposalId,
          expectedRevision: input.expectedRevision,
          mutationKey: input.mutationKey,
          payload: { decision: input.decision, note: input.note },
          proposalMeetingId: proposal.meetingId,
          isSelectedTacticalMeetingParticipant: meeting?.participantIds.includes(input.actorId) === true,
        });
        return { authorization, context: { proposal } };
      },
      replay: async ({ authorization, context }) => this.replay(input.organizationId, input.mutationKey, context.proposal.id, authorization),
      validateFresh: ({ context }) => {
        if (context.proposal.status !== "PROPOSED" || context.proposal.revision !== input.expectedRevision) throw new Error("STALE_REVISION");
      },
      mutate: async ({ authorization, context }) => {
        this.requireTenantUnusedKey(input.organizationId, input.mutationKey, context.proposal.id);
        const result = { ok: true, proposalId: context.proposal.id, revision: context.proposal.revision, status: input.decision };
        this.writes.push("decision");
        Object.assign(context.proposal, { status: input.decision, lastMutationKey: input.mutationKey, lastMutationResult: storedMutationEnvelope(authorization, result) });
        return result;
      },
    });
  }

  private async replay(organizationId: string, mutationKey: string, subjectProposalId: string | null, authorization: AuthorizedTacticalOutcomeMutation) {
    const duplicate = this.proposals.find((proposal) => proposal.organizationId === organizationId && proposal.lastMutationKey === mutationKey);
    if (!duplicate) return null;
    if (duplicate.id !== subjectProposalId) throw new Error("KEY_USED_BY_OTHER_PROPOSAL");
    return readAuthorizedMutationReplay(authorization, duplicate.lastMutationKey, duplicate.lastMutationResult) as Record<string, unknown>;
  }

  private requireTenantUnusedKey(organizationId: string, mutationKey: string, subjectProposalId: string | null) {
    const duplicate = this.proposals.find((proposal) => proposal.organizationId === organizationId && proposal.lastMutationKey === mutationKey && proposal.id !== subjectProposalId);
    if (duplicate) throw new Error("TENANT_KEY_CONFLICT");
  }
}

const projectPayload = { kind: "PROJECT", title: "Publish model card", expectedResult: "Model card is public", acceptanceCriteria: null, circleId: "circle-a", responsiblePersonId: "owner", deadline: null };

function proposal(store: BehavioralStore, overrides: Partial<Proposal> = {}): Proposal {
  const value: Proposal = { id: "proposal-1", organizationId: "org-a", tensionId: "tension-1", proposerId: "proposer", meetingId: "meeting-selected", revision: 1, status: "PROPOSED", lastMutationKey: null, lastMutationResult: null, ...overrides };
  store.proposals.push(value);
  return value;
}

describe("G3-I2C-2B behavioral authority and idempotency", () => {
  test("a proposer who participated submits, while a nonparticipant proposer and wrong proposer produce zero writes", async () => {
    const allowed = new BehavioralStore();
    const result = await allowed.submit({ organizationId: "org-a", actorId: "proposer", tensionId: "tension-1", tensionRaiserId: "proposer", meetingId: "meeting-selected", expectedRevision: 0, mutationKey: "submit-allowed", payload: projectPayload });
    assert.equal(result.status, "PROPOSED");
    assert.deepEqual(allowed.writes, ["proposal"]);

    const nonparticipant = new BehavioralStore();
    await assert.rejects(nonparticipant.submit({ organizationId: "org-a", actorId: "proposer", tensionId: "tension-1", tensionRaiserId: "proposer", meetingId: "meeting-without-proposer", expectedRevision: 0, mutationKey: "submit-denied", payload: projectPayload }), /实际参与人/);
    assert.deepEqual(nonparticipant.writes, []);

    const wrongProposer = new BehavioralStore();
    await assert.rejects(wrongProposer.submit({ organizationId: "org-a", actorId: "participant", tensionId: "tension-1", tensionRaiserId: "proposer", meetingId: "meeting-selected", expectedRevision: 0, mutationKey: "submit-wrong", payload: projectPayload }), /张力提出人/);
    assert.deepEqual(wrongProposer.writes, []);
  });

  test("the proposer and another selected-meeting participant can each record approval", async () => {
    for (const actorId of ["proposer", "participant"]) {
      const store = new BehavioralStore();
      proposal(store);
      const result = await store.decide({ organizationId: "org-a", actorId, proposalId: "proposal-1", meetingId: "meeting-selected", expectedRevision: 1, mutationKey: `approve-${actorId}`, decision: "APPROVED", note: "" });
      assert.equal(result.status, "APPROVED");
      assert.deepEqual(store.writes, ["decision"]);
    }
  });

  test("duplicate replay still denies a same-org nonparticipant, wrong meeting, and cross-tenant actor with zero writes", async () => {
    const store = new BehavioralStore();
    proposal(store);
    const request = { organizationId: "org-a", actorId: "proposer", proposalId: "proposal-1", meetingId: "meeting-selected", expectedRevision: 1, mutationKey: "decision-duplicate", decision: "APPROVED" as const, note: "" };
    await store.decide(request);
    const before = [...store.writes];

    await assert.rejects(store.decide({ ...request, actorId: "outsider" }), /实际参与人/);
    assert.deepEqual(store.writes, before);
    await assert.rejects(store.decide({ ...request, meetingId: "meeting-wrong" }), /会议与提案/);
    assert.deepEqual(store.writes, before);
    await assert.rejects(store.decide({ ...request, organizationId: "org-b", actorId: "cross-tenant" }), /PROPOSAL_NOT_FOUND/);
    assert.deepEqual(store.writes, before);
  });

  test("the same key is bound to decision, note, and submitted payload, while an identical request replays", async () => {
    const decisions = new BehavioralStore();
    proposal(decisions);
    const request = { organizationId: "org-a", actorId: "proposer", proposalId: "proposal-1", meetingId: "meeting-selected", expectedRevision: 1, mutationKey: "bound-decision", decision: "RETURNED" as const, note: "Add evidence" };
    const first = await decisions.decide(request);
    const writes = [...decisions.writes];
    assert.deepEqual(await decisions.decide(request), first);
    assert.deepEqual(decisions.writes, writes);
    await assert.rejects(decisions.decide({ ...request, decision: "REJECTED" }), /原请求不一致/);
    await assert.rejects(decisions.decide({ ...request, note: "Different note" }), /原请求不一致/);
    assert.deepEqual(decisions.writes, writes);

    const submissions = new BehavioralStore();
    const submit = { organizationId: "org-a", actorId: "proposer", tensionId: "tension-1", tensionRaiserId: "proposer", meetingId: "meeting-selected", expectedRevision: 0, mutationKey: "bound-submit", payload: projectPayload };
    await submissions.submit(submit);
    const submitWrites = [...submissions.writes];
    await assert.rejects(submissions.submit({ ...submit, payload: { ...projectPayload, title: "Changed title" } }), /原请求不一致/);
    assert.deepEqual(submissions.writes, submitWrites);
  });

  test("the same key is allowed across tenants but conflicts across proposals in one tenant", async () => {
    const crossTenant = new BehavioralStore();
    proposal(crossTenant, { id: "foreign-proposal", organizationId: "org-b", tensionId: "foreign-tension", lastMutationKey: "shared-key", lastMutationResult: {} });
    const result = await crossTenant.submit({ organizationId: "org-a", actorId: "proposer", tensionId: "tension-1", tensionRaiserId: "proposer", meetingId: "meeting-selected", expectedRevision: 0, mutationKey: "shared-key", payload: projectPayload });
    assert.equal(result.status, "PROPOSED");
    assert.deepEqual(crossTenant.writes, ["proposal"]);

    const sameTenant = new BehavioralStore();
    proposal(sameTenant, { id: "other-proposal", tensionId: "other-tension", lastMutationKey: "same-org-key", lastMutationResult: {} });
    await assert.rejects(sameTenant.submit({ organizationId: "org-a", actorId: "proposer", tensionId: "tension-1", tensionRaiserId: "proposer", meetingId: "meeting-selected", expectedRevision: 0, mutationKey: "same-org-key", payload: projectPayload }), /KEY_USED_BY_OTHER_PROPOSAL/);
    assert.deepEqual(sameTenant.writes, []);
  });

  test("stale revision is rejected before writes", async () => {
    const stale = new BehavioralStore();
    proposal(stale);
    await assert.rejects(stale.decide({ organizationId: "org-a", actorId: "proposer", proposalId: "proposal-1", meetingId: "meeting-selected", expectedRevision: 2, mutationKey: "stale", decision: "APPROVED", note: "" }), /STALE_REVISION/);
    assert.deepEqual(stale.writes, []);
  });
});

describe("G3-I2C-2B integration boundaries", () => {
  test("ordinary proposals use confirmed tactical mode while runtime proposals retain exact route validation", () => {
    assert.match(actions, /submitTacticalOutcomeProposal\(tx/);
    assert.match(domainOperations, /handlingMode !== "TACTICAL"/);
    assert.match(domainOperations, /kind: "ORDINARY_TENSION", route: null/);
    assert.match(domainOperations, /if \(runtimeSource\)[\s\S]+kind: "INTERFACE_RUN", route: await findExactTacticalRoute/);
    assert.match(actions, /revalidateProposalProvenance/);
    assert.match(domainOperations, /if \(context\.provenance\.route\)[\s\S]+appendTacticalOutcomeEvents/);
  });
  test("the Server Actions scope mutation-key lookup to the authenticated organization", () => {
    assert.doesNotMatch(actions, /where: \{ lastMutationKey: mutationKey \}/);
    assert.match(actions, /organizationId_lastMutationKey: \{ organizationId, lastMutationKey: mutationKey \}/);
    assert.match(actions, /participants: \{ some: \{ id: actor\.id \} \}/);
  });

  test("decision input cannot rewrite stored proposal fields and notes are required for return or rejection", () => {
    const decisionSection = actions.slice(actions.indexOf("export async function recordTacticalOutcomeDecisionAction"));
    assert.doesNotMatch(decisionSection, /formData, "(?:kind|title|expectedResult|acceptanceCriteria|circleId|responsiblePersonId|deadline)"/);
    assert.match(decisionSection, /\(decision === "RETURNED" \|\| decision === "REJECTED"\) && !note/);
  });

  test("approval locks, revalidates, claims, and creates outcome, artifact, and events atomically", () => {
    assert.match(actions, /FOR UPDATE/);
    assert.match(actions, /revalidateStoredRoute/);
    assert.match(actions, /status: "PROPOSED", revision: expectedRevision, outcomeProjectId: null, outcomeActionId: null/);
    assert.match(actions, /relation: `tactical-outcome:\$\{proposal\.id\}`/);
    assert.match(actions, /TACTICAL_OUTCOME_MEETING_DECISION/);
    assert.match(actions, /TACTICAL_OUTCOME_CREATED/);
    assert.match(actions, /TransactionIsolationLevel\.Serializable/);
  });

  test("Tracker actions retain the approved-proposal owner boundary", () => {
    assert.match(trackerActions, /authorizeTrackerTensionMutation/);
    assert.match(trackerEditAction, /authorizeTrackerTensionMutation/);
    assert.match(trackerActions, /actorId: actor\.id/);
    assert.match(trackerEditAction, /actorId: actor\.id/);
    assert.doesNotMatch(trackerActions, /canManageTension/);
    assert.doesNotMatch(trackerEditAction, /requireManageTension/);
  });

  test("proposal authoring and decisions require selected-meeting participation in the UI", () => {
    assert.match(component, /!isProposer \|\| !isMeetingParticipant/);
    assert.match(component, /记录会议通过并创建/);
    assert.match(component, /退回修改/);
    assert.match(component, /记录不采纳/);
    assert.match(component, /sm:grid-cols-2/);
    assert.doesNotMatch(component, />[^<]*(?:artifact|command|node|revision|runId)[^<]*</i);
  });

  test("a single available circle is preselected for a low-friction ordinary proposal", () => {
    assert.match(component, /circles\.length === 1 \? circles\[0\]\.id : ""/);
  });
});

function decisionForm(): FormData {
  const formData = new FormData();
  formData.set("decision", "RETURNED");
  formData.set("note", "Add evidence");
  formData.set("mutationKey", "decision-key");
  formData.set("expectedRevision", "1");
  return formData;
}

function decisionHarness(lifecycleStatus: "SETUP" | "ACTIVE" | null) {
  const calls = { lifecycleReads: 0, downstreamReads: 0, isolationLevel: "" };
  const tx = {
    organization: {
      findUnique: async () => {
        calls.lifecycleReads += 1;
        return lifecycleStatus === null ? null : { lifecycleStatus };
      },
    },
    $queryRaw: async () => {
      calls.downstreamReads += 1;
      throw new Error("ACTIVE_DOWNSTREAM_SENTINEL");
    },
  };
  return {
    calls,
    dependencies: {
      prisma: {
        $transaction: async (
          work: (transaction: typeof tx) => Promise<unknown>,
          options: { isolationLevel: string },
        ) => {
          calls.isolationLevel = options.isolationLevel;
          return work(tx);
        },
        tacticalOutcomeProposal: { findFirst: async () => null },
      },
      getCurrentOrgId: async () => "org-a",
      getCurrentPerson: async () => ({ id: "person-1", organizationId: "org-a" }),
      revalidatePath: () => undefined,
    },
  };
}

describe("recordTacticalOutcomeDecisionAction lifecycle gate", () => {
  for (const [label, lifecycleStatus] of [["SETUP", "SETUP"], ["missing", null]] as const) {
    test(`${label} organization is denied before proposal, outcome, notification, or event work`, async () => {
      const harness = decisionHarness(lifecycleStatus);
      const result = await withTacticalOutcomeActionTestDependencies(
        harness.dependencies,
        () => recordTacticalOutcomeDecisionAction("proposal-1", "meeting-1", null, decisionForm()),
      );

      assert.deepEqual(result, { error: "组织尚未启用，不能进行会议操作" });
      assert.equal(harness.calls.lifecycleReads, 1);
      assert.equal(harness.calls.isolationLevel, "Serializable");
      assert.equal(harness.calls.downstreamReads, 0);
    });
  }

  test("ACTIVE passes the lifecycle gate and reaches the unchanged decision path", async () => {
    const harness = decisionHarness("ACTIVE");
    const result = await withTacticalOutcomeActionTestDependencies(
      harness.dependencies,
      () => recordTacticalOutcomeDecisionAction("proposal-1", "meeting-1", null, decisionForm()),
    );

    assert.deepEqual(result, { error: "记录会议结果失败，请重试" });
    assert.equal(harness.calls.lifecycleReads, 1);
    assert.equal(harness.calls.isolationLevel, "Serializable");
    assert.equal(harness.calls.downstreamReads, 1);
  });
});
