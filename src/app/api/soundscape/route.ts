import { NextRequest, NextResponse } from "next/server";
import { generateAmbientVibe } from "@/lib/elevenlabs";
import { checkRateLimit, getClientId, RATE_LIMITS } from "@/lib/rate-limit";
import { getProofStorageProvider } from "@/lib/storage";

export async function POST(request: NextRequest) {
  // Use same rate limit as video for now as it's a generative operation
  const clientId = getClientId(request);
  const limit = checkRateLimit(clientId, "video", RATE_LIMITS.video);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: `Rate limited. Try again in ${limit.resetIn}s.` },
      { status: 429, headers: { "Retry-After": String(limit.resetIn) } }
    );
  }

  try {
    const { context } = await request.json();

    if (!context) {
      return NextResponse.json(
        { error: "Context is required for soundscape generation" },
        { status: 400 }
      );
    }

    const audioBuffer = await generateAmbientVibe(context);
    
    // For the hackathon, we'll store this in Grove if enabled,
    // otherwise return the base64 data for immediate use/caching
    const proofProvider = getProofStorageProvider();
    
    if (proofProvider && proofProvider.name === "grove") {
      // In a real scenario, we'd have a specific upload method for assets.
      // For now, we'll return base64 and let the client handle it or implement
      // a dedicated upload helper if we find one in the codebase.
      const base64Audio = audioBuffer.toString("base64");
      return NextResponse.json({
        audio: `data:audio/mpeg;base64,${base64Audio}`,
        context
      });
    }

    const base64Audio = audioBuffer.toString("base64");
    return NextResponse.json({
      audio: `data:audio/mpeg;base64,${base64Audio}`,
      context
    });

  } catch (error) {
    console.error("[soundscape] Generation failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate soundscape" },
      { status: 500 }
    );
  }
}
