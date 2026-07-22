# 🔐 生产环境配置指南

本文档提供 **碳硅回路设计师** 生产环境配置的完整说明，包括环境变量、安全配置、验证步骤。

---

## 📋 配置检查清单

部署前，请确保完成以下所有配置：

- [ ] 所有必填环境变量已设置
- [ ] 环境变量值已通过验证
- [ ] 安全配置已审查
- [ ] 数据库连接已测试
- [ ] 外部服务（LLM、飞书）已测试

---

## 🌍 环境变量完整清单

### 应用配置

#### `NEXT_PUBLIC_SITE_URL` ⭐⭐⭐

**必填**: ✅ **是**

**说明**: 应用的基础 URL，用于生成链接和回调地址

**示例**:
```bash
# 生产环境
NEXT_PUBLIC_SITE_URL=https://loop.csi-org.com

# 开发环境
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

**验证**:
```bash
# 测试
curl -I $NEXT_PUBLIC_SITE_URL
# 期望: HTTP 200 或 307
```

---

#### `NEXT_PUBLIC_SUPABASE_URL` ⭐⭐⭐

**必填**: ✅ **是**

**说明**: Supabase 项目 URL

**示例**:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://xyzcompany.supabase.co
```

**获取方式**:
1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 选择项目 → **Settings** → **API**
3. 复制 **Project URL**

---

#### `NEXT_PUBLIC_SUPABASE_ANON_KEY` ⭐⭐⭐

**必填**: ✅ **是**

**说明**: Supabase 公开密钥（anon key），用于客户端认证

**安全等级**: 🔓 可公开（但不要主动暴露）

**示例**:
```bash
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**获取方式**: 同上（Project API 页面）

**警告**:
- ❌ 此密钥具有 **数据库读取权限**
- ✅ 受 RLS（Row Level Security）保护
- ❌ **不要**用于服务端操作

---

#### `SUPABASE_SERVICE_ROLE_KEY` ⭐⭐⭐

**必填**: ✅ **是**

**说明**: Supabase 服务角色密钥，**绕过 RLS**

**安全等级**: 🔒 **高度机密**

**示例**:
```bash
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**获取方式**: Supabase Dashboard → Settings → API → **service_role key**

**警告**:
- 🔴 **此密钥具有完整数据库访问权限**
- 🔴 **绝对不能暴露给客户端**
- 🔴 **不能提交到 Git**
- ✅ **仅用于服务端代码**

---

### LLM 配置

#### `MODEL_API_URL` ⭐⭐⭐

**必填**: ✅ **是**

**说明**: LLM API 端点（OpenAI 兼容格式）

**示例**:
```bash
# Step Router
MODEL_API_URL=https://api.stepfun.com/step_plan/v1/chat/completions

# OpenAI
MODEL_API_URL=https://api.openai.com/v1/chat/completions

# 自定义（Azure、本地等）
MODEL_API_URL=https://your-api.com/v1/chat/completions
```

**验证**:
```bash
curl -X POST $MODEL_API_URL \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"test","messages":[{"role":"user","content":"hi"}],"max_tokens":10}'
```

---

#### `MODEL_API_KEY` ⭐⭐⭐

**必填**: ✅ **是**

**说明**: LLM API 密钥

**安全等级**: 🔒 **机密**

**示例**:
```bash
MODEL_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

#### `MODEL_NAME` ⭐⭐⭐

**必填**: ✅ **是**

**说明**: 使用的模型名称

**示例**:
```bash
# Step Router
MODEL_NAME=step-router-v1

# OpenAI
MODEL_NAME=gpt-4-turbo-preview

# Claude（通过 OpenAI 兼容接口）
MODEL_NAME=claude-3-opus
```

---

#### `MODEL_TIMEOUT_MS` ⭐⭐

**必填**: ❌ **否**（默认: 300000 = 5 分钟）

**说明**: LLM API 超时时间

**建议**:
```bash
# 标准（5 分钟）
MODEL_TIMEOUT_MS=300000

# 复杂方案生成（10 分钟）
MODEL_TIMEOUT_MS=600000

