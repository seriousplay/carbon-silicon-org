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
    const { data: sessions } = await admin
      .from("loop_designer_sessions")
      .select("id, status, context, created_at, submitted_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);

    return NextResponse.json({
      exportedAt: new Date().toISOString(),
      user: {
        id: user.id,
        displayName: user.displayName,
        tenantKey: user.tenantKey,
      },
      sessions: sessions ?? [],
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
    await admin
      .from("loop_designer_auth_sessions")
      .update({
        revoked_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .is("revoked_at", null);

    // 2. Anonymize user record (soft delete)
    const anonymizedId = `deleted_${user.id}`;
    await admin
      .from("loop_designer_users")
      .update({
        display_name: "已删除用户",
        email: null,
        password_hash: null,
        avatar_url: null,
        open_id: anonymizedId,
        union_id: null,
        feishu_user_id: null,
        status: "disabled",
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

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
