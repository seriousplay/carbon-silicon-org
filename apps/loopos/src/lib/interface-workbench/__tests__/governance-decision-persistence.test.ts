import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, test } from "node:test";

const readIfPresent = (url: URL) => (existsSync(url) ? readFileSync(url, "utf8") : "");

const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
const migrationDirectory = "prisma/migrations/20260712090000_g3_i2c_gd1_governance_decision";
const migrationName = "20260712090000_g3_i2c_gd1_governance_decision";
const schema = readIfPresent(new URL("../../../../prisma/schema.prisma", import.meta.url));
const migration = readIfPresent(new URL(`../../../../${migrationDirectory}/migration.sql`, import.meta.url));
const plan = readIfPresent(
  new URL("../../../../docs/plans/2026-07-11-gd1-governance-decision-implementation-plan.md", import.meta.url),
);
const databaseRequired = process.env.GD1_DB_REQUIRED === "1";
const databaseUrl = process.env.GD1_DATABASE_URL ?? "";

type CommandResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv = process.env): CommandResult {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    env,
  });
  return {
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? result.error?.message ?? "",
  };
}

function psql(sql: string): CommandResult {
  return runCommand("psql", [databaseUrl, "-X", "-v", "ON_ERROR_STOP=1", "-qAt", "-c", sql]);
}

function commandDetails(result: CommandResult): string {
  return `status=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`;
}

function expectSqlPass(label: string, sql: string): CommandResult {
  const result = psql(sql);
  assert.equal(result.status, 0, `${label} should succeed\n${commandDetails(result)}`);
  return result;
}

function expectSqlReject(label: string, sql: string): CommandResult {
  const result = psql(sql);
  assert.notEqual(result.status, 0, `${label} should be rejected by PostgreSQL\n${commandDetails(result)}`);
  return result;
}

function query(sql: string): string {
  return expectSqlPass("query", sql).stdout.trim();
}

const revisionTwoInsert = `
  INSERT INTO "governance_proposal_revisions" (
    "id","organizationId","processId","proposalId","revision","authoredById",
    "currentStructure","proposedStructure","rationale","expectedImpact","typedChange","sourceKind"
  ) VALUES (
    'gd1-edge-revision-2','gd1-org','gd1-edge-process','gd1-edge-proposal',2,'gd1-person',
    'Current structure','Revised role','Revised rationale','Revised impact',
    '{"schemaVersion":1,"operation":"ROLE_CREATED","revision":2}'::jsonb,'AMENDMENT'
  );`;

function operationInsert(id: string, leaseToken: string, leaseExpiry: string): string {
  return `
    INSERT INTO "governance_decision_operations" (
      "id","organizationId","proposalId","processId","meetingId","actorId","revision","operation",
      "operationScope","mutationKey","canonicalPayloadHash","leaseToken","leaseExpiresAt","updatedAt"
    ) VALUES (
      '${id}','gd1-org','gd1-edge-proposal','gd1-edge-process','gd1-meeting','gd1-person',1,'ADOPT_ROLE',
      '${id}','${id}-key','${id}-hash','${leaseToken}',${leaseExpiry},CURRENT_TIMESTAMP
    );`;
}

