# 🚀 立即开始操作指南

**服务器**: 阿里云 47.95.199.142
**应用**: 碳硅回路设计师
**当前状态**: ✅ 部署完成，等待配置

---

## ✅ 已完成的自动化工作

### 1. 服务器部署
- ✅ 最新代码已部署
- ✅ PM2 运行正常 (PID: 342019)
- ✅ Nginx 代理已配置
- ✅ HTTPS 证书已申请

### 2. 部署工具
- ✅ 7 个自动化脚本
- ✅ 9 份完整文档
- ✅ 上线助手脚本

### 3. HTTPS 配置
- ✅ SSL 证书生效
- ✅ HTTP → HTTPS 重定向
- ✅ 安全头配置

---

## 🔐 下一步：需要你手动操作

### 任务 1: 配置环境变量 (5分钟)

SSH 到服务器并编辑环境变量：

```bash
ssh root@47.95.199.142
nano /var/www/carbon-silicon-org-book/apps/loop-designer/.env.local
```

**需要填入以下变量**:

```bash
# 应用配置
NEXT_PUBLIC_SITE_URL=https://loop.csi-org.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# LLM 配置
MODEL_API_URL=https://api.stepfun.com/step_plan/v1/chat/completions
MODEL_API_KEY=your-model-api-key
MODEL_NAME=step-router-v1

# 飞书配置
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=your-secret
FEISHU_ALLOWED_TENANT_KEY=your-tenant-key

# 认证配置 (生成: openssl rand -hex 32)
LOOP_AUTH_SESSION_SECRET=your-32-char-secret
LOOP_AUTH_SESSION_TTL_SECONDS=1209600
```

保存后重启应用：

```bash
pm2 restart carbon-silicon-loop-designer
```

验证：

```bash
cd /var/www/carbon-silicon-org-book/apps/loop-designer
node scripts/verify-env.mjs
```

期望输出：`✅ 所有环境变量已配置`

---

### 任务 2: 执行数据库迁移 (5分钟)

#### 方式 A: 使用自动化脚本（推荐）

```bash
ssh root@47.95.199.142
bash /var/www/carbon-silicon-org-book/apps/loop-designer/scripts/run-migration.sh
```

#### 方式 B: 手动执行（Supabase Dashboard）

1. 打开 https://supabase.com/dashboard
2. 进入你的项目 → SQL Editor
3. 复制以下文件内容并执行：

```bash
# 在本地查看迁移文件
cat supabase/migrations/202606110002_enterprise_subscription.sql
```

**迁移内容**:
- 5 张新表（enterprises, members, invites, audit_logs, settings）
- 4 个新字段（users 表）
- 2 个 RPC 函数

---

### 任务 3: 功能测试 (30分钟)

#### 基础功能测试

1. **飞书登录**
   - 访问 https://loop.csi-org.com/loop-designer/
   - 点击"飞书登录"
   - 完成 OAuth 授权

2. **邮箱注册**
   ```bash
   curl -X POST https://loop.csi-org.com/loop-designer/api/auth/email/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123","displayName":"测试"}'
   ```

3. **邮箱登录**
   ```bash
   curl -X POST https://loop.csi-org.com/loop-designer/api/auth/email/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123"}'
   ```

4. **创建会话**
   - 登录后点击"新建会话"
   - 完成 5 步对话
   - 生成方案

5. **导出功能**
   - 导出 Markdown
   - 导出 PDF（如果配置了 Chromium）
   - 导出飞书文档

#### 管理员功能测试

1. **管理后台**
   - 登录企业管理员账号
   - 点击"管理后台"

2. **成员管理**
   - 查看成员列表
   - 更改成员角色
   - 生成邀请码

3. **订阅管理**
   - 查看当前订阅
   - 升级/降级订阅

4. **审计日志**
   - 查看操作记录

**详细测试清单**: [docs/BUSINESS_VERIFICATION.md](docs/BUSINESS_VERIFICATION.md)

---

## 📚 快速参考

### 服务器命令

```bash
# SSH 连接
ssh root@47.95.199.142

# 查看 PM2 状态
pm2 list

# 查看日志
pm2 logs carbon-silicon-loop-designer

# 重启应用
pm2 restart carbon-silicon-loop-designer

# 查看 Nginx 状态
nginx -t
nginx -s reload
```

### 部署命令

```bash
# 本地部署到服务器
./scripts/deploy-aliyun.sh

# 服务器上运行验证
bash /var/www/carbon-silicon-org-book/apps/loop-designer/scripts/verify-deployment.sh
```

---

## 🎯 检查清单

完成以下所有项即可上线：

- [ ] 环境变量已配置
- [ ] 数据库迁移已执行
- [ ] 环境验证通过（verify-env.mjs）
- [ ] 部署验证通过（verify-deployment.sh）
- [ ] 飞书登录测试通过
- [ ] 邮箱注册/登录测试通过
- [ ] 创建会话并生成方案
- [ ] 管理后台可访问
- [ ] HTTPS 证书有效

---

## 🌐 访问地址

- **HTTPS**: https://loop.csi-org.com/loop-designer/
- **HTTP**: http://47.95.199.142/loop-designer/

---

## 📞 获取帮助

- 📧 邮件: support@csi-org.com
- 📖 文档: docs/

---

**最后更新**: 2026-06-11 10:45
**状态**: ⏳ 60% 完成，等待手动配置
