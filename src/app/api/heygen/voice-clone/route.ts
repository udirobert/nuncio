import { NextRequest, NextResponse } from "next/server";
import { cloneVoice, getVoiceCloneStatus } from "@/lib/heygen";

/**
 * POST /api/heygen/voice-clone — Clone a voice from an uploaded audio URL.
 * GET /api/heygen/voice-clone?id=xxx — Poll voice clone status.
 */
export async function POST(request: NextRequest) {
  try {
    const { audioUrl, name } = await request.json();

    if (!audioUrl) {
      return NextResponse.json({ error: "audioUrl is required" }, { status: 400 });
    }

    const result = await cloneVoice(audioUrl, name);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[heygen/voice-clone] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Voice clone failed" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  const voiceId = request.nextUrl.searchParams.get("id");
  if (!voiceId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  try {
    const status = await getVoiceCloneStatus(voiceId);
    return NextResponse.json(status);
  } catch (err) {
    console.error("[heygen/voice-clone] Status error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Status check failed" },
      { status: 500 }
    );
  }
}
