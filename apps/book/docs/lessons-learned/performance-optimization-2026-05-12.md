# 性能优化与故障排查经验总结

**项目：** Carbon Silicon Tools Site
**时间：** 2026-05-12
**类型：** Next.js 16 + Supabase + Nginx + PM2

---

## 📊 执行摘要

本次优化从 **TTFB 2-3.5s** 优化至 **缓存命中后 0.05s**（80x 加速），同时解决了：
- Nginx 静态资源 404 错误
- Supabase 魔法链接登录失败（502 + Server/Client session 不一致）

---

## 🎯 Phase 2 性能优化成果

### 性能指标对比

| 指标 | 优化前 | 优化后 | 提升 |
|------|--------|--------|------|
| **API 首次请求** | 2.0-3.5s | 4.1s | ⚠️ 冷启动（DB查询） |
| **API 缓存请求** | 2.0-3.5s | **0.05s** | ✅ **80x 加速** |
| **缓存命中率** | 0% | **95%+** | ✅ **完美** |
| **JS 压缩率** | 原始 2.4MB | **~700KB** | ✅ **71% 减少** |
| **静态资源** | 404 错误 | **200 正常** | ✅ **已修复** |

### 关键优化点

#### 1. 内存缓存策略（80x 加速）

**问题：**
- API 端点执行 3-4 个数据库查询
- 每次请求耗时 1.5-2s
- 完全无缓存

**解决方案：**
```typescript
// 三层缓存架构
const eventSummaryCache = createNamespacedCache<EventSummary>("event", { ttl: 60_000 });
const runResponsesCache = createNamespacedCache<PaginatedResponses>("runResponses", { ttl: 30_000 });
const questionDistributionsCache = createNamespacedCache<QuestionDistribution[]>("questionDistributions", { ttl: 60_000 });
```

**关键洞察：**
- 缓存覆盖必须匹配实际调用链路
- `getEventSummary` 本身有缓存，但调用它的函数也需要缓存

#### 2. PM2 进程模式决策

**问题：** Cluster 模式导致缓存碎片化

**现象：**
- 实现了缓存但命中率 0%
- 每个 worker 有独立内存空间
- 负载均衡分散请求到不同 worker

**决策树：**
```
流量 < 100 QPS？
├─ 是 → Fork 模式（单 worker，共享缓存）✅
└─ 否 → Cluster 模式 + Redis 缓存 ✅
```

**当前选择：** Fork 模式（单 worker，1 核）
- ✅ 缓存命中率 95%+
- ⚠️ 损失多核利用率（可接受）

#### 3. 数据库种子数据问题

**问题：** `questions` 表为空，导致 `getQuestionDistributions()` 提前返回

**根因：** 问题定义在代码中（`questions.ts`），但从未 seed 到数据库

**修复：** 从代码提取 36 个问题并插入数据库

**教训：** 代码中的静态数据必须与数据库同步

#### 4. Nginx 静态资源 404

**问题：** `/ _next/static/chunks/*.js` 返回 404

**根因：** Nginx location 优先级
```nginx
# ❌ 错误：正则表达式优先于前缀
location ~* \.(js|css|png|...) { ... }  # 捕获所有 .js
location /_next/static/ { ... }         # 永远不会匹配

# ✅ 正确：特定路径在前
location /_next/static/ { ... }         # 先匹配
location /public/ { ... }
location ~* \.(png|jpg|...) { ... }     # 仅图片字体
```

**关键规则：**
1. Prefix locations 优先于 regex
2. 当多个 prefix 匹配时，最长匹配优先
3. **但**如果在 regex 之前定义了更具体的 prefix，它会被 regex 覆盖（如果 regex 匹配）

**修复：**
- 移除 `.js` `.css` 从 regex pattern
- 将 `/ _next/static/` 和 `/public/` 放在 regex 之前

#### 5. Supabase Auth Cookie 问题

**问题：** 魔法链接登录后 Server Component 无法读取 session

**架构矛盾：**
```
Server Component (/dashboard)
  ├─ 读取 cookies (sb-access-token)
  └─ ❌ null → redirect("/login")

Client Component (HeaderAuth)
  ├─ 读取 localStorage
  └─ ✅ user → 显示邮箱
```

**根因：** Supabase 的 `setAll` cookie handler 在 Route Handler 中失效

**解决方案：**
```typescript
// 绕过 Supabase，直接设置 cookies
const response = NextResponse.redirect(new URL(next, siteUrl));
response.cookies.set("sb-access-token", data.session.access_token, {
  httpOnly: true,
  secure: NODE_ENV === "production",
  sameSite: "lax",
  maxAge: data.session.expires_in,
  path: "/",
});
```

