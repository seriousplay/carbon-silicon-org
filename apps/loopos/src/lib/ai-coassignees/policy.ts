export const AI_CAPABILITY_RISK_LEVELS = ["L0", "L1", "L2", "L3", "L4"] as const;
export const AI_CO_ASSIGNEE_STATUSES = ["PROPOSED", "APPROVED", "SUSPENDED", "REVOKED"] as const;

export type AiCapabilityRiskLevel = (typeof AI_CAPABILITY_RISK_LEVELS)[number];
export type AiCoAssigneeStatus = (typeof AI_CO_ASSIGNEE_STATUSES)[number];

export type AiCoAssigneePolicyDraft = Readonly<{
  roleId: string;
  aiPersonId: string;
  accountableHumanPersonId: string;
  maxRiskLevel: AiCapabilityRiskLevel;
  status?: AiCoAssigneeStatus;
  capabilityScope?: Record<string, unknown>;
}>;

export type AiCoAssigneePolicyIssue =
  | "ROLE_REQUIRED"
  | "AI_PERSON_REQUIRED"
  | "ACCOUNTABLE_HUMAN_REQUIRED"
  | "AI_AND_HUMAN_MUST_DIFFER"
  | "UNSUPPORTED_RISK_LEVEL"
  | "UNSUPPORTED_STATUS"
  | "ROLE_NOT_FOUND"
  | "AI_PERSON_NOT_AGENT"
  | "ACCOUNTABLE_PERSON_NOT_HUMAN";

export type AiCoAssigneePolicyRecord = Readonly<{
  id: string;
  organizationId: string;
  roleId: string;
  aiPersonId: string;
  accountableHumanPersonId: string;
  maxRiskLevel: AiCapabilityRiskLevel;
  status: AiCoAssigneeStatus;
}>;

export type AiExecutionReadinessInput = Readonly<{
  roleStatus: string;
  aiPersonEntityType: string;
  accountableHumanEntityType: string;
  policyStatus: AiCoAssigneeStatus;
  maxRiskLevel: AiCapabilityRiskLevel;
}>;

export type AiExecutionReadinessCode =
  | "READY"
  | "POLICY_NOT_APPROVED"
  | "ROLE_NOT_ACTIVE"
  | "AI_PERSON_NOT_AGENT"
  | "ACCOUNTABLE_PERSON_NOT_HUMAN"
  | "RISK_LEVEL_REQUIRES_EXTRA_APPROVAL";

export type AiExecutionReadiness = Readonly<{
  ready: boolean;
  code: AiExecutionReadinessCode;
  label: string;
}>;

export type AiExecutionAuditEventStatus = "RECORDED" | "DENIED";

export type AiExecutionAuditEventInput = Readonly<{
  organizationId: string;
  policyId: string;
  requestedOperationLabel: string;
  recordedById: string;
  sourceProcessType?: string | null;
  sourceProcessId?: string | null;
  metadata?: Record<string, unknown>;
}>;

export type AiExecutionAuditEventRecord = Readonly<{
  id: string;
  organizationId: string;
  roleId: string;
  policyId: string;
  aiPersonId: string;
  accountableHumanPersonId: string;
  requestedOperationLabel: string;
  status: AiExecutionAuditEventStatus;
  readinessCode: AiExecutionReadinessCode;
  maxRiskLevel: AiCapabilityRiskLevel;
}>;

export type AiCoAssigneePolicyStore = Readonly<{
  roleDef: {
    findFirst(args: { where: { id: string; organizationId: string; status: "ACTIVE" }; select: { id: true } }):
      Promise<{ id: string } | null>;
  };
  person: {
    findFirst(args: { where: { id: string; organizationId: string }; select: { id: true; entityType: true } }):
      Promise<{ id: string; entityType: string } | null>;
  };
  aiRoleCoAssignmentPolicy: {
    upsert(args: {
      where: { organizationId_roleId_aiPersonId: { organizationId: string; roleId: string; aiPersonId: string } };
      create: {
        organizationId: string;
        roleId: string;
        aiPersonId: string;
        accountableHumanPersonId: string;
        maxRiskLevel: AiCapabilityRiskLevel;
        status: AiCoAssigneeStatus;
        capabilityScope: Record<string, unknown>;
        createdById: string;
      };
      update: {
        accountableHumanPersonId: string;
        maxRiskLevel: AiCapabilityRiskLevel;
        status: AiCoAssigneeStatus;
        capabilityScope: Record<string, unknown>;
        revocationReason: null;
        suspendedAt: null;
        revokedAt: null;
      };
      select: {
        id: true;
        organizationId: true;
        roleId: true;
        aiPersonId: true;
        accountableHumanPersonId: true;
        maxRiskLevel: true;
        status: true;
      };
    }): Promise<AiCoAssigneePolicyRecord>;
  };
}>;

