import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, getUserWorkspace } from "@/lib/auth/server";
import { db } from "@/lib/supabase/pool";
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

  if (!db) {
    return NextResponse.json({ ok: false, reason: "Database is not configured" });
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

  try {
    const event = await db.event.findUnique({
      where: { slug: eventSlug },
      select: { id: true, organizationId: true },
    });

    if (!event?.id) {
      return NextResponse.json({ error: "Event not found" }, { status: 404 });
    }

    const workspace = user ? await getUserWorkspace(user.id) : null;
    const organizationId = event.organizationId ?? workspace?.defaultMembership?.organizationId ?? null;
    const userId = user?.id ?? null;

    const participantRow = await db.participant.create({
      data: {
        eventId: event.id,
        userId,
        organizationId,
        displayName: participant.displayName,
        role: participant.role,
        industry: participant.industry,
        orgSize: participant.orgSize,
        companyName: participant.companyName || null,
        contact: participant.contact || null,
        contactConsent: Boolean(participant.contactConsent),
      },
      select: { id: true },
    });

    const assessmentRow = await db.assessment.create({
      data: {
        eventId: event.id,
        participantId: participantRow.id,
        userId,
        status: "submitted",
        submittedAt: new Date(),
      },
      select: { id: true },
    });

    const answerRows = Object.entries(answers).map(([questionId, value]) => ({
      assessmentId: assessmentRow.id,
      questionId,
      numericValue: typeof value === "number" ? value : null,
      textValue: typeof value === "string" ? value : null,
    }));

    await db.assessmentAnswer.createMany({ data: answerRows });

    const reportId = crypto.randomUUID();
    const report: Report = buildReport(eventSlug, participant as ParticipantProfile, answers as AssessmentAnswers, reportId);

    const reportRow = await db.report.create({
      data: {
        id: reportId,
        assessmentId: assessmentRow.id,
        userId,
        stageLevel: report.stageLevel,
        nextLevel: report.nextLevel,
        stageSummary: report.stageSummary,
        spiralScores: report.spiralScores,
        energyScores: report.energyScores,
        chainScore: report.chainScore,
        charterScore: report.charterScore,
        primaryBottleneck: report.primaryBottleneck.key,
        actionRecommendation: report.actionRecommendation,
        recommendedTools: report.recommendedTools,
        participantSnapshot: participant,
        openAnswers: report.openAnswers,
        reportPayload: JSON.parse(JSON.stringify(report)),
      },
      select: { id: true },
    });

    return NextResponse.json({ ok: true, reportId: reportRow.id });
  } catch (error) {
    console.error("Assessment submission error:", error);
    return NextResponse.json({ error: "Failed to submit assessment" }, { status: 500 });
  }
}
