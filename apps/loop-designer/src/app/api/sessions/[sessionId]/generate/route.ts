import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { enqueuePlanGenerationJob, getLatestPlanGenerationJob, userFacingGenerationError } from "@/lib/generation-jobs";
import { getAuthorizedSession } from "@/lib/sessions";
import { CONVERSATION_STEPS } from "@/lib/conversation";

type GenerateBody = {
  useOrgMemory?: boolean;
  async?: boolean;
};

export async function POST(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { sessionId } = await params;
  const session = await getAuthorizedSession(user, sessionId);
  if (!session || session.userId !== user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (session.context.currentStep < CONVERSATION_STEPS.length) return NextResponse.json({ error: "信息采集尚未完成" }, { status: 400 });
  const body = await request.json().catch(() => ({})) as GenerateBody;
  const useOrgMemory = body.useOrgMemory !== false;
  try {
    if (session.status === "generating") {
      const generationJob = await getLatestPlanGenerationJob(user, sessionId);
      if (generationJob && (generationJob.status === "queued" || generationJob.status === "running")) {
        return NextResponse.json({ session, generationJob, status: generationJob.status }, { status: 202 });
      }
    }
    const { session: generatingSession, job } = await enqueuePlanGenerationJob(user, session, { useOrgMemory });
    return NextResponse.json({ session: generatingSession, generationJob: job, status: job.status }, { status: 202 });
  } catch (error) {
    return NextResponse.json({ error: userFacingGenerationError(error) }, { status: 502 });
  }
}
