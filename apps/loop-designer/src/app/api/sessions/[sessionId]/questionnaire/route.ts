import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { saveQuestionnaire } from "@/lib/sessions";

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    const body = await request.json();
    const session = await saveQuestionnaire(user, sessionId, body);
    const nextUrl = session.context.entryPoint === "prework_624" ? "/prework/624/thanks" : "/";
    return NextResponse.json({ session, nextUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Save failed" }, { status: 400 });
  }
}
