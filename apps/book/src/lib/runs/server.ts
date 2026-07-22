import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getUserMemberships, isOrganizationAdmin } from "@/lib/auth/server";
import { defaultRun, fallbackRuns } from "./default-runs";
import type { AssessmentRun, CreateRunInput, RunStatus, RunType } from "./types";

type FullEventRow = {
  id: string;
  slug: string;
  title: string;
  event_date: string | null;
  access_code: string | null;
  status: RunStatus | string;
  run_type?: RunType | string | null;
  audience?: string | null;
  description?: string | null;
  organization_id?: string | null;
  show_on_home?: boolean | null;
  created_at?: string | null;
};

const fullSelect = "id,slug,title,event_date,access_code,status,run_type,audience,description,organization_id,show_on_home,created_at";
const compatibleSelect = "id,slug,title,event_date,access_code,status,run_type,audience,description,organization_id,created_at";
const legacySelect = "id,slug,title,event_date,access_code,status,created_at";
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

function normalizeRun(row: FullEventRow): AssessmentRun {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    runType: (row.run_type as RunType | undefined) ?? "workshop",
    status: (row.status as RunStatus | undefined) ?? "draft",
    audience: row.audience ?? defaultRun.audience,
    description: row.description ?? defaultRun.description,
    organizationId: row.organization_id ?? null,
    showOnHome: Boolean(row.show_on_home),
    dateLabel: formatDateLabel(row.event_date),
    accessCode: row.access_code ?? undefined,
    createdAt: row.created_at ?? undefined,
  };
}

async function selectEvents() {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return null;

  const full = await supabase.from("events").select(fullSelect).order("created_at", { ascending: false });
  if (!full.error) return (full.data ?? []) as FullEventRow[];

  const compatible = await supabase.from("events").select(compatibleSelect).order("created_at", { ascending: false });
  if (!compatible.error) return (compatible.data ?? []) as FullEventRow[];

  const legacy = await supabase.from("events").select(legacySelect).order("created_at", { ascending: false });
  if (!legacy.error) return (legacy.data ?? []) as FullEventRow[];

  return null;
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
  const supabase = createAdminSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("events")
    .select(fullSelect)
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (error) {
    const compatible = await supabase
      .from("events")
      .select(compatibleSelect)
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false });

    if (compatible.error) return [];

    const compatibleRuns = ((compatible.data ?? []) as FullEventRow[]).map(normalizeRun);
    const compatibleCounts = await getRunCounts(compatibleRuns.map((run) => run.slug));

    return compatibleRuns.map((run) => ({
      ...run,
      participantCount: compatibleCounts[run.slug]?.participants ?? 0,
      completedCount: compatibleCounts[run.slug]?.completed ?? 0,
    }));
  }

  const runs = ((data ?? []) as FullEventRow[]).map(normalizeRun);
  const counts = await getRunCounts(runs.map((run) => run.slug));

  return runs.map((run) => ({
    ...run,
    participantCount: counts[run.slug]?.participants ?? 0,
    completedCount: counts[run.slug]?.completed ?? 0,
  }));
}

export async function getAssessmentRun(slug: string): Promise<AssessmentRun | null> {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return fallbackRuns.find((run) => run.slug === slug) ?? null;

  const full = await supabase.from("events").select(fullSelect).eq("slug", slug).maybeSingle();
  if (!full.error && full.data) return normalizeRun(full.data as FullEventRow);

  const compatible = await supabase.from("events").select(compatibleSelect).eq("slug", slug).maybeSingle();
  if (!compatible.error && compatible.data) return normalizeRun(compatible.data as FullEventRow);

  const legacy = await supabase.from("events").select(legacySelect).eq("slug", slug).maybeSingle();
  if (!legacy.error && legacy.data) return normalizeRun(legacy.data as FullEventRow);

  return fallbackRuns.find((run) => run.slug === slug) ?? null;
}

