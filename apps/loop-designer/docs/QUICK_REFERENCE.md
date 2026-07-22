# 🚀 快速参考指南

本文档提供 **碳硅回路设计师** 商业级产品的快速参考信息。

---

## 📍 快速链接

| 资源 | 链接 |
|------|------|
| 生产环境 | https://loop.csi-org.com/loop-designer/ |
| Supabase 控制台 | https://supabase.com/dashboard |
| 飞书开放平台 | https://open.feishu.cn/app |
| GitHub 仓库 | https://github.com/your-org/carbon-silicon-org-book |

---

## 🔧 常用命令

### 开发

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 运行测试
npm test

# Lint 代码
npm run lint
```

### 部署

```bash
# 构建生产版本
npm run build

# 启动生产服务器（正确方式）
node .next/standalone/apps/loop-designer/server.js

# 验证部署
./scripts/verify-deployment.sh
```

### PM2 管理

```bash
# 启动
pm2 start ecosystem.config.cjs

# 查看状态
pm2 status

# 查看日志
pm2 logs carbon-silicon-loop-designer

# 重启
pm2 restart carbon-silicon-loop-designer
```

---

## 🌍 环境变量清单

### 必填变量

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...

# LLM
MODEL_API_URL=https://api.stepfun.com/step_plan/v1/chat/completions
MODEL_API_KEY=sk-xxx
MODEL_NAME=step-router-v1

# 飞书
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_ALLOWED_TENANT_KEY=xxx
FEISHU_EXPORT_FOLDER_TOKEN=xxx

# 认证
LOOP_AUTH_SESSION_SECRET=<openssl rand -hex 32>
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

### 可选变量

```bash
# 订阅（未来）
# STRIPE_SECRET_KEY=your_stripe_test_secret_here
# STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
```

---

## 🗄️ 数据库表结构

### 核心表

| 表名 | 主要字段 | 说明 |
|------|---------|------|
| `loop_designer_users` | id, email, auth_provider, enterprise_id | 用户（飞书+邮箱） |
| `loop_designer_auth_sessions` | user_id, token_hash, expires_at | 认证会话 |
| `loop_designer_sessions` | user_id, status, context, responses, outputs | 设计会话 |
| `loop_designer_enterprises` | tenant_key, company_name, subscription_tier, seat_limit | 企业 |
| `loop_designer_enterprise_members` | enterprise_id, user_id, role | 企业成员 |
| `loop_designer_invite_codes` | enterprise_id, code, max_uses, used_count | 邀请码 |
| `loop_designer_audit_logs` | enterprise_id, user_id, action, details | 审计日志 |
| `loop_designer_enterprise_settings` | enterprise_id, default_ai_model, branding | 企业设置 |

### RPC 函数

| 函数名 | 说明 |
|--------|------|
| `increment_used_seats(p_enterprise_id)` | 增加席位（原子操作） |
| `decrement_used_seats(p_enterprise_id)` | 减少席位（原子操作） |

---

## 🔐 角色权限

| 角色 | 管理成员 | 管理计费 | 查看审计 | 修改设置 |
|------|---------|---------|---------|---------|
| super_admin | ✅ | ✅ | ✅ | ✅ |
| billing_admin | ❌ | ✅ | ✅ | ❌ |
| member_admin | ✅ | ❌ | ✅ | ❌ |
| member | ❌ | ❌ | ❌ | ❌ |

---

## 📂 项目结构

```
apps/loop-designer/
├── src/
│   ├── app/
│   │   ├── api/              # API 路由
│   │   │   ├── auth/         # 认证
│   │   │   ├── sessions/     # 会话管理
│   │   │   └── admin/        # 管理员接口
│   │   ├── admin/enterprise/ # 管理后台 UI
│   │   ├── sessions/[id]/    # 设计工作台
│   │   └── page.tsx          # 首页
│   ├── components/           # React 组件
│   │   ├── designer-workspace.tsx  # 核心编辑器
│   │   ├── admin-console-link.tsx  # 管理后台入口
│   │   └── ...
│   └── lib/                  # 核心逻辑（服务端）
│       ├── model.ts          # LLM 集成
│       ├── enterprise.ts     # 企业管理
│       ├── admin-console.ts  # 管理员功能
│       ├── invite-codes.ts   # 邀请码
│       ├── sessions.ts       # 会话 CRUD
│       └── ...
├── supabase/migrations/      # 数据库迁移
├── scripts/                  # 部署脚本
│   ├── verify-deployment.sh  # 部署验证
│   └── prepare-standalone.mjs
├── docs/                     # 文档
│   ├── DEPLOYMENT.md         # 部署指南
│   ├── BUSINESS_VERIFICATION.md  # 商业验证清单
│   └── QUICK_REFERENCE.md    # 本文档
└── ecosystem.config.cjs      # PM2 配置
```

---

## 🔗 API 路由清单

### 认证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/auth/feishu/login` | 飞书 OAuth 登录 |
| GET | `/api/auth/feishu/callback` | 飞书回调 |
| POST | `/api/auth/email/signup` | 邮箱注册 |
| POST | `/api/auth/join-enterprise/[code]` | 邀请码加入 |
| POST | `/api/auth/logout` | 登出 |

