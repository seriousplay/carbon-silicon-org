import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getTool } from "@/lib/tools/tool-library";
import { getUserMemberships, getUserProfile, isOrganizationAdmin, type OrganizationMembership } from "@/lib/auth/server";

export type OnboardingInput =
  | {
      mode: "create";
      displayName: string;
      role?: string;
      organizationName: string;
      userId: string;
      email?: string | null;
    }
  | {
      mode: "join";
      displayName: string;
      role?: string;
      inviteCode: string;
      userId: string;
      email?: string | null;
    };

export type PersonalReportItem = {
  id: string;
  createdAt: string;
  stageLevel?: string | null;
  nextLevel?: string | null;
  primaryBottleneck?: string | null;
  chainScore?: number | null;
  charterScore?: number | null;
};

export type PersonalToolSessionItem = {
  id: string;
  toolId: string;
  toolName: string;
  submittedAt: string;
  useCase?: string;
  dataScope?: string;
  nextAction?: string;
  context?: Record<string, string | undefined>;
  responses?: Record<string, string>;
  insightReport?: unknown;
};

export type OrganizationDashboardData = {
  membership: OrganizationMembership | null;
  members: {
    userId: string;
    displayName?: string | null;
    email?: string | null;
    role?: string | null;
    memberRole: string;
    createdAt: string;
  }[];
  invites: {
    code: string;
    status: string;
    expiresAt?: string | null;
    createdAt: string;
  }[];
  runs: {
    slug: string;
    title: string;
    status: string;
    createdAt?: string | null;
  }[];
  reports: PersonalReportItem[];
  toolSessions: PersonalToolSessionItem[];
};

export async function completeOnboarding(input: OnboardingInput) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false as const, reason: "Supabase service role is not configured" };

  if (input.mode === "create") {
    const slug = await uniqueOrganizationSlug(input.organizationName);
    const { data: organization, error: orgError } = await supabase
      .from("organizations")
      .insert({
        slug,
        name: input.organizationName,
        org_type: "company",
        status: "active",
        created_by: input.userId,
      })
      .select("id,slug,name")
      .single();

    if (orgError || !organization) return { ok: false as const, reason: orgError?.message ?? "Organization insert failed" };

    const profileResult = await upsertProfile(input.userId, {
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      organizationId: organization.id,
    });
    if (!profileResult.ok) return profileResult;

    const memberResult = await upsertOrganizationMember(organization.id, input.userId, "admin");
    if (!memberResult.ok) return memberResult;

    await createInviteForOrganization(organization.id, input.userId);
    return { ok: true as const, organizationSlug: organization.slug };
  }

  const { data: invite, error: inviteError } = await supabase
    .from("organization_invites")
    .select("organization_id,member_role,status,expires_at")
    .eq("code", input.inviteCode.trim().toUpperCase())
    .maybeSingle();

  if (inviteError || !invite) return { ok: false as const, reason: "邀请码不存在或已失效" };
  if (invite.status !== "active") return { ok: false as const, reason: "邀请码已失效" };
  if (invite.expires_at && new Date(invite.expires_at).getTime() < Date.now()) {
    return { ok: false as const, reason: "邀请码已过期" };
  }

  const profileResult = await upsertProfile(input.userId, {
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    organizationId: invite.organization_id,
  });
  if (!profileResult.ok) return profileResult;

  const memberResult = await upsertOrganizationMember(invite.organization_id, input.userId, invite.member_role === "admin" ? "admin" : "member");
  if (!memberResult.ok) return memberResult;

  return { ok: true as const };
}

export async function upsertProfile(
  userId: string,
  input: { email?: string | null; displayName?: string | null; role?: string | null; organizationId?: string | null },
) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false as const, reason: "Supabase service role is not configured" };

  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      email: input.email ?? null,
      display_name: input.displayName ?? null,
      role: input.role ?? null,
      default_organization_id: input.organizationId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}

async function upsertOrganizationMember(organizationId: string, userId: string, memberRole: "admin" | "member") {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false as const, reason: "Supabase service role is not configured" };

  const { error } = await supabase.from("organization_members").upsert(
    {
      organization_id: organizationId,
      user_id: userId,
      member_role: memberRole,
      status: "active",
      joined_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,user_id" },
  );

  if (error) return { ok: false as const, reason: error.message };
  return { ok: true as const };
}

