import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminClient } from "@/lib/supabase";
import { createAppSession, normalizeUser } from "@/lib/app-session";
import { checkRateLimit, getClientIP, rateLimitHeaders } from "@/lib/rate-limit";
import { safeLogError } from "@/lib/api-error";

const LOGIN_RATE_LIMIT = { maxRequests: 5, windowSeconds: 60 };

/**
 * POST /api/auth/email/login
 * 邮箱密码登录
 */
export async function POST(request: Request) {
  try {
    // Rate limiting
    const ip = getClientIP(request);
    const limit = checkRateLimit(ip, LOGIN_RATE_LIMIT);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "请求过于频繁，请稍后再试" },
        { status: 429, headers: rateLimitHeaders(LOGIN_RATE_LIMIT.maxRequests, LOGIN_RATE_LIMIT.windowSeconds, 0, Date.now() + limit.retryAfter * 1000) }
      );
    }

    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "请填写邮箱和密码" },
        { status: 400 }
      );
    }

    const admin = getAdminClient();
    if (!admin) {
      return NextResponse.json({ error: "数据库未配置" }, { status: 500 });
    }

    // 1. 查找用户（仅邮箱认证方式）
    const { data: user, error: userError } = await admin
      .from("loop_designer_users")
      .select("*")
      .eq("email", email)
      .eq("auth_provider", "email")
      .eq("status", "active")
      .maybeSingle();

    if (userError || !user) {
      // 统一错误消息，避免泄露用户是否存在
      return NextResponse.json(
        { error: "邮箱或密码错误" },
        { status: 401 }
      );
    }

    // 2. 验证密码
    const passwordHash = user.password_hash as string;
    if (!passwordHash) {
      return NextResponse.json(
        { error: "该账号未设置密码，请使用其他方式登录" },
        { status: 400 }
      );
    }

    const isValid = await bcrypt.compare(password, passwordHash);
    if (!isValid) {
      return NextResponse.json(
        { error: "邮箱或密码错误" },
        { status: 401 }
      );
    }

    // 3. 更新最后登录时间
    await admin
      .from("loop_designer_users")
      .update({ last_login_at: new Date().toISOString() })
      .eq("id", user.id);

    // 4. 创建 Session
    await createAppSession(normalizeUser(user));

    // 5. 记录审计日志
    await admin.from("loop_designer_audit_logs").insert({
      enterprise_id: user.enterprise_id,
      user_id: user.id,
      action: "user_login",
      resource_type: "user",
      resource_id: user.id,
      details: { auth_provider: "email", email },
      ip_address: request.headers.get("x-forwarded-for") || null,
      user_agent: request.headers.get("user-agent") || null,
    });

    // 6. 返回成功
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.display_name,
      },
      ...(user.enterprise_id ? { enterpriseId: user.enterprise_id } : {}),
    });
  } catch (error) {
    safeLogError("email-login", error);
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
