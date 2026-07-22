# ✅ 碳硅回路设计师 - 部署完成指南

**日期**: 2026-06-11
**服务器**: 阿里云 47.95.199.142
**状态**: ✅ **服务器就绪，等待配置**

---

## 📊 完成状态

```
进度: [███████████████░░░░] 90%

✅ 服务器部署      100%
✅ HTTPS 配置      100%
✅ 部署工具        100%
✅ 文档体系        100%
⏳ 环境配置         0%  ← 需要你手动完成
⏳ 数据库迁移       0%  ← 需要你手动完成
⏳ 功能测试         0%  ← 需要你手动完成
```

---

## ✅ 服务器状态

### PM2 进程

```
ID: 30
名称: carbon-silicon-loop-designer
状态: ✅ online
PID: 342019
内存: 113.7 mb
运行时间: 15m
```

### HTTPS 证书

```
域名: loop.csi-org.com
状态: ✅ 有效
颁发: Jun 10 12:15:51 2026 GMT
过期: Sep 8 12:15:50 2026 GMT (90 天)
```

### 网络连接

```
服务器: 47.95.199.142
延迟: 10ms
丢包: 0%
SSH: ✅ 正常
HTTP: ✅ 正常
HTTPS: ✅ 正常
```

---

## 🚀 3 步完成上线

### 第 1 步：配置环境变量

```bash
# 1. SSH 到服务器
ssh root@47.95.199.142

# 2. 编辑环境变量
nano /var/www/carbon-silicon-org-book/apps/loop-designer/.env.local

# 3. 填入以下变量（参考下方模板）

# 4. 保存并退出（Ctrl+X，然后 Y，然后 Enter）

# 5. 重启应用
pm2 restart carbon-silicon-loop-designer

# 6. 验证
cd /var/www/carbon-silicon-org-book/apps/loop-designer
node scripts/verify-env.mjs
```

**环境变量模板**:

```bash
# 应用配置
NEXT_PUBLIC_SITE_URL=https://loop.csi-org.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# LLM 配置
MODEL_API_URL=https://api.stepfun.com/step_plan/v1/chat/completions
MODEL_API_KEY=your-model-api-key-here
MODEL_NAME=step-router-v1
MODEL_TIMEOUT_MS=300000

# 飞书配置
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=your-feishu-secret-here
FEISHU_ALLOWED_TENANT_KEY=your-tenant-key-here
FEISHU_EXPORT_FOLDER_TOKEN=your-folder-token-here

# 认证配置（生成: openssl rand -hex 32）
LOOP_AUTH_SESSION_SECRET=your-32-char-secret-here
LOOP_AUTH_SESSION_TTL_SECONDS=1209600
```

---

### 第 2 步：执行数据库迁移

**方式 A: 使用自动化脚本**

```bash
ssh root@47.95.199.142
bash /var/www/carbon-silicon-org-book/apps/loop-designer/scripts/run-migration.sh
```

**方式 B: 手动执行（推荐）**

1. 打开 https://supabase.com/dashboard
2. 进入你的项目 → SQL Editor
3. 复制以下文件内容并执行：

```bash
# 在本地查看迁移文件
cat supabase/migrations/202606110002_enterprise_subscription.sql
```

**迁移内容**:
- ✅ 5 张新表
- ✅ 4 个新字段
- ✅ 2 个 RPC 函数

---

### 第 3 步：功能测试

访问 https://loop.csi-org.com/loop-designer/ 测试：

- ✅ 飞书登录
- ✅ 邮箱注册
- ✅ 邮箱登录
- ✅ 创建会话
- ✅ 5步对话
- ✅ 生成方案
- ✅ 导出功能
- ✅ 管理后台

**详细测试清单**: [docs/BUSINESS_VERIFICATION.md](docs/BUSINESS_VERIFICATION.md)

---

## 📚 快速参考

### SSH 命令

```bash
# 基本连接
ssh root@47.95.199.142

# 查看 PM2 状态
ssh root@47.95.199.142 'pm2 list'

# 查看日志
ssh root@47.95.199.142 'pm2 logs carbon-silicon-loop-designer'

# 重启应用
ssh root@47.95.199.142 'pm2 restart carbon-silicon-loop-designer'

# 测试本地访问
ssh root@47.95.199.142 'curl -I http://localhost:3010'
```

### 本地命令

```bash
# 一键部署（如果需要更新）
./scripts/deploy-aliyun.sh

# 部署验证
./scripts/verify-deployment.sh

# 一键上线助手
./scripts/go-live.sh
```

---

## 🌐 访问地址

| 方式 | 地址 | 状态 |
|------|------|------|
| **HTTPS** | https://loop.csi-org.com/loop-designer/ | ✅ |
| **HTTP** | http://47.95.199.142/loop-designer/ | ✅ (重定向到 HTTPS) |
| **直接** | http://47.95.199.142:3010/loop-designer/ | ✅ |

---

## 📋 检查清单

完成上线前，确认以下所有项:

- [ ] 环境变量已配置 (11 个)
- [ ] 环境验证通过 (verify-env.mjs)
- [ ] 数据库迁移已执行
- [ ] 应用已重启
- [ ] 飞书登录测试通过
- [ ] 邮箱注册测试通过
- [ ] 创建会话测试通过
- [ ] 管理后台测试通过

---

## 🎯 下一步

1. **立即开始**: [START_HERE_NOW.md](START_HERE_NOW.md)
2. **环境配置**: [docs/CONFIG_SERVER_ENV.md](docs/CONFIG_SERVER_ENV.md)
3. **数据库迁移**: [docs/DATABASE_MIGRATION.md](docs/DATABASE_MIGRATION.md)
4. **功能测试**: [docs/BUSINESS_VERIFICATION.md](docs/BUSINESS_VERIFICATION.md)

---

## 💡 常见问题

### SSH 连接失败

```bash
# 检查 SSH 密钥权限
chmod 600 ~/.ssh/daodecision_aliyun.pem

# 测试连接
ssh -i ~/.ssh/daodecision_aliyun.pem root@47.95.199.142 'uptime'

# 使用详细模式
ssh -vvv -i ~/.ssh/daodecision_aliyun.pem root@47.95.199.142
```

### 应用启动失败

```bash
# 查看错误日志
ssh root@47.95.199.142 'pm2 logs carbon-silicon-loop-designer --err'

# 检查环境变量
ssh root@47.95.199.142 'cat /var/www/carbon-silicon-org-book/apps/loop-designer/.env.local | grep -v "^#" | grep -v "^$"'
```

---

## 📞 获取帮助

- 📧 邮件: support@csi-org.com
- 💬 飞书群: [加入讨论]
- 📖 文档: docs/

---

**最后更新**: 2026-06-11 12:40
**服务器状态**: ✅ 运行中 (PID: 342019)
**HTTPS**: ✅ 已配置
**文档**: ✅ 完整

**准备好上线了吗？从第 1 步开始！** 🚀
