import { NextRequest, NextResponse } from "next/server";
import { createEvent, listEvents } from "@/lib/state";
import type { DraftCandidateRecord } from "@/lib/types";

function normalizeDraftCandidates(input: unknown): DraftCandidateRecord[] {
  if (!Array.isArray(input)) return [];
  return input.slice(0, 3).map((item, index) => {
    const candidate = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
    return {
      id: String(candidate.id ?? `draft_${index + 1}`),
      name: String(candidate.name ?? `候选 ${index + 1}`),
      scenario: String(candidate.scenario ?? "").trim(),
      routeFrom: String(candidate.routeFrom ?? "").trim(),
      routeTo: String(candidate.routeTo ?? "").trim(),
      notes: String(candidate.notes ?? "").trim(),
      aiWork: String(candidate.aiWork ?? "").trim(),
      humanWork: String(candidate.humanWork ?? "").trim(),
      successStandard: String(candidate.successStandard ?? "").trim(),
      source: candidate.source === "模板" || candidate.source === "AI生成" ? (candidate.source as DraftCandidateRecord["source"]) : "自创",
    };
  });
}

export async function GET() {
  const events = (await listEvents()).map((event) => ({
    id: event.id,
    title: event.title,
    venue: event.venue,
    tagline: event.tagline,
    createdAt: event.createdAt,
    updatedAt: event.updatedAt,
  }));
  return NextResponse.json({ events });
}

export async function POST(request: NextRequest) {
  const input = await request.json().catch(() => ({}));
  const title = String(input.title ?? "").trim();
  const venue = String(input.venue ?? "").trim();
  const tagline = String(input.tagline ?? "").trim();
  const draftCandidates = normalizeDraftCandidates(input.draftCandidates);
  if (!title || !venue || !tagline) {
    return NextResponse.json({ error: "标题、场地和说明不能为空" }, { status: 400 });
  }
  const event = await createEvent({ title, venue, tagline, draftCandidates });
  return NextResponse.json({ event });
}
