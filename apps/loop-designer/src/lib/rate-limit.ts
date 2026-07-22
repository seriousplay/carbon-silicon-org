/**
 * IP-based in-memory rate limiter for Next.js API routes.
 *
 * For production with multiple instances, replace with Redis-backed implementation.
 */

type BucketEntry = {
  count: number;
  resetAt: number;
};

const store = new Map<string, BucketEntry>();

// Clean up expired entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (entry.resetAt <= now) store.delete(key);
  }
}

export type RateLimitConfig = {
  /** Maximum number of requests allowed in the window */
  maxRequests: number;
  /** Time window in seconds */
  windowSeconds: number;
};

/**
 * Check rate limit for a given key (typically IP address).
 * Returns `{ allowed: true }` or `{ allowed: false, retryAfter: number }`.
 */
export function checkRateLimit(
  key: string,
  config: RateLimitConfig,
): { allowed: true } | { allowed: false; retryAfter: number } {
  cleanup();
  const now = Date.now();
  const bucketKey = `${key}:${config.maxRequests}:${config.windowSeconds}`;
  const entry = store.get(bucketKey);

  if (!entry || entry.resetAt <= now) {
    store.set(bucketKey, { count: 1, resetAt: now + config.windowSeconds * 1000 });
    return { allowed: true };
  }

  if (entry.count >= config.maxRequests) {
    const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count++;
  return { allowed: true };
}

/**
 * Extract client IP from request headers.
 * Respects X-Forwarded-For when behind a trusted proxy.
 */
export function getClientIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // Take the leftmost IP (original client) when behind a trusted proxy
    return forwarded.split(",")[0].trim();
  }
  return request.headers.get("x-real-ip") || "127.0.0.1";
}

/** Rate limit response headers */
export function rateLimitHeaders(
  maxRequests: number,
  windowSeconds: number,
  remaining: number,
  resetAt: number,
): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(maxRequests),
    "X-RateLimit-Remaining": String(Math.max(0, remaining)),
    "X-RateLimit-Reset": String(Math.ceil(resetAt / 1000)),
    "Retry-After": String(Math.ceil((resetAt - Date.now()) / 1000)),
  };
}
