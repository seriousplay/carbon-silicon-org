import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function cleanupOrphanedParticipants() {
  const eventSlug = '20260517-hr-od-workshop';

  // Get event
  const { data: event } = await supabase.from('events').select('id').eq('slug', eventSlug).maybeSingle();
  if (!event?.id) {
    console.log('Event not found');
    return;
  }

  // Get all participants
  const { data: participants } = await supabase
    .from('participants')
    .select('id,display_name')
    .eq('event_id', event.id);

  if (!participants?.length) {
    console.log('No participants found');
    return;
  }

  // Get all assessments
  const { data: assessments } = await supabase
    .from('assessments')
    .select('participant_id')
    .eq('event_id', event.id);

  const assessmentParticipantIds = new Set((assessments ?? []).map(a => a.participant_id));

  // Find orphaned participants (those without assessments)
  const orphaned = participants.filter(p => !assessmentParticipantIds.has(p.id));

  console.log(`Total participants: ${participants.length}`);
  console.log(`With assessments: ${assessmentParticipantIds.size}`);
  console.log(`Orphaned (no assessment): ${orphaned.length}`);

  if (orphaned.length > 0) {
    console.log('\nOrphaned participants:');
    orphaned.forEach(p => console.log(`  - ${p.display_name} (${p.id})`));

    const { error } = await supabase.from('participants').delete().in('id', orphaned.map(p => p.id));

    if (error) {
      console.error('Delete error:', error);
    } else {
      console.log(`\n✅ Deleted ${orphaned.length} orphaned participants`);
    }
  } else {
    console.log('\n✅ No orphaned participants found');
  }
}

cleanupOrphanedParticipants().catch(console.error);
