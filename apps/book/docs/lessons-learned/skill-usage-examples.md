# 技能使用示例

本文档展示如何使用 `nextjs-performance-optimization` 技能解决实际问题。

---

## 示例 1：API 响应很慢

### 用户问题
> "我的 API 接口每次都要 2-3 秒，怎么优化？"

### 应用技能

**步骤 1：查看性能分析章节**

```bash
# 按 SKILL.md 指引测量基线
curl -w "\nTTFB: %{time_starttransfer}s\n" -o /dev/null -s https://your-site.com/api/endpoint
```

**步骤 2：识别瓶颈**

根据 `performance-analysis.md` 的诊断流程：
- 检查是否有缓存 → 无
- 检查数据库查询 → 4 个顺序查询，每个 400-900ms
- 检查 PM2 模式 → cluster 模式

**步骤 3：实施优化**

根据 `caching-strategies.md`：
```typescript
// 1. 添加 TTL 缓存
const cache = new NamespacedCache<Data>('api', { ttl: 60_000, maxSize: 100 });

// 2. 并行查询
const [data1, data2, data3, data4] = await Promise.all([
  fetch1(),
  fetch2(),
  fetch3(),
  fetch4(),
]);

// 3. 切换 PM2 为 fork 模式
// ecosystem.config.cjs
{ exec_mode: "fork", instances: 1 }
```

**结果：** 2s → 0.05s（40x 加速）

---

## 示例 2：502 Bad Gateway

### 用户问题
> "点击登录链接出现 502 错误"

### 应用技能

**步骤 1：查看故障排查手册**

打开 `troubleshooting.md` → 搜索 "502"

**步骤 2：诊断**

```bash
# 按手册指示检查 error.log
tail -f /var/log/nginx/error.log | grep 502
# 输出：upstream sent too big header

# 检查响应头大小
curl -sI https://site.com/auth/confirm | wc -c
# 输出：8KB（超过默认 4k 缓冲区）
```

**步骤 3：修复**

根据 `nginx-optimization.md` → 缓冲区配置：

```nginx
location / {
    proxy_buffer_size 16k;      # 4k → 16k
    proxy_buffers 8 16k;        # 8×4k → 8×16k
    proxy_busy_buffers_size 24k; # 8k → 24k
}
```

**结果：** 502 消失

---

## 示例 3：登录后跳回登录页

### 用户问题
> "点击魔法链接后，虽然右上角显示了邮箱，但页面还是登录页"

### 应用技能

**步骤 1：查看 Supabase Auth 调试**

打开 `supabase-auth-debugging.md` → "Server vs Client Session 不一致"

**步骤 2：诊断**

按手册中的诊断流程：
1. ✅ Client Component 能读取 localStorage
2. ❌ Server Component 读取 cookies 返回 null
3. ❌ curl -I 响应无 Set-Cookie
4. **结论：** Route Handler 未设置 cookies

**步骤 3：修复**

根据 `supabase-auth-debugging.md` 的完整修复代码：

```typescript
// /auth/confirm/route.ts
const { data } = await supabase.auth.verifyOtp({ token_hash, type });

if (data?.session) {
  const response = NextResponse.redirect(new URL(nextPath, url));

  // ✅ 手动设置 cookies
  response.cookies.set("sb-access-token", data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: data.session.expires_in,
    path: "/",
  });

  return response;
}
```

**结果：** 登录成功，跳转到 /dashboard

---

## 示例 4：实现了缓存但没效果

### 用户问题
> "我加了缓存，但每次请求还是 2s"

### 应用技能

**步骤 1：查看缓存策略**

打开 `caching-strategies.md` → "缓存覆盖率优化"

**步骤 2：诊断**

```bash
# 检查缓存日志
grep "CACHE" /var/www/app/logs/out.log
# 输出：全部是 [CACHE MISS]，没有 HIT

# 检查 PM2 模式
pm2 show app | grep "exec mode"
# 输出：cluster_mode → 问题所在！
```

