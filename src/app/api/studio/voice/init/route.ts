import { NextResponse } from "next/server";

export async function GET() {
  const wsUrl = process.env.VOICE_PUBLIC_URL;
  const voiceServerPort = process.env.VOICE_SERVER_PORT || "3001";

  if (!wsUrl) {
    return NextResponse.json(
      { error: "Voice server not configured — set VOICE_PUBLIC_URL" },
      { status: 501 }
    );
  }

  return NextResponse.json({
    wsUrl: `${wsUrl.replace(/\/$/, "")}/api/voice/ws`,
    port: voiceServerPort,
    status: "available",
  });
}
