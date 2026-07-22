import assert from "node:assert/strict";
import test from "node:test";

import {
  activateGoalCycle,
  appendGoalCheckIns,
  appendGoalProposalRevision,
  cancelGoalCycle,
  closeGoalCycle,
  createGoalCycle,
  createGoalProposal,
  createGoalWorkLink,
  decideGoalProposal,
  deriveGoalHealth,
  editPlannedGoalCycle,
  GoalDomainError,
  submitGoalProposal,
  removeGoalWorkLink,
  withdrawGoalProposal,
  type GoalCycleSnapshot,
  type GoalCheckInSnapshot,
  type GoalCheckInInput,
  type GoalDecisionResult,
  type GoalDomainActor,
  type GoalDomainDependencies,
  type GoalDomainTransaction,
  type GoalProposalSnapshot,
  type GoalProposalRevisionInput,
  type GoalSnapshot,
  type GoalWorkLinkKind,
  type GoalWorkLinkSnapshot,
} from "./domain-operations";

const admin: GoalDomainActor = {
  userId: "user-admin",
  personId: "person-admin",
  organizationId: "org-a",
};

const member: GoalDomainActor = {
  userId: "user-member",
  personId: "person-member",
  organizationId: "org-a",
};

const startAt = new Date("2026-08-01T00:00:00.000Z");
const endAt = new Date("2026-09-30T00:00:00.000Z");

test("creates, edits, activates, and closes a cycle through legal transitions", async () => {
  const fake = new FakeGoalDomain();
  fake.allow(admin);

  const created = await createGoalCycle(cycleInput(), fake.dependencies());
  assert.equal(created.status, "PLANNED");
  assert.deepEqual(lifecycleTimes(created), { activatedAt: null, closedAt: null, cancelledAt: null });
  assert.equal(fake.lastIsolationLevel, "Serializable");

  const edited = await editPlannedGoalCycle({
    organizationId: "org-a",
    cycleId: created.id,
    actor: admin,
    name: "2026 Q3 priorities",
    checkInCadenceDays: 14,
  }, fake.dependencies());
  assert.equal(edited.name, "2026 Q3 priorities");
  assert.equal(edited.checkInCadenceDays, 14);
  assert.deepEqual(lifecycleTimes(edited), { activatedAt: null, closedAt: null, cancelledAt: null });

  fake.now = new Date("2026-08-01T01:00:00.000Z");
  const activated = await activateGoalCycle(transitionInput(created.id), fake.dependencies());
  assert.equal(activated.status, "ACTIVE");
  assert.deepEqual(lifecycleTimes(activated), {
    activatedAt: "2026-08-01T01:00:00.000Z",
    closedAt: null,
    cancelledAt: null,
  });

  fake.now = new Date("2026-10-01T02:00:00.000Z");
  const closed = await closeGoalCycle(transitionInput(created.id), fake.dependencies());
  assert.equal(closed.status, "CLOSED");
  assert.deepEqual(lifecycleTimes(closed), {
    activatedAt: "2026-08-01T01:00:00.000Z",
    closedAt: "2026-10-01T02:00:00.000Z",
    cancelledAt: null,
  });
});

test("cancels only a planned cycle", async () => {
  const fake = new FakeGoalDomain();
  fake.allow(admin);
  const created = await createGoalCycle(cycleInput(), fake.dependencies());

  fake.now = new Date("2026-07-20T03:00:00.000Z");
  const cancelled = await cancelGoalCycle(transitionInput(created.id), fake.dependencies());
  assert.equal(cancelled.status, "CANCELLED");
  assert.deepEqual(lifecycleTimes(cancelled), {
    activatedAt: null,
    closedAt: null,
    cancelledAt: "2026-07-20T03:00:00.000Z",
  });
  await expectCode(() => activateGoalCycle(transitionInput(created.id), fake.dependencies()), "CYCLE_IMMUTABLE");
});

test("non-admin, cross-tenant, and mismatched person actors produce zero writes", async () => {
  const cases: GoalDomainActor[] = [
    { ...admin, userId: "user-member", personId: "person-member" },
    { ...admin, organizationId: "org-b" },
    { ...admin, personId: "person-other" },
  ];

  for (const actor of cases) {
    const fake = new FakeGoalDomain();
    fake.allow(admin);
    const expected = actor.organizationId === "org-b" ? "ACTOR_CONTEXT_MISMATCH" : "FORBIDDEN";
    await expectCode(() => createGoalCycle(cycleInput(actor), fake.dependencies()), expected);
    assert.equal(fake.writeCount, 0);
  }
});

test("cycle lookup remains tenant bounded and does not write", async () => {
  const fake = new FakeGoalDomain();
  fake.allow(admin);
  fake.seed(cycle("cycle-b", "org-b", "PLANNED"));

  await expectCode(() => activateGoalCycle(transitionInput("cycle-b"), fake.dependencies()), "CYCLE_NOT_FOUND");
  assert.equal(fake.writeCount, 0);
});

test("rejects stale state and a failed status CAS", async () => {
  const fake = new FakeGoalDomain();
  fake.allow(admin);
  fake.seed(cycle("cycle-active", "org-a", "ACTIVE"));

  await expectCode(() => activateGoalCycle(transitionInput("cycle-active"), fake.dependencies()), "CYCLE_NOT_PLANNED");
  assert.equal(fake.writeCount, 0);

  fake.seed(cycle("cycle-planned", "org-a", "PLANNED"));
  fake.failNextCas = true;
  await expectCode(() => activateGoalCycle(transitionInput("cycle-planned"), fake.dependencies()), "CYCLE_STATE_CONFLICT");
  assert.equal(fake.get("cycle-planned")?.status, "PLANNED");
});

test("maps activation, cancellation, and close constraints to stable errors", async () => {
  const fake = new FakeGoalDomain();
  fake.allow(admin);
  fake.seed(cycle("planned", "org-a", "PLANNED"));
  fake.failNextWrite = prismaUniqueError(["organizationId"]);
  await expectCode(() => activateGoalCycle(transitionInput("planned"), fake.dependencies()), "ACTIVE_CYCLE_EXISTS");

  fake.failNextWrite = prismaError("P2010", "goal cycle has non-terminal proposals");
  await expectCode(() => cancelGoalCycle(transitionInput("planned"), fake.dependencies()), "CYCLE_HAS_NON_TERMINAL_PROPOSALS");

  fake.seed(cycle("active", "org-a", "ACTIVE"));
  fake.failNextWrite = prismaError("P2010", "goal cycle has active Goals");
  await expectCode(() => closeGoalCycle(transitionInput("active"), fake.dependencies()), "CYCLE_HAS_ACTIVE_GOALS");
});

test("normalizes adapter-pg nested quoted unique fields", async () => {
  const fake = new FakeGoalDomain();
  fake.allow(admin);
  fake.seed(cycle("planned", "org-a", "PLANNED"));
  fake.failNextWrite = prismaAdapterUniqueError(['"organizationId"']);

  await expectCode(() => activateGoalCycle(transitionInput("planned"), fake.dependencies()), "ACTIVE_CYCLE_EXISTS");
  assert.equal(fake.writeCount, 0);
});

test("maps unrelated unique violations to a generic stable constraint error", async () => {
  const fake = new FakeGoalDomain();
  fake.allow(admin);
  fake.failNextWrite = prismaUniqueError(["id"]);

  await expectCode(() => createGoalCycle(cycleInput(), fake.dependencies()), "CONSTRAINT_VIOLATION");
  assert.equal(fake.writeCount, 0);
});

test("maps serialization failures to a stable error", async () => {
  const fake = new FakeGoalDomain();
  fake.allow(admin);
  fake.transactionFailure = prismaError("P2034", "transaction conflict");

  await expectCode(() => createGoalCycle(cycleInput(), fake.dependencies()), "SERIALIZATION_CONFLICT");
  assert.equal(fake.writeCount, 0);
});

test("rolls back a write when the transaction later throws", async () => {
  const fake = new FakeGoalDomain();
  fake.allow(admin);
  fake.seed(cycle("planned", "org-a", "PLANNED"));
  fake.failAfterNextWrite = new Error("injected failure after write");

  await expectCode(() => activateGoalCycle(transitionInput("planned"), fake.dependencies()), "PERSISTENCE_FAILED");
  assert.equal(fake.get("planned")?.status, "PLANNED");
  assert.equal(fake.writeCount, 0);
});

test("unknown database failures expose only the stable persistence code", async () => {
  const fake = new FakeGoalDomain();
  fake.allow(admin);
  fake.transactionFailure = Object.assign(new Error("host=secret-db.internal password=raw-secret"), {
    meta: { detail: "private row and adapter metadata" },
  });

  await assert.rejects(() => createGoalCycle(cycleInput(), fake.dependencies()), (error) => {
    assert.ok(error instanceof GoalDomainError);
    assert.equal(error.code, "PERSISTENCE_FAILED");
    assert.equal(error.message, "PERSISTENCE_FAILED");
    assert.equal("meta" in error, false);
    return true;
  });
  assert.equal(fake.writeCount, 0);
});

test("any current member can create an exact revision 1 with typed Targets", async () => {
  const fake = proposalFake("PLANNED");
  const proposal = await createGoalProposal(proposalInput(), fake.dependencies());

  assert.equal(proposal.proposerId, member.personId);
  assert.equal(proposal.status, "DRAFT");
  assert.equal(proposal.currentRevision, 1);
  assert.equal(proposal.revision.authoredById, member.personId);
  assert.deepEqual(proposal.revision.targets.map((target) => ({
    position: target.position,
    kind: target.kind,
    baselineValue: target.baselineValue,
    desiredValue: target.desiredValue,
    metricId: target.metricId,
  })), [
    { position: 0, kind: "NUMERIC", baselineValue: "10", desiredValue: "20", metricId: "metric-a" },
    { position: 1, kind: "MILESTONE", baselineValue: null, desiredValue: null, metricId: null },
  ]);
  assert.equal(fake.lastIsolationLevel, "Serializable");
});

test("proposal creation validates tenant, active Goal, Role, parent, and Metric before visible writes", async () => {
  const cases: Array<[string, () => FakeGoalDomain, ReturnType<typeof proposalInput>]> = [
    ["CIRCLE_NOT_FOUND", () => proposalFake("PLANNED", { circle: false }), proposalInput()],
    ["OWNER_ROLE_INVALID", () => proposalFake("PLANNED", { role: false }), proposalInput()],
    ["METRIC_INVALID", () => proposalFake("PLANNED", { metric: false }), proposalInput()],
    ["ACTIVE_GOAL_REQUIRED", () => proposalFake("ACTIVE"), proposalInput(member, "REPLACE", "missing-goal")],
    ["PARENT_GOAL_INVALID", () => proposalFake("ACTIVE"), proposalInput(member, "CREATE", undefined, definitionRevision("missing-parent"))],
  ];
  for (const [code, makeFake, input] of cases) {
    const fake = makeFake();
    await expectCode(() => createGoalProposal(input, fake.dependencies()), code);
    assert.equal(fake.writeCount, 0);
  }
});

