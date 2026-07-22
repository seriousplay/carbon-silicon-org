# LoopOS V5: Organization Brain and Goal Tree Design

Status: approved by product owner on 2026-07-14

## 1. Desired Outcome

LoopOS V5 should let a real team run an AI-native organization through one coherent experience:

- Goals pull every circle toward an explicit outcome.
- Tensions expose the gap between current reality and the desired outcome.
- Tactical, strategic, and governance meetings convert tensions into authorized changes.
- Projects and Actions carry those changes to closure.
- The Organization Brain helps every member understand the organization, find the right surface, prepare work, and detect drift without taking authority away from people or meeting processes.

V5 is not complete when code exists. It is complete only after a real team can use the system over time with accepted browser, database, security, and longitudinal evidence.

## 2. Product Principles

1. **Daily work before module taxonomy.** Navigation follows user jobs, not database tables.
2. **Goals pull; hierarchy does not command.** Each circle proposes and confirms its own contribution to the parent goal.
3. **AI sees broadly but acts narrowly.** Authorized reads are dynamic; writes remain previewed, confirmed, and audited.
4. **Confirmed facts outrank inference.** Every answer separates facts, inference, advice, and drafts.
5. **Power comes from process.** AI, administrators, circle leads, and goal owners cannot bypass strategic, tactical, or governance authority.
6. **Core remains usable without AI or plugins.** Model and plugin outages must degrade cleanly.
7. **Visible vertical slices beat disconnected domain growth.** Each milestone ends in a browser-reachable workflow.

## 3. User Experience and Information Architecture

### 3.1 Primary navigation

The primary navigation contains only:

- **Workspace**: what the current user should handle now.
- **Goals**: the current Goal Tree, progress, evidence, and cycle review.
- **Meetings**: upcoming, active, prepared, and historical meetings.
- **Organization**: circles, roles, people, governance output, and organization records.

The following are global capabilities rather than primary destinations:

- Organization Brain: persistent top-bar entry opening a side panel, expandable to a full workspace.
- Raise tension: persistent primary action.
- Quick create: permission-aware menu for meeting and later Goal drafts.
- Search, notifications, and personal settings: top-bar tools.

Projects, Actions, personal roles, and raised tensions appear inside Workspace and relevant Goal or Circle context. Weekly review appears in Workspace and Goal-cycle context. Governance processing occurs in Meetings; the resulting structure and record appear in Organization.

### 3.2 Interaction budget

- A core pending item is reachable in one interaction from Workspace.
- A frequent task requires no more than two interactions.
- Raise tension is one interaction from every application page.
- Join the current meeting is one interaction from Workspace.
- Start a meeting is at most two interactions.
- Open the Goal Tree is one primary-navigation interaction.
- Open a Circle or Role is at most two interactions through the interactive organization map or search.

Section entry pages must be operational surfaces, not directories of links. Organization opens directly to the organization map. Meetings opens directly to active and upcoming meetings. Goals opens directly to the current tree.

## 4. Goal Domain

### 4.1 Concepts

- **Purpose**: why a circle exists; durable and structural.
- **Goal**: the primary time-bounded outcome a circle seeks in one shared organization cycle.
- **Target**: a measurable or verifiable success condition for a Goal.
- **Metric**: a continuously observed value that may provide Target evidence.
- **Project**: a result requiring multiple actions.
- **Action**: a result obtainable with one concrete action.
- **Tension**: a perceived gap between current reality and a desired state.

These concepts remain separate. A `Circle.goal` string or a repurposed `Project.goal` field is insufficient.

### 4.2 Cycle and cardinality

- The organization configures one shared cycle with explicit start and end dates.
- The root circle and every nested circle participate in the same cycle.
- A circle may have multiple drafts but at most one `ACTIVE` primary Goal per cycle.
- Historical cycles, outcomes, evidence, and review conclusions are immutable history.

### 4.3 Goal Tree

