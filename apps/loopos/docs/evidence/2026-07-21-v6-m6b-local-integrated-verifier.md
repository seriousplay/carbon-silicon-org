# V6-M6-B Local Integrated Verifier Evidence

Date: 2026-07-21

Status: local SQL-seeded fixture deep browser path proven and independently
reclosed; retained as M6-B evidence, not final V6-M6 acceptance

Scope:

- M6-B local integrated browser and PostgreSQL trial verifier.
- Current work proves a local browser path over disposable PostgreSQL fixture
  data. Several setup facts are seeded directly in SQL and therefore do not
  prove the full UI-driven first-run setup journey.
- Browser execution is claimed only for the recorded local fixture path.
- No production deployment, BioCoach integration, or real-team longitudinal
  completion is claimed.

Artifact:

- `scripts/m6b-local-integrated-trial-verifier.cjs`

Current verifier mode:

- `readiness`

Coordinator checks:

```text
node -c scripts/m6b-local-integrated-trial-verifier.cjs
```

Result: passed.

```text
node scripts/m6b-local-integrated-trial-verifier.cjs --mode readiness
```

Result: failed because `DATABASE_URL` was not present in the shell environment.

```text
node --env-file=.env scripts/m6b-local-integrated-trial-verifier.cjs --mode readiness
```

Result: sandboxed run failed with local PostgreSQL `EPERM`.

```text
node --env-file=.env scripts/m6b-local-integrated-trial-verifier.cjs --mode readiness
```

Result after approved local PostgreSQL access:

```json
{
  "ok": false,
  "database": {
    "ok": false,
    "tables": {
      "organizations": true,
      "people": true,
      "role_defs": true,
      "goal_cycles": true,
      "tensions": true,
      "candidate_tensions": false,
      "meetings": true
    }
  }
}
```

Interpretation:

- The verifier entrypoint is syntactically valid.
- M6-A artifacts exist.
- The default `.env` local database is not a valid M6-B evidence database
  because it is missing the V6-M5 candidate tension table.
- M6-B acceptance must use a disposable fully migrated database, not the stale
  default local database.

Disposable readiness proof:

```text
node --env-file=.env scripts/m6b-local-integrated-trial-verifier.cjs --mode readiness --prepare-disposable-db true --temp-db-name loopos_m6b_readiness_20260721_2 --drop-disposable-db-after-check true
```

Result:

```json
{
  "ok": true,
  "disposable": {
    "requested": true,
    "databaseName": "loopos_m6b_readiness_20260721_2",
    "created": true,
    "migrated": {
      "ok": true,
      "status": 0
    },
    "dropped": true,
    "existsAfterDrop": 0
  },
  "database": {
    "ok": true,
    "tables": {
      "organizations": true,
      "people": true,
      "role_defs": true,
      "goal_cycles": true,
      "tensions": true,
      "candidate_tensions": true,
      "meetings": true
    }
  }
}
```

This proves M6-B now has a clean database lifecycle foundation for later full
browser verification. It does not execute or accept the integrated browser
journey.

Local browser smoke proof:

Setup:

- Disposable DB `loopos_m6b_browser_20260721_1` was created and fully migrated.
- Temporary Next server was started on `http://127.0.0.1:3032` with
  `DATABASE_URL=postgresql://heyiqing@localhost:5432/loopos_m6b_browser_20260721_1`.

Command:

```text
NODE_PATH=/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules DATABASE_URL=postgresql://heyiqing@localhost:5432/loopos_m6b_browser_20260721_1 node scripts/m6b-local-integrated-trial-verifier.cjs --mode browser --base-url http://127.0.0.1:3032 --screenshot-dir /tmp/loopos-m6b-browser-20260721-6
```

Result:

```json
{
  "ok": true,
  "accepted": false,
  "readinessOnly": false,
  "browserResult": {
    "ok": true,
    "browser": {
      "registered": true,
      "activated": true,
      "candidateConfirmed": true,
      "tacticalMeetingCreated": true,
      "governanceMeetingCreated": true,
      "brainVisited": true,
      "mobileOverflow": false
    },
    "facts": {
      "lifecycle": "ACTIVE",
      "roles": 1,
      "active_goal_cycles": 1,
      "tactical_meetings": 1,
      "governance_meetings": 2,
      "candidate_status": "CONFIRMED"
    },
    "ledger": {
      "console": [],
      "page": [],
      "http": []
    }
  }
}
```

