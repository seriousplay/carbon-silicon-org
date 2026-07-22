import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAuthorizedSession } from "@/lib/sessions";
import { QuestionnaireWorkspace } from "@/components/questionnaire-workspace";

export default async function QuestionnairePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await requireUser(`/loop-designer/sessions/${sessionId}/questionnaire`);
  const session = await getAuthorizedSession(user, sessionId);
  if (!session) notFound();
  if (session.context.workflowStage === "loop_design") redirect(`/sessions/${session.id}`);
  if (session.context.workflowStage === "diagnosis") redirect(`/sessions/${session.id}/diagnosis`);
  if (session.outputs.blueprint) redirect(`/sessions/${session.id}/blueprint`);
  return <QuestionnaireWorkspace session={session} />;
}
