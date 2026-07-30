import { NextRequest, NextResponse } from "next/server";
import { persistVideo } from "@/lib/storage/media-store";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { getMediaStorageProvider } from "@/lib/storage";

/**
 * POST /api/persist
 * Download a video from a temporary URL (e.g., HeyGen signed URL)
 * and upload to B2 for permanent, publicly-accessible storage.
 * Falls back to the original URL if B2 is not configured.
 */
export async function POST(request: NextRequest) {
  const clientId = getClientId(request);
  const limit = await checkRateLimit(clientId, "video", RATE_LIMITS.video);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${limit.resetIn} seconds.` },
      { status: 429, headers: { "Retry-After": String(limit.resetIn) } }
    );
  }

  if (!getMediaStorageProvider()) {
    return NextResponse.json(
      { error: "No media storage provider configured (set B2_* env vars)" },
      { status: 503 }
    );
  }

  try {
    const { videoUrl, shareId } = await request.json();

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const id = shareId || crypto.randomUUID();
    const { url, result } = await persistVideo(videoUrl, id);

    return NextResponse.json({
      permanentUrl: url,
      provider: result?.provider ?? "fallback",
      sha256: result?.sha256,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to persist video" },
      { status: 500 }
    );
  }
}
