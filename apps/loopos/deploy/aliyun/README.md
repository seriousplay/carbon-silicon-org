# LoopOS Aliyun single-host deployment

This directory contains only the LoopOS additions for the shared Aliyun host. It must not replace the existing `csi-org.com` Nginx server configuration.

## Fixed production contract

- Public URL: `https://csi-org.com/loopos`
- Release path: `/var/www/loopos/current`
- Shared environment file: `/var/www/loopos/shared/.env`
- Web listener: `127.0.0.1:3040`
- PM2 processes: `loopos-web` and `loopos-worker`
- Package manager: `pnpm@10.28.0` with `pnpm-lock.yaml`

The application reads `NEXT_PUBLIC_BASE_PATH` dynamically in `next.config.ts`. It must be `/loopos` when `next build` runs because Next.js inlines the base path in the build output.

The shared environment file must contain the production variables required by the application, including:

```dotenv
AUTH_URL=https://csi-org.com
NEXT_PUBLIC_BASE_PATH=/loopos
```

`AUTH_URL` remains the site origin. The application combines it with the configured base path to expose NextAuth at `https://csi-org.com/loopos/api/auth`.

Do not commit the environment file. Keep it readable only by the deployment account, for example with mode `600`.

Do not use `npm install` or generate `package-lock.json` for production releases. The repository's release contract is pinned by `packageManager` in `package.json`, `pnpm-lock.yaml`, and `pnpm-workspace.yaml`.

Every release candidate must keep a secret-free evidence record. Use `docs/evidence/production-baseline-template.md` as the required shape and omit or redact credentials, tokens, raw PM2 environments, database URLs, cookie values, and raw logs that contain secrets.

## Build locally

Never run `next build` on the shared production host. Build on the development machine with the production public path, then upload the generated `.next` directory into the matching release source tree:

```bash
pnpm install --frozen-lockfile
pnpm db:generate
NEXT_PUBLIC_BASE_PATH=/loopos AUTH_URL=https://csi-org.com pnpm build
tar --exclude=./node_modules --exclude=./.git --exclude=./.env --exclude=./.env.local \
  --exclude=./.next/cache --exclude=./.next/dev -czf loopos-next.tgz .next
scp loopos-next.tgz <deployment-host>:/tmp/loopos-next.tgz
```

Next.js 16/Turbopack may generate `.next/node_modules` with hashed external
module aliases for server routes. Preserve that directory in the release
artifact. If packaging the whole source tree, exclude only the top-level
`./node_modules`; do not use a bare `--exclude=node_modules` pattern that also
removes `.next/node_modules`. Do not use a basename-only `--exclude=dev`
pattern: it can remove `dist/server/dev` from the standalone Next runtime.
The release must retain `.next/standalone/node_modules` and its complete
`next/dist/server/dev` directory.

For Next.js 16/Turbopack releases, also copy the generated external-module
aliases from `.next/node_modules` into `.next/standalone/.next/node_modules`.
These aliases are part of the standalone runtime contract; omitting them can
leave public HTML routes healthy while authenticated routes fail to resolve
`pg` or Prisma runtime modules.

```bash
mkdir -p .next/standalone/.next
cp -R .next/static .next/standalone/.next/static
mkdir -p .next/standalone/.next/node_modules
cp -aL .next/node_modules/. .next/standalone/.next/node_modules/
cp -aL node_modules/.pnpm/node_modules/. .next/standalone/.next/node_modules/
```

The `-L` is intentional. The aliases generated on macOS point through the
local pnpm layout and cannot be shipped as symlinks to a Linux release. The
release must contain dereferenced runtime packages, including transitive
dependencies such as `pg-types` and `@prisma/client-runtime-utils`.

## Migrate and start on the server

Place the exact matching source release at `/var/www/loopos/current`, install its Linux dependencies, extract the locally built artifact, and migrate before either process starts.

Before running `prisma migrate deploy`, the database cluster must already satisfy the Organization Brain reader-role prerequisite documented in `scripts/organization-brain/B2A_DEPLOYMENT.md`. The migration stack intentionally fails closed if `loopos_brain_reader` has not been provisioned with safe attributes.

```bash
cd /var/www/loopos/current
pnpm install --frozen-lockfile
pnpm db:generate
tar -xzf /tmp/loopos-next.tgz
node --env-file=/var/www/loopos/shared/.env node_modules/prisma/build/index.js migrate deploy
pm2 startOrReload deploy/aliyun/ecosystem.config.cjs --update-env
pm2 save
```

The PM2 ecosystem uses `util.parseEnv()` without modifying the configuration process environment and passes only variables parsed from the shared file, plus `NODE_ENV=production`; `NODE_OPTIONS` is explicitly removed. A missing or unreadable environment file fails closed.