**问题根因：** Cluster 模式 → 每个 worker 有独立内存 → 缓存碎片化

**步骤 3：修复**

根据 `caching-strategies.md` → PM2 模式决策树：

**方案 A：** 切换到 Fork 模式（< 100 QPS）
```javascript
// ecosystem.config.cjs
{ exec_mode: "fork", instances: 1 }
```

**方案 B：** 使用 Redis（> 1000 QPS）
```typescript
const redis = new Redis(process.env.REDIS_URL);
await redis.setex(key, ttl, JSON.stringify(data));
```

**结果：** 缓存命中率 0% → 95%+，响应时间 2s → 0.05s

---

## 示例 5：Nginx 静态资源 404

### 用户问题
> "JS 和 CSS 文件全部 404，但文件明明存在"

### 应用技能

**步骤 1：查看 Nginx 优化**

打开 `nginx-optimization.md` → "Location 匹配规则"

**步骤 2：诊断**

```nginx
# 当前配置
location ~* \.(js|css|png|jpg)$ { ... }  # Regex 在前
location /_next/static/ { ... }           # Prefix 在后
```

**问题：** Regex 匹配所有 `.js` 文件，Prefix 永远不会命中

**步骤 3：修复**

根据 `nginx-optimization.md` → "最佳实践"：

```nginx
# Prefix 在前
location /_next/static/ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    alias /path/to/.next/static/;
}

# Regex 在后，且不含 .js/.css
location ~* \.(png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}
```

**结果：** 所有静态资源 404 → 200

---

## 快速参考卡片

### 遇到 502？
→ [故障排查手册 - 502 Bad Gateway](./troubleshooting.md#502-bad-gateway)

### API 很慢？
→ [性能分析 - 诊断流程](./performance-analysis.md#诊断流程)

### 缓存不生效？
→ [缓存策略 - 缓存覆盖率优化](./caching-strategies.md#缓存覆盖率优化)

### 静态资源 404？
→ [Nginx 优化 - Location 匹配规则](./nginx-optimization.md#location-匹配规则重要)

### 登录失败？
→ [Supabase Auth 调试](./supabase-auth-debugging.md)

### Nginx 配置？
→ [Nginx 优化 - 完整配置模板](./nginx-optimization.md#完整配置模板)

---

## 🎯 技能调用演示

### 在对话中使用

**用户：**
```
我的网站魔法链接登录后跳回登录页，但客户端显示已登录
```

**Claude（应用技能）：**
> 根据 `nextjs-performance-optimization` 技能的指导，这是一个典型的 Server/Client session 不一致问题。让我按诊断流程检查：
>
> 1. 检查 Server Component 是否能读取 cookies
> 2. 检查 Route Handler 是否设置 cookies
> 3. 检查 Nginx 是否转发 Set-Cookie
>
> [开始诊断...]

---

**用户：**
```
API 响应时间 2s，帮我优化
```

**Claude（应用技能）：**
> 根据 `nextjs-performance-optimization` 技能的缓存策略，2s 的 API 响应时间表明没有缓存或缓存不生效。让我按以下步骤优化：
>
> 1. 检查 PM2 模式
> 2. 添加 TTL 缓存
> 3. 优化数据库查询
>
> [开始优化...]

---

## 📊 技能效果追踪

| 场景 | 应用技能前 | 应用技能后 | 节省时间 |
|------|-----------|-----------|---------|
| API 慢（无缓存） | 2-3s | 0.05s | **80x** |
| 502 错误 | 无法访问 | 正常 | ∞ |
| 静态资源 404 | 全部失败 | 正常 | 100% |
| 登录失败 | 无法登录 | 正常 | 100% |
| 缓存不生效 | 0% 命中 | 95%+ | 95% |

**平均问题解决时间：**
- 使用技能前：2-4 小时（从零分析）
- 使用技能后：15-30 分钟（按指南操作）

---

**创建时间：** 2026-05-12
**技能版本：** 1.0.0
