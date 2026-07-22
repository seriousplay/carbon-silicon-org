# LoopOS V5 Organization Brain and Goal Tree Implementation Plan

Status: V5-M1 accepted; V5-M2-A contract review active
Design source: `docs/plans/2026-07-14-organization-brain-goal-tree-v5-design.md`

## 1. Execution Rules

- Keep exactly one V5 milestone active.
- The coordination thread owns goals, constraints, decisions, integration, and evidence.
- Delegate bounded implementation slices with disjoint write ownership.
- Workers report only `Conclusion / Changes / Evidence / Blockers`.
- Read relevant guides under `node_modules/next/dist/docs/` before changing Next.js code.
- Preserve unrelated dirty state and existing canonical tactical and governance behavior.
- Do not call a slice complete from source inspection, typecheck, or unit tests alone.
- After every milestone, run an independent implementation review and an independent `GOALS.md` versus repository audit before activating the next milestone.

## 2. Milestone Order

1. `V5-M1` Trustworthy Organization Brain Entry - accepted
2. `V5-M2` Goal Tree Closed Loop - active (`V5-M2-A` contract review)
3. `V5-M3` Brain-Assisted Goal Operations - pending
4. `V5-M4` Proactive Perception and Memory - pending
5. `V5-M5` Pluginization and Industry Hardening - pending

## 3. V5-M1 Acceptance Scenario

An ordinary member signs in and sees the four-entry application shell. From any page, the member opens the configured Organization Brain, asks:

- What Roles do I hold?
- What can I decide?
- What should I handle next?
- Which Circle or meeting page should I open?

The Brain dynamically reads only records authorized for that actor, labels confirmed facts, cites source records with current links, and opens the right application surface. A second tenant and an unauthorized contextual object remain undiscoverable. The user can continue a private conversation. The Brain cannot write organization state.

## 4. V5-M1 Scope

### In scope

- Canonical actor context for tenant, user, Person, Membership, assigned Roles, and contextual capabilities.
- Central read-policy contract for the existing data used by M1.
- Dedicated read-only database access path and database-enforced tenant restrictions.
- Validated dynamic structured queries over an allowlisted Brain read surface.
- Organization Brain profile, private conversations, messages, and query audit.
- Fact packets with provenance, timestamps, object types, and application links.
- Read-only reasoning response with fact, inference, advice, and insufficient-evidence states.
- Global side panel and full Brain workspace.
- Four-entry primary navigation, global Raise Tension action, quick-create menu, search, and notifications.
- Desktop and mobile browser evidence for ordinary member, Role assignee, and administrator.

### Out of scope

- Goal models, Goal Tree, or strategic Goal flow.
- Organization Brain writes or command execution.
- Shared memory candidates.
- Proactive monitoring or notifications.
- Arbitrary model-generated SQL.
- Interface plugin extraction.
- Tactical or governance behavior changes.
- Multi-organization switching.

## 5. V5-M1 Slices

### M1-A: Authorization Baseline

Outcome:
- One reusable actor context and one read-policy decision path replace M1-specific scattered assumptions.

Likely ownership:
- `src/lib/session.ts`
- new `src/lib/authorization/actor-context.ts`
- new `src/lib/authorization/read-policy.ts`
- focused tests under `src/lib/authorization/`

Required behavior:
- Resolve exact `organizationId`, `userId`, `personId`, membership Role, assigned Role IDs, and home Circle.
- Fail closed when Session, Membership, Person, and organization do not agree; M1 supports one exact active organization and does not select the first Membership implicitly.
- Give every current member read access to confirmed organization-operating facts.
- Keep private conversations and personal drafts owner-only, including against administrators.
- Require participation, ownership, or an explicit contextual capability for meeting drafts and other context-restricted records.
- Treat assigned Roles as relevance and action-authority context, not implicit extra read scope.
- Express object access without granting authority from UI visibility or transparent read access.
- Default deny unknown object types and capabilities.
- Preserve existing mutation authorization paths unchanged.

