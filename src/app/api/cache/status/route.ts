import { NextResponse } from "next/server";
import { getCacheMetrics, getCacheProviderInfo } from "@/lib/cache-metrics";
import { ServerCache } from "@/lib/server-cache";

export const dynamic = "force-dynamic";

/**
 * GET /api/cache/status
 *
 * Returns live cache metrics and provider configuration.
 * Useful for debugging cache behavior during development and production.
 */
export async function GET() {
  const metrics = getCacheMetrics();
  const provider = getCacheProviderInfo();

  const totalHits = Object.values(metrics).reduce((s, n) => s + n.hits, 0);
  const totalMisses = Object.values(metrics).reduce((s, n) => s + n.misses, 0);
  const totalOps = totalHits + totalMisses;

  return NextResponse.json({
    provider,
    summary: {
      totalHits,
      totalMisses,
      totalOps,
      overallHitRate: totalOps === 0 ? 0 : Math.round((totalHits / totalOps) * 100),
    },
    namespaces: metrics,
  });
}

/**
 * DELETE /api/cache/status
 *
 * Clears the entire cache and resets in-memory metrics.
 * Useful for manual cache invalidation during debugging.
 */
export async function DELETE() {
  const cache = ServerCache.getInstance();
  await cache.clear();
  return NextResponse.json({ ok: true, message: "Cache cleared" });
}
