import { NextRequest, NextResponse } from "next/server";
import { persistTrace, persistAssetManifest } from "@/lib/storage/media-store";
import type { PersistResult } from "@/lib/storage/media-store";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { getMediaStorageProvider } from "@/lib/storage";

/**
 * POST /api/persist/trace
 * Persist the pipeline trace JSON and build a per-share asset manifest in B2.
 * Called after all assets (video, audio, thumbnail) have been persisted.
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
      { error: "No media storage provider configured" },
      { status: 503 }
    );
  }

  try {
    const { shareId, trace, assets } = await request.json();

    if (!shareId) {
      return NextResponse.json({ error: "shareId is required" }, { status: 400 });
    }

    const results: string[] = [];

    if (trace && Object.keys(trace).length > 0) {
      const { url } = await persistTrace(trace, shareId);
      if (url) results.push(url);
    }

    if (Array.isArray(assets) && assets.length > 0) {
      const { url } = await persistAssetManifest(
        shareId,
        assets as PersistResult[]
      );
      if (url) results.push(url);
    }

    return NextResponse.json({ persisted: results });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to persist trace" },
      { status: 500 }
    );
  }
}