test("proposal parent support follows the exact immediate Circle hierarchy", async () => {
  const validFake = hierarchyFake();
  const valid = await createGoalProposal({
    ...proposalInput(member, "CREATE", undefined, definitionRevision("goal-parent")),
    circleId: "circle-child",
  }, validFake.dependencies());
  assert.equal(valid.revision.parentGoalId, "goal-parent");

  const invalid: Array<[string, string | undefined]> = [
    ["missing child parent", undefined],
    ["wrong ancestor", "goal-root"],
    ["sibling", "goal-sibling"],
  ];
  for (const [, parentGoalId] of invalid) {
    const fake = hierarchyFake();
    await expectCode(() => createGoalProposal({
      ...proposalInput(member, "CREATE", undefined, definitionRevision(parentGoalId)),
      circleId: "circle-child",
    }, fake.dependencies()), "PARENT_GOAL_INVALID");
    assert.equal(fake.writeCount, 0);
  }

  const rootFake = hierarchyFake();
  await expectCode(() => createGoalProposal(
    proposalInput(member, "CREATE", undefined, definitionRevision("goal-parent")),
    rootFake.dependencies(),
  ), "PARENT_GOAL_INVALID");
  assert.equal(rootFake.writeCount, 0);
});

test("only the proposer can submit, append a returned revision, resubmit, and withdraw", async () => {
  const fake = proposalFake("PLANNED");
  const draft = await createGoalProposal(proposalInput(), fake.dependencies());
  const writesAfterCreate = fake.writeCount;

  await expectCode(() => submitGoalProposal(proposalTransition(draft.id, 1, admin), fake.dependencies()), "PROPOSER_REQUIRED");
  await expectCode(() => submitGoalProposal(proposalTransition(draft.id, 2, member), fake.dependencies()), "STALE_REVISION");
  assert.equal(fake.writeCount, writesAfterCreate);

  await submitGoalProposal(proposalTransition(draft.id, 1, member), fake.dependencies());
  const returned = await decideGoalProposal(decisionInput(draft.id, 1, "RETURNED", admin, "return-1"), fake.dependencies());
  assert.equal(returned.proposal.status, "RETURNED");
  await expectCode(() => appendGoalProposalRevision({
    ...proposalTransition(draft.id, 1, admin),
    revision: definitionRevision(),
  }, fake.dependencies()), "PROPOSER_REQUIRED");

  const revised = await appendGoalProposalRevision({
    ...proposalTransition(draft.id, 1, member),
    revision: { ...definitionRevision(), title: "Revised goal" },
  }, fake.dependencies());
  assert.equal(revised.currentRevision, 2);
  assert.equal(revised.status, "DRAFT");
  assert.equal(revised.revision.title, "Revised goal");
  await submitGoalProposal(proposalTransition(draft.id, 2, member), fake.dependencies());
  const withdrawn = await withdrawGoalProposal(proposalTransition(draft.id, 2, member), fake.dependencies());
  assert.equal(withdrawn.status, "WITHDRAWN");
  assert.equal(withdrawn.terminalAt?.toISOString(), fake.now.toISOString());
});

test("an exact RETURNED mutation key replays after a later revision while a new old-revision key is stale", async () => {
  const fake = proposalFake("PLANNED");
  const proposal = await createSubmittedProposal(fake);
  const decision = decisionInput(proposal.id, 1, "RETURNED", admin, "return-replay", "strategy-a", "revise scope");
  const returned = await decideGoalProposal(decision, fake.dependencies());
  await appendGoalProposalRevision({
    ...proposalTransition(proposal.id, 1, member),
    revision: { ...definitionRevision(), title: "Revision two" },
  }, fake.dependencies());
  const writes = fake.writeCount;

  const replay = await decideGoalProposal(decision, fake.dependencies());
  assert.equal(replay.decision.id, returned.decision.id);
  assert.deepEqual(replay, returned);
  assert.equal(fake.writeCount, writes);

  await expectCode(() => decideGoalProposal({ ...decision, note: "changed tuple" }, fake.dependencies()), "MUTATION_KEY_CONFLICT");
  await expectCode(() => decideGoalProposal({ ...decision, mutationKey: "new-old-revision-key" }, fake.dependencies()), "STALE_REVISION");
  assert.equal(fake.writeCount, writes);
});

test("member revalidation and tenant bounds deny before proposal writes", async () => {
  const nonmember = { ...member, userId: "user-outsider", personId: "person-outsider" };
  const crossTenant = { ...member, organizationId: "org-b" };
  for (const [actor, code] of [[nonmember, "FORBIDDEN"], [crossTenant, "ACTOR_CONTEXT_MISMATCH"]] as const) {
    const fake = proposalFake("PLANNED");
    await expectCode(() => createGoalProposal(proposalInput(actor), fake.dependencies()), code);
    assert.equal(fake.writeCount, 0);
  }
});

test("strategic decisions require exact same-Circle unended meeting and both current participants", async () => {
  const fake = proposalFake("ACTIVE");
  const proposal = await createSubmittedProposal(fake);
  const writes = fake.writeCount;
  const cases: Array<[FakeMeeting, string, GoalDomainActor]> = [
    [strategyMeeting({ id: "wrong-org", organizationId: "org-b" }), "MEETING_NOT_FOUND", admin],
    [strategyMeeting({ id: "wrong-circle", circleId: "circle-b" }), "MEETING_INVALID", admin],
    [strategyMeeting({ id: "wrong-type", type: "TACTICAL" }), "MEETING_INVALID", admin],
    [strategyMeeting({ id: "ended", endedAt: new Date() }), "MEETING_INVALID", admin],
    [strategyMeeting({ id: "missing-proposer", participantIds: [admin.personId] }), "PROPOSER_NOT_PARTICIPANT", admin],
    [strategyMeeting({ id: "admin-not-participant", participantIds: [member.personId] }), "RECORDER_NOT_PARTICIPANT", admin],
  ];
  for (const [meeting, code, actor] of cases) {
    fake.seedMeeting(meeting);
    await expectCode(() => decideGoalProposal(
      decisionInput(proposal.id, 1, "DECLINED", actor, `key-${meeting.id}`, meeting.id),
      fake.dependencies(),
    ), code);
    assert.equal(fake.writeCount, writes);
  }
});

test("proposer-as-recorder is valid and planned cycles permit return and decline", async () => {
  const returnedFake = proposalFake("PLANNED");
  returnedFake.seedMeeting(strategyMeeting({ participantIds: [member.personId] }));
  const returnedProposal = await createSubmittedProposal(returnedFake);
  const returned = await decideGoalProposal(
    decisionInput(returnedProposal.id, 1, "RETURNED", member, "self-return"),
    returnedFake.dependencies(),
  );
  assert.equal(returned.proposal.status, "RETURNED");
  assert.equal(returned.decision.recorderId, member.personId);

  const declinedFake = proposalFake("PLANNED");
  const declinedProposal = await createSubmittedProposal(declinedFake);
  const declined = await decideGoalProposal(
    decisionInput(declinedProposal.id, 1, "DECLINED", admin, "decline-1"),
    declinedFake.dependencies(),
  );
  assert.equal(declined.proposal.status, "DECLINED");
  assert.equal(declined.adoptedGoal, null);
});

test("adoption is denied unless the cycle is ACTIVE", async () => {
  const fake = proposalFake("PLANNED");
  const proposal = await createSubmittedProposal(fake);
  const writes = fake.writeCount;

  await expectCode(() => decideGoalProposal(
    decisionInput(proposal.id, 1, "ADOPTED", admin, "adopt-planned"),
    fake.dependencies(),
  ), "ADOPTION_REQUIRES_ACTIVE_CYCLE");
  assert.equal(fake.writeCount, writes);
  assert.equal(fake.proposal(proposal.id)?.status, "SUBMITTED");
});

test("ADOPTED CREATE copies exact Targets and exact replay is canonical", async () => {
  const fake = proposalFake("ACTIVE");
  const proposal = await createSubmittedProposal(fake);
  const input = decisionInput(proposal.id, 1, "ADOPTED", admin, "adopt-create", "strategy-a", "approved");
  const adopted = await decideGoalProposal(input, fake.dependencies());

  assert.equal(adopted.proposal.status, "ADOPTED");
  assert.equal(adopted.adoptedGoal?.status, "ACTIVE");
  assert.deepEqual(adopted.adoptedGoal?.targets.map((target) => ({
    sourceProposalTargetId: target.sourceProposalTargetId,
    position: target.position,
    label: target.label,
    kind: target.kind,
    baselineValue: target.baselineValue,
    desiredValue: target.desiredValue,
    unit: target.unit,
    acceptanceCriteria: target.acceptanceCriteria,
    metricId: target.metricId,
  })), proposal.revision.targets.map((target) => ({
    sourceProposalTargetId: target.id,
    position: target.position,
    label: target.label,
    kind: target.kind,
    baselineValue: target.baselineValue,
    desiredValue: target.desiredValue,
    unit: target.unit,
    acceptanceCriteria: target.acceptanceCriteria,
    metricId: target.metricId,
  })));

  const writes = fake.writeCount;
  assert.deepEqual(await decideGoalProposal(input, fake.dependencies()), adopted);
  assert.equal(fake.writeCount, writes);
  await expectCode(() => decideGoalProposal({ ...input, note: "changed" }, fake.dependencies()), "MUTATION_KEY_CONFLICT");
  await expectCode(() => decideGoalProposal({ ...input, mutationKey: "different-key" }, fake.dependencies()), "DECISION_ALREADY_RECORDED");
});

test("ADOPTED REPLACE atomically supersedes the old Goal and creates its replacement", async () => {
  const fake = proposalFake("ACTIVE");
  const oldGoal = activeGoal("goal-old");
  fake.seedGoal(oldGoal);
  const proposal = await createSubmittedProposal(fake, proposalInput(member, "REPLACE", oldGoal.id));
  const result = await decideGoalProposal(
    decisionInput(proposal.id, 1, "ADOPTED", admin, "replace-1"),
    fake.dependencies(),
  );

  assert.equal(result.terminalGoal?.id, oldGoal.id);
  assert.equal(result.terminalGoal?.status, "SUPERSEDED");
  assert.equal(result.terminalGoal?.terminalDecisionId, result.decision.id);
  assert.equal(result.adoptedGoal?.status, "ACTIVE");
  assert.equal(result.adoptedGoal?.adoptedDecisionId, result.decision.id);
});

test("ADOPTED CLOSE applies ACHIEVED with effective evidence and NOT_ACHIEVED with a conclusion", async () => {
  const achievedFake = proposalFake("ACTIVE");
  const achievedGoal = activeGoal("goal-achieved");
  achievedFake.seedGoal(achievedGoal);
  achievedFake.seedCheckIn(achievedGoalCheckIn(achievedGoal));
  const achievedProposal = await createSubmittedProposal(achievedFake, proposalInput(member, "CLOSE", achievedGoal.id, {
    closeResult: "ACHIEVED",
    conclusion: "Target evidence was accepted",
  }));
  const achieved = await decideGoalProposal(
    decisionInput(achievedProposal.id, 1, "ADOPTED", admin, "close-achieved"),
    achievedFake.dependencies(),
  );
  assert.equal(achieved.terminalGoal?.status, "ACHIEVED");
  assert.equal(achieved.adoptedGoal, null);

  const notAchievedFake = proposalFake("ACTIVE");
  const notAchievedGoal = activeGoal("goal-not-achieved");
  notAchievedFake.seedGoal(notAchievedGoal);
  const notAchievedProposal = await createSubmittedProposal(notAchievedFake, proposalInput(member, "CLOSE", notAchievedGoal.id, {
    closeResult: "NOT_ACHIEVED",
    conclusion: "The target was not met",
  }));
  const notAchieved = await decideGoalProposal(
    decisionInput(notAchievedProposal.id, 1, "ADOPTED", admin, "close-not-achieved"),
    notAchievedFake.dependencies(),
  );
  assert.equal(notAchieved.terminalGoal?.status, "NOT_ACHIEVED");
  assert.equal(notAchieved.adoptedGoal, null);
});

