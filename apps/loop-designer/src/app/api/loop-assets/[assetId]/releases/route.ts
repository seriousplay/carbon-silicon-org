import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { releaseLoopRunVersion } from "@/lib/evolution-events";
import type { LoopRunReleasePayload } from "@/lib/evolution-events-core";

export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { assetId } = await context.params;
    const body = await request.json().catch(() => ({})) as LoopRunReleasePayload;
    const event = await releaseLoopRunVersion(user, assetId, body);
    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to release loop version" }, { status: 400 });
  }
}
