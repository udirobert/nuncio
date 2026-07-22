import { NextRequest, NextResponse } from "next/server";
import { generateSoundEffect, VIBE_PRESETS } from "@/lib/elevenlabs";
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
    const { context, preview } = await request.json();

    if (!context) {
      return NextResponse.json(
        { error: "Context is required for soundscape generation" },
        { status: 400 }
      );
    }

    const preset = VIBE_PRESETS.find((p) => p.id === context);
    const prompt = preset
      ? preset.prompt
      : `Ambient background soundscape for: ${context}. Subtle, non-distracting, high quality foley.`;

    // Preview mode: 3s clip for the customization panel
    // Full mode: 20s loop for the actual video
    const duration = preview ? 3 : 20;
    const audioBuffer = await generateSoundEffect(prompt, duration, 0.8);

    const base64Audio = audioBuffer.toString("base64");
    return NextResponse.json({
      audio: `data:audio/mpeg;base64,${base64Audio}`,
      context,
      duration,
    });
  } catch (error) {
    console.error("[soundscape] Generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate soundscape" },
      { status: 500 }
    );
  }
}