# 简单查询（2 分钟）
MODEL_TIMEOUT_MS=120000
```

---

### 飞书集成配置

#### `FEISHU_APP_ID` ⭐⭐⭐

**必填**: ✅ **是**

**说明**: 飞书应用 ID

**获取方式**:
1. 登录 [飞书开放平台](https://open.feishu.cn/app)
2. 选择或创建应用
3. 进入 **凭证与基础信息**
4. 复制 **App ID**

**示例**:
```bash
FEISHU_APP_ID=cli_xxxxxxxxxx
```

---

#### `FEISHU_APP_SECRET` ⭐⭐⭐

**必填**: ✅ **是**

**说明**: 飞书应用密钥

**安全等级**: 🔒 **机密**

**获取方式**: 同上（飞书开放平台）

---

#### `FEISHU_ALLOWED_TENANT_KEY` ⭐⭐⭐

**必填**: ✅ **是**

**说明**: 允许的企业租户 Key（安全验证）

**获取方式**:
1. 飞书开放平台 → 应用详情
2. 进入 **事件与回调**
3. 查看 **Encrypt Key**

**示例**:
```bash
FEISHU_ALLOWED_TENANT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

#### `FEISHU_EXPORT_FOLDER_TOKEN` ⭐⭐

**必填**: ❌ **否**（但飞书导出功能需要）

**说明**: 飞书文档导出文件夹的 Token

**获取方式**:
1. 在飞书中创建文件夹
2. 右键 → **复制链接**
3. 提取 `folder/` 后的部分

**示例**:
```bash
FEISHU_EXPORT_FOLDER_TOKEN=fldxxxxxxxxxx
```

---

### 认证配置

#### `LOOP_AUTH_SESSION_SECRET` ⭐⭐⭐

**必填**: ✅ **是**

**说明**: Session 加密密钥，用于加密 Auth Token

**要求**: ≥ 32 字符

**生成方法**:
```bash
# Linux/macOS
openssl rand -hex 32

# Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Python
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**示例**:
```bash
LOOP_AUTH_SESSION_SECRET=a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2
```

**警告**:
- 🔴 此密钥变更将导致所有用户登出
- 🔴 泄露可能导致 Session 伪造
- ✅ 定期轮换（建议 90 天）

---

#### `LOOP_AUTH_SESSION_TTL_SECONDS` ⭐

**必填**: ❌ **否**（默认: 1209600 = 14 天）

**说明**: Session 有效期

**建议**:
```bash
# 标准（14 天）
LOOP_AUTH_SESSION_TTL_SECONDS=1209600

# 安全敏感环境（7 天）
LOOP_AUTH_SESSION_TTL_SECONDS=604800

# 高安全环境（24 小时）
LOOP_AUTH_SESSION_TTL_SECONDS=86400
```

---

### PDF 生成配置

#### `CHROMIUM_EXECUTABLE_PATH` ⭐⭐

**必填**: ❌ **否**（但 PDF 导出功能需要）

**说明**: Chromium 可执行文件路径

**安装**:
```bash
# Ubuntu/Debian
apt install -y chromium-browser
which chromium-browser
# 输出: /usr/bin/chromium-browser

# macOS（使用 Homebrew）
brew install --cask chromium
which chromium
# 输出: /usr/local/bin/chromium
```

**配置**:
```bash
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

---

### 可选配置（未来功能）

#### `STRIPE_SECRET_KEY` ⭐⭐

**必填**: ❌ **否**（支付功能需要）

**说明**: Stripe 密钥（支付集成）

**示例**:
```bash
# 测试环境
STRIPE_SECRET_KEY=your_stripe_test_secret_here

# 生产环境
STRIPE_SECRET_KEY=your_stripe_live_secret_here
```

---

#### `STRIPE_WEBHOOK_SECRET` ⭐⭐

**必填**: ❌ **否**（支付功能需要）

**说明**: Stripe Webhook 签名验证密钥

---

## 🔒 安全配置

### 1. 环境变量安全

#### 检查清单

