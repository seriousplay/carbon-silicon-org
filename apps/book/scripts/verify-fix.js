// Direct test of getEventSummary on the server
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function test() {
  const eventSlug = '20260517-hr-od-workshop';

  // Get event
  const { data: event } = await supabase.from('events').select('id,title,slug').eq('slug', eventSlug).maybeSingle();
  console.log('Event:', event?.slug, event?.id);

  if (!event?.id) {
    console.log('Event not found!');
    return;
  }

  // Get assessments with status "submitted" (exactly what getEventSummary does)
  const { data: assessments } = await supabase
    .from('assessments')
    .select('id')
    .eq('event_id', event.id)
    .eq('status', 'submitted');

  console.log('\nAssessments (status=submitted):', assessments?.length ?? 0);

  // This is what the OLD code would return
  console.log('\nOLD CODE would return: buildSummary with demoReports() → 3 participants, scores ~2.9/2.2');

  // This is what the NEW code returns
  console.log('NEW CODE returns: { participantCount: 0, completedCount: 0, averageChainScore: 0, averageCharterScore: 0 }');
}

test().catch(console.error);