Screenshots:

- `/tmp/loopos-m6b-browser-20260721-6/desktop-brain.png`
- `/tmp/loopos-m6b-browser-20260721-6/mobile-organization.png`

Cleanup:

- Temporary Next server on port `3032` was stopped.
- Disposable DB `loopos_m6b_browser_20260721_1` was dropped.
- Final cleanup verifier reported `existsAfterDrop: 0`.

Current interpretation for the earlier smoke pass:

- M6-B now has a working local integrated browser smoke path for setup,
  activation, human role assignment, goal cycle, candidate tension
  confirmation, tactical meeting creation, governance meeting creation,
  Organization Brain access, mobile no-overflow, clean browser ledger, and
  disposable DB cleanup.
- This was not final M6-B acceptance because tactical and governance deep
  outcome processing assertions were still pending at that point.

## 2026-07-21 Deep Local Browser Pass

Command:

```bash
NODE_PATH=/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules DATABASE_URL=postgresql://heyiqing@localhost:5432/loopos_m6b_deep_20260721_8 node scripts/m6b-local-integrated-trial-verifier.cjs --mode browser --base-url http://127.0.0.1:3033 --screenshot-dir /tmp/loopos-m6b-deep-20260721-8
```

Result summary:

```json
{
  "ok": true,
  "readinessOnly": false,
  "browserResult": {
    "ok": true,
    "browser": {
      "registered": true,
      "activated": true,
      "candidateConfirmed": true,
      "tacticalMeetingCreated": true,
      "governanceMeetingCreated": true,
      "tacticalOutcomeApproved": true,
      "actionAssigned": true,
      "governanceProcessAdopted": true,
      "governanceRoleCreated": true,
      "brainVisited": true,
      "mobileOverflow": false
    },
    "facts": {
      "lifecycle": "ACTIVE",
      "roles": 2,
      "active_goal_cycles": 1,
      "tactical_meetings": 1,
      "governance_meetings": 2,
      "candidate_status": "CONFIRMED",
      "approved_tactical_outcomes": 1,
      "assigned_actions": 1,
      "adopted_governance_processes": 1,
      "governance_outcome_roles": 1
    },
    "ledger": {
      "console": [],
      "page": [],
      "http": []
    }
  }
}
```

Screenshots:

- `/tmp/loopos-m6b-deep-20260721-8/desktop-brain.png`
- `/tmp/loopos-m6b-deep-20260721-8/mobile-organization.png`

Cleanup:

- Temporary Next server on port `3033` was stopped.
- Disposable DB `loopos_m6b_deep_20260721_8` was dropped.
- Cleanup query returned `temp_db_exists = 0`.

Additional implementation fixes proven by this run:

- Organization Brain governance proposal creation now supplies a valid role
  target circle instead of an empty `circleId`.
- Governance create payload parsing now accepts normalized `targetId: null`
  across the create-to-meeting initialization boundary.
- Governance adoption now permits the proposer to adopt after the meeting
  process gate when they are a meeting participant, matching the locked product
  principle that the authority comes from the process.

Focused source gates after the fixes:

- `./node_modules/.bin/tsx --test src/lib/__tests__/governance-decision.test.ts`
  passed: 38 tests, 5 suites, 0 failures.
- `./node_modules/.bin/tsx --test src/lib/organization-brain/command-preview-service.test.ts`
  passed: 8 tests, 1 suite, 0 failures. This locks the governance preview
  source binding to `tension.updatedAt` and requires exact governance meeting
  participation.
- `./node_modules/.bin/tsx --test src/lib/organization-brain/goal-command-handler.test.ts`
  passed: 16 tests, 1 suite, 0 failures. This locks the governance command
  handler to an open governance meeting where the actor is a participant.
- `npm run build` passed after the final authorization change: compile,
  TypeScript, page data, static generation, and route optimization completed.
- `git diff --check` passed for the touched verifier, governance, Brain,
  roadmap, evidence, and dashboard files.
- Process cleanup check found no remaining `PORT=3033`,
  `loopos_m6b_deep`, or `next start` process except the check command itself.
- Independent implementation review reclosure passed after the P1 fixes.