export async function createAssessmentRun(input: CreateRunInput, owner?: { userId: string; organizationId: string }) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return { ok: false as const, reason: "Supabase service role is not configured" };
  }

  const fullPayload = {
    slug: input.slug,
    title: input.title,
    event_date: input.date || null,
    access_code: input.accessCode || null,
    status: input.status,
    run_type: input.runType,
    audience: input.audience || null,
    description: input.description || null,
    organization_id: owner?.organizationId ?? null,
    created_by: owner?.userId ?? null,
    show_on_home: Boolean(input.showOnHome),
  };

  const full = await supabase.from("events").insert(fullPayload).select(fullSelect).single();
  if (!full.error && full.data) {
    return { ok: true as const, run: normalizeRun(full.data as FullEventRow) };
  }

  const missingHomeVisibility = /show_on_home|column/i.test(full.error.message);
  if (missingHomeVisibility) {
    const compatiblePayload = {
      slug: fullPayload.slug,
      title: fullPayload.title,
      event_date: fullPayload.event_date,
      access_code: fullPayload.access_code,
      status: fullPayload.status,
      run_type: fullPayload.run_type,
      audience: fullPayload.audience,
      description: fullPayload.description,
      organization_id: fullPayload.organization_id,
      created_by: fullPayload.created_by,
    };
    const compatible = await supabase.from("events").insert(compatiblePayload).select(compatibleSelect).single();

    if (!compatible.error && compatible.data) {
      return { ok: true as const, run: normalizeRun(compatible.data as FullEventRow), degraded: true };
    }
  }

  const isSchemaMismatch = /run_type|audience|description|column/i.test(full.error.message);
  if (!isSchemaMismatch) {
    return { ok: false as const, reason: full.error.message };
  }

  const legacy = await supabase
    .from("events")
    .insert({
      slug: input.slug,
      title: input.title,
      event_date: input.date || null,
      access_code: input.accessCode || null,
      status: input.status,
    })
    .select(legacySelect)
    .single();

  if (legacy.error || !legacy.data) {
    return { ok: false as const, reason: legacy.error?.message ?? "Run insert failed" };
  }

  return { ok: true as const, run: normalizeRun(legacy.data as FullEventRow), degraded: true };
}

export async function updateAssessmentRun(
  slug: string,
  input: Partial<Pick<CreateRunInput, "title" | "status" | "audience" | "description" | "accessCode" | "showOnHome">>,
) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return { ok: false as const, reason: "Supabase service role is not configured" };
  }

  const payload: Record<string, string | boolean | null> = {};
  if (input.title !== undefined) payload.title = input.title;
  if (input.status !== undefined) payload.status = input.status;
  if (input.audience !== undefined) payload.audience = input.audience || null;
  if (input.description !== undefined) payload.description = input.description || null;
  if (input.accessCode !== undefined) payload.access_code = input.accessCode || null;
  if (input.showOnHome !== undefined) payload.show_on_home = input.showOnHome;

  const result = await supabase.from("events").update(payload).eq("slug", slug).select(fullSelect).maybeSingle();

  if (result.error || !result.data) {
    return { ok: false as const, reason: result.error?.message ?? "Run not found" };
  }

  return { ok: true as const, run: normalizeRun(result.data as FullEventRow) };
}

export async function verifyRunAccessCode(slug: string, accessCode: string | undefined) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    const fallback = fallbackRuns.find((run) => run.slug === slug);
    return { ok: Boolean(fallback), required: Boolean(fallback?.accessCode) };
  }

  const { data, error } = await supabase.from("events").select("access_code,status").eq("slug", slug).maybeSingle();
  if (error || !data) return { ok: false, required: false, reason: "Run not found" };
  if (!["active", "draft"].includes(String(data.status))) return { ok: false, required: false, reason: "Run is not active" };
  if (!data.access_code) return { ok: true, required: false };

  return {
    ok: data.access_code === accessCode,
    required: true,
    reason: data.access_code === accessCode ? undefined : "Access code does not match",
  };
}

export async function canAdministerRun(userId: string, slug: string) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) return false;

  const { data: event } = await supabase.from("events").select("organization_id").eq("slug", slug).maybeSingle();
  if (!event) return false;

  const memberships = await getUserMemberships(userId);
  const adminMemberships = memberships.filter(isOrganizationAdmin);
  if (!adminMemberships.length) return false;

  if (!event.organization_id) return true;
  return adminMemberships.some((membership) => membership.organizationId === event.organization_id);
}

export async function cleanupTestParticipants(slug: string) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return { ok: false as const, reason: "Supabase service role is not configured" };
  }

  const { data: event, error: eventError } = await supabase.from("events").select("id").eq("slug", slug).maybeSingle();
  if (eventError || !event?.id) {
    return { ok: false as const, reason: eventError?.message ?? "Run not found" };
  }

  const { data: participants, error: participantsError } = await supabase
    .from("participants")
    .select("id,display_name,company_name,contact")
    .eq("event_id", event.id);

  if (participantsError) {
    return { ok: false as const, reason: participantsError.message };
  }

  const testIds = ((participants ?? []) as { id: string; display_name: string; company_name: string | null; contact: string | null }[])
    .filter((participant) => {
      const text = `${participant.display_name} ${participant.company_name ?? ""} ${participant.contact ?? ""}`.toLowerCase();
      return /测试|test|codex|验收|演示|demo|smoke/.test(text);
    })
    .map((participant) => participant.id);

  if (!testIds.length) {
    return { ok: true as const, deleted: 0 };
  }

  const { error: deleteError } = await supabase.from("participants").delete().in("id", testIds);
  if (deleteError) {
    return { ok: false as const, reason: deleteError.message };
  }

  return { ok: true as const, deleted: testIds.length };
}

