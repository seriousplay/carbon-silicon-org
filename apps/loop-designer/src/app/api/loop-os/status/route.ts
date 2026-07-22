import { NextResponse } from "next/server";
import { getLoopOsSchemaStatus } from "@/lib/loop-os-schema-status";

export async function GET() {
  const result = await getLoopOsSchemaStatus();
  return NextResponse.json(result, { status: result.status === "ok" ? 200 : 503 });
}
