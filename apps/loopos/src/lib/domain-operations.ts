import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import {
  authorizeSubmitMutation,
  readAuthorizedMutationReplay,
  runAuthorizedMutation,
  storedMutationEnvelope,
} from "@/lib/tactical-outcome-authority";
import { evaluateMeetingLifecycle } from "@/lib/organization-setup/meeting-lifecycle-policy";

type DomainOperationClient = Pick<
  Prisma.TransactionClient,
  "$queryRaw" | "circle" | "decisionRecord" | "governanceDecisionProcess" | "governanceProposal" | "governanceProposalRevision" | "interfaceWorkflowArtifact" | "interfaceWorkflowCommand" | "interfaceWorkflowRun" | "interfaceWorkflowRunEvent" | "meeting" | "organization" | "person" | "tacticalOutcomeProposal" | "tension"
>;

export const GOVERNANCE_STRUCTURAL_CATEGORIES = [
  "ROLE",
  "CIRCLE",
  "DOMAIN_AUTHORITY",
  "ACCOUNTABILITY",
  "POLICY",
  "INTERFACE_RELATIONSHIP",
] as const;

export type GovernanceStructuralCategory = typeof GOVERNANCE_STRUCTURAL_CATEGORIES[number];
export type GovernanceCandidateDraft = {
  structuralCategory: GovernanceStructuralCategory;
  currentStructure: string;
  proposedStructure: string;
  expectedImpact: string;
  rationale: string;
};

export type GovernanceCandidateResolution = {
  proposalId: string;
  tensionId: string;
  sourceArtifactId: string;
  draft: GovernanceCandidateDraft;
};

export async function authorizeGovernanceCandidateAuthor(
  client: DomainOperationClient,
  input: { organizationId: string; runId: string; actorId: string; sourceTensionArtifactId: string },
): Promise<{ tensionId: string; sourceArtifactId: string }> {
  const sourceArtifact = await client.interfaceWorkflowArtifact.findFirst({
    where: { id: input.sourceTensionArtifactId, organizationId: input.organizationId, runId: input.runId, artifactType: "TENSION", relation: "raised-tension" },
    select: { id: true, artifactId: true },
  });
  if (!sourceArtifact) throw new DomainOperationError("SOURCE_TENSION_ARTIFACT_NOT_FOUND");
  const tension = await client.tension.findFirst({
    where: { id: sourceArtifact.artifactId, organizationId: input.organizationId, status: "OPEN", raiserId: input.actorId },
    select: { id: true },
  });
  if (!tension) throw new DomainOperationError("GOVERNANCE_CANDIDATE_AUTHOR_FORBIDDEN");
  return { tensionId: tension.id, sourceArtifactId: sourceArtifact.id };
}

export async function createGovernanceCandidate(
  client: DomainOperationClient,
  input: {
    organizationId: string;
    runId: string;
    actorId: string;
    sourceTensionArtifactId: string;
    draft: GovernanceCandidateDraft;
  },
): Promise<GovernanceCandidateResolution> {
  const draft = validateGovernanceCandidateDraft(input.draft);
  const authorized = await authorizeGovernanceCandidateAuthor(client, input);
  const existing = await client.governanceProposal.findFirst({
    where: { organizationId: input.organizationId, tensionId: authorized.tensionId, status: "CANDIDATE" },
    select: { id: true },
  });
  if (existing) throw new DomainOperationError("GOVERNANCE_CANDIDATE_EXISTS");
  const proposal = await client.governanceProposal.create({
    data: {
      organizationId: input.organizationId,
      type: draft.structuralCategory,
      proposedChange: JSON.stringify({
        schemaVersion: 1,
        structuralCategory: draft.structuralCategory,
        currentStructure: draft.currentStructure,
        proposedStructure: draft.proposedStructure,
        expectedImpact: draft.expectedImpact,
      }),
      rationale: draft.rationale,
      status: "CANDIDATE",
      tensionId: authorized.tensionId,
      meetingId: null,
    },
    select: { id: true },
  });
  return { proposalId: proposal.id, tensionId: authorized.tensionId, sourceArtifactId: authorized.sourceArtifactId, draft };
}

export type GovernanceRouteResolution = {
  proposalId: string;
  proposalArtifactId: string;
  sourceTensionArtifactId: string;
  tensionId: string;
  meetingId: string;
};

export type GovernanceReplayCommand = {
  id: string;
  nodeId: string;
  nodeVisit: number;
  kind: string;
  clientIdempotencyKey: string;
  actorId: string;
  payload: unknown;
  status: "SUCCEEDED";
};

export type GovernanceRouteMeeting = {
  id: string;
  title: string;
  startedAt: Date;
};

export type VerifiedGovernanceCandidate = {
  proposalId: string;
  proposalArtifactId: string;
  sourceTensionArtifactId: string;
  tensionId: string;
  proposerId: string;
  meetingId: string | null;
};

type GovernanceCandidateContext = GovernanceRouteResolution & {
  proposerId: string;
  candidateCommand: GovernanceReplayCommand;
  candidateRevision: number;
  proposalMeetingId: string | null;
};

export type RoutedGovernanceCandidateForDecision = {
  organizationId: string;
  proposal: { id: string; status: string; meetingId: string; proposedChange: string; rationale: string };
  tension: { id: string; status: string; raiserId: string };
  proposerId: string;
  meeting: { id: string; type: "GOVERNANCE" };
  run: { id: string };
  sourceTensionArtifact: { id: string; artifactId: string; relation: string };
  proposalArtifact: { id: string; artifactId: string; relation: string };
  routeArtifact: { id: string; artifactId: string; relation: string };
  candidateCommand: GovernanceReplayCommand;
  routeCommand: GovernanceReplayCommand;
  candidateRevision: number;
  routeRevision: number;
  process: {
    id: string;
    state: string;
    currentRevision: number;
    currentRevisionId: string;
    proposerId: string;
    sourceTensionId: string;
    meetingId: string;
    runId: string | null;
    sourceTensionArtifactId: string | null;
    proposalArtifactId: string | null;
    routeArtifactId: string | null;
  } | null;
  revision: {
    id: string;
    revision: number;
    authoredById: string;
    currentStructure: string;
    proposedStructure: string;
    rationale: string;
    expectedImpact: string;
    typedChange: unknown;
  } | null;
};