test("ADOPTED ACHIEVED close rejects insufficient evidence with full rollback", async () => {
  const fake = proposalFake("ACTIVE");
  const oldGoal = activeGoal("goal-insufficient-evidence");
  fake.seedGoal(oldGoal);
  const proposal = await createSubmittedProposal(fake, proposalInput(member, "CLOSE", oldGoal.id, {
    closeResult: "ACHIEVED",
    conclusion: "Claimed achieved without effective evidence",
  }));
  const writes = fake.writeCount;

  await expectCode(() => decideGoalProposal(
    decisionInput(proposal.id, 1, "ADOPTED", admin, "close-insufficient"),
    fake.dependencies(),
  ), "GOAL_EVIDENCE_INSUFFICIENT");
  assert.equal(fake.writeCount, writes);
  assert.equal(fake.proposal(proposal.id)?.status, "SUBMITTED");
  assert.equal(fake.goal(oldGoal.id)?.status, "ACTIVE");
  assert.equal(fake.goal(oldGoal.id)?.terminalDecisionId, null);
});

test("decision CAS losers and late failures leave no decision or Goal effects", async () => {
  const fake = proposalFake("ACTIVE");
  const proposal = await createSubmittedProposal(fake);
  const writes = fake.writeCount;
  fake.failNextProposalCas = true;
  await expectCode(() => decideGoalProposal(
    decisionInput(proposal.id, 1, "ADOPTED", admin, "cas-loser"),
    fake.dependencies(),
  ), "PROPOSAL_STATE_CONFLICT");
  assert.equal(fake.writeCount, writes);
  assert.equal(fake.proposal(proposal.id)?.status, "SUBMITTED");
  assert.equal(fake.allGoals().length, 0);

  fake.failAfterNextWrite = new Error("late adoption failure");
  await expectCode(() => decideGoalProposal(
    decisionInput(proposal.id, 1, "ADOPTED", admin, "late-failure"),
    fake.dependencies(),
  ), "PERSISTENCE_FAILED");
  assert.equal(fake.writeCount, writes);
  assert.equal(fake.proposal(proposal.id)?.status, "SUBMITTED");
  assert.equal(fake.allGoals().length, 0);
});

test("database decision and active-Goal uniqueness targets map to narrow stable codes", async () => {
  for (const [target, code] of [
    [["organizationId", "mutationKey"], "MUTATION_KEY_CONFLICT"],
    [["organizationId", "proposalId", "revision"], "DECISION_ALREADY_RECORDED"],
    [["organizationId", "cycleId", "circleId"], "ACTIVE_GOAL_EXISTS"],
  ] as const) {
    const fake = proposalFake("ACTIVE");
    const proposal = await createSubmittedProposal(fake);
    const writes = fake.writeCount;
    fake.failNextWrite = prismaUniqueError([...target]);
    await expectCode(() => decideGoalProposal(
      decisionInput(proposal.id, 1, "ADOPTED", admin, `conflict-${code}`),
      fake.dependencies(),
    ), code);
    assert.equal(fake.writeCount, writes);
  }
});

test("owner-Role assignee atomically records legal numeric and milestone check-ins", async () => {
  const fake = followUpFake();
  const rows = await appendGoalCheckIns({
    organizationId: "org-a",
    goalId: "goal-follow-up",
    actor: member,
    entries: [
      numericCheckIn("target-numeric", "20", "ACHIEVED"),
      milestoneCheckIn("target-milestone", true, "ACHIEVED", "Signed acceptance"),
    ],
  }, fake.dependencies());

  assert.equal(rows.length, 2);
  assert.deepEqual(rows.map((row) => ({
    targetId: row.targetId,
    currentValue: row.currentValue,
    milestoneCompleted: row.milestoneCompleted,
    acceptanceEvidence: row.acceptanceEvidence,
    recorderId: row.recorderId,
  })), [
    { targetId: "target-numeric", currentValue: "20", milestoneCompleted: null, acceptanceEvidence: null, recorderId: member.personId },
    { targetId: "target-milestone", currentValue: null, milestoneCompleted: true, acceptanceEvidence: "Signed acceptance", recorderId: member.personId },
  ]);

  const descending = followUpFake();
  descending.seedGoal({
    ...followUpGoal(),
    targets: [{ ...goalTarget("target-numeric", "NUMERIC"), baselineValue: "20", desiredValue: "10" }],
  });
  const [reached] = await appendGoalCheckIns({
    ...checkInRequest(member),
    entries: [numericCheckIn("target-numeric", "9", "ACHIEVED")],
  }, descending.dependencies());
  assert.equal(reached.assessment, "ACHIEVED");
});

test("check-in authority is exact Role assignment or an allowed current meeting participant", async () => {
  const denied = followUpFake({ assigneeIds: [] });
  const writes = denied.writeCount;
  await expectCode(() => appendGoalCheckIns(checkInRequest(admin), denied.dependencies()), "FOLLOW_UP_AUTHORITY_REQUIRED");
  assert.equal(denied.writeCount, writes);

  for (const meeting of [
    tacticalMeeting({ id: "tactical-authority", participantIds: [admin.personId] }),
    strategyMeeting({ id: "strategy-authority", participantIds: [admin.personId] }),
  ]) {
    const fake = followUpFake({ assigneeIds: [] });
    fake.seedMeeting(meeting);
    const rows = await appendGoalCheckIns(checkInRequest(admin, meeting.id), fake.dependencies());
    assert.equal(rows[0].meetingId, meeting.id);
  }

  for (const meeting of [
    tacticalMeeting({ id: "ended-follow-up", endedAt: new Date() }),
    tacticalMeeting({ id: "wrong-circle-follow-up", circleId: "circle-b" }),
    tacticalMeeting({ id: "governance-follow-up", type: "GOVERNANCE" }),
  ]) {
    const fake = followUpFake();
    fake.seedMeeting(meeting);
    await expectCode(() => appendGoalCheckIns(checkInRequest(member, meeting.id), fake.dependencies()), "MEETING_INVALID");
    assert.equal(fake.goalCheckIns("goal-follow-up").length, 0);
  }
});

test("inactive, unassigned, nonmember, and cross-tenant check-in actors produce zero writes", async () => {
  const cases: Array<[FakeGoalDomain, GoalDomainActor, string]> = [
    [followUpFake({ roleActive: false }), member, "FOLLOW_UP_AUTHORITY_REQUIRED"],
    [followUpFake({ assigneeIds: [] }), member, "FOLLOW_UP_AUTHORITY_REQUIRED"],
    [followUpFake(), { ...member, userId: "outsider", personId: "outsider" }, "FORBIDDEN"],
    [followUpFake(), { ...member, organizationId: "org-b" }, "ACTOR_CONTEXT_MISMATCH"],
  ];
  for (const [fake, actor, code] of cases) {
    await expectCode(() => appendGoalCheckIns(checkInRequest(actor), fake.dependencies()), code);
    assert.equal(fake.goalCheckIns("goal-follow-up").length, 0);
    assert.equal(fake.writeCount, 0);
  }
});

test("typed check-in validation and duplicate targets roll back the full request", async () => {
  const invalidEntries: Array<[GoalCheckInInput[], string]> = [
    [[numericCheckIn("target-numeric", "19", "ACHIEVED")], "CHECK_IN_INVALID"],
    [[{ ...numericCheckIn("target-numeric", "20", "ON_TRACK"), milestoneCompleted: true }], "CHECK_IN_INVALID"],
    [[milestoneCheckIn("target-milestone", false, "ACHIEVED")], "CHECK_IN_INVALID"],
    [[{ ...milestoneCheckIn("target-milestone", true, "ON_TRACK"), currentValue: "1" }], "CHECK_IN_INVALID"],
    [[{ ...numericCheckIn("target-numeric", "15", "ON_TRACK"), sourceUrl: "javascript:bad" }], "SOURCE_URL_INVALID"],
    [[numericCheckIn("target-numeric", "15", "ON_TRACK"), numericCheckIn("target-numeric", "16", "ON_TRACK")], "DUPLICATE_TARGET"],
  ];
  for (const [entries, expected] of invalidEntries) {
    const fake = followUpFake();
    await expectCode(() => appendGoalCheckIns({
      ...checkInRequest(member),
      entries,
    }, fake.dependencies()), expected);
    assert.equal(fake.goalCheckIns("goal-follow-up").length, 0);
  }

  const fake = followUpFake();
  fake.failAfterNextWrite = new Error("late check-in failure");
  await expectCode(() => appendGoalCheckIns({
    ...checkInRequest(member),
    entries: [numericCheckIn("target-numeric", "15", "ON_TRACK"), milestoneCheckIn("target-milestone", false, "ON_TRACK")],
  }, fake.dependencies()), "PERSISTENCE_FAILED");
  assert.equal(fake.goalCheckIns("goal-follow-up").length, 0);
  assert.equal(fake.writeCount, 0);
});

test("runtime-null and malformed check-in entries fail with stable domain errors", async () => {
  for (const entry of [null, "not-an-entry"] as unknown[]) {
    const fake = followUpFake();
    await expectCode(() => appendGoalCheckIns({
      ...checkInRequest(member),
      entries: [entry] as GoalCheckInInput[],
    }, fake.dependencies()), "CHECK_IN_INVALID");
    assert.equal(fake.writeCount, 0);
  }
});

