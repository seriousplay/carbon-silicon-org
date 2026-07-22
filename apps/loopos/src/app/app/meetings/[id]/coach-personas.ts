import {
  MEETING_COACH_PERSONAS,
  type MeetingCoachPersona,
} from "@/lib/meeting-facilitation/personas";

export type CoachPersona = MeetingCoachPersona;
export const COACH_PERSONAS: Record<string, CoachPersona> = MEETING_COACH_PERSONAS;
