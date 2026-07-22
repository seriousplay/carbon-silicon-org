import { Pool } from "pg";

import type { ActorContext } from "../authorization/actor-context-resolver";
import { BrainEvidenceError, buildBrainEvidencePackets } from "./evidence";
import {
  BRAIN_QUERY_FAILURE_CODES,
  hashRejectedBrainQueryPlanShape,
  hasValidBrainQueryInvocation,
  type BrainQueryAuditErrorCode,
  type BrainQueryFailureCode,
  writeBrainQueryAudit,
} from "./query-audit";
import {
  BRAIN_QUERY_CATALOG,
  BrainQueryPlanError,
  parseBrainQueryPlan,
  type BrainQueryOperator,
  type BrainQueryPlanErrorCode,
  type BrainQueryResource,
  type BrainResourceDefinition,
  type ParsedBrainQueryFilter,
  type ParsedBrainQueryPlan,
} from "./query-plan";
import {
  toBrainReadPolicyContext,
  type BrainReadPolicyContext,
} from "./read-policy-context";

const READER_ROLE = "loopos_brain_reader";
const STATEMENT_TIMEOUT = "5000ms";
const MAX_IDENTIFIER_LENGTH = 191;

const CONNECTION_IDENTITY_SQL = `SELECT
  session_user AS "sessionUser",
  current_user AS "currentUser",
  pg_has_role(session_user, 'loopos_brain_reader', 'MEMBER') AS "isReaderMember",
  EXISTS (
    SELECT 1
    FROM pg_catalog.pg_auth_members AS membership
    WHERE membership.roleid = reader_role.oid
      AND membership.member = login_role.oid
      AND NOT membership.admin_option
  ) AS "isDirectReaderMember",
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_auth_members AS membership
    WHERE membership.member = login_role.oid
  ) AS "loginMembershipCount",
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_auth_members AS membership
    WHERE membership.roleid = reader_role.oid
  ) AS "readerMemberCount",
  (
    SELECT count(*)::integer
    FROM pg_catalog.pg_auth_members AS membership
    WHERE membership.member = reader_role.oid
  ) AS "readerParentMembershipCount",
  login_role.rolcanlogin AS "canLogin",
  login_role.rolinherit AS "inheritsPrivileges",
  login_role.rolsuper AS "isSuperuser",
  login_role.rolcreatedb AS "canCreateDatabase",
  login_role.rolcreaterole AS "canCreateRole",
  login_role.rolreplication AS "canReplicate",
  login_role.rolbypassrls AS "bypassesRowSecurity"
FROM pg_catalog.pg_roles AS login_role
JOIN pg_catalog.pg_roles AS reader_role
  ON reader_role.rolname = 'loopos_brain_reader'
WHERE login_role.rolname = session_user`;

const SET_POLICY_CONTEXT_SQL = `SELECT
  set_config('loopos.organization_id', $1, true),
  set_config('loopos.user_id', $2, true),
  set_config('loopos.person_id', $3, true),
  set_config('statement_timeout', $4, true)`;

type BrainReadRow = Readonly<Record<string, unknown>>;
type CompiledBrainQuery = Readonly<{
  text: string;
  values: readonly unknown[];
}>;
type BrokerReadClient = Readonly<{
  query: (
    text: string,
    values?: readonly unknown[],
  ) => Promise<{ rows: BrainReadRow[] }>;
  release: (error?: Error) => void;
}>;

function rejectPlan(code: BrainQueryPlanErrorCode): never {
  throw new BrainQueryPlanError(code);
}

function isResource(value: unknown): value is BrainQueryResource {
  return typeof value === "string" && Object.hasOwn(BRAIN_QUERY_CATALOG, value);
}

function containsValue(value: unknown): string {
  return `%${String(value).replace(/[\\%_]/g, "\\$&")}%`;
}

