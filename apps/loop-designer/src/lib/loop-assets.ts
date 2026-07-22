import "server-only";

import { randomUUID } from "node:crypto";
import type { MatrixIntegrationContext } from "@carbon-silicon/types";
import { getAdminClient } from "./supabase";
import { getAuthorizedSession, updateSession } from "./sessions";
import type { AppUser } from "./app-session";
import {
  assertMatrixAssetBindingCompatible,
  buildLoopAssetDraft,
  buildLoopBirthLessonsFromHistory,
  buildManualLoopAssetDraft,
  type LoopAsset,
  type LoopAssetStatus,
  type LoopBirthCertificate,
  type LoopMatrixReview,
  type LoopVersion,
} from "./loop-assets-core";
import { loopOsErrorMessage } from "./loop-os-errors";
import { listLoopRelationships } from "./loop-relationships";
import type { LoopPlan, LoopMaturityMapping } from "./plan-schema";
import type { ConversationMessage, LoopDesignerSession, SessionOutputs } from "./session-types";

type LoopAssetRow = {
  id: string;
  enterprise_id: string;
  title: string;
  domain: string;
  status: LoopAssetStatus;
  current_version_id: string | null;
  source_session_id: string | null;
  matrix_workspace_id: string | null;
  matrix_circuit_logical_id: string | null;
  matrix_base_version_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type LoopVersionRow = {
  id: string;
  asset_id: string;
  version_number: number;
  plan: LoopPlan;
  maturity_mapping: LoopMaturityMapping | null;
  birth_certificate: LoopBirthCertificate | null;
  matrix_review: LoopMatrixReview | null;
  source_session_version_id: string | null;
  change_reason: string | null;
  created_by: string;
  created_at: string;
};

export type CreateLoopAssetFromSessionInput = {
  sessionId: string;
  title?: string;
  domain?: string;
  status?: LoopAssetStatus;
};

export type CreateManualLoopAssetInput = {
  title: string;
  domain?: string;
  status?: LoopAssetStatus;
};

export type CreateLoopAssetVersionFromSessionInput = {
  assetId: string;
  sessionId: string;
};

export type UpdateLoopAssetStatusInput = {
  assetId: string;
  status: LoopAssetStatus;
};

export type RecordLoopVersionMatrixReviewInput = {
  assetId: string;
  versionId: string;
  review: LoopMatrixReview;
};

export type LoopAssetWithVersion = {
  asset: LoopAsset;
  currentVersion: LoopVersion;
  created: boolean;
  versionCreated?: boolean;
};

export type LoopAssetDetails = {
  asset: LoopAsset;
  currentVersion: LoopVersion | null;
  versions: LoopVersion[];
};

export type LoopAssetIterationSession = {
  id: string;
};

export type FindLoopAssetByMatrixCircuitInput = {
  matrixWorkspaceId: string;
  matrixCircuitLogicalId: string;
};

export type CreateLoopAssetIterationSessionInput = {
  matrixIntegration?: MatrixIntegrationContext;
};

export async function createLoopAssetFromSession(
  user: AppUser,
  input: CreateLoopAssetFromSessionInput,
): Promise<LoopAssetWithVersion> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const session = await getAuthorizedSession(user, input.sessionId);
  if (!session) throw new Error("Session not found");
  const sourceAssetId = session.responses.sourceAssetId;
  if (sourceAssetId) {
    return createVersionFromIterationSession(user, session, sourceAssetId);
  }

  const existing = await findAssetBySourceSession(user.enterpriseId, input.sessionId);
  if (existing) {
    const version = await getAssetCurrentVersion(user.enterpriseId, existing.id);
    if (!version) throw new Error("Loop asset current version not found");
    return { asset: existing, currentVersion: version, created: false };
  }

  const draft = buildLoopAssetDraft({
    user,
    session,
    title: input.title,
    domain: input.domain,
    status: input.status,
  });
  const lessonsFromHistory = await buildHistoricalBirthLessons(user, draft.asset.domain);
  const birthCertificate = draft.firstVersion.birthCertificate
    ? { ...draft.firstVersion.birthCertificate, lessonsFromHistory }
    : null;

  const { data: assetData, error: assetError } = await admin
    .from("loop_os_assets")
    .insert({
      enterprise_id: draft.asset.enterpriseId,
      title: draft.asset.title,
      domain: draft.asset.domain,
      status: draft.asset.status,
      source_session_id: draft.asset.sourceSessionId,
      matrix_workspace_id: draft.asset.matrixWorkspaceId,
      matrix_circuit_logical_id: draft.asset.matrixCircuitLogicalId,
      matrix_base_version_id: draft.asset.matrixBaseVersionId,
      created_by: draft.asset.createdBy,
    })
    .select("*")
    .single();
  if (assetError || !assetData) {
    if (isUniqueViolation(assetError)) {
      const racedAsset = await findAssetBySourceSession(user.enterpriseId, input.sessionId);
      const racedVersion = racedAsset ? await getAssetCurrentVersion(user.enterpriseId, racedAsset.id) : null;
      if (racedAsset && racedVersion) return { asset: racedAsset, currentVersion: racedVersion, created: false };
    }
    throw new Error(loopOsErrorMessage(assetError, "Unable to create loop asset"));
  }
  const asset = normalizeAsset(assetData as LoopAssetRow);

  const { data: versionData, error: versionError } = await admin
    .from("loop_os_versions")
    .insert({
      asset_id: asset.id,
      version_number: draft.firstVersion.versionNumber,
      plan: draft.firstVersion.plan,
      maturity_mapping: draft.firstVersion.maturityMapping ?? null,
      birth_certificate: birthCertificate,
      source_session_version_id: draft.firstVersion.sourceSessionVersionId,
      change_reason: draft.firstVersion.changeReason,
      created_by: draft.firstVersion.createdBy,
    })
    .select("*")
    .single();
  if (versionError || !versionData) {
    await admin.from("loop_os_assets").delete().eq("id", asset.id).eq("enterprise_id", user.enterpriseId);
    throw new Error(loopOsErrorMessage(versionError, "Unable to create loop asset version"));
  }
  const currentVersion = normalizeVersion(versionData as LoopVersionRow);

  const { data: updatedAssetData, error: updateError } = await admin
    .from("loop_os_assets")
    .update({ current_version_id: currentVersion.id, updated_at: new Date().toISOString() })
    .eq("id", asset.id)
    .eq("enterprise_id", user.enterpriseId)
    .select("*")
    .single();
  if (updateError || !updatedAssetData) throw new Error(loopOsErrorMessage(updateError, "Unable to update loop asset current version"));

  return {
    asset: normalizeAsset(updatedAssetData as LoopAssetRow),
    currentVersion,
    created: true,
  };
}

