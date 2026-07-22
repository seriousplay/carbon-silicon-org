import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { Client, Pool } from "pg";

import {
  runBrainFoundationReadTransaction,
  type BrainFoundationReadRequest,
  type BrainReadRow,
} from "./read-database-core";

const adminDatabaseUrl = process.env.BRAIN_TEST_ADMIN_DATABASE_URL;
const migration = readFileSync(
  new URL(
    "../../../prisma/migrations/20260714081530_v5_m1_b2_brain_read_boundary/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const rollback = readFileSync(
  new URL(
    "../../../prisma/migrations/20260714081530_v5_m1_b2_brain_read_boundary/rollback.sql",
    import.meta.url,
  ),
  "utf8",
);
const b2bMigration = readFileSync(
  new URL(
    "../../../prisma/migrations/20260714110000_v5_m1_b2b_operational_fact_views/migration.sql",
    import.meta.url,
  ),
  "utf8",
);
const b2bRollback = readFileSync(
  new URL(
    "../../../prisma/migrations/20260714110000_v5_m1_b2b_operational_fact_views/rollback.sql",
    import.meta.url,
  ),
  "utf8",
);
const migrationsRoot = fileURLToPath(
  new URL("../../../prisma/migrations/", import.meta.url),
);
const preB2aMigrations = readdirSync(migrationsRoot, { withFileTypes: true })
  .filter(
    (entry) =>
      entry.isDirectory() &&
      entry.name < "20260714081530_v5_m1_b2_brain_read_boundary",
  )
  .map((entry) => ({
    name: entry.name,
    sql: readFileSync(`${migrationsRoot}/${entry.name}/migration.sql`, "utf8"),
  }))
  .sort((left, right) => left.name.localeCompare(right.name));
const provisionScript = fileURLToPath(
  new URL(
    "../../../scripts/organization-brain/provision-reader-role.sql",
    import.meta.url,
  ),
);
const hardeningScript = fileURLToPath(
  new URL(
    "../../../scripts/organization-brain/harden-reader-database.sql",
    import.meta.url,
  ),
);
const deprovisionScript = fileURLToPath(
  new URL(
    "../../../scripts/organization-brain/deprovision-reader-role.sql",
    import.meta.url,
  ),
);

const B2A_VIEWS = [
  "current_actor",
  "current_actor_role_assignments",
  "organization_brain_profile",
  "organization_identity",
  "private_conversations",
  "private_messages",
] as const;
const ALL_BRAIN_READ_VIEWS = [
  "actions",
  "adopted_governance_decisions",
  "approved_tactical_outcomes",
  "circles",
  ...B2A_VIEWS,
  "meeting_drafts",
  "projects",
  "published_governance_logs",
  "role_definitions",
  "unresolved_tensions",
].sort();

const FIXTURE_SQL = `BEGIN;
INSERT INTO public.users ("id", "email", "updatedAt") VALUES
  ('user-a', 'user-a@example.invalid', CURRENT_TIMESTAMP),
  ('user-a2', 'user-a2@example.invalid', CURRENT_TIMESTAMP),
  ('user-raiser', 'user-raiser@example.invalid', CURRENT_TIMESTAMP),
  ('user-direct-lead', 'user-direct-lead@example.invalid', CURRENT_TIMESTAMP),
  ('user-related-lead', 'user-related-lead@example.invalid', CURRENT_TIMESTAMP),
  ('user-role', 'user-role@example.invalid', CURRENT_TIMESTAMP),
  ('user-participant', 'user-participant@example.invalid', CURRENT_TIMESTAMP),
  ('user-bystander', 'user-bystander@example.invalid', CURRENT_TIMESTAMP),
  ('user-b', 'user-b@example.invalid', CURRENT_TIMESTAMP);
INSERT INTO public.organizations ("id", "name", "slug", "updatedAt") VALUES
  ('org-a', 'Organization A', 'organization-a', CURRENT_TIMESTAMP),
  ('org-b', 'Organization B', 'organization-b', CURRENT_TIMESTAMP);
INSERT INTO public.memberships ("id", "userId", "organizationId", "role") VALUES
  ('membership-a', 'user-a', 'org-a', 'ORG_MEMBER'),
  ('membership-a2', 'user-a2', 'org-a', 'ORG_ADMIN'),
  ('membership-raiser', 'user-raiser', 'org-a', 'ORG_MEMBER'),
  ('membership-direct-lead', 'user-direct-lead', 'org-a', 'ORG_MEMBER'),
  ('membership-related-lead', 'user-related-lead', 'org-a', 'ORG_MEMBER'),
  ('membership-role', 'user-role', 'org-a', 'ORG_MEMBER'),
  ('membership-participant', 'user-participant', 'org-a', 'ORG_MEMBER'),
  ('membership-bystander', 'user-bystander', 'org-a', 'ORG_MEMBER'),
  ('membership-b', 'user-b', 'org-b', 'ORG_MEMBER');
INSERT INTO public.circles (
  "id", "organizationId", "name", "number", "type", "purpose", "status", "updatedAt"
) VALUES
  ('circle-a', 'org-a', 'Circle A', 'ONE', 'PRODUCTION', 'Purpose A', 'NORMAL', CURRENT_TIMESTAMP),
  ('circle-direct', 'org-a', 'Direct Lead Circle', 'TWO', 'PRODUCTION', 'Direct lead scope', 'NORMAL', CURRENT_TIMESTAMP),
  ('circle-related', 'org-a', 'Related Lead Circle', 'THREE', 'PRODUCTION', 'Related lead scope', 'NORMAL', CURRENT_TIMESTAMP),
  ('circle-archived', 'org-a', 'Archived Circle', 'FOUR', 'INFRA', 'Archived scope', 'ARCHIVED', CURRENT_TIMESTAMP),
  ('circle-b', 'org-b', 'Circle B', 'ONE', 'PRODUCTION', 'Purpose B', 'NORMAL', CURRENT_TIMESTAMP);
INSERT INTO public.people (
  "id", "organizationId", "userId", "name", "homeCircleId", "updatedAt"
) VALUES
  ('person-a', 'org-a', 'user-a', 'Actor A', 'circle-a', CURRENT_TIMESTAMP),
  ('person-a2', 'org-a', 'user-a2', 'Actor A2', 'circle-a', CURRENT_TIMESTAMP),
  ('person-raiser', 'org-a', 'user-raiser', 'Raiser', 'circle-a', CURRENT_TIMESTAMP),
  ('person-direct-lead', 'org-a', 'user-direct-lead', 'Direct Lead', 'circle-a', CURRENT_TIMESTAMP),
  ('person-related-lead', 'org-a', 'user-related-lead', 'Related Lead', 'circle-a', CURRENT_TIMESTAMP),
  ('person-role', 'org-a', 'user-role', 'Role Assignee', 'circle-a', CURRENT_TIMESTAMP),
  ('person-participant', 'org-a', 'user-participant', 'Meeting Participant', 'circle-a', CURRENT_TIMESTAMP),
  ('person-bystander', 'org-a', 'user-bystander', 'Bystander', 'circle-a', CURRENT_TIMESTAMP),
  ('person-b', 'org-b', 'user-b', 'Actor B', 'circle-b', CURRENT_TIMESTAMP);
UPDATE public.circles
SET "leadPersonId" = CASE "id"
  WHEN 'circle-direct' THEN 'person-direct-lead'
  WHEN 'circle-related' THEN 'person-related-lead'
  WHEN 'circle-archived' THEN 'person-related-lead'
END
WHERE "id" IN ('circle-direct', 'circle-related', 'circle-archived');
INSERT INTO public.role_defs (
  "id", "organizationId", "name", "purpose", "accountabilities", "circleId",
  "ownershipType", "category", "status", "updatedAt"
) VALUES
  ('role-a', 'org-a', 'Role A', 'Purpose A', 'Accountabilities A', 'circle-a', 'HOME', 'OPERATIONS', 'ACTIVE', CURRENT_TIMESTAMP),
  ('role-role-only', 'org-a', 'Role Only', 'Role access must not authorize Tensions', 'Accountabilities', 'circle-a', 'HOME', 'OPERATIONS', 'ACTIVE', CURRENT_TIMESTAMP),
  ('role-gov-a', 'org-a', 'Adopted Role', 'Governance outcome', 'Governance accountabilities', 'circle-a', 'HOME', 'OPERATIONS', 'ACTIVE', CURRENT_TIMESTAMP),
  ('role-a-paused', 'org-a', 'Paused Role', 'Paused', 'Paused', 'circle-a', 'HOME', 'OPERATIONS', 'PAUSED', CURRENT_TIMESTAMP),
  ('role-b', 'org-b', 'Role B', 'Purpose B', 'Accountabilities B', 'circle-b', 'HOME', 'OPERATIONS', 'ACTIVE', CURRENT_TIMESTAMP);
INSERT INTO public."_PersonRoles" ("A", "B") VALUES
  ('person-a', 'role-a'),
  ('person-role', 'role-role-only'),
  ('person-a', 'role-a-paused'),
  ('person-b', 'role-b');
INSERT INTO public.organization_brain_profiles (
  "id", "organizationId", "name", "updatedAt"
) VALUES
  ('profile-a', 'org-a', 'Brain A', CURRENT_TIMESTAMP),
  ('profile-b', 'org-b', 'Brain B', CURRENT_TIMESTAMP);
INSERT INTO public.brain_conversations (
  "id", "organizationId", "ownerId", "title", "updatedAt"
) VALUES
  ('conversation-a', 'org-a', 'person-a', 'Private A', CURRENT_TIMESTAMP),
  ('conversation-a2', 'org-a', 'person-a2', 'Private A2', CURRENT_TIMESTAMP),
  ('conversation-b', 'org-b', 'person-b', 'Private B', CURRENT_TIMESTAMP);
INSERT INTO public.brain_messages (
  "id", "organizationId", "conversationId", "role", "content", "updatedAt"
) VALUES
  ('message-a', 'org-a', 'conversation-a', 'USER', 'A secret', CURRENT_TIMESTAMP),
  ('message-a2', 'org-a', 'conversation-a2', 'USER', 'A2 secret', CURRENT_TIMESTAMP),
  ('message-b', 'org-b', 'conversation-b', 'USER', 'B secret', CURRENT_TIMESTAMP);

INSERT INTO public.meetings (
  "id", "organizationId", "title", "type", "agenda", "notes", "notesRevision",
  "aiGuardReport", "durationMin", "startedAt", "endedAt", "endedById", "circleId"
) VALUES
  ('meeting-a-ended', 'org-a', 'Ended Participant Draft', 'TACTICAL', 'Agenda A', 'Participant notes A', 1, 'hidden guard A', 30, '2026-07-13T01:00:00Z', '2026-07-13T01:30:00Z', 'person-a', 'circle-a'),
  ('meeting-a-participant-only', 'org-a', 'Participant Only Draft', 'TACTICAL', 'Agenda participant', 'Participant-only notes', 2, 'hidden guard participant', 25, '2026-07-13T02:00:00Z', NULL, NULL, 'circle-a'),
  ('meeting-a-governance', 'org-a', 'Governance Source Meeting', 'GOVERNANCE', 'Governance agenda', 'Governance draft notes', 1, 'hidden governance guard', 60, '2026-07-13T03:00:00Z', '2026-07-13T04:00:00Z', 'person-a', NULL),
  ('meeting-b', 'org-b', 'Meeting B', 'TACTICAL', 'Agenda B', 'Notes B', 1, 'hidden guard B', 30, '2026-07-13T01:00:00Z', '2026-07-13T01:30:00Z', 'person-b', 'circle-b');
INSERT INTO public."_MeetingToPerson" ("A", "B") VALUES
  ('meeting-a-ended', 'person-a'),
  ('meeting-a-participant-only', 'person-participant'),
  ('meeting-b', 'person-b');

INSERT INTO public.tensions (
  "id", "organizationId", "title", "description", "type", "source", "status",
  "handlingMode", "raiserId", "ownerId", "circleId", "roleId", "resolvedAt", "updatedAt"
) VALUES
  ('tension-owner', 'org-a', 'Owner visible', 'Owner-visible tension', 'PROBLEMATIC', 'FORM', 'OPEN', 'UNROUTED', 'person-bystander', 'person-a', NULL, NULL, NULL, CURRENT_TIMESTAMP),
  ('tension-raiser', 'org-a', 'Raiser visible', 'Raiser-visible tension', 'PROBLEMATIC', 'FORM', 'OPEN', 'UNROUTED', 'person-raiser', 'person-bystander', NULL, NULL, NULL, CURRENT_TIMESTAMP),
  ('tension-direct', 'org-a', 'Direct lead visible', 'Direct-circle lead tension', 'PROBLEMATIC', 'FORM', 'OPEN', 'UNROUTED', 'person-bystander', 'person-bystander', 'circle-direct', NULL, NULL, CURRENT_TIMESTAMP),
  ('tension-related', 'org-a', 'Related lead visible', 'Related-circle lead tension', 'PROBLEMATIC', 'FORM', 'OPEN', 'UNROUTED', 'person-bystander', 'person-bystander', NULL, NULL, NULL, CURRENT_TIMESTAMP),
  ('tension-admin', 'org-a', 'Admin visible', 'Admin-only contextual tension', 'PROBLEMATIC', 'FORM', 'OPEN', 'UNROUTED', 'person-bystander', 'person-bystander', NULL, NULL, NULL, CURRENT_TIMESTAMP),
  ('tension-role', 'org-a', 'Role denied', 'Role assignment must not authorize', 'PROBLEMATIC', 'FORM', 'OPEN', 'UNROUTED', 'person-bystander', 'person-bystander', NULL, 'role-role-only', NULL, CURRENT_TIMESTAMP),
  ('tension-participant', 'org-a', 'Participant denied', 'Meeting participation must not authorize', 'PROBLEMATIC', 'FORM', 'OPEN', 'UNROUTED', 'person-bystander', 'person-bystander', NULL, NULL, NULL, CURRENT_TIMESTAMP),
  ('tension-archived', 'org-a', 'Archived lead denied', 'Archived-circle lead must not authorize', 'PROBLEMATIC', 'FORM', 'OPEN', 'UNROUTED', 'person-bystander', 'person-bystander', NULL, NULL, NULL, CURRENT_TIMESTAMP),
  ('tension-resolved', 'org-a', 'Resolved hidden', 'Resolved owner tension', 'PROBLEMATIC', 'FORM', 'RESOLVED', 'UNROUTED', 'person-bystander', 'person-a', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tension-project-source', 'org-a', 'Project source', 'Approved project source', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'RESOLVED', 'TACTICAL', 'person-a', 'person-a', 'circle-a', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tension-action-source', 'org-a', 'Action source', 'Approved action source', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'RESOLVED', 'TACTICAL', 'person-a', 'person-a', 'circle-a', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('action-approved', 'org-a', 'Approved action', 'Confirmed action outcome', 'PROBLEMATIC', 'TACTICAL_MEETING', 'OPEN', 'TACTICAL', 'person-a', 'person-a', 'circle-a', 'role-a', NULL, CURRENT_TIMESTAMP),
  ('action-legacy', 'org-a', 'Legacy action', 'Unconfirmed legacy action row', 'PROBLEMATIC', 'FORM', 'OPEN', 'TACTICAL', 'person-a', 'person-a', 'circle-a', 'role-a', NULL, CURRENT_TIMESTAMP),
  ('tension-unapproved', 'org-a', 'Unapproved source', 'Unapproved tactical proposal source', 'PROBLEMATIC', 'TACTICAL_MEETING', 'RESOLVED', 'TACTICAL', 'person-a', 'person-a', 'circle-a', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tension-governance-adopted', 'org-a', 'Governance adopted source', 'Adopted governance source', 'CLARIFYING', 'GOVERNANCE_MEETING', 'RESOLVED', 'GOVERNANCE', 'person-a', 'person-a', 'circle-a', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('tension-governance-ready', 'org-a', 'Governance ready source', 'Non-adopted governance source', 'CLARIFYING', 'GOVERNANCE_MEETING', 'OPEN', 'GOVERNANCE', 'person-a', 'person-a', 'circle-a', NULL, NULL, CURRENT_TIMESTAMP),
  ('tension-b-owner', 'org-b', 'B owner tension', 'Tenant B tension', 'PROBLEMATIC', 'FORM', 'OPEN', 'UNROUTED', 'person-b', 'person-b', 'circle-b', NULL, NULL, CURRENT_TIMESTAMP),
  ('tension-b-project-source', 'org-b', 'B project source', 'Tenant B project source', 'CONSTRUCTIVE', 'TACTICAL_MEETING', 'RESOLVED', 'TACTICAL', 'person-b', 'person-b', 'circle-b', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
INSERT INTO public."_TensionCircle" ("A", "B") VALUES
  ('circle-related', 'tension-related'),
  ('circle-archived', 'tension-archived');

INSERT INTO public.projects (
  "id", "organizationId", "name", "goal", "expectedResult", "status", "circleId",
  "bearerId", "sourceTensionId", "updatedAt"
) VALUES
  ('project-approved', 'org-a', 'Approved Project', 'Confirmed project goal', 'Confirmed result', 'ACTIVE', 'circle-a', 'person-a', 'tension-project-source', CURRENT_TIMESTAMP),
  ('project-legacy', 'org-a', 'Legacy Project', 'Unconfirmed legacy project', 'Legacy result', 'ACTIVE', 'circle-a', 'person-a', NULL, CURRENT_TIMESTAMP),
  ('project-b-approved', 'org-b', 'Approved Project B', 'Tenant B project goal', 'Tenant B result', 'ACTIVE', 'circle-b', 'person-b', 'tension-b-project-source', CURRENT_TIMESTAMP);

INSERT INTO public.tactical_outcome_proposals (
  "id", "organizationId", "tensionId", "provenanceKind", "meetingId", "proposerId",
  "kind", "title", "expectedResult", "acceptanceCriteria", "circleId",
  "responsiblePersonId", "deadline", "status", "revision", "recordedById",
  "meetingDecisionNote", "recordedAt", "outcomeProjectId", "outcomeActionId", "updatedAt"
) VALUES
  ('tactical-project-a', 'org-a', 'tension-project-source', 'ORDINARY_TENSION', 'meeting-a-ended', 'person-a', 'PROJECT', 'Approved Project', 'Confirmed result', NULL, 'circle-a', 'person-a', NULL, 'APPROVED', 1, 'person-a', 'Approved project', CURRENT_TIMESTAMP, 'project-approved', NULL, CURRENT_TIMESTAMP),
  ('tactical-action-a', 'org-a', 'tension-action-source', 'ORDINARY_TENSION', 'meeting-a-ended', 'person-a', 'ACTION', 'Approved action', NULL, 'Done means complete', 'circle-a', 'person-a', '2026-07-20T00:00:00Z', 'APPROVED', 1, 'person-a', 'Approved action', CURRENT_TIMESTAMP, NULL, 'action-approved', CURRENT_TIMESTAMP),
  ('tactical-unapproved-a', 'org-a', 'tension-unapproved', 'ORDINARY_TENSION', 'meeting-a-ended', 'person-a', 'ACTION', 'Unapproved action', NULL, 'Not confirmed', 'circle-a', 'person-a', NULL, 'PROPOSED', 1, NULL, NULL, NULL, NULL, NULL, CURRENT_TIMESTAMP),
  ('tactical-project-b', 'org-b', 'tension-b-project-source', 'ORDINARY_TENSION', 'meeting-b', 'person-b', 'PROJECT', 'Approved Project B', 'Tenant B result', NULL, 'circle-b', 'person-b', NULL, 'APPROVED', 1, 'person-b', 'Approved project B', CURRENT_TIMESTAMP, 'project-b-approved', NULL, CURRENT_TIMESTAMP);

INSERT INTO public.governance_proposals (
  "id", "organizationId", "type", "proposedChange", "rationale", "status",
  "tensionId", "meetingId"
) VALUES
  ('governance-proposal-adopted', 'org-a', 'ROLE_CREATED', '{"role":"Adopted Role"}', 'Adopt the role', 'CANDIDATE', 'tension-governance-adopted', 'meeting-a-governance'),
  ('governance-proposal-ready', 'org-a', 'ROLE_CREATED', '{"role":"Ready Role"}', 'Still under consideration', 'CANDIDATE', 'tension-governance-ready', 'meeting-a-governance');

INSERT INTO public.governance_decision_processes (
  "id", "organizationId", "proposalId", "sourceTensionId", "provenanceKind",
  "meetingId", "proposerId", "state", "currentRevision", "updatedAt"
) VALUES
  ('governance-process-adopted', 'org-a', 'governance-proposal-adopted', 'tension-governance-adopted', 'ORDINARY_TENSION', 'meeting-a-governance', 'person-a', 'READY', 1, CURRENT_TIMESTAMP),
  ('governance-process-ready', 'org-a', 'governance-proposal-ready', 'tension-governance-ready', 'ORDINARY_TENSION', 'meeting-a-governance', 'person-a', 'READY', 1, CURRENT_TIMESTAMP);

INSERT INTO public.governance_proposal_revisions (
  "id", "organizationId", "processId", "proposalId", "revision", "authoredById",
  "currentStructure", "proposedStructure", "rationale", "expectedImpact",
  "typedChange", "sourceKind"
) VALUES
  ('governance-revision-adopted', 'org-a', 'governance-process-adopted', 'governance-proposal-adopted', 1, 'person-a', 'No role', 'Adopted role structure', 'Adopt the role', 'Clear ownership', '{"kind":"ROLE_CREATED"}'::jsonb, 'INITIAL'),
  ('governance-revision-ready', 'org-a', 'governance-process-ready', 'governance-proposal-ready', 1, 'person-a', 'No role', 'Ready role structure', 'Consider the role', 'Potential ownership', '{"kind":"ROLE_CREATED"}'::jsonb, 'INITIAL');

UPDATE public.governance_decision_processes
SET "currentRevisionId" = CASE "id"
  WHEN 'governance-process-adopted' THEN 'governance-revision-adopted'
  WHEN 'governance-process-ready' THEN 'governance-revision-ready'
END,
"updatedAt" = CURRENT_TIMESTAMP
WHERE "id" IN ('governance-process-adopted', 'governance-process-ready');

INSERT INTO public.decision_records (
  "id", "organizationId", "title", "type", "content", "rationale", "status",
  "effectiveAt", "decisionMakerId", "meetingId"
) VALUES
  ('decision-adopted-a', 'org-a', 'Adopted governance decision', 'ROLE_CHANGE', 'Adopted role structure', 'Adopt the role', 'ACTIVE', CURRENT_TIMESTAMP, NULL, 'meeting-a-governance');
INSERT INTO public.change_logs (
  "id", "organizationId", "type", "objectDesc", "beforeValue", "afterValue",
  "impactAssessment", "effectiveAt", "initiatorId", "decisionId"
) VALUES
  ('change-adopted-a', 'org-a', 'ROLE_CREATED', 'Adopted Role', 'None', 'Adopted Role', 'Clear ownership', CURRENT_TIMESTAMP, 'person-a', 'decision-adopted-a');

UPDATE public.governance_decision_processes
SET "state" = 'ADOPTED',
  "recordedById" = 'person-a',
  "recordedAt" = CURRENT_TIMESTAMP,
  "resultNote" = 'Adopted',
  "outcomeRoleId" = 'role-gov-a',
  "decisionId" = 'decision-adopted-a',
  "changeLogId" = 'change-adopted-a',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE "id" = 'governance-process-adopted';
UPDATE public.governance_proposals
SET "status" = 'ADOPTED', "adoptedAt" = CURRENT_TIMESTAMP, "decisionId" = 'decision-adopted-a'
WHERE "id" = 'governance-proposal-adopted';

INSERT INTO public.governance_logs (
  "id", "organizationId", "period", "title", "content", "patterns", "risks",
  "status", "publishedAt", "confirmedById", "updatedAt"
) VALUES
  ('governance-log-published-a', 'org-a', '2026-07', 'Published A', 'Published content A', 'Patterns A', NULL, 'published', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP),
  ('governance-log-draft-a', 'org-a', '2026-08', 'Draft A', 'Draft content A', 'Patterns draft', NULL, 'draft', NULL, NULL, CURRENT_TIMESTAMP),
  ('governance-log-malformed-a', 'org-a', '2026-09', 'Malformed A', 'Missing publication time', 'Patterns malformed', NULL, 'published', NULL, NULL, CURRENT_TIMESTAMP),
  ('governance-log-timestamped-draft-a', 'org-a', '2026-10', 'Timestamped Draft A', 'Still draft', 'Patterns draft', NULL, 'draft', CURRENT_TIMESTAMP, NULL, CURRENT_TIMESTAMP),
  ('governance-log-published-b', 'org-b', '2026-07', 'Published B', 'Published content B', 'Patterns B', NULL, 'published', CURRENT_TIMESTAMP, 'person-b', CURRENT_TIMESTAMP);

COMMIT;`;

function quotedIdentifier(value: string): string {
  assert.match(value, /^[a-z][a-z0-9_]+$/);
  return `"${value}"`;
}

function quotedLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function databaseUrl(
  baseUrl: string,
  database: string,
  login?: Readonly<{ name: string; secret: string }>,
): string {
  const url = new URL(baseUrl);
  url.pathname = `/${database}`;
  if (login) {
    url.username = login.name;
    url.password = login.secret;
  }
  return url.toString();
}

function runPsqlScript(
  url: string,
  script: string,
  variables: Readonly<Record<string, string>>,
): ReturnType<typeof spawnSync> {
  return spawnSync(
    "psql",
    [
      "--no-psqlrc",
      "--dbname",
      url,
      "--set=ON_ERROR_STOP=1",
      ...Object.entries(variables).map(([name, value]) => `--set=${name}=${value}`),
      "--file",
      script,
    ],
    { encoding: "utf8" },
  );
}

async function setupDatabase(url: string): Promise<void> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    for (const entry of preB2aMigrations) await client.query(entry.sql);
  } finally {
    await client.end();
  }
}

