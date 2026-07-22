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
  tenantKey: string;
  companyName: string;
  subscriptionTier: string;
  seatLimit: number;
  usedSeats: number;
  isActive: boolean;
  isTrial: boolean;
  trialEndsAt: Date | null;
  featureFlags: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date | null;
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

  const data = await admin.loopDesignerEnterprise.findMany({
    select: {
      id: true,
      tenantKey: true,
      companyName: true,
      subscriptionTier: true,
      seatLimit: true,
      usedSeats: true,
      isActive: true,
      isTrial: true,
      trialEndsAt: true,
      featureFlags: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return (data as unknown as EnterpriseRow[]).map((row) => ({
    id: row.id,
    tenantKey: row.tenantKey,
    companyName: row.companyName,
    subscriptionTier: row.subscriptionTier,
    seatLimit: row.seatLimit,
    usedSeats: row.usedSeats,
    isActive: row.isActive,
    isTrial: row.isTrial,
    trialEndsAt: row.trialEndsAt?.toISOString() ?? null,
    authSource: typeof row.featureFlags?.auth_source === "string" ? row.featureFlags.auth_source : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt?.toISOString() ?? null,
  }));
}

export async function setEnterpriseAccess(input: {
  enterpriseId: string;
  isActive: boolean;
  actorUserId: string;
}) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Database not configured");

  const data = await admin.loopDesignerEnterprise.update({
    where: { id: input.enterpriseId },
    data: {
      isActive: input.isActive,
      updatedAt: new Date(),
    },
    select: { id: true, companyName: true, isActive: true },
  });

  await admin.loopDesignerAuditLog.create({
    data: {
      enterpriseId: input.enterpriseId,
      userId: input.actorUserId,
      action: input.isActive ? "tenant_access_enabled" : "tenant_access_disabled",
      resourceType: "platform_enterprise",
      resourceId: input.enterpriseId,
      details: { company_name: data.companyName },
    },
  });

  return data;
}