## 2026-07-21 Deep Local Browser Re-Run After P1 Fixes

Independent implementation review found two P1 issues: stale governance preview
source versions and missing governance meeting participant boundaries. After
fixing both, the local SQL-seeded fixture browser path was re-run.

Command:

```bash
NODE_PATH=/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules DATABASE_URL=postgresql://heyiqing@localhost:5432/loopos_m6b_deep_20260721_9 node scripts/m6b-local-integrated-trial-verifier.cjs --mode browser --base-url http://127.0.0.1:3033 --screenshot-dir /tmp/loopos-m6b-deep-20260721-9
```

Result summary:

```json
{
  "ok": true,
  "browserResult": {
    "ok": true,
    "browser": {
      "activated": true,
      "candidateConfirmed": true,
      "tacticalOutcomeApproved": true,
      "actionAssigned": true,
      "governanceProcessAdopted": true,
      "governanceRoleCreated": true,
      "mobileOverflow": false
    },
    "ledger": {
      "console": [],
      "page": [],
      "http": []
    }
  }
}
```

Cleanup:

- Temporary Next server on port `3033` was stopped.
- Disposable DB `loopos_m6b_deep_20260721_9` was dropped.
- Cleanup query returned `temp_db_exists = 0`.

Readiness checks:

- M6-A contract artifacts exist.
- Required PostgreSQL tables exist when `DATABASE_URL` points to a migrated
  LoopOS database.
- Planned browser journey is enumerated:
  setup, activation, human role assignment, goal cycle, candidate tension
  confirmation, tactical meeting outcome, governance meeting outcome,
  Organization Brain support, desktop/mobile clean ledgers, and zero-residue
  cleanup.

Non-claims:

- M6-B is not accepted.
- V6-M6 is not accepted.
- The integrated browser deep path has executed locally, including tactical and
  governance outcome processing, but independent implementation review and
  roadmap/evidence audit have not yet accepted it.
- PostgreSQL authority and tenant-isolation negative assertions are not yet
  proven in this evidence packet. Current PostgreSQL checks prove same-fixture
  state and cleanup, not cross-tenant denial, unauthorized actor denial, or
  SETUP/ACTIVE boundary denial.
- Production refresh is not claimed.
- Real-team longitudinal completion is not claimed.

Independent roadmap/evidence reclosure:

- The final scoped P2 was reclosed as PASS after this file explicitly stated
  that PostgreSQL authority and tenant-isolation negative assertions are not
  proven in the M6-B evidence packet and listed them as required follow-up work.

Next required work:

- Continue with M6-C authority, isolation, and UI-first trial gap closure.
- Keep SQL-seeded fixture boundaries explicit until a fully UI-driven first-run
  verifier exists.
- Add PostgreSQL authority and tenant-isolation negative assertions before any
  final V6-M6 acceptance claim.
- Keep production refresh and real-team longitudinal completion unclaimed until
  their evidence is collected.

## 2026-07-21 M6-C Start

Status: started, not accepted.

Change:

- The local verifier now has a `full` browser mode alias and a
  `negativeAssertions` result block.
- The unauthorized actor assertion now calls the accepted
  `confirmCandidateTensionWithHuman` service boundary through `tsx -e` with
  the disposable database URL instead of relying on a SQL foreign-key failure.
- The verifier currently records:
  - cross-tenant scoped SQL denial,
  - invalid lifecycle denial through the browser meeting-start route,
  - zero-residue rollback for negative fixture rows,
  - unauthorized actor denial through the candidate tension service boundary
    when the full browser/verifier path can run against the disposable DB.

Previous unauthorized actor gap:

- A foreign-key failure or scoped SQL `rowCount = 0` is not sufficient evidence
  that an accepted LoopOS service/action boundary denied an unauthorized
  same-tenant actor.
- The verifier has been corrected to call the real service boundary, but full
  browser/verifier evidence has not yet been collected.

Current blocker:

- A local Next dev server is already running on `localhost:3001` for the same
  repository. Next refused a parallel disposable-DB dev server with
  `Another next dev server is already running`.
- The existing `3001` server points at the default local `.env` database, which
  is missing `candidate_tensions` and therefore cannot serve as M6-C evidence.

Coordinator verification:

```text
node -c scripts/m6b-local-integrated-trial-verifier.cjs
```

