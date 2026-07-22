import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getAuthorizedSession } from "@/lib/sessions";
import { BlueprintWorkspace } from "@/components/blueprint-workspace";

export default async function BlueprintPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await requireUser(`/loop-designer/sessions/${sessionId}/blueprint`);
  const session = await getAuthorizedSession(user, sessionId);
  if (!session) notFound();
  if (!session.context.questionnaire) redirect(`/sessions/${session.id}/questionnaire`);
  if (session.context.workflowStage === "diagnosis") redirect(`/sessions/${session.id}/diagnosis`);
  if (session.context.workflowStage === "loop_design" && session.outputs.blueprint?.preferredCandidateId) redirect(`/sessions/${session.id}`);
  return <BlueprintWorkspace session={session} />;
}
