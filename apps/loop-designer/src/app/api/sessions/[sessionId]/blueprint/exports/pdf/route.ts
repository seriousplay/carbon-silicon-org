import { renderBlueprintPdf } from "@/lib/blueprint-export";
import { authorizeExport } from "@/lib/export-auth";

export async function GET(request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const session = await authorizeExport(request, sessionId, "pdf");
  if (!session) return new Response("Unauthorized", { status: 401 });
  if (!session.outputs.blueprint) return new Response("Not found", { status: 404 });
  try {
    const pdf = await renderBlueprintPdf(session.outputs.blueprint);
    return new Response(new Uint8Array(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="organization-blueprint-${session.id.slice(0, 8)}.pdf"`,
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "PDF failed", { status: 503 });
  }
}
