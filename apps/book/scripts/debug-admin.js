import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function debugAdminAccess() {
  const userId = '665b9425-f26b-42d4-a523-892cee2332fc';
  const runSlug = '20260517-hr-od-workshop';

  console.log('=== Step 1: Get event organization_id ===');
  const { data: event } = await supabase.from('events').select('organization_id').eq('slug', runSlug).maybeSingle();
  console.log('Event organization_id:', event?.organization_id);

  console.log('\n=== Step 2: Get user memberships (raw) ===');
  const { data: memberships } = await supabase
    .from('organization_members')
    .select('organization_id,member_role,status')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  console.log('Total memberships:', memberships?.length || 0);
  memberships?.forEach(m => {
    console.log(`  - Org: ${m.organization_id}, Role: ${m.member_role}, Status: ${m.status}`);
  });

  console.log('\n=== Step 3: Check isOrganizationAdmin filter ===');
  const adminMemberships = memberships?.filter(m => m.member_role === 'admin' && m.status === 'active');
  console.log('Admin memberships:', adminMemberships?.length || 0);

  console.log('\n=== Step 4: canAdministerRun result ===');
  if (!adminMemberships?.length) {
    console.log('❌ No admin memberships found - user cannot administer any run');
  } else if (!event?.organization_id) {
    console.log('✅ Event has no organization_id - any admin can access');
  } else {
    const hasAccess = adminMemberships.some(m => m.organization_id === event.organization_id);
    console.log(hasAccess ? '✅ User can administer this run' : '❌ User cannot administer this run (org mismatch)');
  }
}

debugAdminAccess().catch(console.error);