- [ ] `.env.local` 在 `.gitignore` 中
- [ ] 从未提交到 Git
- [ ] 使用强随机密钥（≥ 32 字符）
- [ ] 生产环境变量加密存储（推荐使用 Vault）

#### 验证

```bash
# 检查 .gitignore
cat .gitignore | grep ".env"

# 期望输出:
# .env*.local
# .env

# 检查 Git 历史
git log --all --full-history -- .env.local
# 期望: 无输出
```

---

### 2. HTTPS 配置

#### Nginx 配置

```nginx
server {
    listen 443 ssl http2;
    server_name loop.csi-org.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/loop.csi-org.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/loop.csi-org.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5:!3DES;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # 反向代理
    location /loop-designer/ {
        proxy_pass http://127.0.0.1:3010/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### SSL 验证

```bash
# 测试 SSL 配置
openssl s_client -connect loop.csi-org.com:443 -servername loop.csi-org.com

# 使用 SSL Labs（推荐）
# https://www.ssllabs.com/ssltest/analyze.html?d=loop.csi-org.com
# 期望评级: A 或 A+
```

---

### 3. Cookie 安全

应用已配置安全 Cookie:

```typescript
// src/lib/app-session.ts
{
  httpOnly: true,        // ✅ 防止 XSS 窃取
  secure: NODE_ENV === "production",  // ✅ HTTPS only
  sameSite: "lax",       // ✅ 防 CSRF
  path: "/loop-designer", // ✅ 限制路径
}
```

**验证**:
```bash
# 登录后检查 Cookie
curl -I https://loop.csi-org.com/loop-designer/api/auth/feishu/login 2>&1 | grep Set-Cookie

# 期望:
# Set-Cookie: loop_designer_session=...; HttpOnly; Path=/loop-designer; Secure; SameSite=Lax
```

---

### 4. CORS 配置

如果需要在不同域名访问 API，配置 CORS:

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  // ...
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: 'https://loop.csi-org.com' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
        ],
      },
    ];
  },
};
```

---

### 5. RLS（Row Level Security）

**验证 RLS 已启用**:

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename LIKE 'loop_designer_%';
```

**期望**: 所有表 `rowsecurity = true`

---

## ✅ 配置验证步骤

### 步骤 1: 验证环境变量

```bash
# 创建验证脚本
cat > scripts/verify-env.mjs << 'EOF'
import { config } from 'dotenv';

config({ path: '.env.local' });

const required = [
  'NEXT_PUBLIC_SITE_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'MODEL_API_URL',
  'MODEL_API_KEY',
  'MODEL_NAME',
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'FEISHU_ALLOWED_TENANT_KEY',
  'LOOP_AUTH_SESSION_SECRET',
];

let allOk = true;

for (const key of required) {
  const value = process.env[key];
  if (!value) {
    console.error(`❌ 缺失: ${key}`);
    allOk = false;
  } else if (value.includes('replace-me') || value.includes('your-')) {
    console.warn(`⚠️  未配置: ${key} (当前值: ${value.slice(0, 20)}...)`);
    allOk = false;
  } else {
    console.log(`✅ ${key}`);
  }
}

if (!allOk) {
  console.error('\n❌ 环境变量配置不完整');
  process.exit(1);
} else {
  console.log('\n✅ 所有环境变量已配置');
}
EOF

# 运行验证
node scripts/verify-env.mjs
```

---

### 步骤 2: 验证数据库连接

```bash
# 测试数据库连接
node -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
supabase.from('loop_designer_users').select('count').then(({ data, error }) => {
  if (error) {
    console.error('❌ 数据库连接失败:', error.message);
    process.exit(1);
  } else {
    console.log('✅ 数据库连接成功');
  }
});
"
```

---

### 步骤 3: 验证 LLM API

```bash
# 测试 LLM API
curl -X POST $MODEL_API_URL \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "'$MODEL_NAME'",
    "messages": [{"role": "user", "content": "Say hello"}],
    "max_tokens": 10
  }' | jq '.choices[0].message.content'
