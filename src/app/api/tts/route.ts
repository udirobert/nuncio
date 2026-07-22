import { NextRequest, NextResponse } from "next/server";
import { textToSpeech } from "@/lib/elevenlabs";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const clientId = getClientId(request);
  const limit = await checkRateLimit(clientId, "video", RATE_LIMITS.video);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${limit.resetIn}s.` },
      { status: 429, headers: { "Retry-After": String(limit.resetIn) } }
    );
  }

  try {
    const { text, voiceId } = await request.json();

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "text is required" }, { status: 400 });
    }

    // Limit to 500 chars for preview, 2000 for full audio memo
    if (text.length > 2000) {
      return NextResponse.json({ error: "Text too long (max 2000 chars)" }, { status: 400 });
    }

    const audioBuffer = await textToSpeech(text, { voiceId });
    const base64Audio = audioBuffer.toString("base64");

    return NextResponse.json({
      audio: `data:audio/mpeg;base64,${base64Audio}`,
      chars: text.length,
    });
  } catch (error) {
    console.error("[tts] Generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "TTS generation failed" },
      { status: 500 }
    );
  }
}
