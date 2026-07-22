import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { buildMemoryContextForEnterprise } from "@/lib/memory-context";

type MemoryContextBody = {
  domain?: string;
  loopType?: string;
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await request.json().catch(() => ({})) as MemoryContextBody;
    const memoryContext = await buildMemoryContextForEnterprise(user, {
      domain: body.domain,
      loopType: body.loopType,
    });
    return NextResponse.json({ memoryContext });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to build memory context" }, { status: 500 });
  }
}
