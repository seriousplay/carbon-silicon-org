# 🔐 配置服务器环境变量

## 当前状态

✅ **服务器**: 47.95.199.142
✅ **.env.local 模板**: 已创建
⚠️ **真实配置**: 待填入

---

## 📋 下一步操作

### 1. SSH 到服务器

```bash
ssh root@47.95.199.142
```

### 2. 编辑环境变量文件

```bash
nano /var/www/carbon-silicon-org-book/apps/loop-designer/.env.local
```

### 3. 填入真实配置

按以下顺序配置：

#### 应用配置

```bash
NEXT_PUBLIC_SITE_URL=https://loop.csi-org.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

#### LLM 配置

```bash
MODEL_API_URL=https://api.stepfun.com/step_plan/v1/chat/completions
MODEL_API_KEY=your-model-api-key
MODEL_NAME=step-router-v1
MODEL_TIMEOUT_MS=300000
```

#### 飞书配置

```bash
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=your-feishu-secret
FEISHU_ALLOWED_TENANT_KEY=your-tenant-key
FEISHU_EXPORT_FOLDER_TOKEN=your-folder-token
```

#### 认证配置

```bash
# 生成: openssl rand -hex 32
LOOP_AUTH_SESSION_SECRET=your-32-char-secret
LOOP_AUTH_SESSION_TTL_SECONDS=1209600
```

### 4. 验证配置

```bash
cd /var/www/carbon-silicon-org-book/apps/loop-designer
node scripts/verify-env.mjs
```

期望输出: ✅ 所有环境变量已配置

### 5. 重启应用

```bash
pm2 restart carbon-silicon-loop-designer
```

---

## 📚 详细文档

- **[PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)** - 环境变量完整说明
- **[GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md)** - 上线清单

---

**当前进度**: 60% ✅
**下一步**: 配置环境变量 → 执行数据库迁移 → 测试功能
