import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listAssetInterfaceProtocols } from "@/lib/interface-protocols";

export async function GET(_request: Request, context: { params: Promise<{ assetId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { assetId } = await context.params;
    return NextResponse.json({ protocols: await listAssetInterfaceProtocols(user, assetId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list interface protocols" }, { status: 400 });
  }
}
