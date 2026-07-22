import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getEnterpriseSettings, updateEnterpriseSettings } from "@/lib/admin-console";
import { getAdminClient } from "@/lib/supabase";
import { statusFromAdminError } from "@/lib/admin-api";
import { getModelCandidateSummaries } from "@/lib/model-config";

/**
 * GET /api/admin/settings
 * 获取企业设置（需要 modify_settings 权限）
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireAdmin(user, ["modify_settings"]);

    const settings = await getEnterpriseSettings(user.enterpriseId);

    // 同时获取企业订阅信息
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    const { data: enterprise } = await admin
      .from("loop_designer_enterprises")
      .select("subscription_tier, seat_limit, used_seats, is_trial, trial_ends_at")
      .eq("id", user.enterpriseId)
      .single();

    return NextResponse.json({
      success: true,
      data: {
        settings,
        subscription: enterprise,
        modelProviders: getModelCandidateSummaries(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch settings";
    const status = statusFromAdminError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/**
 * PATCH /api/admin/settings
 * 更新企业设置（需要 modify_settings 权限）
 */
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireAdmin(user, ["modify_settings"]);

    const body = (await request.json()) as {
      defaultAiModel?: string;
      enableAiClaude?: boolean;
      enableCustomKnowledgeBase?: boolean;
    };

    const updated = await updateEnterpriseSettings(user.enterpriseId, body, user.id);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update settings";
    const status = statusFromAdminError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
