import type { ActorContext } from "../authorization/actor-context-resolver";

const MAX_PLAN_BYTES = 16 * 1024;
const MAX_DEPTH = 5;
const MAX_STRUCTURAL_ENTRIES = 128;
const MAX_FILTERS = 8;
const MAX_RELATION_FILTERS = 3;
const MAX_IN_VALUES = 20;
const MAX_ACTOR_REFERENCES = 50;
const MAX_FILTER_STRING_BYTES = 256;
const MAX_ID_BYTES = 191;
const MAX_SORT_TERMS = 2;
const MAX_ESTIMATED_COST = 64;

export const BRAIN_QUERY_RESOURCES = Object.freeze([
  "currentActor",
  "organizationIdentity",
  "organizationBrainProfile",
  "currentActorRoleAssignments",
  "currentActorRoleApplications",
  "currentActorRoleAssignmentHistory",
  "privateConversations",
  "privateMessages",
  "circles",
  "roleDefinitions",
  "projects",
  "actions",
  "unresolvedTensions",
  "meetingDrafts",
  "approvedTacticalOutcomes",
  "adoptedGovernanceDecisions",
  "publishedGovernanceLogs",
  "goalCycles",
  "goals",
  "goalTargets",
  "goalEffectiveCheckIns",
  "goalActiveWorkLinks",
] as const);

export type BrainQueryResource = (typeof BRAIN_QUERY_RESOURCES)[number];
export type BrainQueryOperator =
  | "eq"
  | "in"
  | "contains"
  | "gt"
  | "gte"
  | "lt"
  | "lte";
export type BrainQueryDirection = "asc" | "desc";
export type ActorReference =
  | "personId"
  | "homeCircleId"
  | "assignedActiveRoleDefIds"
  | "ledActiveCircleIds";
export type BrainFieldType =
  | "id"
  | "string"
  | "number"
  | "datetime"
  | "json"
  | "stringArray";

export type BrainQueryPlanErrorCode =
  | "INVALID_PLAN"
  | "PLAN_TOO_LARGE"
  | "PLAN_TOO_DEEP"
  | "PLAN_TOO_COMPLEX"
  | "UNSUPPORTED_RESOURCE"
  | "UNSUPPORTED_FIELD"
  | "UNSUPPORTED_OPERATOR"
  | "INVALID_FILTER"
  | "INVALID_RELATION"
  | "INVALID_SORT"
  | "INVALID_PAGE"
  | "INVALID_LIMIT"
  | "PRIVATE_MESSAGE_SCOPE_REQUIRED"
  | "ACTOR_REFERENCE_LIMIT"
  | "QUERY_TOO_EXPENSIVE";

export class BrainQueryPlanError extends Error {
  constructor(public readonly code: BrainQueryPlanErrorCode) {
    super(`Brain query plan rejected: ${code}`);
    this.name = "BrainQueryPlanError";
  }
}

type FieldDefinition = Readonly<{
  column: string;
  type: BrainFieldType;
  nullable: boolean;
  filters: readonly BrainQueryOperator[];
  sortable: boolean;
  actorReferences: readonly ActorReference[];
}>;

type RelationDefinition = Readonly<{
  resource: BrainQueryResource;
  on: string;
}>;

export type BrainLinkRule =
  | "actor-home"
  | "organization-home"
  | "role-definition"
  | "circle"
  | "project"
  | "action"
  | "tension"
  | "meeting"
  | "tactical-meeting"
  | "governance-decision"
  | "goal-cycle"
  | "goal"
  | "goal-work-link"
  | "none";

export type BrainResourceDefinition = Readonly<{
  view: string;
  fields: Readonly<Record<string, FieldDefinition>>;
  projection: readonly string[];
  displayFields: readonly string[];
  recordIdField: string;
  defaultSort: readonly Readonly<{
    field: string;
    direction: BrainQueryDirection;
  }>[];
  relations: Readonly<Record<string, RelationDefinition>>;
  linkRule: BrainLinkRule;
  sourceVersionField: string | null;
}>;

const EQ_IN = Object.freeze(["eq", "in"] as const);
const TEXT = Object.freeze(["eq", "in", "contains"] as const);
const RANGE = Object.freeze(["eq", "in", "gt", "gte", "lt", "lte"] as const);
const NO_FILTERS = Object.freeze([] as BrainQueryOperator[]);
const NO_ACTOR_REFERENCES = Object.freeze([] as ActorReference[]);

function field(
  column: string,
  type: BrainFieldType,
  options: Readonly<{
    nullable?: boolean;
    filters?: readonly BrainQueryOperator[];
    sortable?: boolean;
    actorReferences?: readonly ActorReference[];
  }> = {},
): FieldDefinition {
  return Object.freeze({
    column: `"${column}"`,
    type,
    nullable: options.nullable ?? false,
    filters: Object.freeze([...(options.filters ?? NO_FILTERS)]),
    sortable: options.sortable ?? false,
    actorReferences: Object.freeze([
      ...(options.actorReferences ?? NO_ACTOR_REFERENCES),
    ]),
  });
}

const tenant = (column = "organizationId") => field(column, "id");
const opaqueId = (
  column: string,
  options: Readonly<{
    nullable?: boolean;
    sortable?: boolean;
    actorReferences?: readonly ActorReference[];
  }> = {},
) =>
  field(column, "id", {
    ...options,
    filters: EQ_IN,
  });
const text = (
  column: string,
  options: Readonly<{ nullable?: boolean; sortable?: boolean }> = {},
) => field(column, "string", { ...options, filters: TEXT });
const enumText = (
  column: string,
  options: Readonly<{ nullable?: boolean; sortable?: boolean }> = {},
) => field(column, "string", { ...options, filters: EQ_IN });
const date = (column: string, nullable = false, sortable = true) =>
  field(column, "datetime", { nullable, filters: RANGE, sortable });