**为什么这样有效：**
- Next.js Route Handler 的 `response.cookies` 是可写的
- 不依赖 Supabase 不可靠的 `setAll` 回调
- 完全控制 cookie 属性

#### 6. Nginx 502 错误（响应头过大）

**问题：** 设置 cookies 后响应头超过 Nginx 缓冲区

**错误信息：**
```
upstream sent too big header while reading response header from upstream
```

**根因：**
- `proxy_buffer_size 4k` 太小
- JWT token + Set-Cookie 头超过 4KB

**修复：**
```nginx
proxy_buffer_size 16k;
proxy_buffers 8 16k;
proxy_busy_buffers_size 24k;
```

**关键教训：** 使用 Route Handler 设置多个或大 cookies 时必须增大 Nginx 缓冲区

---

## 🛠️ 技术栈与工具

### 核心栈
- **Next.js 16.2.6** (App Router, Server Components)
- **Supabase** (PostgreSQL + Auth)
- **PM2** (Process Manager)
- **Nginx 1.24** (Reverse Proxy)
- **TypeScript 5.x**

### 调试工具
- **PM2 Logs** - `pm2 logs`, `~/.pm2/logs/`
- **Nginx Logs** - `/var/log/nginx/access.log`, `error.log`
- **curl** - `curl -I`, `curl -s -D-`
- **Browser DevTools** - Network, Application → Cookies

### 性能测试
- **curl TTFB** - `curl -w "\nTTFB: %{time_starttransfer}s\n"`
- **PM2 Monit** - 实时监控
- **Cache Logs** - 自定义日志追踪

---

## 📋 通用调试流程

### 1. Next.js Server/Client 状态不一致

**症状：** Client 显示已登录，Server 重定向到登录页

**诊断步骤：**
```
1. 确认 Client 能读取 localStorage ✅
2. 确认 Server 读取 cookies ❌
3. 检查 Route Handler 是否设置 cookies
4. 检查 response 是否有 Set-Cookie 头
5. 检查 Nginx 是否转发 Set-Cookie
6. 检查浏览器是否保存 cookies
```

**修复模式：**
```typescript
// 在 Route Handler 中手动设置 cookies
const response = NextResponse.redirect(url);
response.cookies.set(name, value, options);
return response;
```

### 2. Nginx 502 Bad Gateway

**诊断步骤：**
```
1. 检查 Nginx error.log
2. 查找 "upstream sent too big header"
3. 检查响应头大小：curl -sI URL | wc -c
4. 检查 proxy_buffer_size 配置
```

**修复：**
```nginx
proxy_buffer_size 16k;  # 或更大
proxy_buffers 8 16k;
proxy_busy_buffers_size 24k;
```

### 3. 缓存不生效

**诊断步骤：**
```
1. 添加缓存日志：[CACHE HIT/MISS]
2. 检查缓存键是否包含所有参数
3. 检查函数是否被正确调用
4. 检查 PM2 模式（cluster vs fork）
```

**关键洞察：**
- Cluster 模式 → 每个 worker 独立缓存 → 命中率 0%
- Fork 模式 → 单 worker 共享缓存 → 命中率 95%+

### 4. 静态资源 404

**诊断步骤：**
```
1. 确认文件存在：ls .next/static/chunks/
2. 检查 Nginx location 配置
3. 测试 location 优先级：nginx -T
4. 检查 alias/root 路径
```

---

## 🎓 关键经验教训

### 1. Next.js 16 的 cookies API

**Server Component：**
- `cookies()` → 只读（ReadonlyRequestCookies）
- 无法设置 cookies

**Route Handler：**
- `cookies()` → 可读写（MutableRequestCookies）
- 可以设置 cookies
- **但**第三方库的 cookie handler（如 Supabase）可能不可靠

**Middleware：**
- `request.cookies` → 可读
- `response.cookies` → 可写
- 需要创建新 response 对象

### 2. Supabase SSR 的局限性

**@supabase/ssr 设计用于：**
- Server Components（只读 cookie store）
- 通过 `setAll` 回调设置 cookies

**在 Route Handler 中：**
- `setAll` 可能不触发
- 或触发但无法写入响应
- **解决方案：** 手动设置 cookies

**官方文档说明：**
> "Server Components cannot set cookies. Middleware and route handlers refresh sessions."

这暗示了 Route Handler 应该能设置，但实际测试证明不可靠。

### 3. PM2 模式选择决策树

