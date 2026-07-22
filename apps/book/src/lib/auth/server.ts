import "server-only";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/supabase/pool";

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

/**
 * Get the current authenticated user from NextAuth session.
 * Use this in Server Components and Route Handlers.
 */
export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  return {
    id: session.user.id,
    email: session.user.email ?? null,
    role: (session.user as { role?: string }).role ?? null,
  };
}

/**
 * Require authentication. Redirects to /book/login if not logged in.
 */
export async function requireUser(nextPath?: string) {
  const user = await getCurrentUser();
  if (!user) {
    const suffix = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/book/login${suffix}`);
  }
  return user;
}

/**
 * Get user profile from database.
 */
export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  if (!db) return null;

  const profile = await db.profile.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      defaultOrganizationId: true,
    },
  });

  if (!profile) return null;

  return {
    id: profile.id,
    email: profile.email ?? null,
    displayName: profile.displayName ?? null,
    role: profile.role ?? null,
    defaultOrganizationId: profile.defaultOrganizationId ?? null,
  };
}

/**
 * Get user's organization memberships.
 */
export async function getUserMemberships(userId: string): Promise<OrganizationMembership[]> {
  if (!db) return [];

  const memberships = await db.organizationMember.findMany({
    where: {
      userId,
      status: "active",
    },
    select: {
      organizationId: true,
      memberRole: true,
      status: true,
      organization: {
        select: {
          slug: true,
          name: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return memberships.map((m) => ({
    organizationId: m.organizationId,
    organizationSlug: m.organization.slug,
    organizationName: m.organization.name,
    memberRole: m.memberRole as "admin" | "member",
    status: m.status,
  }));
}

/**
 * Get the complete user workspace (profile + memberships).
 */
export async function getUserWorkspace(userId: string) {
  const [profile, memberships] = await Promise.all([
    getUserProfile(userId),
    getUserMemberships(userId),
  ]);

  const defaultMembership =
    memberships.find(
      (m) => m.organizationId === profile?.defaultOrganizationId
    ) ?? memberships[0] ?? null;

  return { profile, memberships, defaultMembership };
}

/**
 * Check if a membership has admin role.
 */
export function isOrganizationAdmin(
  membership: OrganizationMembership | null | undefined
) {
  return membership?.memberRole === "admin";
}
