"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";
import { hashCanonical } from "@/lib/interface-workbench/compiler";
import { minimalDefinition, requireOrgAdmin } from "@/lib/interface-workbench/admin";

export async function createWorkbenchAction(formData: FormData): Promise<void> {
  const guard = await requireOrgAdmin();
  if (!guard.ok) throw new Error(guard.error);
  const interfaceId = String(formData.get("interfaceId") ?? "").trim();
  const intf = await prisma.circleInterface.findFirst({
    where: { id: interfaceId, organizationId: guard.context.organizationId },
    select: { id: true, name: true },
  });
  if (!intf) throw new Error("NOT_FOUND");
  const definition = minimalDefinition(intf.name);
  const workbench = await prisma.interfaceWorkbench.create({
    data: {
      organizationId: guard.context.organizationId,
      interfaceId: intf.id,
      draft: definition as unknown as Prisma.InputJsonValue,
      draftLayout: {} as Prisma.InputJsonValue,
      draftHash: hashCanonical(definition),
    },
    select: { id: true },
  });
  revalidatePath("/app/interfaces/workbenches");
  redirect(`/app/interfaces/workbenches/${workbench.id}`);
}
