/**
 * Lightweight structured cache hit/miss metrics.
 *
 * Logs each cache operation as structured JSON and exposes aggregated
 * stats for the `/api/cache/status` endpoint.
 */

interface NamespaceStats {
  hits: number;
  misses: number;
}

const namespaces = new Map<string, NamespaceStats>();

function ensure(key: string): NamespaceStats {
  let ns = namespaces.get(key);
  if (!ns) {
    ns = { hits: 0, misses: 0 };
    namespaces.set(key, ns);
  }
  return ns;
}

/**
 * Record a cache hit, log structured JSON.
 */
export function recordHit(namespace: string, detail?: string): void {
  const ns = ensure(namespace);
  ns.hits++;
  console.log(
    JSON.stringify({
      event: "cache.hit",
      namespace,
      detail: detail ?? "",
      totalHits: ns.hits,
      totalMisses: ns.misses,
      hitRate: hitRate(ns),
    }),
  );
}

/**
 * Record a cache miss, log structured JSON.
 */
export function recordMiss(namespace: string, detail?: string): void {
  const ns = ensure(namespace);
  ns.misses++;
  console.log(
    JSON.stringify({
      event: "cache.miss",
      namespace,
      detail: detail ?? "",
      totalHits: ns.hits,
      totalMisses: ns.misses,
      hitRate: hitRate(ns),
    }),
  );
}

function hitRate(ns: NamespaceStats): number {
  const total = ns.hits + ns.misses;
  return total === 0 ? 0 : Math.round((ns.hits / total) * 100);
}

/**
 * Get aggregated snapshot of all namespace stats.
 */
export function getCacheMetrics(): Record<
  string,
  NamespaceStats & { hitRate: number }
> {
  const snapshot: Record<string, NamespaceStats & { hitRate: number }> = {};
  for (const [key, ns] of namespaces) {
    snapshot[key] = { ...ns, hitRate: hitRate(ns) };
  }
  return snapshot;
}

/**
 * Get the cache provider info (reads env vars at runtime).
 */
export function getCacheProviderInfo(): {
  type: "file" | "redis";
  ttlMinutes: number;
  storageDir?: string;
  redisUrl?: string;
} {
  if (process.env.NUNCIO_CACHE === "redis") {
    return {
      type: "redis",
      ttlMinutes: 60,
      redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    };
  }
  return {
    type: "file",
    ttlMinutes: 60,
    storageDir:
      process.env.NUNCIO_CACHE_DIR || `${process.cwd()}/.data/cache`,
  };
}
