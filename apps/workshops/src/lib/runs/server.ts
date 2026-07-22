import "server-only";

import { db } from "@/lib/supabase/pool";
import { getUserMemberships, isOrganizationAdmin } from "@/lib/auth/server";
import { defaultRun, fallbackRuns } from "./default-runs";
import type { AssessmentRun, CreateRunInput, RunStatus, RunType } from "./types";

const guestAssessmentRunSlugs = new Set(["20260517-hr-od-workshop"]);

export function canSubmitAssessmentAsGuest(slug: string) {
  return guestAssessmentRunSlugs.has(slug);
}

function formatDateLabel(value: string | null | undefined) {
  if (!value) return undefined;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function normalizeRun(row: {
  id: string;
  slug: string;
  title: string;
  eventDate: Date | null;
  accessCode: string | null;
  status: string;
  runType?: string | null;
  audience?: string | null;
  description?: string | null;
  organizationId?: string | null;
  showOnHome?: boolean | null;
  createdAt?: Date | null;
}): AssessmentRun {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    runType: (row.runType as RunType | undefined) ?? "workshop",
    status: (row.status as RunStatus | undefined) ?? "draft",
    audience: row.audience ?? defaultRun.audience,
    description: row.description ?? defaultRun.description,
    organizationId: row.organizationId ?? null,
    showOnHome: Boolean(row.showOnHome),
    dateLabel: formatDateLabel(row.eventDate ? row.eventDate.toISOString().slice(0, 10) : null),
    accessCode: row.accessCode ?? undefined,
    createdAt: row.createdAt?.toISOString() ?? undefined,
  };
}

async function selectEvents() {
  if (!db) return null;
  try {
    return await db.event.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return null;
  }
}

export async function getAssessmentRuns(): Promise<AssessmentRun[]> {
  const rows = await selectEvents();
  if (!rows) return fallbackRuns;

  const runs = rows.map(normalizeRun);
  const counts = await getRunCounts(runs.map((run) => run.slug));

  return runs.map((run) => ({
    ...run,
    participantCount: counts[run.slug]?.participants ?? 0,
    completedCount: counts[run.slug]?.completed ?? 0,
  }));
}

export async function getHomeAssessmentRuns(): Promise<AssessmentRun[]> {
  const runs = await getAssessmentRuns();
  return runs.filter((run) => run.showOnHome);
}

export async function getAssessmentRunsForOrganization(organizationId: string): Promise<AssessmentRun[]> {
  if (!db) return [];

  try {
    const rows = await db.event.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
    });

    const runs = rows.map(normalizeRun);
    const counts = await getRunCounts(runs.map((run) => run.slug));

    return runs.map((run) => ({
      ...run,
      participantCount: counts[run.slug]?.participants ?? 0,
      completedCount: counts[run.slug]?.completed ?? 0,
    }));
  } catch {
    return [];
  }
}

export async function getAssessmentRun(slug: string): Promise<AssessmentRun | null> {
  if (!db) return fallbackRuns.find((run) => run.slug === slug) ?? null;

  const row = await db.event.findUnique({
    where: { slug },
  });

  if (!row) return fallbackRuns.find((run) => run.slug === slug) ?? null;
  return normalizeRun(row);
}

export async function createAssessmentRun(input: CreateRunInput, owner?: { userId: string; organizationId: string }) {
  if (!db) {
    return { ok: false as const, reason: "Supabase service role is not configured" };
  }

  try {
    const row = await db.event.create({
      data: {
        slug: input.slug,
        title: input.title,
        eventDate: input.date ? new Date(input.date) : null,
        accessCode: input.accessCode || null,
        status: input.status,
        runType: input.runType,
        audience: input.audience || null,
        description: input.description || null,
        organizationId: owner?.organizationId ?? null,
        createdBy: owner?.userId ?? null,
        showOnHome: Boolean(input.showOnHome),
      },
    });

    return { ok: true as const, run: normalizeRun(row) };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error ? error.message : "Run insert failed" };
  }
}

export async function updateAssessmentRun(
  slug: string,
  input: Partial<Pick<CreateRunInput, "title" | "status" | "audience" | "description" | "accessCode" | "showOnHome">>,
) {
  if (!db) {
    return { ok: false as const, reason: "Supabase service role is not configured" };
  }

  const payload: Record<string, string | boolean | null> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.status !== undefined) payload.status = input.status;
  if (input.audience !== undefined) payload.audience = input.audience || null;
  if (input.description !== undefined) payload.description = input.description || null;
  if (input.accessCode !== undefined) payload.accessCode = input.accessCode || null;
  if (input.showOnHome !== undefined) payload.showOnHome = input.showOnHome;

  try {
    const row = await db.event.update({
      where: { slug },
      data: payload,
    });

    return { ok: true as const, run: normalizeRun(row) };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error ? error.message : "Run not found" };
  }
}

export async function verifyRunAccessCode(slug: string, accessCode: string | undefined) {
  if (!db) {
    const fallback = fallbackRuns.find((run) => run.slug === slug);
    return { ok: Boolean(fallback), required: Boolean(fallback?.accessCode) };
  }

  const event = await db.event.findUnique({
    where: { slug },
    select: { accessCode: true, status: true },
  });

  if (!event) return { ok: false, required: false, reason: "Run not found" };
  if (!["active", "draft"].includes(String(event.status))) return { ok: false, required: false, reason: "Run is not active" };
  if (!event.accessCode) return { ok: true, required: false };

  return {
    ok: event.accessCode === accessCode,
    required: true,
    reason: event.accessCode === accessCode ? undefined : "Access code does not match",
  };
}

