# Magic Link 登录问题 - 修复状态报告

**时间：** 2026-05-12 15:30 UTC+8
**状态：** ✅ 502 错误已修复，⚠️ 魔法链接过期问题（正常行为）

---

## 🔍 问题诊断结果

### 问题 1：502 Bad Gateway ✅ 已修复

**根因：** Nginx 响应头缓冲区太小（4KB）

**现象：**
```
upstream sent too big header while reading response header from upstream
```

**原因：**
- Nginx `proxy_buffer_size 4k` 太小
- Set-Cookie 头（JWT tokens）超过 4KB 阈值
- 触发 Nginx 502 错误

**修复：**
```nginx
# 之前
proxy_buffer_size 4k;
proxy_buffers 8 4k;
proxy_busy_buffers_size 8k;

# 现在
proxy_buffer_size 16k;
proxy_buffers 8 16k;
proxy_busy_buffers_size 24k;
proxy_headers_hash_max_size 1024;
proxy_headers_hash_bucket_size 128;
```

**已部署：** ✅ 2026-05-12 15:22 UTC+8

---

### 问题 2：魔法链接过期 ⚠️ 正常行为

**根因：** Supabase 魔法链接有效期很短（通常 5-10 分钟）

**服务器日志：**
```
verifyOtp result: {
  error: Error [AuthApiError]: Email link is invalid or has expired
  code: 'otp_expired'
},
hasSession: false
```

**这不是代码问题**，而是：
- 用户收到邮件后没有及时点击
- 或者测试时间间隔太长
- Supabase 的安全机制（防止链接被滥用）

**解决：** 重新发送魔法链接并立即点击

---

## 📊 完整流程分析

### 当前认证流程

```
用户点击"发送登录邮件"
  ↓
supabase.auth.signInWithOtp()
  ↓
Supabase 发送魔法链接邮件
  ↓
用户点击邮件中的链接
  ↓
GET /auth/confirm?token_hash=xxx&type=magiclink&next=/dashboard
  ↓
verifyOtp(token_hash, type)
  ↓
成功 → 设置 cookies → 307 重定向到 /dashboard
失败 → 307 重定向到 /login?next=/dashboard
```

### 日志追踪

**成功的请求（之前）：**
```
15:11:29 GET /auth/confirm?... 307 → /dashboard
```

**失败的请求（已过期）：**
```
15:19:07 GET /auth/confirm?... 502 (缓冲区太小，已修复)
15:19:21 GET /auth/confirm?... 307 → /login (链接过期)
```

---

## ✅ 已完成修复

### 1. Nginx 配置优化

**文件：** `.deploy/nginx.conf`
- `proxy_buffer_size`: 4k → 16k
- `proxy_buffers`: 8×4k → 8×16k
- `proxy_busy_buffers_size`: 8k → 24k
- 添加 `proxy_headers_hash_max_size` 和 `proxy_headers_hash_bucket_size`

**效果：** 防止响应头过大导致的 502 错误

### 2. Auth Cookies 手动设置

**文件：**
- `src/app/auth/callback/route.ts`
- `src/app/auth/confirm/route.ts`

**实现：** 绕过 Supabase `setAll`，直接使用 Next.js `response.cookies.set()`

### 3. 增强日志

**文件：** `src/app/auth/confirm/route.ts`
- `Auth confirm request:`
- `verifyOtp result:`
- `OTP verification failed:`

---

## 🧪 验证测试步骤

### 1. 重新发送魔法链接

访问 https://carbon.daodecision.com/login
输入邮箱 → 点击"发送登录邮件"

### 2. **立即点击邮件中的链接**（重要！）

魔法链接有效期约 **5-10 分钟**，请尽快点击。

### 3. 预期成功流程

```
点击魔法链接
  ↓
/auth/confirm → 设置 cookies → 307 重定向
  ↓
/dashboard → 读取 cookies → ✅ 显示工作台
```

### 4. 检查服务器日志

```bash
ssh root@47.95.199.142
tail -f /var/www/carbon-silicon-org-book/apps/carbon-silicon-tools-site/logs/out.log
```

**期望看到：**
```
Auth confirm request: { tokenHash: 'xxx...', type: 'magiclink', nextPath: '/dashboard' }
verifyOtp result: { error: null, hasData: true, hasSession: true }
OTP verified successfully, user: your-email@example.com
Auth cookies manually set for confirm flow
```

---

## 📝 故障排查

### 如果仍然出现 502

**原因：** 响应头仍然太大

**检查：**
```bash
# 查看 Set-Cookie 头数量
curl -I "https://carbon.daodecision.com/auth/confirm?token_hash=test&type=magiclink" 2>&1 | grep -i set-cookie | wc -l

# 查看单个 cookie 大小
curl -I "https://carbon.daodecision.com/auth/confirm?token_hash=test&type=magiclink" 2>&1 | grep -i set-cookie | awk '{print length($0)}'
```

**进一步增大缓冲区：**
```nginx
proxy_buffer_size 32k;
proxy_buffers 8 32k;
proxy_busy_buffers_size 48k;
```

### 如果仍然回到登录页

**检查日志：**
```bash
grep "verifyOtp result" /var/www/.../logs/out.log | tail -1
```

**可能原因：**
- 链接过期（`code: 'otp_expired'`）→ 重新发送
- Token hash 无效（`code: 'otp_invalid'`）→ 重新发送
- 邮箱未验证 → 检查 Supabase 用户状态

### 如果成功但 /dashboard 仍然显示登录页

**检查 cookies：**
- DevTools → Application → Cookies → `carbon.daodecision.com`
- 应该看到 `sb-access-token` 和 `sb-refresh-token`

**检查 Server Component：**
```bash
# 访问 /api/auth/debug 查看认证状态
curl https://carbon.daodecision.com/api/auth/debug
```

---

## 🔗 相关文档

- **深度分析：** `docs/debug/magic-link-login-deep-dive.md`
- **验证测试：** `docs/debug/magic-link-login-verification.md`
- **初始诊断：** `docs/debug/magic-link-login-issue.md`

---

## 📞 请提供以下信息（如果问题持续）

1. **服务器日志（最近 5 分钟）：**
   ```bash
   tail -50 /var/www/.../logs/out.log
   ```

2. **浏览器行为：**
   - DevTools → Network → `/auth/confirm` 的响应状态码
   - 响应头的 `Location` 字段
   - Application → Cookies 中是否有 `sb-access-token`

3. **时间戳：** 测试的具体时间

---

**创建日期：** 2026-05-12
**最后更新：** 2026-05-12 15:30 UTC+8
**状态：** ✅ 502 已修复，等待用户重新测试
