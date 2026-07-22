import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export async function POST(request: NextRequest) {
  try {
    const { assessmentIds } = await request.json();

    if (!Array.isArray(assessmentIds) || assessmentIds.length === 0) {
      return NextResponse.json({ ok: false, reason: "No assessment IDs provided" }, { status: 400 });
    }

    const supabase = createAdminSupabaseClient();
    if (!supabase) {
      return NextResponse.json({ ok: false, reason: "Supabase not configured" }, { status: 500 });
    }

    // Get participant_ids before deleting assessments
    const { data: assessmentsToDelete } = await supabase
      .from("assessments")
      .select("id,participant_id")
      .in("id", assessmentIds);

    const participantIds = (assessmentsToDelete ?? [])
      .map((a) => a.participant_id)
      .filter((id): id is string => Boolean(id));

    // Delete assessment_answers first
    await supabase.from("assessment_answers").delete().in("assessment_id", assessmentIds);

    // Delete reports
    await supabase.from("reports").delete().in("assessment_id", assessmentIds);

    // Delete assessments
    const { error: deleteError } = await supabase.from("assessments").delete().in("id", assessmentIds);

    if (deleteError) {
      console.error("Delete error:", deleteError);
      return NextResponse.json({ ok: false, reason: deleteError.message }, { status: 500 });
    }

    // Delete participants (orphaned records)
    if (participantIds.length > 0) {
      await supabase.from("participants").delete().in("id", participantIds);
    }

    return NextResponse.json({ ok: true, deleted: assessmentIds.length, participantsDeleted: participantIds.length });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json({ ok: false, reason: "Internal error" }, { status: 500 });
  }
}
