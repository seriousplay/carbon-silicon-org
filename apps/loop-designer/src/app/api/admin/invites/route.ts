import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";
import {
  createInviteCode,
  getEnterpriseInviteCodes,
  disableInviteCode,
} from "@/lib/invite-codes";

/**
 * GET /api/admin/invites
 * 获取企业的所有邀请码（需要 manage_members 权限）
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(user, ["manage_members", "view_audit_logs"]);
    const codes = await getEnterpriseInviteCodes(user.enterpriseId);
    return NextResponse.json({ success: true, data: codes });
  } catch (error) {
    const message = error instanceof Error ? error.message : "获取邀请码失败";
    return NextResponse.json({ success: false, error: message }, { status: 403 });
  }
}

/**
 * POST /api/admin/invites
 * 生成新的邀请码（需要 manage_members 权限）
 */
export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(user, ["manage_members"]);

    const body = (await request.json()) as { maxUses?: number; expiresInHours?: number };
    const code = await createInviteCode({
      enterpriseId: user.enterpriseId,
      createdBy: user.id,
      maxUses: body.maxUses,
      expiresInHours: body.expiresInHours,
    });
    return NextResponse.json({ success: true, data: code });
  } catch (error) {
    const message = error instanceof Error ? error.message : "生成邀请码失败";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}

/**
 * PATCH /api/admin/invites
 * 禁用邀请码（需要 manage_members 权限）
 */
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await requireAdmin(user, ["manage_members"]);

    const body = (await request.json()) as { id: string };
    if (!body.id) {
      return NextResponse.json({ success: false, error: "缺少邀请码 ID" }, { status: 400 });
    }
    await disableInviteCode(body.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "禁用邀请码失败";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
