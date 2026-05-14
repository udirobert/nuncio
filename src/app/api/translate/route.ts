import { NextRequest, NextResponse } from "next/server";
import { translateVideo } from "@/lib/heygen";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * POST /api/translate
 * Translate a rendered video to another language using HeyGen Video Translate + Lipsync.
 */
export async function POST(request: NextRequest) {
  // Rate limit
  const clientId = getClientId(request);
  const limit = checkRateLimit(clientId, "translate", RATE_LIMITS.translate);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${limit.resetIn} seconds.` },
      {
        status: 429,
        headers: { "Retry-After": String(limit.resetIn) },
      }
    );
  }

  try {
    const { videoId, targetLanguage } = await request.json();

    if (!videoId || !targetLanguage) {
      return NextResponse.json(
        { error: "videoId and targetLanguage are required" },
        { status: 400 }
      );
    }

    const result = await translateVideo(videoId, targetLanguage);
    return NextResponse.json({
      translationId: result.translationId,
      status: "processing",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Translation failed" },
      { status: 500 }
    );
  }
}
