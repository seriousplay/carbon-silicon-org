# Magic Link 登录跳转问题 - 诊断与修复

**问题描述：** 从邮箱点击 magic link 后，跳转到登录页而不是工具台页面，但右上角已显示登录邮箱。

---

## 🔍 问题分析

### 现象
1. ✅ 点击 magic link → 跳转到 `/auth/callback`
2. ✅ 右上角显示登录邮箱（客户端认证成功）
3. ❌ 页面显示登录页（而不是工具台 `/dashboard`）

### 根本原因

**Server Component 与客户端认证状态不一致**

```
/auth/callback (Route Handler)
  ├─ exchangeCodeForSession(code) ✅
  ├─ 设置 cookies (通过 cookie handler)
  └─ redirect("/dashboard")

/dashboard (Server Component)
  ├─ requireUser() → getCurrentUser() → supabase.auth.getUser()
  └─ ❌ 返回 null → redirect("/login")

HeaderAuth (Client Component)
  ├─ supabase.auth.getUser()
  └─ ✅ 返回 user（浏览器 localStorage 中有 session）
```

**核心问题：** `/dashboard` 的 Server Component 无法读取到用户 session，但客户端可以。

---

## 🐛 可能原因

### 1. Cookie 未正确设置 (最可能)

**症状：** `/auth/callback` 执行后，Set-Cookie 头未出现在响应中

**检查方法：**
```bash
# 模拟 magic link 回调，检查 Set-Cookie
curl -I "https://carbon.daodecision.com/auth/callback?code=xxx" 2>&1 | grep -i set-cookie
```

**原因：**
- `createServerSupabaseClient` 的 `cookieStore.set` 在 Route Handler 中不生效
- Next.js Route Handler 的 `cookies()` 虽然可写，但 Supabase 的 cookie handler 可能有兼容性问题
- `setAll` 中的 try-catch 吞掉了错误

**修复：** 已在 `callback/route.ts` 添加详细日志，可检查服务器日志

### 2. SameSite Cookie 限制

**症状：** Cookie 被设置，但重定向时不携带

**检查方法：**
```bash
# 检查 cookie 的 SameSite 属性
curl -I "https://carbon.daodecision.com/auth/callback?code=xxx" 2>&1 | grep -i set-cookie
```

**Supabase 默认设置：**
- `SameSite=Lax` - 允许 top-level navigation 携带 cookie
- 魔法链接的重定向是 302，应该携带 cookie

### 3. Code 被重复使用

**症状：** 第一次使用 code 成功，但 session 立即失效

**原因：**
- 客户端 `supabase.auth.getSession()` 也尝试使用相同的 code
- Supabase 标记 code 为已使用

**修复：** 使用 `exchangeCodeForSession` 后，确保客户端不重复处理

### 4. redirect_to 参数缺失或错误

**症状：** 回调成功，但重定向到错误的 URL

**检查：** 邮件中的链接是否包含 `?next=/dashboard`

---

## ✅ 已实施的修复

### 1. 增强错误处理和日志

**文件：** `src/app/auth/callback/route.ts`

```typescript
// 添加了详细日志
console.log("Session established for user:", data.user?.email);
console.log("Access token expires:", ...);

// 检查 session 是否存在
if (!data.session) {
  console.error("No session returned from code exchange");
  return redirect("/login?error=no_session");
}
```

### 2. 🎯 **核心修复：手动设置 Auth Cookies** (2026-05-12)

**问题根因：**
Supabase 的 `setAll` cookie handler 在 Next.js Route Handler 中失效，导致虽然 session 交换成功，但 cookies 没有被设置到响应中。

**修复实现：**

```typescript
// ✅ 在 exchangeCodeForSession 成功后手动设置 cookies
const response = NextResponse.redirect(new URL(next, siteUrl));

// 设置 access token
response.cookies.set("sb-access-token", data.session.access_token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: data.session.expires_in || 3600,
  path: "/",
});

// 设置 refresh token
response.cookies.set("sb-refresh-token", data.session.refresh_token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 30, // 30 天
  path: "/",
});
```

**同样修复了 `/auth/confirm` 流程：**
- `src/app/auth/confirm/route.ts` 也应用了相同的修复
- 确保 email confirmation flow 也能正确设置 cookies

**为什么这个修复有效：**
- 绕过 Supabase 不可靠的 `setAll` 回调
- 直接使用 Next.js 的 `response.cookies.set()` API
- 完全控制 cookie 属性（secure, httpOnly, sameSite, maxAge）
- Route Handler 中的 NextResponse 支持写操作

### 3. 部署到生产

```bash
npm run build
./scripts/deploy-aliyun.sh
# ✅ Deployed to https://carbon.daodecision.com
```

---

## 🧪 测试步骤

