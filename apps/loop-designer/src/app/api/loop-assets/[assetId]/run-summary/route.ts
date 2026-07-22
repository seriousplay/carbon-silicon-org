import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getLoopRunSummary } from "@/lib/evolution-events";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { assetId } = await context.params;
    return NextResponse.json({ runSummary: await getLoopRunSummary(user, assetId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to get run summary" }, { status: 400 });
  }
}
