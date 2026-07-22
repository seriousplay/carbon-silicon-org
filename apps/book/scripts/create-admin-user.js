#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error("Missing environment variables:");
  console.error("  NEXT_PUBLIC_SUPABASE_URL:", url ? "✓" : "✗");
  console.error("  SUPABASE_SERVICE_ROLE_KEY:", serviceRoleKey ? "✓" : "✗");
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createAdminUser(email, password, displayName) {
  try {
    console.log(`\nCreating admin user: ${email}`);

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error("Failed to create user");

    const userId = authData.user.id;
    console.log(`✓ Auth user created: ${userId}`);

    // 2. Create profile
    const { error: profileError } = await supabase.from("profiles").insert({
      id: userId,
      email,
      display_name: displayName,
      role: "admin",
    });

    if (profileError) throw profileError;
    console.log(`✓ Profile created`);

    // 3. Create organization
    const orgSlug = email.split("@")[0] + "-org";
    const { data: orgData, error: orgError } = await supabase
      .from("organizations")
      .insert({
        slug: orgSlug,
        name: `${displayName}'s Organization`,
        org_type: "company",
        status: "active",
        created_by: userId,
      })
      .select()
      .single();

    if (orgError) throw orgError;
    console.log(`✓ Organization created: ${orgData.id} (${orgSlug})`);

    // 4. Add user as admin member
    const { error: memberError } = await supabase.from("organization_members").insert({
      organization_id: orgData.id,
      user_id: userId,
      member_role: "admin",
      status: "active",
      joined_at: new Date().toISOString(),
    });

    if (memberError) throw memberError;
    console.log(`✓ User added as admin member`);

    // 5. Set default organization
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ default_organization_id: orgData.id })
      .eq("id", userId);

    if (updateError) throw updateError;
    console.log(`✓ Default organization set`);

    console.log("\n✅ Admin user created successfully!");
    console.log(`\nLogin credentials:`);
    console.log(`  Email: ${email}`);
    console.log(`  Password: ${password}`);
    console.log(`\nOrganization:`);
    console.log(`  ID: ${orgData.id}`);
    console.log(`  Slug: ${orgSlug}`);
    console.log(`  Name: ${displayName}'s Organization`);
    console.log(`\nYou can now login at: http://47.95.199.142/login`);

    return { userId, orgId: orgData.id, orgSlug };
  } catch (error) {
    console.error("\n❌ Error creating admin user:", error.message);
    process.exit(1);
  }
}

// Get arguments
const email = process.argv[2];
const password = process.argv[3];
const displayName = process.argv[4] || email.split("@")[0];

if (!email || !password) {
  console.error("Usage: node create-admin-user.js <email> <password> [displayName]");
  console.error("\nExample:");
  console.error("  node create-admin-user.js admin@example.com mypassword \"Admin User\"");
  process.exit(1);
}

createAdminUser(email, password, displayName);