export async function createInviteForOrganization(organizationId: string, userId: string) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return { ok: false as const, reason: "Supabase service role is not configured" };

  const memberships = await getUserMemberships(userId);
  const membership = memberships.find((item) => item.organizationId === organizationId);
  if (!isOrganizationAdmin(membership)) return { ok: false as const, reason: "Only organization admins can create invites" };

  const code = await uniqueInviteCode();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  const { data, error } = await supabase
    .from("organization_invites")
    .insert({
      organization_id: organizationId,
      code,
      member_role: "member",
      status: "active",
      expires_at: expiresAt,
      created_by: userId,
    })
    .select("code,expires_at")
    .single();

  if (error || !data) return { ok: false as const, reason: error?.message ?? "Invite insert failed" };
  return { ok: true as const, code: data.code as string, expiresAt: data.expires_at as string | null };
}

export async function getPersonalDashboardData(userId: string) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return { reports: [] as PersonalReportItem[], toolSessions: [] as PersonalToolSessionItem[] };
  }

  const [reportsResult, toolsResult] = await Promise.all([
    supabase
      .from("reports")
      .select("id,created_at,stage_level,next_level,primary_bottleneck,chain_score,charter_score")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("tool_sessions")
      .select("id,tool_id,context,responses,outputs,submitted_at")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: false })
      .limit(30),
  ]);

  return {
    reports: ((reportsResult.data ?? []) as Array<{
      id: string;
      created_at: string;
      stage_level?: string | null;
      next_level?: string | null;
      primary_bottleneck?: string | null;
      chain_score?: number | null;
      charter_score?: number | null;
    }>).map((row) => ({
      id: row.id,
      createdAt: row.created_at,
      stageLevel: row.stage_level,
      nextLevel: row.next_level,
      primaryBottleneck: row.primary_bottleneck,
      chainScore: row.chain_score,
      charterScore: row.charter_score,
    })),
    toolSessions: mapToolSessionRows(toolsResult.data ?? []),
  };
}