Result: passed.

```text
./node_modules/.bin/tsx --test src/lib/candidate-tensions/service.test.ts
```

Result: passed, 5 tests / 1 suite / 0 failures. This focused gate includes the
same-tenant non-owner-role human denial for `confirmCandidateTensionWithHuman`.

```text
npm run build
```

Result: passed. Compile, TypeScript, page data, static generation, and route
optimization completed.

```text
git diff --check -- scripts/m6b-local-integrated-trial-verifier.cjs GOALS.md docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md docs/evidence/2026-07-21-v6-m6b-local-integrated-verifier.md progress-dashboard.html
```

Result: passed.

Next required work:

- Run the verifier against a disposable database through a server that is
  actually bound to that database.
- Prove the verifier's service-boundary unauthorized actor assertion inside the
  disposable DB browser/full run.
- Only after that, send M6-C for independent implementation review and
  roadmap/evidence audit.

## 2026-07-21 M6-C Full Local Pass

Status: local full verifier passed; M6-C not accepted until independent review.

Setup:

- Disposable DB `loopos_m6c_full_20260721_1` was created and fully migrated.
- Production build had already passed.
- Local production server was started on `http://127.0.0.1:3034` with
  `DATABASE_URL=postgresql://heyiqing@localhost:5432/loopos_m6c_full_20260721_1`.

Command:

```bash
NODE_PATH=/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules DATABASE_URL=postgresql://heyiqing@localhost:5432/loopos_m6c_full_20260721_1 node scripts/m6b-local-integrated-trial-verifier.cjs --mode full --base-url http://127.0.0.1:3034 --screenshot-dir /tmp/loopos-m6c-full-20260721-8
```

Result summary:

```json
{
  "ok": true,
  "readinessOnly": false,
  "browserResult": {
    "ok": true,
    "browser": {
      "registered": true,
      "activated": true,
      "candidateConfirmed": true,
      "tacticalOutcomeApproved": true,
      "actionAssigned": true,
      "governanceProcessAdopted": true,
      "governanceRoleCreated": true,
      "mobileOverflow": false
    },
    "negativeAssertions": {
      "ok": true,
      "assertions": [
        { "name": "cross-tenant denial", "status": "pass" },
        { "name": "unauthorized actor denial", "status": "pass" },
        { "name": "zero residue", "status": "pass" },
        { "name": "invalid lifecycle denial", "status": "pass" }
      ],
      "gaps": []
    },
    "ledger": {
      "console": [],
      "page": [],
      "http": []
    }
  }
}
```

Key negative assertion evidence:

- Cross-tenant denial: scoped update row count `0`, scoped read count `0`, and
  original candidate stayed `CONFIRMED`.
- Unauthorized actor denial: `confirmCandidateTensionWithHuman` returned
  `HUMAN_OWNER_ROLE_ASSIGNEE_REQUIRED`; candidate stayed `DETECTED` with no
  `confirmedTensionId`, no `confirmedById`, and `auditEvents = 0`.
- Zero residue: rollback fixture rows were all `0` after rollback.
- Invalid lifecycle denial: attempted `ACTIVE_TO_SETUP` transition failed with
  SQLSTATE `55000` and message `Organization activation is irreversible`.

Screenshots:

- `/tmp/loopos-m6c-full-20260721-8/desktop-brain.png`
- `/tmp/loopos-m6c-full-20260721-8/mobile-organization.png`

Cleanup:

- Temporary server on port `3034` was stopped.
- Disposable DB `loopos_m6c_full_20260721_1` was dropped.
- Cleanup verifier reported `existsAfterDrop: 0`.
- Direct PostgreSQL residue check returned `0` for
  `pg_database.datname = 'loopos_m6c_full_20260721_1'`.

Final coordinator checks:

- `node -c scripts/m6b-local-integrated-trial-verifier.cjs`: passed.
- `./node_modules/.bin/tsx --test src/lib/candidate-tensions/service.test.ts`:
  passed, 5 tests / 1 suite / 0 failures.
- `git diff --check -- scripts/m6b-local-integrated-trial-verifier.cjs GOALS.md docs/plans/2026-07-20-v6-ai-native-organization-bootstrap-implementation-plan.md docs/evidence/2026-07-21-v6-m6b-local-integrated-verifier.md progress-dashboard.html`:
  passed.