async function queryDatabase<Row extends BrainReadRow>(
  url: string,
  text: string,
): Promise<Row[]> {
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    return (await client.query(text)).rows as Row[];
  } finally {
    await client.end();
  }
}

async function readFoundation(
  pool: Pool,
  context: Readonly<{
    organizationId: string;
    userId: string;
    personId: string;
  }>,
  request: BrainFoundationReadRequest,
): Promise<BrainReadRow[]> {
  const client = await pool.connect();
  return runBrainFoundationReadTransaction(
    {
      query: async (text, values) => {
        const result = await client.query(text, values);
        return { rows: result.rows };
      },
      release: (error) => client.release(error),
    },
    context,
    request,
  );
}

async function assertReaderStatementDenied(
  pool: Pool,
  statement: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SET TRANSACTION READ ONLY");
    await client.query("SET LOCAL ROLE loopos_brain_reader");
    await assert.rejects(
      client.query(statement),
      /denied|read-only transaction|cannot update view/i,
    );
  } finally {
    await client.query("ROLLBACK").catch(() => undefined);
    client.release();
  }
}

async function assertDirectLoginStatementDenied(
  pool: Pool,
  statement: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await assert.rejects(client.query(statement), /denied|privilege/i);
  } finally {
    client.release();
  }
}