export async function canAdministerRun(userId: string, slug: string) {
  if (!db) return false;

  const event = await db.event.findUnique({
    where: { slug },
    select: { organizationId: true },
  });

  if (!event) return false;

  const memberships = await getUserMemberships(userId);
  const adminMemberships = memberships.filter(isOrganizationAdmin);
  if (!adminMemberships.length) return false;

  if (!event.organizationId) return true;
  return adminMemberships.some((membership) => membership.organizationId === event.organizationId);
}

export async function cleanupTestParticipants(slug: string) {
  if (!db) {
    return { ok: false as const, reason: "Supabase service role is not configured" };
  }

  const event = await db.event.findUnique({
    where: { slug },
    select: { id: true },
  });
  if (!event?.id) {
    return { ok: false as const, reason: "Run not found" };
  }

  try {
    const participants = await db.participant.findMany({
      where: { eventId: event.id },
      select: { id: true, displayName: true, companyName: true, contact: true },
    });

    const testIds = participants
      .filter((participant) => {
        const text = `${participant.displayName} ${participant.companyName ?? ""} ${participant.contact ?? ""}`.toLowerCase();
        return /测试|test|codex|验收|演示|demo|smoke/.test(text);
      })
      .map((participant) => participant.id);

    if (!testIds.length) {
      return { ok: true as const, deleted: 0 };
    }

    await db.participant.deleteMany({
      where: { id: { in: testIds } },
    });

    return { ok: true as const, deleted: testIds.length };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error ? error.message : "Cleanup failed" };
  }
}

export async function exportRunCsv(slug: string) {
  if (!db) {
    return { ok: false as const, reason: "Supabase service role is not configured" };
  }

  const event = await db.event.findUnique({
    where: { slug },
    select: { id: true, title: true },
  });
  if (!event?.id) {
    return { ok: false as const, reason: "Run not found" };
  }

  try {
    const rows = await db.assessment.findMany({
      where: { eventId: event.id },
      select: {
        id: true,
        status: true,
        submittedAt: true,
        participant: {
          select: {
            displayName: true,
            role: true,
            industry: true,
            orgSize: true,
            companyName: true,
            contact: true,
            contactConsent: true,
          },
        },
        report: {
          select: {
            stageLevel: true,
            nextLevel: true,
            primaryBottleneck: true,
            chainScore: true,
            charterScore: true,
            openAnswers: true,
          },
        },
      },
      orderBy: { submittedAt: "desc" },
    });

    const header = [
      "submitted_at",
      "display_name",
      "role",
      "industry",
      "org_size",
      "company_name",
      "contact",
      "contact_consent",
      "status",
      "stage_level",
      "next_level",
      "primary_bottleneck",
      "chain_score",
      "charter_score",
      "open_scenario",
      "open_workflow",
      "open_blocker",
    ];

    const csvRows = rows.map((row) => {
      const p = row.participant;
      const r = row.report;
      const openAnswers = (r?.openAnswers ?? {}) as Record<string, string | undefined>;
      return [
        row.submittedAt?.toISOString() ?? "",
        p?.displayName ?? "",
        p?.role ?? "",
        p?.industry ?? "",
        p?.orgSize ?? "",
        p?.companyName ?? "",
        p?.contact ?? "",
        p?.contactConsent ? "yes" : "no",
        row.status,
        r?.stageLevel ?? "",
        r?.nextLevel ?? "",
        r?.primaryBottleneck ?? "",
        r?.chainScore ? String(r.chainScore) : "",
        r?.charterScore ? String(r.charterScore) : "",
        openAnswers.scenario ?? "",
        openAnswers.workflow ?? "",
        openAnswers.blocker ?? "",
      ];
    });

    return {
      ok: true as const,
      filename: `${slug}-assessment-export.csv`,
      csv: [header, ...csvRows].map((row) => row.map(escapeCsv).join(",")).join("\n"),
    };
  } catch (error) {
    return { ok: false as const, reason: error instanceof Error ? error.message : "Export failed" };
  }
}

function escapeCsv(value: string | number) {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

async function getRunCounts(slugs: string[]) {
  if (!db || !slugs.length) return {};

  try {
    const events = await db.event.findMany({
      where: { slug: { in: slugs } },
      select: { id: true, slug: true },
    });
    const eventIds = events.map((e) => e.id);
    if (!eventIds.length) return {};

    const slugById = Object.fromEntries(events.map((e) => [e.id, e.slug]));
    const counts: Record<string, { participants: number; completed: number }> = {};

    for (const slug of slugs) counts[slug] = { participants: 0, completed: 0 };

    const [participants, assessments] = await Promise.all([
      db.participant.findMany({
        where: { eventId: { in: eventIds } },
        select: { eventId: true },
      }),
      db.assessment.findMany({
        where: { eventId: { in: eventIds }, status: "submitted" },
        select: { eventId: true },
      }),
    ]);

    for (const row of participants) {
      const slug = slugById[row.eventId];
      if (slug) counts[slug].participants += 1;
    }

    for (const row of assessments) {
      const slug = slugById[row.eventId];
      if (slug) counts[slug].completed += 1;
    }

    return counts;
  } catch {
    return {};
  }
}
