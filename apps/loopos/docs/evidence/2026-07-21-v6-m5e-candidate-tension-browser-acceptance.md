# V6-M5-E Candidate Tension Browser Acceptance Evidence

Date: 2026-07-21

Scope: prove the candidate tension inbox and human review action flow in a
browser with disposable fixtures and cleanup.

Implementation:

- Added `scripts/m5e-candidate-tension-browser-acceptance.cjs`.
- The verifier registers a temporary organization, seeds an owner Role assigned
  to the current human, a read-only Role not assigned to the current human, an
  AI detector, a formal Tension, and three detected candidate tensions.
- Browser proof covers:
  - visible `AI 候选张力` inbox on `/app/tensions`;
  - evidence/sourceRef display;
  - owner-role human assignee can see review actions;
  - non-assignee candidate card shows read-only notice;
  - confirming a candidate links it to an existing formal same-organization
    Tension;
  - DB state becomes `CONFIRMED` with one audit event;
  - browser console/page/http ledger stays clean.
- Cleanup deletes the temporary organization/user fixture and candidate
  records, checks default DB residue, and can drop the disposable DB itself.

Source evidence:

```text
node -c scripts/m5e-candidate-tension-browser-acceptance.cjs
exit 0
```

```text
./node_modules/.bin/eslint scripts/m5e-candidate-tension-browser-acceptance.cjs
exit 0
```

Browser evidence:

```text
DATABASE_URL=postgresql://heyiqing@localhost:5432/loopos_m5e_browser_20260721_2 \
NODE_PATH=/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules \
/Users/heyiqing/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node \
scripts/m5e-candidate-tension-browser-acceptance.cjs \
--base-url http://127.0.0.1:3025 \
--screenshot-dir /tmp/loopos-m5e-browser-20260721-2 \
--default-database-url postgresql://heyiqing@localhost:5432/loopos \
--temp-db-name loopos_m5e_browser_20260721_2 \
--drop-temp-db-after-cleanup true
```

Result:

```json
{
  "ok": true,
  "cleanupOk": true,
  "residue": {
    "users": 0,
    "people": 0,
    "organizations": 0,
    "candidate_tensions": 0,
    "candidate_audit_events": 0
  },
  "defaultResidue": {
    "users": 0,
    "people": 0,
    "organizations": 0
  },
  "tempDbExists": 0,
  "ledger": {
    "console": [],
    "page": [],
    "http": []
  },
  "screenshotDir": "/tmp/loopos-m5e-browser-20260721-2"
}
```

Environment evidence:

- Disposable DB `loopos_m5e_browser_20260721_2` was created.
- `prisma migrate deploy` applied all 47 migrations successfully to the
  disposable DB.
- Isolated server `http://127.0.0.1:3025` was started with the disposable DB.
- Disposable DB was dropped by the verifier after browser proof.
- Default local DB cleanup removed three temporary failed-attempt fixtures from
  earlier non-isolated script attempts and removed two orphan `_PersonRoles`
  rows.
- Final residue check:

```json
{
  "defaultResidue": {
    "users": 0,
    "people": 0,
    "organizations": 0
  },
  "tempDbExists": 0
}
```

Boundaries:

- M5-E does not add product domain logic.
- M5-E does not add automatic signal scanning.
- M5-E does not let AI create formal `Tension` records.
- M5-E does not add scheduler, worker, deployment, broad notifications,
  semantic/vector retrieval, or BioCoach integration.

Independent review:

- Implementation review by James initially failed with P1/P2: temp/default DB
  cleanup proof was outside the verifier output, and read-only notice assertion
  was not scoped to the non-assignee candidate card. The verifier now outputs
  `defaultResidue` and `tempDbExists`, can drop the disposable DB itself, and
  scopes read-only notice to the non-assignee candidate article.
- Implementation reclosure by James returned PASS with no P0/P1/P2 findings.
- Roadmap/evidence audit by Chandrasekhar returned PASS with no P0/P1/P2
  findings.
