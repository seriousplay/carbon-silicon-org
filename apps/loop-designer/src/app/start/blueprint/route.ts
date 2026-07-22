import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { forwardedRequestOrigin } from "@/lib/request-origin";
import { getOrCreateBlueprintSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const startPath = "/loop-designer/start/blueprint";

export async function GET(request: Request) {
  const requestOrigin = forwardedRequestOrigin(request.headers, request.url);
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/loop-designer/auth/login?next=${encodeURIComponent(startPath)}`, requestOrigin), 303);
  }

  const session = await getOrCreateBlueprintSession(user);
  const targetPath = session.context.workflowStage === "blueprint"
    ? `/loop-designer/sessions/${session.id}/blueprint`
    : `/loop-designer/sessions/${session.id}/diagnosis`;
  return NextResponse.redirect(new URL(targetPath, requestOrigin), 303);
}
