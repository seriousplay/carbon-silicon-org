import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createLoopAssetIterationSession } from "@/lib/loop-assets";

export async function POST(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { assetId } = await context.params;
    const session = await createLoopAssetIterationSession(user, assetId);
    return NextResponse.json({ sessionId: session.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to create loop iteration session",
    }, { status: 400 });
  }
}
