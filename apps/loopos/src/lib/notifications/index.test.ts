import assert from "node:assert/strict";
import test from "node:test";
import {
  createNotification,
  notificationIdForEvent,
  notifyMeetingParticipants,
  notifyOutcomeAssignment,
  type NotificationClient,
} from "./index";
import {
  reconcileCommitmentNotificationsForOrg,
  type CommitmentReconciliationClient,
} from "./reconcile";

type StoredNotification = {
  id: string;
  organizationId: string;
  recipientId: string;
  type: string;
  title: string;
  body: string;
  targetUrl?: string;
};

type StoredCommitment = {
  id: string;
  organizationId: string;
  title: string;
  deadline: Date | null;
  ownerId: string | null;
  status: string;
};

class FakeNotificationClient implements CommitmentReconciliationClient {
  readonly people = new Map<string, string>();
  readonly notifications = new Map<string, StoredNotification>();
  readonly commitments: StoredCommitment[] = [];

  person = {
    findFirst: async (args: {
      where: { id: string; organizationId: string };
      select: { id: true };
    }) => {
      void args.select;
      return this.people.get(args.where.id) === args.where.organizationId
        ? { id: args.where.id }
        : null;
    },
  };

  notification = {
    createMany: async (args: {
      data: StoredNotification[];
      skipDuplicates: true;
    }) => {
      void args.skipDuplicates;
      let count = 0;
      for (const notification of args.data) {
        if (this.notifications.has(notification.id)) continue;
        this.notifications.set(notification.id, notification);
        count += 1;
      }
      return { count };
    },
  };

  tension = {
    findMany: async (args: {
      where: {
        organizationId: string;
        ownerId: { not: null };
        deadline: { not: null; lte: Date };
        status: { notIn: string[] };
      };
      select: {
        id: true;
        organizationId: true;
        title: true;
        deadline: true;
        ownerId: true;
      };
    }) => {
      void args.select;
      return this.commitments
        .filter((commitment) =>
          commitment.organizationId === args.where.organizationId
          && commitment.ownerId !== null
          && commitment.deadline !== null
          && commitment.deadline <= args.where.deadline.lte
          && !args.where.status.notIn.includes(commitment.status))
        .map((commitment) => ({
          id: commitment.id,
          organizationId: commitment.organizationId,
          title: commitment.title,
          deadline: commitment.deadline,
          ownerId: commitment.ownerId,
        }));
    },
  };
}

test("event identity deduplicates exact replays without broad type throttling", async () => {
  const client = new FakeNotificationClient();
  client.people.set("person-a", "org-a");
  const base = {
    organizationId: "org-a",
    recipientId: "person-a",
    type: "outcome_assigned" as const,
    title: "Assigned",
    body: "Act now",
    targetUrl: "/app/tracker/action-a",
  };

  assert.equal(await createNotification({ ...base, eventKey: "assignment:a" }, client), true);
  assert.equal(await createNotification({ ...base, eventKey: "assignment:a" }, client), false);
  assert.equal(await createNotification({ ...base, eventKey: "assignment:b" }, client), true);
  assert.equal(client.notifications.size, 2);
  assert.notEqual(
    notificationIdForEvent({ ...base, eventKey: "assignment:a" }),
    notificationIdForEvent({ ...base, eventKey: "assignment:b" }),
  );
});

test("notification creation rejects a recipient outside the organization", async () => {
  const client = new FakeNotificationClient();
  client.people.set("person-b", "org-b");

  await assert.rejects(
    createNotification({
      organizationId: "org-a",
      recipientId: "person-b",
      type: "meeting_participation",
      eventKey: "meeting:m1:participant:person-b",
      title: "Meeting",
      body: "Join",
      targetUrl: "/app/meetings/m1",
    }, client),
    /不属于当前组织/,
  );
  assert.equal(client.notifications.size, 0);
});

test("meeting participation and tactical assignment use exact executable targets", async () => {
  const client = new FakeNotificationClient();
  client.people.set("actor", "org-a");
  client.people.set("participant", "org-a");
  client.people.set("owner", "org-a");

  await notifyMeetingParticipants({
    organizationId: "org-a",
    meetingId: "meeting-a",
    meetingTitle: "Weekly tactical",
    startedAt: new Date("2026-07-14T01:00:00.000Z"),
    recipientIds: ["actor", "participant", "participant"],
    actorId: "actor",
    client,
  });
  await notifyOutcomeAssignment({
    organizationId: "org-a",
    proposalId: "proposal-project",
    outcomeKind: "PROJECT",
    outcomeId: "project-a",
    title: "Ship pilot",
    recipientId: "owner",
    client,
  });
  await notifyOutcomeAssignment({
    organizationId: "org-a",
    proposalId: "proposal-action",
    outcomeKind: "ACTION",
    outcomeId: "action-a",
    title: "Confirm data",
    recipientId: "owner",
    client,
  });

  const targets = [...client.notifications.values()].map((notification) => notification.targetUrl).sort();
  assert.deepEqual(targets, [
    "/app/meetings/meeting-a",
    "/app/projects/project-a",
    "/app/tracker/action-a",
  ]);
  assert.equal([...client.notifications.values()].some((notification) => notification.recipientId === "actor"), false);
});

test("commitment reconciliation is tenant-scoped and creates approaching then overdue events once", async () => {
  const client = new FakeNotificationClient();
  client.people.set("owner-a", "org-a");
  client.people.set("owner-b", "org-b");
  const now = new Date("2026-07-13T12:00:00.000Z");
  client.commitments.push(
    { id: "approaching", organizationId: "org-a", title: "Approaching", deadline: new Date("2026-07-13T13:00:00.000Z"), ownerId: "owner-a", status: "ASSIGNED" },
    { id: "overdue", organizationId: "org-a", title: "Overdue", deadline: new Date("2026-07-13T11:00:00.000Z"), ownerId: "owner-a", status: "IN_PROGRESS" },
    { id: "future", organizationId: "org-a", title: "Future", deadline: new Date("2026-07-14T13:00:00.000Z"), ownerId: "owner-a", status: "ASSIGNED" },
    { id: "other-org", organizationId: "org-b", title: "Other", deadline: new Date("2026-07-13T11:00:00.000Z"), ownerId: "owner-b", status: "ASSIGNED" },
  );

  assert.deepEqual(await reconcileCommitmentNotificationsForOrg("org-a", { now, client }), { candidates: 2, created: 2 });
  assert.deepEqual(await reconcileCommitmentNotificationsForOrg("org-a", { now, client }), { candidates: 2, created: 0 });
  assert.deepEqual(
    await reconcileCommitmentNotificationsForOrg("org-a", { now: new Date("2026-07-13T14:00:00.000Z"), client }),
    { candidates: 3, created: 2 },
  );

  const notifications = [...client.notifications.values()];
  assert.equal(notifications.length, 4);
  assert.equal(notifications.every((notification) => notification.organizationId === "org-a" && notification.recipientId === "owner-a"), true);
  assert.deepEqual(notifications.map((notification) => notification.targetUrl).sort(), [
    "/app/tracker/approaching",
    "/app/tracker/approaching",
    "/app/tracker/future",
    "/app/tracker/overdue",
  ]);
  assert.deepEqual(notifications.map((notification) => notification.type).sort(), [
    "commitment_approaching",
    "commitment_approaching",
    "commitment_overdue",
    "commitment_overdue",
  ]);
});

test("notification client contract remains narrow enough for transaction clients", () => {
  const client: NotificationClient = new FakeNotificationClient();
  assert.ok(client);
});