Evidence:
- Decision-table unit tests for organization-transparent, context-restricted, personal-private, and forbidden zones.
- Cross-tenant, missing-Person, stale-Role, and administrator cases.
- Administrator denial against another user's private Brain conversation.
- Session/Person/Membership mismatch and multiple-Membership fail-closed cases.
- No regression in existing permission and source tests.

### M1-B: Database Read Boundary and Audit Schema

Outcome:
- The Brain can query an authorized read surface while the database identity is incapable of mutation.

Likely ownership:
- `prisma/schema.prisma`
- one additive migration and reviewed reverse SQL
- new `src/lib/organization-brain/read-database.ts`
- new `src/lib/organization-brain/read-policy-context.ts`

Data additions:
- `OrganizationBrainProfile`
- `BrainConversation`
- `BrainMessage`
- `BrainQueryAudit`

Database boundary:
- Dedicated read-only role or equivalent deployment identity.
- Actor context scoped to a transaction.
- Tenant-safe Brain views or read schema for M1 object families.
- Database denial for wrong tenant even if the application filter is omitted.
- Explicit exclusion of auth, session, token, credential, and secret material.

Evidence:
- Migration apply, rollback review, and clean reapply on disposable PostgreSQL.
- Direct proof that the Brain database identity cannot insert, update, delete, alter, or access forbidden data.
- Two-tenant row-denial proof.
- Conversation owner-only proof.

### M1-C: Dynamic Query Broker and Evidence Packets

Outcome:
- Questions are not limited to fixed prompts; the Brain can compose validated reads over authorized existing facts.

Likely ownership:
- new `src/lib/organization-brain/query-plan.ts`
- new `src/lib/organization-brain/query-broker.ts`
- new `src/lib/organization-brain/evidence.ts`
- new `src/lib/organization-brain/link-resolver.ts`

Required behavior:
- Accept a typed query plan with allowlisted object families, relations, filters, sort, and bounded pagination.
- Reject unknown fields, cross-tenant identifiers, excessive depth, unbounded result sets, mutation intent, and forbidden object families.
- Enforce statement timeout and maximum rows.
- Return evidence packets containing source object, record ID, current timestamp or version, safe display fields, and application URL.
- Persist one audit entry that links the actor, query scope, result count, and conversation message.

M1 object families:
- Organization identity
- Circles and published Role definitions
- Current user's Role assignments and home Circle
- Tensions visible under the M1 policy
- All confirmed Projects and Actions in the active organization; current-user relevance affects ranking and default query focus, not visibility
- Meetings and confirmed decisions visible under the M1 policy
- Published governance records

Evidence:
- Query-plan fuzz and rejection tests.
- Two-tenant integration tests.
- Expensive-query and timeout tests.
- Prompt-injection text stored in organization records cannot change policy or query scope.

### M1-D: Read-Only Reasoning Contract

Outcome:
- The existing AI provider produces grounded, labeled, navigable answers and fails honestly.

Likely ownership:
- new `src/lib/organization-brain/reasoner.ts`
- new `src/lib/organization-brain/response-schema.ts`
- focused extensions to `src/lib/ai/provider.ts` only when required

Required behavior:
- Build prompts from evidence packets rather than raw unrestricted rows.
- Emit structured sections for facts, inference, recommendations, and missing evidence.
- Cite only evidence packet IDs supplied to the model.
- Reject invented source IDs and remove unsupported factual claims.
- Keep deterministic navigation and source display available when the model is unavailable.

Evidence:
- Provider-off fallback tests.
- Unsupported-citation and hallucinated-source tests.
- Chinese organization questions for Role, Circle, work, meeting, and authority context.
- No model output can create a write operation in M1.

### M1-E: Organization Brain UI and Four-Entry Shell

Outcome:
- Users see the approved daily-work experience and can reach the Brain from every page.

