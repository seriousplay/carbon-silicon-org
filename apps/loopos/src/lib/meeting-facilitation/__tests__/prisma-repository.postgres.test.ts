import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { Pool } from "pg";

import { buildMeetingContext, createPrismaMeetingContextLoader } from "../context-builder";
import { createPrismaMeetingFacilitationRepository } from "../prisma-repository";
import { createMeetingFacilitationService } from "../service";

const databaseUrl = process.env.MEETING_FACILITATION_DATABASE_URL;

if (!databaseUrl) {
  test("meeting facilitation PostgreSQL integration", { skip: "MEETING_FACILITATION_DATABASE_URL is not set" }, () => {});
} else {
  describe("meeting facilitation PostgreSQL repository", { concurrency: 1 }, () => {
    const pool = new Pool({ connectionString: databaseUrl });
    const prisma = new PrismaClient({ adapter: new PrismaPg(pool, { schema: "public" }) });
    const service = createMeetingFacilitationService(createPrismaMeetingFacilitationRepository(prisma));
    let organizationId = "";
    let otherOrganizationId = "";

    before(async () => {
      await prisma.$connect();
    });

    after(async () => {
      if (organizationId) await prisma.organization.deleteMany({ where: { id: organizationId } });
      if (otherOrganizationId) await prisma.organization.deleteMany({ where: { id: otherOrganizationId } });
      await prisma.$disconnect();
      await pool.end();
    });

    test("enforces tenant, participant, represented-role, cursor and optimistic concurrency boundaries", async () => {
      const fixture = await createOrganizationFixture(prisma, "primary");
      const other = await createOrganizationFixture(prisma, "other");
      organizationId = fixture.organizationId;
      otherOrganizationId = other.organizationId;

      await assert.rejects(
        service.initialize({
          organizationId: other.organizationId,
          meetingId: fixture.meetingId,
          actorPersonId: other.alicePersonId,
          representations: [],
        }),
        /MEETING_NOT_AVAILABLE_TO_ACTOR/,
      );

      await assert.rejects(
        service.initialize({
          organizationId: fixture.organizationId,
          meetingId: fixture.meetingId,
          actorPersonId: fixture.outsiderPersonId,
          representations: fixture.representations,
        }),
        /MEETING_NOT_AVAILABLE_TO_ACTOR/,
      );

      await assert.rejects(
        service.initialize({
          organizationId: fixture.organizationId,
          meetingId: fixture.invalidRoleMeetingId,
          actorPersonId: fixture.alicePersonId,
          representations: [
            { participantId: fixture.invalidAliceParticipantId, roleIds: [fixture.bobRoleId] },
            { participantId: fixture.invalidBobParticipantId, roleIds: [fixture.bobRoleId] },
          ],
        }),
        /ROLE_NOT_ASSIGNED_TO_PARTICIPANT/,
      );
      assert.equal(
        await prisma.meetingFacilitationSession.count({
          where: { organizationId: fixture.organizationId, meetingId: fixture.invalidRoleMeetingId },
        }),
        0,
      );

      const initialized = await service.initialize({
        organizationId: fixture.organizationId,
        meetingId: fixture.meetingId,
        actorPersonId: fixture.alicePersonId,
        representations: fixture.representations,
      });
      assert.equal(initialized.state.engine, "TACTICAL");
      assert.equal(
        await prisma.meetingRoleRepresentation.count({
          where: { organizationId: fixture.organizationId, meetingId: fixture.meetingId },
        }),
        3,
      );
      const context = await buildMeetingContext(
        {
          organizationId: fixture.organizationId,
          meetingId: fixture.meetingId,
          actorPersonId: fixture.alicePersonId,
        },
        createPrismaMeetingContextLoader(prisma),
      );
      assert.equal(context.engine, "TACTICAL");
      assert.equal(context.facts.filter((fact) => fact.ref.startsWith("represented-role:")).length, 3);
      assert.ok(context.facts.every((fact) => fact.ref.length > 0));

      const concurrent = await Promise.allSettled([
        service.execute({
          organizationId: fixture.organizationId,
          meetingId: fixture.meetingId,
          actorPersonId: fixture.alicePersonId,
          expectedRevision: 0,
          command: { type: "START" },
        }),
        service.execute({
          organizationId: fixture.organizationId,
          meetingId: fixture.meetingId,
          actorPersonId: fixture.bobPersonId,
          expectedRevision: 0,
          command: { type: "START" },
        }),
      ]);
      assert.equal(concurrent.filter((result) => result.status === "fulfilled").length, 1);
      assert.equal(concurrent.filter((result) => result.status === "rejected").length, 1);

      const snapshot = await service.getSnapshot({
        organizationId: fixture.organizationId,
        meetingId: fixture.meetingId,
        actorPersonId: fixture.alicePersonId,
      });
      assert.equal(snapshot.state.revision, 1);
      assert.equal(snapshot.state.phase, "CHECK_IN");
      assert.equal(snapshot.lastEventSequence, 2);
      const events = await service.listEvents({
        organizationId: fixture.organizationId,
        meetingId: fixture.meetingId,
        actorPersonId: fixture.alicePersonId,
        after: 0,
      });
      assert.deepEqual(events.map((event) => event.sequence), [1, 2]);
      assert.deepEqual(events.map((event) => event.type), ["SESSION_INITIALIZED", "PHASE_CHANGED"]);
      assert.equal(
        await prisma.meetingFacilitationSession.count({ where: { organizationId: other.organizationId } }),
        0,
      );
    });
  });
}

