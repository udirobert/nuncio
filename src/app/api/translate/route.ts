import { NextRequest, NextResponse } from "next/server";
import { translateVideo } from "@/lib/heygen";

/**
 * POST /api/translate
 * Translate a rendered video to another language using HeyGen Video Translate + Lipsync.
 */
export async function POST(request: NextRequest) {
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
