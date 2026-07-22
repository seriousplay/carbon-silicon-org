import { randomUUID } from "node:crypto";

import { Prisma, type PrismaClient } from "@/generated/prisma/client";

export type GoalDomainErrorCode =
  | "INVALID_INPUT"
  | "ACTOR_CONTEXT_MISMATCH"
  | "FORBIDDEN"
  | "CYCLE_NOT_FOUND"
  | "CYCLE_NOT_PLANNED"
  | "CYCLE_NOT_ACTIVE"
  | "CYCLE_STATE_CONFLICT"
  | "ACTIVE_CYCLE_EXISTS"
  | "CYCLE_HAS_NON_TERMINAL_PROPOSALS"
  | "CYCLE_HAS_ACTIVE_GOALS"
  | "CYCLE_IMMUTABLE"
  | "CYCLE_NOT_AVAILABLE"
  | "CIRCLE_NOT_FOUND"
  | "ACTIVE_GOAL_REQUIRED"
  | "ACTIVE_GOAL_EXISTS"
  | "OWNER_ROLE_INVALID"
  | "PARENT_GOAL_INVALID"
  | "METRIC_INVALID"
  | "PROPOSAL_NOT_FOUND"
  | "PROPOSER_REQUIRED"
  | "PROPOSAL_NOT_RETURNED"
  | "PROPOSAL_NOT_DRAFT"
  | "PROPOSAL_NOT_WITHDRAWABLE"
  | "STALE_REVISION"
  | "PROPOSAL_STATE_CONFLICT"
  | "MEETING_NOT_FOUND"
  | "MEETING_INVALID"
  | "PROPOSER_NOT_PARTICIPANT"
  | "RECORDER_NOT_PARTICIPANT"
  | "ADOPTION_REQUIRES_ACTIVE_CYCLE"
  | "DECISION_CYCLE_TERMINAL"
  | "MUTATION_KEY_CONFLICT"
  | "DECISION_ALREADY_RECORDED"
  | "ORGANIZATION_INTEGRITY_GAP"
  | "GOAL_EVIDENCE_INSUFFICIENT"
  | "GOAL_NOT_FOUND"
  | "GOAL_NOT_ACTIVE"
  | "TARGET_NOT_FOUND"
  | "DUPLICATE_TARGET"
  | "FOLLOW_UP_AUTHORITY_REQUIRED"
  | "CHECK_IN_INVALID"
  | "CORRECTION_INVALID"
  | "CORRECTION_CONFLICT"
  | "SOURCE_URL_INVALID"
  | "WORK_OBJECT_NOT_FOUND"
  | "ACTION_NOT_APPROVED"
  | "WORK_LINK_ALREADY_ACTIVE"
  | "WORK_LINK_NOT_FOUND"
  | "WORK_LINK_STATE_CONFLICT"
  | "SERIALIZATION_CONFLICT"
  | "CONSTRAINT_VIOLATION"
  | "PERSISTENCE_FAILED";

export class GoalDomainError extends Error {
  constructor(readonly code: GoalDomainErrorCode) {
    super(code);
    this.name = "GoalDomainError";
  }
}

export type GoalCycleStatus = "PLANNED" | "ACTIVE" | "CLOSED" | "CANCELLED";
export type GoalProposalKind = "CREATE" | "REPLACE" | "CLOSE";
export type GoalProposalStatus = "DRAFT" | "SUBMITTED" | "ADOPTED" | "RETURNED" | "DECLINED" | "WITHDRAWN";
export type GoalCloseResult = "ACHIEVED" | "NOT_ACHIEVED";
export type GoalDecisionOutcome = "ADOPTED" | "RETURNED" | "DECLINED";
export type GoalStatus = "ACTIVE" | "SUPERSEDED" | "ACHIEVED" | "NOT_ACHIEVED";
export type GoalCheckInAssessment = "ON_TRACK" | "AT_RISK" | "OFF_TRACK" | "ACHIEVED";
export type GoalHealthStatus = Exclude<GoalStatus, "ACTIVE"> | "NOT_UPDATED" | "OFF_TRACK" | "AT_RISK" | "ON_TRACK";
export type GoalWorkLinkKind = "PROJECT" | "ACTION" | "BLOCKING_TENSION";
export type GoalWorkLinkStatus = "ACTIVE" | "REMOVED";

export type GoalDomainActor = {
  userId: string;
  personId: string;
  organizationId: string;
};

export type GoalCycleSnapshot = {
  id: string;
  organizationId: string;
  name: string;
  status: GoalCycleStatus;
  startAt: Date;
  endAt: Date;
  checkInCadenceDays: number;
  activatedAt: Date | null;
  closedAt: Date | null;
  cancelledAt: Date | null;
};

export type GoalProposalTargetInput =
  | { kind: "NUMERIC"; label: string; baselineValue: string | number; desiredValue: string | number; unit: string; metricId?: string }
  | { kind: "MILESTONE"; label: string; acceptanceCriteria: string };

export type GoalProposalTargetSnapshot = {
  id: string;
  position: number;
  label: string;
  kind: "NUMERIC" | "MILESTONE";
  baselineValue: string | null;
  desiredValue: string | null;
  unit: string | null;
  acceptanceCriteria: string | null;
  metricId: string | null;
};

export type GoalProposalRevisionInput = {
  title?: string;
  intendedOutcome?: string;
  ownerRoleId?: string;
  parentGoalId?: string | null;
  closeResult?: GoalCloseResult;
  conclusion?: string;
  targets?: GoalProposalTargetInput[];
};

export type GoalProposalRevisionSnapshot = {
  revision: number;
  title: string | null;
  intendedOutcome: string | null;
  ownerRoleId: string | null;
  parentGoalId: string | null;
  closeResult: GoalCloseResult | null;
  conclusion: string | null;
  authoredById: string;
  createdAt: Date;
  targets: GoalProposalTargetSnapshot[];
};

export type GoalProposalSnapshot = {
  id: string;
  organizationId: string;
  cycleId: string;
  circleId: string;
  proposerId: string;
  kind: GoalProposalKind;
  status: GoalProposalStatus;
  replacedGoalId: string | null;
  currentRevision: number;
  submittedAt: Date | null;
  terminalAt: Date | null;
  cycleStatus: GoalCycleStatus;
  revision: GoalProposalRevisionSnapshot;
};

export type GoalTargetSnapshot = GoalProposalTargetSnapshot & {
  goalId: string;
  sourceProposalTargetId: string;
};

export type GoalSnapshot = {
  id: string;
  organizationId: string;
  cycleId: string;
  circleId: string;
  title: string;
  intendedOutcome: string;
  ownerRoleId: string;
  parentGoalId: string | null;
  status: GoalStatus;
  adoptedDecisionId: string;
  terminalDecisionId: string | null;
  createdAt: Date;
  terminalAt: Date | null;
  targets: GoalTargetSnapshot[];
};

export type GoalCheckInInput = {
  targetId: string;
  fact: string;
  evidenceSummary: string;
  assessment: GoalCheckInAssessment;
  currentValue?: string | number;
  milestoneCompleted?: boolean;
  acceptanceEvidence?: string;
  sourceUrl?: string;
  supersedesCheckInId?: string;
};

export type GoalCheckInSnapshot = {
  id: string;
  organizationId: string;
  goalId: string;
  targetId: string;
  fact: string;
  evidenceSummary: string;
  currentValue: string | null;
  milestoneCompleted: boolean | null;
  acceptanceEvidence: string | null;
  assessment: GoalCheckInAssessment;
  recorderId: string;
  meetingId: string | null;
  sourceUrl: string | null;
  supersedesCheckInId: string | null;
  recordedAt: Date;
};

export type AppendGoalCheckInsInput = {
  organizationId: string;
  goalId: string;
  actor: GoalDomainActor;
  meetingId?: string;
  entries: GoalCheckInInput[];
};

export type GoalHealthInput = {
  goal: Pick<GoalSnapshot, "id" | "status">;
  cycle: Pick<GoalCycleSnapshot, "endAt" | "checkInCadenceDays">;
  targets: GoalTargetSnapshot[];
  checkIns: GoalCheckInSnapshot[];
  now: Date;
};

export type GoalTargetHealthEvidence = {
  targetId: string;
  effectiveCheckIn: GoalCheckInSnapshot | null;
  stale: boolean;
};

export type GoalHealthResult = {
  status: GoalHealthStatus;
  targets: GoalTargetHealthEvidence[];
};

export type GoalWorkLinkSnapshot = {
  id: string;
  organizationId: string;
  goalId: string;
  kind: GoalWorkLinkKind;
  status: GoalWorkLinkStatus;
  projectId: string | null;
  tensionId: string | null;
  createdById: string;
  createdMeetingId: string | null;
  createdAt: Date;
  removedById: string | null;
  removedMeetingId: string | null;
  removedAt: Date | null;
  removalReason: string | null;
};

export type CreateGoalWorkLinkInput = {
  organizationId: string;
  goalId: string;
  actor: GoalDomainActor;
  kind: GoalWorkLinkKind;
  workObjectId: string;
  meetingId?: string;
};

export type RemoveGoalWorkLinkInput = {
  organizationId: string;
  goalId: string;
  linkId: string;
  actor: GoalDomainActor;
  meetingId?: string;
  reason: string;
};

export type GoalDecisionSnapshot = {
  id: string;
  organizationId: string;
  proposalId: string;
  revision: number;
  outcome: GoalDecisionOutcome;
  meetingId: string;
  recorderId: string;
  mutationKey: string;
  note: string | null;
  decidedAt: Date;
};

export type GoalDecisionResult = {
  decision: GoalDecisionSnapshot;
  proposal: GoalProposalSnapshot;
  adoptedGoal: GoalSnapshot | null;
  terminalGoal: GoalSnapshot | null;
};

type GoalCycleFields = Pick<GoalCycleSnapshot, "name" | "startAt" | "endAt" | "checkInCadenceDays">;

export type CreateGoalCycleInput = GoalCycleFields & {
  organizationId: string;
  actor: GoalDomainActor;
};

export type EditPlannedGoalCycleInput = {
  organizationId: string;
  cycleId: string;
  actor: GoalDomainActor;
  name?: string;
  startAt?: Date;
  endAt?: Date;
  checkInCadenceDays?: number;
};

export type GoalCycleTransitionInput = {
  organizationId: string;
  cycleId: string;
  actor: GoalDomainActor;
};

export type CreateGoalProposalInput = {
  organizationId: string;
  cycleId: string;
  circleId: string;
  actor: GoalDomainActor;
  kind: GoalProposalKind;
  replacedGoalId?: string;
  revision: GoalProposalRevisionInput;
};

