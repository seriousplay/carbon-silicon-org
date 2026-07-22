import Link from "next/link";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/db";
import { requireSession, getCurrentPerson } from "@/lib/session";
import { canAdvanceInterfaceWorkflow, canViewInterfaceWorkflow } from "@/lib/interface-workbench/runtime-permissions";
import { listGovernanceRouteMeetings, resolveGovernanceCandidateArtifact, resolveGovernanceCandidatesRoutedToMeeting, resolveTacticalRoute } from "@/lib/domain-operations";
import { canAccessGovernanceRouteOnlyPage, persistedGovernanceRouteCommandKey } from "./governance-route-boundary";
import { RunWorkspace, type WorkspaceBinding, type WorkspaceEvent, type WorkspaceNode } from "./run-workspace";

export default async function InterfaceRunPage({ params, searchParams }: { params: Promise<{ runId: string }>; searchParams: Promise<{ message?: string | string[] }> }) {
  const { runId } = await params;
  const session = await requireSession();
  const person = await getCurrentPerson();
  if (!person) notFound();
  const [membership, actorRoles, run, tacticalMeetings] = await Promise.all([
    prisma.membership.findUnique({ where: { userId_organizationId: { userId: session.user.id, organizationId: person.organizationId } }, select: { role: true } }),
    prisma.roleDef.findMany({ where: { organizationId: person.organizationId, assignees: { some: { id: person.id } } }, select: { id: true } }),
    prisma.interfaceWorkflowRun.findFirst({
      where: { id: runId, organizationId: person.organizationId },
      select: {
        id: true, organizationId: true, status: true, revision: true, currentNodeId: true, currentNodeVisit: true, evidence: true,
        version: { select: { version: true, compiledSnapshot: true } },
        workbench: { select: { interface: { select: {
          name: true, organizationId: true, ownerId: true, contractContent: true, acceptanceCriteria: true,
          fromCircle: { select: { name: true, leadPersonId: true } }, toCircle: { select: { name: true, leadPersonId: true } },
          supportPeople: { select: { id: true } }, supportRoles: { select: { id: true } },
        } } } },
        roleBindings: { select: { roleId: true, organizationId: true, personId: true, roleDefId: true, person: { select: { name: true } }, roleDef: { select: { name: true } } } },
        waitingRoleBinding: { select: { roleId: true, organizationId: true, personId: true, roleDefId: true, person: { select: { name: true } }, roleDef: { select: { name: true } } } },
        events: { orderBy: { sequence: "asc" }, select: { id: true, sequence: true, type: true, payload: true, createdAt: true, actor: { select: { name: true } } } },
        commands: { orderBy: { createdAt: "asc" }, select: { id: true, nodeId: true, nodeVisit: true, kind: true, status: true, attempts: true, clientIdempotencyKey: true, error: true, createdAt: true } },
        artifacts: { orderBy: { createdAt: "asc" }, select: { id: true, runId: true, artifactType: true, artifactId: true, relation: true, metadata: true, createdAt: true } },
      },
    }),
    prisma.meeting.findMany({ where: { organizationId: person.organizationId, type: "TACTICAL" }, select: { id: true, title: true, startedAt: true }, orderBy: { startedAt: "desc" } }),
  ]);
  if (!membership || !run) notFound();
  const actor = { organizationId: person.organizationId, personId: person.id, membershipRole: membership.role, assignedRoleDefIds: actorRoles.map((role) => role.id) };
  const intf = run.workbench.interface;
  const interfaceContext = { organizationId: intf.organizationId, ownerId: intf.ownerId, fromCircleLeadPersonId: intf.fromCircle.leadPersonId, toCircleLeadPersonId: intf.toCircle.leadPersonId, supportPersonIds: intf.supportPeople.map((item) => item.id), supportRoleDefIds: intf.supportRoles.map((item) => item.id) };
  const node = readCurrentNode(run.version.compiledSnapshot, run.currentNodeId);
  const canViewFullRun = canViewInterfaceWorkflow(actor, interfaceContext);
  const artifacts = await verifiedArtifacts(person.organizationId, person.id, run.id, run.artifacts);
  const governanceMeetings = node?.type === "route_governance_meeting" ? await governanceMeetingsForArtifacts(person.organizationId, person.id, run.id, artifacts) : [];
  const routeOnly = canAccessGovernanceRouteOnlyPage({ canViewFullRun, nodeType: node?.type ?? null, eligibleMeetingCount: governanceMeetings.length });
  if (!canViewFullRun && !routeOnly) notFound();
  const binding = run.status === "WAITING" ? run.waitingRoleBinding : node?.roleId ? run.roleBindings.find((item) => item.roleId === node.roleId) ?? null : null;
  const directPermission = binding ? canAdvanceInterfaceWorkflow(actor, interfaceContext, binding) : { allowed: false, requiresTakeoverEvent: false };
  const takeoverPermission = binding ? canAdvanceInterfaceWorkflow(actor, interfaceContext, binding, { takeover: true }) : { allowed: false, requiresTakeoverEvent: false };
  const message = firstParam((await searchParams).message);

  const governanceNode = node?.type === "mark_governance_candidate" || node?.type === "route_governance_meeting";
  const canAct = node?.type === "route_governance_meeting" ? governanceMeetings.length > 0 : governanceNode ? canViewFullRun : directPermission.allowed;
  const retryIdempotencyKey = persistedGovernanceRouteCommandKey({ nodeType: node?.type ?? null, currentNodeId: run.currentNodeId, currentNodeVisit: run.currentNodeVisit, commands: run.commands });
  return <><div className="mx-auto mb-4 flex max-w-5xl items-center justify-between"><Button variant="ghost" size="sm" nativeButton={false} render={<Link href={routeOnly ? "/app" : "/app/interfaces/runs"} />}>{routeOnly ? "返回工作台" : "返回运行台"}</Button>{message ? <p className="text-sm text-muted-foreground" role="status">{messageText(message)}</p> : null}</div><RunWorkspace routeOnly={routeOnly} retryIdempotencyKey={retryIdempotencyKey} run={{ id: run.id, status: run.status, revision: run.revision, evidence: run.evidence, interfaceName: intf.name, fromCircleName: intf.fromCircle.name, toCircleName: intf.toCircle.name, version: run.version.version, contractContent: intf.contractContent, acceptanceCriteria: intf.acceptanceCriteria }} node={node} responsibility={bindingLabel(binding)} canAct={canAct} canTakeOver={!routeOnly && run.status === "WAITING" && takeoverPermission.allowed && takeoverPermission.requiresTakeoverEvent} events={run.events.map(toWorkspaceEvent)} commands={run.commands} artifacts={artifacts} tacticalMeetings={tacticalMeetings} governanceMeetings={governanceMeetings}/></>;
}

