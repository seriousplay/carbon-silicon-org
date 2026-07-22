import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function test() {
  // Test event
  const { data: event } = await supabase.from('events').select('id,slug,title').eq('slug', '20260517-hr-od-workshop').maybeSingle();
  console.log('Event:', event);

  if (event?.id) {
    // Test participants
    const { count: participants } = await supabase.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', event.id);
    console.log('Participants count:', participants);

    // Test assessments
    const { count: assessments } = await supabase.from('assessments').select('*', { count: 'exact', head: true }).eq('event_id', event.id);
    console.log('Assessments count:', assessments);
  }
}

test().catch(console.error);
