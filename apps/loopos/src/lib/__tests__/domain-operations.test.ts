import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  authorizeGovernanceCandidateReplay,
  authorizeGovernanceRoute,
  authorizeGovernanceRouteReplay,
  authorizeMeetingTensionMutation,
  authorizeManualProjectSource,
  authorizeTrackerTensionMutation,
  classifyTensionProvenance,
  convertOrdinaryTensionToGovernanceDecision,
  DomainOperationError,
  hasExactOpenTacticalRoute,
  listGovernanceRouteMeetings,
  raiseTension,
  resolveGovernanceCandidateArtifact,
  resolveGovernanceCandidatesRoutedToMeeting,
  resolveRoutedGovernanceCandidateForDecision,
  resolveOpenTensionsRoutedToMeeting,
  resolveTacticalRoute,
  routeGovernanceCandidate,
  submitTacticalOutcomeProposal,
  updateMeetingNotes,
} from "../domain-operations";
import { MEETING_LIFECYCLE_DENIAL_CODE } from "../organization-setup/meeting-lifecycle-policy";

type Artifact = { id: string; organizationId: string; runId: string; artifactType: string; artifactId: string; relation: string; metadata: unknown; createdAt: Date };

function fakeDomain() {
  const people = [{ id: "person-a", organizationId: "org-a" }];
  const circles = [{ id: "circle-a", organizationId: "org-a" }, { id: "circle-b", organizationId: "org-b" }];
  const meetings = [
    { id: "meeting-a", organizationId: "org-a", type: "TACTICAL", endedAt: null as Date | null, notes: null as string | null, notesRevision: 0, participants: [{ id: "person-a" }] },
    { id: "meeting-other", organizationId: "org-a", type: "TACTICAL", endedAt: null as Date | null, notes: null as string | null, notesRevision: 0, participants: [] },
    { id: "meeting-ended", organizationId: "org-a", type: "TACTICAL", endedAt: new Date("2026-07-15T12:00:00Z") as Date | null, notes: null as string | null, notesRevision: 0, participants: [{ id: "person-a" }] },
    { id: "meeting-gov", organizationId: "org-a", type: "GOVERNANCE", endedAt: null as Date | null, notes: null as string | null, notesRevision: 0, participants: [{ id: "person-a" }] },
    { id: "meeting-b", organizationId: "org-b", type: "TACTICAL", endedAt: null as Date | null, notes: null as string | null, notesRevision: 0, participants: [{ id: "person-b" }] },
  ];
  const runs = [{ id: "run-a", organizationId: "org-a" }, { id: "run-b", organizationId: "org-b" }];
  const tensions: Array<{ id: string; organizationId: string; status: string; ownerId?: string | null }> = [];
  const artifacts: Artifact[] = [];
  const decisions: Array<{ id: string; organizationId: string; meetingId: string; tensionId?: string }> = [];
  const proposals: Array<{ id: string; organizationId: string; tensionId: string; status: string; kind: string; outcomeActionId: string | null }> = [];
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>): boolean => Object.entries(where).every(([key, value]) => {
    if (key === "relation" && typeof value === "object" && value && "startsWith" in value) return String(row[key]).startsWith(String((value as { startsWith: string }).startsWith));
    return row[key] === value;
  });
  const client = {
    person: { findFirst: async ({ where }: { where: Record<string, unknown> }) => people.find((row) => matches(row, where)) ?? null },
    circle: { findMany: async ({ where }: { where: { id: { in: string[] }; organizationId: string } }) => circles.filter((row) => where.id.in.includes(row.id) && row.organizationId === where.organizationId) },
    meeting: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => meetings.find((row) => matches(row, where)) ?? null,
      updateMany: async ({ where, data }: { where: { id: string; organizationId: string; notesRevision: number; endedAt: null; participants: { some: { id: string } } }; data: { notes: string; notesRevision: { increment: number } } }) => {
        const row = meetings.find((candidate) =>
          candidate.id === where.id &&
          candidate.organizationId === where.organizationId &&
          candidate.notesRevision === where.notesRevision &&
          candidate.endedAt === where.endedAt &&
          candidate.participants.some((participant) => participant.id === where.participants.some.id)
        );
        if (!row) return { count: 0 };
        row.notes = data.notes;
        row.notesRevision += data.notesRevision.increment;
        return { count: 1 };
      },
    },
    tension: {
      create: async ({ data }: { data: { organizationId: string } }) => { const row = { id: `tension-${tensions.length + 1}`, organizationId: data.organizationId, status: "OPEN" }; tensions.push(row); return { id: row.id }; },
      findFirst: async ({ where }: { where: Record<string, unknown> }) => tensions.find((row) => matches(row, where)) ?? null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: { status: string } }) => { const row = tensions.find((candidate) => matches(candidate, where)); if (!row) return { count: 0 }; row.status = data.status; return { count: 1 }; },
    },
    interfaceWorkflowArtifact: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => artifacts.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where }: { where: Record<string, unknown> }) => artifacts.filter((row) => matches(row, where)),
    },
    interfaceWorkflowRun: { findFirst: async ({ where }: { where: Record<string, unknown> }) => runs.find((row) => matches(row, where)) ?? null },
    tacticalOutcomeProposal: { findFirst: async ({ where }: { where: Record<string, unknown> }) => proposals.find((row) => matches(row, where)) ?? null },
    decisionRecord: { create: async ({ data }: { data: { organizationId: string; meetingId: string } }) => { const row = { id: `decision-${decisions.length + 1}`, organizationId: data.organizationId, meetingId: data.meetingId }; decisions.push(row); return { id: row.id }; } },
  };
  return { client: client as never, tensions, artifacts, decisions, proposals, meetings };
}

