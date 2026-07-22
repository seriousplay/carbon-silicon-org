import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getEnterpriseMembers, addEnterpriseMember } from "@/lib/admin-console";
import { getAdminClient } from "@/lib/supabase";
import { isAdminRole, statusFromAdminError } from "@/lib/admin-api";

type EnterpriseSeatRow = {
  used_seats: number | null;
  seat_limit: number | null;
};

/**
 * GET /api/admin/members
 * 获取企业所有成员（需要 manage_members 权限）
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { adminRole } = await requireAdmin(user, ["manage_members", "view_audit_logs"]);

    const members = await getEnterpriseMembers(user.enterpriseId);

    // 获取企业席位信息
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    const { data: enterprise } = await admin
      .from("loop_designer_enterprises")
      .select("seat_limit, used_seats")
      .eq("id", user.enterpriseId)
      .single();
    const seats = enterprise as EnterpriseSeatRow | null;

    return NextResponse.json({
      success: true,
      data: {
        members,
        seats: {
          used: members.length,
          limit: seats?.seat_limit ?? 5,
        },
        currentUserRole: adminRole,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch members";
    const status = statusFromAdminError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/**
 * POST /api/admin/members
 * 添加新成员（需要 manage_members 权限）
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireAdmin(user, ["manage_members"]);

    const body = (await request.json()) as {
      userId?: string;
      email?: string;
      role?: string;
    };

    if (!body.userId && !body.email) {
      return NextResponse.json(
        { success: false, error: "Please provide userId or email" },
        { status: 400 }
      );
    }

    // TODO: Phase 3 - 实现邮件邀请
    // 目前仅支持通过 userId 添加
    if (!body.userId) {
      return NextResponse.json(
        { success: false, error: "Email invites coming in Phase 3. Please provide userId for now." },
        { status: 501 }
      );
    }

    const role = isAdminRole(body.role) && body.role !== "super_admin"
      ? body.role
      : "member";

    const member = await addEnterpriseMember({
      enterpriseId: user.enterpriseId,
      userId: body.userId,
      role,
      invitedBy: user.id,
    });

    return NextResponse.json({ success: true, data: member });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to add member";
    const status = statusFromAdminError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
