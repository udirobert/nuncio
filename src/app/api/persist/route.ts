import { NextRequest, NextResponse } from "next/server";
import { persistVideoToGrove, isGroveEnabled } from "@/lib/grove";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/persist
 * Download a video from a temporary URL (e.g., HeyGen signed URL)
 * and upload to Grove for permanent, publicly-accessible storage.
 *
 * Returns the permanent Grove gateway URL that never expires.
 */
export async function POST(request: NextRequest) {
  // Rate limit — same as video (expensive operation)
  const clientId = getClientId(request);
  const limit = checkRateLimit(clientId, "video", RATE_LIMITS.video);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${limit.resetIn} seconds.` },
      { status: 429, headers: { "Retry-After": String(limit.resetIn) } }
    );
  }

  if (!isGroveEnabled()) {
    return NextResponse.json(
      { error: "Grove storage is not enabled" },
      { status: 503 }
    );
  }

  try {
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: "videoUrl is required" },
        { status: 400 }
      );
    }

    const result = await persistVideoToGrove(videoUrl);

    return NextResponse.json({
      permanentUrl: result.gatewayUrl,
      storageKey: result.storageKey,
      uri: result.uri,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to persist video" },
      { status: 500 }
    );
  }
}
