import "server-only";

import { db } from "@/lib/supabase/pool";
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
  if (!db) return { ok: false as const, reason: "Supabase service role is not configured" };

  if (input.mode === "create") {
    const slug = await uniqueOrganizationSlug(input.organizationName);
    const organization = await db.organization.create({
      data: {
        slug,
        name: input.organizationName,
        orgType: "company",
        status: "active",
        createdBy: input.userId,
      },
      select: { id: true, slug: true, name: true },
    });

    if (!organization) return { ok: false as const, reason: "Organization insert failed" };

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

  const invite = await db.organizationInvite.findUnique({
    where: { code: input.inviteCode.trim().toUpperCase() },
    select: { organizationId: true, memberRole: true, status: true, expiresAt: true },
  });

  if (!invite) return { ok: false as const, reason: "邀请码不存在或已失效" };
  if (invite.status !== "active") return { ok: false as const, reason: "邀请码已失效" };
  if (invite.expiresAt && invite.expiresAt.getTime() < Date.now()) {
    return { ok: false as const, reason: "邀请码已过期" };
  }

  const profileResult = await upsertProfile(input.userId, {
    email: input.email,
    displayName: input.displayName,
    role: input.role,
    organizationId: invite.organizationId,
  });
  if (!profileResult.ok) return profileResult;

  const memberResult = await upsertOrganizationMember(invite.organizationId, input.userId, invite.memberRole === "admin" ? "admin" : "member");
  if (!memberResult.ok) return memberResult;

  return { ok: true as const };
}

export async function upsertProfile(
  userId: string,
  input: { email?: string | null; displayName?: string | null; role?: string | null; organizationId?: string | null },
) {
  if (!db) return { ok: false as const, reason: "Supabase service role is not configured" };

  try {
    await db.profile.upsert({
      where: { id: userId },
      create: {
        id: userId,
        email: input.email ?? null,
        displayName: input.displayName ?? null,
        role: input.role ?? null,
        defaultOrganizationId: input.organizationId ?? null,
        updatedAt: new Date(),
      },
      update: {
        email: input.email ?? null,
        displayName: input.displayName ?? null,
        role: input.role ?? null,
        defaultOrganizationId: input.organizationId ?? null,
        updatedAt: new Date(),
      },
    });

    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error ? error.message : "Profile upsert failed" };
  }
}

async function upsertOrganizationMember(organizationId: string, userId: string, memberRole: "admin" | "member") {
  if (!db) return { ok: false as const, reason: "Supabase service role is not configured" };

  try {
    await db.organizationMember.upsert({
      where: { organizationId_userId: { organizationId, userId } },
      create: {
        organizationId,
        userId,
        memberRole,
        status: "active",
        joinedAt: new Date(),
      },
      update: {
        memberRole,
        status: "active",
        joinedAt: new Date(),
      },
    });

    return { ok: true as const };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error ? error.message : "Organization member upsert failed" };
  }
}

export async function createInviteForOrganization(organizationId: string, userId: string) {
  if (!db) return { ok: false as const, reason: "Supabase service role is not configured" };

  const memberships = await getUserMemberships(userId);
  const membership = memberships.find((item) => item.organizationId === organizationId);
  if (!isOrganizationAdmin(membership)) return { ok: false as const, reason: "Only organization admins can create invites" };

  const code = await uniqueInviteCode();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

  const invite = await db.organizationInvite.create({
    data: {
      organizationId,
      code,
      memberRole: "member",
      status: "active",
      expiresAt,
      createdBy: userId,
    },
    select: { code: true, expiresAt: true },
  });

  if (!invite) return { ok: false as const, reason: "Invite insert failed" };
  return { ok: true as const, code: invite.code, expiresAt: invite.expiresAt?.toISOString() ?? null };
}

