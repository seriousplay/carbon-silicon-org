import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createLoopRelationship, listLoopRelationships } from "@/lib/loop-relationships";
import type { LoopRelationshipStrength, LoopRelationshipType } from "@/lib/loop-assets-core";
import { refreshOrgProfileSnapshotBestEffort } from "@/lib/org-profile";

type CreateRelationshipBody = {
  targetAssetId?: string;
  type?: LoopRelationshipType;
  interfaceName?: string;
  strength?: LoopRelationshipStrength;
};

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { assetId } = await context.params;
    const relationships = await listLoopRelationships(user, assetId);
    return NextResponse.json({ relationships });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to list loop relationships" }, { status: 500 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { assetId } = await context.params;
    const body = await request.json().catch(() => ({})) as CreateRelationshipBody;
    if (!body.targetAssetId) return NextResponse.json({ error: "targetAssetId is required" }, { status: 400 });
    if (!body.type || !isRelationshipType(body.type)) return NextResponse.json({ error: "type is invalid" }, { status: 400 });
    if (body.strength && !isRelationshipStrength(body.strength)) {
      return NextResponse.json({ error: "strength is invalid" }, { status: 400 });
    }

    const relationship = await createLoopRelationship(user, {
      sourceAssetId: assetId,
      targetAssetId: body.targetAssetId,
      type: body.type,
      interfaceName: body.interfaceName,
      strength: body.strength,
    });
    await refreshOrgProfileSnapshotBestEffort(user);
    return NextResponse.json({ relationship }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to create loop relationship" }, { status: 400 });
  }
}

function isRelationshipType(value: string): value is LoopRelationshipType {
  return value === "parent_child" || value === "dependency";
}

function isRelationshipStrength(value: string): value is LoopRelationshipStrength {
  return value === "critical" || value === "important" || value === "nice_to_have";
}
