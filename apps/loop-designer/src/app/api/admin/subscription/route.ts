import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminClient } from "@/lib/supabase";
import { statusFromAdminError } from "@/lib/admin-api";

type EnterpriseSubscriptionRow = {
  subscription_tier: "free" | "pro" | "enterprise";
  seat_limit: number;
  is_trial: boolean;
  trial_ends_at: string | null;
};

type EnterpriseSeatUsageRow = {
  used_seats: number;
  subscription_tier: string;
};

/**
 * GET /api/admin/subscription
 * 获取企业订阅信息（需要 manage_billing 权限）
 */
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireAdmin(user, ["manage_billing"]);

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    const { data: enterprise } = await admin
      .from("loop_designer_enterprises")
      .select("*")
      .eq("id", user.enterpriseId)
      .single();

    if (!enterprise) {
      return NextResponse.json({ success: false, error: "Enterprise not found" }, { status: 404 });
    }
    const enterpriseRow = enterprise as EnterpriseSubscriptionRow;
    const { count: activeMemberCount } = await admin
      .from("loop_designer_enterprise_members")
      .select("id", { count: "exact", head: true })
      .eq("enterprise_id", user.enterpriseId)
      .eq("is_active", true);

    // TODO: Phase 3 - 集成实际支付API获取账单信息
    // 目前返回模拟数据
    const subscription = {
      tier: enterpriseRow.subscription_tier,
      seatLimit: enterpriseRow.seat_limit,
      usedSeats: activeMemberCount ?? 0,
      isTrial: enterpriseRow.is_trial,
      trialEndsAt: enterpriseRow.trial_ends_at,
      nextBillingDate: null, // TODO: 从支付API获取
      amount: null, // TODO: 从支付API获取
      availableTiers: [
        { tier: "free", name: "免费版", price: 0, seats: 5 },
        { tier: "pro", name: "专业版", price: 99, seats: "unlimited" },
        { tier: "enterprise", name: "企业版", price: "custom", seats: "unlimited" },
      ],
    };

    return NextResponse.json({ success: true, data: subscription });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch subscription";
    const status = statusFromAdminError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

/**
 * PATCH /api/admin/subscription
 * 升级/降级订阅（需要 manage_billing 权限）
 */
export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await requireAdmin(user, ["manage_billing"]);

    const body = (await request.json()) as {
      tier: "free" | "pro" | "enterprise";
      seatLimit?: number;
    };

    if (!body.tier || !["free", "pro", "enterprise"].includes(body.tier)) {
      return NextResponse.json(
        { success: false, error: "Invalid tier" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ success: false, error: "Database not configured" }, { status: 500 });
    }

    // 计算新席位上限
    let newSeatLimit = body.seatLimit;
    if (!newSeatLimit) {
      if (body.tier === "free") newSeatLimit = 5;
      else if (body.tier === "pro") newSeatLimit = 999;
      else newSeatLimit = 9999; // enterprise
    }

    // Validate downgrade: ensure new seat limit accommodates current members
    const { data: current } = await admin
      .from("loop_designer_enterprises")
      .select("used_seats, subscription_tier")
      .eq("id", user.enterpriseId)
      .single();
    const currentUsage = current as EnterpriseSeatUsageRow | null;

    if (currentUsage && newSeatLimit < currentUsage.used_seats) {
      return NextResponse.json(
        {
          success: false,
          error: `当前已占用 ${currentUsage.used_seats} 个席位，降级后席位上限为 ${newSeatLimit}。请先移除多余成员后再降级。`,
        },
        { status: 422 }
      );
    }

    // 更新企业订阅
    const { data: enterprise, error } = await admin
      .from("loop_designer_enterprises")
      .update({
        subscription_tier: body.tier,
        seat_limit: newSeatLimit,
        is_trial: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.enterpriseId)
      .select("*")
      .single();

    if (error || !enterprise) {
      return NextResponse.json(
        { success: false, error: error?.message || "Failed to update subscription" },
        { status: 500 }
      );
    }

    // TODO: Phase 3 - 调用支付API创建订单

    return NextResponse.json({ success: true, data: enterprise });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update subscription";
    const status = statusFromAdminError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
