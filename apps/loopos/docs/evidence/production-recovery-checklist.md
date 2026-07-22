# LoopOS Production Recovery Checklist

Status: M5-A4 design artifact

This checklist defines the rollback and recovery evidence required before a
real-team longitudinal trial. It does not claim that a production rollback drill
has been executed.

## Required Inputs

- Current release target.
- Previous release target.
- Release evidence file for both targets, if available.
- Database migration status for the current release.
- Database rollback classification:
  - unavailable;
  - forward-only remediation;
  - named backup/restore procedure.
- Operator responsible for PM2 and Nginx actions.

## Application Rollback

Application rollback is limited to LoopOS:

- repoint `/var/www/loopos/current` to the previous release;
- reload only `loopos-web` and `loopos-worker` through
  `/var/www/loopos/current/deploy/aliyun/ecosystem.config.cjs`;
- run `pm2 save` only after the two LoopOS processes are online;
- do not restart unrelated PM2 applications.

## Route Withdrawal

Route withdrawal is limited to LoopOS:

- remove only `location = /loopos`;
- remove only `location ^~ /loopos/`;
- remove only the matching HTTP redirect exceptions for `/loopos` and
  `/loopos/`;
- run `sudo nginx -t` before reload;
- do not change certificates, server names, other locations, or catch-all
  redirects for other sites.

## Restoration Checks

After rollback or route restoration, collect secret-free evidence:

- `pm2 show loopos-web`;
- `pm2 show loopos-worker`;
- `node scripts/verify-production-http.mjs --base-url https://csi-org.com/loopos --json`;
- authenticated browser smoke only if credentials and a read-only validation
  window are available.

## Database Boundary

Application rollback does not automatically roll back data. If a migration has
already changed production data, recovery must use one of:

- forward-only remediation migration;
- named backup restore procedure;
- explicit product-owner acceptance of the data state.

Do not run ad hoc SQL against production as part of rollback evidence.

## Missing Evidence

If host access, credentials, previous release target, or backup/restore policy is
missing, record it as missing evidence. Do not mark rollback proof passed.
