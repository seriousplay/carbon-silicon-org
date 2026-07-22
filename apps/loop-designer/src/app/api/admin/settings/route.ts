import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getEnterpriseSettings, updateEnterpriseSettings } from "@/lib/admin-console";
import { getAdminClient } from "@/lib/supabase";
import { statusFromAdminError } from "@/lib/admin-api";
import { getModelCandidateSummaries } from "@/lib/model-config";

/**
 * GET /api/admin/settings
 * Get enterprise settings (requires modify_settings permission)
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireAdmin(user, ["modify_settings"]);

    const settings = await getEnterpriseSettings(user.enterpriseId);

    // Also get enterprise subscription info
    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    const enterprise = await admin.loopDesignerEnterprise.findFirst({
      where: { id: user.enterpriseId },
      select: {
        subscriptionTier: true,
        seatLimit: true,
        usedSeats: true,
        isTrial: true,
        trialEndsAt: true,
      },
    });

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
 * Update enterprise settings (requires modify_settings permission)
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
