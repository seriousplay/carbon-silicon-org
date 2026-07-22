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
  enterpriseId: string;
  title: string;
  domain: string;
  status: string;
  currentVersionId: string | null;
  sourceSessionId: string | null;
  matrixWorkspaceId: string | null;
  matrixCircuitLogicalId: string | null;
  matrixBaseVersionId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
};

type LoopVersionRow = {
  id: string;
  assetId: string;
  versionNumber: number;
  plan: PrismaJsonValue;
  maturityMapping: PrismaJsonValue | null;
  birthCertificate: PrismaJsonValue | null;
  matrixReview: PrismaJsonValue | null;
  sourceSessionVersionId: string | null;
  changeReason: string | null;
  createdBy: string;
  createdAt: Date;
};

// Helper type for JSON values in Prisma
type PrismaJsonValue = Record<string, unknown> | null;

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

  let asset: LoopAsset;
  let currentVersion: LoopVersion;

  try {
    asset = normalizeAsset(await admin.loopOsAsset.create({
      data: {
        enterpriseId: draft.asset.enterpriseId,
        title: draft.asset.title,
        domain: draft.asset.domain,
        status: draft.asset.status,
        sourceSessionId: draft.asset.sourceSessionId ?? null,
        matrixWorkspaceId: draft.asset.matrixWorkspaceId ?? null,
        matrixCircuitLogicalId: draft.asset.matrixCircuitLogicalId ?? null,
        matrixBaseVersionId: draft.asset.matrixBaseVersionId ?? null,
        createdBy: draft.asset.createdBy,
      },
    }) as unknown as LoopAssetRow);

    currentVersion = normalizeVersion(await admin.loopOsVersion.create({
      data: {
        assetId: asset.id,
        versionNumber: draft.firstVersion.versionNumber,
        plan: draft.firstVersion.plan as PrismaJsonValue,
        maturityMapping: (draft.firstVersion.maturityMapping ?? null) as PrismaJsonValue | null,
        birthCertificate: birthCertificate as PrismaJsonValue | null,
        sourceSessionVersionId: draft.firstVersion.sourceSessionVersionId ?? null,
        changeReason: draft.firstVersion.changeReason ?? null,
        createdBy: draft.firstVersion.createdBy,
      },
    }) as unknown as LoopVersionRow);
  } catch (error) {
    if (isUniqueViolation(error)) {
      const racedAsset = await findAssetBySourceSession(user.enterpriseId, input.sessionId);
      const racedVersion = racedAsset ? await getAssetCurrentVersion(user.enterpriseId, racedAsset.id) : null;
      if (racedAsset && racedVersion) return { asset: racedAsset, currentVersion: racedVersion, created: false };
    }
    throw new Error(loopOsErrorMessage(error, "Unable to create loop asset"));
  }

  const updatedAsset = normalizeAsset(await admin.loopOsAsset.update({
    where: { id: asset.id, enterpriseId: user.enterpriseId },
    data: { currentVersionId: currentVersion.id, updatedAt: new Date() },
  }) as unknown as LoopAssetRow);

  return {
    asset: updatedAsset,
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

  const data = await admin.loopOsAsset.create({
    data: {
      enterpriseId: draft.enterpriseId,
      title: draft.title,
      domain: draft.domain,
      status: draft.status,
      createdBy: draft.createdBy,
    },
  });
  return normalizeAsset(data as unknown as LoopAssetRow);
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
  const data = await admin.loopOsAsset.findMany({
    where: { enterpriseId: user.enterpriseId },
    orderBy: { updatedAt: "desc" },
  });
  return (data as unknown as LoopAssetRow[]).map(normalizeAsset);
}

export async function updateLoopAssetStatus(
  user: AppUser,
  input: UpdateLoopAssetStatusInput,
): Promise<LoopAsset> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const data = await admin.loopOsAsset.update({
    where: { id: input.assetId, enterpriseId: user.enterpriseId },
    data: { status: input.status, updatedAt: new Date() },
  });
  return normalizeAsset(data as unknown as LoopAssetRow);
}

export async function recordLoopVersionMatrixReview(
  user: AppUser,
  input: RecordLoopVersionMatrixReviewInput,
): Promise<LoopVersion> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const details = await getLoopAssetDetails(user, input.assetId);
  if (!details) throw new Error("Loop asset not found");
  const data = await admin.loopOsVersion.update({
    where: { id: input.versionId, assetId: input.assetId },
    data: { matrixReview: input.review as PrismaJsonValue },
  });
  return normalizeVersion(data as unknown as LoopVersionRow);
}