- Process cleanup check found no remaining `PORT=3034`,
  `loopos_m6c_full`, or `next start` process except the check command itself.

Remaining non-claims:

- M6-C is not accepted until independent implementation review and
  roadmap/evidence audit pass with no open P0/P1/P2.
- This remains local fixture evidence; production deployment, BioCoach
  isolation, rollback, and real-team longitudinal evidence are separate gates.
- Full UI-first first-run setup is not yet proven because readiness facts are
  still SQL-seeded in this verifier path.

Exact SQL-seeded facts that must be UI-proven or treated as production-trial
preconditions in the next slice:

- Organization purpose is updated directly.
- Main circle lead and tactical cadence are set directly.
- First accountable human Role is created and assigned directly.
- Organization Brain profile is inserted directly.
- Goal cycle, Goal proposal, Goal decision, adopted Goal, and Goal target are
  inserted directly.
- Detector Agent person is inserted directly.
- Formal tactical/governance tensions are inserted directly.
- Candidate tension is inserted directly before the browser confirms it.

## 2026-07-21 M6-C Re-Run After Implementation Review Findings

Independent implementation review found:

- P1: cross-tenant denial was previously only scoped SQL row-count evidence.
- P2: zero-residue evidence did not explicitly include service-boundary fixture
  rows created by the unauthorized actor child process.

Fix:

- Cross-tenant denial now uses the same accepted
  `confirmCandidateTensionWithHuman` service boundary as same-tenant
  unauthorized denial.
- The child service-boundary assertion returns cleanup residue counts for
  same-tenant unauthorized person, cross-tenant user/person/circle/organization,
  temporary tensions, temporary candidates, and audit events.
- Main `zero residue` now requires both transaction rollback residue and
  service-boundary cleanup residue to be zero.

Command:

```bash
NODE_PATH=/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules DATABASE_URL=postgresql://heyiqing@localhost:5432/loopos_m6c_full_20260721_2 node scripts/m6b-local-integrated-trial-verifier.cjs --mode full --base-url http://127.0.0.1:3034 --screenshot-dir /tmp/loopos-m6c-full-20260721-9
```

Result summary:

```json
{
  "ok": true,
  "browserResult": {
    "ok": true,
    "negativeAssertions": {
      "ok": true,
      "assertions": [
        {
          "name": "cross-tenant denial",
          "status": "pass",
          "evidence": {
            "boundary": "confirmCandidateTensionWithHuman",
            "expectedError": "HUMAN_OWNER_ROLE_ASSIGNEE_REQUIRED",
            "auditEvents": 0
          }
        },
        {
          "name": "unauthorized actor denial",
          "status": "pass",
          "evidence": {
            "boundary": "confirmCandidateTensionWithHuman",
            "expectedError": "HUMAN_OWNER_ROLE_ASSIGNEE_REQUIRED",
            "auditEvents": 0
          }
        },
        {
          "name": "zero residue",
          "status": "pass",
          "evidence": {
            "serviceBoundaryRowsAfterCleanup": {
              "sameTenantPeople": 0,
              "crossTenantPeople": 0,
              "crossTenantCircles": 0,
              "crossTenantOrganizations": 0,
              "crossTenantUsers": 0,
              "tensions": 0,
              "candidates": 0,
              "auditEvents": 0
            }
          }
        },
        { "name": "invalid lifecycle denial", "status": "pass" }
      ],
      "gaps": []
    },
    "ledger": {
      "console": [],
      "page": [],
      "http": []
    }
  }
}
```

Cleanup:

- Temporary server on port `3034` was stopped.
- Disposable DB `loopos_m6c_full_20260721_2` was dropped.
- Cleanup verifier reported `existsAfterDrop: 0`.

Current status:

- Same-reviewer implementation reclosure passed with no open P0/P1/P2 after
  confirming the P1 and P2 fixes.
- Roadmap/evidence reclosure passed with no open P0/P1/P2 after stale
  implementation-review pending wording was removed.
- M6-C local evidence slice is accepted as fixture evidence. It does not accept
  V6-M6 overall because UI-first setup, production deployment, BioCoach
  isolation, rollback, and real-team longitudinal evidence remain separate
  unproven gates.
