import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getAdminClient } from "@/lib/supabase";
import { createAppSession, normalizeUser } from "@/lib/app-session";
import { checkRateLimit, getClientIP, rateLimitHeaders } from "@/lib/rate-limit";
import { safeLogError } from "@/lib/api-error";

const LOGIN_RATE_LIMIT = { maxRequests: 5, windowSeconds: 60 };

/**
 * POST /api/auth/email/login
 * Email + password login
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

    // 1. Find user (only email auth method)
    const user = await admin.loopDesignerUser.findFirst({
      where: {
        email,
        authProvider: "email",
        status: "active",
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: "邮箱或密码错误" },
        { status: 401 }
      );
    }

    // 2. Verify password
    const passwordHash = user.passwordHash;
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

    // 3. Update last login time
    await admin.loopDesignerUser.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // 4. Create session
    await createAppSession(normalizeUser(user));

    // 5. Record audit log
    await admin.loopDesignerAuditLog.create({
      data: {
        enterpriseId: user.enterpriseId ?? "",
        userId: user.id,
        action: "user_login",
        resourceType: "user",
        resourceId: user.id,
        details: { auth_provider: "email", email },
        ipAddress: request.headers.get("x-forwarded-for") || null,
        userAgent: request.headers.get("user-agent") || null,
      },
    });

    // 6. Return success
    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      },
      ...(user.enterpriseId ? { enterpriseId: user.enterpriseId } : {}),
    });
  } catch (error) {
    safeLogError("email-login", error);
    return NextResponse.json(
      { error: "登录失败，请稍后重试" },
      { status: 500 }
    );
  }
}
