import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateSessionBreakpoint } from "@/lib/sessions";
import type { WorkflowBreakpoint } from "@/lib/process-transformation-core";

type BreakpointPatchBody = Partial<Pick<WorkflowBreakpoint, "severity" | "diagnosis" | "evidence" | "suggestedIntervention" | "confidence" | "userConfirmed">>;

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string; breakpointId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId, breakpointId } = await context.params;
    const body = await request.json().catch(() => ({})) as BreakpointPatchBody;
    const session = await updateSessionBreakpoint(user, sessionId, breakpointId, body);
    return NextResponse.json({ session, breakpoints: session.context.breakpointScan ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update breakpoint" }, { status: 400 });
  }
}
