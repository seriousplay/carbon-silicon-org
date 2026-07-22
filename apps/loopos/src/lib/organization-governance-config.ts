import { prisma } from "@/lib/db";

export const defaultTerminology = {
  circle: "回路",
  role: "角色",
  tension: "张力",
  tacticalMeeting: "战术会",
  governanceMeeting: "治理会",
  coach: "教练",
} as const;

export type OrganizationTerminology = typeof defaultTerminology;

export type OrganizationProfile = {
  organizationType: "FOUNDATION_MODEL" | "LEAN" | "PROFESSIONAL_SERVICES" | "FUNCTIONAL" | "CUSTOM";
  meetingCadence: "WEEKLY" | "BIWEEKLY" | "MONTHLY" | "CUSTOM";
  roleCategories: string[];
};

export const defaultOrganizationProfile: OrganizationProfile = {
  organizationType: "CUSTOM",
  meetingCadence: "WEEKLY",
  roleCategories: ["负责人", "专家", "运营", "教练"],
};

const ROLE_CATEGORY_KEYS = ["CIRCLE_LEAD", "EXPERT", "OPERATIONS", "COACH"] as const;

export function organizationRoleCategoryLabel(profile: OrganizationProfile, category: string): string {
  const index = ROLE_CATEGORY_KEYS.indexOf(category as (typeof ROLE_CATEGORY_KEYS)[number]);
  return index >= 0 ? profile.roleCategories[index] ?? category : category;
}

function normalizeOrganizationProfile(value: unknown): OrganizationProfile {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return defaultOrganizationProfile;
  const candidate = value as Record<string, unknown>;
  const organizationType = ["FOUNDATION_MODEL", "LEAN", "PROFESSIONAL_SERVICES", "FUNCTIONAL", "CUSTOM"].includes(String(candidate.organizationType))
    ? String(candidate.organizationType) as OrganizationProfile["organizationType"]
    : defaultOrganizationProfile.organizationType;
  const meetingCadence = ["WEEKLY", "BIWEEKLY", "MONTHLY", "CUSTOM"].includes(String(candidate.meetingCadence))
    ? String(candidate.meetingCadence) as OrganizationProfile["meetingCadence"]
    : defaultOrganizationProfile.meetingCadence;
  const roleCategories = Array.isArray(candidate.roleCategories)
    ? candidate.roleCategories.filter((item): item is string => typeof item === "string" && item.trim().length > 0).map((item) => item.trim().slice(0, 40)).slice(0, 12)
    : [];
  return { organizationType, meetingCadence, roleCategories: roleCategories.length > 0 ? roleCategories : defaultOrganizationProfile.roleCategories };
}

export async function getOrganizationGovernanceConfig(organizationId: string) {
  const latest = await prisma.organizationGovernanceConfigVersion.findFirst({
    where: { organizationId, effectiveAt: { lte: new Date() } },
    orderBy: [{ version: "desc" }, { effectiveAt: "desc" }],
  });
  return {
    version: latest?.version ?? 0,
    terminology: { ...defaultTerminology, ...(latest?.terminologyPreferences as Partial<OrganizationTerminology> | undefined) },
    rules: (latest?.governanceRules ?? {}) as Record<string, unknown>,
    profile: normalizeOrganizationProfile((latest?.governanceRules as Record<string, unknown> | null)?.organizationProfile),
  };
}
