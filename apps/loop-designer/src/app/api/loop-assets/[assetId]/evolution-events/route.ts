import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listLoopEvolutionEvents, recordLoopRunRound } from "@/lib/evolution-events";
import type { RunRoundPayload } from "@/lib/evolution-events-core";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { assetId } = await context.params;
    return NextResponse.json({ events: await listLoopEvolutionEvents(user, assetId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list evolution events" }, { status: 400 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { assetId } = await context.params;
    const body = await request.json().catch(() => ({})) as RunRoundPayload;
    const event = await recordLoopRunRound(user, assetId, body);
    return NextResponse.json({ event });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to record run round" }, { status: 400 });
  }
}
