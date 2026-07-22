import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveDiagnosisDraft } from "@/lib/sessions";

export async function PATCH(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    const body = (await request.json()) as { stepId?: string; answer?: string };
    const session = await saveDiagnosisDraft(user, sessionId, {
      stepId: body.stepId ?? "",
      answer: body.answer ?? "",
    });
    return NextResponse.json({ session });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Draft save failed" }, { status: 400 });
  }
}
