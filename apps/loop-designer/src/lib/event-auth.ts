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

  const existing = await admin.loopDesignerUser.findFirst({
    where: {
      tenantKey,
      openId,
    },
  });

  if (existing) {
    if (existing.authProvider !== "event") {
      throw new Error("该手机号已被其他登录方式使用");
    }
    if (existing.passwordHash && password) {
      const passwordOk = await bcrypt.compare(password, existing.passwordHash);
      if (!passwordOk) throw new Error("手机号或密码错误");
    } else if (existing.passwordHash && options.requirePassword) {
      throw new Error("请输入登录密码");
    }
    const updates: Record<string, unknown> = {
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    };
    if (requestedDisplayName) updates.displayName = requestedDisplayName;
    if (!existing.passwordHash && password) updates.passwordHash = await bcrypt.hash(password, 12);
    if (email) updates.email = email;
    await admin.loopDesignerUser.update({
      where: { id: existing.id },
      data: updates,
    });

    if (existing.enterpriseId && (requestedCompanyName || contact || requestedDisplayName)) {
      const enterpriseUpdates: Record<string, unknown> = {
        updatedAt: new Date(),
      };
      if (requestedCompanyName) enterpriseUpdates.companyName = requestedCompanyName;
      enterpriseUpdates.billingContact = {
        phone,
        contact: contact || null,
        displayName: requestedDisplayName || existing.displayName,
      };
      await admin.loopDesignerEnterprise.update({
        where: { id: existing.enterpriseId },
        data: enterpriseUpdates,
      });
    }

    await writeEventAuditLog({
      enterpriseId: existing.enterpriseId ?? "",
      userId: existing.id,
      companyName,
      contact,
      phone,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      reused: true,
    });
    await createAppSession(normalizeUser(existing), { skipEnterpriseActivation: true });
    return { user: existing, enterpriseId: existing.enterpriseId, reused: true };
  }

  const enterprise = await findOrCreateEventEnterprise({
    tenantKey,
    companyName,
    displayName,
    phone,
    contact,
    now,
  });

  const user = await admin.loopDesignerUser.create({
    data: {
      tenantKey,
      enterpriseId: enterprise.id,
      openId,
      unionId: null,
      feishuUserId: null,
      displayName,
      email,
      ...(password ? { passwordHash: await bcrypt.hash(password, 12) } : {}),
      authProvider: "event",
      status: "active",
      createdAt: new Date(now),
      updatedAt: new Date(now),
      lastLoginAt: new Date(now),
    },
  });

  await admin.loopDesignerEnterpriseMember.create({
    data: {
      enterpriseId: enterprise.id,
      userId: user.id,
      role: "super_admin",
      isActive: true,
    },
  });

  await admin.loopDesignerEnterpriseSetting.create({
    data: {
      enterpriseId: enterprise.id,
    },
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

  const existing = await admin.loopDesignerEnterprise.findFirst({
    where: { tenantKey: input.tenantKey },
  });
  if (existing) return existing;

  try {
    return await admin.loopDesignerEnterprise.create({
      data: {
        tenantKey: input.tenantKey,
        companyName: input.companyName,
        subscriptionTier: "enterprise",
        seatLimit: 5,
        usedSeats: 1,
        featureFlags: { auth_source: "event_quick_login", identity: "phone" },
        billingContact: { phone: input.phone, contact: input.contact || null, displayName: input.displayName },
        isActive: true,
        isTrial: true,
        trialEndsAt: process.env.LOOP_EVENT_ACCESS_UNTIL ? new Date(process.env.LOOP_EVENT_ACCESS_UNTIL) : null,
        createdAt: new Date(input.now),
        updatedAt: new Date(input.now),
      },
    });
  } catch {
    const raced = await admin.loopDesignerEnterprise.findFirst({
      where: { tenantKey: input.tenantKey },
    });
    if (raced) return raced;
    throw new Error("创建活动企业失败");
  }
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
  await admin.loopDesignerAuditLog.create({
    data: {
      enterpriseId: input.enterpriseId,
      userId: input.userId,
      action: "event_quick_login",
      resourceType: "enterprise",
      resourceId: input.enterpriseId,
      details: {
        auth_provider: "event",
        identity: "phone",
        company_name: input.companyName,
        contact: input.contact || null,
        phone: input.phone,
        reused: input.reused,
      },
      ipAddress: normalizeIp(input.ipAddress),
      userAgent: input.userAgent || null,
    },
  });
}

function normalizeIp(value: string | null | undefined) {
  if (!value) return null;
  return value.split(",")[0]?.trim() || null;
}
