import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkDataAfterDelete() {
  const eventSlug = '20260517-hr-od-workshop';

  // Get event
  const { data: event } = await supabase.from('events').select('id,slug,title').eq('slug', eventSlug).maybeSingle();
  console.log('Event ID:', event?.id);

  if (!event?.id) {
    console.log('Event not found!');
    return;
  }

  // Count all tables
  const participants = await supabase.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', event.id);
  const assessments = await supabase.from('assessments').select('id,status').eq('event_id', event.id);

  console.log('\nParticipants:', participants.count ?? 0);
  console.log('Assessments:', assessments.data?.length ?? 0);

  const statusCounts = {};
  assessments.data?.forEach(a => {
    statusCounts[a.status] = (statusCounts[a.status] || 0) + 1;
  });
  console.log('By status:', statusCounts);

  // Check reports
  const reports = await supabase.from('reports').select('*', { count: 'exact', head: true })
    .in('assessment_id', (assessments.data || []).map(a => a.id));
  console.log('Reports:', reports.count ?? 0);
}

checkDataAfterDelete().catch(console.error);