function compileFilter(
  filter: ParsedBrainQueryFilter,
  definition: BrainResourceDefinition,
  alias: "record" | "relation",
  values: unknown[],
): string {
  if (
    typeof filter.field !== "string" ||
    !Object.hasOwn(definition.fields, filter.field)
  ) {
    rejectPlan("UNSUPPORTED_FIELD");
  }
  const fieldDefinition = definition.fields[filter.field];
  if (
    !fieldDefinition ||
    !/^"[A-Za-z][A-Za-z0-9]*"$/.test(fieldDefinition.column) ||
    !fieldDefinition.filters.includes(filter.operator) ||
    !Array.isArray(filter.values)
  ) {
    rejectPlan("INVALID_FILTER");
  }
  const column = `"${alias}".${fieldDefinition.column}`;
  if (filter.operator === "in") {
    if (filter.values.length === 0) return "FALSE";
    const parameters = filter.values.map((value) => {
      values.push(value);
      return `$${values.length}`;
    });
    return `${column} IN (${parameters.join(", ")})`;
  }
  values.push(
    filter.operator === "contains"
      ? containsValue(filter.values[0] ?? "")
      : filter.values[0],
  );
  const parameter = `$${values.length}`;
  if (filter.operator === "contains") {
    return `${column} ILIKE ${parameter} ESCAPE E'\\\\'`;
  }
  const operators: Readonly<
    Record<Exclude<BrainQueryOperator, "in" | "contains">, string>
  > = {
    eq: "=",
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
  };
  const operator = operators[filter.operator];
  if (!operator) rejectPlan("UNSUPPORTED_OPERATOR");
  return `${column} ${operator} ${parameter}`;
}

function validatedView(definition: BrainResourceDefinition): string {
  if (!/^brain_read\.[a-z_]+$/.test(definition.view)) {
    rejectPlan("INVALID_PLAN");
  }
  return definition.view;
}

function validatedRelationOn(
  recordDefinition: BrainResourceDefinition,
  relationDefinition: BrainResourceDefinition,
  relation: Readonly<{ on: string }>,
): string {
  const match = /^"relation"\.("[A-Za-z][A-Za-z0-9]*") = "record"\.("[A-Za-z][A-Za-z0-9]*")$/.exec(
    relation.on,
  );
  if (
    !match ||
    !Object.values(relationDefinition.fields).some(
      (fieldDefinition) => fieldDefinition.column === match[1],
    ) ||
    !Object.values(recordDefinition.fields).some(
      (fieldDefinition) => fieldDefinition.column === match[2],
    )
  ) {
    rejectPlan("INVALID_RELATION");
  }
  return relation.on;
}