export async function getPersonalDashboardData(userId: string) {
  if (!db) {
    return { reports: [] as PersonalReportItem[], toolSessions: [] as PersonalToolSessionItem[] };
  }

  try {
    const [reportsRows, toolsRows] = await Promise.all([
      db.report.findMany({
        where: { userId },
        select: {
          id: true,
          createdAt: true,
          stageLevel: true,
          nextLevel: true,
          primaryBottleneck: true,
          chainScore: true,
          charterScore: true,
        },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.toolSession.findMany({
        where: { userId },
        select: {
          id: true,
          toolId: true,
          context: true,
          responses: true,
          outputs: true,
          submittedAt: true,
        },
        orderBy: { submittedAt: "desc" },
        take: 30,
      }),
    ]);

    return {
      reports: reportsRows.map((row) => ({
        id: row.id,
        createdAt: row.createdAt.toISOString(),
        stageLevel: row.stageLevel,
        nextLevel: row.nextLevel,
        primaryBottleneck: row.primaryBottleneck,
        chainScore: row.chainScore ? Number(row.chainScore) : null,
        charterScore: row.charterScore ? Number(row.charterScore) : null,
      })),
      toolSessions: mapToolSessionRows(toolsRows),
    };
  } catch {
    return { reports: [] as PersonalReportItem[], toolSessions: [] as PersonalToolSessionItem[] };
  }
}

export async function getOrganizationDashboardData(userId: string): Promise<OrganizationDashboardData> {
  const memberships = await getUserMemberships(userId);
  const profile = await getUserProfile(userId);
  const membership =
    memberships.find((item) => item.organizationId === profile?.defaultOrganizationId) ??
    memberships.find((item) => item.memberRole === "admin") ??
    memberships[0] ??
    null;

  if (!db || !membership || !isOrganizationAdmin(membership)) {
    return { membership, members: [], invites: [], runs: [], reports: [], toolSessions: [] };
  }

  try {
    const [
      memberRows,
      inviteRows,
      runRows,
      participants,
      toolSessionsRows,
    ] = await Promise.all([
      db.organizationMember.findMany({
        where: { organizationId: membership.organizationId, status: "active" },
        select: { userId: true, memberRole: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      }),
      db.organizationInvite.findMany({
        where: { organizationId: membership.organizationId },
        select: { code: true, status: true, expiresAt: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      db.event.findMany({
        where: { organizationId: membership.organizationId },
        select: { slug: true, title: true, status: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
      db.participant.findMany({
        where: { organizationId: membership.organizationId },
        select: { id: true },
      }),
      db.toolSession.findMany({
        where: { organizationId: membership.organizationId },
        select: {
          id: true,
          toolId: true,
          context: true,
          responses: true,
          outputs: true,
          submittedAt: true,
        },
        orderBy: { submittedAt: "desc" },
        take: 50,
      }),
    ]);

    const memberUserIds = memberRows.map((member) => member.userId);
    let profileById = new Map<string, { id: string; email: string | null; displayName: string | null; role: string | null }>();
    if (memberUserIds.length) {
      const profileRows = await db.profile.findMany({
        where: { id: { in: memberUserIds } },
        select: { id: true, email: true, displayName: true, role: true },
      });
      profileById = new Map(profileRows.map((p) => [p.id, p]));
    }

    const participantIds = participants.map((p) => p.id);
    let reports: PersonalReportItem[] = [];
    if (participantIds.length) {
      const assessmentRows = await db.assessment.findMany({
        where: { participantId: { in: participantIds } },
        select: { id: true },
      });
      const assessmentIds = assessmentRows.map((a) => a.id);
      if (assessmentIds.length) {
        const reportRows = await db.report.findMany({
          where: { assessmentId: { in: assessmentIds } },
          select: {
            id: true,
            createdAt: true,
            stageLevel: true,
            nextLevel: true,
            primaryBottleneck: true,
            chainScore: true,
            charterScore: true,
          },
          orderBy: { createdAt: "desc" },
          take: 50,
        });
        reports = reportRows.map((row) => ({
          id: row.id,
          createdAt: row.createdAt.toISOString(),
          stageLevel: row.stageLevel,
          nextLevel: row.nextLevel,
          primaryBottleneck: row.primaryBottleneck,
          chainScore: row.chainScore ? Number(row.chainScore) : null,
          charterScore: row.charterScore ? Number(row.charterScore) : null,
        }));
      }
    }

    return {
      membership,
      members: memberRows.map((row) => {
        const profileRow = profileById.get(row.userId);
        return {
          userId: row.userId,
          displayName: profileRow?.displayName,
          email: profileRow?.email,
          role: profileRow?.role,
          memberRole: row.memberRole,
          createdAt: row.createdAt.toISOString(),
        };
      }),
      invites: inviteRows.map((row) => ({
        code: row.code,
        status: row.status,
        expiresAt: row.expiresAt?.toISOString() ?? null,
        createdAt: row.createdAt.toISOString(),
      })),
      runs: runRows.map((row) => ({
        slug: row.slug,
        title: row.title,
        status: row.status,
        createdAt: row.createdAt?.toISOString() ?? null,
      })),
      reports,
      toolSessions: mapToolSessionRows(toolSessionsRows),
    };
  } catch {
    return { membership, members: [], invites: [], runs: [], reports: [], toolSessions: [] };
  }
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

function mapToolSessionRows(rows: {
  id: string;
  toolId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  context?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  responses?: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  outputs?: any;
  submittedAt: Date;
}[]): PersonalToolSessionItem[] {
  return rows.map((row) => ({
    id: row.id,
    toolId: row.toolId,
    toolName: getTool(row.toolId)?.name ?? row.toolId,
    submittedAt: row.submittedAt.toISOString(),
    useCase: row.context?.useCase as string | undefined,
    dataScope: row.context?.dataScope as string | undefined,
    nextAction: typeof row.outputs?.nextAction === "string" ? row.outputs.nextAction : undefined,
    context: (row.context ?? {}) as Record<string, string | undefined>,
    responses: (row.responses ?? {}) as Record<string, string>,
    insightReport: row.outputs?.report as Record<string, unknown> | undefined,
  }));
}

async function uniqueOrganizationSlug(name: string) {
  const base = slugify(name) || "organization";
  if (!db) return `${base}-${Date.now().toString(36)}`;

  for (let index = 0; index < 8; index += 1) {
    const suffix = index === 0 ? "" : `-${randomText(4).toLowerCase()}`;
    const slug = `${base}${suffix}`;
    const existing = await db.organization.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) return slug;
  }

  return `${base}-${Date.now().toString(36)}`;
}

async function uniqueInviteCode() {
  for (let index = 0; index < 8; index += 1) {
    const code = randomText(8);
    if (!db) return code;
    const existing = await db.organizationInvite.findUnique({ where: { code }, select: { id: true } });
    if (!existing) return code;
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
