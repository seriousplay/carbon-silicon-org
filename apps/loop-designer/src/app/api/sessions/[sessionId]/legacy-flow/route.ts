import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedSession, saveLegacyFlow } from "@/lib/sessions";
import type { LegacyWorkflowNode } from "@/lib/process-transformation-core";

type LegacyFlowBody = {
  legacyNodes?: LegacyWorkflowNode[];
};

export async function POST(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  return upsertLegacyFlow(request, context);
}

export async function PATCH(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  return upsertLegacyFlow(request, context);
}

export async function GET(_request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = await context.params;
  const session = await getAuthorizedSession(user, sessionId);
  if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ legacyNodes: session.context.legacyFlow ?? [] });
}

async function upsertLegacyFlow(request: Request, context: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { sessionId } = await context.params;
    const body = await request.json().catch(() => ({})) as LegacyFlowBody;
    const session = await saveLegacyFlow(user, sessionId, body.legacyNodes ?? []);
    return NextResponse.json({ session, legacyNodes: session.context.legacyFlow ?? [] });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to save legacy flow" }, { status: 400 });
  }
}
