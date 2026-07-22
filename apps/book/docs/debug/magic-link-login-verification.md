# Magic Link 登录修复 - 验证测试指南

**修复版本：** 2026-05-12 15:09 UTC+8
**状态：** ✅ 已部署到生产环境
**修复内容：** 手动设置 auth cookies（绕过 Supabase cookie handler）

---

## 🎯 修复概述

### 问题
从邮箱点击 magic link 后，虽然右上角显示已登录（客户端 auth 成功），但页面跳转到登录页而不是工具台。

### 根因
Supabase 的 `setAll` cookie handler 在 Next.js Route Handler 中失效，导致 cookies 没有被设置到响应中。

### 解决方案
绕过 Supabase 的 cookie handler，直接使用 Next.js 的 `response.cookies.set()` API 手动设置：
- `sb-access-token`
- `sb-refresh-token`

### 修复文件
1. `src/app/auth/callback/route.ts` - magic link callback flow
2. `src/app/auth/confirm/route.ts` - email confirmation flow

---

## ✅ 验证步骤

### 1. 清除浏览器数据（重要）

**在开始测试前，清除旧 cookies：**

1. 打开浏览器 DevTools → Application → Cookies
2. 找到 `carbon.daodecision.com`
3. 删除所有 `sb-` 开头的 cookies（如果存在）
4. 或者使用无痕/隐私模式测试

### 2. 执行登录流程

1. 访问 https://carbon.daodecision.com/login
2. 输入你的邮箱地址
3. 点击"发送登录邮件"
4. 打开邮箱，点击 magic link

### 3. 验证结果

#### ✅ 预期成功行为

**立即行为：**
- [ ] 点击 magic link 后跳转到 `/dashboard`（而不是 `/login`）
- [ ] 页面显示"我的工作台"
- [ ] 右上角显示你的邮箱地址

**浏览器 DevTools → Application → Cookies：**
应该看到以下 cookies：
```
Name: sb-access-token
Value: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Domain: carbon.daodecision.com
Path: /
HttpOnly: ✓
Secure: ✓
SameSite: Lax

Name: sb-refresh-token
Value: ...
Domain: carbon.daodecision.com
Path: /
HttpOnly: ✓
Secure: ✓
SameSite: Lax
```

**服务器日志（可选检查）：**
```bash
ssh root@47.95.199.142
tail -f /root/.pm2/logs/carbon-silicon-tools-site-out.log
```

应该看到：
```
Session established for user: your-email@example.com
Access token expires: 2026-05-19T...
Auth cookies manually set on redirect response
```

#### ❌ 如果失败

**症状：仍然跳转到 `/login`**

1. 检查浏览器是否有 `sb-access-token` cookie
   - 如果没有 → cookies 没有被设置
   - 如果有 → Server Component 仍然无法读取

2. 检查服务器日志：
```bash
grep "Session established" /root/.pm2/logs/carbon-silicon-tools-site-out.log
grep "Auth cookies" /root/.pm2/logs/carbon-silicon-tools-site-out.log
```

3. 清除浏览器 cookies 并重试

---

## 🔍 技术细节

### Cookie 设置

```typescript
response.cookies.set("sb-access-token", data.session.access_token, {
  httpOnly: true,           // 防止 XSS 攻击
  secure: process.env.NODE_ENV === "production", // 仅 HTTPS
  sameSite: "lax",          // 允许 top-level navigation 携带
  maxAge: data.session.expires_in || 3600,  // 1 小时
  path: "/",                // 全站有效
});

response.cookies.set("sb-refresh-token", data.session.refresh_token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 30, // 30 天
  path: "/",
});
```

### Cookie 读取

**Server Component (`/dashboard`)：**
```typescript
const supabase = await createServerSupabaseClient();
const { data: { user } } = await supabase.auth.getUser();
// 从 cookies 读取 sb-access-token → Supabase 验证 → 返回 user
```

