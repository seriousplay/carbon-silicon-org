import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getLatestPlanGenerationJob } from "@/lib/generation-jobs";
import { getAuthorizedSession } from "@/lib/sessions";
import { DesignerWorkspace } from "@/components/designer-workspace";

export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await requireUser(`/loop-designer/sessions/${sessionId}`);
  const session = await getAuthorizedSession(user, sessionId);
  if (!session) notFound();
  if (session.context.workflowStage === "questionnaire") redirect(`/sessions/${session.id}/questionnaire`);
  if (session.context.workflowStage === "diagnosis") redirect(`/sessions/${session.id}/diagnosis`);
  if (session.context.workflowStage === "blueprint") redirect(`/sessions/${session.id}/blueprint`);
  const generationJob = await getLatestPlanGenerationJob(user, session.id);
  return <DesignerWorkspace initialSession={session} initialGenerationJob={generationJob} editable={session.userId === user.id} />;
}