export async function createManualLoopAsset(
  user: AppUser,
  input: CreateManualLoopAssetInput,
): Promise<LoopAsset> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const draft = buildManualLoopAssetDraft({
    user,
    title: input.title,
    domain: input.domain,
    status: input.status,
  });

  const { data, error } = await admin
    .from("loop_os_assets")
    .insert({
      enterprise_id: draft.enterpriseId,
      title: draft.title,
      domain: draft.domain,
      status: draft.status,
      created_by: draft.createdBy,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(loopOsErrorMessage(error, "Unable to create manual loop asset"));
  return normalizeAsset(data as LoopAssetRow);
}

export async function createLoopAssetVersionFromSession(
  user: AppUser,
  input: CreateLoopAssetVersionFromSessionInput,
): Promise<LoopAssetWithVersion> {
  const session = await getAuthorizedSession(user, input.sessionId);
  if (!session) throw new Error("Session not found");
  if (session.responses.sourceAssetId !== input.assetId) {
    throw new Error("Session is not an iteration of this loop asset");
  }
  return createVersionFromIterationSession(user, session, input.assetId);
}

export async function listLoopAssets(user: AppUser): Promise<LoopAsset[]> {
  const admin = getAdminClient();
  if (!admin) return [];
  const { data, error } = await admin
    .from("loop_os_assets")
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .order("updated_at", { ascending: false });
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to list loop assets"));
  return ((data ?? []) as LoopAssetRow[]).map(normalizeAsset);
}

export async function updateLoopAssetStatus(
  user: AppUser,
  input: UpdateLoopAssetStatusInput,
): Promise<LoopAsset> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data, error } = await admin
    .from("loop_os_assets")
    .update({ status: input.status, updated_at: new Date().toISOString() })
    .eq("id", input.assetId)
    .eq("enterprise_id", user.enterpriseId)
    .select("*")
    .single();
  if (error || !data) throw new Error(loopOsErrorMessage(error, "Unable to update loop asset status"));
  return normalizeAsset(data as LoopAssetRow);
}