export async function resolveRoutedGovernanceCandidateForDecision(
  client: DomainOperationClient,
  input: { organizationId: string; runId: string; proposalId: string; proposalArtifactId: string; routeArtifactId: string; meetingId: string },
): Promise<RoutedGovernanceCandidateForDecision> {
  const [proposalArtifact, routeArtifact, proposal, meeting, run, process] = await Promise.all([
    client.interfaceWorkflowArtifact.findFirst({ where: { id: input.proposalArtifactId, organizationId: input.organizationId, runId: input.runId, artifactType: "GOVERNANCE_PROPOSAL", artifactId: input.proposalId }, select: { id: true, artifactId: true, relation: true, metadata: true } }),
    client.interfaceWorkflowArtifact.findFirst({ where: { id: input.routeArtifactId, organizationId: input.organizationId, runId: input.runId, artifactType: "MEETING", artifactId: input.meetingId }, select: { id: true, artifactId: true, relation: true, metadata: true } }),
    client.governanceProposal.findFirst({ where: { id: input.proposalId, organizationId: input.organizationId }, select: { id: true, status: true, meetingId: true, type: true, proposedChange: true, rationale: true, tensionId: true, tension: { select: { id: true, status: true, raiserId: true } } } }),
    client.meeting.findFirst({ where: { id: input.meetingId, organizationId: input.organizationId, type: "GOVERNANCE" }, select: { id: true, type: true } }),
    client.interfaceWorkflowRun.findFirst({ where: { id: input.runId, organizationId: input.organizationId }, select: { id: true } }),
    client.governanceDecisionProcess.findFirst({ where: { organizationId: input.organizationId, proposalId: input.proposalId }, select: { id: true, state: true, currentRevision: true, currentRevisionId: true, proposerId: true, sourceTensionId: true, meetingId: true, runId: true, sourceTensionArtifactId: true, proposalArtifactId: true, routeArtifactId: true } }),
  ]);
  const candidateMetadata = proposalArtifact ? readGovernanceCandidateMetadata(proposalArtifact.metadata) : null;
  const routeMetadata = routeArtifact ? readGovernanceRouteMetadata(routeArtifact.metadata) : null;
  if (!proposalArtifact || !routeArtifact || !proposal || !meeting || !run || !candidateMetadata || !routeMetadata || !proposal.meetingId) throw new DomainOperationError("GOVERNANCE_DECISION_PROVENANCE_INVALID");
  const [sourceTensionArtifact, candidateCommand, routeCommand, revision] = await Promise.all([
    client.interfaceWorkflowArtifact.findFirst({ where: { id: candidateMetadata.sourceTensionArtifactId, organizationId: input.organizationId, runId: input.runId, artifactType: "TENSION", artifactId: candidateMetadata.tensionId, relation: "raised-tension" }, select: { id: true, artifactId: true, relation: true } }),
    readGovernanceCommand(client, input.organizationId, input.runId, candidateMetadata.commandId),
    readGovernanceCommand(client, input.organizationId, input.runId, routeMetadata.commandId),
    process?.currentRevisionId ? client.governanceProposalRevision.findFirst({ where: { id: process.currentRevisionId, organizationId: input.organizationId, processId: process.id, proposalId: input.proposalId, revision: process.currentRevision }, select: { id: true, revision: true, authoredById: true, currentStructure: true, proposedStructure: true, rationale: true, expectedImpact: true, typedChange: true } }) : Promise.resolve(null),
  ]);
  const candidatePayload = candidateCommand ? readGovernanceCandidatePayload(candidateCommand.payload) : null;
  const routePayload = routeCommand ? readGovernanceRoutePayload(routeCommand.payload) : null;
  const proposedChange = readGovernanceProposedChange(proposal.proposedChange);
  const processMatches = process === null || (process.currentRevisionId !== null && process.proposerId === proposal.tension.raiserId && process.sourceTensionId === proposal.tensionId && process.meetingId === input.meetingId && process.runId === input.runId && process.sourceTensionArtifactId === candidateMetadata.sourceTensionArtifactId && process.proposalArtifactId === input.proposalArtifactId && process.routeArtifactId === input.routeArtifactId && revision !== null);
  const openCandidate = proposal.status === "CANDIDATE" && proposal.tension.status === "OPEN";
  const terminalReplay = process !== null && ((process.state === "ADOPTED" && proposal.status === "ADOPTED" && proposal.tension.status === "RESOLVED") || (process.state !== "ADOPTED" && proposal.status === "CANDIDATE" && proposal.tension.status === "OPEN"));
  if (!sourceTensionArtifact || !candidateCommand || !routeCommand || !candidatePayload || !routePayload || !proposedChange || !processMatches || (!openCandidate && !terminalReplay)
    || proposalArtifact.relation !== `governance-candidate:${candidateMetadata.commandId}` || routeArtifact.relation !== `governance-route:${routeMetadata.commandId}`
    || candidateMetadata.runId !== input.runId || routeMetadata.runId !== input.runId || candidateMetadata.proposalId !== input.proposalId || routeMetadata.proposalId !== input.proposalId
    || candidateMetadata.proposerId !== proposal.tension.raiserId || candidateMetadata.tensionId !== proposal.tensionId || routeMetadata.tensionId !== proposal.tensionId
    || routeMetadata.proposalArtifactId !== input.proposalArtifactId || routeMetadata.sourceTensionArtifactId !== sourceTensionArtifact.id || routeMetadata.meetingType !== "GOVERNANCE"
    || proposal.meetingId !== input.meetingId || routePayload.meetingId !== input.meetingId || routePayload.proposalArtifactId !== input.proposalArtifactId
    || candidateCommand.nodeId !== candidateMetadata.nodeId || candidateCommand.nodeVisit !== candidateMetadata.nodeVisit || candidateCommand.actorId !== candidateMetadata.proposerId
    || routeCommand.nodeId !== routeMetadata.nodeId || routeCommand.nodeVisit !== routeMetadata.nodeVisit || routeCommand.actorId !== routeMetadata.actorId
    || candidatePayload.sourceTensionArtifactId !== sourceTensionArtifact.id || proposal.type !== candidatePayload.draft.structuralCategory
    || proposedChange.structuralCategory !== candidatePayload.draft.structuralCategory || proposedChange.currentStructure !== candidatePayload.draft.currentStructure || proposedChange.proposedStructure !== candidatePayload.draft.proposedStructure || proposedChange.expectedImpact !== candidatePayload.draft.expectedImpact || proposal.rationale !== candidatePayload.draft.rationale) {
    throw new DomainOperationError("GOVERNANCE_DECISION_PROVENANCE_INVALID");
  }
  return {
    organizationId: input.organizationId,
    proposal: { id: proposal.id, status: proposal.status, meetingId: proposal.meetingId, proposedChange: proposal.proposedChange, rationale: proposal.rationale },
    tension: proposal.tension,
    proposerId: proposal.tension.raiserId,
    meeting: { id: meeting.id, type: "GOVERNANCE" },
    run,
    sourceTensionArtifact,
    proposalArtifact: { id: proposalArtifact.id, artifactId: proposalArtifact.artifactId, relation: proposalArtifact.relation },
    routeArtifact: { id: routeArtifact.id, artifactId: routeArtifact.artifactId, relation: routeArtifact.relation },
    candidateCommand,
    routeCommand,
    candidateRevision: candidateMetadata.revision,
    routeRevision: routeMetadata.revision,
    process: process ? { ...process, currentRevisionId: process.currentRevisionId! } : null,
    revision,
  };
}

export async function resolveGovernanceCandidateArtifact(
  client: DomainOperationClient,
  input: { organizationId: string; runId: string; proposalArtifactId: string },
): Promise<VerifiedGovernanceCandidate> {
  const candidate = await resolveGovernanceCandidateContext(client, input);
  return {
    proposalId: candidate.proposalId,
    proposalArtifactId: candidate.proposalArtifactId,
    sourceTensionArtifactId: candidate.sourceTensionArtifactId,
    tensionId: candidate.tensionId,
    proposerId: candidate.proposerId,
    meetingId: candidate.proposalMeetingId,
  };
}

export async function listGovernanceRouteMeetings(
  client: DomainOperationClient,
  input: { organizationId: string; runId: string; actorId: string; proposalArtifactId: string },
): Promise<GovernanceRouteMeeting[]> {
  const candidate = await resolveGovernanceCandidateContext(client, input);
  if (candidate.proposalMeetingId !== null) return [];
  return client.meeting.findMany({
    where: {
      organizationId: input.organizationId,
      type: "GOVERNANCE",
      AND: [
        { participants: { some: { id: candidate.proposerId, organizationId: input.organizationId } } },
        { participants: { some: { id: input.actorId, organizationId: input.organizationId } } },
      ],
    },
    select: { id: true, title: true, startedAt: true },
    orderBy: { startedAt: "desc" },
  });
}

