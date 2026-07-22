import "server-only";

import type { AppUser } from "./app-session";
import { getAdminClient } from "./supabase";

/**
 * Phase 2: Enterprise admin privilege management
 *
 * Role hierarchy (from high to low):
 * - super_admin: Super admin (auto-granted to enterprise creator)
 * - billing_admin: Billing admin
 * - member_admin: Member admin
 * - member: Regular member
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
  enterpriseId: string;
  userId: string;
  role: string;
  invitedBy: string | null;
  isActive: boolean;
  joinedAt: Date;
  leftAt: Date | null;
  user?: {
    displayName: string;
    avatarUrl: string | null;
  } | null;
};

type UserProfileRow = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
};

type AuditLogRow = {
  id: string;
  enterpriseId: string;
  userId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  details: Record<string, unknown>;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user?: {
    displayName: string;
  } | null;
};

type EnterpriseSettingsRow = {
  id: string;
  enterpriseId: string;
  defaultAiModel: string;
  enableAiClaude: boolean;
  enableCustomKnowledgeBase: boolean;
  branding: Record<string, unknown>;
  dataRetentionDays: number;
  updatedAt: Date;
};

/**
 * Permission check: can manage members
 */
export function canManageMembers(role: AdminRole): boolean {
  return role === "super_admin" || role === "member_admin";
}

/**
 * Permission check: can manage billing
 */
export function canManageBilling(role: AdminRole): boolean {
  return role === "super_admin" || role === "billing_admin";
}

/**
 * Permission check: can view audit logs
 */
export function canViewAuditLogs(role: AdminRole): boolean {
  return role === "super_admin" || role === "billing_admin" || role === "member_admin";
}

/**
 * Permission check: can modify enterprise settings
 */
export function canModifySettings(role: AdminRole): boolean {
  return role === "super_admin";
}

/**
 * Get user's role in enterprise
 */
export async function getUserEnterpriseRole(
  userId: string,
  enterpriseId: string
): Promise<AdminRole | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const data = await admin.loopDesignerEnterpriseMember.findFirst({
    where: {
      userId,
      enterpriseId,
      isActive: true,
    },
    select: { role: true },
  });

  return (data?.role as AdminRole) ?? null;
}

/**
 * Check if user is an admin
 */
export async function isEnterpriseAdmin(
  user: AppUser
): Promise<boolean> {
  const role = await getUserEnterpriseRole(user.id, user.enterpriseId);
  return role !== null && role !== "member";
}

/**
 * Get all enterprise members
 */
export async function getEnterpriseMembers(
  enterpriseId: string
): Promise<EnterpriseMember[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const data = await admin.loopDesignerEnterpriseMember.findMany({
    where: {
      enterpriseId,
      isActive: true,
    },
    orderBy: { joinedAt: "desc" },
  });

  const rows = data as unknown as EnterpriseMemberRow[];
  const userIds = rows.map((row) => row.userId);
  if (!userIds.length) return [];

  const users = await admin.loopDesignerUser.findMany({
    where: { id: { in: userIds } },
    select: { id: true, displayName: true, avatarUrl: true },
  });

  const userById = new Map(
    users.map((user) => [user.id, user]),
  );

  return rows.map((row) => normalizeMember({
    ...row,
    user: userById.get(row.userId) ? {
      displayName: userById.get(row.userId)!.displayName,
      avatarUrl: userById.get(row.userId)!.avatarUrl,
    } : null,
  }));
}

/**
 * Add enterprise member
 */
export async function addEnterpriseMember(input: {
  enterpriseId: string;
  userId: string;
  role: AdminRole;
  invitedBy: string;
}): Promise<EnterpriseMember> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  // 1. Add member
  const member = await admin.loopDesignerEnterpriseMember.create({
    data: {
      enterpriseId: input.enterpriseId,
      userId: input.userId,
      role: input.role,
      invitedBy: input.invitedBy,
      isActive: true,
    },
  });

  // 2. Log audit event
  await logAuditEvent({
    enterpriseId: input.enterpriseId,
    userId: input.invitedBy,
    action: "member_added",
    resourceType: "user",
    resourceId: input.userId,
    details: { role: input.role },
  });

  // 3. Increment used seats
  await incrementUsedSeats(input.enterpriseId);

  return normalizeMember(member as unknown as EnterpriseMemberRow);
}

/**
 * Remove enterprise member
 */
