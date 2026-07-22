"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireSession, getCurrentPerson } from "@/lib/session";
import { canAdvanceInterfaceWorkflow, canViewInterfaceWorkflow } from "@/lib/interface-workbench/runtime-permissions";
import { advanceWorkflowRun, createPrismaRuntimeDependencies, takeOverWorkflowRun } from "@/lib/interface-workbench/runtime-service";
import { authorizeGovernanceRoute } from "@/lib/domain-operations";
import { currentInterfaceRunActionDependencies, executeGovernanceRouteActionBoundary } from "./governance-route-boundary";

const productionActionDependencies = {
  prisma,
  requireSession,
  getCurrentPerson,
  advanceWorkflowRun,
  createPrismaRuntimeDependencies,
  takeOverWorkflowRun,
  revalidatePath,
  redirect,
};

type InterfaceRunActionDependencies = typeof productionActionDependencies;

export async function submitEvidenceAction(runId: string, formData: FormData): Promise<void> {
  await advanceAction(runId, formData, "evidence");
}

export async function confirmRunAction(runId: string, formData: FormData): Promise<void> {
  await advanceAction(runId, formData, "confirm");
}

export async function resumeRunAction(runId: string, formData: FormData): Promise<void> {
  await advanceAction(runId, formData, "resume");
}

export async function takeOverAndResumeRunAction(runId: string, formData: FormData): Promise<void> {
  await advanceAction(runId, formData, "takeover-resume");
}

export async function executeSideEffectAction(runId: string, formData: FormData): Promise<void> {
  await advanceAction(runId, formData, "side-effect");
}

async function advanceAction(runId: string, formData: FormData, intent: "evidence" | "confirm" | "resume" | "takeover-resume" | "side-effect"): Promise<never> {
  const dependencies = currentInterfaceRunActionDependencies<InterfaceRunActionDependencies>(productionActionDependencies);
  let destination: string;
  try {
    destination = await resolveAdvanceDestination(runId, formData, intent, dependencies);
  } catch {
    destination = `${runUrl(runId)}?message=failed`;
  }
  dependencies.revalidatePath(runUrl(runId));
  dependencies.revalidatePath("/app/interfaces/runs");
  return dependencies.redirect(destination);
}