const number = (column: string, nullable = false, sortable = true) =>
  field(column, "number", { nullable, filters: RANGE, sortable });
const json = (column: string) => field(column, "json");
const stringArray = (column: string) => field(column, "stringArray");

function resource(
  definition: Omit<
    BrainResourceDefinition,
    "projection" | "sourceVersionField"
  > &
    Readonly<{ sourceVersionField?: string | null }>,
): BrainResourceDefinition {
  const fields = Object.freeze({ ...definition.fields });
  const relations = Object.freeze(
    Object.fromEntries(
      Object.entries(definition.relations).map(([name, relation]) => [
        name,
        Object.freeze({ ...relation }),
      ]),
    ),
  );
  return Object.freeze({
    ...definition,
    fields,
    projection: Object.freeze(Object.keys(fields)),
    displayFields: Object.freeze([...definition.displayFields]),
    defaultSort: Object.freeze(
      definition.defaultSort.map((term) => Object.freeze({ ...term })),
    ),
    relations,
    sourceVersionField: definition.sourceVersionField ?? null,
  });
}

export const BRAIN_QUERY_CATALOG: Readonly<
  Record<BrainQueryResource, BrainResourceDefinition>
> = Object.freeze({
  currentActor: resource({
    view: "brain_read.current_actor",
    fields: {
      organizationId: tenant(),
      personId: opaqueId("personId", {
        sortable: true,
        actorReferences: ["personId"],
      }),
      name: text("name", { sortable: true }),
      entityType: enumText("entityType"),
      homeCircleId: opaqueId("homeCircleId", {
        actorReferences: ["homeCircleId", "ledActiveCircleIds"],
      }),
      homeCircleName: text("homeCircleName", { sortable: true }),
      membershipRole: enumText("membershipRole"),
    },
    displayFields: ["name", "entityType", "homeCircleName", "membershipRole"],
    recordIdField: "personId",
    defaultSort: [{ field: "personId", direction: "asc" }],
    relations: {
      circles: {
        resource: "circles",
        on: '"relation"."id" = "record"."homeCircleId"',
      },
    },
    linkRule: "actor-home",
  }),
  organizationIdentity: resource({
    view: "brain_read.organization_identity",
    fields: {
      id: field("id", "id"),
      name: text("name", { sortable: true }),
      slug: text("slug", { sortable: true }),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
    },
    displayFields: ["name", "slug"],
    recordIdField: "id",
    defaultSort: [{ field: "id", direction: "asc" }],
    relations: {},
    linkRule: "organization-home",
  }),
  organizationBrainProfile: resource({
    view: "brain_read.organization_brain_profile",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      name: text("name", { sortable: true }),
      avatarUrl: field("avatarUrl", "string", { nullable: true }),
      tonePreferences: json("tonePreferences"),
      terminologyPreferences: json("terminologyPreferences"),
      enabledCapabilities: stringArray("enabledCapabilities"),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
    },
    displayFields: ["name", "enabledCapabilities"],
    recordIdField: "id",
    defaultSort: [{ field: "id", direction: "asc" }],
    relations: {},
    linkRule: "none",
  }),
  currentActorRoleAssignments: resource({
    view: "brain_read.current_actor_role_assignments",
    fields: {
      organizationId: tenant(),
      personId: opaqueId("personId", { actorReferences: ["personId"] }),
      roleDefinitionId: opaqueId("roleDefinitionId", {
        sortable: true,
        actorReferences: ["assignedActiveRoleDefIds"],
      }),
      roleDefinitionName: text("roleDefinitionName", { sortable: true }),
      circleId: opaqueId("circleId", {
        actorReferences: ["homeCircleId", "ledActiveCircleIds"],
      }),
      circleName: text("circleName", { sortable: true }),
      ownershipType: enumText("ownershipType"),
      category: enumText("category"),
    },
    displayFields: [
      "roleDefinitionName",
      "circleName",
      "ownershipType",
      "category",
    ],
    recordIdField: "roleDefinitionId",
    defaultSort: [{ field: "roleDefinitionId", direction: "asc" }],
    relations: {
      roleDefinitions: {
        resource: "roleDefinitions",
        on: '"relation"."id" = "record"."roleDefinitionId"',
      },
      circles: {
        resource: "circles",
        on: '"relation"."id" = "record"."circleId"',
      },
    },
    linkRule: "role-definition",
  }),
  currentActorRoleApplications: resource({
    view: "brain_read.current_actor_role_applications",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      personId: opaqueId("personId", { actorReferences: ["personId"] }),
      roleId: opaqueId("roleId", { sortable: true }),
      roleName: text("roleName", { sortable: true }),
      status: enumText("status", { sortable: true }),
      motivation: text("motivation"),
      capabilitySummary: text("capabilitySummary"),
      commitment: text("commitment"),
      createdAt: date("createdAt", true),
      updatedAt: date("updatedAt"),
    },
    displayFields: ["roleName", "status", "createdAt"],
    recordIdField: "id",
    defaultSort: [{ field: "createdAt", direction: "desc" }, { field: "id", direction: "asc" }],
    relations: {},
    linkRule: "role-definition",
  }),
  currentActorRoleAssignmentHistory: resource({
    view: "brain_read.current_actor_role_assignment_history",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      personId: opaqueId("personId", { actorReferences: ["personId"] }),
      roleId: opaqueId("roleId", { sortable: true }),
      roleName: text("roleName", { sortable: true }),
      eventType: enumText("eventType", { sortable: true }),
      effectiveAt: date("effectiveAt", false, true),
      decisionId: opaqueId("decisionId", { nullable: true }),
      changeLogId: opaqueId("changeLogId", { nullable: true }),
    },
    displayFields: ["roleName", "eventType", "effectiveAt"],
    recordIdField: "id",
    defaultSort: [{ field: "effectiveAt", direction: "desc" }, { field: "id", direction: "asc" }],
    relations: {},
    linkRule: "role-definition",
  }),
  privateConversations: resource({
    view: "brain_read.private_conversations",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      ownerId: field("ownerId", "id"),
      title: text("title", { nullable: true, sortable: true }),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
    },
    displayFields: ["title", "updatedAt"],
    recordIdField: "id",
    defaultSort: [
      { field: "updatedAt", direction: "desc" },
      { field: "id", direction: "asc" },
    ],
    relations: {},
    linkRule: "none",
  }),
  privateMessages: resource({
    view: "brain_read.private_messages",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      conversationId: opaqueId("conversationId"),
      role: enumText("role", { sortable: true }),
      content: text("content"),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
    },
    displayFields: ["role", "content", "createdAt"],
    recordIdField: "id",
    defaultSort: [
      { field: "createdAt", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      privateConversations: {
        resource: "privateConversations",
        on: '"relation"."id" = "record"."conversationId"',
      },
    },
    linkRule: "none",
  }),
  circles: resource({
    view: "brain_read.circles",
    fields: {
      id: opaqueId("id", {
        sortable: true,
        actorReferences: ["homeCircleId", "ledActiveCircleIds"],
      }),
      organizationId: tenant(),
      name: text("name", { sortable: true }),
      number: enumText("number", { sortable: true }),
      type: enumText("type", { sortable: true }),
      purpose: text("purpose"),
      domain: text("domain", { nullable: true }),
      status: enumText("status", { sortable: true }),
      phase: enumText("phase", { sortable: true }),
      parentId: opaqueId("parentId", {
        nullable: true,
        actorReferences: ["homeCircleId", "ledActiveCircleIds"],
      }),
      leadPersonId: opaqueId("leadPersonId", {
        nullable: true,
        actorReferences: ["personId"],
      }),
      tacticalCadence: text("tacticalCadence", { nullable: true }),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
    },
    displayFields: ["name", "type", "purpose", "status"],
    recordIdField: "id",
    defaultSort: [
      { field: "name", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
    relations: {},
    linkRule: "circle",
  }),
  roleDefinitions: resource({
    view: "brain_read.role_definitions",
    fields: {
      id: opaqueId("id", {
        sortable: true,
        actorReferences: ["assignedActiveRoleDefIds"],
      }),
      organizationId: tenant(),
      name: text("name", { sortable: true }),
      purpose: text("purpose"),
      domain: text("domain", { nullable: true }),
      accountabilities: text("accountabilities"),
      ownershipType: enumText("ownershipType", { sortable: true }),
      category: enumText("category", { sortable: true }),
      status: enumText("status", { sortable: true }),
      circleId: opaqueId("circleId", {
        actorReferences: ["homeCircleId", "ledActiveCircleIds"],
      }),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
    },
    displayFields: ["name", "purpose", "accountabilities", "category"],
    recordIdField: "id",
    defaultSort: [
      { field: "name", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      circles: {
        resource: "circles",
        on: '"relation"."id" = "record"."circleId"',
      },
    },
    linkRule: "role-definition",
  }),
  projects: resource({
    view: "brain_read.projects",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      name: text("name", { sortable: true }),
      goal: text("goal"),
      expectedResult: text("expectedResult"),
      status: enumText("status", { sortable: true }),
      circleId: opaqueId("circleId", {
        actorReferences: ["homeCircleId", "ledActiveCircleIds"],
      }),
      bearerId: opaqueId("bearerId", { actorReferences: ["personId"] }),
      sourceTensionId: opaqueId("sourceTensionId", { nullable: true }),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
      completedAt: date("completedAt", true),
      completedById: opaqueId("completedById", {
        nullable: true,
        actorReferences: ["personId"],
      }),
    },
    displayFields: ["name", "goal", "expectedResult", "status"],
    recordIdField: "id",
    defaultSort: [
      { field: "updatedAt", direction: "desc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      circles: {
        resource: "circles",
        on: '"relation"."id" = "record"."circleId"',
      },
    },
    linkRule: "project",
  }),
  actions: resource({
    view: "brain_read.actions",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      title: text("title", { sortable: true }),
      description: text("description"),
      type: enumText("type", { sortable: true }),
      source: enumText("source", { sortable: true }),
      conflictLevel: enumText("conflictLevel", { nullable: true, sortable: true }),
      handlingMode: enumText("handlingMode", { sortable: true }),
      status: enumText("status", { sortable: true }),
      acceptanceCriteria: text("acceptanceCriteria", { nullable: true }),
      deadline: date("deadline", true),
      resolvedAt: date("resolvedAt", true),
      raiserId: opaqueId("raiserId", { actorReferences: ["personId"] }),
      ownerId: opaqueId("ownerId", {
        nullable: true,
        actorReferences: ["personId"],
      }),
      circleId: opaqueId("circleId", {
        nullable: true,
        actorReferences: ["homeCircleId", "ledActiveCircleIds"],
      }),
      roleId: opaqueId("roleId", {
        nullable: true,
        actorReferences: ["assignedActiveRoleDefIds"],
      }),
      actionContext: text("actionContext", { nullable: true }),
      projectId: opaqueId("projectId", { nullable: true }),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
    },
    displayFields: ["title", "description", "status", "acceptanceCriteria"],
    recordIdField: "id",
    defaultSort: [
      { field: "updatedAt", direction: "desc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      circles: {
        resource: "circles",
        on: '"relation"."id" = "record"."circleId"',
      },
      roleDefinitions: {
        resource: "roleDefinitions",
        on: '"relation"."id" = "record"."roleId"',
      },
      projects: {
        resource: "projects",
        on: '"relation"."id" = "record"."projectId"',
      },
    },
    linkRule: "action",
  }),
  unresolvedTensions: resource({
    view: "brain_read.unresolved_tensions",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      title: text("title", { sortable: true }),
      description: text("description"),
      type: enumText("type", { sortable: true }),
      source: enumText("source", { sortable: true }),
      conflictLevel: enumText("conflictLevel", { nullable: true, sortable: true }),
      handlingMode: enumText("handlingMode", { sortable: true }),
      status: enumText("status", { sortable: true }),
      acceptanceCriteria: text("acceptanceCriteria", { nullable: true }),
      deadline: date("deadline", true),
      raiserId: opaqueId("raiserId", { actorReferences: ["personId"] }),
      ownerId: opaqueId("ownerId", {
        nullable: true,
        actorReferences: ["personId"],
      }),
      circleId: opaqueId("circleId", {
        nullable: true,
        actorReferences: ["homeCircleId", "ledActiveCircleIds"],
      }),
      roleId: opaqueId("roleId", {
        nullable: true,
        actorReferences: ["assignedActiveRoleDefIds"],
      }),
      actionContext: text("actionContext", { nullable: true }),
      projectId: opaqueId("projectId", { nullable: true }),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
    },
    displayFields: ["title", "description", "status", "deadline"],
    recordIdField: "id",
    defaultSort: [
      { field: "updatedAt", direction: "desc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      circles: {
        resource: "circles",
        on: '"relation"."id" = "record"."circleId"',
      },
      roleDefinitions: {
        resource: "roleDefinitions",
        on: '"relation"."id" = "record"."roleId"',
      },
      projects: {
        resource: "projects",
        on: '"relation"."id" = "record"."projectId"',
      },
    },
    linkRule: "tension",
  }),
  meetingDrafts: resource({
    view: "brain_read.meeting_drafts",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      title: text("title", { sortable: true }),
      type: enumText("type", { sortable: true }),
      agenda: text("agenda", { nullable: true }),
      notes: text("notes", { nullable: true }),
      notesRevision: number("notesRevision"),
      durationMin: number("durationMin"),
      startedAt: date("startedAt"),
      endedAt: date("endedAt", true),
      circleId: opaqueId("circleId", {
        nullable: true,
        actorReferences: ["homeCircleId", "ledActiveCircleIds"],
      }),
      createdAt: date("createdAt"),
    },
    displayFields: ["title", "type", "agenda", "notes"],
    recordIdField: "id",
    defaultSort: [
      { field: "startedAt", direction: "desc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      circles: {
        resource: "circles",
        on: '"relation"."id" = "record"."circleId"',
      },
    },
    linkRule: "meeting",
  }),
  approvedTacticalOutcomes: resource({
    view: "brain_read.approved_tactical_outcomes",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      tensionId: opaqueId("tensionId"),
      meetingId: opaqueId("meetingId"),
      proposerId: opaqueId("proposerId", { actorReferences: ["personId"] }),
      kind: enumText("kind", { sortable: true }),
      title: text("title", { sortable: true }),
      expectedResult: text("expectedResult", { nullable: true }),
      acceptanceCriteria: text("acceptanceCriteria", { nullable: true }),
      circleId: opaqueId("circleId", {
        actorReferences: ["homeCircleId", "ledActiveCircleIds"],
      }),
      responsiblePersonId: opaqueId("responsiblePersonId", {
        actorReferences: ["personId"],
      }),
      deadline: date("deadline", true),
      status: enumText("status", { sortable: true }),
      revision: number("revision"),
      recordedById: opaqueId("recordedById", {
        nullable: true,
        actorReferences: ["personId"],
      }),
      meetingDecisionNote: text("meetingDecisionNote", { nullable: true }),
      recordedAt: date("recordedAt", true),
      outcomeProjectId: opaqueId("outcomeProjectId", { nullable: true }),
      outcomeActionId: opaqueId("outcomeActionId", { nullable: true }),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
    },
    displayFields: [
      "title",
      "kind",
      "expectedResult",
      "acceptanceCriteria",
    ],
    recordIdField: "id",
    defaultSort: [
      { field: "recordedAt", direction: "desc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      circles: {
        resource: "circles",
        on: '"relation"."id" = "record"."circleId"',
      },
      projects: {
        resource: "projects",
        on: '"relation"."id" = "record"."outcomeProjectId"',
      },
      actions: {
        resource: "actions",
        on: '"relation"."id" = "record"."outcomeActionId"',
      },
    },
    linkRule: "tactical-meeting",
  }),
  adoptedGovernanceDecisions: resource({
    view: "brain_read.adopted_governance_decisions",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      sourceTensionId: opaqueId("sourceTensionId"),
      meetingId: opaqueId("meetingId"),
      proposerId: opaqueId("proposerId", { actorReferences: ["personId"] }),
      state: enumText("state", { sortable: true }),
      currentRevision: number("currentRevision"),
      recordedById: opaqueId("recordedById", { actorReferences: ["personId"] }),
      recordedAt: date("recordedAt"),
      resultNote: text("resultNote", { nullable: true }),
      outcomeRoleId: opaqueId("outcomeRoleId", {
        actorReferences: ["assignedActiveRoleDefIds"],
      }),
      decisionId: opaqueId("decisionId"),
      changeLogId: opaqueId("changeLogId"),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
      decisionTitle: text("decisionTitle", { sortable: true }),
      decisionType: enumText("decisionType", { sortable: true }),
      decisionContent: text("decisionContent"),
      decisionRationale: text("decisionRationale", { nullable: true }),
      decisionStatus: enumText("decisionStatus", { sortable: true }),
      decisionEffectiveAt: date("decisionEffectiveAt"),
      decisionMakerId: opaqueId("decisionMakerId", {
        nullable: true,
        actorReferences: ["personId"],
      }),
      decisionCreatedAt: date("decisionCreatedAt"),
      changeType: enumText("changeType", { sortable: true }),
      changedObject: text("changedObject"),
      beforeValue: text("beforeValue", { nullable: true }),
      afterValue: text("afterValue", { nullable: true }),
      impactAssessment: text("impactAssessment", { nullable: true }),
      changeEffectiveAt: date("changeEffectiveAt"),
      changeInitiatorId: opaqueId("changeInitiatorId", {
        actorReferences: ["personId"],
      }),
      changeCreatedAt: date("changeCreatedAt"),
    },
    displayFields: [
      "decisionTitle",
      "decisionContent",
      "decisionRationale",
      "resultNote",
    ],
    recordIdField: "id",
    defaultSort: [
      { field: "recordedAt", direction: "desc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      roleDefinitions: {
        resource: "roleDefinitions",
        on: '"relation"."id" = "record"."outcomeRoleId"',
      },
      meetingDrafts: {
        resource: "meetingDrafts",
        on: '"relation"."id" = "record"."meetingId"',
      },
    },
    linkRule: "governance-decision",
  }),
  publishedGovernanceLogs: resource({
    view: "brain_read.published_governance_logs",
    fields: {
      id: opaqueId("id", { sortable: true }),
      organizationId: tenant(),
      period: text("period", { sortable: true }),
      title: text("title", { sortable: true }),
      content: text("content"),
      patterns: text("patterns"),
      risks: text("risks", { nullable: true }),
      status: enumText("status", { sortable: true }),
      credibilityScore: number("credibilityScore", true),
      createdAt: date("createdAt"),
      updatedAt: date("updatedAt"),
      publishedAt: date("publishedAt", true),
      confirmedById: opaqueId("confirmedById", {
        nullable: true,
        actorReferences: ["personId"],
      }),
    },
    displayFields: ["period", "title", "content", "risks"],
    recordIdField: "id",
    defaultSort: [
      { field: "publishedAt", direction: "desc" },
      { field: "id", direction: "asc" },
    ],
    relations: {},
    linkRule: "none",
  }),
  goalCycles: resource({
    view: "brain_read.goal_cycles",
    fields: {
      organizationId: opaqueId("organizationId"),
      id: opaqueId("id", { sortable: true }),
      name: text("name", { sortable: true }),
      status: enumText("status"),
      startAt: date("startAt"),
      endAt: date("endAt"),
      checkInCadenceDays: number("checkInCadenceDays"),
      sourceVersionAt: date("sourceVersionAt"),
    },
    displayFields: ["name", "status", "startAt", "endAt", "checkInCadenceDays"],
    recordIdField: "id",
    defaultSort: [
      { field: "startAt", direction: "desc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      goals: {
        resource: "goals",
        on: '"relation"."cycleId" = "record"."id"',
      },
    },
    linkRule: "goal-cycle",
    sourceVersionField: "sourceVersionAt",
  }),
  goals: resource({
    view: "brain_read.goals",
    fields: {
      organizationId: opaqueId("organizationId"),
      id: opaqueId("id", { sortable: true }),
      cycleId: opaqueId("cycleId"),
      circleId: opaqueId("circleId"),
      title: text("title"),
      intendedOutcome: field("intendedOutcome", "string"),
      ownerRoleId: opaqueId("ownerRoleId"),
      parentGoalId: opaqueId("parentGoalId", { nullable: true }),
      status: enumText("status"),
      createdAt: date("createdAt"),
      adoptedMeetingId: opaqueId("adoptedMeetingId"),
      adoptedAt: date("adoptedAt", false, false),
      terminalOutcome: enumText("terminalOutcome", { nullable: true }),
      terminalMeetingId: opaqueId("terminalMeetingId", { nullable: true }),
      terminalAt: date("terminalAt", true, false),
      sourceVersionAt: date("sourceVersionAt", false, false),
    },
    displayFields: [
      "title",
      "intendedOutcome",
      "status",
      "createdAt",
      "adoptedAt",
      "terminalOutcome",
      "terminalAt",
    ],
    recordIdField: "id",
    defaultSort: [
      { field: "createdAt", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      goalCycles: {
        resource: "goalCycles",
        on: '"relation"."id" = "record"."cycleId"',
      },
      circles: {
        resource: "circles",
        on: '"relation"."id" = "record"."circleId"',
      },
      roleDefinitions: {
        resource: "roleDefinitions",
        on: '"relation"."id" = "record"."ownerRoleId"',
      },
      goals: {
        resource: "goals",
        on: '"relation"."id" = "record"."parentGoalId"',
      },
    },
    linkRule: "goal",
    sourceVersionField: "sourceVersionAt",
  }),
  goalTargets: resource({
    view: "brain_read.goal_targets",
    fields: {
      organizationId: opaqueId("organizationId"),
      id: opaqueId("id", { sortable: true }),
      cycleId: opaqueId("cycleId"),
      goalId: opaqueId("goalId"),
      position: number("position"),
      label: text("label"),
      kind: enumText("kind"),
      baselineValue: field("baselineValue", "string", { nullable: true }),
      desiredValue: field("desiredValue", "string", { nullable: true }),
      unit: field("unit", "string", { nullable: true }),
      acceptanceCriteria: field("acceptanceCriteria", "string", {
        nullable: true,
      }),
      metricId: opaqueId("metricId", { nullable: true }),
      createdAt: date("createdAt", false, false),
      sourceVersionAt: date("sourceVersionAt", false, false),
    },
    displayFields: [
      "position",
      "label",
      "kind",
      "baselineValue",
      "desiredValue",
      "unit",
      "acceptanceCriteria",
      "createdAt",
    ],
    recordIdField: "id",
    defaultSort: [
      { field: "position", direction: "asc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      goals: {
        resource: "goals",
        on: '"relation"."id" = "record"."goalId"',
      },
    },
    linkRule: "goal",
    sourceVersionField: "sourceVersionAt",
  }),
  goalEffectiveCheckIns: resource({
    view: "brain_read.goal_effective_check_ins",
    fields: {
      organizationId: opaqueId("organizationId"),
      id: opaqueId("id", { sortable: true }),
      cycleId: opaqueId("cycleId"),
      goalId: opaqueId("goalId"),
      targetId: opaqueId("targetId"),
      fact: field("fact", "string"),
      evidenceSummary: field("evidenceSummary", "string"),
      currentValue: field("currentValue", "string", { nullable: true }),
      milestoneState: enumText("milestoneState", { nullable: true }),
      acceptanceEvidence: field("acceptanceEvidence", "string", {
        nullable: true,
      }),
      assessment: enumText("assessment"),
      recorderId: opaqueId("recorderId"),
      meetingId: opaqueId("meetingId", { nullable: true }),
      recordedAt: date("recordedAt"),
      sourceVersionAt: date("sourceVersionAt", false, false),
    },
    displayFields: [
      "fact",
      "evidenceSummary",
      "currentValue",
      "milestoneState",
      "acceptanceEvidence",
      "assessment",
      "recordedAt",
    ],
    recordIdField: "id",
    defaultSort: [
      { field: "recordedAt", direction: "desc" },
      { field: "id", direction: "desc" },
    ],
    relations: {
      goals: {
        resource: "goals",
        on: '"relation"."id" = "record"."goalId"',
      },
      goalTargets: {
        resource: "goalTargets",
        on: '"relation"."id" = "record"."targetId"',
      },
    },
    linkRule: "goal",
    sourceVersionField: "sourceVersionAt",
  }),
  goalActiveWorkLinks: resource({
    view: "brain_read.goal_active_work_links",
    fields: {
      organizationId: opaqueId("organizationId"),
      id: opaqueId("id", { sortable: true }),
      cycleId: opaqueId("cycleId"),
      goalId: opaqueId("goalId"),
      kind: enumText("kind"),
      projectId: opaqueId("projectId", { nullable: true }),
      tensionId: opaqueId("tensionId", { nullable: true }),
      objectLabel: text("objectLabel"),
      objectStatus: enumText("objectStatus"),
      createdAt: date("createdAt"),
      sourceVersionAt: date("sourceVersionAt", false, false),
    },
    displayFields: ["kind", "objectLabel", "objectStatus", "createdAt"],
    recordIdField: "id",
    defaultSort: [
      { field: "createdAt", direction: "desc" },
      { field: "id", direction: "asc" },
    ],
    relations: {
      goals: {
        resource: "goals",
        on: '"relation"."id" = "record"."goalId"',
      },
      projects: {
        resource: "projects",
        on: '"relation"."id" = "record"."projectId"',
      },
      unresolvedTensions: {
        resource: "unresolvedTensions",
        on: '"relation"."id" = "record"."tensionId"',
      },
    },
    linkRule: "goal-work-link",
    sourceVersionField: "sourceVersionAt",
  }),
});

