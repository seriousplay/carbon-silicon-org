import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { forwardedRequestOrigin } from "@/lib/request-origin";
import { createSession } from "@/lib/sessions";

export const dynamic = "force-dynamic";

const startPath = "/loop-designer/start/questionnaire";

export async function GET(request: Request) {
  const requestOrigin = forwardedRequestOrigin(request.headers, request.url);
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/loop-designer/auth/login?next=${encodeURIComponent(startPath)}`, requestOrigin), 303);
  }

  const session = await createSession(user, { workflow: "questionnaire" });
  return NextResponse.redirect(new URL(`/loop-designer/sessions/${session.id}/questionnaire`, requestOrigin), 303);
}
