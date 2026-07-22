# 🚀 上线执行清单

**项目**: 碳硅回路设计师
**目标**: 安全、顺利地完成首次商业级部署
**预计时间**: 2-3 小时

---

## 📋 前置检查

### 准备工作

- [ ] 代码已更新到最新版本: `git pull origin main`
- [ ] Supabase 项目已创建
- [ ] 飞书应用已创建并配置
- [ ] LLM API 密钥已获取
- [ ] 服务器已准备（或本地测试环境）

---

## ✅ 阶段 1: 数据库迁移（30 分钟）

### 步骤 1.1: 备份数据库

```bash
# 方式 A: Supabase Dashboard
# https://supabase.com/dashboard → Database → Backups → Create manual backup

# 方式 B: Supabase CLI
supabase db dump --data-only > backup_$(date +%Y%m%d).sql
```

**验证**:
- [ ] 备份文件存在
- [ ] 备份文件大小 > 0

---

### 步骤 1.2: 执行迁移

**推荐方式**: Supabase Dashboard

```bash
# 1. 打开迁移文件
cat supabase/migrations/202606110002_enterprise_subscription.sql

# 2. 复制全部内容

# 3. 粘贴到 Supabase SQL Editor → Run
```

**验证**:
```sql
-- 检查新表
SELECT table_name FROM information_schema.tables
WHERE table_name LIKE 'loop_designer_enterprise%';
-- 期望: 5 行
```

**详细文档**: [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md)

---

## ✅ 阶段 2: 环境配置（30 分钟）

### 步骤 2.1: 复制环境变量模板

```bash
cp .env.example .env.local
```

---

### 步骤 2.2: 配置必填变量

按顺序填写以下变量:

#### 应用配置
```bash
NEXT_PUBLIC_SITE_URL=https://loop.csi-org.com
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGci...
```

#### LLM 配置
```bash
MODEL_API_URL=https://api.stepfun.com/step_plan/v1/chat/completions
MODEL_API_KEY=sk-xxx
MODEL_NAME=step-router-v1
MODEL_TIMEOUT_MS=300000
```

#### 飞书配置
```bash
FEISHU_APP_ID=cli_xxx
FEISHU_APP_SECRET=xxx
FEISHU_ALLOWED_TENANT_KEY=xxx
FEISHU_EXPORT_FOLDER_TOKEN=xxx  # 可选
```

#### 认证配置
```bash
# 生成: openssl rand -hex 32
LOOP_AUTH_SESSION_SECRET=a1b2c3d4e5f6...（32+字符）
LOOP_AUTH_SESSION_TTL_SECONDS=1209600
```

#### PDF 配置（可选）
```bash
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

---

### 步骤 2.3: 验证环境变量

```bash
# 运行验证脚本
node scripts/verify-env.mjs

# 期望输出: ✅ 所有环境变量已配置
```

---

### 步骤 2.4: 验证外部服务

#### 测试数据库连接
```bash
node -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
const { count } = await supabase.from('loop_designer_users').select('*', { count: 'exact', head: true });
console.log('✅ 数据库连接成功, 用户数:', count);
"
```

#### 测试 LLM API
```bash
curl -X POST $MODEL_API_URL \
  -H "Authorization: Bearer $MODEL_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"test","messages":[{"role":"user","content":"Say hi"}],"max_tokens":10}'
```

**详细文档**: [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)

---

## ✅ 阶段 3: 构建与部署（20 分钟）

### 步骤 3.1: 安装依赖

```bash
npm ci
```

---

### 步骤 3.2: 构建生产版本

```bash
npm run build
```

**验证**:
- [ ] 构建成功（无错误）
- [ ] 生成 `.next/standalone/` 目录

---

### 步骤 3.3: 启动应用

```bash
# 开发环境测试
node .next/standalone/apps/loop-designer/server.js

# 或使用 PM2（推荐生产）
pm2 start ecosystem.config.cjs
```

**验证**:
```bash
curl -I http://127.0.0.1:3000/loop-designer/
# 期望: HTTP 307
```

---

### 步骤 3.4: 运行部署验证

```bash
./scripts/verify-deployment.sh
```

**期望输出**:
```
✅ 所有测试通过！
总计: 16
通过: 16
失败: 0
```

---

## ✅ 阶段 4: 功能测试（40 分钟）

### 步骤 4.1: 基础功能测试

#### 4.1.1 飞书登录测试

1. [ ] 打开 https://loop.csi-org.com/loop-designer/
2. [ ] 点击"飞书登录"
3. [ ] 完成 OAuth 授权
4. [ ] 验证返回应用

**预期结果**:
- [ ] 页面显示"飞书用户：[用户名]"
- [ ] 自动创建企业记录（首次登录）

**数据库验证**:
```sql
SELECT * FROM loop_designer_users
WHERE auth_provider = 'feishu'
ORDER BY created_at DESC LIMIT 1;

SELECT * FROM loop_designer_enterprises
ORDER BY created_at DESC LIMIT 1;
```

---

#### 4.1.2 邮箱注册测试

```bash
curl -X POST https://loop.csi-org.com/loop-designer/api/auth/email/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test1@example.com",
    "password": "password123",
    "displayName": "测试用户"
  }'