export async function authorizeGovernanceRoute(
  client: DomainOperationClient,
  input: { organizationId: string; runId: string; actorId: string; proposalArtifactId: string; meetingId: string },
): Promise<GovernanceRouteResolution> {
  const candidate = await resolveGovernanceCandidateContext(client, input);
  if (candidate.proposalMeetingId !== null && candidate.proposalMeetingId !== input.meetingId) {
    throw new DomainOperationError("GOVERNANCE_ROUTE_ALREADY_CLAIMED");
  }
  const meeting = await client.meeting.findFirst({
    where: { id: input.meetingId, organizationId: input.organizationId, type: "GOVERNANCE", AND: [{ participants: { some: { id: candidate.proposerId, organizationId: input.organizationId } } }, { participants: { some: { id: input.actorId, organizationId: input.organizationId } } }] },
    select: { id: true },
  });
  if (!meeting) throw new DomainOperationError("GOVERNANCE_ROUTE_PARTICIPANT_FORBIDDEN");
  return { proposalId: candidate.proposalId, proposalArtifactId: candidate.proposalArtifactId, sourceTensionArtifactId: candidate.sourceTensionArtifactId, tensionId: candidate.tensionId, meetingId: meeting.id };
}

export async function authorizeGovernanceCandidateReplay(
  client: DomainOperationClient,
  input: {
    organizationId: string;
    runId: string;
    actorId: string;
    sourceTensionArtifactId: string;
    expectedRevision: number;
    command: GovernanceReplayCommand;
  },
): Promise<GovernanceCandidateResolution> {
  const proposalArtifact = await client.interfaceWorkflowArtifact.findFirst({
    where: {
      organizationId: input.organizationId,
      runId: input.runId,
      artifactType: "GOVERNANCE_PROPOSAL",
      relation: `governance-candidate:${input.command.id}`,
    },
    select: { id: true },
  });
  if (!proposalArtifact) throw new DomainOperationError("GOVERNANCE_CANDIDATE_REPLAY_FORBIDDEN");
  const candidate = await resolveGovernanceCandidateContext(client, {
    organizationId: input.organizationId,
    runId: input.runId,
    proposalArtifactId: proposalArtifact.id,
  });
  if (
    candidate.proposerId !== input.actorId
    || candidate.sourceTensionArtifactId !== input.sourceTensionArtifactId
    || candidate.candidateRevision !== input.expectedRevision
    || !sameGovernanceCommand(candidate.candidateCommand, input.command)
  ) {
    throw new DomainOperationError("GOVERNANCE_CANDIDATE_REPLAY_FORBIDDEN");
  }
  return {
    proposalId: candidate.proposalId,
    tensionId: candidate.tensionId,
    sourceArtifactId: candidate.sourceTensionArtifactId,
    draft: readGovernanceCandidatePayload(candidate.candidateCommand.payload)!.draft,
  };
}

export async function authorizeGovernanceRouteReplay(
  client: DomainOperationClient,
  input: {
    organizationId: string;
    runId: string;
    actorId: string;
    proposalArtifactId: string;
    meetingId: string;
    expectedRevision: number;
    command: GovernanceReplayCommand;
    routeArtifactId?: string;
  },
): Promise<GovernanceRouteResolution> {
  const authorized = await authorizeGovernanceRoute(client, input);
  const routeArtifact = await client.interfaceWorkflowArtifact.findFirst({
    where: {
      ...(input.routeArtifactId ? { id: input.routeArtifactId } : {}),
      organizationId: input.organizationId,
      runId: input.runId,
      artifactType: "MEETING",
      artifactId: input.meetingId,
      relation: `governance-route:${input.command.id}`,
    },
    select: { id: true, runId: true, artifactId: true, relation: true, metadata: true },
  });
  const metadata = routeArtifact ? readGovernanceRouteMetadata(routeArtifact.metadata) : null;
  const storedCommand = await readGovernanceCommand(client, input.organizationId, input.runId, input.command.id);
  const payload = readGovernanceRoutePayload(input.command.payload);
  if (
    !routeArtifact
    || !metadata
    || !storedCommand
    || !payload
    || routeArtifact.relation !== `governance-route:${metadata.commandId}`
    || metadata.runId !== input.runId
    || metadata.commandId !== input.command.id
    || metadata.nodeId !== input.command.nodeId
    || metadata.nodeVisit !== input.command.nodeVisit
    || metadata.revision !== input.expectedRevision
    || metadata.actorId !== input.actorId
    || metadata.meetingType !== "GOVERNANCE"
    || metadata.proposalId !== authorized.proposalId
    || metadata.proposalArtifactId !== authorized.proposalArtifactId
    || metadata.sourceTensionArtifactId !== authorized.sourceTensionArtifactId
    || metadata.tensionId !== authorized.tensionId
    || payload.meetingId !== input.meetingId
    || payload.proposalArtifactId !== input.proposalArtifactId
    || !sameGovernanceCommand(storedCommand, input.command)
  ) {
    throw new DomainOperationError("GOVERNANCE_ROUTE_REPLAY_FORBIDDEN");
  }
  return authorized;
}

export async function resolveGovernanceCandidatesRoutedToMeeting(
  client: DomainOperationClient,
  input: { organizationId: string; meetingId: string },
): Promise<Array<GovernanceRouteResolution & { runId: string; routeArtifactId: string }>> {
  const artifacts = await client.interfaceWorkflowArtifact.findMany({
    where: { organizationId: input.organizationId, artifactType: "MEETING", artifactId: input.meetingId, relation: { startsWith: "governance-route:" } },
    select: { id: true, runId: true, metadata: true },
  });
  const resolved: Array<GovernanceRouteResolution & { runId: string; routeArtifactId: string }> = [];
  for (const artifact of artifacts) {
    const metadata = readGovernanceRouteMetadata(artifact.metadata);
    if (!metadata || metadata.runId !== artifact.runId || metadata.meetingType !== "GOVERNANCE") continue;
    const command = await readGovernanceCommand(client, input.organizationId, artifact.runId, metadata.commandId);
    if (!command) continue;
    try {
      const route = await authorizeGovernanceRouteReplay(client, {
        organizationId: input.organizationId,
        runId: artifact.runId,
        actorId: metadata.actorId,
        proposalArtifactId: metadata.proposalArtifactId,
        meetingId: input.meetingId,
        expectedRevision: metadata.revision,
        command,
        routeArtifactId: artifact.id,
      });
      resolved.push({ ...route, runId: artifact.runId, routeArtifactId: artifact.id });
    } catch {
      continue;
    }
  }
  return resolved;
}

export async function routeGovernanceCandidate(
  client: DomainOperationClient,
  input: {
    organizationId: string;
    runId: string;
    actorId: string;
    proposalArtifactId: string;
    meetingId: string;
  },
): Promise<GovernanceRouteResolution> {
  const authorized = await authorizeGovernanceRoute(client, input);
  const claimed = await client.governanceProposal.updateMany({
    where: { id: authorized.proposalId, organizationId: input.organizationId, tensionId: authorized.tensionId, status: "CANDIDATE", meetingId: null },
    data: { meetingId: authorized.meetingId },
  });
  if (claimed.count !== 1) throw new DomainOperationError("GOVERNANCE_ROUTE_ALREADY_CLAIMED");
  return authorized;
}

