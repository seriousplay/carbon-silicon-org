import { NextResponse } from "next/server";
import { generateDraftCandidates } from "@/lib/candidate-generator";

export async function POST(request: Request) {
  const input = await request.json().catch(() => ({}));
  const prompt = String(input.prompt ?? "").trim();
  const industry = String(input.industry ?? "").trim();
  const business = String(input.business ?? "").trim();
  const title = String(input.title ?? "").trim();
  const venue = String(input.venue ?? "").trim();
  const tagline = String(input.tagline ?? "").trim();

  if (!prompt || !industry || !business) {
    return NextResponse.json({ error: "请输入行业、主营业务和关键提示词" }, { status: 400 });
  }

  const result = await generateDraftCandidates({
    prompt,
    industry,
    business,
    title: title || "现场活动",
    venue: venue || "线下现场",
    tagline: tagline || "",
  });

  return NextResponse.json(result);
}
