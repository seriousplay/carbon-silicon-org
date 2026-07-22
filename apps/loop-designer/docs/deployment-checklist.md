# Phase 1 + Phase 2 部署清单

## 部署前检查

### ✅ 数据库迁移
- [x] Phase 1 迁移已执行（`combined_phase1_phase2.sql`）
- [x] 验证查询通过（7张表存在）
- [x] 数据完整性检查通过
- [x] 测试数据已生成（可选）

### ✅ 环境变量配置
- [x] `.env.local` 已创建
- [x] Supabase 配置正确
- [x] LLM API 配置正确
- [x] 飞书应用配置正确
- [x] `LOOP_AUTH_SESSION_SECRET` 已设置

### ✅ 本地构建
- [x] `npm ci` 成功
- [x] `npm run build` 成功
- [x] 无 TypeScript 错误
- [x] 所有路由生成成功

---

## 部署步骤

### 步骤 1：本地准备

```bash
cd apps/loop-designer

# 1. 确保代码是最新的
git pull origin main

# 2. 安装依赖
npm ci

# 3. 本地构建测试
npm run build
```

### 步骤 2：执行部署脚本

```bash
# 方式1：使用默认配置
./scripts/deploy-aliyun.sh

# 方式2：自定义配置
export ALIYUN_HOST=47.95.199.142
export ALIYUN_USER=root
export ALIYUN_KEY=$HOME/.ssh/daodecision_aliyun.pem
export REMOTE_ROOT=/var/www/carbon-silicon-org-book
./scripts/deploy-aliyun.sh
```

**部署脚本会自动执行**：
1. ✅ 检查本地构建
2. ✅ 创建远程目录
3. ✅ 同步文件到服务器（rsync）
4. ✅ 在服务器上安装依赖
5. ✅ 在服务器上构建
6. ✅ 启动/重启 PM2
7. ✅ 保存 PM2 配置

### 步骤 3：服务器配置

SSH 到服务器：

```bash
ssh root@47.95.199.142
```

#### 3.1 配置环境变量

```bash
cd /var/www/carbon-silicon-org-book/apps/loop-designer

cat > .env.local << 'EOF'
NEXT_PUBLIC_SITE_URL=https://loop.csi-org.com
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

MODEL_BASE_URL=https://api.stepfun.com
MODEL_API_KEY=your-model-api-key
MODEL_NAME=step-router-v1
MODEL_TIMEOUT_MS=300000

CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium-browser

FEISHU_APP_ID=your-app-id
FEISHU_APP_SECRET=your-app-secret
FEISHU_ALLOWED_TENANT_KEY=your-tenant-key
FEISHU_EXPORT_FOLDER_TOKEN=your-folder-token

LOOP_AUTH_SESSION_SECRET=random-32-char-secret-here
LOOP_AUTH_SESSION_TTL_SECONDS=1209600
EOF
```

#### 3.2 重启应用

```bash
pm2 restart carbon-silicon-loop-designer
pm2 save
```

### 步骤 4：配置 Nginx

在服务器上创建 Nginx 配置：

```bash
cat > /etc/nginx/conf.d/loop-designer.conf << 'EOF'
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

    # 超时设置（AI 生成需要较长时间）
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
EOF

# 测试配置
nginx -t

# 重新加载
nginx -s reload
```

---

## 验证部署

### 1. 检查 PM2 状态

```bash
pm2 list

# 期望：
# carbon-silicon-loop-designer | online | PID | Memory
```

### 2. 检查端口

```bash
ss -tlnp | grep 3010
# 应该看到 127.0.0.1:3010
```

### 3. 测试本地访问

```bash
curl -I http://localhost:3010/
# 应该返回 HTTP/1.1 200 OK
```

### 4. 测试 Nginx 代理

```bash
curl -I http://47.95.199.142/loop-designer/
# 应该返回 HTTP/1.1 200 OK
```

### 5. 测试 API

```bash
curl http://47.95.199.142/loop-designer/api/sessions
# 应该返回 {"error":"Unauthorized"}（未登录状态）
```

### 6. 浏览器访问

打开浏览器访问：
- `http://47.95.199.142/loop-designer/`

应该看到：
- ✅ 首页正常显示
- ✅ 可以点击飞书登录
- ✅ 登录后可以看到"管理后台"链接（如果是管理员）

---

## 数据库配置

### 重要：确保服务器使用正确的 Supabase 数据库

回路设计师的数据存储在 Supabase 云数据库中，**不需要在服务器上配置数据库**。

部署前请确认：
1. ✅ `.env.local` 中的 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY` 正确
2. ✅ 服务器可以访问 Supabase（检查网络连接）
3. ✅ 数据库迁移已在 Supabase 控制台执行

测试数据库连接：

```bash
cd /var/www/carbon-silicon-org-book/apps/loop-designer
node -e "
const { createClient } = require('@supabase/supabase-js');
const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);
admin.from('loop_designer_enterprises').select('count').then(r => {
  console.log('Database connection:', r.error ? 'FAILED' : 'OK');
  if (r.error) console.error(r.error);
});
"
```

---

## 故障排查

### 问题 1：PM2 启动失败

```bash
# 查看详细日志
pm2 logs carbon-silicon-loop-designer --lines 100

# 检查错误
pm2 describe carbon-silicon-loop-designer

# 手动启动看错误
cd /var/www/carbon-silicon-org-book/apps/loop-designer
node .next/standalone/apps/loop-designer/server.js
```

### 问题 2：Nginx 502 Bad Gateway

```bash
# 检查应用是否运行
curl http://localhost:3010/

# 检查 Nginx 错误日志
tail -30 /var/log/nginx/error.log

# 检查 PM2 状态
pm2 list
```

### 问题 3：静态资源 404

```bash
# 检查静态文件是否存在
ls -la /var/www/carbon-silicon-org-book/apps/loop-designer/.next/standalone/apps/loop-designer/.next/static/

# 重新构建
cd /var/www/carbon-silicon-org-book/apps/loop-designer
npm run build
pm2 restart carbon-silicon-loop-designer
```

### 问题 4：数据库连接失败

```bash
# 测试网络连接
curl -I https://your-project.supabase.co

# 检查环境变量
cat .env.local | grep SUPABASE

# 测试 Supabase 连接
node -e "console.log(process.env.NEXT_PUBLIC_SUPABASE_URL)"
```

---

## 后续优化

### 1. HTTPS 配置（Let's Encrypt）

```bash
# 安装 Certbot
apt-get install -y certbot python3-certbot-nginx

# 获取证书（需要域名）
certbot --nginx -d loop.csi-org.com

# 自动续期
certbot renew --dry-run
```

### 2. PM2 开机自启

```bash
pm2 startup
# 按提示执行生成的命令
pm2 save
```

### 3. 日志轮转

```bash
# 安装 logrotate
apt-get install -y logrotate

# 配置 PM2 日志轮转
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 30
```

### 4. 监控告警

```bash
# 安装 PM2 Plus
pm2 plus

# 或配置阿里云监控
```

---

## 快速命令参考

```bash
# 查看日志
pm2 logs carbon-silicon-loop-designer

# 重启应用
pm2 restart carbon-silicon-loop-designer

# 查看状态
pm2 list

# 查看监控
pm2 monit

# 更新代码并部署
cd /var/www/carbon-silicon-org-book/apps/loop-designer
git pull
npm ci
npm run build
pm2 restart carbon-silicon-loop-designer

# Nginx 日志
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```
