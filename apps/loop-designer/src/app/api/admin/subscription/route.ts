import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { requireAdmin } from "@/lib/admin-auth";
import { getAdminClient } from "@/lib/supabase";
import { statusFromAdminError } from "@/lib/admin-api";

type EnterpriseSubscriptionRow = {
  subscriptionTier: string;
  seatLimit: number;
  isTrial: boolean;
  trialEndsAt: Date | null;
};

type EnterpriseSeatUsageRow = {
  usedSeats: number;
  subscriptionTier: string;
};

/**
 * GET /api/admin/subscription
 * Get enterprise subscription info (requires manage_billing permission)
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

    const enterprise = await admin.loopDesignerEnterprise.findFirst({
      where: { id: user.enterpriseId },
    });

    if (!enterprise) {
      return NextResponse.json({ success: false, error: "Enterprise not found" }, { status: 404 });
    }
    const enterpriseRow = enterprise as unknown as EnterpriseSubscriptionRow;
    const activeMemberCount = await admin.loopDesignerEnterpriseMember.count({
      where: {
        enterpriseId: user.enterpriseId,
        isActive: true,
      },
    });

    // TODO: Phase 3 - Integrate with real payment API for billing
    const subscription = {
      tier: enterpriseRow.subscriptionTier,
      seatLimit: enterpriseRow.seatLimit,
      usedSeats: activeMemberCount ?? 0,
      isTrial: enterpriseRow.isTrial,
      trialEndsAt: enterpriseRow.trialEndsAt?.toISOString() ?? null,
      nextBillingDate: null, // TODO: From payment API
      amount: null, // TODO: From payment API
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
 * Upgrade/downgrade subscription (requires manage_billing permission)
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

    // Calculate new seat limit
    let newSeatLimit = body.seatLimit;
    if (!newSeatLimit) {
      if (body.tier === "free") newSeatLimit = 5;
      else if (body.tier === "pro") newSeatLimit = 999;
      else newSeatLimit = 9999; // enterprise
    }

    // Validate downgrade: ensure new seat limit accommodates current members
    const current = await admin.loopDesignerEnterprise.findFirst({
      where: { id: user.enterpriseId },
      select: { usedSeats: true, subscriptionTier: true },
    });
    const currentUsage = current as unknown as EnterpriseSeatUsageRow | null;

    if (currentUsage && newSeatLimit < currentUsage.usedSeats) {
      return NextResponse.json(
        {
          success: false,
          error: `当前已占用 ${currentUsage.usedSeats} 个席位，降级后席位上限为 ${newSeatLimit}。请先移除多余成员后再降级。`,
        },
        { status: 422 }
      );
    }

    // Update enterprise subscription
    const enterprise = await admin.loopDesignerEnterprise.update({
      where: { id: user.enterpriseId },
      data: {
        subscriptionTier: body.tier,
        seatLimit: newSeatLimit,
        isTrial: false,
        updatedAt: new Date(),
      },
    });

    // TODO: Phase 3 - Call payment API to create order

    return NextResponse.json({ success: true, data: enterprise });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update subscription";
    const status = statusFromAdminError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