### 会话

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/sessions` | 创建会话 |
| GET | `/api/sessions` | 列出会话 |
| POST | `/api/sessions/[id]/answer` | 提交步骤回答 |
| POST | `/api/sessions/[id]/generate` | 生成方案 |
| POST | `/api/sessions/[id]/refine` | 优化方案 |

### 导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/sessions/[id]/exports/markdown` | 导出 Markdown |
| GET | `/api/sessions/[id]/exports/pdf` | 导出 PDF |
| GET | `/api/sessions/[id]/exports/feishu` | 导出飞书文档 |

### 管理员

| 方法 | 路径 | 权限 |
|------|------|------|
| GET | `/api/admin/members` | manage_members |
| POST | `/api/admin/members` | manage_members |
| DELETE | `/api/admin/members/[userId]` | manage_members |
| GET | `/api/admin/subscription` | manage_billing |
| PATCH | `/api/admin/subscription` | manage_billing |
| GET | `/api/admin/invites` | manage_members |
| POST | `/api/admin/invites` | manage_members |
| GET | `/api/admin/audit-logs` | view_audit_logs |
| GET | `/api/admin/settings` | modify_settings |

---

## 🐛 常见问题

### Q1: 应用启动失败

```bash
# 检查端口占用
lsof -i :3000

# 检查环境变量
cat .env.local | grep -v "^#"

# 查看详细错误
node .next/standalone/apps/loop-designer/server.js 2>&1 | head -50
```

---

### Q2: 数据库迁移失败

```sql
-- 检查表是否存在
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'loop_designer_%';

-- 手动执行迁移
-- 在 Supabase SQL Editor 中执行
-- supabase/migrations/202606110002_enterprise_subscription.sql
```

---

### Q3: 飞书登录失败

**检查清单**:
1. ✅ `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 正确
2. ✅ 飞书开放平台配置了重定向 URL: `https://loop.csi-org.com/loop-designer/api/auth/feishu/callback`
3. ✅ `FEISHU_ALLOWED_TENANT_KEY` 匹配你的企业
4. ✅ RLS 策略允许认证访问

---

### Q4: LLM 生成超时

**解决方案**:

```bash
# 增加超时时间（默认 5 分钟）
MODEL_TIMEOUT_MS=300000 npm start

# 或在 .env.local 中配置
MODEL_TIMEOUT_MS=600000  # 10 分钟
```

---

### Q5: PDF 导出失败

```bash
# 1. 检查 Chromium 路径
which chromium-browser

# 2. 测试 Puppeteer
node -e "require('puppeteer-core'); console.log('✅ Puppeteer 可用')"

# 3. 安装依赖（如果失败）
apt install -y libgbm1 libasound2 libatk1.0-0
```

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [部署指南](DEPLOYMENT.md) | 完整的部署和运维指南 |
| [商业验证清单](BUSINESS_VERIFICATION.md) | 所有商业功能的验证步骤 |
| [CLAUDE.md](/CLAUDE.md) | 项目详细说明（开发指南） |
| [README.md](/README.md) | 项目简介 |

---

## 💡 开发技巧

### 1. 快速导航

```bash
# 查看所有 API 路由
find src/app/api -name "route.ts"

# 查看所有 React 组件
find src/components -name "*.tsx"

# 查看所有服务端库
ls src/lib/*.ts
```

---

### 2. 数据库调试

```sql
-- 查看所有表
\dt loop_designer_*

-- 查看表结构
\d loop_designer_users

-- 查看索引
\di loop_designer_*

-- 查看 RLS 策略
SELECT * FROM pg_policies
WHERE tablename LIKE 'loop_designer_%';
```

---

### 3. 日志查看

```bash
# 实时日志
pm2 logs -f

# 错误日志
pm2 logs --err

# 最近 100 行
pm2 logs --lines 100
```

---

### 4. 性能分析

```bash
# Next.js 分析
npm run build -- --profile

# 使用 Chrome DevTools
# 打开 Chrome → Inspect → Performance
```

---

## 🔒 安全注意事项

### 1. 环境变量

- ❌ **不要**提交 `.env.local` 到 Git
- ❌ **不要**在前端代码中使用 `SUPABASE_SERVICE_ROLE_KEY`
- ✅ 使用 `NEXT_PUBLIC_*` 前缀的变量可以暴露给前端

---

### 2. 数据库安全

- ✅ RLS 已启用
- ✅ 所有查询使用参数化
- ✅ 服务角色密钥仅在服务端使用

---

### 3. 会话安全

- ✅ HttpOnly Cookie
- ✅ Secure Flag（生产环境）
- ✅ SameSite: Lax
- ✅ 过期时间：14 天

---

## 📞 技术支持

- 📧 邮箱: support@csi-org.com
- 💬 飞书群: [加入讨论]
- 🐛 Bug 反馈: GitHub Issues

---

**最后更新**: 2026-06-11
**文档版本**: v1.0
**维护者**: 碳硅回路设计师团队