test("check-in corrections are same-target, strictly later, and have one winner", async () => {
  const fake = followUpFake();
  const [original] = await appendGoalCheckIns(checkInRequest(member), fake.dependencies());
  fake.now = new Date(fake.now.getTime() + 1);
  const [correction] = await appendGoalCheckIns({
    ...checkInRequest(member),
    entries: [{ ...numericCheckIn("target-numeric", "18", "ON_TRACK"), supersedesCheckInId: original.id }],
  }, fake.dependencies());
  assert.equal(correction.supersedesCheckInId, original.id);

  const writes = fake.writeCount;
  await expectCode(() => appendGoalCheckIns({
    ...checkInRequest(member),
    entries: [{ ...numericCheckIn("target-numeric", "19", "ON_TRACK"), supersedesCheckInId: original.id }],
  }, fake.dependencies()), "CORRECTION_CONFLICT");
  assert.equal(fake.writeCount, writes);

  const sameTime = followUpFake();
  const [sameTimeOriginal] = await appendGoalCheckIns(checkInRequest(member), sameTime.dependencies());
  await expectCode(() => appendGoalCheckIns({
    ...checkInRequest(member),
    entries: [{ ...numericCheckIn("target-numeric", "18", "ON_TRACK"), supersedesCheckInId: sameTimeOriginal.id }],
  }, sameTime.dependencies()), "CORRECTION_INVALID");

  const wrongTarget = followUpFake();
  const [numeric] = await appendGoalCheckIns(checkInRequest(member), wrongTarget.dependencies());
  wrongTarget.now = new Date(wrongTarget.now.getTime() + 1);
  await expectCode(() => appendGoalCheckIns({
    ...checkInRequest(member),
    entries: [{ ...milestoneCheckIn("target-milestone", false, "ON_TRACK"), supersedesCheckInId: numeric.id }],
  }, wrongTarget.dependencies()), "CORRECTION_INVALID");

  for (const target of [
    ["supersedesCheckInId"],
    ["supersedesCheckInId", "organizationId", "goalId", "targetId"],
  ]) {
    const concurrent = followUpFake();
    const [concurrentOriginal] = await appendGoalCheckIns(checkInRequest(member), concurrent.dependencies());
    concurrent.now = new Date(concurrent.now.getTime() + 1);
    concurrent.failNextWrite = prismaUniqueError(target);
    await expectCode(() => appendGoalCheckIns({
      ...checkInRequest(member),
      entries: [{ ...numericCheckIn("target-numeric", "18", "ON_TRACK"), supersedesCheckInId: concurrentOriginal.id }],
    }, concurrent.dependencies()), "CORRECTION_CONFLICT");
  }
});

test("Goal health follows terminal, empty, deadline, assessment, missing, stale, and healthy precedence", () => {
  const now = new Date("2026-08-20T00:00:00.000Z");
  const base = healthInput(now);
  for (const status of ["SUPERSEDED", "ACHIEVED", "NOT_ACHIEVED"] as const) {
    assert.equal(deriveGoalHealth({ ...base, goal: { ...base.goal, status } }).status, status);
  }
  assert.equal(deriveGoalHealth(base).status, "NOT_UPDATED");
  assert.equal(deriveGoalHealth({ ...base, cycle: { ...base.cycle, endAt: new Date("2026-08-19T00:00:00.000Z") }, checkIns: [healthCheckIn("fresh", "target-numeric", "ON_TRACK", now)] }).status, "OFF_TRACK");
  assert.equal(deriveGoalHealth({ ...base, checkIns: base.targets.map((target, index) => healthCheckIn(`a-${index}`, target.id, "ACHIEVED", now)) }).status, "ACHIEVED");
  assert.equal(deriveGoalHealth({ ...base, checkIns: [healthCheckIn("off", "target-numeric", "OFF_TRACK", now)] }).status, "OFF_TRACK");
  assert.equal(deriveGoalHealth({ ...base, checkIns: [healthCheckIn("one", "target-numeric", "ON_TRACK", now)] }).status, "AT_RISK");
  assert.equal(deriveGoalHealth({ ...base, checkIns: base.targets.map((target, index) => healthCheckIn(`risk-${index}`, target.id, index === 0 ? "AT_RISK" : "ON_TRACK", now)) }).status, "AT_RISK");
  const staleAt = new Date(now.getTime() - 8 * 86_400_000);
  assert.equal(deriveGoalHealth({ ...base, checkIns: base.targets.map((target, index) => healthCheckIn(`stale-${index}`, target.id, "ON_TRACK", staleAt)) }).status, "AT_RISK");
  assert.equal(deriveGoalHealth({ ...base, checkIns: base.targets.map((target, index) => healthCheckIn(`ok-${index}`, target.id, "ON_TRACK", now)) }).status, "ON_TRACK");
});

test("Goal health excludes superseded rows and uses recordedAt then id descending", () => {
  const now = new Date("2026-08-20T00:00:00.000Z");
  const base = healthInput(now, [goalTarget("target-numeric", "NUMERIC")]);
  const old = healthCheckIn("old", "target-numeric", "OFF_TRACK", new Date(now.getTime() - 1));
  const correction = { ...healthCheckIn("correction", "target-numeric", "ACHIEVED", now), supersedesCheckInId: old.id };
  const corrected = deriveGoalHealth({ ...base, checkIns: [old, correction] });
  assert.equal(corrected.status, "ACHIEVED");
  assert.equal(corrected.targets[0].effectiveCheckIn?.id, "correction");

  const tie = deriveGoalHealth({
    ...base,
    checkIns: [healthCheckIn("a", "target-numeric", "ON_TRACK", now), healthCheckIn("b", "target-numeric", "OFF_TRACK", now)],
  });
  assert.equal(tie.status, "OFF_TRACK");
  assert.equal(tie.targets[0].effectiveCheckIn?.id, "b");
});

test("owner Role assignee cannot manage work links through a direct domain caller without tactical participation", async () => {
  const createFake = followUpFake();
  seedTrustedWorkObject(createFake, "PROJECT", "project-owner-denied");
  await expectCode(() => createGoalWorkLink(
    workLinkInput("PROJECT", "project-owner-denied", member, null),
    createFake.dependencies(),
  ), "FOLLOW_UP_AUTHORITY_REQUIRED");
  assert.equal(createFake.writeCount, 0);

  const removeFake = followUpFake();
  seedTrustedWorkObject(removeFake, "PROJECT", "project-remove-denied");
  const link = await createGoalWorkLink(workLinkInput("PROJECT", "project-remove-denied", admin), removeFake.dependencies());
  await expectCode(() => removeGoalWorkLink(
    removeLinkInput(link.id, member, null),
    removeFake.dependencies(),
  ), "FOLLOW_UP_AUTHORITY_REQUIRED");
  assert.equal(removeFake.workLink(link.id)?.status, "ACTIVE");
});

test("tactical participants create all three work-link kinds without mutating work objects", async () => {
  const fake = followUpFake();
  seedTrustedWorkObject(fake, "PROJECT", "project-a");
  seedTrustedWorkObject(fake, "ACTION", "action-a");
  seedTrustedWorkObject(fake, "BLOCKING_TENSION", "blocker-a");
  const before = fake.workObjectCounts();
  for (const [kind, workObjectId] of [["PROJECT", "project-a"], ["ACTION", "action-a"], ["BLOCKING_TENSION", "blocker-a"]] as const) {
    const link = await createGoalWorkLink(workLinkInput(kind, workObjectId, member), fake.dependencies());
    assert.equal(link.kind, kind);
    assert.equal(link.status, "ACTIVE");
  }
  assert.deepEqual(fake.workObjectCounts(), before);
});

test("PROJECT and ACTION work links require the exact approved tactical candidate", async () => {
  for (const kind of ["PROJECT", "ACTION"] as const) {
    const workObjectId = `${kind.toLowerCase()}-exact`;
    const success = followUpFake();
    seedTrustedWorkObject(success, kind, workObjectId);
    const link = await createGoalWorkLink(workLinkInput(kind, workObjectId, member), success.dependencies());
    assert.equal(kind === "PROJECT" ? link.projectId : link.tensionId, workObjectId);

    const invalidCandidates: Array<Partial<FakeTacticalCandidate>> = [
      { organizationId: "org-b" },
      { meetingId: "tactical-other" },
      { circleId: "circle-b" },
      { kind: kind === "PROJECT" ? "ACTION" : "PROJECT" },
      { workObjectId: `${workObjectId}-other` },
      { status: "PROPOSED" },
    ];
    for (const candidate of invalidCandidates) {
      const fake = followUpFake();
      fake.seedWorkObject(kind, "org-a", workObjectId);
      fake.seedTacticalCandidate(kind, workObjectId, candidate);
      await expectCode(() => createGoalWorkLink(
        workLinkInput(kind, workObjectId, member),
        fake.dependencies(),
      ), kind === "ACTION" ? "ACTION_NOT_APPROVED" : "WORK_OBJECT_NOT_FOUND");
      assert.equal(fake.writeCount, 0);
    }
  }
});

test("work links reject active duplicates and preserve unique-conflict mapping", async () => {
  const duplicate = followUpFake();
  seedTrustedWorkObject(duplicate, "PROJECT", "project-a");
  await createGoalWorkLink(workLinkInput("PROJECT", "project-a", member), duplicate.dependencies());
  await expectCode(() => createGoalWorkLink(workLinkInput("PROJECT", "project-a", member), duplicate.dependencies()), "WORK_LINK_ALREADY_ACTIVE");

  for (const [kind, workObjectId, targetField] of [
    ["PROJECT", "project-concurrent", "projectId"],
    ["BLOCKING_TENSION", "tension-concurrent", "tensionId"],
  ] as const) {
    const concurrentDuplicate = followUpFake();
    seedTrustedWorkObject(concurrentDuplicate, kind, workObjectId);
    concurrentDuplicate.failNextWrite = prismaUniqueError(["organizationId", "goalId", "kind", targetField]);
    await expectCode(() => createGoalWorkLink(
      workLinkInput(kind, workObjectId, member),
      concurrentDuplicate.dependencies(),
    ), "WORK_LINK_ALREADY_ACTIVE");
    assert.equal(concurrentDuplicate.writeCount, 0);
  }
});

test("owner assignee nonparticipant is denied create and remove even with an exact tactical meeting", async () => {
  const fake = followUpFake();
  seedTrustedWorkObject(fake, "PROJECT", "project-participant-boundary");
  fake.seedMeeting(tacticalMeeting({ participantIds: [admin.personId] }));
  await expectCode(() => createGoalWorkLink(
    workLinkInput("PROJECT", "project-participant-boundary", member),
    fake.dependencies(),
  ), "RECORDER_NOT_PARTICIPANT");

  const link = await createGoalWorkLink(workLinkInput("PROJECT", "project-participant-boundary", admin), fake.dependencies());
  await expectCode(() => removeGoalWorkLink(removeLinkInput(link.id, member), fake.dependencies()), "RECORDER_NOT_PARTICIPANT");
  assert.equal(fake.workLink(link.id)?.status, "ACTIVE");
});

test("blocking-tension links require a live same-Circle Tension", async () => {
  for (const [status, circleIds] of [
    ["RESOLVED", ["circle-a"]],
    ["REJECTED", ["circle-a"]],
    ["OPEN", ["circle-b"]],
  ] as const) {
    const fake = followUpFake();
    const tensionId = `tension-${status.toLowerCase()}-${circleIds[0]}`;
    fake.seedWorkObject("BLOCKING_TENSION", "org-a", tensionId, status, [...circleIds]);
    await expectCode(() => createGoalWorkLink(
      workLinkInput("BLOCKING_TENSION", tensionId, member),
      fake.dependencies(),
    ), "WORK_OBJECT_NOT_FOUND");
    assert.equal(fake.writeCount, 0);
  }
});

