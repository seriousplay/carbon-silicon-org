import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createLoopAssetFromSession, createManualLoopAsset, listLoopAssets } from "@/lib/loop-assets";
import type { LoopAssetStatus } from "@/lib/loop-assets-core";
import { refreshOrgProfileSnapshotBestEffort } from "@/lib/org-profile";

type CreateAssetBody = {
  sessionId?: string;
  sourceSessionId?: string;
  title?: string;
  domain?: string;
  status?: LoopAssetStatus;
};

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const assets = await listLoopAssets(user);
    return NextResponse.json({ assets });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to list loop assets" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as CreateAssetBody;
    if (body.status && !isLoopAssetStatus(body.status)) {
      return NextResponse.json({ error: "status is invalid" }, { status: 400 });
    }
    const sourceSessionId = body.sourceSessionId || body.sessionId;
    if (!sourceSessionId) {
      if (!body.title) return NextResponse.json({ error: "title is required" }, { status: 400 });
      const asset = await createManualLoopAsset(user, {
        title: body.title,
        domain: body.domain,
        status: body.status,
      });
      await refreshOrgProfileSnapshotBestEffort(user);
      return NextResponse.json({ asset, created: true }, { status: 201 });
    }
    const result = await createLoopAssetFromSession(user, {
      sessionId: sourceSessionId,
      title: body.title,
      domain: body.domain,
      status: body.status,
    });
    if (result.created || result.versionCreated) {
      await refreshOrgProfileSnapshotBestEffort(user);
    }
    return NextResponse.json(result, { status: result.created || result.versionCreated ? 201 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create loop asset" }, { status: 400 });
  }
}

function isLoopAssetStatus(value: string): value is LoopAssetStatus {
  return value === "incubating" || value === "active" || value === "dormant" || value === "retired";
}
