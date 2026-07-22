import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { exportPlanToFeishu } from "@/lib/feishu";
import { getAuthorizedSession, updateSession } from "@/lib/sessions";

export async function POST(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = await params;
  const session = await getAuthorizedSession(user, sessionId);
  if (!session?.outputs.currentPlan) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const result = await exportPlanToFeishu(session.outputs.currentPlan, user.openId);
    const outputs = {
      ...session.outputs,
      exports: [...(session.outputs.exports ?? []), { type: "feishu" as const, createdAt: new Date().toISOString(), url: result.url }],
    };
    await updateSession(user, sessionId, { outputs });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "飞书导出失败" }, { status: 503 });
  }
}
