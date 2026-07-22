import { NextRequest, NextResponse } from "next/server";
import { readAccountSession } from "@/lib/auth/session";
import { checkRateLimit, getClientId } from "@/lib/rate-limit";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const SPEECH_ENGINE_ID = process.env.SPEECH_ENGINE_ID;

export async function GET(request: NextRequest) {
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
  }
  if (!SPEECH_ENGINE_ID) {
    return NextResponse.json({ error: "SPEECH_ENGINE_ID not set" }, { status: 501 });
  }

  const session = readAccountSession(request);
  const clientId = getClientId(request) || session?.userId || "guest";
  const limit = await checkRateLimit(clientId, "voice-token", {
    maxRequests: 10,
    windowSeconds: 60,
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many requests", resetIn: limit.resetIn },
      { status: 429, headers: { "Retry-After": String(limit.resetIn) } }
    );
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${encodeURIComponent(SPEECH_ENGINE_ID)}`,
      {
        method: "GET",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
        },
      }
    );

    if (!res.ok) {
      console.error(`[voice-token] ElevenLabs error: ${res.status}`);
      return NextResponse.json(
        { error: "Failed to generate conversation token" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[voice-token] Network error:", err);
    return NextResponse.json(
      { error: "Failed to generate conversation token" },
      { status: 500 }
    );
  }
}
