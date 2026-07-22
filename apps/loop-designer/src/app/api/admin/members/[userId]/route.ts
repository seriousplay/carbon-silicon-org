import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";
import { removeEnterpriseMember, updateMemberRole } from "@/lib/admin-console";
import { isAdminRole, statusFromAdminError } from "@/lib/admin-api";

/**
 * DELETE /api/admin/members/[userId]
 * 移除成员（需要 manage_members 权限）
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireAdmin(user, ["manage_members"]);
    const { userId } = await params;

    await removeEnterpriseMember(user.enterpriseId, userId, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to remove member";
    const status = statusFromAdminError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/**
 * PATCH /api/admin/members/[userId]
 * 更新成员角色（需要 manage_members 权限）
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireAdmin(user, ["manage_members"]);
    const { userId } = await params;

    const body = (await request.json()) as { role?: string };
    const role = body.role;

    if (!isAdminRole(role)) {
      return NextResponse.json(
        { success: false, error: "Invalid role" },
        { status: 400 }
      );
    }

    await updateMemberRole(user.enterpriseId, userId, role, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update member role";
    const status = statusFromAdminError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