export type AppendGoalProposalRevisionInput = {
  organizationId: string;
  proposalId: string;
  expectedRevision: number;
  actor: GoalDomainActor;
  revision: GoalProposalRevisionInput;
};

export type GoalProposalTransitionInput = {
  organizationId: string;
  proposalId: string;
  expectedRevision: number;
  actor: GoalDomainActor;
};

export type DecideGoalProposalInput = GoalProposalTransitionInput & {
  outcome: GoalDecisionOutcome;
  meetingId: string;
  mutationKey: string;
  note?: string;
};

type GoalProposalReferenceValidation = {
  cycleStatus: GoalCycleStatus | null;
  circleExists: boolean;
  replacedGoalActive: boolean;
  ownerRoleValid: boolean;
  parentGoalValid: boolean;
  metricsValid: boolean;
};

type GoalMeetingSnapshot = {
  id: string;
  organizationId: string;
  circleId: string | null;
  type: "TACTICAL" | "GOVERNANCE" | "STRATEGY";
  endedAt: Date | null;
  participantIds: string[];
};

type NormalizedRevision = Omit<GoalProposalRevisionSnapshot, "revision" | "authoredById" | "createdAt">;

type ApplyGoalDecisionInput = {
  proposal: GoalProposalSnapshot;
  outcome: GoalDecisionOutcome;
  meetingId: string;
  recorderId: string;
  mutationKey: string;
  note: string | null;
  decisionId: string;
  goalId: string | null;
  goalTargetIds: string[];
  now: Date;
};

type GoalFollowUpContext = {
  goal: GoalSnapshot;
  ownerRoleActive: boolean;
  ownerRoleAssigneeIds: string[];
  checkIns: GoalCheckInSnapshot[];
};

type PreparedGoalCheckIn = Omit<GoalCheckInSnapshot, "id" | "organizationId" | "goalId" | "recorderId" | "meetingId" | "recordedAt">;

type GoalWorkObjectValidation = {
  exists: boolean;
  trustedTacticalCandidate: boolean;
  blockingTension: boolean;
  duplicateActive: boolean;
};

export interface GoalDomainTransaction {
  isCurrentOrgAdmin(actor: GoalDomainActor): Promise<boolean>;
  isCurrentMember(actor: GoalDomainActor): Promise<boolean>;
  lockCycle(input: { organizationId: string; cycleId: string }): Promise<GoalCycleSnapshot | null>;
  createCycle(input: GoalCycleFields & { id: string; organizationId: string; now: Date }): Promise<GoalCycleSnapshot>;
  updateCycle(input: {
    organizationId: string;
    cycleId: string;
    expectedStatus: GoalCycleStatus;
    data: Partial<GoalCycleFields> & {
      status?: GoalCycleStatus;
      activatedAt?: Date | null;
      closedAt?: Date | null;
      cancelledAt?: Date | null;
      now: Date;
    };
  }): Promise<GoalCycleSnapshot | null>;
  validateProposalReferences(input: {
    organizationId: string;
    cycleId: string;
    circleId: string;
    kind: GoalProposalKind;
    replacedGoalId: string | null;
    revision: NormalizedRevision;
  }): Promise<GoalProposalReferenceValidation>;
  createProposal(input: {
    id: string;
    organizationId: string;
    cycleId: string;
    circleId: string;
    proposerId: string;
    kind: GoalProposalKind;
    replacedGoalId: string | null;
    revision: NormalizedRevision;
    targetIds: string[];
    now: Date;
  }): Promise<GoalProposalSnapshot>;
  lockProposal(input: { organizationId: string; proposalId: string }): Promise<GoalProposalSnapshot | null>;
  appendProposalRevision(input: {
    proposal: GoalProposalSnapshot;
    revision: NormalizedRevision;
    targetIds: string[];
    authoredById: string;
    now: Date;
  }): Promise<GoalProposalSnapshot | null>;
  updateProposalStatus(input: {
    organizationId: string;
    proposalId: string;
    proposerId: string;
    expectedRevision: number;
    expectedStatuses: GoalProposalStatus[];
    status: "SUBMITTED" | "WITHDRAWN";
    now: Date;
  }): Promise<GoalProposalSnapshot | null>;
  lockMeeting(input: { organizationId: string; meetingId: string }): Promise<GoalMeetingSnapshot | null>;
  findDecisionByMutationKey(input: { organizationId: string; mutationKey: string }): Promise<GoalDecisionSnapshot | null>;
  findDecisionByRevision(input: { organizationId: string; proposalId: string; revision: number }): Promise<GoalDecisionSnapshot | null>;
  loadDecisionResult(input: { organizationId: string; decisionId: string }): Promise<GoalDecisionResult | null>;
  applyGoalDecision(input: ApplyGoalDecisionInput): Promise<GoalDecisionResult | null>;
  lockGoalFollowUp(input: {
    organizationId: string;
    goalId: string;
    supersedesCheckInIds: string[];
  }): Promise<GoalFollowUpContext | null>;
  insertGoalCheckIns(input: {
    organizationId: string;
    goalId: string;
    recorderId: string;
    meetingId: string | null;
    rows: Array<PreparedGoalCheckIn & { id: string }>;
    now: Date;
  }): Promise<GoalCheckInSnapshot[]>;
  validateWorkObject(input: {
    organizationId: string;
    goalId: string;
    meetingId: string;
    circleId: string;
    kind: GoalWorkLinkKind;
    workObjectId: string;
  }): Promise<GoalWorkObjectValidation>;
  createWorkLink(input: {
    id: string;
    organizationId: string;
    goalId: string;
    kind: GoalWorkLinkKind;
    workObjectId: string;
    actorId: string;
    meetingId: string | null;
    now: Date;
  }): Promise<GoalWorkLinkSnapshot>;
  lockWorkLink(input: { organizationId: string; goalId: string; linkId: string }): Promise<GoalWorkLinkSnapshot | null>;
  removeWorkLink(input: {
    organizationId: string;
    goalId: string;
    linkId: string;
    actorId: string;
    meetingId: string | null;
    reason: string;
    now: Date;
  }): Promise<GoalWorkLinkSnapshot | null>;
}

export interface GoalDomainDependencies {
  transaction<T>(
    work: (transaction: GoalDomainTransaction) => Promise<T>,
    options?: { isolationLevel: "Serializable" },
  ): Promise<T>;
  now?(): Date;
  randomId?(): string;
}

