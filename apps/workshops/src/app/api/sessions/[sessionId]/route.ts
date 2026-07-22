import { NextResponse } from "next/server";
import { getEvent, updateSession } from "@/lib/state";
import type { SessionRecord } from "@/lib/types";

export async function GET(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const eventId = new URL(request.url).searchParams.get("eventId");
  if (!eventId) {
    return NextResponse.json({ error: "缺少活动编号" }, { status: 400 });
  }
  const event = await getEvent(eventId);
  const session = event?.sessions[sessionId];
  if (!session) {
    return NextResponse.json({ error: "会话不存在" }, { status: 404 });
  }
  return NextResponse.json({ session });
}

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await context.params;
  const input = await request.json().catch(() => ({}));
  const session = input.session as SessionRecord | undefined;
  if (!session || session.id !== sessionId) {
    return NextResponse.json({ error: "会话数据无效" }, { status: 400 });
  }
  const saved = await updateSession(session);
  return NextResponse.json({ session: saved });
}