```

**预期结果**:
- [ ] 返回 `{ "success": true, "user": {...} }`

**数据库验证**:
```sql
SELECT * FROM loop_designer_users
WHERE email = 'test1@example.com';
-- 期望: auth_provider = 'email', password_hash 存在
```

---

#### 4.1.3 邮箱登录测试

```bash
curl -X POST https://loop.csi-org.com/loop-designer/api/auth/email/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test1@example.com",
    "password": "password123"
  }'
```

**预期结果**:
- [ ] 返回 `{ "success": true }`
- [ ] 设置 Session Cookie

---

### 步骤 4.2: 会话设计功能测试

#### 4.2.1 创建新会话

1. [ ] 登录应用
2. [ ] 点击"新建会话"
3. [ ] 填写会话名称

**预期结果**:
- [ ] 创建成功
- [ ] 跳转到设计工作台

---

#### 4.2.2 完成 5 步对话

**步骤**:
1. [ ] **选定回路** - 选择回路类型
2. [ ] **拆解价值流** - 填写 5 个阶段
3. [ ] **定位阻塞** - 描述瓶颈
4. [ ] **组织映射** - 映射角色
5. [ ] **定义目标** - 设定指标

**验证**:
- [ ] 每步可以保存
- [ ] 进度指示器正确更新
- [ ] 第 5 步完成后可以"生成方案"

---

#### 4.2.3 生成方案

1. [ ] 完成所有 5 步
2. [ ] 点击"生成方案"
3. [ ] 等待 LLM 响应（约 30-60 秒）

**预期结果**:
- [ ] 状态变为 "generating"
- [ ] 生成完成后显示方案
- [ ] 方案包含：回路蓝图、组织映射、治理指标、行动计划

---

#### 4.2.4 导出方案

**Markdown 导出**:
```bash
curl -H "Cookie: loop_designer_session=YOUR_TOKEN" \
  https://loop.csi-org.com/loop-designer/api/sessions/[id]/exports/markdown
```

**PDF 导出**:
```bash
curl -H "Cookie: loop_designer_session=YOUR_TOKEN" \
  https://loop.csi-org.com/loop-designer/api/sessions/[id]/exports/pdf
```

**验证**:
- [ ] Markdown 文件下载成功
- [ ] PDF 文件下载成功（如果配置了 Chromium）

---

### 步骤 4.3: 企业管理员功能测试

#### 4.3.1 访问管理后台

1. [ ] 使用企业超级管理员账号登录
2. [ ] 检查首页右上角

**预期结果**:
- [ ] 显示"管理后台"按钮（紫色）
- [ ] 点击后进入 `/admin/enterprise`

---

#### 4.3.2 成员管理

1. [ ] 进入"成员管理" Tab
2. [ ] 查看成员列表

**验证**:
- [ ] 显示所有成员
- [ ] 显示席位使用情况

**添加成员测试**:
```bash
# 方式 1: 生成邀请码
curl -X POST https://loop.csi-org.com/loop-designer/api/admin/invites \
  -H "Cookie: loop_designer_session=ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"maxUses": 5}'

# 复制邀请码
# 方式 2: 新用户注册时使用邀请码
```

---

#### 4.3.3 角色管理

1. [ ] 进入成员管理
2. [ ] 点击某个成员的"更改角色"
3. [ ] 选择"成员管理员"

**验证**:
- [ ] 角色可以更改
- [ ] 审计日志记录变更

---

#### 4.3.4 订阅管理

1. [ ] 进入"订阅管理" Tab
2. [ ] 查看当前订阅状态

**验证**:
- [ ] 显示当前套餐（免费版）
- [ ] 显示席位使用情况
- [ ] 显示试用期信息

**升级测试**:
1. [ ] 点击"升级到专业版"
2. [ ] 确认对话框
3. [ ] 验证升级成功

**数据库验证**:
```sql
SELECT subscription_tier, seat_limit
FROM loop_designer_enterprises
WHERE id = 'your-enterprise-id';
-- 期望: subscription_tier = 'pro', seat_limit = 999
```

---

#### 4.3.5 审计日志

1. [ ] 进入"审计日志" Tab
2. [ ] 查看操作记录

**验证**:
- [ ] 显示登录、成员添加、角色更改等操作
- [ ] 按时间倒序排列

---

## ✅ 阶段 5: 生产环境配置（30 分钟）

### 步骤 5.1: 配置 Nginx

```bash
# 编辑 Nginx 配置
sudo nano /etc/nginx/sites-available/loop.csi-org.com
```

**配置内容**:
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

    # 安全头
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Strict-Transport-Security "max-age=31536000" always;

    # 反向代理
    location /loop-designer/ {
        proxy_pass http://127.0.0.1:3010/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 60s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
    }
}
```

**启用配置**:
```bash
sudo ln -s /etc/nginx/sites-available/loop.csi-org.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

### 步骤 5.2: 配置 SSL

```bash
# 使用 Let's Encrypt（自动配置 Nginx）
sudo certbot --nginx -d loop.csi-org.com

