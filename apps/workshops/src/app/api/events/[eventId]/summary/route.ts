import { NextResponse } from "next/server";
import { buildDashboard, getEvent } from "@/lib/state";

export async function GET(request: Request, context: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await context.params;
  const key = new URL(request.url).searchParams.get("key");
  const event = await getEvent(eventId);
  if (!event) {
    return NextResponse.json({ error: "活动不存在" }, { status: 404 });
  }
  if (!key || key !== event.adminKey) {
    return NextResponse.json({ error: "管理员密钥无效" }, { status: 401 });
  }
  return NextResponse.json({ dashboard: buildDashboard(event) });
}
