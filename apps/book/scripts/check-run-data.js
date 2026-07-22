import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function checkRunData() {
  const runSlug = '20260517-hr-od-workshop';

  // 1. Check event details
  console.log('=== Event Details ===');
  const { data: event } = await supabase.from('events').select('*').eq('slug', runSlug).maybeSingle();
  if (!event) {
    console.log('Event not found!');
    return;
  }
  console.log('Event:', {
    id: event.id,
    slug: event.slug,
    title: event.title,
    status: event.status,
    organization_id: event.organization_id,
    created_by: event.created_by,
  });

  // 2. Count participants
  console.log('\n=== Participants ===');
  const { count: participantCount } = await supabase.from('participants').select('*', { count: 'exact', head: true }).eq('event_id', event.id);
  console.log('Total participants:', participantCount ?? 0);

  // 3. Count assessments
  console.log('\n=== Assessments ===');
  const { count: assessmentCount } = await supabase.from('assessments').select('*', { count: 'exact', head: true }).eq('event_id', event.id);
  console.log('Total assessments:', assessmentCount ?? 0);

  // 4. Count submitted assessments
  const { count: submittedCount } = await supabase.from('assessments').select('*', { count: 'exact', head: true }).eq('event_id', event.id).eq('status', 'submitted');
  console.log('Submitted assessments:', submittedCount ?? 0);

  // 5. Check reports
  console.log('\n=== Reports ===');
  const { count: reportCount } = await supabase.from('reports').select('*', { count: 'exact', head: true }).in('assessment_id',
    supabase.from('assessments').select('id').eq('event_id', event.id)
  );
  console.log('Reports generated:', reportCount ?? 0);

  // 6. Check if current user can administer this run
  console.log('\n=== Admin Access Check ===');
  const userId = '665b9425-f26b-42d4-a523-892cee2332fc'; // heyiqing6@gmail.com

  // Get user's admin memberships
  const { data: adminMemberships } = await supabase
    .from('organization_members')
    .select('organization_id,member_role')
    .eq('user_id', userId)
    .eq('member_role', 'admin')
    .eq('status', 'active');

  console.log('User admin memberships:', adminMemberships?.length || 0);
  adminMemberships?.forEach(m => {
    console.log('  - Org:', m.organization_id, 'Role:', m.member_role);
  });

  // Check event's organization
  if (event.organization_id) {
    const hasAccess = adminMemberships?.some(m => m.organization_id === event.organization_id);
    console.log('\nEvent organization_id:', event.organization_id);
    console.log('User has access to this org:', hasAccess ? 'Yes' : 'No');
  } else {
    console.log('\nEvent has NO organization_id (open to all admins)');
  }

  // 7. Show recent participants
  console.log('\n=== Recent Participants ===');
  const { data: participants } = await supabase
    .from('participants')
    .select('id,display_name,role,industry,company_name,created_at')
    .eq('event_id', event.id)
    .order('created_at', { ascending: false })
    .limit(5);

  participants?.forEach(p => {
    console.log(`  - ${p.display_name} (${p.role}) - ${p.company_name || 'N/A'} - ${p.created_at}`);
  });
}

checkRunData().catch(err => {
  console.error(err);
  process.exit(1);
});
