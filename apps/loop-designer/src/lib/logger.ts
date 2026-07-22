import pino from "pino";
import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { sanitizeLog } from "./api-error";

/**
 * Trace context: automatically injected into every log entry
 * within a request's async context.
 */
const traceStore = new AsyncLocalStorage<{ traceId: string }>();

/**
 * Get or generate the current trace ID.
 */
export function getTraceId(): string {
  return traceStore.getStore()?.traceId ?? "no-trace";
}

/**
 * Run a callback within a traced context.
 * Use this in middleware or API route handlers.
 */
export function withTrace<T>(traceId: string | undefined, fn: () => T): T {
  return traceStore.run({ traceId: traceId ?? randomUUID() }, fn);
}

const isDev = process.env.NODE_ENV === "development";

/**
 * Pino logger configured for production JSON output.
 * In development, uses pino-pretty-like formatting (still JSON-compatible).
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),
  ...(isDev
    ? {
        transport: {
          target: "pino/file",
          options: { destination: 1 }, // stdout
        },
      }
    : {}),
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  mixin() {
    return { traceId: getTraceId() };
  },
  serializers: {
    error: pino.stdSerializers.err,
  },
});

/**
 * Sanitized child logger for a specific module.
 */
export function createModuleLogger(module: string) {
  return logger.child({ module });
}

/**
 * Safe error logging — sanitizes sensitive data before writing.
 */
export function logError(
  context: string,
  error: unknown,
  extra?: Record<string, unknown>,
) {
  const message = error instanceof Error ? error.message : String(error);
  logger.error(
    { ...extra, error: sanitizeLog(message) },
    `[${context}] ${isDev ? sanitizeLog(message) : "An error occurred"}`,
  );
}

/**
 * Info-level event logging.
 */
export function logEvent(
  event: string,
  data?: Record<string, unknown>,
) {
  logger.info(data ?? {}, event);
}
