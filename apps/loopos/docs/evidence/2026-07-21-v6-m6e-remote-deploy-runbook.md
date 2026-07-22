# V6-M6-E Remote Deploy Runbook

Date: 2026-07-21
Status: prepared, not executed

## Purpose

Deploy the accepted M6-D local evidence snapshot to `https://csi-org.com/loopos`
without building on the Aliyun server, while preserving rollback scope and
BioCoach isolation.

## Local Artifacts

- Source archive: `/tmp/loopos-m6e-source-20260721.tgz`
- Runtime archive: `/tmp/loopos-m6e-release-20260721.tgz`
- Public base path: `/loopos`
- Production listener: `127.0.0.1:3040`
- PM2 scope: `loopos-web`, `loopos-worker`

## Remote Preflight

Run only after SSH approval:

```sh
ssh -i "$HOME/.ssh/daodecision_aliyun.pem" root@47.95.199.142 \
  'set -e
   echo current=$(readlink -f /var/www/loopos/current 2>/dev/null || true)
   ls -1dt /var/www/loopos/releases/* 2>/dev/null | head -5
   pm2 jlist | node -e "let s=\"\";process.stdin.on(\"data\",d=>s+=d);process.stdin.on(\"end\",()=>{const a=JSON.parse(s||\"[]\"); for (const p of a.filter(x=>/^loopos-/.test(x.name))) console.log(`${p.name} ${p.pm2_env?.status} pid=${p.pid} restart=${p.pm2_env?.restart_time}`);})"
   df -h /var/www/loopos
   uptime'
```

Record:

- current release target;
- previous release target;
- PM2 status for `loopos-web` and `loopos-worker`;
- available disk space;
- server load.

Do not continue if disk is low, PM2 has unrelated failures, or current release
cannot be read.

## Upload

```sh
scp -i "$HOME/.ssh/daodecision_aliyun.pem" \
  /tmp/loopos-m6e-source-20260721.tgz \
  /tmp/loopos-m6e-release-20260721.tgz \
  root@47.95.199.142:/tmp/
```

## Install Release

Use a new release directory. Example:

```sh
ssh -i "$HOME/.ssh/daodecision_aliyun.pem" root@47.95.199.142 \
  'set -e
   release=/var/www/loopos/releases/20260721-m6e-trial
   mkdir -p "$release"
   tar -xzf /tmp/loopos-m6e-source-20260721.tgz -C "$release" --strip-components=1
   tar -xzf /tmp/loopos-m6e-release-20260721.tgz -C "$release" --strip-components=1
   cd "$release"
   corepack enable
   pnpm install --frozen-lockfile --prod=false
   pnpm db:generate
   node --env-file=/var/www/loopos/shared/.env node_modules/prisma/build/index.js migrate deploy
   previous=$(readlink -f /var/www/loopos/current)
   ln -sfn "$release" /var/www/loopos/current
   pm2 startOrReload /var/www/loopos/current/deploy/aliyun/ecosystem.config.cjs --update-env
   pm2 save
   echo previous=$previous
   echo current=$(readlink -f /var/www/loopos/current)'
```

Do not run `next build` on the server.

## Production Verification

Run after PM2 reload:

```sh
node scripts/verify-production-http.mjs --base-url https://csi-org.com/loopos --transport curl --no-proxy --json
```

If smoke credentials are available:

```sh
M5B_SMOKE_EMAIL=<redacted> M5B_SMOKE_PASSWORD=<redacted> \
  node scripts/m5b-production-auth-http-smoke.mjs --base-url https://csi-org.com/loopos
```

Run BioCoach isolation on the server so it uses production `.env` without
copying secrets locally:

```sh
ssh -i "$HOME/.ssh/daodecision_aliyun.pem" root@47.95.199.142 \
  'cd /var/www/loopos/current &&
   node --env-file=/var/www/loopos/shared/.env scripts/verify-production-brain-reader-isolation.mjs --json'
```

## Rollback

If verification fails:

```sh
ssh -i "$HOME/.ssh/daodecision_aliyun.pem" root@47.95.199.142 \
  'set -e
   ln -sfn <previous-release-target> /var/www/loopos/current
   pm2 startOrReload /var/www/loopos/current/deploy/aliyun/ecosystem.config.cjs --update-env
   pm2 save
   readlink -f /var/www/loopos/current'
```

Then rerun public HTTP verification. Database rollback is not automatic; use
forward remediation, named restore, or explicit product-owner acceptance.

## Non-Claims

- This runbook is not a deployment.
- M6-E remains unaccepted until remote execution, public HTTP, authenticated
  smoke, BioCoach isolation, rollback evidence, and independent reviews pass.
- Real-team longitudinal completion remains unclaimed.
