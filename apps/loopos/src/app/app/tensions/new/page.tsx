import { getCurrentOrgId } from "@/lib/session";
import { prisma } from "@/lib/db";
import NewTensionClient from "./page-client";

export default async function NewTensionPage({ searchParams }: { searchParams: Promise<{ mode?: string; meetingId?: string }> }) {
  const orgId = await getCurrentOrgId();
  const query = await searchParams;

  const circles = await prisma.circle.findMany({
    where: { organizationId: orgId, status: { not: "ARCHIVED" } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <NewTensionClient
      circles={circles}
      fixedHandlingMode={query.mode === "TACTICAL" || query.mode === "GOVERNANCE" ? query.mode : null}
      meetingId={query.meetingId ?? null}
    />
  );
}
