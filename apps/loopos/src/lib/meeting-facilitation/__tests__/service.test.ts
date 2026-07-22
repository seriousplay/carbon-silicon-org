import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type {
  MeetingFacilitationRepository,
  PersistedFacilitationEvent,
  PersistedFacilitationSession,
  TransitionCommit,
} from "../repository";
import { MeetingFacilitationRepositoryError } from "../repository";
import { buildMeetingFacilitationReadModel } from "../read-model";
import { createMeetingFacilitationService } from "../service";

class InMemoryRepository implements MeetingFacilitationRepository {
  session: PersistedFacilitationSession | null = null;
  events: PersistedFacilitationEvent[] = [];

  constructor(readonly meetingType: "TACTICAL" | "GOVERNANCE" = "TACTICAL") {}

  async getInitializationContext() {
    return { meetingType: this.meetingType, participantIds: ["participant-a", "participant-b"] } as const;
  }

  async createSession(input: Parameters<MeetingFacilitationRepository["createSession"]>[0]) {
    if (this.session) throw new MeetingFacilitationRepositoryError("SESSION_ALREADY_INITIALIZED");
    this.session = {
      id: "session-1",
      organizationId: input.organizationId,
      meetingId: input.meetingId,
      actorParticipantId: participantIdForPerson(input.actorPersonId),
      state: input.state,
      lastEventSequence: 1,
    };
    this.events.push({
      sequence: 1,
      stateRevision: 0,
      actorPersonId: input.actorPersonId,
      type: "SESSION_INITIALIZED",
      payload: {},
      createdAt: new Date(0),
    });
    return this.session;
  }

  async loadForActor(input: Parameters<MeetingFacilitationRepository["loadForActor"]>[0]) {
    if (!this.session) throw new MeetingFacilitationRepositoryError("FACILITATION_SESSION_NOT_FOUND");
    return { ...this.session, actorParticipantId: participantIdForPerson(input.actorPersonId) };
  }

  async commitTransition(input: TransitionCommit) {
    if (!this.session || this.session.state.revision !== input.expectedRevision) {
      throw new MeetingFacilitationRepositoryError("STALE_MEETING_REVISION");
    }
    const start = this.session.lastEventSequence;
    input.events.forEach((event, index) => {
      this.events.push({
        sequence: start + index + 1,
        stateRevision: input.nextState.revision,
        actorPersonId: input.actorPersonId,
        type: event.type,
        payload: event.payload ?? {},
        createdAt: new Date(index + 1),
      });
    });
    this.session = {
      ...this.session,
      actorParticipantId: input.actorParticipantId,
      state: input.nextState,
      lastEventSequence: start + input.events.length,
    };
    return this.session;
  }

  async appendEvent(input: Parameters<MeetingFacilitationRepository["appendEvent"]>[0]) {
    const session = await this.loadForActor(input);
    if (session.state.revision !== input.expectedRevision) {
      throw new MeetingFacilitationRepositoryError("STALE_MEETING_REVISION");
    }
    const sequence = session.lastEventSequence + 1;
    this.events.push({
      sequence,
      stateRevision: input.expectedRevision,
      actorPersonId: input.actorPersonId,
      type: input.type,
      payload: input.payload,
      createdAt: new Date(sequence),
    });
    this.session = { ...session, lastEventSequence: sequence };
    return this.session;
  }

  async getSnapshot(input: Parameters<MeetingFacilitationRepository["getSnapshot"]>[0]) {
    return this.loadForActor(input);
  }

  async listEvents(input: Parameters<MeetingFacilitationRepository["listEvents"]>[0]) {
    await this.loadForActor(input);
    return this.events.filter((event) => event.sequence > input.after).slice(0, input.limit);
  }
}

const base = {
  organizationId: "org-1",
  meetingId: "meeting-1",
  actorPersonId: "person-a",
} as const;

const representations = [
  { participantId: "participant-a", roleIds: ["role-product", "role-research"] },
  { participantId: "participant-b", roleIds: ["role-data"] },
] as const;

