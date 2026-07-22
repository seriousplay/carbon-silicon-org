import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { refinePlan } from "@/lib/model";
import { getAuthorizedSession, updateSession } from "@/lib/sessions";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = await params;
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.outputs.refinementCount >= 3) return NextResponse.json({ error: "已达到三轮优化上限" }, { status: 400 });
  const body = (await request.json()) as { focus?: string; instruction?: string };
  if (!body.focus || !body.instruction?.trim()) return NextResponse.json({ error: "请填写优化范围和要求" }, { status: 400 });
  try {
    const plan = await refinePlan(session, body.focus, body.instruction.slice(0, 3000));
    const version = { id: randomUUID(), createdAt: new Date().toISOString(), focus: body.focus, instruction: body.instruction, plan };
    const outputs = {
      ...session.outputs,
      currentPlan: plan,
      versions: [...session.outputs.versions, version],
      refinementCount: session.outputs.refinementCount + 1,
    };
    await updateSession(user, sessionId, { status: "submitted", outputs });
    return NextResponse.json({ plan, outputs });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "优化失败" }, { status: 502 });
  }
}
