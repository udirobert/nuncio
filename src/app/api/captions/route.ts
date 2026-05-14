import { NextRequest, NextResponse } from "next/server";
import {
  transcribeVideoUrl,
  generateCaptions,
} from "@/lib/speechmatics";

/**
 * POST /api/captions
 * Generate captions/subtitles for a rendered video.
 * Fetches the video, transcribes it via Speechmatics, returns timed segments.
 */
export async function POST(request: NextRequest) {
  try {
    const { videoUrl } = await request.json();

    if (!videoUrl) {
      return NextResponse.json(
        { error: "videoUrl is required" },
        { status: 400 }
      );
    }

    const transcription = await transcribeVideoUrl(videoUrl);
    const captions = generateCaptions(transcription);

    return NextResponse.json({
      transcript: transcription.transcript,
      confidence: transcription.confidence,
      captions,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Caption generation failed" },
      { status: 500 }
    );
  }
}