export type AiExecutionAuditEventStore = Readonly<{
  aiRoleCoAssignmentPolicy: {
    findFirst(args: {
      where: { id: string; organizationId: string };
      select: {
        id: true;
        organizationId: true;
        roleId: true;
        aiPersonId: true;
        accountableHumanPersonId: true;
        maxRiskLevel: true;
        status: true;
        role: { select: { status: true } };
        aiPerson: { select: { entityType: true } };
        accountableHuman: { select: { entityType: true } };
      };
    }): Promise<{
      id: string;
      organizationId: string;
      roleId: string;
      aiPersonId: string;
      accountableHumanPersonId: string;
      maxRiskLevel: AiCapabilityRiskLevel;
      status: AiCoAssigneeStatus;
      role: { status: string };
      aiPerson: { entityType: string };
      accountableHuman: { entityType: string };
    } | null>;
  };
  person: {
    findFirst(args: { where: { id: string; organizationId: string; entityType: "HUMAN" }; select: { id: true } }):
      Promise<{ id: string } | null>;
  };
  aiExecutionAuditEvent: {
    create(args: {
      data: {
        organizationId: string;
        roleId: string;
        policyId: string;
        aiPersonId: string;
        accountableHumanPersonId: string;
        requestedOperationLabel: string;
        sourceProcessType: string | null;
        sourceProcessId: string | null;
        status: AiExecutionAuditEventStatus;
        readinessCode: AiExecutionReadinessCode;
        maxRiskLevel: AiCapabilityRiskLevel;
        metadata: Record<string, unknown>;
        recordedById: string;
      };
      select: {
        id: true;
        organizationId: true;
        roleId: true;
        policyId: true;
        aiPersonId: true;
        accountableHumanPersonId: true;
        requestedOperationLabel: true;
        status: true;
        readinessCode: true;
        maxRiskLevel: true;
      };
    }): Promise<AiExecutionAuditEventRecord>;
  };
}>;

export function isAiCapabilityRiskLevel(value: unknown): value is AiCapabilityRiskLevel {
  return typeof value === "string" && AI_CAPABILITY_RISK_LEVELS.includes(value as AiCapabilityRiskLevel);
}

export function isAiCoAssigneeStatus(value: unknown): value is AiCoAssigneeStatus {
  return typeof value === "string" && AI_CO_ASSIGNEE_STATUSES.includes(value as AiCoAssigneeStatus);
}

export function validateAiCoAssigneePolicyDraft(
  draft: Readonly<{
    roleId?: unknown;
    aiPersonId?: unknown;
    accountableHumanPersonId?: unknown;
    maxRiskLevel?: unknown;
    status?: unknown;
  }>,
): AiCoAssigneePolicyIssue[] {
  const issues: AiCoAssigneePolicyIssue[] = [];
  const roleId = typeof draft.roleId === "string" ? draft.roleId.trim() : "";
  const aiPersonId = typeof draft.aiPersonId === "string" ? draft.aiPersonId.trim() : "";
  const accountableHumanPersonId =
    typeof draft.accountableHumanPersonId === "string" ? draft.accountableHumanPersonId.trim() : "";

  if (!roleId) issues.push("ROLE_REQUIRED");
  if (!aiPersonId) issues.push("AI_PERSON_REQUIRED");
  if (!accountableHumanPersonId) issues.push("ACCOUNTABLE_HUMAN_REQUIRED");
  if (aiPersonId && accountableHumanPersonId && aiPersonId === accountableHumanPersonId) {
    issues.push("AI_AND_HUMAN_MUST_DIFFER");
  }
  if (!isAiCapabilityRiskLevel(draft.maxRiskLevel)) issues.push("UNSUPPORTED_RISK_LEVEL");
  if (draft.status !== undefined && !isAiCoAssigneeStatus(draft.status)) issues.push("UNSUPPORTED_STATUS");

  return issues;
}

export function canAiExecuteWithoutHumanAccountability(policy: AiCoAssigneePolicyDraft): false {
  void policy;
  return false;
}

export function evaluateAiExecutionReadiness(input: AiExecutionReadinessInput): AiExecutionReadiness {
  if (input.policyStatus !== "APPROVED") {
    return { ready: false, code: "POLICY_NOT_APPROVED", label: "策略尚未批准" };
  }
  if (input.roleStatus !== "ACTIVE") {
    return { ready: false, code: "ROLE_NOT_ACTIVE", label: "角色不是有效状态" };
  }
  if (input.aiPersonEntityType !== "AGENT") {
    return { ready: false, code: "AI_PERSON_NOT_AGENT", label: "AI 共同承担者不是智能体成员" };
  }
  if (input.accountableHumanEntityType !== "HUMAN") {
    return { ready: false, code: "ACCOUNTABLE_PERSON_NOT_HUMAN", label: "责任人不是人类成员" };
  }
  if (input.maxRiskLevel === "L4") {
    return { ready: false, code: "RISK_LEVEL_REQUIRES_EXTRA_APPROVAL", label: "L4 风险需要额外审批" };
  }
  return { ready: true, code: "READY", label: "未来执行准备就绪" };
}

function boundedOptionalText(value: string | null | undefined, maxBytes: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return Buffer.byteLength(trimmed, "utf8") <= maxBytes ? trimmed : trimmed.slice(0, maxBytes);
}