async function roleExists(client: Client, role: string): Promise<boolean> {
  const result = await client.query(
    "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = $1",
    [role],
  );
  return result.rowCount === 1;
}

async function publicFunctionExecuteCount(client: Client): Promise<number> {
  const result = await client.query<{ count: number }>(`SELECT count(*)::integer AS count
    FROM pg_catalog.pg_proc AS procedure
    JOIN pg_catalog.pg_namespace AS namespace
      ON namespace.oid = procedure.pronamespace
    CROSS JOIN LATERAL pg_catalog.aclexplode(
      COALESCE(procedure.proacl, pg_catalog.acldefault('f', procedure.proowner))
    ) AS acl
    WHERE namespace.nspname !~ '^pg_'
      AND namespace.nspname <> 'information_schema'
      AND procedure.prokind IN ('f', 'w')
      AND acl.grantee = 0
      AND acl.privilege_type = 'EXECUTE'`);
  return result.rows[0]?.count ?? 0;
}

async function brainReaderViewAcl(client: Client): Promise<
  Array<Readonly<{ view: string; privilege: string; isGrantable: boolean }>>
> {
  const result = await client.query<{
    view: string;
    privilege: string;
    isGrantable: boolean;
  }>(`SELECT
    class.relname AS view,
    acl.privilege_type AS privilege,
    acl.is_grantable AS "isGrantable"
  FROM pg_catalog.pg_class AS class
  JOIN pg_catalog.pg_namespace AS namespace
    ON namespace.oid = class.relnamespace
  CROSS JOIN LATERAL pg_catalog.aclexplode(class.relacl) AS acl
  JOIN pg_catalog.pg_roles AS role
    ON role.oid = acl.grantee
  WHERE namespace.nspname = 'brain_read'
    AND class.relkind = 'v'
    AND role.rolname = 'loopos_brain_reader'
  ORDER BY class.relname, acl.privilege_type`);
  return result.rows;
}