type ScalarFilterValue = string | number | boolean;

export type ParsedBrainQueryFilter = Readonly<{
  field: string;
  operator: BrainQueryOperator;
  values: readonly ScalarFilterValue[];
  actorReference: ActorReference | null;
}>;

export type ParsedBrainQueryPlan = Readonly<{
  schemaVersion: 1;
  resource: BrainQueryResource;
  filters: readonly ParsedBrainQueryFilter[];
  relation: Readonly<{
    resource: BrainQueryResource;
    filters: readonly ParsedBrainQueryFilter[];
  }> | null;
  sort: readonly Readonly<{
    field: string;
    direction: BrainQueryDirection;
  }>[];
  page: number;
  limit: number;
  estimatedCost: number;
}>;

type PlainObject = Record<string, unknown>;
type InspectionState = {
  bytes: number;
  entries: number;
  seen: WeakSet<object>;
};

function reject(code: BrainQueryPlanErrorCode): never {
  throw new BrainQueryPlanError(code);
}

function addPlanBytes(state: InspectionState, bytes: number): void {
  state.bytes += bytes;
  if (state.bytes > MAX_PLAN_BYTES) reject("PLAN_TOO_LARGE");
}

function addJsonStringBytes(state: InspectionState, value: string): void {
  if (state.bytes + byteLength(value) + 2 > MAX_PLAN_BYTES) {
    reject("PLAN_TOO_LARGE");
  }
  addPlanBytes(state, byteLength(JSON.stringify(value)));
}

