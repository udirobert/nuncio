import { NextRequest, NextResponse } from "next/server";
import { generateSoundEffect, VIBE_PRESETS } from "@/lib/elevenlabs";
import { genblazeSoundscape, isGenblazeWorkerConfigured } from "@/lib/genblaze-client";
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
    const { context, preview, shareId } = await request.json();

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

    const duration = preview ? 3 : 20;

    // Try Genblaze worker first (gives B2 URL + provenance manifest)
    if (isGenblazeWorkerConfigured() && shareId && !preview) {
      const result = await genblazeSoundscape(prompt, shareId, duration);
      if (result) {
        return NextResponse.json({
          audio: result.asset.url,
          context,
          duration,
          provider: "genblaze",
          manifestUri: result.asset.manifest_uri,
          sha256: result.asset.sha256,
        });
      }
    }

    // Fallback: direct ElevenLabs call (returns base64 data URL)
    const audioBuffer = await generateSoundEffect(prompt, duration, 0.8);
    const base64Audio = audioBuffer.toString("base64");
    return NextResponse.json({
      audio: `data:audio/mpeg;base64,${base64Audio}`,
      context,
      duration,
      provider: "elevenlabs-direct",
    });
  } catch (error) {
    console.error("[soundscape] Generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate soundscape" },
      { status: 500 }
    );
  }
}
