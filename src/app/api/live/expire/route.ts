import { NextRequest, NextResponse } from "next/server";
import { expireStaleLiveSessions } from "@/lib/live-session";

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.NUNCIO_LIVELINK_CRON_TOKEN;
  if (!expected) return false;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return provided === expected;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const expired = await expireStaleLiveSessions();
    return NextResponse.json({ expired: expired.length, sessions: expired.map((session) => session.id) });
  } catch (error) {
    console.error("[api/live/expire] error:", error);
    return NextResponse.json({ error: "Failed to expire live sessions" }, { status: 500 });
  }
}