function compileBrainQueryPlan(
  plan: ParsedBrainQueryPlan,
): CompiledBrainQuery {
  if (!isResource(plan.resource)) rejectPlan("UNSUPPORTED_RESOURCE");
  const definition = BRAIN_QUERY_CATALOG[plan.resource];
  if (
    !Number.isInteger(plan.page) ||
    plan.page < 1 ||
    plan.page > 10 ||
    !Number.isInteger(plan.limit) ||
    plan.limit < 1 ||
    plan.limit > 50 ||
    plan.page * plan.limit > 500
  ) {
    rejectPlan("INVALID_PLAN");
  }
  const values: unknown[] = [];
  const projection = definition.projection
    .map((name) => {
      if (
        !/^[A-Za-z][A-Za-z0-9]*$/.test(name) ||
        !Object.hasOwn(definition.fields, name)
      ) {
        rejectPlan("UNSUPPORTED_FIELD");
      }
      const fieldDefinition = definition.fields[name];
      if (
        !fieldDefinition ||
        !/^"[A-Za-z][A-Za-z0-9]*"$/.test(fieldDefinition.column)
      ) {
        rejectPlan("UNSUPPORTED_FIELD");
      }
      return `"record".${fieldDefinition.column} AS "${name}"`;
    })
    .join(",\n  ");
  const conditions = plan.filters.map((filter) =>
    compileFilter(filter, definition, "record", values),
  );
  if (plan.relation) {
    if (!Object.hasOwn(definition.relations, plan.relation.resource)) {
      rejectPlan("INVALID_RELATION");
    }
    const relation = definition.relations[plan.relation.resource];
    if (!relation || !isResource(relation.resource)) {
      rejectPlan("INVALID_RELATION");
    }
    const relationDefinition = BRAIN_QUERY_CATALOG[relation.resource];
    const relationFilters = plan.relation.filters.map((filter) =>
      compileFilter(filter, relationDefinition, "relation", values),
    );
    conditions.push(
      `EXISTS (\n    SELECT 1\n    FROM ${validatedView(relationDefinition)} AS "relation"\n    WHERE ${[
        validatedRelationOn(definition, relationDefinition, relation),
        ...relationFilters,
      ].join("\n      AND ")}\n  )`,
    );
  }
  const requestedSort =
    plan.sort.length > 0 ? plan.sort : definition.defaultSort;
  const sort = [...requestedSort];
  if (!sort.some((term) => term.field === definition.recordIdField)) {
    sort.push({ field: definition.recordIdField, direction: "asc" });
  }
  const orderBy = sort
    .map((term) => {
      if (
        typeof term.field !== "string" ||
        !Object.hasOwn(definition.fields, term.field)
      ) {
        rejectPlan("INVALID_SORT");
      }
      const fieldDefinition = definition.fields[term.field];
      const isCatalogSort =
        fieldDefinition?.sortable === true ||
        term.field === definition.recordIdField ||
        definition.defaultSort.some(
          (catalogTerm) =>
            catalogTerm.field === term.field &&
            catalogTerm.direction === term.direction,
        );
      if (
        !fieldDefinition ||
        !isCatalogSort ||
        !/^"[A-Za-z][A-Za-z0-9]*"$/.test(fieldDefinition.column)
      ) {
        rejectPlan("INVALID_SORT");
      }
      const direction =
        term.direction === "asc"
          ? "ASC"
          : term.direction === "desc"
            ? "DESC"
            : rejectPlan("INVALID_SORT");
      return `"record".${fieldDefinition.column} ${direction} NULLS LAST`;
    })
    .join(", ");
  values.push(plan.limit + 1);
  const limitParameter = `$${values.length}`;
  values.push((plan.page - 1) * plan.limit);
  const offsetParameter = `$${values.length}`;

  return Object.freeze({
    text: `SELECT\n  ${projection}\nFROM ${validatedView(definition)} AS "record"${
      conditions.length > 0 ? `\nWHERE ${conditions.join("\n  AND ")}` : ""
    }\nORDER BY ${orderBy}\nLIMIT ${limitParameter}\nOFFSET ${offsetParameter}`,
    values: Object.freeze(values),
  });
}

let brokerPool: Pool | undefined;

function getBrokerPool(): Pool {
  if (brokerPool) return brokerPool;
  const connectionString = process.env.BRAIN_DATABASE_URL;
  if (!connectionString) throw new Error("BRAIN_DATABASE_URL is required");
  brokerPool = new Pool({
    connectionString,
    max: 2,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 5_000,
  });
  return brokerPool;
}

export type OrganizationBrainQueryErrorCode =
  | "INVALID_INVOCATION"
  | "AUDIT_FAILED"
  | BrainQueryPlanErrorCode
  | BrainQueryFailureCode;

export class OrganizationBrainQueryError extends Error {
  constructor(public readonly code: OrganizationBrainQueryErrorCode) {
    super(`Organization Brain query failed: ${code}`);
    this.name = "OrganizationBrainQueryError";
  }
}

export type OrganizationBrainQueryResult = Readonly<{
  packets: ReturnType<typeof buildBrainEvidencePackets>;
  hasMore: boolean;
}>;

async function executeRead(
  actor: ActorContext,
  query: CompiledBrainQuery,
): Promise<BrainReadRow[]> {
  const client = await getBrokerPool().connect();
  return runBrainQueryPlanTransaction(
    {
      query: async (text, values) => {
        const result = await client.query(text, values ? [...values] : undefined);
        return { rows: result.rows };
      },
      release: (error) => client.release(error),
    },
    toBrainReadPolicyContext(actor),
    query,
  );
}

function boundedIdentifier(value: unknown): void {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_IDENTIFIER_LENGTH
  ) {
    throw new Error("invalid ActorContext identifier");
  }
}

function validatePolicyContext(context: BrainReadPolicyContext): void {
  boundedIdentifier(context.organizationId);
  boundedIdentifier(context.userId);
  boundedIdentifier(context.personId);
}