# 测试自动续期
sudo certbot renew --dry-run
```

---

### 步骤 5.3: 配置 PM2

```bash
# 安装 PM2（如果未安装）
npm install -g pm2

# 启动应用
pm2 start ecosystem.config.cjs

# 设置开机自启
pm2 startup
pm2 save
```

---

### 步骤 5.4: 配置防火墙

```bash
# 允许 SSH、HTTP、HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status
```

---

## ✅ 阶段 6: 监控与日志（15 分钟）

### 步骤 6.1: 配置健康检查

```bash
# 创建健康检查脚本
cat > /var/www/carbon-silicon-org-book/apps/loop-designer/healthcheck.sh << 'EOF'
#!/bin/bash
URL="http://127.0.0.1:3010/loop-designer/"
STATUS=$(curl -o /dev/null -s -w "%{http_code}" $URL)

if [ "$STATUS" -ne 307 ]; then
  echo "❌ Health check failed: HTTP $STATUS"
  # TODO: 发送告警
  exit 1
else
  echo "✅ Health check passed: HTTP $STATUS"
  exit 0
fi
fi
EOF

chmod +x /var/www/carbon-silicon-org-book/apps/loop-designer/healthcheck.sh

# 添加到 cron（每 5 分钟）
crontab -e
# 添加: */5 * * * * /var/www/.../healthcheck.sh >> /var/log/healthcheck.log 2>&1
```

---

### 步骤 6.2: 配置日志轮转

```bash
sudo nano /etc/logrotate.d/carbon-silicon-loop-designer
```

**内容**:
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

---

### 步骤 6.3: 配置错误告警（可选）

```bash
# 方法 1: 使用 PM2 + 邮件
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30

# 方法 2: 使用 Sentry（推荐）
npm install @sentry/nextjs
# 配置 SENTRY_DSN
```

---

## ✅ 阶段 7: 最终验证（15 分钟）

### 步骤 7.1: 运行完整验证

```bash
./scripts/verify-deployment.sh
```

**期望**: ✅ 所有测试通过

---

### 步骤 7.2: 手动功能测试

按 **阶段 4** 的步骤完成手动测试

---

### 步骤 7.3: 性能测试

```bash
# 测试首页响应时间
time curl -s https://loop.csi-org.com/loop-designer/ > /dev/null
# 期望: < 2s

# 使用 Apache Bench 测试并发
ab -n 1000 -c 10 https://loop.csi-org.com/loop-designer/
# 期望: 成功率 > 99%, 平均响应 < 200ms
```

---

## ✅ 阶段 8: 上线准备（10 分钟）

### 步骤 8.1: 更新 DNS

```
域名: loop.csi-org.com
类型: A
值: 你的服务器 IP
TTL: 300（5 分钟）
```

**验证**:
```bash
dig loop.csi-org.com
# 期望: 返回服务器 IP

# 等待 DNS 传播（通常 5-30 分钟）
```

---

### 步骤 8.2: 配置监控告警（可选）

- [ ] 配置 Uptime Kuma / Pingdom（网站可用性监控）
- [ ] 配置 Sentry（错误追踪）
- [ ] 配置 Prometheus + Grafana（性能监控）

---

### 步骤 8.3: 通知团队

- [ ] 通知开发团队上线完成
- [ ] 通知产品团队开始测试
- [ ] 更新内部文档

---

## 📊 上线检查清单

### 数据库

- [ ] 迁移已执行
- [ ] 所有表创建成功
- [ ] RLS 策略已启用
- [ ] RPC 函数测试通过

### 环境配置

- [ ] 所有必填环境变量已配置
- [ ] 外部服务（LLM、飞书）已测试
- [ ] SSL 证书已配置
- [ ] Cookie 安全标志已启用

### 应用

- [ ] 构建成功
- [ ] 应用启动正常
- [ ] 部署验证全部通过
- [ ] 基础功能测试通过

### 基础设施

- [ ] Nginx 已配置
- [ ] PM2 已配置
- [ ] 防火墙已配置
- [ ] 健康检查已配置

### 监控

- [ ] 日志轮转已配置
- [ ] 错误告警已配置（可选）
- [ ] 性能监控已配置（可选）

---

## 🎉 上线完成

完成以上所有步骤后：

- ✅ **网站可访问**: https://loop.csi-org.com/loop-designer/
- ✅ **飞书登录**: 正常工作
- ✅ **邮箱登录**: 正常工作
- ✅ **企业管理员功能**: 成员、订阅、审计日志、设置
- ✅ **邀请码系统**: 可以生成和使用邀请码
- ✅ **订阅管理**: 免费/专业/企业三级

---

## 📞 获取帮助

如果遇到问题：

1. 📖 查看 [故障排查指南](../DEPLOYMENT.md#故障排查)
2. 📧 邮件: support@csi-org.com
3. 💬 飞书群: [加入讨论]

---

**清单版本**: v1.0
**最后更新**: 2026-06-11
**维护者**: 碳硅回路设计师团队