PM2 receives the parsed runtime environment, including secrets from the shared file. `pm2 save` persists that environment in root's `$HOME/.pm2/dump.pm2`, and `pm2 env` can display it. Keep the PM2 home directory and dump root-only, and run `pm2 startOrReload deploy/aliyun/ecosystem.config.cjs --update-env` followed by `pm2 save` after rotating the shared environment file.

## Nginx integration

Copy the two proxy blocks from `nginx-loopos.conf` into the existing HTTPS `csi-org.com` server block. Both `/loopos` and `/loopos/` proxy unchanged to Next.js; Nginx must not normalize either path. Next.js owns its build-generated `/loopos/` to `/loopos` redirect.

Copy the two redirect blocks from `nginx-loopos-http.conf` into the existing HTTP `csi-org.com` server block. These exact-path exceptions must precede the host's catch-all redirect to `www.csi-org.com`; they keep LoopOS on `https://csi-org.com`. Do not install the proxy fragment in the HTTP server, and do not add another `server_name`, certificate, or catch-all route.

The upstream `proxy_pass` intentionally has no trailing slash. This preserves `/loopos` in the upstream request because the Next.js build owns that base path.

Validate and reload without disturbing other sites:

```bash
node <<'NODE'
const assert = require("node:assert/strict");
const fs = require("node:fs");
const nginx = fs.readFileSync("deploy/aliyun/nginx-loopos.conf", "utf8");
const httpNginx = fs.readFileSync("deploy/aliyun/nginx-loopos-http.conf", "utf8");
const manifest = JSON.parse(fs.readFileSync(".next/routes-manifest.json", "utf8"));
const upstream = "proxy_pass http://127.0.0.1:3040;";

assert.match(nginx, new RegExp(`location = /loopos\\s*\\{[\\s\\S]*?${upstream}`));
assert.match(nginx, new RegExp(`location \\^~ /loopos/\\s*\\{[\\s\\S]*?${upstream}`));
assert.equal((nginx.match(/proxy_pass http:\/\/127\.0\.0\.1:3040;/g) ?? []).length, 2);
assert.doesNotMatch(nginx, /return\s+30[178]\s+\/loopos\/?/);
assert.match(httpNginx, /location = \/loopos[\s\S]*return 301 https:\/\/csi-org\.com\$request_uri;/);
assert.match(httpNginx, /location \^~ \/loopos\/[\s\S]*return 301 https:\/\/csi-org\.com\$request_uri;/);
assert.ok(manifest.redirects.some((redirect) =>
  redirect.source === "/loopos/"
    && redirect.destination === "/loopos"
    && redirect.statusCode === 308
));
console.log("LoopOS redirect-loop assertion: PASS");
NODE
sudo nginx -t
sudo systemctl reload nginx
```

## Verification

```bash
pm2 show loopos-web
pm2 show loopos-worker
curl --fail --silent --show-error http://127.0.0.1:3040/loopos -o /dev/null
curl --fail --silent --show-error https://csi-org.com/loopos -o /dev/null
curl --fail --silent --show-error --location --max-redirs 1 https://csi-org.com/loopos/ -o /dev/null
node scripts/verify-production-http.mjs --base-url https://csi-org.com/loopos --json
```

If local Node networking is constrained by proxy or sandbox settings, use the
curl transport:

```bash
node scripts/verify-production-http.mjs --base-url https://csi-org.com/loopos --transport curl --no-proxy --json
```

Authenticated browser smoke is separate from public HTTP verification. Use
`docs/evidence/production-browser-smoke-checklist.md` and keep the default smoke
mode read-only unless an explicit test tenant and cleanup plan exist.

Inspect recent process logs if either request fails:

```bash
pm2 logs loopos-web --lines 100 --nostream
pm2 logs loopos-worker --lines 100 --nostream
```

## Rollback

Application rollback restores the previous application release only. It does
not roll back database data unless a separate, named backup/restore procedure
has been approved for the release.

Before rollback, identify and record:

- current release target;
- previous release target;
- whether the database migration in the failed release is forward-only or has a
  named backup/restore plan;
- the expected public verification URL, normally `https://csi-org.com/loopos`.

Point `/var/www/loopos/current` back to the previous release, then reload only
the LoopOS PM2 processes from that release's ecosystem file:

```bash
pm2 startOrReload /var/www/loopos/current/deploy/aliyun/ecosystem.config.cjs --update-env
pm2 save
```

Verify restoration with the same public HTTP checks:

```bash
node scripts/verify-production-http.mjs --base-url https://csi-org.com/loopos --json
pm2 show loopos-web
pm2 show loopos-worker
```

If the route itself must be withdrawn, remove only the two LoopOS `location`
blocks from the existing `csi-org.com` HTTPS server and the two LoopOS HTTP
redirect blocks from the existing HTTP server. Then run `sudo nginx -t` and
reload Nginx. Do not change any other `csi-org.com` site locations,
certificates, upstreams, or server blocks.