test("work-link authority rejects admin alone, inactive Role, bad meetings, and cross-tenant work", async () => {
  const cases: Array<[FakeGoalDomain, GoalDomainActor, string, string | null]> = [
    [followUpFake({ assigneeIds: [] }), admin, "FOLLOW_UP_AUTHORITY_REQUIRED", null],
    [followUpFake({ roleActive: false }), member, "FOLLOW_UP_AUTHORITY_REQUIRED", null],
    [followUpFake(), member, "MEETING_INVALID", "ended-work"],
    [followUpFake(), member, "MEETING_INVALID", "wrong-circle-work"],
    [followUpFake(), member, "MEETING_INVALID", "strategy-a"],
    [followUpFake(), { ...member, organizationId: "org-b" }, "ACTOR_CONTEXT_MISMATCH", null],
  ];
  cases[2][0].seedMeeting(tacticalMeeting({ id: "ended-work", endedAt: new Date() }));
  cases[3][0].seedMeeting(tacticalMeeting({ id: "wrong-circle-work", circleId: "circle-b" }));
  for (const [fake, actor, code, meetingId] of cases) {
    seedTrustedWorkObject(fake, "PROJECT", "project-authority");
    await expectCode(() => createGoalWorkLink(
      workLinkInput("PROJECT", "project-authority", actor, meetingId),
      fake.dependencies(),
    ), code);
    assert.equal(fake.writeCount, 0);
  }

  const crossWork = followUpFake();
  crossWork.seedWorkObject("PROJECT", "org-b", "project-other-tenant");
  crossWork.seedTacticalCandidate("PROJECT", "project-other-tenant", { organizationId: "org-b" });
  await expectCode(() => createGoalWorkLink(
    workLinkInput("PROJECT", "project-other-tenant", member),
    crossWork.dependencies(),
  ), "WORK_OBJECT_NOT_FOUND");
  assert.equal(crossWork.writeCount, 0);
});

test("work-link removal is authorized once, CAS protected, and rollback safe", async () => {
  const fake = followUpFake();
  seedTrustedWorkObject(fake, "PROJECT", "project-a");
  const link = await createGoalWorkLink(workLinkInput("PROJECT", "project-a", member), fake.dependencies());
  fake.now = new Date(fake.now.getTime() + 1);
  const removed = await removeGoalWorkLink(removeLinkInput(link.id, member), fake.dependencies());
  assert.equal(removed.status, "REMOVED");
  assert.equal(removed.removedById, member.personId);
  assert.equal(removed.removalReason, "No longer aligned");
  await expectCode(() => removeGoalWorkLink(removeLinkInput(link.id, member), fake.dependencies()), "WORK_LINK_STATE_CONFLICT");

  const meetingFake = followUpFake();
  seedTrustedWorkObject(meetingFake, "PROJECT", "project-meeting-remove");
  const meetingLink = await createGoalWorkLink(workLinkInput("PROJECT", "project-meeting-remove", member), meetingFake.dependencies());
  const meetingRemoved = await removeGoalWorkLink(removeLinkInput(meetingLink.id, admin), meetingFake.dependencies());
  assert.equal(meetingRemoved.removedById, admin.personId);
  assert.equal(meetingRemoved.removedMeetingId, "tactical-a");

  const terminalFake = followUpFake();
  seedTrustedWorkObject(terminalFake, "PROJECT", "project-terminal");
  const terminalLink = await createGoalWorkLink(workLinkInput("PROJECT", "project-terminal", member), terminalFake.dependencies());
  terminalFake.seedGoal({
    ...followUpGoal(),
    status: "ACHIEVED",
    terminalDecisionId: "decision-terminal",
    terminalAt: new Date(terminalFake.now),
  });
  const terminalRemoved = await removeGoalWorkLink(removeLinkInput(terminalLink.id, member), terminalFake.dependencies());
  assert.equal(terminalRemoved.status, "REMOVED");

  const casFake = followUpFake();
  seedTrustedWorkObject(casFake, "PROJECT", "project-b");
  const casLink = await createGoalWorkLink(workLinkInput("PROJECT", "project-b", member), casFake.dependencies());
  casFake.failNextWorkLinkCas = true;
  const writes = casFake.writeCount;
  await expectCode(() => removeGoalWorkLink(removeLinkInput(casLink.id, member), casFake.dependencies()), "WORK_LINK_STATE_CONFLICT");
  assert.equal(casFake.workLink(casLink.id)?.status, "ACTIVE");
  assert.equal(casFake.writeCount, writes);

  casFake.failAfterNextWrite = new Error("late removal failure");
  await expectCode(() => removeGoalWorkLink(removeLinkInput(casLink.id, member), casFake.dependencies()), "PERSISTENCE_FAILED");
  assert.equal(casFake.workLink(casLink.id)?.status, "ACTIVE");
  assert.equal(casFake.writeCount, writes);
});

function proposalFake(
  status: GoalCycleSnapshot["status"],
  options: { circle?: boolean; role?: boolean; metric?: boolean } = {},
): FakeGoalDomain {
  const fake = new FakeGoalDomain();
  fake.allow(admin);
  fake.allowMember(member);
  fake.seed(cycle("cycle-a", "org-a", status));
  if (options.circle !== false) fake.seedCircle("org-a", "circle-a");
  if (options.role !== false) fake.seedRole("org-a", "circle-a", "role-a");
  if (options.metric !== false) fake.seedMetric("org-a", "circle-a", "metric-a");
  fake.seedMeeting(strategyMeeting());
  return fake;
}

function followUpFake(
  options: { roleActive?: boolean; assigneeIds?: string[] } = {},
): FakeGoalDomain {
  const fake = proposalFake("ACTIVE");
  fake.seedGoal(followUpGoal());
  fake.seedOwnerRole("org-a", "role-a", options.roleActive ?? true, options.assigneeIds ?? [member.personId]);
  fake.seedMeeting(tacticalMeeting());
  return fake;
}

function followUpGoal(): GoalSnapshot {
  return { ...activeGoal("goal-follow-up"), targets: [goalTarget("target-numeric", "NUMERIC"), goalTarget("target-milestone", "MILESTONE")] };
}

function goalTarget(id: string, kind: "NUMERIC" | "MILESTONE", goalId = "goal-follow-up") {
  return {
    id,
    goalId,
    sourceProposalTargetId: `source-${id}`,
    position: kind === "NUMERIC" ? 0 : 1,
    label: kind === "NUMERIC" ? "Revenue" : "Proof",
    kind,
    baselineValue: kind === "NUMERIC" ? "10" : null,
    desiredValue: kind === "NUMERIC" ? "20" : null,
    unit: kind === "NUMERIC" ? "M" : null,
    acceptanceCriteria: kind === "MILESTONE" ? "Signed acceptance" : null,
    metricId: kind === "NUMERIC" ? "metric-a" : null,
  };
}

function checkInRequest(actor: GoalDomainActor, meetingId?: string) {
  return {
    organizationId: "org-a",
    goalId: "goal-follow-up",
    actor,
    ...(meetingId ? { meetingId } : {}),
    entries: [numericCheckIn("target-numeric", "15", "ON_TRACK")],
  };
}

function numericCheckIn(targetId: string, currentValue: string, assessment: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED") {
  return {
    targetId,
    fact: "Verified numeric result",
    evidenceSummary: "Finance system snapshot",
    assessment,
    currentValue,
    sourceUrl: "https://example.com/evidence",
  };
}

function milestoneCheckIn(
  targetId: string,
  milestoneCompleted: boolean,
  assessment: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED",
  acceptanceEvidence?: string,
) {
  return {
    targetId,
    fact: "Verified milestone state",
    evidenceSummary: "Signed review record",
    assessment,
    milestoneCompleted,
    ...(acceptanceEvidence ? { acceptanceEvidence } : {}),
  };
}

function healthInput(
  now: Date,
  targets = [goalTarget("target-numeric", "NUMERIC"), goalTarget("target-milestone", "MILESTONE")],
): Parameters<typeof deriveGoalHealth>[0] {
  return {
    goal: { id: "goal-follow-up", status: "ACTIVE" },
    cycle: { endAt: new Date("2026-09-30T00:00:00.000Z"), checkInCadenceDays: 7 },
    targets,
    checkIns: [],
    now,
  };
}

function healthCheckIn(
  id: string,
  targetId: string,
  assessment: "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED",
  recordedAt: Date,
): GoalCheckInSnapshot {
  return {
    id,
    organizationId: "org-a",
    goalId: "goal-follow-up",
    targetId,
    fact: "Persisted fact",
    evidenceSummary: "Persisted evidence",
    currentValue: targetId === "target-numeric" ? "15" : null,
    milestoneCompleted: targetId === "target-milestone" ? assessment === "ACHIEVED" : null,
    acceptanceEvidence: targetId === "target-milestone" && assessment === "ACHIEVED" ? "Accepted" : null,
    assessment,
    recorderId: member.personId,
    meetingId: null,
    sourceUrl: null,
    supersedesCheckInId: null,
    recordedAt: new Date(recordedAt),
  };
}

function tacticalMeeting(overrides: Partial<FakeMeeting> = {}): FakeMeeting {
  return {
    id: "tactical-a",
    organizationId: "org-a",
    circleId: "circle-a",
    type: "TACTICAL",
    endedAt: null,
    participantIds: [member.personId, admin.personId],
    ...overrides,
  };
}

function workLinkInput(
  kind: GoalWorkLinkKind,
  workObjectId: string,
  actor: GoalDomainActor,
  meetingId: string | null = "tactical-a",
) {
  return {
    organizationId: "org-a",
    goalId: "goal-follow-up",
    actor,
    kind,
    workObjectId,
    ...(meetingId ? { meetingId } : {}),
  };
}

function removeLinkInput(linkId: string, actor: GoalDomainActor, meetingId: string | null = "tactical-a") {
  return {
    organizationId: "org-a",
    goalId: "goal-follow-up",
    linkId,
    actor,
    reason: "No longer aligned",
    ...(meetingId ? { meetingId } : {}),
  };
}

function seedTrustedWorkObject(fake: FakeGoalDomain, kind: GoalWorkLinkKind, workObjectId: string): void {
  fake.seedWorkObject(kind, "org-a", workObjectId);
  if (kind === "PROJECT" || kind === "ACTION") fake.seedTacticalCandidate(kind, workObjectId);
}

function hierarchyFake(): FakeGoalDomain {
  const fake = proposalFake("ACTIVE");
  fake.seedCircle("org-a", "circle-root");
  fake.seedCircle("org-a", "circle-parent", "circle-root");
  fake.seedCircle("org-a", "circle-child", "circle-parent");
  fake.seedCircle("org-a", "circle-sibling", "circle-root");
  fake.seedRole("org-a", "circle-child", "role-a");
  fake.seedMetric("org-a", "circle-child", "metric-a");
  fake.seedGoal(activeGoal("goal-root", "circle-root"));
  fake.seedGoal(activeGoal("goal-parent", "circle-parent"));
  fake.seedGoal(activeGoal("goal-sibling", "circle-sibling"));
  return fake;
}

function proposalInput(
  actor: GoalDomainActor = member,
  kind: "CREATE" | "REPLACE" | "CLOSE" = "CREATE",
  replacedGoalId?: string,
  revision: GoalProposalRevisionInput = kind === "CLOSE"
    ? { closeResult: "NOT_ACHIEVED", conclusion: "Evidence did not meet the target" }
    : definitionRevision(),
) {
  return {
    organizationId: "org-a",
    cycleId: "cycle-a",
    circleId: "circle-a",
    actor,
    kind,
    ...(replacedGoalId ? { replacedGoalId } : {}),
    revision,
  };
}

