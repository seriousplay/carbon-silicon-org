import "server-only";

import type { AppUser } from "./app-session";
import {
  nextProtocolVersion,
  validateInterfaceProtocolPayload,
  type InterfaceProtocol,
  type InterfaceProtocolPayload,
  type InterfaceProtocolStatus,
} from "./interface-protocols-core";
import { listLoopRelationships } from "./loop-relationships";
import { loopOsErrorMessage } from "./loop-os-errors";
import { getAdminClient } from "./supabase";

type InterfaceProtocolRow = {
  id: string;
  enterpriseId: string;
  relationshipId: string;
  versionNumber: number;
  couplingType: string;
  semanticProtocol: Record<string, unknown>;
  structuralProtocol: Record<string, unknown>;
  governanceProtocol: Record<string, unknown>;
  status: string;
  changeReason: string | null;
  createdBy: string;
  createdAt: Date;
};

export async function listAssetInterfaceProtocols(user: AppUser, assetId: string): Promise<InterfaceProtocol[]> {
  const relationships = await listLoopRelationships(user, assetId);
  if (!relationships.length) return [];
  return listProtocolsByRelationshipIds(user, relationships.map((relationship) => relationship.id));
}

export async function listRelationshipInterfaceProtocols(user: AppUser, relationshipId: string): Promise<InterfaceProtocol[]> {
  await requireRelationship(user, relationshipId);
  return listProtocolsByRelationshipIds(user, [relationshipId]);
}

export async function createInterfaceProtocol(
  user: AppUser,
  relationshipId: string,
  payload: InterfaceProtocolPayload,
  changeReason?: string,
): Promise<InterfaceProtocol> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  await requireRelationship(user, relationshipId);
  const validPayload = validateInterfaceProtocolPayload(payload);
  const existing = await listRelationshipInterfaceProtocols(user, relationshipId);
  const versionNumber = nextProtocolVersion(existing);
  const data = await admin.loopOsInterfaceProtocol.create({
    data: {
      enterpriseId: user.enterpriseId,
      relationshipId,
      versionNumber,
      couplingType: validPayload.couplingType,
      semanticProtocol: validPayload.semanticProtocol as Record<string, unknown>,
      structuralProtocol: validPayload.structuralProtocol as Record<string, unknown>,
      governanceProtocol: validPayload.governanceProtocol as Record<string, unknown>,
      status: "draft",
      changeReason: changeReason?.trim() || null,
      createdBy: user.id,
    },
  });
  return normalizeInterfaceProtocol(data as unknown as InterfaceProtocolRow);
}

export async function updateInterfaceProtocolStatus(
  user: AppUser,
  protocolId: string,
  status: InterfaceProtocolStatus,
): Promise<InterfaceProtocol> {
  if (!["draft", "active", "deprecated"].includes(status)) throw new Error("接口协议状态无效");
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const protocol = await getInterfaceProtocol(user, protocolId);
  if (!protocol) throw new Error("Interface protocol not found");
  if (status === "active") {
    await admin.loopOsInterfaceProtocol.updateMany({
      where: {
        enterpriseId: user.enterpriseId,
        relationshipId: protocol.relationshipId,
        status: "active",
        id: { not: protocolId },
      },
      data: { status: "deprecated" },
    });
  }
  const data = await admin.loopOsInterfaceProtocol.update({
    where: { enterpriseId: user.enterpriseId, id: protocolId },
    data: { status },
  });
  return normalizeInterfaceProtocol(data as unknown as InterfaceProtocolRow);
}

export async function getInterfaceProtocol(user: AppUser, protocolId: string): Promise<InterfaceProtocol | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const data = await admin.loopOsInterfaceProtocol.findFirst({
    where: { enterpriseId: user.enterpriseId, id: protocolId },
  });
  return data ? normalizeInterfaceProtocol(data as unknown as InterfaceProtocolRow) : null;
}

async function listProtocolsByRelationshipIds(user: AppUser, relationshipIds: string[]) {
  const admin = getAdminClient();
  if (!admin) return [];
  const data = await admin.loopOsInterfaceProtocol.findMany({
    where: {
      enterpriseId: user.enterpriseId,
      relationshipId: { in: relationshipIds },
    },
    orderBy: { versionNumber: "desc" },
  });
  return (data as unknown as InterfaceProtocolRow[]).map(normalizeInterfaceProtocol);
}

async function requireRelationship(user: AppUser, relationshipId: string) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const data = await admin.loopOsRelationship.findFirst({
    where: { enterpriseId: user.enterpriseId, id: relationshipId },
    select: { id: true, enterpriseId: true },
  });
  if (!data) throw new Error("Loop relationship not found");
  return data;
}

function normalizeInterfaceProtocol(row: InterfaceProtocolRow): InterfaceProtocol {
  return {
    id: row.id,
    enterpriseId: row.enterpriseId,
    relationshipId: row.relationshipId,
    versionNumber: row.versionNumber,
    couplingType: row.couplingType as InterfaceProtocol["couplingType"],
    semanticProtocol: row.semanticProtocol as InterfaceProtocol["semanticProtocol"],
    structuralProtocol: row.structuralProtocol as InterfaceProtocol["structuralProtocol"],
    governanceProtocol: row.governanceProtocol as InterfaceProtocol["governanceProtocol"],
    status: row.status as InterfaceProtocolStatus,
    changeReason: row.changeReason,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
