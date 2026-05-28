import { NextResponse } from "next/server";

export async function GET() {
  const agentId = process.env.SPEECH_ENGINE_ID;

  if (!agentId) {
    return NextResponse.json(
      { error: "Speech engine not configured — set SPEECH_ENGINE_ID" },
      { status: 501 }
    );
  }

  return NextResponse.json({ agentId });
}
