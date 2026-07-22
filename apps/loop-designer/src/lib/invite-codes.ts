import "server-only";

import { randomBytes } from "node:crypto";
import { getAdminClient } from "./supabase";

/**
 * Phase 3: Invite code management
 */

export type InviteCode = {
  id: string;
  enterpriseId: string;
  code: string;
  createdBy: string;
  maxUses: number;
  usedCount: number;
  expiresAt: string | null;
  isActive: boolean;
  createdAt: string;
};

type InviteCodeRow = {
  id: string;
  enterpriseId: string;
  code: string;
  createdBy: string;
  maxUses: number;
  usedCount: number;
  expiresAt: Date | null;
  isActive: boolean;
  createdAt: Date;
};

function normalizeInviteCode(row: InviteCodeRow): InviteCode {
  return {
    id: row.id,
    enterpriseId: row.enterpriseId,
    code: row.code,
    createdBy: row.createdBy,
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
  };
}

export function generateCode(): string {
  return randomBytes(5)
    .toString("base64url")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8)
    .padEnd(8, "X");
}

export async function createInviteCode(input: {
  enterpriseId: string;
  createdBy: string;
  maxUses?: number;
  expiresInHours?: number;
}): Promise<InviteCode> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  let code: string;
  let attempts = 0;
  do {
    code = generateCode();
    const existing = await admin.loopDesignerInviteCode.findFirst({
      where: { code },
      select: { id: true },
    });
    if (!existing) break;
    attempts++;
  } while (attempts < 5);

  if (attempts >= 5) {
    throw new Error("无法生成唯一邀请码，请重试");
  }

  const expiresAt = input.expiresInHours
    ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000)
    : null;

  const data = await admin.loopDesignerInviteCode.create({
    data: {
      enterpriseId: input.enterpriseId,
      code,
      createdBy: input.createdBy,
      maxUses: input.maxUses ?? 0,
      usedCount: 0,
      expiresAt,
      isActive: true,
    },
  });

  return normalizeInviteCode(data as unknown as InviteCodeRow);
}

export async function getEnterpriseInviteCodes(enterpriseId: string): Promise<InviteCode[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const data = await admin.loopDesignerInviteCode.findMany({
    where: { enterpriseId },
    orderBy: { createdAt: "desc" },
  });

  return (data as unknown as InviteCodeRow[]).map(normalizeInviteCode);
}

export async function consumeInviteCode(code: string): Promise<{
  enterpriseId: string;
  enterpriseName: string;
  seatLimit: number;
  usedSeats: number;
}> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const invite = await admin.loopDesignerInviteCode.findFirst({
    where: {
      code: code.toUpperCase(),
      isActive: true,
    },
  });

  if (!invite) {
    throw new Error("邀请码无效或已过期");
  }

  // Check expiration
  if (invite.expiresAt && new Date(invite.expiresAt) < new Date()) {
    await admin.loopDesignerInviteCode.update({
      where: { id: invite.id },
      data: { isActive: false },
    });
    throw new Error("邀请码已过期");
  }

  // Check usage count
  if (invite.maxUses > 0 && invite.usedCount >= invite.maxUses) {
    throw new Error("邀请码已达最大使用次数");
  }

  // Check enterprise seats
  const enterprise = await admin.loopDesignerEnterprise.findFirst({
    where: { id: invite.enterpriseId },
    select: { id: true, companyName: true, seatLimit: true, usedSeats: true },
  });

  if (!enterprise) throw new Error("企业不存在");
  if (enterprise.usedSeats >= enterprise.seatLimit) {
    throw new Error("企业席位已满，请联系管理员升级订阅");
  }

  // Increment usage count (atomic)
  await admin.loopDesignerInviteCode.update({
    where: { id: invite.id },
    data: { usedCount: { increment: 1 } },
  });

  return {
    enterpriseId: enterprise.id,
    enterpriseName: enterprise.companyName,
    seatLimit: enterprise.seatLimit,
    usedSeats: enterprise.usedSeats,
  };
}

export async function disableInviteCode(codeId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  await admin.loopDesignerInviteCode.update({
    where: { id: codeId },
    data: { isActive: false },
  });
}
