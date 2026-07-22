import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const email = 'heyiqing6@gmail.com';

const { data: { users } } = await supabase.auth.admin.listUsers({ email });
const user = users?.[0];

if (!user) {
  console.log('User not found');
  process.exit(1);
}

console.log('User found:');
console.log('  ID:', user.id);
console.log('  Email:', user.email);
console.log('  Created:', user.created_at);
console.log('  Email confirmed:', user.email_confirmed_at ? 'Yes' : 'No');

const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
console.log('\nProfile:', profile ? 'Exists' : 'None');
if (profile) {
  console.log('  Role:', profile.role);
  console.log('  Display name:', profile.display_name);
  console.log('  Default org:', profile.default_organization_id);
}

const { data: members } = await supabase.from('organization_members').select('*').eq('user_id', user.id);
console.log('\nOrganization memberships:', members?.length || 0);
members?.forEach(m => {
  console.log('  - Org:', m.organization_id, 'Role:', m.member_role, 'Status:', m.status);
});