export type RaiseTensionInput = {
  organizationId: string;
  raiserId: string;
  title: string;
  description: string;
  type: "PROBLEMATIC" | "CONSTRUCTIVE" | "CLARIFYING";
  source: "TACTICAL_MEETING" | "GOVERNANCE_MEETING" | "BOT" | "FORM" | "ANONYMOUS_PULSE";
  circleIds?: string[];
  aiTranslation?: string | null;
  translationAccepted?: boolean | null;
  handlingMode?: "UNROUTED" | "TACTICAL" | "GOVERNANCE";
  aiHandlingSuggestion?: "TACTICAL" | "GOVERNANCE" | null;
};

export async function raiseTension(client: DomainOperationClient, input: RaiseTensionInput): Promise<{ id: string }> {
  const title = input.title.trim();
  const description = input.description.trim();
  const circleIds = [...new Set(input.circleIds ?? [])];
  if (!title || !description) throw new DomainOperationError("INVALID_TENSION");

  const [raiser, circles] = await Promise.all([
    client.person.findFirst({
      where: { id: input.raiserId, organizationId: input.organizationId },
      select: { id: true },
    }),
    circleIds.length === 0
      ? Promise.resolve([])
      : client.circle.findMany({
          where: { id: { in: circleIds }, organizationId: input.organizationId },
          select: { id: true },
        }),
  ]);
  if (!raiser) throw new DomainOperationError("RAISER_NOT_FOUND");
  if (circles.length !== circleIds.length) throw new DomainOperationError("CIRCLE_NOT_FOUND");

  return client.tension.create({
    data: {
      organizationId: input.organizationId,
      title,
      description,
      type: input.type,
      source: input.source,
      raiserId: input.raiserId,
      aiTranslation: input.aiTranslation ?? null,
      translationAccepted: input.aiTranslation ? input.translationAccepted ?? false : null,
      handlingMode: input.handlingMode ?? "UNROUTED",
      aiHandlingSuggestion: input.aiHandlingSuggestion ?? null,
      ...(circleIds.length > 0 ? { circles: { connect: circleIds.map((id) => ({ id })) } } : {}),
    },
    select: { id: true },
  });
}

type TacticalRoute = {
  runId: string;
  sourceTensionArtifactId: string;
  routeArtifactId: string;
  nodeId: string;
  nodeVisit: number;
  commandId: string;
};

type TacticalProposalProvenance =
  | { kind: "INTERFACE_RUN"; route: TacticalRoute }
  | { kind: "ORDINARY_TENSION"; route: null };

export type SubmitTacticalOutcomeProposalInput = {
  organizationId: string;
  actorId: string;
  tensionId: string;
  meetingId: string;
  expectedRevision: number;
  mutationKey: string;
  kind: "PROJECT" | "ACTION";
  title: string;
  description: string;
  circleId: string;
  responsiblePersonId: string;
  deadline?: Date | null;
};

export type SubmitTacticalOutcomeProposalResult = {
  ok: true;
  proposalId: string;
  revision: number;
  status: "PROPOSED";
};

export type UpdateMeetingNotesInput = {
  organizationId: string;
  actorId: string;
  meetingId: string;
  expectedNotesRevision: number;
  notes: string;
};

export type UpdateMeetingNotesResult = {
  ok: true;
  meetingId: string;
  notesRevision: number;
};

export async function updateMeetingNotes(
  client: DomainOperationClient,
  input: UpdateMeetingNotesInput,
): Promise<UpdateMeetingNotesResult> {
  const notes = input.notes.trim();
  if (!Number.isInteger(input.expectedNotesRevision) || input.expectedNotesRevision < 0) {
    throw new DomainOperationError("INVALID_MEETING_NOTES");
  }

  const meeting = await client.meeting.findFirst({
    where: { id: input.meetingId, organizationId: input.organizationId, type: "TACTICAL" },
    select: {
      id: true,
      endedAt: true,
      participants: { select: { id: true } },
    },
  });
  if (!meeting) throw new DomainOperationError("MEETING_NOT_AVAILABLE");
  if (!meeting.participants.some((participant) => participant.id === input.actorId)) {
    throw new DomainOperationError("MEETING_PARTICIPANT_REQUIRED");
  }
  if (meeting.endedAt) throw new DomainOperationError("MEETING_ENDED");

  const result = await client.meeting.updateMany({
    where: {
      id: input.meetingId,
      organizationId: input.organizationId,
      notesRevision: input.expectedNotesRevision,
      endedAt: null,
      participants: { some: { id: input.actorId } },
    },
    data: { notes, notesRevision: { increment: 1 } },
  });
  if (result.count !== 1) throw new DomainOperationError("MEETING_NOTES_STALE");

  return {
    ok: true,
    meetingId: input.meetingId,
    notesRevision: input.expectedNotesRevision + 1,
  };
}

