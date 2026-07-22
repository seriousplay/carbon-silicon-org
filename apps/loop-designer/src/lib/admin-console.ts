import "server-only";

import type { AppUser } from "./app-session";
import { getAdminClient } from "./supabase";

/**
 * Phase 2: 企业管理员权限管理
 *
 * 角色层级（从高到低）：
 * - super_admin: 超级管理员（企业创建者自动获得）
 * - billing_admin: 计费管理员
 * - member_admin: 成员管理员
 * - member: 普通成员
 */

export type AdminRole = "super_admin" | "billing_admin" | "member_admin" | "member";

export type EnterpriseMember = {
  id: string;
  enterpriseId: string;
  userId: string;
  role: AdminRole;
  invitedBy: string | null;
  isActive: boolean;
  joinedAt: string;
  leftAt: string | null;
  user?: {
    displayName: string;
    avatarUrl: string | null;
    email?: string;
  };
};

export type AuditLog = {
  id: string;
  enterpriseId: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  user?: {
    displayName: string;
  };
};

export type EnterpriseSettings = {
  id: string;
  enterpriseId: string;
  defaultAiModel: string;
  enableAiClaude: boolean;
  enableCustomKnowledgeBase: boolean;
  branding: Record<string, unknown>;
  dataRetentionDays: number;
  updatedAt: string;
};

type EnterpriseMemberRow = {
  id: string;
  enterprise_id: string;
  user_id: string;
  role: AdminRole;
  invited_by: string | null;
  is_active: boolean;
  joined_at: string;
  left_at: string | null;
  user?: {
    display_name: string;
    avatar_url: string | null;
  } | null;
};

type UserProfileRow = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type AuditLogRow = {
  id: string;
  enterprise_id: string;
  user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  user?: {
    display_name: string;
  } | null;
};

type EnterpriseSettingsRow = {
  id: string;
  enterprise_id: string;
  default_ai_model: string;
  enable_ai_claude: boolean;
  enable_custom_knowledge_base: boolean;
  branding: Record<string, unknown>;
  data_retention_days: number;
  updated_at: string;
};

/**
 * 权限检查：是否可以管理成员
 */
export function canManageMembers(role: AdminRole): boolean {
  return role === "super_admin" || role === "member_admin";
}

/**
 * 权限检查：是否可以管理计费
 */
export function canManageBilling(role: AdminRole): boolean {
  return role === "super_admin" || role === "billing_admin";
}

/**
 * 权限检查：是否可以查看审计日志
 */
export function canViewAuditLogs(role: AdminRole): boolean {
  return role === "super_admin" || role === "billing_admin" || role === "member_admin";
}

/**
 * 权限检查：是否可以修改企业设置
 */
export function canModifySettings(role: AdminRole): boolean {
  return role === "super_admin";
}

/**
 * 获取用户在企业中的角色
 */
export async function getUserEnterpriseRole(
  userId: string,
  enterpriseId: string
): Promise<AdminRole | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("loop_designer_enterprise_members")
    .select("role")
    .eq("user_id", userId)
    .eq("enterprise_id", enterpriseId)
    .eq("is_active", true)
    .maybeSingle();

  return (data as { role: AdminRole } | null)?.role ?? null;
}

/**
 * 检查用户是否是管理员
 */
export async function isEnterpriseAdmin(
  user: AppUser
): Promise<boolean> {
  const role = await getUserEnterpriseRole(user.id, user.enterpriseId);
  return role !== null && role !== "member";
}

/**
 * 获取企业所有成员
 */
export async function getEnterpriseMembers(
  enterpriseId: string
): Promise<EnterpriseMember[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const { data, error } = await admin
    .from("loop_designer_enterprise_members")
    .select("*")
    .eq("enterprise_id", enterpriseId)
    .eq("is_active", true)
    .order("joined_at", { ascending: false });

  if (error) throw new Error(error.message);
  const rows = (data ?? []) as EnterpriseMemberRow[];
  const userIds = rows.map((row) => row.user_id);
  if (!userIds.length) return [];

  const { data: users, error: userError } = await admin
    .from("loop_designer_users")
    .select("id,display_name,avatar_url")
    .in("id", userIds);

  if (userError) throw new Error(userError.message);
  const userById = new Map(
    ((users ?? []) as UserProfileRow[]).map((user) => [user.id, user]),
  );

  return rows.map((row) => normalizeMember({
    ...row,
    user: userById.get(row.user_id) ? {
      display_name: userById.get(row.user_id)!.display_name,
      avatar_url: userById.get(row.user_id)!.avatar_url,
    } : null,
  }));
}

/**
 * 添加企业成员
 */
export async function addEnterpriseMember(input: {
  enterpriseId: string;
  userId: string;
  role: AdminRole;
  invitedBy: string;
}): Promise<EnterpriseMember> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  // 1. 添加成员
  const { data: member, error } = await admin
    .from("loop_designer_enterprise_members")
    .insert({
      enterprise_id: input.enterpriseId,
      user_id: input.userId,
      role: input.role,
      invited_by: input.invitedBy,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !member) {
    throw new Error(error?.message ?? "Failed to add member");
  }

  // 2. 记录审计日志
  await logAuditEvent({
    enterpriseId: input.enterpriseId,
    userId: input.invitedBy,
    action: "member_added",
    resourceType: "user",
    resourceId: input.userId,
    details: { role: input.role },
  });

  // 3. 更新企业已使用席位
  await incrementUsedSeats(input.enterpriseId);

  return normalizeMember(member as EnterpriseMemberRow);
}

