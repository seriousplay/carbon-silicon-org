# Magic Link 登录问题 - 深度分析与修复计划

**日期：** 2026-05-12
**状态：** 增强日志已部署，等待测试结果

---

## 🔍 问题现象

1. ✅ 点击 magic link → 跳转到 `/auth/callback`
2. ✅ 右上角显示登录邮箱（客户端认证成功）
3. ❌ 页面显示登录页（而不是工具台 `/dashboard`）
4. 🔍 根本原因：Server Component `/dashboard` 无法读取用户 session

---

## 🏗️ 架构分析

### 认证流程

```
用户点击 magic link
    ↓
GET /auth/callback?code=XXX
    ↓
Route Handler: supabase.auth.exchangeCodeForSession(code)
    ├─ Supabase API: 交换 code → session
    ├─ Supabase cookie handler: setAll([access_token, refresh_token])
    └─ redirect("/dashboard")
    ↓
GET /dashboard (Server Component)
    ↓
requireUser() → supabase.auth.getUser()
    ├─ 读取 cookies (sb-access-token, sb-refresh-token)
    └─ ❌ 返回 null → redirect("/login")
    ↓
显示登录页
    ↓
Client Component: HeaderAuth
    ↓
supabase.auth.getUser()  // 从 localStorage 读取
    └─ ✅ 返回 user（客户端工作正常）
```

### 核心矛盾

**Server Component** 通过 **cookies** 读取 session → ❌ 失败
**Client Component** 通过 **localStorage** 读取 session → ✅ 成功

这说明：
1. ✅ Supabase 成功交换了 code → session
2. ❓ 浏览器 localStorage 中有 session（由 Supabase 浏览器客户端自动设置）
3. ❓ **cookies 可能没有被正确设置或发送**

---

## 🔬 增强日志诊断

### 已部署的日志点

在 `src/app/auth/callback/route.ts` 中添加了以下日志：

```typescript
console.log("Session established for user:", data.user?.email);
console.log("Access token expires:", new Date(...));
console.log("Access token cookie present in response:", hasAccessToken);

if (!hasAccessToken) {
  console.warn("WARNING: Access token cookie NOT found!");
  console.warn("Supabase setAll callback may not have set cookies properly");
}
```

### 如何收集日志

```bash
# SSH 到服务器
ssh root@47.95.199.142

# 查看最近的日志
pm2 logs carbon-silicon-tools-site --lines 100

# 或查看日志文件
tail -100 /root/.pm2/logs/carbon-silicon-tools-site-out.log

# 搜索关键日志
grep "Session established" /root/.pm2/logs/carbon-silicon-tools-site-out.log
grep "Access token cookie" /root/.pm2/logs/carbon-silicon-tools-site-out.log
grep "WARNING" /root/.pm2/logs/carbon-silicon-tools-site-out.log
```

### 预期日志输出

**情况 A：cookies 设置成功**
```
Session established for user: user@example.com
Access token expires: 2026-05-19T12:00:00.000Z
Access token cookie present in response: true
SUCCESS: Auth cookies are properly set
```

**情况 B：cookies 设置失败**
```
Session established for user: user@example.com
Access token expires: 2026-05-19T12:00:00.000Z
Access token cookie present in response: false
WARNING: Access token cookie NOT found!
WARNING: Supabase setAll callback may not have set cookies properly...
```

---

## 🐛 可能的原因分析

### 假设 1：Supabase Cookie Handler 在 Route Handler 中失效 (最可能) ⭐

**现象：**
- `exchangeCodeForSession()` 成功，返回 session
- 但 `setAll` 回调没有实际设置 cookies
- `cookies()` 检查不到 cookies

**原因：**
- `createServerSupabaseClient()` 设计用于 **Server Components**
- Server Components 中的 `cookies()` 返回 **只读** cookie store
- Route Handler 虽然可以写 cookies，但 Supabase 的 `setAll` 回调可能无法正确写入

