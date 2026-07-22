import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function detailedBenchmark() {
  const eventSlug = '20260517-hr-od-workshop';

  console.time('Total getEventSummary');
  console.time('1. Get event');

  const { data: event } = await supabase
    .from("events")
    .select("id,title,slug")
    .eq("slug", eventSlug)
    .maybeSingle();

  console.timeEnd('1. Get event');
  console.log('   Event ID:', event?.id);

  if (!event?.id) {
    console.log('Event not found');
    return;
  }

  console.time('2. Get assessments (status=submitted)');
  const { data: assessments } = await supabase
    .from("assessments")
    .select("id")
    .eq("event_id", event.id)
    .eq("status", "submitted");

  const assessmentIds = (assessments ?? []).map((item) => item.id);
  console.timeEnd('2. Get assessments (status=submitted)');
  console.log(`   Found ${assessmentIds.length} assessments`);

  if (!assessmentIds.length) {
    console.log('No assessments - would return empty summary');
    console.timeEnd('Total getEventSummary');
    return;
  }

  console.time('3. Get reports');
  const { data: reports } = await supabase
    .from("reports")
    .select("stage_level, spiral_scores, energy_scores, chain_score, charter_score, primary_bottleneck")
    .in("assessment_id", assessmentIds);

  console.timeEnd('3. Get reports');
  console.log(`   Found ${reports?.length || 0} reports`);

  console.time('4. Get open answers');
  const { data: openAnswers } = await supabase
    .from("assessment_answers")
    .select("text_value")
    .in("assessment_id", assessmentIds)
    .in("question_id", ["open_scenario", "open_workflow", "open_blocker"])
    .limit(12);

  console.timeEnd('4. Get open answers');
  console.log(`   Found ${openAnswers?.length ?? 0} answers`);

  console.timeEnd('Total getEventSummary');
}

detailedBenchmark().catch(console.error);