export async function createGoalCycle(
  input: CreateGoalCycleInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalCycleSnapshot> {
  const organizationId = requiredId(input.organizationId);
  const actor = normalizeActor(input.actor);
  const fields = normalizeFields(input);

  return runTransaction(dependencies, async (transaction, now, randomId) => {
    await authorizeActor(transaction, organizationId, actor);
    return transaction.createCycle({
      id: randomId(),
      organizationId,
      ...fields,
      now,
    });
  });
}

export async function editPlannedGoalCycle(
  input: EditPlannedGoalCycleInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalCycleSnapshot> {
  const organizationId = requiredId(input.organizationId);
  const cycleId = requiredId(input.cycleId);
  const actor = normalizeActor(input.actor);
  const patch = normalizePatch(input);

  return runTransaction(dependencies, async (transaction, now) => {
    await authorizeActor(transaction, organizationId, actor);
    const cycle = await requireLockedCycle(transaction, organizationId, cycleId);
    requireStatus(cycle, "PLANNED");
    normalizeFields({ ...cycle, ...patch });
    return requireCas(await transaction.updateCycle({
      organizationId,
      cycleId,
      expectedStatus: "PLANNED",
      data: { ...patch, now },
    }));
  });
}

export async function activateGoalCycle(
  input: GoalCycleTransitionInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalCycleSnapshot> {
  return transitionCycle(input, dependencies, "PLANNED", "ACTIVE");
}

export async function cancelGoalCycle(
  input: GoalCycleTransitionInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalCycleSnapshot> {
  return transitionCycle(input, dependencies, "PLANNED", "CANCELLED");
}

export async function closeGoalCycle(
  input: GoalCycleTransitionInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalCycleSnapshot> {
  return transitionCycle(input, dependencies, "ACTIVE", "CLOSED");
}

export async function createGoalProposal(
  input: CreateGoalProposalInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalProposalSnapshot> {
  const organizationId = requiredId(input.organizationId);
  const cycleId = requiredId(input.cycleId);
  const circleId = requiredId(input.circleId);
  const actor = normalizeActor(input.actor);
  const kind = normalizeProposalKind(input.kind);
  const replacedGoalId = input.replacedGoalId === undefined ? null : requiredId(input.replacedGoalId);
  validateReplacedGoalShape(kind, replacedGoalId);
  const revision = normalizeRevision(kind, input.revision);

  return runTransaction(dependencies, async (transaction, now, randomId) => {
    await authorizeMember(transaction, organizationId, actor);
    assertProposalReferences(await transaction.validateProposalReferences({
      organizationId,
      cycleId,
      circleId,
      kind,
      replacedGoalId,
      revision,
    }), kind);
    return transaction.createProposal({
      id: randomId(),
      organizationId,
      cycleId,
      circleId,
      proposerId: actor.personId,
      kind,
      replacedGoalId,
      revision,
      targetIds: revision.targets.map(() => randomId()),
      now,
    });
  });
}

export async function appendGoalProposalRevision(
  input: AppendGoalProposalRevisionInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalProposalSnapshot> {
  const organizationId = requiredId(input.organizationId);
  const proposalId = requiredId(input.proposalId);
  const expectedRevision = positiveInteger(input.expectedRevision);
  const actor = normalizeActor(input.actor);

  return runTransaction(dependencies, async (transaction, now, randomId) => {
    await authorizeMember(transaction, organizationId, actor);
    const proposal = await requireLockedProposal(transaction, organizationId, proposalId);
    requireProposer(proposal, actor);
    requireRevision(proposal, expectedRevision);
    if (proposal.status !== "RETURNED") throw new GoalDomainError("PROPOSAL_NOT_RETURNED");
    const revision = normalizeRevision(proposal.kind, input.revision);
    assertProposalReferences(await transaction.validateProposalReferences({
      organizationId,
      cycleId: proposal.cycleId,
      circleId: proposal.circleId,
      kind: proposal.kind,
      replacedGoalId: proposal.replacedGoalId,
      revision,
    }), proposal.kind);
    const updated = await transaction.appendProposalRevision({
      proposal,
      revision,
      targetIds: revision.targets.map(() => randomId()),
      authoredById: actor.personId,
      now,
    });
    if (!updated) throw new GoalDomainError("PROPOSAL_STATE_CONFLICT");
    return updated;
  });
}

export async function submitGoalProposal(
  input: GoalProposalTransitionInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalProposalSnapshot> {
  return transitionProposal(input, dependencies, "SUBMITTED");
}

export async function withdrawGoalProposal(
  input: GoalProposalTransitionInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalProposalSnapshot> {
  return transitionProposal(input, dependencies, "WITHDRAWN");
}

export async function decideGoalProposal(
  input: DecideGoalProposalInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalDecisionResult> {
  const organizationId = requiredId(input.organizationId);
  const proposalId = requiredId(input.proposalId);
  const expectedRevision = positiveInteger(input.expectedRevision);
  const actor = normalizeActor(input.actor);
  const meetingId = requiredId(input.meetingId);
  const mutationKey = requiredText(input.mutationKey, 200);
  const outcome = normalizeDecisionOutcome(input.outcome);
  const note = optionalText(input.note, 2_000);

  return runTransaction(dependencies, async (transaction, now, randomId) => {
    await authorizeMember(transaction, organizationId, actor);
    const proposal = await requireLockedProposal(transaction, organizationId, proposalId);
    const meeting = await transaction.lockMeeting({ organizationId, meetingId });
    validateDecisionMeeting(meeting, proposal, actor);

    const existingKey = await transaction.findDecisionByMutationKey({ organizationId, mutationKey });
    if (existingKey) {
      if (!sameDecisionTuple(existingKey, { proposalId, revision: expectedRevision, outcome, meetingId, recorderId: actor.personId, mutationKey, note })) {
        throw new GoalDomainError("MUTATION_KEY_CONFLICT");
      }
      const replay = await transaction.loadDecisionResult({ organizationId, decisionId: existingKey.id });
      if (!replay) throw new GoalDomainError("CONSTRAINT_VIOLATION");
      return replay;
    }
    requireRevision(proposal, expectedRevision);
    if (await transaction.findDecisionByRevision({ organizationId, proposalId, revision: expectedRevision })) {
      throw new GoalDomainError("DECISION_ALREADY_RECORDED");
    }
    if (proposal.status !== "SUBMITTED") throw new GoalDomainError("PROPOSAL_STATE_CONFLICT");
    if (outcome === "ADOPTED" && proposal.cycleStatus !== "ACTIVE") {
      throw new GoalDomainError("ADOPTION_REQUIRES_ACTIVE_CYCLE");
    }
    if (outcome !== "ADOPTED" && !["PLANNED", "ACTIVE"].includes(proposal.cycleStatus)) {
      throw new GoalDomainError("DECISION_CYCLE_TERMINAL");
    }

    const result = await transaction.applyGoalDecision({
      proposal,
      outcome,
      meetingId,
      recorderId: actor.personId,
      mutationKey,
      note,
      decisionId: randomId(),
      goalId: outcome === "ADOPTED" && proposal.kind !== "CLOSE" ? randomId() : null,
      goalTargetIds: outcome === "ADOPTED" && proposal.kind !== "CLOSE"
        ? proposal.revision.targets.map(() => randomId())
        : [],
      now,
    });
    if (!result) throw new GoalDomainError("PROPOSAL_STATE_CONFLICT");
    return result;
  });
}

export async function appendGoalCheckIns(
  input: AppendGoalCheckInsInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalCheckInSnapshot[]> {
  const organizationId = requiredId(input.organizationId);
  const goalId = requiredId(input.goalId);
  const actor = normalizeActor(input.actor);
  const meetingId = input.meetingId === undefined ? null : requiredId(input.meetingId);
  if (!Array.isArray(input.entries) || input.entries.length === 0) throw new GoalDomainError("INVALID_INPUT");
  if (input.entries.some((entry) => entry === null || typeof entry !== "object" || Array.isArray(entry))) {
    throw new GoalDomainError("CHECK_IN_INVALID");
  }
  const targetIds = input.entries.map((entry) => requiredId(entry.targetId));
  if (new Set(targetIds).size !== targetIds.length) throw new GoalDomainError("DUPLICATE_TARGET");
  const supersedesCheckInIds = input.entries.flatMap((entry) => entry.supersedesCheckInId
    ? [requiredId(entry.supersedesCheckInId)]
    : []);

  return runTransaction(dependencies, async (transaction, now, randomId) => {
    await authorizeMember(transaction, organizationId, actor);
    const context = await requireGoalFollowUp(transaction, organizationId, goalId, supersedesCheckInIds);
    requireActiveGoal(context.goal);
    const meetingAuthorized = await authorizeFollowUpMeeting(
      transaction,
      context.goal,
      actor,
      meetingId,
      ["TACTICAL", "STRATEGY"],
    );
    requireFollowUpAuthority(context, actor, meetingAuthorized);
    const targets = new Map(context.goal.targets.map((target) => [target.id, target]));
    const rows = input.entries.map((entry, index) => prepareCheckIn(
      entry,
      targetIds[index],
      targets.get(targetIds[index]),
      context.checkIns,
      now,
    ));
    return transaction.insertGoalCheckIns({
      organizationId,
      goalId,
      recorderId: actor.personId,
      meetingId,
      rows: rows.map((row) => ({ ...row, id: randomId() })),
      now,
    });
  });
}

export function deriveGoalHealth(input: GoalHealthInput): GoalHealthResult {
  const now = validDate(input.now);
  const endAt = validDate(input.cycle.endAt);
  if (!Number.isInteger(input.cycle.checkInCadenceDays) || input.cycle.checkInCadenceDays <= 0
    || !Array.isArray(input.targets) || input.targets.length === 0 || !Array.isArray(input.checkIns)) {
    throw new GoalDomainError("INVALID_INPUT");
  }
  const supersededIds = new Set(input.checkIns.flatMap((row) => row.supersedesCheckInId ? [row.supersedesCheckInId] : []));
  const cadenceMs = input.cycle.checkInCadenceDays * 86_400_000;
  const targets = input.targets.map((target): GoalTargetHealthEvidence => {
    const effectiveCheckIn = input.checkIns
      .filter((row) => row.goalId === input.goal.id && row.targetId === target.id && !supersededIds.has(row.id))
      .sort(compareEffectiveCheckIns)[0] ?? null;
    const stale = Boolean(effectiveCheckIn && effectiveCheckIn.assessment !== "ACHIEVED"
      && now.getTime() - effectiveCheckIn.recordedAt.getTime() > cadenceMs);
    return { targetId: target.id, effectiveCheckIn, stale };
  });

  if (input.goal.status !== "ACTIVE") return { status: input.goal.status, targets };
  if (targets.every((target) => target.effectiveCheckIn === null)) return { status: "NOT_UPDATED", targets };
  if (now.getTime() > endAt.getTime()) return { status: "OFF_TRACK", targets };
  if (targets.every((target) => target.effectiveCheckIn?.assessment === "ACHIEVED")) return { status: "ACHIEVED", targets };
  if (targets.some((target) => target.effectiveCheckIn?.assessment === "OFF_TRACK")) return { status: "OFF_TRACK", targets };
  if (targets.some((target) => target.effectiveCheckIn === null
    || target.effectiveCheckIn.assessment === "AT_RISK" || target.stale)) {
    return { status: "AT_RISK", targets };
  }
  return { status: "ON_TRACK", targets };
}

export async function createGoalWorkLink(
  input: CreateGoalWorkLinkInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalWorkLinkSnapshot> {
  const organizationId = requiredId(input.organizationId);
  const goalId = requiredId(input.goalId);
  const actor = normalizeActor(input.actor);
  const kind = normalizeWorkLinkKind(input.kind);
  const workObjectId = requiredId(input.workObjectId);
  const meetingId = input.meetingId === undefined ? null : requiredId(input.meetingId);

  return runTransaction(dependencies, async (transaction, now, randomId) => {
    await authorizeMember(transaction, organizationId, actor);
    const context = await requireGoalFollowUp(transaction, organizationId, goalId, []);
    requireActiveGoal(context.goal);
    const meetingAuthorized = await authorizeFollowUpMeeting(transaction, context.goal, actor, meetingId, ["TACTICAL"]);
    requireWorkLinkAuthority(meetingId, meetingAuthorized);
    const work = await transaction.validateWorkObject({
      organizationId,
      goalId,
      meetingId,
      circleId: context.goal.circleId,
      kind,
      workObjectId,
    });
    if (!work.exists) throw new GoalDomainError("WORK_OBJECT_NOT_FOUND");
    if (kind === "PROJECT" && !work.trustedTacticalCandidate) throw new GoalDomainError("WORK_OBJECT_NOT_FOUND");
    if (kind === "ACTION" && !work.trustedTacticalCandidate) throw new GoalDomainError("ACTION_NOT_APPROVED");
    if (kind === "BLOCKING_TENSION" && !work.blockingTension) throw new GoalDomainError("WORK_OBJECT_NOT_FOUND");
    if (work.duplicateActive) throw new GoalDomainError("WORK_LINK_ALREADY_ACTIVE");
    return transaction.createWorkLink({
      id: randomId(),
      organizationId,
      goalId,
      kind,
      workObjectId,
      actorId: actor.personId,
      meetingId,
      now,
    });
  });
}

export async function removeGoalWorkLink(
  input: RemoveGoalWorkLinkInput,
  dependencies: GoalDomainDependencies,
): Promise<GoalWorkLinkSnapshot> {
  const organizationId = requiredId(input.organizationId);
  const goalId = requiredId(input.goalId);
  const linkId = requiredId(input.linkId);
  const actor = normalizeActor(input.actor);
  const meetingId = input.meetingId === undefined ? null : requiredId(input.meetingId);
  const reason = requiredText(input.reason, 2_000);

  return runTransaction(dependencies, async (transaction, now) => {
    await authorizeMember(transaction, organizationId, actor);
    const context = await requireGoalFollowUp(transaction, organizationId, goalId, []);
    const meetingAuthorized = await authorizeFollowUpMeeting(transaction, context.goal, actor, meetingId, ["TACTICAL"]);
    requireWorkLinkAuthority(meetingId, meetingAuthorized);
    const link = await transaction.lockWorkLink({ organizationId, goalId, linkId });
    if (!link) throw new GoalDomainError("WORK_LINK_NOT_FOUND");
    if (link.status !== "ACTIVE") throw new GoalDomainError("WORK_LINK_STATE_CONFLICT");
    const removed = await transaction.removeWorkLink({
      organizationId,
      goalId,
      linkId,
      actorId: actor.personId,
      meetingId,
      reason,
      now,
    });
    if (!removed) throw new GoalDomainError("WORK_LINK_STATE_CONFLICT");
    return removed;
  });
}

export function createPrismaGoalDomainDependencies(client: PrismaClient): GoalDomainDependencies {
  return {
    transaction: (work) => client.$transaction(
      async (transaction) => {
        await transaction.$queryRaw(Prisma.sql`SELECT set_config('TimeZone', 'UTC', true)`);
        return work(prismaGoalDomainTransaction(transaction));
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    ),
  };
}

export function createPrismaGoalDomainTransactionDependencies(
  client: Prisma.TransactionClient,
): GoalDomainDependencies {
  return {
    transaction: async (work) => {
      await client.$queryRaw(Prisma.sql`SELECT set_config('TimeZone', 'UTC', true)`);
      return work(prismaGoalDomainTransaction(client));
    },
  };
}

async function transitionCycle(
  input: GoalCycleTransitionInput,
  dependencies: GoalDomainDependencies,
  expectedStatus: "PLANNED" | "ACTIVE",
  status: "ACTIVE" | "CANCELLED" | "CLOSED",
): Promise<GoalCycleSnapshot> {
  const organizationId = requiredId(input.organizationId);
  const cycleId = requiredId(input.cycleId);
  const actor = normalizeActor(input.actor);

  return runTransaction(dependencies, async (transaction, now) => {
    await authorizeActor(transaction, organizationId, actor);
    const cycle = await requireLockedCycle(transaction, organizationId, cycleId);
    requireStatus(cycle, expectedStatus);
    const lifecycleData = status === "ACTIVE"
      ? { status, activatedAt: now, closedAt: null, cancelledAt: null }
      : status === "CANCELLED"
        ? { status, activatedAt: null, closedAt: null, cancelledAt: now }
        : { status, closedAt: now, cancelledAt: null };
    return requireCas(await transaction.updateCycle({
      organizationId,
      cycleId,
      expectedStatus,
      data: { ...lifecycleData, now },
    }));
  });
}

async function transitionProposal(
  input: GoalProposalTransitionInput,
  dependencies: GoalDomainDependencies,
  status: "SUBMITTED" | "WITHDRAWN",
): Promise<GoalProposalSnapshot> {
  const organizationId = requiredId(input.organizationId);
  const proposalId = requiredId(input.proposalId);
  const expectedRevision = positiveInteger(input.expectedRevision);
  const actor = normalizeActor(input.actor);

  return runTransaction(dependencies, async (transaction, now) => {
    await authorizeMember(transaction, organizationId, actor);
    const proposal = await requireLockedProposal(transaction, organizationId, proposalId);
    requireProposer(proposal, actor);
    requireRevision(proposal, expectedRevision);
    if (status === "SUBMITTED" && proposal.status !== "DRAFT") throw new GoalDomainError("PROPOSAL_NOT_DRAFT");
    if (status === "WITHDRAWN" && !["DRAFT", "RETURNED", "SUBMITTED"].includes(proposal.status)) {
      throw new GoalDomainError("PROPOSAL_NOT_WITHDRAWABLE");
    }
    const updated = await transaction.updateProposalStatus({
      organizationId,
      proposalId,
      proposerId: actor.personId,
      expectedRevision,
      expectedStatuses: status === "SUBMITTED" ? ["DRAFT"] : ["DRAFT", "RETURNED", "SUBMITTED"],
      status,
      now,
    });
    if (!updated) throw new GoalDomainError("PROPOSAL_STATE_CONFLICT");
    return updated;
  });
}

async function runTransaction<T>(
  dependencies: GoalDomainDependencies,
  work: (transaction: GoalDomainTransaction, now: Date, randomId: () => string) => Promise<T>,
): Promise<T> {
  const now = dependencies.now?.() ?? new Date();
  const randomId = dependencies.randomId ?? randomUUID;
  try {
    return await dependencies.transaction(
      (transaction) => work(transaction, now, randomId),
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    throw translateDatabaseError(error);
  }
}

async function authorizeActor(
  transaction: GoalDomainTransaction,
  organizationId: string,
  actor: GoalDomainActor,
): Promise<void> {
  if (actor.organizationId !== organizationId) throw new GoalDomainError("ACTOR_CONTEXT_MISMATCH");
  if (!await transaction.isCurrentOrgAdmin(actor)) throw new GoalDomainError("FORBIDDEN");
}

async function authorizeMember(
  transaction: GoalDomainTransaction,
  organizationId: string,
  actor: GoalDomainActor,
): Promise<void> {
  if (actor.organizationId !== organizationId) throw new GoalDomainError("ACTOR_CONTEXT_MISMATCH");
  if (!await transaction.isCurrentMember(actor)) throw new GoalDomainError("FORBIDDEN");
}

async function requireLockedCycle(
  transaction: GoalDomainTransaction,
  organizationId: string,
  cycleId: string,
): Promise<GoalCycleSnapshot> {
  const cycle = await transaction.lockCycle({ organizationId, cycleId });
  if (!cycle) throw new GoalDomainError("CYCLE_NOT_FOUND");
  return cycle;
}

async function requireLockedProposal(
  transaction: GoalDomainTransaction,
  organizationId: string,
  proposalId: string,
): Promise<GoalProposalSnapshot> {
  const proposal = await transaction.lockProposal({ organizationId, proposalId });
  if (!proposal) throw new GoalDomainError("PROPOSAL_NOT_FOUND");
  return proposal;
}

function requireProposer(proposal: GoalProposalSnapshot, actor: GoalDomainActor): void {
  if (proposal.proposerId !== actor.personId) throw new GoalDomainError("PROPOSER_REQUIRED");
}

function requireRevision(proposal: GoalProposalSnapshot, expectedRevision: number): void {
  if (proposal.currentRevision !== expectedRevision) throw new GoalDomainError("STALE_REVISION");
}

function assertProposalReferences(
  validation: GoalProposalReferenceValidation,
  kind: GoalProposalKind,
): void {
  if (!validation.cycleStatus) throw new GoalDomainError("CYCLE_NOT_FOUND");
  if (!["PLANNED", "ACTIVE"].includes(validation.cycleStatus)) throw new GoalDomainError("CYCLE_NOT_AVAILABLE");
  if (!validation.circleExists) throw new GoalDomainError("CIRCLE_NOT_FOUND");
  if (kind !== "CREATE" && !validation.replacedGoalActive) throw new GoalDomainError("ACTIVE_GOAL_REQUIRED");
  if (kind !== "CLOSE" && !validation.ownerRoleValid) throw new GoalDomainError("OWNER_ROLE_INVALID");
  if (kind !== "CLOSE" && !validation.parentGoalValid) throw new GoalDomainError("PARENT_GOAL_INVALID");
  if (kind !== "CLOSE" && !validation.metricsValid) throw new GoalDomainError("METRIC_INVALID");
}

function validateDecisionMeeting(
  meeting: GoalMeetingSnapshot | null,
  proposal: GoalProposalSnapshot,
  actor: GoalDomainActor,
): void {
  if (!meeting) throw new GoalDomainError("MEETING_NOT_FOUND");
  if (meeting.organizationId !== proposal.organizationId || meeting.circleId !== proposal.circleId
    || meeting.type !== "STRATEGY" || meeting.endedAt !== null) {
    throw new GoalDomainError("MEETING_INVALID");
  }
  if (!meeting.participantIds.includes(proposal.proposerId)) throw new GoalDomainError("PROPOSER_NOT_PARTICIPANT");
  if (!meeting.participantIds.includes(actor.personId)) throw new GoalDomainError("RECORDER_NOT_PARTICIPANT");
}

async function requireGoalFollowUp(
  transaction: GoalDomainTransaction,
  organizationId: string,
  goalId: string,
  supersedesCheckInIds: string[],
): Promise<GoalFollowUpContext> {
  const context = await transaction.lockGoalFollowUp({ organizationId, goalId, supersedesCheckInIds });
  if (!context) throw new GoalDomainError("GOAL_NOT_FOUND");
  return context;
}

function requireActiveGoal(goal: GoalSnapshot): void {
  if (goal.status !== "ACTIVE") throw new GoalDomainError("GOAL_NOT_ACTIVE");
}

async function authorizeFollowUpMeeting(
  transaction: GoalDomainTransaction,
  goal: GoalSnapshot,
  actor: GoalDomainActor,
  meetingId: string | null,
  allowedTypes: Array<GoalMeetingSnapshot["type"]>,
): Promise<boolean> {
  if (!meetingId) return false;
  const meeting = await transaction.lockMeeting({ organizationId: goal.organizationId, meetingId });
  if (!meeting) throw new GoalDomainError("MEETING_NOT_FOUND");
  if (meeting.circleId !== goal.circleId || meeting.endedAt !== null || !allowedTypes.includes(meeting.type)) {
    throw new GoalDomainError("MEETING_INVALID");
  }
  if (!meeting.participantIds.includes(actor.personId)) throw new GoalDomainError("RECORDER_NOT_PARTICIPANT");
  return true;
}

function requireFollowUpAuthority(
  context: GoalFollowUpContext,
  actor: GoalDomainActor,
  meetingAuthorized: boolean,
): void {
  const roleAuthorized = context.ownerRoleActive && context.ownerRoleAssigneeIds.includes(actor.personId);
  if (!roleAuthorized && !meetingAuthorized) throw new GoalDomainError("FOLLOW_UP_AUTHORITY_REQUIRED");
}

function requireWorkLinkAuthority(
  meetingId: string | null,
  meetingAuthorized: boolean,
): asserts meetingId is string {
  if (!meetingId || !meetingAuthorized) throw new GoalDomainError("FOLLOW_UP_AUTHORITY_REQUIRED");
}

function sameDecisionTuple(
  decision: GoalDecisionSnapshot,
  expected: Omit<GoalDecisionSnapshot, "id" | "organizationId" | "decidedAt">,
): boolean {
  return decision.proposalId === expected.proposalId
    && decision.revision === expected.revision
    && decision.outcome === expected.outcome
    && decision.meetingId === expected.meetingId
    && decision.recorderId === expected.recorderId
    && decision.mutationKey === expected.mutationKey
    && decision.note === expected.note;
}

function requireStatus(cycle: GoalCycleSnapshot, expectedStatus: "PLANNED" | "ACTIVE"): void {
  if (cycle.status === "CLOSED" || cycle.status === "CANCELLED") {
    throw new GoalDomainError("CYCLE_IMMUTABLE");
  }
  if (cycle.status !== expectedStatus) {
    throw new GoalDomainError(expectedStatus === "PLANNED" ? "CYCLE_NOT_PLANNED" : "CYCLE_NOT_ACTIVE");
  }
}

function requireCas(cycle: GoalCycleSnapshot | null): GoalCycleSnapshot {
  if (!cycle) throw new GoalDomainError("CYCLE_STATE_CONFLICT");
  return cycle;
}

function normalizeActor(actor: GoalDomainActor): GoalDomainActor {
  if (!actor || typeof actor !== "object") throw new GoalDomainError("INVALID_INPUT");
  return {
    userId: requiredId(actor.userId),
    personId: requiredId(actor.personId),
    organizationId: requiredId(actor.organizationId),
  };
}

function normalizeProposalKind(value: unknown): GoalProposalKind {
  if (value === "CREATE" || value === "REPLACE" || value === "CLOSE") return value;
  throw new GoalDomainError("INVALID_INPUT");
}

function normalizeDecisionOutcome(value: unknown): GoalDecisionOutcome {
  if (value === "ADOPTED" || value === "RETURNED" || value === "DECLINED") return value;
  throw new GoalDomainError("INVALID_INPUT");
}

function normalizeWorkLinkKind(value: unknown): GoalWorkLinkKind {
  if (value === "PROJECT" || value === "ACTION" || value === "BLOCKING_TENSION") return value;
  throw new GoalDomainError("INVALID_INPUT");
}

function validateReplacedGoalShape(kind: GoalProposalKind, replacedGoalId: string | null): void {
  if ((kind === "CREATE") !== (replacedGoalId === null)) throw new GoalDomainError("INVALID_INPUT");
}

function normalizeRevision(kind: GoalProposalKind, input: GoalProposalRevisionInput): NormalizedRevision {
  if (!input || typeof input !== "object") throw new GoalDomainError("INVALID_INPUT");
  if (kind === "CLOSE") {
    if (input.closeResult !== "ACHIEVED" && input.closeResult !== "NOT_ACHIEVED") {
      throw new GoalDomainError("INVALID_INPUT");
    }
    if (input.title !== undefined || input.intendedOutcome !== undefined || input.ownerRoleId !== undefined
      || input.parentGoalId !== undefined || (input.targets?.length ?? 0) !== 0) {
      throw new GoalDomainError("INVALID_INPUT");
    }
    return {
      title: null,
      intendedOutcome: null,
      ownerRoleId: null,
      parentGoalId: null,
      closeResult: input.closeResult,
      conclusion: requiredText(input.conclusion, 4_000),
      targets: [],
    };
  }
  if (input.closeResult !== undefined || input.conclusion !== undefined || !Array.isArray(input.targets) || input.targets.length === 0) {
    throw new GoalDomainError("INVALID_INPUT");
  }
  return {
    title: requiredText(input.title, 500),
    intendedOutcome: requiredText(input.intendedOutcome, 4_000),
    ownerRoleId: requiredId(input.ownerRoleId),
    parentGoalId: input.parentGoalId === undefined || input.parentGoalId === null ? null : requiredId(input.parentGoalId),
    closeResult: null,
    conclusion: null,
    targets: input.targets.map(normalizeTarget),
  };
}

function normalizeTarget(input: GoalProposalTargetInput, position: number): GoalProposalTargetSnapshot {
  if (!input || typeof input !== "object") throw new GoalDomainError("INVALID_INPUT");
  const raw = input as unknown as Record<string, unknown>;
  const label = requiredText(input.label, 500);
  if (input.kind === "NUMERIC") {
    if (raw.acceptanceCriteria !== undefined) throw new GoalDomainError("INVALID_INPUT");
    const baselineValue = decimalText(input.baselineValue);
    const desiredValue = decimalText(input.desiredValue);
    if (baselineValue === desiredValue) throw new GoalDomainError("INVALID_INPUT");
    return {
      id: "",
      position,
      label,
      kind: "NUMERIC",
      baselineValue,
      desiredValue,
      unit: requiredText(input.unit, 100),
      acceptanceCriteria: null,
      metricId: input.metricId === undefined ? null : requiredId(input.metricId),
    };
  }
  if (input.kind === "MILESTONE") {
    if (raw.baselineValue !== undefined || raw.desiredValue !== undefined || raw.unit !== undefined || raw.metricId !== undefined) {
      throw new GoalDomainError("INVALID_INPUT");
    }
    return {
      id: "",
      position,
      label,
      kind: "MILESTONE",
      baselineValue: null,
      desiredValue: null,
      unit: null,
      acceptanceCriteria: requiredText(input.acceptanceCriteria, 4_000),
      metricId: null,
    };
  }
  throw new GoalDomainError("INVALID_INPUT");
}

function decimalText(value: unknown): string {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : value;
  if (typeof text !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(text)) throw new GoalDomainError("INVALID_INPUT");
  const negative = text.startsWith("-");
  const [integerPart, fractionalPart = ""] = (negative ? text.slice(1) : text).split(".");
  const integer = integerPart.replace(/^0+(?=\d)/, "");
  const fraction = fractionalPart.replace(/0+$/, "");
  if (integer.length + fraction.length > 30 || fraction.length > 10) throw new GoalDomainError("INVALID_INPUT");
  const normalized = `${integer}${fraction ? `.${fraction}` : ""}`;
  return negative && normalized !== "0" ? `-${normalized}` : normalized;
}

function prepareCheckIn(
  input: GoalCheckInInput,
  targetId: string,
  target: GoalTargetSnapshot | undefined,
  existing: GoalCheckInSnapshot[],
  now: Date,
): PreparedGoalCheckIn {
  if (!target) throw new GoalDomainError("TARGET_NOT_FOUND");
  if (!input || typeof input !== "object") throw new GoalDomainError("CHECK_IN_INVALID");
  const raw = input as unknown as Record<string, unknown>;
  const assessment = normalizeAssessment(input.assessment);
  const fact = requiredCheckInText(input.fact, 4_000);
  const evidenceSummary = requiredCheckInText(input.evidenceSummary, 4_000);
  const sourceUrl = normalizeSourceUrl(input.sourceUrl);
  const supersedesCheckInId = input.supersedesCheckInId === undefined ? null : requiredId(input.supersedesCheckInId);
  if (supersedesCheckInId) {
    const superseded = existing.find((row) => row.id === supersedesCheckInId);
    if (!superseded || superseded.targetId !== targetId || now.getTime() <= superseded.recordedAt.getTime()) {
      throw new GoalDomainError("CORRECTION_INVALID");
    }
    if (existing.some((row) => row.supersedesCheckInId === supersedesCheckInId)) {
      throw new GoalDomainError("CORRECTION_CONFLICT");
    }
  }

  if (target.kind === "NUMERIC") {
    if (raw.milestoneCompleted !== undefined || raw.acceptanceEvidence !== undefined || input.currentValue === undefined) {
      throw new GoalDomainError("CHECK_IN_INVALID");
    }
    const currentValue = decimalText(input.currentValue);
    if (assessment === "ACHIEVED" && !numericTargetReached(target, currentValue)) {
      throw new GoalDomainError("CHECK_IN_INVALID");
    }
    return {
      targetId,
      fact,
      evidenceSummary,
      currentValue,
      milestoneCompleted: null,
      acceptanceEvidence: null,
      assessment,
      sourceUrl,
      supersedesCheckInId,
    };
  }

  if (raw.currentValue !== undefined || typeof input.milestoneCompleted !== "boolean") {
    throw new GoalDomainError("CHECK_IN_INVALID");
  }
  const acceptanceEvidence = optionalText(input.acceptanceEvidence, 4_000);
  if (assessment === "ACHIEVED" && (input.milestoneCompleted !== true || !acceptanceEvidence)) {
    throw new GoalDomainError("CHECK_IN_INVALID");
  }
  return {
    targetId,
    fact,
    evidenceSummary,
    currentValue: null,
    milestoneCompleted: input.milestoneCompleted,
    acceptanceEvidence,
    assessment,
    sourceUrl,
    supersedesCheckInId,
  };
}

function normalizeAssessment(value: unknown): GoalCheckInAssessment {
  if (value === "ON_TRACK" || value === "AT_RISK" || value === "OFF_TRACK" || value === "ACHIEVED") return value;
  throw new GoalDomainError("CHECK_IN_INVALID");
}

function requiredCheckInText(value: unknown, maxBytes: number): string {
  try {
    return requiredText(value, maxBytes);
  } catch {
    throw new GoalDomainError("CHECK_IN_INVALID");
  }
}

function normalizeSourceUrl(value: unknown): string | null {
  try {
    const text = optionalText(value, 2_000);
    if (!text) return null;
    const url = new URL(text);
    if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("unsupported protocol");
    return text;
  } catch {
    throw new GoalDomainError("SOURCE_URL_INVALID");
  }
}

function numericTargetReached(target: GoalTargetSnapshot, currentValue: string): boolean {
  if (target.baselineValue === null || target.desiredValue === null) return false;
  const direction = compareDecimalValues(target.desiredValue, target.baselineValue);
  const currentToDesired = compareDecimalValues(currentValue, target.desiredValue);
  return direction > 0 ? currentToDesired >= 0 : currentToDesired <= 0;
}

function compareDecimalValues(left: string, right: string): number {
  const leftParts = decimalParts(left);
  const rightParts = decimalParts(right);
  const scale = Math.max(leftParts.scale, rightParts.scale);
  const leftInteger = leftParts.value * BigInt(10) ** BigInt(scale - leftParts.scale);
  const rightInteger = rightParts.value * BigInt(10) ** BigInt(scale - rightParts.scale);
  return leftInteger < rightInteger ? -1 : leftInteger > rightInteger ? 1 : 0;
}

function decimalParts(value: string): { value: bigint; scale: number } {
  const normalized = decimalText(value);
  const negative = normalized.startsWith("-");
  const [integer, fraction = ""] = (negative ? normalized.slice(1) : normalized).split(".");
  const magnitude = BigInt(`${integer}${fraction}`);
  return { value: negative ? -magnitude : magnitude, scale: fraction.length };
}

function compareEffectiveCheckIns(left: GoalCheckInSnapshot, right: GoalCheckInSnapshot): number {
  const time = right.recordedAt.getTime() - left.recordedAt.getTime();
  if (time !== 0) return time;
  if (left.id === right.id) return 0;
  return left.id > right.id ? -1 : 1;
}

function positiveInteger(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) <= 0) throw new GoalDomainError("INVALID_INPUT");
  return value as number;
}

function optionalText(value: unknown, maxBytes: number): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") throw new GoalDomainError("INVALID_INPUT");
  const normalized = value.trim();
  if (Buffer.byteLength(normalized, "utf8") > maxBytes) throw new GoalDomainError("INVALID_INPUT");
  return normalized || null;
}

function normalizeFields(input: GoalCycleFields): GoalCycleFields {
  const name = requiredText(input.name, 200);
  const startAt = validDate(input.startAt);
  const endAt = validDate(input.endAt);
  if (startAt.getTime() >= endAt.getTime()) throw new GoalDomainError("INVALID_INPUT");
  if (!Number.isInteger(input.checkInCadenceDays) || input.checkInCadenceDays <= 0) {
    throw new GoalDomainError("INVALID_INPUT");
  }
  return { name, startAt, endAt, checkInCadenceDays: input.checkInCadenceDays };
}

function normalizePatch(input: EditPlannedGoalCycleInput): Partial<GoalCycleFields> {
  const patch: Partial<GoalCycleFields> = {};
  if (input.name !== undefined) patch.name = requiredText(input.name, 200);
  if (input.startAt !== undefined) patch.startAt = validDate(input.startAt);
  if (input.endAt !== undefined) patch.endAt = validDate(input.endAt);
  if (input.checkInCadenceDays !== undefined) {
    if (!Number.isInteger(input.checkInCadenceDays) || input.checkInCadenceDays <= 0) {
      throw new GoalDomainError("INVALID_INPUT");
    }
    patch.checkInCadenceDays = input.checkInCadenceDays;
  }
  if (Object.keys(patch).length === 0) throw new GoalDomainError("INVALID_INPUT");
  return patch;
}

function requiredId(value: unknown): string {
  return requiredText(value, 200);
}

function requiredText(value: unknown, maxBytes: number): string {
  if (typeof value !== "string") throw new GoalDomainError("INVALID_INPUT");
  const normalized = value.trim();
  if (!normalized || Buffer.byteLength(normalized, "utf8") > maxBytes) {
    throw new GoalDomainError("INVALID_INPUT");
  }
  return normalized;
}

function validDate(value: unknown): Date {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new GoalDomainError("INVALID_INPUT");
  }
  return new Date(value);
}

function prismaGoalDomainTransaction(client: Prisma.TransactionClient): GoalDomainTransaction {
  const cycleSelect = {
    id: true,
    organizationId: true,
    name: true,
    status: true,
    startAt: true,
    endAt: true,
    checkInCadenceDays: true,
    activatedAt: true,
    closedAt: true,
    cancelledAt: true,
  } as const;

  const isCurrentMember = async (actor: GoalDomainActor, role?: "ORG_ADMIN"): Promise<boolean> => {
    const person = await client.person.findFirst({
      where: { id: actor.personId, userId: actor.userId, organizationId: actor.organizationId },
      select: { id: true },
    });
    if (!person) return false;
    return await client.membership.findFirst({
      where: { userId: actor.userId, organizationId: actor.organizationId, ...(role ? { role } : {}) },
      select: { id: true },
    }) !== null;
  };

  const loadProposal = async (
    organizationId: string,
    proposalId: string,
    snapshotRevision?: number,
    snapshotStatus?: GoalProposalStatus,
  ): Promise<GoalProposalSnapshot | null> => {
    const proposal = await client.goalProposal.findFirst({
      where: { id: proposalId, organizationId },
      select: {
        id: true,
        organizationId: true,
        cycleId: true,
        circleId: true,
        proposerId: true,
        kind: true,
        status: true,
        replacedGoalId: true,
        currentRevision: true,
        submittedAt: true,
        terminalAt: true,
      },
    });
    if (!proposal) return null;
    const revisionNumber = snapshotRevision ?? proposal.currentRevision;
    const [cycle, revision, targets] = await Promise.all([
      client.goalCycle.findFirst({ where: { id: proposal.cycleId, organizationId }, select: { status: true } }),
      client.goalProposalRevision.findFirst({
        where: { organizationId, proposalId, revision: revisionNumber },
        select: {
          revision: true,
          title: true,
          intendedOutcome: true,
          ownerRoleId: true,
          parentGoalId: true,
          closeResult: true,
          conclusion: true,
          authoredById: true,
          createdAt: true,
        },
      }),
      client.goalProposalTarget.findMany({
        where: { organizationId, proposalId, revision: revisionNumber },
        orderBy: { position: "asc" },
        select: {
          id: true,
          position: true,
          label: true,
          kind: true,
          baselineValue: true,
          desiredValue: true,
          unit: true,
          acceptanceCriteria: true,
          metricId: true,
        },
      }),
    ]);
    if (!cycle || !revision) throw new GoalDomainError("CONSTRAINT_VIOLATION");
    return {
      ...proposal,
      status: snapshotStatus ?? proposal.status,
      currentRevision: revisionNumber,
      terminalAt: snapshotStatus === "RETURNED" ? null : proposal.terminalAt,
      cycleStatus: cycle.status,
      revision: {
        ...revision,
        targets: targets.map(proposalTargetSnapshot),
      },
    };
  };

  const loadGoal = async (where: { organizationId: string; id?: string; adoptedDecisionId?: string; terminalDecisionId?: string }): Promise<GoalSnapshot | null> => {
    const goal = await client.goal.findFirst({
      where,
      select: {
        id: true,
        organizationId: true,
        cycleId: true,
        circleId: true,
        title: true,
        intendedOutcome: true,
        ownerRoleId: true,
        parentGoalId: true,
        status: true,
        adoptedDecisionId: true,
        terminalDecisionId: true,
        createdAt: true,
        terminalAt: true,
        targets: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            goalId: true,
            sourceProposalTargetId: true,
            position: true,
            label: true,
            kind: true,
            baselineValue: true,
            desiredValue: true,
            unit: true,
            acceptanceCriteria: true,
            metricId: true,
          },
        },
      },
    });
    if (!goal) return null;
    return { ...goal, targets: goal.targets.map(goalTargetSnapshot) };
  };

  const loadDecisionResult = async (organizationId: string, decisionId: string): Promise<GoalDecisionResult | null> => {
    const decision = await client.goalDecision.findFirst({
      where: { id: decisionId, organizationId },
      select: decisionSelect,
    });
    if (!decision) return null;
    const [proposal, adoptedGoal, terminalGoal] = await Promise.all([
      loadProposal(organizationId, decision.proposalId, decision.revision, decision.outcome),
      loadGoal({ organizationId, adoptedDecisionId: decisionId }),
      loadGoal({ organizationId, terminalDecisionId: decisionId }),
    ]);
    if (!proposal) throw new GoalDomainError("CONSTRAINT_VIOLATION");
    return { decision, proposal, adoptedGoal, terminalGoal };
  };

  return {
    isCurrentOrgAdmin: (actor) => isCurrentMember(actor, "ORG_ADMIN"),
    isCurrentMember,
    lockCycle: async ({ organizationId, cycleId }) => {
      await client.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "goal_cycles"
        WHERE "id" = ${cycleId} AND "organizationId" = ${organizationId}
        FOR UPDATE
      `);
      return client.goalCycle.findFirst({
        where: { id: cycleId, organizationId },
        select: cycleSelect,
      });
    },
    createCycle: ({ id, organizationId, name, startAt, endAt, checkInCadenceDays, now }) => client.goalCycle.create({
      data: {
        id,
        organizationId,
        name,
        status: "PLANNED",
        startAt,
        endAt,
        checkInCadenceDays,
        activatedAt: null,
        closedAt: null,
        cancelledAt: null,
        createdAt: now,
        updatedAt: now,
      },
      select: cycleSelect,
    }),
    updateCycle: async ({ organizationId, cycleId, expectedStatus, data }) => {
      const { now, ...cycleData } = data;
      const updated = await client.goalCycle.updateMany({
        where: { id: cycleId, organizationId, status: expectedStatus },
        data: { ...cycleData, updatedAt: now },
      });
      if (updated.count !== 1) return null;
      return client.goalCycle.findFirst({
        where: { id: cycleId, organizationId },
        select: cycleSelect,
      });
    },
    validateProposalReferences: async ({ organizationId, cycleId, circleId, kind, replacedGoalId, revision }) => {
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "goal_cycles" WHERE "id" = ${cycleId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "circles" WHERE "id" = ${circleId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      if (replacedGoalId) {
        await client.$queryRaw(Prisma.sql`SELECT "id" FROM "goals" WHERE "id" = ${replacedGoalId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      }
      if (revision.ownerRoleId) {
        await client.$queryRaw(Prisma.sql`SELECT "id" FROM "role_defs" WHERE "id" = ${revision.ownerRoleId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      }
      if (revision.parentGoalId) {
        await client.$queryRaw(Prisma.sql`SELECT "id" FROM "goals" WHERE "id" = ${revision.parentGoalId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      }
      const metricIds = [...new Set(revision.targets.flatMap((target) => target.metricId ? [target.metricId] : []))];
      if (metricIds.length > 0) {
        await client.$queryRaw(Prisma.sql`SELECT "id" FROM "metrics" WHERE "organizationId" = ${organizationId} AND "id" IN (${Prisma.join(metricIds)}) FOR UPDATE`);
      }
      const [cycle, circle, replacedGoal, ownerRole, parentGoal, metrics] = await Promise.all([
        client.goalCycle.findFirst({ where: { id: cycleId, organizationId }, select: { status: true } }),
        client.circle.findFirst({ where: { id: circleId, organizationId }, select: { id: true, parentId: true } }),
        replacedGoalId ? client.goal.findFirst({
          where: { id: replacedGoalId, organizationId, cycleId, circleId, status: "ACTIVE" },
          select: { id: true },
        }) : Promise.resolve(null),
        revision.ownerRoleId ? client.roleDef.findFirst({
          where: { id: revision.ownerRoleId, organizationId, circleId, status: "ACTIVE" },
          select: { id: true },
        }) : Promise.resolve(null),
        revision.parentGoalId ? client.goal.findFirst({
          where: { id: revision.parentGoalId, organizationId, cycleId, status: "ACTIVE" },
          select: { id: true, circleId: true },
        }) : Promise.resolve(null),
        metricIds.length > 0 ? client.metric.count({ where: { id: { in: metricIds }, organizationId, circleId } }) : Promise.resolve(0),
      ]);
      return {
        cycleStatus: cycle?.status ?? null,
        circleExists: circle !== null,
        replacedGoalActive: kind === "CREATE" || replacedGoal !== null,
        ownerRoleValid: kind === "CLOSE" || ownerRole !== null,
        parentGoalValid: circle !== null && (circle.parentId === null
          ? revision.parentGoalId === null
          : revision.parentGoalId !== null && parentGoal?.circleId === circle.parentId),
        metricsValid: metrics === metricIds.length,
      };
    },
    createProposal: async (input) => {
      await client.goalProposal.create({
        data: {
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
          createdAt: input.now,
          updatedAt: input.now,
        },
      });
      await createPrismaProposalRevision(client, { ...input, proposalId: input.id, revisionNumber: 1, authoredById: input.proposerId });
      const created = await loadProposal(input.organizationId, input.id);
      if (!created) throw new GoalDomainError("CONSTRAINT_VIOLATION");
      return created;
    },
    lockProposal: async ({ organizationId, proposalId }) => {
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "goal_proposals" WHERE "id" = ${proposalId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      return loadProposal(organizationId, proposalId);
    },
    appendProposalRevision: async ({ proposal, revision, targetIds, authoredById, now }) => {
      const nextRevision = proposal.currentRevision + 1;
      const updated = await client.goalProposal.updateMany({
        where: {
          id: proposal.id,
          organizationId: proposal.organizationId,
          proposerId: authoredById,
          status: "RETURNED",
          currentRevision: proposal.currentRevision,
        },
        data: { status: "DRAFT", currentRevision: nextRevision, updatedAt: now },
      });
      if (updated.count !== 1) return null;
      await createPrismaProposalRevision(client, {
        organizationId: proposal.organizationId,
        proposalId: proposal.id,
        revision,
        revisionNumber: nextRevision,
        authoredById,
        targetIds,
        now,
      });
      return loadProposal(proposal.organizationId, proposal.id);
    },
    updateProposalStatus: async ({ organizationId, proposalId, proposerId, expectedRevision, expectedStatuses, status, now }) => {
      const updated = await client.goalProposal.updateMany({
        where: { id: proposalId, organizationId, proposerId, currentRevision: expectedRevision, status: { in: expectedStatuses } },
        data: {
          status,
          ...(status === "SUBMITTED" ? { submittedAt: now } : { terminalAt: now }),
          updatedAt: now,
        },
      });
      if (updated.count !== 1) return null;
      return loadProposal(organizationId, proposalId);
    },
    lockMeeting: async ({ organizationId, meetingId }) => {
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "meetings" WHERE "id" = ${meetingId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      const meeting = await client.meeting.findFirst({
        where: { id: meetingId, organizationId },
        select: { id: true, organizationId: true, circleId: true, type: true, endedAt: true, participants: { select: { id: true } } },
      });
      return meeting ? { ...meeting, participantIds: meeting.participants.map(({ id }) => id) } : null;
    },
    findDecisionByMutationKey: ({ organizationId, mutationKey }) => client.goalDecision.findFirst({
      where: { organizationId, mutationKey },
      select: decisionSelect,
    }),
    findDecisionByRevision: ({ organizationId, proposalId, revision }) => client.goalDecision.findFirst({
      where: { organizationId, proposalId, revision },
      select: decisionSelect,
    }),
    loadDecisionResult: ({ organizationId, decisionId }) => loadDecisionResult(organizationId, decisionId),
    applyGoalDecision: async (input) => {
      await client.goalDecision.create({
        data: {
          id: input.decisionId,
          organizationId: input.proposal.organizationId,
          proposalId: input.proposal.id,
          revision: input.proposal.currentRevision,
          outcome: input.outcome,
          meetingId: input.meetingId,
          recorderId: input.recorderId,
          mutationKey: input.mutationKey,
          note: input.note,
          decidedAt: input.now,
        },
      });
      const updated = await client.goalProposal.updateMany({
        where: {
          id: input.proposal.id,
          organizationId: input.proposal.organizationId,
          currentRevision: input.proposal.currentRevision,
          status: "SUBMITTED",
        },
        data: {
          status: input.outcome,
          ...(input.outcome === "ADOPTED" || input.outcome === "DECLINED" ? { terminalAt: input.now } : {}),
          updatedAt: input.now,
        },
      });
      if (updated.count !== 1) return null;
      if (input.outcome === "ADOPTED") await applyPrismaGoalAdoption(client, input);
      return loadDecisionResult(input.proposal.organizationId, input.decisionId);
    },
    lockGoalFollowUp: async ({ organizationId, goalId, supersedesCheckInIds }) => {
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "goals" WHERE "id" = ${goalId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "goal_targets" WHERE "goalId" = ${goalId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      if (supersedesCheckInIds.length > 0) {
        await client.$queryRaw(Prisma.sql`SELECT "id" FROM "goal_check_ins" WHERE "organizationId" = ${organizationId} AND "goalId" = ${goalId} AND "id" IN (${Prisma.join(supersedesCheckInIds)}) FOR UPDATE`);
      }
      const goal = await loadGoal({ organizationId, id: goalId });
      if (!goal) return null;
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "role_defs" WHERE "id" = ${goal.ownerRoleId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      const [ownerRole, checkIns] = await Promise.all([
        client.roleDef.findFirst({
          where: { id: goal.ownerRoleId, organizationId },
          select: { status: true, assignees: { select: { id: true } } },
        }),
        client.goalCheckIn.findMany({ where: { organizationId, goalId }, select: checkInSelect }),
      ]);
      return {
        goal,
        ownerRoleActive: ownerRole?.status === "ACTIVE",
        ownerRoleAssigneeIds: ownerRole?.assignees.map(({ id }) => id) ?? [],
        checkIns: checkIns.map(checkInSnapshot),
      };
    },
    insertGoalCheckIns: async ({ organizationId, goalId, recorderId, meetingId, rows, now }) => {
      await client.goalCheckIn.createMany({
        data: rows.map((row) => ({
          ...row,
          organizationId,
          goalId,
          recorderId,
          meetingId,
          recordedAt: now,
        })),
      });
      const inserted = await client.goalCheckIn.findMany({
        where: { organizationId, goalId, id: { in: rows.map(({ id }) => id) } },
        select: checkInSelect,
      });
      const insertedById = new Map(inserted.map((row) => [row.id, checkInSnapshot(row)]));
      return rows.map(({ id }) => {
        const checkIn = insertedById.get(id);
        if (!checkIn) throw new GoalDomainError("CONSTRAINT_VIOLATION");
        return checkIn;
      });
    },
    validateWorkObject: async ({ organizationId, goalId, meetingId, circleId, kind, workObjectId }) => {
      if (kind === "PROJECT") {
        await client.$queryRaw(Prisma.sql`SELECT "id" FROM "projects" WHERE "id" = ${workObjectId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      } else {
        await client.$queryRaw(Prisma.sql`SELECT "id" FROM "tensions" WHERE "id" = ${workObjectId} AND "organizationId" = ${organizationId} FOR UPDATE`);
      }
      const [exists, trustedTacticalCandidate, duplicateActive] = await Promise.all([
        kind === "PROJECT"
          ? client.project.findFirst({ where: { id: workObjectId, organizationId }, select: { id: true } })
          : client.tension.findFirst({
            where: {
              id: workObjectId,
              organizationId,
              ...(kind === "BLOCKING_TENSION"
                ? { circles: { some: { id: circleId, organizationId } } }
                : {}),
            },
            select: { id: true, status: true },
          }),
        kind === "PROJECT" || kind === "ACTION" ? client.tacticalOutcomeProposal.findFirst({
          where: {
            organizationId,
            meetingId,
            circleId,
            kind,
            status: "APPROVED",
            ...(kind === "PROJECT" ? { outcomeProjectId: workObjectId } : { outcomeActionId: workObjectId }),
          },
          select: { id: true },
        }) : Promise.resolve({ id: workObjectId }),
        client.goalWorkLink.findFirst({
          where: {
            organizationId,
            goalId,
            kind,
            status: "ACTIVE",
            ...(kind === "PROJECT" ? { projectId: workObjectId } : { tensionId: workObjectId }),
          },
          select: { id: true },
        }),
      ]);
      return {
        exists: exists !== null,
        trustedTacticalCandidate: trustedTacticalCandidate !== null,
        blockingTension: kind !== "BLOCKING_TENSION" || Boolean(exists && "status" in exists
          && exists.status !== "RESOLVED" && exists.status !== "REJECTED"),
        duplicateActive: duplicateActive !== null,
      };
    },
    createWorkLink: ({ id, organizationId, goalId, kind, workObjectId, actorId, meetingId, now }) => client.goalWorkLink.create({
      data: {
        id,
        organizationId,
        goalId,
        kind,
        status: "ACTIVE",
        projectId: kind === "PROJECT" ? workObjectId : null,
        tensionId: kind === "PROJECT" ? null : workObjectId,
        createdById: actorId,
        createdMeetingId: meetingId,
        createdAt: now,
        removedById: null,
        removedMeetingId: null,
        removedAt: null,
        removalReason: null,
      },
      select: workLinkSelect,
    }),
    lockWorkLink: async ({ organizationId, goalId, linkId }) => {
      await client.$queryRaw(Prisma.sql`SELECT "id" FROM "goal_work_links" WHERE "id" = ${linkId} AND "organizationId" = ${organizationId} AND "goalId" = ${goalId} FOR UPDATE`);
      return client.goalWorkLink.findFirst({ where: { id: linkId, organizationId, goalId }, select: workLinkSelect });
    },
    removeWorkLink: async ({ organizationId, goalId, linkId, actorId, meetingId, reason, now }) => {
      const removed = await client.goalWorkLink.updateMany({
        where: { id: linkId, organizationId, goalId, status: "ACTIVE" },
        data: {
          status: "REMOVED",
          removedById: actorId,
          removedMeetingId: meetingId,
          removedAt: now,
          removalReason: reason,
        },
      });
      if (removed.count !== 1) return null;
      return client.goalWorkLink.findFirst({ where: { id: linkId, organizationId, goalId }, select: workLinkSelect });
    },
  };
}

const decisionSelect = {
  id: true,
  organizationId: true,
  proposalId: true,
  revision: true,
  outcome: true,
  meetingId: true,
  recorderId: true,
  mutationKey: true,
  note: true,
  decidedAt: true,
} as const;

const checkInSelect = {
  id: true,
  organizationId: true,
  goalId: true,
  targetId: true,
  fact: true,
  evidenceSummary: true,
  currentValue: true,
  milestoneCompleted: true,
  acceptanceEvidence: true,
  assessment: true,
  recorderId: true,
  meetingId: true,
  sourceUrl: true,
  supersedesCheckInId: true,
  recordedAt: true,
} as const;

const workLinkSelect = {
  id: true,
  organizationId: true,
  goalId: true,
  kind: true,
  status: true,
  projectId: true,
  tensionId: true,
  createdById: true,
  createdMeetingId: true,
  createdAt: true,
  removedById: true,
  removedMeetingId: true,
  removedAt: true,
  removalReason: true,
} as const;

function checkInSnapshot(input: {
  id: string;
  organizationId: string;
  goalId: string;
  targetId: string;
  fact: string;
  evidenceSummary: string;
  currentValue: { toString(): string } | null;
  milestoneCompleted: boolean | null;
  acceptanceEvidence: string | null;
  assessment: GoalCheckInAssessment;
  recorderId: string;
  meetingId: string | null;
  sourceUrl: string | null;
  supersedesCheckInId: string | null;
  recordedAt: Date;
}): GoalCheckInSnapshot {
  return { ...input, currentValue: input.currentValue?.toString() ?? null };
}

async function createPrismaProposalRevision(
  client: Prisma.TransactionClient,
  input: {
    organizationId: string;
    proposalId: string;
    revision: NormalizedRevision;
    revisionNumber: number;
    authoredById: string;
    targetIds: string[];
    now: Date;
  },
): Promise<void> {
  await client.goalProposalRevision.create({
    data: {
      organizationId: input.organizationId,
      proposalId: input.proposalId,
      revision: input.revisionNumber,
      title: input.revision.title,
      intendedOutcome: input.revision.intendedOutcome,
      ownerRoleId: input.revision.ownerRoleId,
      parentGoalId: input.revision.parentGoalId,
      closeResult: input.revision.closeResult,
      conclusion: input.revision.conclusion,
      authoredById: input.authoredById,
      createdAt: input.now,
    },
  });
  if (input.revision.targets.length > 0) {
    await client.goalProposalTarget.createMany({
      data: input.revision.targets.map((target, index) => ({
        id: input.targetIds[index],
        organizationId: input.organizationId,
        proposalId: input.proposalId,
        revision: input.revisionNumber,
        position: target.position,
        label: target.label,
        kind: target.kind,
        baselineValue: target.baselineValue,
        desiredValue: target.desiredValue,
        unit: target.unit,
        acceptanceCriteria: target.acceptanceCriteria,
        metricId: target.metricId,
        createdAt: input.now,
      })),
    });
  }
}

async function applyPrismaGoalAdoption(
  client: Prisma.TransactionClient,
  input: ApplyGoalDecisionInput,
): Promise<void> {
  const proposal = input.proposal;
  if (proposal.kind === "REPLACE" || proposal.kind === "CLOSE") {
    const status: GoalStatus = proposal.kind === "REPLACE"
      ? "SUPERSEDED"
      : proposal.revision.closeResult ?? "NOT_ACHIEVED";
    const terminalized = await client.goal.updateMany({
      where: {
        id: proposal.replacedGoalId ?? undefined,
        organizationId: proposal.organizationId,
        cycleId: proposal.cycleId,
        circleId: proposal.circleId,
        status: "ACTIVE",
      },
      data: { status, terminalDecisionId: input.decisionId, terminalAt: input.now },
    });
    if (terminalized.count !== 1) throw new GoalDomainError("ACTIVE_GOAL_REQUIRED");
  }
  if (proposal.kind === "CLOSE") return;
  if (!input.goalId || input.goalTargetIds.length !== proposal.revision.targets.length
    || !proposal.revision.title || !proposal.revision.intendedOutcome || !proposal.revision.ownerRoleId) {
    throw new GoalDomainError("CONSTRAINT_VIOLATION");
  }
  await client.goal.create({
    data: {
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
      createdAt: input.now,
      terminalAt: null,
    },
  });
  await client.goalTarget.createMany({
    data: proposal.revision.targets.map((target, index) => ({
      id: input.goalTargetIds[index],
      organizationId: proposal.organizationId,
      goalId: input.goalId!,
      sourceProposalTargetId: target.id,
      position: target.position,
      label: target.label,
      kind: target.kind,
      baselineValue: target.baselineValue,
      desiredValue: target.desiredValue,
      unit: target.unit,
      acceptanceCriteria: target.acceptanceCriteria,
      metricId: target.metricId,
      createdAt: input.now,
    })),
  });
}

function proposalTargetSnapshot(input: {
  id: string;
  position: number;
  label: string;
  kind: "NUMERIC" | "MILESTONE";
  baselineValue: { toString(): string } | null;
  desiredValue: { toString(): string } | null;
  unit: string | null;
  acceptanceCriteria: string | null;
  metricId: string | null;
}): GoalProposalTargetSnapshot {
  return {
    ...input,
    baselineValue: input.baselineValue?.toString() ?? null,
    desiredValue: input.desiredValue?.toString() ?? null,
  };
}

function goalTargetSnapshot(input: {
  id: string;
  goalId: string;
  sourceProposalTargetId: string;
  position: number;
  label: string;
  kind: "NUMERIC" | "MILESTONE";
  baselineValue: { toString(): string } | null;
  desiredValue: { toString(): string } | null;
  unit: string | null;
  acceptanceCriteria: string | null;
  metricId: string | null;
}): GoalTargetSnapshot {
  return {
    ...input,
    baselineValue: input.baselineValue?.toString() ?? null,
    desiredValue: input.desiredValue?.toString() ?? null,
  };
}

function translateDatabaseError(error: unknown): GoalDomainError {
  if (error instanceof GoalDomainError) return error;
  const code = recordString(error, "code");
  const uniqueTarget = prismaUniqueTarget(error);
  const message = databaseMessage(error).toLowerCase().replaceAll(/[_-]/g, " ");

  if (code === "P2034" || (code === "P2010" && message.includes("40001"))) {
    return new GoalDomainError("SERIALIZATION_CONFLICT");
  }
  if (code === "P2002") {
    if (sameUniqueTarget(uniqueTarget, ["organizationId"])) {
      return new GoalDomainError("ACTIVE_CYCLE_EXISTS");
    }
    if (sameUniqueTarget(uniqueTarget, ["organizationId", "mutationKey"])) {
      return new GoalDomainError("MUTATION_KEY_CONFLICT");
    }
    if (sameUniqueTarget(uniqueTarget, ["organizationId", "proposalId", "revision"])) {
      return new GoalDomainError("DECISION_ALREADY_RECORDED");
    }
    if (sameUniqueTarget(uniqueTarget, ["organizationId", "cycleId", "circleId"])) {
      return new GoalDomainError("ACTIVE_GOAL_EXISTS");
    }
    if (sameUniqueTarget(uniqueTarget, ["supersedesCheckInId"])
      || sameUniqueTarget(uniqueTarget, ["supersedesCheckInId", "organizationId", "goalId", "targetId"])) {
      return new GoalDomainError("CORRECTION_CONFLICT");
    }
    if (includesUniqueTarget(uniqueTarget, ["organizationId", "goalId", "kind", "projectId"])
      || includesUniqueTarget(uniqueTarget, ["organizationId", "goalId", "kind", "tensionId"])) {
      return new GoalDomainError("WORK_LINK_ALREADY_ACTIVE");
    }
  }
  if (message.includes("goal cycles one active per organization key")) {
    return new GoalDomainError("ACTIVE_CYCLE_EXISTS");
  }
  if (message.includes("goal decisions organizationid mutationkey key")) {
    return new GoalDomainError("MUTATION_KEY_CONFLICT");
  }
  if (message.includes("goal decisions organizationid proposalid revision key")) {
    return new GoalDomainError("DECISION_ALREADY_RECORDED");
  }
  if (message.includes("goals one active per circle cycle key")) {
    return new GoalDomainError("ACTIVE_GOAL_EXISTS");
  }
  if (message.includes("goal check ins supersedescheckinid key")
    || message.includes("goal check ins supersedescheckinid organizationid goalid targetid key")) {
    return new GoalDomainError("CORRECTION_CONFLICT");
  }
  if (message.includes("goal work links active project key") || message.includes("goal work links active tension key")) {
    return new GoalDomainError("WORK_LINK_ALREADY_ACTIVE");
  }
  if (message.includes("planned goal cycle cannot be cancelled with non terminal proposals")
    || message.includes("goal cycle has non terminal proposals")) {
    return new GoalDomainError("CYCLE_HAS_NON_TERMINAL_PROPOSALS");
  }
  if (message.includes("goal cycle cannot close while an active goal remains")
    || message.includes("goal cycle has active goals")) {
    return new GoalDomainError("CYCLE_HAS_ACTIVE_GOALS");
  }
  if (message.includes("terminal goal cycle is immutable") || message.includes("closed or cancelled")) {
    return new GoalDomainError("CYCLE_IMMUTABLE");
  }
  if (message.includes("goal adoption requires an active cycle")) return new GoalDomainError("ADOPTION_REQUIRES_ACTIVE_CYCLE");
  if (message.includes("exactly one non archived root circle")) return new GoalDomainError("ORGANIZATION_INTEGRITY_GAP");
  if (message.includes("goal owner role must be active in the same circle")) return new GoalDomainError("OWNER_ROLE_INVALID");
  if (message.includes("parent goal") || message.includes("root circle goal cannot have parent")) return new GoalDomainError("PARENT_GOAL_INVALID");
  if (message.includes("latest effective check in is achieved")) return new GoalDomainError("GOAL_EVIDENCE_INSUFFICIENT");
  if (message.includes("action goal work link requires an approved action outcome")) return new GoalDomainError("ACTION_NOT_APPROVED");
  if (message.includes("goal work link requires an active goal") || message.includes("check in requires an active goal target")) {
    return new GoalDomainError("GOAL_NOT_ACTIVE");
  }
  if (message.includes("check in correction must supersede the same target at a later timestamp")) {
    return new GoalDomainError("CORRECTION_INVALID");
  }
  if (message.includes("check in has invalid typed value shape") || message.includes("achieved check in")
    || message.includes("milestone achieved requires")) {
    return new GoalDomainError("CHECK_IN_INVALID");
  }
  if (message.includes("removed goal work link is immutable") || message.includes("goal work link may move only")) {
    return new GoalDomainError("WORK_LINK_STATE_CONFLICT");
  }
  if (code === "P2002" || code === "P2003" || code === "P2004" || code === "P2010" || message.includes("23514") || message.includes("23503")) {
    return new GoalDomainError("CONSTRAINT_VIOLATION");
  }
  return new GoalDomainError("PERSISTENCE_FAILED");
}

function prismaUniqueTarget(error: unknown): string[] {
  if (!isRecord(error) || !isRecord(error.meta)) return [];
  const direct = uniqueFields(error.meta.target);
  if (direct.length > 0) return direct;
  const adapterError = isRecord(error.meta.driverAdapterError) ? error.meta.driverAdapterError : null;
  const cause = adapterError && isRecord(adapterError.cause) ? adapterError.cause : null;
  const constraint = cause && isRecord(cause.constraint) ? cause.constraint : null;
  return uniqueFields(constraint?.fields);
}

function uniqueFields(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((field) => typeof field === "string")) return [];
  return value.map((field) => field.trim().replace(/^["'`]+|["'`]+$/g, ""));
}

function sameUniqueTarget(target: string[], expected: string[]): boolean {
  return target.length === expected.length && expected.every((field) => target.includes(field));
}

function includesUniqueTarget(target: string[], expected: string[]): boolean {
  return expected.every((field) => target.includes(field));
}

function databaseMessage(error: unknown): string {
  if (!isRecord(error)) return "";
  const meta = isRecord(error.meta) ? Object.values(error.meta).join(" ") : "";
  return `${String(error.message ?? "")} ${meta}`;
}

function recordString(value: unknown, key: string): string | undefined {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