describe("governance decision persistence contracts", () => {
  test("defines the locked bounded enums and ROLE artifact type", () => {
    assert.match(
      schema,
      /enum GovernanceDecisionProcessState \{\s+READY\s+CLARIFICATION_REQUIRED\s+OBJECTION_PENDING\s+AMENDMENT_REQUIRED\s+NOT_ADOPTED\s+ADOPTED\s+\}/,
    );
    assert.match(schema, /enum GovernanceProposalRevisionSource \{\s+INITIAL\s+CLARIFICATION\s+AMENDMENT\s+\}/);
    assert.match(
      schema,
      /enum GovernanceDecisionOperationKind \{\s+INITIALIZE\s+SUBMIT_REVISION\s+REQUEST_CLARIFICATION\s+RAISE_OBJECTION\s+ASSESS_OBJECTION\s+RECORD_NON_ADOPTION\s+ADOPT_ROLE\s+\}/,
    );
    assert.match(schema, /enum GovernanceDecisionOperationStatus \{\s+PROCESSING\s+FAILED\s+SUCCEEDED\s+\}/);
    assert.match(schema, /enum InterfaceWorkflowArtifactType \{[^}]*\bROLE\b[^}]*\}/);
  });

  test("process projection pins tenant-safe provenance and unique outcomes", () => {
    assert.match(schema, /model GovernanceDecisionProcess \{/);
    for (const field of [
      "proposalId",
      "sourceTensionId",
      "runId",
      "meetingId",
      "sourceTensionArtifactId",
      "proposalArtifactId",
      "routeArtifactId",
      "proposerId",
      "currentRevisionId",
      "recordedById",
      "outcomeRoleId",
      "decisionId",
      "changeLogId",
    ]) {
      assert.match(schema, new RegExp(`\\b${field}\\s+String`));
    }
    assert.match(schema, /proposalId\s+String\s+@unique/);
    assert.match(schema, /outcomeRoleId\s+String\?\s+@unique/);
    assert.match(schema, /decisionId\s+String\?\s+@unique/);
    assert.match(schema, /changeLogId\s+String\?\s+@unique/);
    assert.match(schema, /@@index\(\[organizationId, meetingId, state\]\)/);
  });

  test("revision snapshots are complete and uniquely monotonic", () => {
    assert.match(schema, /model GovernanceProposalRevision \{/);
    for (const field of ["currentStructure", "proposedStructure", "rationale", "expectedImpact"]) {
      assert.match(schema, new RegExp(`\\b${field}\\s+String`));
    }
    assert.match(schema, /typedChange\s+Json/);
    assert.match(schema, /sourceKind\s+GovernanceProposalRevisionSource/);
    assert.match(schema, /@@unique\(\[processId, revision\]\)/);
    assert.match(schema, /@@unique\(\[proposalId, revision\]\)/);
  });

  test("operation ledger owns immutable keys, logical slots, leases, and attempts", () => {
    assert.match(schema, /model GovernanceDecisionOperation \{/);
    assert.match(schema, /processId\s+String\?/);
    assert.match(schema, /mutationKey\s+String/);
    assert.match(schema, /@@unique\(\[organizationId, mutationKey\]\)/);
    assert.match(schema, /canonicalPayloadHash\s+String/);
    assert.match(schema, /attempt\s+Int\s+@default\(1\)/);
    assert.match(schema, /leaseToken\s+String/);
    assert.match(schema, /leaseExpiresAt\s+DateTime/);
    assert.match(schema, /resultEnvelope\s+Json\?/);
    assert.match(schema, /@@unique\(\[organizationId, proposalId, meetingId, revision, operation, operationScope\]\)/);
    assert.match(schema, /@@index\(\[status, leaseExpiresAt\]\)/);
  });

  test("migration enforces deferred current-revision integrity", () => {
    assert.match(migration, /CREATE CONSTRAINT TRIGGER "governance_decision_processes_validate_current_revision"/);
    assert.match(migration, /DEFERRABLE INITIALLY DEFERRED/);
    assert.match(migration, /current revision pointer is required at commit/);
    assert.match(migration, /revision\."organizationId" IS DISTINCT FROM process\."organizationId"/);
    assert.match(migration, /revision\."processId" IS DISTINCT FROM process\."id"/);
    assert.match(migration, /revision\."proposalId" IS DISTINCT FROM process\."proposalId"/);
    assert.match(migration, /revision\."revision" IS DISTINCT FROM process\."currentRevision"/);
  });

  test("migration rejects revision and provenance mutation", () => {
    assert.match(migration, /BEFORE UPDATE OR DELETE ON "governance_proposal_revisions"/);
    assert.match(migration, /governance proposal revisions are append-only/);
    assert.match(migration, /governance decision process provenance is immutable/);
    assert.match(migration, /NEW\."applicationAttempts" = OLD\."applicationAttempts" \+ 1/);
    assert.match(migration, /same-state governance decision process rewrites are forbidden/);
  });

  test("migration constrains operation bindings and status envelopes", () => {
    assert.match(migration, /governance decision operation bindings are immutable/);
    assert.match(migration, /governance decision operations cannot be deleted/);
    assert.match(migration, /new governance decision operations require a fresh processing lease/);
    assert.match(migration, /governance_decision_operations_status_envelope_check/);
  });

  test("migration is additive and contains reviewed reverse SQL", () => {
    assert.match(migration, /ALTER TYPE "InterfaceWorkflowArtifactType" ADD VALUE 'ROLE'/);
    assert.doesNotMatch(migration, /INSERT INTO "governance_decision_processes"/);
    assert.match(migration, /-- Reviewed rollback \(execute in this reverse order\):/);
    assert.match(migration, /-- DROP TABLE "governance_decision_operations"/);
    assert.match(migration, /-- DROP TABLE "governance_proposal_revisions"/);
    assert.match(migration, /-- DROP TABLE "governance_decision_processes"/);
    assert.match(migration, /-- ALTER TYPE "InterfaceWorkflowArtifactType" RENAME TO "InterfaceWorkflowArtifactType_old"/);
  });
});

if (databaseRequired) {
  describe("governance decision PostgreSQL behavior", { concurrency: 1 }, () => {
    let sentinelBefore = "";

    test("database-required mode fails closed without a disposable URL and starts before GD1", () => {
      assert.ok(databaseUrl, "GD1_DATABASE_URL is required when GD1_DB_REQUIRED=1");
      assert.equal(
        query(
          `SELECT concat_ws('|',COALESCE(to_regclass('public.governance_decision_processes')::text,'NULL'),COALESCE(to_regclass('public.governance_proposal_revisions')::text,'NULL'),COALESCE(to_regclass('public.governance_decision_operations')::text,'NULL'))`,
        ),
        "NULL|NULL|NULL",
        "database-required mode must start from the pre-GD1 disposable baseline",
      );
      sentinelBefore = query(
        `SELECT concat_ws('|',"id","organizationId","type","status","tensionId","meetingId") FROM "governance_proposals" WHERE "id"='gd1-proposal'`,
      );
      assert.equal(sentinelBefore, "gd1-proposal|gd1-org|ROLE_CREATED|CANDIDATE|gd1-tension|gd1-meeting");
    });

    test("applies GD1 DDL, preserves the sentinel, and commits initialization pointer wiring", () => {
      const deploy = runCommand("./node_modules/.bin/prisma", ["migrate", "deploy"], {
        ...process.env,
        DATABASE_URL: databaseUrl,
      });
      assert.equal(deploy.status, 0, commandDetails(deploy));
      assert.equal(query(`SELECT count(*) FROM "governance_decision_processes"`), "0");
      assert.equal(
        query(
          `SELECT concat_ws('|',"id","organizationId","type","status","tensionId","meetingId") FROM "governance_proposals" WHERE "id"='gd1-proposal'`,
        ),
        sentinelBefore,
      );
      expectSqlPass(
        "database fixture and initialization",
        `
          BEGIN;
          INSERT INTO "circle_interfaces" (
            "id","organizationId","name","contractContent","sla","acceptanceCriteria","createdAt","updatedAt","fromCircleId","toCircleId","ownerId"
          ) VALUES ('gd1-interface','gd1-org','GD1 Interface','Contract','1 day','Accepted',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'gd1-circle','gd1-circle','gd1-person');
          INSERT INTO "interface_workbenches" ("id","organizationId","interfaceId","draft","draftHash","updatedAt","draftLayout")
          VALUES ('gd1-workbench','gd1-org','gd1-interface','{}'::jsonb,'gd1-draft',CURRENT_TIMESTAMP,'{}'::jsonb);
          INSERT INTO "interface_workbench_versions" (
            "id","organizationId","workbenchId","version","publisherId","sourceSnapshot","compiledSnapshot","validationResult","sourceHash","compiledHash","definitionSchemaVersion","compilerVersion","editorLayout"
          ) VALUES ('gd1-version','gd1-org','gd1-workbench',1,'gd1-person','{}'::jsonb,'{}'::jsonb,'{}'::jsonb,'gd1-source','gd1-compiled',1,'gd1-test','{}'::jsonb);
          INSERT INTO "interface_workflow_runs" ("id","organizationId","workbenchId","versionId","currentNodeId","starterId","createdAt","updatedAt")
          VALUES ('gd1-run','gd1-org','gd1-workbench','gd1-version','governance-route','gd1-person',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP);
          INSERT INTO "governance_proposals" ("id","organizationId","type","proposedChange","rationale","status","createdAt","tensionId","meetingId")
          VALUES ('gd1-edge-proposal','gd1-org','ROLE_CREATED','{}','Edge fixture','CANDIDATE',CURRENT_TIMESTAMP,'gd1-tension','gd1-meeting');
          INSERT INTO "interface_workflow_artifacts" ("id","organizationId","runId","artifactType","artifactId","relation","metadata") VALUES
            ('gd1-source-artifact','gd1-org','gd1-run','TENSION','gd1-tension','source-tension','{}'::jsonb),
            ('gd1-proposal-artifact','gd1-org','gd1-run','GOVERNANCE_PROPOSAL','gd1-edge-proposal','governance-candidate','{}'::jsonb),
            ('gd1-route-artifact','gd1-org','gd1-run','MEETING','gd1-meeting','governance-route','{}'::jsonb);
          INSERT INTO "role_defs" ("id","organizationId","name","purpose","accountabilities","category","createdAt","updatedAt","circleId")
          VALUES ('gd1-outcome-role','gd1-org','Outcome role','Outcome purpose','Outcome accountability','OPERATIONS',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'gd1-circle');
          INSERT INTO "decision_records" ("id","organizationId","title","type","content","rationale","effectiveAt","createdAt","meetingId")
          VALUES ('gd1-outcome-decision','gd1-org','Outcome decision','ROLE_CHANGE','Create role','Governance result',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'gd1-meeting');
          INSERT INTO "change_logs" ("id","organizationId","type","objectDesc","beforeValue","afterValue","impactAssessment","effectiveAt","createdAt","initiatorId","decisionId")
          VALUES ('gd1-outcome-change','gd1-org','ROLE_CREATED','Outcome role','无','Created','Improves delivery',CURRENT_TIMESTAMP,CURRENT_TIMESTAMP,'gd1-person','gd1-outcome-decision');
          INSERT INTO "governance_decision_processes" (
            "id","organizationId","proposalId","sourceTensionId","runId","meetingId","sourceTensionArtifactId","proposalArtifactId","routeArtifactId","proposerId","updatedAt"
          ) VALUES ('gd1-edge-process','gd1-org','gd1-edge-proposal','gd1-tension','gd1-run','gd1-meeting','gd1-source-artifact','gd1-proposal-artifact','gd1-route-artifact','gd1-person',CURRENT_TIMESTAMP);
          INSERT INTO "governance_proposal_revisions" (
            "id","organizationId","processId","proposalId","revision","authoredById","currentStructure","proposedStructure","rationale","expectedImpact","typedChange","sourceKind"
          ) VALUES ('gd1-edge-revision-1','gd1-org','gd1-edge-process','gd1-edge-proposal',1,'gd1-person','Current structure','Proposed role','Rationale','Impact','{"schemaVersion":1,"operation":"ROLE_CREATED","revision":1}'::jsonb,'INITIAL');
          UPDATE "governance_decision_processes" SET "currentRevisionId"='gd1-edge-revision-1',"updatedAt"=CURRENT_TIMESTAMP WHERE "id"='gd1-edge-process';
          COMMIT;
        `,
      );
      assert.equal(
        query(
          `SELECT concat_ws('|',"state","currentRevision","currentRevisionId") FROM "governance_decision_processes" WHERE "id"='gd1-edge-process'`,
        ),
        "READY|1|gd1-edge-revision-1",
      );
    });

    const legalEdges: Array<[string, string]> = [
      [
        "READY to CLARIFICATION_REQUIRED keeps revision",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='CLARIFICATION_REQUIRED',"activeClarification"='{"question":"clarify"}'::jsonb WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "READY to OBJECTION_PENDING keeps revision",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='OBJECTION_PENDING',"activeObjection"='{"harm":"material"}'::jsonb,"activeObjectionSequence"=1 WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "READY to NOT_ADOPTED keeps revision",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='NOT_ADOPTED',"recordedById"='gd1-person',"recordedAt"=CURRENT_TIMESTAMP,"resultNote"='not adopted' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "READY to ADOPTED keeps revision",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='ADOPTED',"recordedById"='gd1-person',"recordedAt"=CURRENT_TIMESTAMP,"resultNote"='adopted',"outcomeRoleId"='gd1-outcome-role',"decisionId"='gd1-outcome-decision',"changeLogId"='gd1-outcome-change' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "CLARIFICATION_REQUIRED to READY authors revision plus one",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='CLARIFICATION_REQUIRED',"activeClarification"='{}'::jsonb WHERE "id"='gd1-edge-process'; ${revisionTwoInsert} UPDATE "governance_decision_processes" SET "state"='READY',"activeClarification"=NULL,"currentRevision"=2,"currentRevisionId"='gd1-edge-revision-2' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "OBJECTION_PENDING to READY keeps revision",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='OBJECTION_PENDING',"activeObjection"='{}'::jsonb,"activeObjectionSequence"=1 WHERE "id"='gd1-edge-process'; UPDATE "governance_decision_processes" SET "state"='READY',"activeObjection"=NULL,"activeObjectionSequence"=NULL WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "OBJECTION_PENDING to AMENDMENT_REQUIRED keeps revision",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='OBJECTION_PENDING',"activeObjection"='{}'::jsonb,"activeObjectionSequence"=1 WHERE "id"='gd1-edge-process'; UPDATE "governance_decision_processes" SET "state"='AMENDMENT_REQUIRED' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "AMENDMENT_REQUIRED to READY authors revision plus one",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='OBJECTION_PENDING',"activeObjection"='{}'::jsonb,"activeObjectionSequence"=1 WHERE "id"='gd1-edge-process'; UPDATE "governance_decision_processes" SET "state"='AMENDMENT_REQUIRED' WHERE "id"='gd1-edge-process'; ${revisionTwoInsert} UPDATE "governance_decision_processes" SET "state"='READY',"activeObjection"=NULL,"activeObjectionSequence"=NULL,"currentRevision"=2,"currentRevisionId"='gd1-edge-revision-2' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "AMENDMENT_REQUIRED to NOT_ADOPTED keeps revision",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='OBJECTION_PENDING',"activeObjection"='{}'::jsonb,"activeObjectionSequence"=1 WHERE "id"='gd1-edge-process'; UPDATE "governance_decision_processes" SET "state"='AMENDMENT_REQUIRED' WHERE "id"='gd1-edge-process'; UPDATE "governance_decision_processes" SET "state"='NOT_ADOPTED',"activeObjection"=NULL,"activeObjectionSequence"=NULL,"recordedById"='gd1-person',"recordedAt"=CURRENT_TIMESTAMP,"resultNote"='not adopted' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "NOT_ADOPTED to READY authors revision plus one",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='NOT_ADOPTED',"recordedById"='gd1-person',"recordedAt"=CURRENT_TIMESTAMP,"resultNote"='not adopted' WHERE "id"='gd1-edge-process'; ${revisionTwoInsert} UPDATE "governance_decision_processes" SET "state"='READY',"recordedById"=NULL,"recordedAt"=NULL,"resultNote"=NULL,"currentRevision"=2,"currentRevisionId"='gd1-edge-revision-2' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "READY technical failure projection increments attempts only",
        `BEGIN; UPDATE "governance_decision_processes" SET "applicationAttempts"="applicationAttempts"+1,"lastApplicationError"='TECHNICAL_FAILURE' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
    ];

    for (const [label, sql] of legalEdges) {
      test(`allows ${label}`, () => {
        expectSqlPass(label, sql);
      });
    }

    const illegalEdges: Array<[string, string]> = [
      [
        "clarification completion without revision plus one",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='CLARIFICATION_REQUIRED',"activeClarification"='{}'::jsonb WHERE "id"='gd1-edge-process'; UPDATE "governance_decision_processes" SET "state"='READY',"activeClarification"=NULL WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "invalid objection assessment with revision plus one",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='OBJECTION_PENDING',"activeObjection"='{}'::jsonb,"activeObjectionSequence"=1 WHERE "id"='gd1-edge-process'; ${revisionTwoInsert} UPDATE "governance_decision_processes" SET "state"='READY',"activeObjection"=NULL,"activeObjectionSequence"=NULL,"currentRevision"=2,"currentRevisionId"='gd1-edge-revision-2' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "same READY state revision increment",
        `BEGIN; ${revisionTwoInsert} UPDATE "governance_decision_processes" SET "currentRevision"=2,"currentRevisionId"='gd1-edge-revision-2' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "same-state clarification projection rewrite",
        `BEGIN; UPDATE "governance_decision_processes" SET "state"='CLARIFICATION_REQUIRED',"activeClarification"='{"question":"a"}'::jsonb WHERE "id"='gd1-edge-process'; UPDATE "governance_decision_processes" SET "activeClarification"='{"question":"b"}'::jsonb WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "non-adoption with revision increment",
        `BEGIN; ${revisionTwoInsert} UPDATE "governance_decision_processes" SET "state"='NOT_ADOPTED',"recordedById"='gd1-person',"recordedAt"=CURRENT_TIMESTAMP,"resultNote"='not adopted',"currentRevision"=2,"currentRevisionId"='gd1-edge-revision-2' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
      [
        "adoption with revision increment",
        `BEGIN; ${revisionTwoInsert} UPDATE "governance_decision_processes" SET "state"='ADOPTED',"recordedById"='gd1-person',"recordedAt"=CURRENT_TIMESTAMP,"outcomeRoleId"='gd1-outcome-role',"decisionId"='gd1-outcome-decision',"changeLogId"='gd1-outcome-change',"currentRevision"=2,"currentRevisionId"='gd1-edge-revision-2' WHERE "id"='gd1-edge-process'; ROLLBACK;`,
      ],
    ];

    for (const [label, sql] of illegalEdges) {
      test(`rejects ${label}`, () => {
        expectSqlReject(label, sql);
      });
    }

    test("rejects terminal success and failure after lease expiry", () => {
      expectSqlPass(
        "insert expiring success operation",
        operationInsert("gd1-expired-success", "expired-success-1", "CURRENT_TIMESTAMP + interval '20 milliseconds'"),
      );
      expectSqlPass("wait for success lease expiry", `SELECT pg_sleep(0.05)`);
      expectSqlReject(
        "expired lease success",
        `UPDATE "governance_decision_operations" SET "status"='SUCCEEDED',"resultEnvelope"='{}'::jsonb WHERE "id"='gd1-expired-success'`,
      );
      expectSqlPass(
        "insert expiring failure operation",
        operationInsert("gd1-expired-failure", "expired-failure-1", "CURRENT_TIMESTAMP + interval '20 milliseconds'"),
      );
      expectSqlPass("wait for failure lease expiry", `SELECT pg_sleep(0.05)`);
      expectSqlReject(
        "expired lease failure",
        `UPDATE "governance_decision_operations" SET "status"='FAILED',"failureCode"='TECHNICAL_FAILURE' WHERE "id"='gd1-expired-failure'`,
      );
    });

    test("allows only rotated-token incremented-attempt future-lease reclaim", () => {
      expectSqlPass(
        "insert valid reclaim operation",
        operationInsert("gd1-reclaim-valid", "reclaim-valid-1", "CURRENT_TIMESTAMP + interval '20 milliseconds'"),
      );
      expectSqlPass("wait for valid reclaim expiry", `SELECT pg_sleep(0.05)`);
      expectSqlPass(
        "valid expired reclaim",
        `UPDATE "governance_decision_operations" SET "leaseToken"='reclaim-valid-2',"attempt"=2,"leaseExpiresAt"=CURRENT_TIMESTAMP + interval '5 minutes' WHERE "id"='gd1-reclaim-valid'`,
      );
      expectSqlPass(
        "insert same-token reclaim operation",
        operationInsert("gd1-reclaim-token", "reclaim-token-1", "CURRENT_TIMESTAMP + interval '20 milliseconds'"),
      );
      expectSqlPass("wait for same-token reclaim expiry", `SELECT pg_sleep(0.05)`);
      expectSqlReject(
        "same-token reclaim",
        `UPDATE "governance_decision_operations" SET "attempt"=2,"leaseExpiresAt"=CURRENT_TIMESTAMP + interval '5 minutes' WHERE "id"='gd1-reclaim-token'`,
      );
      expectSqlPass(
        "insert same-attempt reclaim operation",
        operationInsert("gd1-reclaim-attempt", "reclaim-attempt-1", "CURRENT_TIMESTAMP + interval '20 milliseconds'"),
      );
      expectSqlPass("wait for same-attempt reclaim expiry", `SELECT pg_sleep(0.05)`);
      expectSqlReject(
        "same-attempt reclaim",
        `UPDATE "governance_decision_operations" SET "leaseToken"='reclaim-attempt-2',"leaseExpiresAt"=CURRENT_TIMESTAMP + interval '5 minutes' WHERE "id"='gd1-reclaim-attempt'`,
      );
      expectSqlPass(
        "insert replacement-lease reclaim operation",
        operationInsert("gd1-reclaim-future", "reclaim-future-1", "CURRENT_TIMESTAMP + interval '20 milliseconds'"),
      );
      expectSqlPass("wait for replacement-lease reclaim expiry", `SELECT pg_sleep(0.05)`);
      expectSqlReject(
        "expired replacement lease",
        `UPDATE "governance_decision_operations" SET "leaseToken"='reclaim-future-2',"attempt"=2,"leaseExpiresAt"=CURRENT_TIMESTAMP - interval '1 second' WHERE "id"='gd1-reclaim-future'`,
      );
    });

    test("stale worker cannot finalize after reclaim", () => {
      expectSqlPass(
        "insert stale-worker operation",
        operationInsert("gd1-stale", "stale-1", "CURRENT_TIMESTAMP + interval '20 milliseconds'"),
      );
      expectSqlPass("wait for stale-worker lease expiry", `SELECT pg_sleep(0.05)`);
      expectSqlPass(
        "reclaim stale-worker operation",
        `UPDATE "governance_decision_operations" SET "leaseToken"='stale-2',"attempt"=2,"leaseExpiresAt"=CURRENT_TIMESTAMP + interval '5 minutes' WHERE "id"='gd1-stale'`,
      );
      const result = expectSqlPass(
        "stale worker exclusion",
        `WITH finalized AS (UPDATE "governance_decision_operations" SET "status"='SUCCEEDED',"resultEnvelope"='{}'::jsonb WHERE "id"='gd1-stale' AND "leaseToken"='stale-1' AND "attempt"=1 RETURNING "id") SELECT count(*) FROM finalized`,
      );
      assert.match(result.stdout.trim(), /(^|\n)0$/);
    });

    test("valid current lease can finalize", () => {
      expectSqlPass(
        "insert current-lease operation",
        operationInsert("gd1-current", "current-1", "CURRENT_TIMESTAMP + interval '5 minutes'"),
      );
      const result = expectSqlPass(
        "current lease finalization",
        `UPDATE "governance_decision_operations" SET "status"='SUCCEEDED',"resultEnvelope"='{}'::jsonb WHERE "id"='gd1-current' AND "leaseToken"='current-1' AND "attempt"=1; SELECT "status" FROM "governance_decision_operations" WHERE "id"='gd1-current'`,
      );
      assert.match(result.stdout.trim(), /(^|\n)SUCCEEDED$/);
    });

    test("executes the literal documented extractor to full GD1 absence with sentinel preservation", () => {
      const extractorLine = plan
        .split("\n")
        .find((line) => line.includes("Reviewed rollback") && line.includes("| psql"));
      assert.ok(extractorLine, "implementation plan must contain the literal reviewed rollback extractor pipeline");
      const reverse = runCommand("/bin/bash", ["-o", "pipefail", "-c", extractorLine], {
        ...process.env,
        GD1_DATABASE_URL: databaseUrl,
        GD1_MIGRATION_DIR: migrationDirectory,
      });
      assert.equal(reverse.status, 0, commandDetails(reverse));
      assert.equal(
        query(
          `SELECT concat_ws('|',COALESCE(to_regclass('public.governance_decision_processes')::text,'NULL'),COALESCE(to_regclass('public.governance_proposal_revisions')::text,'NULL'),COALESCE(to_regclass('public.governance_decision_operations')::text,'NULL'),EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='InterfaceWorkflowArtifactType' AND e.enumlabel='ROLE'))`,
        ),
        "NULL|NULL|NULL|f",
      );
      assert.equal(
        query(
          `SELECT concat_ws('|',"id","organizationId","type","status","tensionId","meetingId") FROM "governance_proposals" WHERE "id"='gd1-proposal'`,
        ),
        sentinelBefore,
      );
      expectSqlPass(
        "delete reversed migration record",
        `DELETE FROM "_prisma_migrations" WHERE migration_name='${migrationName}'`,
      );
    });

    test("reapplies GD1 after the documented reverse", () => {
      const deploy = runCommand("./node_modules/.bin/prisma", ["migrate", "deploy"], {
        ...process.env,
        DATABASE_URL: databaseUrl,
      });
      assert.equal(deploy.status, 0, commandDetails(deploy));
      assert.equal(
        query(
          `SELECT concat_ws('|',to_regclass('public.governance_decision_processes'),to_regclass('public.governance_proposal_revisions'),to_regclass('public.governance_decision_operations'),EXISTS(SELECT 1 FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid WHERE t.typname='InterfaceWorkflowArtifactType' AND e.enumlabel='ROLE'),(SELECT count(*) FROM "governance_decision_processes"))`,
        ),
        "governance_decision_processes|governance_proposal_revisions|governance_decision_operations|t|0",
      );
      assert.equal(
        query(
          `SELECT concat_ws('|',"id","organizationId","type","status","tensionId","meetingId") FROM "governance_proposals" WHERE "id"='gd1-proposal'`,
        ),
        sentinelBefore,
      );
    });
  });
}