describe("meeting facilitation service", () => {
  test("requires explicit roles for every active participant", async () => {
    const service = createMeetingFacilitationService(new InMemoryRepository());
    await assert.rejects(
      service.initialize({
        ...base,
        representations: [{ participantId: "participant-a", roleIds: ["role-product"] }],
      }),
      /REPRESENTED_ROLE_REQUIRED/,
    );
  });

  test("creates actor-owned agenda items with any represented role", async () => {
    const repository = new InMemoryRepository();
    const service = createMeetingFacilitationService(repository);
    let session = await service.initialize({ ...base, representations });
    session = await execute(service, session, "person-a", { type: "START" });
    for (let round = 0; round < 4; round += 1) {
      session = await completeRound(service, session);
    }
    session = await execute(service, session, "person-a", {
      type: "ADD_AGENDA_ITEM",
      roleId: "role-research",
      label: "research",
    });
    assert.equal(session.state.agenda[0]?.ownerParticipantId, "participant-a");
    assert.equal(session.state.agenda[0]?.ownerRoleId, "role-research");
    assert.equal(buildMeetingFacilitationReadModel(session).agenda[0]?.label, "research");
  });

  test("rejects governance commands in a tactical session", async () => {
    const service = createMeetingFacilitationService(new InMemoryRepository());
    const session = await service.initialize({ ...base, representations });
    await assert.rejects(
      service.execute({
        ...base,
        expectedRevision: session.state.revision,
        command: { type: "CONFIRM_ADOPTION" },
      }),
      /COMMAND_NOT_ALLOWED_FOR_TACTICAL_MEETING/,
    );
  });

  test("allows exactly one winner for concurrent writes from the same revision", async () => {
    const repository = new InMemoryRepository();
    const service = createMeetingFacilitationService(repository);
    const session = await service.initialize({ ...base, representations });
    const attempts = await Promise.allSettled([
      service.execute({ ...base, expectedRevision: session.state.revision, command: { type: "START" } }),
      service.execute({ ...base, expectedRevision: session.state.revision, command: { type: "START" } }),
    ]);
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    assert.equal(attempts.filter((result) => result.status === "rejected").length, 1);
    assert.equal(repository.session?.state.revision, 1);
  });

  test("returns ordered incremental events without mutating the snapshot", async () => {
    const repository = new InMemoryRepository();
    const service = createMeetingFacilitationService(repository);
    let session = await service.initialize({ ...base, representations });
    session = await execute(service, session, "person-a", { type: "START" });
    session = await execute(service, session, "person-a", { type: "COMPLETE_TURN" });
    const events = await service.listEvents({ ...base, after: 1 });
    assert.deepEqual(events.map((event) => event.sequence), [2, 3]);
    assert.equal((await service.getSnapshot(base)).state.revision, session.state.revision);
    assert.throws(() => service.listEvents({ ...base, after: -1 }), /INVALID_EVENT_CURSOR/);
  });

  test("appends grounded coach events without advancing the state revision", async () => {
    const repository = new InMemoryRepository();
    const service = createMeetingFacilitationService(repository);
    await service.initialize({ ...base, representations });
    const appended = await service.appendEvent({
      ...base,
      expectedRevision: 0,
      type: "COACH_SUGGESTION",
      payload: { speech: "Please check in." },
    });
    assert.equal(appended.state.revision, 0);
    assert.equal(appended.lastEventSequence, 2);
    assert.equal(repository.events[1]?.type, "COACH_SUGGESTION");
  });
});

async function execute(
  service: ReturnType<typeof createMeetingFacilitationService>,
  session: PersistedFacilitationSession,
  actorPersonId: string,
  command: Parameters<ReturnType<typeof createMeetingFacilitationService>["execute"]>[0]["command"],
) {
  return service.execute({
    organizationId: session.organizationId,
    meetingId: session.meetingId,
    actorPersonId,
    expectedRevision: session.state.revision,
    command,
  });
}

async function completeRound(
  service: ReturnType<typeof createMeetingFacilitationService>,
  session: PersistedFacilitationSession,
) {
  let current = await execute(service, session, "person-a", { type: "COMPLETE_TURN" });
  current = await execute(service, current, "person-b", { type: "COMPLETE_TURN" });
  return current;
}

function participantIdForPerson(personId: string): string {
  if (personId === "person-a") return "participant-a";
  if (personId === "person-b") return "participant-b";
  throw new MeetingFacilitationRepositoryError("ACTOR_NOT_ACTIVE_PARTICIPANT");
}