- The root-circle Goal is the root node.
- A child-circle Goal supports the active Goal of its parent circle in the same cycle.
- The relationship is explicitly confirmed; it is never inferred or assigned automatically.
- Missing child-circle Goals remain visible as alignment gaps.
- Cross-circle collaboration stays in Interfaces, Projects, and Tensions rather than turning the Goal Tree into a general graph.

The tree node shows Goal, cycle, owner Role, health, Targets, latest evidence, linked Projects and Actions, blocking Tensions, and latest check-in. Selecting a node opens details in the same surface.

### 4.4 Ownership and authority

- A Goal belongs to a Circle.
- Follow-up responsibility binds to a Role, not a Person.
- The current Role assignee reports progress and maintains evidence.
- The Role owner cannot unilaterally change, replace, or close the Goal.
- Any member may raise a tension and propose a Goal draft.
- A Circle confirms, replaces, or ends its Goal through its strategic meeting process.
- Tactical meetings inspect progress and produce Tensions, Projects, or Actions.
- Governance meetings are used only when organization structure changes.

### 4.5 Target and progress semantics

V5 supports two Target kinds:

- **Numeric**: baseline, desired value, current value, unit, and optional linked Metric.
- **Milestone**: explicit acceptance criteria and evidence of completion.

Each check-in records the fact, evidence, actor or meeting, and timestamp. Users cannot manually enter a total Goal completion percentage. The system derives a health state from Target evidence and time:

- `NOT_UPDATED`
- `ON_TRACK`
- `AT_RISK`
- `OFF_TRACK`
- `ACHIEVED`
- `NOT_ACHIEVED`

AI may draft a check-in or identify candidate evidence. A Role assignee or the relevant meeting process confirms it.

## 5. Organization Brain Product Model

### 5.1 One brain per organization

Each organization has one configurable Organization Brain profile:

- Name
- Avatar
- Tone and terminology preferences
- Enabled capabilities

Organizations cannot configure away permission checks, provenance, fact labeling, confirmation, or auditing.

### 5.2 Interaction surfaces

- A global side panel preserves the user's current page context.
- The panel can expand into a full conversation workspace for long analysis and history.
- The current Goal, Circle, Role, Tension, Project, Action, Meeting, or record may be supplied as page context.
- Answers link directly to the source objects and appropriate application pages.

### 5.3 Answer contract

Every substantive answer separates:

- Confirmed facts
- Inference from facts
- Recommendations
- Drafts awaiting confirmation

If evidence is insufficient, the Brain states that it cannot confirm the answer and identifies the missing evidence. It does not fill gaps with plausible text.

## 6. Dynamic Authorized Database Reads

### 6.1 Revised read boundary

The Organization Brain may dynamically read authorized organization data. It is not limited to a small set of precomposed context endpoints.

The model itself never receives database credentials or an unrestricted production connection. Dynamic reads use a controlled query broker:

1. Resolve the authenticated tenant, Person, Membership, assigned Roles, and contextual capabilities.
2. Set that actor context for the database transaction.
3. Query through a dedicated read-only database identity and Brain read schema or views.
4. Enforce tenant, row, relationship, and field policies at the database boundary.
5. Accept a validated structured query plan. Any future generated SQL must parse as an allowlisted `SELECT` AST.
6. Apply cost, row, depth, and statement-time limits.
7. Return provenance-bearing records rather than anonymous text.
8. Audit query purpose, scope, result count, and response linkage.

### 6.2 Data zones

- **Organization-transparent**: all current members may read confirmed organization-operating facts, including current Goals, Circle and Role definitions, Purpose, Domains, Accountabilities, confirmed meeting results, Projects, Actions, governance records, and published organization decisions. Role assignments affect relevance and action authority, not the visibility of these confirmed facts.
- **Context-restricted**: unresolved Tensions, meeting drafts, interface runtime information, personal work, and other objects limited by ownership, participation, or Role.
- **Personal-private**: private conversations and personal drafts.
- **Forbidden**: password material, sessions, tokens, credentials, secrets, internal security configuration, and raw connector credentials.

