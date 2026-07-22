export type CandidateSource = "模板" | "自创" | "AI生成";

export type DraftCandidateRecord = {
  id: string;
  name: string;
  scenario: string;
  routeFrom: string;
  routeTo: string;
  notes: string;
  aiWork: string;
  humanWork: string;
  successStandard: string;
  source: CandidateSource;
};

export type CandidateFlags = {
  pain: boolean;
  data: boolean;
  owner: boolean;
  shortLoop: boolean;
};

export type CandidateScores = {
  pain: number;
  data: number;
  copy: number;
  risk: number;
  total: number;
};

export type CandidateRecord = {
  id: string;
  name: string;
  scenario: string;
  routeFrom: string;
  routeTo: string;
  source: CandidateSource;
  notes: string;
  aiWork: string;
  humanWork: string;
  successStandard: string;
  flags: CandidateFlags;
  scores: CandidateScores;
};

export type ParticipantRecord = {
  nickname: string;
  company: string;
  seat: string;
};

export type PressureRecord = {
  challenger: string;
  blindspot: string;
  failureReason: string;
  resistance: string;
};

export type CommitmentRecord = {
  action: string;
  deadline: string;
  firstContact: string;
};

export type SessionStatus = "draft" | "active" | "locked" | "submitted";

export type SessionRecord = {
  id: string;
  eventId: string;
  createdAt: string;
  updatedAt: string;
  participant: ParticipantRecord;
  status: SessionStatus;
  step: number;
  candidates: CandidateRecord[];
  finalChoiceId: string | null;
  pressure: PressureRecord;
  commitment: CommitmentRecord;
};

export type EventRecord = {
  id: string;
  title: string;
  venue: string;
  tagline: string;
  createdAt: string;
  updatedAt: string;
  adminKey: string;
  draftCandidates: DraftCandidateRecord[];
  sessions: Record<string, SessionRecord>;
};

export type AppState = {
  events: Record<string, EventRecord>;
};
