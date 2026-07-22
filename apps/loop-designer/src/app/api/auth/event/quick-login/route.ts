import { NextResponse } from "next/server";
import { quickLoginWithEventPhone } from "@/lib/event-auth";
import { checkRateLimit, getClientIP, rateLimitHeaders } from "@/lib/rate-limit";
import { safeLogError } from "@/lib/api-error";
import { publicUrl } from "@/lib/public-url";

const EVENT_LOGIN_RATE_LIMIT = { maxRequests: 20, windowSeconds: 600 };

export async function POST(request: Request) {
  const isFormPost = request.headers.get("content-type")?.includes("application/x-www-form-urlencoded")
    || request.headers.get("content-type")?.includes("multipart/form-data");
  const next = getSafeNextUrl(new URL(request.url).searchParams.get("next"));
  const ip = getClientIP(request);
  const limit = checkRateLimit(`event-login:${ip}`, EVENT_LOGIN_RATE_LIMIT);
  if (!limit.allowed) {
    if (isFormPost) {
      return redirectToLogin(next, "请求过于频繁，请稍后再试");
    }
    return NextResponse.json(
      { error: "请求过于频繁，请稍后再试" },
      {
        status: 429,
        headers: rateLimitHeaders(
          EVENT_LOGIN_RATE_LIMIT.maxRequests,
          EVENT_LOGIN_RATE_LIMIT.windowSeconds,
          0,
          Date.now() + limit.retryAfter * 1000,
        ),
      },
    );
  }

  try {
    const body = isFormPost ? Object.fromEntries(await request.formData()) : await request.json();
    const password = body.password ? String(body.password) : undefined;
    const passwordConfirm = body.passwordConfirm ? String(body.passwordConfirm) : undefined;
    if (passwordConfirm !== undefined && password !== passwordConfirm) {
      throw new Error("两次输入的密码不一致");
    }
    const result = await quickLoginWithEventPhone({
      phone: String(body.phone || body.contact || ""),
      password,
      displayName: body.displayName ? String(body.displayName) : undefined,
      companyName: body.companyName ? String(body.companyName) : undefined,
      contact: body.contact ? String(body.contact) : undefined,
      ipAddress: ip,
      userAgent: request.headers.get("user-agent"),
    });

    if (isFormPost) {
      return NextResponse.redirect(publicUrl(next), 303);
    }

    return NextResponse.json({
      success: true,
      user: {
        id: result.user.id,
        displayName: result.user.display_name,
        email: result.user.email,
      },
      enterpriseId: result.enterpriseId,
      reused: result.reused,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "手机号登录失败";
    const status = message.includes("无效") || message.includes("填写")
      ? 400
      : message.includes("未启用") || message.includes("未配置") || message.includes("已结束")
        ? 403
        : 500;
    if (status >= 500) safeLogError("event-quick-login", error);
    if (isFormPost) {
      return redirectToLogin(next, status >= 500 ? "手机号登录失败，请稍后重试" : message);
    }
    return NextResponse.json({ error: status >= 500 ? "手机号登录失败，请稍后重试" : message }, { status });
  }
}

function getSafeNextUrl(value: string | null) {
  if (!value) return "/loop-designer";
  if (value === "/loop-designer" || value.startsWith("/loop-designer/")) return value;
  if (value.startsWith("/") && !value.startsWith("//")) {
    return `/loop-designer${value === "/" ? "" : value}`;
  }
  return "/loop-designer";
}

function redirectToLogin(next: string, message: string) {
  return NextResponse.redirect(
    publicUrl(`/loop-designer/auth/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent(message)}`),
    303,
  );
}
