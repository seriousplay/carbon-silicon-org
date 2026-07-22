#!/usr/bin/env node

import { Client } from "pg";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const client = new Client({ connectionString: databaseUrl });
const now = "2026-07-17 10:00:00+00";

function check(ok, name, detail) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: ${detail}`);
  if (!ok) process.exitCode = 1;
}

let savepointNumber = 0;
async function expectRejected(query) {
  const savepoint = `m6_2a_expected_failure_${savepointNumber++}`;
  await client.query(`SAVEPOINT ${savepoint}`);
  try {
    await client.query(query);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return { rejected: false, code: null };
  } catch (error) {
    const code = error?.code ?? null;
    await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
    await client.query(`RELEASE SAVEPOINT ${savepoint}`);
    return { rejected: true, code };
  }
}

async function main() {
  await client.connect();
  try {
    await client.query("BEGIN");
    await client.query(`
      INSERT INTO "organizations" ("id", "name", "slug", "updatedAt") VALUES
        ('m6-2a-org-a', 'M6-2A A', 'm6-2a-a', '${now}'),
        ('m6-2a-org-b', 'M6-2A B', 'm6-2a-b', '${now}');
      INSERT INTO "users" ("id", "email", "updatedAt") VALUES
        ('m6-2a-user-a', 'm6-2a-a@example.invalid', '${now}'),
        ('m6-2a-user-b', 'm6-2a-b@example.invalid', '${now}');
      INSERT INTO "memberships" ("id", "userId", "organizationId", "role") VALUES
        ('m6-2a-membership-a', 'm6-2a-user-a', 'm6-2a-org-a', 'ORG_MEMBER'),
        ('m6-2a-membership-b', 'm6-2a-user-b', 'm6-2a-org-b', 'ORG_MEMBER');
      INSERT INTO "circles" ("id", "organizationId", "name", "number", "type", "purpose", "updatedAt") VALUES
        ('m6-2a-circle-a', 'm6-2a-org-a', 'A', 'ONE', 'PRODUCTION', 'A', '${now}'),
        ('m6-2a-circle-b', 'm6-2a-org-b', 'B', 'ONE', 'PRODUCTION', 'B', '${now}');
      INSERT INTO "people" ("id", "organizationId", "userId", "name", "homeCircleId", "updatedAt") VALUES
        ('m6-2a-person-a', 'm6-2a-org-a', 'm6-2a-user-a', 'A', 'm6-2a-circle-a', '${now}'),
        ('m6-2a-person-b', 'm6-2a-org-b', 'm6-2a-user-b', 'B', 'm6-2a-circle-b', '${now}');
      INSERT INTO "brain_artifacts" (
        "id", "organizationId", "ownerPersonId", "artifactType", "payload", "sourceRefs", "createdAt", "updatedAt"
      ) VALUES
        ('m6-2a-artifact-a', 'm6-2a-org-a', 'm6-2a-person-a', 'TENSION_DRAFT', '{"title":"A"}', '[{"organizationId":"m6-2a-org-a","ownerPersonId":"m6-2a-person-a","type":"meeting","id":"m","label":"M","applicationUrl":"/app/meetings/m","observedAt":"2026-07-17T10:00:00.000Z"}]', '${now}', '${now}'),
        ('m6-2a-artifact-b', 'm6-2a-org-b', 'm6-2a-person-b', 'TENSION_DRAFT', '{"title":"B"}', '[{"organizationId":"m6-2a-org-b","ownerPersonId":"m6-2a-person-b","type":"meeting","id":"m","label":"M","applicationUrl":"/app/meetings/m","observedAt":"2026-07-17T10:00:00.000Z"}]', '${now}', '${now}');
      INSERT INTO "brain_artifact_audit_events" ("id", "organizationId", "artifactId", "type", "actor", "actorPersonId") VALUES
        ('m6-2a-event-a-created', 'm6-2a-org-a', 'm6-2a-artifact-a', 'CREATED', '{"type":"person","id":"m6-2a-person-a"}', 'm6-2a-person-a'),
        ('m6-2a-event-b-created', 'm6-2a-org-b', 'm6-2a-artifact-b', 'CREATED', '{"type":"person","id":"m6-2a-person-b"}', 'm6-2a-person-b');
    `);

    const visible = await client.query(`SELECT count(*)::int AS count FROM "brain_artifacts" WHERE "organizationId" = 'm6-2a-org-a' AND "ownerPersonId" = 'm6-2a-person-a'`);
    const foreignOwner = await client.query(`SELECT count(*)::int AS count FROM "brain_artifacts" WHERE "organizationId" = 'm6-2a-org-a' AND "ownerPersonId" = 'm6-2a-person-b'`);
    const foreignTenant = await client.query(`SELECT count(*)::int AS count FROM "brain_artifacts" WHERE "organizationId" = 'm6-2a-org-b' AND "ownerPersonId" = 'm6-2a-person-a'`);
    check(visible.rows[0].count === 1, "owner-can-read-own-tenant-artifact", "one artifact visible");
    check(foreignOwner.rows[0].count === 0, "foreign-owner-denied", "composite owner filter returns no artifact");
    check(foreignTenant.rows[0].count === 0, "foreign-tenant-denied", "composite tenant filter returns no artifact");

    const initialTerminal = await expectRejected(`INSERT INTO "brain_artifacts" ("id", "organizationId", "ownerPersonId", "artifactType", "payload", "sourceRefs", "status", "createdAt", "updatedAt") VALUES ('m6-2a-artifact-invalid', 'm6-2a-org-a', 'm6-2a-person-a', 'TENSION_DRAFT', '{}', '[]', 'SUCCEEDED', '${now}', '${now}')`);
    check(initialTerminal.rejected, "initial-terminal-insert-denied", "artifacts must start as DRAFT");

    const actorMismatch = await expectRejected(`INSERT INTO "brain_artifact_audit_events" ("id", "organizationId", "artifactId", "type", "actor", "actorPersonId") VALUES ('m6-2a-event-mismatch', 'm6-2a-org-a', 'm6-2a-artifact-a', 'CREATED', '{"type":"person","id":"m6-2a-person-b"}', 'm6-2a-person-a')`);
    check(actorMismatch.rejected, "audit-actor-binding", "audit JSON actor must match actorPersonId");
    const foreignSource = await expectRejected(`INSERT INTO "brain_artifacts" ("id", "organizationId", "ownerPersonId", "artifactType", "payload", "sourceRefs", "createdAt", "updatedAt") VALUES ('m6-2a-artifact-foreign-source', 'm6-2a-org-a', 'm6-2a-person-a', 'TENSION_DRAFT', '{"title":"bad source"}', '[{"organizationId":"m6-2a-org-b","ownerPersonId":"m6-2a-person-b","type":"meeting","id":"m","label":"M","applicationUrl":"/app/meetings/m","observedAt":"2026-07-17T10:00:00.000Z"}]', '${now}', '${now}')`);
    check(foreignSource.rejected, "foreign-source-binding-denied", "source ref organization/owner must match artifact scope");
    const missingSourceMessage = await expectRejected(`INSERT INTO "brain_artifacts" ("id", "organizationId", "ownerPersonId", "conversationId", "sourceMessageId", "artifactType", "payload", "sourceRefs", "createdAt", "updatedAt") VALUES ('m6-2a-artifact-missing-message', 'm6-2a-org-a', 'm6-2a-person-a', 'missing-conversation', 'missing-message', 'TENSION_DRAFT', '{"title":"bad message"}', '[{"organizationId":"m6-2a-org-a","ownerPersonId":"m6-2a-person-a","type":"meeting","id":"m","label":"M","applicationUrl":"/app/meetings/m","observedAt":"2026-07-17T10:00:00.000Z"}]', '${now}', '${now}')`);
    check(missingSourceMessage.rejected, "source-message-fk-denied", "source message must exist in the tenant-scoped conversation");

    await client.query(`UPDATE "brain_artifacts" SET "status"='READY', "readyAt"='2026-07-17 10:01:00+00', "updatedAt"='2026-07-17 10:01:00+00' WHERE "id"='m6-2a-artifact-a'`);
    await client.query(`INSERT INTO "brain_artifact_audit_events" ("id", "organizationId", "artifactId", "type", "actor", "actorPersonId") VALUES ('m6-2a-event-a-ready', 'm6-2a-org-a', 'm6-2a-artifact-a', 'READY', '{"type":"person","id":"m6-2a-person-a"}', 'm6-2a-person-a')`);
    await client.query(`UPDATE "brain_artifacts" SET "status"='EXECUTING', "executionStartedAt"='2026-07-17 10:02:00+00', "updatedAt"='2026-07-17 10:02:00+00' WHERE "id"='m6-2a-artifact-a'`);
    await client.query(`INSERT INTO "brain_artifact_audit_events" ("id", "organizationId", "artifactId", "type", "actor", "actorPersonId") VALUES ('m6-2a-event-a-executing', 'm6-2a-org-a', 'm6-2a-artifact-a', 'EXECUTION_STARTED', '{"type":"person","id":"m6-2a-person-a"}', 'm6-2a-person-a')`);
    await client.query(`UPDATE "brain_artifacts" SET "status"='FAILED', "failureCode"='DOMAIN_VALIDATION_FAILED', "completedAt"='2026-07-17 10:03:00+00', "updatedAt"='2026-07-17 10:03:00+00' WHERE "id"='m6-2a-artifact-a'`);
    await client.query(`INSERT INTO "brain_artifact_audit_events" ("id", "organizationId", "artifactId", "type", "actor", "actorPersonId") VALUES ('m6-2a-event-a-failed', 'm6-2a-org-a', 'm6-2a-artifact-a', 'FAILED', '{"type":"person","id":"m6-2a-person-a"}', 'm6-2a-person-a')`);
    const lifecycle = await client.query(`SELECT "status", "payload"->>'title' AS title, (SELECT count(*)::int FROM "brain_artifact_audit_events" WHERE "artifactId"='m6-2a-artifact-a') AS events FROM "brain_artifacts" WHERE "id"='m6-2a-artifact-a'`);
    check(lifecycle.rows[0].status === "FAILED" && lifecycle.rows[0].title === "A" && lifecycle.rows[0].events === 4, "failed-lifecycle-audited", "failure preserves payload and records four events");

    await client.query(`INSERT INTO "brain_artifacts" ("id", "organizationId", "ownerPersonId", "supersedesArtifactId", "artifactType", "payload", "sourceRefs", "createdAt", "updatedAt") VALUES ('m6-2a-artifact-superseding', 'm6-2a-org-a', 'm6-2a-person-a', 'm6-2a-artifact-a', 'TENSION_DRAFT', '{"title":"A correction"}', '[{"organizationId":"m6-2a-org-a","ownerPersonId":"m6-2a-person-a","type":"meeting","id":"m","label":"M","applicationUrl":"/app/meetings/m","observedAt":"2026-07-17T10:00:00.000Z"}]', '${now}', '${now}')`);
    const supersession = await client.query(`SELECT "supersedesArtifactId" FROM "brain_artifacts" WHERE "id"='m6-2a-artifact-superseding'`);
    check(supersession.rows[0].supersedesArtifactId === "m6-2a-artifact-a", "same-owner-supersession", "owner can supersede its own terminal artifact");
    const foreignSupersession = await expectRejected(`INSERT INTO "brain_artifacts" ("id", "organizationId", "ownerPersonId", "supersedesArtifactId", "artifactType", "payload", "sourceRefs", "createdAt", "updatedAt") VALUES ('m6-2a-artifact-foreign-superseding', 'm6-2a-org-b', 'm6-2a-person-b', 'm6-2a-artifact-a', 'TENSION_DRAFT', '{"title":"foreign"}', '[{"organizationId":"m6-2a-org-b","ownerPersonId":"m6-2a-person-b","type":"meeting","id":"m","label":"M","applicationUrl":"/app/meetings/m","observedAt":"2026-07-17T10:00:00.000Z"}]', '${now}', '${now}')`);
    check(foreignSupersession.rejected, "foreign-supersession-denied", "cross-tenant supersession rejected");

    const terminal = await expectRejected(`UPDATE "brain_artifacts" SET "payload"='{"title":"tampered"}', "updatedAt"=CURRENT_TIMESTAMP WHERE "id"='m6-2a-artifact-a'`);
    check(terminal.rejected, "terminal-row-immutable", `terminal update rejected with ${terminal.code ?? "error"}`);

    await client.query(`DELETE FROM "brain_artifacts" WHERE "id"='m6-2a-artifact-superseding'`);
    const deleted = await expectRejected(`DELETE FROM "brain_artifacts" WHERE "id"='m6-2a-artifact-a'`);
    check(deleted.rejected && deleted.code === "P0001", "terminal-row-delete-protected", `terminal artifact deletion rejected with ${deleted.code ?? "error"}`);

    const invalidCheck = await expectRejected(`UPDATE "brain_artifacts" SET "status"='READY' WHERE "id"='m6-2a-artifact-b'`);
    check(invalidCheck.rejected, "database-lifecycle-check", "invalid READY transition rejected");

    const invalidTransition = await expectRejected(`UPDATE "brain_artifacts" SET "status"='SUCCEEDED', "readyAt"='2026-07-17 10:01:00+00', "executionStartedAt"='2026-07-17 10:02:00+00', "completedAt"='2026-07-17 10:03:00+00', "terminalResult"='{"id":"bad"}' WHERE "id"='m6-2a-artifact-b'`);
    check(invalidTransition.rejected, "database-transition-graph", "direct DRAFT to SUCCEEDED transition rejected");
    await client.query("ROLLBACK");
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
  if (process.exitCode) process.exit(1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