export async function removeEnterpriseMember(
  enterpriseId: string,
  userId: string,
  removedBy: string
): Promise<void> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  // 1. Mark as inactive
  await admin.loopDesignerEnterpriseMember.updateMany({
    where: {
      enterpriseId,
      userId,
    },
    data: {
      isActive: false,
      leftAt: new Date(),
    },
  });

  // 2. Log audit event
  await logAuditEvent({
    enterpriseId,
    userId: removedBy,
    action: "member_removed",
    resourceType: "user",
    resourceId: userId,
    details: {},
  });

  // 3. Release enterprise seat
  await releaseUserSeat(userId, enterpriseId);
}

/**
 * Update member role
 */
export async function updateMemberRole(
  enterpriseId: string,
  userId: string,
  newRole: AdminRole,
  updatedBy: string
): Promise<void> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  await admin.loopDesignerEnterpriseMember.updateMany({
    where: {
      enterpriseId,
      userId,
      isActive: true,
    },
    data: { role: newRole },
  });

  // Log audit event
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
 * Record audit log
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

  await admin.loopDesignerAuditLog.create({
    data: {
      enterpriseId: input.enterpriseId,
      userId: input.userId,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      details: input.details,
      ipAddress: input.ipAddress ?? null,
      userAgent: input.userAgent ?? null,
    },
  });
}

/**
 * Get enterprise audit logs
 */
export async function getEnterpriseAuditLogs(
  enterpriseId: string,
  limit: number = 50,
  offset: number = 0
): Promise<AuditLog[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const data = await admin.loopDesignerAuditLog.findMany({
    where: { enterpriseId },
    orderBy: { createdAt: "desc" },
    skip: offset,
    take: limit,
    include: {
      user: { select: { displayName: true } },
    },
  });

  return (data as unknown as AuditLogRow[]).map((row) => ({
    id: row.id,
    enterpriseId: row.enterpriseId,
    userId: row.userId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    details: row.details,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    createdAt: row.createdAt.toISOString(),
    user: row.user ? { displayName: row.user.displayName } : undefined,
  }));
}

/**
 * Get enterprise settings
 */
export async function getEnterpriseSettings(
  enterpriseId: string
): Promise<EnterpriseSettings | null> {
  const admin = getAdminClient();
  if (!admin) return null;

  const data = await admin.loopDesignerEnterpriseSetting.findFirst({
    where: { enterpriseId },
  });

  return data ? normalizeSettings(data as unknown as EnterpriseSettingsRow) : null;
}

/**
 * Update enterprise settings
 */
export async function updateEnterpriseSettings(
  enterpriseId: string,
  settings: Partial<Omit<EnterpriseSettings, "id" | "enterpriseId" | "updatedAt">>,
  updatedBy: string
): Promise<EnterpriseSettings> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const data = await admin.loopDesignerEnterpriseSetting.update({
    where: { enterpriseId },
    data: {
      ...settings,
      updatedAt: new Date(),
    },
  });

  // Log audit event
  await logAuditEvent({
    enterpriseId,
    userId: updatedBy,
    action: "settings_updated",
    resourceType: "enterprise_settings",
    resourceId: enterpriseId,
    details: { changed_fields: Object.keys(settings) },
  });

  return normalizeSettings(data as unknown as EnterpriseSettingsRow);
}

/**
 * Increment enterprise seats (atomic operation)
 */
async function incrementUsedSeats(enterpriseId: string) {
  const admin = getAdminClient();
  if (!admin) return;

  await admin.loopDesignerEnterprise.update({
    where: { id: enterpriseId },
    data: { usedSeats: { increment: 1 } },
  });
}

/**
 * Release enterprise seat (atomic operation)
 */
async function releaseUserSeat(_userId: string, enterpriseId: string) {
  const admin = getAdminClient();
  if (!admin) return;

  await admin.loopDesignerEnterprise.update({
    where: { id: enterpriseId },
    data: { usedSeats: { decrement: 1 } },
  });
}

function normalizeMember(row: EnterpriseMemberRow): EnterpriseMember {
  return {
    id: row.id,
    enterpriseId: row.enterpriseId,
    userId: row.userId,
    role: row.role as AdminRole,
    invitedBy: row.invitedBy,
    isActive: row.isActive,
    joinedAt: row.joinedAt.toISOString(),
    leftAt: row.leftAt?.toISOString() ?? null,
    user: row.user ? {
      displayName: row.user.displayName,
      avatarUrl: row.user.avatarUrl,
    } : undefined,
  };
}

function normalizeSettings(row: EnterpriseSettingsRow): EnterpriseSettings {
  return {
    id: row.id,
    enterpriseId: row.enterpriseId,
    defaultAiModel: row.defaultAiModel,
    enableAiClaude: row.enableAiClaude,
    enableCustomKnowledgeBase: row.enableCustomKnowledgeBase,
    branding: row.branding,
    dataRetentionDays: row.dataRetentionDays,
    updatedAt: row.updatedAt.toISOString(),
  };
}
