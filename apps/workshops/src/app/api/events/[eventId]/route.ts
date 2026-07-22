import { NextResponse } from "next/server";
import { getEvent } from "@/lib/state";

export async function GET(_: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const event = await getEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  }
  return NextResponse.json({
    event: {
      id: event.id,
      title: event.title,
      venue: event.venue,
      tagline: event.tagline,
      createdAt: event.createdAt,
      updatedAt: event.updatedAt,
      draftCandidates: event.draftCandidates,
      sessions: event.sessions,
    },
  });
}