function assertDedicatedReaderIdentity(rows: BrainReadRow[]): void {
  const identity = rows[0];
  const valid =
    rows.length === 1 &&
    typeof identity?.sessionUser === "string" &&
    identity.sessionUser.length > 0 &&
    identity.sessionUser !== READER_ROLE &&
    identity.currentUser === identity.sessionUser &&
    identity.isReaderMember === true &&
    identity.isDirectReaderMember === true &&
    identity.loginMembershipCount === 1 &&
    identity.readerMemberCount === 1 &&
    identity.readerParentMembershipCount === 0 &&
    identity.canLogin === true &&
    identity.inheritsPrivileges === false &&
    identity.isSuperuser === false &&
    identity.canCreateDatabase === false &&
    identity.canCreateRole === false &&
    identity.canReplicate === false &&
    identity.bypassesRowSecurity === false;

  if (!valid) {
    throw new Error("BRAIN_DATABASE_URL must use the dedicated brain reader login");
  }
}

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function attachRollbackError(primaryError: unknown, rollbackError: Error): void {
  if (
    ((typeof primaryError === "object" && primaryError !== null) ||
      typeof primaryError === "function") &&
    Object.isExtensible(primaryError)
  ) {
    try {
      Object.defineProperty(primaryError, "rollbackError", {
        configurable: true,
        value: rollbackError,
      });
    } catch {
      // Destructive release still carries the rollback failure.
    }
  }
}

async function runBrainQueryPlanTransaction(
  client: BrokerReadClient,
  context: BrainReadPolicyContext,
  query: CompiledBrainQuery,
): Promise<BrainReadRow[]> {
  let transactionOpen = false;
  let releaseError: Error | undefined;

  try {
    validatePolicyContext(context);
    await client.query("BEGIN");
    transactionOpen = true;
    await client.query("SET TRANSACTION READ ONLY");

    const identity = await client.query(CONNECTION_IDENTITY_SQL);
    assertDedicatedReaderIdentity(identity.rows);

    await client.query("SET LOCAL ROLE loopos_brain_reader");
    await client.query(SET_POLICY_CONTEXT_SQL, [
      context.organizationId,
      context.userId,
      context.personId,
      STATEMENT_TIMEOUT,
    ]);

    const result = await client.query(query.text, query.values);
    try {
      await client.query("ROLLBACK");
      transactionOpen = false;
    } catch (rollbackFailure) {
      releaseError = asError(rollbackFailure);
      transactionOpen = false;
      throw releaseError;
    }
    return result.rows;
  } catch (error) {
    if (transactionOpen) {
      try {
        await client.query("ROLLBACK");
      } catch (rollbackFailure) {
        releaseError = asError(rollbackFailure);
        attachRollbackError(error, releaseError);
      }
    }
    throw error;
  } finally {
    client.release(releaseError);
  }
}

function failureCode(error: unknown): BrainQueryFailureCode {
  if (error instanceof BrainEvidenceError) return error.code;
  const codes = new Set<string>();
  const pending: unknown[] = [error];
  const inspected = new Set<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (typeof current !== "object" || current === null || inspected.has(current)) {
      continue;
    }
    inspected.add(current);
    if ("code" in current && typeof current.code === "string") {
      codes.add(current.code);
    }
    if (current instanceof AggregateError) pending.push(...current.errors);
    if ("cause" in current) pending.push(current.cause);
  }
  if (codes.has("57014")) return "QUERY_TIMEOUT";
  if (
    error instanceof Error &&
    error.message ===
      "BRAIN_DATABASE_URL must use the dedicated brain reader login"
  ) {
    return "DATABASE_POLICY_MISMATCH";
  }
  if (codes.has("42501") || codes.has("25006")) {
    return "DATABASE_POLICY_MISMATCH";
  }
  if (
    error instanceof Error &&
    error.message === "BRAIN_DATABASE_URL is required"
  ) {
    return "DATABASE_UNAVAILABLE";
  }
  if (
    error instanceof Error &&
    (error.message === "Connection terminated unexpectedly" ||
      error.message === "Connection terminated due to connection timeout" ||
      error.message === "timeout exceeded when trying to connect")
  ) {
    return "DATABASE_UNAVAILABLE";
  }
  if (
    [...codes].some(
      (code) =>
        code.startsWith("08") ||
        code.startsWith("53") ||
        code === "3D000" ||
        code === "28000" ||
        code === "28P01" ||
        code === "57P01" ||
        code === "57P02" ||
        code === "57P03" ||
        code === "ECONNREFUSED" ||
        code === "ECONNRESET" ||
        code === "ENOTFOUND" ||
        code === "EAI_AGAIN" ||
        code === "ETIMEDOUT" ||
        code === "EPIPE",
    )
  ) {
    return "DATABASE_UNAVAILABLE";
  }
  return "DATABASE_EXECUTION_FAILED";
}

