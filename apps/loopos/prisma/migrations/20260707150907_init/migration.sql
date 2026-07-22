-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ORG_ADMIN', 'ORG_MEMBER');

-- CreateEnum
CREATE TYPE "CircleNumber" AS ENUM ('ZERO', 'ONE', 'TWO', 'THREE', 'FOUR', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CircleType" AS ENUM ('STRATEGY', 'PRODUCTION', 'INFRA', 'CROSSCUTTING');

-- CreateEnum
CREATE TYPE "CircleStatus" AS ENUM ('NORMAL', 'WARNING', 'HALTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CirclePhase" AS ENUM ('PHASE_0', 'PHASE_1', 'PHASE_2', 'PHASE_3', 'PHASE_4');

-- CreateEnum
CREATE TYPE "RoleOwnershipType" AS ENUM ('HOME', 'SUPPORT', 'CROSSCUTTING');

-- CreateEnum
CREATE TYPE "RoleCategory" AS ENUM ('CIRCLE_LEAD', 'EXPERT', 'OPERATIONS', 'COACH');

-- CreateEnum
CREATE TYPE "RoleStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('UNSIGNED', 'SIGNED', 'STRESS_TESTED');

-- CreateEnum
CREATE TYPE "TensionType" AS ENUM ('PROBLEMATIC', 'CONSTRUCTIVE', 'CLARIFYING');

-- CreateEnum
CREATE TYPE "TensionSource" AS ENUM ('TACTICAL_MEETING', 'GOVERNANCE_MEETING', 'BOT', 'FORM', 'ANONYMOUS_PULSE');

-- CreateEnum
CREATE TYPE "TensionStatus" AS ENUM ('SENSING', 'CONVERTED_TO_BLOCKER', 'CONVERTED_TO_GOVERNANCE', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "ConflictLevel" AS ENUM ('L0', 'L0_5', 'L1', 'L2', 'L3', 'L4');

-- CreateEnum
CREATE TYPE "BlockerStatus" AS ENUM ('OPEN', 'ASSIGNED', 'IN_PROGRESS', 'BLOCKED', 'ESCALATED_L0_5', 'ESCALATED_L2', 'ESCALATED_L3', 'ESCALATED_L4', 'RESOLVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "InterfaceStatus" AS ENUM ('READY', 'DELAYED', 'BLOCKED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "DispatchRight" AS ENUM ('HOME_LEAD', 'CONSUMER_IN_SCOPE');

-- CreateEnum
CREATE TYPE "MetricType" AS ENUM ('LEADING', 'LAGGING');

-- CreateEnum
CREATE TYPE "MetricPhase" AS ENUM ('PHASE_1', 'PHASE_2', 'PHASE_3', 'FINAL');

-- CreateEnum
CREATE TYPE "AchievementStatus" AS ENUM ('ON_TRACK', 'OFF_TRACK', 'AT_RISK');

-- CreateEnum
CREATE TYPE "DecisionType" AS ENUM ('ROLE_CHANGE', 'STRATEGY_CHANGE', 'CIRCLE_STRUCTURE_CHANGE', 'CONFLICT_ADJUDICATION', 'CHARTER_AMENDMENT');

-- CreateEnum
CREATE TYPE "DecisionStatus" AS ENUM ('ACTIVE', 'SUPERSEDED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ChangeType" AS ENUM ('HOME_CHANGE', 'ROLE_CREATED', 'ROLE_MODIFIED', 'ROLE_ARCHIVED', 'CIRCLE_CREATED', 'CIRCLE_MERGED', 'CIRCLE_SPLIT');

-- CreateEnum
CREATE TYPE "MeetingType" AS ENUM ('TACTICAL', 'GOVERNANCE', 'STRATEGY');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "image" TEXT,
    "emailVerified" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'ORG_MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circles" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "number" "CircleNumber" NOT NULL,
    "type" "CircleType" NOT NULL,
    "purpose" TEXT NOT NULL,
    "domain" TEXT,
    "status" "CircleStatus" NOT NULL DEFAULT 'NORMAL',
    "phase" "CirclePhase" NOT NULL DEFAULT 'PHASE_0',
    "groupChatId" TEXT,
    "tacticalCadence" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "parentId" TEXT,
    "leadPersonId" TEXT,

    CONSTRAINT "circles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_defs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "domain" TEXT,
    "accountabilities" TEXT NOT NULL,
    "ownershipType" "RoleOwnershipType" NOT NULL DEFAULT 'HOME',
    "category" "RoleCategory" NOT NULL,
    "status" "RoleStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "circleId" TEXT NOT NULL,
    "contractId" TEXT,

    CONSTRAINT "role_defs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "people" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "userId" TEXT,
    "homeCircleId" TEXT NOT NULL,
    "cardStatus" "CardStatus" NOT NULL DEFAULT 'UNSIGNED',
    "signedAt" TIMESTAMP(3),
    "cardAttachment" TEXT,
    "adminHome" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "people_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tensions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "type" "TensionType" NOT NULL,
    "source" "TensionSource" NOT NULL,
    "status" "TensionStatus" NOT NULL DEFAULT 'SENSING',
    "conflictLevel" "ConflictLevel",
    "aiTranslation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "raiserId" TEXT NOT NULL,

    CONSTRAINT "tensions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blockers" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL,
    "status" "BlockerStatus" NOT NULL DEFAULT 'OPEN',
    "rootCause" TEXT,
    "newDeadline" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),
    "deadline" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "consecutiveMissed" INTEGER NOT NULL DEFAULT 0,
    "circleId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "sourceTensionId" TEXT,
    "interfaceDependencyId" TEXT,

    CONSTRAINT "blockers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "circle_interfaces" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contractContent" TEXT NOT NULL,
    "sla" TEXT NOT NULL,
    "acceptanceCriteria" TEXT NOT NULL,
    "status" "InterfaceStatus" NOT NULL DEFAULT 'READY',
    "dispatchRight" "DispatchRight" NOT NULL DEFAULT 'HOME_LEAD',
    "supportScope" TEXT,
    "nextDeliveryAt" TIMESTAMP(3),
    "recentDelayRootCause" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fromCircleId" TEXT NOT NULL,
    "toCircleId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "circle_interfaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metrics" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "MetricType" NOT NULL,
    "phase" "MetricPhase" NOT NULL,
    "targetValue" TEXT NOT NULL,
    "actualValue" TEXT,
    "status" "AchievementStatus" NOT NULL DEFAULT 'AT_RISK',
    "dataSource" TEXT,
    "milestone" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "circleId" TEXT NOT NULL,

    CONSTRAINT "metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decision_records" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "DecisionType" NOT NULL,
    "content" TEXT NOT NULL,
    "rationale" TEXT NOT NULL,
    "status" "DecisionStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decisionMakerId" TEXT,
    "meetingId" TEXT,
    "supersededById" TEXT,

    CONSTRAINT "decision_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "change_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "type" "ChangeType" NOT NULL,
    "objectDesc" TEXT NOT NULL,
    "beforeValue" TEXT NOT NULL,
    "afterValue" TEXT NOT NULL,
    "impactAssessment" TEXT NOT NULL,
    "effectiveAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "initiatorId" TEXT NOT NULL,
    "decisionId" TEXT,

    CONSTRAINT "change_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "meetings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "MeetingType" NOT NULL,
    "agenda" TEXT NOT NULL,
    "notes" TEXT,
    "aiGuardReport" TEXT,
    "durationMin" INTEGER NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "circleId" TEXT,

    CONSTRAINT "meetings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_tokens" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "_TensionCircle" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_TensionCircle_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_PersonRoles" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_PersonRoles_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_DecisionForBlocker" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DecisionForBlocker_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_InterfaceSupportPerson" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_InterfaceSupportPerson_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_DecisionFromTension" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_DecisionFromTension_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateTable
CREATE TABLE "_MeetingToPerson" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MeetingToPerson_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_userId_organizationId_key" ON "memberships"("userId", "organizationId");

-- CreateIndex
CREATE INDEX "circles_organizationId_idx" ON "circles"("organizationId");

-- CreateIndex
CREATE INDEX "role_defs_organizationId_circleId_idx" ON "role_defs"("organizationId", "circleId");

-- CreateIndex
CREATE UNIQUE INDEX "people_userId_key" ON "people"("userId");

-- CreateIndex
CREATE INDEX "people_organizationId_homeCircleId_idx" ON "people"("organizationId", "homeCircleId");

-- CreateIndex
CREATE UNIQUE INDEX "people_organizationId_userId_key" ON "people"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "tensions_organizationId_status_idx" ON "tensions"("organizationId", "status");

-- CreateIndex
CREATE INDEX "blockers_organizationId_status_idx" ON "blockers"("organizationId", "status");

-- CreateIndex
CREATE INDEX "blockers_organizationId_ownerId_idx" ON "blockers"("organizationId", "ownerId");

-- CreateIndex
CREATE INDEX "circle_interfaces_organizationId_status_idx" ON "circle_interfaces"("organizationId", "status");

-- CreateIndex
CREATE INDEX "metrics_organizationId_circleId_idx" ON "metrics"("organizationId", "circleId");

-- CreateIndex
CREATE UNIQUE INDEX "decision_records_supersededById_key" ON "decision_records"("supersededById");

-- CreateIndex
CREATE INDEX "decision_records_organizationId_status_idx" ON "decision_records"("organizationId", "status");

-- CreateIndex
CREATE INDEX "change_logs_organizationId_type_idx" ON "change_logs"("organizationId", "type");

-- CreateIndex
CREATE INDEX "meetings_organizationId_startedAt_idx" ON "meetings"("organizationId", "startedAt");

-- CreateIndex
CREATE INDEX "notifications_recipientId_readAt_idx" ON "notifications"("recipientId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_provider_providerAccountId_key" ON "accounts"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_sessionToken_key" ON "sessions"("sessionToken");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_token_key" ON "verification_tokens"("token");

-- CreateIndex
CREATE UNIQUE INDEX "verification_tokens_identifier_token_key" ON "verification_tokens"("identifier", "token");

-- CreateIndex
CREATE INDEX "_TensionCircle_B_index" ON "_TensionCircle"("B");

-- CreateIndex
CREATE INDEX "_PersonRoles_B_index" ON "_PersonRoles"("B");

-- CreateIndex
CREATE INDEX "_DecisionForBlocker_B_index" ON "_DecisionForBlocker"("B");

-- CreateIndex
CREATE INDEX "_InterfaceSupportPerson_B_index" ON "_InterfaceSupportPerson"("B");

-- CreateIndex
CREATE INDEX "_DecisionFromTension_B_index" ON "_DecisionFromTension"("B");

-- CreateIndex
CREATE INDEX "_MeetingToPerson_B_index" ON "_MeetingToPerson"("B");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circles" ADD CONSTRAINT "circles_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "circles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circles" ADD CONSTRAINT "circles_leadPersonId_fkey" FOREIGN KEY ("leadPersonId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circles" ADD CONSTRAINT "circles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_defs" ADD CONSTRAINT "role_defs_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_defs" ADD CONSTRAINT "role_defs_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "circle_interfaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_defs" ADD CONSTRAINT "role_defs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_homeCircleId_fkey" FOREIGN KEY ("homeCircleId") REFERENCES "circles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "people" ADD CONSTRAINT "people_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tensions" ADD CONSTRAINT "tensions_raiserId_fkey" FOREIGN KEY ("raiserId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tensions" ADD CONSTRAINT "tensions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_sourceTensionId_fkey" FOREIGN KEY ("sourceTensionId") REFERENCES "tensions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_interfaceDependencyId_fkey" FOREIGN KEY ("interfaceDependencyId") REFERENCES "circle_interfaces"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blockers" ADD CONSTRAINT "blockers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circle_interfaces" ADD CONSTRAINT "circle_interfaces_fromCircleId_fkey" FOREIGN KEY ("fromCircleId") REFERENCES "circles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circle_interfaces" ADD CONSTRAINT "circle_interfaces_toCircleId_fkey" FOREIGN KEY ("toCircleId") REFERENCES "circles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circle_interfaces" ADD CONSTRAINT "circle_interfaces_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "circle_interfaces" ADD CONSTRAINT "circle_interfaces_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metrics" ADD CONSTRAINT "metrics_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_decisionMakerId_fkey" FOREIGN KEY ("decisionMakerId") REFERENCES "people"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "meetings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "decision_records" ADD CONSTRAINT "decision_records_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "people"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "decision_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "change_logs" ADD CONSTRAINT "change_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "circles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "meetings" ADD CONSTRAINT "meetings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_tokens" ADD CONSTRAINT "verification_tokens_identifier_fkey" FOREIGN KEY ("identifier") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TensionCircle" ADD CONSTRAINT "_TensionCircle_A_fkey" FOREIGN KEY ("A") REFERENCES "circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_TensionCircle" ADD CONSTRAINT "_TensionCircle_B_fkey" FOREIGN KEY ("B") REFERENCES "tensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonRoles" ADD CONSTRAINT "_PersonRoles_A_fkey" FOREIGN KEY ("A") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_PersonRoles" ADD CONSTRAINT "_PersonRoles_B_fkey" FOREIGN KEY ("B") REFERENCES "role_defs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionForBlocker" ADD CONSTRAINT "_DecisionForBlocker_A_fkey" FOREIGN KEY ("A") REFERENCES "blockers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionForBlocker" ADD CONSTRAINT "_DecisionForBlocker_B_fkey" FOREIGN KEY ("B") REFERENCES "decision_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InterfaceSupportPerson" ADD CONSTRAINT "_InterfaceSupportPerson_A_fkey" FOREIGN KEY ("A") REFERENCES "circle_interfaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_InterfaceSupportPerson" ADD CONSTRAINT "_InterfaceSupportPerson_B_fkey" FOREIGN KEY ("B") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionFromTension" ADD CONSTRAINT "_DecisionFromTension_A_fkey" FOREIGN KEY ("A") REFERENCES "decision_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_DecisionFromTension" ADD CONSTRAINT "_DecisionFromTension_B_fkey" FOREIGN KEY ("B") REFERENCES "tensions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MeetingToPerson" ADD CONSTRAINT "_MeetingToPerson_A_fkey" FOREIGN KEY ("A") REFERENCES "meetings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MeetingToPerson" ADD CONSTRAINT "_MeetingToPerson_B_fkey" FOREIGN KEY ("B") REFERENCES "people"("id") ON DELETE CASCADE ON UPDATE CASCADE;
