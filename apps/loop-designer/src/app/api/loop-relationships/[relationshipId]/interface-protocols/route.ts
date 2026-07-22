import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { createInterfaceProtocol, listRelationshipInterfaceProtocols } from "@/lib/interface-protocols";
import type { InterfaceProtocolPayload } from "@/lib/interface-protocols-core";

type CreateProtocolBody = InterfaceProtocolPayload & {
  changeReason?: string;
};

export async function GET(_request: Request, context: { params: Promise<{ relationshipId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { relationshipId } = await context.params;
    return NextResponse.json({ protocols: await listRelationshipInterfaceProtocols(user, relationshipId) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to list interface protocols" }, { status: 400 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ relationshipId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { relationshipId } = await context.params;
    const body = await request.json().catch(() => ({})) as CreateProtocolBody;
    const { changeReason, ...payload } = body;
    const protocol = await createInterfaceProtocol(user, relationshipId, payload, changeReason);
    return NextResponse.json({ protocol });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create interface protocol" }, { status: 400 });
  }
}