export async function recordLoopVersionMatrixReview(
  user: AppUser,
  input: RecordLoopVersionMatrixReviewInput,
): Promise<LoopVersion> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const details = await getLoopAssetDetails(user, input.assetId);
  if (!details) throw new Error("Loop asset not found");
  const { data, error } = await admin
    .from("loop_os_versions")
    .update({ matrix_review: input.review })
    .eq("id", input.versionId)
    .eq("asset_id", input.assetId)
    .select("*")
    .single();
  if (error || !data) throw new Error(loopOsErrorMessage(error, "Unable to record Matrix review status"));
  return normalizeVersion(data as LoopVersionRow);
}

export async function getLoopAssetDetails(user: AppUser, assetId: string): Promise<LoopAssetDetails | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data: assetData, error: assetError } = await admin
    .from("loop_os_assets")
    .select("*")
    .eq("enterprise_id", user.enterpriseId)
    .eq("id", assetId)
    .maybeSingle();
  if (assetError) throw new Error(loopOsErrorMessage(assetError, "Unable to get loop asset"));
  if (!assetData) return null;

  const asset = normalizeAsset(assetData as LoopAssetRow);
  const { data: versionData, error: versionError } = await admin
    .from("loop_os_versions")
    .select("*")
    .eq("asset_id", asset.id)
    .order("version_number", { ascending: false });
  if (versionError) throw new Error(loopOsErrorMessage(versionError, "Unable to list loop asset versions"));

  const versions = ((versionData ?? []) as LoopVersionRow[]).map(normalizeVersion);
  return {
    asset,
    currentVersion: versions.find((version) => version.id === asset.currentVersionId) ?? null,
    versions,
  };
}

export async function findLoopAssetByMatrixCircuit(
  user: AppUser,
  input: FindLoopAssetByMatrixCircuitInput,
): Promise<LoopAssetDetails | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const { data, error } = await admin
    .from("loop_os_assets")
    .select("id")
    .eq("enterprise_id", user.enterpriseId)
    .eq("matrix_workspace_id", input.matrixWorkspaceId)
    .eq("matrix_circuit_logical_id", input.matrixCircuitLogicalId)
    .neq("status", "retired")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to find Matrix loop asset binding"));
  const assetId = (data as { id?: string } | null)?.id;
  return assetId ? getLoopAssetDetails(user, assetId) : null;
}

export async function createLoopAssetIterationSession(
  user: AppUser,
  assetId: string,
  input: CreateLoopAssetIterationSessionInput = {},
): Promise<LoopAssetIterationSession> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");

  const details = await getLoopAssetDetails(user, assetId);
  if (!details) throw new Error("Loop asset not found");
  if (!details.currentVersion) throw new Error("Loop asset has no current version");

  const now = new Date().toISOString();
  const welcome: ConversationMessage = {
    id: randomUUID(),
    role: "assistant",
    content: `你正在基于企业回路资产“${details.asset.title}”发起一次迭代。当前版本 v${details.currentVersion.versionNumber} 已带入方案区。请说明这次要优化的目标、边界或运行证据。`,
    createdAt: now,
  };
  const outputs: SessionOutputs = {
    messages: [welcome],
    currentPlan: details.currentVersion.plan,
    versions: [{
      id: randomUUID(),
      createdAt: now,
      focus: "asset_iteration",
      instruction: `从 Loop OS 资产 ${details.asset.id} 的 v${details.currentVersion.versionNumber} 启动迭代`,
      plan: details.currentVersion.plan,
    }],
    refinementCount: 0,
  };

  const { data, error } = await admin
    .from("loop_designer_sessions")
    .insert({
      user_id: user.id,
      enterprise_id: user.enterpriseId,
      status: "submitted",
      participant_snapshot: {
        displayName: user.displayName,
        openId: user.openId,
        tenantKey: user.tenantKey,
      },
      context: {
        currentStep: 5,
        loopType: details.asset.domain,
        loopPurpose: `从 Loop OS 资产迭代：${details.asset.title}`,
      },
      responses: {
        loop: `从 Loop OS 资产迭代：${details.asset.title}`,
        sourceAssetId: details.asset.id,
        sourceAssetVersionId: details.currentVersion.id,
      },
      outputs,
      ...(input.matrixIntegration ? { matrix_integration: input.matrixIntegration } : {}),
      submitted_at: now,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message || "Unable to create loop iteration session");
  return { id: (data as { id: string }).id };
}

