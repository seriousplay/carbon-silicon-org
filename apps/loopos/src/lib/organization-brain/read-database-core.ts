import type { BrainReadPolicyContext } from "./read-policy-context";

const READER_ROLE = "loopos_brain_reader";
const STATEMENT_TIMEOUT = "5000ms";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_IDENTIFIER_LENGTH = 191;

export type BrainReadRow = Readonly<Record<string, unknown>>;

export type BrainFoundationReadRequest =
  | Readonly<{ resource: "currentActor" }>
  | Readonly<{ resource: "organizationIdentity" }>
  | Readonly<{ resource: "organizationBrainProfile" }>
  | Readonly<{
      resource: "currentActorRoleAssignments";
      limit?: number;
    }>
  | Readonly<{ resource: "currentActorRoleApplications"; limit?: number }>
  | Readonly<{ resource: "currentActorRoleAssignmentHistory"; limit?: number }>
  | Readonly<{ resource: "privateConversations"; limit?: number }>
  | Readonly<{
      resource: "privateMessages";
      conversationId: string;
      limit?: number;
    }>
  | Readonly<{ resource: "circles"; limit?: number }>
  | Readonly<{ resource: "roleDefinitions"; limit?: number }>
  | Readonly<{ resource: "projects"; limit?: number }>
  | Readonly<{ resource: "actions"; limit?: number }>
  | Readonly<{ resource: "unresolvedTensions"; limit?: number }>
  | Readonly<{ resource: "meetingDrafts"; limit?: number }>
  | Readonly<{ resource: "approvedTacticalOutcomes"; limit?: number }>
  | Readonly<{ resource: "adoptedGovernanceDecisions"; limit?: number }>
  | Readonly<{ resource: "publishedGovernanceLogs"; limit?: number }>;

export type BrainReadClient = Readonly<{
  query: (
    text: string,
    values?: unknown[],
  ) => Promise<{ rows: BrainReadRow[] }>;
  release: (error?: Error) => void;
}>;

type FixedRead = Readonly<{
  text: string;
  values: unknown[];
}>;

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

function boundedIdentifier(value: unknown, label: string): string {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > MAX_IDENTIFIER_LENGTH
  ) {
    throw new Error(`invalid ${label}`);
  }
  return value;
}

function boundedLimit(value: unknown): number {
  const limit = value ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || Number(limit) < 1 || Number(limit) > MAX_LIMIT) {
    throw new Error(`invalid limit; expected an integer from 1 to ${MAX_LIMIT}`);
  }
  return Number(limit);
}

function validatePolicyContext(context: BrainReadPolicyContext): void {
  boundedIdentifier(context.organizationId, "ActorContext organizationId");
  boundedIdentifier(context.userId, "ActorContext userId");
  boundedIdentifier(context.personId, "ActorContext personId");
}

