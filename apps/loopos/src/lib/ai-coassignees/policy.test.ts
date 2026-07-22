import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import {
  AI_CAPABILITY_RISK_LEVELS,
  AI_CO_ASSIGNEE_STATUSES,
  canAiExecuteWithoutHumanAccountability,
  evaluateAiExecutionReadiness,
  recordAiExecutionAuditEvent,
  saveAiCoAssigneePolicy,
  validateAiCoAssigneePolicyDraft,
  type AiCoAssigneePolicyStore,
  type AiExecutionAuditEventStore,
} from "./policy";

const schema = readFileSync(new URL("../../../prisma/schema.prisma", import.meta.url), "utf8");
const migration = readFileSync(
  new URL(
    "../../../prisma/migrations/20260720233000_v6_m4a_ai_co_assignee_policy_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const m4eMigration = readFileSync(
  new URL(
    "../../../prisma/migrations/20260721003000_v6_m4e_ai_execution_audit_ledger/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

function storeWithPeople(people: Record<string, string>): AiCoAssigneePolicyStore {
  return {
    roleDef: {
      async findFirst(args) {
        return args.where.id === "role-1" && args.where.organizationId === "org-1" ? { id: "role-1" } : null;
      },
    },
    person: {
      async findFirst(args) {
        const entityType = people[args.where.id];
        return entityType ? { id: args.where.id, entityType } : null;
      },
    },
    aiRoleCoAssignmentPolicy: {
      async upsert(args) {
        return {
          id: "policy-1",
          organizationId: args.create.organizationId,
          roleId: args.create.roleId,
          aiPersonId: args.create.aiPersonId,
          accountableHumanPersonId: args.create.accountableHumanPersonId,
          maxRiskLevel: args.create.maxRiskLevel,
          status: args.create.status,
        };
      },
    },
  };
}

function auditStoreWithPolicy(
  policy: Parameters<typeof auditPolicy>[0] | null,
  recordedByEntityType = "HUMAN",
): AiExecutionAuditEventStore {
  return {
    aiRoleCoAssignmentPolicy: {
      async findFirst(args) {
        if (!policy || args.where.id !== policy.id || args.where.organizationId !== policy.organizationId) return null;
        return auditPolicy(policy);
      },
    },
    person: {
      async findFirst(args) {
        return args.where.id === "human-1" && args.where.organizationId === "org-1" && recordedByEntityType === "HUMAN"
          ? { id: "human-1" }
          : null;
      },
    },
    aiExecutionAuditEvent: {
      async create(args) {
        return {
          id: "audit-1",
          organizationId: args.data.organizationId,
          roleId: args.data.roleId,
          policyId: args.data.policyId,
          aiPersonId: args.data.aiPersonId,
          accountableHumanPersonId: args.data.accountableHumanPersonId,
          requestedOperationLabel: args.data.requestedOperationLabel,
          status: args.data.status,
          readinessCode: args.data.readinessCode,
          maxRiskLevel: args.data.maxRiskLevel,
        };
      },
    },
  };
}

function auditPolicy(policy: {
  id?: string;
  organizationId?: string;
  roleStatus?: string;
  policyStatus?: "PROPOSED" | "APPROVED" | "SUSPENDED" | "REVOKED";
  maxRiskLevel?: "L0" | "L1" | "L2" | "L3" | "L4";
  aiPersonEntityType?: string;
  accountableHumanEntityType?: string;
}) {
  return {
    id: policy.id ?? "policy-1",
    organizationId: policy.organizationId ?? "org-1",
    roleId: "role-1",
    aiPersonId: "agent-1",
    accountableHumanPersonId: "human-1",
    maxRiskLevel: policy.maxRiskLevel ?? "L2",
    status: policy.policyStatus ?? "APPROVED",
    role: { status: policy.roleStatus ?? "ACTIVE" },
    aiPerson: { entityType: policy.aiPersonEntityType ?? "AGENT" },
    accountableHuman: { entityType: policy.accountableHumanEntityType ?? "HUMAN" },
  };
}

describe("V6-M4-A AI co-assignee policy foundation", () => {
  test("defines L0-L4 risk vocabulary and bounded policy statuses", () => {
    assert.deepEqual(AI_CAPABILITY_RISK_LEVELS, ["L0", "L1", "L2", "L3", "L4"]);
    assert.deepEqual(AI_CO_ASSIGNEE_STATUSES, ["PROPOSED", "APPROVED", "SUSPENDED", "REVOKED"]);

    assert.match(schema, /enum AiCapabilityRiskLevel \{\s*L0\s*L1\s*L2\s*L3\s*L4\s*\}/);
    assert.match(schema, /enum AiCoAssigneeStatus \{\s*PROPOSED\s*APPROVED\s*SUSPENDED\s*REVOKED\s*\}/);
  });

  test("requires a role, an AI person, and a distinct accountable human", () => {
    assert.deepEqual(validateAiCoAssigneePolicyDraft({}), [
      "ROLE_REQUIRED",
      "AI_PERSON_REQUIRED",
      "ACCOUNTABLE_HUMAN_REQUIRED",
      "UNSUPPORTED_RISK_LEVEL",
    ]);
    assert.deepEqual(
      validateAiCoAssigneePolicyDraft({
        roleId: "role-1",
        aiPersonId: "person-1",
        accountableHumanPersonId: "person-1",
        maxRiskLevel: "L2",
      }),
      ["AI_AND_HUMAN_MUST_DIFFER"],
    );
    assert.deepEqual(
      validateAiCoAssigneePolicyDraft({
        roleId: "role-1",
        aiPersonId: "agent-1",
        accountableHumanPersonId: "human-1",
        maxRiskLevel: "L4",
        status: "APPROVED",
      }),
      [],
    );
  });

  test("never treats AI as able to execute without human accountability", () => {
    assert.equal(
      canAiExecuteWithoutHumanAccountability({
        roleId: "role-1",
        aiPersonId: "agent-1",
        accountableHumanPersonId: "human-1",
        maxRiskLevel: "L1",
      }),
      false,
    );
  });

  test("creation guard requires an AGENT co-assignee and a HUMAN accountable person", async () => {
    await assert.rejects(
      saveAiCoAssigneePolicy(storeWithPeople({ "agent-1": "HUMAN", "human-1": "HUMAN" }), {
        organizationId: "org-1",
        roleId: "role-1",
        aiPersonId: "agent-1",
        accountableHumanPersonId: "human-1",
        maxRiskLevel: "L2",
        createdById: "human-1",
      }),
      /AI_PERSON_NOT_AGENT/,
    );
    await assert.rejects(
      saveAiCoAssigneePolicy(storeWithPeople({ "agent-1": "AGENT", "human-1": "AGENT" }), {
        organizationId: "org-1",
        roleId: "role-1",
        aiPersonId: "agent-1",
        accountableHumanPersonId: "human-1",
        maxRiskLevel: "L2",
        createdById: "human-1",
      }),
      /ACCOUNTABLE_PERSON_NOT_HUMAN/,
    );

    const policy = await saveAiCoAssigneePolicy(storeWithPeople({ "agent-1": "AGENT", "human-1": "HUMAN" }), {
      organizationId: "org-1",
      roleId: "role-1",
      aiPersonId: "agent-1",
      accountableHumanPersonId: "human-1",
      maxRiskLevel: "L2",
      createdById: "human-1",
    });
    assert.equal(policy.aiPersonId, "agent-1");
    assert.equal(policy.accountableHumanPersonId, "human-1");
    assert.equal(policy.status, "PROPOSED");
  });

  test("computes read-only AI execution readiness without authorizing execution", () => {
    assert.deepEqual(
      evaluateAiExecutionReadiness({
        roleStatus: "ACTIVE",
        aiPersonEntityType: "AGENT",
        accountableHumanEntityType: "HUMAN",
        policyStatus: "APPROVED",
        maxRiskLevel: "L2",
      }),
      { ready: true, code: "READY", label: "未来执行准备就绪" },
    );
    assert.equal(
      evaluateAiExecutionReadiness({
        roleStatus: "ACTIVE",
        aiPersonEntityType: "AGENT",
        accountableHumanEntityType: "HUMAN",
        policyStatus: "REVOKED",
        maxRiskLevel: "L2",
      }).code,
      "POLICY_NOT_APPROVED",
    );
    assert.equal(
      evaluateAiExecutionReadiness({
        roleStatus: "ACTIVE",
        aiPersonEntityType: "AGENT",
        accountableHumanEntityType: "HUMAN",
        policyStatus: "APPROVED",
        maxRiskLevel: "L4",
      }).code,
      "RISK_LEVEL_REQUIRES_EXTRA_APPROVAL",
    );
  });

  test("adds only the co-assignment policy table and no automatic execution path", () => {
    assert.match(migration, /CREATE TABLE "ai_role_co_assignment_policies"/);
    assert.match(migration, /"accountableHumanPersonId" TEXT NOT NULL/);
    assert.match(migration, /CHECK \("aiPersonId" <> "accountableHumanPersonId"\)/);
    assert.match(migration, /REFERENCES "role_defs"\("id", "organizationId"\)/);
    assert.match(migration, /REFERENCES "people"\("id", "organizationId"\)/);
    assert.doesNotMatch(migration, /^ALTER TABLE "(role_defs|people|circles)"/gm);
    assert.doesNotMatch(`${schema}\n${migration}`, /candidate[_-]?tension|delivery[_-]?scheduler|biocoach/i);
  });

  test("defines an append-only AI execution audit ledger without execution jobs", () => {
    const ledgerModel = schema.match(/model AiExecutionAuditEvent \{[\s\S]*?@@map\("ai_execution_audit_events"\)\n\}/)?.[0] ?? "";
    assert.match(schema, /enum AiExecutionAuditEventStatus \{\s*RECORDED\s*DENIED\s*\}/);
    assert.match(ledgerModel, /model AiExecutionAuditEvent \{/);
    assert.match(ledgerModel, /@@map\("ai_execution_audit_events"\)/);
    assert.match(m4eMigration, /CREATE TABLE "ai_execution_audit_events"/);
    assert.match(m4eMigration, /"readinessCode" TEXT NOT NULL/);
    assert.match(m4eMigration, /"accountableHumanPersonId" TEXT NOT NULL/);
    assert.match(m4eMigration, /FOREIGN KEY \("policyId", "organizationId"\)/);
    assert.doesNotMatch(`${ledgerModel}\n${m4eMigration}`, /execution[_-]?job|scheduler|worker|dispatch|candidate[_-]?tension|biocoach/i);
  });

  test("records ready AI execution intent as an audit event without executing", async () => {
    const event = await recordAiExecutionAuditEvent(auditStoreWithPolicy(auditPolicy({})), {
      organizationId: "org-1",
      policyId: "policy-1",
      requestedOperationLabel: "prepare weekly operating review",
      recordedById: "human-1",
      sourceProcessType: "ROLE_DETAIL",
      sourceProcessId: "role-1",
    });

    assert.equal(event.status, "RECORDED");
    assert.equal(event.readinessCode, "READY");
    assert.equal(event.accountableHumanPersonId, "human-1");
    assert.equal(event.maxRiskLevel, "L2");
  });

  test("records blocked readiness as a denied audit event instead of executing", async () => {
    const event = await recordAiExecutionAuditEvent(
      auditStoreWithPolicy(auditPolicy({ policyStatus: "APPROVED", maxRiskLevel: "L4" })),
      {
        organizationId: "org-1",
        policyId: "policy-1",
        requestedOperationLabel: "high risk autonomous deployment",
        recordedById: "human-1",
      },
    );

    assert.equal(event.status, "DENIED");
    assert.equal(event.readinessCode, "RISK_LEVEL_REQUIRES_EXTRA_APPROVAL");
  });

  test("requires a human recorder and a tenant-scoped policy before writing audit", async () => {
    await assert.rejects(
      recordAiExecutionAuditEvent(auditStoreWithPolicy(null), {
        organizationId: "org-1",
        policyId: "missing-policy",
        requestedOperationLabel: "prepare summary",
        recordedById: "human-1",
      }),
      /POLICY_NOT_FOUND/,
    );

    await assert.rejects(
      recordAiExecutionAuditEvent(auditStoreWithPolicy(auditPolicy({}), "AGENT"), {
        organizationId: "org-1",
        policyId: "policy-1",
        requestedOperationLabel: "prepare summary",
        recordedById: "human-1",
      }),
      /RECORDER_NOT_HUMAN/,
    );
  });
});
