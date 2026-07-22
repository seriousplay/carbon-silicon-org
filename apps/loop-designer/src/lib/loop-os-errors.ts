export const LOOP_OS_SCHEMA_MISSING_MESSAGE = "Loop OS v1 数据库迁移尚未对 API 可见。请配置数据库连接后运行 node scripts/apply-loop-os-v1-migration.mjs，或运行 node scripts/print-loop-os-v1-migration.mjs 生成并执行完整 SQL bundle，然后运行 node scripts/verify-loop-os-v1.mjs 验证。";

export function loopOsErrorMessage(error: { code?: string; message?: string } | null | undefined, fallback: string) {
  if (error?.code === "PGRST205" || error?.message?.includes("schema cache")) return LOOP_OS_SCHEMA_MISSING_MESSAGE;
  return error?.message || fallback;
}