**证据：**
- `src/lib/auth/server.ts` 注释："Server Components cannot set cookies. Middleware and route handlers refresh sessions."
- `setAll` 中的 try-catch 吞掉了所有错误
- HeaderAuth（客户端）能工作 → session 本身有效

**修复方案：**
在 Route Handler 中**手动设置 cookies**，而不是依赖 Supabase 的 `setAll` 回调。

---

### 假设 2：Cookie Domain/Path 不匹配

**现象：**
- Set-Cookie 头出现在响应中
- 但浏览器没有保存 cookie

**检查方法：**
```bash
# 手动触发 callback 并检查响应
curl -I "https://carbon.daodecision.com/auth/callback?code=test" 2>&1 | grep -i set-cookie
```

**可能原因：**
- Cookie domain 设置为 `localhost` 而不是 `carbon.daodecision.com`
- Cookie path 不是 `/`
- SameSite 设置阻止了重定向时携带

---

### 假设 3：Nginx 剥离 Set-Cookie 头

**现象：**
- Next.js 发送 Set-Cookie
- 但浏览器收不到

**检查方法：**
```bash
# 检查 nginx 配置是否有 proxy_set_header 问题
grep -A5 "location /auth" /etc/nginx/conf.d/carbon-silicon-tools-site.conf
```

**当前配置：**
```nginx
proxy_set_header Host $host;
proxy_set_header X-Real-IP $remote_addr;
# ... 没有特殊处理 cookies
```

Nginx 默认会转发 Set-Cookie，所以这个可能性较低。

---

### 假设 4：Next.js 15+ Cookie API 变化

**现象：**
- Next.js 15+ 的 `cookies()` API 在 Route Handler 和 Server Component 中行为不同
- Server Component: 只读
- Route Handler: 可读写

**检查点：**
- 确保 `createServerSupabaseClient()` 在 Route Handler 中返回的 cookie handler 是可写的
- Next.js 16.2.6 的 `cookies()` 返回 `ReadonlyRequestCookies` (Server Component) 或 `MutableRequestCookies` (Route Handler)

---

## 🛠️ 修复方案

### 方案 A：手动设置 Cookies (推荐，立即可实施)

**原理：**
绕过 Supabase 的 `setAll` 回调，直接从 `exchangeCodeForSession` 返回的 session 中提取 token，并手动设置到 response cookies。

**实现：**

```typescript
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, "");
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      try {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);

        if (error || !data.session) {
          // 错误处理...
          return NextResponse.redirect(new URL("/login?error=...", siteUrl));
        }

        // ✅ 手动设置 cookies
        const response = NextResponse.redirect(new URL(next, siteUrl));

        // 设置 access token
        response.cookies.set("sb-access-token", data.session.access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: data.session.expires_in,
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

        return response;
      } catch (err) {
        // 错误处理...
      }
    }
  }

  return NextResponse.redirect(new URL(next, siteUrl));
}
```

**优点：**
- ✅ 完全控制 cookies 设置过程
- ✅ 不依赖 Supabase cookie handler
- ✅ 明确的错误处理
- ✅ 可自定义 cookie 选项（domain, path, maxAge 等）

**缺点：**
- ⚠️ 需要手动保持与 Supabase 客户端的一致
- ⚠️ 如果 Supabase 改变 cookie 格式，需要手动更新

---

### 方案 B：使用 Middleware 刷新 Session (长期方案)

**原理：**
在 Middleware 中刷新 session，确保每个请求都能正确读取 cookies。

**实现：**

