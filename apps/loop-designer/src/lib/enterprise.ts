import "server-only";

import { getAdminClient } from "./supabase";

/**
 * Phase 1: 企业激活与订阅管理
 *
 * 当新企业首次使用时：
 * 1. 自动创建企业记录（free tier 试用）
 * 2. 关联用户到企业
 * 3. 支持后续升级订阅
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
  tenant_key: string;
  company_name: string;
  subscription_tier: "free" | "pro" | "enterprise";
  seat_limit: number;
  used_seats: number;
  feature_flags: Record<string, unknown>;
  is_active: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  created_at: string;
};

function normalizeEnterprise(row: EnterpriseRow): Enterprise {
  return {
    id: row.id,
    tenantKey: row.tenant_key,
    companyName: row.company_name,
    subscriptionTier: row.subscription_tier,
    seatLimit: row.seat_limit,
    usedSeats: row.used_seats,
    featureFlags: row.feature_flags,
    isActive: row.is_active,
    isTrial: row.is_trial,
    trialEndsAt: row.trial_ends_at,
    createdAt: row.created_at,
  };
}

/**
 * 激活企业（首次使用时自动调用）
 * 如果企业已存在则返回现有记录
 */
export async function activateEnterprise(input: {
  tenantKey: string;
  companyName: string;
  displayName: string;
}): Promise<Enterprise> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  // 1. 尝试查找现有企业
  const { data: existing } = await admin
    .from("loop_designer_enterprises")
    .select("*")
    .eq("tenant_key", input.tenantKey)
    .maybeSingle();

  if (existing) {
    return normalizeEnterprise(existing as EnterpriseRow);
  }

  // 2. 创建新企业（默认 free tier 14天试用）
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const { data: enterprise, error } = await admin
    .from("loop_designer_enterprises")
    .insert({
      tenant_key: input.tenantKey,
      company_name: input.companyName,
      subscription_tier: "free",
      is_trial: true,
      trial_ends_at: trialEndsAt.toISOString(),
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !enterprise) {
    throw new Error(error?.message ?? "Failed to activate enterprise");
  }

  return normalizeEnterprise(enterprise as EnterpriseRow);
}

/**
 * 根据 tenant_key 查找企业
 */
export async function getEnterpriseByTenantKey(tenantKey: string): Promise<Enterprise | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("loop_designer_enterprises")
    .select("*")
    .eq("tenant_key", tenantKey)
    .maybeSingle();
  return data ? normalizeEnterprise(data as EnterpriseRow) : null;
}

/**
 * 根据 enterpriseId 查找企业
 */
export async function getEnterpriseById(enterpriseId: string): Promise<Enterprise | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("loop_designer_enterprises")
    .select("*")
    .eq("id", enterpriseId)
    .maybeSingle();
  return data ? normalizeEnterprise(data as EnterpriseRow) : null;
}

/**
 * 更新企业订阅层级
 */
export async function updateEnterpriseSubscription(
  enterpriseId: string,
  tier: "free" | "pro" | "enterprise",
  seatLimit: number
): Promise<Enterprise> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const { data, error } = await admin
    .from("loop_designer_enterprises")
    .update({
      subscription_tier: tier,
      seat_limit: seatLimit,
      is_trial: false,
      is_active: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", enterpriseId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update subscription");
  }

  return normalizeEnterprise(data as EnterpriseRow);
}

/**
 * 检查企业是否有权使用某功能
 */
export function checkFeatureAccess(enterprise: Enterprise, feature: string): boolean {
  // 试用期检查
  if (enterprise.isTrial && enterprise.trialEndsAt) {
    const trialEnd = new Date(enterprise.trialEndsAt);
    if (new Date() > trialEnd) {
      return false; // 试用已过期
    }
  }

  // 功能开关检查
  if (feature in enterprise.featureFlags) {
    return Boolean(enterprise.featureFlags[feature]);
  }

  // 基于订阅层级的默认权限
  const tierPermissions: Record<string, string[]> = {
    free: ["basic_design", "markdown_export", "pdf_export"],
    pro: ["basic_design", "markdown_export", "pdf_export", "feishu_export", "ai_gpt4"],
    enterprise: ["basic_design", "markdown_export", "pdf_export", "feishu_export", "ai_gpt4", "ai_claude", "sso", "custom_branding"],
  };

  return tierPermissions[enterprise.subscriptionTier]?.includes(feature) ?? false;
}

/**
 * 检查用户数是否超出配额
 */
export function checkSeatQuota(enterprise: Enterprise): boolean {
  return enterprise.usedSeats < enterprise.seatLimit;
}
