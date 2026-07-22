"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getCurrentOrgId, getCurrentPerson, requireSession } from "@/lib/session";
import { hashInvitationToken } from "@/lib/invitations";
import { withBasePath } from "@/lib/base-path";
import { createInvitationForDelivery } from "@/lib/organization-setup/invitation-delivery-service";
import { encryptInvitationToken } from "@/lib/organization-setup/invitation-token-envelope";

export type InviteState = { error?: string; link?: string } | undefined;

export async function createInvitationAction(
  _prev: InviteState,
  formData: FormData
): Promise<InviteState> {
  const session = await requireSession();
  const orgId = await getCurrentOrgId();
  const person = await getCurrentPerson();
  const email = ((formData.get("email") as string) ?? "").trim().toLowerCase();
  const homeCircleId = ((formData.get("homeCircleId") as string) ?? "").trim() || null;

  if (!person) return { error: "当前账号没有人员档案" };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: "邮箱格式不正确" };

  const invitationId = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashInvitationToken(token);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  let tokenCiphertext: string;
  try {
    tokenCiphertext = encryptInvitationToken(token, {
      organizationId: orgId,
      invitationId,
    });
  } catch {
    return { error: "邀请创建失败，请稍后重试" };
  }

  const created = await createInvitationForDelivery({
    actor: { organizationId: orgId, userId: session.user.id, personId: person.id },
    invitationId,
    email,
    tokenHash,
    tokenCiphertext,
    homeCircleId,
    requestedMode: undefined,
    now,
    expiresAt,
  });
  if (!created.ok) {
    if (created.code === "ACCESS_DENIED" || created.code === "ORG_ADMIN_REQUIRED") {
      return { error: "只有组织管理员可以邀请成员" };
    }
    if (created.code === "INVITATION_UNAVAILABLE") {
      return { error: "当前组织或归属回路不可用" };
    }
    if (created.code === "INVITATION_CONFLICT") {
      return { error: "邀请已存在，请重新提交" };
    }
    if (created.code === "INVALID_INPUT") {
      return { error: "邀请信息不正确" };
    }
    return { error: "邀请创建失败，请稍后重试" };
  }

  const invitationPath = withBasePath(`/invite/${token}`);
  revalidatePath("/app/people");
  return { link: invitationPath };
}
