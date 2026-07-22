# Deployment Configurations

This directory contains server configuration templates for deploying the Carbon Silicon Tools Site.

## Nginx Configuration (`nginx.conf`)

Optimized Nginx configuration with performance enhancements:

### Features
- ✅ **Gzip compression** (70% size reduction for JS/CSS/JSON)
- ✅ **Static asset caching** (1 year for immutable assets)
- ✅ **Keepalive connections** (reuse connections to backend)
- ✅ **Security headers** (X-Frame-Options, X-Content-Type-Options, etc.)
- ✅ **Proxy buffering** (improved response times)
- ✅ **Health check endpoint** (`/health`)

### Deployment Steps

1. **Copy to server:**
   ```bash
   scp nginx.conf root@47.95.199.142:/etc/nginx/conf.d/carbon-silicon-tools-site.conf
   ```

2. **Test configuration:**
   ```bash
   ssh root@47.95.199.142 "nginx -t"
   ```

3. **Reload Nginx:**
   ```bash
   ssh root@47.95.199.142 "nginx -s reload"
   ```

4. **Verify:**
   ```bash
   curl -I https://carbon.daodecision.com
   # Check for: Content-Encoding: gzip
   ```

### Performance Impact

Before:
- JS files: 2.4MB (uncompressed)
- TTFB: 2.0-3.5s

After:
- JS files: ~700KB (gzip compressed)
- TTFB: Expected ~1.0-1.5s (50% improvement)

### Customization

If using multiple PM2 instances (cluster mode), uncomment additional `server` lines in the `upstream` block:

```nginx
upstream carbon_silicon_backend {
    server 127.0.0.1:3000 max_fails=3 fail_timeout=30s;
    server 127.0.0.1:3001 max_fails=3 fail_timeout=30s; # PM2 instance 2
    server 127.0.0.1:3002 max_fails=3 fail_timeout=30s; # PM2 instance 3
    server 127.0.0.1:3003 max_fails=3 fail_timeout=30s; # PM2 instance 4
    keepalive 32;
}
```

## PM2 Ecosystem Config (`../ecosystem.config.cjs`)

Cluster mode configuration to utilize all CPU cores.

### Deployment

```bash
# From project root, after deployment
pm2 start ecosystem.config.cjs
pm2 save
pm2 list
```

### Monitoring

```bash
pm2 monit
pm2 logs carbon-silicon-tools-site
```

## Health Check

The Nginx config exposes a health endpoint at `/health`:

```bash
curl http://47.95.199.142/health
# Expected output: healthy
```

## Troubleshooting

### Nginx fails to start
Check syntax: `nginx -t`
Check logs: `tail -f /var/log/nginx/error.log`

### 502 Bad Gateway
PM2 not running: `pm2 list`
Check PM2 logs: `pm2 logs`

### Gzip not working
Verify Nginx has gzip module: `nginx -V 2>&1 | grep gzip`
Check response headers: `curl -I -H "Accept-Encoding: gzip" https://carbon.daodecision.com`
