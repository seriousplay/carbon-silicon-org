# V6-M6-D UI-First Setup Gap Closure

Date: 2026-07-21

## Conclusion

M6-D is accepted as local UI-first setup evidence. The current product already
exposes several UI-first setup paths, and the verifier now replaces M6-C
SQL-seeded setup facts with browser actions wherever accepted UI already
exists. A full disposable browser run passed for M6-D, and independent
implementation review plus roadmap/evidence audit reclosure returned PASS.

## Gap Matrix

| M6-C seeded setup fact | Current UI/action evidence | M6-D decision |
| --- | --- | --- |
| Organization purpose | `/app/organization` renders `OrganizationProfileForm` in `01 组织身份`; `saveOrganizationProfileAction` updates `organization.name` and `organization.purpose`. | Verifier now performs this through browser UI. |
| Main structure | `/app/organization` renders template initialization in `02 组织结构`; initialized organizations route users to `/app/circles/map`. | Verifier now performs template initialization through browser UI. |
| Main circle lead and tactical cadence | Template initialization assigns the root lead to the admin, but no direct setup UI was confirmed for tactical cadence. | Lead is covered by UI initialization; cadence remains an explicit fixture precondition. |
| First accountable human Role | Template initialization creates roles and assigns the root `CIRCLE_LEAD` role to the admin. | Verifier now derives the assigned lead role from UI-created data. |
| Role assignment | Role market supports application creation, and governance adoption supports `ROLE_ASSIGNMENT`; direct setup assignment was not confirmed. | Defer direct assignment; production trial must prove application -> governance -> assignment or add a thin setup route later. |
| Organization Brain profile/model | `/app/organization#system-configuration` renders `ModelSettingsForm`; DeepSeek defaults are present and API key is saved through the model-settings action. | Verifier only proves the model settings section is visible. Persisted model configuration and Brain profile remain explicit preconditions until browser-proven. |
| Goal cycle | Initialization creates a first goal cycle if none exists; `/app/goals` also renders `CreateCycleForm`. | Verifier now proves the goal page after UI initialization and reuses the UI-created cycle. |
| Goal proposal | Goal draft UI renders title, intended outcome, owner role, targets, and submit controls; actions create and submit proposals. | Close only if prerequisite owner role exists through UI or fixture. |
| Goal decision, adopted Goal, Goal target | Strategic meeting workbench and goal decision actions exist, but adoption requires an active cycle and a submitted proposal routed to a strategy meeting. | Defer until browser verifier proves proposal -> meeting -> adoption, or keep it as a production-trial precondition. |
| Detector Agent person | No setup UI confirmed for creating the detector Agent person. | Defer; do not add automatic sensing or scheduler logic in M6-D. |
| Formal tactical/governance tensions | `/app/tensions/new` supports title, detailed description, mode, circles, and tactical-only meeting context. | Verifier now creates both formal tensions through browser UI after activation. |
| Candidate tension before browser confirmation | `/app/tensions` exposes candidate review, but candidate creation is intentionally not a user form. | Defer candidate seeding as an AI-sensing fixture until the sensing service is explicitly activated in a later milestone. |

## Evidence

- M6-D verifier syntax check passed:
  `node -c scripts/m6b-local-integrated-trial-verifier.cjs`.
- Default `.env` readiness still fails because the local default database is
  stale and lacks `candidate_tensions`; this is not M6-D acceptance evidence.
- Disposable readiness passed with
  `loopos_m6d_readiness_20260721_1`: database created, all migrations applied,
  required tables including `candidate_tensions` present, disposable database
  dropped, and `existsAfterDrop: 0`.
- Disposable full browser verifier passed with
  `loopos_m6d_full_20260721_3` through local production server
  `http://127.0.0.1:3035` and screenshots in
  `/tmp/loopos-m6d-full-20260721-7`.
- The full browser verifier proved organization purpose, structure
  initialization, goal cycle availability, tactical tension creation, and
  governance tension creation through UI. It kept tactical cadence, Organization
  Brain model/profile persistence, goal proposal/decision/adopted-goal/target,
  detector Agent, and candidate tension creation as explicit fixture
  preconditions.
- The full browser verifier also proved organization activation, candidate
  tension confirmation, tactical meeting creation, governance meeting creation,
  tactical outcome approval, assigned Action creation, governance process
  adoption, governance Role creation, Organization Brain visit, mobile overflow
  false, and empty console/page/http ledgers.
- PostgreSQL/service-boundary negative assertions passed for cross-tenant
  denial, unauthorized actor denial, zero fixture residue, and invalid
  lifecycle denial with SQLSTATE `55000`.
- The temporary production server on port `3035` was stopped and disposable
  database `loopos_m6d_full_20260721_3` was dropped after the run.
- `/app/organization` shows setup mode, readiness gates, seven setup steps,
  organization identity, structure initialization, goals, roles, invitations,
  role assignment, and system configuration:
  `src/app/app/organization/page.tsx:36-42`,
  `src/app/app/organization/page.tsx:66-181`,
  `src/app/app/organization/page.tsx:184-339`.
- Setup readiness requires organization purpose, one root structure, human key
  role assignment, goal cycle plus active goal, and model configuration:
  `src/lib/organization-setup/setup-workspace-read-model.ts:120-125`.
- Organization setup step links and completion rules are centralized in the
  setup read model:
  `src/lib/organization-setup/setup-workspace-read-model.ts:127-183`.
- Goal cycle creation is backed by `createGoalCycleAction`:
  `src/app/app/goals/actions.ts:55-80`.
- Goal proposal creation and submission are backed by canonical goal actions:
  `src/app/app/goals/actions.ts:258-340`.
- Goal draft UI captures goal name, expected result, owner role, and target
  criteria:
  `src/app/app/goals/goal-draft-form.tsx:533-599`.
- Role market currently creates role-assignment applications rather than direct
  assignment:
  `src/app/app/roles/market/actions.ts:17-47`.
- Candidate tension inbox and authorized review actions exist, but there is no
  user-facing creation form for detected candidates:
  `src/app/app/tensions/page.tsx:61-117`,
  `src/app/app/tensions/page.tsx:182-253`.
- Organization model settings UI exposes provider, model name, base URL,
  thinking mode, and API key configuration:
  `src/app/app/setup/model-settings-form.tsx:29-49`,
  `src/app/app/setup/model-settings-form.tsx:94-199`.
- New formal tension UI supports title, detailed description, AI
  structuring, handling mode, tactical-only hidden mode, meeting return
  context, and circles:
  `src/app/app/tensions/new/page-client.tsx:63-169`.

## Required Next Evidence

- Move to the next V6-M6 production gate.
- Keep SQL seeding only for facts without an accepted UI path in this slice:
  tactical cadence, Organization Brain model/profile persistence, detector
  Agent person, candidate tension creation, and the full goal
  proposal/decision/adopted-goal/target path not yet proven by browser.
- Keep production deployment, rollback, BioCoach isolation, and real-team
  longitudinal trial as separate unclaimed V6-M6 gates.

## Blockers

No M6-D blocker. V6-M6 remains incomplete until production deployment,
rollback, BioCoach isolation, and real-team longitudinal evidence pass.
