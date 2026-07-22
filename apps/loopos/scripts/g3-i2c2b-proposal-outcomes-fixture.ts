import "dotenv/config";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";

const PASSWORD = "loopos-proposal-test-2026";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) });
  const suffix = `${Date.now()}-${randomUUID().slice(0, 6)}`;
  const hash = await bcrypt.hash(PASSWORD, 12);
  const accountSpecs = [
    ["proposer", "提案人"],
    ["participant", "参会记录人"],
    ["project-owner", "Project owner"],
    ["action-assignee", "Action 负责人"],
    ["non-participant", "非参会成员"],
  ] as const;

  try {
    const fixture = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({ data: { name: `G3 I2C2B ${suffix}`, slug: `g3-i2c2b-${suffix}` } });
      const otherOrganization = await tx.organization.create({ data: { name: `G3 Other ${suffix}`, slug: `g3-i2c2b-other-${suffix}` } });
      const [sourceCircle, targetCircle, otherCircle] = await Promise.all([
        tx.circle.create({ data: { organizationId: organization.id, name: "数据回路", number: "CUSTOM", type: "PRODUCTION", purpose: "提出可验证的接口张力" } }),
        tx.circle.create({ data: { organizationId: organization.id, name: "预训练回路", number: "CUSTOM", type: "PRODUCTION", purpose: "承担 Project 与 Action" } }),
        tx.circle.create({ data: { organizationId: otherOrganization.id, name: "其他租户回路", number: "CUSTOM", type: "PRODUCTION", purpose: "租户隔离" } }),
      ]);
      const accounts: Record<string, { userId: string; personId: string; email: string }> = {};
      for (const [key, name] of accountSpecs) {
        const email = `g3-${key}-${suffix}@loopos.test`;
        const user = await tx.user.create({ data: { email, name, passwordHash: hash } });
        await tx.membership.create({ data: { userId: user.id, organizationId: organization.id, role: "ORG_MEMBER" } });
        const person = await tx.person.create({ data: { organizationId: organization.id, userId: user.id, email, name, homeCircleId: key === "proposer" ? sourceCircle.id : targetCircle.id } });
        accounts[key] = { userId: user.id, personId: person.id, email };
      }
      const crossEmail = `g3-cross-tenant-${suffix}@loopos.test`;
      const crossUser = await tx.user.create({ data: { email: crossEmail, name: "跨租户成员", passwordHash: hash } });
      await tx.membership.create({ data: { userId: crossUser.id, organizationId: otherOrganization.id, role: "ORG_MEMBER" } });
      const crossPerson = await tx.person.create({ data: { organizationId: otherOrganization.id, userId: crossUser.id, email: crossEmail, name: "跨租户成员", homeCircleId: otherCircle.id } });

      const interfaceRow = await tx.circleInterface.create({ data: {
        organizationId: organization.id,
        name: "Data -> Pretraining Fixture",
        contractContent: "数据回路提供可复现的训练输入。",
        sla: "24h",
        acceptanceCriteria: "证据与验收标准可验证。",
        fromCircleId: sourceCircle.id,
        toCircleId: targetCircle.id,
        ownerId: accounts.proposer.personId,
      } });
      const snapshot = { protocolVersion: 1, definitionSchemaVersion: 1, name: "Proposal fixture", entryNodeId: "complete", roles: [], nodes: [{ id: "complete", type: "complete", config: { outcome: "路由完成" } }], edges: [] };
      const compiled = { ...snapshot, compilerVersion: "fixture", nodeIndex: { complete: 0 }, adjacency: { complete: [] } };
      const workbench = await tx.interfaceWorkbench.create({ data: { organizationId: organization.id, interfaceId: interfaceRow.id, draft: snapshot as Prisma.InputJsonValue, draftLayout: {}, draftHash: `fixture-${suffix}` } });
      const version = await tx.interfaceWorkbenchVersion.create({ data: { organizationId: organization.id, workbenchId: workbench.id, version: 1, publisherId: accounts.proposer.personId, sourceSnapshot: snapshot as Prisma.InputJsonValue, compiledSnapshot: compiled as Prisma.InputJsonValue, editorLayout: {}, validationResult: { ok: true, issues: [] }, sourceHash: `fixture-${suffix}`, compiledHash: `fixture-compiled-${suffix}`, definitionSchemaVersion: 1, compilerVersion: "fixture" } });
      await tx.interfaceWorkbench.update({ where: { id: workbench.id }, data: { activeVersionId: version.id } });

      const [selectedMeeting, wrongMeeting, governanceMeeting] = await Promise.all([
        tx.meeting.create({ data: { organizationId: organization.id, circleId: sourceCircle.id, title: "G3 提案战术会", type: "TACTICAL", agenda: "记录提案会议结果", durationMin: 30, startedAt: new Date(), participants: { connect: [{ id: accounts.proposer.personId }, { id: accounts.participant.personId }] } } }),
        tx.meeting.create({ data: { organizationId: organization.id, circleId: targetCircle.id, title: "错误战术会", type: "TACTICAL", agenda: "不得处理选定路由", durationMin: 30, startedAt: new Date(Date.now() + 60_000) } }),
        tx.meeting.create({ data: { organizationId: organization.id, title: "治理会（错误类型）", type: "GOVERNANCE", agenda: "仅结构治理", durationMin: 90, startedAt: new Date(Date.now() + 120_000), participants: { connect: { id: accounts.participant.personId } } } }),
      ]);

      const tensions = await Promise.all(["Project 提案张力", "Action 提案张力", "退回与不采纳张力"].map((title) => tx.tension.create({ data: { organizationId: organization.id, title, description: `${title}：只允许提案会议流程闭环。`, type: "PROBLEMATIC", source: "BOT", raiserId: accounts.proposer.personId, circles: { connect: { id: targetCircle.id } } } })));
      const runs: Array<{ id: string; tensionId: string }> = [];
      for (const [index, tension] of tensions.entries()) {
        const run = await tx.interfaceWorkflowRun.create({ data: { organizationId: organization.id, workbenchId: workbench.id, versionId: version.id, status: "COMPLETED", currentNodeId: "complete", currentNodeVisit: 0, evidence: { fixture: index + 1 }, revision: 1, starterId: accounts.proposer.personId, lastActorId: accounts.proposer.personId } });
        await tx.interfaceWorkflowRunEvent.create({ data: { organizationId: organization.id, runId: run.id, sequence: 1, type: "STARTED", nodeId: "complete", nodeVisit: 0, actorId: accounts.proposer.personId, payload: { fixture: true } } });
        const source = await tx.interfaceWorkflowArtifact.create({ data: { organizationId: organization.id, runId: run.id, artifactType: "TENSION", artifactId: tension.id, relation: "raised-tension", metadata: { schemaVersion: 1, commandId: `raise-${index}`, nodeId: "raise", nodeVisit: 1 } } });
        const commandId = `route-${index}`;
        await tx.interfaceWorkflowArtifact.create({ data: { organizationId: organization.id, runId: run.id, artifactType: "MEETING", artifactId: selectedMeeting.id, relation: `tactical-route:${commandId}`, metadata: { schemaVersion: 1, commandId, nodeId: "route", nodeVisit: 2, meetingType: "TACTICAL", sourceTensionArtifactId: source.id } } });
        runs.push({ id: run.id, tensionId: tension.id });
      }

      const pilotTension = await tx.tension.create({ data: { organizationId: organization.id, title: "Data -> Pretraining 试点异常", description: "必须继续显示原有四种处置控件。", type: "PROBLEMATIC", source: "BOT", raiserId: accounts.proposer.personId, circles: { connect: { id: targetCircle.id } } } });
      await tx.interfaceValidationRun.create({ data: { organizationId: organization.id, interfaceId: interfaceRow.id, dataVersion: `pilot-${suffix}`, dataLocation: "fixture://pilot", changeSummary: "浏览器回归", dataScopeScale: "1 fixture", submittedAt: new Date(), status: "FAILED", smokeRunResult: "FAIL", createdTensionId: pilotTension.id } });

      return { organization, otherOrganization, sourceCircle, targetCircle, accounts, cross: { email: crossEmail, personId: crossPerson.id }, selectedMeeting, wrongMeeting, governanceMeeting, tensions, runs, pilotTension };
    });

    const baseUrl = (process.env.APP_URL ?? "http://localhost:3108").replace(/\/$/, "");
    console.log(JSON.stringify({
      fixture: suffix,
      database: process.env.DATABASE_URL,
      password: PASSWORD,
      accounts: Object.fromEntries(Object.entries(fixture.accounts).map(([key, value]) => [key, { email: value.email, personId: value.personId }])),
      crossTenant: fixture.cross,
      urls: {
        login: `${baseUrl}/login`,
        selectedMeeting: `${baseUrl}/app/meetings/${fixture.selectedMeeting.id}`,
        wrongMeeting: `${baseUrl}/app/meetings/${fixture.wrongMeeting.id}`,
        governanceMeeting: `${baseUrl}/app/meetings/${fixture.governanceMeeting.id}`,
        runs: fixture.runs.map((run) => `${baseUrl}/app/interfaces/runs/${run.id}`),
      },
      ids: { organizationId: fixture.organization.id, selectedMeetingId: fixture.selectedMeeting.id, tensionIds: fixture.tensions.map((item) => item.id), pilotTensionId: fixture.pilotTension.id },
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
