import { NextResponse } from "next/server";
import { db } from "@/lib/supabase/pool";

// GET /api/hr-bootcamp/projects — list all projects with vote counts
export async function GET() {
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });
  try {
    const projects = await db.bootcampProject.findMany({
      include: { votes: true },
      orderBy: { createdAt: "desc" },
    });
    const ranked = projects
      .map(p => ({
        id: p.id,
        authorName: p.authorName,
        authorRole: p.authorRole,
        title: p.title,
        description: p.description,
        url: p.url,
        createdAt: p.createdAt.toISOString(),
        voteCount: p.votes.length,
        avgScore: p.votes.length ? Math.round(p.votes.reduce((s, v) => s + v.score, 0) / p.votes.length * 10) / 10 : 0,
      }))
      .sort((a, b) => b.avgScore * b.voteCount - a.avgScore * a.voteCount || b.voteCount - a.voteCount);
    return NextResponse.json(ranked);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

// POST /api/hr-bootcamp/projects — submit a project
export async function POST(req: Request) {
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });
  try {
    const body = await req.json();
    const { authorName, authorRole, title, description, url } = body;
    if (!authorName || !title || !description) {
      return NextResponse.json({ error: "authorName, title, description required" }, { status: 400 });
    }
    const project = await db.bootcampProject.create({
      data: { authorName, authorRole: authorRole || null, title, description, url: url || null },
      include: { votes: true },
    });
    return NextResponse.json({ ...project, createdAt: project.createdAt.toISOString() }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
