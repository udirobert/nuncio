import { NextRequest, NextResponse } from "next/server";
import { enrich } from "@/lib/tinyfish";
import { validateUrls } from "@/lib/validation";
import { MemoryCache } from "@/lib/cache";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { recordHit, recordMiss } from "@/lib/cache-metrics";

// Cache enrichment results for 30 minutes
const enrichmentCache = new MemoryCache<unknown[]>(30);

export async function POST(request: NextRequest) {
  // Rate limit
  const clientId = getClientId(request);
  const limit = checkRateLimit(clientId, "enrich", RATE_LIMITS.enrich);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${limit.resetIn} seconds.` },
      {
        status: 429,
        headers: { "Retry-After": String(limit.resetIn) },
      }
    );
  }

  const { urls, discoverRelated } = await request.json();

  if (!urls || !Array.isArray(urls) || urls.length === 0) {
    return NextResponse.json(
      { error: "At least one URL is required" },
      { status: 400 }
    );
  }

  // Validate URLs before spending credits
  const { valid, errors } = validateUrls(urls);

  if (valid.length === 0) {
    return NextResponse.json(
      {
        error: "No valid profile URLs provided",
        details: errors.map((e) => ({ url: e.url, reason: e.error })),
      },
      { status: 400 }
    );
  }

  // Check cache (include discovery flag in key)
  const cacheKey = discoverRelated
    ? `${MemoryCache.urlsKey(valid)}:discovered`
    : MemoryCache.urlsKey(valid);
  const cached = enrichmentCache.get(cacheKey);
  if (cached) {
    recordHit("enrich", `${valid.length} URLs`);
    return NextResponse.json(cached, {
      headers: { "X-Cache": "hit" },
    });
  }

  // Call TinyFish only for valid URLs
  const result = await enrich(valid, { discoverRelated: Boolean(discoverRelated) });

  // Add validation errors as failed results
  const fullResult = [
    ...result,
    ...errors.map((e) => ({
      url: e.url,
      markdown: "",
      success: false,
      reason: e.error,
    })),
  ];

  // Cache successful results
  enrichmentCache.set(cacheKey, fullResult);
  recordMiss("enrich", `${valid.length} URLs`);

  return NextResponse.json(fullResult, {
    headers: { "X-Cache": "miss" },
  });
}