/**
 * 移除企业成员
 */
export async function removeEnterpriseMember(
  enterpriseId: string,
  userId: string,
  removedBy: string
): Promise<void> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  // 1. 标记为非活跃
  const { error } = await admin
    .from("loop_designer_enterprise_members")
    .update({
      is_active: false,
      left_at: new Date().toISOString(),
    })
    .eq("enterprise_id", enterpriseId)
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  // 2. 记录审计日志
  await logAuditEvent({
    enterpriseId,
    userId: removedBy,
    action: "member_removed",
    resourceType: "user",
    resourceId: userId,
    details: {},
  });

  // 3. 减少企业席位
  await releaseUserSeat(userId, enterpriseId);
}

/**
 * 更新成员角色
 */
export async function updateMemberRole(
  enterpriseId: string,
  userId: string,
  newRole: AdminRole,
  updatedBy: string
): Promise<void> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const { error } = await admin
    .from("loop_designer_enterprise_members")
    .update({ role: newRole })
    .eq("enterprise_id", enterpriseId)
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  // 记录审计日志
  await logAuditEvent({
    enterpriseId,
    userId: updatedBy,
    action: "member_role_updated",
    resourceType: "user",
    resourceId: userId,
    details: { newRole },
  });
}

/**
 * 记录审计日志
 */
export async function logAuditEvent(input: {
  enterpriseId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  const admin = getAdminClient();
  if (!admin) return;

  await admin.from("loop_designer_audit_logs").insert({
    enterprise_id: input.enterpriseId,
    user_id: input.userId,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId,
    details: input.details,
    ip_address: input.ipAddress ?? null,
    user_agent: input.userAgent ?? null,
  });
}

/**
 * 获取企业审计日志
 */
export async function getEnterpriseAuditLogs(
  enterpriseId: string,
  limit: number = 50,
  offset: number = 0
): Promise<AuditLog[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("loop_designer_audit_logs")
    .select(`
      *,
      user:loop_designer_users(display_name)
    `)
    .eq("enterprise_id", enterpriseId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  return ((data ?? []) as AuditLogRow[]).map((row) => ({
    id: row.id,
    enterpriseId: row.enterprise_id,
    userId: row.user_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    details: row.details,
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    user: row.user ? { displayName: row.user.display_name } : undefined,
  }));
}

/**
 * 获取企业设置
 */
export async function getEnterpriseSettings(
  enterpriseId: string
): Promise<EnterpriseSettings | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const { data } = await admin
    .from("loop_designer_enterprise_settings")
    .select("*")
    .eq("enterprise_id", enterpriseId)
    .maybeSingle();

  return data ? normalizeSettings(data as EnterpriseSettingsRow) : null;
}

/**
 * 更新企业设置
 */
export async function updateEnterpriseSettings(
  enterpriseId: string,
  settings: Partial<Omit<EnterpriseSettings, "id" | "enterpriseId" | "updatedAt">>,
  updatedBy: string
): Promise<EnterpriseSettings> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const { data, error } = await admin
    .from("loop_designer_enterprise_settings")
    .update({
      ...settings,
      updated_at: new Date().toISOString(),
    })
    .eq("enterprise_id", enterpriseId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update settings");
  }

  // 记录审计日志
  await logAuditEvent({
    enterpriseId,
    userId: updatedBy,
    action: "settings_updated",
    resourceType: "enterprise_settings",
    resourceId: enterpriseId,
    details: { changed_fields: Object.keys(settings) },
  });

  return normalizeSettings(data as EnterpriseSettingsRow);
}

/**
 * 增加企业席位（原子操作）
 */
async function incrementUsedSeats(enterpriseId: string) {
  const admin = getAdminClient();
  if (!admin) return;

  await admin.rpc("increment_used_seats", { p_enterprise_id: enterpriseId });
}

/**
 * 释放企业席位（原子操作）
 */
async function releaseUserSeat(_userId: string, enterpriseId: string) {
  const admin = getAdminClient();
  if (!admin) return;

  await admin.rpc("decrement_used_seats", { p_enterprise_id: enterpriseId });
}

function normalizeMember(row: EnterpriseMemberRow): EnterpriseMember {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    userId: row.user_id,
    role: row.role,
    invitedBy: row.invited_by,
    isActive: row.is_active,
    joinedAt: row.joined_at,
    leftAt: row.left_at,
    user: row.user ? {
      displayName: row.user.display_name,
      avatarUrl: row.user.avatar_url,
    } : undefined,
  };
}

function normalizeSettings(row: EnterpriseSettingsRow): EnterpriseSettings {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    defaultAiModel: row.default_ai_model,
    enableAiClaude: row.enable_ai_claude,
    enableCustomKnowledgeBase: row.enable_custom_knowledge_base,
    branding: row.branding,
    dataRetentionDays: row.data_retention_days,
    updatedAt: row.updated_at,
  };
}
