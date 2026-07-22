import type { AdminRole } from "./admin-console";

export function statusFromAdminError(error: unknown) {
  return error instanceof Error && error.cause === "UNAUTHORIZED" ? 401 : 403;
}

export function isAdminRole(value: unknown): value is AdminRole {
  return value === "super_admin"
    || value === "billing_admin"
    || value === "member_admin"
    || value === "member";
}
