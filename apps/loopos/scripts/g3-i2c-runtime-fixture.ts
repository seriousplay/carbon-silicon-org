import "dotenv/config";

import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@/generated/prisma/client";
import { compileWorkflow } from "@/lib/interface-workbench/compiler";
import { advanceWorkflowRun, createPrismaRuntimeDependencies, startWorkflowRun } from "@/lib/interface-workbench/runtime-service";

const TEST_PASSWORD = "loopos-runtime-test-2026";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) });
  const suffix = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const authorizedEmail = `runtime-authorized-${suffix}@loopos.test`;
  const unauthorizedEmail = `runtime-cross-tenant-${suffix}@loopos.test`;
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 12);
  const definition = {
    protocolVersion: 1,
    definitionSchemaVersion: 1,
    name: "Raise tension and tactical route browser fixture",
    entryNodeId: "evidence",
    roles: [
      { id: "operator", capabilities: ["collect_evidence", "confirm", "raise_tension", "route"] },
    ],
    nodes: [
      { id: "evidence", type: "structured_evidence_input", config: { fields: ["tension_title", "tension_description"], roleId: "operator" } },
      { id: "confirm-raise", type: "human_confirmation", config: { prompt: "确认以这些证据提出张力。", roleId: "operator" } },
      { id: "raise", type: "raise_tension", config: { confirmationNodeId: "confirm-raise", roleId: "operator", titleField: "tension_title", descriptionField: "tension_description" } },
      { id: "confirm-route", type: "human_confirmation", config: { prompt: "确认把已提出的张力路由到一个明确选择的战术会。", roleId: "operator" } },
      { id: "route", type: "route_tactical_meeting", config: { confirmationNodeId: "confirm-route", roleId: "operator" } },
      { id: "complete", type: "complete", config: { outcome: "张力已路由到战术会" } },
    ],
    edges: [
      { id: "evidence-to-confirm-raise", from: "evidence", to: "confirm-raise" },
      { id: "confirm-raise-to-raise", from: "confirm-raise", to: "raise" },
      { id: "raise-to-confirm-route", from: "raise", to: "confirm-route" },
      { id: "confirm-route-to-route", from: "confirm-route", to: "route" },
      { id: "route-to-complete", from: "route", to: "complete" },
    ],
  } as const;
  const compiled = compileWorkflow(definition);
  if (!compiled.ok) throw new Error(`Fixture workflow is invalid: ${JSON.stringify(compiled.issues)}`);

  try {
    const fixture = await prisma.$transaction(async (tx) => {
      const [authorizedUser, unauthorizedUser] = await Promise.all([
        tx.user.create({ data: { email: authorizedEmail, name: "Runtime Authorized Member", passwordHash } }),
        tx.user.create({ data: { email: unauthorizedEmail, name: "Runtime Unrelated Member", passwordHash } }),
      ]);
      const organization = await tx.organization.create({
        data: { name: `Runtime Fixture ${suffix}`, slug: `runtime-fixture-${suffix}` },
      });
      const otherOrganization = await tx.organization.create({ data: { name: `Runtime Other Tenant ${suffix}`, slug: `runtime-other-${suffix}` } });
      await tx.membership.createMany({ data: [
        { userId: authorizedUser.id, organizationId: organization.id, role: "ORG_MEMBER" },
        { userId: unauthorizedUser.id, organizationId: otherOrganization.id, role: "ORG_MEMBER" },
      ] });
      const [sourceCircle, targetCircle] = await Promise.all([
        tx.circle.create({ data: { organizationId: organization.id, name: "Fixture Source", number: "CUSTOM", type: "PRODUCTION", purpose: "Provide fixture evidence" } }),
        tx.circle.create({ data: { organizationId: organization.id, name: "Fixture Target", number: "CUSTOM", type: "PRODUCTION", purpose: "Confirm fixture evidence" } }),
      ]);
      const otherCircle = await tx.circle.create({ data: { organizationId: otherOrganization.id, name: "Other tenant circle", number: "CUSTOM", type: "PRODUCTION", purpose: "Tenant isolation" } });
      const [authorizedPerson, unauthorizedPerson] = await Promise.all([
        tx.person.create({ data: { organizationId: organization.id, userId: authorizedUser.id, email: authorizedEmail, name: "Runtime Authorized Member", homeCircleId: sourceCircle.id } }),
        tx.person.create({ data: { organizationId: otherOrganization.id, userId: unauthorizedUser.id, email: unauthorizedEmail, name: "Runtime Cross-tenant Member", homeCircleId: otherCircle.id } }),
      ]);
      await tx.circle.update({ where: { id: sourceCircle.id }, data: { leadPersonId: authorizedPerson.id } });
      const circleInterface = await tx.circleInterface.create({
        data: {
          organizationId: organization.id,
          name: "Fixture delivery interface",
          contractContent: "Source provides a versioned delivery with a reproducible smoke result.",
          sla: "Same browser session",
          acceptanceCriteria: "Both configured evidence fields are present and a human confirms them.",
          fromCircleId: sourceCircle.id,
          toCircleId: targetCircle.id,
          ownerId: authorizedPerson.id,
          supportPeople: { connect: { id: authorizedPerson.id } },
        },
      });
      const [selectedMeeting, otherMeeting, governanceMeeting, strategyMeeting] = await Promise.all([
        tx.meeting.create({ data: { organizationId: organization.id, circleId: sourceCircle.id, title: "Selected tactical fixture", type: "TACTICAL", agenda: "Process explicitly routed tension", durationMin: 30, startedAt: new Date() } }),
        tx.meeting.create({ data: { organizationId: organization.id, circleId: targetCircle.id, title: "Other tactical fixture", type: "TACTICAL", agenda: "Must not show the selected route", durationMin: 30, startedAt: new Date(Date.now() + 60_000) } }),
        tx.meeting.create({ data: { organizationId: organization.id, title: "Governance visibility fixture", type: "GOVERNANCE", agenda: "Ordinary tensions only", durationMin: 90, startedAt: new Date(Date.now() + 120_000) } }),
        tx.meeting.create({ data: { organizationId: organization.id, title: "Strategy visibility fixture", type: "STRATEGY", agenda: "Ordinary tensions only", durationMin: 60, startedAt: new Date(Date.now() + 180_000) } }),
      ]);
      const ordinaryTension = await tx.tension.create({ data: { organizationId: organization.id, title: "Ordinary legacy tension", description: "Must remain visible in non-tactical legacy queues.", type: "CLARIFYING", source: "FORM", raiserId: authorizedPerson.id } });
      const crossTenantMeeting = await tx.meeting.create({ data: { organizationId: otherOrganization.id, title: "Cross-tenant tactical fixture", type: "TACTICAL", agenda: "Tenant isolation", durationMin: 30, startedAt: new Date() } });
      const supportRole = await tx.roleDef.create({
        data: {
          organizationId: organization.id,
          circleId: sourceCircle.id,
          contractId: circleInterface.id,
          name: "Fixture interface support",
          purpose: "Operate the fixture interface",
          accountabilities: "Submit and confirm fixture evidence",
          ownershipType: "SUPPORT",
          category: "OPERATIONS",
          assignees: { connect: { id: authorizedPerson.id } },
        },
      });
      const workbench = await tx.interfaceWorkbench.create({
        data: {
          organizationId: organization.id,
          interfaceId: circleInterface.id,
          draft: compiled.snapshot as unknown as Prisma.InputJsonValue,
          draftLayout: {} as Prisma.InputJsonValue,
          draftHash: compiled.sourceHash,
        },
      });
      const version = await tx.interfaceWorkbenchVersion.create({
        data: {
          organizationId: organization.id,
          workbenchId: workbench.id,
          version: 1,
          publisherId: authorizedPerson.id,
          sourceSnapshot: compiled.snapshot as unknown as Prisma.InputJsonValue,
          compiledSnapshot: compiled.compiled as unknown as Prisma.InputJsonValue,
          editorLayout: {} as Prisma.InputJsonValue,
          validationResult: { ok: true, issues: [] },
          sourceHash: compiled.sourceHash,
          compiledHash: compiled.compiledHash,
          definitionSchemaVersion: compiled.snapshot.definitionSchemaVersion,
          compilerVersion: compiled.compiled.compilerVersion,
        },
      });
      await tx.interfaceWorkbench.update({ where: { id: workbench.id }, data: { activeVersionId: version.id } });
      return { organization, otherOrganization, authorizedPerson, unauthorizedPerson, circleInterface, supportRole, workbench, version, selectedMeeting, otherMeeting, governanceMeeting, strategyMeeting, ordinaryTension, crossTenantMeeting };
    });

    const started = await startWorkflowRun({
      organizationId: fixture.organization.id,
      workbenchId: fixture.workbench.id,
      starterId: fixture.authorizedPerson.id,
      bindings: [
        { roleId: "operator", personId: fixture.authorizedPerson.id },
      ],
    }, createPrismaRuntimeDependencies(prisma));
    if (!started.ok) throw new Error(`Fixture run could not start: ${started.error}`);

    const retryStarted = await startWorkflowRun({
      organizationId: fixture.organization.id,
      workbenchId: fixture.workbench.id,
      starterId: fixture.authorizedPerson.id,
      bindings: [{ roleId: "operator", personId: fixture.authorizedPerson.id }],
    }, createPrismaRuntimeDependencies(prisma));
    if (!retryStarted.ok) throw new Error(`Retry fixture run could not start: ${retryStarted.error}`);
    const dependencies = createPrismaRuntimeDependencies(prisma);
    const evidenceResult = await advanceWorkflowRun({ organizationId: fixture.organization.id, runId: retryStarted.runId, actorId: fixture.authorizedPerson.id, actorAuthorized: true, expectedRevision: 0, clientIdempotencyKey: randomUUID(), command: { kind: "SUBMIT_EVIDENCE", payload: { evidence: { tension_title: "Retry fixture tension", tension_description: "The injected first attempt must fail without a duplicate tension." } } } }, dependencies);
    if (!evidenceResult.ok) throw new Error("Retry fixture evidence failed");
    const confirmResult = await advanceWorkflowRun({ organizationId: fixture.organization.id, runId: retryStarted.runId, actorId: fixture.authorizedPerson.id, actorAuthorized: true, expectedRevision: 1, clientIdempotencyKey: randomUUID(), command: { kind: "CONFIRM" } }, dependencies);
    if (!confirmResult.ok) throw new Error("Retry fixture confirmation failed");
    await prisma.$transaction(async (tx) => {
      const command = await tx.interfaceWorkflowCommand.create({ data: { organizationId: fixture.organization.id, runId: retryStarted.runId, nodeId: "raise", nodeVisit: 2, kind: "EXECUTE_SIDE_EFFECT", clientIdempotencyKey: randomUUID(), actorId: fixture.authorizedPerson.id, payload: {}, attempts: 1, status: "FAILED", error: "INJECTED_FIRST_ATTEMPT_FAILURE" } });
      const last = await tx.interfaceWorkflowRunEvent.findFirst({ where: { runId: retryStarted.runId }, orderBy: { sequence: "desc" }, select: { sequence: true } });
      await tx.interfaceWorkflowRunEvent.create({ data: { organizationId: fixture.organization.id, runId: retryStarted.runId, sequence: (last?.sequence ?? 0) + 1, type: "COMMAND_FAILED", nodeId: "raise", nodeVisit: 2, actorId: fixture.authorizedPerson.id, payload: { commandId: command.id, attempt: 1, error: "INJECTED_FIRST_ATTEMPT_FAILURE" } } });
    });

    const baseUrl = (process.env.APP_URL ?? "http://localhost:3107").replace(/\/$/, "");
    console.log(`Fixture: ${suffix}`);
    console.log(`Authorized ORG_MEMBER: ${authorizedEmail} / ${TEST_PASSWORD}`);
    console.log(`Cross-tenant ORG_MEMBER: ${unauthorizedEmail} / ${TEST_PASSWORD}`);
    console.log(`Login: ${baseUrl}/login`);
    console.log(`Runs: ${baseUrl}/app/interfaces/runs`);
    console.log(`Authorized direct run: ${baseUrl}/app/interfaces/runs/${started.runId}`);
    console.log(`Retry run: ${baseUrl}/app/interfaces/runs/${retryStarted.runId}`);
    console.log(`Selected tactical meeting: ${baseUrl}/app/meetings/${fixture.selectedMeeting.id}`);
    console.log(`Other tactical meeting: ${baseUrl}/app/meetings/${fixture.otherMeeting.id}`);
    console.log(`Governance meeting: ${baseUrl}/app/meetings/${fixture.governanceMeeting.id}`);
    console.log(`Strategy meeting: ${baseUrl}/app/meetings/${fixture.strategyMeeting.id}`);
    console.log(`Ordinary tension: ${baseUrl}/app/tensions/${fixture.ordinaryTension.id}`);
    console.log(`Cross-tenant meeting: ${baseUrl}/app/meetings/${fixture.crossTenantMeeting.id}`);
    console.log(`Cross-tenant denial URL: ${baseUrl}/app/interfaces/runs/${started.runId}`);
    console.log(`Workbench: ${fixture.workbench.id} · published v${fixture.version.version}`);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Fixture failed");
  process.exitCode = 1;
});