async function resolveAdvanceDestination(runId: string, formData: FormData, intent: "evidence" | "confirm" | "resume" | "takeover-resume" | "side-effect", dependencies: InterfaceRunActionDependencies): Promise<string> {
  const session = await dependencies.requireSession();
  const person = await dependencies.getCurrentPerson();
  if (!person) return `${runUrl(runId)}?message=failed`;
  const [membership, actorRoles, run] = await Promise.all([
    dependencies.prisma.membership.findUnique({ where: { userId_organizationId: { userId: session.user.id, organizationId: person.organizationId } }, select: { role: true } }),
    dependencies.prisma.roleDef.findMany({ where: { organizationId: person.organizationId, assignees: { some: { id: person.id } } }, select: { id: true } }),
    dependencies.prisma.interfaceWorkflowRun.findFirst({
      where: { id: runId, organizationId: person.organizationId },
      select: {
        id: true, status: true, revision: true, currentNodeId: true,
        version: { select: { compiledSnapshot: true } },
        roleBindings: { select: { roleId: true, organizationId: true, personId: true, roleDefId: true } },
        waitingRoleBinding: { select: { organizationId: true, personId: true, roleDefId: true } },
        workbench: { select: { interface: { select: {
          organizationId: true, ownerId: true,
          fromCircle: { select: { leadPersonId: true } }, toCircle: { select: { leadPersonId: true } },
          supportPeople: { select: { id: true } }, supportRoles: { select: { id: true } },
        } } } },
      },
    }),
  ]);
  if (!membership || !run) return `${runUrl(runId)}?message=failed`;
  const expectedRevision = parseRevision(formData.get("expectedRevision"));
  const idempotencyKey = String(formData.get("idempotencyKey") ?? "");
  if (expectedRevision === null || !isUuid(idempotencyKey)) return `${runUrl(runId)}?message=conflict`;

  const existingCommand = await dependencies.prisma.interfaceWorkflowCommand.findFirst({
    where: { organizationId: person.organizationId, runId, clientIdempotencyKey: idempotencyKey },
    select: { nodeId: true },
  });
  const node = readCurrentNode(run.version.compiledSnapshot, existingCommand?.nodeId ?? run.currentNodeId);
  const command = node ? commandForIntent(intent, node, formData) : null;
  if (!node || !command) return `${runUrl(runId)}?message=${node ? "invalid-input" : "conflict"}`;

  const actor = { organizationId: person.organizationId, personId: person.id, membershipRole: membership.role, assignedRoleDefIds: actorRoles.map((role) => role.id) };
  const intf = run.workbench.interface;
  const interfaceContext = { organizationId: intf.organizationId, ownerId: intf.ownerId, fromCircleLeadPersonId: intf.fromCircle.leadPersonId, toCircleLeadPersonId: intf.toCircle.leadPersonId, supportPersonIds: intf.supportPeople.map((item) => item.id), supportRoleDefIds: intf.supportRoles.map((item) => item.id) };
  const routePayload = node.type === "route_governance_meeting" ? governanceRouteCommandPayload(command) : null;
  if (node.type === "route_governance_meeting") {
    if (!routePayload) return `${runUrl(runId)}?message=invalid-input`;
    return executeGovernanceRouteActionBoundary({
      advanceInput: { organizationId: person.organizationId, runId, actorId: person.id, actorAuthorized: true, expectedRevision, clientIdempotencyKey: idempotencyKey, command },
      meetingId: routePayload.meetingId,
      runUrl: runUrl(runId),
    }, {
      authorize: () => authorizeGovernanceRoute(dependencies.prisma, { organizationId: person.organizationId, runId, actorId: person.id, proposalArtifactId: routePayload.proposalArtifactId, meetingId: routePayload.meetingId }).then(() => undefined),
      advance: (input) => dependencies.advanceWorkflowRun(input, dependencies.createPrismaRuntimeDependencies(dependencies.prisma)),
    });
  }
  if (!canViewInterfaceWorkflow(actor, interfaceContext)) return `${runUrl(runId)}?message=denied`;
  if (!existingCommand && expectedRevision !== run.revision) return `${runUrl(runId)}?message=conflict`;

  const governanceNode = node.type === "mark_governance_candidate";
  const binding = run.status === "WAITING" ? run.waitingRoleBinding : node.roleId ? run.roleBindings.find((item) => item.roleId === node.roleId) ?? null : null;
  if (!binding && !governanceNode) return `${runUrl(runId)}?message=denied`;
  const takeover = intent === "takeover-resume";
  const permission = governanceNode ? { allowed: true, requiresTakeoverEvent: false } : canAdvanceInterfaceWorkflow(actor, interfaceContext, binding!, { takeover });
  if (!permission.allowed || (takeover && !permission.requiresTakeoverEvent)) return `${runUrl(runId)}?message=denied`;

  let revision = expectedRevision;
  if (permission.requiresTakeoverEvent) {
    const takeoverResult = await dependencies.takeOverWorkflowRun({ organizationId: person.organizationId, runId, actorId: person.id, actorAuthorized: true, expectedRevision: revision }, dependencies.createPrismaRuntimeDependencies(dependencies.prisma));
    if (!takeoverResult.ok) return `${runUrl(runId)}?message=${takeoverResult.error === "REVISION_CONFLICT" ? "conflict" : "failed"}`;
    revision = takeoverResult.revision;
  }
  const result = await dependencies.advanceWorkflowRun({ organizationId: person.organizationId, runId, actorId: person.id, actorAuthorized: true, expectedRevision: revision, clientIdempotencyKey: idempotencyKey, command }, dependencies.createPrismaRuntimeDependencies(dependencies.prisma));
  if (result.ok) return runUrl(runId);
  const message = result.error === "REVISION_CONFLICT" ? "conflict" : result.error === "FORBIDDEN" ? "denied" : result.error === "COMMAND_IN_PROGRESS" ? "in-progress" : result.error === "SIDE_EFFECT_FAILED" ? "retry" : "failed";
  return `${runUrl(runId)}?message=${message}`;
}

function governanceRouteCommandPayload(command: { kind: string; payload?: unknown }): { meetingId: string; proposalArtifactId: string } | null {
  if (command.kind !== "EXECUTE_SIDE_EFFECT" || !isRecord(command.payload) || command.payload.confirmed !== true) return null;
  return typeof command.payload.meetingId === "string" && command.payload.meetingId && typeof command.payload.proposalArtifactId === "string" && command.payload.proposalArtifactId
    ? { meetingId: command.payload.meetingId, proposalArtifactId: command.payload.proposalArtifactId }
    : null;
}

