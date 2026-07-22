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

export const LOOP_OS_V1_SCHEMA_CHECKS: LoopOsSchemaCheck[] = [
  {
    table: "loop_os_assets",
    columns: "id,enterprise_id,title,domain,status,current_version_id,source_session_id,matrix_workspace_id,matrix_circuit_logical_id,matrix_base_version_id,created_by",
  },
  {
    table: "loop_os_versions",
    columns: "id,asset_id,version_number,plan,maturity_mapping,birth_certificate,source_session_version_id,matrix_review,created_by",
  },
  {
    table: "loop_os_relationships",
    columns: "id,enterprise_id,source_asset_id,target_asset_id,type,interface_name,strength,created_by",
  },
  {
    table: "loop_os_org_profiles",
    columns: "enterprise_id,profile,source,computed_at,updated_at",
  },
];

export async function getLoopOsSchemaStatus(): Promise<LoopOsSchemaStatus> {
  const admin = getAdminClient();
  const checkedAt = new Date().toISOString();
  if (!admin) {
    return {
      status: "degraded",
      checkedAt,
      checks: LOOP_OS_V1_SCHEMA_CHECKS.map((check) => ({
        table: check.table,
        status: "down",
        latencyMs: 0,
        error: "Supabase service role is not configured",
      })),
      remediation: "请先配置 NEXT_PUBLIC_SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY。",
    };
  }

  const checks = await Promise.all(LOOP_OS_V1_SCHEMA_CHECKS.map(async (check) => {
    const startedAt = Date.now();
    const { error } = await admin
      .from(check.table)
      .select(check.columns)
      .limit(1);
    const latencyMs = Date.now() - startedAt;
    if (!error) return { table: check.table, status: "ok" as const, latencyMs };
    return {
      table: check.table,
      status: "down" as const,
      latencyMs,
      error: loopOsErrorMessage(error, `Unable to read ${check.table}`),
    };
  }));
  const ok = checks.every((check) => check.status === "ok");
  return {
    status: ok ? "ok" : "degraded",
    checkedAt,
    checks,
    ...(!ok ? { remediation: LOOP_OS_SCHEMA_MISSING_MESSAGE } : {}),
  };
}
