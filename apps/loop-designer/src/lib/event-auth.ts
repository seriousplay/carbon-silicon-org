import "server-only";

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { createAppSession, normalizeUser } from "./app-session";
import { maskPhone, normalizePhone, verifyEventAccessCode } from "./event-auth-utils";
import { cleanOrganizationName } from "./identity-labels";
import { getAdminClient } from "./supabase";

export type EventLoginInput = {
  accessCode?: string;
  phone: string;
  password?: string;
  displayName?: string;
  companyName?: string;
  contact?: string;
  ipAddress?: string | null;
  userAgent?: string | null;
};

export function eventLoginStatus(now = new Date()) {
  const enabled = process.env.LOOP_EVENT_LOGIN_ENABLED === "true";
  if (!enabled) return { ok: false as const, message: "手机号登录未启用" };

  const until = process.env.LOOP_EVENT_ACCESS_UNTIL;
  if (until) {
    const expiresAt = new Date(until);
    if (Number.isNaN(expiresAt.getTime())) {
      return { ok: false as const, message: "手机号登录过期时间配置无效" };
    }
    if (expiresAt.getTime() < now.getTime()) {
      return { ok: false as const, message: "手机号登录已结束" };
    }
  }

  return { ok: true as const };
}

export async function quickLoginWithEventPhone(input: EventLoginInput) {
  const status = eventLoginStatus();
  if (!status.ok) throw new Error(status.message);
  return quickLoginWithoutAccessCode(input, { requirePassword: true });
}

export async function quickLoginWithFixedEventCode(input: EventLoginInput, expectedAccessCode: string) {
  if (!expectedAccessCode.trim()) throw new Error("活动码未配置");
  return quickLoginWithExpectedAccessCode(input, expectedAccessCode);
}

async function quickLoginWithExpectedAccessCode(input: EventLoginInput, expectedAccessCode: string) {
  if (!verifyEventAccessCode(input.accessCode || "", expectedAccessCode)) {
    throw new Error("活动码无效");
  }
  return quickLoginWithoutAccessCode(input, { requirePassword: false });
}

async function quickLoginWithoutAccessCode(input: EventLoginInput, options: { requirePassword: boolean }) {
  const phone = normalizePhone(input.phone);
  const password = input.password?.trim() || "";
  const requestedDisplayName = input.displayName?.trim() || "";
  const requestedCompanyName = cleanOrganizationName(input.companyName);
  const displayName = requestedDisplayName || maskPhone(phone);
  const companyName = requestedCompanyName || "待填写企业名称";
  const contact = input.contact?.trim() || "";
  if (!phone) throw new Error("请填写有效手机号");
  if (options.requirePassword || password) validateEventPassword(password);

  const admin = getAdminClient();
  if (!admin) throw new Error("数据库未配置");

  const email = isEmail(contact) ? contact.toLowerCase() : null;
  const now = new Date().toISOString();
  const phoneKey = hashPhone(phone);
  const tenantKey = `event_phone:${phoneKey}`;
  const openId = `event_phone:${phoneKey}`;

  const { data: existing } = await admin
    .from("loop_designer_users")
    .select("*")
    .eq("tenant_key", tenantKey)
    .eq("open_id", openId)
    .maybeSingle();

  if (existing) {
    if (existing.auth_provider !== "event") {
      throw new Error("该手机号已被其他登录方式使用");
    }
    if (existing.password_hash && password) {
      const passwordOk = await bcrypt.compare(password, existing.password_hash);
      if (!passwordOk) throw new Error("手机号或密码错误");
    } else if (existing.password_hash && options.requirePassword) {
      throw new Error("请输入登录密码");
    }
    const updates: Record<string, unknown> = {
      last_login_at: now,
      updated_at: now,
    };
    if (requestedDisplayName) updates.display_name = requestedDisplayName;
    if (!existing.password_hash && password) updates.password_hash = await bcrypt.hash(password, 12);
    if (email) updates.email = email;
    const { data: updated, error: updateError } = await admin
      .from("loop_designer_users")
      .update(updates)
      .eq("id", existing.id)
      .select("*")
      .single();
    if (updateError || !updated) throw new Error(updateError?.message || "更新活动用户失败");

    if (updated.enterprise_id && (requestedCompanyName || contact || requestedDisplayName)) {
      const enterpriseUpdates: Record<string, unknown> = {
        updated_at: now,
      };
      if (requestedCompanyName) enterpriseUpdates.company_name = requestedCompanyName;
      enterpriseUpdates.billing_contact = {
        phone,
        contact: contact || null,
        display_name: requestedDisplayName || updated.display_name,
      };
      await admin
        .from("loop_designer_enterprises")
        .update(enterpriseUpdates)
        .eq("id", updated.enterprise_id);
    }

    await writeEventAuditLog({
      enterpriseId: updated.enterprise_id,
      userId: updated.id,
      companyName,
      contact,
      phone,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      reused: true,
    });
    await createAppSession(normalizeUser(updated), { skipEnterpriseActivation: true });
    return { user: updated, enterpriseId: updated.enterprise_id, reused: true };
  }

  const enterprise = await findOrCreateEventEnterprise({
    tenantKey,
    companyName,
    displayName,
    phone,
    contact,
    now,
  });

  const { data: user, error: userError } = await admin
    .from("loop_designer_users")
    .insert({
      tenant_key: tenantKey,
      enterprise_id: enterprise.id,
      open_id: openId,
      union_id: null,
      feishu_user_id: null,
      display_name: displayName,
      email,
      ...(password ? { password_hash: await bcrypt.hash(password, 12) } : {}),
      auth_provider: "event",
      status: "active",
      created_at: now,
      updated_at: now,
      last_login_at: now,
    })
    .select("*")
    .single();

  if (userError || !user) {
    throw new Error(userError?.message || "创建活动用户失败");
  }

  await admin.from("loop_designer_enterprise_members").insert({
    enterprise_id: enterprise.id,
    user_id: user.id,
    role: "super_admin",
    is_active: true,
  });

  await admin.from("loop_designer_enterprise_settings").insert({
    enterprise_id: enterprise.id,
  });

  await writeEventAuditLog({
    enterpriseId: enterprise.id,
    userId: user.id,
    companyName,
    contact,
    phone,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    reused: false,
  });

  await createAppSession(normalizeUser(user), { skipEnterpriseActivation: true });
  return { user, enterpriseId: enterprise.id, reused: false };
}