**Client Component (`HeaderAuth`)：**
```typescript
const { data: { user } } = await supabase.auth.getUser();
// 从 localStorage 读取 session → 返回 user
```

---

## 📊 测试清单

### 功能测试

- [ ] Magic link 登录成功
- [ ] 跳转到 `/dashboard`（不是 `/login`）
- [ ] 右上角显示登录邮箱
- [ ] 页面显示工作台数据
- [ ] Cookies 正确设置（`sb-access-token`, `sb-refresh-token`）
- [ ] 刷新页面后仍然保持登录
- [ ] 退出登录功能正常
- [ ] 重新登录正常

### 兼容性测试

- [ ] Chrome/Edge（Chromium）
- [ ] Firefox
- [ ] Safari（如果可用）
- [ ] 移动端 Safari（iOS）
- [ ] 移动端 Chrome（Android）

### 安全测试

- [ ] HttpOnly 标志设置 ✓
- [ ] Secure 标志设置（生产环境） ✓
- [ ] SameSite=Lax 设置 ✓
- [ ] Path=/ 设置 ✓

---

## 🚨 如果测试失败

### 情况 1：跳转到 `/login`，但没有 cookies

**原因：** cookies 没有被设置

**检查：**
```bash
# 1. 检查响应是否有 Set-Cookie
curl -I "https://carbon.daodecision.com/auth/callback?code=test" 2>&1 | grep set-cookie

# 2. 检查服务器日志
grep "Session established" /root/.pm2/logs/carbon-silicon-tools-site-out.log
grep "Auth cookies" /root/.pm2/logs/carbon-silicon-tools-site-out.log
```

**可能原因：**
- `exchangeCodeForSession` 失败 → 检查错误日志
- `data.session` 为空 → code 已使用或过期
- response.cookies.set() 失败 → Next.js 版本问题

### 情况 2：有 cookies，但仍然跳转到 `/login`

**原因：** Server Component 无法验证 cookies

**检查：**
1. 确认 cookie 的 Domain 和 Path 正确
2. 确认 cookie 没有被浏览器阻止（隐私模式、插件）
3. 检查 `createServerSupabaseClient()` 是否能正确读取 cookies

### 情况 3：部分成功（第一次成功，刷新后失败）

**原因：** cookie maxAge 或持久化问题

**检查：**
- Access token cookie 的 Max-Age
- 浏览器是否持久化保存 cookies

---

## 📝 服务器日志检查

```bash
# 实时查看日志
ssh root@47.95.199.142
tail -f /root/.pm2/logs/carbon-silicon-tools-site-out.log

# 查看最近的认证日志
grep -E "(Session established|Auth cookies|callback error)" /root/.pm2/logs/carbon-silicon-tools-site-out.log | tail -20

# 查看错误日志
tail -50 /root/.pm2/logs/carbon-silicon-tools-site-error.log
```

### 期望的日志输出

```
Session established for user: user@example.com
Access token expires: 2026-05-19T12:00:00.000Z
Auth cookies manually set on redirect response
```

### 错误日志示例

```
Auth callback error: Invalid code
No session returned from code exchange
Exception during session exchange: ...
```

---

## 🎉 验证通过标准

当以下所有条件满足时，修复验证通过：

1. ✅ 点击 magic link → 跳转到 `/dashboard`
2. ✅ 右上角显示登录邮箱
3. ✅ 浏览器有 `sb-access-token` 和 `sb-refresh-token` cookies
4. ✅ 刷新页面后保持登录
5. ✅ 服务器日志显示 "Auth cookies manually set on redirect response"

---

## 📞 问题报告

如果测试失败，请提供：
1. 浏览器 console 日志（F12 → Console）
2. 浏览器 cookies（DevTools → Application → Cookies）
3. 服务器日志（PM2 out.log 和 error.log）
4. Network 面板中 `/auth/callback` 的响应头（特别是 Set-Cookie）

---

**创建日期：** 2026-05-12
**最后更新：** 2026-05-12 15:15 UTC+8
**状态：** 等待用户测试验证