async function createVersionFromIterationSession(
  user: AppUser,
  session: LoopDesignerSession,
  assetId: string,
): Promise<LoopAssetWithVersion> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const plan = session.outputs.currentPlan;
  if (!plan) throw new Error("当前会话还没有可沉淀的回路方案");

  const details = await getLoopAssetDetails(user, assetId);
  if (!details) throw new Error("Loop asset not found");
  assertMatrixAssetBindingCompatible(details.asset, session.matrixIntegration);

  const latestSessionVersion = session.outputs.versions.at(-1);
  if (latestSessionVersion?.id) {
    const { data: existingVersionData, error: existingVersionError } = await admin
      .from("loop_os_versions")
      .select("*")
      .eq("asset_id", details.asset.id)
      .eq("source_session_version_id", latestSessionVersion.id)
      .maybeSingle();
    if (existingVersionError) throw new Error(loopOsErrorMessage(existingVersionError, "Unable to find loop asset version"));
    if (existingVersionData) {
      const currentVersion = normalizeVersion(existingVersionData as LoopVersionRow);
      const asset = await updateAssetCurrentVersion(user, details.asset.id, currentVersion.id);
      await updateSessionAssetVersionRef(user, session, currentVersion.id);
      return {
        asset,
        currentVersion,
        created: false,
        versionCreated: false,
      };
    }
  }

  const now = new Date().toISOString();
  const nextVersionNumber = Math.max(0, ...details.versions.map((version) => version.versionNumber)) + 1;
  const { data: versionData, error: versionError } = await admin
    .from("loop_os_versions")
    .insert({
      asset_id: details.asset.id,
      version_number: nextVersionNumber,
      plan,
      maturity_mapping: plan.maturityMapping ?? null,
      birth_certificate: null,
      source_session_version_id: latestSessionVersion?.id ?? null,
      change_reason: "asset_iteration_session_promoted",
      created_by: user.id,
    })
    .select("*")
    .single();
  if (versionError || !versionData) {
    if (isUniqueViolation(versionError) && latestSessionVersion?.id) {
      const racedVersion = await findAssetVersionBySourceSessionVersion(details.asset.id, latestSessionVersion.id);
      if (racedVersion) {
        const asset = await updateAssetCurrentVersion(user, details.asset.id, racedVersion.id);
        await updateSessionAssetVersionRef(user, session, racedVersion.id);
        return {
          asset,
          currentVersion: racedVersion,
          created: false,
          versionCreated: false,
        };
      }
    }
    throw new Error(loopOsErrorMessage(versionError, "Unable to create loop asset version"));
  }

  const currentVersion = normalizeVersion(versionData as LoopVersionRow);
  const asset = await updateAssetCurrentVersion(user, details.asset.id, currentVersion.id, now);

  await updateSessionAssetVersionRef(user, session, currentVersion.id);

  return {
    asset,
    currentVersion,
    created: false,
    versionCreated: true,
  };
}

async function updateSessionAssetVersionRef(user: AppUser, session: LoopDesignerSession, versionId: string) {
  if (session.responses.sourceAssetVersionId === versionId) return;
  await updateSession(user, session.id, {
    responses: {
      ...session.responses,
      sourceAssetVersionId: versionId,
    },
  });
}

async function updateAssetCurrentVersion(user: AppUser, assetId: string, versionId: string, now = new Date().toISOString()) {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data, error } = await admin
    .from("loop_os_assets")
    .update({ current_version_id: versionId, updated_at: now })
    .eq("id", assetId)
    .eq("enterprise_id", user.enterpriseId)
    .select("*")
    .single();
  if (error || !data) throw new Error(loopOsErrorMessage(error, "Unable to update loop asset current version"));
  return normalizeAsset(data as LoopAssetRow);
}

