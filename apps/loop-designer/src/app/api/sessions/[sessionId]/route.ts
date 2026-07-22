import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLatestPlanGenerationJob } from "@/lib/generation-jobs";
import { deleteSession, getAuthorizedSession, renameSession, reopenSessionForEditing } from "@/lib/sessions";

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = await context.params;
  const session = await getAuthorizedSession(user, sessionId);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const generationJob = await getLatestPlanGenerationJob(user, sessionId);
  return NextResponse.json({ session, generationJob });
}

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await context.params;
    const body = await request.json().catch(() => ({})) as { action?: "reopen"; stepId?: "business_goal" | "workflow" | "diagnosis"; title?: string };
    if (body.action === "reopen") {
      if (!body.stepId) return NextResponse.json({ error: "请选择要重新编辑的步骤" }, { status: 400 });
      const session = await reopenSessionForEditing(user, sessionId, body.stepId);
      return NextResponse.json({ session });
    }
    const session = await renameSession(user, sessionId, body.title || "");
    return NextResponse.json({
      id: session.id,
      title: session.outputs.currentPlan?.title || session.context.loopType || "未命名回路",
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await context.params;
    await deleteSession(user, sessionId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Delete failed" }, { status: 400 });
  }
}
