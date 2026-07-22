import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getUserWorkspace } from "@/lib/auth/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { buildReport } from "@/lib/assessment/scoring";
import { canSubmitAssessmentAsGuest, verifyRunAccessCode } from "@/lib/runs/server";
import type { AssessmentAnswers, ParticipantProfile, Report } from "@/lib/assessment/types";

const payloadSchema = z.object({
  eventSlug: z.string().min(1),
  participant: z.object({
    displayName: z.string().min(1),
    role: z.string().min(1),
    industry: z.string().min(1),
    orgSize: z.string().min(1),
    companyName: z.string().optional(),
    contact: z.string().optional(),
    contactConsent: z.boolean().optional(),
  }),
  answers: z.record(z.string(), z.union([z.string(), z.number()])),
  accessCode: z.string().optional(),
  report: z.unknown().optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();

  const supabase = createAdminSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ ok: false, reason: "Supabase service role is not configured" });
  }

  const parsed = payloadSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid assessment payload" }, { status: 400 });
  }

  const { eventSlug, participant, answers, accessCode } = parsed.data;
  const allowsGuestSubmission = canSubmitAssessmentAsGuest(eventSlug);

  if (!user && !allowsGuestSubmission) {
    return NextResponse.json({ ok: false, reason: "请先登录后再提交测评。" }, { status: 401 });
  }

  const access = await verifyRunAccessCode(eventSlug, accessCode);

  if (!access.ok) {
    return NextResponse.json({ error: access.reason ?? "Access denied" }, { status: 403 });
  }

  const { data: event, error: eventError } = await supabase
    .from("events")
    .select("id,organization_id")
    .eq("slug", eventSlug)
    .maybeSingle();

  if (eventError) {
    return NextResponse.json({ error: eventError.message }, { status: 500 });
  }

  if (!event?.id) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const workspace = user ? await getUserWorkspace(user.id) : null;
  const organizationId = event.organization_id ?? workspace?.defaultMembership?.organizationId ?? null;
  const userId = user?.id ?? null;

  const { data: participantRow, error: participantError } = await supabase
    .from("participants")
    .insert({
      event_id: event.id,
      user_id: userId,
      organization_id: organizationId,
      display_name: participant.displayName,
      role: participant.role,
      industry: participant.industry,
      org_size: participant.orgSize,
      company_name: participant.companyName || null,
      contact: participant.contact || null,
      contact_consent: Boolean(participant.contactConsent),
    })
    .select("id")
    .single();

  if (participantError || !participantRow) {
    return NextResponse.json({ error: participantError?.message ?? "Participant insert failed" }, { status: 500 });
  }

  const { data: assessmentRow, error: assessmentError } = await supabase
    .from("assessments")
    .insert({
      event_id: event.id,
      participant_id: participantRow.id,
      user_id: userId,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (assessmentError || !assessmentRow) {
    return NextResponse.json({ error: assessmentError?.message ?? "Assessment insert failed" }, { status: 500 });
  }

  const answerRows = Object.entries(answers).map(([questionId, value]) => ({
    assessment_id: assessmentRow.id,
    question_id: questionId,
    numeric_value: typeof value === "number" ? value : null,
    text_value: typeof value === "string" ? value : null,
  }));

  const { error: answersError } = await supabase.from("assessment_answers").insert(answerRows);

  if (answersError) {
    return NextResponse.json({ error: answersError.message }, { status: 500 });
  }

  const reportId = crypto.randomUUID();
  const report: Report = buildReport(eventSlug, participant as ParticipantProfile, answers as AssessmentAnswers, reportId);

  const { data: reportRow, error: reportError } = await supabase
    .from("reports")
    .insert({
      id: reportId,
      assessment_id: assessmentRow.id,
      user_id: userId,
      stage_level: report.stageLevel,
      next_level: report.nextLevel,
      stage_summary: report.stageSummary,
      spiral_scores: report.spiralScores,
      energy_scores: report.energyScores,
      chain_score: report.chainScore,
      charter_score: report.charterScore,
      primary_bottleneck: report.primaryBottleneck.key,
      action_recommendation: report.actionRecommendation,
      recommended_tools: report.recommendedTools,
      participant_snapshot: participant,
      open_answers: report.openAnswers,
      report_payload: report,
    })
    .select("id")
    .single();

  if (reportError || !reportRow) {
    return NextResponse.json({ error: reportError?.message ?? "Report insert failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, reportId: reportRow.id });
}
