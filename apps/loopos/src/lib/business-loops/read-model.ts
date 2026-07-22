import "server-only";

import { PrismaClient } from "@/generated/prisma/client";
import { prisma } from "@/lib/db";

export type BusinessLoopReadModel = Readonly<{
  source: "persisted" | "fallback";
  counts: Readonly<{
    structures: number;
    flows: number;
    readyInterfaces: number;
    delayedInterfaces: number;
    activities: number;
    evidenceRefs: number;
  }>;
  persistedLoops: readonly Readonly<{
    id: string;
    name: string;
    purpose: string | null;
    status: string;
    publishedAt: Date | null;
    activities: readonly Readonly<{
      id: string;
      name: string;
      activityType: string;
      circleId: string | null;
      circleName: string | null;
      ownerRoleId: string | null;
      ownerRoleName: string | null;
    }>[];
    edges: readonly Readonly<{
      id: string;
      label: string;
      edgeType: string;
      fromCircleId: string | null;
      fromCircleName: string | null;
      toCircleId: string | null;
      toCircleName: string | null;
      interfaceId: string | null;
      interfaceName: string | null;
    }>[];
  }>[];
  candidateFlows: readonly Readonly<{
    id: string;
    name: string;
    from: string;
    to: string;
    status: string;
  }>[];
  empty: boolean;
}>;

type BusinessLoopPrisma = Pick<
  PrismaClient,
  | "businessLoop"
  | "businessLoopActivity"
  | "businessLoopEdge"
  | "businessLoopEvidenceRef"
  | "circle"
  | "circleInterface"
>;

export async function getBusinessLoopReadModel(
  organizationId: string,
  db: BusinessLoopPrisma = prisma,
): Promise<BusinessLoopReadModel> {
  const [
    structures,
    interfaceCount,
    readyInterfaceCount,
    persistedLoopCount,
    persistedActivityCount,
    persistedEdgeCount,
    persistedEvidenceCount,
    persistedLoops,
    previewInterfaces,
  ] = await Promise.all([
    db.circle.findMany({
      where: { organizationId, status: { not: "ARCHIVED" } },
      select: { id: true, name: true },
      orderBy: [{ parentId: "asc" }, { name: "asc" }],
    }),
    db.circleInterface.count({ where: { organizationId, status: { not: "ARCHIVED" } } }),
    db.circleInterface.count({ where: { organizationId, status: "READY" } }),
    db.businessLoop.count({ where: { organizationId, status: "ACTIVE" } }),
    db.businessLoopActivity.count({
      where: { organizationId, businessLoop: { status: "ACTIVE" } },
    }),
    db.businessLoopEdge.count({
      where: { organizationId, businessLoop: { status: "ACTIVE" } },
    }),
    db.businessLoopEvidenceRef.count({
      where: { organizationId, businessLoop: { status: "ACTIVE" } },
    }),
    db.businessLoop.findMany({
      where: { organizationId, status: "ACTIVE" },
      select: {
        id: true,
        name: true,
        purpose: true,
        status: true,
        versions: {
          where: { status: "PUBLISHED" },
          select: { publishedAt: true },
          orderBy: [{ publishedAt: "desc" }, { version: "desc" }],
          take: 1,
        },
        activities: {
          select: {
            id: true,
            name: true,
            activityType: true,
            circleId: true,
            circle: { select: { name: true } },
            ownerRoleId: true,
            ownerRole: { select: { name: true } },
          },
          orderBy: [{ position: "asc" }, { name: "asc" }],
          take: 6,
        },
        edges: {
          select: {
            id: true,
            label: true,
            edgeType: true,
            fromCircleId: true,
            fromCircle: { select: { name: true } },
            toCircleId: true,
            toCircle: { select: { name: true } },
            interfaceId: true,
            interface: { select: { name: true } },
          },
          orderBy: [{ position: "asc" }, { label: "asc" }],
          take: 8,
        },
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: 6,
    }),
    db.circleInterface.findMany({
      where: { organizationId, status: { not: "ARCHIVED" } },
      select: {
        id: true,
        name: true,
        status: true,
        fromCircleId: true,
        toCircleId: true,
      },
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      take: 8,
    }),
  ]);
  const structureNames = new Map(structures.map((item) => [item.id, item.name]));
  const candidateFlows = previewInterfaces.map((item) => ({
    id: item.id,
    name: item.name,
    from: structureNames.get(item.fromCircleId) ?? "未知结构",
    to: structureNames.get(item.toCircleId) ?? "未知结构",
    status: item.status,
  }));
  const persistedFlowRows = persistedLoops.map((loop) => ({
    id: loop.id,
    name: loop.name,
    purpose: loop.purpose,
    status: loop.status,
    publishedAt: loop.versions[0]?.publishedAt ?? null,
    activities: loop.activities.map((activity) => ({
      id: activity.id,
      name: activity.name,
      activityType: activity.activityType,
      circleId: activity.circleId,
      circleName: activity.circle?.name ?? null,
      ownerRoleId: activity.ownerRoleId,
      ownerRoleName: activity.ownerRole?.name ?? null,
    })),
    edges: loop.edges.map((edge) => ({
      id: edge.id,
      label: edge.label,
      edgeType: edge.edgeType,
      fromCircleId: edge.fromCircleId,
      fromCircleName: edge.fromCircle?.name ?? null,
      toCircleId: edge.toCircleId,
      toCircleName: edge.toCircle?.name ?? null,
      interfaceId: edge.interfaceId,
      interfaceName: edge.interface?.name ?? null,
    })),
  }));
  const hasPersistedLoops = persistedLoopCount > 0;

  return {
    source: hasPersistedLoops ? "persisted" : "fallback",
    counts: {
      structures: structures.length,
      flows: hasPersistedLoops ? persistedEdgeCount : interfaceCount,
      readyInterfaces: readyInterfaceCount,
      delayedInterfaces: interfaceCount - readyInterfaceCount,
      activities: hasPersistedLoops ? persistedActivityCount : structures.length,
      evidenceRefs: persistedEvidenceCount,
    },
    persistedLoops: persistedFlowRows,
    candidateFlows,
    empty: structures.length === 0 && interfaceCount === 0 && persistedLoopCount === 0,
  };
}
