"use server";

import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson, requireSession } from "@/lib/session";
import { prisma } from "@/lib/db";
import { defaultTerminology } from "@/lib/organization-governance-config";

export type TerminologyState = { error?: string; ok?: boolean } | undefined;

export async function saveTerminologyAction(_previous: TerminologyState, formData: FormData): Promise<TerminologyState> {
  const session = await requireSession();
  const organizationId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  if (!person) return { error: "无法确认当前组织身份。" };
  const membership = await prisma.membership.findUnique({ where: { userId_organizationId: { userId: session.user.id, organizationId } }, select: { role: true } });
  if (membership?.role !== "ORG_ADMIN") return { error: "只有组织管理员可以修改组织语言。" };

  const terminology = Object.fromEntries(Object.keys(defaultTerminology).map((key) => {
    const value = formData.get(key);
    return [key, typeof value === "string" && value.trim() ? value.trim().slice(0, 80) : defaultTerminology[key as keyof typeof defaultTerminology]];
  }));
  const latest = await prisma.organizationGovernanceConfigVersion.findFirst({ where: { organizationId }, orderBy: { version: "desc" }, select: { version: true, governanceRules: true } });
  await prisma.$transaction([
    prisma.organizationGovernanceConfigVersion.create({ data: { organizationId, version: (latest?.version ?? 0) + 1, terminologyPreferences: terminology, governanceRules: latest?.governanceRules ?? {}, createdById: person.id } }),
    prisma.organizationBrainProfile.updateMany({ where: { organizationId }, data: { terminologyPreferences: terminology } }),
  ]);
  revalidatePath("/app/organization");
  revalidatePath("/app/setup");
  revalidatePath("/app");
  return { ok: true };
}