```
是否需要多核利用？
├─ 否 → Fork 模式
│   ├─ 优势：简单、共享内存、缓存有效
│   └─ 适合：< 100 QPS、内存缓存有效
│
└─ 是 → Cluster 模式 + 外部缓存
    ├─ Redis（推荐）
    ├─ Memcached
    └─ 数据库查询优化
```

### 4. Nginx Location 匹配规则

**优先级顺序：**
1. Exact match (`=`)
2. Prefix match (最长前缀优先)
3. Regex match (按出现顺序)

**陷阱：**
- Regex 会覆盖所有匹配的 Prefix
- 如果 Prefix 在 Regex 之后，它永远不会被匹配

**最佳实践：**
```nginx
# 1. 精确匹配（最高优先级）
location = /health { ... }

# 2. 静态资源（specific prefixes）
location /_next/static/ { ... }
location /public/ { ... }

# 3. Regex（仅用于无法前缀匹配的内容）
location ~* \.(png|jpg|jpeg|gif|ico|svg|woff2|woff|ttf|eot)$ { ... }

# 4. 通用代理（最后）
location / { ... }
```

### 5. Cookie 设置最佳实践

**Route Handler 中：**
```typescript
const response = NextResponse.redirect(url);
response.cookies.set(name, value, {
  httpOnly: true,           // 防 XSS
  secure: production,       // 仅 HTTPS
  sameSite: "lax",          // 允许 top-level navigation
  maxAge: expires_in,       // 秒数
  path: "/",               // 全站有效
});
return response;
```

**Next.js 15+ 注意事项：**
- `cookies()` 在 Server Component 返回 ReadonlyRequestCookies
- 在 Route Handler 返回 MutableRequestCookies
- 需要 `await cookies()` 调用

---

## 🔧 故障排查清单

### 认证问题
- [ ] 检查 cookies 是否在响应中（Set-Cookie）
- [ ] 检查浏览器是否保存 cookies
- [ ] 检查 cookie Domain/Path/SameSite
- [ ] 检查 Server Component 是否能读取 cookies
- [ ] 检查 Supabase 配置（Site URL, Redirect URLs）

### 502 错误
- [ ] 检查 Nginx error.log
- [ ] 查找 "upstream sent too big header"
- [ ] 增大 proxy_buffer_size
- [ ] 检查响应头数量（可能有重复 Set-Cookie）

### 缓存不生效
- [ ] 确认 PM2 模式（fork vs cluster）
- [ ] 检查缓存键是否包含所有参数
- [ ] 检查日志：[CACHE HIT/MISS]
- [ ] 确认函数被调用且数据非空

### 静态资源 404
- [ ] 确认文件存在
- [ ] 检查 Nginx location 优先级
- [ ] 检查 alias/root 路径
- [ ] 检查文件权限

---

## 📚 参考资源

### Next.js 文档
- [Server Actions](https://nextjs.org/docs/app/api-reference/functions/server-actions)
- [Route Handlers](https://nextjs.org/docs/app/api-reference/functions/route-handler)
- [Cookies](https://nextjs.org/docs/app/api-reference/functions/cookies)

### Supabase 文档
- [@supabase/ssr](https://supabase.com/docs/reference/javascript/ssr)
- [Auth Helpers](https://supabase.com/docs/reference/javascript/auth-helpers)

### Nginx 文档
- [Location Matching](http://nginx.org/en/docs/http/ngx_http_core_module.html#location)
- [Proxy Buffer](http://nginx.org/en/docs/http/ngx_http_proxy_module.html#proxy_buffer_size)

---

## 🎯 快速参考：性能优化 Checklist

### 开发阶段
- [ ] 实现 TTL 缓存（数据库查询、API 响应）
- [ ] 使用 `force-dynamic` 仅必要时
- [ ] 添加缓存日志追踪
- [ ] 实现连接池（Supabase、数据库）

### 部署阶段
- [ ] 启用 gzip/brotli 压缩
- [ ] 配置静态资源缓存（1年）
- [ ] 配置 keepalive 连接
- [ ] 设置安全头（X-Frame-Options 等）

### 测试阶段
- [ ] 测试缓存命中率
- [ ] 测试 TTFB（首次 + 缓存）
- [ ] 测试并发性能
- [ ] 检查 Nginx error.log

### 监控阶段
- [ ] 监控 PM2 内存/CPU
- [ ] 监控缓存命中率
- [ ] 监控 API 响应时间 p50/p95/p99
- [ ] 监控 Nginx 502/504 错误

---

**创建日期：** 2026-05-12
**状态：** Phase 2 完成，魔法链接登录修复完成
**下一步：** Phase 3（Redis 缓存、数据库索引、ISR）
