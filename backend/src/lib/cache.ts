import { redis } from "./redis";
import { appLogger } from "../middleware/logger";
import { metrics } from "@opentelemetry/api";

const meter = metrics.getMeter("amana-backend");

const cacheHits = meter.createCounter("cache_hit_total", {
  description: "Number of cache hits",
});
const cacheMisses = meter.createCounter("cache_miss_total", {
  description: "Number of cache misses",
});
const cacheSets = meter.createCounter("cache_set_total", {
  description: "Number of cache set operations",
});

/** Randomize TTL by ±10% to prevent cache stampede. */
function jitterTtl(ttl: number): number {
  const jitter = ttl * 0.1;
  return Math.round(ttl + (Math.random() * 2 - 1) * jitter);
}

export class CacheService {
  /**
   * Return cached value if present; otherwise call `fetcher`, cache the result,
   * and return it. Gracefully degrades to direct DB fetch if Redis is unavailable.
   */
  async getOrSet<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
    try {
      const cached = await redis.get(key);
      if (cached !== null) {
        cacheHits.add(1, { key });
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      appLogger.warn({ err, key }, "Cache get failed — falling back to DB");
      return fetcher();
    }

    cacheMisses.add(1, { key });
    const value = await fetcher();

    try {
      await redis.set(key, JSON.stringify(value), "EX", jitterTtl(ttl));
      cacheSets.add(1, { key });
    } catch (err) {
      appLogger.warn({ err, key }, "Cache set failed");
    }

    return value;
  }

  /** Delete all keys matching a glob pattern (uses SCAN to avoid blocking). */
  async invalidate(pattern: string): Promise<void> {
    try {
      let cursor = "0";
      do {
        const [next, keys] = await redis.scan(cursor, "MATCH", pattern, "COUNT", 100);
        cursor = next;
        if (keys.length > 0) {
          await redis.del(...keys);
        }
      } while (cursor !== "0");
    } catch (err) {
      appLogger.warn({ err, pattern }, "Cache invalidate failed");
    }
  }

  /** Delete a single cache key. */
  async invalidateOne(key: string): Promise<void> {
    try {
      await redis.del(key);
    } catch (err) {
      appLogger.warn({ err, key }, "Cache invalidateOne failed");
    }
  }
}

export const cacheService = new CacheService();

// ── Legacy helpers (kept for backward-compat with existing callers) ──────────

const DEFAULT_TTL_SECONDS = 300;

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    if (value === null) return null;
    return JSON.parse(value) as T;
  } catch (err) {
    appLogger.warn({ err, key }, "Cache get failed");
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds: number = DEFAULT_TTL_SECONDS,
): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    appLogger.warn({ err, key }, "Cache set failed");
  }
}