```typescript
// middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
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

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

**优点：**
- ✅ 统一处理所有请求的认证
- ✅ 确保 cookies 在每个请求中被正确刷新
- ✅ 不修改现有 Route Handler

**缺点：**
- ⚠️ 每个请求都会调用 `supabase.auth.getUser()`（增加 overhead）
- ⚠️ Middleware 运行在每个请求上，可能影响性能

---

### 方案 C：等待 Supabase 修复 (不推荐)

在 GitHub 上提交 issue 给 `@supabase/ssr`，等待官方修复。

**优点：** 不需要修改代码
**缺点：** 不确定修复时间，影响用户体验

---

## 🧪 测试步骤

### 1. 部署增强日志（已完成）

```bash
✓ Deployed to https://carbon.daodecision.com
```

### 2. 触发 Magic Link 登录

1. 访问 https://carbon.daodecision.com/login
2. 输入邮箱，点击"发送登录邮件"
3. 打开邮箱，点击登录链接

### 3. 收集服务器日志

```bash
ssh root@47.95.199.142
pm2 logs carbon-silicon-tools-site --lines 50
```

**查找这些关键日志：**
- `Session established for user:`
- `Access token cookie present in response:`
- `WARNING: Access token cookie NOT found!`

### 4. 检查浏览器行为

- [ ] 右上角是否显示邮箱 → 客户端认证
- [ ] 是否跳转到 `/dashboard` → 预期行为
- [ ] 是否跳转到 `/login` → 问题复现

### 5. 检查 Set-Cookie 响应头

```bash
curl -I "https://carbon.daodecision.com/auth/callback?code=test_code" 2>&1 | grep -i set-cookie
```

**期望看到：**
```
Set-Cookie: sb-access-token=...; Path=/; Secure; HttpOnly; SameSite=Lax
Set-Cookie: sb-refresh-token=...; Path=/; Secure; HttpOnly; SameSite=Lax
```

---

## 📊 诊断决策树

```
1. 检查日志: "Access token cookie present in response:"
   │
   ├─ true  → Cookies 被设置了
   │         ↓
   │        检查浏览器是否收到 Set-Cookie
   │         ↓
   │        ├─ 浏览器收到 → 检查浏览器是否发送到 /dashboard
   │        │              ↓
   │        │             ├─ 发送了 → /dashboard 读取失败 → 检查 cookies() API
   │        │             └─ 没发送 → SameSite/Domain 问题
   │        │
   │        └─ 浏览器没收到 → Nginx 剥离 / Next.js 响应问题
   │
   └─ false → Cookies 根本没被设置
             ↓
            Supabase setAll 回调失效
             ↓
            实施方案 A：手动设置 cookies
```

---

## 🚀 下一步行动

### 立即行动（等待用户测试）

1. **用户测试 magic link 登录**
2. **提供服务器日志**（关键日志）
3. **确认问题是否复现**

### 根据日志结果

#### 如果日志显示 `hasAccessToken: false`

**立即实施方案 A：** 手动设置 cookies

```bash
# 编辑文件
vim src/app/auth/callback/route.ts

# 重建并部署
npm run build && ./scripts/deploy-aliyun.sh
```

#### 如果日志显示 `hasAccessToken: true`

**检查浏览器：**
```bash
# 检查响应是否包含 Set-Cookie
curl -I "https://carbon.daodecision.com/auth/callback?code=..." 2>&1 | grep set-cookie

# 如果响应有 Set-Cookie，但浏览器不发送：
# → SameSite/Domain/Path cookie 配置问题
# → Nginx proxy 配置问题
```

**实施方案 B：** 添加 Middleware

---

## 📋 检查清单

- [x] 部署增强日志
- [ ] 用户测试并收集日志
- [ ] 分析日志确定根因
- [ ] 实施对应修复方案
- [ ] 验证修复效果
- [ ] 同步修复 `/auth/confirm` 和 `/auth/signout`（如果适用）

---

## 🔗 相关文件

- `src/app/auth/callback/route.ts` - 增强日志 + 待修复
- `src/lib/auth/server.ts` - Supabase server client 工厂
- `src/app/dashboard/page.tsx` - Server Component 读取 session
- `src/components/header-auth.tsx` - Client Component 读取 localStorage
- `docs/debug/magic-link-login-issue.md` - 初始诊断文档

---

**创建日期：** 2026-05-12
**状态：** 等待用户测试结果
