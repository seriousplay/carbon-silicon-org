import "server-only";

import bcrypt from "bcryptjs";
import type { AppUser } from "./app-session";
import { cleanOrganizationName } from "./identity-labels";
import { getAdminClient } from "./supabase";

export type UserProfile = {
  displayName: string;
  companyName: string;
};

export type UserProfileUpdateInput = UserProfile & {
  currentPassword?: string;
  newPassword?: string;
  newPasswordConfirm?: string;
};

export async function getUserProfile(user: AppUser): Promise<UserProfile> {
  const admin = getAdminClient();
  if (!admin) return { displayName: user.displayName, companyName: "" };
  const enterprise = await admin.loopDesignerEnterprise.findFirst({
    where: { id: user.enterpriseId },
    select: { companyName: true },
  });
  return {
    displayName: user.displayName,
    companyName: cleanOrganizationName(enterprise?.companyName),
  };
}

export async function updateUserProfile(user: AppUser, input: UserProfileUpdateInput) {
  const displayName = input.displayName.trim();
  const companyName = cleanOrganizationName(input.companyName);
  const newPassword = input.newPassword?.trim() || "";
  const newPasswordConfirm = input.newPasswordConfirm?.trim() || "";
  if (!displayName || displayName.length > 80) throw new Error("姓名需要 1-80 个字符");
  if (!companyName || companyName.length > 120) throw new Error("企业名称需要 1-120 个字符");
  const admin = getAdminClient();
  if (!admin) throw new Error("数据库未配置");
  const now = new Date();
  const userUpdates: Record<string, unknown> = { displayName, updatedAt: now };
  if (newPassword) {
    if (newPassword !== newPasswordConfirm) throw new Error("两次输入的新密码不一致");
    validatePassword(newPassword);
    const existing = await admin.loopDesignerUser.findFirst({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!existing) throw new Error("无法读取当前用户");
    if (existing.passwordHash) {
      const currentPassword = input.currentPassword?.trim() || "";
      if (!currentPassword) throw new Error("请输入当前密码");
      const passwordOk = await bcrypt.compare(currentPassword, existing.passwordHash);
      if (!passwordOk) throw new Error("当前密码不正确");
    }
    userUpdates.passwordHash = await bcrypt.hash(newPassword, 12);
  }
  await admin.loopDesignerUser.update({
    where: { id: user.id },
    data: userUpdates,
  });
  await admin.loopDesignerEnterprise.update({
    where: { id: user.enterpriseId },
    data: { companyName, updatedAt: now },
  });
  return { displayName, companyName };
}

function validatePassword(password: string) {
  if (password.length < 8) throw new Error("新密码至少 8 个字符");
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("新密码需要包含字母和数字");
  }
}
