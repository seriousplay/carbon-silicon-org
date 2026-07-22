# V5 M6-1C Brain-first Command Center Evidence

Date: 2026-07-17

Status: accepted; M6-2A activated

## Scope

M6-1C turns the `/app` Brain home into the primary command surface without
changing the accepted M6-1B Actor-scoped projection, ranking, evidence links,
navigation-only actions, or canonical domain authority.

The slice adds:

- a compact Brain-first workspace before the sensing projection;
- coherent recent private work, private brief, conversation, process, input,
  retry, denied, provider-unavailable, and error states;
- system light/dark themes and reduced-motion support;
- semantic status colors with measured small-text contrast;
- a repeatable disposable-database browser verifier.

No domain write path, authorization policy, database schema, migration,
credential, deployment configuration, or BioCoach application/data was added
or changed by this slice.

## Static And Build Evidence

- Focused tests: 45 tests passed, zero failed.
- Scoped ESLint: zero errors.
- TypeScript: `tsc --noEmit` passed.
- `git diff --check`: passed.
- Production build: 36 of 36 routes generated successfully.
- Existing Next.js middleware deprecation warning remains outside this slice.
- The broader source-runner boundary remains the M6-1B-recorded unrelated
  setup-action invalid-TAP harness debt; this slice does not claim it fixed.

## Browser Evidence

The final run used a disposable PostgreSQL database with all 27 migrations and
a temporary safe `loopos_brain_reader` role. The server used a production build
with the model provider intentionally disabled so the browser could exercise
the honest provider-unavailable state without an external model request.

The verifier returned `ok=true` for all four initial viewports:

| Viewport | Input initial bounds | Nav overlap | Horizontal overflow |
| --- | ---: | --- | --- |
| desktop light | 621-685 | no | no |
| desktop dark | 621-685 | no | no |
| mobile light | 686-752 | no | no |
| mobile dark | 686-752 | no | no |

The input is visible without scrolling in every viewport. The run also proved:

- exactly three focus items in stable order across all four views;
- three evidence links and three navigation-only action links, all internal;
- actual click navigation for the first evidence and action links;
- healthy-state Goal, next-meeting, and active-project labels remain present;
- a new private conversation becomes explicitly selected;
- keyboard submission reaches the visible `模型不可用` state;
- zero console warnings/errors, page errors, or application HTTP responses at
  status 400 or above;
- zero user, person, organization, session, and account smoke residue.

After the run, the disposable database and temporary role were removed. The
cluster residue check returned `0|0`.

## Theme And Contrast Evidence

Computed body colors switch from warm light to soil dark under the system media
preference. The four Brain semantic colors were measured against the computed
body background:

| Semantic color | Light contrast | Dark contrast |
| --- | ---: | ---: |
| success | 5.09:1 | 12.19:1 |
| information | 4.98:1 | 11.81:1 |
| warning | 6.59:1 | 11.87:1 |
| danger | 6.01:1 | 9.02:1 |

Every measured ratio is at least 4.5:1.

The final roadmap audit found that the first verifier measured semantic tokens
against the body rather than the warning badge's translucent rendered
background. Its first correction also parsed Chromium's `oklab(...)` output as
RGB. The final verifier uses Canvas to convert every computed CSS color to sRGB
before alpha-compositing the actual ancestor backgrounds of the rendered
`模型不可用` badge. The resulting effective contrast is 6.08:1 in light mode
and 10.02:1 in dark mode.

Screenshots:

- `docs/evidence/assets/2026-07-17-v5-m6-1c-desktop-light.png`
- `docs/evidence/assets/2026-07-17-v5-m6-1c-desktop-dark.png`
- `docs/evidence/assets/2026-07-17-v5-m6-1c-mobile-light.png`
- `docs/evidence/assets/2026-07-17-v5-m6-1c-mobile-dark.png`
- `docs/evidence/assets/2026-07-17-v5-m6-1c-provider-unavailable-light.png`
- `docs/evidence/assets/2026-07-17-v5-m6-1c-provider-unavailable-dark.png`

## Independent Review

The first independent UX/implementation review returned HOLD with two P1 and
one P2 finding:

- the primary Brain input was below the initial viewport;
- dark-theme status/evidence small text had insufficient contrast;
- browser evidence did not click navigation or exercise a provider-off state.

The workspace was moved ahead of sensing and compacted, theme-aware semantic
colors were added, mobile fixed-navigation overlap was removed, and the browser
verifier was strengthened. The same reviewer re-ran the focused tests and
returned `ACCEPT M6-1C` with no remaining P0, P1, or P2.

The first final roadmap/evidence audit then found one P1 in the contrast proof:
the translucent warning badge background was not included in the measured
ratio. The correction and rendered-element measurements above are complete;
its first reclosure also rejected numeric parsing of Chromium `oklab(...)` as
RGB. After the Canvas sRGB correction, the same auditor returned
`ACCEPT M6-1 AND ACTIVATE M6-2` with no open P0/P1/P2.

## Mandatory BioCoach Isolation Gate

The production security gate was refreshed independently from the local UI
run. This does not claim that the M6-1 UI was deployed.

- Brain Reader readiness: pass.
- Reader mutation attempt: denied with exact PostgreSQL SQLSTATE `42501`.
- `loopos_brain_login` to `biocoach`: denied with exact `42501`.
- `loopos_app` to `biocoach`: denied with exact `42501`.
- Both LoopOS credentials to `postgres`: denied with exact `42501`.
- BioCoach local HTTP: `200`.
- BioCoach public HTTP: `200`.
- PM2 `biocoach`, `loopos-web`, and `loopos-worker`: online.
- Temporary verifier files on the production host: removed.

The isolation verifier only accepts permission denial `42501`; authentication,
DNS, network, or timeout failures cannot pass. No BioCoach code, configuration,
schema, table, row, credential, migration, Nginx rule, or PM2 configuration was
read as application data or modified.

## Artifact Hashes

- M6-1C browser verifier: `6aeb62bc59eef1d6b34232ef7ced6693a41db7f6a1246fe36da578135a77b9ae`
- production readiness verifier: `ee6edb24884b737741eb88764b637d4fd383fe2dee2f2a78b51e95d94dcf80a0`
- production mutation verifier: `cf3f9397dc698b4d3ebc6d5253bc424fa047e30e873a505c5d529c2a12f1cf79`
- production isolation verifier: `481e5a40d7607836e27aac69e4b3d82892be215e6b42b3b7ac76071a002dc3aa`
- desktop light screenshot: `6e7321230215c41e69f88df4a81bc97fdb9f2069f9b4b55aded1ab24556bd7c9`
- desktop dark screenshot: `27265f235f28d2d2b964a543dc0996b9d0654246f79766d149250107c703e5f5`
- mobile light screenshot: `e7113e0ae1df0e5006e428182ec73a2eae5950b85ee64c598444a4429ca21f6c`
- mobile dark screenshot: `7c5d07bcc51f451da54830ecf94d0f209243dd777aba5fb994cf796d282f9c9f`
- provider-unavailable light screenshot: `094157a286db2ca8484b1da773ee50865cd320272e38e98a1a0a940d5c7260a1`
- provider-unavailable dark screenshot: `174652157f539638dbaebd4e1e88a48695e1f5c6605c5c8658af39e851dc241e`

## Remaining Evidence Boundary

- The M6-1 UI has not been deployed by this slice.
- Longitudinal evidence from a real team completing repeated weekly governance
  cycles remains unproven and deferred to M6-6.
- M6-2A is active; M6-2B and later slices remain inactive until their own
  evidence and audit gates pass.
