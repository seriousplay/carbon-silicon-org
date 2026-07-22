import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/supabase/pool";

export async function POST(request: NextRequest) {
  try {
    const { assessmentIds } = await request.json();

    if (!Array.isArray(assessmentIds) || assessmentIds.length === 0) {
      return NextResponse.json({ ok: false, reason: "No assessment IDs provided" }, { status: 400 });
    }

    if (!db) {
      return NextResponse.json({ ok: false, reason: "Database not configured" }, { status: 500 });
    }

    // Get participant_ids before deleting assessments
    const assessmentsToDelete = await db.assessment.findMany({
      where: { id: { in: assessmentIds } },
      select: { id: true, participantId: true },
    });

    const participantIds = assessmentsToDelete
      .map((a) => a.participantId)
      .filter((id): id is string => Boolean(id));

    // Delete in order: answers → reports → assessments → participants
    await db.assessmentAnswer.deleteMany({
      where: { assessmentId: { in: assessmentIds } },
    });

    await db.report.deleteMany({
      where: { assessmentId: { in: assessmentIds } },
    });

    await db.assessment.deleteMany({
      where: { id: { in: assessmentIds } },
    });

    if (participantIds.length > 0) {
      await db.participant.deleteMany({
        where: { id: { in: participantIds } },
      });
    }

    return NextResponse.json({
      ok: true,
      deleted: assessmentIds.length,
      participantsDeleted: participantIds.length,
    });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ ok: false, reason: "Internal error" }, { status: 500 });
  }
}