export async function getLoopAssetDetails(user: AppUser, assetId: string): Promise<LoopAssetDetails | null> {
  const admin = getAdminClient();
  if (!admin) return null;
  const assetData = await admin.loopOsAsset.findFirst({
    where: { enterpriseId: user.enterpriseId, id: assetId },
  });
  if (!assetData) return null;

  const asset = normalizeAsset(assetData as unknown as LoopAssetRow);
  const versionData = await admin.loopOsVersion.findMany({
    where: { assetId: asset.id },
    orderBy: { versionNumber: "desc" },
  });

  const versions = (versionData as unknown as LoopVersionRow[]).map(normalizeVersion);
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
  const data = await admin.loopOsAsset.findFirst({
    where: {
      enterpriseId: user.enterpriseId,
      matrixWorkspaceId: input.matrixWorkspaceId,
      matrixCircuitLogicalId: input.matrixCircuitLogicalId,
      status: { not: "retired" },
    },
    orderBy: { updatedAt: "desc" },
    select: { id: true },
  });
  return data?.id ? getLoopAssetDetails(user, data.id) : null;
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
    content: `你正在基于企业回路资产"${details.asset.title}"发起一次迭代。当前版本 v${details.currentVersion.versionNumber} 已带入方案区。请说明这次要优化的目标、边界或运行证据。`,
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

  const data = await admin.loopDesignerSession.create({
    data: {
      userId: user.id,
      enterpriseId: user.enterpriseId,
      status: "submitted",
      participantSnapshot: {
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
      matrixIntegration: input.matrixIntegration as PrismaJsonValue ?? null,
      submittedAt: new Date(),
    },
    select: { id: true },
  });
  return { id: data.id };
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
    const existingVersionData = await admin.loopOsVersion.findFirst({
      where: {
        assetId: details.asset.id,
        sourceSessionVersionId: latestSessionVersion.id,
      },
    });
    if (existingVersionData) {
      const currentVersion = normalizeVersion(existingVersionData as unknown as LoopVersionRow);
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

  let currentVersion: LoopVersion;
  try {
    currentVersion = normalizeVersion(await admin.loopOsVersion.create({
      data: {
        assetId: details.asset.id,
        versionNumber: nextVersionNumber,
        plan: plan as PrismaJsonValue,
        maturityMapping: (plan.maturityMapping ?? null) as PrismaJsonValue | null,
        birthCertificate: null,
        sourceSessionVersionId: latestSessionVersion?.id ?? null,
        changeReason: "asset_iteration_session_promoted",
        createdBy: user.id,
      },
    }) as unknown as LoopVersionRow);
  } catch (error) {
    if (isUniqueViolation(error) && latestSessionVersion?.id) {
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
    throw new Error(loopOsErrorMessage(error, "Unable to create loop asset version"));
  }

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
  const data = await admin.loopOsAsset.update({
    where: { id: assetId, enterpriseId: user.enterpriseId },
    data: { currentVersionId: versionId, updatedAt: new Date(now) },
  });
  return normalizeAsset(data as unknown as LoopAssetRow);
}

async function findAssetBySourceSession(enterpriseId: string, sessionId: string): Promise<LoopAsset | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const data = await admin.loopOsAsset.findFirst({
    where: { enterpriseId, sourceSessionId: sessionId },
  });
  return data ? normalizeAsset(data as unknown as LoopAssetRow) : null;
}

async function findAssetVersionBySourceSessionVersion(assetId: string, sourceSessionVersionId: string): Promise<LoopVersion | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const data = await admin.loopOsVersion.findFirst({
    where: { assetId, sourceSessionVersionId },
  });
  return data ? normalizeVersion(data as unknown as LoopVersionRow) : null;
}

function isUniqueViolation(error: unknown) {
  return error instanceof Error && "code" in error && (error as { code?: string }).code === "P2002";
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

  const data = await admin.loopOsVersion.findMany({
    where: {
      id: { in: versionIds },
      asset: { enterpriseId: user.enterpriseId },
    },
    include: { asset: { select: { enterpriseId: true } } },
  });
  return (data as unknown as LoopVersionRow[]).map(normalizeVersion);
}

async function getAssetCurrentVersion(enterpriseId: string, assetId: string): Promise<LoopVersion | null> {
  const admin = getAdminClient();
  if (!admin) throw new Error("Supabase service role is not configured");
  const assetData = await admin.loopOsAsset.findFirst({
    where: { enterpriseId, id: assetId },
    select: { currentVersionId: true },
  });
  const currentVersionId = assetData?.currentVersionId;
  if (!currentVersionId) return null;
  const data = await admin.loopOsVersion.findFirst({
    where: { assetId, id: currentVersionId },
  });
  return data ? normalizeVersion(data as unknown as LoopVersionRow) : null;
}

function normalizeAsset(row: LoopAssetRow): LoopAsset {
  return {
    id: row.id,
    enterpriseId: row.enterpriseId,
    title: row.title,
    domain: row.domain,
    status: row.status as LoopAssetStatus,
    currentVersionId: row.currentVersionId,
    ...(row.sourceSessionId ? { sourceSessionId: row.sourceSessionId } : {}),
    ...(row.matrixWorkspaceId ? { matrixWorkspaceId: row.matrixWorkspaceId } : {}),
    ...(row.matrixCircuitLogicalId ? { matrixCircuitLogicalId: row.matrixCircuitLogicalId } : {}),
    ...(row.matrixBaseVersionId ? { matrixBaseVersionId: row.matrixBaseVersionId } : {}),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function normalizeVersion(row: LoopVersionRow): LoopVersion {
  return {
    id: row.id,
    assetId: row.assetId,
    versionNumber: row.versionNumber,
    plan: row.plan as LoopPlan,
    ...(row.maturityMapping ? { maturityMapping: row.maturityMapping as LoopMaturityMapping } : {}),
    ...(row.birthCertificate ? { birthCertificate: row.birthCertificate as LoopBirthCertificate } : {}),
    ...(row.matrixReview ? { matrixReview: row.matrixReview as LoopMatrixReview } : {}),
    ...(row.sourceSessionVersionId ? { sourceSessionVersionId: row.sourceSessionVersionId } : {}),
    ...(row.changeReason ? { changeReason: row.changeReason } : {}),
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
  };
}