M1 uses a transparency-first read matrix:

- A current organization member reads organization-transparent facts.
- The member reads only their own private conversations and personal drafts.
- Meeting drafts and other context-restricted records require participation, ownership, or an explicit contextual capability.
- A Circle lead or administrator receives additional context-restricted access only where the policy names it.
- An administrator cannot read another user's private Brain conversation.
- Assigned Roles prioritize and explain relevant facts but grant no implicit extra read scope.
- Unknown object families and fields fail closed until explicitly classified.

### 6.3 Current-system prerequisite

The current application does not have a unified database-level authorization model. It has `ORG_ADMIN` and `ORG_MEMBER` membership roles plus scattered contextual checks. M1 must establish one actor context and one read-policy source before broad dynamic querying is enabled.

M1 supports one exact active organization context per request. It fails closed when Session, Membership, Person, and organization do not agree. Multi-organization switching is a later capability and is not inferred from the first Membership row.

## 7. Controlled Writes

The Organization Brain never writes through the query broker. It uses an allowlisted command registry:

`draft -> preview -> explicit confirmation -> fresh authorization -> domain command -> audit`

Initial command families may later include:

- Open or navigate to an object
- Draft a Tension
- Draft a Goal or Target
- Prepare a meeting agenda item
- Draft a Project or Action proposal
- Submit a memory candidate

The Brain cannot adopt governance, judge objections, assign responsibility, close work, change Goals, or modify structure outside the existing authority process. Stale previews expire and must be regenerated.

## 8. Memory and Proactivity

### 8.1 Memory layers

- **Fact memory**: index of confirmed canonical organization records.
- **Event memory**: changes, decisions, meetings, and outcomes over time.
- **Cognitive candidates**: AI-derived patterns and risks awaiting confirmation.
- **Interaction memory**: private user conversations and drafts.
- **Procedural memory**: confirmed guidance about how the organization handles recurring work.

Personal conversations are private by default. New knowledge becomes a shared memory candidate only through explicit submission.

Confirmation follows source authority rather than a centralized memory administrator:

- Goal knowledge routes to strategic process.
- Structure and Role knowledge routes to governance.
- Project and Action status routes to the bearer or tactical process.
- Meeting and decision knowledge uses the official meeting record.
- Unowned knowledge becomes a Tension.

### 8.2 Bounded proactive mode

The Brain may detect stale Goal check-ins, unsupported work, unresolved meeting output, missing child Goals, repeated Tensions, or Role/work mismatch. It may create a daily brief, meeting preparation, risk explanation, or draft. It never applies the proposed change automatically.

High-risk signals may notify immediately. Ordinary signals are aggregated into a brief. Repeated alerts are deduplicated.

## 9. Interface Plugin Boundary

The core retains a minimal cross-circle Interface relation: provider Circle, consumer Circle, commitment, acceptance criteria, owner, status, and related Tensions.

The following become one optional Interface Automation plugin:

- Interface designer
- Version publication
- Interface workflow runtime
- Runtime evidence and validation
- Tactical and governance outcome integration specific to the runtime

`Data -> Pretraining` becomes a plugin template, not a first-class platform module. When disabled, the plugin has no primary navigation entry and cannot affect core availability. When enabled, it is reachable through Organization > Extensions or relevant Circle interface context.

## 10. Control-Layer Components

- **Actor Context**: one canonical tenant, user, Person, Membership, Role, meeting, and object capability representation.
- **Read Policy Engine**: centralized application policy mirrored by database restrictions.
- **Brain Query Broker**: validates dynamic query plans and executes read-only queries.
- **Evidence Assembler**: converts records into fact packets with source IDs, timestamps, and links.
- **Reasoning Service**: produces labeled fact, inference, advice, and draft output.
- **Command Registry**: exposes previewable, authorized domain operations.
- **Conversation Service**: stores private conversations with retention controls.
- **Memory Service**: manages candidates, confirmation provenance, validity, and supersession.
- **Signal Service**: deterministic detection first, AI explanation second.
- **Goal Service**: cycles, Goals, Targets, check-ins, tree, and invariants.
- **Plugin Gateway**: advertises only enabled, authorized plugin capabilities.
- **Audit Service**: records reads, generated claims, confirmations, and command outcomes.