describe("organization-scoped domain operations", () => {
  test("tactical outcome proposal denies SETUP and missing organizations before downstream reads or writes", async () => {
    for (const lifecycleStatus of ["SETUP", null] as const) {
      let downstreamCalls = 0;
      const unavailable = async () => {
        downstreamCalls += 1;
        return null;
      };
      const client = {
        organization: {
          findUnique: async () => lifecycleStatus === null ? null : { lifecycleStatus },
        },
        tension: { findFirst: unavailable },
        meeting: { findFirst: unavailable },
        circle: { findFirst: unavailable },
        person: { findFirst: unavailable },
        tacticalOutcomeProposal: { findFirst: unavailable },
      };

      await assert.rejects(
        submitTacticalOutcomeProposal(client as never, {
          organizationId: "org-a",
          actorId: "person-a",
          tensionId: "tension-a",
          meetingId: "meeting-a",
          expectedRevision: 0,
          mutationKey: "proposal-key",
          kind: "PROJECT",
          title: "Project",
          description: "Expected result",
          circleId: "circle-a",
          responsiblePersonId: "person-a",
          deadline: null,
        }),
        (error: unknown) => error instanceof DomainOperationError && error.code === MEETING_LIFECYCLE_DENIAL_CODE,
      );
      assert.equal(downstreamCalls, 0);
    }
  });

  test("tactical outcome proposal preserves ACTIVE downstream behavior", async () => {
    const unavailable = async () => null;
    const client = {
      organization: { findUnique: async () => ({ lifecycleStatus: "ACTIVE" }) },
      tension: { findFirst: unavailable },
      meeting: { findFirst: unavailable },
      circle: { findFirst: unavailable },
      person: { findFirst: unavailable },
      tacticalOutcomeProposal: { findFirst: unavailable },
    };

    await assert.rejects(
      submitTacticalOutcomeProposal(client as never, {
        organizationId: "org-a",
        actorId: "person-a",
        tensionId: "missing-tension",
        meetingId: "meeting-a",
        expectedRevision: 0,
        mutationKey: "active-key",
        kind: "PROJECT",
        title: "Project",
        description: "Expected result",
        circleId: "circle-a",
        responsiblePersonId: "person-a",
        deadline: null,
      }),
      (error: unknown) => error instanceof DomainOperationError && error.code === "TACTICAL_TENSION_NOT_AVAILABLE",
    );
  });

  test("raiseTension rejects cross-tenant circle ids", async () => {
    const fixture = fakeDomain();
    await assert.rejects(
      raiseTension(fixture.client, { organizationId: "org-a", raiserId: "person-a", title: "T", description: "D", type: "PROBLEMATIC", source: "FORM", circleIds: ["circle-b"] }),
      (error: unknown) => error instanceof DomainOperationError && error.code === "CIRCLE_NOT_FOUND",
    );
    assert.equal(fixture.tensions.length, 0);
  });

  test("updateMeetingNotes requires exact participant, unended meeting, and notes revision", async () => {
    const fixture = fakeDomain();
    assert.deepEqual(
      await updateMeetingNotes(fixture.client, {
        organizationId: "org-a",
        actorId: "person-a",
        meetingId: "meeting-a",
        expectedNotesRevision: 0,
        notes: " Updated notes ",
      }),
      { ok: true, meetingId: "meeting-a", notesRevision: 1 },
    );
    assert.equal(fixture.meetings.find((meeting) => meeting.id === "meeting-a")?.notes, "Updated notes");
    await assert.rejects(
      updateMeetingNotes(fixture.client, { organizationId: "org-a", actorId: "person-a", meetingId: "meeting-a", expectedNotesRevision: 0, notes: "stale" }),
      (error: unknown) => error instanceof DomainOperationError && error.code === "MEETING_NOTES_STALE",
    );
    await assert.rejects(
      updateMeetingNotes(fixture.client, { organizationId: "org-a", actorId: "person-a", meetingId: "meeting-other", expectedNotesRevision: 0, notes: "no participant" }),
      (error: unknown) => error instanceof DomainOperationError && error.code === "MEETING_PARTICIPANT_REQUIRED",
    );
    await assert.rejects(
      updateMeetingNotes(fixture.client, { organizationId: "org-a", actorId: "person-a", meetingId: "meeting-ended", expectedNotesRevision: 0, notes: "ended" }),
      (error: unknown) => error instanceof DomainOperationError && error.code === "MEETING_ENDED",
    );
    await assert.rejects(
      updateMeetingNotes(fixture.client, { organizationId: "org-b", actorId: "person-a", meetingId: "meeting-a", expectedNotesRevision: 1, notes: "cross tenant" }),
      (error: unknown) => error instanceof DomainOperationError && error.code === "MEETING_NOT_AVAILABLE",
    );
  });

  test("exact tactical route rejects cross-run, cross-organization, and non-tactical destinations", async () => {
    const fixture = fakeDomain();
    fixture.tensions.push({ id: "tension-a", organizationId: "org-a", status: "OPEN" });
    fixture.artifacts.push({ id: "source-a", organizationId: "org-a", runId: "run-a", artifactType: "TENSION", artifactId: "tension-a", relation: "raised-tension", metadata: {}, createdAt: new Date() });
    assert.deepEqual(await resolveTacticalRoute(fixture.client, { organizationId: "org-a", runId: "run-a", sourceTensionArtifactId: "source-a", meetingId: "meeting-a" }), { sourceArtifactId: "source-a", tensionId: "tension-a", meetingId: "meeting-a" });
    await assert.rejects(resolveTacticalRoute(fixture.client, { organizationId: "org-a", runId: "run-x", sourceTensionArtifactId: "source-a", meetingId: "meeting-a" }));
    await assert.rejects(resolveTacticalRoute(fixture.client, { organizationId: "org-a", runId: "run-a", sourceTensionArtifactId: "source-a", meetingId: "meeting-b" }));
    await assert.rejects(resolveTacticalRoute(fixture.client, { organizationId: "org-a", runId: "run-a", sourceTensionArtifactId: "source-a", meetingId: "meeting-gov" }));
  });

  test("selected meeting includes only exact valid routes and keeps multiple sources unambiguous", async () => {
    const fixture = fakeDomain();
    fixture.tensions.push({ id: "tension-1", organizationId: "org-a", status: "OPEN" }, { id: "tension-2", organizationId: "org-a", status: "OPEN" }, { id: "tension-b", organizationId: "org-b", status: "OPEN" });
    fixture.artifacts.push(
      { id: "source-1", organizationId: "org-a", runId: "run-a", artifactType: "TENSION", artifactId: "tension-1", relation: "raised-tension", metadata: {}, createdAt: new Date(1) },
      { id: "source-2", organizationId: "org-a", runId: "run-a", artifactType: "TENSION", artifactId: "tension-2", relation: "raised-tension", metadata: {}, createdAt: new Date(2) },
      { id: "route-1", organizationId: "org-a", runId: "run-a", artifactType: "MEETING", artifactId: "meeting-a", relation: "tactical-route:command-1", metadata: { schemaVersion: 1, sourceTensionArtifactId: "source-1" }, createdAt: new Date(3) },
      { id: "route-2", organizationId: "org-a", runId: "run-a", artifactType: "MEETING", artifactId: "meeting-a", relation: "tactical-route:command-2", metadata: { schemaVersion: 1, sourceTensionArtifactId: "source-2" }, createdAt: new Date(4) },
      { id: "route-other", organizationId: "org-a", runId: "run-a", artifactType: "MEETING", artifactId: "meeting-other", relation: "tactical-route:command-3", metadata: { schemaVersion: 1, sourceTensionArtifactId: "source-1" }, createdAt: new Date(5) },
      { id: "route-cross", organizationId: "org-b", runId: "run-b", artifactType: "MEETING", artifactId: "meeting-a", relation: "tactical-route:command-4", metadata: { schemaVersion: 1, sourceTensionArtifactId: "source-1" }, createdAt: new Date(6) },
    );
    assert.deepEqual((await resolveOpenTensionsRoutedToMeeting(fixture.client, { organizationId: "org-a", meetingId: "meeting-a" })).map((item) => item.tensionId), ["tension-1", "tension-2"]);
    assert.equal(await hasExactOpenTacticalRoute(fixture.client, { organizationId: "org-a", meetingId: "meeting-other", tensionId: "tension-2" }), false);
  });

  test("direct tactical mutation boundary rejects wrong meeting, wrong type, and cross-tenant submissions", async () => {
    const fixture = fakeDomain();
    fixture.tensions.push({ id: "runtime-tension", organizationId: "org-a", status: "OPEN" });
    fixture.artifacts.push(
      { id: "runtime-source", organizationId: "org-a", runId: "run-a", artifactType: "TENSION", artifactId: "runtime-tension", relation: "raised-tension", metadata: {}, createdAt: new Date(1) },
      { id: "runtime-route", organizationId: "org-a", runId: "run-a", artifactType: "MEETING", artifactId: "meeting-a", relation: "tactical-route:command", metadata: { schemaVersion: 1, sourceTensionArtifactId: "runtime-source" }, createdAt: new Date(2) },
    );
    await assert.rejects(
      authorizeMeetingTensionMutation(fixture.client, { organizationId: "org-a", meetingId: "meeting-a", tensionId: "runtime-tension", operation: "TACTICAL_PROCESS" }),
      (error: unknown) => error instanceof DomainOperationError && error.code === "RUNTIME_TENSION_PROPOSAL_REQUIRED",
    );
    await assert.rejects(authorizeMeetingTensionMutation(fixture.client, { organizationId: "org-a", meetingId: "meeting-other", tensionId: "runtime-tension", operation: "TACTICAL_PROCESS" }));
    await assert.rejects(authorizeMeetingTensionMutation(fixture.client, { organizationId: "org-a", meetingId: "meeting-gov", tensionId: "runtime-tension", operation: "TACTICAL_PROCESS" }));
    await assert.rejects(authorizeMeetingTensionMutation(fixture.client, { organizationId: "org-b", meetingId: "meeting-a", tensionId: "runtime-tension", operation: "TACTICAL_PROCESS" }));
  });

  test("Tracker mutation requires an approved Action and its current owner for every provenance", async () => {
    const fixture = fakeDomain();
    fixture.tensions.push(
      { id: "runtime-tension", organizationId: "org-a", status: "OPEN", ownerId: "owner" },
      { id: "ordinary-tension", organizationId: "org-a", status: "OPEN", ownerId: "owner" },
    );
    fixture.artifacts.push({ id: "runtime-source", organizationId: "org-a", runId: "run-a", artifactType: "TENSION", artifactId: "runtime-tension", relation: "raised-tension", metadata: {}, createdAt: new Date(1) });
    await assert.rejects(authorizeTrackerTensionMutation(fixture.client, { organizationId: "org-a", tensionId: "ordinary-tension", actorId: "owner" }));
    await assert.rejects(authorizeTrackerTensionMutation(fixture.client, { organizationId: "org-a", tensionId: "runtime-tension", actorId: "owner" }));
    await assert.rejects(authorizeManualProjectSource(fixture.client, { organizationId: "org-a", tensionId: "runtime-tension" }));
    fixture.proposals.push({ id: "proposal", organizationId: "org-a", tensionId: "runtime-tension", status: "APPROVED", kind: "ACTION", outcomeActionId: "runtime-tension" });
    assert.deepEqual(
      await authorizeTrackerTensionMutation(fixture.client, { organizationId: "org-a", tensionId: "runtime-tension", actorId: "owner" }),
      { proposalId: "proposal", tensionId: "runtime-tension", ownerId: "owner" },
    );
    for (const actorId of ["circle-lead", "admin", "coach", "facilitator"]) {
      await assert.rejects(authorizeTrackerTensionMutation(fixture.client, { organizationId: "org-a", tensionId: "runtime-tension", actorId }));
    }
    fixture.proposals.push({ id: "ordinary-proposal", organizationId: "org-a", tensionId: "ordinary-tension", status: "APPROVED", kind: "ACTION", outcomeActionId: "ordinary-tension" });
    assert.equal(
      (await authorizeTrackerTensionMutation(fixture.client, { organizationId: "org-a", tensionId: "ordinary-tension", actorId: "owner" })).proposalId,
      "ordinary-proposal",
    );
  });

  test("Tracker mutation denies unapproved, non-Action, mismatched-outcome, cross-tenant, and ownerless records", async () => {
    const cases = [
      { proposal: { status: "PROPOSED", kind: "ACTION", outcomeActionId: "action" }, organizationId: "org-a", ownerId: "owner" },
      { proposal: { status: "APPROVED", kind: "PROJECT", outcomeActionId: "action" }, organizationId: "org-a", ownerId: "owner" },
      { proposal: { status: "APPROVED", kind: "ACTION", outcomeActionId: "other" }, organizationId: "org-a", ownerId: "owner" },
      { proposal: { status: "APPROVED", kind: "ACTION", outcomeActionId: "action" }, organizationId: "org-b", ownerId: "owner" },
      { proposal: { status: "APPROVED", kind: "ACTION", outcomeActionId: "action" }, organizationId: "org-a", ownerId: null },
    ];
    for (const [index, entry] of cases.entries()) {
      const fixture = fakeDomain();
      fixture.tensions.push({ id: "action", organizationId: "org-a", status: "ESCALATED_L1", ownerId: entry.ownerId });
      fixture.proposals.push({ id: `proposal-${index}`, organizationId: entry.organizationId, tensionId: "action", ...entry.proposal });
      await assert.rejects(authorizeTrackerTensionMutation(fixture.client, { organizationId: "org-a", tensionId: "action", actorId: "owner" }));
    }
  });

  test("direct decision boundary rejects runtime tension and permits only ordinary tension in governance", async () => {
    const fixture = fakeDomain();
    fixture.tensions.push(
      { id: "runtime-tension", organizationId: "org-a", status: "OPEN" },
      { id: "ordinary-tension", organizationId: "org-a", status: "OPEN" },
      { id: "pilot-tension", organizationId: "org-a", status: "OPEN" },
    );
    fixture.artifacts.push(
      { id: "runtime-source", organizationId: "org-a", runId: "run-a", artifactType: "TENSION", artifactId: "runtime-tension", relation: "raised-tension", metadata: {}, createdAt: new Date(1) },
      { id: "pilot-trace", organizationId: "org-a", runId: "run-a", artifactType: "TENSION", artifactId: "pilot-tension", relation: "validation-tension", metadata: {}, createdAt: new Date(2) },
    );
    assert.equal((await classifyTensionProvenance(fixture.client, { organizationId: "org-a", tensionId: "runtime-tension" })).provenance, "RUNTIME_RAISED");
    await assert.rejects(authorizeMeetingTensionMutation(fixture.client, { organizationId: "org-a", meetingId: "meeting-gov", tensionId: "runtime-tension", operation: "LEGACY_DECISION" }));
    await assert.rejects(authorizeMeetingTensionMutation(fixture.client, { organizationId: "org-a", meetingId: "meeting-a", tensionId: "ordinary-tension", operation: "LEGACY_DECISION" }));
    await assert.rejects(authorizeMeetingTensionMutation(fixture.client, { organizationId: "org-a", meetingId: "meeting-other", tensionId: "ordinary-tension", operation: "LEGACY_DECISION" }));
    assert.equal((await authorizeMeetingTensionMutation(fixture.client, { organizationId: "org-a", meetingId: "meeting-gov", tensionId: "ordinary-tension", operation: "LEGACY_DECISION" })).provenance, "ORDINARY");
    assert.equal((await authorizeMeetingTensionMutation(fixture.client, { organizationId: "org-a", meetingId: "meeting-gov", tensionId: "pilot-tension", operation: "LEGACY_DECISION" })).provenance, "ORDINARY");
  });

  test("direct decision mutation rejects forged calls without writes and preserves ordinary and pilot conversion", async () => {
    const fixture = fakeDomain();
    fixture.tensions.push(
      { id: "runtime-tension", organizationId: "org-a", status: "OPEN" },
      { id: "ordinary-tension", organizationId: "org-a", status: "OPEN" },
      { id: "pilot-tension", organizationId: "org-a", status: "OPEN" },
    );
    fixture.artifacts.push(
      { id: "runtime-source", organizationId: "org-a", runId: "run-a", artifactType: "TENSION", artifactId: "runtime-tension", relation: "raised-tension", metadata: {}, createdAt: new Date(1) },
      { id: "pilot-trace", organizationId: "org-a", runId: "run-a", artifactType: "TENSION", artifactId: "pilot-tension", relation: "validation-tension", metadata: {}, createdAt: new Date(2) },
    );
    const base = { organizationId: "org-a", title: "Decision", type: "ROLE_CHANGE" as const, content: "Content", rationale: "Rationale" };
    await assert.rejects(convertOrdinaryTensionToGovernanceDecision(fixture.client, { ...base, meetingId: "meeting-gov", tensionId: "runtime-tension" }));
    await assert.rejects(convertOrdinaryTensionToGovernanceDecision(fixture.client, { ...base, meetingId: "meeting-a", tensionId: "ordinary-tension" }));
    await assert.rejects(convertOrdinaryTensionToGovernanceDecision(fixture.client, { ...base, organizationId: "org-b", meetingId: "meeting-gov", tensionId: "ordinary-tension" }));
    assert.equal(fixture.decisions.length, 0);
    assert.equal(fixture.tensions.find((item) => item.id === "runtime-tension")?.status, "OPEN");
    assert.deepEqual(await convertOrdinaryTensionToGovernanceDecision(fixture.client, { ...base, meetingId: "meeting-gov", tensionId: "ordinary-tension" }), { id: "decision-1" });
    assert.deepEqual(await convertOrdinaryTensionToGovernanceDecision(fixture.client, { ...base, meetingId: "meeting-gov", tensionId: "pilot-tension" }), { id: "decision-2" });
    assert.equal(fixture.decisions.length, 2);
    assert.equal(fixture.tensions.find((item) => item.id === "ordinary-tension")?.status, "RESOLVED");
    assert.equal(fixture.tensions.find((item) => item.id === "pilot-tension")?.status, "RESOLVED");
  });
});

