import {
  createDetectedCandidateTension,
  dismissCandidateTension,
  mergeCandidateTension,
  type CandidateTensionDraft,
  type CandidateTensionRecord,
} from "./contract";

export type CandidateTensionAuditType =
  | "DETECTED"
  | "CONFIRMED"
  | "DISMISSED"
  | "MERGED"
  | "MARKED_FALSE_POSITIVE";

type CandidateTensionRow = Readonly<{
  id: string;
  organizationId: string;
  title: string;
  evidenceSummary: string;
  sourceKind: CandidateTensionDraft["sourceKind"];
  sourceRef: unknown;
  ownerRoleId: string;
  detectedById: string;
  status: CandidateTensionRecord["status"];
  suggestedMode: string | null;
  confirmedTensionId: string | null;
  confirmedById: string | null;
  confirmedAt: Date | null;
  terminalReason: string | null;
  mergedIntoId: string | null;
  detectedAt?: Date;
  updatedAt?: Date;
}>;

type CandidateTensionStore = {
  roleDef: {
    findFirst(args: {
      where: {
        id: string;
        organizationId: string;
        assignees?: { some: { id: string; organizationId: string; entityType: "HUMAN" } };
      };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  person: {
    findFirst(args: {
      where: { id: string; organizationId: string; entityType?: "HUMAN" };
      select: { id: true };
    }): Promise<{ id: string } | null>;
  };
  tension: {
    findFirst(args: {
      where: { id: string; organizationId: string };
      select: { id: true; organizationId: true };
    }): Promise<{ id: string; organizationId: string } | null>;
  };
  candidateTension: {
    create(args: { data: Record<string, unknown> }): Promise<CandidateTensionRow>;
    findFirst(args: {
      where: { id: string; organizationId: string };
    }): Promise<CandidateTensionRow | null>;
    update(args: {
      where: { id_organizationId: { id: string; organizationId: string } };
      data: Record<string, unknown>;
    }): Promise<CandidateTensionRow>;
  };
  candidateTensionAuditEvent: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
  };
  $transaction<T>(fn: (tx: CandidateTensionStore) => Promise<T>): Promise<T>;
};

export type CreateCandidateTensionInput = CandidateTensionDraft;

export type ConfirmCandidateTensionInput = Readonly<{
  organizationId: string;
  candidateId: string;
  confirmedTensionId: string;
  actorPersonId: string;
}>;

export type CloseCandidateTensionInput = Readonly<{
  organizationId: string;
  candidateId: string;
  actorPersonId: string;
  reason: string;
  falsePositive?: boolean;
}>;

export type MergeCandidateTensionInput = Readonly<{
  organizationId: string;
  candidateId: string;
  actorPersonId: string;
  mergedIntoId: string;
  reason: string;
}>;

export async function createCandidateTension(
  store: CandidateTensionStore,
  input: CreateCandidateTensionInput,
): Promise<CandidateTensionRow> {
  const candidate = createDetectedCandidateTension("candidate-preview", input);
  return store.$transaction(async (tx) => {
    await requireScopedRole(tx, candidate.organizationId, candidate.ownerRoleId);
    await requireScopedPerson(tx, candidate.organizationId, candidate.detectedById);

    const created = await tx.candidateTension.create({
      data: {
        organizationId: candidate.organizationId,
        title: candidate.title,
        evidenceSummary: candidate.evidenceSummary,
        sourceKind: candidate.sourceKind,
        sourceRef: candidate.sourceRef,
        ownerRoleId: candidate.ownerRoleId,
        detectedById: candidate.detectedById,
        suggestedMode: candidate.suggestedMode,
        status: "DETECTED",
      },
    });
    await recordCandidateAudit(tx, {
      organizationId: candidate.organizationId,
      candidateId: created.id,
      actorPersonId: candidate.detectedById,
      type: "DETECTED",
      payload: { sourceKind: candidate.sourceKind, sourceRef: candidate.sourceRef },
    });
    return created;
  });
}

export async function confirmCandidateTensionWithHuman(
  store: CandidateTensionStore,
  input: ConfirmCandidateTensionInput,
): Promise<CandidateTensionRow> {
  return store.$transaction(async (tx) => {
    const candidate = await requireDetectedCandidate(tx, input.organizationId, input.candidateId);
    await requireHumanRoleAssignee(tx, input.organizationId, candidate.ownerRoleId, input.actorPersonId);
    await requireScopedTension(tx, input.organizationId, input.confirmedTensionId);

    const updated = await tx.candidateTension.update({
      where: { id_organizationId: { id: candidate.id, organizationId: input.organizationId } },
      data: {
        status: "CONFIRMED",
        confirmedTensionId: input.confirmedTensionId.trim(),
        confirmedById: input.actorPersonId.trim(),
        confirmedAt: new Date(),
      },
    });
    await recordCandidateAudit(tx, {
      organizationId: input.organizationId,
      candidateId: candidate.id,
      actorPersonId: input.actorPersonId,
      type: "CONFIRMED",
      payload: { confirmedTensionId: input.confirmedTensionId.trim() },
    });
    return updated;
  });
}

export async function closeCandidateTensionWithHuman(
  store: CandidateTensionStore,
  input: CloseCandidateTensionInput,
): Promise<CandidateTensionRow> {
  return store.$transaction(async (tx) => {
    const candidate = await requireDetectedCandidate(tx, input.organizationId, input.candidateId);
    await requireHumanRoleAssignee(tx, input.organizationId, candidate.ownerRoleId, input.actorPersonId);
    const closed = dismissCandidateTension(toContractCandidate(candidate), { reason: input.reason, falsePositive: input.falsePositive });
    const updated = await tx.candidateTension.update({
      where: { id_organizationId: { id: candidate.id, organizationId: input.organizationId } },
      data: {
        status: closed.status,
        terminalReason: closed.terminalReason,
      },
    });
    await recordCandidateAudit(tx, {
      organizationId: input.organizationId,
      candidateId: candidate.id,
      actorPersonId: input.actorPersonId,
      type: input.falsePositive ? "MARKED_FALSE_POSITIVE" : "DISMISSED",
      payload: { reason: closed.terminalReason },
    });
    return updated;
  });
}

export async function mergeCandidateTensionWithHuman(
  store: CandidateTensionStore,
  input: MergeCandidateTensionInput,
): Promise<CandidateTensionRow> {
  return store.$transaction(async (tx) => {
    const candidate = await requireDetectedCandidate(tx, input.organizationId, input.candidateId);
    await requireDetectedCandidate(tx, input.organizationId, input.mergedIntoId);
    await requireHumanRoleAssignee(tx, input.organizationId, candidate.ownerRoleId, input.actorPersonId);
    const merged = mergeCandidateTension(toContractCandidate(candidate), {
      mergedIntoId: input.mergedIntoId,
      reason: input.reason,
    });
    const updated = await tx.candidateTension.update({
      where: { id_organizationId: { id: candidate.id, organizationId: input.organizationId } },
      data: {
        status: "MERGED",
        mergedIntoId: merged.mergedIntoId,
        terminalReason: merged.terminalReason,
      },
    });
    await recordCandidateAudit(tx, {
      organizationId: input.organizationId,
      candidateId: candidate.id,
      actorPersonId: input.actorPersonId,
      type: "MERGED",
      payload: { mergedIntoId: merged.mergedIntoId, reason: merged.terminalReason },
    });
    return updated;
  });
}

async function requireScopedRole(store: CandidateTensionStore, organizationId: string, roleId: string): Promise<void> {
  const role = await store.roleDef.findFirst({
    where: { id: roleId, organizationId },
    select: { id: true },
  });
  if (!role) throw new Error("OWNER_ROLE_NOT_FOUND");
}

async function requireScopedPerson(store: CandidateTensionStore, organizationId: string, personId: string): Promise<void> {
  const person = await store.person.findFirst({
    where: { id: personId, organizationId },
    select: { id: true },
  });
  if (!person) throw new Error("PERSON_NOT_FOUND");
}

async function requireHumanRoleAssignee(
  store: CandidateTensionStore,
  organizationId: string,
  roleId: string,
  personId: string,
): Promise<void> {
  const role = await store.roleDef.findFirst({
    where: {
      id: roleId,
      organizationId,
      assignees: { some: { id: personId, organizationId, entityType: "HUMAN" } },
    },
    select: { id: true },
  });
  if (!role) throw new Error("HUMAN_OWNER_ROLE_ASSIGNEE_REQUIRED");
}

async function requireScopedTension(store: CandidateTensionStore, organizationId: string, tensionId: string): Promise<void> {
  if (!tensionId.trim()) throw new Error("CONFIRMED_TENSION_REQUIRED");
  const tension = await store.tension.findFirst({
    where: { id: tensionId.trim(), organizationId },
    select: { id: true, organizationId: true },
  });
  if (!tension) throw new Error("CONFIRMED_TENSION_NOT_FOUND");
}

async function requireDetectedCandidate(
  store: CandidateTensionStore,
  organizationId: string,
  candidateId: string,
): Promise<CandidateTensionRow> {
  const candidate = await store.candidateTension.findFirst({
    where: { id: candidateId, organizationId },
  });
  if (!candidate) throw new Error("CANDIDATE_NOT_FOUND");
  if (candidate.status !== "DETECTED") throw new Error("CANDIDATE_NOT_DETECTED");
  return candidate;
}

function toContractCandidate(candidate: CandidateTensionRow): CandidateTensionRecord {
  return {
    id: candidate.id,
    organizationId: candidate.organizationId,
    title: candidate.title,
    evidenceSummary: candidate.evidenceSummary,
    sourceKind: candidate.sourceKind,
    sourceRef: isRecord(candidate.sourceRef) ? candidate.sourceRef : {},
    ownerRoleId: candidate.ownerRoleId,
    detectedById: candidate.detectedById,
    suggestedMode: candidate.suggestedMode === "TACTICAL" || candidate.suggestedMode === "GOVERNANCE" ? candidate.suggestedMode : null,
    status: candidate.status,
    confirmedTensionId: candidate.confirmedTensionId,
    confirmedById: candidate.confirmedById,
    terminalReason: candidate.terminalReason,
    mergedIntoId: candidate.mergedIntoId,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function recordCandidateAudit(
  store: CandidateTensionStore,
  input: Readonly<{
    organizationId: string;
    candidateId: string;
    actorPersonId: string;
    type: CandidateTensionAuditType;
    payload: Record<string, unknown>;
  }>,
): Promise<void> {
  await store.candidateTensionAuditEvent.create({
    data: {
      organizationId: input.organizationId,
      candidateId: input.candidateId,
      actorPersonId: input.actorPersonId,
      type: input.type,
      payload: input.payload,
    },
  });
}
