import { NextRequest, NextResponse } from "next/server";

const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;
const HEYGEN_BASE_URL = "https://api.heygen.com";

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

    if (!HEYGEN_API_KEY) {
      return NextResponse.json(
        { error: "HEYGEN_API_KEY is not configured" },
        { status: 500 }
      );
    }

    const response = await fetch(`${HEYGEN_BASE_URL}/v1/video_translate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${HEYGEN_API_KEY}`,
      },
      body: JSON.stringify({
        video_id: videoId,
        target_language: targetLanguage,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return NextResponse.json(
        { error: `Translation failed: ${error}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({
      translationId: data.data?.video_translate_id || data.data?.id,
      status: "processing",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Translation failed" },
      { status: 500 }
    );
  }
}
