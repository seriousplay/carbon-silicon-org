# V5-M5-B Remaining Gates Runbook

Date: 2026-07-16

Scope:
- Convert the two remaining M5-B blockers into executable operating steps.
- Preserve evidence-class separation: operator readiness, real-team evidence,
  and smoke evidence are separate.
- Prevent unsafe shortcuts such as reusing the application database credential
  for Organization Brain reads.

Current acceptance state:
- `accepted=false`
- `pass=15`
- `blocked=2`
- `missing=0`

The remaining blocked gates are:
- `brain-readiness`
- `longitudinal-real-team`

## Gate 1 - Brain Readiness

Goal:
- Production `BRAIN_DATABASE_URL` must point to an operator-approved dedicated
  Brain reader login.
- The readiness verifier must pass before production Organization Brain dynamic
  reads are claimed.

Allowed operator paths:

1. Move LoopOS Brain reader access to a database or cluster without unrelated
   databases that expose `PUBLIC CONNECT/TEMPORARY`.
2. Obtain explicit operator approval to repair unrelated database ACLs, then
   prove no unrelated workload loses required access.
3. Create an equivalent isolated reader boundary that passes the readiness
   verifier without weakening credential separation.

Forbidden shortcuts:
- Do not set `BRAIN_DATABASE_URL` to the application `DATABASE_URL`.
- Do not make `loopos_brain_reader` a login role.
- Do not grant the Brain login superuser, createdb, createrole, replication,
  bypass-RLS, or inheritance privileges.
- Do not change unrelated `biocoach` ACLs as part of LoopOS validation without
  explicit operator approval.
- Do not claim dynamic production reads from source review, local PostgreSQL, or
  smoke browser evidence.

Required proof command after operator setup:

```bash
ssh root@47.95.199.142 \
  'cd /var/www/loopos/current && node --env-file=/var/www/loopos/shared/.env - --json' \
  < scripts/verify-production-brain-reader-readiness.mjs
```

Required passing facts:
- `BRAIN_DATABASE_URL` is present.
- It is not the application `DATABASE_URL`.
- The session user is a dedicated login role, not `loopos_brain_reader`.
- The dedicated login has exactly one direct non-admin membership in
  `loopos_brain_reader`.
- `SET LOCAL ROLE loopos_brain_reader` works inside a read-only transaction.
- `brain_read.current_actor` can be queried under bounded fake context.

## Gate 2 - Longitudinal Real-Team Evidence

Goal:
- One real team must use production LoopOS for a weekly operating cycle.
- The data must show a real tension-to-closure governance rhythm, not a smoke
  tenant, screenshot, or synthetic fixture.

Pilot setup:
1. Choose one real organization slug.
2. Ensure at least two real non-`loopos.test` users are members.
3. Choose a trial window of at least six days.
4. Run one Goal cycle for the trial window.
5. Keep at most one active Goal per circle in that cycle.
6. Add at least one Target and at least one check-in.
7. Raise at least one Tension.
8. Route the Tension to tactical or governance processing.
9. Hold at least one tactical meeting with notes or an ended timestamp.
10. Close the Tension or approve one Project/Action/governance output.
11. Link weekly work back to a Goal, or approve it as Project/Action output.
12. If governance routing is used, record the governance meeting and terminal
    governance process.

Required proof command after the trial:

```bash
ssh root@47.95.199.142 \
  'cd /var/www/loopos/current && node --env-file=/var/www/loopos/shared/.env - \
    --organization-slug <real-org-slug> --from <YYYY-MM-DD> --to <YYYY-MM-DD> --json' \
  < scripts/verify-m5b-longitudinal-real-team.mjs
```

Required passing gates:
- `organization-found`
- `not-smoke-tenant`
- `weekly-window`
- `real-team-participation`
- `goal-cycle-loop`
- `tactical-meeting-loop`
- `tension-to-output`
- `work-linked-to-goal`
- `governance-if-used`

Forbidden shortcuts:
- Do not use `@loopos.test` accounts.
- Do not count production smoke tenants.
- Do not count screenshots as longitudinal evidence.
- Do not count local fixture databases.
- Do not claim the gate from a single login or empty organization.

## Final Acceptance After Both Gates

After both gates pass:

```bash
node scripts/verify-m5b-acceptance-state.mjs
```

Expected final state for M5-B acceptance:
- `accepted=true`
- `blocked=0`
- `missing=0`

Only after this is true can the coordinator run the final M5-B acceptance audit
and consider whether V5 as a whole is complete.

## Current Non-Claim

This runbook does not close either gate. It defines the operator and real-team
actions required to close them without weakening the product's authority,
security, or evidence model.
