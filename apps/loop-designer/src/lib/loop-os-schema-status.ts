import "server-only";

import { LOOP_OS_SCHEMA_MISSING_MESSAGE, loopOsErrorMessage } from "./loop-os-errors";
import { getAdminClient } from "./supabase";

export type LoopOsSchemaCheck = {
  table: string;
  columns: string;
};

export type LoopOsSchemaCheckResult = {
  table: string;
  status: "ok" | "down";
  latencyMs: number;
  error?: string;
};

export type LoopOsSchemaStatus = {
  status: "ok" | "degraded";
  checkedAt: string;
  checks: LoopOsSchemaCheckResult[];
  remediation?: string;
};

export async function getLoopOsSchemaStatus(): Promise<LoopOsSchemaStatus> {
  const admin = getAdminClient();
  const checkedAt = new Date().toISOString();
  if (!admin) {
    return {
      status: "degraded",
      checkedAt,
      checks: [],
      remediation: "请先配置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。",
    };
  }

  const checks: LoopOsSchemaCheckResult[] = [];

  // Check loop_os_assets
  let startedAt = Date.now();
  try {
    await admin.loopOsAsset.findFirst({
      select: {
        id: true, enterpriseId: true, title: true, domain: true, status: true,
        currentVersionId: true, sourceSessionId: true, matrixWorkspaceId: true,
        matrixCircuitLogicalId: true, matrixBaseVersionId: true, createdBy: true,
      },
      take: 1,
    });
    checks.push({ table: "loop_os_assets", status: "ok", latencyMs: Date.now() - startedAt });
  } catch (error) {
    checks.push({ table: "loop_os_assets", status: "down", latencyMs: Date.now() - startedAt, error: loopOsErrorMessage(error, "Unable to read loop_os_assets") });
  }

  // Check loop_os_versions
  startedAt = Date.now();
  try {
    await admin.loopOsVersion.findFirst({
      select: {
        id: true, assetId: true, versionNumber: true, plan: true, maturityMapping: true,
        birthCertificate: true, sourceSessionVersionId: true, createdBy: true,
      },
      take: 1,
    });
    checks.push({ table: "loop_os_versions", status: "ok", latencyMs: Date.now() - startedAt });
  } catch (error) {
    checks.push({ table: "loop_os_versions", status: "down", latencyMs: Date.now() - startedAt, error: loopOsErrorMessage(error, "Unable to read loop_os_versions") });
  }

  // Check loop_os_relationships
  startedAt = Date.now();
  try {
    await admin.loopOsRelationship.findFirst({
      select: {
        id: true, enterpriseId: true, sourceAssetId: true, targetAssetId: true,
        type: true, interfaceName: true, strength: true, createdBy: true,
      },
      take: 1,
    });
    checks.push({ table: "loop_os_relationships", status: "ok", latencyMs: Date.now() - startedAt });
  } catch (error) {
    checks.push({ table: "loop_os_relationships", status: "down", latencyMs: Date.now() - startedAt, error: loopOsErrorMessage(error, "Unable to read loop_os_relationships") });
  }

  // Check loop_os_org_profiles
  startedAt = Date.now();
  try {
    await admin.loopOsOrgProfile.findFirst({
      select: {
        enterpriseId: true, profile: true, source: true, computedAt: true, updatedAt: true,
      },
      take: 1,
    });
    checks.push({ table: "loop_os_org_profiles", status: "ok", latencyMs: Date.now() - startedAt });
  } catch (error) {
    checks.push({ table: "loop_os_org_profiles", status: "down", latencyMs: Date.now() - startedAt, error: loopOsErrorMessage(error, "Unable to read loop_os_org_profiles") });
  }

  const ok = checks.every((check) => check.status === "ok");
  return {
    status: ok ? "ok" : "degraded",
    checkedAt,
    checks,
    ...(!ok ? { remediation: LOOP_OS_SCHEMA_MISSING_MESSAGE } : {}),
  };
}
