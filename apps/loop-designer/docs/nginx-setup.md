# Nginx 配置指南

## 配置说明

碳硅回路设计师运行在端口 `3010`，需要通过 Nginx 反向代理并保留 `/loop-designer/` 路径前缀。

**重要**：`basePath: "/loop-designer"` 要求 Nginx **必须保留路径前缀**，不能移除。

---

## Nginx 配置

### 方法 A：在现有 Nginx 配置中添加

编辑服务器上的 Nginx 配置：

```bash
ssh root@47.95.199.142
vim /etc/nginx/conf.d/carbon-silicon.conf
```

添加以下 `location` 块：

```nginx
# 碳硅回路设计师
location /loop-designer/ {
  proxy_pass http://127.0.0.1:3010/;
  proxy_http_version 1.1;
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
  proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  proxy_set_header X-Forwarded-Proto $scheme;

  # WebSocket support (if needed in future)
  proxy_set_header Upgrade $http_upgrade;
  proxy_set_header Connection "upgrade";

  # Timeouts
  proxy_connect_timeout 60s;
  proxy_send_timeout 60s;
  proxy_read_timeout 60s;
}
```

**注意**：
- `proxy_pass http://127.0.0.1:3010/;` 末尾的 `/` 是必须的
- 它告诉 Nginx 将 `/loop-designer/` 后面的路径原样转发到后端
- 例如：`/loop-designer/api/sessions` → `http://127.0.0.1:3010/api/sessions`

### 方法 B：独立配置文件

创建新文件 `/etc/nginx/conf.d/loop-designer.conf`：

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
  }

  # 静态资源缓存
  location /loop-designer/_next/static/ {
    proxy_pass http://127.0.0.1:3010/_next/static/;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

---

## 测试配置

### 1. 测试 Nginx 配置语法

```bash
nginx -t
```

期望输出：
```
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

### 2. 重新加载 Nginx

```bash
nginx -s reload
# 或
systemctl reload nginx
```

### 3. 测试访问

```bash
# 测试本地
curl -I http://localhost:3010/

# 测试通过 Nginx
curl -I http://47.95.199.142/loop-designer/

# 测试 API
curl -I http://47.95.199.142/loop-designer/api/sessions
```

---

## HTTPS 配置（Let's Encrypt）

如果需要 HTTPS，使用 Certbot：

```bash
# 安装 Certbot
apt-get update
apt-get install certbot python3-certbot-nginx

# 获取证书（域名方式）
certbot --nginx -d loop.csi-org.com

# 或使用 IP 方式（不建议生产环境使用）
certbot certonly --standalone -d 47.95.199.142
```

Certbot 会自动修改 Nginx 配置添加 HTTPS。

---

## 常见问题

### 问题1：404 Not Found

**原因**：`proxy_pass` 路径末尾缺少 `/`

**错误配置**：
```nginx
proxy_pass http://127.0.0.1:3010;  # ❌ 缺少末尾的 /
```

**正确配置**：
```nginx
proxy_pass http://127.0.0.1:3010/;  # ✅ 有末尾的 /
```

### 问题2：CSS/JS 加载失败

**原因**：静态资源路径没有正确处理

**解决**：确保 `basePath` 配置正确，并且 Nginx 正确转发

### 问题3：API 返回 404

**原因**：Next.js 没有接收到正确的路径前缀

**解决**：检查 Nginx 的 `proxy_pass` 路径

---

## 完整 Nginx 配置示例

如果 carbon-silicon-tools-site 和 loop-designer 共存：

```nginx
# 主站：carbon-silicon-tools-site
server {
  listen 80;
  server_name loop.csi-org.com;

  location / {
    proxy_pass http://127.0.0.1:3000/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # 静态资源
  location /_next/static/ {
    proxy_pass http://127.0.0.1:3000/_next/static/;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}

# 回路设计师：loop-designer
server {
  listen 80;
  server_name loop.csi-org.com;

  location /loop-designer/ {
    proxy_pass http://127.0.0.1:3010/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  location /loop-designer/_next/static/ {
    proxy_pass http://127.0.0.1:3010/_next/static/;
    expires 1y;
    add_header Cache-Control "public, immutable";
  }
}
```

**注意**：上述配置使用了同一个 `server_name`，通过不同的 `location` 区分。

---

## 验证

配置完成后，验证以下 URL 可访问：

- ✅ `http://47.95.199.142/loop-designer/` - 首页
- ✅ `http://47.95.199.142/loop-designer/api/sessions` - API
- ✅ `http://47.95.199.142/loop-designer/sessions/xxx` - 会话页面

---

## 监控

### 查看 Nginx 日志

```bash
# 访问日志
tail -f /var/log/nginx/access.log

# 错误日志
tail -f /var/log/nginx/error.log

# 过滤回路设计师相关请求
grep loop-designer /var/log/nginx/access.log
```

### 查看应用日志

```bash
# PM2 日志
pm2 logs carbon-silicon-loop-designer

# 应用日志文件
tail -f /var/www/carbon-silicon-org-book/apps/loop-designer/logs/out.log
tail -f /var/www/carbon-silicon-org-book/apps/loop-designer/logs/error.log
```