function addStructuralEntries(state: InspectionState, entries: number): void {
  state.entries += entries;
  if (state.entries > MAX_STRUCTURAL_ENTRIES) reject("PLAN_TOO_COMPLEX");
}

function inspectInput(
  value: unknown,
  depth: number,
  state: InspectionState,
): void {
  if (value === null) {
    addPlanBytes(state, 4);
    return;
  }
  if (typeof value === "string") {
    addJsonStringBytes(state, value);
    return;
  }
  if (typeof value === "boolean") {
    addPlanBytes(state, value ? 4 : 5);
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) reject("INVALID_PLAN");
    addPlanBytes(state, byteLength(JSON.stringify(value)));
    return;
  }
  if (typeof value !== "object") reject("INVALID_PLAN");
  if (depth > MAX_DEPTH) reject("PLAN_TOO_DEEP");
  if (state.seen.has(value)) reject("INVALID_PLAN");
  state.seen.add(value);

  const isArray = Array.isArray(value);
  if (isArray) {
    if (
      !Number.isSafeInteger(value.length) ||
      value.length < 0 ||
      state.entries + value.length > MAX_STRUCTURAL_ENTRIES
    ) {
      reject("PLAN_TOO_COMPLEX");
    }
    addStructuralEntries(state, value.length);
    addPlanBytes(state, 2 + Math.max(0, value.length - 1));
  }
  const prototype = Object.getPrototypeOf(value);
  if (
    (isArray && prototype !== Array.prototype) ||
    (!isArray && prototype !== Object.prototype)
  ) {
    reject("INVALID_PLAN");
  }

  const keys = Reflect.ownKeys(value);
  if (keys.some((key) => typeof key === "symbol")) reject("INVALID_PLAN");

  if (isArray) {
    const array = value as unknown[];
    const expected = new Set([
      "length",
      ...Array.from({ length: array.length }, (_, index) => String(index)),
    ]);
    if (keys.some((key) => !expected.has(String(key)))) reject("INVALID_PLAN");
    for (let index = 0; index < array.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(array, index);
      if (!descriptor?.enumerable || !("value" in descriptor)) {
        reject("INVALID_PLAN");
      }
      inspectInput(descriptor.value, depth + 1, state);
    }
    return;
  }

  const stringKeys = keys as string[];
  if (
    stringKeys.some(
      (key) => key === "__proto__" || key === "prototype" || key === "constructor",
    )
  ) {
    reject("INVALID_PLAN");
  }
  addStructuralEntries(state, stringKeys.length);
  addPlanBytes(state, 2 + Math.max(0, stringKeys.length - 1));
  for (const key of stringKeys) {
    addJsonStringBytes(state, key);
    addPlanBytes(state, 1);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor?.enumerable || !("value" in descriptor)) reject("INVALID_PLAN");
    inspectInput(descriptor.value, depth + 1, state);
  }
}