function definitionRevision(parentGoalId?: string) {
  return {
    title: "Increase retained revenue",
    intendedOutcome: "Retained revenue grows with verified customer value",
    ownerRoleId: "role-a",
    ...(parentGoalId ? { parentGoalId } : {}),
    targets: [
      { kind: "NUMERIC" as const, label: "Revenue", baselineValue: "10.0", desiredValue: "20.00", unit: "M", metricId: "metric-a" },
      { kind: "MILESTONE" as const, label: "Proof", acceptanceCriteria: "Three customers confirm value" },
    ],
  };
}

function proposalTransition(proposalId: string, expectedRevision: number, actor: GoalDomainActor) {
  return { organizationId: "org-a", proposalId, expectedRevision, actor };
}

function decisionInput(
  proposalId: string,
  expectedRevision: number,
  outcome: "ADOPTED" | "RETURNED" | "DECLINED",
  actor: GoalDomainActor,
  mutationKey: string,
  meetingId = "strategy-a",
  note?: string,
) {
  return { organizationId: "org-a", proposalId, expectedRevision, outcome, actor, meetingId, mutationKey, ...(note ? { note } : {}) };
}

async function createSubmittedProposal(
  fake: FakeGoalDomain,
  input = proposalInput(),
): Promise<GoalProposalSnapshot> {
  const proposal = await createGoalProposal(input, fake.dependencies());
  return submitGoalProposal(proposalTransition(proposal.id, proposal.currentRevision, input.actor), fake.dependencies());
}

function strategyMeeting(overrides: Partial<FakeMeeting> = {}): FakeMeeting {
  return {
    id: "strategy-a",
    organizationId: "org-a",
    circleId: "circle-a",
    type: "STRATEGY",
    endedAt: null,
    participantIds: [member.personId, admin.personId],
    ...overrides,
  };
}

function activeGoal(id: string, circleId = "circle-a"): GoalSnapshot {
  return {
    id,
    organizationId: "org-a",
    cycleId: "cycle-a",
    circleId,
    title: "Old goal",
    intendedOutcome: "Old outcome",
    ownerRoleId: "role-a",
    parentGoalId: null,
    status: "ACTIVE",
    adoptedDecisionId: `adoption-${id}`,
    terminalDecisionId: null,
    createdAt: new Date("2026-08-01T01:00:00.000Z"),
    terminalAt: null,
    targets: [goalTarget(`target-${id}`, "MILESTONE", id)],
  };
}

function achievedGoalCheckIn(goal: GoalSnapshot): GoalCheckInSnapshot {
  return {
    id: `check-in-${goal.id}`,
    organizationId: goal.organizationId,
    goalId: goal.id,
    targetId: goal.targets[0].id,
    fact: "The milestone was completed",
    evidenceSummary: "Acceptance record verified",
    currentValue: null,
    milestoneCompleted: true,
    acceptanceEvidence: "Signed acceptance",
    assessment: "ACHIEVED",
    recorderId: member.personId,
    meetingId: "strategy-a",
    sourceUrl: null,
    supersedesCheckInId: null,
    recordedAt: new Date("2026-08-20T00:00:00.000Z"),
  };
}

function cycleInput(actor: GoalDomainActor = admin) {
  return {
    organizationId: "org-a",
    actor,
    name: "2026 Q3",
    startAt,
    endAt,
    checkInCadenceDays: 7,
  };
}

function transitionInput(cycleId: string) {
  return { organizationId: "org-a", cycleId, actor: admin };
}

function cycle(id: string, organizationId: string, status: GoalCycleSnapshot["status"]): GoalCycleSnapshot {
  const activatedAt = status === "ACTIVE" || status === "CLOSED"
    ? new Date("2026-08-01T01:00:00.000Z")
    : null;
  const closedAt = status === "CLOSED" ? new Date("2026-10-01T02:00:00.000Z") : null;
  const cancelledAt = status === "CANCELLED" ? new Date("2026-07-20T03:00:00.000Z") : null;
  return {
    id,
    organizationId,
    name: "2026 Q3",
    status,
    startAt,
    endAt,
    checkInCadenceDays: 7,
    activatedAt,
    closedAt,
    cancelledAt,
  };
}

function lifecycleTimes(value: GoalCycleSnapshot) {
  return {
    activatedAt: value.activatedAt?.toISOString() ?? null,
    closedAt: value.closedAt?.toISOString() ?? null,
    cancelledAt: value.cancelledAt?.toISOString() ?? null,
  };
}

async function expectCode(work: () => Promise<unknown>, code: string): Promise<void> {
  await assert.rejects(work, (error) => error instanceof GoalDomainError && error.code === code);
}

function prismaError(code: string, message: string): Error & { code: string } {
  return Object.assign(new Error(message), { code });
}

function prismaUniqueError(target: string[]): Error & { code: string; meta: { target: string[] } } {
  return Object.assign(new Error("Unique constraint failed"), { code: "P2002", meta: { target } });
}

function prismaAdapterUniqueError(fields: string[]): Error & {
  code: string;
  meta: { driverAdapterError: { cause: { constraint: { fields: string[] } } } };
} {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: { driverAdapterError: { cause: { constraint: { fields } } } },
  });
}

class FakeGoalDomain {
  private cycles = new Map<string, GoalCycleSnapshot>();
  private proposals = new Map<string, GoalProposalSnapshot>();
  private goals = new Map<string, GoalSnapshot>();
  private decisions = new Map<string, GoalDecisionResult["decision"]>();
  private decisionResults = new Map<string, GoalDecisionResult>();
  private checkIns = new Map<string, GoalCheckInSnapshot>();
  private workLinks = new Map<string, GoalWorkLinkSnapshot>();
  private meetings = new Map<string, FakeMeeting>();
  private admins = new Set<string>();
  private members = new Set<string>();
  private circles = new Map<string, string | null>();
  private roles = new Set<string>();
  private metrics = new Set<string>();
  private followUpRoles = new Map<string, { active: boolean; assigneeIds: string[] }>();
  private projects = new Set<string>();
  private tensions = new Map<string, { status: "OPEN" | "RESOLVED" | "REJECTED"; circleIds: string[] }>();
  private tacticalCandidates: FakeTacticalCandidate[] = [];
  private idSequence = 0;
  writeCount = 0;
  lastIsolationLevel: string | undefined;
  failNextCas = false;
  failNextProposalCas = false;
  failNextWorkLinkCas = false;
  failNextWrite: Error | undefined;
  failAfterNextWrite: Error | undefined;
  transactionFailure: Error | undefined;
  now = new Date("2026-07-15T12:00:00.000Z");

  allow(actor: GoalDomainActor): void {
    this.admins.add(actorKey(actor));
    this.members.add(actorKey(actor));
  }

  allowMember(actor: GoalDomainActor): void {
    this.members.add(actorKey(actor));
  }

  seed(value: GoalCycleSnapshot): void {
    this.cycles.set(value.id, cloneCycle(value));
  }

  get(id: string): GoalCycleSnapshot | undefined {
    const value = this.cycles.get(id);
    return value ? cloneCycle(value) : undefined;
  }

  seedCircle(organizationId: string, circleId: string, parentId: string | null = null): void {
    this.circles.set(`${organizationId}:${circleId}`, parentId);
  }

  seedRole(organizationId: string, circleId: string, roleId: string): void {
    this.roles.add(`${organizationId}:${circleId}:${roleId}`);
  }

  seedOwnerRole(
    organizationId: string,
    roleId: string,
    active: boolean,
    assigneeIds: string[],
  ): void {
    this.followUpRoles.set(`${organizationId}:${roleId}`, { active, assigneeIds: [...assigneeIds] });
  }

  seedMetric(organizationId: string, circleId: string, metricId: string): void {
    this.metrics.add(`${organizationId}:${circleId}:${metricId}`);
  }

  seedMeeting(meeting: FakeMeeting): void {
    this.meetings.set(meeting.id, cloneMeeting(meeting));
  }

  seedGoal(goal: GoalSnapshot): void {
    if (goal.targets.length === 0) throw new GoalDomainError("CONSTRAINT_VIOLATION");
    this.goals.set(goal.id, cloneGoal(goal));
  }

  seedCheckIn(checkIn: GoalCheckInSnapshot): void {
    this.checkIns.set(checkIn.id, cloneCheckIn(checkIn));
  }

  seedWorkObject(
    kind: GoalWorkLinkKind,
    organizationId: string,
    id: string,
    tensionStatus: "OPEN" | "RESOLVED" | "REJECTED" = "OPEN",
    circleIds: string[] = ["circle-a"],
  ): void {
    const key = `${organizationId}:${id}`;
    if (kind === "PROJECT") this.projects.add(key);
    else this.tensions.set(key, { status: tensionStatus, circleIds: [...circleIds] });
  }

  seedTacticalCandidate(
    kind: "PROJECT" | "ACTION",
    workObjectId: string,
    overrides: Partial<FakeTacticalCandidate> = {},
  ): void {
    this.tacticalCandidates.push({
      organizationId: "org-a",
      meetingId: "tactical-a",
      circleId: "circle-a",
      kind,
      workObjectId,
      status: "APPROVED",
      ...overrides,
    });
  }

  proposal(id: string): GoalProposalSnapshot | undefined {
    const proposal = this.proposals.get(id);
    return proposal ? cloneProposal(proposal) : undefined;
  }

  goal(id: string): GoalSnapshot | undefined {
    const goal = this.goals.get(id);
    return goal ? cloneGoal(goal) : undefined;
  }

  allGoals(): GoalSnapshot[] {
    return [...this.goals.values()].map(cloneGoal);
  }

  goalCheckIns(goalId: string): GoalCheckInSnapshot[] {
    return [...this.checkIns.values()].filter((row) => row.goalId === goalId).map(cloneCheckIn);
  }

  workLink(id: string): GoalWorkLinkSnapshot | undefined {
    const link = this.workLinks.get(id);
    return link ? cloneWorkLink(link) : undefined;
  }

  workObjectCounts(): { projects: number; tensions: number; tacticalCandidates: number } {
    return { projects: this.projects.size, tensions: this.tensions.size, tacticalCandidates: this.tacticalCandidates.length };
  }

  dependencies(): GoalDomainDependencies {
    return {
      now: () => new Date(this.now),
      randomId: () => `generated-${++this.idSequence}`,
      transaction: async (work, options) => {
        this.lastIsolationLevel = options?.isolationLevel;
        if (this.transactionFailure) {
          const error = this.transactionFailure;
          this.transactionFailure = undefined;
          throw error;
        }
        const pending: FakeState = {
          cycles: cloneMap(this.cycles),
          proposals: cloneProposalMap(this.proposals),
          goals: cloneGoalMap(this.goals),
          decisions: cloneDecisionMap(this.decisions),
          decisionResults: cloneDecisionResultMap(this.decisionResults),
          checkIns: cloneCheckInMap(this.checkIns),
          workLinks: cloneWorkLinkMap(this.workLinks),
        };
        let pendingWrites = 0;
        const transaction = this.transactionFor(pending, () => { pendingWrites += 1; });
        const result = await work(transaction);
        this.cycles = pending.cycles;
        this.proposals = pending.proposals;
        this.goals = pending.goals;
        this.decisions = pending.decisions;
        this.decisionResults = pending.decisionResults;
        this.checkIns = pending.checkIns;
        this.workLinks = pending.workLinks;
        this.writeCount += pendingWrites;
        return result;
      },
    };
  }