export async function submitTacticalOutcomeProposal(
  client: DomainOperationClient,
  input: SubmitTacticalOutcomeProposalInput,
): Promise<SubmitTacticalOutcomeProposalResult> {
  const kind = input.kind;
  const title = input.title.trim();
  const description = input.description.trim();
  const mutationKey = input.mutationKey.trim();
  const deadline = kind === "ACTION" ? input.deadline ?? null : null;
  if ((kind !== "PROJECT" && kind !== "ACTION") || !title || !description || !input.circleId || !input.responsiblePersonId || !mutationKey) {
    throw new DomainOperationError("INVALID_TACTICAL_OUTCOME_PROPOSAL");
  }

  const organization = await client.organization.findUnique({
    where: { id: input.organizationId },
    select: { lifecycleStatus: true },
  });
  const lifecycle = evaluateMeetingLifecycle(organization?.lifecycleStatus);
  if (!lifecycle.allowed) throw new DomainOperationError(lifecycle.code);

  const [tension, meeting, circle, responsiblePerson, existing] = await Promise.all([
    client.tension.findFirst({ where: { id: input.tensionId, organizationId: input.organizationId, status: "OPEN" }, select: { id: true, raiserId: true, handlingMode: true } }),
    client.meeting.findFirst({ where: { id: input.meetingId, organizationId: input.organizationId, type: "TACTICAL", participants: { some: { id: input.actorId } } }, select: { id: true } }),
    client.circle.findFirst({ where: { id: input.circleId, organizationId: input.organizationId, status: { not: "ARCHIVED" } }, select: { id: true } }),
    client.person.findFirst({ where: { id: input.responsiblePersonId, organizationId: input.organizationId }, select: { id: true } }),
    client.tacticalOutcomeProposal.findFirst({ where: { tensionId: input.tensionId, organizationId: input.organizationId } }),
  ]);
  if (!tension) throw new DomainOperationError("TACTICAL_TENSION_NOT_AVAILABLE");
  if (tension.raiserId !== input.actorId) throw new DomainOperationError("TACTICAL_PROPOSER_REQUIRED");
  if (!meeting) throw new DomainOperationError("TACTICAL_MEETING_PARTICIPANT_REQUIRED");
  if (!circle || !responsiblePerson) throw new DomainOperationError("TACTICAL_TARGET_NOT_AVAILABLE");

  const expectedResult = kind === "PROJECT" ? description : null;
  const acceptanceCriteria = kind === "ACTION" ? description : null;
  const provenance = await resolveTacticalProposalProvenance(client, {
    organizationId: input.organizationId,
    tensionId: input.tensionId,
    meetingId: input.meetingId,
    handlingMode: tension.handlingMode,
  });
  const payload = {
    kind,
    title,
    expectedResult,
    acceptanceCriteria,
    circleId: input.circleId,
    responsiblePersonId: input.responsiblePersonId,
    deadline: deadline?.toISOString() ?? null,
  };

  let authorization;
  try {
    authorization = authorizeSubmitMutation({
      organizationId: input.organizationId,
      actorId: input.actorId,
      meetingId: input.meetingId,
      subjectId: input.tensionId,
      expectedRevision: input.expectedRevision,
      mutationKey,
      payload,
      tensionRaiserId: tension.raiserId,
      existingProposerId: existing?.proposerId ?? null,
      isSelectedTacticalMeetingParticipant: true,
    });
  } catch {
    throw new DomainOperationError("TACTICAL_OUTCOME_ACCESS_DENIED");
  }

  return runAuthorizedMutation({
    authorize: async () => ({ authorization, context: { existing, provenance } }),
    replay: async ({ authorization: authorized, context }) => {
      const duplicate = await client.tacticalOutcomeProposal.findUnique({ where: { organizationId_lastMutationKey: { organizationId: input.organizationId, lastMutationKey: mutationKey } }, select: { id: true, lastMutationKey: true, lastMutationResult: true } });
      if (!duplicate) return null;
      if (duplicate.id !== context.existing?.id) throw new DomainOperationError("MUTATION_KEY_CONFLICT");
      try {
        const prior = tacticalProposalMutationResult(readAuthorizedMutationReplay(authorized, duplicate.lastMutationKey, duplicate.lastMutationResult));
        if (!prior) throw new DomainOperationError("MUTATION_KEY_CONFLICT");
        return prior;
      } catch (error) {
        if (error instanceof DomainOperationError) throw error;
        throw new DomainOperationError("MUTATION_KEY_CONFLICT");
      }
    },
    validateFresh: ({ context }) => {
      if (!context.existing) {
        if (input.expectedRevision !== 0) throw new DomainOperationError("TACTICAL_PROPOSAL_STALE");
        return;
      }
      if ((context.existing.status !== "RETURNED" && context.existing.status !== "REJECTED") || context.existing.revision !== input.expectedRevision) {
        throw new DomainOperationError("TACTICAL_PROPOSAL_STALE");
      }
      if (
        context.existing.meetingId !== input.meetingId ||
        context.existing.provenanceKind !== context.provenance.kind ||
        context.existing.runId !== context.provenance.route?.runId ||
        context.existing.sourceTensionArtifactId !== context.provenance.route?.sourceTensionArtifactId ||
        context.existing.routeArtifactId !== context.provenance.route?.routeArtifactId
      ) {
        throw new DomainOperationError("TACTICAL_PROVENANCE_STALE");
      }
    },
    mutate: async ({ authorization: authorized, context }) => {
      if (!context.existing) {
        const proposalId = randomUUID();
        const response: SubmitTacticalOutcomeProposalResult = { ok: true, proposalId, revision: 1, status: "PROPOSED" };
        await client.tacticalOutcomeProposal.create({ data: {
          id: proposalId,
          organizationId: input.organizationId,
          tensionId: input.tensionId,
          meetingId: input.meetingId,
          provenanceKind: context.provenance.kind,
          runId: context.provenance.route?.runId ?? null,
          sourceTensionArtifactId: context.provenance.route?.sourceTensionArtifactId ?? null,
          routeArtifactId: context.provenance.route?.routeArtifactId ?? null,
          proposerId: input.actorId,
          kind,
          title,
          expectedResult,
          acceptanceCriteria,
          circleId: input.circleId,
          responsiblePersonId: input.responsiblePersonId,
          deadline,
          lastMutationKey: mutationKey,
          lastMutationResult: storedMutationEnvelope(authorized, response) as Prisma.InputJsonValue,
        } });
        if (context.provenance.route) {
          await appendTacticalOutcomeEvents(client, { organizationId: input.organizationId, runId: context.provenance.route.runId, actorId: input.actorId, nodeId: context.provenance.route.nodeId, nodeVisit: context.provenance.route.nodeVisit, events: [{ type: "TACTICAL_OUTCOME_PROPOSED", payload: { proposalId, revision: 1, kind, meetingId: input.meetingId, title, circleId: input.circleId, responsiblePersonId: input.responsiblePersonId } }] });
        }
        return response;
      }

      const revision = context.existing.revision + 1;
      const response: SubmitTacticalOutcomeProposalResult = { ok: true, proposalId: context.existing.id, revision, status: "PROPOSED" };
      const updated = await client.tacticalOutcomeProposal.updateMany({
        where: { id: context.existing.id, organizationId: input.organizationId, proposerId: input.actorId, revision: input.expectedRevision, status: { in: ["RETURNED", "REJECTED"] } },
        data: { kind, title, expectedResult, acceptanceCriteria, circleId: input.circleId, responsiblePersonId: input.responsiblePersonId, deadline, status: "PROPOSED", revision, recordedById: null, recordedAt: null, meetingDecisionNote: null, lastMutationKey: mutationKey, lastMutationResult: storedMutationEnvelope(authorized, response) as Prisma.InputJsonValue },
      });
      if (updated.count !== 1) throw new DomainOperationError("TACTICAL_PROPOSAL_STALE");
      if (context.provenance.route) {
        await appendTacticalOutcomeEvents(client, { organizationId: input.organizationId, runId: context.provenance.route.runId, actorId: input.actorId, nodeId: context.provenance.route.nodeId, nodeVisit: context.provenance.route.nodeVisit, events: [{ type: "TACTICAL_OUTCOME_PROPOSED", payload: { proposalId: context.existing.id, revision, kind, meetingId: input.meetingId, title, circleId: input.circleId, responsiblePersonId: input.responsiblePersonId } }] });
      }
      return response;
    },
  });
}

function tacticalProposalMutationResult(value: unknown): SubmitTacticalOutcomeProposalResult | null {
  if (!isRecord(value) || value.ok !== true || typeof value.proposalId !== "string" || typeof value.revision !== "number" || value.status !== "PROPOSED") {
    return null;
  }
  return {
    ok: true,
    proposalId: value.proposalId,
    revision: value.revision,
    status: "PROPOSED",
  };
}

function tacticalRouteMetadata(value: unknown): { sourceTensionArtifactId: string; commandId: string; nodeId: string; nodeVisit: number } | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || value.meetingType !== "TACTICAL") return null;
  if (typeof value.sourceTensionArtifactId !== "string" || typeof value.commandId !== "string") return null;
  return {
    sourceTensionArtifactId: value.sourceTensionArtifactId,
    commandId: value.commandId,
    nodeId: typeof value.nodeId === "string" ? value.nodeId : "route_tactical_meeting",
    nodeVisit: typeof value.nodeVisit === "number" ? value.nodeVisit : 0,
  };
}