```

---

### 步骤 4: 验证飞书配置

```bash
# 测试获取飞书 Access Token
curl -X POST https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal \
  -H "Content-Type: application/json" \
  -d '{
    "app_id": "'$FEISHU_APP_ID'",
    "app_secret": "'$FEISHU_APP_SECRET'"
  }' | jq '.tenant_access_token'

# 期望: 返回 access_token（非空字符串）
```

---

### 步骤 5: 验证应用启动

```bash
# 构建
npm run build

# 启动
node .next/standalone/apps/loop-designer/server.js &

# 测试
curl -I http://127.0.0.1:3000/loop-designer/
# 期望: HTTP 307

# 运行部署验证
./scripts/verify-deployment.sh
# 期望: ✅ 所有测试通过！
```

---

## 🔑 密钥轮换指南

### 何时轮换密钥

- ✅ 每 90 天定期轮换
- ✅ 密钥泄露时立即轮换
- ✅ 员工离职时轮换
- ✅ 怀疑被入侵时轮换

### 轮换步骤

#### 1. Session Secret 轮换

```bash
# 1. 生成新密钥
NEW_SECRET=$(openssl rand -hex 32)

# 2. 更新 .env.local
sed -i '' 's/LOOP_AUTH_SESSION_SECRET=.*/LOOP_AUTH_SESSION_SECRET='$NEW_SECRET'/' .env.local

# 3. 重启应用（所有用户将被登出）
pm2 restart carbon-silicon-loop-designer

# 4. 通知用户重新登录
```

**影响**: 所有用户会被登出

---

#### 2. Supabase Service Role Key 轮换

```bash
# 1. 在 Supabase Dashboard → Settings → API
# 2. 点击 "Reset service_role key"
# 3. 复制新密钥
# 4. 更新 .env.local
# 5. 重启应用
pm2 restart carbon-silicon-loop-designer
```

**影响**: 应用会暂时无法访问数据库，直到重启完成

---

#### 3. LLM API Key 轮换

```bash
# 1. 在 LLM 服务商控制台生成新密钥
# 2. 更新 .env.local
# 3. 重启应用（无需登出）
pm2 restart carbon-silicon-loop-designer
```

**影响**: 无用户影响

---

## 🚨 故障排查

### 问题 1: 数据库连接失败

**症状**: `Error: Database connection failed`

**排查**:
```bash
# 1. 检查 URL
echo $NEXT_PUBLIC_SUPABASE_URL

# 2. 检查密钥
echo $SUPABASE_SERVICE_ROLE_KEY | cut -c1-20

# 3. 测试连接
curl -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  "$NEXT_PUBLIC_SUPABASE_URL/rest/v1/loop_designer_users?select=count"
```

---

### 问题 2: LLM API 超时

**症状**: `Error: LLM request timeout`

**解决**:
```bash
# 1. 增加超时时间
MODEL_TIMEOUT_MS=600000

# 2. 测试 API
curl -X POST $MODEL_API_URL \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"test","messages":[{"role":"user","content":"test"}],"max_tokens":10}' \
  --max-time 10

# 3. 检查网络
ping api.stepfun.com
```

---

### 问题 3: 飞书 OAuth 失败

**症状**: 飞书登录后跳转到错误页

**排查清单**:
- [ ] `FEISHU_APP_ID` 正确
- [ ] `FEISHU_APP_SECRET` 正确
- [ ] `FEISHU_ALLOWED_TENANT_KEY` 正确
- [ ] 飞书开放平台重定向 URL 配置:
  ```
  https://loop.csi-org.com/loop-designer/api/auth/feishu/callback
  ```
- [ ] 应用已发布（开发模式下只有白名单用户可用）

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| [部署指南](../DEPLOYMENT.md) | 完整部署流程 |
| [数据库迁移指南](DATABASE_MIGRATION.md) | 数据库迁移步骤 |
| [快速参考](../QUICK_REFERENCE.md) | 常用命令和 API |

---

**最后更新**: 2026-06-11
**文档版本**: v1.0
**维护者**: 碳硅回路设计师团队
