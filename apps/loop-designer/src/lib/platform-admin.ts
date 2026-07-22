import "server-only";

import type { AppUser } from "./app-session";
import { getUserEnterpriseRole } from "./admin-console";
import { getAdminClient } from "./supabase";

export type PlatformEnterprise = {
  id: string;
  tenantKey: string;
  companyName: string;
  subscriptionTier: string;
  seatLimit: number;
  usedSeats: number;
  isActive: boolean;
  isTrial: boolean;
  trialEndsAt: string | null;
  authSource: string | null;
  createdAt: string;
  updatedAt: string | null;
};

type EnterpriseRow = {
  id: string;
  tenant_key: string;
  company_name: string;
  subscription_tier: string;
  seat_limit: number;
  used_seats: number;
  is_active: boolean;
  is_trial: boolean;
  trial_ends_at: string | null;
  feature_flags: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
};

function parseList(value: string | undefined) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function platformAdminTenantKeys() {
  const explicit = parseList(process.env.LOOP_PLATFORM_ADMIN_TENANT_KEYS);
  if (explicit.length) return explicit;
  return parseList(process.env.FEISHU_ALLOWED_TENANT_KEY);
}

export async function isPlatformAdmin(user: AppUser) {
  const tenantAllowed = platformAdminTenantKeys().includes(user.tenantKey);
  const unionAllowed = user.unionId
    ? parseList(process.env.LOOP_PLATFORM_ADMIN_UNION_IDS).includes(user.unionId)
    : false;
  const openAllowed = parseList(process.env.LOOP_PLATFORM_ADMIN_OPEN_IDS).includes(user.openId);
  if (!tenantAllowed && !unionAllowed && !openAllowed) return false;

  const role = await getUserEnterpriseRole(user.id, user.enterpriseId);
  return role === "super_admin";
}

export async function requirePlatformAdmin(user: AppUser) {
  if (!(await isPlatformAdmin(user))) {
    throw new Error("Forbidden: platform admin required", { cause: "FORBIDDEN" });
  }
}

export async function listPlatformEnterprises(): Promise<PlatformEnterprise[]> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Database not configured");

  const { data, error } = await admin
    .from("loop_designer_enterprises")
    .select("id,tenant_key,company_name,subscription_tier,seat_limit,used_seats,is_active,is_trial,trial_ends_at,feature_flags,created_at,updated_at")
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as EnterpriseRow[]).map((row) => ({
    id: row.id,
    tenantKey: row.tenant_key,
    companyName: row.company_name,
    subscriptionTier: row.subscription_tier,
    seatLimit: row.seat_limit,
    usedSeats: row.used_seats,
    isActive: row.is_active,
    isTrial: row.is_trial,
    trialEndsAt: row.trial_ends_at,
    authSource: typeof row.feature_flags?.auth_source === "string" ? row.feature_flags.auth_source : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function setEnterpriseAccess(input: {
  enterpriseId: string;
  isActive: boolean;
  actorUserId: string;
}) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Database not configured");

  const { data, error } = await admin
    .from("loop_designer_enterprises")
    .update({
      is_active: input.isActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.enterpriseId)
    .select("id,company_name,is_active")
    .single();

  if (error || !data) throw new Error(error?.message ?? "企业不存在");

  await admin.from("loop_designer_audit_logs").insert({
    enterprise_id: input.enterpriseId,
    user_id: input.actorUserId,
    action: input.isActive ? "tenant_access_enabled" : "tenant_access_disabled",
    resource_type: "platform_enterprise",
    resource_id: input.enterpriseId,
    details: { company_name: data.company_name },
  });

  return data;
}
