/**
 * In-Memory TTL Cache
 *
 * Simple in-memory cache with time-to-live (TTL) support.
 * Used for caching database query results and computed summaries.
 *
 * Performance characteristics:
 * - O(1) get/set operations
 * - Automatic expiration via cleanup interval
 * - LRU eviction when max size reached
 *
 * Usage:
 * ```typescript
 * const cache = new TTLCache<string, EventSummary>({
 *   ttl: 60_000, // 1 minute
 *   maxSize: 1000,
 * });
 *
 * const summary = await cache.get('event:abc123', () =>
 *   getEventSummary('abc123')
 * );
 * ```
 */

export interface CacheOptions<T> {
  /** Time-to-live in milliseconds. Default: 60000 (1 minute) */
  ttl?: number;
  /** Maximum number of entries before LRU eviction. Default: 1000 */
  maxSize?: number;
  /** Called when cache miss occurs (lazy loading) */
  loader?: () => Promise<T>;
  /** Called when cache entry is set (for logging/metrics) */
  onSet?: (key: string, value: T) => void;
  /** Called when cache entry expires or is evicted */
  onDelete?: (key: string, value: T) => void;
}

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * Thread-safe (within single process) TTL cache with optional lazy loading.
 *
 * Note: In PM2 cluster mode, each worker has its own cache.
 * For shared caching across workers, use Redis (Phase 3).
 */
export class TTLCache<T = unknown> {
  private cache: Map<string, CacheEntry<T>>;
  private ttl: number;
  private maxSize: number;
  private loader?: () => Promise<T>;
  private onSet?: (key: string, value: T) => void;
  private onDelete?: (key: string, value: T) => void;
  private cleanupInterval?: NodeJS.Timeout;

  /**
   * Create a new TTL cache.
   *
   * @param options - Cache configuration options
   */
  constructor(options: CacheOptions<T> = {}) {
    this.cache = new Map();
    this.ttl = options.ttl ?? 60_000; // 1 minute default
    this.maxSize = options.maxSize ?? 1000;
    this.loader = options.loader;
    this.onSet = options.onSet;
    this.onDelete = options.onDelete;

    // Periodic cleanup of expired entries (every 1 minute)
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60_000);
  }

  /**
   * Get a value from cache, or load it if missing and loader provided.
   *
   * @param key - Cache key
   * @returns Cached value or loaded value, or undefined if not found
   */
  async get(key: string): Promise<T | undefined>;
  async get<K extends string>(key: K): Promise<T | undefined>;
  async get(key: string): Promise<T | undefined> {
    const entry = this.cache.get(key);

    // Cache hit - check expiration
    if (entry) {
      if (Date.now() < entry.expiresAt) {
        return entry.value;
      }
      // Expired - remove it
      this.cache.delete(key);
      this.onDelete?.(key, entry.value);
    }

    // Cache miss - try lazy loading if loader provided
    if (this.loader) {
      const value = await this.loader();
      this.set(key, value);
      return value;
    }

    return undefined;
  }

  /**
   * Get a cached value synchronously (no lazy loading).
   * Returns undefined if not found or expired.
   *
   * @param key - Cache key
   * @returns Cached value or undefined
   */
  getSync(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (entry && Date.now() < entry.expiresAt) {
      return entry.value;
    }

    if (entry) {
      this.cache.delete(key);
      this.onDelete?.(key, entry.value);
    }

    return undefined;
  }

  /**
   * Set a value in cache with TTL.
   *
   * @param key - Cache key
   * @param value - Value to cache
   * @param ttl - Optional override TTL in milliseconds
   */
  set(key: string, value: T, ttl?: number): void {
    // Evict oldest entry if at capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        const firstEntry = this.cache.get(firstKey);
        if (firstEntry) {
          this.cache.delete(firstKey);
          this.onDelete?.(firstKey, firstEntry.value);
        }
      }
    }

    const expiresAt = Date.now() + (ttl ?? this.ttl);
    this.cache.set(key, { value, expiresAt });
    this.onSet?.(key, value);
  }

  /**
   * Delete a specific cache entry.
   *
   * @param key - Cache key to delete
   * @returns true if entry was deleted
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.onDelete?.(key, entry.value);
      return true;
    }
    return false;
  }

  /**
   * Clear all cache entries.
   */
  clear(): void {
    const entries = Array.from(this.cache.entries());
    this.cache.clear();
    entries.forEach(([key, entry]) => {
      this.onDelete?.(key, entry.value);
    });
  }

  /**
   * Remove expired entries from cache.
   * Called automatically on a schedule, but can be called manually.
   */
  private cleanup(): void {
    const now = Date.now();
    const expiredKeys: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now >= entry.expiresAt) {
        expiredKeys.push(key);
      }
    }

    expiredKeys.forEach((key) => {
      const entry = this.cache.get(key);
      if (entry) {
        this.cache.delete(key);
        this.onDelete?.(key, entry.value);
      }
    });
  }

  /**
   * Get cache statistics.
   *
   * @returns Object with cache stats
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }

  /**
   * Destroy the cache and stop cleanup interval.
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
    }
    this.clear();
  }
}

/**
 * Create a namespaced cache for a specific domain.
 * Useful for organizing cache keys with prefixes.
 *
 * @param namespace - Cache namespace (prefix)
 * @param options - Cache options
 * @returns Namespaced cache instance
 */
export function createNamespacedCache<T>(namespace: string, options?: CacheOptions<T>) {
  const cache = new TTLCache<T>(options);

  return {
    ...cache,
    get: async (key: string) => cache.get(`${namespace}:${key}`),
    getSync: (key: string) => cache.getSync(`${namespace}:${key}`),
    set: (key: string, value: T, ttl?: number) =>
      cache.set(`${namespace}:${key}`, value, ttl),
    delete: (key: string) => cache.delete(`${namespace}:${key}`),
  };
}

// Export for backward compatibility and convenience
export default TTLCache;
