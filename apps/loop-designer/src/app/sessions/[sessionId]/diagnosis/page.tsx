import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAuthorizedSession } from "@/lib/sessions";
import { DiagnosisWorkspace } from "@/components/diagnosis-workspace";

export default async function DiagnosisPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await requireUser(`/loop-designer/sessions/${sessionId}/diagnosis`);
  const session = await getAuthorizedSession(user, sessionId);
  if (!session) notFound();
  if (!session.context.questionnaire) redirect(`/sessions/${session.id}/questionnaire`);
  if (session.context.workflowStage === "loop_design") redirect(`/sessions/${session.id}`);
  if (session.context.workflowStage === "blueprint") redirect(`/sessions/${session.id}/blueprint`);
  return <DiagnosisWorkspace session={session} />;
}
