import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase";
import { consumeInviteCode } from "@/lib/invite-codes";

/**
 * POST /api/auth/join-enterprise/[code]
 * 使用邀请码加入企业
 *
 * Uses atomic RPC (join_enterprise_atomic) when available,
 * falls back to legacy multi-step approach for backward compatibility.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 500 });
    }

    // Try atomic RPC first (single transaction, prevents partial writes)
    const { data: rpcResult, error: rpcError } = await admin.rpc(
      "join_enterprise_atomic",
      { p_invite_code: code, p_user_id: user.id }
    );

    if (!rpcError && rpcResult) {
      const result = rpcResult as { success: boolean; error?: string; message?: string; already_member?: boolean; enterprise_id?: string; enterprise_name?: string };
      if (!result.success) {
        return NextResponse.json({ success: false, error: result.error || "加入企业失败" }, { status: 400 });
      }
      if (result.already_member) {
        return NextResponse.json({ success: true, message: result.message }, { status: 200 });
      }
      return NextResponse.json({
        success: true,
        message: `已加入 ${result.enterprise_name}`,
        data: { enterpriseId: result.enterprise_id, enterpriseName: result.enterprise_name },
      });
    }

    // Fallback: legacy multi-step approach
    // 1. 验证并消费邀请码
    const inviteInfo = await consumeInviteCode(code);

    // 2. 检查用户是否已在目标企业中
    const { data: existingMember } = await admin
      .from("loop_designer_enterprise_members")
      .select("id, is_active")
      .eq("enterprise_id", inviteInfo.enterpriseId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingMember?.is_active) {
      return NextResponse.json({ success: true, message: "你已在该企业中" }, { status: 200 });
    }

    // 3. 重新激活之前被停用的成员记录
    if (existingMember && !existingMember.is_active) {
      await admin
        .from("loop_designer_enterprise_members")
        .update({ is_active: true, left_at: null })
        .eq("id", existingMember.id);

      await admin
        .from("loop_designer_users")
        .update({ enterprise_id: inviteInfo.enterpriseId })
        .eq("id", user.id);

      await admin.rpc("increment_used_seats", { p_enterprise_id: inviteInfo.enterpriseId });

      return NextResponse.json({
        success: true,
        data: { enterpriseId: inviteInfo.enterpriseId, enterpriseName: inviteInfo.enterpriseName },
      });
    }

    // 4. 保存原企业 ID（用于释放席位）
    const oldEnterpriseId = user.enterpriseId;

    // 5. 创建新企业的成员记录
    await admin.from("loop_designer_enterprise_members").insert({
      enterprise_id: inviteInfo.enterpriseId,
      user_id: user.id,
      role: "member",
      is_active: true,
    });

    // 6. 更新 enterprise_id
    await admin
      .from("loop_designer_users")
      .update({ enterprise_id: inviteInfo.enterpriseId })
      .eq("id", user.id);

    // 7. 递增目标企业席位
    await admin.rpc("increment_used_seats", { p_enterprise_id: inviteInfo.enterpriseId });

    // 8. 释放原企业席位
    if (oldEnterpriseId && oldEnterpriseId !== inviteInfo.enterpriseId) {
      await admin.rpc("decrement_used_seats", { p_enterprise_id: oldEnterpriseId });
    }

    // 9. 审计日志
    await admin.from("loop_designer_audit_logs").insert({
      enterprise_id: inviteInfo.enterpriseId,
      user_id: user.id,
      action: "member_joined_via_invite",
      resource_type: "enterprise",
      resource_id: inviteInfo.enterpriseId,
      details: { old_enterprise_id: oldEnterpriseId, code },
    });

    return NextResponse.json({
      success: true,
      message: `已加入 ${inviteInfo.enterpriseName}`,
      data: { enterpriseId: inviteInfo.enterpriseId, enterpriseName: inviteInfo.enterpriseName },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "加入企业失败";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
