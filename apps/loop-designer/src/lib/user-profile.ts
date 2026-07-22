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
  const { data: enterprise } = await admin
    .from("loop_designer_enterprises")
    .select("company_name")
    .eq("id", user.enterpriseId)
    .maybeSingle();
  return {
    displayName: user.displayName,
    companyName: cleanOrganizationName(enterprise?.company_name),
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
  const now = new Date().toISOString();
  const userUpdates: Record<string, unknown> = { display_name: displayName, updated_at: now };
  if (newPassword) {
    if (newPassword !== newPasswordConfirm) throw new Error("两次输入的新密码不一致");
    validatePassword(newPassword);
    const { data: existing, error: existingError } = await admin
      .from("loop_designer_users")
      .select("password_hash")
      .eq("id", user.id)
      .single();
    if (existingError || !existing) throw new Error(existingError?.message || "无法读取当前用户");
    if (existing.password_hash) {
      const currentPassword = input.currentPassword?.trim() || "";
      if (!currentPassword) throw new Error("请输入当前密码");
      const passwordOk = await bcrypt.compare(currentPassword, existing.password_hash);
      if (!passwordOk) throw new Error("当前密码不正确");
    }
    userUpdates.password_hash = await bcrypt.hash(newPassword, 12);
  }
  const { error: userError } = await admin
    .from("loop_designer_users")
    .update(userUpdates)
    .eq("id", user.id);
  if (userError) throw new Error(userError.message);
  const { error: enterpriseError } = await admin
    .from("loop_designer_enterprises")
    .update({ company_name: companyName, updated_at: now })
    .eq("id", user.enterpriseId);
  if (enterpriseError) throw new Error(enterpriseError.message);
  return { displayName, companyName };
}

function validatePassword(password: string) {
  if (password.length < 8) throw new Error("新密码至少 8 个字符");
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("新密码需要包含字母和数字");
  }
}