async function findExactTacticalRoute(
  client: DomainOperationClient,
  input: { organizationId: string; tensionId: string; meetingId: string },
): Promise<TacticalRoute> {
  const sources = await client.interfaceWorkflowArtifact.findMany({
    where: { organizationId: input.organizationId, artifactType: "TENSION", artifactId: input.tensionId, relation: "raised-tension" },
    select: { id: true, runId: true },
  });
  for (const source of sources) {
    const routes = await client.interfaceWorkflowArtifact.findMany({
      where: { organizationId: input.organizationId, runId: source.runId, artifactType: "MEETING", artifactId: input.meetingId, relation: { startsWith: "tactical-route:" } },
      select: { id: true, relation: true, metadata: true },
      orderBy: { createdAt: "asc" },
    });
    for (const route of routes) {
      const metadata = tacticalRouteMetadata(route.metadata);
      if (metadata?.sourceTensionArtifactId === source.id && route.relation === `tactical-route:${metadata.commandId}`) {
        return { runId: source.runId, sourceTensionArtifactId: source.id, routeArtifactId: route.id, nodeId: metadata.nodeId, nodeVisit: metadata.nodeVisit, commandId: metadata.commandId };
      }
    }
  }
  throw new DomainOperationError("EXACT_TACTICAL_ROUTE_REQUIRED");
}

async function resolveTacticalProposalProvenance(
  client: DomainOperationClient,
  input: { organizationId: string; tensionId: string; meetingId: string; handlingMode: string },
): Promise<TacticalProposalProvenance> {
  const runtimeSource = await client.interfaceWorkflowArtifact.findFirst({
    where: { organizationId: input.organizationId, artifactType: "TENSION", artifactId: input.tensionId, relation: "raised-tension" },
    select: { id: true },
  });
  if (runtimeSource) {
    return { kind: "INTERFACE_RUN", route: await findExactTacticalRoute(client, input) };
  }
  if (input.handlingMode !== "TACTICAL") throw new DomainOperationError("TACTICAL_TENSION_ROUTE_REQUIRED");
  return { kind: "ORDINARY_TENSION", route: null };
}

async function appendTacticalOutcomeEvents(
  client: DomainOperationClient,
  input: { organizationId: string; runId: string; actorId: string; nodeId: string; nodeVisit: number; events: Array<{ type: string; payload: Record<string, unknown> }> },
): Promise<void> {
  await client.$queryRaw(Prisma.sql`SELECT "id" FROM "interface_workflow_runs" WHERE "id" = ${input.runId} AND "organizationId" = ${input.organizationId} FOR UPDATE`);
  const last = await client.interfaceWorkflowRunEvent.aggregate({ where: { runId: input.runId }, _max: { sequence: true } });
  const first = (last._max.sequence ?? 0) + 1;
  await client.interfaceWorkflowRunEvent.createMany({
    data: input.events.map((event, index) => ({
      organizationId: input.organizationId,
      runId: input.runId,
      sequence: first + index,
      type: event.type,
      nodeId: input.nodeId,
      nodeVisit: input.nodeVisit,
      actorId: input.actorId,
      payload: event.payload as Prisma.InputJsonValue,
    })),
  });
}

export type TacticalRouteResolution = {
  sourceArtifactId: string;
  tensionId: string;
  meetingId: string;
};

