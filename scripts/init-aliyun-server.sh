#!/bin/bash
# Carbon-Silicon Org - Aliyun Server Initialization
# Run this ONCE on the Aliyun ECS server to set up infrastructure
# Usage: ssh root@47.95.199.142 'bash -s' < scripts/init-aliyun-server.sh

set -euo pipefail

echo "=== Carbon-Silicon Org Server Init ==="
echo ""

# ─── Check prerequisites ───
command -v docker >/dev/null 2>&1 || {
  echo "Installing Docker..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable docker && systemctl start docker
}

command -v node >/dev/null 2>&1 || {
  echo "Installing Node.js 22..."
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
}

command -v pnpm >/dev/null 2>&1 || {
  echo "Installing pnpm..."
  npm install -g pnpm@10
}

command -v pm2 >/dev/null 2>&1 || {
  echo "Installing PM2..."
  npm install -g pm2
}

# ─── Directory structure ───
REMOTE_ROOT="${REMOTE_ROOT:-/var/www/carbon-silicon-org}"
mkdir -p "${REMOTE_ROOT}/apps"
mkdir -p "${REMOTE_ROOT}/logs"
mkdir -p "${REMOTE_ROOT}/shared"

# ─── Docker: PostgreSQL + Redis ───
echo ""
echo "=== Setting up Docker services ==="

cat > "${REMOTE_ROOT}/docker-compose.yml" <<'DOCKER'
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: csi-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: csi_admin
      POSTGRES_PASSWORD: ${PG_PASSWORD}
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "127.0.0.1:5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U csi_admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: csi-redis
    restart: unless-stopped
    command: redis-server --appendonly yes --maxmemory 256mb --maxmemory-policy allkeys-lru
    ports:
      - "127.0.0.1:6379:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  pgdata:
  redisdata:
DOCKER

# ─── Database initialization SQL ───
cat > "${REMOTE_ROOT}/init-db.sql" <<'SQL'
CREATE DATABASE csi_book OWNER csi_admin;
CREATE DATABASE csi_loop OWNER csi_admin;
CREATE DATABASE csi_loopos OWNER csi_admin;
SQL

# ─── Start services ───
echo "Starting PostgreSQL + Redis..."
cd "${REMOTE_ROOT}"
docker compose up -d

# Wait for postgres to be ready
echo "Waiting for PostgreSQL..."
until docker exec csi-postgres pg_isready -U csi_admin > /dev/null 2>&1; do
  sleep 2
done
echo "PostgreSQL ready"

# ─── Nginx ───
echo ""
echo "=== Setting up Nginx ==="
apt-get install -y nginx certbot python3-certbot-nginx 2>/dev/null || true

cat > /etc/nginx/conf.d/csi-org.conf <<'NGINX'
# Will be deployed from repo: docker/nginx/conf.d/csi-org.conf
# For now, basic health check
server {
    listen 80;
    server_name csi-org.com;
    location /health { return 200 "healthy\n"; }
}
NGINX

nginx -t && systemctl reload nginx

# ─── SSL Certificate ───
echo ""
echo "=== SSL Certificate ==="
if [ -d "/etc/letsencrypt/live/csi-org.com" ]; then
  echo "SSL cert already exists, skipping"
else
  echo "Requesting SSL cert for csi-org.com..."
  certbot --nginx -d csi-org.com -d www.csi-org.com --non-interactive --agree-tos --email admin@csi-org.com || true
fi

# ─── PM2 startup ───
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ─── Firewall ───
echo ""
echo "=== Firewall ==="
ufw allow 80/tcp 2>/dev/null || true
ufw allow 443/tcp 2>/dev/null || true
ufw allow 22/tcp 2>/dev/null || true

echo ""
echo "=== Server initialization complete ==="
echo "PostgreSQL: localhost:5432 (csi_book, csi_loop, csi_loopos)"
echo "Redis:      localhost:6379"
echo "Nginx:      /etc/nginx/conf.d/csi-org.conf"
echo "PM2:        ready"
echo ""
echo "Next: Run deploy-all.sh from local machine"
