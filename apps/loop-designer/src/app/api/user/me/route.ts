import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { revokeCurrentAppSession } from "@/lib/app-session";

/**
 * GET /api/user/me/export
 * Export user's personal data (GDPR / PIPL compliance).
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 500 });
    }

    // Fetch user sessions for export
    const sessions = await admin.loopDesignerSession.findMany({
      where: { userId: user.id },
      select: { id: true, status: true, context: true, createdAt: true, submittedAt: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    });

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        displayName: user.displayName,
        tenantKey: user.tenantKey,
      },
      sessions,
    });
  } catch {
    return NextResponse.json(
      { error: "数据导出失败" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/user/me
 * Soft-delete user account: anonymize personal data, revoke sessions.
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 500 });
    }

    // 1. Revoke all auth sessions for this user
    await admin.loopDesignerAuthSession.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    // 2. Anonymize user record (soft delete)
    const anonymizedId = `deleted_${user.id}`;
    await admin.loopDesignerUser.update({
      where: { id: user.id },
      data: {
        displayName: "已删除用户",
        email: null,
        passwordHash: null,
        avatarUrl: null,
        openId: anonymizedId,
        unionId: null,
        feishuUserId: null,
        status: "disabled",
        updatedAt: new Date(),
      },
    });

    // 3. Revoke current session cookie
    await revokeCurrentAppSession();

    return NextResponse.json({ success: true, message: "账号已删除" });
  } catch {
    return NextResponse.json(
      { error: "账号删除失败" },
      { status: 500 }
    );
  }
}