  private transactionFor(state: FakeState, wrote: () => void): GoalDomainTransaction {
    const maybeFailWrite = (): void => {
      if (this.failNextWrite) {
        const error = this.failNextWrite;
        this.failNextWrite = undefined;
        throw error;
      }
    };
    const maybeFailAfterWrite = (): void => {
      if (this.failAfterNextWrite) {
        const error = this.failAfterNextWrite;
        this.failAfterNextWrite = undefined;
        throw error;
      }
    };

    return {
      isCurrentOrgAdmin: async (actor) => this.admins.has(actorKey(actor)),
      isCurrentMember: async (actor) => this.members.has(actorKey(actor)),
      lockCycle: async ({ organizationId, cycleId }) => {
        const value = state.cycles.get(cycleId);
        return value?.organizationId === organizationId ? cloneCycle(value) : null;
      },
      createCycle: async (input) => {
        maybeFailWrite();
        const value: GoalCycleSnapshot = {
          ...input,
          status: "PLANNED",
          activatedAt: null,
          closedAt: null,
          cancelledAt: null,
        };
        state.cycles.set(value.id, cloneCycle(value));
        wrote();
        maybeFailAfterWrite();
        return cloneCycle(value);
      },
      updateCycle: async ({ organizationId, cycleId, expectedStatus, data }) => {
        maybeFailWrite();
        if (this.failNextCas) {
          this.failNextCas = false;
          return null;
        }
        const current = state.cycles.get(cycleId);
        if (!current || current.organizationId !== organizationId || current.status !== expectedStatus) return null;
        const { now, ...changes } = data;
        assert.equal(now.toISOString(), this.now.toISOString());
        const updated = { ...current, ...changes };
        state.cycles.set(cycleId, cloneCycle(updated));
        wrote();
        maybeFailAfterWrite();
        return cloneCycle(updated);
      },
      validateProposalReferences: async ({ organizationId, cycleId, circleId, kind, replacedGoalId, revision }) => {
        const replacedGoal = replacedGoalId ? state.goals.get(replacedGoalId) : null;
        const parentGoal = revision.parentGoalId ? state.goals.get(revision.parentGoalId) : null;
        const circleKey = `${organizationId}:${circleId}`;
        const circleParentId = this.circles.get(circleKey);
        return {
          cycleStatus: state.cycles.get(cycleId)?.organizationId === organizationId ? state.cycles.get(cycleId)!.status : null,
          circleExists: this.circles.has(circleKey),
          replacedGoalActive: kind === "CREATE" || Boolean(replacedGoal
            && replacedGoal.organizationId === organizationId
            && replacedGoal.cycleId === cycleId
            && replacedGoal.circleId === circleId
            && replacedGoal.status === "ACTIVE"),
          ownerRoleValid: kind === "CLOSE" || this.roles.has(`${organizationId}:${circleId}:${revision.ownerRoleId}`),
          parentGoalValid: kind === "CLOSE" || (circleParentId === null
            ? revision.parentGoalId === null
            : circleParentId !== undefined && Boolean(parentGoal
              && parentGoal.organizationId === organizationId
              && parentGoal.cycleId === cycleId
              && parentGoal.circleId === circleParentId
              && parentGoal.status === "ACTIVE")),
          metricsValid: revision.targets.every((target) => !target.metricId
            || this.metrics.has(`${organizationId}:${circleId}:${target.metricId}`)),
        };
      },
      createProposal: async (input) => {
        maybeFailWrite();
        const cycleStatus = state.cycles.get(input.cycleId)?.status;
        if (!cycleStatus) throw new GoalDomainError("CYCLE_NOT_FOUND");
        const proposal: GoalProposalSnapshot = {
          id: input.id,
          organizationId: input.organizationId,
          cycleId: input.cycleId,
          circleId: input.circleId,
          proposerId: input.proposerId,
          kind: input.kind,
          status: "DRAFT",
          replacedGoalId: input.replacedGoalId,
          currentRevision: 1,
          submittedAt: null,
          terminalAt: null,
          cycleStatus,
          revision: fakeRevision(input.revision, 1, input.proposerId, input.targetIds, input.now),
        };
        state.proposals.set(proposal.id, cloneProposal(proposal));
        wrote();
        maybeFailAfterWrite();
        return cloneProposal(proposal);
      },
      lockProposal: async ({ organizationId, proposalId }) => {
        const proposal = state.proposals.get(proposalId);
        if (!proposal || proposal.organizationId !== organizationId) return null;
        return cloneProposal({ ...proposal, cycleStatus: state.cycles.get(proposal.cycleId)?.status ?? proposal.cycleStatus });
      },
      appendProposalRevision: async ({ proposal, revision, targetIds, authoredById, now }) => {
        maybeFailWrite();
        if (this.failNextProposalCas) {
          this.failNextProposalCas = false;
          return null;
        }
        const current = state.proposals.get(proposal.id);
        if (!current || current.status !== "RETURNED" || current.currentRevision !== proposal.currentRevision) return null;
        const updated: GoalProposalSnapshot = {
          ...current,
          status: "DRAFT",
          currentRevision: current.currentRevision + 1,
          revision: fakeRevision(revision, current.currentRevision + 1, authoredById, targetIds, now),
        };
        state.proposals.set(updated.id, cloneProposal(updated));
        wrote();
        maybeFailAfterWrite();
        return cloneProposal(updated);
      },
      updateProposalStatus: async ({ organizationId, proposalId, proposerId, expectedRevision, expectedStatuses, status, now }) => {
        maybeFailWrite();
        if (this.failNextProposalCas) {
          this.failNextProposalCas = false;
          return null;
        }
        const current = state.proposals.get(proposalId);
        if (!current || current.organizationId !== organizationId || current.proposerId !== proposerId
          || current.currentRevision !== expectedRevision || !expectedStatuses.includes(current.status)) return null;
        const updated = {
          ...current,
          status,
          submittedAt: status === "SUBMITTED" ? new Date(now) : current.submittedAt,
          terminalAt: status === "WITHDRAWN" ? new Date(now) : current.terminalAt,
        };
        state.proposals.set(proposalId, cloneProposal(updated));
        wrote();
        maybeFailAfterWrite();
        return cloneProposal(updated);
      },
      lockMeeting: async ({ organizationId, meetingId }) => {
        const meeting = this.meetings.get(meetingId);
        return meeting?.organizationId === organizationId ? cloneMeeting(meeting) : null;
      },
      findDecisionByMutationKey: async ({ organizationId, mutationKey }) => {
        const decision = [...state.decisions.values()].find((candidate) => candidate.organizationId === organizationId && candidate.mutationKey === mutationKey);
        return decision ? cloneDecision(decision) : null;
      },
      findDecisionByRevision: async ({ organizationId, proposalId, revision }) => {
        const decision = [...state.decisions.values()].find((candidate) => candidate.organizationId === organizationId
          && candidate.proposalId === proposalId && candidate.revision === revision);
        return decision ? cloneDecision(decision) : null;
      },
      loadDecisionResult: async ({ organizationId, decisionId }) => {
        const result = state.decisionResults.get(decisionId);
        return result?.decision.organizationId === organizationId ? cloneDecisionResult(result) : null;
      },
      applyGoalDecision: async (input) => {
        maybeFailWrite();
        const current = state.proposals.get(input.proposal.id);
        const decision = {
          id: input.decisionId,
          organizationId: input.proposal.organizationId,
          proposalId: input.proposal.id,
          revision: input.proposal.currentRevision,
          outcome: input.outcome,
          meetingId: input.meetingId,
          recorderId: input.recorderId,
          mutationKey: input.mutationKey,
          note: input.note,
          decidedAt: new Date(input.now),
        };
        state.decisions.set(decision.id, cloneDecision(decision));
        if (this.failNextProposalCas || !current || current.status !== "SUBMITTED"
          || current.currentRevision !== input.proposal.currentRevision) {
          this.failNextProposalCas = false;
          return null;
        }
        state.proposals.set(current.id, cloneProposal({
          ...current,
          status: input.outcome,
          terminalAt: input.outcome === "ADOPTED" || input.outcome === "DECLINED" ? new Date(input.now) : null,
        }));
        if (input.outcome === "ADOPTED") applyFakeAdoption(state, input);
        wrote();
        maybeFailAfterWrite();
        const result = fakeDecisionResult(state, input.proposal.organizationId, input.decisionId);
        if (result) state.decisionResults.set(input.decisionId, cloneDecisionResult(result));
        return result;
      },
      lockGoalFollowUp: async ({ organizationId, goalId }) => {
        const goal = state.goals.get(goalId);
        if (!goal || goal.organizationId !== organizationId) return null;
        const role = this.followUpRoles.get(`${organizationId}:${goal.ownerRoleId}`);
        return {
          goal: cloneGoal(goal),
          ownerRoleActive: role?.active ?? false,
          ownerRoleAssigneeIds: [...(role?.assigneeIds ?? [])],
          checkIns: [...state.checkIns.values()].filter((row) => row.organizationId === organizationId && row.goalId === goalId).map(cloneCheckIn),
        };
      },
      insertGoalCheckIns: async ({ organizationId, goalId, recorderId, meetingId, rows, now }) => {
        maybeFailWrite();
        for (const row of rows) {
          if (row.supersedesCheckInId && [...state.checkIns.values()].some((existing) => existing.supersedesCheckInId === row.supersedesCheckInId)) {
            throw new GoalDomainError("CORRECTION_CONFLICT");
          }
        }
        const inserted = rows.map((row): GoalCheckInSnapshot => ({
          ...row,
          organizationId,
          goalId,
          recorderId,
          meetingId,
          recordedAt: new Date(now),
        }));
        for (const row of inserted) state.checkIns.set(row.id, cloneCheckIn(row));
        wrote();
        maybeFailAfterWrite();
        return inserted.map(cloneCheckIn);
      },
      validateWorkObject: async ({ organizationId, goalId, meetingId, circleId, kind, workObjectId }) => {
        const key = `${organizationId}:${workObjectId}`;
        const exists = kind === "PROJECT" ? this.projects.has(key) : this.tensions.has(key);
        const tension = this.tensions.get(key);
        const duplicateActive = [...state.workLinks.values()].some((link) => link.organizationId === organizationId
          && link.goalId === goalId && link.kind === kind && link.status === "ACTIVE"
          && (kind === "PROJECT" ? link.projectId === workObjectId : link.tensionId === workObjectId));
        return {
          exists,
          trustedTacticalCandidate: kind === "BLOCKING_TENSION" || this.tacticalCandidates.some((candidate) => (
            candidate.organizationId === organizationId
            && candidate.meetingId === meetingId
            && candidate.circleId === circleId
            && candidate.kind === kind
            && candidate.workObjectId === workObjectId
            && candidate.status === "APPROVED"
          )),
          blockingTension: kind !== "BLOCKING_TENSION"
            || Boolean(tension && tension.status !== "RESOLVED" && tension.status !== "REJECTED"
              && tension.circleIds.includes(circleId)),
          duplicateActive,
        };
      },
      createWorkLink: async ({ id, organizationId, goalId, kind, workObjectId, actorId, meetingId, now }) => {
        maybeFailWrite();
        const link: GoalWorkLinkSnapshot = {
          id,
          organizationId,
          goalId,
          kind,
          status: "ACTIVE",
          projectId: kind === "PROJECT" ? workObjectId : null,
          tensionId: kind === "PROJECT" ? null : workObjectId,
          createdById: actorId,
          createdMeetingId: meetingId,
          createdAt: new Date(now),
          removedById: null,
          removedMeetingId: null,
          removedAt: null,
          removalReason: null,
        };
        state.workLinks.set(id, cloneWorkLink(link));
        wrote();
        maybeFailAfterWrite();
        return cloneWorkLink(link);
      },
      lockWorkLink: async ({ organizationId, goalId, linkId }) => {
        const link = state.workLinks.get(linkId);
        return link?.organizationId === organizationId && link.goalId === goalId ? cloneWorkLink(link) : null;
      },
      removeWorkLink: async ({ organizationId, goalId, linkId, actorId, meetingId, reason, now }) => {
        maybeFailWrite();
        if (this.failNextWorkLinkCas) {
          this.failNextWorkLinkCas = false;
          return null;
        }
        const link = state.workLinks.get(linkId);
        if (!link || link.organizationId !== organizationId || link.goalId !== goalId || link.status !== "ACTIVE") return null;
        const removed: GoalWorkLinkSnapshot = {
          ...link,
          status: "REMOVED",
          removedById: actorId,
          removedMeetingId: meetingId,
          removedAt: new Date(now),
          removalReason: reason,
        };
        state.workLinks.set(linkId, cloneWorkLink(removed));
        wrote();
        maybeFailAfterWrite();
        return cloneWorkLink(removed);
      },
    };
  }
}

