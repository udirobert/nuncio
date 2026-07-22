import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { synthesise, generateScript } from "@/lib/claude";
import { ServerCache } from "@/lib/server-cache";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { recordHit, recordMiss } from "@/lib/cache-metrics";
import {
  commitCreditReservation,
  estimateCreditCost,
  getCreditBalance,
  getCreditSubject,
  InsufficientCreditsError,
  refundCreditReservation,
  reserveCredits,
} from "@/lib/billing/credits";

const CACHE_TTL_MINUTES = 15;

function hashInput(data: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(data))
    .digest("hex")
    .slice(0, 16);
}

export async function POST(request: NextRequest) {
  // Rate limit
  const clientId = getClientId(request);
  const limit = await checkRateLimit(clientId, "script", RATE_LIMITS.script);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${limit.resetIn} seconds.` },
      {
        status: 429,
        headers: { "Retry-After": String(limit.resetIn) },
      }
    );
  }

  const { enrichment, senderBrief, intent, forceFallback, profileOnly } = await request.json();

  if (!enrichment || !Array.isArray(enrichment) || enrichment.length === 0) {
    return NextResponse.json(
      { error: "Enrichment data is required" },
      { status: 400 }
    );
  }

  const cache = ServerCache.getInstance();
  const subject = getCreditSubject(request);
  const creditCost = estimateCreditCost("script.generate");
  let reservationId: string | undefined;

  async function ensureReservation(): Promise<void> {
    if (reservationId) return;
    const reservation = await reserveCredits({
      subject,
      action: "script.generate",
      amount: creditCost,
      reason: profileOnly ? "Synthesize recipient profile" : "Generate outreach script",
      provider: "llm",
    });
    reservationId = reservation.id;
  }

  // Helper: cache-aware fetch with structured hit/miss logging
  // Uses cache.getOrSet internally for cross-request in-flight dedup.
  async function cached<T>(
    key: string,
    label: string,
    fetch: () => Promise<T>,
  ): Promise<{ value: T; fromCache: boolean }> {
    const hit = await cache.get<T>(key);
    if (hit !== null) {
      recordHit("script", label);
      return { value: hit, fromCache: true };
    }
    recordMiss("script", label);
    await ensureReservation();
    const value = await cache.getOrSet(key, fetch, CACHE_TTL_MINUTES);
    return { value, fromCache: false };
  }

  try {
    // --- Pass 1: Profile synthesis ---
    const synthesisKey = `script:synthesis:${hashInput({ enrichment, forceFallback })}`;
    const { value: profile, fromCache: synthesisCached } = await cached(
      synthesisKey,
      "synthesis",
      () => synthesise(enrichment, { forceFallback }),
    );

    // If profileOnly, return just the profile (for coach mode angle preview)
    if (profileOnly) {
      if (reservationId) await commitCreditReservation(reservationId);
      return NextResponse.json(
        { profile, script: null },
        {
          headers: {
            "X-Cache": synthesisCached ? "hit" : "miss",
            "X-Cache-Step": "synthesis",
            "X-Nuncio-Credits-Charged": synthesisCached ? "0" : String(creditCost),
            "X-Nuncio-Credits-Balance": String(await getCreditBalance(subject)),
          },
        },
      );
    }

    // --- Pass 2: Script generation ---
    const scriptKey = `script:generate:${hashInput({ profile, senderBrief, intent, forceFallback })}`;
    const { value: scriptResult, fromCache: scriptCached } = await cached(
      scriptKey,
      "script generation",
      () => generateScript(profile, senderBrief, { forceFallback, intent }),
    );

    if (reservationId) await commitCreditReservation(reservationId);

    console.log(
      JSON.stringify({
        event: "script.result",
        synthesis: synthesisCached ? "cache" : "fresh",
        script: scriptCached ? "cache" : "fresh",
      }),
    );

    return NextResponse.json(
      { profile, script: scriptResult.script, vibeId: scriptResult.vibeId, vibeReasoning: scriptResult.vibeReasoning },
      {
        headers: {
          "X-Cache": scriptCached ? "hit" : "miss",
          "X-Cache-Step": "script",
          "X-Cache-Synthesis": synthesisCached ? "hit" : "miss",
          "X-Nuncio-Credits-Charged": reservationId ? String(creditCost) : "0",
          "X-Nuncio-Credits-Balance": String(await getCreditBalance(subject)),
        },
      },
    );
  } catch (error) {
    if (reservationId) {
      await refundCreditReservation(reservationId);
    }

    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: error.message,
          requiredCredits: error.required,
          availableCredits: error.available,
        },
        { status: 402 }
      );
    }

    throw error;
  }
}