function plainObject(value: unknown, code: BrainQueryPlanErrorCode): PlainObject {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    reject(code);
  }
  return value as PlainObject;
}

function exactKeys(
  object: PlainObject,
  required: readonly string[],
  optional: readonly string[],
  code: BrainQueryPlanErrorCode,
): void {
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(object);
  if (
    required.some((key) => !Object.hasOwn(object, key)) ||
    keys.some((key) => !allowed.has(key))
  ) {
    reject(code);
  }
}

function isResource(value: unknown): value is BrainQueryResource {
  return (
    typeof value === "string" &&
    Object.hasOwn(BRAIN_QUERY_CATALOG, value)
  );
}

function byteLength(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function actorReferenceValue(
  actor: ActorContext,
  reference: ActorReference,
): readonly string[] {
  const raw =
    reference === "personId"
      ? [actor.personId]
      : reference === "homeCircleId"
        ? [actor.homeCircleId]
        : reference === "assignedActiveRoleDefIds"
          ? actor.assignedActiveRoleDefIds
          : actor.ledActiveCircleIds;
  const values = [...new Set(raw)];
  if (values.length > MAX_ACTOR_REFERENCES) reject("ACTOR_REFERENCE_LIMIT");
  if (
    values.some(
      (value) =>
        typeof value !== "string" || value.length === 0 || byteLength(value) > MAX_ID_BYTES,
    )
  ) {
    reject("INVALID_FILTER");
  }
  return values;
}

function scalarValue(value: unknown, definition: FieldDefinition): ScalarFilterValue {
  if (definition.type === "id") {
    if (
      typeof value !== "string" ||
      value.length === 0 ||
      byteLength(value) > MAX_ID_BYTES
    ) {
      reject("INVALID_FILTER");
    }
    return value;
  }
  if (definition.type === "string") {
    if (typeof value !== "string" || byteLength(value) > MAX_FILTER_STRING_BYTES) {
      reject("INVALID_FILTER");
    }
    return value;
  }
  if (definition.type === "datetime") {
    if (
      typeof value !== "string" ||
      byteLength(value) > MAX_FILTER_STRING_BYTES ||
      !Number.isFinite(Date.parse(value))
    ) {
      reject("INVALID_FILTER");
    }
    return value;
  }
  if (definition.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value)) {
      reject("INVALID_FILTER");
    }
    return value;
  }
  reject("INVALID_FILTER");
}

