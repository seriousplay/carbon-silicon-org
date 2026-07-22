import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireOrgAdmin } from "@/lib/interface-workbench/admin";
import type { EditorLayout, WorkbenchEditorDto } from "@/lib/interface-workbench/dto";
import type { WorkflowDefinition } from "@/lib/interface-workbench/protocol";
import { WorkbenchDesigner } from "./workbench-designer";

export default async function WorkbenchEditorPage({ params }: { params: Promise<{ workbenchId: string }> }) {
  const { workbenchId } = await params;
  const guard = await requireOrgAdmin();
  if (!guard.ok) notFound();
  const item = await prisma.interfaceWorkbench.findFirst({
    where: { id: workbenchId, organizationId: guard.context.organizationId },
    select: {
      id: true, interfaceId: true, draft: true, draftLayout: true, draftHash: true, draftRevision: true, activeVersionId: true,
      interface: { select: { name: true } },
      versions: { select: { id: true, version: true, parentVersionId: true, sourceHash: true, publishedAt: true, sourceSnapshot: true, editorLayout: true }, orderBy: { version: "desc" } },
    },
  });
  if (!item) notFound();
  const dto: WorkbenchEditorDto = {
    id: item.id, interfaceId: item.interfaceId, interfaceName: item.interface.name,
    draft: item.draft as unknown as WorkflowDefinition, draftLayout: item.draftLayout as EditorLayout,
    draftHash: item.draftHash, draftRevision: item.draftRevision, activeVersionId: item.activeVersionId,
    versions: item.versions.map((version) => ({ id: version.id, version: version.version, parentVersionId: version.parentVersionId, sourceHash: version.sourceHash, publishedAt: version.publishedAt.toISOString(), source: version.sourceSnapshot as unknown as WorkflowDefinition, editorLayout: version.editorLayout as EditorLayout })),
  };
  return <WorkbenchDesigner initial={dto} />;
}
