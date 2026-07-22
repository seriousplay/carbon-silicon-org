import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminClient } from "@/lib/supabase";
import { consumeInviteCode } from "@/lib/invite-codes";
import { checkRateLimit, getClientIP, rateLimitHeaders } from "@/lib/rate-limit";

const SIGNUP_RATE_LIMIT = { maxRequests: 3, windowSeconds: 3600 };

export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip = getClientIP(request);
    const limit = checkRateLimit(ip, SIGNUP_RATE_LIMIT);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "注册请求过于频繁，请稍后再试" },
        { status: 429, headers: rateLimitHeaders(SIGNUP_RATE_LIMIT.maxRequests, SIGNUP_RATE_LIMIT.windowSeconds, 0, Date.now() + limit.retryAfter * 1000) }
      );
    }

    const { email, password, displayName, inviteCode } = await request.json();

    if (!email || !password || !displayName) {
      return NextResponse.json({ error: "请填写邮箱、密码和姓名" }, { status: 400 });
    }

    // Password policy: min 8 chars, must contain letters and digits
    if (password.length < 8) {
      return NextResponse.json({ error: "密码至少 8 个字符" }, { status: 400 });
    }
    if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json({ error: "密码需要包含字母和数字" }, { status: 400 });
    }
    if (isWeakPassword(password)) {
      return NextResponse.json({ error: "密码过于常见，请使用更强的密码" }, { status: 400 });
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 500 });
    }

    // 检查邮箱是否已注册
    const { data: existing } = await admin
      .from("loop_designer_users")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }

    // 验证邀请码（如果提供了）
    let targetEnterprise: { enterpriseId: string; enterpriseName: string } | null = null;

    if (inviteCode) {
      try {
        targetEnterprise = await consumeInviteCode(inviteCode);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "邀请码无效";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    // 创建用户
    const passwordHash = await bcrypt.hash(password, 12);
    const now = new Date().toISOString();
    const userRecord: Record<string, unknown> = {
      email,
      password_hash: passwordHash,
      auth_provider: "email",
      display_name: displayName,
      status: "active",
      created_at: now,
      updated_at: now,
      last_login_at: now,
    };

    // 如果提供了邀请码，直接设置 enterprise_id
    if (targetEnterprise) {
      userRecord.enterprise_id = targetEnterprise.enterpriseId;
    }

    const { data: user, error } = await admin
      .from("loop_designer_users")
      .insert(userRecord)
      .select("*")
      .single();

    if (error || !user) {
      return NextResponse.json({ error: error?.message || "注册失败" }, { status: 500 });
    }

    // 如果通过邀请码注册，创建成员记录
    if (targetEnterprise) {
      await admin.from("loop_designer_enterprise_members").insert({
        enterprise_id: targetEnterprise.enterpriseId,
        user_id: user.id,
        role: "member",
        is_active: true,
      });

      await admin.rpc("increment_used_seats", { p_enterprise_id: targetEnterprise.enterpriseId });

      await admin.from("loop_designer_audit_logs").insert({
        enterprise_id: targetEnterprise.enterpriseId,
        user_id: user.id,
        action: "member_joined_via_invite",
        resource_type: "enterprise",
        resource_id: targetEnterprise.enterpriseId,
        details: { email, auth_provider: "email" },
      });
    }

    // 创建 session cookie
    const { createAppSession, normalizeUser } = await import("@/lib/app-session");
    await createAppSession(normalizeUser(user));

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, displayName: user.display_name },
      ...(targetEnterprise ? { enterprise: targetEnterprise } : {}),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注册失败" },
      { status: 500 }
    );
  }
}

/** Top 100 common weak passwords — rejects register attempts using these. */
const WEAK_PASSWORDS = new Set([
  "password", "12345678", "123456789", "1234567890", "qwerty123", "qwertyuiop",
  "admin123", "letmein1", "welcome1", "password1", "abc12345", "football1",
  "iloveyou1", "monkey12", "dragon12", "master12", "shadow12", "sunshine",
  "princess", "baseball", "football", "trustno1", "hunter12", "rangers1",
  "charlie1", "cookie12", "hello123", "liverpoo", "whatever", "chocolate",
]);

function isWeakPassword(password: string): boolean {
  const lower = password.toLowerCase();
  if (WEAK_PASSWORDS.has(lower)) return true;
  // Reject passwords that are too repetitive (e.g., "aaaaaaa1")
  if (/(.)\1{4,}/.test(lower)) return true;
  return false;
}
