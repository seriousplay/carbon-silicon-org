# V5-M8 Configuration Browser Evidence

## Scope

This evidence covers the M8 organization-configuration entry point and a fresh
uninitialized organization. It does not claim the four-week real-team gate.

## Execution

- Service: local LoopOS development service at `http://localhost:3013` (same-origin access is required for Next development Server Actions)
- Runner: `scripts/m8-configuration-browser-acceptance.cjs`
- Mode: `M8_REGISTER=1`, unique temporary account, authenticated Playwright
- Browser errors: none after ignoring the known development-only Next HMR WebSocket message

## Result

```json
{
  "ok": true,
  "setupProfile": true,
  "terminology": true,
  "governanceRules": true,
  "initialized": false,
  "templateNames": [
    "精益团队",
    "专业服务 / 项目型组织",
    "传统职能型组织",
    "大模型团队"
  ]
}
```

With `M8_INIT_TEMPLATE=professional-services`, the same run returned
`initializedTemplate = "professional-services"` and navigated to
`/app/circles/map`. A PostgreSQL check confirmed three generated circles and
the expected names above.

With `M8_ROLE_LIFECYCLE=1`, the same fresh organization also completed one
browser role lifecycle: an authenticated member opened the role market,
submitted an application with motivation, capability, and commitment, observed
the pending state after refresh, and withdrew the application.

The equivalent run with `M8_INIT_TEMPLATE=functional-team` also passed. The
database contained `主回路`, `运营回路`, and `持续改进回路`, and the role-market
application/withdrawal lifecycle returned `roleLifecycle = true`.

The governance variant (`M8_ROLE_GOVERNANCE=1`) also passed for a fresh
functional-team organization: it created one governance-source Tension and one
governance Meeting, then submitted the role application through the inbox into
the meeting proposal URL. Before cleanup, the database counts were
`circles=3`, `tensions=1`, `meetings=1`, `applications=1`, and
`decision_records=0`; no direct assignment was performed.

The same single-member fixture then attempted `ADOPT_ROLE`. The browser
captured the real Server Action request and response `{"error":"PROPOSER_CONFIRMATION_DISABLED"}`.
This is the expected distributed-authority denial: the only member was both
the tension proposer and the meeting participant. A second member fixture is
required to prove successful adoption, so no adoption claim is made.

The two-member rerun then passed the full confirmation path: a second member
was added to the organization and meeting, logged in separately, and adopted
the proposal. Before cleanup, PostgreSQL showed `decision_records=1`,
`role_assignment_history=1`, `accepted_applications=1`, and
`adopted_processes=1`. The meeting UI showed `ADOPTED`, the decision link, and
the change-log link.

The same two-member fixture then completed the exit path: the assigned person
submitted a new exit Tension, initialized a `ROLE_UNASSIGNMENT` proposal, and
the second member adopted it. Before cleanup, PostgreSQL showed
`decision_records=2`, `assigned=1`, `released=1`, and `adopted_processes=2`.
The acceptance runner now waits for and asserts the `RELEASED` history row.

The nomination variant also passed: the administrator selected an empty role
and a second human member, the nominee saw and accepted the nomination, and
the database recorded one nomination with the application in `PENDING`. The
same pre-confirmation query showed `assignments=0` for the nominated role;
the later governance application remained separate and was the only one
confirmed in that run.

## Cleanup

The two temporary organizations created during the initial failed-HMR run and
the successful run were deleted by organization id. A follow-up PostgreSQL
query returned `residue = 0` for both organization ids and the temporary
organization-name prefix.

## Boundary

This proves the configurable onboarding surface and template visibility. It
also proves that selecting professional-services and functional-team templates
creates their expected starting structures and that a member can submit and
withdraw a role application. The two-member run proves governance confirmation,
assignment history, exit release history, and the nomination-to-pending boundary.
Brain actions, weekly tension-to-closure, and longitudinal real-team adoption
are not proven.

## M8-A Brain Tactical Closure Evidence

Runner: `scripts/m8-brain-tactical-browser-acceptance.cjs`.

Fresh functional-organization and professional-services-organization fixtures
completed the following identical browser path:

`Brain question -> tactical outcome preview -> explicit confirmation -> tactical meeting -> record approval -> Action`

The runner verified the page states and the database result:

```json
{
  "ok": true,
  "tensionToBrainPreview": true,
  "previewConfirmed": true,
  "tacticalMeetingApproved": true,
  "database": {
    "actions": "1",
    "approved_proposals": "1",
    "assigned_tensions": "1"
  }
}
```

The implementation reuses the existing `tactical_outcome.submit_proposal`
command handler and the existing meeting result transaction. Preview source
bindings are actor- and tenant-scoped; confirmation rejects stale tension,
meeting, or Circle bindings. The runner deletes the temporary organization in
`finally`; no claim is made about four-week real-team adoption.

Both template runs returned the same result (`actions=1`,
`approved_proposals=1`, `assigned_tensions=1`). This is local disposable-fixture
evidence that the workflow is not tied to one non-model template; it is not
production or longitudinal adoption evidence.

The configuration runner also passed for the lean-team template. Its starting
structure has no vacancy card in the role market, so the runner now requires
and records an honest empty state instead of assuming every template must have
an immediately applicable role. The three-template configuration regression
therefore covers lean, professional-services, and functional organizations.

## M8-4 Brain Role Application Evidence

Runner: `scripts/m8-brain-role-application-browser-acceptance.cjs`.

On a fresh professional-services organization, the browser completed:

`Brain question -> role application composer -> confirmation -> pending application`

The result was:

```json
{
  "ok": true,
  "brainRoleApplicationPreview": true,
  "previewConfirmed": true,
  "governanceStillRequired": true,
  "database": { "status": "PENDING", "assignees": "0" }
}
```

The first run exposed a missing PostgreSQL command whitelist migration for
`role_application.create`; migration
`20260719110000_v5_m8_brain_role_application_command_check` was applied before
the successful rerun. This proves the Brain role-application boundary locally;
it does not grant automatic appointment authority.

## M8-4 Brain Governance Closure Evidence

The updated `scripts/m6-3-browser-acceptance.cjs` completed a fresh
organization flow with a second meeting participant:

`Brain governance composer -> preview -> explicit confirmation -> READY -> second participant adopts -> ADOPTED`

All nine acceptance steps returned `ok: true`, including governance process
initialization and structural adoption. The first single-participant attempt
was correctly rejected by the distributed-authority rule; the successful rerun
added a distinct reviewer before adoption. Temporary organization cleanup used
the controlled acceptance-database cleanup path and returned zero residue.
