import "server-only";

import { getAdminClient } from "./supabase";

/**
 * Phase 1: Enterprise activation & subscription management
 */

export type Enterprise = {
  id: string;
  tenantKey: string;
  companyName: string;
  subscriptionTier: "free" | "pro" | "enterprise";
  seatLimit: number;
  usedSeats: number;
  featureFlags: Record<string, unknown>;
  isActive: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  createdAt: string;
};

export type EnterpriseRow = {
  id: string;
  tenantKey: string;
  companyName: string;
  subscriptionTier: string;
  seatLimit: number;
  usedSeats: number;
  featureFlags: Record<string, unknown>;
  isActive: boolean;
  isTrial: boolean;
  trialEndsAt: Date | null;
  createdAt: Date;
};

function normalizeEnterprise(row: EnterpriseRow): Enterprise {
  return {
    id: row.id,
    tenantKey: row.tenantKey,
    companyName: row.companyName,
    subscriptionTier: row.subscriptionTier as "free" | "pro" | "enterprise",
    seatLimit: row.seatLimit,
    usedSeats: row.usedSeats,
    featureFlags: row.featureFlags,
    isActive: row.isActive,
    isTrial: row.isTrial,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function activateEnterprise(input: {
  tenantKey: string;
  companyName: string;
  displayName: string;
}): Promise<Enterprise> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const existing = await admin.loopDesignerEnterprise.findFirst({
    where: { tenantKey: input.tenantKey },
  });

  if (existing) {
    return normalizeEnterprise(existing as unknown as EnterpriseRow);
  }

  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const enterprise = await admin.loopDesignerEnterprise.create({
    data: {
      tenantKey: input.tenantKey,
      companyName: input.companyName,
      subscriptionTier: "free",
      isTrial: true,
      trialEndsAt,
      isActive: true,
    },
  });

  return normalizeEnterprise(enterprise as unknown as EnterpriseRow);
}

export async function getEnterpriseByTenantKey(tenantKey: string): Promise<Enterprise | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const data = await admin.loopDesignerEnterprise.findFirst({
    where: { tenantKey },
  });
  return data ? normalizeEnterprise(data as unknown as EnterpriseRow) : null;
}

export async function getEnterpriseById(enterpriseId: string): Promise<Enterprise | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const data = await admin.loopDesignerEnterprise.findFirst({
    where: { id: enterpriseId },
  });
  return data ? normalizeEnterprise(data as unknown as EnterpriseRow) : null;
}

export async function updateEnterpriseSubscription(
  enterpriseId: string,
  tier: "free" | "pro" | "enterprise",
  seatLimit: number
): Promise<Enterprise> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const data = await admin.loopDesignerEnterprise.update({
    where: { id: enterpriseId },
    data: {
      subscriptionTier: tier,
      seatLimit,
      isTrial: false,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  return normalizeEnterprise(data as unknown as EnterpriseRow);
}

export function checkFeatureAccess(enterprise: Enterprise, feature: string): boolean {
  if (enterprise.isTrial && enterprise.trialEndsAt) {
    const trialEnd = new Date(enterprise.trialEndsAt);
    if (new Date() > trialEnd) {
      return false;
    }
  }

  if (feature in enterprise.featureFlags) {
    return Boolean(enterprise.featureFlags[feature]);
  }

  const tierPermissions: Record<string, string[]> = {
    free: ["basic_design", "markdown_export", "pdf_export"],
    pro: ["basic_design", "markdown_export", "pdf_export", "feishu_export", "ai_gpt4"],
    enterprise: ["basic_design", "markdown_export", "pdf_export", "feishu_export", "ai_gpt4", "ai_claude", "sso", "custom_branding"],
  };

  return tierPermissions[enterprise.subscriptionTier]?.includes(feature) ?? false;
}

export function checkSeatQuota(enterprise: Enterprise): boolean {
  return enterprise.usedSeats < enterprise.seatLimit;
}