async function findAssetBySourceSession(enterpriseId: string, sessionId: string): Promise<LoopAsset | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data, error } = await admin
    .from("loop_os_assets")
    .select("*")
    .eq("enterprise_id", enterpriseId)
    .eq("source_session_id", sessionId)
    .maybeSingle();
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to find loop asset by source session"));
  return data ? normalizeAsset(data as LoopAssetRow) : null;
}

async function findAssetVersionBySourceSessionVersion(assetId: string, sourceSessionVersionId: string): Promise<LoopVersion | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data, error } = await admin
    .from("loop_os_versions")
    .select("*")
    .eq("asset_id", assetId)
    .eq("source_session_version_id", sourceSessionVersionId)
    .maybeSingle();
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to find loop asset version by source session version"));
  return data ? normalizeVersion(data as LoopVersionRow) : null;
}

function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}

async function buildHistoricalBirthLessons(user: AppUser, domain: string): Promise<string[]> {
  const assets = await listLoopAssets(user);
  const currentVersionIds = assets
    .map((asset) => asset.currentVersionId)
    .filter((id): id is string => Boolean(id));
  const currentVersions = await listLoopVersionsByIds(user, currentVersionIds);
  const relationships = await listLoopRelationships(user);
  return buildLoopBirthLessonsFromHistory({
    domain,
    assets,
    currentVersions,
    relationships,
  });
}

async function listLoopVersionsByIds(user: AppUser, versionIds: string[]): Promise<LoopVersion[]> {
  const admin = getAdminClient();
  if (!admin || !versionIds.length) return [];

  const { data, error } = await admin
    .from("loop_os_versions")
    .select("*, loop_os_assets!inner(enterprise_id)")
    .in("id", versionIds)
    .eq("loop_os_assets.enterprise_id", user.enterpriseId);
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to list loop versions"));
  return ((data ?? []) as LoopVersionRow[]).map(normalizeVersion);
}

async function getAssetCurrentVersion(enterpriseId: string, assetId: string): Promise<LoopVersion | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const { data: assetData, error: assetError } = await admin
    .from("loop_os_assets")
    .select("current_version_id")
    .eq("enterprise_id", enterpriseId)
    .eq("id", assetId)
    .maybeSingle();
  if (assetError) throw new Error(loopOsErrorMessage(assetError, "Unable to get loop asset current version"));
  const currentVersionId = (assetData as { current_version_id?: string } | null)?.current_version_id;
  if (!currentVersionId) return null;
  const { data, error } = await admin
    .from("loop_os_versions")
    .select("*")
    .eq("asset_id", assetId)
    .eq("id", currentVersionId)
    .maybeSingle();
  if (error) throw new Error(loopOsErrorMessage(error, "Unable to get loop asset current version"));
  return data ? normalizeVersion(data as LoopVersionRow) : null;
}

function normalizeAsset(row: LoopAssetRow): LoopAsset {
  return {
    id: row.id,
    enterpriseId: row.enterprise_id,
    title: row.title,
    domain: row.domain,
    status: row.status,
    currentVersionId: row.current_version_id,
    ...(row.source_session_id ? { sourceSessionId: row.source_session_id } : {}),
    ...(row.matrix_workspace_id ? { matrixWorkspaceId: row.matrix_workspace_id } : {}),
    ...(row.matrix_circuit_logical_id ? { matrixCircuitLogicalId: row.matrix_circuit_logical_id } : {}),
    ...(row.matrix_base_version_id ? { matrixBaseVersionId: row.matrix_base_version_id } : {}),
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeVersion(row: LoopVersionRow): LoopVersion {
  return {
    id: row.id,
    assetId: row.asset_id,
    versionNumber: row.version_number,
    plan: row.plan,
    ...(row.maturity_mapping ? { maturityMapping: row.maturity_mapping } : {}),
    ...(row.birth_certificate ? { birthCertificate: row.birth_certificate } : {}),
    ...(row.matrix_review ? { matrixReview: row.matrix_review } : {}),
    ...(row.source_session_version_id ? { sourceSessionVersionId: row.source_session_version_id } : {}),
    ...(row.change_reason ? { changeReason: row.change_reason } : {}),
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}
