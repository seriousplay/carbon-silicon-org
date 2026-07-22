import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { generateBlueprint } from "@/lib/sessions";

export async function POST(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await params;
    const session = await generateBlueprint(user, sessionId);
    return NextResponse.json({ blueprint: session.outputs.blueprint });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generate failed" }, { status: 400 });
  }
}