function parseActorReference(value: unknown): ActorReference | null {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return null;
  }
  const object = value as PlainObject;
  if (Object.keys(object).length !== 1 || !Object.hasOwn(object, "actorRef")) {
    return null;
  }
  const reference = object.actorRef;
  return reference === "personId" ||
    reference === "homeCircleId" ||
    reference === "assignedActiveRoleDefIds" ||
    reference === "ledActiveCircleIds"
    ? reference
    : null;
}

function parseFilter(
  input: unknown,
  definition: BrainResourceDefinition,
  actor: ActorContext,
  inValueCounter: { count: number },
): ParsedBrainQueryFilter {
  const object = plainObject(input, "INVALID_FILTER");
  exactKeys(object, ["field", "operator", "value"], [], "INVALID_FILTER");
  if (typeof object.field !== "string") reject("INVALID_FILTER");
  const fieldDefinition = definition.fields[object.field];
  if (!fieldDefinition) reject("UNSUPPORTED_FIELD");
  const operator = object.operator;
  if (
    operator !== "eq" &&
    operator !== "in" &&
    operator !== "contains" &&
    operator !== "gt" &&
    operator !== "gte" &&
    operator !== "lt" &&
    operator !== "lte"
  ) {
    reject("UNSUPPORTED_OPERATOR");
  }
  if (!fieldDefinition.filters.includes(operator)) reject("UNSUPPORTED_OPERATOR");

  const reference = parseActorReference(object.value);
  if (reference) {
    if (!fieldDefinition.actorReferences.includes(reference)) reject("INVALID_FILTER");
    const values = actorReferenceValue(actor, reference);
    const scalarReference = reference === "personId" || reference === "homeCircleId";
    if ((operator === "eq") !== scalarReference) reject("INVALID_FILTER");
    if (operator !== "eq" && operator !== "in") reject("INVALID_FILTER");
    return Object.freeze({
      field: object.field,
      operator,
      values: Object.freeze([...values]),
      actorReference: reference,
    });
  }

  if (operator === "in") {
    if (!Array.isArray(object.value) || object.value.length === 0) {
      reject("INVALID_FILTER");
    }
    inValueCounter.count += object.value.length;
    if (inValueCounter.count > MAX_IN_VALUES) reject("INVALID_FILTER");
    const values = object.value.map((value) => scalarValue(value, fieldDefinition));
    return Object.freeze({
      field: object.field,
      operator,
      values: Object.freeze(values),
      actorReference: null,
    });
  }

  return Object.freeze({
    field: object.field,
    operator,
    values: Object.freeze([scalarValue(object.value, fieldDefinition)]),
    actorReference: null,
  });
}

