import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function diagnoseStaleData() {
  const eventSlug = '20260517-hr-od-workshop';

  // Get event
  const { data: event } = await supabase.from('events').select('id,title,slug').eq('slug', eventSlug).maybeSingle();
  console.log('Event:', event?.slug, event?.id);

  if (!event?.id) {
    console.log('Event not found!');
    return;
  }

  // Check ALL participants (no status filter)
  const { count: allParticipants } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id);

  console.log('\n=== Participants ===');
  console.log('Total count:', allParticipants ?? 0);

  // Check ALL assessments with different statuses
  const { data: allAssessments } = await supabase
    .from('assessments')
    .select('id,status,participant_id')
    .eq('event_id', event.id);

  console.log('\n=== Assessments (ALL statuses) ===');
  console.log('Total count:', allAssessments?.length ?? 0);

  const statusCounts = {};
  allAssessments?.forEach(a => {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  });
  console.log('By status:', statusCounts);

  // Check only "submitted" assessments (what getEventSummary uses)
  const { count: submittedAssessments } = await supabase
    .from('assessments')
    .select('*', { count: 'exact', head: true })
    .eq('event_id', event.id)
    .eq('status', 'submitted');

  console.log('\n=== Assessments (status = "submitted" only) ===');
  console.log('Count:', submittedAssessments ?? 0);

  // Check reports
  const { count: allReports } = await supabase
    .from('reports')
    .select('*', { count: 'exact', head: true })
    .in('assessment_id', (allAssessments ?? []).map(a => a.id));

  console.log('\n=== Reports ===');
  console.log('Total count:', allReports ?? 0);

  // Sample some participants to see their data
  const { data: sampleParticipants } = await supabase
    .from('participants')
    .select('id,display_name,role,created_at')
    .eq('event_id', event.id)
    .limit(5);

  console.log('\n=== Sample Participants ===');
  sampleParticipants?.forEach(p => {
    console.log(`- ${p.display_name} (${p.id}) created at ${p.created_at}`);
  });

  // Check if there are any orphaned assessments (no participant)
  const orphanedAssessments = allAssessments?.filter(a => !a.participant_id) ?? [];
  console.log('\n=== Orphaned Assessments (no participant) ===');
  console.log('Count:', orphanedAssessments.length);
  if (orphanedAssessments.length > 0) {
    orphanedAssessments.forEach(a => console.log(`- ${a.id} (status: ${a.status})`));
  }
}

diagnoseStaleData().catch(console.error);