## 11. Failure and Degradation

- Model unavailable: Goals, Meetings, Workspace, Organization, and manual flows remain available.
- Query denied: return a clear permission boundary without revealing object existence or sensitive metadata.
- Evidence missing: return an unconfirmed result and the missing source requirement.
- Stale command preview: reject without retrying the write silently.
- Plugin unavailable: hide or mark only plugin capability unavailable.
- Query too expensive: terminate at the broker and request a narrower question.
- Database policy mismatch: fail closed and emit an auditable security event.

## 12. Verification Contract

### Static and unit evidence

- Goal-cycle, cardinality, lifecycle, and Target-health invariants.
- Actor-context and read-policy decision tables.
- Query-plan parser and forbidden-query rejection.
- Fact/inference/advice/draft response contract.
- Command preview freshness and explicit-confirmation rules.

### Database evidence

- Migration apply, rollback review, and clean reapply.
- Two-tenant isolation with database-level denial.
- Role, ownership, meeting-participant, and private-conversation access cases.
- Immutable check-ins and historical Goal cycles.
- Read-only database identity cannot mutate any table.

### Browser evidence

- Ordinary member, Role assignee, and administrator sessions.
- Desktop and mobile interaction budgets.
- Global Brain panel, full workspace, sources, and deep links.
- Root and child Goal confirmation, check-in, and Goal Tree display.
- Denied and degraded states without console or failed-request regressions.

### AI security evidence

- Prompt injection in organization content cannot alter query policy.
- Cross-tenant questions do not leak existence, counts, or values.
- The model cannot call unregistered writes.
- Unsupported factual claims are rejected or labeled as inference.

### Longitudinal evidence

- A designated real team runs the weekly rhythm without implementation-team intervention.
- The team maintains one shared Goal cycle and uses Goal evidence in tactical and strategic meetings.
- Friction, correction rate, unanswered questions, and notification noise are measured.

## 13. Milestones

### V5-M1: Trustworthy Organization Brain Entry

Deliver four-entry navigation, a configured global Brain entry, private read-only conversations, dynamic authorized database reads over existing facts, provenance, deep links, denial behavior, and browser proof. No writes, shared memory, proactive signals, or Goal domain are added in M1.

### V5-M2: Goal Tree Closed Loop

Deliver shared cycles, one primary Goal per Circle, Targets, evidence check-ins, strategic confirmation, tactical inspection, the Goal Tree, and Workspace alignment.

### V5-M3: Brain-Assisted Goal Operations

Let the Brain explain Goal alignment, draft Goal and Target changes, prepare meetings, and submit confirmed commands through the registry.

### V5-M4: Proactive Perception and Memory

Deliver bounded signals, daily briefs, private-to-shared memory candidates, source-authority confirmation, validity, and supersession.

### V5-M5: Pluginization and Industry Hardening

Gate Interface Automation as an optional plugin, move Data -> Pretraining to a template, complete security and resilience hardening, and collect real-team longitudinal evidence.

Only one milestone is active at a time. A milestone cannot close without its named database, browser, review, roadmap-audit, and cleanup evidence.

## 14. Explicit Non-Goals for M1

- No Goal schema or Goal Tree implementation.
- No autonomous organization mutation.
- No shared AI memory.
- No proactive notifications.
- No arbitrary model-generated SQL.
- No plugin extraction.
- No replacement of canonical tactical or governance workflows.
- No multi-organization switching.
- No broad refactor of unrelated existing modules.
