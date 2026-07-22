import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createSession } from "@/lib/sessions";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as { templateId?: string; workflow?: "questionnaire" | "diagnosis" | "blueprint" | "loop_design"; sourceSessionId?: string };
    const session = await createSession(user, { templateId: body.templateId, workflow: body.workflow, sourceSessionId: body.sourceSessionId });
    return NextResponse.json({ id: session.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Create failed" }, { status: 500 });
  }
}
