import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveDiagnosisResponse, setDiagnosisStep } from "@/lib/sessions";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    const body = (await request.json()) as { answer?: string };
    const session = await saveDiagnosisResponse(user, sessionId, { answer: body.answer ?? "" });
    const complete = session.context.workflowStage === "blueprint";
    return NextResponse.json({ session, nextUrl: complete ? `/sessions/${session.id}/blueprint` : `/sessions/${session.id}/diagnosis` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 });
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    const body = (await request.json()) as { stepIndex?: number };
    const session = await setDiagnosisStep(user, sessionId, Number(body.stepIndex));
    return NextResponse.json({ session, nextUrl: `/sessions/${session.id}/diagnosis` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Update failed" }, { status: 400 });
  }
}
