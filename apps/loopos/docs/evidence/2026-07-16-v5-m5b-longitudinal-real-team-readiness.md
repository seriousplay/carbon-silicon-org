# V5-M5-B Longitudinal Real-Team Evidence Readiness

Date: 2026-07-16

Scope:
- Define a repeatable read-only verifier for the remaining real-team
  longitudinal evidence gate.
- Keep synthetic smoke evidence separate from real-team evidence.
- Do not claim longitudinal acceptance until a real team leaves enough
  production evidence for one weekly tension-to-closure loop.

## Verifier

Added:
- `scripts/verify-m5b-longitudinal-real-team.mjs`

Required inputs:
- `--organization-slug`
- `--from`
- `--to`

The verifier checks:
- the organization exists and is not a `loopos.test` smoke tenant;
- the evidence window spans at least six days;
- enough real non-test participants exist;
- an overlapping Goal cycle has Goals, Targets, check-ins, and no duplicate
  active Goal per circle;
- at least one tactical meeting has notes or an ended timestamp;
- at least one Tension is raised, routed, and reaches closure or an approved
  tactical/governance output;
- weekly work is linked to a Goal or approved as Project/Action output;
- any governance-routed Tension has governance meeting and terminal process
  evidence.

## Production Dry Run

Command shape:

```bash
ssh root@47.95.199.142 \
  'cd /var/www/loopos/current && node --env-file=/var/www/loopos/shared/.env - \
    --organization-slug stepfun-20ax --from 2026-07-09 --to 2026-07-17 --json' \
  < scripts/verify-m5b-longitudinal-real-team.mjs
```

Result:

```json
{
  "ok": false,
  "mode": "m5b-longitudinal-real-team",
  "days": 8,
  "passedGates": [
    "organization-found",
    "not-smoke-tenant",
    "weekly-window",
    "governance-if-used"
  ],
  "failedGates": [
    "real-team-participation",
    "goal-cycle-loop",
    "tactical-meeting-loop",
    "tension-to-output",
    "work-linked-to-goal"
  ],
  "facts": {
    "realPeople": 1,
    "realUsers": 1,
    "goalCycles": 0,
    "goals": 0,
    "goalCheckIns": 0,
    "meetings": 0,
    "tensions": 0,
    "approvedTacticalOutputs": 0
  }
}
```

Interpretation:
- The verifier runs successfully against the production schema.
- The checked organization is not smoke evidence.
- The current production data does not yet prove a real-team weekly operating
  loop.

## Required Real-Team Trial

To close the longitudinal gate, one real team must run a weekly cycle in
production and leave evidence that passes the verifier:

1. At least two real participants are in the organization.
2. One weekly Goal cycle is active or closed for the trial window.
3. Each active circle has at most one active Goal in that cycle.
4. At least one Goal has a Target and at least one check-in in the window.
5. At least one tactical meeting is ended or has notes.
6. At least one Tension is raised, routed, and closed or converted into an
   approved Project/Action/governance output.
7. Weekly work is linked back to a Goal or approved as a Project/Action.
8. If a Tension is routed to governance, the governance meeting and terminal
   governance process must also be present.

## Not Claimed

- No real-team longitudinal operation evidence is accepted yet.
- The production dry run is negative evidence: it proves the current gap, not
  completion.
- Synthetic smoke tenants and screenshots do not satisfy this gate.