function commandForIntent(intent: "evidence" | "confirm" | "resume" | "takeover-resume" | "side-effect", node: CurrentNode, formData: FormData) {
  if (intent === "evidence" && node.type === "structured_evidence_input" && node.fields) {
    const evidence: Record<string, string> = {};
    let totalBytes = 0;
    for (const field of node.fields) {
      const values = formData.getAll(`evidence:${field}`);
      if (values.length !== 1 || typeof values[0] !== "string") return null;
      const fieldBytes = Buffer.byteLength(values[0], "utf8");
      totalBytes += fieldBytes;
      if (fieldBytes > MAX_EVIDENCE_FIELD_BYTES || totalBytes > MAX_EVIDENCE_TOTAL_BYTES) return null;
      evidence[field] = values[0];
    }
    return { kind: "SUBMIT_EVIDENCE", payload: { evidence } };
  }
  if (intent === "confirm" && node.type === "human_confirmation") return { kind: "CONFIRM" };
  if ((intent === "resume" || intent === "takeover-resume") && node.type === "wait_for_role") return { kind: "RESUME" };
  if (intent === "side-effect" && node.type === "raise_tension") return { kind: "EXECUTE_SIDE_EFFECT" };
  if (intent === "side-effect" && node.type === "route_tactical_meeting") {
    const meetingId = text(formData, "meetingId");
    const sourceTensionArtifactId = text(formData, "sourceTensionArtifactId");
    return meetingId && sourceTensionArtifactId ? { kind: "EXECUTE_SIDE_EFFECT", payload: { meetingId, sourceTensionArtifactId } } : null;
  }
  if (intent === "side-effect" && node.type === "mark_governance_candidate") {
    const sourceTensionArtifactId = text(formData, "sourceTensionArtifactId");
    const structuralCategory = text(formData, "structuralCategory");
    const currentStructure = text(formData, "currentStructure");
    const proposedStructure = text(formData, "proposedStructure");
    const rationale = text(formData, "rationale");
    const expectedImpact = text(formData, "expectedImpact");
    const confirmed = formData.get("confirmed") === "yes";
    return sourceTensionArtifactId && structuralCategory && currentStructure && proposedStructure && rationale && expectedImpact && confirmed
      ? { kind: "EXECUTE_SIDE_EFFECT", payload: { confirmed: true, sourceTensionArtifactId, structuralCategory, currentStructure, proposedStructure, rationale, expectedImpact } }
      : null;
  }
  if (intent === "side-effect" && node.type === "route_governance_meeting") {
    const meetingId = text(formData, "meetingId");
    const proposalArtifactId = text(formData, "proposalArtifactId");
    const confirmed = formData.get("confirmed") === "yes";
    return meetingId && proposalArtifactId && confirmed ? { kind: "EXECUTE_SIDE_EFFECT", payload: { confirmed: true, meetingId, proposalArtifactId } } : null;
  }
  return null;
}

const MAX_EVIDENCE_FIELD_BYTES = 8 * 1024;
const MAX_EVIDENCE_TOTAL_BYTES = 32 * 1024;

type CurrentNode = { type: string; roleId: string | null; fields: string[] | null };
function readCurrentNode(compiled: unknown, nodeId: string): CurrentNode | null {
  if (!isRecord(compiled) || !Array.isArray(compiled.nodes)) return null;
  const node = compiled.nodes.find((item) => isRecord(item) && item.id === nodeId);
  if (!isRecord(node) || typeof node.type !== "string" || !isRecord(node.config)) return null;
  const fields = Array.isArray(node.config.fields) && node.config.fields.every((field) => typeof field === "string") ? node.config.fields : null;
  return { type: node.type, roleId: typeof node.config.roleId === "string" ? node.config.roleId : null, fields };
}
function parseRevision(value: FormDataEntryValue | null): number | null { const parsed = Number(value); return typeof value === "string" && Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null; }
function isUuid(value: string): boolean { return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value); }
function runUrl(runId: string): string { return `/app/interfaces/runs/${encodeURIComponent(runId)}`; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function text(formData: FormData, key: string): string { const value = formData.get(key); return typeof value === "string" ? value.trim() : ""; }
