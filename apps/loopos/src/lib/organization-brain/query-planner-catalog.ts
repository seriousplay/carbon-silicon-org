import {
  BRAIN_QUERY_CATALOG,
  BRAIN_QUERY_RESOURCES,
  type ActorReference,
  type BrainFieldType,
  type BrainQueryDirection,
  type BrainQueryOperator,
  type BrainQueryResource,
} from "./query-plan";
import { ORGANIZATION_BRAIN_RESOURCE_LABELS } from "./response-schema";

export type OrganizationBrainPlannerFilterableField = Readonly<{
  field: string;
  type: BrainFieldType;
  operators: readonly BrainQueryOperator[];
  actorReferences: readonly ActorReference[];
}>;

export type OrganizationBrainPlannerSortableField = Readonly<{
  field: string;
  directions: readonly BrainQueryDirection[];
}>;

export type OrganizationBrainPlannerCatalogResource = Readonly<{
  resource: BrainQueryResource;
  label: string;
  displayFields: readonly string[];
  filterableFields: readonly OrganizationBrainPlannerFilterableField[];
  sortableFields: readonly OrganizationBrainPlannerSortableField[];
  relationResources: readonly BrainQueryResource[];
}>;

export const ORGANIZATION_BRAIN_QUERY_PLANNER_LIMITS = Object.freeze({
  maxPlans: 3,
  maxPlanLimit: 10,
  maxTotalRows: 20,
  maxTotalCost: 96,
  pageForbidden: true,
  maxPlanBytes: 16 * 1024,
  maxDepth: 5,
  maxStructuralEntries: 128,
  maxFilters: 8,
  maxRelationFilters: 3,
  maxInValues: 20,
  maxRelations: 1,
  maxSortTerms: 2,
  maxFilterStringBytes: 256,
  maxIdBytes: 191,
  maxExpandedActorReferences: 50,
} as const);

const SORT_DIRECTIONS = Object.freeze(["asc", "desc"] as const);

function projectResource(
  resource: BrainQueryResource,
): OrganizationBrainPlannerCatalogResource {
  const definition = BRAIN_QUERY_CATALOG[resource];
  const filterableFields = Object.freeze(
    Object.entries(definition.fields)
      .filter(([, field]) => field.filters.length > 0)
      .map(([fieldName, field]) =>
        Object.freeze({
          field: fieldName,
          type: field.type,
          operators: Object.freeze([...field.filters]),
          actorReferences: Object.freeze([...field.actorReferences]),
        }),
      ),
  );
  const sortableFields = Object.freeze(
    Object.entries(definition.fields)
      .filter(([, field]) => field.sortable && field.type !== "id")
      .map(([fieldName]) =>
        Object.freeze({
          field: fieldName,
          directions: SORT_DIRECTIONS,
        }),
      ),
  );
  const relationResources = Object.freeze(
    Object.values(definition.relations).map((relation) => relation.resource),
  );

  return Object.freeze({
    resource,
    label: ORGANIZATION_BRAIN_RESOURCE_LABELS[resource],
    displayFields: Object.freeze([...definition.displayFields]),
    filterableFields,
    sortableFields,
    relationResources,
  });
}

export const ORGANIZATION_BRAIN_QUERY_PLANNER_CATALOG = Object.freeze({
  schemaVersion: 1 as const,
  resources: Object.freeze(BRAIN_QUERY_RESOURCES.map(projectResource)),
  limits: ORGANIZATION_BRAIN_QUERY_PLANNER_LIMITS,
});