async function createOrganizationFixture(prisma: PrismaClient, label: string) {
  const suffix = randomUUID();
  const organization = await prisma.organization.create({
    data: { name: `Meeting ${label} ${suffix}`, slug: `meeting-${label}-${suffix}` },
  });
  const circle = await prisma.circle.create({
    data: {
      organizationId: organization.id,
      name: "Root",
      number: "ZERO",
      type: "STRATEGY",
      purpose: "Meeting facilitation integration fixture",
    },
  });
  const [alice, bob, outsider] = await Promise.all([
    prisma.person.create({
      data: { organizationId: organization.id, name: "Alice", homeCircleId: circle.id },
    }),
    prisma.person.create({
      data: { organizationId: organization.id, name: "Bob", homeCircleId: circle.id },
    }),
    prisma.person.create({
      data: { organizationId: organization.id, name: "Outsider", homeCircleId: circle.id },
    }),
  ]);
  const [aliceRole, aliceSecondaryRole, bobRole] = await Promise.all([
    prisma.roleDef.create({
      data: {
        organizationId: organization.id,
        circleId: circle.id,
        name: "Product",
        purpose: "Own product",
        accountabilities: "Maintain product",
        category: "EXPERT",
        assignees: { connect: { id: alice.id } },
      },
    }),
    prisma.roleDef.create({
      data: {
        organizationId: organization.id,
        circleId: circle.id,
        name: "Research",
        purpose: "Own research",
        accountabilities: "Maintain research",
        category: "EXPERT",
        assignees: { connect: { id: alice.id } },
      },
    }),
    prisma.roleDef.create({
      data: {
        organizationId: organization.id,
        circleId: circle.id,
        name: "Data",
        purpose: "Own data",
        accountabilities: "Maintain data",
        category: "EXPERT",
        assignees: { connect: { id: bob.id } },
      },
    }),
  ]);
  const meeting = await createMeeting(prisma, organization.id, circle.id, [alice.id, bob.id], `Valid ${label}`);
  const invalidMeeting = await createMeeting(prisma, organization.id, circle.id, [alice.id, bob.id], `Invalid ${label}`);
  const [aliceParticipant, bobParticipant, invalidAliceParticipant, invalidBobParticipant] = await Promise.all([
    prisma.meetingParticipant.create({
      data: { organizationId: organization.id, meetingId: meeting.id, personId: alice.id, status: "ONLINE" },
    }),
    prisma.meetingParticipant.create({
      data: { organizationId: organization.id, meetingId: meeting.id, personId: bob.id, status: "ONLINE" },
    }),
    prisma.meetingParticipant.create({
      data: { organizationId: organization.id, meetingId: invalidMeeting.id, personId: alice.id, status: "ONLINE" },
    }),
    prisma.meetingParticipant.create({
      data: { organizationId: organization.id, meetingId: invalidMeeting.id, personId: bob.id, status: "ONLINE" },
    }),
  ]);
  return {
    organizationId: organization.id,
    meetingId: meeting.id,
    invalidRoleMeetingId: invalidMeeting.id,
    alicePersonId: alice.id,
    bobPersonId: bob.id,
    outsiderPersonId: outsider.id,
    aliceRoleId: aliceRole.id,
    bobRoleId: bobRole.id,
    invalidAliceParticipantId: invalidAliceParticipant.id,
    invalidBobParticipantId: invalidBobParticipant.id,
    representations: [
      { participantId: aliceParticipant.id, roleIds: [aliceRole.id, aliceSecondaryRole.id] },
      { participantId: bobParticipant.id, roleIds: [bobRole.id] },
    ],
  };
}

async function createMeeting(
  prisma: PrismaClient,
  organizationId: string,
  circleId: string,
  personIds: readonly string[],
  title: string,
) {
  return prisma.meeting.create({
    data: {
      organizationId,
      circleId,
      title,
      type: "TACTICAL",
      agenda: "Integration fixture",
      durationMin: 30,
      startedAt: new Date(),
      participants: { connect: personIds.map((id) => ({ id })) },
    },
  });
}
