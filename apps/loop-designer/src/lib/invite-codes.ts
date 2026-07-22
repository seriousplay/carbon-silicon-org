import "server-only";

import { randomBytes } from "node:crypto";
import { getAdminClient } from "./supabase";

/**
 * Phase 3: 邀请码管理
 *
 * 企业 super_admin 生成邀请码，目标用户（邮箱注册时或已有用户）凭码加入企业。
 * 支持限次和过期。
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
  enterprise_id: string;
  code: string;
  created_by: string;
  max_uses: number;
  used_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
};

function normalizeInviteCode(row: InviteCodeRow): InviteCode {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    code: row.code,
    createdBy: row.created_by,
    maxUses: row.max_uses,
    usedCount: row.used_count,
    expiresAt: row.expires_at,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

/**
 * 生成一个随机邀请码（8 位大写字母数字）
 */
export function generateCode(): string {
  return randomBytes(5)
    .toString("base64url")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8)
    .padEnd(8, "X");
}

/**
 * 生成邀请码
 */
export async function createInviteCode(input: {
  enterpriseId: string;
  createdBy: string;
  maxUses?: number;
  expiresInHours?: number;
}): Promise<InviteCode> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  // 生成唯一邀请码（冲突重试）
  let code: string;
  let attempts = 0;
  do {
    code = generateCode();
    const { data: existing } = await admin
      .from("loop_designer_invite_codes")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    if (!existing) break;
    attempts++;
  } while (attempts < 5);

  if (attempts >= 5) {
    throw new Error("无法生成唯一邀请码，请重试");
  }

  const expiresAt = input.expiresInHours
    ? new Date(Date.now() + input.expiresInHours * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await admin
    .from("loop_designer_invite_codes")
    .insert({
      enterprise_id: input.enterpriseId,
      code,
      created_by: input.createdBy,
      max_uses: input.maxUses ?? 0,
      used_count: 0,
      expires_at: expiresAt,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "创建邀请码失败");
  }

  return normalizeInviteCode(data as InviteCodeRow);
}

/**
 * 获取企业的所有邀请码
 */
export async function getEnterpriseInviteCodes(enterpriseId: string): Promise<InviteCode[]> {
  const admin = getAdminClient();
  if (!admin) return [];

  const { data } = await admin
    .from("loop_designer_invite_codes")
    .select("*")
    .eq("enterprise_id", enterpriseId)
    .order("created_at", { ascending: false });

  return ((data ?? []) as InviteCodeRow[]).map(normalizeInviteCode);
}

/**
 * 验证并消费邀请码
 * @returns 邀请码对应的企业 ID，或抛出错误
 */
export async function consumeInviteCode(code: string): Promise<{
  enterpriseId: string;
  enterpriseName: string;
  seatLimit: number;
  usedSeats: number;
}> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  // 1. 查找邀请码
  const { data: invite, error } = await admin
    .from("loop_designer_invite_codes")
    .select("*")
    .eq("code", code.toUpperCase())
    .eq("is_active", true)
    .maybeSingle();

  if (error || !invite) {
    throw new Error("邀请码无效或已过期");
  }

  const inviteRow = invite as InviteCodeRow;

  // 2. 检查过期
  if (inviteRow.expires_at && new Date(inviteRow.expires_at) < new Date()) {
    await admin
      .from("loop_designer_invite_codes")
      .update({ is_active: false })
      .eq("id", inviteRow.id);
    throw new Error("邀请码已过期");
  }

  // 3. 检查使用次数
  if (inviteRow.max_uses > 0 && inviteRow.used_count >= inviteRow.max_uses) {
    throw new Error("邀请码已达最大使用次数");
  }

  // 4. 检查企业席位
  const { data: enterprise } = await admin
    .from("loop_designer_enterprises")
    .select("id, company_name, seat_limit, used_seats")
    .eq("id", inviteRow.enterprise_id)
    .single();

  if (!enterprise) throw new Error("企业不存在");
  if (enterprise.used_seats >= enterprise.seat_limit) {
    throw new Error("企业席位已满，请联系管理员升级订阅");
  }

  // 5. 递增使用次数（原子操作）
  const { error: updateError } = await admin
    .from("loop_designer_invite_codes")
    .update({ used_count: inviteRow.used_count + 1 })
    .eq("id", inviteRow.id);

  if (updateError) throw new Error("邀请码使用失败，请重试");

  return {
    enterpriseId: enterprise.id,
    enterpriseName: enterprise.company_name,
    seatLimit: enterprise.seat_limit,
    usedSeats: enterprise.used_seats,
  };
}

/**
 * 禁用邀请码
 */
export async function disableInviteCode(codeId: string): Promise<void> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { error } = await admin
    .from("loop_designer_invite_codes")
    .update({ is_active: false })
    .eq("id", codeId);
  if (error) throw new Error(error.message);
}