export async function recordAiExecutionAuditEvent(
  db: AiExecutionAuditEventStore,
  input: AiExecutionAuditEventInput,
): Promise<AiExecutionAuditEventRecord> {
  const policyId = input.policyId.trim();
  const organizationId = input.organizationId.trim();
  const recordedById = input.recordedById.trim();
  const requestedOperationLabel = boundedOptionalText(input.requestedOperationLabel, 160);
  if (!organizationId) throw new Error("ORGANIZATION_REQUIRED");
  if (!policyId) throw new Error("POLICY_REQUIRED");
  if (!recordedById) throw new Error("RECORDED_BY_REQUIRED");
  if (!requestedOperationLabel) throw new Error("REQUESTED_OPERATION_REQUIRED");

  const [policy, recordedBy] = await Promise.all([
    db.aiRoleCoAssignmentPolicy.findFirst({
      where: { id: policyId, organizationId },
      select: {
        id: true,
        organizationId: true,
        roleId: true,
        aiPersonId: true,
        accountableHumanPersonId: true,
        maxRiskLevel: true,
        status: true,
        role: { select: { status: true } },
        aiPerson: { select: { entityType: true } },
        accountableHuman: { select: { entityType: true } },
      },
    }),
    db.person.findFirst({
      where: { id: recordedById, organizationId, entityType: "HUMAN" },
      select: { id: true },
    }),
  ]);

  if (!policy) throw new Error("POLICY_NOT_FOUND");
  if (!recordedBy) throw new Error("RECORDER_NOT_HUMAN");

  const readiness = evaluateAiExecutionReadiness({
    roleStatus: policy.role.status,
    aiPersonEntityType: policy.aiPerson.entityType,
    accountableHumanEntityType: policy.accountableHuman.entityType,
    policyStatus: policy.status,
    maxRiskLevel: policy.maxRiskLevel,
  });

  return db.aiExecutionAuditEvent.create({
    data: {
      organizationId,
      roleId: policy.roleId,
      policyId: policy.id,
      aiPersonId: policy.aiPersonId,
      accountableHumanPersonId: policy.accountableHumanPersonId,
      requestedOperationLabel,
      sourceProcessType: boundedOptionalText(input.sourceProcessType, 80),
      sourceProcessId: boundedOptionalText(input.sourceProcessId, 191),
      status: readiness.ready ? "RECORDED" : "DENIED",
      readinessCode: readiness.code,
      maxRiskLevel: policy.maxRiskLevel,
      metadata: input.metadata ?? {},
      recordedById,
    },
    select: {
      id: true,
      organizationId: true,
      roleId: true,
      policyId: true,
      aiPersonId: true,
      accountableHumanPersonId: true,
      requestedOperationLabel: true,
      status: true,
      readinessCode: true,
      maxRiskLevel: true,
    },
  });
}

export async function saveAiCoAssigneePolicy(
  db: AiCoAssigneePolicyStore,
  input: AiCoAssigneePolicyDraft & Readonly<{ organizationId: string; createdById: string }>,
): Promise<AiCoAssigneePolicyRecord> {
  const issues = validateAiCoAssigneePolicyDraft(input);
  if (issues.length > 0) throw new Error(issues[0]);

  const [role, aiPerson, accountableHuman] = await Promise.all([
    db.roleDef.findFirst({
      where: { id: input.roleId, organizationId: input.organizationId, status: "ACTIVE" },
      select: { id: true },
    }),
    db.person.findFirst({
      where: { id: input.aiPersonId, organizationId: input.organizationId },
      select: { id: true, entityType: true },
    }),
    db.person.findFirst({
      where: { id: input.accountableHumanPersonId, organizationId: input.organizationId },
      select: { id: true, entityType: true },
    }),
  ]);

  if (!role) throw new Error("ROLE_NOT_FOUND");
  if (aiPerson?.entityType !== "AGENT") throw new Error("AI_PERSON_NOT_AGENT");
  if (accountableHuman?.entityType !== "HUMAN") throw new Error("ACCOUNTABLE_PERSON_NOT_HUMAN");

  return db.aiRoleCoAssignmentPolicy.upsert({
    where: {
      organizationId_roleId_aiPersonId: {
        organizationId: input.organizationId,
        roleId: input.roleId,
        aiPersonId: input.aiPersonId,
      },
    },
    create: {
      organizationId: input.organizationId,
      roleId: input.roleId,
      aiPersonId: input.aiPersonId,
      accountableHumanPersonId: input.accountableHumanPersonId,
      maxRiskLevel: input.maxRiskLevel,
      status: input.status ?? "PROPOSED",
      capabilityScope: input.capabilityScope ?? {},
      createdById: input.createdById,
    },
    update: {
      accountableHumanPersonId: input.accountableHumanPersonId,
      maxRiskLevel: input.maxRiskLevel,
      status: input.status ?? "PROPOSED",
      capabilityScope: input.capabilityScope ?? {},
      revocationReason: null,
      suspendedAt: null,
      revokedAt: null,
    },
    select: {
      id: true,
      organizationId: true,
      roleId: true,
      aiPersonId: true,
      accountableHumanPersonId: true,
      maxRiskLevel: true,
      status: true,
    },
  });
}