async function auditOrFail(
  actor: ActorContext,
  conversationId: string,
  messageId: string,
  input: Readonly<{
    status: "SUCCEEDED" | "REJECTED" | "FAILED";
    errorCode: BrainQueryAuditErrorCode | null;
    resultCount: number;
    plan: ParsedBrainQueryPlan | null;
    latencyMs: number;
    hasMore: boolean;
    rejectedPlanShapeHash?: string;
  }>,
): Promise<void> {
  try {
    await writeBrainQueryAudit(actor, conversationId, messageId, input);
  } catch {
    throw new OrganizationBrainQueryError("AUDIT_FAILED");
  }
}

export async function executeOrganizationBrainQuery(
  actor: ActorContext,
  conversationId: string,
  messageId: string,
  planInput: unknown,
): Promise<OrganizationBrainQueryResult> {
  const startedAt = Date.now();
  let invocationIsValid = false;
  try {
    invocationIsValid = await hasValidBrainQueryInvocation(
      actor,
      conversationId,
      messageId,
    );
  } catch {
    throw new OrganizationBrainQueryError("INVALID_INVOCATION");
  }
  if (!invocationIsValid) {
    throw new OrganizationBrainQueryError("INVALID_INVOCATION");
  }

  let plan: ParsedBrainQueryPlan;
  let query: CompiledBrainQuery;
  try {
    plan = parseBrainQueryPlan(planInput, actor);
    query = compileBrainQueryPlan(plan);
  } catch (error) {
    const code =
      error instanceof BrainQueryPlanError ? error.code : "INVALID_PLAN";
    await auditOrFail(actor, conversationId, messageId, {
      status: "REJECTED",
      errorCode: code,
      resultCount: 0,
      plan: null,
      latencyMs: Date.now() - startedAt,
      hasMore: false,
      rejectedPlanShapeHash: hashRejectedBrainQueryPlanShape(planInput),
    });
    throw new OrganizationBrainQueryError(code);
  }

  try {
    const rows = await executeRead(actor, query);
    if (rows.length > plan.limit + 1) {
      throw new BrainEvidenceError("ROW_SHAPE_MISMATCH");
    }
    const hasMore = rows.length > plan.limit;
    const packets = buildBrainEvidencePackets(
      actor.organizationId,
      plan.resource,
      rows.slice(0, plan.limit),
    );
    await auditOrFail(actor, conversationId, messageId, {
      status: "SUCCEEDED",
      errorCode: null,
      resultCount: packets.length,
      plan,
      latencyMs: Date.now() - startedAt,
      hasMore,
    });
    return Object.freeze({ packets, hasMore });
  } catch (error) {
    if (
      error instanceof OrganizationBrainQueryError &&
      error.code === "AUDIT_FAILED"
    ) {
      throw error;
    }
    const code = failureCode(error);
    if (!(BRAIN_QUERY_FAILURE_CODES as readonly string[]).includes(code)) {
      throw new OrganizationBrainQueryError("DATABASE_EXECUTION_FAILED");
    }
    await auditOrFail(actor, conversationId, messageId, {
      status: "FAILED",
      errorCode: code,
      resultCount: 0,
      plan,
      latencyMs: Date.now() - startedAt,
      hasMore: false,
    });
    throw new OrganizationBrainQueryError(code);
  }
}
