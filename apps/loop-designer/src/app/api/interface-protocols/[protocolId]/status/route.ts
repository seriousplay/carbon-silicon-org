import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { updateInterfaceProtocolStatus } from "@/lib/interface-protocols";
import type { InterfaceProtocolStatus } from "@/lib/interface-protocols-core";

type StatusBody = {
  status?: InterfaceProtocolStatus;
};

export async function PATCH(request: Request, context: { params: Promise<{ protocolId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { protocolId } = await context.params;
    const body = await request.json().catch(() => ({})) as StatusBody;
    if (!body.status) return NextResponse.json({ error: "请选择协议状态" }, { status: 400 });
    const protocol = await updateInterfaceProtocolStatus(user, protocolId, body.status);
    return NextResponse.json({ protocol });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update interface protocol status" }, { status: 400 });
  }
}
