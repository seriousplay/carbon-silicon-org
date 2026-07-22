import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { scanSessionBreakpoints } from "@/lib/sessions";

export async function POST(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await context.params;
    const session = await scanSessionBreakpoints(user, sessionId);
    return NextResponse.json({ session, breakpoints: session.context.breakpointScan ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to scan breakpoints" }, { status: 400 });
  }
}
