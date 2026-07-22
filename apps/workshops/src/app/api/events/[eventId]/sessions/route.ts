import { NextResponse } from "next/server";
import { createSession } from "@/lib/state";

export async function POST(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const input = await request.json().catch(() => ({}));
  const nickname = String(input.nickname ?? "").trim();
  const company = String(input.company ?? "").trim();
  const seat = String(input.seat ?? "").trim();

  if (!nickname) {
    return NextResponse.json({ error: "请输入昵称" }, { status: 400 });
  }

  const session = await createSession(eventId, { nickname, company, seat });
  return NextResponse.json({ session });
}
