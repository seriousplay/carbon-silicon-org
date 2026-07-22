import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false }
});

console.time('Event Query');
const { data } = await supabase.from('events').select('id,slug').eq('slug', '20260517-hr-od-workshop').maybeSingle();
console.timeEnd('Event Query');

console.time('Participants Count');
const { count: pCount } = await supabase.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', data?.id);
console.timeEnd('Participants Count');

console.time('Assessments Count');
const { count: aCount } = await supabase.from('assessments').select('*', { count: 'exact', head: true }).eq('event_id', data?.id);
console.timeEnd('Assessments Count');

console.log(`\\nTotal for event: ${pCount} participants, ${aCount} assessments`);
