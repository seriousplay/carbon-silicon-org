# 🚀 商业级部署完整指南

本文档提供 **碳硅回路设计师** 商业级部署的所有步骤，包括首次部署、升级、故障排查。

---

## 目录

1. [系统要求](#系统要求)
2. [首次部署](#首次部署)
3. [环境配置](#环境配置)
4. [数据库迁移](#数据库迁移)
5. [启动与监控](#启动与监控)
6. [SSL/HTTPS 配置](#sslhttps-配置)
7. [备份与恢复](#备份与恢复)
8. [监控与日志](#监控与日志)
9. [故障排查](#故障排查)
10. [升级流程](#升级流程)

---

## 系统要求

### 服务器配置

| 项目 | 最低配置 | 推荐配置 |
|------|---------|---------|
| CPU | 2核 | 4核+ |
| 内存 | 4GB | 8GB+ |
| 磁盘 | 50GB SSD | 100GB SSD |
| 操作系统 | Ubuntu 20.04+ | Ubuntu 22.04 LTS |
| Node.js | 22.x | 22.x |

### 依赖服务

| 服务 | 版本要求 | 说明 |
|------|---------|------|
| Supabase | 最新 | 数据库和认证 |
| Nginx | 1.18+ | 反向代理 |
| PM2 | 最新 | 进程管理 |

---

## 首次部署

### 方案 A: 使用自动化脚本（推荐）

```bash
# 1. SSH 登录服务器
ssh root@your-server-ip

# 2. 克隆代码
cd /var/www
git clone https://github.com/your-org/carbon-silicon-org-book.git
cd carbon-silicon-org-book/apps/loop-designer

# 3. 运行自动部署脚本
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

脚本将自动完成：
- ✅ 安装系统依赖
- ✅ 配置 Node.js 22
- ✅ 安装 PM2
- ✅ 配置 Nginx
- ✅ 首次数据库迁移
- ✅ SSL 证书（Let's Encrypt）

---

### 方案 B: 手动部署

#### 1. 系统准备

```bash
# 更新系统
apt update && apt upgrade -y

# 安装依赖
apt install -y curl wget git nginx ufw

# 安装 Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
apt install -y nodejs

# 验证安装
node --version  # v22.x
npm --version   # 10.x
```

#### 2. 安装 PM2

```bash
npm install -g pm2

# 设置 PM2 开机自启
pm2 startup
# 执行输出的命令
```

#### 3. 配置防火墙

```bash
# 允许 SSH、HTTP、HTTPS
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

---

## 环境配置

### 1. 创建环境变量文件

```bash
# 复制示例文件
cp .env.example .env.local

# 编辑配置
nano .env.local
```

### 2. 必填环境变量

```bash
# ==================== 应用配置 ====================
NEXT_PUBLIC_SITE_URL=https://loop.csi-org.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# ==================== LLM 配置 ====================
MODEL_API_URL=https://api.stepfun.com/step_plan/v1/chat/completions
MODEL_API_KEY=your-step-api-key
MODEL_NAME=step-router-v1
MODEL_TIMEOUT_MS=300000

# ==================== 飞书集成 ====================
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=your-feishu-secret
FEISHU_ALLOWED_TENANT_KEY=your-tenant-key
FEISHU_EXPORT_FOLDER_TOKEN=your-folder-token

# ==================== 认证会话 ====================
# 生成方法: openssl rand -hex 32
LOOP_AUTH_SESSION_SECRET=your-32-char-secret-minimum
LOOP_AUTH_SESSION_TTL_SECONDS=1209600

# ==================== PDF 生成 ====================
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# ==================== 可选：企业版特性 ====================
# STRIPE_SECRET_KEY=your_stripe_test_secret_here
# STRIPE_WEBHOOK_SECRET=your_stripe_webhook_secret_here
```

### 3. 生成会话密钥

```bash
# Linux/macOS
openssl rand -hex 32

# 或使用 Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 4. 安装 Chromium（PDF 导出需要）

```bash
# Ubuntu/Debian
apt install -y chromium-browser

# 验证
which chromium-browser
# 输出: /usr/bin/chromium-browser
```

---

## 数据库迁移

### ⚠️ 关键步骤：升级现有数据库

如果你的 Supabase 数据库已有旧版本数据，**必须**执行以下迁移：

#### 步骤 1: 备份数据库

```bash
# 在 Supabase Dashboard → SQL Editor 中执行
# 导出所有数据（Supabase 会自动备份，但建议手动确认）
```

#### 步骤 2: 执行迁移脚本

```bash
# 方法 1: 使用 Supabase CLI（推荐）
supabase migration up

# 方法 2: 在 Supabase Dashboard → SQL Editor 中手动执行
# 打开 supabase/migrations/202606110002_enterprise_subscription.sql
# 复制全部内容并执行
```

#### 步骤 3: 验证迁移

在 Supabase Dashboard → SQL Editor 中执行：

```sql
-- 检查新表是否创建成功
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name LIKE 'loop_designer_%'
ORDER BY table_name;

-- 预期输出（应包含 8 个表）：
-- loop_designer_enterprises
-- loop_designer_enterprise_members
-- loop_designer_enterprise_settings
-- loop_designer_invite_codes
-- loop_designer_audit_logs
-- loop_designer_users
-- loop_designer_auth_sessions
-- loop_designer_sessions
```

#### 步骤 4: 检查 RPC 函数

```sql
-- 验证席位管理函数
SELECT proname
FROM pg_proc
WHERE proname IN ('increment_used_seats', 'decrement_used_seats');

-- 预期输出 2 行
```

---

## 启动与监控

### 首次启动

```bash
# 1. 安装依赖
npm ci

# 2. 构建（包含数据库迁移检查）
npm run build

# 3. 使用 PM2 启动
pm2 start ecosystem.config.cjs

# 4. 查看状态
pm2 status

# 5. 保存 PM2 配置
pm2 save
pm2 startup
```

### PM2 常用命令

```bash
# 查看日志
pm2 logs carbon-silicon-loop-designer

# 查看实时日志
pm2 logs carbon-silicon-loop-designer --lines 100

# 重启
pm2 restart carbon-silicon-loop-designer

# 停止
pm2 stop carbon-silicon-loop-designer

# 删除
pm2 delete carbon-silicon-loop-designer

# 监控资源使用
pm2 monit
```

---

## SSL/HTTPS 配置

### 使用 Let's Encrypt（免费）

```bash
# 1. 安装 Certbot
apt install -y certbot python3-certbot-nginx

# 2. 获取证书
certbot --nginx -d loop.csi-org.com

# 3. 测试自动续期
certbot renew --dry-run

# 4. Certbot 会自动配置 Nginx，确认配置
cat /etc/nginx/sites-available/loop.csi-org.com
```

### 手动 Nginx 配置

如果 Certbot 失败，手动编辑：

```bash
nano /etc/nginx/sites-available/loop.csi-org.com
```

```nginx
server {
    listen 80;
    server_name loop.csi-org.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name loop.csi-org.com;

    # SSL 证书
    ssl_certificate /etc/letsencrypt/live/loop.csi-org.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/loop.csi-org.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # 反向代理
    location /loop-designer/ {
        proxy_pass http://127.0.0.1:3010/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 超时设置（AI 生成可能需要较长时间）
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }

    # 静态资源缓存
    location /_next/static/ {
        proxy_pass http://127.0.0.1:3010/_next/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

启用配置：

```bash
ln -s /etc/nginx/sites-available/loop.csi-org.com /etc/nginx/sites-enabled/
nginx -t  # 测试配置
systemctl reload nginx
```

---

## 备份与恢复

### 数据库备份

Supabase 自动备份，但建议定期导出：

```bash
# 1. 使用 Supabase CLI 导出数据
supabase db dump --data-only > backup_data_$(date +%Y%m%d).sql

# 2. 或通过 Dashboard 导出
# Supabase Dashboard → Database → Backups → Download
```

### 应用备份

```bash
# 备份 .env.local
cp .env.local .env.local.backup.$(date +%Y%m%d)

# 备份上传的文件（如有）
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz /path/to/uploads
```

### 恢复流程

```bash
# 1. 停止应用
pm2 stop carbon-silicon-loop-designer

# 2. 恢复数据库
# 在 Supabase Dashboard → SQL Editor 执行 SQL 文件

# 3. 重启应用
pm2 restart carbon-silicon-loop-designer

# 4. 验证
curl https://loop.csi-org.com/loop-designer/
```

---

## 监控与日志

### PM2 日志

```bash
# 查看所有日志
pm2 logs

# 查看错误日志
pm2 logs --err

# 查看指定行数
pm2 logs --lines 200

# 清空日志
pm2 flush
```

### 日志轮转

创建 `/etc/logrotate.d/carbon-silicon-loop-designer`:

```
/var/www/carbon-silicon-org-book/apps/loop-designer/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    notifempty
    create 0640 www-data www-data
    postrotate
        pm2 reloadLogs
    endscript
}
```

### 健康检查

创建 `/var/www/carbon-silicon-org-book/apps/loop-designer/healthcheck.sh`:

```bash
#!/bin/bash
# 健康检查脚本

URL="http://127.0.0.1:3010/loop-designer/"
STATUS=$(curl -o /dev/null -s -w "%{http_code}\n" $URL)

if [ "$STATUS" -ne 200 ] && [ "$STATUS" -ne 308 ]; then
    echo "❌ 健康检查失败: HTTP $STATUS"
    # 发送告警（邮件、钉钉、企业微信等）
    exit 1
else
    echo "✅ 健康检查通过: HTTP $STATUS"
    exit 0
fi
```

添加到 cron：

```bash
chmod +x healthcheck.sh
crontab -e

# 每 5 分钟检查一次
*/5 * * * * /var/www/carbon-silicon-org-book/apps/loop-designer/healthcheck.sh >> /var/log/healthcheck.log 2>&1
```

---

## 故障排查

### 问题 1: 应用无法启动

**症状**: `pm2 start` 后立即退出

**排查步骤**:

```bash
# 1. 查看错误日志
pm2 logs carbon-silicon-loop-designer --err

# 2. 检查环境变量
cat .env.local

# 3. 测试环境变量加载
node -e "require('dotenv').config(); console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"

# 4. 检查端口占用
lsof -i :3010
netstat -tulpn | grep 3010
```

**常见原因**:
- ❌ 环境变量缺失
- ❌ 端口被占用
- ❌ Node.js 版本过低

---

### 问题 2: 数据库迁移失败

**症状**: 应用启动时报 "relation does not exist"

**排查步骤**:

```bash
# 1. 连接到 Supabase
psql -h your-db-host -U postgres -d postgres

# 2. 列出所有表
\dt loop_designer_*

# 3. 如果缺少表，手动执行迁移
# 在 Supabase Dashboard → SQL Editor 中执行
# supabase/migrations/202606110002_enterprise_subscription.sql
```

---

### 问题 3: 飞书登录失败

**症状**: 点击"飞书登录"后跳转到错误页

**排查步骤**:

```bash
# 1. 检查环境变量
grep FEISHU .env.local

# 2. 查看飞书开放平台配置
# 确认以下配置正确：
# - App ID
# - App Secret
# - 重定向 URL: https://loop.csi-org.com/loop-designer/api/auth/feishu/callback
# - 权限范围: contact:user.base:readonly, unit_talk_space:all

# 3. 查看应用日志
pm2 logs | grep feishu
```

---

### 问题 4: API 返回 404

**症状**: API 路由无法访问

**原因**: standalone 模式下路径映射错误

**解决方案**:

```bash
# 1. 确认使用正确的启动方式
# ❌ 错误: npm start (会使用 next start)
# ✅ 正确: node .next/standalone/apps/loop-designer/server.js

# 2. 验证构建包含所有路由
grep -r "api/sessions" .next/standalone/apps/loop-designer/.next/server/chunks/ | head -5

# 3. 重新构建
npm run build
pm2 restart carbon-silicon-loop-designer
```

---

### 问题 5: PDF 导出失败

**症状**: 点击"导出 PDF"后生成失败

**排查步骤**:

```bash
# 1. 检查 Chromium 路径
which chromium-browser
# 应在 .env.local 中一致
grep CHROMIUM .env.local

# 2. 测试 Puppeteer
node -e "
const puppeteer = require('puppeteer-core');
(async () => {
  const browser = await puppeteer.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium-browser'
  });
  console.log('✅ Chromium 启动成功');
  await browser.close();
})();
"

# 3. 如果失败，安装缺失依赖
apt install -y libgbm1 libasound2 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdbus-1-3 libdrm2 libgtk-3-0 libnspr4 libnss3 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxrandr2 libxss1 libxtst6 ca-certificates
```

---

## 升级流程

### 1. 代码升级

```bash
# 1. 拉取最新代码
cd /var/www/carbon-silicon-org-book/apps/loop-designer
git pull origin main

# 2. 安装新依赖（如有）
npm ci

# 3. 检查环境变量变更
git diff HEAD~1 .env.example
# 如果有新变量，更新 .env.local

# 4. 重新构建
npm run build

# 5. 检查新迁移
ls supabase/migrations/ | sort
# 如果有新文件，执行迁移

# 6. 重启应用
pm2 restart carbon-silicon-loop-designer

# 7. 验证
curl https://loop.csi-org.com/loop-designer/
```

### 2. 数据库迁移（升级时）

```bash
# 方法 1: Supabase CLI
supabase migration up

# 方法 2: 手动执行
# 在 Supabase Dashboard → SQL Editor 中执行新的迁移文件
```

### 3. 零停机部署

```bash
# 使用 PM2  reload 实现零停机
pm2 reload carbon-silicon-loop-designer

# 或使用多进程模式
pm2 start ecosystem.config.cjs -i 2
```

---

## 安全检查清单

部署前确认：

- [ ] `.env.local` 已配置所有必填环境变量
- [ ] `LOOP_AUTH_SESSION_SECRET` ≥ 32 字符
- [ ] `SUPABASE_SERVICE_ROLE_KEY` 安全存储
- [ ] RLS 策略已在 Supabase 中启用
- [ ] Nginx 已配置 HTTPS（非 HTTP）
- [ ] 防火墙已限制端口（仅 22, 80, 443 开放）
- [ ] PM2 日志轮转已配置
- [ ] 数据库自动备份已启用
- [ ] 健康检查脚本已配置
- [ ] SSL 证书自动续期已测试

---

## 商业级功能验证

部署完成后，验证以下商业功能：

### ✅ 基础功能

- [ ] 用户可以访问 https://loop.csi-org.com/loop-designer/
- [ ] 飞书用户可以正常登录
- [ ] 邮箱用户可以正常注册和登录
- [ ] 用户可以创建设计会话
- [ ] 用户可以完成 5 步对话流程
- [ ] LLM 可以生成回路方案
- [ ] 用户可以导出 Markdown、PDF、飞书文档

### ✅ 企业管理员功能

- [ ] 企业超级管理员可以看到"管理后台"入口
- [ ] 成员管理：可以查看、添加、移除企业成员
- [ ] 成员管理：可以更改成员角色（超级管理员、计费管理员、成员管理员、成员）
- [ ] 订阅管理：可以查看当前订阅状态和席位使用情况
- [ ] 订阅管理：可以升级/降级订阅（免费版 → 专业版 → 企业版）
- [ ] 审计日志：可以查看所有管理员操作记录
- [ ] 企业设置：可以配置 AI 模型、数据保留策略等

### ✅ 邀请码系统

- [ ] 管理员可以生成邀请码（限次/限时）
- [ ] 用户可以使用邀请码加入企业
- [ ] 邀请码使用次数和过期时间正确限制

### ✅ 平台管理（可选）

- [ ] 平台管理员可以查看所有企业
- [ ] 平台管理员可以管理企业订阅状态
- [ ] 平台管理员可以查看全局审计日志

---

## 附录

### A. 环境变量完整清单

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `NEXT_PUBLIC_SITE_URL` | ✅ | 应用 URL |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 公开密钥 |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ | Supabase 服务角色密钥 |
| `MODEL_API_URL` | ✅ | LLM API 地址 |
| `MODEL_API_KEY` | ✅ | LLM API 密钥 |
| `MODEL_NAME` | ✅ | LLM 模型名称 |
| `MODEL_TIMEOUT_MS` | ⭕ | LLM 超时时间（默认 300000） |
| `CHROMIUM_EXECUTABLE_PATH` | ✅ | Chromium 路径（PDF 导出） |
| `FEISHU_APP_ID` | ✅ | 飞书应用 ID |
| `FEISHU_APP_SECRET` | ✅ | 飞书应用密钥 |
| `FEISHU_ALLOWED_TENANT_KEY` | ✅ | 允许的企业租户 Key |
| `FEISHU_EXPORT_FOLDER_TOKEN` | ✅ | 飞书导出文件夹 Token |
| `LOOP_AUTH_SESSION_SECRET` | ✅ | 会话加密密钥（≥32 字符） |
| `LOOP_AUTH_SESSION_TTL_SECONDS` | ⭕ | 会话有效期（默认 14 天） |

### B. 数据库表清单

| 表名 | 说明 |
|------|------|
| `loop_designer_users` | 用户表（飞书 + 邮箱） |
| `loop_designer_auth_sessions` | 认证会话表 |
| `loop_designer_sessions` | 设计会话表 |
| `loop_designer_enterprises` | 企业表 |
| `loop_designer_enterprise_members` | 企业成员表 |
| `loop_designer_invite_codes` | 邀请码表 |
| `loop_designer_audit_logs` | 审计日志表 |
| `loop_designer_enterprise_settings` | 企业设置表 |

### C. RPC 函数清单

| 函数名 | 说明 |
|--------|------|
| `increment_used_seats` | 增加企业席位（原子操作） |
| `decrement_used_seats` | 减少企业席位（原子操作） |

---

## 支持与反馈

- 📧 技术支持：support@csi-org.com
- 📖 产品文档：https://docs.csi-org.com/loop-designer
- 🐛 问题反馈：https://github.com/your-org/carbon-silicon-org-book/issues

---

**最后更新**: 2026-06-11
**文档版本**: v1.0
**维护者**: 碳硅回路设计师团队
