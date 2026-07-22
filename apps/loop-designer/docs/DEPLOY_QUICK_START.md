# 🚀 部署指南

本文档提供碳硅回路设计师的完整部署步骤。

---

## ⚡ 快速开始

### 1. 配置环境变量

```bash
# 方式 A: 交互式配置向导（推荐）
./scripts/setup-env.sh

# 方式 B: 手动配置
cp .env.example .env.local
nano .env.local
```

### 2. 执行数据库迁移

```bash
# 查看指南
open docs/DATABASE_MIGRATION.md

# 在 Supabase SQL Editor 中执行
cat supabase/migrations/202606110002_enterprise_subscription.sql
```

### 3. 构建部署

```bash
# 安装依赖
npm ci

# 构建
npm run build

# 启动（开发/测试）
node .next/standalone/apps/loop-designer/server.js

# 或使用 PM2（生产）
pm2 start ecosystem.config.cjs
```

### 4. 验证部署

```bash
# 自动化验证
./scripts/verify-deployment.sh

# 环境变量验证
node scripts/verify-env.mjs
```

---

## 📋 详细步骤

### 前置条件

- ✅ Node.js 22.x
- ✅ Supabase 项目
- ✅ 飞书应用已创建
- ✅ LLM API 密钥

**详细检查清单**: [GO_LIVE_CHECKLIST.md](GO_LIVE_CHECKLIST.md)

---

## 🔧 部署方式

### 方式 A: 开发/测试部署

```bash
npm ci
npm run build
node .next/standalone/apps/loop-designer/server.js
```

**适用场景**: 本地开发、测试环境

---

### 方式 B: PM2 生产部署

```bash
# 安装 PM2
npm install -g pm2

# 首次启动
pm2 start ecosystem.config.cjs

# 查看状态
pm2 status

# 查看日志
pm2 logs carbon-silicon-loop-designer

# 重启
pm2 restart carbon-silicon-loop-designer

# 开机自启
pm2 startup
pm2 save
```

**适用场景**: 生产环境（单服务器）

---

### 方式 C: Docker 部署（推荐）

```bash
# 构建镜像
docker build -t loop-designer .

# 运行容器
docker run -d \
  -p 3010:3010 \
  --env-file .env.local \
  --name loop-designer \
  loop-designer

# 查看日志
docker logs -f loop-designer

# 停止
docker stop loop-designer
```

**适用场景**: 容器化部署

---

## 🗄️ 数据库迁移

### 首次部署

```bash
# 1. 备份数据库（Supabase Dashboard → Database → Backups）

# 2. 执行迁移
# 打开 Supabase SQL Editor，执行：
cat supabase/migrations/202606110002_enterprise_subscription.sql

# 3. 验证
node scripts/verify-deployment.sh
```

**详细步骤**: [DATABASE_MIGRATION.md](DATABASE_MIGRATION.md)

---

## 🔐 Nginx 配置

### 基础配置

```nginx
server {
    listen 80;
    server_name loop.csi-org.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name loop.csi-org.com;

    ssl_certificate /etc/letsencrypt/live/loop.csi-org.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/loop.csi-org.com/privkey.pem;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;

    location /loop-designer/ {
        proxy_pass http://127.0.0.1:3010/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**启用**:
```bash
sudo ln -s /etc/nginx/sites-available/loop.csi-org.com /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

**详细配置**: [DEPLOYMENT.md](DEPLOYMENT.md#sslhttps-配置)

---

## ✅ 验证部署

### 自动化验证

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

### 手动验证

1. **访问首页**
   ```
   https://loop.csi-org.com/loop-designer/
   ```

2. **测试飞书登录**
   - 点击"飞书登录"
   - 完成 OAuth 授权
   - 验证返回应用

3. **测试邮箱注册**
   ```bash
   curl -X POST https://loop.csi-org.com/loop-designer/api/auth/email/signup \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"password123","displayName":"Test"}'
   ```

4. **测试管理员后台**
   - 登录企业管理员账号
   - 点击"管理后台"
   - 验证成员管理、订阅管理等功能

**详细验证清单**: [BUSINESS_VERIFICATION.md](BUSINESS_VERIFICATION.md)

---

## 🔄 后续部署（升级）

### 代码更新

```bash
cd /var/www/carbon-silicon-org-book/apps/loop-designer
git pull origin main
npm ci
npm run build
pm2 restart carbon-silicon-loop-designer
```

### 数据库迁移

```bash
# 查看新迁移
ls supabase/migrations/ | sort

# 执行迁移
supabase migration up

# 或手动执行新迁移文件
```

---

## 📊 监控

### PM2 日志

```bash
# 实时日志
pm2 logs -f

# 错误日志
pm2 logs --err

# 最近 100 行
pm2 logs --lines 100
```

### 健康检查

```bash
# 创建健康检查脚本
cat > /path/to/healthcheck.sh << 'EOF'
#!/bin/bash
URL="http://127.0.0.1:3010/loop-designer/"
STATUS=$(curl -o /dev/null -s -w "%{http_code}" $URL)
[ "$STATUS" -ne 307 ] && exit 1
EOF

chmod +x /path/to/healthcheck.sh

# 添加到 cron（每 5 分钟）
crontab -e
# 添加: */5 * * * * /path/to/healthcheck.sh >> /var/log/healthcheck.log 2>&1
```

---

## 🚨 故障排查

### 应用无法启动

```bash
# 查看错误日志
pm2 logs --err

# 检查环境变量
cat .env.local

# 测试构建
npm run build
```

### 数据库连接失败

```bash
# 测试连接
node -e "
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
supabase.from('loop_designer_users').select('count');
"
```

### API 返回 404

```bash
# 确认 basePath 配置
grep basePath next.config.ts

# 重新构建
npm run build
```

**更多问题**: [DEPLOYMENT.md#故障排查](DEPLOYMENT.md)

---

## 📞 获取帮助

- 📧 邮件: support@csi-org.com
- 📖 文档: [DEPLOYMENT.md](DEPLOYMENT.md)
- 💬 飞书群: [加入讨论]

---

**最后更新**: 2026-06-11
**文档版本**: v1.0
