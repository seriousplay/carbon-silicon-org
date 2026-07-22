import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";

export type UserProfile = {
  id: string;
  email: string | null;
  displayName: string | null;
  role: string | null;
  defaultOrganizationId: string | null;
};

export type OrganizationMembership = {
  organizationId: string;
  organizationSlug: string;
  organizationName: string;
  memberRole: "admin" | "member";
  status: string;
};

export async function createServerSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot set cookies. Middleware and route handlers refresh sessions.
        }
      },
    },
  });
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return null;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function requireUser(nextPath?: string) {
  const user = await getCurrentUser();
  if (!user) {
    const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${suffix}`);
  }
  return user;
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id,email,display_name,role,default_organization_id")
    .eq("id", userId)
    .maybeSingle();

  if (!data) return null;

  return {
    id: String(data.id),
    email: data.email ?? null,
    displayName: data.display_name ?? null,
    role: data.role ?? null,
    defaultOrganizationId: data.default_organization_id ?? null,
  };
}

export async function getUserMemberships(userId: string): Promise<OrganizationMembership[]> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return [];

  const { data } = await supabase
    .from("organization_members")
    .select("organization_id,member_role,status,organizations(slug,name)")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("created_at", { ascending: true });

  return ((data ?? []) as Array<{
    organization_id: string;
    member_role: "admin" | "member";
    status: string;
    organizations: { slug: string; name: string } | { slug: string; name: string }[] | null;
  }>).flatMap((row) => {
    const organization = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations;
    if (!organization) return [];
    return {
      organizationId: row.organization_id,
      organizationSlug: organization.slug,
      organizationName: organization.name,
      memberRole: row.member_role,
      status: row.status,
    };
  });
}

export async function getUserWorkspace(userId: string) {
  const [profile, memberships] = await Promise.all([getUserProfile(userId), getUserMemberships(userId)]);
  const defaultMembership =
    memberships.find((membership) => membership.organizationId === profile?.defaultOrganizationId) ?? memberships[0] ?? null;

  return { profile, memberships, defaultMembership };
}

export function isOrganizationAdmin(membership: OrganizationMembership | null | undefined) {
  return membership?.memberRole === "admin";
}
