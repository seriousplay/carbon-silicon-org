# 手动部署指南

如果自动化部署脚本遇到问题，可以按以下步骤手动部署。

---

## 方式1：使用部署脚本（推荐）

```bash
cd /Users/heyiqing/Documents/GitHub/carbon-silicon-org-book/apps/loop-designer

# 一键部署
./scripts/deploy-aliyun.sh
```

---

## 方式2：手动分步部署

### 步骤 1：本地构建

```bash
cd /Users/heyiqing/Documents/GitHub/carbon-silicon-org-book/apps/loop-designer

# 安装依赖
npm ci

# 构建
npm run build
```

### 步骤 2：上传文件到服务器

```bash
# 使用 rsync 同步（推荐）
rsync -avz --progress \
  --exclude "node_modules" \
  --exclude ".env.local" \
  --exclude ".env.production" \
  -e "ssh -i ~/.ssh/daodecision_aliyun.pem" \
  /Users/heyiqing/Documents/GitHub/carbon-silicon-org-book/apps/loop-designer/ \
  root@47.95.199.142:/var/www/carbon-silicon-org-book/apps/loop-designer/

# 或使用 scp（较慢）
scp -i ~/.ssh/daodecision_aliyun.pem -r \
  /Users/heyiqing/Documents/GitHub/carbon-silicon-org-book/apps/loop-designer/* \
  root@47.95.199.142:/var/www/carbon-silicon-org-book/apps/loop-designer/
```

### 步骤 3：服务器上安装依赖和构建

```bash
ssh root@47.95.199.142

cd /var/www/carbon-silicon-org-book/apps/loop-designer

# 安装依赖
npm ci --production

# 构建
npm run build
```

### 步骤 4：配置环境变量

```bash
cd /var/www/carbon-silicon-org-book/apps/loop-designer

# 创建环境变量文件
cat > .env.local << 'EOF'
# 复制你的本地 .env.local 内容到这里
# 确保 SUPABASE、LLM、FEISHU 等配置正确
EOF

# 验证配置
cat .env.local
```

### 步骤 5：启动 PM2

```bash
cd /var/www/carbon-silicon-org-book/apps/loop-designer

# 首次启动
pm2 start ecosystem.config.cjs

# 或重启（如果已经运行）
pm2 restart carbon-silicon-loop-designer

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
# 按提示执行生成的命令

# 查看状态
pm2 list

# 查看日志
pm2 logs carbon-silicon-loop-designer
```

### 步骤 6：配置 Nginx

```bash
ssh root@47.95.199.142

# 创建 Nginx 配置
cat > /etc/nginx/conf.d/loop-designer.conf << 'EOF'
server {
  listen 80;
  server_name 47.95.199.142;

  location /loop-designer/ {
    proxy_pass http://127.0.0.1:3010/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_connect_timeout 300s;
    proxy_send_timeout 300s;
    proxy_read_timeout 300s;
  }

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

### 步骤 7：验证部署

```bash
# 检查 PM2 状态
pm2 list

# 检查端口
ss -tlnp | grep 3010

# 测试本地访问
curl -I http://localhost:3010/

# 测试 Nginx 代理
curl -I http://47.95.199.142/loop-designer/
```

---

## 常见问题

### SSH 连接失败

```bash
# 测试 SSH 连接
ssh -i ~/.ssh/daodecision_aliyun.pem root@47.95.199.142 'echo "SSH OK"'

# 检查密钥权限
chmod 600 ~/.ssh/daodecision_aliyun.pem

# 使用详细模式调试
ssh -vvv -i ~/.ssh/daodecision_aliyun.pem root@47.95.199.142
```

### rsync 超时

```bash
# 使用更小的块大小
rsync -avz --progress --bwlimit=1000 ...

# 或分段传输
scp -i ~/.ssh/daodecision_aliyun.pem -r /path/to/app root@47.95.199.142:/tmp/
ssh root@47.95.199.142 'mv /tmp/app /var/www/carbon-silicon-org-book/apps/'
```

### PM2 启动失败

```bash
# 查看详细日志
pm2 logs carbon-silicon-loop-designer --lines 200

# 手动启动看错误
cd /var/www/carbon-silicon-org-book/apps/loop-designer
node .next/standalone/apps/loop-designer/server.js

# 检查环境变量
cat .env.local

# 检查 Node.js 版本
node --version  # 应该 >= 20
```

### Nginx 502 Bad Gateway

```bash
# 检查应用是否运行
pm2 list
curl http://localhost:3010/

# 查看 Nginx 错误日志
tail -f /var/log/nginx/error.log

# 检查 Nginx 配置
nginx -t
```

### 构建失败

```bash
# 清理缓存重新构建
cd /var/www/carbon-silicon-org-book/apps/loop-designer
rm -rf .next node_modules
npm ci
npm run build
```

---

## 回滚方案

如果部署出现问题，需要回滚：

```bash
# 1. 停止当前版本
pm2 stop carbon-silicon-loop-designer

# 2. 恢复之前的版本（如果有备份）
cd /var/www/carbon-silicon-org-book/apps/loop-designer
git checkout <previous-commit-hash>

# 3. 重新构建
npm ci
npm run build

# 4. 重启
pm2 start carbon-silicon-loop-designer
```

---

## 性能优化

### PM2 集群模式

```bash
# 使用集群模式（多核 CPU）
pm2 start ecosystem.config.cjs -i max

# 或指定进程数
pm2 start ecosystem.config.cjs -i 2
```

### Nginx Gzip

```nginx
location /loop-designer/ {
  proxy_pass http://127.0.0.1:3010/;
  # ... 其他配置

  # Gzip 压缩
  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

---

## 参考文档

- 📄 [部署指南](./deployment-guide.md)
- 📄 [Nginx 配置](./nginx-setup.md)
- 📄 [部署清单](./deployment-checklist.md)