function fixedRead(request: BrainFoundationReadRequest): FixedRead {
  const resource = (request as { resource?: unknown } | undefined)?.resource;

  switch (resource) {
    case "currentActor":
      return {
        text: `SELECT
  "organizationId", "personId", "name", "entityType", "homeCircleId",
  "homeCircleName", "membershipRole"
FROM brain_read.current_actor
LIMIT 1`,
        values: [],
      };
    case "organizationIdentity":
      return {
        text: `SELECT "id", "name", "slug", "createdAt", "updatedAt"
FROM brain_read.organization_identity
LIMIT 1`,
        values: [],
      };
    case "organizationBrainProfile":
      return {
        text: `SELECT
  "id", "organizationId", "name", "avatarUrl", "tonePreferences",
  "terminologyPreferences", "enabledCapabilities", "createdAt", "updatedAt"
FROM brain_read.organization_brain_profile
LIMIT 1`,
        values: [],
      };
    case "currentActorRoleAssignments":
      return {
        text: `SELECT
  "organizationId", "personId", "roleDefinitionId", "roleDefinitionName",
  "circleId", "circleName", "ownershipType", "category"
FROM brain_read.current_actor_role_assignments
ORDER BY "roleDefinitionId"
LIMIT $1`,
        values: [
          boundedLimit(
            (request as Extract<
              BrainFoundationReadRequest,
              { resource: "currentActorRoleAssignments" }
            >).limit,
          ),
        ],
      };
    case "currentActorRoleApplications":
      return {
        text: `SELECT "id", "organizationId", "personId", "roleId", "roleName", "status", "motivation", "capabilitySummary", "commitment", "createdAt", "updatedAt"
FROM brain_read.current_actor_role_applications
ORDER BY "createdAt" DESC, "id"
LIMIT $1`,
        values: [boundedLimit((request as Extract<BrainFoundationReadRequest, { resource: "currentActorRoleApplications" }>).limit)],
      };
    case "currentActorRoleAssignmentHistory":
      return {
        text: `SELECT "id", "organizationId", "personId", "roleId", "roleName", "eventType", "effectiveAt", "decisionId", "changeLogId"
FROM brain_read.current_actor_role_assignment_history
ORDER BY "effectiveAt" DESC, "id"
LIMIT $1`,
        values: [boundedLimit((request as Extract<BrainFoundationReadRequest, { resource: "currentActorRoleAssignmentHistory" }>).limit)],
      };
    case "privateConversations":
      return {
        text: `SELECT
  "id", "organizationId", "ownerId", "title", "createdAt", "updatedAt"
FROM brain_read.private_conversations
ORDER BY "updatedAt" DESC, "id"
LIMIT $1`,
        values: [
          boundedLimit(
            (request as Extract<
              BrainFoundationReadRequest,
              { resource: "privateConversations" }
            >).limit,
          ),
        ],
      };
    case "privateMessages": {
      const privateMessageRequest = request as Extract<
        BrainFoundationReadRequest,
        { resource: "privateMessages" }
      >;
      return {
        text: `SELECT
  "id", "organizationId", "conversationId", "role", "content", "createdAt",
  "updatedAt"
FROM brain_read.private_messages
WHERE "conversationId" = $1
ORDER BY "createdAt", "id"
LIMIT $2`,
        values: [
          boundedIdentifier(
            privateMessageRequest.conversationId,
            "conversationId",
          ),
          boundedLimit(privateMessageRequest.limit),
        ],
      };
    }
    case "circles":
      return {
        text: `SELECT
  "id", "organizationId", "name", "number", "type", "purpose", "domain",
  "status", "phase", "parentId", "leadPersonId", "tacticalCadence",
  "createdAt", "updatedAt"
FROM brain_read.circles
ORDER BY "name", "id"
LIMIT $1`,
        values: [
          boundedLimit(
            (request as Extract<
              BrainFoundationReadRequest,
              { resource: "circles" }
            >).limit,
          ),
        ],
      };
    case "roleDefinitions":
      return {
        text: `SELECT
  "id", "organizationId", "name", "purpose", "domain", "accountabilities",
  "ownershipType", "category", "status", "circleId", "createdAt", "updatedAt"
FROM brain_read.role_definitions
ORDER BY "name", "id"
LIMIT $1`,
        values: [
          boundedLimit(
            (request as Extract<
              BrainFoundationReadRequest,
              { resource: "roleDefinitions" }
            >).limit,
          ),
        ],
      };
    case "projects":
      return {
        text: `SELECT
  "id", "organizationId", "name", "goal", "expectedResult", "status",
  "circleId", "bearerId", "sourceTensionId", "createdAt", "updatedAt",
  "completedAt", "completedById"
FROM brain_read.projects
ORDER BY "updatedAt" DESC, "id"
LIMIT $1`,
        values: [
          boundedLimit(
            (request as Extract<
              BrainFoundationReadRequest,
              { resource: "projects" }
            >).limit,
          ),
        ],
      };
    case "actions":
      return {
        text: `SELECT
  "id", "organizationId", "title", "description", "type", "source",
  "conflictLevel", "handlingMode", "status", "acceptanceCriteria", "deadline",
  "resolvedAt", "raiserId", "ownerId", "circleId", "roleId", "actionContext",
  "projectId", "createdAt", "updatedAt"
FROM brain_read.actions
ORDER BY "updatedAt" DESC, "id"
LIMIT $1`,
        values: [
          boundedLimit(
            (request as Extract<
              BrainFoundationReadRequest,
              { resource: "actions" }
            >).limit,
          ),
        ],
      };
    case "unresolvedTensions":
      return {
        text: `SELECT
  "id", "organizationId", "title", "description", "type", "source",
  "conflictLevel", "handlingMode", "status", "acceptanceCriteria", "deadline",
  "raiserId", "ownerId", "circleId", "roleId", "actionContext", "projectId",
  "createdAt", "updatedAt"
FROM brain_read.unresolved_tensions
ORDER BY "updatedAt" DESC, "id"
LIMIT $1`,
        values: [
          boundedLimit(
            (request as Extract<
              BrainFoundationReadRequest,
              { resource: "unresolvedTensions" }
            >).limit,
          ),
        ],
      };
    case "meetingDrafts":
      return {
        text: `SELECT
  "id", "organizationId", "title", "type", "agenda", "notes", "notesRevision",
  "durationMin", "startedAt", "endedAt", "circleId", "createdAt"
FROM brain_read.meeting_drafts
ORDER BY "startedAt" DESC, "id"
LIMIT $1`,
        values: [
          boundedLimit(
            (request as Extract<
              BrainFoundationReadRequest,
              { resource: "meetingDrafts" }
            >).limit,
          ),
        ],
      };
    case "approvedTacticalOutcomes":
      return {
        text: `SELECT
  "id", "organizationId", "tensionId", "meetingId", "proposerId", "kind",
  "title", "expectedResult", "acceptanceCriteria", "circleId",
  "responsiblePersonId", "deadline", "status", "revision", "recordedById",
  "meetingDecisionNote", "recordedAt", "outcomeProjectId", "outcomeActionId",
  "createdAt", "updatedAt"
FROM brain_read.approved_tactical_outcomes
ORDER BY "recordedAt" DESC, "id"
LIMIT $1`,
        values: [
          boundedLimit(
            (request as Extract<
              BrainFoundationReadRequest,
              { resource: "approvedTacticalOutcomes" }
            >).limit,
          ),
        ],
      };
    case "adoptedGovernanceDecisions":
      return {
        text: `SELECT
  "id", "organizationId", "sourceTensionId", "meetingId", "proposerId", "state",
  "currentRevision", "recordedById", "recordedAt", "resultNote", "outcomeRoleId",
  "decisionId", "changeLogId", "createdAt", "updatedAt", "decisionTitle",
  "decisionType", "decisionContent", "decisionRationale", "decisionStatus",
  "decisionEffectiveAt", "decisionMakerId", "decisionCreatedAt", "changeType",
  "changedObject", "beforeValue", "afterValue", "impactAssessment",
  "changeEffectiveAt", "changeInitiatorId", "changeCreatedAt"
FROM brain_read.adopted_governance_decisions
ORDER BY "recordedAt" DESC, "id"
LIMIT $1`,
        values: [
          boundedLimit(
            (request as Extract<
              BrainFoundationReadRequest,
              { resource: "adoptedGovernanceDecisions" }
            >).limit,
          ),
        ],
      };
    case "publishedGovernanceLogs":
      return {
        text: `SELECT
  "id", "organizationId", "period", "title", "content", "patterns", "risks",
  "status", "credibilityScore", "createdAt", "updatedAt", "publishedAt",
  "confirmedById"
FROM brain_read.published_governance_logs
ORDER BY "publishedAt" DESC, "id"
LIMIT $1`,
        values: [
          boundedLimit(
            (request as Extract<
              BrainFoundationReadRequest,
              { resource: "publishedGovernanceLogs" }
            >).limit,
          ),
        ],
      };
    default:
      throw new Error("unsupported Brain foundation read resource");
  }
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

export async function runBrainFoundationReadTransaction(
  client: BrainReadClient,
  context: BrainReadPolicyContext,
  request: BrainFoundationReadRequest,
): Promise<BrainReadRow[]> {
  let transactionOpen = false;
  let releaseError: Error | undefined;

  try {
    validatePolicyContext(context);
    const read = fixedRead(request);

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

    const result = await client.query(read.text, read.values);
    await client.query("COMMIT");
    transactionOpen = false;
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