type GovernanceCommandRow = {
  id: string;
  organizationId: string;
  runId: string;
  nodeId: string;
  nodeVisit: number;
  kind: string;
  clientIdempotencyKey: string;
  actorId: string;
  payload: unknown;
  status: "SUCCEEDED";
};

function governanceDomainFixture() {
  const candidatePayload = {
    confirmed: true,
    sourceTensionArtifactId: "source-artifact",
    structuralCategory: "ROLE",
    currentStructure: "Current",
    proposedStructure: "Proposed",
    rationale: "Reason",
    expectedImpact: "Impact",
  };
  const commands: GovernanceCommandRow[] = [{
    id: "candidate-command",
    organizationId: "org-a",
    runId: "run-a",
    nodeId: "candidate-node",
    nodeVisit: 4,
    kind: "EXECUTE_SIDE_EFFECT",
    clientIdempotencyKey: "candidate-key",
    actorId: "proposer",
    payload: candidatePayload,
    status: "SUCCEEDED",
  }];
  const artifacts: Array<{ id: string; organizationId: string; runId: string; artifactType: string; artifactId: string; relation: string; metadata: Record<string, unknown> }> = [
    { id: "source-artifact", organizationId: "org-a", runId: "run-a", artifactType: "TENSION", artifactId: "tension-a", relation: "raised-tension", metadata: {} },
    {
      id: "proposal-artifact",
      organizationId: "org-a",
      runId: "run-a",
      artifactType: "GOVERNANCE_PROPOSAL",
      artifactId: "proposal-a",
      relation: "governance-candidate:candidate-command",
      metadata: { schemaVersion: 1, commandId: "candidate-command", nodeId: "candidate-node", nodeVisit: 4, runId: "run-a", revision: 0, sourceTensionArtifactId: "source-artifact", tensionId: "tension-a", proposalId: "proposal-a", proposerId: "proposer" },
    },
  ];
  const proposals = [{
    id: "proposal-a",
    organizationId: "org-a",
    tensionId: "tension-a",
    status: "CANDIDATE",
    meetingId: null as string | null,
    type: "ROLE",
    proposedChange: JSON.stringify({ schemaVersion: 1, structuralCategory: "ROLE", currentStructure: "Current", proposedStructure: "Proposed", expectedImpact: "Impact" }),
    rationale: "Reason",
    tension: { id: "tension-a", raiserId: "proposer", status: "OPEN" },
  }];
  const meetings = [
    { id: "meeting-governance", organizationId: "org-a", type: "GOVERNANCE", title: "Governance", startedAt: new Date("2026-07-11"), participants: [{ id: "proposer", organizationId: "org-a" }, { id: "participant-no-interface-role", organizationId: "org-a" }] },
    { id: "meeting-proposer-only", organizationId: "org-a", type: "GOVERNANCE", title: "Proposer only", startedAt: new Date("2026-07-10"), participants: [{ id: "proposer", organizationId: "org-a" }] },
    { id: "meeting-wrong-type", organizationId: "org-a", type: "TACTICAL", title: "Tactical", startedAt: new Date("2026-07-09"), participants: [{ id: "proposer", organizationId: "org-a" }, { id: "participant-no-interface-role", organizationId: "org-a" }] },
  ];
  const processes: Array<Record<string, unknown>> = [];
  const revisions: Array<Record<string, unknown>> = [];
  let writes = 0;
  const matches = (row: Record<string, unknown>, where: Record<string, unknown>): boolean => Object.entries(where).every(([key, value]) => {
    if (key === "AND" && Array.isArray(value)) return value.every((part) => matches(row, part as Record<string, unknown>));
    if (key === "OR" && Array.isArray(value)) return value.some((part) => matches(row, part as Record<string, unknown>));
    if (key === "relation" && isTestRecord(value) && typeof value.startsWith === "string") return String(row.relation).startsWith(value.startsWith);
    if (key === "participants" && isTestRecord(value) && isTestRecord(value.some)) {
      return Array.isArray(row.participants) && row.participants.some((participant) => matches(participant as Record<string, unknown>, value.some as Record<string, unknown>));
    }
    return row[key] === value;
  });
  const client = {
    interfaceWorkflowArtifact: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => artifacts.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where }: { where: Record<string, unknown> }) => artifacts.filter((row) => matches(row, where)),
    },
    interfaceWorkflowCommand: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => commands.find((row) => matches(row, where)) ?? null,
    },
    governanceProposal: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => proposals.find((row) => matches(row, where)) ?? null,
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: { meetingId: string } }) => {
        const proposal = proposals.find((row) => matches(row, where));
        if (!proposal) return { count: 0 };
        proposal.meetingId = data.meetingId;
        writes += 1;
        return { count: 1 };
      },
    },
    governanceDecisionProcess: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => processes.find((row) => matches(row, where)) ?? null,
    },
    governanceProposalRevision: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => revisions.find((row) => matches(row, where)) ?? null,
    },
    interfaceWorkflowRun: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => matches({ id: "run-a", organizationId: "org-a" }, where) ? { id: "run-a" } : null,
    },
    meeting: {
      findFirst: async ({ where }: { where: Record<string, unknown> }) => meetings.find((row) => matches(row, where)) ?? null,
      findMany: async ({ where }: { where: Record<string, unknown> }) => meetings.filter((row) => matches(row, where)).sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime()),
    },
  };
  return { client: client as never, candidatePayload, commands, artifacts, proposals, meetings, processes, revisions, get writes() { return writes; } };
}