function readCurrentNode(compiled: unknown, nodeId: string): (WorkspaceNode & { roleId: string | null }) | null {
  if (!isRecord(compiled) || !Array.isArray(compiled.nodes)) return null;
  const node = compiled.nodes.find((item) => isRecord(item) && item.id === nodeId);
  if (!isRecord(node) || typeof node.type !== "string" || !isRecord(node.config)) return null;
  const config = node.config;
  return { type: node.type, roleId: typeof config.roleId === "string" ? config.roleId : null, prompt: typeof config.prompt === "string" ? config.prompt : null, request: typeof config.request === "string" ? config.request : null, fields: Array.isArray(config.fields) && config.fields.every((field) => typeof field === "string") ? config.fields : [], outcome: typeof config.outcome === "string" ? config.outcome : null, reason: typeof config.reason === "string" ? config.reason : null };
}

function bindingLabel(binding: { roleId: string; person: { name: string } | null; roleDef: { name: string } | null } | null): WorkspaceBinding { return binding ? { symbolicRoleId: binding.roleId, personName: binding.person?.name ?? null, roleName: binding.roleDef?.name ?? null } : null; }
function toWorkspaceEvent(event: { id: string; sequence: number; type: string; payload: unknown; createdAt: Date; actor: { name: string } | null }): WorkspaceEvent { return { id: event.id, sequence: event.sequence, type: event.type, actorName: event.actor?.name ?? null, createdAt: event.createdAt, summary: eventSummary(event.type, event.payload) }; }
function eventSummary(type: string, payload: unknown): string | null { if (!isRecord(payload)) return null; if (type === "EVIDENCE_RECORDED" && Array.isArray(payload.fields) && payload.fields.every((field) => typeof field === "string")) return payload.fields.join("、"); if (type === "COMPLETED" && typeof payload.outcome === "string") return payload.outcome; if (type === "TERMINATED" && typeof payload.reason === "string") return payload.reason; return null; }
function messageText(message: string): string { return ({ conflict: "运行已被更新，页面已刷新。", denied: "当前动作不属于你。", "invalid-input": "提交内容无效，请检查后重试。", failed: "操作未完成，请重试。", retry: "执行失败，已保留审计记录，可以立即重试。", "in-progress": "该操作正在执行，请稍后刷新。" } as Record<string, string>)[message] ?? "操作未完成，请重试。"; }
function firstParam(value: string | string[] | undefined): string | undefined { return Array.isArray(value) ? value[0] : value; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

async function verifiedArtifacts(organizationId: string, actorId: string, runId: string, artifacts: Array<{ id: string; runId: string; artifactType: string; artifactId: string; relation: string; metadata: unknown; createdAt: Date }>) {
  const verified: Array<{ id: string; artifactType: "TENSION" | "GOVERNANCE_PROPOSAL" | "MEETING" | "PROJECT" | "ACTION"; artifactId: string; relation: string; createdAt: Date; href: string; label: string; canAuthor?: boolean }> = [];
  for (const artifact of artifacts) {
    if (artifact.runId !== runId || !validArtifactMetadata(artifact.metadata)) continue;
    if (artifact.artifactType === "TENSION" && artifact.relation === "raised-tension") {
      const tension = await prisma.tension.findFirst({ where: { id: artifact.artifactId, organizationId }, select: { id: true, title: true, raiserId: true } });
      if (tension) verified.push({ id: artifact.id, artifactType: "TENSION", artifactId: tension.id, relation: artifact.relation, createdAt: artifact.createdAt, href: `/app/tensions/${tension.id}`, label: tension.title, canAuthor: tension.raiserId === actorId });
      continue;
    }
    if (artifact.artifactType === "GOVERNANCE_PROPOSAL" && artifact.relation.startsWith("governance-candidate:") && artifact.relation === `governance-candidate:${artifact.metadata.commandId}` && typeof artifact.metadata.sourceTensionArtifactId === "string") {
      try {
        const candidate = await resolveGovernanceCandidateArtifact(prisma, { organizationId, runId, proposalArtifactId: artifact.id });
        const proposal = await prisma.governanceProposal.findFirst({ where: { id: candidate.proposalId, organizationId, status: "CANDIDATE", tensionId: candidate.tensionId }, select: { id: true, tension: { select: { title: true } } } });
        if (proposal) verified.push({ id: artifact.id, artifactType: "GOVERNANCE_PROPOSAL", artifactId: proposal.id, relation: artifact.relation, createdAt: artifact.createdAt, href: `/app/tensions/${candidate.tensionId}`, label: proposal.tension.title });
      } catch {
        continue;
      }
      continue;
    }
    if ((artifact.artifactType === "PROJECT" || artifact.artifactType === "ACTION") && artifact.relation.startsWith("tactical-outcome:") && isRecord(artifact.metadata) && typeof artifact.metadata.proposalId === "string" && artifact.relation === `tactical-outcome:${artifact.metadata.proposalId}`) {
      const proposal = await prisma.tacticalOutcomeProposal.findFirst({
        where: {
          id: artifact.metadata.proposalId,
          organizationId,
          runId,
          status: "APPROVED",
          kind: artifact.artifactType,
          ...(artifact.artifactType === "PROJECT" ? { outcomeProjectId: artifact.artifactId } : { outcomeActionId: artifact.artifactId }),
        },
        select: { id: true },
      });
      if (!proposal) continue;
      if (artifact.artifactType === "PROJECT") {
        const project = await prisma.project.findFirst({ where: { id: artifact.artifactId, organizationId }, select: { id: true, name: true } });
        if (project) verified.push({ id: artifact.id, artifactType: "PROJECT", artifactId: project.id, relation: artifact.relation, createdAt: artifact.createdAt, href: `/app/projects/${project.id}`, label: project.name });
      } else {
        const action = await prisma.tension.findFirst({ where: { id: artifact.artifactId, organizationId }, select: { id: true, title: true } });
        if (action) verified.push({ id: artifact.id, artifactType: "ACTION", artifactId: action.id, relation: artifact.relation, createdAt: artifact.createdAt, href: `/app/tracker/${action.id}`, label: action.title });
      }
      continue;
    }
    if (artifact.artifactType === "MEETING" && artifact.relation.startsWith("governance-route:") && isRecord(artifact.metadata) && artifact.metadata.meetingType === "GOVERNANCE" && artifact.relation === `governance-route:${artifact.metadata.commandId}` && typeof artifact.metadata.proposalId === "string" && typeof artifact.metadata.proposalArtifactId === "string" && typeof artifact.metadata.sourceTensionArtifactId === "string") {
      const metadata = artifact.metadata;
      const routes = await resolveGovernanceCandidatesRoutedToMeeting(prisma, { organizationId, meetingId: artifact.artifactId });
      const exact = routes.some((route) => route.runId === runId && route.proposalId === metadata.proposalId && route.proposalArtifactId === metadata.proposalArtifactId);
      const meeting = exact ? await prisma.meeting.findFirst({ where: { id: artifact.artifactId, organizationId, type: "GOVERNANCE" }, select: { id: true, title: true } }) : null;
      if (meeting) verified.push({ id: artifact.id, artifactType: "MEETING", artifactId: meeting.id, relation: artifact.relation, createdAt: artifact.createdAt, href: `/app/meetings/${meeting.id}`, label: meeting.title });
      continue;
    }
    if (artifact.artifactType !== "MEETING" || !artifact.relation.startsWith("tactical-route:") || !isRecord(artifact.metadata) || artifact.metadata.meetingType !== "TACTICAL" || artifact.relation !== `tactical-route:${artifact.metadata.commandId}` || typeof artifact.metadata.sourceTensionArtifactId !== "string") continue;
    try {
      const route = await resolveTacticalRoute(prisma, { organizationId, runId, sourceTensionArtifactId: artifact.metadata.sourceTensionArtifactId, meetingId: artifact.artifactId });
      const meeting = await prisma.meeting.findFirst({ where: { id: route.meetingId, organizationId, type: "TACTICAL" }, select: { title: true } });
      if (meeting) verified.push({ id: artifact.id, artifactType: "MEETING", artifactId: route.meetingId, relation: artifact.relation, createdAt: artifact.createdAt, href: `/app/meetings/${route.meetingId}`, label: meeting.title });
    } catch {
      continue;
    }
  }
  return verified;
}

async function governanceMeetingsForArtifacts(organizationId: string, actorId: string, runId: string, artifacts: Awaited<ReturnType<typeof verifiedArtifacts>>) {
  const candidate = artifacts.find((artifact) => artifact.artifactType === "GOVERNANCE_PROPOSAL");
  if (!candidate) return [];
  try {
    return await listGovernanceRouteMeetings(prisma, { organizationId, actorId, runId, proposalArtifactId: candidate.id });
  } catch {
    return [];
  }
}

function validArtifactMetadata(value: unknown): value is Record<string, unknown> & { schemaVersion: 1; commandId: string; nodeId: string; nodeVisit: number } {
  return isRecord(value) && value.schemaVersion === 1 && typeof value.commandId === "string" && typeof value.nodeId === "string" && Number.isSafeInteger(value.nodeVisit) && Number(value.nodeVisit) >= 0;
}
