import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentOrgId, getCurrentPerson } from "@/lib/session";
import { prisma } from "@/lib/db";
import { EditTensionForm } from "../edit-form";

export default async function EditBlockerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();

  const tension = await prisma.tension.findFirst({
    where: { id, organizationId: orgId },
    include: {
      tacticalOutcomeActionProposal: { select: { status: true, kind: true } },
    },
  });

  if (
    !tension
    || tension.ownerId !== person?.id
    || tension.tacticalOutcomeActionProposal?.status !== "APPROVED"
    || tension.tacticalOutcomeActionProposal.kind !== "ACTION"
  ) notFound();

  return (
    <div className="max-w-2xl mx-auto animate-fade-rise">
      <Link
        href={`/app/tracker/${id}`}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors mb-4 inline-block"
      >
        ← 返回
      </Link>

      <h1 className="font-serif text-2xl font-medium mb-1">编辑行动</h1>
      <p className="text-sm text-muted-foreground mb-8">
        仅当前负责人可以更新已通过会议提案的行动信息。
      </p>

      <EditTensionForm
        tensionId={id}
        initial={{
          title: tension.title,
          description: tension.description,
          acceptanceCriteria: tension.acceptanceCriteria ?? "",
          deadline: tension.deadline,
          rootCause: tension.rootCause,
        }}
      />
    </div>
  );
}
