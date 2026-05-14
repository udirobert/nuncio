import { NextRequest, NextResponse } from "next/server";
import { transcribeFile } from "@/lib/speechmatics";

/**
 * POST /api/transcribe
 * Transcribe an uploaded audio file (batch mode).
 * Used for voice clone quality check and sender brief voice input.
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

    const result = await transcribeFile(file, file.name);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Transcription failed" },
      { status: 500 }
    );
  }
}
