BEGIN;

CREATE TYPE "MemoryCandidateStatus" AS ENUM (
  'DRAFT',
  'SUBMITTED',
  'CONFIRMED',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TYPE "MemoryCandidateAuthorityRouteKind" AS ENUM (
  'GOAL_STRATEGY',
  'GOVERNANCE',
  'TACTICAL',
  'MEETING_RECORD',
  'TENSION'
);

CREATE TYPE "MemoryCandidateAuditEventType" AS ENUM (
  'CREATED',
  'SUBMITTED',
  'CONFIRMED',
  'REJECTED',
  'SUPERSEDED'
);

CREATE TABLE "memory_candidates" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "ownerPersonId" TEXT NOT NULL,
  "claim" TEXT NOT NULL,
  "rationale" TEXT NOT NULL,
  "sourceRefs" JSONB NOT NULL,
  "authorityRouteKind" "MemoryCandidateAuthorityRouteKind" NOT NULL,
  "authorityRouteLabel" TEXT NOT NULL,
  "authorityRouteUrl" TEXT NOT NULL,
  "status" "MemoryCandidateStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedBy" JSONB,
  "confirmedBy" JSONB,
  "supersededBy" JSONB,
  "validFrom" TIMESTAMP(3),
  "validUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "memory_candidates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memory_candidates_id_organization_key" UNIQUE ("id", "organizationId"),
  CONSTRAINT "memory_candidates_content_check" CHECK (
    btrim("claim") <> ''
    AND btrim("rationale") <> ''
    AND jsonb_typeof("sourceRefs") = 'array'
    AND jsonb_array_length("sourceRefs") > 0
    AND btrim("authorityRouteLabel") <> ''
    AND "authorityRouteUrl" LIKE '/app/%'
  ),
  CONSTRAINT "memory_candidates_lifecycle_check" CHECK (
    (
      "status" = 'DRAFT'
      AND "submittedBy" IS NULL
      AND "confirmedBy" IS NULL
      AND "supersededBy" IS NULL
      AND "validFrom" IS NULL
      AND "validUntil" IS NULL
    )
    OR (
      "status" = 'SUBMITTED'
      AND "submittedBy" IS NOT NULL
      AND "confirmedBy" IS NULL
      AND "supersededBy" IS NULL
      AND "validFrom" IS NULL
      AND "validUntil" IS NULL
    )
    OR (
      "status" = 'CONFIRMED'
      AND "submittedBy" IS NOT NULL
      AND "confirmedBy" IS NOT NULL
      AND "supersededBy" IS NULL
      AND "validFrom" IS NOT NULL
      AND ("validUntil" IS NULL OR "validUntil" > "validFrom")
    )
    OR (
      "status" = 'REJECTED'
      AND "submittedBy" IS NOT NULL
      AND "confirmedBy" IS NULL
      AND "supersededBy" IS NULL
      AND "validFrom" IS NULL
      AND "validUntil" IS NULL
    )
    OR (
      "status" = 'SUPERSEDED'
      AND "submittedBy" IS NOT NULL
      AND "confirmedBy" IS NOT NULL
      AND "supersededBy" IS NOT NULL
      AND "validFrom" IS NOT NULL
    )
  ),
  CONSTRAINT "memory_candidates_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "memory_candidates_owner_fkey"
    FOREIGN KEY ("ownerPersonId", "organizationId") REFERENCES "people"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "memory_candidate_audit_events" (
  "id" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "candidateId" TEXT NOT NULL,
  "type" "MemoryCandidateAuditEventType" NOT NULL,
  "actor" JSONB NOT NULL,
  "reason" TEXT,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "memory_candidate_audit_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "memory_candidate_audit_events_actor_check" CHECK (jsonb_typeof("actor") = 'object'),
  CONSTRAINT "memory_candidate_audit_events_organization_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "memory_candidate_audit_events_candidate_fkey"
    FOREIGN KEY ("candidateId", "organizationId") REFERENCES "memory_candidates"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "memory_candidates_owner_status_updated_idx"
  ON "memory_candidates"("organizationId", "ownerPersonId", "status", "updatedAt");
CREATE INDEX "memory_candidates_route_status_updated_idx"
  ON "memory_candidates"("organizationId", "authorityRouteKind", "status", "updatedAt");
CREATE INDEX "memory_candidate_audit_events_candidate_occurred_idx"
  ON "memory_candidate_audit_events"("organizationId", "candidateId", "occurredAt");

CREATE FUNCTION memory_candidates_prevent_closed_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" IN ('CONFIRMED', 'REJECTED', 'SUPERSEDED') THEN
    IF OLD."status" = 'CONFIRMED'
      AND NEW."status" = 'SUPERSEDED'
      AND OLD."organizationId" IS NOT DISTINCT FROM NEW."organizationId"
      AND OLD."ownerPersonId" IS NOT DISTINCT FROM NEW."ownerPersonId"
      AND OLD."claim" IS NOT DISTINCT FROM NEW."claim"
      AND OLD."rationale" IS NOT DISTINCT FROM NEW."rationale"
      AND OLD."sourceRefs" IS NOT DISTINCT FROM NEW."sourceRefs"
      AND OLD."authorityRouteKind" IS NOT DISTINCT FROM NEW."authorityRouteKind"
      AND OLD."authorityRouteLabel" IS NOT DISTINCT FROM NEW."authorityRouteLabel"
      AND OLD."authorityRouteUrl" IS NOT DISTINCT FROM NEW."authorityRouteUrl"
      AND OLD."submittedBy" IS NOT DISTINCT FROM NEW."submittedBy"
      AND OLD."confirmedBy" IS NOT DISTINCT FROM NEW."confirmedBy"
      AND NEW."supersededBy" IS NOT NULL
      AND OLD."validFrom" IS NOT DISTINCT FROM NEW."validFrom"
      AND OLD."validUntil" IS NOT DISTINCT FROM NEW."validUntil"
      AND OLD."createdAt" IS NOT DISTINCT FROM NEW."createdAt"
    THEN
      RETURN NEW;
    END IF;

    IF OLD."organizationId" IS DISTINCT FROM NEW."organizationId"
      OR OLD."ownerPersonId" IS DISTINCT FROM NEW."ownerPersonId"
      OR OLD."claim" IS DISTINCT FROM NEW."claim"
      OR OLD."rationale" IS DISTINCT FROM NEW."rationale"
      OR OLD."sourceRefs" IS DISTINCT FROM NEW."sourceRefs"
      OR OLD."authorityRouteKind" IS DISTINCT FROM NEW."authorityRouteKind"
      OR OLD."authorityRouteLabel" IS DISTINCT FROM NEW."authorityRouteLabel"
      OR OLD."authorityRouteUrl" IS DISTINCT FROM NEW."authorityRouteUrl"
      OR OLD."submittedBy" IS DISTINCT FROM NEW."submittedBy"
      OR OLD."confirmedBy" IS DISTINCT FROM NEW."confirmedBy"
      OR OLD."supersededBy" IS DISTINCT FROM NEW."supersededBy"
      OR OLD."validFrom" IS DISTINCT FROM NEW."validFrom"
      OR OLD."validUntil" IS DISTINCT FROM NEW."validUntil"
      OR OLD."createdAt" IS DISTINCT FROM NEW."createdAt"
      OR OLD."updatedAt" IS DISTINCT FROM NEW."updatedAt"
    THEN
      RAISE EXCEPTION 'closed memory candidate rows are immutable';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER memory_candidates_prevent_closed_mutation
BEFORE UPDATE ON "memory_candidates"
FOR EACH ROW
EXECUTE FUNCTION memory_candidates_prevent_closed_mutation();

CREATE FUNCTION memory_candidate_audit_events_prevent_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'memory candidate audit event rows are immutable';
END;
$$;

CREATE TRIGGER memory_candidate_audit_events_prevent_mutation
BEFORE UPDATE OR DELETE ON "memory_candidate_audit_events"
FOR EACH ROW
EXECUTE FUNCTION memory_candidate_audit_events_prevent_mutation();

REVOKE ALL ON TABLE "memory_candidates" FROM PUBLIC;
REVOKE ALL ON TABLE "memory_candidate_audit_events" FROM PUBLIC;

COMMIT;
