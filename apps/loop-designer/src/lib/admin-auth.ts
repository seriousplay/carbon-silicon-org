import "server-only";

import type { AppUser } from "./app-session";
import {
  getUserEnterpriseRole,
  type AdminRole,
} from "./admin-console";

/**
 * Phase 2: 管理员权限检查
 *
 * 使用示例：
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const { user, adminRole } = await requireAdmin(request, ["super_admin", "billing_admin"]);
 *   // user 是 AppUser
 *   // adminRole 是用户的角色
 * }
 * ```
 */

export type AdminAuthResult = {
  user: AppUser;
  adminRole: AdminRole;
};

export type RequiredPermission = "manage_members" | "manage_billing" | "manage_loop_assets" | "view_audit_logs" | "modify_settings";

/**
 * 要求管理员权限
 *
 * @param user - 已经通过 requireUser 验证的用户
 * @param permissions - 需要的权限列表（满足其一即可）
 * @returns 用户对象和管理员角色
 * @throws Error 如果权限不足
 */
export async function requireAdmin(
  user: AppUser,
  permissions: RequiredPermission[]
): Promise<AdminAuthResult> {
  // 1. 获取用户角色
  const role = await getUserEnterpriseRole(user.id, user.enterpriseId);
  if (!role) {
    throw new Error("Forbidden", { cause: "FORBIDDEN" });
  }

  // 2. 检查权限
  if (!hasPermission(role, permissions)) {
    throw new Error("Forbidden: insufficient permissions", { cause: "FORBIDDEN" });
  }

  return { user, adminRole: role };
}

/**
 * 检查角色是否满足任一权限要求
 */
function hasPermission(role: AdminRole, permissions: RequiredPermission[]): boolean {
  return permissions.some((permission) => checkSinglePermission(role, permission));
}

/**
 * 检查单个权限
 */
function checkSinglePermission(role: AdminRole, permission: RequiredPermission): boolean {
  switch (permission) {
    case "manage_members":
      return role === "super_admin" || role === "member_admin";
    case "manage_billing":
      return role === "super_admin" || role === "billing_admin";
    case "manage_loop_assets":
      return role !== "member";
    case "view_audit_logs":
      return role !== "member";
    case "modify_settings":
      return role === "super_admin";
    default:
      return false;
  }
}

/**
 * 管理员 API 响应辅助函数
 */
export function adminSuccess<T>(data: T) {
  return { success: true, data } as const;
}

export function adminError(message: string, status: number = 500) {
  return { success: false, error: message, status } as const;
}
