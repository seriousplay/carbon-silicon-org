import { blueprintToMarkdown } from "@/lib/blueprint-export";
import { authorizeExport } from "@/lib/export-auth";

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await authorizeExport(request, sessionId, "markdown");
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!session.outputs.blueprint) return new Response("Not found", { status: 404 });
  return new Response(blueprintToMarkdown(session.outputs.blueprint), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="organization-blueprint-${session.id.slice(0, 8)}.md"`,
    },
  });
}