export async function resolveTacticalRoute(
  client: DomainOperationClient,
  input: { organizationId: string; runId: string; sourceTensionArtifactId: string; meetingId: string },
): Promise<TacticalRouteResolution> {
  const [sourceArtifact, meeting] = await Promise.all([
    client.interfaceWorkflowArtifact.findFirst({
      where: {
        id: input.sourceTensionArtifactId,
        organizationId: input.organizationId,
        runId: input.runId,
        artifactType: "TENSION",
        relation: "raised-tension",
      },
      select: { id: true, artifactId: true },
    }),
    client.meeting.findFirst({
      where: { id: input.meetingId, organizationId: input.organizationId, type: "TACTICAL" },
      select: { id: true },
    }),
  ]);
  if (!sourceArtifact) throw new DomainOperationError("SOURCE_TENSION_ARTIFACT_NOT_FOUND");
  if (!meeting) throw new DomainOperationError("TACTICAL_MEETING_NOT_FOUND");
  const tension = await client.tension.findFirst({
    where: { id: sourceArtifact.artifactId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!tension) throw new DomainOperationError("SOURCE_TENSION_NOT_FOUND");
  return { sourceArtifactId: sourceArtifact.id, tensionId: tension.id, meetingId: meeting.id };
}

export type RoutedTension = {
  tensionId: string;
  runId: string;
  sourceTensionArtifactId: string;
};

export async function resolveOpenTensionsRoutedToMeeting(
  client: DomainOperationClient,
  input: { organizationId: string; meetingId: string },
): Promise<RoutedTension[]> {
  const routes = await client.interfaceWorkflowArtifact.findMany({
    where: {
      organizationId: input.organizationId,
      artifactType: "MEETING",
      artifactId: input.meetingId,
      relation: { startsWith: "tactical-route:" },
    },
    select: { runId: true, metadata: true },
    orderBy: { createdAt: "asc" },
  });
  const resolved: RoutedTension[] = [];
  const seen = new Set<string>();
  for (const route of routes) {
    const sourceTensionArtifactId = readSourceTensionArtifactId(route.metadata);
    if (!sourceTensionArtifactId) continue;
    const source = await client.interfaceWorkflowArtifact.findFirst({
      where: {
        id: sourceTensionArtifactId,
        organizationId: input.organizationId,
        runId: route.runId,
        artifactType: "TENSION",
        relation: "raised-tension",
      },
      select: { artifactId: true },
    });
    if (!source || seen.has(source.artifactId)) continue;
    const tension = await client.tension.findFirst({
      where: { id: source.artifactId, organizationId: input.organizationId, status: "OPEN" },
      select: { id: true },
    });
    if (!tension) continue;
    seen.add(tension.id);
    resolved.push({ tensionId: tension.id, runId: route.runId, sourceTensionArtifactId });
  }
  return resolved;
}

export async function hasExactOpenTacticalRoute(
  client: DomainOperationClient,
  input: { organizationId: string; meetingId: string; tensionId: string },
): Promise<boolean> {
  const routed = await resolveOpenTensionsRoutedToMeeting(client, input);
  return routed.some((item) => item.tensionId === input.tensionId);
}

export type TensionProvenance =
  | { provenance: "ORDINARY"; tensionId: string }
  | { provenance: "RUNTIME_RAISED"; tensionId: string; sourceArtifactIds: string[] };

export async function classifyTensionProvenance(
  client: DomainOperationClient,
  input: { organizationId: string; tensionId: string },
): Promise<TensionProvenance> {
  const tension = await client.tension.findFirst({
    where: { id: input.tensionId, organizationId: input.organizationId },
    select: { id: true },
  });
  if (!tension) throw new DomainOperationError("TENSION_NOT_FOUND");
  const candidates = await client.interfaceWorkflowArtifact.findMany({
    where: {
      organizationId: input.organizationId,
      artifactType: "TENSION",
      artifactId: tension.id,
      relation: "raised-tension",
    },
    select: { id: true, runId: true },
  });
  const sourceArtifactIds: string[] = [];
  for (const candidate of candidates) {
    const run = await client.interfaceWorkflowRun.findFirst({
      where: { id: candidate.runId, organizationId: input.organizationId },
      select: { id: true },
    });
    if (run) sourceArtifactIds.push(candidate.id);
  }
  return sourceArtifactIds.length > 0
    ? { provenance: "RUNTIME_RAISED", tensionId: tension.id, sourceArtifactIds }
    : { provenance: "ORDINARY", tensionId: tension.id };
}

export async function authorizeMeetingTensionMutation(
  client: DomainOperationClient,
  input: {
    organizationId: string;
    meetingId: string;
    tensionId: string;
    operation: "TACTICAL_PROCESS" | "LEGACY_DECISION";
  },
): Promise<TensionProvenance> {
  const [meeting, provenance] = await Promise.all([
    client.meeting.findFirst({
      where: { id: input.meetingId, organizationId: input.organizationId },
      select: { id: true, type: true },
    }),
    classifyTensionProvenance(client, input),
  ]);
  if (!meeting) throw new DomainOperationError("MEETING_NOT_FOUND");
  if (input.operation === "LEGACY_DECISION") {
    if (meeting.type !== "GOVERNANCE") throw new DomainOperationError("GOVERNANCE_MEETING_REQUIRED");
    if (provenance.provenance === "RUNTIME_RAISED") throw new DomainOperationError("RUNTIME_TENSION_DECISION_FORBIDDEN");
    return provenance;
  }
  if (meeting.type !== "TACTICAL") throw new DomainOperationError("TACTICAL_MEETING_REQUIRED");
  if (
    provenance.provenance === "RUNTIME_RAISED" &&
    !await hasExactOpenTacticalRoute(client, {
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      tensionId: input.tensionId,
    })
  ) {
    throw new DomainOperationError("EXACT_TACTICAL_ROUTE_REQUIRED");
  }
  if (provenance.provenance === "RUNTIME_RAISED") {
    throw new DomainOperationError("RUNTIME_TENSION_PROPOSAL_REQUIRED");
  }
  return provenance;
}

export async function authorizeTrackerTensionMutation(
  client: DomainOperationClient,
  input: { organizationId: string; tensionId: string; actorId: string },
): Promise<{ proposalId: string; tensionId: string; ownerId: string }> {
  const [action, approvedAction] = await Promise.all([
    client.tension.findFirst({
      where: {
        id: input.tensionId,
        organizationId: input.organizationId,
        ownerId: input.actorId,
      },
      select: { id: true, ownerId: true },
    }),
    client.tacticalOutcomeProposal.findFirst({
      where: {
        organizationId: input.organizationId,
        tensionId: input.tensionId,
        status: "APPROVED",
        kind: "ACTION",
        outcomeActionId: input.tensionId,
      },
      select: { id: true },
    }),
  ]);
  if (!action?.ownerId) throw new DomainOperationError("TACTICAL_ACTION_OWNER_REQUIRED");
  if (!approvedAction) throw new DomainOperationError("TACTICAL_ACTION_APPROVAL_REQUIRED");
  return { proposalId: approvedAction.id, tensionId: action.id, ownerId: action.ownerId };
}

export async function authorizeManualProjectSource(
  client: DomainOperationClient,
  input: { organizationId: string; tensionId: string },
): Promise<TensionProvenance> {
  const provenance = await classifyTensionProvenance(client, input);
  if (provenance.provenance === "RUNTIME_RAISED") {
    throw new DomainOperationError("RUNTIME_TENSION_PROJECT_PROPOSAL_REQUIRED");
  }
  return provenance;
}

export async function convertOrdinaryTensionToGovernanceDecision(
  client: DomainOperationClient,
  input: {
    organizationId: string;
    meetingId: string;
    tensionId: string;
    title: string;
    type: Prisma.DecisionRecordUncheckedCreateInput["type"];
    content: string;
    rationale: string;
    decisionMakerId?: string;
  },
): Promise<{ id: string }> {
  await authorizeMeetingTensionMutation(client, { ...input, operation: "LEGACY_DECISION" });
  const decision = await client.decisionRecord.create({
    data: {
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      title: input.title,
      type: input.type,
      content: input.content,
      rationale: input.rationale,
      decisionMakerId: input.decisionMakerId,
      effectiveAt: new Date(),
    },
    select: { id: true },
  });
  const resolved = await client.tension.updateMany({
    where: { id: input.tensionId, organizationId: input.organizationId },
    data: { status: "RESOLVED" },
  });
  if (resolved.count !== 1) throw new DomainOperationError("TENSION_MUTATION_FAILED");
  return decision;
}

function readSourceTensionArtifactId(value: unknown): string | null {
  if (!isRecord(value) || value.schemaVersion !== 1 || typeof value.sourceTensionArtifactId !== "string") return null;
  return value.sourceTensionArtifactId;
}

async function resolveGovernanceCandidateContext(
  client: DomainOperationClient,
  input: { organizationId: string; runId: string; proposalArtifactId: string },
): Promise<GovernanceCandidateContext> {
  const proposalArtifact = await client.interfaceWorkflowArtifact.findFirst({
    where: {
      id: input.proposalArtifactId,
      organizationId: input.organizationId,
      runId: input.runId,
      artifactType: "GOVERNANCE_PROPOSAL",
    },
    select: { id: true, artifactId: true, relation: true, metadata: true },
  });
  const metadata = proposalArtifact ? readGovernanceCandidateMetadata(proposalArtifact.metadata) : null;
  if (
    !proposalArtifact
    || !metadata
    || metadata.runId !== input.runId
    || proposalArtifact.relation !== `governance-candidate:${metadata.commandId}`
    || proposalArtifact.artifactId !== metadata.proposalId
  ) {
    throw new DomainOperationError("PROPOSAL_ARTIFACT_NOT_FOUND");
  }

  const [sourceArtifact, proposal, candidateCommand] = await Promise.all([
    client.interfaceWorkflowArtifact.findFirst({
      where: {
        id: metadata.sourceTensionArtifactId,
        organizationId: input.organizationId,
        runId: input.runId,
        artifactType: "TENSION",
        relation: "raised-tension",
      },
      select: { id: true, artifactId: true },
    }),
    client.governanceProposal.findFirst({
      where: {
        id: metadata.proposalId,
        organizationId: input.organizationId,
        tensionId: metadata.tensionId,
        status: "CANDIDATE",
      },
      select: {
        id: true,
        tensionId: true,
        meetingId: true,
        type: true,
        proposedChange: true,
        rationale: true,
        tension: { select: { raiserId: true, status: true } },
      },
    }),
    readGovernanceCommand(client, input.organizationId, input.runId, metadata.commandId),
  ]);
  const candidatePayload = candidateCommand ? readGovernanceCandidatePayload(candidateCommand.payload) : null;
  const proposedChange = proposal ? readGovernanceProposedChange(proposal.proposedChange) : null;
  if (
    !sourceArtifact
    || sourceArtifact.artifactId !== metadata.tensionId
    || !proposal
    || proposal.tension.status !== "OPEN"
    || proposal.tension.raiserId !== metadata.proposerId
    || !candidateCommand
    || candidateCommand.nodeId !== metadata.nodeId
    || candidateCommand.nodeVisit !== metadata.nodeVisit
    || candidateCommand.actorId !== metadata.proposerId
    || candidateCommand.kind !== "EXECUTE_SIDE_EFFECT"
    || candidateCommand.status !== "SUCCEEDED"
    || !candidatePayload
    || candidatePayload.sourceTensionArtifactId !== metadata.sourceTensionArtifactId
    || !proposedChange
    || proposal.type !== candidatePayload.draft.structuralCategory
    || proposedChange.structuralCategory !== candidatePayload.draft.structuralCategory
    || proposedChange.currentStructure !== candidatePayload.draft.currentStructure
    || proposedChange.proposedStructure !== candidatePayload.draft.proposedStructure
    || proposedChange.expectedImpact !== candidatePayload.draft.expectedImpact
    || proposal.rationale !== candidatePayload.draft.rationale
  ) {
    throw new DomainOperationError("GOVERNANCE_CANDIDATE_PROVENANCE_INVALID");
  }
  return {
    proposalId: proposal.id,
    proposalArtifactId: proposalArtifact.id,
    sourceTensionArtifactId: sourceArtifact.id,
    tensionId: proposal.tensionId,
    meetingId: proposal.meetingId ?? "",
    proposerId: proposal.tension.raiserId,
    candidateCommand,
    candidateRevision: metadata.revision,
    proposalMeetingId: proposal.meetingId,
  };
}

type GovernanceCandidateMetadata = {
  schemaVersion: 1;
  commandId: string;
  nodeId: string;
  nodeVisit: number;
  runId: string;
  revision: number;
  sourceTensionArtifactId: string;
  tensionId: string;
  proposalId: string;
  proposerId: string;
};

type GovernanceRouteMetadata = {
  schemaVersion: 1;
  commandId: string;
  nodeId: string;
  nodeVisit: number;
  runId: string;
  revision: number;
  actorId: string;
  meetingType: "GOVERNANCE";
  proposalId: string;
  proposalArtifactId: string;
  sourceTensionArtifactId: string;
  tensionId: string;
};

function readGovernanceCandidateMetadata(value: unknown): GovernanceCandidateMetadata | null {
  const keys = "commandId,nodeId,nodeVisit,proposalId,proposerId,revision,runId,schemaVersion,sourceTensionArtifactId,tensionId";
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== keys || value.schemaVersion !== 1) return null;
  if (!nonEmptyStrings(value, ["commandId", "nodeId", "runId", "sourceTensionArtifactId", "tensionId", "proposalId", "proposerId"])) return null;
  if (!nonNegativeInteger(value.nodeVisit) || !nonNegativeInteger(value.revision)) return null;
  return value as GovernanceCandidateMetadata;
}

function readGovernanceRouteMetadata(value: unknown): GovernanceRouteMetadata | null {
  const keys = "actorId,commandId,meetingType,nodeId,nodeVisit,proposalArtifactId,proposalId,revision,runId,schemaVersion,sourceTensionArtifactId,tensionId";
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== keys || value.schemaVersion !== 1 || value.meetingType !== "GOVERNANCE") return null;
  if (!nonEmptyStrings(value, ["actorId", "commandId", "nodeId", "runId", "proposalArtifactId", "proposalId", "sourceTensionArtifactId", "tensionId"])) return null;
  if (!nonNegativeInteger(value.nodeVisit) || !nonNegativeInteger(value.revision)) return null;
  return value as GovernanceRouteMetadata;
}

