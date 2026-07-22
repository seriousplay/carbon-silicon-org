import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createLoopAssetVersionFromSession } from "@/lib/loop-assets";
import { refreshOrgProfileSnapshotBestEffort } from "@/lib/org-profile";

type CreateVersionBody = {
  sessionId?: string;
  sourceSessionId?: string;
};

export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { assetId } = await context.params;
    const body = await request.json().catch(() => ({})) as CreateVersionBody;
    const sourceSessionId = body.sourceSessionId || body.sessionId;
    if (!sourceSessionId) return NextResponse.json({ error: "sessionId is required" }, { status: 400 });
    const result = await createLoopAssetVersionFromSession(user, {
      assetId,
      sessionId: sourceSessionId,
    });
    if (result.versionCreated) await refreshOrgProfileSnapshotBestEffort(user);
    return NextResponse.json(result, { status: result.versionCreated ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to create loop asset version",
    }, { status: 400 });
  }
}
