import type { AssessmentAnswers, ParticipantProfile, Report } from "../assessment/types";

export async function submitAssessment({
  eventSlug,
  participant,
  answers,
  report,
  accessCode,
}: {
  eventSlug: string;
  participant: ParticipantProfile;
  answers: AssessmentAnswers;
  report: Report;
  accessCode?: string;
}): Promise<{ ok: true; reportId: string } | { ok: false; reason: string }> {
  const response = await fetch("/api/assessments", {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify({ eventSlug, participant, answers, report, accessCode }),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { error?: string; reason?: string } | null;
    return { ok: false, reason: payload?.reason ?? payload?.error ?? `http-${response.status}` };
  }

  const payload = (await response.json().catch(() => null)) as
    | { ok: true; reportId: string }
    | { ok: false; reason?: string }
    | null;

  if (payload?.ok === true) return payload;

  return { ok: false, reason: payload?.reason ?? "remote-submit-disabled" };
}