type FakeMeeting = {
  id: string;
  organizationId: string;
  circleId: string | null;
  type: "TACTICAL" | "GOVERNANCE" | "STRATEGY";
  endedAt: Date | null;
  participantIds: string[];
};

type FakeTacticalCandidate = {
  organizationId: string;
  meetingId: string;
  circleId: string;
  kind: "PROJECT" | "ACTION";
  workObjectId: string;
  status: "PROPOSED" | "APPROVED";
};

type FakeState = {
  cycles: Map<string, GoalCycleSnapshot>;
  proposals: Map<string, GoalProposalSnapshot>;
  goals: Map<string, GoalSnapshot>;
  decisions: Map<string, GoalDecisionResult["decision"]>;
  decisionResults: Map<string, GoalDecisionResult>;
  checkIns: Map<string, GoalCheckInSnapshot>;
  workLinks: Map<string, GoalWorkLinkSnapshot>;
};

type FakeRevisionInput = Parameters<GoalDomainTransaction["createProposal"]>[0]["revision"];
type FakeApplyInput = Parameters<GoalDomainTransaction["applyGoalDecision"]>[0];

function fakeRevision(
  revision: FakeRevisionInput,
  revisionNumber: number,
  authoredById: string,
  targetIds: string[],
  now: Date,
): GoalProposalSnapshot["revision"] {
  return {
    ...revision,
    revision: revisionNumber,
    authoredById,
    createdAt: new Date(now),
    targets: revision.targets.map((target, index) => ({ ...target, id: targetIds[index] })),
  };
}

function applyFakeAdoption(state: FakeState, input: FakeApplyInput): void {
  const proposal = input.proposal;
  if (proposal.kind === "REPLACE" || proposal.kind === "CLOSE") {
    const replaced = proposal.replacedGoalId ? state.goals.get(proposal.replacedGoalId) : null;
    if (!replaced || replaced.status !== "ACTIVE") throw new GoalDomainError("ACTIVE_GOAL_REQUIRED");
    if (proposal.kind === "CLOSE" && proposal.revision.closeResult === "ACHIEVED") {
      const evidenceSufficient = replaced.targets.length > 0 && replaced.targets.every((target) => {
        const checkIns = [...state.checkIns.values()].filter((row) => row.organizationId === replaced.organizationId
          && row.goalId === replaced.id && row.targetId === target.id);
        const supersededIds = new Set(checkIns.flatMap((row) => row.supersedesCheckInId ? [row.supersedesCheckInId] : []));
        const latest = checkIns
          .filter((row) => !supersededIds.has(row.id))
          .sort((left, right) => right.recordedAt.getTime() - left.recordedAt.getTime() || right.id.localeCompare(left.id))[0];
        return latest?.assessment === "ACHIEVED";
      });
      if (!evidenceSufficient) throw new GoalDomainError("GOAL_EVIDENCE_INSUFFICIENT");
    }
    state.goals.set(replaced.id, cloneGoal({
      ...replaced,
      status: proposal.kind === "REPLACE" ? "SUPERSEDED" : proposal.revision.closeResult ?? "NOT_ACHIEVED",
      terminalDecisionId: input.decisionId,
      terminalAt: new Date(input.now),
    }));
  }
  if (proposal.kind === "CLOSE") return;
  if (!input.goalId || !proposal.revision.title || !proposal.revision.intendedOutcome || !proposal.revision.ownerRoleId) {
    throw new GoalDomainError("CONSTRAINT_VIOLATION");
  }
  const goal: GoalSnapshot = {
    id: input.goalId,
    organizationId: proposal.organizationId,
    cycleId: proposal.cycleId,
    circleId: proposal.circleId,
    title: proposal.revision.title,
    intendedOutcome: proposal.revision.intendedOutcome,
    ownerRoleId: proposal.revision.ownerRoleId,
    parentGoalId: proposal.revision.parentGoalId,
    status: "ACTIVE",
    adoptedDecisionId: input.decisionId,
    terminalDecisionId: null,
    createdAt: new Date(input.now),
    terminalAt: null,
    targets: proposal.revision.targets.map((target, index) => ({
      ...target,
      id: input.goalTargetIds[index],
      goalId: input.goalId!,
      sourceProposalTargetId: target.id,
    })),
  };
  state.goals.set(goal.id, cloneGoal(goal));
}

function fakeDecisionResult(state: FakeState, organizationId: string, decisionId: string): GoalDecisionResult | null {
  const decision = state.decisions.get(decisionId);
  if (!decision || decision.organizationId !== organizationId) return null;
  const proposal = state.proposals.get(decision.proposalId);
  if (!proposal) return null;
  const adoptedGoal = [...state.goals.values()].find((goal) => goal.organizationId === organizationId && goal.adoptedDecisionId === decisionId);
  const terminalGoal = [...state.goals.values()].find((goal) => goal.organizationId === organizationId && goal.terminalDecisionId === decisionId);
  return {
    decision: cloneDecision(decision),
    proposal: cloneProposal(proposal),
    adoptedGoal: adoptedGoal ? cloneGoal(adoptedGoal) : null,
    terminalGoal: terminalGoal ? cloneGoal(terminalGoal) : null,
  };
}

function actorKey(actor: GoalDomainActor): string {
  return `${actor.userId}:${actor.personId}:${actor.organizationId}`;
}

function cloneMap(source: Map<string, GoalCycleSnapshot>): Map<string, GoalCycleSnapshot> {
  return new Map([...source].map(([id, value]) => [id, cloneCycle(value)]));
}

function cloneProposalMap(source: Map<string, GoalProposalSnapshot>): Map<string, GoalProposalSnapshot> {
  return new Map([...source].map(([id, value]) => [id, cloneProposal(value)]));
}

function cloneGoalMap(source: Map<string, GoalSnapshot>): Map<string, GoalSnapshot> {
  return new Map([...source].map(([id, value]) => [id, cloneGoal(value)]));
}

function cloneDecisionMap(
  source: Map<string, GoalDecisionResult["decision"]>,
): Map<string, GoalDecisionResult["decision"]> {
  return new Map([...source].map(([id, value]) => [id, cloneDecision(value)]));
}

function cloneDecisionResultMap(source: Map<string, GoalDecisionResult>): Map<string, GoalDecisionResult> {
  return new Map([...source].map(([id, value]) => [id, cloneDecisionResult(value)]));
}

function cloneCheckInMap(source: Map<string, GoalCheckInSnapshot>): Map<string, GoalCheckInSnapshot> {
  return new Map([...source].map(([id, value]) => [id, cloneCheckIn(value)]));
}

function cloneWorkLinkMap(source: Map<string, GoalWorkLinkSnapshot>): Map<string, GoalWorkLinkSnapshot> {
  return new Map([...source].map(([id, value]) => [id, cloneWorkLink(value)]));
}

function cloneCycle(value: GoalCycleSnapshot): GoalCycleSnapshot {
  return {
    ...value,
    startAt: new Date(value.startAt),
    endAt: new Date(value.endAt),
    activatedAt: value.activatedAt ? new Date(value.activatedAt) : null,
    closedAt: value.closedAt ? new Date(value.closedAt) : null,
    cancelledAt: value.cancelledAt ? new Date(value.cancelledAt) : null,
  };
}

function cloneProposal(value: GoalProposalSnapshot): GoalProposalSnapshot {
  return {
    ...value,
    submittedAt: value.submittedAt ? new Date(value.submittedAt) : null,
    terminalAt: value.terminalAt ? new Date(value.terminalAt) : null,
    revision: {
      ...value.revision,
      createdAt: new Date(value.revision.createdAt),
      targets: value.revision.targets.map((target) => ({ ...target })),
    },
  };
}

function cloneGoal(value: GoalSnapshot): GoalSnapshot {
  return {
    ...value,
    createdAt: new Date(value.createdAt),
    terminalAt: value.terminalAt ? new Date(value.terminalAt) : null,
    targets: value.targets.map((target) => ({ ...target })),
  };
}

function cloneDecision(value: GoalDecisionResult["decision"]): GoalDecisionResult["decision"] {
  return { ...value, decidedAt: new Date(value.decidedAt) };
}

function cloneDecisionResult(value: GoalDecisionResult): GoalDecisionResult {
  return {
    decision: cloneDecision(value.decision),
    proposal: cloneProposal(value.proposal),
    adoptedGoal: value.adoptedGoal ? cloneGoal(value.adoptedGoal) : null,
    terminalGoal: value.terminalGoal ? cloneGoal(value.terminalGoal) : null,
  };
}

function cloneCheckIn(value: GoalCheckInSnapshot): GoalCheckInSnapshot {
  return { ...value, recordedAt: new Date(value.recordedAt) };
}

function cloneWorkLink(value: GoalWorkLinkSnapshot): GoalWorkLinkSnapshot {
  return {
    ...value,
    createdAt: new Date(value.createdAt),
    removedAt: value.removedAt ? new Date(value.removedAt) : null,
  };
}

function cloneMeeting(value: FakeMeeting): FakeMeeting {
  return { ...value, endedAt: value.endedAt ? new Date(value.endedAt) : null, participantIds: [...value.participantIds] };
}
