import { authorizeExport } from "@/lib/export-auth";
import { planToMarkdown } from "@/lib/markdown";

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await authorizeExport(request, sessionId, "markdown");
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!session?.outputs.currentPlan) return new Response("Not found", { status: 404 });
  return new Response(planToMarkdown(session.outputs.currentPlan), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": `attachment; filename="loop-design-${session.id.slice(0, 8)}.md"`,
    },
  });
}
