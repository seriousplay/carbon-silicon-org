import { NextResponse } from "next/server";

/**
 * Production-safe error messages.
 * In production, never expose internal details (file paths, DB errors, stack traces).
 * In development, include the original message for debugging.
 */
const isDev = process.env.NODE_ENV === "development";

/** Sensitive patterns to strip from error messages before logging or returning. */
const SENSITIVE_PATTERNS = [
  /Bearer\s+[A-Za-z0-9\-._~+/]+/gi,
  /sk-[A-Za-z0-9]+/g,
  /api[_-]?key[=:]\s*[^\s,;]+/gi,
  /password[=:]\s*[^\s,;]+/gi,
  /secret[=:]\s*[^\s,;]+/gi,
  /token[=:]\s*[^\s,;]+/gi,
];

/**
 * Sanitize a string by redacting sensitive patterns.
 */
export function sanitizeLog(input: string): string {
  let result = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    result = result.replace(pattern, (match) => {
      const prefix = match.slice(0, match.indexOf(match.match(/[=:]/)?.[0] ?? "") + 1 || 7);
      return `${prefix} [REDACTED]`;
    });
  }
  return result;
}

/**
 * Sanitize request headers for logging (redact Authorization, Cookie, X-API-Key).
 */
export function sanitizeHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  const sensitive = new Set(["authorization", "cookie", "x-api-key", "x-csrf-token"]);
  for (const [key, value] of headers) {
    if (sensitive.has(key.toLowerCase())) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * Public-safe error message. Returns a user-friendly message in production,
 * and the full error details in development.
 */
export function safeErrorMessage(error: unknown): string {
  if (isDev) {
    return error instanceof Error ? error.message : String(error);
  }
  // Production: generic message
  if (error instanceof Error) {
    // Only expose messages that are explicitly user-facing
    if (error.message.startsWith("USER:")) {
      return error.message.slice(5);
    }
  }
  return "操作失败，请稍后重试";
}

/**
 * Create a user-facing error. Prefix with USER: to mark it as safe for production exposure.
 */
export function userError(message: string): Error {
  return new Error(`USER:${message}`);
}

/**
 * Standardized JSON error response.
 */
export function jsonError(
  message: string,
  status: number = 500,
  extra?: Record<string, unknown>
) {
  return NextResponse.json(
    { error: isDev ? message : safeErrorMessage(new Error(`USER:${message}`)) },
    { status, ...(extra ? { headers: extra as Record<string, string> } : {}) }
  );
}

/**
 * Safe console.error wrapper that sanitizes log output.
 */
export function safeLogError(context: string, error: unknown, extra?: Record<string, unknown>) {
  const message = error instanceof Error ? error.message : String(error);
  const sanitized = sanitizeLog(message);
  const payload: Record<string, unknown> = { error: sanitized };
  if (extra) Object.assign(payload, extra);
  console.error(`[${context}]`, JSON.stringify(payload));
}