function filterCost(filter: ParsedBrainQueryFilter): number {
  if (filter.operator === "contains") return 8;
  if (filter.operator === "in") return 2 + Math.ceil(filter.values.length / 2);
  if (filter.operator === "eq") return 2;
  return 3;
}

function parseFilters(
  value: unknown,
  definition: BrainResourceDefinition,
  actor: ActorContext,
  max: number,
  inValueCounter: { count: number },
): readonly ParsedBrainQueryFilter[] {
  if (!Array.isArray(value) || value.length > max) reject("INVALID_FILTER");
  return Object.freeze(
    value.map((entry) => parseFilter(entry, definition, actor, inValueCounter)),
  );
}

function parsePositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number,
  code: "INVALID_PAGE" | "INVALID_LIMIT",
): number {
  const parsed = value ?? fallback;
  if (!Number.isInteger(parsed) || Number(parsed) < 1 || Number(parsed) > maximum) {
    reject(code);
  }
  return Number(parsed);
}

export function parseBrainQueryPlan(
  input: unknown,
  actor: ActorContext,
): ParsedBrainQueryPlan {
  try {
    inspectInput(input, 1, {
      bytes: 0,
      entries: 0,
      seen: new WeakSet(),
    });
  } catch (error) {
    if (error instanceof BrainQueryPlanError) throw error;
    reject("INVALID_PLAN");
  }

  const object = plainObject(input, "INVALID_PLAN");
  exactKeys(
    object,
    ["schemaVersion", "resource"],
    ["filters", "relation", "sort", "page", "limit"],
    "INVALID_PLAN",
  );
  if (object.schemaVersion !== 1) reject("INVALID_PLAN");
  if (!isResource(object.resource)) reject("UNSUPPORTED_RESOURCE");

  const definition = BRAIN_QUERY_CATALOG[object.resource];
  const inValueCounter = { count: 0 };
  const filters = Object.hasOwn(object, "filters")
    ? parseFilters(object.filters, definition, actor, MAX_FILTERS, inValueCounter)
    : Object.freeze([] as ParsedBrainQueryFilter[]);

  let relation: ParsedBrainQueryPlan["relation"] = null;
  if (Object.hasOwn(object, "relation")) {
    const relationObject = plainObject(object.relation, "INVALID_RELATION");
    exactKeys(relationObject, ["resource"], ["filters"], "INVALID_RELATION");
    if (typeof relationObject.resource !== "string") reject("INVALID_RELATION");
    const relationDefinition = definition.relations[relationObject.resource];
    if (!relationDefinition) reject("INVALID_RELATION");
    const relationFilters = Object.hasOwn(relationObject, "filters")
      ? parseFilters(
          relationObject.filters,
          BRAIN_QUERY_CATALOG[relationDefinition.resource],
          actor,
          MAX_RELATION_FILTERS,
          inValueCounter,
        )
      : Object.freeze([] as ParsedBrainQueryFilter[]);
    relation = Object.freeze({
      resource: relationDefinition.resource,
      filters: relationFilters,
    });
  }

  if (filters.length + (relation?.filters.length ?? 0) > MAX_FILTERS) {
    reject("INVALID_FILTER");
  }
  if (object.resource === "privateMessages") {
    const conversationFilters = filters.filter(
      (filter) => filter.field === "conversationId",
    );
    if (
      conversationFilters.length !== 1 ||
      conversationFilters[0]?.operator !== "eq"
    ) {
      reject("PRIVATE_MESSAGE_SCOPE_REQUIRED");
    }
  }

  let sort: ParsedBrainQueryPlan["sort"] = Object.freeze([]);
  if (Object.hasOwn(object, "sort")) {
    if (
      !Array.isArray(object.sort) ||
      object.sort.length === 0 ||
      object.sort.length > MAX_SORT_TERMS
    ) {
      reject("INVALID_SORT");
    }
    sort = Object.freeze(
      object.sort.map((entry) => {
        const term = plainObject(entry, "INVALID_SORT");
        exactKeys(term, ["field", "direction"], [], "INVALID_SORT");
        if (
          typeof term.field !== "string" ||
          !definition.fields[term.field]?.sortable ||
          (term.direction !== "asc" && term.direction !== "desc")
        ) {
          reject("INVALID_SORT");
        }
        return Object.freeze({
          field: term.field,
          direction: term.direction,
        });
      }),
    );
  }

  const page = parsePositiveInteger(object.page, 1, 10, "INVALID_PAGE");
  const limit = parsePositiveInteger(object.limit, 20, 50, "INVALID_LIMIT");
  if (page * limit > 500) reject("INVALID_LIMIT");

  const estimatedCost =
    4 +
    filters.reduce((sum, filter) => sum + filterCost(filter), 0) +
    (relation
      ? 12 + relation.filters.reduce((sum, filter) => sum + filterCost(filter), 0)
      : 0) +
    sort.length * 2 +
    Math.ceil((page * limit) / 25);
  if (estimatedCost > MAX_ESTIMATED_COST) reject("QUERY_TOO_EXPENSIVE");

  return Object.freeze({
    schemaVersion: 1,
    resource: object.resource,
    filters,
    relation,
    sort,
    page,
    limit,
    estimatedCost,
  });
}