type PublicDatabaseConnectionAcl = Readonly<{
  connect: boolean;
  temporary: boolean;
}>;

async function publicDatabaseConnectionAcl(
  client: Client,
  database: string,
): Promise<PublicDatabaseConnectionAcl> {
  const result = await client.query<PublicDatabaseConnectionAcl>(`SELECT
    COALESCE(bool_or(acl.privilege_type = 'CONNECT'), false) AS connect,
    COALESCE(bool_or(acl.privilege_type = 'TEMPORARY'), false) AS temporary
  FROM pg_catalog.pg_database AS database
  CROSS JOIN LATERAL pg_catalog.aclexplode(
    COALESCE(database.datacl, pg_catalog.acldefault('d', database.datdba))
  ) AS acl
  WHERE database.datname = $1
    AND acl.grantee = 0`, [database]);
  return result.rows[0] ?? { connect: false, temporary: false };
}

test(
  "PostgreSQL 14 full migration stack enforces B2a and B2b hardening, rollback, and reapply",
  { skip: adminDatabaseUrl ? false : "BRAIN_TEST_ADMIN_DATABASE_URL is not set" },
  async () => {
    assert.ok(adminDatabaseUrl);
    const suffix = `${process.pid}_${randomBytes(4).toString("hex")}`;
    const databases = [`loopos_b2a_a_${suffix}`, `loopos_b2a_b_${suffix}`];
    const outsideDatabase = `loopos_b2a_outside_${suffix}`;
    const futureOutsideDatabase = `loopos_b2a_future_${suffix}`;
    const allDisposableDatabases = [
      ...databases,
      outsideDatabase,
      futureOutsideDatabase,
    ];
    const login = {
      name: `loopos_b2a_login_${suffix}`,
      secret: randomBytes(18).toString("base64url"),
    };
    const contaminationRole = `loopos_b2a_contamination_${suffix}`;
    const admin = new Client({ connectionString: adminDatabaseUrl });
    let runtimePool: Pool | undefined;
    let maintenanceDatabase = "";
    let maintenanceInitialPublicAcl: PublicDatabaseConnectionAcl | undefined;
    let maintenanceAclModified = false;
    let migrationOwner = "";

    await admin.connect();
    try {
      const version = await admin.query<{ server_version_num: string }>(
        "SHOW server_version_num",
      );
      const versionNumber = Number(version.rows[0]?.server_version_num);
      assert.ok(versionNumber >= 140_000 && versionNumber < 150_000);

      const capabilities = await admin.query<{
        isSuperuser: boolean;
        canCreateDatabase: boolean;
        canCreateRole: boolean;
      }>(`SELECT
        role.rolsuper AS "isSuperuser",
        role.rolcreatedb AS "canCreateDatabase",
        role.rolcreaterole AS "canCreateRole"
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = current_user`);
      assert.deepEqual(capabilities.rows, [
        {
          isSuperuser: true,
          canCreateDatabase: true,
          canCreateRole: true,
        },
      ]);
      assert.equal(preB2aMigrations.length, 20);

      const clusterIdentity = await admin.query<{
        maintenanceDatabase: string;
        migrationOwner: string;
      }>(`SELECT
        current_database() AS "maintenanceDatabase",
        current_user AS "migrationOwner"`);
      maintenanceDatabase = clusterIdentity.rows[0]?.maintenanceDatabase ?? "";
      migrationOwner = clusterIdentity.rows[0]?.migrationOwner ?? "";
      assert.match(maintenanceDatabase, /^[a-z][a-z0-9_]+$/);
      assert.ok(migrationOwner);

      const baselineDatabases = await admin.query<{ datname: string }>(`SELECT datname
        FROM pg_catalog.pg_database
        WHERE NOT datistemplate
        ORDER BY datname`);
      assert.deepEqual(
        baselineDatabases.rows.map((row) => row.datname),
        [maintenanceDatabase],
        "integration test requires an isolated PostgreSQL cluster with only its maintenance database",
      );

      const existingReader = await admin.query(
        "SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = 'loopos_brain_reader'",
      );
      assert.equal(
        existingReader.rowCount,
        0,
        "integration test requires a disposable cluster without loopos_brain_reader",
      );

      maintenanceInitialPublicAcl = await publicDatabaseConnectionAcl(
        admin,
        maintenanceDatabase,
      );
      maintenanceAclModified = true;
      await admin.query(
        `REVOKE CONNECT, TEMPORARY ON DATABASE ${quotedIdentifier(maintenanceDatabase)} FROM PUBLIC`,
      );
      assert.deepEqual(
        await publicDatabaseConnectionAcl(admin, maintenanceDatabase),
        { connect: false, temporary: false },
      );

      await admin.query(`CREATE ROLE ${quotedIdentifier(login.name)}
        LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS
        PASSWORD ${quotedLiteral(login.secret)}`);
      await admin.query(
        `CREATE ROLE ${quotedIdentifier(contaminationRole)} NOLOGIN NOINHERIT`,
      );
      await admin.query(`CREATE DATABASE ${quotedIdentifier(outsideDatabase)}`);
      for (const database of databases) {
        await admin.query(`CREATE DATABASE ${quotedIdentifier(database)}`);
        const url = databaseUrl(adminDatabaseUrl, database);
        await setupDatabase(url);
        await admin.query(
          `REVOKE TEMPORARY ON DATABASE ${quotedIdentifier(database)} FROM PUBLIC`,
        );
      }

      const firstDatabaseAdminUrl = databaseUrl(adminDatabaseUrl, databases[0]);
      const deploymentVariables = {
        brain_allowed_databases: JSON.stringify(databases),
        brain_login_role: login.name,
        brain_migration_owner_role: migrationOwner,
      } as const;
      const hardeningVariables = {
        brain_allowed_databases: JSON.stringify(databases),
        brain_migration_owner_role: migrationOwner,
      } as const;

      const outsideDatabaseContamination = runPsqlScript(
        firstDatabaseAdminUrl,
        provisionScript,
        deploymentVariables,
      );
      assert.notEqual(outsideDatabaseContamination.status, 0);
      assert.match(
        `${outsideDatabaseContamination.stdout}${outsideDatabaseContamination.stderr}`,
        /outside the database allowlist/i,
      );

      await admin.query(
        `REVOKE CONNECT, TEMPORARY ON DATABASE ${quotedIdentifier(outsideDatabase)} FROM PUBLIC`,
      );
      const outsideLogin = new Client({
        connectionString: databaseUrl(adminDatabaseUrl, outsideDatabase, login),
      });
      await assert.rejects(outsideLogin.connect(), /permission denied for database/i);
      await outsideLogin.end().catch(() => undefined);

      const firstDatabase = new Client({ connectionString: firstDatabaseAdminUrl });
      await firstDatabase.connect();
      try {
        await assert.rejects(
          firstDatabase.query(migration),
          /must be provisioned before applying the B2a migration/,
        );
        const absentSchema = await firstDatabase.query(
          "SELECT to_regnamespace('brain_read') AS schema",
        );
        assert.equal(absentSchema.rows[0]?.schema, null);

        assert.equal(await publicFunctionExecuteCount(firstDatabase), 7);
        const publicFunctionContamination = runPsqlScript(
          firstDatabaseAdminUrl,
          provisionScript,
          deploymentVariables,
        );
        assert.notEqual(publicFunctionContamination.status, 0);
        assert.match(
          `${publicFunctionContamination.stdout}${publicFunctionContamination.stderr}`,
          /unsafe PUBLIC function EXECUTE/i,
        );
      } finally {
        await firstDatabase.end();
      }

      for (const database of databases) {
        const hardening = runPsqlScript(
          databaseUrl(adminDatabaseUrl, database),
          hardeningScript,
          hardeningVariables,
        );
        assert.equal(hardening.status, 0, `${hardening.stdout}${hardening.stderr}`);
      }

      const firstHardenedDatabase = new Client({
        connectionString: firstDatabaseAdminUrl,
      });
      await firstHardenedDatabase.connect();
      try {
        assert.equal(await publicFunctionExecuteCount(firstHardenedDatabase), 0);
        await firstHardenedDatabase.query(
          "ALTER DEFAULT PRIVILEGES GRANT EXECUTE ON FUNCTIONS TO PUBLIC",
        );
        const contaminatedFunctionDefaults = runPsqlScript(
          firstDatabaseAdminUrl,
          provisionScript,
          deploymentVariables,
        );
        assert.notEqual(contaminatedFunctionDefaults.status, 0);
        assert.match(
          `${contaminatedFunctionDefaults.stdout}${contaminatedFunctionDefaults.stderr}`,
          /migration owner function defaults are unsafe/i,
        );

        const reharden = runPsqlScript(
          firstDatabaseAdminUrl,
          hardeningScript,
          hardeningVariables,
        );
        assert.equal(reharden.status, 0, `${reharden.stdout}${reharden.stderr}`);
        await firstHardenedDatabase.query(`CREATE FUNCTION public.brain_future_probe()
          RETURNS integer
          LANGUAGE sql
          AS 'SELECT 1'`);
        assert.equal(await publicFunctionExecuteCount(firstHardenedDatabase), 0);
      } finally {
        await firstHardenedDatabase.end();
      }

      await admin.query(
        `GRANT ${quotedIdentifier(contaminationRole)} TO ${quotedIdentifier(login.name)}`,
      );
      const contaminatedMembership = runPsqlScript(
        firstDatabaseAdminUrl,
        provisionScript,
        deploymentVariables,
      );
      assert.notEqual(contaminatedMembership.status, 0);
      assert.match(
        `${contaminatedMembership.stdout}${contaminatedMembership.stderr}`,
        /membership/i,
      );
      await admin.query(
        `REVOKE ${quotedIdentifier(contaminationRole)} FROM ${quotedIdentifier(login.name)}`,
      );

      const firstDatabasePrivileges = new Client({
        connectionString: firstDatabaseAdminUrl,
      });
      await firstDatabasePrivileges.connect();
      try {
        await firstDatabasePrivileges.query(
          `GRANT SELECT ON public.organizations TO ${quotedIdentifier(login.name)}`,
        );
        const contaminatedLoginPrivilege = runPsqlScript(
          firstDatabaseAdminUrl,
          provisionScript,
          deploymentVariables,
        );
        assert.notEqual(contaminatedLoginPrivilege.status, 0);
        assert.match(
          `${contaminatedLoginPrivilege.stdout}${contaminatedLoginPrivilege.stderr}`,
          /privileges/i,
        );
        await firstDatabasePrivileges.query(
          `REVOKE SELECT ON public.organizations FROM ${quotedIdentifier(login.name)}`,
        );

        const provisionFirst = runPsqlScript(
          firstDatabaseAdminUrl,
          provisionScript,
          deploymentVariables,
        );
        assert.equal(
          provisionFirst.status,
          0,
          `${provisionFirst.stdout}${provisionFirst.stderr}`,
        );
        await assert.rejects(
          firstDatabasePrivileges.query(b2bMigration),
          /complete B2a brain_read foundation must exist/i,
        );
        await firstDatabasePrivileges.query("ROLLBACK");
        await firstDatabasePrivileges.query(migration);

        await admin.query(
          `GRANT ${quotedIdentifier(contaminationRole)} TO loopos_brain_reader`,
        );
        const contaminatedReaderMembership = runPsqlScript(
          firstDatabaseAdminUrl,
          provisionScript,
          deploymentVariables,
        );
        assert.notEqual(contaminatedReaderMembership.status, 0);
        assert.match(
          `${contaminatedReaderMembership.stdout}${contaminatedReaderMembership.stderr}`,
          /member/i,
        );
        await admin.query(
          `REVOKE ${quotedIdentifier(contaminationRole)} FROM loopos_brain_reader`,
        );

        await firstDatabasePrivileges.query(
          "GRANT SELECT ON public.organizations TO loopos_brain_reader",
        );
        const contaminatedReaderPrivilege = runPsqlScript(
          firstDatabaseAdminUrl,
          provisionScript,
          deploymentVariables,
        );
        assert.notEqual(contaminatedReaderPrivilege.status, 0);
        assert.match(
          `${contaminatedReaderPrivilege.stdout}${contaminatedReaderPrivilege.stderr}`,
          /privileges/i,
        );
        await firstDatabasePrivileges.query(
          "REVOKE SELECT ON public.organizations FROM loopos_brain_reader",
        );

        const reprovisionFirst = runPsqlScript(
          firstDatabaseAdminUrl,
          provisionScript,
          deploymentVariables,
        );
        assert.equal(
          reprovisionFirst.status,
          0,
          `${reprovisionFirst.stdout}${reprovisionFirst.stderr}`,
        );
        await firstDatabasePrivileges.query(b2bMigration);
        const reprovisionFirstB2b = runPsqlScript(
          firstDatabaseAdminUrl,
          provisionScript,
          deploymentVariables,
        );
        assert.equal(
          reprovisionFirstB2b.status,
          0,
          `${reprovisionFirstB2b.stdout}${reprovisionFirstB2b.stderr}`,
        );
      } finally {
        await firstDatabasePrivileges.end();
      }

      const secondDatabaseAdminUrl = databaseUrl(
        adminDatabaseUrl,
        databases[1],
      );
      const provisionSecond = runPsqlScript(
        secondDatabaseAdminUrl,
        provisionScript,
        deploymentVariables,
      );
      assert.equal(
        provisionSecond.status,
        0,
        `${provisionSecond.stdout}${provisionSecond.stderr}`,
      );
      const secondDatabase = new Client({
        connectionString: secondDatabaseAdminUrl,
      });
      await secondDatabase.connect();
      try {
        await secondDatabase.query(migration);
      } finally {
        await secondDatabase.end();
      }
      const reprovisionSecond = runPsqlScript(
        secondDatabaseAdminUrl,
        provisionScript,
        deploymentVariables,
      );
      assert.equal(
        reprovisionSecond.status,
        0,
        `${reprovisionSecond.stdout}${reprovisionSecond.stderr}`,
      );
      const secondDatabaseB2b = new Client({
        connectionString: secondDatabaseAdminUrl,
      });
      await secondDatabaseB2b.connect();
      try {
        await secondDatabaseB2b.query(b2bMigration);
      } finally {
        await secondDatabaseB2b.end();
      }
      const reprovisionSecondB2b = runPsqlScript(
        secondDatabaseAdminUrl,
        provisionScript,
        deploymentVariables,
      );
      assert.equal(
        reprovisionSecondB2b.status,
        0,
        `${reprovisionSecondB2b.stdout}${reprovisionSecondB2b.stderr}`,
      );

      await admin.query(
        `CREATE DATABASE ${quotedIdentifier(futureOutsideDatabase)} WITH ALLOW_CONNECTIONS=false`,
      );
      const futureDatabaseState = await admin.query<{ allowConnections: boolean }>(
        `SELECT datallowconn AS "allowConnections"
        FROM pg_catalog.pg_database
        WHERE datname = $1`,
        [futureOutsideDatabase],
      );
      assert.deepEqual(futureDatabaseState.rows, [{ allowConnections: false }]);
      assert.deepEqual(
        await publicDatabaseConnectionAcl(admin, futureOutsideDatabase),
        { connect: true, temporary: true },
      );

      const futureDatabaseContamination = runPsqlScript(
        firstDatabaseAdminUrl,
        provisionScript,
        deploymentVariables,
      );
      assert.notEqual(futureDatabaseContamination.status, 0);
      assert.match(
        `${futureDatabaseContamination.stdout}${futureDatabaseContamination.stderr}`,
        /outside the database allowlist/i,
      );

      await admin.query(
        `REVOKE CONNECT, TEMPORARY ON DATABASE ${quotedIdentifier(futureOutsideDatabase)} FROM PUBLIC`,
      );
      assert.deepEqual(
        await publicDatabaseConnectionAcl(admin, futureOutsideDatabase),
        { connect: false, temporary: false },
      );
      const futureDatabaseIsolated = runPsqlScript(
        firstDatabaseAdminUrl,
        provisionScript,
        deploymentVariables,
      );
      assert.equal(
        futureDatabaseIsolated.status,
        0,
        `${futureDatabaseIsolated.stdout}${futureDatabaseIsolated.stderr}`,
      );

      await admin.query(
        `ALTER DATABASE ${quotedIdentifier(futureOutsideDatabase)} ALLOW_CONNECTIONS=true`,
      );
      const futureOutsideLogin = new Client({
        connectionString: databaseUrl(
          adminDatabaseUrl,
          futureOutsideDatabase,
          login,
        ),
      });
      await assert.rejects(
        futureOutsideLogin.connect(),
        /permission denied for database/i,
      );
      await futureOutsideLogin.end().catch(() => undefined);

      const roleState = await admin.query(`SELECT
        role.rolcanlogin,
        role.rolinherit,
        role.rolsuper,
        role.rolcreatedb,
        role.rolcreaterole,
        role.rolreplication,
        role.rolbypassrls
      FROM pg_catalog.pg_roles AS role
      WHERE role.rolname = 'loopos_brain_reader'`);
      assert.deepEqual(roleState.rows, [
        {
          rolcanlogin: false,
          rolinherit: false,
          rolsuper: false,
          rolcreatedb: false,
          rolcreaterole: false,
          rolreplication: false,
          rolbypassrls: false,
        },
      ]);

      for (const database of databases) {
        const url = databaseUrl(adminDatabaseUrl, database);
        const client = new Client({ connectionString: url });
        await client.connect();
        try {
          const views = await client.query<{ table_name: string }>(`SELECT table_name
            FROM information_schema.views
            WHERE table_schema = 'brain_read'
            ORDER BY table_name`);
          assert.deepEqual(
            views.rows.map((row) => row.table_name),
            ALL_BRAIN_READ_VIEWS,
          );
          assert.deepEqual(
            await brainReaderViewAcl(client),
            ALL_BRAIN_READ_VIEWS.map((view) => ({
              view,
              privilege: "SELECT",
              isGrantable: false,
            })),
          );
        } finally {
          await client.end();
        }
      }

      const blockedDeprovision = runPsqlScript(
        adminDatabaseUrl,
        deprovisionScript,
        { brain_login_role: login.name },
      );
      assert.notEqual(blockedDeprovision.status, 0);
      assert.match(
        `${blockedDeprovision.stdout}${blockedDeprovision.stderr}`,
        /dependenc/i,
      );
      const membershipPreserved = await admin.query<{ member: boolean }>(
        "SELECT pg_has_role($1, 'loopos_brain_reader', 'MEMBER') AS member",
        [login.name],
      );
      assert.equal(membershipPreserved.rows[0]?.member, true);

      const firstDatabaseSeed = new Client({ connectionString: firstDatabaseAdminUrl });
      await firstDatabaseSeed.connect();
      try {
        await firstDatabaseSeed.query(FIXTURE_SQL);
      } finally {
        await firstDatabaseSeed.end();
      }

      runtimePool = new Pool({
        connectionString: databaseUrl(adminDatabaseUrl, databases[0], login),
        max: 2,
      });

      const missingContextClient = await runtimePool.connect();
      try {
        await missingContextClient.query("BEGIN");
        await missingContextClient.query("SET TRANSACTION READ ONLY");
        await missingContextClient.query("SET LOCAL ROLE loopos_brain_reader");
        const missingContext = await missingContextClient.query(
          "SELECT * FROM brain_read.current_actor",
        );
        assert.equal(missingContext.rowCount, 0);
      } finally {
        await missingContextClient.query("ROLLBACK").catch(() => undefined);
        missingContextClient.release();
      }

      const actorA = {
        organizationId: "org-a",
        userId: "user-a",
        personId: "person-a",
      } as const;
      const actorAdmin = {
        organizationId: "org-a",
        userId: "user-a2",
        personId: "person-a2",
      } as const;
      const actorRaiser = {
        organizationId: "org-a",
        userId: "user-raiser",
        personId: "person-raiser",
      } as const;
      const actorDirectLead = {
        organizationId: "org-a",
        userId: "user-direct-lead",
        personId: "person-direct-lead",
      } as const;
      const actorRelatedLead = {
        organizationId: "org-a",
        userId: "user-related-lead",
        personId: "person-related-lead",
      } as const;
      const actorRoleAssignee = {
        organizationId: "org-a",
        userId: "user-role",
        personId: "person-role",
      } as const;
      const actorParticipant = {
        organizationId: "org-a",
        userId: "user-participant",
        personId: "person-participant",
      } as const;
      const actorB = {
        organizationId: "org-b",
        userId: "user-b",
        personId: "person-b",
      } as const;
      await admin.query(
        `GRANT ${quotedIdentifier(contaminationRole)} TO ${quotedIdentifier(login.name)}`,
      );
      await assert.rejects(
        readFoundation(runtimePool, actorA, { resource: "currentActor" }),
        /dedicated brain reader login/i,
      );
      await admin.query(
        `REVOKE ${quotedIdentifier(contaminationRole)} FROM ${quotedIdentifier(login.name)}`,
      );

      const mismatched = await readFoundation(runtimePool, {
        organizationId: "org-b",
        userId: "user-a",
        personId: "person-a",
      }, { resource: "currentActor" });
      assert.deepEqual(mismatched, []);

      assert.equal(
        (await readFoundation(runtimePool, actorA, { resource: "currentActor" }))[0]
          ?.personId,
        "person-a",
      );
      assert.equal(
        (
          await readFoundation(runtimePool, actorA, {
            resource: "organizationIdentity",
          })
        )[0]?.id,
        "org-a",
      );
      assert.equal(
        (
          await readFoundation(runtimePool, actorA, {
            resource: "organizationBrainProfile",
          })
        )[0]?.id,
        "profile-a",
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorA, {
            resource: "currentActorRoleAssignments",
          })
        ).map((row) => row.roleDefinitionId),
        ["role-a"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorA, {
            resource: "privateConversations",
          })
        ).map((row) => row.id),
        ["conversation-a"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorA, {
            resource: "privateMessages",
            conversationId: "conversation-a",
          })
        ).map((row) => row.id),
        ["message-a"],
      );
      assert.deepEqual(
        await readFoundation(runtimePool, actorA, {
          resource: "privateMessages",
          conversationId: "conversation-a2",
        }),
        [],
      );
      assert.deepEqual(
        await readFoundation(runtimePool, actorA, {
          resource: "privateMessages",
          conversationId: "conversation-b",
        }),
        [],
      );

      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorA, { resource: "circles" })
        )
          .map((row) => row.id)
          .sort(),
        ["circle-a", "circle-direct", "circle-related"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorA, {
            resource: "roleDefinitions",
          })
        )
          .map((row) => row.id)
          .sort(),
        ["role-a", "role-gov-a", "role-role-only"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorA, { resource: "projects" })
        ).map((row) => row.id),
        ["project-approved"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorRaiser, {
            resource: "projects",
          })
        ).map((row) => row.id),
        ["project-approved"],
        "confirmed organization facts remain transparent to an ordinary actor without a Role",
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorA, { resource: "actions" })
        ).map((row) => row.id),
        ["action-approved"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorA, {
            resource: "approvedTacticalOutcomes",
          })
        )
          .map((row) => row.id)
          .sort(),
        ["tactical-action-a", "tactical-project-a"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorA, {
            resource: "adoptedGovernanceDecisions",
          })
        ).map((row) => row.id),
        ["governance-process-adopted"],
      );
      const publishedLogsA = await readFoundation(runtimePool, actorA, {
        resource: "publishedGovernanceLogs",
      });
      assert.deepEqual(
        publishedLogsA.map((row) => row.id),
        ["governance-log-published-a"],
      );
      assert.equal(publishedLogsA[0]?.confirmedById, null);

      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorB, { resource: "circles" })
        ).map((row) => row.id),
        ["circle-b"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorB, { resource: "projects" })
        ).map((row) => row.id),
        ["project-b-approved"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorB, {
            resource: "publishedGovernanceLogs",
          })
        ).map((row) => row.id),
        ["governance-log-published-b"],
      );

      const participantMeetingA = await readFoundation(runtimePool, actorA, {
        resource: "meetingDrafts",
      });
      assert.deepEqual(
        participantMeetingA.map((row) => row.id),
        ["meeting-a-ended"],
      );
      assert.ok(participantMeetingA[0]?.endedAt instanceof Date);
      assert.equal(
        Object.hasOwn(participantMeetingA[0] ?? {}, "aiGuardReport"),
        false,
      );
      assert.deepEqual(
        await readFoundation(runtimePool, actorAdmin, {
          resource: "meetingDrafts",
        }),
        [],
        "organization administrators do not bypass meeting participation",
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorParticipant, {
            resource: "meetingDrafts",
          })
        ).map((row) => row.id),
        ["meeting-a-participant-only"],
      );

      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorA, {
            resource: "unresolvedTensions",
          })
        )
          .map((row) => row.id)
          .sort(),
        ["action-legacy", "tension-governance-ready", "tension-owner"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorRaiser, {
            resource: "unresolvedTensions",
          })
        ).map((row) => row.id),
        ["tension-raiser"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorDirectLead, {
            resource: "unresolvedTensions",
          })
        ).map((row) => row.id),
        ["tension-direct"],
      );
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorRelatedLead, {
            resource: "unresolvedTensions",
          })
        ).map((row) => row.id),
        ["tension-related"],
        "an archived related Circle does not authorize its lead",
      );
      assert.deepEqual(
        await readFoundation(runtimePool, actorRoleAssignee, {
          resource: "unresolvedTensions",
        }),
        [],
        "Role assignment alone does not authorize a Tension",
      );
      assert.deepEqual(
        await readFoundation(runtimePool, actorParticipant, {
          resource: "unresolvedTensions",
        }),
        [],
        "meeting participation alone does not authorize a Tension",
      );
      const adminTensions = (
        await readFoundation(runtimePool, actorAdmin, {
          resource: "unresolvedTensions",
        })
      ).map((row) => row.id);
      assert.ok(adminTensions.includes("tension-admin"));
      assert.ok(adminTensions.includes("tension-role"));
      assert.equal(adminTensions.includes("action-approved"), false);
      assert.equal(adminTensions.includes("tension-resolved"), false);
      assert.equal(adminTensions.includes("tension-b-owner"), false);
      assert.deepEqual(
        (
          await readFoundation(runtimePool, actorB, {
            resource: "unresolvedTensions",
          })
        ).map((row) => row.id),
        ["tension-b-owner"],
      );

      await assertReaderStatementDenied(
        runtimePool,
        "SELECT * FROM public.organizations",
      );
      await assertReaderStatementDenied(
        runtimePool,
        "SELECT * FROM public.governance_decision_operations",
      );
      await assertReaderStatementDenied(
        runtimePool,
        "SELECT * FROM public.users",
      );
      await assertReaderStatementDenied(
        runtimePool,
        "INSERT INTO public.organizations (\"id\", \"name\", \"slug\") VALUES ('denied', 'Denied', 'denied')",
      );
      await assertReaderStatementDenied(
        runtimePool,
        "UPDATE brain_read.projects SET name = 'Denied' WHERE id = 'project-approved'",
      );
      await assertReaderStatementDenied(
        runtimePool,
        "CREATE TABLE brain_read.denied_ddl (id integer)",
      );
      await assertDirectLoginStatementDenied(
        runtimePool,
        "SELECT * FROM public.organizations",
      );
      await assertDirectLoginStatementDenied(
        runtimePool,
        "SELECT * FROM brain_read.projects",
      );
      await assertDirectLoginStatementDenied(
        runtimePool,
        "INSERT INTO public.organizations (\"id\", \"name\", \"slug\") VALUES ('direct-denied', 'Direct Denied', 'direct-denied')",
      );
      await assertDirectLoginStatementDenied(
        runtimePool,
        "CREATE TABLE public.direct_denied_ddl (id integer)",
      );
      await assertDirectLoginStatementDenied(
        runtimePool,
        "SELECT public.brain_future_probe()",
      );

      const rollbackClient = new Client({ connectionString: firstDatabaseAdminUrl });
      await rollbackClient.connect();
      try {
        await rollbackClient.query(b2bRollback);
        const survivingB2aViews = await rollbackClient.query<{
          table_name: string;
        }>(`SELECT table_name
          FROM information_schema.views
          WHERE table_schema = 'brain_read'
          ORDER BY table_name`);
        assert.deepEqual(
          survivingB2aViews.rows.map((row) => row.table_name),
          B2A_VIEWS,
        );
        assert.deepEqual(
          await brainReaderViewAcl(rollbackClient),
          B2A_VIEWS.map((view) => ({
            view,
            privilege: "SELECT",
            isGrantable: false,
          })),
        );
        assert.equal(
          (
            await readFoundation(runtimePool, actorA, {
              resource: "currentActor",
            })
          )[0]?.personId,
          "person-a",
        );

        const secondDatabaseViews = await queryDatabase<{ count: number }>(
          databaseUrl(adminDatabaseUrl, databases[1]),
          "SELECT count(*)::integer AS count FROM information_schema.views WHERE table_schema = 'brain_read'",
        );
        assert.equal(secondDatabaseViews[0]?.count, 15);

        await rollbackClient.query(b2bMigration);
        assert.deepEqual(
          await brainReaderViewAcl(rollbackClient),
          ALL_BRAIN_READ_VIEWS.map((view) => ({
            view,
            privilege: "SELECT",
            isGrantable: false,
          })),
        );
        assert.deepEqual(
          (
            await readFoundation(runtimePool, actorA, { resource: "projects" })
          ).map((row) => row.id),
          ["project-approved"],
        );

        await rollbackClient.query(b2bRollback);
        await rollbackClient.query(rollback);
        const preserved = await rollbackClient.query(`SELECT
          to_regclass('public.organization_brain_profiles') IS NOT NULL AS "b1Present",
          (SELECT count(*)::integer FROM public.organization_brain_profiles) AS "profileCount",
          (SELECT count(*)::integer FROM public.organizations) AS "organizationCount",
          to_regnamespace('brain_read') AS "brainReadSchema"`);
        assert.deepEqual(preserved.rows, [
          {
            b1Present: true,
            profileCount: 2,
            organizationCount: 2,
            brainReadSchema: null,
          },
        ]);

        await rollbackClient.query(migration);
        await rollbackClient.query(b2bMigration);
        const reprovisionAfterReapply = runPsqlScript(
          firstDatabaseAdminUrl,
          provisionScript,
          deploymentVariables,
        );
        assert.equal(
          reprovisionAfterReapply.status,
          0,
          `${reprovisionAfterReapply.stdout}${reprovisionAfterReapply.stderr}`,
        );
        assert.deepEqual(
          await brainReaderViewAcl(rollbackClient),
          ALL_BRAIN_READ_VIEWS.map((view) => ({
            view,
            privilege: "SELECT",
            isGrantable: false,
          })),
        );
      } finally {
        await rollbackClient.end();
      }

      assert.equal(
        (await readFoundation(runtimePool, actorA, { resource: "currentActor" }))[0]
          ?.personId,
        "person-a",
      );
    } finally {
      if (runtimePool) await runtimePool.end().catch(() => undefined);
      try {
        for (const database of databases) {
          const url = databaseUrl(adminDatabaseUrl, database);
          const client = new Client({ connectionString: url });
          try {
            await client.connect();
            const schema = await client.query(
              "SELECT to_regnamespace('brain_read') AS schema",
            );
            if (schema.rows[0]?.schema) await client.query(rollback);
          } catch {
            // Database removal below is the fallback for partially applied setup.
          } finally {
            await client.end().catch(() => undefined);
          }
        }

        if (
          (await roleExists(admin, contaminationRole)) &&
          (await roleExists(admin, login.name))
        ) {
          await admin
            .query(
              `REVOKE ${quotedIdentifier(contaminationRole)} FROM ${quotedIdentifier(login.name)}`,
            )
            .catch(() => undefined);
        }
        if (
          (await roleExists(admin, contaminationRole)) &&
          (await roleExists(admin, "loopos_brain_reader"))
        ) {
          await admin
            .query(
              `REVOKE ${quotedIdentifier(contaminationRole)} FROM loopos_brain_reader`,
            )
            .catch(() => undefined);
        }

        if (
          (await roleExists(admin, "loopos_brain_reader")) &&
          (await roleExists(admin, login.name))
        ) {
          runPsqlScript(adminDatabaseUrl, deprovisionScript, {
            brain_login_role: login.name,
          });
        }

        for (const database of allDisposableDatabases) {
          await admin
            .query(
              "SELECT pg_terminate_backend(pid) FROM pg_catalog.pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
              [database],
            )
            .catch(() => undefined);
          await admin
            .query(`DROP DATABASE IF EXISTS ${quotedIdentifier(database)}`)
            .catch(() => undefined);
        }

        if (
          (await roleExists(admin, "loopos_brain_reader")) &&
          (await roleExists(admin, login.name))
        ) {
          runPsqlScript(adminDatabaseUrl, deprovisionScript, {
            brain_login_role: login.name,
          });
        }
        if (await roleExists(admin, "loopos_brain_reader")) {
          await admin
            .query("DROP ROLE loopos_brain_reader")
            .catch(() => undefined);
        }
        if (await roleExists(admin, login.name)) {
          await admin
            .query(`DROP ROLE ${quotedIdentifier(login.name)}`)
            .catch(() => undefined);
        }
        if (await roleExists(admin, contaminationRole)) {
          await admin
            .query(`DROP ROLE ${quotedIdentifier(contaminationRole)}`)
            .catch(() => undefined);
        }

        const roleResidue = await admin.query<{ rolname: string }>(
          "SELECT rolname FROM pg_catalog.pg_roles WHERE rolname = ANY($1::text[]) ORDER BY rolname",
          [[login.name, contaminationRole, "loopos_brain_reader"]],
        );
        assert.deepEqual(roleResidue.rows, []);

        const databaseResidue = await admin.query<{ datname: string }>(
          "SELECT datname FROM pg_catalog.pg_database WHERE datname = ANY($1::text[]) ORDER BY datname",
          [allDisposableDatabases],
        );
        assert.deepEqual(databaseResidue.rows, []);
      } finally {
        if (maintenanceAclModified && maintenanceInitialPublicAcl) {
          await admin.query(
            `${maintenanceInitialPublicAcl.connect ? "GRANT" : "REVOKE"} CONNECT ON DATABASE ${quotedIdentifier(maintenanceDatabase)} ${maintenanceInitialPublicAcl.connect ? "TO" : "FROM"} PUBLIC`,
          );
          await admin.query(
            `${maintenanceInitialPublicAcl.temporary ? "GRANT" : "REVOKE"} TEMPORARY ON DATABASE ${quotedIdentifier(maintenanceDatabase)} ${maintenanceInitialPublicAcl.temporary ? "TO" : "FROM"} PUBLIC`,
          );
          assert.deepEqual(
            await publicDatabaseConnectionAcl(admin, maintenanceDatabase),
            maintenanceInitialPublicAcl,
          );
        }
        await admin.end();
      }
    }
  },
);
