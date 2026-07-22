import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/db";
import { parseEventCursor, parseEventLimit } from "@/lib/meeting-facilitation/event-api";
import { createPrismaMeetingFacilitationRepository } from "@/lib/meeting-facilitation/prisma-repository";
import { createMeetingFacilitationService } from "@/lib/meeting-facilitation/service";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";

export const dynamic = "force-dynamic";

const facilitation = createMeetingFacilitationService(createPrismaMeetingFacilitationRepository(prisma));

export async function GET(request: NextRequest, context: RouteContext<"/api/meetings/[id]/events">) {
  try {
    const { id: meetingId } = await context.params;
    const [organizationId, person] = await Promise.all([getCurrentOrgId(), getCurrentPerson()]);
    if (!person || person.organizationId !== organizationId) return response({ error: "UNAUTHORIZED" }, 401);
    const after = parseEventCursor(request.nextUrl.searchParams.get("after"));
    const limit = parseEventLimit(request.nextUrl.searchParams.get("limit"));
    const events = await facilitation.listEvents({
      organizationId,
      meetingId,
      actorPersonId: person.id,
      after,
      limit,
    });
    const nextCursor = events.at(-1)?.sequence ?? after;
    return response({ events, nextCursor }, 200);
  } catch (error) {
    return response({ error: errorCode(error) }, statusFor(error));
  }
}

function response(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

function errorCode(error: unknown): string {
  return error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
    ? error.message
    : "MEETING_EVENTS_UNAVAILABLE";
}

function statusFor(error: unknown): number {
  if (!(error instanceof Error)) return 500;
  if (error.message === "INVALID_EVENT_CURSOR" || error.message === "INVALID_EVENT_LIMIT") return 400;
  if (/PARTICIPANT|NOT_FOUND|NOT_AVAILABLE/.test(error.message)) return 403;
  if (/未登录|UNAUTHORIZED/.test(error.message)) return 401;
  return 500;
}
