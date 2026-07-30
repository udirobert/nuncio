import { NextRequest, NextResponse } from "next/server";
import { genblazeThumbnail, isGenblazeWorkerConfigured } from "@/lib/genblaze-client";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/thumbnail
 * Generate a custom video thumbnail via Genblaze worker (GMI Cloud).
 * Falls back gracefully if the worker is unavailable.
 */
export async function POST(request: NextRequest) {
  const clientId = getClientId(request);
  const limit = await checkRateLimit(clientId, "video", RATE_LIMITS.video);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${limit.resetIn}s.` },
      { status: 429, headers: { "Retry-After": String(limit.resetIn) } }
    );
  }

  if (!isGenblazeWorkerConfigured()) {
    return NextResponse.json(
      { error: "Genblaze worker not configured" },
      { status: 503 }
    );
  }

  try {
    const { prompt, shareId } = await request.json();

    if (!prompt || !shareId) {
      return NextResponse.json(
        { error: "prompt and shareId are required" },
        { status: 400 }
      );
    }

    const result = await genblazeThumbnail(prompt, shareId);
    if (!result) {
      return NextResponse.json(
        { error: "Thumbnail generation failed" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      thumbnailUrl: result.asset.url,
      sha256: result.asset.sha256,
      provider: result.provider,
      manifestUri: result.asset.manifest_uri,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Thumbnail generation failed" },
      { status: 500 }
    );
  }
}
