import { MeetingEngineError } from "./types";

export function parseEventCursor(value: string | null): number {
  if (value === null || value === "") return 0;
  if (!/^\d+$/.test(value)) throw new MeetingEngineError("INVALID_EVENT_CURSOR");
  const cursor = Number(value);
  if (!Number.isSafeInteger(cursor)) throw new MeetingEngineError("INVALID_EVENT_CURSOR");
  return cursor;
}

export function parseEventLimit(value: string | null): number {
  if (value === null || value === "") return 100;
  if (!/^\d+$/.test(value)) throw new MeetingEngineError("INVALID_EVENT_LIMIT");
  const limit = Number(value);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
    throw new MeetingEngineError("INVALID_EVENT_LIMIT");
  }
  return limit;
}