export async function exportRunCsv(slug: string) {
  const supabase = createAdminSupabaseClient();
  if (!supabase) {
    return { ok: false as const, reason: "Supabase service role is not configured" };
  }

  const { data: event, error: eventError } = await supabase.from("events").select("id,title").eq("slug", slug).maybeSingle();
  if (eventError || !event?.id) {
    return { ok: false as const, reason: eventError?.message ?? "Run not found" };
  }

  const { data, error } = await supabase
    .from("assessments")
    .select(
      "id,status,submitted_at,participants(display_name,role,industry,org_size,company_name,contact,contact_consent),reports(stage_level,next_level,primary_bottleneck,chain_score,charter_score,open_answers)",
    )
    .eq("event_id", event.id)
    .order("submitted_at", { ascending: false });

  if (error) {
    return { ok: false as const, reason: error.message };
  }

  const rows = (data ?? []) as Array<{
    id: string;
    status: string;
    submitted_at: string | null;
    participants:
      | {
          display_name: string;
          role: string | null;
          industry: string | null;
          org_size: string | null;
          company_name: string | null;
          contact: string | null;
          contact_consent: boolean | null;
        }
      | Array<{
          display_name: string;
          role: string | null;
          industry: string | null;
          org_size: string | null;
          company_name: string | null;
          contact: string | null;
          contact_consent: boolean | null;
        }>
      | null;
    reports:
      | {
          stage_level: string | null;
          next_level: string | null;
          primary_bottleneck: string | null;
          chain_score: number | null;
          charter_score: number | null;
          open_answers: Record<string, string | undefined> | null;
        }
      | Array<{
          stage_level: string | null;
          next_level: string | null;
          primary_bottleneck: string | null;
          chain_score: number | null;
          charter_score: number | null;
          open_answers: Record<string, string | undefined> | null;
        }>
      | null;
  }>;

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
    const participant = Array.isArray(row.participants) ? row.participants[0] : row.participants;
    const report = Array.isArray(row.reports) ? row.reports[0] : row.reports;
    return [
      row.submitted_at ?? "",
      participant?.display_name ?? "",
      participant?.role ?? "",
      participant?.industry ?? "",
      participant?.org_size ?? "",
      participant?.company_name ?? "",
      participant?.contact ?? "",
      participant?.contact_consent ? "yes" : "no",
      row.status,
      report?.stage_level ?? "",
      report?.next_level ?? "",
      report?.primary_bottleneck ?? "",
      report?.chain_score ?? "",
      report?.charter_score ?? "",
      report?.open_answers?.scenario ?? "",
      report?.open_answers?.workflow ?? "",
      report?.open_answers?.blocker ?? "",
    ];
  });

  return {
    ok: true as const,
    filename: `${slug}-assessment-export.csv`,
    csv: [header, ...csvRows].map((row) => row.map(escapeCsv).join(",")).join("\n"),
  };
}

function escapeCsv(value: string | number) {
  const text = String(value);
  if (!/[",\n\r]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

async function getRunCounts(slugs: string[]) {
  const supabase = createAdminSupabaseClient();
  if (!supabase || !slugs.length) return {};

  const { data: events } = await supabase.from("events").select("id,slug").in("slug", slugs);
  const eventRows = (events ?? []) as { id: string; slug: string }[];
  const eventIds = eventRows.map((event) => event.id);
  if (!eventIds.length) return {};

  const { data: participants } = await supabase.from("participants").select("event_id").in("event_id", eventIds);
  const { data: assessments } = await supabase
    .from("assessments")
    .select("event_id,status")
    .in("event_id", eventIds)
    .eq("status", "submitted");

  const slugById = Object.fromEntries(eventRows.map((event) => [event.id, event.slug]));
  const counts: Record<string, { participants: number; completed: number }> = {};

  for (const slug of slugs) counts[slug] = { participants: 0, completed: 0 };

  for (const row of (participants ?? []) as { event_id: string }[]) {
    const slug = slugById[row.event_id];
    if (slug) counts[slug].participants += 1;
  }

  for (const row of (assessments ?? []) as { event_id: string }[]) {
    const slug = slugById[row.event_id];
    if (slug) counts[slug].completed += 1;
  }

  return counts;
}
