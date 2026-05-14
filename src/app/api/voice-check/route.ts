import { NextRequest, NextResponse } from "next/server";
import { assessVoiceQuality } from "@/lib/speechmatics";

/**
 * POST /api/voice-check
 * Assess voice clone sample quality before sending to HeyGen.
 * Returns quality score and any issues that might affect clone quality.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("audio") as File | null;

    if (!file) {
      return NextResponse.json(
        { error: "No audio file provided" },
        { status: 400 }
      );
    }

    const result = await assessVoiceQuality(file);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Voice quality check failed" },
      { status: 500 }
    );
  }
}
