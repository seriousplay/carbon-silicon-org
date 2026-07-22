# V5-M5-B Production Recovery Proof

Date: 2026-07-16

Scope:
- Record the bounded production recovery proof for release
  `20260716-115933-m5b`.
- Avoid an unnecessary production rollback switch.
- Keep evidence secret-free.

## Incident

During production validation, the first release archive excluded
`.next/node_modules` because the archive rule used a broad `node_modules`
exclude.

Impact:
- Static routes continued serving.
- `/loopos/api/auth/session` returned `500`.
- PM2 processes were online, but the Next.js 16/Turbopack server runtime could
  not resolve hashed server external aliases such as `pg-...` and
  `@prisma/client-...`.

## Recovery Action

Recovery performed:
- Uploaded the local production build's `.next/node_modules` into the deployed
  release.
- Reloaded only `loopos-web`.
- Updated `deploy/aliyun/README.md` so future release archives preserve
  `.next/node_modules`.

No database rollback or unrelated service restart was performed.

## Production Readback

Remote readback:

```text
current=/var/www/loopos/releases/20260716-115933-m5b
previous_exists=yes
next_node_modules=present
pm2=[{"name":"loopos-web","status":"online","cwd":"/var/www/loopos/current"},{"name":"loopos-worker","status":"online","cwd":"/var/www/loopos/current"}]
```

Public HTTP verification after recovery:

```text
https://csi-org.com/loopos -> 200 text/html; charset=utf-8
https://csi-org.com/loopos/ -> 308 location /loopos
https://csi-org.com/loopos/login -> 200 text/html; charset=utf-8
https://csi-org.com/loopos/api/auth/session -> 200 application/json
```

## Boundary

This is a bounded recovery proof, not a rollback switch drill.

Product-owner decision:
- The bounded recovery proof is sufficient for M5-B production recovery
  acceptance.
- Do not execute an extra rollback symlink switch drill for M5-B solely to
  create evidence.

Accepted boundary:
- The previous release remains present and discoverable.
- The active release was repaired in place for a packaging artifact omission.
- The repair was verified by remote file/process readback and public HTTP.

Not claimed:
- No rollback symlink switch was executed after the recovery.
- No database restore was executed.
- No Nginx configuration change was executed.
