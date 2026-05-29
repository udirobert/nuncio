import { NextRequest, NextResponse } from "next/server";
import { getVideoStatus } from "@/lib/heygen";
import { getVideoStatusFromCache } from "@/lib/video-status-cache";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check webhook cache first — instant if HeyGen already called back
    const cached = getVideoStatusFromCache(id);
    if (cached) {
      return NextResponse.json({
        status: cached.status,
        videoUrl: cached.videoUrl,
        failureMessage: cached.failureMessage,
      });
    }

    const result = await getVideoStatus(id);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        status: "failed",
        error: error instanceof Error ? error.message : "Failed to fetch video status",
      },
      { status: 502 }
    );
  }
}