function validateEventPassword(password: string) {
  if (!password) throw new Error("请设置登录密码");
  if (password.length < 8) throw new Error("密码至少 8 个字符");
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    throw new Error("密码需要包含字母和数字");
  }
}

async function findOrCreateEventEnterprise(input: {
  tenantKey: string;
  companyName: string;
  displayName: string;
  phone: string;
  contact: string;
  now: string;
}) {
  const admin = getAdminClient();
  if (!admin) throw new Error("数据库未配置");

  const { data: existing } = await admin
    .from("loop_designer_enterprises")
    .select("*")
    .eq("tenant_key", input.tenantKey)
    .maybeSingle();
  if (existing) return existing;

  const { data: enterprise, error } = await admin
    .from("loop_designer_enterprises")
    .insert({
      tenant_key: input.tenantKey,
      company_name: input.companyName,
      subscription_tier: "enterprise",
      seat_limit: 5,
      used_seats: 1,
      feature_flags: { auth_source: "event_quick_login", identity: "phone" },
      billing_contact: { phone: input.phone, contact: input.contact || null, display_name: input.displayName },
      is_active: true,
      is_trial: true,
      trial_ends_at: process.env.LOOP_EVENT_ACCESS_UNTIL || null,
      created_at: input.now,
      updated_at: input.now,
    })
    .select("*")
    .single();

  if (!error && enterprise) return enterprise;

  const { data: raced } = await admin
    .from("loop_designer_enterprises")
    .select("*")
    .eq("tenant_key", input.tenantKey)
    .maybeSingle();
  if (raced) return raced;
  throw new Error(error?.message || "创建活动企业失败");
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function hashPhone(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

async function writeEventAuditLog(input: {
  enterpriseId: string;
  userId: string;
  companyName: string;
  contact: string;
  phone: string;
  ipAddress?: string | null;
  userAgent?: string | null;
  reused: boolean;
}) {
  const admin = getAdminClient();
  if (!admin) return;
  await admin.from("loop_designer_audit_logs").insert({
    enterprise_id: input.enterpriseId,
    user_id: input.userId,
    action: "event_quick_login",
    resource_type: "enterprise",
    resource_id: input.enterpriseId,
    details: {
      auth_provider: "event",
      identity: "phone",
      company_name: input.companyName,
      contact: input.contact || null,
      phone: input.phone,
      reused: input.reused,
    },
    ip_address: normalizeIp(input.ipAddress),
    user_agent: input.userAgent || null,
  });
}

function normalizeIp(value: string | null | undefined) {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}
