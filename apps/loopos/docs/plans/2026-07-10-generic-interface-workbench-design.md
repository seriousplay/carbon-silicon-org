# Generic Interface Workbench Design

Date: 2026-07-10
Status: approved
Milestone: G3

## Outcome

LoopOS will provide a versioned, visually configurable interface workbench for cross-loop coordination. Organization administrators configure and publish workflows; ordinary members run published workflows through a lightweight task-oriented experience. The engine routes evidence and tensions into the existing tactical and governance system without making organizational decisions itself.

## Product Boundaries

- Organization administrators can edit, validate, compare, and publish workbench definitions.
- Ordinary members can only start and operate published definitions for interfaces in which they have permission.
- Every run is pinned to the immutable version that was published when the run started. Later releases affect only new runs.
- The first release supports only system-provided safe nodes. It cannot execute arbitrary code or custom scripts.
- AI can prepare drafts, extract evidence, identify gaps, recommend next steps, and explain configuration differences. AI cannot publish workflows or make tactical or governance decisions.

## Architecture

Use a hybrid persistence model:

- Relational records store workbench identity, organization and interface ownership, draft and publication metadata, permissions, and version lineage.
- Each published version stores an immutable JSON workflow snapshot and its compiled representation.
- Publication runs static validation before creating a version. Invalid drafts cannot be published.
- Runtime instances reference one published version and record the current node, structured evidence, state transitions, actors, and generated domain artifacts.

This preserves queryable ownership and audit metadata without requiring a fully normalized BPMN-style graph schema.

## Domain Model

### InterfaceWorkbench

One configurable workbench bound to a `CircleInterface`. It owns the current editable draft and publication metadata.

### InterfaceWorkbenchVersion

An immutable release containing the source node graph, compiled snapshot, version number, publisher, timestamps, and validation result.

### InterfaceWorkflowRun

A generic runtime instance pinned to one workbench version. It records current state, structured inputs and evidence, transition history, waiting responsibility, and links to created organizational artifacts.

The existing `InterfaceValidationRun` is a migration source, not a permanent parallel engine. Existing Data -> Pretraining history is backfilled or exposed through a compatibility adapter until the generic runtime is authoritative.

Tensions, projects, actions, proposals, meetings, circles, roles, and interfaces remain existing domain objects. Workflow nodes invoke those domain operations and do not duplicate their decision logic.

## Safe Node Catalog

The first release supports:

- structured evidence input;
- attachment input;
- AI extraction and summarization;
- human confirmation;
- deterministic condition branch;
- wait for role response;
- raise tension;
- route to tactical meeting;
- create project;
- create action;
- mark governance candidate;
- route to governance meeting;
- complete or terminate.

Nodes use idempotent commands. Failed nodes can retry, pause, or be taken over by an authorized human. Artifacts already created in the organization are never silently rolled back; remediation creates a new auditable event.

## Governance Invariants

- A project is a result requiring continuous action and is owned by its project owner.
- An action is one concrete step that can produce a result.
- The tension raiser proposes the tactical adjustment or governance proposal.
- A circle lead does not centrally decide all tactical or governance tensions.
- An assignee who objects raises a new tension and proposal through the same distributed process.
- Only changes to organization structure, roles, accountabilities, policies, or circle/interface relationships enter governance meetings. Other operational tensions enter tactical meetings.
- A valid objection must show that adopting the proposal would cause real harm or material regression. AI and the facilitator can test evidence, reversibility, and safe-to-try conditions, but cannot decide the objection for the organization.

## Experience

The administrator designer is a full-width workspace with a safe-node palette, flow canvas, node inspector, validation results, version comparison, and publish controls. AI can generate or modify a draft from natural language, but every change is shown as a structured diff and requires administrator confirmation.

The member runtime hides the graph by default. It presents context, required evidence, the next action, and the person or role currently responsible. Meeting surfaces continue to show the real tension and provenance; the workflow engine only supplies routing and traceability.

## Delivery Slices

1. `G3-I2A`: definition and version models, node protocol, and compiler/validator.
2. `G3-I2B`: administrator visual designer, AI-assisted draft, comparison, and publication.
3. `G3-I2C`: generic runtime and lightweight member experience.
4. `G3-I2D`: migrate Data -> Pretraining and configure Pretraining -> Evaluation.
5. `G3-I2E`: two-interface browser rehearsal, independent audit, and `/review`.

Exactly one G3 slice is current at a time.

## Required Evidence

- Migration and rollback evidence for new persistence models.
- Compiler tests covering invalid graphs, missing permissions, unsupported nodes, unreachable nodes, and unsafe transitions.
- Permission tests proving only organization administrators can edit or publish.
- Version tests proving active runs remain pinned after a new publication.
- Idempotency and retry tests for side-effecting nodes.
- Regression evidence that the existing Data -> Pretraining workbench and historical runs remain usable during migration.
- Browser evidence for complete Data -> Pretraining and Pretraining -> Evaluation flows from evidence through tension, tactical disposition or governance candidate, and closure.
- An independent audit against `GOALS.md` and an independent `/review` before G3 closes.

## Explicit Non-Goals For G3-I2A

- No visual canvas.
- No AI draft generation.
- No generic runtime execution.
- No migration of existing validation runs.
- No arbitrary scripts, webhooks, plugins, or user-defined code.
