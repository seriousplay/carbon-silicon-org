import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { getCurrentUser } from "@/lib/auth";
import { getLoopAssetDetails, updateLoopAssetStatus } from "@/lib/loop-assets";
import type { LoopAssetStatus } from "@/lib/loop-assets-core";
import { refreshOrgProfileSnapshotBestEffort } from "@/lib/org-profile";

type UpdateAssetBody = {
  status?: LoopAssetStatus;
};

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { assetId } = await context.params;
    const details = await getLoopAssetDetails(user, assetId);
    if (!details) return NextResponse.json({ error: "Loop asset not found" }, { status: 404 });
    return NextResponse.json(details);
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to get loop asset",
    }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { assetId } = await context.params;
    const body = await request.json().catch(() => ({})) as UpdateAssetBody;
    if (!body.status || !isLoopAssetStatus(body.status)) {
      return NextResponse.json({ error: "status is invalid" }, { status: 400 });
    }
    await requireAdmin(user, ["manage_loop_assets"]);
    const asset = await updateLoopAssetStatus(user, { assetId, status: body.status });
    await refreshOrgProfileSnapshotBestEffort(user);
    return NextResponse.json({ asset });
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Failed to update loop asset",
    }, { status: 400 });
  }
}

function isLoopAssetStatus(value: string): value is LoopAssetStatus {
  return value === "incubating" || value === "active" || value === "dormant" || value === "retired";
}
