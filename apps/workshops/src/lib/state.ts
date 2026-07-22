import "server-only";

import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { createId } from "./ids";
import { computeWeightedScore } from "./shared";
import type {
  AppState,
  CandidateFlags,
  CandidateRecord,
  DraftCandidateRecord,
  CommitmentRecord,
  EventRecord,
  ParticipantRecord,
  PressureRecord,
  SessionRecord,
} from "./types";

const STATE_FILE = join(process.cwd(), "data", "state.json");
let writeChain = Promise.resolve();

function makeCandidate(index: number, draft?: DraftCandidateRecord): CandidateRecord {
  return {
    id: createId(draft ? draft.id : `cand${index + 1}`),
    name: draft?.name ?? `候选 ${index + 1}`,
    scenario: draft?.scenario ?? "",
    routeFrom: draft?.routeFrom ?? "",
    routeTo: draft?.routeTo ?? "",
    source: draft?.source ?? "自创",
    notes: draft?.notes ?? "",
    aiWork: draft?.aiWork ?? "",
    humanWork: draft?.humanWork ?? "",
    successStandard: draft?.successStandard ?? "",
    flags: { pain: false, data: false, owner: false, shortLoop: false },
    scores: { pain: 0, data: 0, copy: 0, risk: 0, total: 0 },
  };
}

export function createEmptySession(eventId: string, drafts: DraftCandidateRecord[] = []): SessionRecord {
  const now = new Date().toISOString();
  return {
    id: createId("sess"),
    eventId,
    createdAt: now,
    updatedAt: now,
    participant: { nickname: "", company: "", seat: "" },
    status: "draft",
    step: 0,
    candidates: [makeCandidate(0, drafts[0]), makeCandidate(1, drafts[1]), makeCandidate(2, drafts[2])],
    finalChoiceId: null,
    pressure: { challenger: "", blindspot: "", failureReason: "", resistance: "" },
    commitment: { action: "", deadline: "", firstContact: "" },
  };
}

async function ensureDir() {
  await mkdir(dirname(STATE_FILE), { recursive: true });
}

async function readState(): Promise<AppState> {
  try {
    const raw = await readFile(STATE_FILE, "utf8");
    return JSON.parse(raw) as AppState;
  } catch {
    return { events: {} };
  }
}

async function persistState(state: AppState) {
  await ensureDir();
  const tempFile = `${STATE_FILE}.tmp`;
  await writeFile(tempFile, `${JSON.stringify(state, null, 2)}\n`, "utf8");
  await rename(tempFile, STATE_FILE);
}

async function withWriteLock<T>(fn: () => Promise<T>) {
  const next = writeChain.then(fn, fn);
  writeChain = next.then(() => undefined, () => undefined);
  return next;
}

export async function listEvents() {
  const state = await readState();
  return Object.values(state.events).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getEvent(eventId: string) {
  const state = await readState();
  return state.events[eventId] ?? null;
}

export async function createEvent(input: { title: string; venue: string; tagline: string; draftCandidates?: DraftCandidateRecord[] }) {
  return withWriteLock(async () => {
    const state = await readState();
    const now = new Date().toISOString();
    const event: EventRecord = {
      id: createId("event"),
      title: input.title.trim(),
      venue: input.venue.trim(),
      tagline: input.tagline.trim(),
      createdAt: now,
      updatedAt: now,
      adminKey: createId("key"),
      draftCandidates: input.draftCandidates ?? [],
      sessions: {},
    };
    state.events[event.id] = event;
    await persistState(state);
    return event;
  });
}

export async function createSession(eventId: string, participant: ParticipantRecord) {
  return withWriteLock(async () => {
    const state = await readState();
    const event = state.events[eventId];
    if (!event) throw new Error("活动不存在");
    const now = new Date().toISOString();
    const session = createEmptySession(eventId, event.draftCandidates ?? []);
    session.participant = participant;
    session.status = "active";
    session.updatedAt = now;
    event.sessions[session.id] = session;
    event.updatedAt = now;
    await persistState(state);
    return session;
  });
}

export async function updateSession(session: SessionRecord) {
  return withWriteLock(async () => {
    const state = await readState();
    const event = state.events[session.eventId];
    if (!event) throw new Error("活动不存在");
    const now = new Date().toISOString();
    const nextSession = { ...session, updatedAt: now };
    event.sessions[nextSession.id] = nextSession;
    event.updatedAt = now;
    await persistState(state);
    return nextSession;
  });
}

export async function getSession(eventId: string, sessionId: string) {
  const event = await getEvent(eventId);
  return event?.sessions[sessionId] ?? null;
}

export function buildDashboard(event: EventRecord) {
  const sessions = Object.values(event.sessions);
  const liveSessions = sessions.filter((item) => item.status !== "submitted");
  const lockedSessions = sessions.filter((item) => item.status === "locked" || item.status === "submitted");
  const finalist = sessions.flatMap((session) => {
    const choice = session.candidates.find((candidate) => candidate.id === session.finalChoiceId);
    return choice ? [{ session, choice }] : [];
  });
  return {
    event,
    counts: {
      total: sessions.length,
      live: liveSessions.length,
      locked: lockedSessions.length,
    },
    finalist,
  };
}

export function candidateDefaults(): CandidateRecord[] {
  return [makeCandidate(0), makeCandidate(1), makeCandidate(2)];
}

export function defaultParticipant(): ParticipantRecord {
  return { nickname: "", company: "", seat: "" };
}

export function defaultPressure(): PressureRecord {
  return { challenger: "", blindspot: "", failureReason: "", resistance: "" };
}

export function defaultCommitment(): CommitmentRecord {
  return { action: "", deadline: "", firstContact: "" };
}

export function applyScoring(candidate: CandidateRecord, flags: CandidateFlags) {
  return {
    ...candidate,
    flags,
    scores: computeWeightedScore(flags),
  };
}
