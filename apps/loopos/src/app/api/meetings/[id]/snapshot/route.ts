import { NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { createPrismaMeetingFacilitationRepository } from "@/lib/meeting-facilitation/prisma-repository";
import { buildMeetingFacilitationReadModel } from "@/lib/meeting-facilitation/read-model";
import { createMeetingFacilitationService } from "@/lib/meeting-facilitation/service";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";

export const dynamic = "force-dynamic";

const facilitation = createMeetingFacilitationService(createPrismaMeetingFacilitationRepository(prisma));

export async function GET(_request: Request, context: RouteContext<"/api/meetings/[id]/snapshot">) {
  let organizationId: string | null = null;
  let actorPersonId: string | null = null;
  let meetingId: string | null = null;
  try {
    ({ id: meetingId } = await context.params);
    const [currentOrganizationId, person] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
    organizationId = currentOrganizationId;
    if (!person || person.organizationId !== organizationId) return response({ error: "UNAUTHORIZED" }, 401);
    actorPersonId = person.id;
    const session = await facilitation.getSnapshot({
      organizationId,
      meetingId,
      actorPersonId,
    });
    return response({ snapshot: buildMeetingFacilitationReadModel(session), preflight: await loadPreflight(organizationId, meetingId) }, 200);
  } catch (error) {
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "MEETING_SNAPSHOT_UNAVAILABLE";
    if (code === "FACILITATION_SESSION_NOT_FOUND" && organizationId && meetingId && actorPersonId) {
      const activeParticipant = await prisma.meetingParticipant.count({
        where: { organizationId, meetingId, personId: actorPersonId, status: "ONLINE" },
      });
      if (activeParticipant === 1) {
        return response({ snapshot: null, preflight: await loadPreflight(organizationId, meetingId) }, 200);
      }
    }
    const status = /PARTICIPANT|NOT_FOUND|NOT_AVAILABLE/.test(code) ? 403 : /未登录|UNAUTHORIZED/.test(code) ? 401 : 500;
    return response({ error: code }, status);
  }
}

async function loadPreflight(organizationId: string, meetingId: string) {
  const participants = await prisma.meetingParticipant.findMany({
    where: { organizationId, meetingId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      personId: true,
      status: true,
      person: { select: { name: true } },
      representedRoles: { select: { roleId: true, role: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
    },
  });
  return {
    participants: participants.map((participant) => ({
      id: participant.id,
      personId: participant.personId,
      name: participant.person.name,
      status: participant.status,
      roleIds: participant.representedRoles.map((item) => item.roleId),
      roleNames: participant.representedRoles.map((item) => item.role.name),
    })),
  };
}

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}