async function readGovernanceCommand(
  client: DomainOperationClient,
  organizationId: string,
  runId: string,
  commandId: string,
): Promise<GovernanceReplayCommand | null> {
  return client.interfaceWorkflowCommand.findFirst({
    where: { id: commandId, organizationId, runId, kind: "EXECUTE_SIDE_EFFECT", status: "SUCCEEDED" },
    select: { id: true, nodeId: true, nodeVisit: true, kind: true, clientIdempotencyKey: true, actorId: true, payload: true, status: true },
  }) as Promise<GovernanceReplayCommand | null>;
}

function readGovernanceCandidatePayload(value: unknown): { sourceTensionArtifactId: string; draft: GovernanceCandidateDraft } | null {
  const keys = "confirmed,currentStructure,expectedImpact,proposedStructure,rationale,sourceTensionArtifactId,structuralCategory";
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== keys || value.confirmed !== true) return null;
  if (typeof value.sourceTensionArtifactId !== "string" || !value.sourceTensionArtifactId || typeof value.structuralCategory !== "string" || !GOVERNANCE_STRUCTURAL_CATEGORIES.includes(value.structuralCategory as GovernanceStructuralCategory)) return null;
  try {
    return {
      sourceTensionArtifactId: value.sourceTensionArtifactId,
      draft: validateGovernanceCandidateDraft({
        structuralCategory: value.structuralCategory as GovernanceStructuralCategory,
        currentStructure: value.currentStructure as string,
        proposedStructure: value.proposedStructure as string,
        expectedImpact: value.expectedImpact as string,
        rationale: value.rationale as string,
      }),
    };
  } catch {
    return null;
  }
}

function readGovernanceRoutePayload(value: unknown): { meetingId: string; proposalArtifactId: string } | null {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== "confirmed,meetingId,proposalArtifactId" || value.confirmed !== true) return null;
  return typeof value.meetingId === "string" && value.meetingId && typeof value.proposalArtifactId === "string" && value.proposalArtifactId
    ? { meetingId: value.meetingId, proposalArtifactId: value.proposalArtifactId }
    : null;
}

function readGovernanceProposedChange(value: string): Omit<GovernanceCandidateDraft, "rationale"> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed) || Object.keys(parsed).sort().join(",") !== "currentStructure,expectedImpact,proposedStructure,schemaVersion,structuralCategory" || parsed.schemaVersion !== 1) return null;
    if (typeof parsed.structuralCategory !== "string" || !GOVERNANCE_STRUCTURAL_CATEGORIES.includes(parsed.structuralCategory as GovernanceStructuralCategory)) return null;
    if (typeof parsed.currentStructure !== "string" || typeof parsed.proposedStructure !== "string" || typeof parsed.expectedImpact !== "string") return null;
    return { structuralCategory: parsed.structuralCategory as GovernanceStructuralCategory, currentStructure: parsed.currentStructure, proposedStructure: parsed.proposedStructure, expectedImpact: parsed.expectedImpact };
  } catch {
    return null;
  }
}

function sameGovernanceCommand(left: GovernanceReplayCommand, right: GovernanceReplayCommand): boolean {
  return left.id === right.id
    && left.nodeId === right.nodeId
    && left.nodeVisit === right.nodeVisit
    && left.kind === right.kind
    && left.clientIdempotencyKey === right.clientIdempotencyKey
    && left.actorId === right.actorId
    && left.status === right.status
    && stableJson(left.payload) === stableJson(right.payload);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  return JSON.stringify(value);
}

function nonEmptyStrings(value: Record<string, unknown>, keys: string[]): boolean {
  return keys.every((key) => typeof value[key] === "string" && Boolean(value[key]));
}

function nonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && Number(value) >= 0;
}

function validateGovernanceCandidateDraft(input: GovernanceCandidateDraft): GovernanceCandidateDraft {
  if (!GOVERNANCE_STRUCTURAL_CATEGORIES.includes(input.structuralCategory)) {
    throw new DomainOperationError("NON_STRUCTURAL_GOVERNANCE_CANDIDATE");
  }
  const currentStructure = boundedText(input.currentStructure);
  const proposedStructure = boundedText(input.proposedStructure);
  const expectedImpact = boundedText(input.expectedImpact);
  const rationale = boundedText(input.rationale);
  if (!currentStructure || !proposedStructure || !expectedImpact || !rationale) {
    throw new DomainOperationError("INVALID_GOVERNANCE_CANDIDATE_DRAFT");
  }
  return { structuralCategory: input.structuralCategory, currentStructure, proposedStructure, expectedImpact, rationale };
}

function boundedText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed && Buffer.byteLength(trimmed, "utf8") <= 8 * 1024 ? trimmed : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class DomainOperationError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}