Likely ownership:
- `src/app/app/layout.tsx`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/mobile-nav.tsx`
- `src/components/layout/topbar.tsx`
- new Organization Brain components and route under `src/app/app/`
- existing destination pages only for required route compatibility

Required behavior:
- Primary navigation is `Workspace / Goals / Meetings / Organization`; Goals may show a clear M2-not-yet-available state until M2 rather than fake data.
- Global Brain control opens a stable side panel and can expand to a full workspace.
- Global Raise Tension remains one interaction away.
- Quick create exposes only authorized commands; in M1 it does not add Brain writes.
- Organization opens directly to the interactive map and stable secondary navigation.
- Meetings opens directly to active/upcoming/preparation content with a visible start action.
- Existing deep links remain reachable or redirect intentionally; no user data becomes inaccessible.
- Use the existing icon library where available and provide tooltips for unfamiliar icon controls.

Evidence:
- Desktop and mobile screenshots.
- Click-budget ledger for the approved frequent tasks.
- Keyboard, focus, screen-reader label, loading, empty, denied, and model-off states.
- No overlapping UI, clipped text, console error, page error, or unclassified failed request.

### M1-F: Runtime Rehearsal and Independent Gate

Outcome:
- M1 is proven as a trustworthy read-only vertical slice before M2 begins.

Required environments:
- Disposable PostgreSQL for database security and migration evidence.
- Local signed-in browser for three same-organization actors and one second-tenant actor.
- Production-like build/runtime for model-off and failure degradation.

Required evidence:
- Focused tests and full source test runner.
- TypeScript, scoped ESLint, Prisma validate, and production build.
- Migration apply, reverse review, reapply, read-only identity, and tenant-denial logs.
- Browser paths for configured Brain, private conversation, grounded answer, sources, deep links, denial, and degradation.
- Independent `/review` findings closed or explicitly retained by product owner.
- Independent `GOALS.md` versus repository audit passes.
- Servers, browsers, test accounts, and disposable databases cleaned up.

## 6. V5-M2 Outline: Goal Tree Closed Loop

Activate only after M1 is accepted.

Outcome:
- One root Circle and one child Circle complete a real shared-cycle Goal flow.

Core additions:
- `GoalCycle`
- `Goal`
- `GoalTarget`
- immutable `GoalCheckIn`
- strategic Goal proposal and confirmation provenance
- parent Goal support relation constrained by Circle hierarchy and cycle
- database-enforced one active Goal per Circle per cycle

Browser acceptance:
- Root Goal draft and strategic confirmation.
- Child Goal draft, explicit support relation, and strategic confirmation.
- Numeric and milestone Target updates with evidence.
- Tactical inspection produces a Tension, Project, or Action without changing the Goal silently.
- Goal Tree and Workspace show alignment and missing evidence.

## 7. V5-M3 Outline: Brain-Assisted Goal Operations

- Add Goal facts to the read surface.
- Add the allowlisted command registry.
- Draft Goal, Target, check-in, Tension, Project, Action, and meeting material.
- Require preview, explicit confirmation, fresh authorization, idempotency, and audit.
- Prove stale preview rejection and no bypass of strategic, tactical, or governance processes.

## 8. V5-M4 Outline: Proactive Perception and Memory

- Add deterministic signal rules before AI narration.
- Add daily brief and meeting-preparation surfaces.
- Add private-to-shared memory candidates.
- Route confirmation by source authority.
- Add validity, expiry, supersession, and notification deduplication.
- Prove private conversation isolation and absence of silent memory promotion.

## 9. V5-M5 Outline: Pluginization and Industry Hardening

- Keep minimal Circle Interface in core.
- Gate designer, runtime, validation, and Data -> Pretraining template behind Interface Automation.
- Remove the four current interface entries from primary navigation.
- Add plugin enablement, capability discovery, degraded states, and audit.
- Complete performance, observability, backup/recovery, AI adversarial testing, and longitudinal real-team evidence.

## 10. Completion Boundary

V5 is not industry-grade merely because M1-M5 source code is merged. The final claim requires:

- Accepted evidence for every milestone.
- No unresolved P0/P1 security or authority findings.
- Production deployment and recovery proof.
- A designated real team completing the agreed weekly rhythm without implementation-team facilitation.
- Measured evidence that navigation, Brain answers, Goal check-ins, meeting preparation, and notifications remain low-friction over time.
