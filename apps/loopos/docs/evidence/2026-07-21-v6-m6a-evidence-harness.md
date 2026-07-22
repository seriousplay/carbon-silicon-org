# V6-M6-A Evidence Harness Inventory

Date: 2026-07-21

Status: draft evidence inventory for active M6-A

Contract:

- `docs/plans/2026-07-21-v6-m6a-integrated-trial-contract.md`

Required harness entries:

| Gate | Current artifact | Status | Acceptance note |
| --- | --- | --- | --- |
| Trial contract | `docs/plans/2026-07-21-v6-m6a-integrated-trial-contract.md` | ready for review | Must pass independent review with no P0/P1/P2. |
| Local integrated browser | pending M6-B artifact | not ready | Must cover setup, activation, goal cycle, role assignment, tactical meeting, governance meeting, candidate tension confirmation, Brain support, desktop, and mobile. |
| PostgreSQL authority/isolation | pending M6-B artifact | not ready | Must prove tenant/authority boundaries and zero fixture residue. |
| Production evidence | existing production scripts/checklists are reusable inputs, but M6-specific run is not ready | not ready | Must prove health/readiness/authenticated smoke/migration/rollback for the M6 release. |
| BioCoach isolation | existing production isolation scripts are reusable inputs, but M6-specific run is not ready | not ready | Must prove exact denial for LoopOS app credentials and Brain reader. |
| UX review | pending M6 UX review | not ready | Must evaluate real administrator and member workflow friction. |
| Longitudinal real-team | pending M6 real-team runbook/verifier | not ready | Must not be replaced by fixture, smoke, or screenshot-only evidence. |

Existing reusable inputs:

- `scripts/verify-production-http.mjs`
- `scripts/verify-production-recovery-plan.mjs`
- `scripts/verify-production-brain-reader-readiness.mjs`
- `scripts/verify-production-brain-reader-boundary.mjs`
- `scripts/verify-production-brain-reader-isolation.mjs`
- `scripts/verify-production-brain-reader-mutation-denial.mjs`
- `scripts/verify-m5b-longitudinal-real-team.mjs`
- `scripts/verify-m8-longitudinal-real-team.mjs`
- `docs/evidence/production-browser-smoke-checklist.md`
- `docs/evidence/production-recovery-checklist.md`

Current M6-A result:

- M6-A is not accepted yet.
- V6-M6 is not accepted yet.
- No real-team longitudinal completion is claimed.
- No production refresh is claimed.
- BioCoach isolation remains a mandatory future evidence gate.