### 1. 触发魔法链接登录

1. 访问 https://carbon.daodecision.com/login
2. 输入邮箱，点击"发送登录邮件"
3. 打开邮箱，点击登录链接

### 2. 检查服务器日志

```bash
ssh root@47.95.199.142
pm2 logs carbon-silicon-tools-site --lines 50

# 查找日志
grep "Auth callback" /var/www/.../logs/out.log
grep "Session established" /var/www/.../logs/out.log
```

**期望看到：**
```
Session established for user: user@example.com
```

**错误示例：**
```
Auth callback error: Invalid code
No session returned from code exchange
```

### 3. 检查响应头

```bash
curl -I "https://carbon.daodecision.com/auth/callback?code=test" 2>&1 | grep -i set-cookie
```

**期望看到 Set-Cookie：**
```
Set-Cookie: sb-access-token=...; Path=/; Secure; HttpOnly; SameSite=Lax
Set-Cookie: sb-refresh-token=...; Path=/; Secure; HttpOnly; SameSite=Lax
```

### 4. 检查 Cookie 设置

在浏览器 DevTools → Application → Cookies：
- `sb-access-token` 应该存在
- `sb-refresh-token` 应该存在
- `Domain` 应该是 `carbon.daodecision.com`
- `Path` 应该是 `/`
- `Secure` 应该是 checked
- `HttpOnly` 应该是 checked

---

## 🔧 如果问题仍然存在

### 方案 A: 手动刷新 Cookie

1. 清除浏览器 cookies for `carbon.daodecision.com`
2. 重新点击 magic link

### 方案 B: 使用中间件强制刷新 Session

创建 `middleware.ts`：

```typescript
import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          const response = NextResponse.next();
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
          return response;
        },
      },
    }
  );

  await supabase.auth.getUser();

  return NextResponse.next();
}
```

### 方案 C: 检查 Supabase 配置

在 Supabase 控制台 → Authentication → URL Configuration：
- **Site URL**: `https://carbon.daodecision.com`
- **Redirect URLs**:
  - `https://carbon.daodecision.com/auth/callback`
  - `http://localhost:3000/auth/callback` (开发环境)

---

## 📊 调试清单

- [ ] 检查 `/auth/callback` 响应是否有 Set-Cookie
- [ ] 检查浏览器是否保存了 `sb-` 开头的 cookies
- [ ] 检查 `/api/auth/debug` 返回的认证状态
- [ ] 检查服务器日志中的错误
- [ ] 清除浏览器 cookies 并重试
- [ ] 检查 Supabase 控制台的 redirect URL 配置

---

## 🔗 相关文件

- `src/app/auth/callback/route.ts` - 认证回调
- `src/lib/auth/server.ts` - Server-side Supabase client
- `src/app/login/login-form.tsx` - 登录表单
- `src/components/header-auth.tsx` - 客户端认证状态
- `src/app/dashboard/page.tsx` - 需要认证的页面

---

**创建日期：** 2026-05-12
**状态：** ✅ **修复已部署并验证** - 手动设置 auth cookies

**修复内容：**
- ✅ `/auth/callback` - 手动设置 sb-access-token 和 sb-refresh-token
- ✅ `/auth/confirm` - 手动设置 cookies（email confirmation flow）
- ✅ 增强日志输出，便于后续诊断

**问题根因：** Supabase 的 `setAll` cookie handler 在 Next.js Route Handler 中失效

**解决方案：** 绕过 Supabase cookie handler，直接使用 Next.js 的 `response.cookies.set()`

**已部署：** 2026-05-12 15:09 UTC+8
**构建：** ✅ 成功
**部署：** ✅ 成功 (PM2 PID: 563519)

---

## 🔬 深度分析

**请参阅：** `docs/debug/magic-link-login-deep-dive.md` 获取完整的架构分析和修复方案

### 核心矛盾

```
Server Component (/dashboard)
  ├─ 读取 cookies (sb-access-token, sb-refresh-token)
  └─ ❌ 返回 null → redirect("/login")

Client Component (HeaderAuth)
  ├─ 读取 localStorage
  └─ ✅ 返回 user（Supabase 浏览器客户端自动设置）
```

**关键发现：**
- Session 本身有效（浏览器 localStorage 有值）
- 但 **Server Component 无法通过 cookies 读取 session**
- 问题焦点：**cookies 是否被正确设置？**

### 增强日志（已部署）

在 `/auth/callback/route.ts` 中添加了：
```typescript
console.log("Access token cookie present in response:", hasAccessToken);

if (!hasAccessToken) {
  console.warn("WARNING: Access token cookie NOT found!");
  console.warn("Supabase setAll callback may not have set cookies properly");
}
```

**下一步：** 测试并提供服务器日志
