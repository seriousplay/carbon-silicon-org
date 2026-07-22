const MAX_MODEL_OUTPUT_BYTES = 16 * 1024;
const MAX_PLANS = 3;
const MAX_PLAN_LIMIT = 10;

export type RawPlannerActorReference = Readonly<{
  actorRef: string;
}>;

export type RawPlannerScalar = string | number | boolean;
export type RawPlannerFilterValue =
  | RawPlannerScalar
  | readonly RawPlannerScalar[]
  | RawPlannerActorReference;

export type RawPlannerFilterV1 = Readonly<{
  field: string;
  operator: string;
  value: RawPlannerFilterValue;
}>;

export type RawPlannerSortV1 = Readonly<{
  field: string;
  direction: string;
}>;

export type RawPlanV1 = Readonly<{
  schemaVersion: 1;
  resource: string;
  limit: number;
  filters?: readonly RawPlannerFilterV1[];
  relation?: Readonly<{
    resource: string;
    filters?: readonly RawPlannerFilterV1[];
  }>;
  sort?: readonly RawPlannerSortV1[];
}>;

export type OrganizationBrainPlannerModelOutput = Readonly<{
  schemaVersion: 1;
  plans: readonly RawPlanV1[];
}>;

export type OrganizationBrainPlannerOutputErrorCode =
  | "OUTPUT_LIMIT_EXCEEDED"
  | "OUTPUT_SCHEMA_INVALID"
  | "PLAN_COUNT_EXCEEDED"
  | "PLAN_LIMIT_EXCEEDED";

export class OrganizationBrainPlannerOutputError extends Error {
  constructor(public readonly code: OrganizationBrainPlannerOutputErrorCode) {
    super(`Organization Brain planner output rejected: ${code}`);
    this.name = "OrganizationBrainPlannerOutputError";
  }
}

type PlainObject = Record<string, unknown>;

function fail(code: OrganizationBrainPlannerOutputErrorCode): never {
  throw new OrganizationBrainPlannerOutputError(code);
}

function utf8Bytes(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function isWellFormed(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && codePoint >= 0xd800 && codePoint <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function isExactObject(
  value: unknown,
  required: readonly string[],
  optional: readonly string[] = [],
): value is PlainObject {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    return false;
  }
  const keys = Object.keys(value);
  const allowed = new Set([...required, ...optional]);
  return (
    required.every((key) => Object.hasOwn(value, key)) &&
    keys.every((key) => allowed.has(key)) &&
    keys.length >= required.length
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string" && isWellFormed(value);
}

function isScalar(value: unknown): value is RawPlannerScalar {
  return (
    isString(value) ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  );
}

function isFilterValue(value: unknown): value is RawPlannerFilterValue {
  if (isScalar(value)) return true;
  if (Array.isArray(value)) return value.every(isScalar);
  return (
    isExactObject(value, ["actorRef"]) &&
    isString(value.actorRef)
  );
}

function validateFilter(value: unknown): asserts value is RawPlannerFilterV1 {
  if (
    !isExactObject(value, ["field", "operator", "value"]) ||
    !isString(value.field) ||
    !isString(value.operator) ||
    !isFilterValue(value.value)
  ) {
    fail("OUTPUT_SCHEMA_INVALID");
  }
}

function validateFilters(value: unknown): asserts value is RawPlannerFilterV1[] {
  if (!Array.isArray(value)) fail("OUTPUT_SCHEMA_INVALID");
  for (const filter of value) validateFilter(filter);
}

function validatePlan(value: unknown): asserts value is RawPlanV1 {
  if (
    !isExactObject(
      value,
      ["schemaVersion", "resource", "limit"],
      ["filters", "relation", "sort"],
    ) ||
    value.schemaVersion !== 1 ||
    !isString(value.resource) ||
    typeof value.limit !== "number" ||
    !Number.isInteger(value.limit)
  ) {
    fail("OUTPUT_SCHEMA_INVALID");
  }
  if (value.limit < 1 || value.limit > MAX_PLAN_LIMIT) {
    fail("PLAN_LIMIT_EXCEEDED");
  }

  if (Object.hasOwn(value, "filters")) validateFilters(value.filters);

  if (Object.hasOwn(value, "relation")) {
    if (
      !isExactObject(value.relation, ["resource"], ["filters"]) ||
      !isString(value.relation.resource)
    ) {
      fail("OUTPUT_SCHEMA_INVALID");
    }
    if (Object.hasOwn(value.relation, "filters")) {
      validateFilters(value.relation.filters);
    }
  }

  if (Object.hasOwn(value, "sort")) {
    if (!Array.isArray(value.sort)) fail("OUTPUT_SCHEMA_INVALID");
    for (const term of value.sort) {
      if (
        !isExactObject(term, ["field", "direction"]) ||
        !isString(term.field) ||
        !isString(term.direction)
      ) {
        fail("OUTPUT_SCHEMA_INVALID");
      }
    }
  }
}

function deepFreeze<T>(value: T): T {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return value;
  }
  for (const entry of Object.values(value)) deepFreeze(entry);
  return Object.freeze(value);
}

export function parseOrganizationBrainPlannerOutput(
  raw: unknown,
): OrganizationBrainPlannerModelOutput {
  if (typeof raw !== "string") fail("OUTPUT_SCHEMA_INVALID");
  if (!isWellFormed(raw)) fail("OUTPUT_SCHEMA_INVALID");
  if (utf8Bytes(raw) > MAX_MODEL_OUTPUT_BYTES) {
    fail("OUTPUT_LIMIT_EXCEEDED");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    fail("OUTPUT_SCHEMA_INVALID");
  }

  if (
    !isExactObject(parsed, ["schemaVersion", "plans"]) ||
    parsed.schemaVersion !== 1 ||
    !Array.isArray(parsed.plans)
  ) {
    fail("OUTPUT_SCHEMA_INVALID");
  }
  if (parsed.plans.length > MAX_PLANS) fail("PLAN_COUNT_EXCEEDED");
  for (const plan of parsed.plans) validatePlan(plan);

  return deepFreeze(parsed as OrganizationBrainPlannerModelOutput);
}
