import "dotenv/config";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { compileWorkflow } from "@/lib/interface-workbench/compiler";

const PASSWORD = "loopos-governance-routing-2026";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) });
  const suffix = `${Date.now()}-${randomUUID().slice(0, 6)}`;
  const hash = await bcrypt.hash(PASSWORD, 12);
  const accountSpecs = [
    ["proposer", "治理候选提出人", "ORG_MEMBER"],
    ["participant", "治理会参会人", "ORG_MEMBER"],
    ["nonparticipant", "非参会成员", "ORG_MEMBER"],
    ["coach", "组织教练", "ORG_MEMBER"],
    ["lead", "回路负责人", "ORG_MEMBER"],
    ["admin", "组织管理员", "ORG_ADMIN"],
    ["runtime-operator", "运行操作者", "ORG_MEMBER"],
    ["affected-holder", "受影响职责持有人", "ORG_MEMBER"],
  ] as const;
  const definition = {
    protocolVersion: 1,
    definitionSchemaVersion: 1,
    name: "Governance candidate and explicit route fixture",
    entryNodeId: "confirm-candidate",
    roles: [{ id: "operator", capabilities: ["confirm", "governance"] }],
    nodes: [
      { id: "confirm-candidate", type: "human_confirmation", config: { prompt: "确认准备一份组织结构治理候选。", roleId: "operator" } },
      { id: "candidate", type: "mark_governance_candidate", config: { confirmationNodeId: "confirm-candidate", rationaleField: "rationale", roleId: "operator" } },
      { id: "route", type: "route_governance_meeting", config: { confirmationNodeId: "confirm-candidate", roleId: "operator" } },
      { id: "complete", type: "complete", config: { outcome: "治理候选已明确路由" } },
    ],
    edges: [
      { id: "confirm-to-candidate", from: "confirm-candidate", to: "candidate" },
      { id: "candidate-to-route", from: "candidate", to: "route" },
      { id: "route-to-complete", from: "route", to: "complete" },
    ],
  } as const;
  const compiled = compileWorkflow(definition);
  if (!compiled.ok) throw new Error(`Fixture workflow invalid: ${JSON.stringify(compiled.issues)}`);

  try {
    const fixture = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name: `G3 I2C2C ${suffix}`, slug: `g3-i2c2c-${suffix}` } });
      const otherOrganization = await tx.organization.create({ data: { name: `G3 I2C2C Other ${suffix}`, slug: `g3-i2c2c-other-${suffix}` } });
      const [sourceCircle, targetCircle, otherCircle] = await Promise.all([
        tx.circle.create({ data: { organizationId: organization.id, name: "候选来源回路", number: "CUSTOM", type: "PRODUCTION", purpose: "提出结构张力" } }),
        tx.circle.create({ data: { organizationId: organization.id, name: "治理目标回路", number: "CUSTOM", type: "PRODUCTION", purpose: "承接治理候选" } }),
        tx.circle.create({ data: { organizationId: otherOrganization.id, name: "其他租户回路", number: "CUSTOM", type: "PRODUCTION", purpose: "租户隔离" } }),
      ]);
      const accounts: Record<string, { personId: string; email: string }> = {};
      for (const [key, name, membershipRole] of accountSpecs) {
        const email = `g3-i2c2c-${key}-${suffix}@loopos.test`;
        const user = await tx.user.create({ data: { email, name, passwordHash: hash } });
        await tx.membership.create({ data: { userId: user.id, organizationId: organization.id, role: membershipRole } });
        const person = await tx.person.create({ data: { organizationId: organization.id, userId: user.id, email, name, homeCircleId: key === "proposer" ? sourceCircle.id : targetCircle.id } });
        accounts[key] = { personId: person.id, email };
      }
      await tx.circle.update({ where: { id: sourceCircle.id }, data: { leadPersonId: accounts.lead.personId } });
      const crossEmail = `g3-i2c2c-cross-${suffix}@loopos.test`;
      const crossUser = await tx.user.create({ data: { email: crossEmail, name: "跨租户成员", passwordHash: hash } });
      await tx.membership.create({ data: { userId: crossUser.id, organizationId: otherOrganization.id, role: "ORG_ADMIN" } });
      const crossPerson = await tx.person.create({ data: { organizationId: otherOrganization.id, userId: crossUser.id, email: crossEmail, name: "跨租户成员", homeCircleId: otherCircle.id } });

      const interfaceRow = await tx.circleInterface.create({ data: { organizationId: organization.id, name: "Governance Routing Fixture", contractContent: "提出可审议的组织结构草案。", sla: "显式路由", acceptanceCriteria: "提出人确认，参会人显式选择会议。", fromCircleId: sourceCircle.id, toCircleId: targetCircle.id, ownerId: accounts.proposer.personId, supportPeople: { connect: { id: accounts["runtime-operator"].personId } } } });
      const workbench = await tx.interfaceWorkbench.create({ data: { organizationId: organization.id, interfaceId: interfaceRow.id, draft: compiled.snapshot as unknown as Prisma.InputJsonValue, draftLayout: {}, draftHash: compiled.sourceHash } });
      const version = await tx.interfaceWorkbenchVersion.create({ data: { organizationId: organization.id, workbenchId: workbench.id, version: 1, publisherId: accounts.admin.personId, sourceSnapshot: compiled.snapshot as unknown as Prisma.InputJsonValue, compiledSnapshot: compiled.compiled as unknown as Prisma.InputJsonValue, editorLayout: {}, validationResult: { ok: true, issues: [] }, sourceHash: compiled.sourceHash, compiledHash: compiled.compiledHash, definitionSchemaVersion: compiled.snapshot.definitionSchemaVersion, compilerVersion: compiled.compiled.compilerVersion } });
      await tx.interfaceWorkbench.update({ where: { id: workbench.id }, data: { activeVersionId: version.id } });

      const [selectedMeeting, wrongGovernanceMeeting, tacticalMeeting] = await Promise.all([
        tx.meeting.create({ data: { organizationId: organization.id, title: "选定治理会", type: "GOVERNANCE", agenda: "只读处理明确路由的候选", durationMin: 90, startedAt: new Date(), participants: { connect: [{ id: accounts.proposer.personId }, { id: accounts.participant.personId }] } } }),
        tx.meeting.create({ data: { organizationId: organization.id, title: "错误治理会", type: "GOVERNANCE", agenda: "提出人未参加", durationMin: 90, startedAt: new Date(Date.now() + 60_000), participants: { connect: [{ id: accounts.participant.personId }, { id: accounts.admin.personId }] } } }),
        tx.meeting.create({ data: { organizationId: organization.id, circleId: sourceCircle.id, title: "错误战术会", type: "TACTICAL", agenda: "不得承接治理候选", durationMin: 30, startedAt: new Date(Date.now() + 120_000), participants: { connect: [{ id: accounts.proposer.personId }, { id: accounts.participant.personId }] } } }),
      ]);
      const crossMeeting = await tx.meeting.create({ data: { organizationId: otherOrganization.id, title: "跨租户治理会", type: "GOVERNANCE", agenda: "租户隔离", durationMin: 90, startedAt: new Date(), participants: { connect: { id: crossPerson.id } } } });

      const createRun = async (title: string, description: string) => {
        const tension = await tx.tension.create({ data: { organizationId: organization.id, title, description, type: "PROBLEMATIC", source: "BOT", raiserId: accounts.proposer.personId, circles: { connect: { id: sourceCircle.id } } } });
        const run = await tx.interfaceWorkflowRun.create({ data: { organizationId: organization.id, workbenchId: workbench.id, versionId: version.id, status: "ACTIVE", currentNodeId: "candidate", currentNodeVisit: 1, revision: 0, evidence: {}, starterId: accounts.proposer.personId, lastActorId: accounts.proposer.personId } });
        await tx.interfaceWorkflowRunRoleBinding.create({ data: { organizationId: organization.id, runId: run.id, roleId: "operator", personId: accounts.proposer.personId } });
        await tx.interfaceWorkflowRunEvent.create({ data: { organizationId: organization.id, runId: run.id, sequence: 1, type: "NODE_TRANSITIONED", nodeId: "confirm-candidate", nodeVisit: 0, actorId: accounts.proposer.personId, payload: { fixture: true } } });
        const sourceArtifact = await tx.interfaceWorkflowArtifact.create({ data: { organizationId: organization.id, runId: run.id, artifactType: "TENSION", artifactId: tension.id, relation: "raised-tension", metadata: { schemaVersion: 1, commandId: `fixture-raise-${run.id}`, nodeId: "raise", nodeVisit: 0 } } });
        return { run, tension, sourceArtifact };
      };
      const primary = await createRun("结构职责长期模糊", "需要明确接口验收职责，但不会在本步骤修改组织结构。");
      const participantRoute = await createRun("参会人路由证明", "提出人创建候选后，由另一位实际参会人记录路由。");
      const nonStructural = await createRun("仅调整当前工作归属", "HOME_CIRCLE_REASSIGNMENT 单独出现时保持战术处理。");
      const pilotTension = await tx.tension.create({ data: { organizationId: organization.id, title: "试点回归张力", description: "原有 Data -> Pretraining 路径保持不变。", type: "PROBLEMATIC", source: "BOT", raiserId: accounts.proposer.personId } });
      await tx.interfaceValidationRun.create({ data: { organizationId: organization.id, interfaceId: interfaceRow.id, dataVersion: `pilot-${suffix}`, dataLocation: "fixture://pilot", changeSummary: "G3-I2C-2C regression", dataScopeScale: "1 fixture", submittedAt: new Date(), status: "FAILED", smokeRunResult: "FAIL", createdTensionId: pilotTension.id } });
      return { organization, otherOrganization, accounts, cross: { email: crossEmail, personId: crossPerson.id }, selectedMeeting, wrongGovernanceMeeting, tacticalMeeting, crossMeeting, primary, participantRoute, nonStructural, pilotTension };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    const baseUrl = (process.env.APP_URL ?? "http://localhost:3110").replace(/\/$/, "");
    console.log(JSON.stringify({
      fixture: suffix,
      password: PASSWORD,
      database: process.env.DATABASE_URL,
      accounts: fixture.accounts,
      crossTenant: fixture.cross,
      urls: {
        login: `${baseUrl}/login`,
        primaryRun: `${baseUrl}/app/interfaces/runs/${fixture.primary.run.id}`,
        participantRouteRun: `${baseUrl}/app/interfaces/runs/${fixture.participantRoute.run.id}`,
        nonStructuralRun: `${baseUrl}/app/interfaces/runs/${fixture.nonStructural.run.id}`,
        selectedMeeting: `${baseUrl}/app/meetings/${fixture.selectedMeeting.id}`,
        wrongGovernanceMeeting: `${baseUrl}/app/meetings/${fixture.wrongGovernanceMeeting.id}`,
        tacticalMeeting: `${baseUrl}/app/meetings/${fixture.tacticalMeeting.id}`,
        crossTenantMeeting: `${baseUrl}/app/meetings/${fixture.crossMeeting.id}`,
        weeklyPilot: `${baseUrl}/app/governance/weekly`,
      },
      ids: { organizationId: fixture.organization.id, otherOrganizationId: fixture.otherOrganization.id, selectedMeetingId: fixture.selectedMeeting.id, primaryRunId: fixture.primary.run.id, primaryTensionId: fixture.primary.tension.id, primarySourceArtifactId: fixture.primary.sourceArtifact.id, participantRunId: fixture.participantRoute.run.id, participantSourceArtifactId: fixture.participantRoute.sourceArtifact.id, nonStructuralRunId: fixture.nonStructural.run.id, pilotTensionId: fixture.pilotTension.id },
    }, null, 2));
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
