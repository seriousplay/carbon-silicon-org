import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildSessionTransformationPreview } from "@/lib/sessions";

export async function POST(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await context.params;
    const session = await buildSessionTransformationPreview(user, sessionId);
    return NextResponse.json({ session, processTransformation: session.context.processTransformation });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to build transformation preview" }, { status: 400 });
  }
}
