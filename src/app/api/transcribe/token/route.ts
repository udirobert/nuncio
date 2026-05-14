import { NextResponse } from "next/server";
import { generateRealtimeToken } from "@/lib/speechmatics";

/**
 * GET /api/transcribe/token
 * Generate a short-lived JWT for the browser to connect to
 * Speechmatics realtime WebSocket API directly.
 */
export async function GET() {
  try {
    const token = await generateRealtimeToken();
    return NextResponse.json({ token });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate token" },
      { status: 500 }
    );
  }
}