export async function getOrganizationDashboardData(userId: string): Promise<OrganizationDashboardData> {
  const supabase = createAdminSupabaseClient();
  const memberships = await getUserMemberships(userId);
  const profile = await getUserProfile(userId);
  const membership =
    memberships.find((item) => item.organizationId === profile?.defaultOrganizationId) ??
    memberships.find((item) => item.memberRole === "admin") ??
    memberships[0] ??
    null;

  if (!supabase || !membership || !isOrganizationAdmin(membership)) {
    return { membership, members: [], invites: [], runs: [], reports: [], toolSessions: [] };
  }

  const [membersResult, invitesResult, runsResult, participantsResult, toolSessionsResult] = await Promise.all([
    supabase
      .from("organization_members")
      .select("user_id,member_role,created_at")
      .eq("organization_id", membership.organizationId)
      .eq("status", "active")
      .order("created_at", { ascending: true }),
    supabase
      .from("organization_invites")
      .select("code,status,expires_at,created_at")
      .eq("organization_id", membership.organizationId)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("events")
      .select("slug,title,status,created_at")
      .eq("organization_id", membership.organizationId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("participants").select("id").eq("organization_id", membership.organizationId),
    supabase
      .from("tool_sessions")
      .select("id,tool_id,context,responses,outputs,submitted_at")
      .eq("organization_id", membership.organizationId)
      .order("submitted_at", { ascending: false })
      .limit(50),
  ]);

  const memberRows = (membersResult.data ?? []) as Array<{ user_id: string; member_role: string; created_at: string }>;
  const memberUserIds = memberRows.map((member) => member.user_id);
  const { data: profileRows } = memberUserIds.length
    ? await supabase.from("profiles").select("id,email,display_name,role").in("id", memberUserIds)
    : { data: [] };
  const profileById = new Map(
    ((profileRows ?? []) as Array<{ id: string; email?: string | null; display_name?: string | null; role?: string | null }>).map((profile) => [profile.id, profile]),
  );

  const participantIds = ((participantsResult.data ?? []) as { id: string }[]).map((participant) => participant.id);
  let reports: PersonalReportItem[] = [];
  if (participantIds.length) {
    const { data: assessments } = await supabase.from("assessments").select("id").in("participant_id", participantIds);
    const assessmentIds = ((assessments ?? []) as { id: string }[]).map((assessment) => assessment.id);
    if (assessmentIds.length) {
      const { data: reportRows } = await supabase
        .from("reports")
        .select("id,created_at,stage_level,next_level,primary_bottleneck,chain_score,charter_score")
        .in("assessment_id", assessmentIds)
        .order("created_at", { ascending: false })
        .limit(50);
      reports = ((reportRows ?? []) as Array<{
        id: string;
        created_at: string;
        stage_level?: string | null;
        next_level?: string | null;
        primary_bottleneck?: string | null;
        chain_score?: number | null;
        charter_score?: number | null;
      }>).map((row) => ({
        id: row.id,
        createdAt: row.created_at,
        stageLevel: row.stage_level,
        nextLevel: row.next_level,
        primaryBottleneck: row.primary_bottleneck,
        chainScore: row.chain_score,
        charterScore: row.charter_score,
      }));
    }
  }

  return {
    membership,
    members: memberRows.map((row) => {
      const profileRow = profileById.get(row.user_id);
      return {
        userId: row.user_id,
        displayName: profileRow?.display_name,
        email: profileRow?.email,
        role: profileRow?.role,
        memberRole: row.member_role,
        createdAt: row.created_at,
      };
    }),
    invites: ((invitesResult.data ?? []) as Array<{ code: string; status: string; expires_at?: string | null; created_at: string }>).map((row) => ({
      code: row.code,
      status: row.status,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    })),
    runs: ((runsResult.data ?? []) as Array<{ slug: string; title: string; status: string; created_at?: string | null }>).map((row) => ({
      slug: row.slug,
      title: row.title,
      status: row.status,
      createdAt: row.created_at,
    })),
    reports,
    toolSessions: mapToolSessionRows(toolSessionsResult.data ?? []),
  };
}

export async function exportOrganizationDataCsv(userId: string) {
  const data = await getOrganizationDashboardData(userId);
  if (!data.membership || !isOrganizationAdmin(data.membership)) {
    return { ok: false as const, reason: "Only organization admins can export organization data" };
  }

  const rows = [
    [
      "type",
      "id",
      "name",
      "stage_or_tool",
      "submitted_at",
      "detail",
      "context_json",
      "responses_json",
      "insight_report_json",
    ],
    ...data.reports.map((report) => [
      "report",
      report.id,
      "",
      report.stageLevel ?? "",
      report.createdAt,
      `next=${report.nextLevel ?? ""}; bottleneck=${report.primaryBottleneck ?? ""}; chain=${report.chainScore ?? ""}; charter=${report.charterScore ?? ""}`,
      "",
      "",
      "",
    ]),
    ...data.toolSessions.map((session) => [
      "tool_session",
      session.id,
      session.toolName,
      session.toolId,
      session.submittedAt,
      `useCase=${session.useCase ?? ""}; dataScope=${session.dataScope ?? ""}; nextAction=${session.nextAction ?? ""}`,
      formatJson(session.context ?? {}),
      formatJson(session.responses ?? {}),
      session.insightReport ? formatJson(session.insightReport) : "",
    ]),
  ];

  return {
    ok: true as const,
    filename: `${data.membership.organizationSlug}-organization-data.csv`,
    csv: rows.map((row) => row.map(escapeCsv).join(",")).join("\n"),
  };
}

function mapToolSessionRows(rows: unknown[]): PersonalToolSessionItem[] {
  return (rows as Array<{
    id: string;
    tool_id: string;
    context?: Record<string, string | undefined> | null;
    responses?: Record<string, string> | null;
    outputs?: Record<string, unknown> | null;
    submitted_at: string;
  }>).map((row) => ({
    id: row.id,
    toolId: row.tool_id,
    toolName: getTool(row.tool_id)?.name ?? row.tool_id,
    submittedAt: row.submitted_at,
    useCase: row.context?.useCase,
    dataScope: row.context?.dataScope,
    nextAction: typeof row.outputs?.nextAction === "string" ? row.outputs.nextAction : undefined,
    context: row.context ?? {},
    responses: row.responses ?? {},
    insightReport: row.outputs?.report,
  }));
}

async function uniqueOrganizationSlug(name: string) {
  const base = slugify(name) || "organization";
  const supabase = createAdminSupabaseClient();
  if (!supabase) return `${base}-${Date.now().toString(36)}`;

  for (let index = 0; index < 8; index += 1) {
    const suffix = index === 0 ? "" : `-${randomText(4).toLowerCase()}`;
    const slug = `${base}${suffix}`;
    const { data } = await supabase.from("organizations").select("id").eq("slug", slug).maybeSingle();
    if (!data) return slug;
  }

  return `${base}-${Date.now().toString(36)}`;
}

async function uniqueInviteCode() {
  const supabase = createAdminSupabaseClient();
  for (let index = 0; index < 8; index += 1) {
    const code = randomText(8);
    if (!supabase) return code;
    const { data } = await supabase.from("organization_invites").select("id").eq("code", code).maybeSingle();
    if (!data) return code;
  }
  return randomText(10);
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function randomText(length: number) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join("");
}

function escapeCsv(value: unknown) {
  const text = String(value ?? "");
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function formatJson(value: unknown) {
  return JSON.stringify(value ?? {});
}
