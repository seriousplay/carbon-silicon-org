"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import { prisma } from "@/lib/db";
import { auth, signIn } from "@/lib/auth";
import { hashInvitationToken } from "@/lib/invitations";

export type InviteAcceptState = { error?: string } | undefined;

export async function acceptInvitationAction(
  _prev: InviteAcceptState,
  formData: FormData
): Promise<InviteAcceptState> {
  const token = ((formData.get("token") as string) ?? "").trim();
  const name = ((formData.get("name") as string) ?? "").trim();
  const password = (formData.get("password") as string) ?? "";
  const session = await auth();

  if (!token) return { error: "邀请链接无效" };
  if (!session?.user?.id && (!name || password.length < 8)) {
    return { error: "请填写姓名，并使用至少 8 位密码" };
  }

  let signInEmail: string | null = null;

  try {
    await prisma.$transaction(async (tx) => {
      const invitation = await tx.organizationInvitation.findUnique({
        where: { tokenHash: hashInvitationToken(token) },
        include: { organization: { select: { id: true, name: true } } },
      });

      if (!invitation) throw new Error("邀请链接无效");
      if (invitation.revokedAt) throw new Error("邀请已撤销");
      if (invitation.consumedAt) throw new Error("邀请已被使用");
      if (invitation.expiresAt.getTime() <= Date.now()) throw new Error("邀请已过期");

      const email = invitation.email.toLowerCase();
      let userId = session?.user?.id ?? null;

      if (userId) {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
        if (user?.email.toLowerCase() !== email) throw new Error("当前登录邮箱与邀请邮箱不一致");
      } else {
        const existing = await tx.user.findUnique({ where: { email }, select: { id: true } });
        if (existing) throw new Error("该邮箱已有账号，请先登录后接受邀请");
        const passwordHash = await bcrypt.hash(password, 12);
        const user = await tx.user.create({ data: { email, name, passwordHash } });
        userId = user.id;
        signInEmail = email;
      }

      const existingPerson = await tx.person.findUnique({ where: { userId } });
      if (existingPerson && existingPerson.organizationId !== invitation.organizationId) {
        throw new Error("该账号已绑定其他组织，不能接受此邀请");
      }

      const homeCircle = invitation.homeCircleId
        ? { id: invitation.homeCircleId }
        : await tx.circle.findFirst({
            where: { organizationId: invitation.organizationId, status: { not: "ARCHIVED" } },
            select: { id: true },
            orderBy: { createdAt: "asc" },
          });
      if (!homeCircle) throw new Error("邀请组织缺少可用归属回路");

      await tx.membership.upsert({
        where: { userId_organizationId: { userId, organizationId: invitation.organizationId } },
        create: { userId, organizationId: invitation.organizationId, role: "ORG_MEMBER" },
        update: {},
      });

      if (!existingPerson) {
        await tx.person.create({
          data: {
            organizationId: invitation.organizationId,
            name: name || email.split("@")[0],
            email,
            userId,
            homeCircleId: homeCircle.id,
          },
        });
      }

      const consumed = await tx.organizationInvitation.updateMany({
        where: {
          id: invitation.id,
          consumedAt: null,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
        data: { consumedAt: new Date(), consumedById: userId },
      });
      if (consumed.count !== 1) throw new Error("邀请状态已变化，请刷新后重试");
    });
  } catch (e) {
    return { error: e instanceof Error ? e.message : "接受邀请失败" };
  }

  if (signInEmail) {
    try {
      await signIn("credentials", { email: signInEmail, password, redirect: false });
    } catch (e) {
      if (e instanceof AuthError) return { error: "已加入组织，请手动登录" };
      throw e;
    }
  }

  revalidatePath("/app/people");
  redirect("/app");
}
