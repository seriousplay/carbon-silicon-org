# 部署指南

## 目录

1. [快速部署](#快速部署)
2. [环境准备](#环境准备)
3. [部署步骤](#部署步骤)
4. [配置 Nginx](#配置-nginx)
5. [验证部署](#验证部署)
6. [常见问题](#常见问题)

---

## 快速部署

### 前提条件

- ✅ 阿里云服务器已准备（Ubuntu 20.04+）
- ✅ SSH 密钥已配置
- ✅ 数据库迁移已执行（Phase 1 + Phase 2）
- ✅ 环境变量已配置

### 一键部署

```bash
# 设置环境变量（可选）
export ALIYUN_HOST=47.95.199.142
export ALIYUN_USER=root
export ALIYUN_KEY=$HOME/.ssh/daodecision_aliyun.pem

# 执行部署
./scripts/deploy-aliyun.sh
```

---

## 环境准备

### 1. 服务器基本信息

**当前配置**：
- **主机**：47.95.199.142
- **用户**：root
- **SSH Key**：`~/.ssh/daodecision_aliyun.pem`
- **应用目录**：`/var/www/carbon-silicon-org-book/apps/loop-designer`

### 2. 服务器依赖

SSH 到服务器并安装依赖：

```bash
ssh root@47.95.199.142

# 更新系统
apt-get update && apt-get upgrade -y

# 安装 Node.js 20+
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 安装 PM2
npm install -g pm2

# 安装 Nginx
apt-get install -y nginx

# 安装 Git（如果需要）
apt-get install -y git

# 安装 Chromium（PDF 生成需要）
apt-get install -y chromium-browser

# 验证安装
node --version  # v20.x
npm --version
pm2 --version
nginx -v
```

### 3. 配置防火墙

```bash
# 开放必要端口
ufw allow 22/tcp   # SSH
ufw allow 80/tcp   # HTTP
ufw allow 443/tcp  # HTTPS
ufw allow 3010/tcp # 应用端口（可选，仅用于本地测试）

# 启用防火墙
ufw enable

# 查看状态
ufw status
```

---

## 部署步骤

### 步骤 1：本地构建

```bash
cd apps/loop-designer

# 设置环境变量
cp .env.example .env.local
vim .env.local  # 编辑环境变量

# 本地构建（可选，会在服务器上重新构建）
npm ci
npm run build
```

### 步骤 2：执行部署脚本

```bash
cd apps/loop-designer

# 方式1：使用默认配置
./scripts/deploy-aliyun.sh

# 方式2：自定义配置
export ALIYUN_HOST=your-server-ip
export ALIYUN_USER=root
export ALIYUN_KEY=~/.ssh/your-key.pem
export REMOTE_ROOT=/var/www/your-app
./scripts/deploy-aliyun.sh
```

**部署脚本会自动执行**：
1. ✅ 检查本地构建
2. ✅ 同步文件到服务器（排除 node_modules, .next）
3. ✅ 在服务器上安装依赖（npm ci）
4. ✅ 在服务器上构建（npm run build）
5. ✅ 启动/重启 PM2 进程
6. ✅ 保存 PM2 配置

### 步骤 3：配置环境变量（服务器上）

SSH 到服务器：

```bash
ssh root@47.95.199.142
cd /var/www/carbon-silicon-org-book/apps/loop-designer
```

创建 `.env.local`：

```bash
cat > .env.local << 'EOF'
# App
NEXT_PUBLIC_SITE_URL=https://loop.csi-org.com
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-key

# LLM
MODEL_BASE_URL=https://api.stepfun.com
MODEL_API_KEY=your-model-api-key
MODEL_NAME=step-router-v1
MODEL_TIMEOUT_MS=300000

# PDF
CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

# Feishu
FEISHU_APP_ID=your-feishu-app-id
FEISHU_APP_SECRET=your-feishu-app-secret
FEISHU_ALLOWED_TENANT_KEY=your-tenant-key
FEISHU_EXPORT_FOLDER_TOKEN=your-folder-token

# Auth
LOOP_AUTH_SESSION_SECRET=your-32-char-random-secret
LOOP_AUTH_SESSION_TTL_SECONDS=1209600
EOF
```

**重要**：生产环境必须设置 `LOOP_AUTH_SESSION_SECRET` 为随机的 32+ 字符字符串。

### 步骤 4：重启应用

```bash
# 重启 PM2 进程
pm2 restart carbon-silicon-loop-designer

# 或重启所有
pm2 restart all

# 查看日志
pm2 logs carbon-silicon-loop-designer

# 查看状态
pm2 list
```

---

## 配置 Nginx

### 1. 基础配置

创建 `/etc/nginx/conf.d/loop-designer.conf`：

```nginx
server {
  listen 80;
  server_name 47.95.199.142;

  # 碳硅回路设计师
  location /loop-designer/ {
    proxy_pass http://127.0.0.1:3010/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # 超时设置（AI 生成可能需要较长时间）
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
  }

  # 静态资源缓存
  location /loop-designer/_next/static/ {
    proxy_pass http://127.0.0.1:3010/_next/static/;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

### 2. 测试并生效

```bash
# 测试配置
nginx -t

# 重新加载
nginx -s reload

# 查看配置
nginx -T | grep -A 20 loop-designer
```

---

## 验证部署

### 1. 检查应用状态

```bash
# PM2 状态
pm2 list

# 期望输出：
# ┌──────────────────────────────────────┬──────────┬─────────┬─────────┐
# │ App                                 │ Status   │ PID     │ Memory  │
# ├──────────────────────────────────────┼──────────┼─────────┼─────────┤
# │ carbon-silicon-loop-designer        │ online   │ xxxxx   │ xx.x MB │
# └──────────────────────────────────────┴──────────┴─────────┴─────────┘
```

### 2. 检查端口监听

```bash
# 检查端口 3010
ss -tlnp | grep 3010

# 期望输出：
# LISTEN 0 4096 127.0.0.1:3010 ...
```

### 3. 测试访问

```bash
# 本地测试
curl -I http://localhost:3010/

# 通过 Nginx 测试
curl -I http://47.95.199.142/loop-designer/

# 测试 API
curl http://47.95.199.142/loop-designer/api/sessions
```

### 4. 浏览器测试

打开浏览器访问：
- `http://47.95.199.142/loop-designer/`

应该看到碳硅回路设计师的首页。

---

## 常见问题

### 问题1：PM2 启动失败

```bash
# 查看详细日志
pm2 logs carbon-silicon-loop-designer --lines 100

# 检查环境变量
cat /var/www/carbon-silicon-org-book/apps/loop-designer/.env.local

# 手动启动看错误
cd /var/www/carbon-silicon-org-book/apps/loop-designer
node .next/standalone/apps/loop-designer/server.js
```

### 问题2：Nginx 502 Bad Gateway

```bash
# 检查应用是否运行
pm2 list
curl http://localhost:3010/

# 检查 Nginx 日志
tail -f /var/log/nginx/error.log
```

### 问题3：静态资源 404

```bash
# 检查 .next/static 是否存在
ls -la /var/www/carbon-silicon-org-book/apps/loop-designer/.next/standalone/apps/loop-designer/.next/static/

# 重新构建
cd /var/www/carbon-silicon-org-book/apps/loop-designer
npm run build
```

### 问题4：权限不足

```bash
# 修复文件权限
chown -R www-data:www-data /var/www/carbon-silicon-org-book/apps/loop-designer

# 或使用 root 运行 PM2
pm2 start ecosystem.config.cjs --uid root
```

---

## 后续步骤

1. ✅ **配置 HTTPS**（使用 Certbot）
2. ✅ **配置域名**（DNS 解析）
3. ✅ **配置日志轮转**（logrotate）
4. ✅ **配置监控**（PM2 Plus / 阿里云监控）
5. ✅ **配置备份**（数据库备份脚本）

---

## 监控与维护

### 查看日志

```bash
# PM2 日志
pm2 logs carbon-silicon-loop-designer

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log

# 应用日志
tail -f /var/www/carbon-silicon-org-book/apps/loop-designer/logs/out.log
```

### 更新应用

```bash
# 方式1：使用部署脚本
./scripts/deploy-aliyun.sh

# 方式2：手动更新
ssh root@47.95.199.142
cd /var/www/carbon-silicon-org-book/apps/loop-designer
git pull
npm ci
npm run build
pm2 restart carbon-silicon-loop-designer
```

### 数据库备份

```bash
# 使用 Supabase CLI
supabase db dump -f backup.sql

# 或通过 Supabase Dashboard 导出
```
