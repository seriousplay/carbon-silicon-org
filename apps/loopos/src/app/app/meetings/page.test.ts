import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { loadMeetingGroups } from "./page";

const source = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
type FindMeetings = Parameters<typeof loadMeetingGroups>[0];

test("Meetings groups only by existing start and end timestamps", () => {
  assert.match(source, /endedAt: null,[\s\S]*startedAt: \{ lte: now \}/);
  assert.match(source, /endedAt: null,[\s\S]*startedAt: \{ gt: now \}/);
  assert.match(source, /endedAt: \{ not: null \}/);
  assert.match(source, /进行中/);
  assert.match(source, /待开始/);
  assert.match(source, /历史记录/);
  assert.match(source, /href="\/app\/meetings\/new"/);
  assert.doesNotMatch(source, /status:/);
});

test("Meetings retain all active meetings and select nearest upcoming before bounded history", async () => {
  const now = new Date("2026-07-15T00:00:00.000Z");
  const day = 24 * 60 * 60 * 1_000;
  const meeting = (id: string, startedAt: Date, endedAt: Date | null) => ({
    id,
    organizationId: "org-a",
    title: id,
    type: "TACTICAL" as const,
    agenda: "",
    notes: null,
    notesRevision: 0,
    aiGuardReport: null,
    durationMin: 30,
    startedAt,
    endedAt,
    endedById: null,
    createdAt: now,
    circleId: null,
    circle: null,
    currentPhase: null,
    _count: { decisions: 0 },
  });
  const rows = [
    meeting("still-running", new Date(now.getTime() - 120 * day), null),
    ...Array.from({ length: 60 }, (_, index) =>
      meeting(`upcoming-${index + 1}`, new Date(now.getTime() + (index + 1) * day), null),
    ),
    ...Array.from({ length: 60 }, (_, index) =>
      meeting(
        `history-${index + 1}`,
        new Date(now.getTime() - (index + 1) * day),
        new Date(now.getTime() - index * day),
      ),
    ),
  ];

  const findMeetings: FindMeetings = async (query) => {
    const where = query.where as {
      organizationId: string;
      endedAt: null | { not: null };
      startedAt?: { lte?: Date; gt?: Date };
    };
    const orderBy = query.orderBy as { startedAt: "asc" | "desc" };
    const filtered = rows.filter((row) => {
      if (row.organizationId !== where.organizationId) return false;
      if (where.endedAt === null && row.endedAt !== null) return false;
      if (where.endedAt !== null && row.endedAt === null) return false;
      if (where.startedAt?.lte && row.startedAt > where.startedAt.lte) return false;
      if (where.startedAt?.gt && row.startedAt <= where.startedAt.gt) return false;
      return true;
    });
    filtered.sort((left, right) => {
      const difference = left.startedAt.getTime() - right.startedAt.getTime();
      return orderBy.startedAt === "asc" ? difference : -difference;
    });
    return query.take === undefined ? filtered : filtered.slice(0, query.take);
  };

  const groups = await loadMeetingGroups(findMeetings, "org-a", now);

  assert.deepEqual(groups.activeMeetings.map(({ id }) => id), ["still-running"]);
  assert.equal(groups.upcomingMeetings.length, 50);
  assert.equal(groups.upcomingMeetings[0]?.id, "upcoming-1");
  assert.equal(groups.upcomingMeetings.at(-1)?.id, "upcoming-50");
  assert.equal(groups.historicalMeetings.length, 50);
  assert.equal(groups.historicalMeetings[0]?.id, "history-1");
  assert.equal(groups.historicalMeetings.at(-1)?.id, "history-50");
});
