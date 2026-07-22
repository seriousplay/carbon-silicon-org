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
  enterprise_id: string;
  relationship_id: string;
  version_number: number;
  coupling_type: InterfaceProtocol["couplingType"];
  semantic_protocol: InterfaceProtocol["semanticProtocol"];
  structural_protocol: InterfaceProtocol["structuralProtocol"];
  governance_protocol: InterfaceProtocol["governanceProtocol"];
  status: InterfaceProtocolStatus;
  change_reason: string | null;
  created_by: string;
  created_at: string;
};

type RelationshipRef = {
  id: string;
  enterprise_id: string;
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
  const { data, error } = await admin
    .from("loop_os_interface_protocols")
    .insert({
      enterprise_id: user.enterpriseId,
      relationship_id: relationshipId,
      version_number: versionNumber,
      coupling_type: validPayload.couplingType,
      semantic_protocol: validPayload.semanticProtocol,
      structural_protocol: validPayload.structuralProtocol,
      governance_protocol: validPayload.governanceProtocol,
      status: "draft",
      change_reason: changeReason?.trim() || null,
      created_by: user.id,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(loopOsErrorMessage(error, "Unable to create interface protocol"));
  return normalizeInterfaceProtocol(data as InterfaceProtocolRow);
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
    const { error: deprecateError } = await admin
      .from("loop_os_interface_protocols")
      .update({ status: "deprecated" })
      .eq("enterprise_id", user.enterpriseId)
      .eq("relationship_id", protocol.relationshipId)
      .eq("status", "active")
      .neq("id", protocolId);
    if (deprecateError) throw new Error(loopOsErrorMessage(deprecateError, "Unable to deprecate previous interface protocol"));
  }
  const { data, error } = await admin
    .from("loop_os_interface_protocols")
    .update({ status })
    .eq("enterprise_id", user.enterpriseId)
    .eq("id", protocolId)
    .select("*")
    .single();
  if (error || !data) throw new Error(loopOsErrorMessage(error, "Unable to update interface protocol status"));
  return normalizeInterfaceProtocol(data as InterfaceProtocolRow);
}

export async function getInterfaceProtocol(user: AppUser, protocolId: string): Promise<InterfaceProtocol | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("loop_os_interface_protocols")
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .eq("id", protocolId)
    .maybeSingle();
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to get interface protocol"));
  return data ? normalizeInterfaceProtocol(data as InterfaceProtocolRow) : null;
}

async function listProtocolsByRelationshipIds(user: AppUser, relationshipIds: string[]) {
  const admin = getAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("loop_os_interface_protocols")
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .in("relationship_id", relationshipIds)
    .order("version_number", { ascending: false });
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to list interface protocols"));
  return ((data ?? []) as InterfaceProtocolRow[]).map(normalizeInterfaceProtocol);
}

async function requireRelationship(user: AppUser, relationshipId: string) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data, error } = await admin
    .from("loop_os_relationships")
    .select("id, enterprise_id")
    .eq("enterprise_id", user.enterpriseId)
    .eq("id", relationshipId)
    .maybeSingle();
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to require loop relationship"));
  if (!data) throw new Error("Loop relationship not found");
  return data as RelationshipRef;
}

function normalizeInterfaceProtocol(row: InterfaceProtocolRow): InterfaceProtocol {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    relationshipId: row.relationship_id,
    versionNumber: row.version_number,
    couplingType: row.coupling_type,
    semanticProtocol: row.semantic_protocol,
    structuralProtocol: row.structural_protocol,
    governanceProtocol: row.governance_protocol,
    status: row.status,
    changeReason: row.change_reason,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
