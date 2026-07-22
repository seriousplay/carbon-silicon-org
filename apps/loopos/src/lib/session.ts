/**
 * 当前会话的数据访问 helper
 *
 * 提供获取当前登录用户的组织、人员档案的便捷方法。
 * 所有应用页面通过这些 helper 获取上下文。
 */
import { cache } from "react";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** 获取当前会话（可能为 null） */
export const getSession = cache(async () => {
  const session = await auth();
  return session;
});

/** 要求已登录，否则抛错（用于受保护页面） */
export const requireSession = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error("未登录");
  }
  return session;
});

/** 获取当前用户的人员档案（含组织和归属回路） */
export const getCurrentPerson = cache(async () => {
  const session = await requireSession();

  const person = await prisma.person.findUnique({
    where: { userId: session.user!.id },
    include: {
      homeCircle: {
        select: { id: true, name: true, purpose: true },
      },
      organization: {
        select: { id: true, name: true, slug: true },
      },
    },
  });

  return person;
});

/** 获取当前用户的组织 ID */
export const getCurrentOrgId = cache(async (): Promise<string> => {
  const person = await getCurrentPerson();
  if (!person) {
    // 人员档案不存在时，回退到 membership 查组织
    const session = await requireSession();
    const membership = await prisma.membership.findFirst({
      where: { userId: session.user!.id },
    });
    if (!membership) throw new Error("用户不属于任何组织");
    return membership.organizationId;
  }
  return person.organizationId;
});
