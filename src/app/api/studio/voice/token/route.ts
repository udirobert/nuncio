import { NextResponse } from "next/server";

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const SPEECH_ENGINE_ID = process.env.SPEECH_ENGINE_ID;

export async function GET() {
  if (!ELEVENLABS_API_KEY) {
    return NextResponse.json({ error: "ELEVENLABS_API_KEY not configured" }, { status: 500 });
  }
  if (!SPEECH_ENGINE_ID) {
    return NextResponse.json({ error: "SPEECH_ENGINE_ID not set" }, { status: 501 });
  }

  try {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/convai/conversation/token`,
      {
        method: "POST",
        headers: {
          "xi-api-key": ELEVENLABS_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agent_id: SPEECH_ENGINE_ID }),
      }
    );

    if (!res.ok) {
      const body = await res.text();
      return NextResponse.json(
        { error: `ElevenLabs token error: ${res.status}`, detail: body },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to get token" },
      { status: 500 }
    );
  }
}
