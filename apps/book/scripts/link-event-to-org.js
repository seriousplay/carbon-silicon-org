import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function linkEventToOrg() {
  const orgName = '北京真合管理咨询有限公司';
  const eventSlug = '20260517-hr-od-workshop';

  console.log(`Looking for organization: "${orgName}"`);

  // 1. Find the organization
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id,slug,name,org_type,status')
    .eq('name', orgName)
    .maybeSingle();

  if (orgError || !org) {
    console.error('❌ Organization not found:', orgError?.message);
    process.exit(1);
  }

  console.log(`✓ Found organization: ${org.name} (${org.slug})`);
  console.log(`  ID: ${org.id}`);
  console.log(`  Type: ${org.org_type}`);
  console.log(`  Status: ${org.status}`);

  // 2. Find the event
  const { data: event, error: eventError } = await supabase
    .from('events')
    .select('id,slug,title,organization_id')
    .eq('slug', eventSlug)
    .maybeSingle();

  if (eventError || !event) {
    console.error('❌ Event not found:', eventError?.message);
    process.exit(1);
  }

  console.log(`\n✓ Found event: ${event.title} (${event.slug})`);
  console.log(`  Current organization_id: ${event.organization_id ?? 'null'}`);

  // 3. Check if user is admin of this org
  const userId = '665b9425-f26b-42d4-a523-892cee2332fc';
  const { data: membership } = await supabase
    .from('organization_members')
    .select('member_role,status')
    .eq('organization_id', org.id)
    .eq('user_id', userId)
    .eq('member_role', 'admin')
    .eq('status', 'active')
    .maybeSingle();

  if (!membership) {
    console.log('\n⚠️  User is NOT an admin of this organization');
    console.log('   Will still link the event, but admin access may require additional setup');
  } else {
    console.log('\n✓ User is admin of this organization');
  }

  // 4. Update event's organization_id
  const { error: updateError } = await supabase
    .from('events')
    .update({ organization_id: org.id })
    .eq('slug', eventSlug);

  if (updateError) {
    console.error('❌ Failed to update event:', updateError.message);
    process.exit(1);
  }

  console.log(`\n✅ Successfully linked event to organization!`);
  console.log(`\nSummary:`);
  console.log(`  Event: ${event.title}`);
  console.log(`  Organization: ${org.name} (${org.slug})`);
  console.log(`  Organization ID: ${org.id}`);
}

linkEventToOrg().catch(err => {
  console.error(err);
  process.exit(1);
});
