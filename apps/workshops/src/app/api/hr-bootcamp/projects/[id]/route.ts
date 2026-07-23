import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/pool";

// POST /api/hr-bootcamp/projects/[id]/vote — vote on a project
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });
  try {
    const { id } = await params;
    const body = await req.json();
    const { voterName, score } = body;
    if (!voterName || !score || score < 1 || score > 5) {
      return NextResponse.json({ error: "voterName and score (1-5) required" }, { status: 400 });
    }
    const vote = await db.bootcampVote.upsert({
      where: { projectId_voterName: { projectId: id, voterName } },
      create: { projectId: id, voterName, score },
      update: { score },
    });
    return NextResponse.json(vote);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