function addSuccessfulGovernanceRoute(fixture: ReturnType<typeof governanceDomainFixture>) {
  const routePayload = { confirmed: true, meetingId: "meeting-governance", proposalArtifactId: "proposal-artifact" };
  const command: GovernanceCommandRow = { id: "route-command", organizationId: "org-a", runId: "run-a", nodeId: "route-node", nodeVisit: 5, kind: "EXECUTE_SIDE_EFFECT", clientIdempotencyKey: "route-key", actorId: "participant-no-interface-role", payload: routePayload, status: "SUCCEEDED" };
  fixture.commands.push(command);
  fixture.proposals[0].meetingId = "meeting-governance";
  fixture.artifacts.push({
    id: "route-artifact",
    organizationId: "org-a",
    runId: "run-a",
    artifactType: "MEETING",
    artifactId: "meeting-governance",
    relation: "governance-route:route-command",
    metadata: { schemaVersion: 1, commandId: "route-command", nodeId: "route-node", nodeVisit: 5, runId: "run-a", revision: 1, actorId: "participant-no-interface-role", meetingType: "GOVERNANCE", proposalId: "proposal-a", proposalArtifactId: "proposal-artifact", sourceTensionArtifactId: "source-artifact", tensionId: "tension-a" },
  });
  return command;
}

function isTestRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

describe("generic governance route authority and provenance", () => {
  test("a selected-meeting participant with no interface role can route while nonparticipants and title identities cannot", async () => {
    const fixture = governanceDomainFixture();
    assert.equal((await resolveGovernanceCandidateArtifact(fixture.client, { organizationId: "org-a", runId: "run-a", proposalArtifactId: "proposal-artifact" })).proposerId, "proposer");
    assert.deepEqual((await listGovernanceRouteMeetings(fixture.client, { organizationId: "org-a", runId: "run-a", actorId: "participant-no-interface-role", proposalArtifactId: "proposal-artifact" })).map((meeting) => meeting.id), ["meeting-governance"]);
    assert.equal((await authorizeGovernanceRoute(fixture.client, { organizationId: "org-a", runId: "run-a", actorId: "participant-no-interface-role", proposalArtifactId: "proposal-artifact", meetingId: "meeting-governance" })).proposalId, "proposal-a");
    assert.equal((await authorizeGovernanceRoute(fixture.client, { organizationId: "org-a", runId: "run-a", actorId: "proposer", proposalArtifactId: "proposal-artifact", meetingId: "meeting-governance" })).proposalId, "proposal-a");
    for (const actorId of ["nonparticipant", "admin", "coach", "circle-lead"]) {
      await assert.rejects(authorizeGovernanceRoute(fixture.client, { organizationId: "org-a", runId: "run-a", actorId, proposalArtifactId: "proposal-artifact", meetingId: "meeting-governance" }));
    }
    await assert.rejects(authorizeGovernanceRoute(fixture.client, { organizationId: "org-a", runId: "run-a", actorId: "participant-no-interface-role", proposalArtifactId: "proposal-artifact", meetingId: "meeting-proposer-only" }));
    await assert.rejects(authorizeGovernanceRoute(fixture.client, { organizationId: "org-a", runId: "run-a", actorId: "participant-no-interface-role", proposalArtifactId: "proposal-artifact", meetingId: "meeting-wrong-type" }));
    await assert.rejects(authorizeGovernanceRoute(fixture.client, { organizationId: "org-b", runId: "run-a", actorId: "participant-no-interface-role", proposalArtifactId: "proposal-artifact", meetingId: "meeting-governance" }));
    assert.equal(fixture.writes, 0);
  });

  test("candidate provenance requires exact relation suffix, command, node, visit, run, source, proposal, and proposer", async () => {
    const mutations: Array<(fixture: ReturnType<typeof governanceDomainFixture>) => void> = [
      (fixture) => { fixture.artifacts[1].relation = "governance-candidate:forged"; },
      (fixture) => { fixture.artifacts[1].metadata.commandId = "forged"; },
      (fixture) => { fixture.artifacts[1].metadata.nodeId = "forged"; },
      (fixture) => { fixture.artifacts[1].metadata.nodeVisit = 99; },
      (fixture) => { fixture.artifacts[1].metadata.runId = "run-b"; },
      (fixture) => { fixture.artifacts[1].metadata.sourceTensionArtifactId = "forged"; },
      (fixture) => { fixture.artifacts[1].metadata.proposalId = "forged"; },
      (fixture) => { fixture.artifacts[1].metadata.proposerId = "coach"; },
      (fixture) => { fixture.commands[0].payload = { ...fixture.candidatePayload, rationale: "changed" }; },
    ];
    for (const mutate of mutations) {
      const fixture = governanceDomainFixture();
      mutate(fixture);
      await assert.rejects(resolveGovernanceCandidateArtifact(fixture.client, { organizationId: "org-a", runId: "run-a", proposalArtifactId: "proposal-artifact" }));
      assert.equal(fixture.proposals[0].meetingId, null);
      assert.equal(fixture.writes, 0);
    }
  });

  test("terminal route replay is exact and forged route provenance stays invisible", async () => {
    const fixture = governanceDomainFixture();
    const command = addSuccessfulGovernanceRoute(fixture);
    const base = { organizationId: "org-a", runId: "run-a", actorId: "participant-no-interface-role", proposalArtifactId: "proposal-artifact", meetingId: "meeting-governance", expectedRevision: 1, command };
    assert.equal((await authorizeGovernanceRouteReplay(fixture.client, base)).meetingId, "meeting-governance");
    assert.deepEqual((await resolveGovernanceCandidatesRoutedToMeeting(fixture.client, { organizationId: "org-a", meetingId: "meeting-governance" })).map((route) => route.proposalId), ["proposal-a"]);
    await assert.rejects(authorizeGovernanceRouteReplay(fixture.client, { ...base, actorId: "nonparticipant" }));
    await assert.rejects(authorizeGovernanceRouteReplay(fixture.client, { ...base, organizationId: "org-b" }));
    await assert.rejects(authorizeGovernanceRouteReplay(fixture.client, { ...base, meetingId: "meeting-proposer-only" }));
    await assert.rejects(authorizeGovernanceRouteReplay(fixture.client, { ...base, expectedRevision: 2 }));
    await assert.rejects(authorizeGovernanceRouteReplay(fixture.client, { ...base, command: { ...command, payload: { ...command.payload as Record<string, unknown>, meetingId: "meeting-proposer-only" } } }));
    assert.equal(fixture.writes, 0);

    fixture.artifacts.at(-1)!.relation = "governance-route:forged";
    assert.deepEqual(await resolveGovernanceCandidatesRoutedToMeeting(fixture.client, { organizationId: "org-a", meetingId: "meeting-governance" }), []);
    fixture.artifacts.at(-1)!.relation = "governance-route:route-command";
    fixture.artifacts.at(-1)!.metadata.nodeVisit = 99;
    assert.deepEqual(await resolveGovernanceCandidatesRoutedToMeeting(fixture.client, { organizationId: "org-a", meetingId: "meeting-governance" }), []);
  });

  test("decision resolver returns the complete exact route and supports immutable terminal replay", async () => {
    const fixture = governanceDomainFixture();
    addSuccessfulGovernanceRoute(fixture);
    const input = { organizationId: "org-a", runId: "run-a", proposalId: "proposal-a", proposalArtifactId: "proposal-artifact", routeArtifactId: "route-artifact", meetingId: "meeting-governance" };
    const initial = await resolveRoutedGovernanceCandidateForDecision(fixture.client, input);
    assert.deepEqual({ proposalId: initial.proposal.id, tensionId: initial.tension.id, proposerId: initial.proposerId, meetingId: initial.meeting.id, runId: initial.run.id, sourceArtifactId: initial.sourceTensionArtifact.id, proposalArtifactId: initial.proposalArtifact.id, routeArtifactId: initial.routeArtifact.id, candidateCommandId: initial.candidateCommand.id, routeCommandId: initial.routeCommand.id, process: initial.process }, {
      proposalId: "proposal-a", tensionId: "tension-a", proposerId: "proposer", meetingId: "meeting-governance", runId: "run-a", sourceArtifactId: "source-artifact", proposalArtifactId: "proposal-artifact", routeArtifactId: "route-artifact", candidateCommandId: "candidate-command", routeCommandId: "route-command", process: null,
    });

    fixture.processes.push({ id: "process-1", organizationId: "org-a", proposalId: "proposal-a", state: "ADOPTED", currentRevision: 2, currentRevisionId: "revision-2", proposerId: "proposer", sourceTensionId: "tension-a", meetingId: "meeting-governance", runId: "run-a", sourceTensionArtifactId: "source-artifact", proposalArtifactId: "proposal-artifact", routeArtifactId: "route-artifact" });
    fixture.revisions.push({ id: "revision-2", organizationId: "org-a", processId: "process-1", proposalId: "proposal-a", revision: 2, authoredById: "proposer", currentStructure: "Current", proposedStructure: "Proposed v2", rationale: "Reason v2", expectedImpact: "Impact v2", typedChange: { schemaVersion: 1, operation: "ROLE_CREATED" } });
    fixture.proposals[0].status = "ADOPTED";
    fixture.proposals[0].tension.status = "RESOLVED";
    const terminal = await resolveRoutedGovernanceCandidateForDecision(fixture.client, input);
    assert.equal(terminal.process?.state, "ADOPTED");
    assert.equal(terminal.revision?.revision, 2);

    fixture.artifacts.at(-1)!.metadata.proposalArtifactId = "forged";
    await assert.rejects(resolveRoutedGovernanceCandidateForDecision(fixture.client, input));
  });

  test("candidate replay binds actor, payload, revision, and the original successful command", async () => {
    const fixture = governanceDomainFixture();
    const command = fixture.commands[0];
    const base = { organizationId: "org-a", runId: "run-a", actorId: "proposer", sourceTensionArtifactId: "source-artifact", expectedRevision: 0, command };
    assert.equal((await authorizeGovernanceCandidateReplay(fixture.client, base)).proposalId, "proposal-a");
    await assert.rejects(authorizeGovernanceCandidateReplay(fixture.client, { ...base, actorId: "participant-no-interface-role" }));
    await assert.rejects(authorizeGovernanceCandidateReplay(fixture.client, { ...base, expectedRevision: 1 }));
    await assert.rejects(authorizeGovernanceCandidateReplay(fixture.client, { ...base, command: { ...command, clientIdempotencyKey: "changed" } }));
    assert.equal(fixture.writes, 0);
  });

  test("route mutation claims the candidate once after the same authoritative check", async () => {
    const fixture = governanceDomainFixture();
    assert.equal((await routeGovernanceCandidate(fixture.client, { organizationId: "org-a", runId: "run-a", actorId: "participant-no-interface-role", proposalArtifactId: "proposal-artifact", meetingId: "meeting-governance" })).proposalId, "proposal-a");
    assert.equal(fixture.proposals[0].meetingId, "meeting-governance");
    assert.equal(fixture.writes, 1);
    await assert.rejects(routeGovernanceCandidate(fixture.client, { organizationId: "org-a", runId: "run-a", actorId: "participant-no-interface-role", proposalArtifactId: "proposal-artifact", meetingId: "meeting-governance" }));
    assert.equal(fixture.writes, 1);
  });
});
