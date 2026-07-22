# V5-M5-B Brain Reader Production Boundary

Date: 2026-07-16

Scope:
- Record the production facts that block safe `BRAIN_DATABASE_URL`
  configuration for M5-B.
- Keep evidence secret-free.
- Do not weaken the Organization Brain read boundary by using the application
  database credential as the Brain credential.
- Do not modify unrelated production databases.

## Production Readback

Read-only SSH evidence from `/var/www/loopos/current`:

```text
env_keys=AUTH_URL,DATABASE_URL,NEXT_PUBLIC_BASE_PATH
role|loopos_brain_reader|f|f|f|f|f|f|f|0
db_acl|biocoach|=Tc/biocoach,biocoach=CTc/biocoach
db_acl|postgres|<null>
```

Interpretation:
- `BRAIN_DATABASE_URL` is not configured in production.
- `loopos_brain_reader` exists but is intentionally non-login and
  non-inheriting.
- The read role has no superuser, createdb, createrole, replication, or
  bypass-RLS authority, and has connection limit `0`.
- No `loopos_brain_login` role was present in the readback.
- The unrelated `biocoach` database grants `PUBLIC` connect/temporary
  privileges through `=Tc/biocoach`.

## Repeatable Verifier

Added:
- `scripts/verify-production-brain-reader-boundary.mjs`

Remote read-only execution:

```bash
ssh root@47.95.199.142 \
  'cd /var/www/loopos/current && node --env-file=/var/www/loopos/shared/.env - --json' \
  < scripts/verify-production-brain-reader-boundary.mjs
```

Result:

```json
{
  "ok": true,
  "ready": false,
  "mode": "m5b-safe-blocked-boundary",
  "database": {
    "current": "loopos",
    "url": "postgresql://loopos_app@127.0.0.1:5432/loopos"
  },
  "brainDatabaseUrlConfigured": false,
  "checks": [
    { "name": "database-url-present", "ok": true },
    { "name": "brain-database-url-absent", "ok": true },
    { "name": "brain-read-schema-present", "ok": true },
    { "name": "reader-role-safe-nonlogin", "ok": true },
    { "name": "login-role-absent", "ok": true }
  ],
  "explicitPublicDatabaseAcls": [
    {
      "datname": "biocoach",
      "public_connect": true,
      "public_temporary": true
    }
  ]
}
```

Boundary:
- `ok=true` means the production state matches the documented safe blocked
  boundary.
- `ready=false` means this is not a production dynamic-read readiness proof.

## Future Readiness Gate

Added:
- `scripts/verify-production-brain-reader-readiness.mjs`

Purpose:
- Fail until `BRAIN_DATABASE_URL` points to an operator-approved dedicated
  Brain reader login.
- After that credential exists, verify credential separation from
  `DATABASE_URL`, exact direct `loopos_brain_reader` membership, safe login role
  attributes, `SET LOCAL ROLE loopos_brain_reader`, read-only transaction setup,
  and a basic `brain_read.current_actor` view probe.

Current production execution:

```bash
ssh root@47.95.199.142 \
  'cd /var/www/loopos/current && node --env-file=/var/www/loopos/shared/.env - --json' \
  < scripts/verify-production-brain-reader-readiness.mjs
```

Result:

```text
BRAIN_DATABASE_URL or --brain-database-url is required
```

Boundary:
- This failure is expected in the current M5-B state.
- M5-B must not claim production Organization Brain dynamic reads until this
  readiness verifier passes against a dedicated reader login.

## Decision

M5-B does not configure production `BRAIN_DATABASE_URL` yet.

Accepted conservative boundary:
- Do not change unrelated `biocoach` ACLs in this LoopOS production validation
  slice.
- Do not use the application `DATABASE_URL` as `BRAIN_DATABASE_URL`.
- Do not relax the query broker's dedicated-reader expectation.

## Required Operator Path

One of these must happen before production Organization Brain dynamic reads are
claimed:

1. Move LoopOS Brain reader to a database/cluster without unrelated databases
   that expose `PUBLIC CONNECT/TEMPORARY`.
2. Obtain explicit operator approval to repair unrelated database ACLs and
   prove no unrelated workload loses required access.
3. Create an equivalent isolated production reader boundary that passes the B2A
   dedicated-login and database-ACL checks without weakening the application
   credential boundary.

## Not Claimed

- Production `BRAIN_DATABASE_URL` is not configured.
- Production Organization Brain dynamic database reads are not claimed ready.
- No unrelated database ACL was changed.
- No application write credential was reused for Brain reads.
